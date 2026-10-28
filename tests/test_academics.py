import pytest
from alembic import command
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.core.security import create_access_token

PROFILE = {'program_id': 22, 'curriculum_id': 22, 'entry_year': 2023, 'current_class': 2, 'preparation_status': 'completed'}
TERM = {'academic_year': 2026, 'term_type': 'fall', 'curriculum_period_kind': 'semester', 'curriculum_period_number': 1}


@pytest.fixture
def academic_app(auth_app):
    env = auth_app
    env.owner_id = env.connection.scalar(text("INSERT INTO users (email,full_name,hashed_password,email_verified_at) VALUES ('23000000001@ogr.halic.edu.tr','Owner','test-hash',now()) RETURNING id"))
    env.other_id = env.connection.scalar(text("INSERT INTO users (email,full_name,hashed_password,email_verified_at) VALUES ('23000000002@ogr.halic.edu.tr','Other','test-hash',now()) RETURNING id"))
    env.client.headers['Authorization'] = f'Bearer {create_access_token(env.owner_id)}'
    env.other_headers = {'Authorization': f'Bearer {create_access_token(env.other_id)}'}
    return env


def profile(env, **changes):
    return env.client.put('/api/v1/users/me/academic-profile', json={**PROFILE, **changes})


def term(env, **changes):
    assert profile(env).status_code == 200
    response = env.client.post('/api/v1/terms', json={**TERM, **changes})
    assert response.status_code == 201, response.text
    return response.json()


def enroll(env, parent_id, **changes):
    return env.client.post('/api/v1/enrollments', json={'term_id': parent_id, 'course_revision_id': 100, **changes})


def test_profile_optional_history_and_preserved_program_snapshot(academic_app):
    env = academic_app
    assert env.client.get('/api/v1/users/me/academic-profile').status_code == 404
    assert env.client.post('/api/v1/terms', json=TERM).status_code == 404
    assert profile(env).status_code == 200
    first = term(env)
    assert enroll(env, first['id'], status='failed', grade='FF').status_code == 201
    assert profile(env, program_id=23, curriculum_id=23, preparation_status='exempt').status_code == 200
    stored = env.client.get(f"/api/v1/terms/{first['id']}").json()
    assert stored['program_id'] == 22 and stored['curriculum_id'] == 22
    assert env.client.get('/api/v1/enrollments').json()[0]['grade'] == 'FF'
    # Historical transfer records can explicitly choose a different program.
    historical = env.client.post('/api/v1/terms', json={**TERM, 'academic_year': 2023, 'program_id': 22, 'curriculum_id': 22})
    assert historical.status_code == 201
    assert env.client.get('/api/v1/users/me/academic-profile', headers=env.other_headers).status_code == 404


@pytest.mark.parametrize('change', [
    {'program_id': 23}, {'curriculum_id': 999}, {'current_class': 5},
    {'current_class': 0}, {'preparation_status': 'in_progress'},
    {'entry_year': 2200}, {'user_id': 999}, {'current_class': None},
])
def test_profile_validation(academic_app, change):
    assert profile(academic_app, **change).status_code == 422


def test_preparation_is_separate_and_allows_personal_courses(academic_app):
    env = academic_app
    assert profile(env, current_class=0, preparation_status='in_progress').status_code == 200
    response = env.client.post('/api/v1/terms', json={'academic_year': 2023, 'term_type': 'annual', 'is_preparation': True})
    assert response.status_code == 201
    term_id = response.json()['id']
    suggestions = env.client.get(f'/api/v1/terms/{term_id}/suggestions')
    assert suggestions.status_code == 200 and suggestions.json()['courses'] == []
    assert enroll(env, term_id).status_code == 422
    response = enroll(env, term_id, course_revision_id=None, custom_course_code=' prep101 ', custom_course_name='Hazırlık İngilizcesi')
    assert response.status_code == 201 and response.json()['course_code'] == 'PREP101'
    bad = env.client.post('/api/v1/terms', json={**TERM, 'is_preparation': True})
    assert bad.status_code == 422


