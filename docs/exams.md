# Resmi sınav takvimi ve otomatik duyuru kontrolü

Sınav ekranı iki veri türünü ayrı gösterir: akademik takvimdeki genel sınav aralıkları ve resmi Excel dosyasından öğrencinin dersine eşleştirilen tarih/saat. Aralık, kişisel sınav tarihi olarak kaydedilmez.

## Otomatik çalışma

FastAPI açıkken arka plandaki görev başlangıçta ve varsayılan saatte bir resmi kaynakları kontrol eder. Ayrı bir Codex hatırlatıcısı değildir; bilgisayar veya sunucu kapalıyken çalışmaz. Birden fazla worker ve yeniden yükleme durumunda PostgreSQL transaction advisory lock ve son kontrol zamanı tekrar taramayı sınırlar.

`EXAM_SYNC_ENABLED` varsayılan `true`, `EXAM_SYNC_INTERVAL_SECONDS` varsayılan `3600` (en az 300) değerindedir. TLS doğrulaması sistem sertifika deposuyla yapılır; özel kurum CA dosyası gerekiyorsa `EXAM_SYNC_CA_BUNDLE` kullanılır. Sertifika doğrulaması kapatılmaz.

Kaynaklar `app/services/exam_sync.py` içindeki açık listededir: genel duyurular, Mühendislik duyuru listesi, resmi sitedeki fakülte/yüksekokul giriş sayfaları. Genel listelerde en fazla üç sayfa izlenir; bilinen güncel dosyaların duyuruları sonraki turlarda ayrıca kontrol edilir. Duyurunun akademik yılı, dönemi ve sınav türü hem bağlantı metninden hem kendi başlığından doğrulanır. Yalnızca içinde bulunulan akademik yıl, bir önceki ve bir sonraki yılın ilgili duyuruları indirilir. Bir yıla ait dosya başka yıla taşınmaz.

Tarama yaklaşık 100 saniyelik iş bütçesi, istek başına 12 saniye timeout, 30 duyuru, duyuru başına 25 dosya ve dosya başına 10 MB sınırı kullanır. HTTP yönlendirmeleri dahil yalnızca `https://halic.edu.tr` ve `https://www.halic.edu.tr` kabul edilir. Sınırlar aşıldığında ekranda eksik kontrol bilgisi verilir. Tüm üniversite arşivinin eksiksiz tarandığı iddia edilmez.

Bakım amacıyla elle kontrol:

```sh
.venv/bin/python -m scripts.sync_exams --force
```

Ekrandaki **Ekranı yenile**, son kaydedilmiş sunucu sonucunu getirir; üniversiteye yeni tarama isteği başlatmaz. Son deneme zamanı, erişim hataları ve dosya inceleme bilgileri Sınavlar ekranında görülebilir.

## Excel okuma ve eşleştirme

XLSX ve eski XLS okunur. Makrolar çalıştırılmaz; formüller hesaplanmaz. ZIP açılmış boyutu 60 MB, sayfa/satır/sütun sınırları denetlenir. Tarih ve saat açıkça doğrulanır. PDF, resim, şifreli dosya ve bilinmeyen tablo düzeni otomatik aktarılmaz; inceleme bilgisi oluşur.

Haliç'in gerçek dışa aktarımındaki `SINAV GÜNÜ`, `BAŞLANGIÇ SAATİ`, `DERS KODU`, `DERS ADI`, `PROGRAM ADI`, `ŞUBE`, `DERSLİK/ODA KODLARI` başlıkları desteklenir. Noktalı virgülle birleştirilmiş ders/program/şube listeleri yalnızca adetleri uyumluysa ayrılır; tek değer ortak değer olarak kullanılabilir. Kaynak sayfa ve satır bilgisi korunur. Öğretim elemanı, öğrenci listesi veya öğrenci sayısı aktarılmaz.

