# PostgreSQL katalog aktarımı

Yerel veritabanı: `halicmind`, adres: `127.0.0.1:5433`.
Şema: `public`. Uygulama hesabı: superuser olmayan `halicmind`.
Bağlantı ayarı `.env` içindeki `DATABASE_URL`; parola repoya eklenmez.

## Dosyalar

- `catalog/schema.sql`: temel katalog tabloları ve `catalog_export` görünümü.
- `catalog/research_extension.sql`: kaynak izlenebilirliği, yıllık planlar, seçmeli üyelikleri ve `catalog_courses_readable` görünümü.
- `catalog/catalog_data_postgresql.sql`: veriler ve identity sequence düzeltmeleri.
- `scripts/import_catalog.py`: dosyaları tek transaction içinde çalıştıran, checksum ve advisory lock kullanan aktarım.
- `scripts/local_db.py`: yerel küme kurulumu ve başlatma/durdurma.
- `scripts/verify_catalog.py`: tüm kaynak tablo değerlerini karşılaştırma.

Kaynak `research_extension.sql` dosyasındaki `CREATE VIEW IF NOT EXISTS`, PostgreSQL uyumlu `CREATE OR REPLACE VIEW` olarak değiştirildi. Okuma görünümüne güvenilir filtreleme için program, müfredat ve ders revizyon kimlikleri eklendi. Özgün kaynak dosyalar değiştirilmedi.

## 26 Ekim 2026 doğrulaması

14 tablonun tüm satır/sütun değerleri, kaynak `HalicMind_Catalog/catalog.sqlite3` ile eşleşti. Sayısal türler, boolean ve tarih gösterimleri normalize edilerek karşılaştırıldı. Sonuçlar `catalog_verification.json` içindedir.

- 11 akademik birim, 167 program ve 167 müfredat.
- 11.949 program kapsamlı ders kimliği/revizyonu.
- 20.351 dönemlik ve 367 yıllık ders yerleşimi.
- Okuma görünümünde 20.718 yerleşim.
- API entegrasyonu, filtreleme, sayfalama, yıllık planlar ve sequence kontrolleri: 5 test geçti.
- Aktarım ikinci kez çalıştırıldı: checksum doğrulandı, veri tekrarı oluşmadı.
- FastAPI `/health`, katalog sorgusu ve `/docs` gerçek HTTP bağlantısıyla doğrulandı.

Tekrar doğrulama (proje kökünde):

```sh
.venv/bin/python -m scripts.verify_catalog ../HalicMind_Catalog/catalog.sqlite3
.venv/bin/python -m pytest -q
```

Katalogda `partial` ve `needs_review` durumları korunur. Kaynaklarda bulunmayan ön koşullar üretilmemiştir. Kimlikler program kapsamlıdır; farklı programlardaki aynı ders kodu tek ders varsayılmaz. Sonraki değişiklikler için yeni numaralı migration eklenmesi ve düzenli `pg_dump` yedeği önerilir. İlk katalog aktarımı Alembic kullanmaz; uygulama tabloları aşağıdaki bağımsız Alembic zincirindedir.

## Kullanıcı tablosu ve Alembic

`app/db/base.py` SQLAlchemy 2.x `DeclarativeBase` tanımlar. `app/models/__init__.py` modelleri metadata'ya kaydeder. `app/models/user.py` içindeki `User` şu alanlara sahiptir:

| Alan | PostgreSQL türü | Kural |
| --- | --- | --- |
| `id` | `BIGINT IDENTITY` | Birincil anahtar |
| `email` | `VARCHAR(254)` | Zorunlu, normalize ve benzersiz |
| `full_name` | `VARCHAR(200)` | Zorunlu |
| `hashed_password` | `VARCHAR(255)` | Zorunlu; kayıt servisi Argon2id hash üretir |
| `is_active` | `BOOLEAN` | Zorunlu, veritabanı varsayılanı `true` |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Zorunlu, veritabanı varsayılanı `now()` |
| `email_verified_at` | `TIMESTAMP WITH TIME ZONE` | Doğrulanmamış hesaplarda `NULL` |

E-posta politikası tüm adresi küçük harfe çevirmektir. ORM alan atamalarında `strip().lower()` uygulanır; boş değer reddedilir. `ck_users_email_normalized`, doğrudan SQL yazımlarında da `email = lower(btrim(email))` ve boş olmama koşulunu zorunlu tutar. `uq_users_email` benzersizliği veritabanında korur; bu kısıt eşzamanlı kayıt girişimleri için de geçerlidir. Doğrudan SQL ile yazan kod önce aynı normalizasyonu yapmalıdır. Kayıt servisi parolaları Argon2id ile hashler; düz parola veritabanına yazılmaz.

### Haliç öğrenci e-postası politikası

`app/core/email_policy.py` içindeki `normalize_student_email`, yalnızca `öğrenci_numarası@ogr.halic.edu.tr` biçimini kabul eder. Öğrenci numarası ASCII rakamlardan (`0-9`) oluşmalıdır; resmî uzunluk kuralı tanımlanmadığından sabit hane sayısı aranmaz. Adres en fazla 254 karakterdir. Örnek: `23000000001@ogr.halic.edu.tr`. Kişisel adresler, diğer üniversiteler, personel alan adı `halic.edu.tr` ve benzer görünen alt/ek alan adları kabul edilmez.

