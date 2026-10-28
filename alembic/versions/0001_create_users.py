"""Create users; existing catalog tables remain owned by the catalog importer.

Revision ID: 0001_create_users
Revises: None
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_create_users'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column('email', sa.String(254), nullable=False),
        sa.Column('full_name', sa.String(200), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_users'),
        sa.UniqueConstraint('email', name='uq_users_email'),
        sa.CheckConstraint(
            'email = lower(btrim(email)) AND length(email) > 0',
            name='ck_users_email_normalized',
        ),
    )


def downgrade() -> None:
    op.drop_table('users')
