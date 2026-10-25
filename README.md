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

- Python 3.12 veya üzeri
- Docker Desktop (Windows/macOS/Linux)

Proje kökünde:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m scripts.setup_env
docker compose up -d --wait postgres
.venv/bin/python -m scripts.import_catalog
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Swagger: http://127.0.0.1:8000/docs — sağlık: http://127.0.0.1:8000/health

Docker Compose, tüm ekipte aynı PostgreSQL 17 ortamını kullanır. Bağlantı bilgisi Git’e eklenmeyen `.env` dosyasına yazılır. Sabitlenmiş bağımlılık sürümleri için `requirements.lock.txt` kullanılabilir.

Windows PowerShell için:

```powershell
py -3 -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m scripts.setup_env
docker compose up -d --wait postgres
.venv\Scripts\python -m scripts.import_catalog
```

Sonraki açılışlarda:

```sh
docker compose up -d postgres
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Windows’ta FastAPI’yi `.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000` ile başlatın. PostgreSQL’i durdurmak için `docker compose stop postgres`, yeniden başlatmak için `docker compose start postgres` kullanın.

`setup_env` her geliştirici için rastgele bir parola üretir ve aynı parolayı `.env` içindeki `POSTGRES_PASSWORD` ile `DATABASE_URL` alanlarına yazar. Mevcut `.env` dosyasının üzerine yazmaz. Boş örnek dosyayı kopyalamak yerine bu komutu kullanın. PostgreSQL portu yalnızca `127.0.0.1:5433` üzerinde yayımlanır. Bu kurulum yerel geliştirme içindir.

### Daha önce Docker kurulumu yaptıysanız

Mevcut Docker volume içindeki parola, `.env` değiştirilince otomatik güncellenmez. Verileri koruyarak değiştirmek için:

1. Çalışan container'a `docker exec -it halicmind-postgres psql -U halicmind -d halicmind` ile girin.
2. `\password halicmind` çalıştırın ve parola yöneticinizle ürettiğiniz uzun, rastgele, yalnızca harf/rakam içeren yeni parolayı iki kez girin. `\q` ile çıkın.
3. Yerel `.env` içinde `POSTGRES_PASSWORD` değerini ve `DATABASE_URL` içindeki parola bölümünü aynı yeni parolayla güncelleyin. Parolayı Git'e veya mesajlara eklemeyin.
4. `docker compose up -d --wait --force-recreate postgres` ile localhost port ayarını uygulayın; FastAPI'yi yeniden başlatın.

Volume'u silmek gerekmez. Eski örnek parola Git geçmişinde bulunsa da yeni kurulumlarda kullanılmaz. Docker henüz kurulmadıysa yukarıdaki yeni kurulum adımlarını izleyin. Homebrew ile oluşturulmuş veritabanı kullanan geliştiriciler mevcut `.env` dosyalarını korumalı; Docker'a geçmeden önce aynı 5433 portunu kullanan yerel sunucuyu durdurmalıdır.

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
.venv/bin/python -m pytest -q
.venv/bin/python -m scripts.verify_catalog ../HalicMind_Catalog/catalog.sqlite3
```

İkinci komut PostgreSQL’deki katalog tablolarını kaynak SQLite veritabanıyla karşılaştırır. Son doğrulama sonucu [`docs/catalog_verification.json`](docs/catalog_verification.json) dosyasındadır.

Testler `.env` içindeki PostgreSQL üzerinde salt okunur çalışır. SQL dosyaları `catalog/` içindedir. Aktarım şema, ek tablolar, görünümler, veriler ve identity sayaçlarını tek transaction içinde uygular; hatada geri alır. Advisory lock eşzamanlı aktarımı engeller. `catalog_migrations` SHA-256 kaydı tekrar aktarımı önler; uygulanmış dosyalar değişirse durur. Sonraki şema değişiklikleri yeni migration ile yapılmalıdır. Migration kaydı olmayan dolu veritabanının üzerine yazılmaz.

Katalog kapsamı, kaynak sınırlamaları ve doğrulama notları [`catalog/RESEARCH_REPORT.md`](catalog/RESEARCH_REPORT.md) dosyasında açıklanır. Bu sürüm PostgreSQL katalog altyapısını ve katalog API’sini içerir; kimlik doğrulama, kişisel ders planı ve takip modülleri sonraki aşamalardadır.

## Lisans

MIT
