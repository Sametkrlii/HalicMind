from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Identity, Index, Numeric, String, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Enrollment(Base):
    __tablename__ = 'enrollments'
    __table_args__ = (
        UniqueConstraint('id', 'user_id', name='uq_enrollments_id_owner'),
        ForeignKeyConstraint(['term_id', 'user_id'], ['academic_terms.id', 'academic_terms.user_id'], ondelete='RESTRICT', name='fk_enrollments_term_owner'),
        CheckConstraint("status IN ('in_progress','passed','failed','withdrawn','exempt')", name='ck_enrollments_status'),
        CheckConstraint('(course_id IS NULL) = (course_revision_id IS NULL)', name='ck_enrollments_catalog_pair'),
        CheckConstraint('ects IS NULL OR ects BETWEEN 0 AND 120', name='ck_enrollments_ects'),
        CheckConstraint('length(trim(course_code)) > 0 AND course_code = upper(trim(course_code))', name='ck_enrollments_code'),
        CheckConstraint('length(trim(course_name)) > 0', name='ck_enrollments_name'),
        Index('uq_enrollments_catalog_active', 'term_id', 'course_id', unique=True, postgresql_where=text('archived_at IS NULL AND course_id IS NOT NULL')),
        Index('uq_enrollments_custom_active', 'term_id', 'course_code', unique=True, postgresql_where=text('archived_at IS NULL AND course_id IS NULL')),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id', ondelete='RESTRICT'), nullable=False, index=True)
    term_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    course_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey('courses.id', ondelete='RESTRICT'))
    course_revision_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey('course_revisions.id', ondelete='RESTRICT'))
    course_code: Mapped[str] = mapped_column(String(100), nullable=False)
    course_name: Mapped[str] = mapped_column(String(500), nullable=False)
    ects: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    grade: Mapped[str | None] = mapped_column(String(20))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