`0002_halic_student_email`, `ck_users_email_halic_student` CHECK kısıtını ekleyerek aynı kuralı doğrudan SQL yazımlarında da zorunlu tutar. Önceden uygulanmış `0001_create_users` değiştirilmez. Uygun olmayan mevcut hesap varsa ikinci migration başarısız olur ve transaction geri alınır; hesap silinmez veya değiştirilmez. Bu revision'ın downgrade işlemi yalnızca yeni kısıtı kaldırır, kullanıcıları korur.

İleride başka okullar eklendiğinde `ALLOWED_STUDENT_EMAIL_DOMAINS` açık izin listesi ve öğrenci numarası politikası gözden geçirilir; veritabanı kısıtı yeni bir migration ile güncellenir. Genel bir `.edu.tr` son eki kontrolü yerine onaylanan öğrenci alan adları kullanılır.

Bu biçim kontrolü e-posta kutusunun varlığını veya kullanıcıya ait olduğunu kanıtlamaz. Kayıt/giriş modülü ayrıca tek kullanımlık kodu e-postayla gönderir; doğrulanmamış hesaplar giriş yapamaz. Geliştirmede mesajlar Mailpit'e gider. Gerçek sahiplik kontrolü için gerçek SMTP sağlayıcısı yapılandırılmalıdır; ayrıntılar `docs/auth.md` içindedir.

### Doğrulama ve deneme sınırları

`0003_auth_verification`, `users.email_verified_at` alanını ve iki uygulama tablosunu ekler:

- `email_verifications`: kullanıcı başına bir kayıt; `user_id` birincil/yabancı anahtar, benzersiz `token_hash`, `created_at`, `expires_at`. Ham kod yerine SHA-256 özeti saklanır. Başarılı doğrulamada kayıt silinir; yeniden gönderim önceki kodu değiştirir. Kullanıcı silinirse kayıt `ON DELETE CASCADE` ile silinir.
- `auth_rate_limits`: hashlenmiş kapsam/kimlik anahtarı, deneme sayısı ve pencere bitiş zamanı. PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` sayaçları atomik günceller. Biten kayıtlar bir gün sonra sonraki auth istekleri sırasında temizlenir. İşlem başarısız olsa da deneme sayısı kaydedilir.

Mevcut hesapların doğrulama tarihi `NULL` kalır; `is_active` yönetimsel erişim durumudur ve e-posta doğrulamasından bağımsızdır. Bu revision'ın downgrade işlemi doğrulama durumunu, kodları ve sayaçları kaldırır; kullanıcıların diğer alanlarını korur.

`alembic.ini` bağlantı bilgisi içermez; `alembic/env.py` mevcut `Settings` üzerinden `.env` / ortam değişkenlerini okur. `0001_create_users` yalnızca kullanıcı tablosunu ekler; `alembic_version` Alembic tarafından oluşturulur. Katalog SQL dosyaları ve `catalog_migrations` kaydı değiştirilmez.

`app/db/migrations.py` içindeki `MANAGED_TABLES` izin listesi (`users`, `email_verifications`, `auth_rate_limits`, `academic_profiles`, `academic_terms`, `enrollments`, `assignments`, `exam_documents`, `exam_sync_state`, `exam_selections`) iki noktada uygulanır: `include_name` katalog tablolarının reflection aşamasına alınmasını engeller, `include_object` ise yanlışlıkla metadata'ya eklenen katalog modellerini de dışlar. Yeni uygulama tabloları için izin listesi bilinçli olarak genişletilmelidir. Bu filtre autogenerate içindir; elle yazılan migration'lar yine incelenmelidir.

`0004_academic_planning`, akademik profil, kişisel dönem ve dönemlik ders tablolarını ekler. Dönemler program/müfredat bilgisini korur. Ders kaydındaki `(term_id,user_id)` bileşik yabancı anahtarı sahipliği veritabanında da denetler. Katalog derslerinin aynı dönemde etkin tekrarını `course_id` üzerinde kısmi benzersiz indeks engeller. Silme yerine arşivleme uygulanır. Ayrıntılı model ve Swagger örnekleri `docs/academics.md` içindedir.

```sh
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m alembic current
.venv/bin/python -m alembic check
.venv/bin/python -m alembic revision --autogenerate -m "describe application change"
```

`alembic downgrade base` ilk revision'ı geri alarak `users` tablosunu ve içindeki kullanıcı verilerini siler; katalog tablolarına dokunmaz. Geri alma testi geliştirme tablosunda değil, transaction sonunda silinen geçici test şemasında yapılır. Testler upgrade, tekrar upgrade, downgrade, yeniden upgrade, model/şema uyumu, autogenerate kapsamı ve e-posta kısıtlarını doğrular:

```sh
.venv/bin/python -m pytest -q tests/test_user_migrations.py
```

## Ödevler

`0005_assignments`, kişisel derslere bağlı `assignments` tablosunu ekler. `(enrollment_id, user_id)` bileşik yabancı anahtarı başka hesaba ait derse ödev bağlanmasını veritabanında da engeller. Katalog tabloları değişmez. Ödevler silinmek yerine arşivlenir; bağlı dersin arşivlenmesi ödev geçmişini korur. Alanlar ve kullanım: [Ödev rehberi](assignments.md).

`0006_exam_sources`, resmi sınav belge sürümleri, kontrol durumu ve kullanıcıya ait şube seçimlerini ekler. [Sınav entegrasyonu](exams.md).
