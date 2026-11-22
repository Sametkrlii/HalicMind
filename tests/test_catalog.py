from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.db.session import engine

client = TestClient(app)

def test_health_and_units():
    assert client.get('/health').json() == {'status': 'ok', 'database': 'postgresql'}
    assert len(client.get('/api/v1/catalog/academic-units').json()) == 11

def test_program_filter():
    response = client.get('/api/v1/catalog/programs', params={'academic_unit_id': 4})
    assert response.status_code == 200
    assert response.json() and all(p['academic_unit_id'] == 4 for p in response.json())
    assert len(client.get('/api/v1/catalog/programs').json()) == 167

def test_courses_filter_and_pagination():
    result = client.get('/api/v1/catalog/courses', params={'program_id': 22, 'limit': 200})
    assert result.status_code == 200
    assert result.json() and all(c['program_id'] == 22 for c in result.json())
    first = client.get('/api/v1/catalog/courses', params={'limit': 1}).json()
    second = client.get('/api/v1/catalog/courses', params={'limit': 1, 'offset': 1}).json()
    assert first != second
    assert client.get('/api/v1/catalog/courses', params={'limit': 201}).status_code == 422
    assert client.get('/api/v1/catalog/courses', params={'q': "' OR 1=1 --"}).json() == []

def test_annual_plans_and_curricula():
    result = client.get('/api/v1/catalog/courses', params={'program_id': 42, 'limit': 200})
    assert result.status_code == 200
    assert result.json() and all(c['period_kind'] == 'year' and c['semester'] is None for c in result.json())
    assert client.get('/api/v1/catalog/curricula').status_code == 200
    rows = client.get('/api/v1/catalog/curricula', params={'program_id': 22}).json()
    assert rows and all(c['program_id'] == 22 for c in rows)

def test_identity_sequences():
    with engine.connect() as conn:
        for table in ('academic_units', 'programs', 'curricula', 'courses', 'course_revisions', 'elective_groups', 'curriculum_courses'):
            seq = conn.execute(text("SELECT pg_get_serial_sequence(:t,'id')"), {'t': table}).scalar_one()
            maximum = conn.execute(text(f'SELECT max(id) FROM {table}')).scalar_one()
            value = conn.execute(text(f'SELECT last_value FROM {seq}')).scalar_one()
            assert value >= (maximum or 1)


def test_import_preserves_legacy_checksums_across_checkout_line_endings(tmp_path, monkeypatch):
    import hashlib
    from contextlib import nullcontext
    from uuid import uuid4

    import psycopg
    import pytest
    from scripts import import_catalog

    catalog = tmp_path / 'catalog'
    catalog.mkdir()
    sources = {
        'schema.sql': 'CREATE TABLE labels (name text);\n',
        'research_extension.sql': '-- Kaynak bilgisi\n',
        'catalog_data_postgresql.sql': "INSERT INTO labels VALUES ('Türkçe');\n",
        '002_university_electives.sql': "INSERT INTO labels VALUES ('Seçmeli');\n",
    }
    for name, sql in sources.items():
        (catalog / name).write_bytes(sql.encode('utf-8'))
    url = import_catalog.settings.database_url.replace('postgresql+psycopg://', 'postgresql://', 1)
    with psycopg.connect(url) as conn, conn.transaction(force_rollback=True):
        schema = 'test_catalog_' + uuid4().hex
        conn.execute(f'CREATE SCHEMA "{schema}"')
        conn.execute(f'SET LOCAL search_path TO "{schema}"')
        monkeypatch.setattr(import_catalog, 'ROOT', tmp_path)
        monkeypatch.setattr(import_catalog.psycopg, 'connect', lambda _: nullcontext(conn))
        import_catalog.main()
        old_bytes = ''.join(list(sources.values())[:3]).replace('\n', '\r\n').encode('utf-8')
        old_digest = hashlib.sha256(old_bytes).hexdigest()
        conn.execute("UPDATE catalog_migrations SET checksum=%s WHERE version='001'", (old_digest,))
        import_catalog.main()  # LF checkout with a previous Windows installation
        for name, sql in sources.items():
            (catalog / name).write_bytes(sql.replace('\n', '\r\n').encode('utf-8'))
        import_catalog.main()  # CRLF checkout with a canonical checksum for 002
        assert conn.execute('SELECT name FROM labels ORDER BY name').fetchall() == [('Seçmeli',), ('Türkçe',)]
        assert conn.execute('SELECT count(*) FROM catalog_migrations').fetchone() == (2,)
        (catalog / 'schema.sql').write_bytes(b'-- changed\n')
        with pytest.raises(RuntimeError, match='001 changed'):
            import_catalog.main()
