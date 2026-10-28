import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_auth import EMAIL, PASSWORD, register, verify

WEB_HEADERS = {'X-HalicMind-Web':'1', 'Origin':'http://testserver'}


def web_login(env, headers=None):
    return env.client.post('/api/v1/auth/login', headers=headers or WEB_HEADERS,
                           data={'username':EMAIL,'password':PASSWORD})


def test_student_shell_assets_and_security_headers():
    client=TestClient(app)
    response=client.get('/')
    assert response.status_code==200
    assert '<html lang="tr">' in response.text
    assert '/assets/app.js' in response.text
    assert "script-src 'self'" in response.headers['content-security-policy']
    assert "frame-ancestors 'none'" in response.headers['content-security-policy']
    assert 'unsafe-inline' not in response.headers['content-security-policy']
    for path in ['/assets/app.js','/assets/api.js','/assets/icons.js','/assets/styles.css','/assets/tokens.css','/assets/favicon.svg']:
        assert client.get(path).status_code==200
    assert client.get('/assets/../core/config.py').status_code==404
    assert client.get('/docs').status_code==200
    assert 'content-security-policy' not in client.get('/docs').headers


def test_cookie_login_refresh_csrf_and_logout(auth_app):
    env=auth_app
    assert register(env).status_code==201
    assert verify(env).status_code==200
    response=web_login(env)
    assert response.status_code==200
    cookie=response.headers['set-cookie']
    assert 'HttpOnly' in cookie and 'SameSite=lax' in cookie and 'Path=/api/v1' in cookie
    assert 'Max-Age=1800' in cookie
    # A fresh request needs no JS-readable Bearer token.
    assert env.client.get('/api/v1/users/me').status_code==200
    body={'program_id':22,'curriculum_id':22,'entry_year':2023,'current_class':2}
    assert env.client.put('/api/v1/users/me/academic-profile',json=body).status_code==403
    assert env.client.put('/api/v1/users/me/academic-profile',json=body,headers={**WEB_HEADERS,'Origin':'https://attacker.example'}).status_code==403
    assert env.client.put('/api/v1/users/me/academic-profile',json=body,headers=WEB_HEADERS).status_code==200
    assert env.client.get('/api/v1/users/me').headers['cache-control']=='no-store'
    assert env.client.post('/api/v1/auth/logout').status_code==403
    assert env.client.post('/api/v1/auth/logout',headers=WEB_HEADERS).status_code==204
    assert env.client.get('/api/v1/users/me').status_code==401


def test_web_session_rejects_cross_origin_login(auth_app):
    response=web_login(auth_app,headers={**WEB_HEADERS,'Origin':'https://attacker.example'})
    assert response.status_code==403 and 'set-cookie' not in response.headers


def test_cookie_does_not_authorize_unverified_or_disabled_accounts(auth_app):
    env=auth_app
    assert register(env).status_code==201
    assert web_login(env).status_code==403
    assert verify(env).status_code==200
    assert web_login(env).status_code==200
    env.connection.exec_driver_sql('UPDATE users SET is_active=false')
    assert env.client.get('/api/v1/users/me').status_code==401


def test_swagger_login_does_not_create_browser_cookie(auth_app):
    env=auth_app
    assert register(env).status_code==201
    assert verify(env).status_code==200
    response=env.client.post('/api/v1/auth/login',data={'username':EMAIL,'password':PASSWORD})
    assert response.status_code==200 and 'set-cookie' not in response.headers
    assert env.client.get('/api/v1/users/me').status_code==401


def test_catalog_curriculum_filter(auth_app):
    rows=auth_app.client.get('/api/v1/catalog/courses',params={'curriculum_id':23}).json()
    assert rows and all(row['curriculum_id']==23 for row in rows)
    assert auth_app.client.get('/api/v1/catalog/courses',params={'curriculum_id':99999}).json()==[]


def test_https_cookie_is_secure_and_bad_bearer_does_not_fall_back(auth_app):
    env=auth_app
    assert register(env).status_code==201
    assert verify(env).status_code==200
    response=env.client.post('https://testserver/api/v1/auth/login',
                             headers={'X-HalicMind-Web':'1','Origin':'https://testserver'},
                             data={'username':EMAIL,'password':PASSWORD})
    assert response.status_code==200 and 'Secure' in response.headers['set-cookie']
    assert env.client.get('https://testserver/api/v1/users/me').status_code==200
    assert env.client.get('https://testserver/api/v1/users/me',headers={'Authorization':'Bearer broken'}).status_code==401
