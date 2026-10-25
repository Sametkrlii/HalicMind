# HaliçMind katalog aktarım raporu — 25 Ekim 2026

Bu dosya resmî üniversite web sayfalarında erişilen ders planlarının araştırma görüntüsüdür. Üniversitenin tüm tarihsel müfredatlarının veya tüm seçmeli havuzlarının eksiksiz olduğu iddia edilmez.

- Program: 167
- Program kapsamlı ders kimliği: 11949
- Farklı normalize ders kodu: 6515
- Ders/dönem eşleştirmesi: 20718
- Kaynak satırı (ders ve yer tutucu): 21825
- Seçmeli havuzu: 833

## Kapsam ve sınırlamalar

- Lisans, ön lisans, yüksek lisans ve doktora/sanatta yeterlik programları tarandı. Eğitim Bilimleri pedagojik formasyon dersleri de other düzeyinde kaydedildi.
- Yabancı Diller Yüksekokulu hazırlık modülleri ve ders planı yayımlanmayan eğitimler bu 167 program sayısına dahil değildir.
- Müfredat yılı resmî tablolarda açık olmadığı için entry_year NULL; 2026-2027 müfredatı olduğu varsayılmadı.
- Program sayfaları güncel/yayımlanmış kaynak olarak alındı; her dersin bu dönem gerçekten açıldığı iddia edilmez.
- Sayfalardaki alan dışı seçmeli başlıklarının bazılarında seçenek listesi yoktur. Bu boş havuzlar için ders uydurulmadı.
- Kaynak etiketleri/orijinal yazım hataları saklandı. Çeviri yapılmadı. course_revisions.name_tr eski şema uyumu için kaynak etiketini içerir; gerçek dil garantisi taşımaz. Uygulama course_source_details.name_original / catalog_courses_readable.course_name kullanmalıdır.
- Kaynakta açık ders dili, yerel kredi ve ön koşul verisi bulunmadığında NULL/boş bırakıldı. Program dili ile ders dili aynı sayılmadı.
- Tıp yıllık planları annual_curriculum_courses içinde tutulur; year_number 1–6 ve semester NULL olarak dışa aktarılır.
- Ders kodları üniversite genelinde tekil kimlik değildir. Resmî sabit ID bulunmadığı için program URL’si + kod kullanıldı; ortak dersler programlar arasında otomatik birleştirilmedi.
- Aynı gerçek dersin birden fazla seçmeli gruba üyeliği elective_group_courses içinde korunur. Grup üyeliği kaynak satır sırasından çıkarılmıştır ve elle kontrol gerektirir.
- Tüm curricula.coverage_status değerleri partial, ders verification_status değerleri needs_review bırakıldı. Otomatik aktarım, elle doğrulanmış resmî katalog demek değildir.
- Eğitim Bilimleri sayfasında 2. dönem başlığı görülmedi. Eksik dönem üretilmedi.
- Web metni çıkarımında atlanan satırlar hedefli okumalarla tamamlandı; bütün sayfaların DOM satır sayılarıyla bire bir tamlık denetimi henüz yapılmadı.
- SQLite PRAGMA integrity_check ve foreign_key_check ile kontrol edilir. PostgreSQL çalıştırma testi bu ortamda yapılmadı.

## Program bazında kaynaklar

