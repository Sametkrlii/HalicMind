# HalicMind

Haliç Üniversitesi öğrencilerinin bölümüne ve müfredatına uygun dersleri bulmasını, kişisel dönemlerini oluşturmasını ve ders geçmişini tek yerde tutmasını sağlayan web uygulaması.

Proje, Advanced Computer Programming dersi kapsamında geliştiriliyor. Mevcut sürüm; akademik katalog, kullanıcı kaydı ve e-posta doğrulama, akademik profil, kişisel dönemler ve ders yönetimini kapsar. Ödev, sınav ve çalışma takibi sonraki geliştirme aşamalarıdır.

> HalicMind'de ders seçmek üniversitenin resmi ders kayıt sisteminde işlem yapmaz. Ders geçmişi ve sonuçları öğrenci tarafından girilir; OBS/SSO veya transkript entegrasyonu bulunmaz.

## Mevcut özellikler

- **Akademik katalog:** Akademik birimler, programlar, müfredatlar ve dersler; program/müfredat filtreleri ve ders araması.
- **Kayıt ve giriş:** Yalnızca `ogr_no@ogr.halic.edu.tr` biçimindeki öğrenci adresleri, normalize edilmiş benzersiz e-posta, Argon2 parola özeti ve JWT ile kimlik doğrulama.
- **E-posta doğrulama:** Süreli, tek kullanımlık doğrulama kodu ve yeniden gönderim. Doğrulanmamış hesaplar kişisel modüllere erişemez.
- **Akademik profil:** Program, müfredat, giriş yılı, sınıf ve hazırlık durumu. Profil değişikliği eski dönemleri silmez.
- **Kişisel dönemler:** Güz, Bahar, Yaz ve yıllık planlar. Takvim dönemi ile müfredat dönem numarası ayrı tutulur.
- **Ders önerileri:** Seçilen müfredata göre zorunlu dersler, seçmeli dersler ve gruplar. Öneriler otomatik olarak öğrencinin listesine eklenmez.
- **Kişisel dersler:** Katalogdan seçim veya yalnızca kullanıcıya özel ders oluşturma; sonuç ve isteğe bağlı not bilgisi; farklı dönemlerde tekrar alma.
- **Arşivleme:** Listeden çıkarılan ders kalıcı olarak silinmez; geri yüklenebilir. Aynı dönemde yinelenen aktif ders kaydı engellenir.
- **Kullanıcıya özel erişim:** Her öğrenci yalnızca kendi profilini, dönemlerini ve ders kayıtlarını yönetir.
- **Web arayüzü:** Mobil ve masaüstü uyumlu kayıt/giriş, profil, genel görünüm, dersler ve dönem geçmişi ekranları.

## Teknolojiler

| Katman | Kullanılan araçlar |
| --- | --- |
| API | Python 3.12+, FastAPI, Pydantic |
| Veri erişimi | SQLAlchemy 2, psycopg, PostgreSQL 17 |
| Şema yönetimi | Alembic; katalog için ayrı SQL aktarımı |
| Kimlik doğrulama | Argon2, PyJWT |
| Arayüz | HTML, CSS ve JavaScript; FastAPI üzerinden sunulur |
| Yerel servisler | Docker Compose, Mailpit |
| Test | pytest, FastAPI TestClient / httpx |

Arayüz için Node.js kurulumu veya frontend derleme adımı gerekmez. Docker Compose yalnızca PostgreSQL ve Mailpit'i başlatır; FastAPI aşağıdaki komutla ayrıca çalıştırılır.

## İlk kurulum

Python 3.12 veya üzeri ile çalışan bir Docker kurulumu gerekir. Tüm komutları `HalicMind` depo kökünde çalıştırın.

### macOS / Linux

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m scripts.setup_env
docker compose up -d --wait postgres mailpit
.venv/bin/python -m scripts.import_catalog
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Windows PowerShell

