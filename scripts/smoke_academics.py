"""Exercise personal planning against the real catalog, rolling back test data."""
import secrets

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import engine, get_db
from app.main import app


def main():
    with engine.connect() as connection:
        transaction = connection.begin()
        previous = app.dependency_overrides.copy()
        client = TestClient(app)
        try:
            user_id = connection.scalar(text('''
                INSERT INTO users (email,full_name,hashed_password,email_verified_at)
                VALUES (:email,'Academic smoke test','not-a-login-hash',now()) RETURNING id
            '''), {'email': f'{secrets.randbelow(10**11):011d}@ogr.halic.edu.tr'})

            def override_db():
                with Session(bind=connection, join_transaction_mode='create_savepoint') as session:
                    yield session

            app.dependency_overrides[get_db] = override_db
            client.headers['Authorization'] = f'Bearer {create_access_token(user_id)}'
            selected = connection.execute(text('''
                SELECT cu.id,cu.program_id FROM curricula cu
                WHERE EXISTS (SELECT 1 FROM catalog_courses_readable v WHERE v.curriculum_id=cu.id
                              AND v.period_kind='semester' AND v.period_number=1 AND v.course_type='required')
                ORDER BY (cu.program_id=22) DESC,cu.id LIMIT 1
            ''')).mappings().one()
            response = client.put('/api/v1/users/me/academic-profile', json={
                'program_id': selected['program_id'], 'curriculum_id': selected['id'],
                'entry_year': 2023, 'current_class': 1, 'preparation_status': 'not_required',
            })
            assert response.status_code == 200, f'Profile failed: {response.status_code}'
            response = client.post('/api/v1/terms', json={
                'academic_year': 2026, 'term_type': 'fall',
                'curriculum_period_kind': 'semester', 'curriculum_period_number': 1,
            })
            assert response.status_code == 201, f'Term failed: {response.status_code}'
            term_id = response.json()['id']
            response = client.get(f'/api/v1/terms/{term_id}/suggestions')
            assert response.status_code == 200, f'Suggestions failed: {response.status_code}'
            course = next(row for row in response.json()['courses'] if row['course_type'] == 'required')
            response = client.post('/api/v1/enrollments', json={
                'term_id': term_id, 'course_revision_id': course['course_revision_id'],
            })
            assert response.status_code == 201, f'Enrollment failed: {response.status_code}'
            enrollment_id = response.json()['id']
            url = f'/api/v1/enrollments/{enrollment_id}'
            assert client.patch(url, json={'status': 'passed', 'grade': 'BA'}).status_code == 200
            assert client.delete(url).status_code == 204
            assert client.get('/api/v1/enrollments').json() == []
            assert client.post(url + '/restore').status_code == 200
            response = client.get('/api/v1/enrollments')
            assert len(response.json()) == 1 and response.json()[0]['grade'] == 'BA'
            print('Real catalog: profile -> term -> suggestions -> enrollment -> grade -> archive -> restore: passed.')
        finally:
            client.close()
            app.dependency_overrides.clear()
            app.dependency_overrides.update(previous)
            transaction.rollback()
    print('Temporary user and personal records rolled back; existing users/catalog preserved.')


if __name__ == '__main__':
    main()
