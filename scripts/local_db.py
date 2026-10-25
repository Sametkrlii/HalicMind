"""Manage an isolated local PostgreSQL 17 cluster: setup, start, stop, status."""
import argparse
import os
from pathlib import Path
import secrets
import subprocess
import getpass
import psycopg
from psycopg import sql
from dotenv import dotenv_values
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / '.local' / 'postgres'
SOCKET = Path('/tmp') / f'halicmind-{os.getuid()}-5433'
BIN = Path(os.environ.get('PG_BIN', '/opt/homebrew/opt/postgresql@17/bin'))

def run(*args):
    subprocess.run([str(BIN / args[0]), *map(str, args[1:])], check=True)

def start():
    SOCKET.mkdir(mode=0o700, exist_ok=True)
    result = subprocess.run([str(BIN / 'pg_ctl'), '-D', str(DATA), 'status'], capture_output=True)
    if result.returncode:
        run('pg_ctl', '-D', DATA, '-l', ROOT / '.local' / 'postgres.log', '-w', 'start')

def setup():
    DATA.parent.mkdir(exist_ok=True)
    if not (DATA / 'PG_VERSION').exists():
        run('initdb', '-D', DATA, '--encoding=UTF8', '--locale=C', '--auth-local=peer', '--auth-host=scram-sha-256')
        with (DATA / 'postgresql.conf').open('a') as f:
            f.write(f"\nlisten_addresses = '127.0.0.1'\nport = 5433\nunix_socket_directories = '{SOCKET}'\ntimezone = 'Europe/Istanbul'\n")
    start()
    env_file = ROOT / '.env'
    if not env_file.exists():
        fd = os.open(env_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as f:
            f.write(f'DATABASE_URL=postgresql+psycopg://halicmind:{secrets.token_hex(24)}@127.0.0.1:5433/halicmind\n')
    url = make_url(dotenv_values(env_file)['DATABASE_URL'])
    if url.host != '127.0.0.1' or url.port != 5433 or url.database != 'halicmind' or url.username != 'halicmind':
        raise RuntimeError('Local setup requires the local halicmind URL; existing .env was preserved.')
    with psycopg.connect(dbname='postgres', host=str(SOCKET), port=5433, user=getpass.getuser(), autocommit=True) as conn:
        if not conn.execute("SELECT 1 FROM pg_roles WHERE rolname='halicmind'").fetchone():
            conn.execute(sql.SQL('CREATE ROLE halicmind LOGIN PASSWORD {}').format(sql.Literal(url.password)))
        if not conn.execute("SELECT 1 FROM pg_database WHERE datname='halicmind'").fetchone():
            conn.execute('CREATE DATABASE halicmind OWNER halicmind')
    print('Local PostgreSQL ready at 127.0.0.1:5433/halicmind')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['setup', 'start', 'stop', 'status'])
    action = parser.parse_args().action
    if action == 'setup':
        setup()
    elif action == 'start':
        start()
    else:
        run('pg_ctl', '-D', DATA, action)
