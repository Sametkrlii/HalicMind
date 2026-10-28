"""PostgreSQL fixtures roll back all test schemas and application writes."""
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import engine, get_db
from app.main import app
from app.services.mail import MailDeliveryError, get_mailer


@pytest.fixture
def migration_db():
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            schema = f'test_users_{uuid4().hex}'
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            root = Path(__file__).resolve().parents[1]
            for name in ('schema.sql', 'research_extension.sql'):
                sql = '\n'.join(line for line in (root / 'catalog' / name).read_text().splitlines()
                                if line.strip().upper() not in {'BEGIN;', 'COMMIT;'})
                connection.connection.driver_connection.execute(sql, prepare=False)
            connection.execute(text("""
                INSERT INTO academic_units (id,source_key,name_tr,unit_type) VALUES (1,'test','Test','faculty');
                INSERT INTO programs (id,academic_unit_id,source_key,name_tr,degree_level) VALUES
                    (22,1,'test22','Catalog sentinel','bachelor'),
                    (23,1,'test23','Other program','bachelor'),
                    (42,1,'test42','Annual program','bachelor');
                INSERT INTO curricula (id,program_id,source_key,label,entry_year,semester_count,source_url,last_verified_at) VALUES
                    (22,22,'test22','Test curriculum',2023,8,'https://example.com',current_date),
                    (23,23,'test23','Other curriculum',NULL,8,'https://example.com',current_date),
                    (42,42,'test42','Annual curriculum',NULL,12,'https://example.com',current_date);
                INSERT INTO courses (id,source_key,course_code) VALUES
                    (100,'22:MATH','MAT101'), (101,'22:ELECT','SEC101'), (102,'23:MATH','MAT101'),
                    (103,'42:ANNUAL','YIL101'), (104,'22:ADVANCED','MAT201'), (106,'22:SLOT','SEC1');
                INSERT INTO course_revisions (id,course_id,revision_key,name_tr,ects,source_url,last_verified_at) VALUES
                    (100,100,'v1','Matematik',5,'https://example.com',current_date),
                    (101,101,'v1','Seçmeli ders',3,'https://example.com',current_date),
                    (102,102,'v1','Başka bölüm matematik',6,'https://example.com',current_date),
                    (103,103,'v1','Yıllık ders',10,'https://example.com',current_date),
                    (104,104,'v1','Üst sınıf dersi',5,'https://example.com',current_date),
                    (105,100,'v2','Matematik yeni sürüm',5,'https://example.com',current_date),
                    (106,106,'v1','Seçmeli grup',3,'https://example.com',current_date);
                INSERT INTO course_source_details (course_revision_id,name_original,hours_original)
                    SELECT id,name_tr,'2+0' FROM course_revisions;
                INSERT INTO elective_groups (id,curriculum_id,source_key,name,required_course_count,required_ects)
                    VALUES (10,22,'group1','Alan seçmelileri',1,3);
                INSERT INTO curriculum_courses (curriculum_id,course_revision_id,semester,course_type,elective_group_id) VALUES
                    (22,100,1,'required',NULL), (22,104,3,'required',NULL), (22,105,2,'required',NULL),
                    (22,106,1,'elective',10), (23,102,1,'required',NULL);
                INSERT INTO elective_group_courses VALUES (10,101,1);
                INSERT INTO annual_curriculum_courses (curriculum_id,course_revision_id,year_number,course_type)
                    VALUES (42,103,1,'required');
            """))
            connection.execute(text('CREATE TABLE catalog_migrations (version TEXT PRIMARY KEY)'))
            connection.execute(text("INSERT INTO catalog_migrations VALUES ('001')"))
            config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
            config.attributes['connection'] = connection
            yield connection, config
        finally:
            transaction.rollback()


class RecordingMailer:
    def __init__(self):
        self.messages = []
        self.fail = False

    def send_verification(self, email, token):
        if self.fail:
            raise MailDeliveryError('Test delivery failure')
        self.messages.append({'email': email, 'token': token})


@pytest.fixture
def auth_app(migration_db):
    connection, config = migration_db
    command.upgrade(config, 'head')
    mailer = RecordingMailer()

    def override_db():
        with Session(bind=connection, join_transaction_mode='create_savepoint') as session:
            yield session

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_mailer] = lambda: mailer
    client = TestClient(app)
    try:
        # Do not dispose the shared engine via app lifespan inside each test.
        yield SimpleNamespace(client=client, connection=connection, mailer=mailer)
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
