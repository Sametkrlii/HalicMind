from datetime import datetime, timedelta, timezone

import pytest
from alembic import command
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from tests.test_academics import academic_app, enroll, term  # noqa: F401 -- reuse owned test workspace


def create(env, course, **changes):
    return env.client.post('/api/v1/assignments', json={
        'enrollment_id': course['id'], 'title': ' Algoritma ödevi ',
        'due_at': (datetime.now(timezone.utc)+timedelta(days=2)).isoformat(), **changes,
    })


def setup_course(env):
    return enroll(env, term(env)['id']).json()


def test_create_complete_reopen_and_archive_preserve_assignment(academic_app):
    env = academic_app
    course = setup_course(env)
    response = create(env, course, description=' Açıklama ', estimated_minutes=90, priority='high')
    assert response.status_code == 201
    item = response.json()
    assert item['title'] == 'Algoritma ödevi' and item['description'] == 'Açıklama'
    assert item['course_code'] == 'MAT101' and item['status'] == 'pending'
    url = f"/api/v1/assignments/{item['id']}"
    response = env.client.patch(url, json={'status':'completed'})
    assert response.status_code == 200 and response.json()['completed_at']
    stamp = response.json()['completed_at']
    assert env.client.patch(url,json={'status':'completed','description':None}).json()['completed_at'] == stamp
    assert env.client.patch(url,json={'status':'pending'}).json()['completed_at'] is None
    assert env.client.delete(url).status_code == 204
    assert env.client.delete(url).status_code == 204
    assert env.client.get(url).status_code == 404
    assert env.client.get('/api/v1/assignments').json() == []
    assert env.client.get('/api/v1/assignments',params={'include_archived':True}).json()[0]['id'] == item['id']
    assert env.client.patch(url,json={'title':'X'}).status_code == 409
    restored = env.client.post(url+'/restore').json()
    assert restored['id'] == item['id'] and restored['estimated_minutes'] == 90


def test_assignment_ownership_for_every_method_and_parent_filters(academic_app):
    env = academic_app
    course = setup_course(env)
    item = create(env, course).json()
    url = f"/api/v1/assignments/{item['id']}"
    for method,path,body in [('get',url,None),('patch',url,{'title':'Hacked'}),('delete',url,None),('post',url+'/restore',None)]:
        kwargs={'headers':env.other_headers}
        if body is not None:kwargs['json']=body
        assert getattr(env.client,method)(path,**kwargs).status_code == 404
    assert env.client.get('/api/v1/assignments',headers=env.other_headers).json() == []
    assert env.client.post('/api/v1/assignments',headers=env.other_headers,json={'enrollment_id':course['id'],'title':'No','due_at':'2027-01-01T12:00:00+03:00'}).status_code == 404
    assert env.client.get('/api/v1/assignments',headers=env.other_headers,params={'enrollment_id':course['id']}).status_code == 404
    assert env.client.get('/api/v1/assignments',headers=env.other_headers,params={'term_id':course['term_id']}).status_code == 404
    env.client.headers.pop('Authorization')
    assert env.client.get('/api/v1/assignments').status_code == 401


def test_archiving_course_preserves_existing_work_but_blocks_new_work(academic_app):
    env = academic_app
    course = setup_course(env)
    item = create(env,course).json()
    assert env.client.delete(f"/api/v1/enrollments/{course['id']}").status_code == 204
    assert create(env,course).status_code == 409
    url = f"/api/v1/assignments/{item['id']}"
    assert env.client.get(url).json()['course_archived'] is True
    assert env.client.patch(url,json={'status':'completed'}).status_code == 200
    assert env.client.get('/api/v1/assignments').json()[0]['id'] == item['id']
    assert env.client.delete(f"/api/v1/terms/{course['term_id']}").status_code == 409


