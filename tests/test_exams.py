from types import SimpleNamespace
import pytest
from app.services.exams import calendar_for_term
from tests.test_academics import academic_app, term


def test_calendar_ranges_are_not_exact_exams():
    result = calendar_for_term(SimpleNamespace(id=1,academic_year=2026,term_type='fall',is_preparation=False),'bachelor')
    assert result['status']=='calendar_range'
    assert result['exams']==[]
    assert result['periods'][0]['start_date']=='2026-11-07'
    assert result['periods'][2]['end_date']=='2027-01-05'
    assert result['source_url'].startswith('https://halic.edu.tr/')


@pytest.mark.parametrize('year,kind,prep,degree',[(2025,'fall',False,'bachelor'),(2026,'fall',True,'bachelor'),(2026,'annual',False,'bachelor'),(2026,'fall',False,'master')])
def test_unsupported_calendar_never_inherits_wrong_dates(year,kind,prep,degree):
    result=calendar_for_term(SimpleNamespace(id=1,academic_year=year,term_type=kind,is_preparation=prep),degree)
    assert result['status']=='unavailable'
    assert result['periods']==[] and result['source_url'] is None


def test_calendar_requires_authentication_and_is_owner_scoped(academic_app):
    env=academic_app
    owned=term(env)
    response=env.client.get('/api/v1/exams/calendar')
    assert response.status_code==200
    assert [row['term_id'] for row in response.json()]==[owned['id']]
    assert env.client.get('/api/v1/exams/calendar',headers=env.other_headers).json()==[]
    env.client.headers.pop('Authorization')
    assert env.client.get('/api/v1/exams/calendar').status_code==401

from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select, text
from app.models.exam import ExamDocument
from app.services.exam_files import announcement_context, announcement_links, file_links, official_url, parse_sheet, read_excel
from app.services.exam_sync import store_document, run_sync
from tests.test_academics import enroll

CONTEXT={'title':'2026-2027 Güz Dönemi Final Sınav Programı','academic_year':2026,'term_type':'fall','exam_type':'final'}
ANNOUNCEMENT='https://halic.edu.tr/tr/duyurular/2026-2027-guz-final'
FILE='https://halic.edu.tr/tr/s-duyurular/Documents/final.xlsx'
ROWS=[['Ders Kodu','Ders Adı','Sınav Tarihi','Sınav Saati','Salon','Şube'],['MAT101','Matematik','28.12.2026','10:30','A101','']]


def test_discovery_preserves_year_term_type_and_official_source_boundary():
    assert announcement_context(CONTEXT['title'])['academic_year']==2026
    for title in ('2025-2027 Güz Final Sınav Programı','2026-2027 Güz Bahar Final Sınav Programı','2026-2027 Final Sınav Programı','2026-2027 Güz Vize ve Final Sınav Programı'):
        assert announcement_context(title) is None
    html=f'<a href="{ANNOUNCEMENT}">{CONTEXT["title"]}</a><a href="https://evil.test/tr/duyurular/x">{CONTEXT["title"]}</a>'
    assert list(announcement_links(html,ANNOUNCEMENT))==[ANNOUNCEMENT]
    assert list(file_links(f'<a href="{FILE}">Excel</a><a href="https://evil.test/x.xlsx">bad</a>',ANNOUNCEMENT))==[FILE]


@pytest.mark.parametrize('url',['http://halic.edu.tr/file.xlsx','https://halic.edu.tr.evil.test/file.xlsx','https://halic.edu.tr@evil.test/x','https://127.0.0.1/x','https://halic.edu.tr:8000/x','file:///etc/passwd'])
def test_fetch_boundary_rejects_untrusted_urls(url):
    with pytest.raises(ValueError):
        official_url(url)


def test_excel_rows_handle_typed_dates_and_times_without_filling_missing_values():
    rows,warnings=parse_sheet(ROWS,'Mühendislik',CONTEXT)
    assert warnings==[] and rows[0]['starts_at']=='2026-12-28T10:30:00+03:00'
    assert rows[0]['row']==2 and rows[0]['room']=='A101'
    bad=[ROWS[0],['MAT101','Matematik','28.12.2025','10:30','A',''],['MAT101','Matematik',None,'10:30','A',''],['MAT101','Matematik','28.12.2026','=NOW()','A','']]
    rows,warnings=parse_sheet(bad,'Sheet',CONTEXT)
    assert rows==[] and len(warnings)==3
    assert parse_sheet([['Unknown','format']],'Sheet',CONTEXT)[1]


def test_reader_rejects_html_error_page_and_archive_bombs():
    from io import BytesIO
    from zipfile import ZipFile, ZIP_DEFLATED
    with pytest.raises(ValueError):
        read_excel(b'<html>Forbidden</html>',CONTEXT)
    buffer=BytesIO()
    with ZipFile(buffer,'w',ZIP_DEFLATED) as archive:
        archive.writestr('large',b'x'*60_000_001)
    with pytest.raises(ValueError,match='boyut'):
        read_excel(buffer.getvalue(),CONTEXT)


