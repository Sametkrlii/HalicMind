# Akademik profil, dönemler ve kişisel dersler

## Veri modeli ve endpoint planı

- `academic_profiles`: kullanıcı başına program, müfredat, giriş yılı, mevcut sınıf ve hazırlık durumu. `GET/PUT /api/v1/users/me/academic-profile`.
- `academic_terms`: kullanıcının takvim yılı/dönemi; program ve müfredat seçiminin tarihsel kopyası; isteğe bağlı müfredat dönem türü/numarası. `POST/GET /api/v1/terms`, `GET/PATCH/DELETE /api/v1/terms/{id}`.
- `enrollments`: kişisel dönemlik ders kaydı; katalog ders/revizyon kimlikleri veya kişisel ders; ad/kod/AKTS kopyası, sonuç, isteğe bağlı not, arşiv zamanı. `POST/GET /api/v1/enrollments`, `GET/PATCH/DELETE /api/v1/enrollments/{id}`, `POST /api/v1/enrollments/{id}/restore`.
- `GET /api/v1/terms/{id}/suggestions`: dönem müfredatından zorunlular önce, seçmeliler sonra; ilgili seçmeli grupları ayrıca sunulur. Salt okunurdur.

Geçmiş dönemleri doldurmak zorunlu değildir. Profil ilk kurulumda oluşturulur; giriş akışı profil eksikliğinden dolayı engellenmez. Tüm kişisel endpoint'ler doğrulanmış, aktif oturum ister; kullanıcı kimliği yalnızca oturumdan alınır. Başkasının kaynak kimliğine erişim `404` döndürür.

## Kararlar ve sınırlar

- `academic_year=2026`, **2026–2027** akademik yılını ifade eder. `fall`, `spring`, `summer`, `annual` takvim dönemleridir. Müfredattaki `semester=1` veya `year=1` bunlardan ayrı tutulur. Bir Güz dönemine müfredatın üçüncü döneminden ders eklenebilir.
- Profilde `current_class=0` yalnızca `preparation_status=in_progress` ile kullanılır. Diğer durumlar `not_required`, `completed`, `exempt`; sınıf en az 1 olmalıdır. Normal program süresinin üstünde sınıf numarası kabul edilmez; uzatmalı öğrenci bulunduğu müfredat sınıfını seçer.
- Hazırlık döneminde `is_preparation=true`, müfredat dönem türü/numarası boş olmalıdır. Bölüm müfredatından hazırlık dersi üretilmez; kişisel hazırlık dersleri eklenebilir.
- Program/müfredat her zaman birlikte doğrulanır. Katalogda bazı müfredatların giriş yılı bilinmediğinden öğrencinin giriş yılıyla otomatik, kesin eşleştirme yapılmaz. Kullanıcı katalogdan müfredat seçer. Takvim geçmişi doldurulmadan güncel dersler eklenebilir.
- Yeni dönem varsayılan olarak profilin program/müfredatını kopyalar. Geçmiş bir program için iki kimlik birlikte açıkça belirtilebilir. Dönemin program/müfredatı oluşturulduktan sonra değiştirilemez; profil güncellemesi geçmiş dönemleri etkilemez.
- Katalog dersleri dönemin müfredatındaki yerleşimlerde veya seçmeli grup üyeliklerinde bulunmalıdır. Başka programın aynı kodlu dersi aynı ders sayılmaz. Dersin kodu/adı/AKTS'si kişisel kayda kopyalanır; katalog sonradan değişirse geçmiş görünümü korunur.
- Aynı katalog dersinin farklı revizyonları aynı dönemde iki aktif kayıt oluşturamaz (`course_id` üzerinden benzersizlik). Farklı dönemlerde tekrar alınabilir. Kişisel dersler kodu normalize edilerek yinelenmeye karşı denetlenir. Ortak katalogda INSERT/UPDATE/DELETE yapılmaz.
- Durumlar: `in_progress`, `passed`, `failed`, `withdrawn`, `exempt`. `grade` isteğe bağlı serbest not metnidir (en fazla 20 karakter); `AA`, `FF`, `85` gibi bilgiler saklanabilir. Not sistemi varsayılmaz, ortalama veya başarı durumu nottan otomatik hesaplanmaz.
- Katalog dersinde yalnızca sonuç ve not güncellenebilir. Kişisel derste bunlara ek olarak ad, kod ve AKTS güncellenebilir. Dersin kaynağı ve dönemi taşınmaz.
- `DELETE /enrollments/{id}` arşivler. Varsayılan listelerde gizlenir; `include_archived=true` ile geçmiş görülebilir. Geri yükleme aynı kimliği, sonuç/notu ve ileride bağlanacak takip kayıtlarını korur. Çakışan aktif ders varsa `409` döner. Arşivlenmiş bir dersin yerine yeni kayıt açmak eski kaydı silmez.
- Yalnızca hiç ders kaydı olmayan dönem silinebilir. Arşivlenmiş dersler de dönem silinmesini engeller. Gelecekte ödev/sınav/çalışma tabloları bu kalıcı ders kimliğine bağlanmalıdır; arşivlenmiş derslere yeni takip kaydı ekleme davranışı o modülde sınırlandırılmalıdır.

