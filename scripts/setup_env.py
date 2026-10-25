"""Generate private Docker development credentials without replacing an existing .env."""
import os
from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parents[1]


def create_env(path: Path):
    password = secrets.token_hex(24)
    # Exclusive creation protects existing native PostgreSQL credentials too.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as file:
        file.write(f'POSTGRES_PASSWORD={password}\n')
        file.write(f'DATABASE_URL=postgresql+psycopg://halicmind:{password}@127.0.0.1:5433/halicmind\n')


if __name__ == '__main__':
    try:
        create_env(ROOT / '.env')
    except FileExistsError:
        raise SystemExit('Existing .env preserved. See README for changing an existing database password.')
    print('Created .env with unique local credentials. Do not commit this file.')
