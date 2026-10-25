# HaliçMind

FastAPI katalog API'si PostgreSQL 17 üzerinden çalışır.

## macOS kurulumu

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

Doğrulanan bağımlılık sürümleri `requirements.lock.txt` içindedir (`pip install -r requirements.lock.txt`).

`setup`, `.local/postgres` içinde bağımsız bir PostgreSQL kümesi, superuser olmayan `halicmind` kullanıcısı ve aynı adlı veritabanını oluşturur. TCP yalnızca 127.0.0.1:5433 üzerinde SCRAM parola doğrulamasıyla açılır. Rastgele parola, Git tarafından dışlanan ve yalnızca sahibince okunabilen `.env` dosyasındadır. Kaynak SQLite dosyaları değiştirilmez.

Sonraki açılışlarda:

```sh
.venv/bin/python -m scripts.local_db start
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Veritabanını durdurmak veya durumunu görmek için `start` yerine `stop` veya `status` kullanın. Otomatik açılış servisi kurulmaz. PostgreSQL farklı konumdaysa `PG_BIN` ile binary klasörünü belirtin.

## API

```text
GET /api/v1/catalog/academic-units
GET /api/v1/catalog/programs?academic_unit_id=4
GET /api/v1/catalog/curricula?program_id=22
GET /api/v1/catalog/courses?program_id=22&limit=50&offset=0
GET /api/v1/catalog/courses?q=MAT
```

Ders listesi en fazla 200 kayıt döndürür. Yıllık planlarda `period_kind=year`, `year_number` dolu ve `semester=null` olur. Kaynak kapsamı ve doğrulama durumları korunur.

## Aktarım ve test

```sh
.venv/bin/python -m scripts.import_catalog
.venv/bin/python -m pytest -q
```

Tüm kaynak verilerini karşılaştırmak için `.venv/bin/python -m scripts.verify_catalog ../HalicMind_Catalog/catalog.sqlite3` kullanın; son sonuçlar `docs/catalog_verification.json` içindedir.

Testler `.env` içindeki PostgreSQL üzerinde salt okunur çalışır. SQL dosyaları `catalog/` içindedir. Aktarım şema, ek tablolar, görünümler, veriler ve identity sayaçlarını tek transaction içinde uygular; hatada geri alır. Advisory lock eşzamanlı aktarımı engeller. `catalog_migrations` SHA-256 kaydı tekrar aktarımı önler; uygulanmış dosyalar değişirse durur. Sonraki şema değişiklikleri yeni migration ile yapılmalıdır. Migration kaydı olmayan dolu veritabanının üzerine yazılmaz.

Başka PostgreSQL sunucusu için `.env.example` dosyasını `.env` olarak kopyalayıp bağlantıyı düzenleyin; boş veritabanı ve şema oluşturma yetkisi olan kullanıcıyı sağlayın. Sonra `scripts.import_catalog` çalıştırın. `local_db` yalnızca yerel kurulum içindir.

Katalog, 25 Ekim 2026 tarihli yerel `HalicMind_Catalog` araştırmasından alınmıştır. Kapsam sınırlamaları [araştırma raporunda](catalog/RESEARCH_REPORT.md) kayıtlıdır; tüm kataloglar eksiksiz veya elle doğrulanmış sayılmaz.

GitHub başlangıç sürümündeki diğer Python modülleri boş iskelettir. Bu çalışma veritabanı ve katalog API'sini uygular; kimlik doğrulama, kişisel ders planı ve takip servisleri henüz uygulanmamıştır.