## Swagger kullanım örneği

Önce kayıt/doğrulama/giriş akışını tamamlayıp **Authorize** olun (`docs/auth.md`). Ardından:

1. `GET /api/v1/catalog/programs` ile program kimliğini bulun.
2. `GET /api/v1/catalog/curricula?program_id=22` ile o programın müfredat kimliğini bulun. Program ve müfredat kimliklerinin genel olarak aynı olduğu varsayılmaz.
3. `PUT /api/v1/users/me/academic-profile`:

   ```json
   {
     "program_id": 22,
     "curriculum_id": 22,
     "entry_year": 2023,
     "current_class": 2,
     "preparation_status": "completed"
   }
   ```

   Bu örnekteki kimlikleri kendi program/müfredatınıza göre değiştirin. Güncellemede tam profil gönderilir. E-posta, parola veya kullanıcı kimliği bu isteğe eklenmez.

4. `POST /api/v1/terms`:

   ```json
   {
     "academic_year": 2026,
     "term_type": "fall",
     "curriculum_period_kind": "semester",
     "curriculum_period_number": 1
   }
   ```

   Yanıttaki `id` kişisel dönem kimliğinizdir. Aynı kullanıcı/yıl/tür/hazırlık durumu ikinci kez oluşturulamaz. Yıllık programlarda `term_type=annual`, `curriculum_period_kind=year` kullanın. Hazırlık için örnek: `{"academic_year":2023,"term_type":"annual","is_preparation":true}`.

5. `GET /api/v1/terms/{id}/suggestions` ile önerileri görün. Yanıt zorunluları önce, seçmelileri ardından döndürür; `elective_groups` grup kurallarını içerir. `coverage_status` kaynak verinin kapsamını belirtir; eksik katalogdan tam ders planı çıkarılmaz. `period_kind`, `period_number`, `q`, `limit` (en fazla 200), `offset` ile filtreleme/sayfalama yapılabilir. Müfredat dönemi kayıtta belirtilmemişse bu sorguda tür ve numara verilmelidir.

6. Dönen bir `course_revision_id` ile `POST /api/v1/enrollments`:

   ```json
   {
     "term_id": 1,
     "course_revision_id": 123,
     "status": "in_progress"
   }
   ```

   `term_id` ve `course_revision_id` örnektir; kendi yanıtlarınızdaki değerleri kullanın. Geçmiş dönem dersinde örneğin `"status":"passed","grade":"BA"` gönderilebilir.

7. Katalogda bulunmayan kişisel ders:

   ```json
   {
     "term_id": 1,
     "custom_course_code": "OZEL101",
     "custom_course_name": "Katalogda bulunmayan dersim",
     "custom_ects": 3,
     "status": "exempt"
   }
   ```

   Kişisel ders bilgileriyle `course_revision_id` birlikte gönderilmez. AKTS bilinmiyorsa yazılmayabilir.

8. `GET /api/v1/enrollments?term_id=1&status=passed` ile listeleyin. `PATCH /api/v1/enrollments/{id}` için örnek: `{"status":"passed","grade":"AA"}`. Notu temizlemek için `{"grade":null}` gönderin.
9. `DELETE /api/v1/enrollments/{id}` ile arşivleyin; `POST /api/v1/enrollments/{id}/restore` ile geri yükleyin. Arşivi görmek için `GET /api/v1/enrollments?include_archived=true` kullanın.

## Migration ve test

`0004_academic_planning` yalnızca üç kişisel tabloyu ve bunların kısıt/indekslerini ekler. Mevcut katalog ve hesaplar korunur. Yabancı anahtarlar için `app/models/catalog_refs.py` içinde minimal katalog hedefleri tanımlıdır; bunlar Alembic'in izin listesine dahil değildir. Katalog kurulumunu veya güncellemesini `Base.metadata.create_all()` üzerinden yapmayın; katalog aktarım aracı ve Alembic'i kullanın.

```sh
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m alembic check
.venv/bin/python -m pytest -q
.venv/bin/python -m scripts.smoke_academics
```

Testler işlem sonunda tamamen geri alınan geçici şemalarda gerçek katalog DDL'si ve küçük örnek veriler kullanır. Hazırlık, yıllık plan, transfer geçmişi, seçmeli üyeleri, yinelenen dersler, arşiv/geri yükleme, doğrudan SQL kısıtları ve kullanıcılar arası erişim sınırları doğrulanır. `0004` downgrade kişisel akademik kayıtları siler; katalog ve kullanıcı hesaplarını korur.
