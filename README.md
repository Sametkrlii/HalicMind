# HaliçMind

Haliç Üniversitesi öğrencileri için akademik planlama ve çalışma takibi uygulaması. FastAPI ile geliştirilir ve katalog verilerini PostgreSQL üzerinden sunar.

## Proje yapısı

```text
app/       FastAPI uygulaması ve API uçları
catalog/   PostgreSQL katalog şeması ve veri aktarım dosyaları
scripts/   Yerel veritabanı, aktarım ve doğrulama araçları
tests/     Uygulama testleri
docs/      Teknik belgeler ve doğrulama raporları
```

Katalog araştırmasının kaynak çalışma alanı proje dışındaki `HalicMind_Catalog` klasörüdür. Uygulamanın kullandığı PostgreSQL dosyaları bu depodaki `catalog/` klasöründe tutulur.

## Gereksinimler ve kurulum

- macOS
- Python 3.12 veya üzeri
- PostgreSQL 17

Proje kökünde:

```sh
brew install postgresql@17
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m scripts.local_db setup
.venv/bin/python -m scripts.import_catalog
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Swagger: http://127.0.0.1:8000/docs — sağlık: http://127.0.0.1:8000/health

`setup`, yalnızca bu proje için `.local/postgres` altında yerel bir PostgreSQL kümesi oluşturur. Uygulama kullanıcısı superuser değildir. Bağlantı bilgisi Git’e eklenmeyen `.env` dosyasına yazılır. Sabitlenmiş bağımlılık sürümleri için `requirements.lock.txt` kullanılabilir.

Sonraki açılışlarda:

```sh
.venv/bin/python -m scripts.local_db start
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Veritabanını durdurmak için `start` yerine `stop`, durumunu görmek için `status` kullanın.

## API

```text
GET /api/v1/catalog/academic-units
GET /api/v1/catalog/programs?academic_unit_id=4
GET /api/v1/catalog/curricula?program_id=22
GET /api/v1/catalog/courses?program_id=22&limit=50&offset=0
GET /api/v1/catalog/courses?q=MAT
```

Ders listesi en fazla 200 kayıt döndürür. Yıllık planlarda `period_kind=year`, `year_number` dolu ve `semester=null` olur. Kaynak kapsamı ve doğrulama durumları korunur.

## Test ve veri doğrulama

```sh
.venv/bin/python -m scripts.import_catalog
.venv/bin/python -m pytest -q
```

İkinci komut PostgreSQL’deki katalog tablolarını kaynak SQLite veritabanıyla karşılaştırır. Son doğrulama sonucu [`docs/catalog_verification.json`](docs/catalog_verification.json) dosyasındadır.

Testler `.env` içindeki PostgreSQL üzerinde salt okunur çalışır. SQL dosyaları `catalog/` içindedir. Aktarım şema, ek tablolar, görünümler, veriler ve identity sayaçlarını tek transaction içinde uygular; hatada geri alır. Advisory lock eşzamanlı aktarımı engeller. `catalog_migrations` SHA-256 kaydı tekrar aktarımı önler; uygulanmış dosyalar değişirse durur. Sonraki şema değişiklikleri yeni migration ile yapılmalıdır. Migration kaydı olmayan dolu veritabanının üzerine yazılmaz.

Katalog kapsamı, kaynak sınırlamaları ve doğrulama notları [`catalog/RESEARCH_REPORT.md`](catalog/RESEARCH_REPORT.md) dosyasında açıklanır. Bu sürüm PostgreSQL katalog altyapısını ve katalog API’sini içerir; kimlik doğrulama, kişisel ders planı ve takip modülleri sonraki aşamalardadır.

## Lisans

MIT
