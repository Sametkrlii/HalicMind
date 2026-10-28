"""Generate private Docker development credentials without replacing an existing .env."""
import os
import argparse
from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parents[1]


def auth_settings():
    return {
        'JWT_SECRET_KEY': secrets.token_hex(32),
        'ACCESS_TOKEN_EXPIRE_MINUTES': '30',
        'EMAIL_VERIFICATION_EXPIRE_MINUTES': '30',
        'SMTP_HOST': '127.0.0.1',
        'SMTP_PORT': '1025',
        'SMTP_TLS_MODE': 'none',
        'SMTP_FROM': 'noreply@halicmind.local',
    }


def add_auth_settings(path: Path):
    """Append missing auth keys without replacing existing credentials/settings."""
    from dotenv import dotenv_values

    with path.open('r+', encoding='utf-8') as file:
        existing = dotenv_values(stream=file)
        missing = {key: value for key, value in auth_settings().items() if key not in existing}
        if missing:
            file.seek(0, os.SEEK_END)
            file.write('\n' + ''.join(f'{key}={value}\n' for key, value in missing.items()))


def create_env(path: Path):
    password = secrets.token_hex(24)
    # Exclusive creation protects existing native PostgreSQL credentials too.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as file:
        file.write(f'POSTGRES_PASSWORD={password}\n')
        file.write(f'DATABASE_URL=postgresql+psycopg://halicmind:{password}@127.0.0.1:5433/halicmind\n')
        for key, value in auth_settings().items():
            file.write(f'{key}={value}\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--add-auth-settings', action='store_true', help='Append missing auth settings to an existing .env')
    args = parser.parse_args()
    if args.add_auth_settings:
        add_auth_settings(ROOT / '.env')
        print('Missing auth settings added; existing values preserved.')
        raise SystemExit(0)
    try:
        create_env(ROOT / '.env')
    except FileExistsError:
        raise SystemExit('Existing .env preserved. See README for changing an existing database password.')
    print('Created .env with unique local credentials. Do not commit this file.')
