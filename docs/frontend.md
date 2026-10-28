# Öğrenci arayüzü

Uygulama: http://127.0.0.1:8000/. API belgeleri `/docs` adresinde ayrıca çalışmaya devam eder.

## Başlatma

Proje kökünde, ilk kurulum README'ye göre tamamlandıktan sonra:

```sh
docker compose up -d postgres mailpit
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

`app/web/` içindeki HTML, CSS, JavaScript modülleri ve SVG doğrudan FastAPI tarafından sunulur. Ayrı frontend sunucusu, paket kurulumu veya derleme adımı yoktur. Statik dosyalar `/assets/` altında; UI ve API aynı origin üzerindedir. Tarayıcı kodda değişiklikleri görmek için sayfayı yenilemelidir.

## Ekran akışı

1. **Kayıt / giriş:** Okul e-postası ve parola. Yalnızca öğrenci numarasıyla başlayan `@ogr.halic.edu.tr` adresleri kabul edilir. Hatalar form içinde gösterilir; parolalar ve doğrulama kodları depolanmaz.
2. **E-posta doğrulama:** E-postadaki 43 karakterlik kod yapıştırılır. Başarılı doğrulama kullanıcıyı girişe döndürür. Gönderim beklemesi ve sunucunun `Retry-After` yanıtı ekranda gösterilir. Yerel SMTP kullanılıyorsa Mailpit bağlantısı görünür; mesajlar gerçek okul kutusuna iletilmez.
3. **İlk profil kurulumu:** Akademik birim, bölüm araması, program ve müfredat, giriş yılı, hazırlık durumu ve sınıf. Müfredatlar seçilen programdan yüklenir; tek sonuç varsa seçilir. Hazırlık devam ediyorsa sınıf hazırlık olur; lisansın ilk dönemi sayılmaz. Müfredat yılı kaynakta yoksa giriş yılından kesin eşleştirme yapılmaz.
4. **Genel bakış:** Seçili dönemdeki gerçek ders sayısı, AKTS bilgisi olan derslerden hesaplanan toplam ve başarılı/muaf ders sayısı. Veri yoksa sahte örnekler yerine başlangıç ekranı gösterilir.
5. **Dönem oluşturma / düzenleme:** Takvim yılı/türü ile müfredat dönem türü/numarası ayrıdır. Hazırlık döneminde müfredat dönemi seçilmez. Yıllık katalogda yıl seçenekleri sunulur. Geçmişteki başka bir program için dönem oluşturulabilir; dönem program/müfredat bilgisi daha sonra değiştirilmez.
6. **Ders ekleme:** Zorunlu derslerin önce geldiği öneriler, diğer müfredat dönemlerine geçiş, seçmeli grup bilgisi ve eklenmiş ders göstergesi. Katalogda arama yalnızca seçili dönemin müfredatına bakar. Aynı ders başka dönemde tekrar alınabilir. Kişisel ders ortak kataloğa yazılmaz.
7. **Derslerim:** Dönem ve durum filtreleri, kişisel derslerde ad/kod/AKTS düzenleme, sonuç/not ekleme ve temizleme. Arşivleme onay ekranı vardır; arşivlenenler filtreyle gösterilip aynı kayıt üzerinden geri yüklenir. Başka programların aynı kodlu dersleri birleştirilmez.
8. **Geçmiş dönemler:** Güncel ve önceki dönemler program bilgisiyle görünür. Geçmişi doldurmak zorunlu değildir. Dönem açıldığında kişisel ders listesine geçilir.

Profil bilgisi değişikliği mevcut dönemleri ve geçmiş dersleri taşımaz veya silmez. Not ortalaması, sınav, ödev ve çalışma takibi bu arayüzün ilk sürümünde yoktur; sayı veya çizelge olarak varmış gibi gösterilmez.

## Oturum ve güvenlik

Arayüz, giriş isteğine `X-HalicMind-Web: 1` ekler. Sunucu normal JWT yanıtına ek olarak 30 dakikalık `halicmind_session` çerezini yalnızca bu web akışında oluşturur. Çerez `HttpOnly`, `SameSite=Lax`, `Path=/api/v1`; HTTPS üzerinde `Secure` özelliğine sahiptir. Oturum anahtarı JavaScript tarafından okunamaz ve localStorage/sessionStorage içine yazılmaz. Tarayıcı aynı origin'e otomatik ilettiği için sayfa yenilendiğinde oturum korunur. Süre ayarı `ACCESS_TOKEN_EXPIRE_MINUTES` ile kontrol edilir.

Çerez ile kimlik doğrulanan yazma istekleri özel header ve varsa aynı origin kontrolünü geçmelidir. Cross-origin CORS izni verilmez. Header'ı olmayan veya farklı origin'den gelen çerezli yazma istekleri `403` döner. Swagger ve API istemcileri Bearer token kullanmaya devam eder; Bearer mevcut ama geçersizse çereze geri düşülmez.

Çıkış butonu web çerezini temizler. Süresi geçmiş oturum ilk korumalı istekte giriş ekranına döndürülür; yenileme token'ı yoktur. Mevcut bir JWT'nin sunucu tarafında tek tek iptal edilmesi bu değişikliğin kapsamına dahil değildir. Kullanıcı pasifse veya doğrulanmamışsa çerez ile de erişemez.

Arayüz sayfasında Content Security Policy ile yalnızca aynı origin'deki betik/stiller çalışır. Haricî font, CDN veya analiz servisi kullanılmaz. API'den gelen metinler HTML'e yazılmadan önce escape edilir. Kişisel API yanıtlarında `Cache-Control: no-store` bulunur. Swagger'ın kendi CDN kaynakları bozulmasın diye arayüz CSP'si `/docs` sayfasına uygulanmaz.

Uzak ortamda HTTPS kullanın. Bu çalışma yerel FastAPI/PostgreSQL uygulamasına entegredir; Sites üzerinde ayrıca yayımlanmış bir bulut sitesi oluşturulmadı.

## Doğrulama

```sh
.venv/bin/python -m pytest -q
```

Web testleri kabuk/statik dosya erişimini, HttpOnly/Secure çerezi, CSRF/origin kontrolünü, çıkışı, pasif/doğrulanmamış hesap engelini, geçersiz Bearer'ın çerezle aşılmamasını ve katalog müfredat filtresini doğrular. Mevcut API testleri de çalışır.

Tarayıcıda ayrı test hesaplarıyla gerçek yerel API ve Mailpit üzerinden kayıt → doğrulama → giriş → profil → dönem → katalogdan ders ekleme → not güncelleme → arşiv/geri yükleme denendi. Geçmiş hazırlık dönemi, kişisel ders, yıllık müfredat, sayfa yenilemede oturum ve çıkış kontrol edildi. 1440 piksel masaüstü ve 390 piksel telefon görünümünde yatay taşma kontrolü yapıldı. Bu kontroller kişisel öğrenci hesabına örnek veri eklemeden yapıldı.
