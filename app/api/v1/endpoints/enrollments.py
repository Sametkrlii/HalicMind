from fastapi import APIRouter, Query, Response
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DB
from app.models import Enrollment
from app.core.choices import CourseStatus
from app.schemas.enrollment import EnrollmentCreate, EnrollmentRead, EnrollmentUpdate
from app.services import academics, enrollments

router = APIRouter(prefix='/enrollments', tags=['personal courses'])


@router.post('', response_model=EnrollmentRead, status_code=201)
def create(data: EnrollmentCreate, user: CurrentUser, db: DB):
    return enrollments.create_enrollment(db, user.id, data)


@router.get('', response_model=list[EnrollmentRead])
def list_courses(user: CurrentUser, db: DB, term_id: int | None = Query(None, gt=0), status: CourseStatus | None = None,
                 include_archived: bool = False, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    query = select(Enrollment).where(Enrollment.user_id == user.id)
    if term_id is not None:
        academics.owned_term(db, user.id, term_id)
        query = query.where(Enrollment.term_id == term_id)
    if status is not None:
        query = query.where(Enrollment.status == status)
    if not include_archived:
        query = query.where(Enrollment.archived_at.is_(None))
    return db.scalars(query.order_by(Enrollment.term_id.desc(), Enrollment.id).limit(limit).offset(offset)).all()


@router.get('/{enrollment_id}', response_model=EnrollmentRead)
def read(enrollment_id: int, user: CurrentUser, db: DB, include_archived: bool = False):
    return enrollments.owned_enrollment(db, user.id, enrollment_id, include_archived)


@router.patch('/{enrollment_id}', response_model=EnrollmentRead)
def update(enrollment_id: int, data: EnrollmentUpdate, user: CurrentUser, db: DB):
    return enrollments.update_enrollment(db, user.id, enrollment_id, data)


@router.delete('/{enrollment_id}', status_code=204, description='Kaydı ve gelecekte bağlı takip verilerini koruyarak arşivler.')
def archive(enrollment_id: int, user: CurrentUser, db: DB):
    enrollments.archive_enrollment(db, user.id, enrollment_id)
    return Response(status_code=204)


@router.post('/{enrollment_id}/restore', response_model=EnrollmentRead)
def restore(enrollment_id: int, user: CurrentUser, db: DB):
    return enrollments.restore_enrollment(db, user.id, enrollment_id)