def test_xlsx_reader_uses_actual_cell_types_and_does_not_execute_formulas():
    # Minimal source fixture, not a generated user workbook.
    from io import BytesIO
    from zipfile import ZipFile
    from xml.sax.saxutils import escape
    buffer=BytesIO()
    with ZipFile(buffer,'w') as z:
        z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>')
        z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sınavlar" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
        xml='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
        for i,row in enumerate(ROWS,1):
            xml+=f'<row r="{i}">'+''.join(f'<c r="{chr(65+j)}{i}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>' for j,value in enumerate(row))+'</row>'
        z.writestr('xl/worksheets/sheet1.xml',xml+'</sheetData></worksheet>')
    rows,warnings=read_excel(buffer.getvalue(),CONTEXT)
    assert not warnings and rows[0]['code']=='MAT101'


def add_document(env,*,section='',hour='10:30',file_url=FILE,program='Catalog sentinel',year=2026):
    rows,_=parse_sheet([ROWS[0],['MAT101','Matematik',f'28.12.{year}',hour,'A101',section]],'Sınavlar',{**CONTEXT,'academic_year':year})
    if program:
        rows[0]['program']=program
    with Session(bind=env.connection,join_transaction_mode='create_savepoint') as db:
        doc=ExamDocument(announcement_url=ANNOUNCEMENT,file_url=file_url,title=CONTEXT['title'],academic_year=year,term_type='fall',exam_type='final',checksum=('a' if hour=='10:30' else 'b')*64,current=True,status='imported',rows=rows,warnings=[],checked_at=datetime.now(timezone.utc))
        db.add(doc);db.commit();db.refresh(doc)
        return doc.id


def test_exact_match_ownership_archived_courses_and_year_scope(academic_app):
    env=academic_app;parent=term(env);course=enroll(env,parent['id']).json()
    add_document(env)
    result=env.client.get('/api/v1/exams/calendar').json()[0]
    assert result['exams'][0]['status']=='confirmed'
    assert result['exams'][0]['selected']['starts_at'].endswith('+03:00')
    assert env.client.get('/api/v1/exams/calendar',headers=env.other_headers).json()==[]
    env.client.delete(f'/api/v1/enrollments/{course["id"]}')
    assert env.client.get('/api/v1/exams/calendar').json()[0]['exams']==[]


def test_section_selection_rejects_foreign_owner_and_unmatched_candidate(academic_app):
    env=academic_app;parent=term(env);course=enroll(env,parent['id']).json()
    doc=add_document(env,section='B')
    group=env.client.get('/api/v1/exams/calendar').json()[0]['exams'][0]
    assert group['status']=='selection_required'
    body=dict(enrollment_id=course['id'],exam_type='final',document_id=doc,sheet='Sınavlar',row_number=2)
    assert env.client.put('/api/v1/exams/selection',json=body,headers=env.other_headers).status_code==404
    assert env.client.put('/api/v1/exams/selection',json={**body,'row_number':3}).status_code==409
    assert env.client.put('/api/v1/exams/selection',json=body).status_code==200
    assert env.client.get('/api/v1/exams/calendar').json()[0]['exams'][0]['status']=='confirmed'
    env.connection.execute(text('UPDATE exam_documents SET current=false WHERE id=:id'),{'id':doc})
    assert env.client.get('/api/v1/exams/calendar').json()[0]['exams'][0]['status']=='source_unavailable'
    add_document(env,section='B',hour='11:30')
    group=env.client.get('/api/v1/exams/calendar').json()[0]['exams'][0]
    assert group['status']=='selection_required' and group['selection_changed']


@pytest.mark.parametrize('change',['program','year','stale','review'])
def test_uncertain_or_outdated_source_is_never_an_exact_exam(academic_app,change):
    env=academic_app;parent=term(env);enroll(env,parent['id'])
    doc=add_document(env,program='Other program' if change=='program' else 'Catalog sentinel',year=2025 if change=='year' else 2026)
    if change=='stale':
        env.connection.execute(text("UPDATE exam_documents SET checked_at=now()-interval '3 days' WHERE id=:id"),{'id':doc})
    if change=='review':
        env.connection.execute(text("UPDATE exam_documents SET status='review' WHERE id=:id"),{'id':doc})
    assert env.client.get('/api/v1/exams/calendar').json()[0]['exams']==[]


def test_revised_time_is_visible_and_conflicting_files_require_selection(academic_app):
    env=academic_app;parent=term(env);enroll(env,parent['id'])
    old=add_document(env)
    env.connection.execute(text('UPDATE exam_documents SET current=false WHERE id=:id'),{'id':old})
    add_document(env,hour='11:30')
    group=env.client.get('/api/v1/exams/calendar').json()[0]['exams'][0]
    assert group['changed_from']=='2026-12-28T10:30:00+03:00'
    add_document(env,file_url=FILE.replace('final','faculty'))
    group=env.client.get('/api/v1/exams/calendar').json()[0]['exams'][0]
    assert group['status']=='selection_required' and len(group['candidates'])==2


