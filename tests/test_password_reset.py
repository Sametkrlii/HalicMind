from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import hash_reset_token, verify_password
from app.db.session import engine
from app.models import User
from app.services.auth import reset_password
from app.services.mail import MailDeliveryError
from tests.test_auth import EMAIL, PASSWORD, expire_limits, login, register, verified_token, verify
from tests.test_web import web_login


def request_code(env, email=EMAIL):
    return env.client.post('/api/v1/auth/forgot-password', json={'email': email})


def confirm(env, code, password='New-password-123!'):
    return env.client.post('/api/v1/auth/reset-password', json={'token': code, 'password': password})


def test_request_privacy_resend_expiry_and_session_revocation(auth_app):
    env = auth_app
    messages = []
    env.mailer.send_password_reset = lambda _, token: messages.append(token)
    unknown = request_code(env, '23000000999@ogr.halic.edu.tr')
    assert unknown.status_code == 202 and messages == []
    old_token = verified_token(env)
    assert web_login(env).status_code == 200
    response = request_code(env)
    assert response.status_code == 202 and response.json() == unknown.json()
    limited = request_code(env)
    assert limited.status_code == 429 and 0 < int(limited.headers['Retry-After']) <= response.json()['retry_after']
    code, = messages
    assert env.connection.scalar(text('SELECT reset_token_hash FROM users')) == hash_reset_token(code)
    env.connection.execute(text("UPDATE users SET reset_expires_at=now()-interval '1 second'"))
    assert confirm(env, code).status_code == 400
    expire_limits(env)
    assert request_code(env).status_code == 202
    replaced = messages[-1]
    expire_limits(env)
    assert request_code(env).status_code == 202
    assert confirm(env, replaced).status_code == 400
    assert confirm(env, messages[-1], 'short').status_code == 422
    assert confirm(env, messages[-1], PASSWORD).status_code == 422
    assert confirm(env, messages[-1]).status_code == 200
    assert confirm(env, messages[-1]).status_code == 400
    assert env.client.get('/api/v1/users/me').status_code == 401
    assert env.client.get('/api/v1/users/me',headers={'Authorization':'Bearer '+old_token}).status_code == 401
    assert login(env,password=PASSWORD).status_code == 401
    assert login(env,password='New-password-123!').status_code == 200


def test_reset_and_verification_codes_have_separate_purposes(auth_app):
    env = auth_app
    assert register(env).status_code == 201
    messages = []
    env.mailer.send_password_reset = lambda _, token: messages.append(token)
    assert request_code(env).status_code == 202
    assert verify(env, messages[0]).status_code == 400
    assert confirm(env, env.mailer.messages[0]['token']).status_code == 400
    assert confirm(env, messages[0]).status_code == 200
    assert login(env,password='New-password-123!').status_code == 403
    assert verify(env).status_code == 200


def test_reset_smtp_failure_does_not_expose_account_or_change_password(auth_app):
    env = auth_app
    verified_token(env)

    def fail(email, token):
        raise MailDeliveryError()

    env.mailer.send_password_reset = fail
    response = request_code(env)
    unknown = request_code(env,'23000000999@ogr.halic.edu.tr')
    assert response.status_code == unknown.status_code == 202
    assert response.json() == unknown.json()
    assert login(env).status_code == 200
    expire_limits(env)
    codes = []
    env.mailer.send_password_reset = lambda _, token: codes.append(token)
    assert request_code(env).status_code == 202
    assert confirm(env, codes[0]).status_code == 200


def test_concurrent_reset_can_commit_only_once():
    # Separate connections must see the same committed row for a PostgreSQL lock test.
    schema = 'test_reset_' + uuid4().hex
    scoped = engine.execution_options(schema_translate_map={None: schema})
    with scoped.begin() as con:
        con.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
        User.__table__.create(con)
    try:
        code = 'a' * 43
        passwords = ['First-new-password', 'Second-new-password']
        with Session(scoped) as db:
            db.add(User(email=EMAIL, full_name='Test', hashed_password='unused',
                        reset_token_hash=hash_reset_token(code),
                        reset_expires_at=datetime.now(timezone.utc)+timedelta(minutes=15)))
            db.commit()
        barrier = Barrier(2)
        def attempt(password):
            with Session(scoped) as db:
                barrier.wait(timeout=10)
                try:
                    reset_password(db, code, password)
                    return 200
                except HTTPException as exc:
                    return exc.status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(attempt, passwords))
        assert sorted(statuses) == [200,400]
        with Session(scoped) as db:
            user = db.get(User,1)
            assert user.session_version == 1 and user.reset_token_hash is None
            assert verify_password(passwords[statuses.index(200)], user.hashed_password)
    finally:
        with scoped.begin() as con:
            User.__table__.drop(con)
            con.exec_driver_sql(f'DROP SCHEMA "{schema}"')
