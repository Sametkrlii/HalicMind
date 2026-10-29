"""Personal assignments; catalog tables and existing academic data stay intact.

Revision ID: 0005_assignments
Revises: 0004_academic_planning
"""
from alembic import op
import sqlalchemy as sa

revision = '0005_assignments'
down_revision = '0004_academic_planning'
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint('uq_enrollments_id_owner', 'enrollments', ['id', 'user_id'])
    op.create_table('assignments',
        sa.Column('id', sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('enrollment_id', sa.BigInteger(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('priority', sa.String(10), nullable=False),
        sa.Column('estimated_minutes', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(12), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['enrollment_id', 'user_id'], ['enrollments.id', 'enrollments.user_id'], name='fk_assignments_enrollment_owner', ondelete='RESTRICT'),
        sa.CheckConstraint("status IN ('pending','completed')", name='ck_assignments_status'),
        sa.CheckConstraint("priority IN ('low','normal','high')", name='ck_assignments_priority'),
        sa.CheckConstraint("(status='pending' AND completed_at IS NULL) OR (status='completed' AND completed_at IS NOT NULL)", name='ck_assignments_completion'),
        sa.CheckConstraint('length(trim(title)) > 0', name='ck_assignments_title'),
        sa.CheckConstraint('estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 10080', name='ck_assignments_estimate'),
    )
    op.create_index('ix_assignments_owner_due', 'assignments', ['user_id', 'due_at'])
    op.create_index('ix_assignments_enrollment_id', 'assignments', ['enrollment_id'])


def downgrade():
    op.drop_index('ix_assignments_enrollment_id', table_name='assignments')
    op.drop_index('ix_assignments_owner_due', table_name='assignments')
    op.drop_table('assignments')
    op.drop_constraint('uq_enrollments_id_owner', 'enrollments', type_='unique')