def test_term_validation_updates_and_empty_delete(academic_app):
    env = academic_app
    first = term(env)
    url = f"/api/v1/terms/{first['id']}"
    assert env.client.post('/api/v1/terms', json=TERM).status_code == 409
    assert env.client.post('/api/v1/terms', json={**TERM, 'term_type': 'annual'}).status_code == 422
    assert env.client.post('/api/v1/terms', json={**TERM, 'term_type': 'spring', 'curriculum_period_number': 9}).status_code == 422
    assert env.client.post('/api/v1/terms', json={**TERM, 'term_type': 'spring', 'program_id': 22}).status_code == 422
    assert env.client.patch(url, json={'academic_year': None}).status_code == 422
    assert env.client.patch(url, json={'curriculum_period_kind': None}).status_code == 422
    assert env.client.patch(url, json={'user_id': env.other_id}).status_code == 422
    response = env.client.patch(url, json={'term_type': 'spring', 'curriculum_period_number': 2})
    assert response.status_code == 200 and response.json()['curriculum_period_number'] == 2
    assert env.client.get('/api/v1/terms').json()[0]['id'] == first['id']
    assert env.client.delete(url).status_code == 204
    assert env.client.get(url).status_code == 404


def test_suggestions_required_first_groups_filters_and_no_auto_enrollment(academic_app):
    env = academic_app
    first = term(env)
    url = f"/api/v1/terms/{first['id']}/suggestions"
    response = env.client.get(url)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data['courses'][0]['course_revision_id'] == 100
    assert data['courses'][0]['course_type'] == 'required'
    assert {course['course_revision_id'] for course in data['courses']} == {100, 101, 106}
    assert data['elective_groups'][0]['id'] == 10
    assert data['coverage_status'] == 'partial'
    assert 'sort_order' not in data['courses'][0]
    assert env.client.get('/api/v1/enrollments').json() == []
    assert len(env.client.get(url, params={'limit': 1}).json()['courses']) == 1
    assert env.client.get(url, params={'q': 'SEC101'}).json()['courses'][0]['course_revision_id'] == 101
    assert env.client.get(url, params={'q': "' OR 1=1 --"}).json()['courses'] == []
    assert env.client.get(url, params={'period_kind': 'year', 'period_number': 1}).status_code == 422
    # Calendar term doesn't restrict taking an upper-class catalog course.
    assert enroll(env, first['id'], course_revision_id=104).status_code == 201
    # Elective member does not need a direct placement row.
    assert enroll(env, first['id'], course_revision_id=101).status_code == 201


def test_annual_curriculum_and_period_number_requirements(academic_app):
    env = academic_app
    assert profile(env, program_id=42, curriculum_id=42, current_class=6).status_code == 200
    response = env.client.post('/api/v1/terms', json={**TERM, 'term_type': 'annual', 'curriculum_period_kind': 'year'})
    assert response.status_code == 201
    term_id = response.json()['id']
    assert env.client.get(f'/api/v1/terms/{term_id}/suggestions').json()['courses'][0]['course_revision_id'] == 103
    assert enroll(env, term_id, course_revision_id=103).status_code == 201
    assert env.client.post('/api/v1/terms', json=TERM).status_code == 422
    assert env.client.post('/api/v1/terms', json={'academic_year': 2025, 'term_type': 'annual', 'curriculum_period_kind': 'year', 'curriculum_period_number': 7}).status_code == 422
    response = env.client.post('/api/v1/terms', json={'academic_year': 2025, 'term_type': 'annual'})
    assert response.status_code == 201
    url = f"/api/v1/terms/{response.json()['id']}/suggestions"
    assert env.client.get(url).status_code == 422
    assert env.client.get(url, params={'period_kind': 'year', 'period_number': 1}).status_code == 200


