# Kayıt, e-posta doğrulama ve giriş

Kayıt yalnızca `öğrenci_numarası@ogr.halic.edu.tr` adreslerini kabul eder. Hesap `is_active=true`, `email_verified_at=null` olarak açılır. Doğrulama tamamlanmadan giriş veya korumalı endpoint erişimi verilmez. Katalog endpoint'leri herkese açıktır.

Öğrenciler için bu akış artık http://127.0.0.1:8000/ adresinde arayüz üzerinden de kullanılabilir. Tarayıcı aynı JWT'yi HttpOnly çerezle taşır; Swagger Bearer akışı korunur. Çerezli isteklerin origin/CSRF kontrolü ve çıkış ayrıntıları `frontend.md` içindedir.

## Yerel ortam

```sh
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m scripts.setup_env --add-auth-settings
docker compose up -d --wait postgres mailpit
.venv/bin/python -m alembic upgrade head
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Yeni kurulumda önce README'deki katalog aktarımını yapın. FastAPI zaten çalışıyorsa ayar değişikliklerinden sonra yeniden başlatın. Windows'ta `.venv/bin/python` yerine `.venv\Scripts\python` kullanın.

Swagger: http://127.0.0.1:8000/docs. Test posta kutusu: http://127.0.0.1:8025.

Mailpit gerçek okul kutusuna mesaj iletmez. Bu ortam akışı geliştirmek içindir; yerel posta kutusuna erişen kişi test kodlarını görebilir. SMTP ve posta kutusu portları yalnızca `127.0.0.1` üzerinden erişilir.

## Swagger'da adım adım

1. `POST /api/v1/auth/register` için şu JSON'u gönderin. Kendi öğrenci adresinizle test edebilirsiniz; yerel modda mesaj yine Mailpit'e gider.

   ```json
   {
     "email": "23000000001@ogr.halic.edu.tr",
     "full_name": "Test Öğrenci",
     "password": "Yerel-Test-Parolasi-123!"
   }
   ```

   `201` döner. Ad/soyad 1–200, parola 12–128 karakter olmalıdır. E-posta normalize edilir. İstemci `is_active` veya `email_verified_at` atayamaz. API ham doğrulama kodunu döndürmez.

2. Mailpit'teki son e-postadan 43 karakterlik doğrulama kodunu kopyalayın. `POST /api/v1/auth/verify-email` endpoint'ine gönderin:

   ```json
   {"token": "E_POSTADAKI_KODU_BURAYA_YAPISTIRIN"}
   ```

   `200` döner. Kod 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir. Geçersiz, süresi geçmiş veya kullanılmış kod `400` döndürür. Kodun biçimi geçersizse `422` döner.

3. Swagger'da **Authorize** düğmesine basın. `username` alanına okul e-postanızı, `password` alanına kayıt parolanızı yazın. Giriş endpoint'i OAuth2 formu (`application/x-www-form-urlencoded`) kullanır. JSON gönderilmez.

4. `GET /api/v1/users/me` isteğini çalıştırın. Profil, doğrulama zamanı ve hesap durumu döner; parola veya hash hiçbir profil yanıtına eklenmez.

Doğrudan `POST /api/v1/auth/login` çağrısı `access_token`, `token_type=bearer` ve `expires_in` (saniye) döndürür. Diğer isteklerde `Authorization: Bearer <access_token>` başlığı kullanılır. Token 30 dakika geçerlidir; yanıtta `Cache-Control: no-store` vardır.

## Yeniden gönderim ve hata davranışları

`POST /api/v1/auth/resend-verification` gövdesi `{"email":"23000000001@ogr.halic.edu.tr"}` şeklindedir. Uygun hesap varsa yeni kod gönderilir ve önceki kod geçersiz olur. Bilinmeyen, pasif veya zaten doğrulanmış hesaplar da aynı genel `202` mesajını alır; mesaj gönderilmez.

SMTP kabulü başarısız olursa `503` ve `Retry-After: 60` döner. Oluşturulmuş hesap doğrulanmamış kalır; bir dakika sonra yeniden gönderme kullanılabilir. Kayıt ve kod SMTP çağrısından önce kaydedilir; dış e-posta hizmeti ile PostgreSQL arasında ortak transaction yoktur. Bu sürümde arka plan teslim kuyruğu/otomatik tekrar deneme bulunmaz. SMTP'nin mesajı kabul etmesi, alıcının gelen kutusuna ulaştığını garanti etmez.

| Durum | Yanıt |
| --- | --- |
| Uygun olmayan okul adresi / geçersiz kayıt bilgileri | `422` |
| Kayıtlı e-posta | `409` (gönderim cooldown'ı varsa önce `429`) |
| Yanlış e-posta veya parola / pasif hesap | `401`, aynı genel mesaj |
| Doğru parola, doğrulanmamış hesap | `403` |
| Geçersiz / süresi dolmuş / kullanılmış kod | `400` |
| Eksik / bozuk / süresi dolmuş JWT | `401` |
| Deneme sınırı | `429`, `Retry-After` saniye başlığı |
| SMTP bağlantı veya gönderim hatası | `503` |

## Deneme sınırları

Sayaçlar PostgreSQL'de tutulur; yeniden başlatma veya birden fazla worker sınırları sıfırlamaz. Sabit zaman pencereleri kullanılır.

| İşlem | Sınır |
| --- | --- |
| Kayıt | IP başına 5 / 5 dakika |
| Giriş | IP başına 20 / dakika ve e-posta başına 10 / 5 dakika |
| Doğrulama kodunu kullanma | IP başına 20 / dakika |
| Yeniden gönderim | IP başına 5 / 5 dakika |
| Kayıt / yeniden gönderim arası bekleme | E-posta başına 60 saniye |
| Yeniden gönderim | E-posta başına 5 / saat |

Kullanıcının gönderdiği `X-Forwarded-For` başlığı uygulama tarafından doğrudan kullanılmaz. Reverse proxy arkasına dağıtımda ASGI sunucusunun güvenilen proxy adresleri yapılandırılmalıdır; aksi hâlde tüm kullanıcılar proxy IP sınırını paylaşabilir. Paylaşılan okul ağındaki sınırlar gerçek trafik görüldükçe ayarlanabilir.

## Gerçek okul kutusuna gönderim

Bir SMTP sağlayıcısından alınmış hesap ve doğrulanmış gönderici adresini `.env` dosyasına tanımlayın:

```dotenv
SMTP_HOST=smtp.saglayiciniz.example
SMTP_PORT=587
SMTP_TLS_MODE=starttls
SMTP_USERNAME=hesabiniz
SMTP_PASSWORD=saglayici_parolaniz
SMTP_FROM=noreply@size-ait-alan-adi.example
```

Bu değerler örnektir; gerçek bir sağlayıcı hesabı oluşturmaz. Sağlayıcının belirttiği değerleri kullanın. TLS bağlantısında sertifika kontrolü aktiftir; uzak SMTP için şifresiz mod reddedilir. Sağlayıcı 465 kullanıyorsa `SMTP_TLS_MODE=ssl` seçin. Gerçek ortama geçerken API'yi HTTPS üzerinden sunun ve yerel Mailpit'i gönderen hizmet olarak kullanmayın.

`JWT_SECRET_KEY` en az 32 karakterlik özel bir anahtar olmalıdır. Kurulum aracı 32 rastgele bayttan 64 karakterlik bir anahtar üretir ve mevcut değeri korur. Anahtarı değiştirmek mevcut access token'ları geçersiz kılar. Parolalar Argon2id; e-posta kodları 32 rastgele bayttan üretilir, veritabanında SHA-256 özeti tutulur. JWT'de parola veya doğrulama kodu bulunmaz; `sub`, `iat`, `exp`, `iss`, `aud`, `type` doğrulanır.

Refresh token, parola sıfırlama, e-posta değiştirme ve token bazında sunucu tarafı çıkış bu sürümde yoktur. Kullanıcı pasifleştirilirse korumalı endpoint erişimi mevcut JWT ile de kesilir. İleride e-posta değiştirme eklenirse mevcut doğrulama kaldırılmalı ve yeni adres tekrar doğrulanmalıdır.

## Test

```sh
.venv/bin/python -m pytest -q
.venv/bin/python -m alembic check
.venv/bin/python -m scripts.smoke_auth
```

API testleri geçici PostgreSQL şemalarında çalışır ve tüm verileri geri alır. SMTP birim testleri ağ kullanmaz. Gerçek Mailpit duman testi yerel SMTP teslimini ve gelen kodla doğrulama → giriş → profil akışını ayrıca doğrular; dış okul adreslerine test mesajı gönderilmez.
