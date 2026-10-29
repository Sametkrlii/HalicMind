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

Profil bilgisi değişikliği mevcut dönemleri ve geçmiş dersleri taşımaz veya silmez. Sınav takibi resmi duyuru kaynaklarıyla desteklenir. Resmi not ortalaması ve çalışma süresi takibi henüz yoktur; bu ölçümler varmış gibi gösterilmez.

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

## 28 Ekim 2026: tasarım ve kullanım akışı güncellemesi

Arayüz lacivert, kırık beyaz ve amber tonlarıyla yenilendi. Marka işareti ve Haliç çizimi yerel SVG dosyalarıdır; harici font, izleme betiği veya görsel servisi yüklenmez.

- Profil ve yeni dönem formunda tek bir aranabilir bölüm seçimi bulunur. Türkçe karakterler ve `pc müh`, `bil muh`, `yazılım müh` gibi aramalar desteklenir; yalnızca katalogda bulunan programlar gösterilir. Yukarı/aşağı ok, Enter ve Escape ile kullanılabilir. Fakülte filtresi ayrıca uygulanır.
- Ders planı etiketi giriş yılı bilgisinin bilinip bilinmediğini açıklar. Plan türü katalogdan alınır; bilinmiyorsa kullanıcı seçer. Bilinmeyen plan sessizce dönemlik kabul edilmez.
- Hazırlık sürüyorsa sınıf 0 olur. Güncel dönem için hazırlık önerilir; hazırlıkta katalogdaki bölüm dersleri eklenemez. Profil tamamlandı/muaf/yok durumuna geçtiğinde eski hazırlık dönemi korunur ve uygun bölüm dönemi öncelikli açılır.
- Ders eklemede **Ders planından**, **Tüm planı ara**, **Elle ders ekle** yolları vardır. Seçmeli havuz üyeleri tüm planda aranabilir. Kaynakta `slot` olarak tanımlanan seçmeli grup başlıkları gerçek ders gibi eklenmez; grubun dersleri ayrı ayrı seçilir. Elle eklenen ders ortak kataloğu değiştirmez.
- Dönem geçmişinde yıl filtresi, tüm dersler, kod, kaynak, AKTS, sonuç, not ve arşiv durumu gösterilir. Toplamlara arşivlenmiş derslerin AKTS'si dahil edilmez. Tekrarlanan dersler farklı dönemlerin kayıtlarıdır; toplamlar mezuniyet AKTS'si veya GPA değildir.
- Giriş ekranı ve öğrenci alanının altbilgisinden Gizlilik, Çerez politikası, KVKK aydınlatma taslağı ve Kullanım/lisans sayfaları açılır. Oturum açmadan da okunabilir; kayıt formundan erişilebilir.

Masaüstü (1440×1000) ve mobil (390×844) kontrollerinde bölüm araması, klavye seçimi, hazırlık → bölüm geçişi, müfredat araması, 7. dönem seçmeli ders ekleme, not güncelleme, ayrıntılı geçmiş ve yasal sayfa gezinmesi denendi. Mobilde sayfanın yatay taşması yoktur; geniş ders tablosu kendi alanında kaydırılır. Denemeler gerçek kullanıcı hesabından ayrı, yerel Mailpit ile doğrulanmış QA hesabında yapıldı.

Yeni ekranlar: [Genel bakış](screenshots/student-dashboard-v2.jpg), [Dönem geçmişi](screenshots/student-history-v2.jpg), [Mobil](screenshots/student-mobile-v2.jpg). Görüntülerdeki hesap ve ders kayıtları yerel QA verisidir.

### Tek tıkla ders kaldırma