def test_catalog_identity_repeats_results_and_personal_course_isolation(academic_app):
    env = academic_app
    first = term(env)
    response = enroll(env, first['id'], status='failed', grade='FF')
    assert response.status_code == 201
    enrollment_id = response.json()['id']
    assert response.json()['course_id'] == 100
    assert enroll(env, first['id']).status_code == 409
    assert enroll(env, first['id'], course_revision_id=105).status_code == 409
    # Same code in another program must not resolve to the wrong identity.
    assert enroll(env, first['id'], course_revision_id=102).status_code == 422
    second = term(env, academic_year=2025)
    assert enroll(env, second['id'], status='passed', grade='AA').status_code == 201
    update = env.client.patch(f'/api/v1/enrollments/{enrollment_id}', json={'status': 'exempt', 'grade': None})
    assert update.status_code == 200 and update.json()['grade'] is None
    assert len(env.client.get('/api/v1/enrollments', params={'status': 'passed'}).json()) == 1
    before = env.connection.scalar(text('SELECT count(*) FROM courses'))
    custom = enroll(env, first['id'], course_revision_id=None, custom_course_code=' ozel101 ', custom_course_name=' Kişisel ders ', custom_ects='4.5')
    assert custom.status_code == 201 and custom.json()['course_code'] == 'OZEL101'
    custom_id = custom.json()['id']
    assert env.connection.scalar(text('SELECT count(*) FROM courses')) == before
    assert enroll(env, first['id'], course_revision_id=None, custom_course_code='ozel101', custom_course_name='Tekrar').status_code == 409
    assert enroll(env, first['id'], course_revision_id=None, custom_course_code='mat101', custom_course_name='Tekrar').status_code == 409
    assert env.client.patch(f'/api/v1/enrollments/{custom_id}', json={'custom_course_name': 'Yeni ad', 'custom_course_code': 'ozel102', 'custom_ects': None}).status_code == 200
    assert env.client.patch(f'/api/v1/enrollments/{custom_id}', json={'custom_course_code': 'mat101'}).status_code == 409
    assert env.client.patch(f'/api/v1/enrollments/{enrollment_id}', json={'custom_course_name': 'Değiştir'}).status_code == 422


def test_archiving_and_restoring_preserve_history(academic_app):
    env = academic_app
    first = term(env)
    row = enroll(env, first['id'], status='passed', grade='BA').json()
    url = f"/api/v1/enrollments/{row['id']}"
    assert env.client.delete(url).status_code == 204
    assert env.client.delete(url).status_code == 204
    assert env.client.get('/api/v1/enrollments').json() == []
    assert env.client.get(url).status_code == 404
    archived = env.client.get(url, params={'include_archived': True}).json()
    assert archived['grade'] == 'BA' and archived['archived_at'] is not None
    assert env.client.delete(f"/api/v1/terms/{first['id']}").status_code == 409
    assert env.client.post(url + '/restore').status_code == 200
    assert env.client.get(url).json()['archived_at'] is None
    assert env.client.delete(url).status_code == 204
    assert enroll(env, first['id']).status_code == 201
    assert env.client.post(url + '/restore').status_code == 409


@pytest.mark.parametrize('change', [
    {'course_revision_id': None}, {'status': 'unknown'}, {'custom_course_name': 'mixed'},
    {'user_id': 999}, {'term_id': 0}, {'grade': ' '},
    {'course_revision_id': None, 'custom_course_code': ' ', 'custom_course_name': 'Test'},
    {'course_revision_id': None, 'custom_course_code': 'TEST', 'custom_course_name': 'Test', 'custom_ects': 121},
])
def test_enrollment_validation(academic_app, change):
    first = term(academic_app)
    assert enroll(academic_app, first['id'], **change).status_code == 422


def test_database_owner_and_duplicate_constraints(academic_app):
    env = academic_app
    first = term(env)
    assert enroll(env, first['id']).status_code == 201
    with pytest.raises(IntegrityError) as duplicate:
        with env.connection.begin_nested():
            env.connection.execute(text("INSERT INTO enrollments (user_id,term_id,course_id,course_revision_id,course_code,course_name,status) VALUES (:owner,:term,100,100,'MAT101','Test','in_progress')"), {'owner': env.owner_id, 'term': first['id']})
    assert duplicate.value.orig.diag.constraint_name == 'uq_enrollments_catalog_active'
    with pytest.raises(IntegrityError) as owner:
        with env.connection.begin_nested():
            env.connection.execute(text("INSERT INTO enrollments (user_id,term_id,course_code,course_name,status) VALUES (:owner,:term,'TEST','Test','in_progress')"), {'owner': env.other_id, 'term': first['id']})
    assert owner.value.orig.diag.constraint_name == 'fk_enrollments_term_owner'


def test_academic_migration_can_rollback_without_touching_catalog_or_users(migration_db):
    connection, config = migration_db
    command.upgrade(config, 'head')
    owner = connection.scalar(text("INSERT INTO users (email,full_name,hashed_password) VALUES ('23000000001@ogr.halic.edu.tr','Test','hash') RETURNING id"))
    command.downgrade(config, '0003_auth_verification')
    assert 'academic_terms' not in inspect(connection).get_table_names()
    assert connection.scalar(text('SELECT id FROM users')) == owner
    assert connection.scalar(text('SELECT count(*) FROM course_revisions')) == 7
    command.upgrade(config, 'head')
    command.check(config)
