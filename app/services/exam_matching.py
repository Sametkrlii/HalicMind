from collections import defaultdict
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy import and_, or_, select, text
from app.models import Enrollment
from app.models.exam import ExamDocument, ExamSelection, ExamSyncState
from app.services.exam_files import normalized, course_key, selectable_rows


def candidates_for(course, program_name, documents):
    groups=defaultdict(list)
    for doc in documents:
        for row in selectable_rows(doc.rows):
            if course_key(row['code'])!=course_key(course.course_code) or normalized(row['name'])!=normalized(course.course_name):
                continue
            if row.get('program') and normalized(row['program'])!=normalized(program_name):
                continue
            groups[doc.exam_type].append(dict(document_id=doc.id,exam_type=doc.exam_type,source_url=doc.announcement_url,
                file_url=doc.file_url,source_checked_at=doc.checked_at.isoformat(),**row))
    return groups


def freshness_cutoff():
    return datetime.now(timezone.utc) - timedelta(hours=48)


def failed_sources(db):
    state = db.get(ExamSyncState, 1)
    errors = state.errors if state and state.status == 'partial' else []
    return [error['url'] for error in errors if error.get('url')]


def verified_document(db, cutoff):
    verified = and_(ExamDocument.current.is_(True), ExamDocument.status == 'imported',
                    ExamDocument.checked_at >= cutoff)
    # Older installations recorded announcement failures only in the sync log.
    failed = failed_sources(db)
    if failed:
        state = db.get(ExamSyncState, 1)
        unaffected = and_(ExamDocument.file_url.not_in(failed), ExamDocument.announcement_url.not_in(failed))
        if state.checked_at:
            unaffected = or_(unaffected, ExamDocument.checked_at >= state.checked_at)
        verified = and_(verified, unaffected)
    return verified


def last_known_documents(db, term, cutoff):
    """Keep the last readable copy of a failed source separate from confirmed matches."""
    failed_urls = failed_sources(db)
    rows = db.scalars(select(ExamDocument).where(
        ExamDocument.academic_year == term.academic_year, ExamDocument.term_type == term.term_type,
        ExamDocument.status.in_(['imported', 'stale']),
        or_(ExamDocument.file_url.in_(failed_urls), ExamDocument.announcement_url.in_(failed_urls),
            ExamDocument.current.is_(True) & ((ExamDocument.checked_at < cutoff) | (ExamDocument.status == 'stale'))),
    ).order_by(ExamDocument.checked_at.desc(), ExamDocument.id.desc())).all()
    by_url = {}
    for doc in rows:
        if not doc.warnings and doc.rows:
            by_url.setdefault(doc.file_url, doc)
    return list(by_url.values())


