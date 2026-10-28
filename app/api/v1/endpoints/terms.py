from fastapi import APIRouter, Query, Response
from sqlalchemy import select

from app.api.dependencies import CurrentUser, DB
from app.models import AcademicTerm
from app.core.choices import PeriodKind
from app.schemas.academic_term import TermCreate, TermRead, TermUpdate
from app.schemas.course_suggestions import CourseSuggestions
from app.services import academics, course_suggestions

router = APIRouter(prefix='/terms', tags=['academic terms'])


@router.post('', response_model=TermRead, status_code=201)
def create(data: TermCreate, user: CurrentUser, db: DB):
    return academics.create_term(db, user.id, data)


@router.get('', response_model=list[TermRead])
def list_terms(user: CurrentUser, db: DB, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return db.scalars(select(AcademicTerm).where(AcademicTerm.user_id == user.id)
                      .order_by(AcademicTerm.academic_year.desc(), AcademicTerm.id).limit(limit).offset(offset)).all()


@router.get('/{term_id}', response_model=TermRead)
def read(term_id: int, user: CurrentUser, db: DB):
    return academics.owned_term(db, user.id, term_id)


@router.patch('/{term_id}', response_model=TermRead)
def update(term_id: int, data: TermUpdate, user: CurrentUser, db: DB):
    return academics.update_term(db, user.id, term_id, data)


@router.delete('/{term_id}', status_code=204)
def delete(term_id: int, user: CurrentUser, db: DB):
    academics.delete_term(db, user.id, term_id)
    return Response(status_code=204)


@router.get('/{term_id}/suggestions', response_model=CourseSuggestions)
def suggestions(term_id: int, user: CurrentUser, db: DB, period_kind: PeriodKind | None = None,
                period_number: int | None = Query(None, ge=1, le=24), q: str | None = Query(None, max_length=100),
                limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return course_suggestions.suggestions(db, user.id, term_id, period_kind, period_number, q, limit, offset)
