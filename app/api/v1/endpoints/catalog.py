from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import get_db

router = APIRouter(prefix='/catalog', tags=['catalog'])
DB = Annotated[Session, Depends(get_db)]

@router.get('/academic-units')
def academic_units(db: DB):
    return db.execute(text('SELECT * FROM academic_units ORDER BY id')).mappings().all()

@router.get('/programs')
def programs(db: DB, academic_unit_id: int | None = None):
    return db.execute(text('SELECT * FROM programs WHERE (CAST(:unit AS BIGINT) IS NULL OR academic_unit_id = :unit) ORDER BY id'), {'unit': academic_unit_id}).mappings().all()

@router.get('/curricula')
def curricula(db: DB, program_id: int | None = None):
    return db.execute(text("""
        WITH plans AS (
            SELECT curriculum_id, array_agg(DISTINCT period_kind ORDER BY period_kind) AS period_kinds
            FROM catalog_courses_readable GROUP BY curriculum_id
        )
        SELECT c.*, coalesce(p.period_kinds, ARRAY[]::text[]) AS period_kinds
        FROM curricula c LEFT JOIN plans p ON p.curriculum_id=c.id
        WHERE (CAST(:program AS BIGINT) IS NULL OR c.program_id=:program)
        ORDER BY c.id
    """), {'program': program_id}).mappings().all()

@router.get('/courses')
def courses(db: DB, program_id: int | None = None, curriculum_id: int | None = None, q: str | None = Query(None, max_length=100), limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return db.execute(text("""
        SELECT v.* FROM catalog_courses_readable v
        WHERE (CAST(:program AS BIGINT) IS NULL OR v.program_id=:program)
        AND (CAST(:curriculum AS BIGINT) IS NULL OR v.curriculum_id=:curriculum)
        AND (CAST(:query AS TEXT) IS NULL OR v.course_code ILIKE :query OR v.course_name ILIKE :query)
        ORDER BY faculty, department, curriculum, period_number, course_code
        LIMIT :limit OFFSET :offset
    """), {'program': program_id, 'curriculum': curriculum_id, 'query': f'%{q}%' if q else None, 'limit': limit, 'offset': offset}).mappings().all()
