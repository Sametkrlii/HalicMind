# HaliçMind — Durum ve geliştirme raporu

**Rapor tarihi:** 27 Ekim 2026  
**Kapsam:** Mevcut kod, uygulama belgeleri ve son doğrulama sonuçları. Bu rapor yeni bir özellik uygulaması değildir.

## 1. Projenin bugünkü durumu

HaliçMind şu anda Haliç Üniversitesi öğrencisinin okul hesabıyla kayıt olabildiği, e-postasını doğrulayabildiği, akademik profilini oluşturabildiği ve kişisel dönem/ders geçmişini yönetebildiği yerel bir web uygulamasıdır.

Öğrenci işlemleri artık normal arayüzden yapılabilir. Swagger, API geliştirme ve inceleme aracı olarak korunur. Uygulama henüz ödev, sınav, çalışma takibi veya otomatik çalışma planı sunmaz.

| Yol haritası | Durum | Kalan iş |
| --- | --- | --- |
| Akademik temel | Uygulandı ve test edildi | Kaynak kapsamı eksik katalog verilerinin teyidi |
| İlk kullanıcı deneyimi | İlk çalışan sürüm hazır | Gerçek öğrenci geri bildirimi, kullanım sadeleştirmeleri, hesap kurtarma |
| Günlük takip | Uygulanmadı | Ödev, sınav ve çalışma kayıtları |
| Akıllı plan | Uygulanmadı | Açıklanabilir öncelik puanı ve çalışma önerileri |
| Genişleme | Planlanabilir | Diğer okullar, bildirimler, takvim aktarımı ve yayın ortamı |

Bu eşleştirme bu sohbette uygulanan kapsamı gösterir. Önceki yol haritası görselinde yalnızca ilk aşamanın ayrıntıları görünüyordu; diğer aşamaların başlıkları burada önerilen kapsamla somutlaştırılmıştır.

## 2. Tamamlanan işler

### Altyapı ve katalog

- FastAPI uygulaması, PostgreSQL bağlantısı ve `/health` kontrolü.
- SQLAlchemy ile uygulama modelleri ve Alembic ile sürümlü şema değişiklikleri.
- Özel `.env` yapılandırması; yerel veritabanı parolası ve JWT anahtarı üretimi.
- Docker Compose üzerinden PostgreSQL ve yerel test e-posta servisi Mailpit.
- Akademik birim, program, müfredat ve ders kataloğu endpoint'leri.
- Program/müfredat filtreleme, ders adı/kodu araması ve sayfalama.
- Dönemlik/yıllık planlar, seçmeli grupları ve kaynak doğrulama işaretleri.
- Katalog aktarımının checksum takibi; uygulama migration'larının kataloğu değiştirmemesi için izin listesi.

Katalogda `partial`, `unavailable` ve `needs_review` gibi kapsam/doğrulama durumları korunur. Bazı müfredatların giriş yılı kaynakta belirtilmemiştir. Bu durumlarda otomatik, kesin bir yıl eşleştirmesi yapılmaz.

### Hesap ve doğrulama

- Yalnızca `öğrenci_numarası@ogr.halic.edu.tr` biçimindeki adreslerle kayıt.
- E-postayı normalize etme ve veritabanı düzeyinde benzersizlik.
- Argon2id parola hashleme.
- Süreli, tek kullanımlık e-posta doğrulama kodu; ham kod yerine SHA-256 özeti saklama.
- Yeniden gönderimde eski kodu geçersiz kılma.
- Doğrulanmamış veya pasif kullanıcıya erişim vermeme.
- JWT ile giriş, profil bilgisi ve PostgreSQL üzerinde ortak deneme sınırları.
- Tarayıcı için HttpOnly oturum çerezi, CSRF/origin kontrolü, sayfa yenilemede oturumun korunması ve çıkış.
- Swagger için Bearer token akışının korunması.

Mevcut ayarlarda doğrulama kodu ve oturum 30 dakika geçerlidir. Süreler yapılandırılabilir. E-posta şu anda Mailpit'e gider; gerçek okul kutusuna teslim yapılandırılmadı. Parola sıfırlama, e-posta değiştirme, refresh token ve tek tek JWT iptali henüz yoktur. Tarayıcıdan çıkış çerezi temizler.

### Akademik profil ve dönemler

- Program, müfredat, giriş yılı, mevcut sınıf ve hazırlık durumu.
- Hazırlığın bölümün birinci döneminden ayrı tutulması.
- Güz, Bahar, Yaz ve yıllık kişisel dönemler.
- Takvim dönemi ile müfredat dönem numarasının ayrı tutulması.
- Geçmişi doldurmadan güncel derslerle başlayabilme.
- Başka programda geçen eski dönemleri kaydetme.
- Profil değişse de mevcut dönemlerin program/müfredat bilgisini koruma.

### Kişisel dersler

