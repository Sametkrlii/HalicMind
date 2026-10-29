from collections import defaultdict
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy import select, text
from app.models import Enrollment
from app.models.exam import ExamDocument, ExamSelection
from app.services.exam_files import normalized, course_key


def candidates_for(course, program_name, documents):
    groups=defaultdict(list)
    for doc in documents:
        for row in doc.rows:
            if course_key(row['code'])!=course_key(course.course_code) or normalized(row['name'])!=normalized(course.course_name):
                continue
            if row.get('program') and normalized(row['program'])!=normalized(program_name):
                continue
            groups[doc.exam_type].append(dict(document_id=doc.id,exam_type=doc.exam_type,source_url=doc.announcement_url,
                file_url=doc.file_url,source_checked_at=doc.checked_at.isoformat(),**row))
    return groups


def match_term(db, user_id, term):
    if term.is_preparation:
        return []  # Preparation needs a separate exam policy and source adapter.
    program=db.execute(text('SELECT name_tr, degree_level FROM programs WHERE id=:id'),{'id':term.program_id}).first()
    if not program or program.degree_level not in {'associate','bachelor'}:
        return []
    cutoff=datetime.now(timezone.utc)-timedelta(seconds=2*86400)
    docs=db.scalars(select(ExamDocument).where(ExamDocument.current.is_(True),ExamDocument.status=='imported',
        ExamDocument.academic_year==term.academic_year,ExamDocument.term_type==term.term_type,ExamDocument.checked_at>=cutoff)).all()
    courses=db.scalars(select(Enrollment).where(Enrollment.user_id==user_id,Enrollment.term_id==term.id,Enrollment.archived_at.is_(None),Enrollment.status=='in_progress')).all()
    result=[]
    for course in courses:
        groups=candidates_for(course,program.name_tr,docs)
        selections=db.scalars(select(ExamSelection).where(ExamSelection.enrollment_id==course.id,ExamSelection.user_id==user_id)).all()
        for previous in selections:
            if previous.exam_type not in groups:
                result.append(dict(enrollment_id=course.id,course_code=course.course_code,course_name=course.course_name,
                    exam_type=previous.exam_type,status='source_unavailable',selected=None,candidates=[],selection_changed=True,changed_from=None))
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
            if chosen is None and len(candidates)==1 and not candidates[0].get('section') and candidates[0].get('program'):
                chosen=candidates[0]
            changed_from=None
            if chosen:
                current_doc=next(doc for doc in docs if doc.id==chosen['document_id'])
                previous=db.scalar(select(ExamDocument).where(ExamDocument.file_url==current_doc.file_url,ExamDocument.id!=current_doc.id).order_by(ExamDocument.imported_at.desc(),ExamDocument.id.desc()).limit(1))
                old=[row for row in previous.rows if course_key(row['code'])==course_key(course.course_code) and normalized(row['name'])==normalized(course.course_name) and normalized(row.get('section'))==normalized(chosen.get('section')) and normalized(row.get('program'))==normalized(chosen.get('program'))] if previous else []
                if len(old)==1 and old[0]['starts_at']!=chosen['starts_at']:
                    changed_from=old[0]['starts_at']
            result.append(dict(enrollment_id=course.id,course_code=course.course_code,course_name=course.course_name,
                changed_from=changed_from,exam_type=kind,status='confirmed' if chosen else 'selection_required',selected=chosen,candidates=candidates,
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
