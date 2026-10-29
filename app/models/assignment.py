from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Identity, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Assignment(Base):
    __tablename__ = 'assignments'
    __table_args__ = (
        ForeignKeyConstraint(['enrollment_id', 'user_id'], ['enrollments.id', 'enrollments.user_id'], ondelete='RESTRICT', name='fk_assignments_enrollment_owner'),
        CheckConstraint("status IN ('pending','completed')", name='ck_assignments_status'),
        CheckConstraint("priority IN ('low','normal','high')", name='ck_assignments_priority'),
        CheckConstraint("(status='pending' AND completed_at IS NULL) OR (status='completed' AND completed_at IS NOT NULL)", name='ck_assignments_completion'),
        CheckConstraint('length(trim(title)) > 0', name='ck_assignments_title'),
        CheckConstraint('estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 10080', name='ck_assignments_estimate'),
        Index('ix_assignments_owner_due', 'user_id', 'due_at'),
    )
    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id', ondelete='RESTRICT'), nullable=False)
    enrollment_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    priority: Mapped[str] = mapped_column(String(10), nullable=False)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
