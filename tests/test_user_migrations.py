"""PostgreSQL integration tests isolated in a transactional, temporary schema."""
import pytest
from alembic import command
from alembic.autogenerate import produce_migrations
from alembic.migration import MigrationContext
from sqlalchemy import Column, Integer, MetaData, Table, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.migrations import include_name, include_object
from app.models import User

def test_upgrade_downgrade_and_autogenerate_preserve_catalog(migration_db):
    connection, config = migration_db
    # Guard both reflected catalog tables and accidentally imported catalog models.
    metadata = MetaData()
    User.__table__.to_metadata(metadata)
    Table('academic_units', metadata, Column('id', Integer, primary_key=True))
    context = MigrationContext.configure(connection, opts={
        'include_name': include_name,
        'include_object': include_object,
    })
    operations = produce_migrations(context, metadata).upgrade_ops.ops
    assert len(operations) == 1
    assert operations[0].table_name == 'users'

    before_tables = set(inspect(connection).get_table_names())
    command.upgrade(config, 'head')
    assert set(inspect(connection).get_table_names()) == before_tables | {
        'users', 'email_verifications', 'auth_rate_limits', 'alembic_version',
        'academic_profiles', 'academic_terms', 'enrollments', 'assignments', 'exam_documents', 'exam_sync_state', 'exam_selections',
    }
    assert connection.scalar(text('SELECT version_num FROM alembic_version')) == '0006_exam_sources'
    command.check(config)  # No schema drift and no catalog DROP proposals.
    command.upgrade(config, 'head')  # Reapplying must be a no-op.
    command.downgrade(config, 'base')
    assert 'users' not in inspect(connection).get_table_names()
    assert connection.execute(text('SELECT id,name_tr FROM programs WHERE id=22')).all() == [(22, 'Catalog sentinel')]
    assert connection.scalar(text('SELECT version FROM catalog_migrations')) == '001'
    command.upgrade(config, 'head')
    command.check(config)


def test_user_normalization_defaults_and_unique_email(migration_db):
    connection, config = migration_db
    command.upgrade(config, 'head')
    with Session(bind=connection, join_transaction_mode='create_savepoint') as session:
        user = User(email='  23000000001@OGR.HALIC.EDU.TR  ', full_name='Test Student', hashed_password='test-hash')
        session.add(user)
        session.flush()
        assert user.email == '23000000001@ogr.halic.edu.tr'
        assert user.id > 0 and user.is_active is True
        assert user.created_at.utcoffset() is not None
        user.email = ' 23000000002@OGR.HALIC.EDU.TR '
        session.flush()
        assert user.email == '23000000002@ogr.halic.edu.tr'
        with pytest.raises(IntegrityError) as duplicate:
            with session.begin_nested():
                session.add(User(email=' 23000000002@OGR.HALIC.EDU.TR ', full_name='Duplicate', hashed_password='hash'))
                session.flush()
        assert duplicate.value.orig.diag.constraint_name == 'uq_users_email'


@pytest.mark.parametrize('email', [' Mixed@Example.com ', '', 'UPPER@example.com'])
def test_database_rejects_non_normalized_email(migration_db, email):
    connection, config = migration_db
    command.upgrade(config, '0001_create_users')
    with pytest.raises(IntegrityError) as invalid:
        with connection.begin_nested():
            connection.execute(
                text('INSERT INTO users (email, full_name, hashed_password) VALUES (:email, :name, :hash)'),
                {'email': email, 'name': 'Test Student', 'hash': 'test-hash'},
            )
    assert invalid.value.orig.diag.constraint_name == 'ck_users_email_normalized'


def test_database_enforces_email_uniqueness_for_direct_sql(migration_db):
    connection, config = migration_db
    command.upgrade(config, 'head')
    statement = text("INSERT INTO users (email, full_name, hashed_password) VALUES ('23000000001@ogr.halic.edu.tr', 'Test', 'hash')")
    connection.execute(statement)
    with pytest.raises(IntegrityError) as duplicate:
        with connection.begin_nested():
            connection.execute(statement)
    assert duplicate.value.orig.diag.constraint_name == 'uq_users_email'


def test_model_rejects_blank_email():
    with pytest.raises(ValueError, match='Email must not be empty'):
        User(email=' \t\n ', full_name='Test', hashed_password='hash')


REJECTED_EMAILS = [
    'student@gmail.com',
    '23000000001@outlook.com',
    '23000000001@halic.edu.tr',
    '23000000001@ogr.other.edu.tr',
    '23000000001@ogr.halic.edu.tr.evil.com',
    '23000000001@evilogr.halic.edu.tr',
    'student@ogr.halic.edu.tr',
    '@ogr.halic.edu.tr',
    '23000000001@@ogr.halic.edu.tr',
    '230 00000001@ogr.halic.edu.tr',
    '٢٣٠٠٠٠٠٠٠٠١@ogr.halic.edu.tr',
    '23000000001@ogr.halic.edu.tr\nextra',
]


@pytest.mark.parametrize('email', REJECTED_EMAILS)
def test_model_rejects_email_outside_student_policy(email):
    with pytest.raises(ValueError, match='Haliç Üniversitesi'):
        User(email=email, full_name='Test', hashed_password='hash')


@pytest.mark.parametrize('email', REJECTED_EMAILS)
def test_database_rejects_email_outside_student_policy(migration_db, email):
    connection, config = migration_db
    command.upgrade(config, 'head')
    with pytest.raises(IntegrityError) as invalid:
        with connection.begin_nested():
            connection.execute(
                text('INSERT INTO users (email, full_name, hashed_password) VALUES (:email, :name, :hash)'),
                {'email': email, 'name': 'Test Student', 'hash': 'test-hash'},
            )
    assert invalid.value.orig.diag.constraint_name == 'ck_users_email_halic_student'


def test_student_email_migration_preserves_users_on_downgrade(migration_db):
    connection, config = migration_db
    command.upgrade(config, 'head')
    connection.execute(text("""
        INSERT INTO users (email, full_name, hashed_password)
        VALUES ('23000000001@ogr.halic.edu.tr', 'Test', 'hash')
    """))
    command.downgrade(config, '0001_create_users')
    assert connection.scalar(text('SELECT email FROM users')) == '23000000001@ogr.halic.edu.tr'
    command.upgrade(config, 'head')
    assert connection.scalar(text('SELECT count(*) FROM users')) == 1


def test_student_email_migration_refuses_existing_personal_accounts(migration_db):
    connection, config = migration_db
    command.upgrade(config, '0001_create_users')
    connection.execute(text("""
        INSERT INTO users (email, full_name, hashed_password)
        VALUES ('student@gmail.com', 'Test', 'hash')
    """))
    with pytest.raises(IntegrityError):
        with connection.begin_nested():
            command.upgrade(config, 'head')
    assert connection.scalar(text('SELECT email FROM users')) == 'student@gmail.com'
    assert connection.scalar(text('SELECT version_num FROM alembic_version')) == '0001_create_users'
