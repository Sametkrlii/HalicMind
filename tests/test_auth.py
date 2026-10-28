from datetime import datetime, timedelta, timezone
import secrets

import jwt
import pytest
from sqlalchemy import text

from app.core.config import settings
from app.core.security import JWT_AUDIENCE, JWT_ISSUER, create_access_token, hash_verification_token, verify_password

EMAIL = '23000000001@ogr.halic.edu.tr'
PASSWORD = 'Test-password-123!'


def register(env, **changes):
    body = {'email': EMAIL, 'full_name': ' Test Student ', 'password': PASSWORD}
    body.update(changes)
    return env.client.post('/api/v1/auth/register', json=body)


def login(env, email=EMAIL, password=PASSWORD):
    return env.client.post('/api/v1/auth/login', data={'username': email, 'password': password})


def verify(env, token=None):
    return env.client.post('/api/v1/auth/verify-email', json={'token': token or env.mailer.messages[-1]['token']})


def expire_limits(env):
    env.connection.execute(text("UPDATE auth_rate_limits SET expires_at = now() - interval '1 second'"))


def verified_token(env):
    assert register(env).status_code == 201
    assert verify(env).status_code == 200
    response = login(env)
    assert response.status_code == 200
    return response.json()['access_token']


def test_register_verify_login_and_me(auth_app):
    env = auth_app
    response = register(env, email=' 23000000001@OGR.HALIC.EDU.TR ')
    assert response.status_code == 201
    assert 'token' not in response.json() and PASSWORD not in response.text
    row = env.connection.execute(text('SELECT * FROM users')).mappings().one()
    assert row['email'] == EMAIL and row['full_name'] == 'Test Student'
    assert row['hashed_password'].startswith('$argon2id$')
    assert verify_password(PASSWORD, row['hashed_password'])
    assert row['email_verified_at'] is None and row['is_active'] is True
    assert login(env).status_code == 403
    challenge = env.connection.scalar(text('SELECT token_hash FROM email_verifications'))
    raw = env.mailer.messages[-1]['token']
    assert challenge == hash_verification_token(raw) and challenge != raw
    assert verify(env).status_code == 200
    assert verify(env).status_code == 400  # Single use, even after success.
    assert env.connection.scalar(text('SELECT count(*) FROM email_verifications')) == 0
    logged_in = login(env, email=' 23000000001@OGR.HALIC.EDU.TR ')
    assert logged_in.status_code == 200
    assert logged_in.headers['cache-control'] == 'no-store'
    assert logged_in.json()['expires_in'] == 1800
    token = logged_in.json()['access_token']
    me = env.client.get('/api/v1/users/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200
    assert me.json()['email'] == EMAIL and me.json()['email_verified_at'] is not None
    assert 'hashed_password' not in me.json() and 'password' not in me.json()


@pytest.mark.parametrize('changes', [
    {'email': 'student@gmail.com'}, {'email': None}, {'email': 123},
    {'email': '23000000001@ogr.halic.edu.tr.evil.com'},
    {'full_name': '  '}, {'password': 'short'}, {'password': 'a' * 129},
    {'email_verified_at': '2026-01-01T00:00:00Z'}, {'is_active': False},
])
def test_registration_validation_does_not_leak_secrets(auth_app, changes):
    response = register(auth_app, **changes)
    assert response.status_code == 422
    assert PASSWORD not in response.text
    assert all('input' not in error for error in response.json()['detail'])
    assert auth_app.connection.scalar(text('SELECT count(*) FROM users')) == 0
    assert auth_app.mailer.messages == []


def test_duplicate_registration_and_resend_cooldown(auth_app):
    env = auth_app
    assert register(env).status_code == 201
    assert register(env).status_code == 429
    assert env.client.post('/api/v1/auth/resend-verification', json={'email': EMAIL}).status_code == 429
    expire_limits(env)
    assert register(env).status_code == 409
    assert env.connection.scalar(text('SELECT count(*) FROM users')) == 1
    assert len(env.mailer.messages) == 1


def test_resend_invalidates_old_token_and_expired_tokens_fail(auth_app):
    env = auth_app
    assert register(env).status_code == 201
    old_token = env.mailer.messages[-1]['token']
    env.connection.execute(text("UPDATE email_verifications SET expires_at = now() - interval '1 second'"))
    assert verify(env).status_code == 400
    expire_limits(env)
    assert env.client.post('/api/v1/auth/resend-verification', json={'email': EMAIL}).status_code == 202
    assert env.mailer.messages[-1]['token'] != old_token
    assert verify(env, old_token).status_code == 400
    assert verify(env).status_code == 200


def test_resend_does_not_disclose_account_presence(auth_app):
    env = auth_app
    unknown = env.client.post('/api/v1/auth/resend-verification', json={'email': EMAIL})
    assert unknown.status_code == 202 and env.mailer.messages == []
    expire_limits(env)
    assert register(env).status_code == 201
    assert verify(env).status_code == 200
    expire_limits(env)
    known = env.client.post('/api/v1/auth/resend-verification', json={'email': EMAIL})
    assert known.status_code == 202 and known.json() == unknown.json()
    assert len(env.mailer.messages) == 1


def test_mail_failure_preserves_pending_account_and_can_recover(auth_app):
    env = auth_app
    env.mailer.fail = True
    assert register(env).status_code == 503
    assert env.connection.scalar(text('SELECT email_verified_at FROM users')) is None
    assert env.connection.scalar(text('SELECT count(*) FROM users')) == 1
    assert login(env).status_code == 403
    env.mailer.fail = False
    expire_limits(env)
    assert env.client.post('/api/v1/auth/resend-verification', json={'email': EMAIL}).status_code == 202
    assert verify(env).status_code == 200
    assert login(env).status_code == 200


def test_wrong_password_and_unknown_email_share_error(auth_app):
    env = auth_app
    assert register(env).status_code == 201
    wrong = login(env, password='Wrong-password-123')
    unknown = login(env, email='23000000002@ogr.halic.edu.tr')
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.headers['www-authenticate'] == 'Bearer'


def test_disabled_and_unverified_users_cannot_use_tokens(auth_app):
    env = auth_app
    token = verified_token(env)
    headers = {'Authorization': f'Bearer {token}'}
    env.connection.execute(text('UPDATE users SET email_verified_at = NULL'))
    assert env.client.get('/api/v1/users/me', headers=headers).status_code == 401
    env.connection.execute(text('UPDATE users SET email_verified_at = now(), is_active = false'))
    assert env.client.get('/api/v1/users/me', headers=headers).status_code == 401
    assert login(env).status_code == 401


def test_inactive_account_cannot_be_verified_or_resent(auth_app):
    env = auth_app
    assert register(env).status_code == 201
    env.connection.execute(text('UPDATE users SET is_active = false'))
    assert verify(env).status_code == 400
    expire_limits(env)
    assert env.client.post('/api/v1/auth/resend-verification', json={'email': EMAIL}).status_code == 202
    assert len(env.mailer.messages) == 1


@pytest.mark.parametrize('change', [
    {'exp': 1}, {'aud': 'other'}, {'iss': 'other'}, {'type': 'email-verification'},
    {'sub': 'invalid'}, {'sub': '0'}, {'sub': '99999999999999999999'},
    {'sub': '9223372036854775807'}, {'exp': None},
])
def test_invalid_jwt_claims_are_rejected(auth_app, change):
    now = datetime.now(timezone.utc)
    claims = {'sub': '1', 'iat': now, 'exp': now + timedelta(minutes=30),
              'iss': JWT_ISSUER, 'aud': JWT_AUDIENCE, 'type': 'access'}
    claims.update(change)
    if claims['exp'] is None:
        del claims['exp']
    token = jwt.encode(claims, settings.jwt_secret_key.get_secret_value(), algorithm='HS256')
    assert auth_app.client.get('/api/v1/users/me', headers={'Authorization': f'Bearer {token}'}).status_code == 401


def test_missing_tampered_or_wrongly_signed_token_is_rejected(auth_app):
    env = auth_app
    token = verified_token(env)
    claims = jwt.decode(token, options={'verify_signature': False})
    wrong_key = jwt.encode(claims, 'another-secret-key-of-at-least-32-characters', algorithm='HS256')
    for candidate in ['broken', wrong_key, token + 'modified']:
        response = env.client.get('/api/v1/users/me', headers={'Authorization': f'Bearer {candidate}'})
        assert response.status_code == 401
    assert env.client.get('/api/v1/users/me').status_code == 401
    assert env.client.get('/api/v1/users/me', headers={'Authorization': f'Bearer {create_access_token(999999)}'}).status_code == 401


def test_unknown_verification_code_and_limits(auth_app):
    env = auth_app
    for _ in range(20):
        assert verify(env, secrets.token_urlsafe(32)).status_code == 400
    response = verify(env, secrets.token_urlsafe(32))
    assert response.status_code == 429 and int(response.headers['retry-after']) > 0


def test_login_limit_survives_requests_and_ignores_forwarded_header(auth_app):
    env = auth_app
    for _ in range(10):
        assert login(env).status_code == 401
    response = env.client.post('/api/v1/auth/login', data={'username': EMAIL, 'password': PASSWORD},
                               headers={'X-Forwarded-For': '1.2.3.4'})
    assert response.status_code == 429
    expire_limits(env)
    assert login(env).status_code == 401


def test_openapi_exposes_swagger_oauth_flow(auth_app):
    schema = auth_app.client.get('/openapi.json').json()
    assert schema['components']['securitySchemes']['OAuth2PasswordBearer']['flows']['password']['tokenUrl'] == 'api/v1/auth/login'
    assert schema['paths']['/api/v1/users/me']['get']['security'] == [{'OAuth2PasswordBearer': []}]
    assert not schema['paths']['/api/v1/catalog/courses']['get'].get('security')


def test_registration_ip_limit_and_resend_hourly_limit(auth_app):
    env = auth_app
    for number in range(5):
        assert register(env, email=f'2300000000{number}@ogr.halic.edu.tr').status_code == 201
    assert register(env, email='23000000009@ogr.halic.edu.tr').status_code == 429
    assert env.connection.scalar(text('SELECT count(*) FROM users')) == 5
    expire_limits(env)
    for _ in range(5):
        # Advance only the short cooldown/IP window, retaining the hourly key.
        env.connection.execute(text("UPDATE auth_rate_limits SET expires_at = now() - interval '1 second' WHERE expires_at < now() + interval '10 minutes'"))
        assert env.client.post('/api/v1/auth/resend-verification', json={'email': EMAIL}).status_code == 202
    env.connection.execute(text("UPDATE auth_rate_limits SET expires_at = now() - interval '1 second' WHERE expires_at < now() + interval '10 minutes'"))
    assert env.client.post('/api/v1/auth/resend-verification', json={'email': EMAIL}).status_code == 429