def test_sync_is_idempotent_and_retains_failed_revision_for_review(academic_app,monkeypatch):
    import app.services.exam_sync as sync
    env=academic_app
    parsed,_=parse_sheet(ROWS,'Sınavlar',CONTEXT)
    monkeypatch.setattr(sync,'read_excel',lambda data,context:(parsed,[]) if data==b'good' else ([],['unknown header']))
    with Session(bind=env.connection,join_transaction_mode='create_savepoint') as db:
        first=store_document(db,FILE,ANNOUNCEMENT,CONTEXT,b'good');db.flush()
        assert store_document(db,FILE,ANNOUNCEMENT,CONTEXT,b'good').id==first.id
        second=store_document(db,FILE,ANNOUNCEMENT,CONTEXT,b'bad');db.flush()
        assert first.current is False and second.status=='review'
        assert len(db.scalars(select(ExamDocument)).all())==2


def test_polling_records_errors_and_preserves_interval_without_network(academic_app):
    env=academic_app
    def session_factory():
        return Session(bind=env.connection,join_transaction_mode='create_savepoint')
    calls=[]
    def fetcher(url,limit):
        calls.append(url)
        raise ValueError('Source unavailable')
    result=run_sync(force=True,session_factory=session_factory,fetcher=fetcher)
    from app.services.exam_sync import SEEDS
    assert result['status']=='partial' and result['errors']==len(SEEDS)
    assert run_sync(session_factory=session_factory,fetcher=fetcher)['status']=='not_due'
    assert len(calls)==len(SEEDS)
    status=env.client.get('/api/v1/exams/sync-status').json()
    assert status['status']=='partial' and status['checked_at']


def test_official_merged_export_expands_parallel_programs_and_sections():
    header=['SINAV GÜNÜ','BAŞLANGIÇ SAATİ','DERS KODU','DERS ADI','PROGRAM ADI','ŞUBE','DERSLİK/ODA KODLARI']
    matrix=[header,['2026-12-28 Pazartesi','11:00:00','SEN301; SEN301','Visual Programming; Visual Programming','Yazılım Mühendisliği (İngilizce); Yazılım Mühendisliği (İngilizce)','1; 2','7614; 7616']]
    rows,warnings=parse_sheet(matrix,'Sayfa1',CONTEXT)
    assert warnings==[] and len(rows)==2
    assert [item['section'] for item in rows]==['1','2']
    assert rows[0]['source_row']==2 and rows[0]['row']!=rows[1]['row']
    assert rows[0]['room']=='7614; 7616'
    matrix[1][4]='A; B; C'
    rows,warnings=parse_sheet(matrix,'Sayfa1',CONTEXT)
    assert rows==[] and warnings


def test_polling_discovers_downloads_and_updates_a_realistic_announcement(academic_app,monkeypatch):
    import app.services.exam_sync as sync
    env=academic_app
    parsed,_=parse_sheet(ROWS,'Sınavlar',CONTEXT)
    monkeypatch.setattr(sync,'read_excel',lambda data,context:(parsed,[]))
    listing=f'<a href="{ANNOUNCEMENT}">{CONTEXT["title"]}</a>'
    page=f'<h1>{CONTEXT["title"]}</h1><a href="{FILE}">Mühendislik</a>'
    def fetcher(url,limit):
        return b'workbook' if url==FILE else (page if url==ANNOUNCEMENT else listing).encode()
    factory=lambda:Session(bind=env.connection,join_transaction_mode='create_savepoint')
    result=run_sync(force=True,session_factory=factory,fetcher=fetcher)
    assert result=={'status':'ok','files_seen':1,'errors':0}
    result=run_sync(force=True,session_factory=factory,fetcher=fetcher)
    assert env.connection.scalar(text('SELECT count(*) FROM exam_documents'))==1
    assert result['files_seen']==1
    # A removed attachment invalidates the current source while preserving its history.
    def removed(url,limit):
        return b'<h1>Schedule updated</h1>' if url==ANNOUNCEMENT else listing.encode()
    run_sync(force=True,session_factory=factory,fetcher=removed)
    assert env.connection.scalar(text('SELECT count(*) FROM exam_documents WHERE current'))==0
    assert env.connection.scalar(text('SELECT count(*) FROM exam_documents'))==1


def test_duplicate_official_copy_preserves_existing_section_selection(academic_app):
    env=academic_app;parent=term(env);course=enroll(env,parent['id']).json()
    first=add_document(env,section='B')
    second=add_document(env,section='B',file_url=FILE.replace('final','faculty'))
    env.connection.execute(text('UPDATE exam_documents SET current=false WHERE id=:id'),{'id':first})
    body=dict(enrollment_id=course['id'],exam_type='final',document_id=second,sheet='Sınavlar',row_number=2)
    assert env.client.put('/api/v1/exams/selection',json=body).status_code==200
    env.connection.execute(text('UPDATE exam_documents SET current=true WHERE id=:id'),{'id':first})
    group=env.client.get('/api/v1/exams/calendar').json()[0]['exams'][0]
    assert len(group['candidates'])==1
    assert group['status']=='confirmed'
    assert group['selected']['document_id']==second
    assert group['selection_changed'] is False
