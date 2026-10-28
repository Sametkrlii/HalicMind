"""Exercise real local SMTP delivery without leaving users in the database."""
from pathlib import Path
import re
import secrets
from uuid import uuid4

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import engine, get_db
from app.main import app


def main():
    if settings.smtp_host not in {'localhost', '127.0.0.1'} or settings.smtp_port != 1025:
        raise SystemExit('Smoke test requires local Mailpit on port 1025; no external SMTP is used.')
    email = f'{secrets.randbelow(10**11):011d}@ogr.halic.edu.tr'
    password = secrets.token_urlsafe(24)
    with engine.connect() as connection:
        transaction = connection.begin()
        previous = app.dependency_overrides.copy()
        try:
            schema = f'test_smoke_auth_{uuid4().hex}'
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            root = Path(__file__).resolve().parents[1]
            for name in ('schema.sql', 'research_extension.sql'):
                sql = '\n'.join(line for line in (root / 'catalog' / name).read_text().splitlines()
                                if line.strip().upper() not in {'BEGIN;', 'COMMIT;'})
                connection.connection.driver_connection.execute(sql, prepare=False)
            config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
            config.attributes['connection'] = connection
            command.upgrade(config, 'head')

            def override_db():
                with Session(bind=connection, join_transaction_mode='create_savepoint') as session:
                    yield session

            app.dependency_overrides[get_db] = override_db
            with httpx.Client(base_url='http://127.0.0.1:8025', trust_env=False, timeout=10) as inbox:
                response = inbox.get('/api/v1/messages')
                response.raise_for_status()
                old_ids = {message['ID'] for message in response.json()['messages']}
                client = TestClient(app)
                try:
                    response = client.post('/api/v1/auth/register', json={
                        'email': email, 'full_name': 'Local SMTP Test', 'password': password,
                    })
                    assert response.status_code == 201, f'Registration failed: {response.status_code}'
                    response = inbox.get('/api/v1/messages')
                    response.raise_for_status()
                    candidates = [message for message in response.json()['messages']
                                  if message['ID'] not in old_ids
                                  and any(recipient['Address'] == email for recipient in message['To'])]
                    assert len(candidates) == 1, 'Expected one message in local Mailpit'
                    response = inbox.get(f"/api/v1/message/{candidates[0]['ID']}")
                    response.raise_for_status()
                    codes = [line for line in response.json()['Text'].splitlines()
                             if re.fullmatch(r'[A-Za-z0-9_-]{43}', line)]
                    assert len(codes) == 1, 'Expected one verification code in the email'
                    response = client.post('/api/v1/auth/verify-email', json={'token': codes[0]})
                    assert response.status_code == 200, f'Verification failed: {response.status_code}'
                    response = client.post('/api/v1/auth/login', data={'username': email, 'password': password})
                    assert response.status_code == 200, f'Login failed: {response.status_code}'
                    token = response.json()['access_token']
                    response = client.get('/api/v1/users/me', headers={'Authorization': f'Bearer {token}'})
                    assert response.status_code == 200 and response.json()['email'] == email
                    assert response.json()['email_verified_at'] is not None
                    print('Local SMTP delivery -> email verification -> login -> /users/me: passed.')
                finally:
                    client.close()
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(previous)
            transaction.rollback()
    print('Temporary schema and user rolled back. Only the local sample email remains in Mailpit.')


if __name__ == '__main__':
    main()