- Müfredattan zorunlu dersleri önce gösteren öneriler ve seçmeli grup üyeleri.
- Ders eklerken katalog ders/revizyon kimliklerini kullanma.
- Katalogda bulunmayan kişisel dersleri ortak kataloğa yazmadan saklama.
- Devam ediyor, başarılı, başarısız, bırakıldı ve muaf durumları.
- İsteğe bağlı not bilgisi; aynı dersi farklı dönemlerde tekrar alabilme.
- Aynı dönemde aynı dersin aktif tekrarını engelleme.
- Ders arşivleme, arşiv filtresi ve aynı kayıt üzerinden geri yükleme.
- Ders geçmişi bulunan dönemin silinmesini engelleme.
- Kullanıcının yalnızca kendi profil/dönem/ders kayıtlarına erişebilmesi.

Notlar şu anda metin olarak saklanır. Not ortalaması hesaplanmaz; girilen not başarı durumunu otomatik değiştirmez. Öneriler mevcut katalogla eşleşmeye dayanır; çalışma önceliği veya yapay zekâ planı hesaplanmaz.

### Öğrenci arayüzü

- Kayıt, giriş ve e-posta doğrulama ekranları.
- İlk profil kurulumu ve sonradan profil düzenleme.
- Genel bakışta gerçek ders sayısı, bilinen AKTS toplamı ve başarılı/muaf ders sayısı.
- Dönem oluşturma/düzenleme, geçmiş dönemlere geçiş.
- Ders önerileri, müfredata özel katalog araması ve kişisel ders formu.
- Sonuç/not güncelleme, arşivleme onayı ve geri yükleme.
- Mobil menü, dar ekranda ders kartları, yüklenme/boş durum/hata mesajları.
- Yeniden e-posta gönderimi için bekleme göstergesi.

Arayüz HTML/CSS/JavaScript modülleriyle FastAPI'den sunulur. Ayrı frontend sunucusu veya derleme adımı gerekmez. Ana ekran `http://127.0.0.1:8000/`, Swagger `/docs` adresindedir. API ve arayüz aynı origin'dedir; özel bilgiler tarayıcı depolamasına yazılmaz.

## 3. Doğrulama ve pratik sınırlar

Son tamamlanan otomatik koşuda **113 test geçti**. Katalog erişimi, okul e-postası kuralı, doğrulama, JWT, kullanıcı sahipliği, migration, hazırlık/yıllık dönem, tekrar ders, arşiv/geri yükleme, web çerezi, HTTPS Secure bayrağı ve CSRF kontrolleri doğrulandı.

Gerçek yerel API ve Mailpit ile tarayıcı akışları ayrıca denendi. Masaüstünde 1440 piksel ve telefonda 390 piksel genişlikte taşma/gezinme kontrolü yapıldı. Arayüz testleri ayrı hesaplarla yürütüldü; test hesapları pasifleştirildi ve test dersleri arşivlendi.

Bu sonuç bir yük testi, geniş cihaz/tarayıcı matrisi, bağımsız güvenlik denetimi veya tüm katalog kayıtlarının resmî akademik onayı değildir. Test istemcisinin bağımlılıklarından gelen bir kullanımdan kaldırma uyarısı vardır; test başarısızlığı yoktur.

Uygulama yereldir. Docker PostgreSQL ve Mailpit'i çalıştırır; FastAPI ayrı bir süreçtir ve çalışır durumda tutulmalıdır. Henüz alan adı, dış erişimli yayın, otomatik yedekleme ve yayın izleme düzeni kurulmadı.

Çalışma ağacında çok sayıda değiştirilmiş ve Git tarafından henüz takip edilmeyen yeni dosya bulunuyor. Bu aşama için kapsamı açıklayan bir milestone commit hazırlanması önerilir. Git'e kaynak kodun alınması, PostgreSQL'deki kullanıcı/ders verilerini yedeklemez; veritabanı yedeği ayrıca alınmalıdır.

## 4. Mevcut özelliklerde iyileştirilebilecek noktalar

### Yakın öncelik

1. **İlk kullanımın sadeleştirilmesi:** Bölüm → öğrenim bilgileri → dönem → dersler akışını daha belirgin adımlara ayırmak. Takvim dönemi ve müfredat dönemini örneklerle anlatmak.
2. **Müfredat etiketleri:** Kaynaktan gelen uzun adları daha kısa okunur etiketlerle göstermek; tam kaynak bilgisini ayrıntıda korumak.
3. **Eksik katalog davranışı:** Katalogda dönem türü bulunmayan programlarda arayüzün mevcut `semester` varsayımı yerine kullanıcıdan açık seçim almak. Eksik/seçmeli grup yer tutucularını gerçek ders seçeneklerinden daha anlaşılır ayırmak.
4. **Hesap kurtarma:** Süreli ve tek kullanımlık parola sıfırlama akışı. Yeni okul adresiyle değişiklikte yeniden doğrulama.
5. **Gerçek e-posta:** SMTP hesabı/gönderici yapılandırması, gerçek okul kutusunda teslim testi, hata ve yeniden deneme davranışının gözlenmesi.
6. **Kaydetme ve geçiş deneyimi:** Profil gibi uzun formlarda kaydedilmemiş değişiklik uyarısı; başarılı işlem sonrasında daha belirgin sonraki adım.

