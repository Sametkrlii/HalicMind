from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.academic_term import TermCreate
from app.services.academics import owned_term, validate_period

PLACEMENTS = '''
    SELECT curriculum_id, course_revision_id, semester AS period_number,
           'semester' AS period_kind, course_type, elective_group_id
    FROM curriculum_courses
    UNION ALL
    SELECT curriculum_id, course_revision_id, year_number, 'year', course_type, elective_group_id
    FROM annual_curriculum_courses
'''


# Membership rows have a period number but no period kind. Prefer the group's
# placements; orphan groups can use an unambiguous curriculum-wide plan kind.
GROUP_PLAN = '''(
    :all_periods
    OR EXISTS (SELECT 1 FROM placements p WHERE p.elective_group_id=eg.id AND p.period_kind=:kind)
    OR (NOT EXISTS (SELECT 1 FROM placements p WHERE p.elective_group_id=eg.id)
        AND EXISTS (SELECT 1 FROM placements p WHERE p.curriculum_id=eg.curriculum_id AND p.period_kind=:kind)
        AND NOT EXISTS (SELECT 1 FROM placements p WHERE p.curriculum_id=eg.curriculum_id AND p.period_kind<>:kind))
)'''


def suggestions(db: Session, user_id: int, term_id: int, kind, number, q, limit, offset, all_periods=False):
    term = owned_term(db, user_id, term_id)
    if term.is_preparation:
        return {'curriculum_id': term.curriculum_id, 'period_kind': None, 'period_number': None,
                'coverage_status': 'unavailable', 'courses': [], 'elective_groups': [],
                'note': 'Hazırlık dersleri bölüm müfredatından önerilmez; kişisel ders ekleyebilirsiniz.'}
    kind = kind if kind is not None else term.curriculum_period_kind
    number = number if number is not None else term.curriculum_period_number
    if not all_periods and (kind is None or number is None):
        raise HTTPException(422, 'Öneriler için müfredat dönem türünü ve numarasını belirtin.')
    if not all_periods:
        validate_period(db, TermCreate(
            academic_year=term.academic_year, term_type=term.term_type, program_id=term.program_id,
            curriculum_id=term.curriculum_id, curriculum_period_kind=kind, curriculum_period_number=number,
        ))
    params = {'curriculum': term.curriculum_id, 'kind': kind, 'number': number,
              'q': f'%{q}%' if q else None, 'limit': limit, 'offset': offset, 'all_periods': all_periods}
    rows = db.execute(text(f'''
        WITH placements AS ({PLACEMENTS}), candidates AS (
            SELECT p.course_revision_id, p.course_type, p.elective_group_id FROM placements p
            WHERE p.curriculum_id=:curriculum
              AND (:all_periods OR (p.period_kind=:kind AND p.period_number=:number))
              AND NOT EXISTS (
                  SELECT 1 FROM course_revisions r JOIN courses c ON c.id=r.course_id
                  JOIN curricula cu ON cu.id=p.curriculum_id
                  JOIN catalog_source_rows sr ON sr.program_id=cu.program_id
                    AND sr.course_code_original=c.course_code AND sr.row_kind='slot'
                    AND sr.period_kind=p.period_kind AND sr.period_number=p.period_number
                  WHERE r.id=p.course_revision_id
              )
            UNION
            SELECT egc.course_revision_id, 'elective', eg.id
            FROM elective_group_courses egc JOIN elective_groups eg ON eg.id=egc.elective_group_id
            WHERE eg.curriculum_id=:curriculum AND (:all_periods OR egc.period_number=:number)
              AND {GROUP_PLAN}
        )
        SELECT DISTINCT r.id AS course_revision_id, r.course_id, c.course_code,
               coalesce(d.name_original, r.name_tr, r.name_en) AS course_name, r.ects,
               ca.course_type, eg.id AS elective_group_id, eg.name AS elective_group_name,
               r.verification_status,
               CASE WHEN ca.course_type='required' THEN 0 ELSE 1 END AS sort_order
        FROM candidates ca JOIN course_revisions r ON r.id=ca.course_revision_id
        JOIN courses c ON c.id=r.course_id
        LEFT JOIN course_source_details d ON d.course_revision_id=r.id
        LEFT JOIN elective_groups eg ON eg.id=ca.elective_group_id
        WHERE CAST(:q AS TEXT) IS NULL OR c.course_code ILIKE :q
            OR coalesce(d.name_original, r.name_tr, r.name_en) ILIKE :q
        ORDER BY sort_order, course_code, course_revision_id, elective_group_id
        LIMIT :limit OFFSET :offset
    '''), params).mappings().all()
    groups = db.execute(text(f'''
        WITH placements AS ({PLACEMENTS})
        SELECT eg.id, eg.name, eg.required_course_count, eg.required_ects
        FROM elective_groups eg WHERE eg.curriculum_id=:curriculum AND {GROUP_PLAN} AND (
            :all_periods
            OR EXISTS (SELECT 1 FROM placements p WHERE p.elective_group_id=eg.id
                       AND p.period_kind=:kind AND p.period_number=:number)
            OR EXISTS (SELECT 1 FROM elective_group_courses egc WHERE egc.elective_group_id=eg.id
                       AND egc.period_number=:number)
        )
        ORDER BY eg.name, eg.id
    '''), params).mappings().all()
    coverage = db.scalar(text('SELECT coverage_status FROM curricula WHERE id=:curriculum'), params)
    return {'curriculum_id': term.curriculum_id, 'period_kind': None if all_periods else kind, 'period_number': None if all_periods else number,
            'coverage_status': coverage, 'courses': rows, 'elective_groups': groups,
            'note': 'Öneriler katalog kapsamıyla sınırlıdır; dersler kendiliğinden kaydedilmez.'}