Genel bakıştaki ders satırları, Derslerim kartları ve ders seçim penceresindeki eklenmiş dersler **Kaldır** düğmesi içerir. Ek onay penceresi açılmaz; mevcut `DELETE /enrollments/{id}` işlemiyle kayıt arşivlenir. Sonuç ve not korunur. Bildirimdeki **Geri al** 15 saniye boyunca aynı kaydı geri yükler; daha sonra **Arşivlenenleri göster → Geri yükle** kullanılabilir. Ders seçimi penceresi açıkken bildirim ve geri alma düğmesi pencerenin içinde erişilebilirdir. Escape veya kapatma düğmesiyle pencere kapatıldığında bildirim öğrenci ekranına taşınır.

### Not türü ve listeden seçim

Ders ekleme ve düzenlemede **Harf notu / Sayısal not (0–100)** seçilir. Harf notu için tek bir açılır liste; sayısal not için doğrudan yazılabilen tek bir alan gösterilir. Harf listesi AA, BA, BB, CB, CC, DC, DD, FD, FF önerilerini içerir; daha önce kaydedilmiş farklı bir not varsa korunması için listede ayrıca gösterilir. Sayısal not listesi yoktur. Virgül/nokta ile ondalık giriş kabul edilir; web formunda 0–100 sınırı kontrol edilir. Not türü değiştirilirken formdaki her türün taslağı korunur. Mevcut API ve not kayıt biçimi değişmez; başarı durumu otomatik hesaplanmaz.

### Duruma göre sadeleşen ders sonuç ekranı

Devam eden ders için not bölümü gösterilmez. Başarılı/başarısız derslerde ve varsa tanınmış muafiyet notunda sonuç notu isteğe bağlıdır. Muafiyet ve **Dersten çekildim** seçenekleri ayrı bir açılır bölümde açıklanır. Dersten çekilme, kaydı arşivden kaldırma ile aynı işlem değildir. Devam eden veya çekilinen derse API'den de not gönderilemez (422). Tamamlanmış ders devam ediyor/çekildi durumuna kaydedildiğinde önceki sonuç notu temizlenir. Bu davranış kullanıcıya formda açıklanır. Ders listeleri ve geçmişte de tamamlanmamış dersin eski notu gösterilmez.

Durum seçimi tek satırlı, sekme benzeri bir kontrolle yapılır. Büyük ikonlar, radyo halkaları ve adım numaraları kaldırılmıştır. Not bölümü ayrı kutu yerine ince ayırıcıyla ayrılır; devam ediyor durumunda gizlenir. Masaüstü ve 390 px mobil görünüm kontrol edilmiştir.

## Ortak tasarım ve form davranışları

- `tokens.css`: ortak yazı boyutları, boşluk ölçeği, alan yüksekliği ve köşe ölçüleri. Buton, form alanı, başlık, panel ve pencere ölçüleri bu değişkenleri kullanır.
- Profil/dönem açıklamaları kısaltıldı. Ders planının ayrıntılı açıklaması gerektiğinde açılabilen **Ders planı nedir?** bölümündedir.
- **Derslerim**: kart/liste geçişi, ders adı/koduyla anlık arama; ad, doğal kod sırası, azalan AKTS ve son eklenene göre sıralama. Arama durum ve arşiv filtreleriyle birlikte çalışır; dönem dışındaki kayıtları getirmez. Sonuç güncellemesi arama alanının odağını bozmaz. Liste kendi alanında yatay kaydırılır.
- `forms.js`: akademik profil, dönem, kişisel ders ekleme ve ders düzenleme formlarında anlamlı değişiklikleri takip eder. Parola formları izlenmez; taslaklar localStorage/cookie/veritabanına kaydedilmez.
- Kaydedilmeden sayfa değiştirme, pencere kapatma, sekme değiştirme veya çıkış için **Düzenlemeye devam et / Kaydetmeden çık** penceresi gösterilir. Düzenlemeye devam edildiğinde girilen değerler korunur. Yenileme/tarayıcıdan ayrılma için tarayıcının yerleşik uyarısı kullanılır.
- Kaydetme sırasında düğme yükleniyor metni/spinner gösterir; yinelenen gönderim ve kayıt bitmeden gezinme engellenir. Başarılı kayıttan sonra form temiz kabul edilir.
- HTML alan hataları Türkçe olarak ilgili alanın altında gösterilir. API'nin 422 hataları alan adlarıyla eşleştirilir; ilk hatalı alana odaklanılır. Alanla ilişkilendirilemeyen hatalar form özetinde kalır. `aria-invalid`, `aria-describedby` ve canlı bildirimler kullanılır.