def test_due_windows_offsets_search_and_pagination(academic_app):
    env = academic_app
    course = setup_course(env)
    now = datetime.now(timezone.utc)
    old = create(env,course,title='Dün',due_at=(now-timedelta(days=1)).isoformat()).json()
    soon = create(env,course,title='Yakında',due_at=(now+timedelta(days=1)).isoformat()).json()
    create(env,course,title='Sonra',due_at=(now+timedelta(days=10)).isoformat())
    create(env,course,title='Bitti',status='completed',due_at=(now-timedelta(days=3)).isoformat())
    assert old['is_overdue'] is True
    assert [a['id'] for a in env.client.get('/api/v1/assignments',params={'view':'overdue'}).json()] == [old['id']]
    assert [a['id'] for a in env.client.get('/api/v1/assignments',params={'view':'upcoming'}).json()] == [soon['id']]
    assert len(env.client.get('/api/v1/assignments',params={'view':'completed'}).json()) == 1
    assert len(env.client.get('/api/v1/assignments',params={'q':'MAT101'}).json()) == 4
    assert env.client.get('/api/v1/assignments',params={'q':"' OR 1=1 --"}).json() == []
    assert len(env.client.get('/api/v1/assignments',params={'limit':1,'offset':1}).json()) == 1
    result = create(env,course,due_at='2026-11-01T15:30:00+03:00').json()
    assert datetime.fromisoformat(result['due_at'].replace('Z','+00:00')) == datetime(2026,11,1,12,30,tzinfo=timezone.utc)


@pytest.mark.parametrize('change',[
    {'due_at':'2026-11-01T10:00:00'}, {'due_at':None}, {'title':' '}, {'title':'X'*201},
    {'estimated_minutes':0}, {'estimated_minutes':10081}, {'priority':'critical'}, {'user_id':999},
    {'status':'overdue'}, {'completed_at':'2026-11-01T10:00:00Z'}, {'description':'x'*5001},
])
def test_assignment_input_validation(academic_app,change):
    env = academic_app
    assert create(env,setup_course(env),**change).status_code == 422


def test_patch_cannot_reparent_or_null_required_fields(academic_app):
    env = academic_app
    item = create(env,setup_course(env)).json()
    url = f"/api/v1/assignments/{item['id']}"
    for change in ({'enrollment_id':999},{'user_id':999},{'title':None},{'status':None},{'due_at':None},{'priority':None},{'due_at':'2026-11-01T10:00:00'}):
        assert env.client.patch(url,json=change).status_code == 422


def test_database_rejects_cross_user_parent_and_migration_is_reversible(academic_app):
    env = academic_app
    course = setup_course(env)
    item = create(env,course).json()
    with pytest.raises(IntegrityError) as error:
        with env.connection.begin_nested():
            env.connection.execute(text("INSERT INTO assignments (user_id,enrollment_id,title,due_at,priority,status) VALUES (:user,:course,'Bad',now(),'normal','pending')"),{'user':env.other_id,'course':course['id']})
    assert error.value.orig.diag.constraint_name == 'fk_assignments_enrollment_owner'
    assert env.client.get(f"/api/v1/assignments/{item['id']}").status_code == 200


def test_assignment_migration_keeps_catalog_and_existing_courses(migration_db):
    connection, config = migration_db
    command.upgrade(config,'0004_academic_planning')
    tables=set(inspect(connection).get_table_names())
    count=connection.scalar(text('SELECT count(*) FROM course_revisions'))
    command.upgrade(config,'head')
    assert set(inspect(connection).get_table_names()) == tables | {'assignments', 'exam_documents', 'exam_sync_state', 'exam_selections'}
    assert connection.scalar(text('SELECT count(*) FROM course_revisions')) == count
    command.check(config)
    command.downgrade(config,'0004_academic_planning')
    assert set(inspect(connection).get_table_names()) == tables
    assert connection.scalar(text('SELECT count(*) FROM course_revisions')) == count
    command.upgrade(config,'head')
    command.check(config)


def test_due_day_remains_current_until_istanbul_midnight(academic_app,monkeypatch):
    from app.services import assignments
    frozen=datetime.fromisoformat('2026-10-29T20:30:00+00:00')
    monkeypatch.setattr(assignments,'utc_now',lambda:frozen)
    env=academic_app;course=setup_course(env)
    today=create(env,course,title='Bugün',due_at='2026-10-29T00:00:00+03:00').json()
    assert today['is_overdue'] is False
    assert env.client.get('/api/v1/assignments',params={'view':'overdue'}).json()==[]
    assert env.client.get('/api/v1/assignments',params={'view':'upcoming'}).json()[0]['id']==today['id']
    monkeypatch.setattr(assignments,'utc_now',lambda:frozen+timedelta(minutes=31))
    assert env.client.get(f"/api/v1/assignments/{today['id']}").json()['is_overdue'] is True
