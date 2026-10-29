"""Bounded, source-allowlisted polling, safe across reloads and multiple workers."""
import hashlib
import gzip
import zlib
from io import BytesIO
import logging
import ssl
import time
import truststore
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, HTTPRedirectHandler, HTTPSHandler, build_opener
from sqlalchemy import select, text, update
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.exam import ExamDocument, ExamSyncState
from bs4 import BeautifulSoup
from app.services.exam_files import announcement_context, official_url, announcement_links, file_links, read_excel, next_listing_page

logger=logging.getLogger(__name__)
SEEDS=('https://halic.edu.tr/tr/tum-duyurular', 'https://halic.edu.tr/tr/tum-duyurular/duyurular-muhendislik-fakultesi', 'https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi', 'https://halic.edu.tr/tr/akademik/fakulteler/guzel-sanatlar-fakultesi', 'https://halic.edu.tr/tr/akademik/fakulteler/isletme-fakultesi', 'https://halic.edu.tr/tr/akademik/fakulteler/mimarlik-fakultesi', 'https://halic.edu.tr/tr/akademik/fakulteler/muhendislik-fakultesi', 'https://halic.edu.tr/tr/akademik/fakulteler/saglik-bilimleri-fakultesi', 'https://halic.edu.tr/tr/akademik/fakulteler/spor-bilimleri-fakultesi', 'https://halic.edu.tr/tr/akademik/fakulteler/tip-fakultesi', 'https://halic.edu.tr/tr/akademik/yuksekokullar/konservatuvar', 'https://halic.edu.tr/tr/akademik/yuksekokullar/yabanci-diller-yuksekokulu')


class OfficialRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        official_url(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def fetch(url, limit=10_000_000):
    official_url(url)
    context=ssl.create_default_context(cafile=settings.exam_sync_ca_bundle) if settings.exam_sync_ca_bundle else truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    opener=build_opener(OfficialRedirect(),HTTPSHandler(context=context))
    request=Request(url,headers={'User-Agent':'HalicMind-ExamCalendar/1.0','Accept':'text/html,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'})
    with opener.open(request,timeout=12) as response:
        official_url(response.url)
        data=response.read(limit+1)
        if len(data)>limit:
            raise ValueError('Kaynak boyut sınırını aşıyor.')
        encoding=response.headers.get('Content-Encoding','').lower()
        if encoding=='gzip' or data.startswith(b'\x1f\x8b'):
            with gzip.GzipFile(fileobj=BytesIO(data)) as compressed:
                data=compressed.read(limit+1)
        elif encoding=='deflate':
            decoder=zlib.decompressobj()
            data=decoder.decompress(data,limit+1)
        elif encoding not in {'','identity'}:
            raise ValueError('Kaynak sıkıştırma biçimi desteklenmiyor.')
        if len(data)>limit:
            raise ValueError('Açılmış kaynak boyut sınırını aşıyor.')
        return data


def error_label(exc):
    if isinstance(exc,HTTPError):
        return f'Kaynak HTTP {exc.code} döndürdü.'
    if isinstance(exc,URLError):
        return 'Kaynak bağlantısı veya TLS sertifikası doğrulanamadı.'
    if isinstance(exc,ValueError):
        return str(exc)[:200]
    return 'Dosya biçimi okunamadı; inceleme gerekiyor.'


def store_document(db, url, announcement, info, data):
    checksum=hashlib.sha256(data).hexdigest()
    previous=db.scalars(select(ExamDocument).where(ExamDocument.file_url==url)).all()
    existing=next((doc for doc in previous if doc.checksum==checksum and doc.academic_year==info['academic_year'] and doc.term_type==info['term_type'] and doc.exam_type==info['exam_type']),None)
    now=datetime.now(timezone.utc)
    if not existing and any(doc.checksum==checksum for doc in previous):
        raise ValueError('Aynı dosyanın akademik yıl/dönem bilgisi değişti; inceleme gerekiyor.')
    if existing:
        for doc in previous:
            doc.current=doc.id==existing.id
        existing.checked_at=now
        existing.status='imported' if existing.rows and not existing.warnings else 'review'
        return existing
    rows,warnings=read_excel(data,info)
    # A partially parsed replacement cannot silently preserve potentially outdated exact dates.
    status='imported' if rows and not warnings else 'review'
    for doc in previous:
        doc.current=False
    doc=ExamDocument(announcement_url=announcement,file_url=url,title=info['title'],
        academic_year=info['academic_year'],term_type=info['term_type'],exam_type=info['exam_type'],
        checksum=checksum,current=True,status=status,rows=rows,warnings=warnings,checked_at=now)
    db.add(doc);db.flush()
    return doc


def run_sync(*, force=False, session_factory=SessionLocal, fetcher=fetch):
    started=time.monotonic()
    now=datetime.now(timezone.utc)
    with session_factory() as db:
        # Transaction advisory lock is automatically released even after a crash.
        if not db.scalar(text('SELECT pg_try_advisory_xact_lock(721980031)')):
            return {'status':'busy'}
        state=db.get(ExamSyncState,1)
        if state and state.checked_at and not force and now-state.checked_at<timedelta(seconds=settings.exam_sync_interval_seconds):
            return {'status':'not_due'}
        errors=[];announcements={};seen=set()
        for seed in SEEDS:
            url=seed
            for page in range(3):
                if not url:
                    break
                if time.monotonic()-started>100:
                    errors.append(dict(url=url,message='Kontrol süre sınırına ulaştı.'))
                    break
                try:
                    html=fetcher(url,2_000_000).decode('utf-8',errors='replace')
                    announcements.update(announcement_links(html,url))
                    url=next_listing_page(html,url)
                except Exception as exc:
                    errors.append(dict(url=url,message=error_label(exc)))
                    break
        # Known current source documents are revisited even after their listing moves off page 3.
        for doc in db.scalars(select(ExamDocument).where(ExamDocument.current.is_(True))).all():
            announcements.setdefault(doc.announcement_url,dict(title=doc.title,academic_year=doc.academic_year,term_type=doc.term_type,exam_type=doc.exam_type))
        # Only currently relevant years; old files are never assigned to a new academic year.
        current_year=now.year if now.month>=7 else now.year-1
        announcements={url:info for url,info in announcements.items() if current_year-1<=info['academic_year']<=current_year+1}
        if len(announcements)>30:
            errors.append(dict(url=SEEDS[0],message='Duyuru sayısı kontrol sınırını aştı; kalan kaynaklar için inceleme gerekiyor.'))
        ordered=sorted(announcements.items(),key=lambda item:item[1]['academic_year'],reverse=True)
        for announcement,info in ordered[:30]:
            if time.monotonic()-started>100:
                errors.append(dict(url=announcement,message='Kontrol süre sınırına ulaştı; sonraki turda tekrar denenecek.'));break
            try:
                html=fetcher(announcement,2_000_000).decode('utf-8',errors='replace')
                links=file_links(html,announcement)
                if links:
                    heading=BeautifulSoup(html,'html.parser').find('h1')
                    actual=announcement_context(heading.get_text(' ',strip=True)) if heading else None
                    if actual is None or any(actual[key]!=info[key] for key in ('academic_year','term_type','exam_type')):
                        db.execute(update(ExamDocument).where(ExamDocument.announcement_url==announcement,ExamDocument.current.is_(True)).values(status='stale'))
                        raise ValueError('Duyuru başlığının yıl/dönem/sınav türü doğrulanamadı.')
                if not links:
                    errors.append(dict(url=announcement,message='Excel bağlantısı bulunamadı; farklı dosya biçimi veya sayfa incelemesi gerekiyor.'))
                # URLs removed from a successfully fetched announcement are no longer authoritative.
                for old in db.scalars(select(ExamDocument).where(ExamDocument.announcement_url==announcement,ExamDocument.current.is_(True))).all():
                    if old.file_url not in links:
                        old.current=False
                if len(links)>25:
                    errors.append(dict(url=announcement,message='Dosya sayısı 25 sınırını aştı; tüm dosyalar kontrol edilemedi.'))
                for url in list(links)[:25]:
                    if url in seen:
                        continue
                    if time.monotonic()-started>100:
                        raise ValueError('Kontrol süre sınırına ulaştı.')
                    seen.add(url)
                    try:
                        data=fetcher(url,10_000_000)
                        doc=store_document(db,url,announcement,info,data)
                        if doc.status=='review':
                            errors.append(dict(url=url,message='Dosya başlıkları veya bazı satırlar doğrulanamadı; kesin tarih aktarımı bekletiliyor.'))
                    except Exception as exc:
                        errors.append(dict(url=url,message=error_label(exc)))
                        # Keep history, but do not label an unchecked old copy as current and certain.
                        db.execute(update(ExamDocument).where(ExamDocument.file_url==url,ExamDocument.current.is_(True)).values(status='stale'))
            except Exception as exc:
                errors.append(dict(url=announcement,message=error_label(exc)))
        if state is None:
            state=ExamSyncState(id=1,status='pending',errors=[],files_seen=0);db.add(state)
        state.checked_at=now;state.errors=errors[:100];state.files_seen=len(seen)
        state.status='partial' if errors else 'ok'
        if not errors:
            state.succeeded_at=now
        db.commit()
        return {'status':state.status,'files_seen':len(seen),'errors':len(errors)}
