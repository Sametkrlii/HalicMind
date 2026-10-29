"""Personal academic setup and catalog-aware validation."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AcademicProfile, AcademicTerm, Enrollment, User
from app.schemas.academic_profile import AcademicProfileWrite
from app.schemas.academic_term import TermCreate, TermUpdate


def commit(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Kayıt zaten mevcut veya ilişkili bir kayıt nedeniyle işlem yapılamıyor.') from None


def curriculum(db: Session, program_id: int, curriculum_id: int):
    row = db.execute(text('SELECT * FROM curricula WHERE id=:curriculum AND program_id=:program'),
                     {'curriculum': curriculum_id, 'program': program_id}).mappings().one_or_none()
    if row is None:
        raise HTTPException(422, 'Müfredat bulunamadı veya seçilen programa ait değil.')
    return row


def validate_period(db: Session, term: TermCreate):
    cu = curriculum(db, term.program_id, term.curriculum_id)
    if term.is_preparation:
        return
    kinds = set(db.execute(text('SELECT DISTINCT period_kind FROM catalog_courses_readable WHERE curriculum_id=:id'),
                           {'id': term.curriculum_id}).scalars())
    if term.term_type == 'annual' and kinds and 'year' not in kinds:
        raise HTTPException(422, 'Bu müfredat yıllık değil; Güz, Bahar veya Yaz dönemi seçin.')
    if kinds == {'year'} and term.term_type not in {'annual', 'summer'}:
        raise HTTPException(422, 'Bu program yıllık plan kullanıyor; yıllık veya yaz dönemi seçin.')
    kind, number = term.curriculum_period_kind, term.curriculum_period_number
    if kind is not None:
        if kinds and kind not in kinds:
            raise HTTPException(422, 'Müfredat dönem türü katalogdaki planla uyuşmuyor.')
        maximum = cu['semester_count'] if kind == 'semester' else (cu['semester_count'] + 1) // 2
        if number > maximum:
            raise HTTPException(422, 'Müfredat dönem numarası program süresini aşıyor.')


def get_profile(db: Session, user_id: int) -> AcademicProfile:
    profile = db.get(AcademicProfile, user_id)
    if profile is None:
        raise HTTPException(404, 'Akademik profil henüz oluşturulmamış.')
    return profile


def save_profile(db: Session, user_id: int, data: AcademicProfileWrite):
    cu = curriculum(db, data.program_id, data.curriculum_id)
    if data.current_class > (cu['semester_count'] + 1) // 2:
        raise HTTPException(422, 'Sınıf seçimi programın normal öğrenim süresini aşıyor.')
    db.scalar(select(User).where(User.id == user_id).with_for_update())
    profile = db.get(AcademicProfile, user_id)
    if profile is None:
        profile = AcademicProfile(user_id=user_id)
        db.add(profile)
    for name, value in data.model_dump().items():
        setattr(profile, name, value)
    commit(db)
    db.refresh(profile)
    return profile


def owned_term(db: Session, user_id: int, term_id: int, lock=False):
    statement = select(AcademicTerm).where(AcademicTerm.id == term_id, AcademicTerm.user_id == user_id)
    if lock:
        statement = statement.with_for_update()
    term = db.scalar(statement)
    if term is None:
        raise HTTPException(404, 'Dönem bulunamadı.')
    return term


def current_academic_year():
    try:
        zone = ZoneInfo('Europe/Istanbul')
    except ZoneInfoNotFoundError:
        # Python on Windows may lack an IANA database; current Turkish time is UTC+3.
        zone = timezone(timedelta(hours=3))
    today = datetime.now(zone)
    return today.year - (today.month < 9)


def validate_preparation_profile(db: Session, user_id: int, data: TermCreate):
    profile = db.get(AcademicProfile, user_id)
    # Historical transfer records and future plans remain possible. The current
    # term must agree with the student's current preparation status.
    if (profile and profile.preparation_status == 'in_progress'
            and data.program_id == profile.program_id
            and data.academic_year == current_academic_year() and not data.is_preparation):
        raise HTTPException(422, 'Hazırlık eğitiminiz devam ediyor. Güncel dönemi hazırlık olarak oluşturun; '
                                'bölüme başladıysanız önce profilinizde hazırlık durumunu ve sınıfınızı güncelleyin.')


def create_term(db: Session, user_id: int, data: TermCreate):
    if data.program_id is None:
        profile = get_profile(db, user_id)
        data = data.model_copy(update={'program_id': profile.program_id, 'curriculum_id': profile.curriculum_id})
    if 'is_preparation' not in data.model_fields_set:
        profile = db.get(AcademicProfile, user_id)
        if (profile and profile.preparation_status == 'in_progress'
                and data.program_id == profile.program_id and data.academic_year == current_academic_year()):
            # Infer only the current term, never silently rewrite a historical term.
            if data.curriculum_period_kind is not None:
                raise HTTPException(422, 'Hazırlık devam ederken güncel döneme bölüm müfredatı bağlanamaz.')
            data = TermCreate.model_validate({**data.model_dump(), 'is_preparation': True})
    validate_preparation_profile(db, user_id, data)
    validate_period(db, data)
    term = AcademicTerm(user_id=user_id, **data.model_dump())
    db.add(term)
    commit(db)
    db.refresh(term)
    return term


def update_term(db: Session, user_id: int, term_id: int, data: TermUpdate):
    term = owned_term(db, user_id, term_id, lock=True)
    current = {key: getattr(term, key) for key in TermCreate.model_fields}
    current.update(data.model_dump(exclude_unset=True))
    try:
        merged = TermCreate.model_validate(current)
    except ValidationError:
        raise HTTPException(422, 'Dönem alanları geçersiz; tür ve numarayı birlikte kontrol edin.') from None
    validate_preparation_profile(db, user_id, merged)
    validate_period(db, merged)
    for name, value in data.model_dump(exclude_unset=True).items():
        setattr(term, name, value)
    commit(db)
    db.refresh(term)
    return term


def delete_term(db: Session, user_id: int, term_id: int):
    term = owned_term(db, user_id, term_id, lock=True)
    if db.scalar(select(Enrollment.id).where(Enrollment.term_id == term_id).limit(1)) is not None:
        raise HTTPException(409, 'Ders geçmişi içeren dönem silinemez; dersleri arşivleyebilirsiniz.')
    db.delete(term)
    commit(db)
