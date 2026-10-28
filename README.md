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
docker compose up -d --wait postgres mailpit
.venv/bin/python -m scripts.import_catalog
.venv/bin/python -m alembic upgrade head
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Öğrenci uygulaması: http://127.0.0.1:8000/ — Swagger: http://127.0.0.1:8000/docs — sağlık: http://127.0.0.1:8000/health

Öğrenci arayüzünde kayıt/giriş, e-posta doğrulama, ilk profil kurulumu, dönem ve ders seçimi, not/sonuç güncelleme ve arşivleme bulunur. Mobil ve masaüstünde çalışır. Arayüz mevcut FastAPI uygulamasından sunulur; ayrıca Node.js kurulumu veya bir frontend derleme komutu gerekmez. Kullanım ve oturum ayrıntıları [`docs/frontend.md`](docs/frontend.md) içindedir.

Docker Compose, tüm ekipte aynı PostgreSQL 17 ortamını kullanır. Bağlantı bilgisi Git’e eklenmeyen `.env` dosyasına yazılır. Sabitlenmiş bağımlılık sürümleri için `requirements.lock.txt` kullanılabilir.

Uygulama adı, süreler ve SMTP ayarları `app/core/config.py`; ortak ders durumu/dönem seçenekleri `app/core/choices.py` içindedir. Kullanım ve değiştirme örnekleri [`docs/configuration.md`](docs/configuration.md) dosyasındadır.

Windows PowerShell için:

```powershell
py -3 -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m scripts.setup_env
docker compose up -d --wait postgres mailpit
.venv\Scripts\python -m scripts.import_catalog
.venv\Scripts\python -m alembic upgrade head
```

Sonraki açılışlarda:

```sh
docker compose up -d postgres mailpit
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Windows’ta FastAPI’yi `.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000` ile başlatın. PostgreSQL’i durdurmak için `docker compose stop postgres`, yeniden başlatmak için `docker compose start postgres` kullanın.

`setup_env` her geliştirici için rastgele bir veritabanı parolası ve bağımsız bir JWT imzalama anahtarı üretir. Veritabanı parolası `.env` içindeki `POSTGRES_PASSWORD` ile `DATABASE_URL` alanlarında eşleşir. Mevcut `.env` dosyasının üzerine yazmaz. Boş örnek dosyayı kopyalamak yerine bu komutu kullanın. PostgreSQL ve Mailpit portları yalnızca localhost üzerinde yayımlanır. Bu kurulum yerel geliştirme içindir.

Mevcut kuruluma kimlik doğrulama ayarlarını eklemek için:

```sh
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m scripts.setup_env --add-auth-settings
.venv/bin/python -m alembic upgrade head
docker compose up -d mailpit
```

Bu komut mevcut `.env` değerlerini korur ve eksik auth ayarlarını ekler. Ardından FastAPI'yi yeniden başlatın. Mailpit test posta kutusu: http://127.0.0.1:8025. Yerel geliştirmede mesajlar bu kutuda tutulur; gerçek okul e-postalarına iletilmez.

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
POST /api/v1/auth/register
POST /api/v1/auth/resend-verification
POST /api/v1/auth/verify-email
POST /api/v1/auth/login
GET /api/v1/users/me
```

Ders listesi en fazla 200 kayıt döndürür. Yıllık planlarda `period_kind=year`, `year_number` dolu ve `semester=null` olur. Kaynak kapsamı ve doğrulama durumları korunur.

## Test ve veri doğrulama

```sh
.venv/bin/python -m pytest -q
.venv/bin/python -m scripts.verify_catalog ../HalicMind_Catalog/catalog.sqlite3
```

İkinci komut PostgreSQL’deki katalog tablolarını kaynak SQLite veritabanıyla karşılaştırır. Son doğrulama sonucu [`docs/catalog_verification.json`](docs/catalog_verification.json) dosyasındadır.

Katalog testleri `.env` içindeki PostgreSQL üzerinde salt okunur çalışır. Kullanıcı/migration testleri rastgele adlandırılmış geçici şemalarda çalışır; şema ve test verileri transaction sonunda geri alınır. Test hesabının şema oluşturma yetkisi olmalıdır. SQL dosyaları `catalog/` içindedir. Aktarım şema, ek tablolar, görünümler, veriler ve identity sayaçlarını tek transaction içinde uygular; hatada geri alır. Advisory lock eşzamanlı aktarımı engeller. `catalog_migrations` SHA-256 kaydı tekrar aktarımı önler; uygulanmış dosyalar değişirse durur. Sonraki şema değişiklikleri yeni migration ile yapılmalıdır. Migration kaydı olmayan dolu veritabanının üzerine yazılmaz.

Katalog kapsamı, kaynak sınırlamaları ve doğrulama notları [`catalog/RESEARCH_REPORT.md`](catalog/RESEARCH_REPORT.md) dosyasında açıklanır. Kayıt, e-posta doğrulama ve JWT ile giriş hazırdır. Swagger akışı ve SMTP yapılandırması [`docs/auth.md`](docs/auth.md) içindedir. Akademik profil, kişisel dönemler, katalog önerileri ve ders geçmişi hazırdır; kullanım örnekleri [`docs/academics.md`](docs/academics.md) içindedir. Ödev, sınav ve çalışma takibi sonraki aşamalardadır.

## Uygulama migration'ları

Alembic bağlantıyı `DATABASE_URL` ayarından alır. Mevcut kurulumu güncellemek için:

```sh
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m scripts.setup_env --add-auth-settings
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m alembic current
.venv/bin/python -m alembic check
```

İlk revision `0001_create_users`, yalnızca `users` tablosunu ekler. Alembic ayrıca kendi `alembic_version` takip tablosunu oluşturur. Katalog aktarımı `scripts.import_catalog` ve `catalog_migrations` üzerinden bağımsız çalışmaya devam eder; mevcut katalog için Alembic `stamp` işlemi gerekmez. Uygulama başlangıcında otomatik tablo oluşturulmaz.

İkinci revision `0002_halic_student_email`, kullanıcı e-postasını yalnızca rakamlardan oluşan öğrenci numarası ve `@ogr.halic.edu.tr` alan adıyla sınırlar. Model e-postayı normalize eder; veritabanı kısıtı kişisel adresleri ve diğer alan adlarını reddeder. `0003_auth_verification`, `email_verified_at`, tek kullanımlık doğrulama kayıtları ve PostgreSQL üzerinde ortak deneme sayaçları ekler. Önceden var olan hesaplar otomatik doğrulanmaz.

`0004_academic_planning`, `academic_profiles`, `academic_terms` ve `enrollments` tablolarını ekler. Hazırlık ve yıllık planlar desteklenir; geçmiş derslerin girilmesi isteğe bağlıdır. Kişisel dersler ortak kataloğu değiştirmez; listeden çıkarılan ders arşivlenir.

Autogenerate kapsamı `app/db/migrations.py` içindeki açık izin listesiyle altı uygulama tablosuna sınırlandırılır; katalog tabloları dışarıda kalır. Yeni uygulama tablosu eklerken bu listeyi de güncelleyin; katalog tablolarını eklemeyin. Aday migration'ı uygulamadan önce inceleyin. Kullanıcı alanları, e-posta politikası ve geri alma bilgisi [`docs/database.md`](docs/database.md) içindedir.

## Lisans

MIT
