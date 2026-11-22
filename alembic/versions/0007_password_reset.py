"""Add single-use password reset challenges and per-user session revocation."""
from alembic import op
import sqlalchemy as sa

revision = '0007_password_reset'
down_revision = '0006_exam_sources'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('session_version', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('reset_token_hash', sa.String(64)))
    op.add_column('users', sa.Column('reset_expires_at', sa.DateTime(timezone=True)))
    op.create_unique_constraint('uq_users_reset_token_hash', 'users', ['reset_token_hash'])


def downgrade():
    op.drop_constraint('uq_users_reset_token_hash', 'users', type_='unique')
    op.drop_column('users', 'reset_expires_at')
    op.drop_column('users', 'reset_token_hash')
    op.drop_column('users', 'session_version')
