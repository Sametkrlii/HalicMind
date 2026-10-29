"""Shared official source versions; personal exams are resolved by ownership at read time."""
from datetime import datetime
from sqlalchemy import ForeignKeyConstraint, CheckConstraint, BigInteger, Boolean, DateTime, Identity, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ExamDocument(Base):
    __tablename__ = 'exam_documents'
    __table_args__ = (UniqueConstraint('file_url', 'checksum', name='uq_exam_document_version'),)
    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    announcement_url: Mapped[str] = mapped_column(Text)
    file_url: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    academic_year: Mapped[int] = mapped_column(Integer, index=True)
    term_type: Mapped[str] = mapped_column(String(10))
    exam_type: Mapped[str] = mapped_column(String(12))
    checksum: Mapped[str] = mapped_column(String(64))
    current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(16))
    rows: Mapped[list] = mapped_column(JSONB, nullable=False)
    warnings: Mapped[list] = mapped_column(JSONB, nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExamSyncState(Base):
    __tablename__ = 'exam_sync_state'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(String(16))
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    succeeded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    errors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    files_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class ExamSelection(Base):
    __tablename__ = 'exam_selections'
    __table_args__ = (
        ForeignKeyConstraint(['enrollment_id','user_id'],['enrollments.id','enrollments.user_id'],name='fk_exam_selection_owner',ondelete='RESTRICT'),
        ForeignKeyConstraint(['document_id'],['exam_documents.id'],ondelete='RESTRICT'),
        CheckConstraint("exam_type IN ('midterm','final','makeup','resit')",name='ck_exam_selection_type'),
    )
    enrollment_id: Mapped[int] = mapped_column(BigInteger,primary_key=True)
    exam_type: Mapped[str] = mapped_column(String(12),primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger,nullable=False)
    document_id: Mapped[int] = mapped_column(BigInteger,nullable=False)
    sheet: Mapped[str] = mapped_column(String(100),nullable=False)
    row_number: Mapped[int] = mapped_column(Integer,nullable=False)
