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

Katalogda `partial` ve `needs_review` durumları korunur. Kaynaklarda bulunmayan ön koşullar üretilmemiştir. Kimlikler program kapsamlıdır; farklı programlardaki aynı ders kodu tek ders varsayılmaz. Sonraki değişiklikler için yeni numaralı migration eklenmesi ve düzenli `pg_dump` yedeği önerilir. Başlangıç deposundaki Alembic dosyaları boş olduğundan bu ilk aktarım Alembic kullanmaz.
