from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Assignment, Enrollment
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate
from app.services.academics import commit, owned_term
from app.services.enrollments import owned_enrollment


def utc_now():
    return datetime.now(timezone.utc)


def day_start(now):
    return now.astimezone(timezone(timedelta(hours=3))).replace(hour=0,minute=0,second=0,microsecond=0)


def payload(row: Assignment, course: Enrollment, now=None):
    data = {column.name: getattr(row, column.name) for column in Assignment.__table__.columns}
    data.update(course_code=course.course_code, course_name=course.course_name, term_id=course.term_id,
                course_archived=course.archived_at is not None,
                is_overdue=row.archived_at is None and row.status == 'pending' and row.due_at < day_start(now or utc_now()))
    return data


def owned_assignment(db: Session, user_id: int, identifier: int, *, lock=False, include_archived=False):
    query = select(Assignment).where(Assignment.id == identifier, Assignment.user_id == user_id)
    if lock:
        query = query.with_for_update()
    row = db.scalar(query)
    if row is None or (row.archived_at is not None and not include_archived):
        raise HTTPException(404, 'Ödev bulunamadı.')
    return row


def read(db: Session, user_id: int, identifier: int, include_archived=False):
    row = owned_assignment(db, user_id, identifier, include_archived=include_archived)
    return payload(row, db.get(Enrollment, row.enrollment_id))


def create(db: Session, user_id: int, data: AssignmentCreate):
    course = owned_enrollment(db, user_id, data.enrollment_id, include_archived=True)
    # Same parent-term lock as course archive/restore serializes the check.
    owned_term(db, user_id, course.term_id, lock=True)
    db.refresh(course)
    if course.archived_at is not None:
        raise HTTPException(409, 'Arşivlenen derse yeni ödev eklenemez. Önce dersi geri yükleyin.')
    values = data.model_dump()
    values['description'] = values['description'] or None
    row = Assignment(user_id=user_id, completed_at=utc_now() if data.status == 'completed' else None, **values)
    db.add(row)
    commit(db)
    db.refresh(row)
    return payload(row, course)


def list_assignments(db: Session, user_id: int, *, term_id=None, enrollment_id=None, view='all',
                     include_archived=False, q=None, sort='due', limit=50, offset=0):
    if term_id is not None:
        owned_term(db, user_id, term_id)
    if enrollment_id is not None:
        owned_enrollment(db, user_id, enrollment_id, include_archived=True)
    now = utc_now()
    query = select(Assignment, Enrollment).join(Enrollment, Enrollment.id == Assignment.enrollment_id).where(Assignment.user_id == user_id)
    if not include_archived:
        query = query.where(Assignment.archived_at.is_(None))
    if term_id is not None:
        query = query.where(Enrollment.term_id == term_id)
    if enrollment_id is not None:
        query = query.where(Assignment.enrollment_id == enrollment_id)
    if view in {'pending', 'overdue', 'upcoming'}:
        query = query.where(Assignment.status == 'pending')
    elif view == 'completed':
        query = query.where(Assignment.status == 'completed')
    if view == 'overdue':
        query = query.where(Assignment.due_at < day_start(now), Assignment.archived_at.is_(None))
    if view == 'upcoming':
        query = query.where(Assignment.due_at >= day_start(now), Assignment.due_at < day_start(now) + timedelta(days=7), Assignment.archived_at.is_(None))
    if q:
        pattern = f'%{q}%'
        query = query.where(or_(Assignment.title.ilike(pattern), Enrollment.course_code.ilike(pattern), Enrollment.course_name.ilike(pattern)))
    if sort == 'recent':
        ordering = [Assignment.id.desc()]
    elif sort == 'priority':
        from sqlalchemy import case
        ordering = [case((Assignment.priority == 'high', 0), (Assignment.priority == 'normal', 1), else_=2), Assignment.due_at, Assignment.id]
    else:
        ordering = [Assignment.status == 'completed', Assignment.due_at, Assignment.id]
    return [payload(row, course, now) for row, course in db.execute(query.order_by(*ordering).limit(limit).offset(offset))]


def update(db: Session, user_id: int, identifier: int, data: AssignmentUpdate):
    row = owned_assignment(db, user_id, identifier, lock=True, include_archived=True)
    if row.archived_at is not None:
        raise HTTPException(409, 'Arşivlenen ödevi önce geri yükleyin.')
    changes = data.model_dump(exclude_unset=True)
    if 'description' in changes:
        changes['description'] = changes['description'] or None
    if 'status' in changes and changes['status'] != row.status:
        row.completed_at = utc_now() if changes['status'] == 'completed' else None
    for name, value in changes.items():
        setattr(row, name, value)
    commit(db)
    db.refresh(row)
    return payload(row, db.get(Enrollment, row.enrollment_id))


def archive(db: Session, user_id: int, identifier: int):
    row = owned_assignment(db, user_id, identifier, lock=True, include_archived=True)
    if row.archived_at is None:
        row.archived_at = utc_now()
        commit(db)


def restore(db: Session, user_id: int, identifier: int):
    row = owned_assignment(db, user_id, identifier, lock=True, include_archived=True)
    if row.archived_at is not None:
        row.archived_at = None
        commit(db)
        db.refresh(row)
    return payload(row, db.get(Enrollment, row.enrollment_id))