Yerel QA hesabında arama/AKTS sıralaması, kaydetmeden çıkıştan vazgeçme, kayıt sonrası yeniden uyarı çıkmaması, modalden değişiklikleri bırakarak çıkma, boş alan doğrulaması, API'den gelen kod hatası ve mobil arama odağı denendi. Gerçek kullanıcı kayıtları değiştirilmedi. Görsel: [Ders listesi](screenshots/course-list.jpg).

İstemci mantığının bağımlılıksız testleri (isteğe bağlı Node.js geliştirme aracı):

```sh
node --test tests/test_course_list.mjs tests/test_web_api.mjs
```

Node.js uygulamayı çalıştırmak için gerekli değildir. Bu testler Türkçe karakter araması, birlikte uygulanan filtreler, sayısal/doğal sıralama ve API alan hatalarını kapsar.

Giriş ekranındaki koordinat, Haliç bölgesi yerine üniversitenin resmi iletişim sayfasına gömülü haritanın konumunu kullanır: 41.085852, 28.952187 (ekranda beş ondalıkla gösterilir). Etiket: 5. Levent Yerleşkesi. Kaynak: https://halic.edu.tr/tr/universitemiz/rektorluk-ofisi/iletisim (29 Ekim 2026). Bu bir kampüs harita referansıdır; ayrı bir bina veya giriş kapısı ölçümü değildir.

## Mobil ve klavye kullanımı

Mobil form alanları 16 px yazı ve en az 44 px dokunma alanları kullanır. Menü açıldığında arka içerik etkileşime kapanır; Tab menü içinde dolaşır, Escape menüyü kapatır. Diyalog kapatılınca odak açan düğmeye döner. Taşan tablolar kendi alanında yatay kayar ve kaydırma açıklaması gösterir. Bunlar erişilebilirlik iyileştirmeleridir; bağımsız bir uygunluk denetimi yapılmış değildir.

## Ödev ekranı

`#/assignments` kişisel derslere ödev ekleme, düzenleme, tamamlama, tekrar açma, arşivleme ve geri alma sunar. Dönem, durum, arama ve sıralama filtreleri bulunur. Ana sayfa seçili dönemin yaklaşan ödevlerini gösterir. Tarihler Türkiye saatiyle (UTC+3) girilir. Tamamlama üniversiteye teslim işlemi yapmaz. Ayrıntılar: [Ödev rehberi](assignments.md).

## Görsel Genel Bakış

Genel Bakış koyu lacivert/antrasit, mint ve sıcak turuncu palet kullanır. SVG sütunlar seçili dönemdeki gelecek 7 günün bekleyen ödev teslimlerini ve kesinleşmiş sınavlarını sayar. Halkalar ödev tamamlanmasını ve kişisel ders sonuçlarını gösterir; mezuniyet oranı değildir. Ders bazında bekleyen ödev sayısı bulunur. Ödevler gün bazında gösterilir; saat ve tahmini süre arayüzden kaldırılmıştır. Arşivler, diğer dönemler ve belirsiz sınav adayları dahil edilmez. Gün sınırı Türkiye saatidir. Çalışma süresi/verimlilik ölçümü üretilmez; boş grafiklerde veri yokluğu açıkça belirtilir. Grafiklere ekran okuyucu açıklamaları ve sayısal etiketler eşlik eder. Diğer işlem sayfaları açık, sade temayı korur.
