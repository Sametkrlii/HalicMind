"""Conservative Excel ingestion. Unknown layouts are retained for review, never guessed."""
import re
import unicodedata
from datetime import date, datetime, time, timedelta, timezone
from io import BytesIO
from zipfile import ZipFile, BadZipFile
from urllib.parse import urljoin, urlsplit
from bs4 import BeautifulSoup

ISTANBUL = timezone(timedelta(hours=3))


def normalized(value):
    value = str(value or '').replace('ı', 'i').replace('İ', 'I').lower()
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()).strip()


def course_key(value):
    return normalized(value).replace(' ', '')


def official_url(value):
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or parsed.hostname not in {'halic.edu.tr', 'www.halic.edu.tr'} or parsed.port not in {None, 443} or parsed.username or parsed.password:
        raise ValueError('Yalnızca doğrulanmış Haliç HTTPS kaynakları okunabilir.')
    return parsed._replace(fragment='').geturl()


def announcement_context(title):
    text = normalized(title)
    year = re.search(r'\b(20\d{2})\s+(20\d{2})\b', text)
    if not year or int(year[2]) != int(year[1])+1:
        return None
    kinds = [('butunleme','resit'),('mazeret','makeup'),('ara sinav','midterm'),('vize','midterm'),('midterm','midterm'),('final','final')]
    exam = {value for key,value in kinds if key in text}
    terms = {value for key,value in [('guz','fall'),('fall','fall'),('bahar','spring'),('spring','spring'),('yaz','summer'),('summer','summer')] if re.search(r'\b'+key+r'\b', text)}
    if len(exam) != 1 or len(terms) != 1 or not any(word in text for word in ('program','takvim','schedule')):
        return None
    return dict(academic_year=int(year[1]),term_type=terms.pop(),exam_type=exam.pop())


def announcement_links(html, base):
    soup = BeautifulSoup(html, 'html.parser')
    found = {}
    for anchor in soup.select('a[href]'):
        title = anchor.get_text(' ',strip=True)
        context = announcement_context(title)
        if not context:
            continue
        try:
            url = official_url(urljoin(base,anchor['href']))
        except ValueError:
            continue
        if '/duyurular/' in urlsplit(url).path:
            found[url] = dict(title=title, **context)
    return found


def file_links(html, base):
    soup = BeautifulSoup(html,'html.parser')
    found = {}
    for anchor in soup.select('a[href]'):
        try:
            url = official_url(urljoin(base,anchor['href']))
        except ValueError:
            continue
        if urlsplit(url).path.lower().endswith(('.xlsx','.xls')):
            found[url] = anchor.find_parent('tr').get_text(' ',strip=True) if anchor.find_parent('tr') else anchor.get_text(' ',strip=True)
    return found


ALIASES = {
    'code': {'ders kodu','course code','dersin kodu'},
    'name': {'ders adi','course name','dersin adi'},
    'date': {'sinav tarihi','sinav gunu','exam date','tarih','date'},
    'time': {'sinav saati','exam time','saat','time','baslangic saati'},
    'room': {'derslik','salon','sinav salonu','sinav yeri','classroom','room','derslik oda kodlari'},
    'program': {'bolum','program','program adi','bolum adi','department'},
    'section': {'sube','grup','section','group','subesi'},
}


def column_map(row):
    result = {}
    for i,value in enumerate(row):
        label = normalized(value)
        for key,aliases in ALIASES.items():
            if label in aliases and key not in result:
                result[key] = i
    return result


def parse_date(value):
    if isinstance(value,datetime):
        return value.date()
    if isinstance(value,date):
        return value
    text = str(value or '').strip()
    # Official exports append the Turkish weekday to an ISO calendar date.
    text = re.sub(r' (Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar)$','',text,flags=re.IGNORECASE)
    for fmt in ('%d.%m.%Y','%d/%m/%Y','%Y-%m-%d','%d-%m-%Y'):
        try:
            return datetime.strptime(text,fmt).date()
        except ValueError:
            pass
    raise ValueError('Sınav tarihi okunamadı.')


