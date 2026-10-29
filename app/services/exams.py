"""Reviewed official calendar snapshot; never invent a per-course exam date."""
import json
from pathlib import Path
from sqlalchemy import select, text
from app.models import AcademicTerm

CALENDAR = json.loads((Path(__file__).parents[1] / 'data/academic_calendar_2026.json').read_text())


def calendar_for_term(term, degree_level):
    result = dict(term_id=term.id, academic_year=term.academic_year, term_type=term.term_type,
                  status='unavailable', reason=None, source_url=None, checked_on=None, periods=[], exams=[])
    if term.is_preparation:
        result['reason'] = 'Hazırlık için ayrı resmi takvim doğrulanmayı bekliyor.'
    elif term.academic_year != CALENDAR['academic_year']:
        result['reason'] = 'Bu akademik yıl için doğrulanmış takvim henüz eklenmedi.'
    elif degree_level not in CALENDAR['audience']:
        result['reason'] = 'Bu eğitim düzeyi için ayrı takvim doğrulanmalı.'
    elif term.term_type == 'annual':
        result['reason'] = 'Yıllık programın sınav takvimi ayrıca doğrulanmalı.'
    else:
        result.update(status='calendar_range', source_url=CALENDAR['source_url'], checked_on=CALENDAR['checked_on'],
                      periods=[p for p in CALENDAR['periods'] if p['term_type'] == term.term_type])
    return result


def list_calendars(db, user_id):
    terms = db.scalars(select(AcademicTerm).where(AcademicTerm.user_id == user_id).order_by(AcademicTerm.academic_year.desc(), AcademicTerm.id.desc())).all()
    levels = dict(db.execute(text('SELECT id, degree_level FROM programs')).all())
    from app.services.exam_matching import match_term
    result=[]
    for term in terms:
        item=calendar_for_term(term,levels.get(term.program_id))
        item['exams']=match_term(db,user_id,term)
        result.append(item)
    return result
