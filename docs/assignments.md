# Kişisel ödev takibi

Ödevler öğrencinin kişisel ders kaydına (`enrollment_id`) bağlanır. Aktif ve e-postası doğrulanmış hesap gerekir. Sahiplik sunucudaki oturumdan belirlenir; başka hesabın kaydı tüm işlemlerde 404 döner.

## Kullanım

Önce kişisel ders listesine ders ekle. **Ödevlerim → Ödev ekle** üzerinden ders, başlık ve teslim tarihi seç. Web formunda yalnızca ders, başlık ve teslim günü zorunludur. Bugün/Yarın/1 hafta sonra kısayolları vardır. Not alanı her açılışta kapalıdır; önem seçimi doğrudan formdadır. Durum formdan değiştirilmez; Ödevler sayfasındaki Tamamla/Yeniden aç düğmeleri kullanılır; tahmini süre formdan kaldırılmıştır. Ödev tamamlanabilir, yeniden açılabilir, düzenlenebilir ve arşivlenip geri yüklenebilir. Bu işlemler resmi bir teslim veya OBS kaydı oluşturmaz.

Arşivlenmiş derse yeni ödev eklenmez (409). Mevcut ödevleri korunur; görüntülenebilir ve tamamlanabilir. Ödev arşivleme kalıcı silme değildir. Arşivdeki ödevi düzenlemek için önce geri yükle.

## API

Yollar `/api/v1` altındadır:

| İşlem | Yol |
| --- | --- |
| Oluştur / listele | `POST /assignments`, `GET /assignments` |
| Oku / güncelle / arşivle | `GET`, `PATCH`, `DELETE /assignments/{id}` |
| Geri yükle | `POST /assignments/{id}/restore` |

Örnek oluşturma gövdesi (ders kimliği kendi kaydına ait olmalı):

```json
{
  "enrollment_id": 1,
  "title": "Algoritma raporu",
  "description": "Çözümü ve test örneklerini hazırla.",
  "due_at": "2026-11-05T23:59:00+03:00",
  "priority": "normal",
  "estimated_minutes": 90
}
```

Başlık 1–200, açıklama en fazla 5000 karakterdir. Öncelik `low`, `normal`, `high`; durum `pending`, `completed` olabilir. Süre 1–10080 dakika veya boş olabilir. `PATCH {"status":"completed"}` tamamlar; `pending` yeniden açar. `completed_at` sunucuda belirlenir. Sahiplik ve bağlı ders sonradan değiştirilemez.

`due_at` saat dilimi içermelidir; belirsiz tarihler 422 döner. PostgreSQL tarihleri zaman dilimiyle saklar, arayüz Türkiye saatiyle (UTC+3) gösterir. `is_overdue` saklanmış bir durum değil, tamamlanmamış/arşivlenmemiş kayıtların teslim tarihinden hesaplanan bilgidir.

Listede `term_id`, `enrollment_id`, `q`, `include_archived`, `view=all|pending|completed|overdue|upcoming`, `sort=due|priority|recent`, `limit`, `offset` kullanılabilir. Yaklaşan filtresi sonraki 7 gündür; sayfalama varsayılan 50, üst sınır 200 kayıttır.

## Migration ve doğrulama

`0005_assignments` yalnızca ödev tablosunu, indekslerini ve ders-sahiplik bileşik benzersizlik kısıtını ekler. Güncel autogenerate izin listesi, sınav kaynakları dahil on uygulama tablosuyla sınırlıdır. Testler sahiplik, doğrulama, saat dilimi, durum geçişleri, arşiv/geri yükleme ve migration geri almayı kapsar.

```sh
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m pytest -q tests/test_assignments.py
node --test tests/test_assignment_ui.mjs
```

Dosya yükleme, bildirim/e-posta hatırlatmaları ve üniversiteye otomatik teslim bu sürümde yoktur.

## Sade teslim günü akışı

Web arayüzü saat istemez; seçilen gün Türkiye saatinde gün sonu olarak API’ye gönderilir. Gecikme, API filtreleri ve ana sayfada Türkiye takvim günü üzerinden değerlendirilir: bugün teslim edilecek ödev gün içinde gecikmiş sayılmaz. Ödev kartları ve gündem saat göstermez; resmi sınav saatleri korunur. Tahmini süre eski API kayıtlarında korunur, webden düzenleme bu alanı silmez; arayüz ve ders dağılımında gösterilmez. Yeni migration veya mevcut kayıtların toplu güncellenmesi gerekmez.