def parse_time(value):
    if isinstance(value,datetime):
        return value.time().replace(tzinfo=None)
    if isinstance(value,time):
        return value.replace(tzinfo=None)
    if isinstance(value,(int,float)) and 0 <= value < 1:
        minutes = round(value*1440)
        if minutes < 1440:
            return time(minutes//60,minutes%60)
    match = re.fullmatch(r'\s*(\d{1,2})[.:](\d{2})(?::\d{2})?(?:\s*[-–]\s*\d{1,2}[.:]\d{2})?\s*',str(value or ''))
    if match:
        return time(int(match[1]),int(match[2]))
    raise ValueError('Sınav saati okunamadı.')


def parse_sheet(rows, sheet, context):
    columns = None
    output, warnings = [], []
    for line,row in enumerate(rows,1):
        if line>20000:
            raise ValueError('Sayfa satır sınırı aşıldı.')
        if not columns:
            candidate=column_map(row)
            if {'code','name','date','time'} <= candidate.keys():
                columns=candidate
            continue
        if {'code','name','date','time'} <= column_map(row).keys():
            columns=column_map(row)
            continue
        def cell(key):
            index=columns.get(key)
            return row[index] if index is not None and index<len(row) else None
        code,name=cell('code'),cell('name')
        if not code and not name:
            continue
        try:
            day=parse_date(cell('date'))
            year=context['academic_year']
            if not date(year,7,1)<=day<=date(year+1,10,31):
                raise ValueError('Tarih duyurunun akademik yılıyla uyuşmuyor.')
            at=datetime.combine(day,parse_time(cell('time')),tzinfo=ISTANBUL)
            vectors={key:[part.strip() for part in str(cell(key) or '').split(';')] for key in ('code','name','program','section')}
            count=max(len(items) for items in vectors.values())
            if count>500 or any(len(items) not in {1,count} for items in vectors.values()):
                raise ValueError('Birleştirilmiş ders/bölüm/şube sayıları uyuşmuyor.')
            expanded=[]
            for index in range(count):
                values={key:items[index] if len(items)>1 else items[0] for key,items in vectors.items()}
                if not values['code'] or not values['name'] or len(values['name'])>500 or not re.fullmatch(r'[A-Za-zÇĞİÖŞÜçğıöşü]{2,12}[\s.-]*\d{2,7}[A-Za-z]?',values['code']):
                    raise ValueError('Ders kodu/adı eksik veya biçimi tanınmadı.')
                expanded.append(dict(code=values['code'],name=values['name'],starts_at=at.isoformat(),
                    room=str(cell('room') or '').strip()[:300],program=values['program'][:300],
                    section=values['section'][:100],sheet=sheet,source_row=line,
                    row=line if count==1 else line*1000+index+1))
            output.extend(expanded)
        except (ValueError,TypeError):
            warnings.append(f'{sheet} / satır {line}: alanlar doğrulanamadı.')
    if not columns:
        warnings.append(f'{sheet}: ders kodu, ders adı, tarih ve saat başlıkları bulunamadı.')
    return output,warnings


def read_excel(data, context):
    if len(data)>10_000_000:
        raise ValueError('Dosya 10 MB sınırını aşıyor.')
    output,warnings=[],[]
    if data.startswith(b'PK'):
        try:
            with ZipFile(BytesIO(data)) as archive:
                if len(archive.infolist())>2000 or sum(item.file_size for item in archive.infolist())>60_000_000:
                    raise ValueError('Excel açılmış boyut sınırını aşıyor.')
                if any('vbaproject' in item.filename.lower() for item in archive.infolist()):
                    raise ValueError('Makrolu dosyalar desteklenmiyor.')
        except BadZipFile as exc:
            raise ValueError('Excel dosyası bozuk.') from exc
        from openpyxl import load_workbook
        workbook=load_workbook(BytesIO(data),read_only=True,data_only=False,keep_links=False)
        try:
            if len(workbook.worksheets)>50:
                raise ValueError('Excel sayfa sınırı aşıldı.')
            for sheet in workbook:
                if sheet.max_column and sheet.max_column>100:
                    raise ValueError('Excel sütun sınırı aşıldı.')
                rows,notes=parse_sheet(sheet.iter_rows(values_only=True),sheet.title,context)
                output.extend(rows);warnings.extend(notes)
        finally:
            workbook.close()
    elif data.startswith(b'\xd0\xcf\x11\xe0'):
        import xlrd
        workbook=xlrd.open_workbook(file_contents=data,on_demand=True)
        try:
            if workbook.nsheets>50:
                raise ValueError('Excel sayfa sınırı aşıldı.')
            for sheet in workbook.sheets():
                if sheet.ncols>100 or sheet.nrows>20000:
                    raise ValueError('Excel boyut sınırı aşıldı.')
                matrix=[]
                for i in range(sheet.nrows):
                    matrix.append([xlrd.xldate_as_datetime(c.value,workbook.datemode) if c.ctype==xlrd.XL_CELL_DATE else c.value for c in sheet.row(i)])
                rows,notes=parse_sheet(matrix,sheet.name,context)
                output.extend(rows);warnings.extend(notes)
        finally:
            workbook.release_resources()
    else:
        raise ValueError('Yanıt desteklenen bir Excel dosyası değil.')
    if len(output)>30000:
        raise ValueError('Dosya kayıt sınırı aşıldı.')
    return output,warnings[:100]


def next_listing_page(html, base):
    soup=BeautifulSoup(html,'html.parser')
    for anchor in soup.select('.custom-pagination-wrapper a[href], a[rel="next"]'):
        if normalized(anchor.get_text(' ',strip=True)) not in {'sonraki','next'} and 'next' not in anchor.get('rel',[]):
            continue
        try:
            url=official_url(urljoin(base,anchor['href']))
        except ValueError:
            continue
        if '/tr/tum-duyurular' in urlsplit(url).path:
            return url
    return None
