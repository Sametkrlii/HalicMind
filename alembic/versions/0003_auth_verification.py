"""Add email verification state and persistent authentication rate limits."""
from alembic import op
import sqlalchemy as sa

revision = '0003_auth_verification'
down_revision = '0002_halic_student_email'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        'email_verifications',
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('user_id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('token_hash'),
    )
    op.create_table(
        'auth_rate_limits',
        sa.Column('key', sa.String(64), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('key'),
        sa.CheckConstraint('attempts > 0', name='ck_auth_rate_limits_attempts'),
    )
    op.create_index('ix_auth_rate_limits_expires_at', 'auth_rate_limits', ['expires_at'])


def downgrade():
    op.drop_index('ix_auth_rate_limits_expires_at', table_name='auth_rate_limits')
    op.drop_table('auth_rate_limits')
    op.drop_table('email_verifications')
    op.drop_column('users', 'email_verified_at')
