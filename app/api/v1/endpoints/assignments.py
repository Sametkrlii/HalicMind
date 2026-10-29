from typing import Literal

from fastapi import APIRouter, Query, Response

from app.api.dependencies import CurrentUser, DB
from app.schemas.assignment import AssignmentCreate, AssignmentRead, AssignmentUpdate
from app.services import assignments

router = APIRouter(prefix='/assignments', tags=['assignments'])


@router.post('', response_model=AssignmentRead, status_code=201)
def create(data: AssignmentCreate, user: CurrentUser, db: DB):
    return assignments.create(db, user.id, data)


@router.get('', response_model=list[AssignmentRead])
def list_assignments(user: CurrentUser, db: DB, term_id: int | None = Query(None, gt=0),
                     enrollment_id: int | None = Query(None, gt=0),
                     view: Literal['all', 'pending', 'completed', 'overdue', 'upcoming'] = 'all',
                     include_archived: bool = False, q: str | None = Query(None, max_length=100),
                     sort: Literal['due', 'priority', 'recent'] = 'due',
                     limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return assignments.list_assignments(db, user.id, term_id=term_id, enrollment_id=enrollment_id, view=view,
                                       include_archived=include_archived, q=q, sort=sort, limit=limit, offset=offset)


@router.get('/{assignment_id}', response_model=AssignmentRead)
def read(assignment_id: int, user: CurrentUser, db: DB, include_archived: bool = False):
    return assignments.read(db, user.id, assignment_id, include_archived)


@router.patch('/{assignment_id}', response_model=AssignmentRead)
def update(assignment_id: int, data: AssignmentUpdate, user: CurrentUser, db: DB):
    return assignments.update(db, user.id, assignment_id, data)


@router.delete('/{assignment_id}', status_code=204, description='Ödevi geçmişini koruyarak arşivler.')
def archive(assignment_id: int, user: CurrentUser, db: DB):
    assignments.archive(db, user.id, assignment_id)
    return Response(status_code=204)


@router.post('/{assignment_id}/restore', response_model=AssignmentRead)
def restore(assignment_id: int, user: CurrentUser, db: DB):
    return assignments.restore(db, user.id, assignment_id)