```powershell
py -3 -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m scripts.setup_env
docker compose up -d --wait postgres mailpit
.venv\Scripts\python -m scripts.import_catalog
.venv\Scripts\python -m alembic upgrade head
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

`setup_env`, rastgele bir veritabanı parolası ve bağımsız JWT anahtarıyla yerel `.env` oluşturur; mevcut dosyanın üzerine yazmaz. `.env.example` bir şablondur; boş parola ve anahtarlarla uygulama başlatılamaz. `--reload` yerel geliştirme içindir.

### Uygulamayı açma

| Adres | Amaç |
| --- | --- |
| [Öğrenci arayüzü](http://127.0.0.1:8000/) | Uygulamanın kullanımı |
| [Swagger](http://127.0.0.1:8000/docs) | API istekleri ve şemaları |
| [Sağlık kontrolü](http://127.0.0.1:8000/health) | Sunucunun yanıtını kontrol etme |
| [Mailpit](http://127.0.0.1:8025) | Yerel doğrulama e-postalarını görüntüleme |

**Yerel kurulum gerçek okul e-postasına mesaj göndermez.** Doğrulama mesajları Mailpit'te tutulur. Gerçek gönderim için SMTP sağlayıcısı yapılandırılmalıdır.

İlk kullanım akışı: **kayıt → Mailpit'ten doğrulama kodu → e-posta doğrulama → giriş → akademik profil → dönem oluşturma → ders ekleme**. Geçmiş dönemleri doldurmak zorunlu değildir.

Swagger'da korumalı endpoint'ler için önce hesabınızı doğrulayın. **Authorize** penceresinde `username` alanına okul e-postanızı, `password` alanına parolanızı girin; `client_id` ve `client_secret` boş kalır.

### Sonraki açılışlar

```sh
docker compose up -d postgres mailpit
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Windows'ta Python yolu `.venv\Scripts\python` olur. FastAPI'yi terminalde `Ctrl+C`, Docker servislerini `docker compose stop` ile durdurabilirsiniz. Normal açılışta katalog aktarımını tekrar çalıştırmanız gerekmez.

### Mevcut kurulumu güncelleme

```sh
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m scripts.setup_env --add-auth-settings
docker compose up -d --wait postgres mailpit
.venv/bin/python -m alembic upgrade head
```

`--add-auth-settings`, mevcut `.env` değerlerini koruyarak eksik kimlik doğrulama ayarlarını ekler. Ardından FastAPI'yi yeniden başlatın. Windows'ta aynı komutlarda `.venv\Scripts\python` kullanın.

## Yapılandırma ve gizli bilgiler

- Uygulama ayarları: `app/core/config.py`. Varsayılan uygulama adı `HalicMind`; `.env` içindeki `APPLICATION_NAME` ile değiştirilebilir.
- Ortak ders durumu ve dönem seçenekleri: `app/core/choices.py`.
- Yerel bağlantı: PostgreSQL `127.0.0.1:5433`, SMTP `127.0.0.1:1025`. Docker portları localhost ile sınırlıdır.
- `.env`, `.venv` ve yerel PostgreSQL çalışma klasörü `.local/`, Git dışında tutulur. Gerçek parolaları, JWT anahtarlarını, kullanıcı verilerini ve veritabanı yedeklerini depoya eklemeyin.
- Web oturumu HttpOnly cookie kullanır; JWT tarayıcıda `localStorage` içine yazılmaz. Swagger/API istemcileri Bearer token kullanabilir.

Docker volume içindeki veritabanı parolası, `.env` değişince otomatik güncellenmez. Parola değiştirmek için:

1. `docker exec -it halicmind-postgres psql -U halicmind -d halicmind` ile bağlanın.
2. `\password halicmind` ile uzun, rastgele bir parola belirleyin; `\q` ile çıkın.
3. `.env` içindeki `POSTGRES_PASSWORD` ile `DATABASE_URL` parola bölümünü eşleştirin. URL içinde özel karakter varsa URL kodlaması gerekir.
4. `docker compose up -d --wait --force-recreate postgres` çalıştırıp FastAPI'yi yeniden başlatın.

Bu işlem için volume silmek gerekmez. `docker compose down -v` kalıcı veritabanı volume'unu siler; mevcut verileri korumak istiyorsanız kullanmayın. Git kaydı, veritabanı yedeğinin yerini tutmaz.

Ayarların kullanım ayrıntıları: [Yapılandırma rehberi](docs/configuration.md).

## API özeti

Aşağıdaki yollar `/api/v1` altında sunulur. Tam alanlar ve örnek yanıtlar Swagger'dadır.

| Modül | Başlıca endpoint'ler |
| --- | --- |
| Katalog | `GET /catalog/academic-units`, `/catalog/programs`, `/catalog/curricula`, `/catalog/courses` |
| Hesap | `POST /auth/register`, `/auth/resend-verification`, `/auth/verify-email`, `/auth/login` |
| Kullanıcı | `GET /users/me` |
| Akademik profil | `GET`, `PUT /users/me/academic-profile` |
| Dönemler | `GET`, `POST /terms`; `GET`, `PATCH`, `DELETE /terms/{term_id}` |
| Ders önerileri | `GET /terms/{term_id}/suggestions` |
| Kişisel dersler | `GET`, `POST /enrollments`; `GET`, `PATCH`, `DELETE /enrollments/{enrollment_id}` |
| Geri yükleme | `POST /enrollments/{enrollment_id}/restore` |

Katalog herkese açıktır; kişisel endpoint'ler aktif ve e-postası doğrulanmış hesap gerektirir. Liste endpoint'lerinde `limit` ve `offset` kullanılır; üst sınır 200 kayıttır. Derslerde `DELETE` arşivler. Arşivlenmiş dersleri listelemek için `include_archived=true` kullanılır; ders kaydı bulunan dönemler doğrudan silinemez.

