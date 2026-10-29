from fastapi import APIRouter
from app.api.dependencies import CurrentUser, DB
from app.schemas.exam import TermExamCalendar
from app.services.exams import list_calendars

router = APIRouter(prefix='/exams', tags=['exams'])


@router.get('/calendar', response_model=list[TermExamCalendar])
def calendar(user: CurrentUser, db: DB):
    """Kendi dönemlerinin resmi sınav aralıkları; kesin ders tarihi değildir."""
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
