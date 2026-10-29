# Mevcut sürümün sağlamlaştırılması — 30 Ekim 2026

## Doğrulama kapsamı

Yerel PostgreSQL üzerinde, test başına geçici şema ve rollback kullanan API entegrasyon testleri çalıştırıldı. Migration testleri upgrade/downgrade, tekrar upgrade, katalog koruması ve autogenerate kapsamını doğrular. Çalışan veritabanı `0006_exam_sources` head sürümündedir; Alembic check yeni işlem önermemektedir. Gerçek hesapların verilerini değiştirmek doğrulamanın parçası değildir.

Ödev testleri: hesap sahipliği, doğrulanmış oturum, arşiv/geri yükleme, tamamla/yeniden aç, arşivlenmiş derse yeni ödev eklenmesinin engellenmesi ve Türkiye takvim gününe göre gecikme. Sınav testleri: bölüm/yıl/şube eşleştirmesi, başka kullanıcının seçiminin engellenmesi, değişen belge sürümü, kaldırılmış veya eski kaynak, çelişen dosyalar, tekrar tarama ve dosya biçim sınırları.

Bu incelemede aynı sınavın fakülte ve genel liste kopyaları birleştirildiğinde önceden seçilen şubenin korunmaması düzeltildi. Kaynak geçmişi ve gerçek seçim, görüntülenen adaylar tekilleştirilmeden önce değerlendirilir. Buna özel regresyon testi eklendi.

İstemci testleri: gün sınırları, ödev filtreleri, grafiklerin gerçek kayıtlarla sınırlandırılması, kaynak hata/şube seçim görünümü ve alan bazında API hataları. Bu otomatik testler tüm tarayıcılarda görsel uygunluk veya bağımsız güvenlik denetimi anlamına gelmez.

## Çalıştırma

```sh
.venv/bin/python -m pytest -q
node --test tests/*.mjs
.venv/bin/python -m alembic current
.venv/bin/python -m alembic check
```

## Sonraki aşamanın tasarım sınırları

Çalışma merkezi ve çalışma raporları henüz uygulanmadı. Uygulama sırası:

1. Kendi kişisel dersine bağlı konu checklist'i; konu tamamlama zamanı ve geri açma.
2. Sunucuda saklanan çalışma oturumu ve çalışma aralıkları: başlat/duraklat/devam/bitir. Kullanıcı başına tek aktif oturum; eşzamanlı isteklerde veritabanı kuralı. Tarayıcı sayacı yalnızca görünüm olacak.
3. Yenilemede sunucudan oturumu geri yükleme. Ağ kesilmesinde görünür bağlantı uyarısı; sunucunun onaylamadığı duraklat/bitir işlemini başarılı göstermeme. Sunucuda başlamış aralık, kullanıcı durdurana kadar sürer; unutulan sayaç sonradan düzeltilebilir.
4. Süre düzeltmesini özgün süreyi ve düzeltme bilgisini koruyarak kaydetme. Çakışan/negatif süreleri engelleme. Ders arşivleme oturum geçmişini silmeyecek.
5. Yalnızca bu kalıcı kayıtlardan Türkiye saatine göre günlük/haftalık ders süreleri, tamamlanan konular ve kullanıcı hedefi karşılaştırması. Ödevin tahmini süresi çalışma yapılmış gibi raporlanmayacak.

Mevcut grafikler çalışma süresi veya verimlilik iddiasında bulunmaz. SMTP, parola sıfırlama, yayın/HTTPS, yedekleme ve KVKK taslağının tamamlanması konuları mevcut yayın sınırlarıdır.