## Veritabanı ve migration'lar

Katalog ile kullanıcı verilerinin şema yönetimi ayrıdır:

- **Katalog:** `catalog/` altındaki SQL dosyaları `scripts.import_catalog` ile aktarılır. Aktarım transaction, advisory lock ve `catalog_migrations` içindeki SHA-256 kayıtlarıyla korunur. Uygulanmış SQL dosyaları değiştirilerek tekrar aktarılmaz.
- **Uygulama:** Alembic, `DATABASE_URL` üzerinden kullanıcı ve akademik planlama tablolarını yönetir. Uygulama açılışında otomatik tablo oluşturulmaz.

| Revision | Değişiklik |
| --- | --- |
| `0001_create_users` | Yalnızca kullanıcı tablosunu ekler |
| `0002_halic_student_email` | Haliç öğrenci e-postası kısıtını ekler |
| `0003_auth_verification` | E-posta doğrulama ve ortak deneme sayaçlarını ekler |
| `0004_academic_planning` | Akademik profil, kişisel dönem ve ders tablolarını ekler |

Katalog aktarımı uygulama migration'larından önce yapılmalıdır. Alembic autogenerate kapsamı `app/db/migrations.py` içindeki altı uygulama tablosuyla sınırlıdır; mevcut katalog tablolarını silinecek tablo olarak değerlendirmemesi için katalog kapsam dışında tutulur. Yeni uygulama tablosu eklenirken izin listesi ve migration birlikte güncellenmelidir.

```sh
.venv/bin/python -m alembic current
.venv/bin/python -m alembic check
```

## Test ve doğrulama

Çalışan PostgreSQL ve geçerli yerel `.env` ile:

```sh
.venv/bin/python -m pytest -q
```

Testler; e-posta politikası, kayıt/giriş, doğrulama, migration kapsamı, kullanıcı sahipliği, akademik profil, dönem ve ders işlemleri ile web oturumu güvenliğini kapsar. Katalog testleri mevcut kataloğu salt okunur kullanır. Veritabanına yazan testler geçici şemalar ve geri alınan transaction'larla çalışır; test veritabanı kullanıcısının şema oluşturma yetkisi gerekir.

Kaynak SQLite kataloğuyla karşılaştırma yapmak için ayrıca kaynak çalışma alanı gerekir:

```sh
.venv/bin/python -m scripts.verify_catalog ../HalicMind_Catalog/catalog.sqlite3
```

Bu kaynak klasör normal uygulama kurulumu için gerekli değildir; PostgreSQL aktarım dosyaları depoda bulunur. Son katalog doğrulama raporu: [catalog_verification.json](docs/catalog_verification.json).

## Proje yapısı

```text
app/
  api/          Endpoint'ler ve kimlik doğrulama bağımlılıkları
  core/         Ayarlar, ortak seçenekler ve güvenlik yardımcıları
  db/           Bağlantı, Base ve migration kapsamı
  models/       SQLAlchemy modelleri
  schemas/      İstek ve yanıt şemaları
  services/     İş kuralları, katalog önerileri ve e-posta gönderimi
  web/          HTML, CSS ve JavaScript arayüzü
alembic/        Uygulama migration'ları
catalog/        Katalog şeması, verisi ve kaynak araştırması
scripts/        Kurulum, aktarım ve doğrulama araçları
tests/          Otomatik testler
docs/           Teknik belgeler ve arayüz ekran görüntüleri
```

## Sınırlar ve sonraki adımlar

Mevcut katalogda kaynak kapsamı ve doğrulama durumu programlara göre değişebilir; tüm kayıtlar resmi olarak eksiksiz doğrulanmış kabul edilmemelidir. Kapsam bilgileri önerilerde korunur. Ayrıntılar: [Katalog araştırma raporu](catalog/RESEARCH_REPORT.md).

Planlanan geliştirme sırası:

1. Kişisel derslere bağlı ödevler, teslim tarihleri ve tamamlanma takibi.
2. Sınav takvimi.
3. Çalışma süresi kayıtları ve gerçek verilere dayalı özetler.
4. Teslim tarihi, önem ve iş yüküne göre açıklanabilir önceliklendirme.

Bu modüller henüz kullanıma hazır değildir. Gerçek kullanıcılara açılmadan önce SMTP ile gerçek gönderim, parola sıfırlama, HTTPS dağıtımı ve veritabanı yedekleme/geri yükleme süreci tamamlanmalıdır.

## Belgeler

- [Kimlik doğrulama ve Swagger kullanımı](docs/auth.md)
- [Akademik profil, dönemler ve dersler](docs/academics.md)
- [Web arayüzü ve oturum yönetimi](docs/frontend.md)
- [Ayarlar ve ortak seçenekler](docs/configuration.md)
- [Veritabanı ve migration ayrıntıları](docs/database.md)
- [API notları](docs/api.md)

## Lisans

[MIT](LICENSE)
