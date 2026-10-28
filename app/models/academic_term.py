from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Identity, SmallInteger, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AcademicTerm(Base):
    __tablename__ = 'academic_terms'
    __table_args__ = (
        UniqueConstraint('id', 'user_id', name='uq_terms_id_owner'),
        UniqueConstraint('user_id', 'academic_year', 'term_type', 'is_preparation', name='uq_terms_calendar'),
        CheckConstraint('academic_year BETWEEN 1900 AND 2200', name='ck_terms_year'),
        CheckConstraint("term_type IN ('fall','spring','summer','annual')", name='ck_terms_type'),
        CheckConstraint("(curriculum_period_kind IS NULL AND curriculum_period_number IS NULL) OR (curriculum_period_kind IS NOT NULL AND curriculum_period_number IS NOT NULL AND ((curriculum_period_kind = 'semester' AND curriculum_period_number BETWEEN 1 AND 24) OR (curriculum_period_kind = 'year' AND curriculum_period_number BETWEEN 1 AND 12)))", name='ck_terms_curriculum_period'),
        CheckConstraint('NOT is_preparation OR curriculum_period_kind IS NULL', name='ck_terms_preparation'),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    program_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('programs.id', ondelete='RESTRICT'), nullable=False)
    curriculum_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('curricula.id', ondelete='RESTRICT'), nullable=False)
    academic_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    term_type: Mapped[str] = mapped_column(String(10), nullable=False)
    is_preparation: Mapped[bool] = mapped_column(Boolean, nullable=False)
    curriculum_period_kind: Mapped[str | None] = mapped_column(String(10))
    curriculum_period_number: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
