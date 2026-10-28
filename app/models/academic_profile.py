from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AcademicProfile(Base):
    __tablename__ = 'academic_profiles'
    __table_args__ = (
        CheckConstraint('entry_year BETWEEN 1900 AND 2200', name='ck_profile_entry_year'),
        CheckConstraint('current_class BETWEEN 0 AND 12', name='ck_profile_class'),
        CheckConstraint("preparation_status IN ('not_required','in_progress','completed','exempt')", name='ck_profile_preparation'),
        CheckConstraint("(preparation_status = 'in_progress' AND current_class = 0) OR (preparation_status <> 'in_progress' AND current_class >= 1)", name='ck_profile_preparation_class'),
    )

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    program_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('programs.id', ondelete='RESTRICT'), nullable=False)
    curriculum_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('curricula.id', ondelete='RESTRICT'), nullable=False)
    entry_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    current_class: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    preparation_status: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