| Birim | Program | Dönemler | Kaynak satırı | Kaynak |
|---|---|---|---:|---|
| Fen Edebiyat Fakültesi | Amerikan Kültürü ve Edebiyatı | 1, 2, 3, 4, 5, 6, 7, 8 | 80 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi/bolumler/amerikan-kulturu-ve-edebiyati) |
| Fen Edebiyat Fakültesi | Eğitim Bilimleri | 1, 3, 4, 5, 6, 7 | 15 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi/bolumler/egitim-bilimleri) |
| Fen Edebiyat Fakültesi | İngilizce Mütercim Tercümanlık | 1, 2, 3, 4, 5, 6, 7, 8 | 127 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi/bolumler/ingilizce-mutercim-tercumanlik) |
| Fen Edebiyat Fakültesi | Matematik | 1, 2, 3, 4, 5, 6, 7, 8 | 96 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi/bolumler/matematik) |
| Fen Edebiyat Fakültesi | Moleküler Biyoloji ve Genetik (Türkçe) | 1, 2, 3, 4, 5, 6, 7, 8 | 100 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi/bolumler/molekuler-biyoloji-ve-genetik) |
| Fen Edebiyat Fakültesi | Moleküler Biyoloji ve Genetik (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 113 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi/bolumler/molekuler-biyoloji-ve-genetik-ingilizce) |
| Fen Edebiyat Fakültesi | Psikoloji (Türkçe) | 1, 2, 3, 4, 5, 6, 7, 8 | 126 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi/bolumler/psikoloji) |
| Fen Edebiyat Fakültesi | Psikoloji (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 128 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi/bolumler/psikoloji-ingilizce) |
| Fen Edebiyat Fakültesi | Tarih | 1, 2, 3, 4, 5, 6, 7, 8 | 139 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi/bolumler/tarih) |
| Fen Edebiyat Fakültesi | Türk Dili ve Edebiyatı | 1, 2, 3, 4, 5, 6, 7, 8 | 117 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/fen-edebiyat-fakultesi/bolumler/turk-dili-ve-edebiyati) |
| İşletme Fakültesi | Ekonomi | 1, 2, 3, 4, 5, 6, 7, 8 | 81 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/isletme-fakultesi/bolumler/ekonomi) |
| İşletme Fakültesi | Halkla İlişkiler ve Tanıtım | 1, 2, 3, 4, 5, 6, 7, 8 | 109 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/isletme-fakultesi/bolumler/halkla-iliskiler-ve-tanitim) |
| İşletme Fakültesi | İşletme (Türkçe) | 1, 2, 3, 4, 5, 6, 7, 8 | 104 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/isletme-fakultesi/bolumler/isletme) |
| İşletme Fakültesi | İşletme (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 108 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/isletme-fakultesi/bolumler/isletme-ingilizce) |
| İşletme Fakültesi | Lojistik Yönetimi (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 112 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/isletme-fakultesi/bolumler/lojistik-yonetimi-ingilizce) |
| İşletme Fakültesi | Siyaset Bilimi ve Uluslararası İlişkiler | 1, 2, 3, 4, 5, 6, 7, 8 | 90 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/isletme-fakultesi/bolumler/siyaset-bilimi-ve-uluslararasi-iliskiler) |
| İşletme Fakültesi | Uluslararası Ticaret ve İşletmecilik (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 93 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/isletme-fakultesi/bolumler/uluslararasi-ticaret-ve-isletmecilik-ingilizce) |
| İşletme Fakültesi | Yönetim Bilişim Sistemleri (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 102 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/isletme-fakultesi/bolumler/yonetim-bilisim-sistemleri-ingilizce) |
| Mimarlık Fakültesi | Endüstriyel Tasarım | 1, 2, 3, 4, 5, 6, 7, 8 | 94 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/mimarlik-fakultesi/bolumler/endustriyel-tasarim) |
| Mimarlık Fakültesi | İç Mimarlık ve Çevre Tasarımı | 1, 2, 3, 4, 5, 6, 7, 8 | 112 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/mimarlik-fakultesi/bolumler/ic-mimarlik-ve-cevre-tasarimi) |
| Mimarlık Fakültesi | Mimarlık | 1, 2, 3, 4, 5, 6, 7, 8 | 102 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/mimarlik-fakultesi/bolumler/mimarlik) |
| Mühendislik Fakültesi | Bilgisayar Mühendisliği (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 204 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/muhendislik-fakultesi/bolumler/bilgisayar-muhendisligi-ingilizce) |
| Mühendislik Fakültesi | Elektrik-Elektronik Mühendisliği (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 159 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/muhendislik-fakultesi/bolumler/elektrik-elektronik-muhendisligi-ingilizce) |
| Mühendislik Fakültesi | Endüstri Mühendisliği (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 91 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/muhendislik-fakultesi/bolumler/endustri-muhendisligi-ingilizce) |
| Mühendislik Fakültesi | Makine Mühendisliği (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 174 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/muhendislik-fakultesi/bolumler/makine-muhendisligi-ingilizce) |
| Mühendislik Fakültesi | Yapay Zeka Mühendisliği | 1, 2, 3, 4, 5, 6, 7, 8 | 225 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/muhendislik-fakultesi/bolumler/yapay-zeka-muhendisligi) |
| Mühendislik Fakültesi | Yazılım Mühendisliği (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 180 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/muhendislik-fakultesi/bolumler/yazilim-muhendisligi-ingilizce) |
| Sağlık Bilimleri Fakültesi | Beslenme ve Diyetetik (Türkçe) | 1, 2, 3, 4, 5, 6, 7, 8 | 134 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/saglik-bilimleri-fakultesi/bolumler/beslenme-ve-diyetetik) |
| Sağlık Bilimleri Fakültesi | Beslenme ve Diyetetik (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 134 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/saglik-bilimleri-fakultesi/bolumler/beslenme-ve-diyetetik-ingilizce) |
| Sağlık Bilimleri Fakültesi | Dil ve Konuşma Terapisi | 1, 2, 3, 4, 5, 6, 7, 8 | 92 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/saglik-bilimleri-fakultesi/bolumler/dil-ve-konusma-terapisi) |
| Sağlık Bilimleri Fakültesi | Ebelik | 1, 2, 3, 4, 5, 6, 7, 8 | 87 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/saglik-bilimleri-fakultesi/bolumler/ebelik) |
| Sağlık Bilimleri Fakültesi | Ergoterapi | 1, 2, 3, 4, 5, 6, 7, 8 | 88 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/saglik-bilimleri-fakultesi/bolumler/ergoterapi) |
| Sağlık Bilimleri Fakültesi | Fizyoterapi ve Rehabilitasyon (Türkçe) | 1, 2, 3, 4, 5, 6, 7, 8 | 110 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/saglik-bilimleri-fakultesi/bolumler/fizyoterapi-ve-rehabilitasyon) |
| Sağlık Bilimleri Fakültesi | Fizyoterapi ve Rehabilitasyon (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 110 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/saglik-bilimleri-fakultesi/bolumler/fizyoterapi-ve-rehabilitasyon-ingilizce) |
| Sağlık Bilimleri Fakültesi | Hemşirelik (Türkçe) | 1, 2, 3, 4, 5, 6, 7, 8 | 78 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/saglik-bilimleri-fakultesi/bolumler/hemsirelik) |
| Sağlık Bilimleri Fakültesi | Hemşirelik (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 79 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/saglik-bilimleri-fakultesi/bolumler/hemsirelik-ingilizce) |
| Spor Bilimleri Fakültesi | Antrenörlük Eğitimi | 1, 2, 3, 4, 5, 6, 7, 8 | 361 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/spor-bilimleri-fakultesi/bolumler/antrenorluk-egitimi) |
| Spor Bilimleri Fakültesi | Beden Eğitimi ve Spor Öğretmenliği | 1, 2, 3, 4, 5, 6, 7, 8 | 475 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/spor-bilimleri-fakultesi/bolumler/beden-egitimi-ve-spor-ogretmenligi) |
| Spor Bilimleri Fakültesi | Rekreasyon | 1, 2, 3, 4, 5, 6, 7, 8 | 564 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/spor-bilimleri-fakultesi/bolumler/rekreasyon) |
| Spor Bilimleri Fakültesi | Spor Yöneticiliği (Türkçe) | 1, 2, 3, 4, 5, 6, 7, 8 | 549 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/spor-bilimleri-fakultesi/bolumler/spor-yoneticiligi) |
| Spor Bilimleri Fakültesi | Spor Yöneticiliği (İngilizce) | 1, 2, 3, 4, 5, 6, 7, 8 | 553 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/spor-bilimleri-fakultesi/bolumler/spor-yoneticiligi-ingilizce) |
| Tıp Fakültesi | Tıp (Türkçe) | 1, 2, 3, 4, 5, 6 | 267 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/tip-fakultesi/bolumler/tip-turkce) |
| Tıp Fakültesi | Tıp (İngilizce) | 1, 2, 3, 4, 5, 6 | 268 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/tip-fakultesi/bolumler/tip-ingilizce) |
| Güzel Sanatlar Fakültesi | Çizgi Film ve Animasyon | 1, 2, 3, 4, 5, 6, 7, 8 | 64 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/guzel-sanatlar-fakultesi/bolumler/cizgi-film-ve-animasyon) |
| Güzel Sanatlar Fakültesi | Dijital Oyun Tasarımı | 1, 2, 3, 4, 5, 6, 7, 8 | 81 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/guzel-sanatlar-fakultesi/bolumler/dijital-oyun-tasarimi) |
| Güzel Sanatlar Fakültesi | Gastronomi ve Mutfak Sanatları | 1, 2, 3, 4, 5, 6, 7, 8 | 91 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/guzel-sanatlar-fakultesi/bolumler/gastronomi-ve-mutfak-sanatlari) |
| Güzel Sanatlar Fakültesi | Görsel İletişim Tasarımı | 1, 2, 3, 4, 5, 6, 7, 8 | 74 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/guzel-sanatlar-fakultesi/bolumler/gorsel-iletisim-tasarimi) |
| Güzel Sanatlar Fakültesi | Grafik Tasarım | 1, 2, 3, 4, 5, 6, 7, 8 | 87 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/guzel-sanatlar-fakultesi/bolumler/grafik-tasarim) |
| Güzel Sanatlar Fakültesi | Tekstil ve Moda Tasarımı | 1, 2, 3, 4, 5, 6, 7, 8 | 112 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/fakulteler/guzel-sanatlar-fakultesi/bolumler/tekstil-ve-moda-tasarimi) |
| Konservatuvar | Müzik Teknolojisi | 1, 2, 3, 4, 5, 6, 7, 8 | 80 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/yuksekokullar/konservatuvar/bolumler/muzik-teknolojisi) |
| Konservatuvar | Opera | 1, 2, 3, 4, 5, 6, 7, 8 | 145 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/yuksekokullar/konservatuvar/bolumler/opera) |
| Konservatuvar | Tiyatro | 1, 2, 3, 4, 5, 6, 7, 8 | 96 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/yuksekokullar/konservatuvar/bolumler/tiyatro) |
| Konservatuvar | Türk Musikisi | 1, 2, 3, 4, 5, 6, 7, 8 | 183 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/yuksekokullar/konservatuvar/bolumler/turk-musikisi) |
| Meslek Yüksekokulu | Anestezi | 1, 2, 3, 4 | 80 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/anestezi) |
| Meslek Yüksekokulu | Aşçılık | 1, 2, 3, 4 | 242 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/ascilik) |
| Meslek Yüksekokulu | Bankacılık ve Sigortacılık | 1, 2, 3, 4 | 181 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/bankacilik-ve-sigortacilik) |
| Meslek Yüksekokulu | Bilgisayar Programcılığı | 1, 2, 3, 4 | 356 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/bilgisayar-programciligi) |
| Meslek Yüksekokulu | Bilgisayar Teknolojisi | 1, 2, 3, 4 | 356 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/bilgisayar-teknolojisi) |
| Meslek Yüksekokulu | Bilişim Güvenliği Teknolojisi | 1, 2, 3, 4 | 284 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/bilisim-guvenligi-teknolojisi) |
| Meslek Yüksekokulu | Bulut Bilişim Operatörlüğü | 1, 2, 3, 4 | 341 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/bulut-bilisim-operatorlugu) |
| Meslek Yüksekokulu | Büyük Veri Analistliği | 1, 2, 3, 4 | 372 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/buyuk-veri-analistligi) |
| Meslek Yüksekokulu | Çocuk Gelişimi | 1, 2, 3, 4 | 101 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/cocuk-gelisimi) |
| Meslek Yüksekokulu | Dış Ticaret | 1, 2, 3, 4 | 204 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/dis-ticaret) |
| Meslek Yüksekokulu | Dijital Dönüşüm Elektroniği | 1, 2, 3, 4 | 189 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/dijital-donusum-elektronigi) |
| Meslek Yüksekokulu | E-Ticaret ve Pazarlama | 1, 2, 3, 4 | 174 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/e-ticaret-ve-pazarlama) |
| Meslek Yüksekokulu | Elektrik | 1, 2, 3, 4 | 209 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/elektrik) |
| Meslek Yüksekokulu | Elektronik Teknolojisi | 1, 2, 3, 4 | 249 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/elektronik-teknolojisi) |
| Meslek Yüksekokulu | Fizyoterapi | 1, 2, 3, 4 | 87 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/fizyoterapi) |
| Meslek Yüksekokulu | Grafik Tasarımı | 1, 2, 3, 4 | 245 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/grafik-tasarimi) |
| Meslek Yüksekokulu | İç Mekan Tasarımı | 1, 2, 3, 4 | 202 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/ic-mekan-tasarimi) |
| Meslek Yüksekokulu | İlk ve Acil Yardım | 1, 2, 3, 4 | 108 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/ilk-ve-acil-yardim) |
| Meslek Yüksekokulu | İmalat Yürütme Sistemleri Operatörlüğü | 1, 2, 3, 4 | 222 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/imalat-yurutme-sistemleri-operatorlugu) |
| Meslek Yüksekokulu | İnsan Kaynakları Yönetimi | 1, 2, 3, 4 | 187 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/insan-kaynaklari-yonetimi) |
| Meslek Yüksekokulu | İnsansız Araç Teknikerliği | 1, 2, 3, 4 | 147 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/insansiz-arac-teknikerligi) |
| Meslek Yüksekokulu | İnşaat Teknolojisi | 1, 2, 3, 4 | 218 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/insaat-teknolojisi) |
| Meslek Yüksekokulu | İşletme Yönetimi | 1, 2, 3, 4 | 178 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/isletme-yonetimi) |
| Meslek Yüksekokulu | Kurumsal Bilişim Uzmanlığı | 1, 2, 3, 4 | 285 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/kurumsal-bilisim-uzmanligi) |
| Meslek Yüksekokulu | Lojistik | 1, 2, 3, 4 | 234 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/lojistik) |
| Meslek Yüksekokulu | Mahkeme Büro Hizmetleri | 1, 2, 3, 4 | 208 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/mahkeme-buro-hizmetleri) |
| Meslek Yüksekokulu | Makine | 1, 2, 3, 4 | 198 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/makine) |
| Meslek Yüksekokulu | Mekatronik | 1, 2, 3, 4 | 150 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/mekatronik) |
| Meslek Yüksekokulu | Moda Tasarımı | 1, 2, 3, 4 | 255 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/moda-tasarimi) |
| Meslek Yüksekokulu | Optisyenlik | 1, 2, 3, 4 | 89 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/optisyenlik) |
| Meslek Yüksekokulu | Otonom Sistemler Teknikerliği | 1, 2, 3, 4 | 197 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/otonom-sistemler-teknikerligi) |
| Meslek Yüksekokulu | Oyun Geliştirme ve Programlama | 1, 2, 3, 4 | 317 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/oyun-gelistirme-ve-programlama) |
| Meslek Yüksekokulu | Raylı Sistemler İşletmeciliği | 1, 2, 3, 4 | 170 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/rayli-sistemler-isletmeciligi) |
| Meslek Yüksekokulu | Robotik ve Yapay Zekâ | 1, 2, 3, 4 | 360 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/robotik-ve-yapay-zeka) |
| Meslek Yüksekokulu | Saç Bakımı ve Güzellik Hizmetleri | 1, 2, 3, 4 | 150 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/sac-bakimi-ve-guzellik-hizmetleri) |
| Meslek Yüksekokulu | Sağlık Bilgi Sistemleri Teknikerliği | 1, 2, 3, 4 | 194 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/saglik-bilgi-sistemleri-teknikerligi) |
| Meslek Yüksekokulu | Sağlık Turizmi İşletmeciliği | 1, 2, 3, 4 | 162 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/saglik-turizmi-isletmeciligi) |
| Meslek Yüksekokulu | Siber Güvenlik | 1, 2, 3, 4 | 349 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/siber-guvenlik) |
| Meslek Yüksekokulu | Sivil Hava Ulaştırma İşletmeciliği | 1, 2, 3, 4 | 199 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/sivil-hava-ulastirma-isletmeciligi) |
| Meslek Yüksekokulu | Tıbbi Görüntüleme Teknikleri | 1, 2, 3, 4 | 83 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/tibbi-goruntuleme-teknikleri) |
| Meslek Yüksekokulu | Turizm ve Otel İşletmeciliği | 1, 2, 3, 4 | 214 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/turizm-ve-otel-isletmeciligi) |
| Meslek Yüksekokulu | Uçak Teknolojisi | 1, 2, 3, 4 | 155 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/ucak-teknolojisi) |
| Meslek Yüksekokulu | Yapay Zekâ Operatörlüğü | 1, 2, 3, 4 | 344 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/meslek-yuksekokullari/meslek-yuksekokulu/programlar/yapay-zeka-operatorlugu) |
| Lisansüstü Eğitim Enstitüsü | Beden Eğitimi ve Spor (Doktora) | 1, 2, 3, 4, 5, 6, 7, 8 | 53 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/beden-egitimi-ve-spor-doktora) |
| Lisansüstü Eğitim Enstitüsü | Beslenme ve Diyetetik (Doktora) | 1, 2, 3, 4, 5, 6, 7, 8 | 90 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/beslenme-ve-diyetetik-doktora) |
| Lisansüstü Eğitim Enstitüsü | Fizyoterapi ve Rehabilitasyon (Doktora) | 1, 2, 3, 4, 5, 6, 7, 8 | 52 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/fizyoterapi-ve-rehabilitasyon-doktora) |
| Lisansüstü Eğitim Enstitüsü | Hemşirelik (Doktora) | 1, 2, 3, 4, 5, 6, 7, 8 | 90 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/hemsirelik-doktora) |
| Lisansüstü Eğitim Enstitüsü | İşletme (Doktora) | 1, 2, 3, 4, 5, 6, 7, 8 | 66 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/isletme-doktora) |
| Lisansüstü Eğitim Enstitüsü | Mimarlık (Doktora) | 1, 2, 3, 4, 5, 6, 7, 8 | 58 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/mimarlik-doktora) |
| Lisansüstü Eğitim Enstitüsü | Tekstil ve Moda Tasarımı (Sanatta Yeterlik) | 1, 2, 3, 4, 5, 6, 7, 8 | 42 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/tekstil-ve-moda-tasarimi-sanatta-yeterlik) |
| Lisansüstü Eğitim Enstitüsü | Türk Musikisi (Sanatta Yeterlik) | 1, 2, 3, 4, 5, 6, 7, 8 | 32 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/turk-musikisi-sanatta-yeterlik) |
| Lisansüstü Eğitim Enstitüsü | Beden Eğitimi ve Spor (Tezli) | 1, 2, 3, 4 | 88 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/beden-egitimi-ve-spor-tezli) |
| Lisansüstü Eğitim Enstitüsü | Beslenme ve Diyetetik (Tezli) | 1, 2, 3, 4 | 80 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/beslenme-ve-diyetetik-tezli) |
| Lisansüstü Eğitim Enstitüsü | Bilgisayar Mühendisliği (Tezli) | 1, 2, 3, 4 | 142 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/bilgisayar-muhendisligi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Bilgisayar Mühendisliği (Tezsiz) | 1, 2, 3, 4 | 142 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/bilgisayar-muhendisligi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Dijital Medya Yönetimi (Tezli) | 1, 2, 3, 4 | 34 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/dijital-medya-yonetimi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Dijital Medya Yönetimi (Tezsiz) | 1, 2, 3 | 32 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/dijital-medya-yonetimi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Enerji Sistemleri Mühendisliği (Tezli) | 1, 2, 3, 4 | 84 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/enerji-sistemleri-muhendisligi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Enerji Sistemleri Mühendisliği (Tezsiz) | 1, 2, 3 | 82 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/enerji-sistemleri-muhendisligi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Elektrik-Elektronik Mühendisliği (Tezli) | 1, 2, 3, 4 | 128 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/elektrik-elektronik-muhendisligi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Elektrik-Elektronik Mühendisliği (Tezsiz) | 1, 2, 3 | 126 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/elektrik-elektronik-muhendisligi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Endüstri Mühendisliği (Tezli) | 1, 2, 3, 4 | 52 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/endustri-muhendisligi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Endüstri Mühendisliği (Tezsiz) | 1, 2, 3 | 50 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/endustri-muhendisligi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Endüstri Mühendisliği (İngilizce) (Tezli) | 1, 2, 3, 4 | 50 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/endustri-muhendisligi-ingilizce-tezli) |
| Lisansüstü Eğitim Enstitüsü | Endüstri Mühendisliği (İngilizce) (Tezsiz) | 1, 2, 3 | 48 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/endustri-muhendisligi-ingilizce-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Endüstriyel Tasarım (Tezli) | 1, 2, 3, 4 | 46 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/endustriyel-tasarim-tezli) |
| Lisansüstü Eğitim Enstitüsü | Endüstriyel Tasarım (Tezsiz) | 1, 2, 3 | 44 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/endustriyel-tasarim-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Fizyoterapi ve Rehabilitasyon (Tezli) | 1, 2, 3, 4 | 43 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/fizyoterapi-ve-rehabilitasyon-tezli) |
| Lisansüstü Eğitim Enstitüsü | Grafik Tasarım (Tezli) | 1, 2, 3, 4 | 60 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/grafik-tasarim-tezli) |
| Lisansüstü Eğitim Enstitüsü | Grafik Tasarım (Tezsiz) | 1, 2, 3 | 58 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/grafik-tasarim-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Hastane ve Sağlık Kuruluşları Yönetimi (Tezli) | 1, 2, 3, 4 | 60 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/hastane-ve-saglik-kuruluslari-yonetimi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Hastane ve Sağlık Kuruluşları Yönetimi (Tezsiz) | 1, 2, 3 | 58 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/hastane-ve-saglik-kuruluslari-yonetimi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Hemşirelik (Tezli) | 1, 2, 3, 4 | 121 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/hemsirelik-tezli) |
| Lisansüstü Eğitim Enstitüsü | Hemşirelik (Tezsiz) | 1, 2, 3 | 119 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/hemsirelik-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | İç Mimarlık (Tezli) | 1, 2, 3, 4 | 48 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/ic-mimarlik-tezli) |
| Lisansüstü Eğitim Enstitüsü | İç Mimarlık (Tezsiz) | 1, 2, 3 | 46 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/ic-mimarlik-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | İnsan Kaynakları Yönetimi (Tezli) | 1, 2, 3, 4 | 44 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/insan-kaynaklari-yonetimi-tezli) |
| Lisansüstü Eğitim Enstitüsü | İnsan Kaynakları Yönetimi (Tezsiz) | 1, 2, 3 | 42 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/insan-kaynaklari-yonetimi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | İşletme (Tezli) | 1, 2, 3, 4 | 74 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/isletme-tezli) |
| Lisansüstü Eğitim Enstitüsü | İşletme (Tezsiz) | 1, 2, 3 | 72 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/isletme-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | İşletme (İngilizce) (Tezli) | 1, 2, 3, 4 | 52 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/isletme-ingilizce-tezli) |
| Lisansüstü Eğitim Enstitüsü | İşletme (İngilizce) (Tezsiz) | 1, 2, 3 | 50 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/isletme-ingilizce-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Klinik Psikoloji (Tezli) | 1, 2, 3, 4 | 64 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/klinik-psikoloji-tezli) |
| Lisansüstü Eğitim Enstitüsü | Makine Mühendisliği (Tezli) | 1, 2, 3, 4 | 72 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/makine-muhendisligi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Mimarlık (Tezli) | 1, 2, 3, 4 | 72 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/mimarlik-tezli) |
| Lisansüstü Eğitim Enstitüsü | Mimarlık (Tezsiz) | 1, 2, 3 | 70 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/mimarlik-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Moleküler Biyoloji ve Genetik (Tezli) | 1, 2, 3, 4 | 42 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/molekuler-biyoloji-ve-genetik-tezli) |
| Lisansüstü Eğitim Enstitüsü | Moleküler Biyoloji ve Genetik (Tezsiz) | 1, 2, 3 | 39 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/molekuler-biyoloji-ve-genetik-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Muhasebe ve Denetim (Tezli) | 1, 2, 3, 4 | 44 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/muhasebe-ve-denetim-tezli) |
| Lisansüstü Eğitim Enstitüsü | Muhasebe ve Denetim (Tezsiz) | 1, 2, 3 | 42 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/muhasebe-ve-denetim-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Psikoloji (Tezli) | 1, 2, 3, 4 | 64 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/psikoloji-tezli) |
| Lisansüstü Eğitim Enstitüsü | Psikoloji (Tezsiz) | 1, 2, 3 | 61 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/psikoloji-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Tekstil ve Moda Tasarımı (Tezli) | 1, 2, 3, 4 | 38 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/tekstil-ve-moda-tasarimi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Tekstil ve Moda Tasarımı (Tezsiz) | 1, 2, 3 | 36 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/tekstil-ve-moda-tasarimi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Tiyatro (Tezli) | 1, 2, 3, 4 | 30 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/tiyatro-tezli) |
| Lisansüstü Eğitim Enstitüsü | Tiyatro (Tezsiz) | 1, 2, 3 | 28 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/tiyatro-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Turizm İşletmeciliği (Tezli) | 1, 2, 3, 4 | 60 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/turizm-isletmeciligi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Turizm İşletmeciliği (Tezsiz) | 1, 2, 3 | 58 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/turizm-isletmeciligi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Türk Dili ve Edebiyatı (Tezli) | 1, 2, 3, 4 | 49 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/turk-dili-ve-edebiyati-tezli) |
| Lisansüstü Eğitim Enstitüsü | Türk Dili ve Edebiyatı (Tezsiz) | 1, 2, 3 | 47 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/turk-dili-ve-edebiyati-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Türk Musikisi (Tezli) | 1, 2, 3, 4 | 48 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/turk-musikisi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Türk Musikisi (Tezsiz) | 1, 2, 3 | 46 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/turk-musikisi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Uluslararası İşletme Yönetimi (İngilizce) (Tezli) | 1, 2, 3, 4 | 58 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/uluslararasi-isletme-yonetimi-ingilizce-tezli) |
| Lisansüstü Eğitim Enstitüsü | Uluslararası İşletme Yönetimi (İngilizce) (Tezsiz) | 1, 2, 3 | 56 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/uluslararasi-isletme-yonetimi-ingilizce-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Uluslararası Ticaret ve İşletmecilik (Tezli) | 1, 2, 3, 4 | 58 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/uluslararasi-ticaret-ve-isletmecilik-tezli) |
| Lisansüstü Eğitim Enstitüsü | Uluslararası Ticaret ve İşletmecilik (Tezsiz) | 1, 2, 3 | 56 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/uluslararasi-ticaret-ve-isletmecilik-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Uygulamalı Matematik (Tezli) | 1, 2, 3, 4 | 68 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/uygulamali-matematik-tezli) |
| Lisansüstü Eğitim Enstitüsü | Uygulamalı Matematik (Tezsiz) | 1, 2, 3 | 66 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/uygulamali-matematik-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Uygulamalı Psikoloji (Tezli) | 1, 2, 3, 4 | 87 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/uygulamali-psikoloji-tezli) |
| Lisansüstü Eğitim Enstitüsü | Uygulamalı Psikoloji (Tezsiz) | 1, 2, 3 | 84 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/uygulamali-psikoloji-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Yapay Zeka Mühendisliği (Tezli) | 1, 2, 3, 4 | 66 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/yapay-zeka-muhendisligi-tezli) |
| Lisansüstü Eğitim Enstitüsü | Yapay Zeka Mühendisliği (Tezsiz) | 1, 2, 3 | 64 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/yapay-zeka-muhendisligi-tezsiz) |
| Lisansüstü Eğitim Enstitüsü | Yönetim Bilişim Sistemleri (Tezli) | 1, 2, 3, 4 | 54 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/yonetim-bilisim-sistemleri-tezli) |
| Lisansüstü Eğitim Enstitüsü | Yönetim Bilişim Sistemleri (Tezsiz) | 1, 2, 3 | 52 | [Resmî sayfa](https://halic.edu.tr/tr/akademik/enstituler/lisansustu-egitim-enstitusu/programlar/yonetim-bilisim-sistemleri-tezsiz) |
