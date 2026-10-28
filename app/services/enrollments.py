from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import or_, select, text
from sqlalchemy.orm import Session

from app.models import Enrollment
from app.schemas.enrollment import EnrollmentCreate, EnrollmentUpdate
from app.services.academics import commit, owned_term


def owned_enrollment(db: Session, user_id: int, enrollment_id: int, include_archived=False):
    row = db.scalar(select(Enrollment).where(Enrollment.id == enrollment_id, Enrollment.user_id == user_id))
    if row is None or (row.archived_at is not None and not include_archived):
        raise HTTPException(404, 'Ders kaydı bulunamadı.')
    return row


def ensure_unique(db: Session, row: Enrollment):
    # Caller holds the parent term lock, serializing create/restore/update.
    duplicate = select(Enrollment.id).where(
        Enrollment.term_id == row.term_id, Enrollment.archived_at.is_(None),
    )
    if row.id is not None:
        duplicate = duplicate.where(Enrollment.id != row.id)
    if row.course_id is None:
        duplicate = duplicate.where(Enrollment.course_code == row.course_code)
    else:
        duplicate = duplicate.where(or_(
            Enrollment.course_id == row.course_id,
            (Enrollment.course_id.is_(None)) & (Enrollment.course_code == row.course_code),
        ))
    with db.no_autoflush:
        if db.scalar(duplicate.limit(1)) is not None:
            raise HTTPException(409, 'Bu ders aynı dönemde zaten kayıtlı.')


def create_enrollment(db: Session, user_id: int, data: EnrollmentCreate):
    term = owned_term(db, user_id, data.term_id, lock=True)
    values = dict(user_id=user_id, term_id=term.id, status=data.status, grade=data.grade)
    if data.course_revision_id is not None:
        if term.is_preparation:
            raise HTTPException(422, 'Hazırlık için bölüm dersleri yerine kişisel ders ekleyin.')
        course = db.execute(text('''
            SELECT r.id AS course_revision_id, r.course_id, c.course_code,
                   coalesce(d.name_original, r.name_tr, r.name_en) AS course_name, r.ects
            FROM course_revisions r JOIN courses c ON c.id=r.course_id
            LEFT JOIN course_source_details d ON d.course_revision_id=r.id
            WHERE r.id=:revision AND (
                EXISTS (SELECT 1 FROM curriculum_courses WHERE curriculum_id=:curriculum AND course_revision_id=r.id)
                OR EXISTS (SELECT 1 FROM annual_curriculum_courses WHERE curriculum_id=:curriculum AND course_revision_id=r.id)
                OR EXISTS (SELECT 1 FROM elective_group_courses egc JOIN elective_groups eg ON eg.id=egc.elective_group_id
                           WHERE eg.curriculum_id=:curriculum AND egc.course_revision_id=r.id)
            )
        '''), {'revision': data.course_revision_id, 'curriculum': term.curriculum_id}).mappings().one_or_none()
        if course is None:
            raise HTTPException(422, 'Ders revizyonu seçilen dönemin program/müfredatına ait değil.')
        values.update(dict(course))
    else:
        values.update(course_id=None, course_revision_id=None, course_code=data.custom_course_code,
                      course_name=data.custom_course_name, ects=data.custom_ects)
    row = Enrollment(**values)
    ensure_unique(db, row)
    db.add(row)
    commit(db)
    db.refresh(row)
    return row


def update_enrollment(db: Session, user_id: int, enrollment_id: int, data: EnrollmentUpdate):
    row = owned_enrollment(db, user_id, enrollment_id)
    owned_term(db, user_id, row.term_id, lock=True)
    db.refresh(row)  # Re-read after the term lock in case another request archived it.
    if row.archived_at is not None:
        raise HTTPException(409, 'Arşivlenmiş ders önce geri yüklenmelidir.')
    changes = data.model_dump(exclude_unset=True)
    if changes.get('status', row.status) is None:
        raise HTTPException(422, 'Ders durumu boş olamaz.')
    custom_fields = {'custom_course_code': 'course_code', 'custom_course_name': 'course_name', 'custom_ects': 'ects'}
    if row.course_id is not None and custom_fields.keys() & changes.keys():
        raise HTTPException(422, 'Katalog dersinin kod, ad ve AKTS kopyası değiştirilemez.')
    for name, value in changes.items():
        if name in {'custom_course_code', 'custom_course_name'} and value is None:
            raise HTTPException(422, 'Kişisel ders kodu ve adı boş olamaz.')
        if name == 'custom_course_code':
            value = value.upper()
            if len(value) > 100:
                raise HTTPException(422, 'Ders kodu en fazla 100 karakter olabilir.')
        setattr(row, custom_fields.get(name, name), value)
    ensure_unique(db, row)
    commit(db)
    db.refresh(row)
    return row


def archive_enrollment(db: Session, user_id: int, enrollment_id: int):
    row = owned_enrollment(db, user_id, enrollment_id, include_archived=True)
    owned_term(db, user_id, row.term_id, lock=True)
    db.refresh(row)
    if row.archived_at is None:
        row.archived_at = datetime.now(timezone.utc)
        commit(db)


def restore_enrollment(db: Session, user_id: int, enrollment_id: int):
    row = owned_enrollment(db, user_id, enrollment_id, include_archived=True)
    owned_term(db, user_id, row.term_id, lock=True)
    db.refresh(row)
    ensure_unique(db, row)
    row.archived_at = None
    commit(db)
    db.refresh(row)
    return row