def match_term(db, user_id, term):
    if term.is_preparation:
        return []  # Preparation needs a separate exam policy and source adapter.
    program=db.execute(text('SELECT name_tr, degree_level FROM programs WHERE id=:id'),{'id':term.program_id}).first()
    if not program or program.degree_level not in {'associate','bachelor'}:
        return []
    cutoff=freshness_cutoff()
    docs=db.scalars(select(ExamDocument).where(verified_document(db, cutoff),
        ExamDocument.academic_year==term.academic_year,ExamDocument.term_type==term.term_type)).all()
    courses=db.scalars(select(Enrollment).where(Enrollment.user_id==user_id,Enrollment.term_id==term.id,Enrollment.archived_at.is_(None),Enrollment.status=='in_progress')).all()
    previous_docs = last_known_documents(db, term, cutoff)
    result=[]
    for course in courses:
        groups=candidates_for(course,program.name_tr,docs)
        selections=db.scalars(select(ExamSelection).where(ExamSelection.enrollment_id==course.id,ExamSelection.user_id==user_id)).all()
        last_known = candidates_for(course, program.name_tr, previous_docs)
        for previous in selections:
            current = groups.get(previous.exam_type, [])
            if any(item['document_id'] == previous.document_id for item in current):
                continue
            doc = db.get(ExamDocument, previous.document_id)
            rows = candidates_for(course, program.name_tr, [doc])[previous.exam_type] if doc else []
            last_known[previous.exam_type] = [item for item in rows if
                item['sheet'] == previous.sheet and item['row'] == previous.row_number]
        for kind, rows in last_known.items():
            if kind not in groups:
                result.append(dict(enrollment_id=course.id,course_code=course.course_code,course_name=course.course_name,
                    exam_type=kind,status='source_unavailable',selected=None,candidates=[],last_known=rows,
                    selection_changed=False,changed_from=None))
        for kind,candidates in groups.items():
            all_candidates=candidates
            # Duplicate faculty/all-list rows with exactly the same event count once.
            unique={}
            for item in candidates:
                key=(item['starts_at'],normalized(item['room']),normalized(item.get('section')),normalized(item.get('program')))
                unique.setdefault(key,item)
            candidates=list(unique.values())
            selected=db.get(ExamSelection,(course.id,kind))
            chosen=next((item for item in all_candidates if selected and item['document_id']==selected.document_id and item['sheet']==selected.sheet and item['row']==selected.row_number),None)
            # A section-specific row requires explicit selection even when it is the only row found.
            if selected is None and len(candidates)==1 and not candidates[0].get('section') and candidates[0].get('program'):
                chosen=candidates[0]
            changed_from=None
            if chosen:
                current_doc=next(doc for doc in docs if doc.id==chosen['document_id'])
                previous=db.scalar(select(ExamDocument).where(ExamDocument.file_url==current_doc.file_url,ExamDocument.id!=current_doc.id,
                    ExamDocument.academic_year==term.academic_year,ExamDocument.term_type==term.term_type,
                    ExamDocument.exam_type==kind,ExamDocument.status.in_(['imported','stale'])).order_by(ExamDocument.checked_at.desc(),ExamDocument.id.desc()).limit(1))
                old=[row for row in previous.rows if course_key(row['code'])==course_key(course.course_code) and normalized(row['name'])==normalized(course.course_name) and normalized(row.get('section'))==normalized(chosen.get('section')) and normalized(row.get('program'))==normalized(chosen.get('program'))] if previous else []
                if len(old)==1 and old[0]['starts_at']!=chosen['starts_at']:
                    changed_from=old[0]['starts_at']
            result.append(dict(enrollment_id=course.id,course_code=course.course_code,course_name=course.course_name,
                changed_from=changed_from,exam_type=kind,status='confirmed' if chosen else 'selection_required',selected=chosen,candidates=candidates,
                last_known=last_known.get(kind, []) if not chosen else [],
                selection_changed=bool(selected and not any(item['document_id']==selected.document_id for item in all_candidates))))
    return result


def select_candidate(db,user_id,data):
    from app.models import AcademicTerm
    course=db.scalar(select(Enrollment).where(Enrollment.id==data.enrollment_id,Enrollment.user_id==user_id))
    if course is None:
        raise HTTPException(404,'Ders bulunamadı.')
    term=db.get(AcademicTerm,course.term_id)
    matches=match_term(db,user_id,term)
    group=next((item for item in matches if item['enrollment_id']==course.id and item['exam_type']==data.exam_type),None)
    candidate=next((item for item in group['candidates'] if item['document_id']==data.document_id and item['sheet']==data.sheet and item['row']==data.row_number),None) if group else None
    if candidate is None:
        raise HTTPException(409,'Kaynak değişti veya bu sınav dersinle eşleşmiyor. Takvimi yenile.')
    from sqlalchemy.dialects.postgresql import insert
    statement=insert(ExamSelection).values(enrollment_id=course.id,exam_type=data.exam_type,user_id=user_id,
        document_id=data.document_id,sheet=data.sheet,row_number=data.row_number)
    db.execute(statement.on_conflict_do_update(index_elements=['enrollment_id','exam_type'],
        set_=dict(document_id=data.document_id,sheet=data.sheet,row_number=data.row_number)))
    db.commit()
    return {'status':'selected'}
