# Ayarları ve seçenekleri değiştirme

## Uygulama ayarları

`app/core/config.py` içindeki `Settings`, uygulama ayarlarının tek merkezidir. `.env` veya ortam değişkenleri varsayılanları değiştirebilir. Örneğin:

```dotenv
APPLICATION_NAME=HaliçMind
ACCESS_TOKEN_EXPIRE_MINUTES=30
EMAIL_VERIFICATION_EXPIRE_MINUTES=30
```

Python tarafında:

```python
from app.core.config import settings

settings.application_name
settings.access_token_expire_minutes
```

Uygulama adı API başlığında ve doğrulama e-postalarında kullanılır. Arayüz aynı adı `/api/v1/ui-config` üzerinden alır; görünür marka metni ve tarayıcı başlığı buradan beslenir. JavaScript Python dosyasını doğrudan import etmez. İlk HTML yüklemesinde ve yapılandırma alınamazsa mevcut HaliçMind adı yedek olarak korunur. Logo ve görsel kimlik ayrı tasarım öğeleridir.

Ayar değişikliğinden sonra FastAPI'yi yeniden başlatın. `.env` özel kalmalıdır; gerçek anahtar ve parolalar kod veya belgeler içine yazılmaz. JWT issuer, cookie adı ve özel HTTP header gibi teknik protokol kimlikleri görünen marka adından bağımsızdır; ad değişikliği mevcut oturum biçimini değiştirmez.

## Ortak seçenekler

`app/core/choices.py`, API şemalarının ve endpoint filtrelerinin ortak kabul ettiği değerleri içerir:

- `CourseStatus`: `in_progress`, `passed`, `failed`, `withdrawn`, `exempt`.
- `TermType`: `fall`, `spring`, `summer`, `annual`.
- `PeriodKind`: `semester`, `year`.
- `PreparationStatus`: `not_required`, `in_progress`, `completed`, `exempt`.

Mevcut `Literal` doğrulama yöntemi korunur; yeni bir enum dönüştürme veya dinamik yapılandırma katmanı eklenmez. Değerler API ve veritabanında aynı metinlerle saklanır.

Veritabanı CHECK kısıtları, uygulanmış migration'lar ve arayüzün Türkçe etiketleri kendi amaçlarıyla açık tutulur. Yeni bir durum eklenirse bu tek dosyayı düzenlemek tek başına yeterli değildir: yeni migration ve arayüz etiketi de birlikte ele alınmalıdır. Eski migration'lar ortak seçenek dosyasını import etmez; geçmiş şema sürümleri değişmez.

## Kullanıcı verileri

Ad, e-posta, sınıf, bölüm kimliği, dersler ve notlar her öğrenciye özel model/veritabanı alanlarıdır. Ortak ayar dosyasına taşınmaz. Bu düzenlemenin faydası bakım ve okunabilirliktir; çalışma hızında belirgin bir iyileştirme iddiası yoktur.

## KVKK taslağındaki kimlik bilgileri

`DATA_CONTROLLER_NAME` ve `PRIVACY_CONTACT_EMAIL` isteğe bağlı ayarlardır. Gerçek veri sorumlusu ve çalışır başvuru adresi belirlenmeden değer uydurulmamalıdır. Bu iki alan `/api/v1/ui-config` üzerinden bilgilendirme sayfasında gösterilir; özel anahtar veya parola için kullanılmaz.

Bu alanları doldurmak tek başına KVKK metnini tamamlamaz. Hukuki sebepler, alıcılar/aktarım koşulları, saklama-silme süreleri ve başvuru süreci gerçek yayın ortamına göre ayrıca kesinleştirilmelidir. Mevcut metin taslaktır. Ayrıntılar: [Gizlilik sayfaları](privacy.md).

## Resmi sınav duyuruları

`EXAM_SYNC_ENABLED=true` sunucu açıkken otomatik kontrolü açar. `EXAM_SYNC_INTERVAL_SECONDS=3600` varsayılan saatte bir kontroldür (300–86400). `EXAM_SYNC_CA_BUNDLE` isteğe bağlı güvenilir CA dosya yoludur; boşsa sistem sertifikaları kullanılır. Bu ayarlar tarayıcıya aktarılmaz. Ayrıntılar: [Sınav kaynakları](exams.md).
