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
