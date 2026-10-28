"""Persistent user identity; passwords must be hashed before assignment."""
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Identity,
    PrimaryKeyConstraint,
    String,
    UniqueConstraint,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, validates

from app.core.email_policy import normalize_student_email
from app.db.base import Base


class User(Base):
    __tablename__ = 'users'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='pk_users'),
        UniqueConstraint('email', name='uq_users_email'),
        CheckConstraint(
            "email = lower(btrim(email)) AND length(email) > 0",
            name='ck_users_email_normalized',
        ),
        CheckConstraint(
            "email ~ '^[0-9]+@ogr[.]halic[.]edu[.]tr$'",
            name='ck_users_email_halic_student',
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=true())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @validates('email')
    def normalize_email(self, key: str, value: str) -> str:
        return normalize_student_email(value)
