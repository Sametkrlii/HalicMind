"""Restrict user email addresses to Halic student accounts.

Revision ID: 0002_halic_student_email
Revises: 0001_create_users
"""
from alembic import op

revision = '0002_halic_student_email'
down_revision = '0001_create_users'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL validates existing rows too. Incompatible data causes failure
    # and transaction rollback; this migration never deletes or edits accounts.
    op.create_check_constraint(
        'ck_users_email_halic_student',
        'users',
        "email ~ '^[0-9]+@ogr[.]halic[.]edu[.]tr$'",
    )


def downgrade() -> None:
    op.drop_constraint('ck_users_email_halic_student', 'users', type_='check')
