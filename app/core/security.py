"""Password hashes, short-lived access tokens and opaque email challenges."""
from datetime import datetime, timedelta, timezone
import hashlib
import secrets

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.config import settings

password_hash = PasswordHash.recommended()
DUMMY_PASSWORD_HASH = password_hash.hash(secrets.token_urlsafe(32))
JWT_ISSUER = 'halicmind'
JWT_AUDIENCE = 'halicmind-api'


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return password_hash.verify(password, hashed_password)
    except (UnknownHashError, ValueError):
        return False


def hash_verification_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            'sub': str(user_id), 'iat': now,
            'exp': now + timedelta(minutes=settings.access_token_expire_minutes),
            'iss': JWT_ISSUER, 'aud': JWT_AUDIENCE, 'type': 'access',
        },
        settings.jwt_secret_key.get_secret_value(), algorithm='HS256',
    )


def decode_access_token(token: str) -> int:
    payload = jwt.decode(
        token, settings.jwt_secret_key.get_secret_value(), algorithms=['HS256'],
        issuer=JWT_ISSUER, audience=JWT_AUDIENCE,
        options={'require': ['sub', 'iat', 'exp', 'iss', 'aud', 'type']},
    )
    subject = payload['sub']
    if (
        payload['type'] != 'access' or not isinstance(subject, str)
        or not subject.isascii() or not subject.isdigit() or len(subject) > 19
        or not 0 < int(subject) <= 9223372036854775807
    ):
        raise jwt.InvalidTokenError('Invalid access token subject or type')
    return int(subject)
