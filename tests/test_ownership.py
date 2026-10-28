import pytest

from tests.test_academics import PROFILE, academic_app, enroll, term  # noqa: F401


def test_every_personal_resource_checks_owner(academic_app):
    env = academic_app
    first = term(env)
    enrollment_id = enroll(env, first['id']).json()['id']
    term_url = f"/api/v1/terms/{first['id']}"
    course_url = f'/api/v1/enrollments/{enrollment_id}'
    requests = [
        ('get', term_url, {}), ('patch', term_url, {'json': {'term_type': 'spring'}}),
        ('delete', term_url, {}), ('get', term_url + '/suggestions', {}),
        ('get', course_url, {}), ('patch', course_url, {'json': {'status': 'passed'}}),
        ('delete', course_url, {}), ('post', course_url + '/restore', {}),
        ('post', '/api/v1/enrollments', {'json': {'term_id': first['id'], 'course_revision_id': 100}}),
        ('get', '/api/v1/enrollments', {'params': {'term_id': first['id']}}),
    ]
    for method, url, kwargs in requests:
        response = getattr(env.client, method)(url, headers=env.other_headers, **kwargs)
        assert response.status_code == 404, (method, url, response.text)
    assert env.client.get('/api/v1/terms', headers=env.other_headers).json() == []
    assert env.client.get('/api/v1/enrollments', headers=env.other_headers).json() == []
    assert env.client.put('/api/v1/users/me/academic-profile', headers=env.other_headers, json=PROFILE).status_code == 200
    assert env.client.get('/api/v1/users/me/academic-profile').json()['user_id'] == env.owner_id


@pytest.mark.parametrize('url', ['/api/v1/users/me/academic-profile', '/api/v1/terms', '/api/v1/enrollments'])
def test_unverified_disabled_and_missing_sessions_are_denied(academic_app, url):
    env = academic_app
    assert env.client.get(url, headers={'Authorization': ''}).status_code == 401
    env.connection.exec_driver_sql('UPDATE users SET email_verified_at = NULL')
    assert env.client.get(url).status_code == 401
    env.connection.exec_driver_sql('UPDATE users SET email_verified_at=now(), is_active=false')
    assert env.client.get(url).status_code == 401