### İhtiyaç büyüdüğünde

- Kullanıcı ekran adını/ad-soyadını düzenleme; mevcut profil formundaki okul e-postası salt okunurdur.
- Aktif dönem tercihini kullanıcı hesabında kalıcı saklama. Şu anda yeniden açılışta ilk listelenen dönem seçilir.
- Başarısız derslerin farklı dönemlerdeki tekrarlarını aynı ders geçmişinde bir araya getiren görünüm.
- Oturum yenileme ve cihaz/oturum bazında iptal yönetimi.
- Çok kullanıcılı ve okul ağı üzerinden kullanımda deneme sınırlarını gerçek trafiğe göre ayarlama.
- Otomatik tarayıcı regresyonları, sürekli test çalıştırma ve bağımlılık uyarısını giderme.
- Ekran sayısı arttıkça JavaScript görünüm/işlem kodunu daha küçük modüllere ayırma.

Mevcut çalışma için zorunlu bir framework değişikliği bulunmuyor. Özelliklerin artışı ve ekip ihtiyacı oluşursa mimari seçenekler ayrıca değerlendirilir.

## 5. Önerilen geliştirme sırası

### A. Mevcut sürümü sabitleme

Git kaydı, belgeler ve veritabanı yedeği; kişisel hesapla kısa bir son kullanım turu. Öncelikli arayüz karışıklıklarının giderilmesi. Çıkış ölçütü: kayıttan ilk gerçek ders listesine kadar akışın yardım almadan tamamlanabilmesi.

### B. Ödev takibi — sonraki ana özellik

Bir kişisel ders kaydına bağlı başlık, açıklama, teslim zamanı, önem düzeyi, isteğe bağlı tahmini süre ve tamamlanma bilgisi. Listeleme, düzenleme, arşivleme ve yaklaşan teslimler görünümü. Teslimi geçmiş olma durumu tarih ve tamamlanma bilgisinden hesaplanır. Arşivlenmiş derse yeni ödev eklenmez; önceden bağlı kayıtlar korunur. Her istek kullanıcı sahipliğini doğrular.

Backend, migration, test ve arayüz birlikte tamamlanır. Çıkış ölçütü: öğrenci dersine ödev ekler, genel bakışta görür ve tamamlandı olarak işaretler. Haricî e-posta/push bildirimi bu ilk parçaya zorunlu değildir.

### C. Sınav takibi

Derse bağlı sınav türü, tarih/saat, isteğe bağlı yer, açıklama ve ağırlık bilgisi. Yaklaşan sınavlar ve dönem görünümü. Saatler kullanıcının göreceği İstanbul saatiyle açıkça gösterilir; saklama ve dönüşüm kuralları tanımlanır.

### D. Çalışma kaydı

Önce derse bağlı elle süre/tarih ve çalışma notu girişi; ardından gerekirse duraklatılabilen sayaç. Haftalık süre ve ders bazında özetler gerçek kayıtlardan hesaplanır.

### E. Açıklanabilir plan ve önceliklendirme

Teslim/sınav yakınlığı, önem, tahmini iş yükü ve kayıtlı çalışma bilgilerini kullanarak öneri sırası. Öğrenci her önerinin neden öne çıktığını görebilir. Eksik veri varken gerçekçi olmayan kesin plan üretilmez. Öncelik formülü ve kabul testleri uygulamadan önce tanımlanır.

### F. Dış kullanıcı ve genişleme

Gerçek SMTP ve hesap kurtarma, HTTPS üzerinden yayın, yedekleme/geri yükleme denemesi, hata izleme ve kullanıcı geri bildirimi. Sonrasında dosya/takvim dışa aktarımı, bildirim tercihleri, başka üniversitelerin doğrulanmış öğrenci alan adları ve katalogları değerlendirilebilir. Genel bir `.edu.tr` kontrolü tek başına okul entegrasyonu sayılmaz.

Gerçek SMTP, hesap kurtarma ve yayın altyapısı; arkadaşlarla dış ortamda denemeye geçilecekse B–E aşamalarını beklemeden öne alınmalıdır.

## 6. İlgili belgeler

- `README.md`: kurulum ve başlatma.
- `docs/auth.md`: kayıt, e-posta ve oturum akışı.
- `docs/academics.md`: profil, dönem ve kişisel ders kararları.
- `docs/frontend.md`: ekranlar, tarayıcı oturumu ve arayüz testleri.
- `docs/database.md`: katalog ve migration düzeni.
- `docs/screenshots/student-dashboard.jpg`, `student-mobile.jpg`: test hesabıyla arayüz örnekleri.

Bu rapordaki geliştirme önerileri henüz uygulanmış özellikler değildir. Sonraki somut geliştirme önerisi, küçük kullanım düzeltmelerinin ardından ödev takibini backend ve arayüzüyle tamamlamaktır.
