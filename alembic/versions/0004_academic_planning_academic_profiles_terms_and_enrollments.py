"""academic profiles terms and enrollments

Revision ID: 0004_academic_planning
Revises: 0003_auth_verification
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0004_academic_planning'
down_revision: Union[str, Sequence[str], None] = '0003_auth_verification'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add personal tables only. Catalog tables remain owned by the SQL importer.
    op.create_table('academic_profiles',
    sa.Column('user_id', sa.BigInteger(), nullable=False),
    sa.Column('program_id', sa.BigInteger(), nullable=False),
    sa.Column('curriculum_id', sa.BigInteger(), nullable=False),
    sa.Column('entry_year', sa.SmallInteger(), nullable=False),
    sa.Column('current_class', sa.SmallInteger(), nullable=False),
    sa.Column('preparation_status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("(preparation_status = 'in_progress' AND current_class = 0) OR (preparation_status <> 'in_progress' AND current_class >= 1)", name='ck_profile_preparation_class'),
    sa.CheckConstraint("preparation_status IN ('not_required','in_progress','completed','exempt')", name='ck_profile_preparation'),
    sa.CheckConstraint('current_class BETWEEN 0 AND 12', name='ck_profile_class'),
    sa.CheckConstraint('entry_year BETWEEN 1900 AND 2200', name='ck_profile_entry_year'),
    sa.ForeignKeyConstraint(['curriculum_id'], ['curricula.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('academic_terms',
    sa.Column('id', sa.BigInteger(), sa.Identity(always=False), nullable=False),
    sa.Column('user_id', sa.BigInteger(), nullable=False),
    sa.Column('program_id', sa.BigInteger(), nullable=False),
    sa.Column('curriculum_id', sa.BigInteger(), nullable=False),
    sa.Column('academic_year', sa.SmallInteger(), nullable=False),
    sa.Column('term_type', sa.String(length=10), nullable=False),
    sa.Column('is_preparation', sa.Boolean(), nullable=False),
    sa.Column('curriculum_period_kind', sa.String(length=10), nullable=True),
    sa.Column('curriculum_period_number', sa.SmallInteger(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("(curriculum_period_kind IS NULL AND curriculum_period_number IS NULL) OR (curriculum_period_kind IS NOT NULL AND curriculum_period_number IS NOT NULL AND ((curriculum_period_kind = 'semester' AND curriculum_period_number BETWEEN 1 AND 24) OR (curriculum_period_kind = 'year' AND curriculum_period_number BETWEEN 1 AND 12)))", name='ck_terms_curriculum_period'),
    sa.CheckConstraint("term_type IN ('fall','spring','summer','annual')", name='ck_terms_type'),
    sa.CheckConstraint('NOT is_preparation OR curriculum_period_kind IS NULL', name='ck_terms_preparation'),
    sa.CheckConstraint('academic_year BETWEEN 1900 AND 2200', name='ck_terms_year'),
    sa.ForeignKeyConstraint(['curriculum_id'], ['curricula.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id', 'user_id', name='uq_terms_id_owner'),
    sa.UniqueConstraint('user_id', 'academic_year', 'term_type', 'is_preparation', name='uq_terms_calendar')
    )
    op.create_index(op.f('ix_academic_terms_user_id'), 'academic_terms', ['user_id'], unique=False)
    op.create_table('enrollments',
    sa.Column('id', sa.BigInteger(), sa.Identity(always=False), nullable=False),
    sa.Column('user_id', sa.BigInteger(), nullable=False),
    sa.Column('term_id', sa.BigInteger(), nullable=False),
    sa.Column('course_id', sa.BigInteger(), nullable=True),
    sa.Column('course_revision_id', sa.BigInteger(), nullable=True),
    sa.Column('course_code', sa.String(length=100), nullable=False),
    sa.Column('course_name', sa.String(length=500), nullable=False),
    sa.Column('ects', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('grade', sa.String(length=20), nullable=True),
    sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('in_progress','passed','failed','withdrawn','exempt')", name='ck_enrollments_status'),
    sa.CheckConstraint('(course_id IS NULL) = (course_revision_id IS NULL)', name='ck_enrollments_catalog_pair'),
    sa.CheckConstraint('ects IS NULL OR ects BETWEEN 0 AND 120', name='ck_enrollments_ects'),
    sa.CheckConstraint('length(trim(course_code)) > 0 AND course_code = upper(trim(course_code))', name='ck_enrollments_code'),
    sa.CheckConstraint('length(trim(course_name)) > 0', name='ck_enrollments_name'),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['course_revision_id'], ['course_revisions.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['term_id', 'user_id'], ['academic_terms.id', 'academic_terms.user_id'], name='fk_enrollments_term_owner', ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_enrollments_term_id'), 'enrollments', ['term_id'], unique=False)
    op.create_index(op.f('ix_enrollments_user_id'), 'enrollments', ['user_id'], unique=False)
    op.create_index('uq_enrollments_catalog_active', 'enrollments', ['term_id', 'course_id'], unique=True, postgresql_where=sa.text('archived_at IS NULL AND course_id IS NOT NULL'))
    op.create_index('uq_enrollments_custom_active', 'enrollments', ['term_id', 'course_code'], unique=True, postgresql_where=sa.text('archived_at IS NULL AND course_id IS NULL'))


def downgrade() -> None:
    # Personal academic history is removed by downgrade; catalog/users stay intact.
    op.drop_index('uq_enrollments_custom_active', table_name='enrollments', postgresql_where=sa.text('archived_at IS NULL AND course_id IS NULL'))
    op.drop_index('uq_enrollments_catalog_active', table_name='enrollments', postgresql_where=sa.text('archived_at IS NULL AND course_id IS NOT NULL'))
    op.drop_index(op.f('ix_enrollments_user_id'), table_name='enrollments')
    op.drop_index(op.f('ix_enrollments_term_id'), table_name='enrollments')
    op.drop_table('enrollments')
    op.drop_index(op.f('ix_academic_terms_user_id'), table_name='academic_terms')
    op.drop_table('academic_terms')
    op.drop_table('academic_profiles')