Aktif ve devam eden kişisel dersler; dönem/yıl, normalize ders kodu, ders adı ve varsa program adı ile eşleşir. Benzer ders adına göre tahmin yapılmaz. Başka programa ait açık satır dışlanır. Hazırlık, lisansüstü ve yıllık planlar için ayrı doğrulanmış adaptör henüz yoktur.

Program bilgisi de doğrulanmış tek ve şubesiz eşleşme otomatik gösterilir. Bölüm bilgisi eksik satırlar seçim gerektirir. Şube varsa veya birden fazla saat/yer bulunuyorsa öğrenci adaylar arasından seçim yapar; sahiplik sunucuda denetlenir. Aynı sınavın tüm-liste/fakülte kopyaları aynı olay olarak birleştirilir. Birden fazla salon içeren satır kişisel salon ataması olarak yorumlanmaz.

Saatler Türkiye saatidir (UTC+3). Sınav takvimi değiştiğinde eski sürüm tutulur, yeni sürüm etkinleşir. Önceki otomatik eşleşmede tarih değişmişse ekranda gösterilir; eski belgeye yapılmış grup seçimi yeniden doğrulama gerektirir. Eksik/bozuk yeni sürüm eski kesin tarihi sessizce devam ettirmez. Son başarılı dosya kontrolü 48 saatten eskiyse kesin eşleştirmeden çıkarılır. Ağ hatasında genel akademik takvim desteği devam eder.

## Veritabanı ve API

`0006_exam_sources` yalnızca üç uygulama tablosu ekler:

- `exam_documents`: kaynak URL, duyuru bağlamı, SHA-256 sürüm özeti, normalize satırlar, kontrol zamanı ve inceleme notları. Önceki sürümler korunur.
- `exam_sync_state`: son deneme, son tam başarılı kontrol, durum ve hata bilgileri.
- `exam_selections`: öğrencinin kendi dersine ait grup seçimi; bileşik ders/kullanıcı yabancı anahtarı sahipliği veritabanında da korur.

Katalog ve mevcut kişisel kayıtlar değiştirilmez. Alembic kapsamı on uygulama tablosudur. Yeni kurulumda önce katalog, ardından `alembic upgrade head` çalıştırılır.

| API | İşlev |
| --- | --- |
| `GET /api/v1/exams/calendar` | Kendi dönemleri, genel aralıklar, kesin eşleşmeler ve seçim adayları |
| `GET /api/v1/exams/sync-status` | Son kaynak kontrolü ve hataları |
| `PUT /api/v1/exams/selection` | Kendi dersine ait güncel adayın seçimi |

Seçim gövdesi `enrollment_id`, `exam_type`, `document_id`, `sheet`, `row_number` alanlarını içerir. Bunlar takvim yanıtındaki adaydan alınır; çoklu satır ayrımında `row` kaynağın fiziksel satırından türetilen benzersiz aday anahtarıdır, `source_row` özgün satırdır. Başkasının dersi 404; artık geçerli olmayan aday 409 döner. Tüm API'ler aktif ve e-postası doğrulanmış hesap ister.

## Gerçek kaynak kontrolü ve testler

29 Ekim 2026'da resmi 2024–2025 Güz final duyurusundaki Mühendislik XLSX dosyasıyla okuyucu doğrulandı: 1.041 normalize ders/program/şube kaydı, sıfır uyarı. Tüm-liste dosyasında 2.853 kayıt okunurken bir satırın 2025–12–29 tarihi duyurunun akademik yılıyla uyuşmadığı için incelemeye ayrıldı. Bu eski örnekler güncel kişisel sınav olarak atanmadı.

Kaynak: https://halic.edu.tr/tr/duyurular/2024-2025-guz-donemi-final-sinav-programi

Testler kaynak sınırları, gerçek dosya düzeninin temsili örneği, ZIP boyutu, yıl doğrulama, sahiplik, şube seçimi, değişen sürüm, eski tarih uyarısı, tekrar aktarım ve kaldırılmış dosyayı kapsar. Migration upgrade/downgrade ve autogenerate kapsamı da doğrulanır.
