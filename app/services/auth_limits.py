"""Atomic PostgreSQL limits shared by all application workers."""
from datetime import datetime, timedelta, timezone
import hashlib
import math

from fastapi import HTTPException
from sqlalchemy import case, delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.auth import AuthRateLimit


def enforce_limit(db: Session, scope: str, identifier: str, limit: int, seconds: int):
    now = datetime.now(timezone.utc)
    key = hashlib.sha256(f'{scope}:{identifier}'.encode()).hexdigest()
    # Reclaim expired keys without storing email addresses or IPs in plaintext.
    db.execute(delete(AuthRateLimit).where(AuthRateLimit.expires_at < now - timedelta(days=1)))
    statement = insert(AuthRateLimit).values(key=key, attempts=1, expires_at=now + timedelta(seconds=seconds))
    expired = AuthRateLimit.expires_at <= now
    statement = statement.on_conflict_do_update(
        index_elements=[AuthRateLimit.key],
        set_={
            'attempts': case((expired, 1), else_=AuthRateLimit.attempts + 1),
            'expires_at': case((expired, statement.excluded.expires_at), else_=AuthRateLimit.expires_at),
        },
    ).returning(AuthRateLimit.attempts, AuthRateLimit.expires_at)
    attempts, expires_at = db.execute(statement).one()
    # Persist failed attempts too; the later business transaction is independent.
    db.commit()
    if attempts > limit:
        retry = max(1, math.ceil((expires_at - now).total_seconds()))
        raise HTTPException(429, 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.', headers={'Retry-After': str(retry)})
