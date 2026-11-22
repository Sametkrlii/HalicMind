from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import column, func, select, text, true
from sqlalchemy.dialects.postgresql import JSONB
from app.services.academics import owned_term
from app.services.exam_files import course_key, selectable_rows
from app.services.exam_matching import freshness_cutoff, verified_document
from app.models.exam import ExamDocument
from app.api.dependencies import CurrentUser, DB
from app.schemas.exam import TermExamCalendar
from app.services.exams import list_calendars

router = APIRouter(prefix='/exams', tags=['exams'])


@router.get('/calendar', response_model=list[TermExamCalendar])
def calendar(user: CurrentUser, db: DB):
    """Kişisel dönemler için genel sınav aralıklarını, doğrulanmış ders eşleşmelerini, şube adaylarını ve varsa son bilinen sınav bilgilerini getirir."""
    return list_calendars(db, user.id)


@router.get('/sync-status')
def sync_status(user: CurrentUser, db: DB):
    from app.core.config import settings
    from app.models.exam import ExamSyncState
    state=db.get(ExamSyncState,1)
    return dict(enabled=settings.exam_sync_enabled,interval_seconds=settings.exam_sync_interval_seconds,
        status=state.status if state else 'not_checked',checked_at=state.checked_at if state else None,
        succeeded_at=state.succeeded_at if state else None,files_seen=state.files_seen if state else 0,
        errors=state.errors if state else [])


from app.schemas.exam import ExamSelectionCreate


@router.put('/selection')
def selection(data: ExamSelectionCreate, user: CurrentUser, db: DB):
    from app.services.exam_matching import select_candidate
    return select_candidate(db,user.id,data)

@router.get('/documents/{document_id}/rows')
def schedule_rows(document_id: int, user: CurrentUser, db: DB):
    rows = db.scalar(select(ExamDocument.rows).where(ExamDocument.id==document_id,
                     verified_document(db, freshness_cutoff())))
    if rows is None:
        raise HTTPException(404, 'Güncel program okunamadı. Resmî duyuruyu kontrol et.')
    return sorted(selectable_rows(rows), key=lambda row: row['starts_at'])

@router.get('/search')
def search_schedules(term_id: int, user: CurrentUser, db: DB, q: str = Query(min_length=2, max_length=100)):
    term = owned_term(db, user.id, term_id)
    needle = course_key(q)
    if len(needle) < 2:
        raise HTTPException(422, 'En az iki harf veya rakam gir.')
    fields = ('code', 'name', 'starts_at', 'room', 'section', 'program')
    rows = func.jsonb_array_elements(ExamDocument.rows).table_valued(column('value', JSONB)).alias('schedule')
    query = select(*(rows.c.value[field].astext.label(field) for field in fields),
                   ExamDocument.exam_type, ExamDocument.announcement_url).distinct().select_from(ExamDocument).join(rows, true()).where(
            verified_document(db, freshness_cutoff()), ExamDocument.academic_year == term.academic_year,
            ExamDocument.term_type == term.term_type, text("""
        EXISTS (
            SELECT 1 FROM (VALUES (schedule.value->>'code'), (schedule.value->>'name')) AS fields(value)
            WHERE strpos(regexp_replace(lower(translate(value,'İIıŞşĞğÜüÖöÇç','iiissgguuoocc')),
                                        '[^a-z0-9]', '', 'g'), :needle)>0
        )
    """)).order_by(text('starts_at, code, name, program, section, room, exam_type, announcement_url')).limit(81)
    matches = db.execute(query, {'needle': needle}).mappings().all()
    return {'matches':matches[:80], 'has_more':len(matches)>80}
