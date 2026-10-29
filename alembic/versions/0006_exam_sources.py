"""Versioned official exam sources and sync status; no catalog or personal data edits."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
revision = '0006_exam_sources'
down_revision = '0005_assignments'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('exam_documents',
        sa.Column('id',sa.BigInteger(),sa.Identity(),primary_key=True),
        sa.Column('announcement_url',sa.Text(),nullable=False),
        sa.Column('file_url',sa.Text(),nullable=False),
        sa.Column('title',sa.Text(),nullable=False),
        sa.Column('academic_year',sa.Integer(),nullable=False),
        sa.Column('term_type',sa.String(10),nullable=False),
        sa.Column('exam_type',sa.String(12),nullable=False),
        sa.Column('checksum',sa.String(64),nullable=False),
        sa.Column('current',sa.Boolean(),nullable=False),
        sa.Column('status',sa.String(16),nullable=False),
        sa.Column('rows',JSONB(),nullable=False),
        sa.Column('warnings',JSONB(),nullable=False),
        sa.Column('checked_at',sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),
        sa.Column('imported_at',sa.DateTime(timezone=True),server_default=sa.func.now(),nullable=False),
        sa.UniqueConstraint('file_url','checksum',name='uq_exam_document_version'))
    op.create_index('ix_exam_documents_academic_year','exam_documents',['academic_year'])
    op.create_table('exam_sync_state',
        sa.Column('id',sa.Integer(),primary_key=True),
        sa.Column('status',sa.String(16),nullable=False),
        sa.Column('checked_at',sa.DateTime(timezone=True)),
        sa.Column('succeeded_at',sa.DateTime(timezone=True)),
        sa.Column('errors',JSONB(),nullable=False),
        sa.Column('files_seen',sa.Integer(),nullable=False))

    op.create_table('exam_selections',
        sa.Column('enrollment_id',sa.BigInteger(),primary_key=True),
        sa.Column('exam_type',sa.String(12),primary_key=True),
        sa.Column('user_id',sa.BigInteger(),nullable=False),
        sa.Column('document_id',sa.BigInteger(),nullable=False),
        sa.Column('sheet',sa.String(100),nullable=False),
        sa.Column('row_number',sa.Integer(),nullable=False),
        sa.ForeignKeyConstraint(['enrollment_id','user_id'],['enrollments.id','enrollments.user_id'],name='fk_exam_selection_owner',ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['document_id'],['exam_documents.id'],ondelete='RESTRICT'),
        sa.CheckConstraint("exam_type IN ('midterm','final','makeup','resit')",name='ck_exam_selection_type'))


def downgrade():
    op.drop_table('exam_selections')
    op.drop_table('exam_sync_state')
    op.drop_index('ix_exam_documents_academic_year',table_name='exam_documents')
    op.drop_table('exam_documents')
