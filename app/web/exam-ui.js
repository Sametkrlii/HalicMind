export const examTypes={midterm:'Vize',final:'Final',makeup:'Mazeret',resit:'Bütünleme'};
const displayDate=value=>value?new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'}).format(new Date(value)):'';
const displayTime=value=>new Intl.DateTimeFormat('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}).format(new Date(value));
export function createExamUI({e,icon,button,termPicker,termLabel,emptyState}){
  function candidate(item,group,selectable){return `<div class="exam-candidate"><div><strong>${e(displayDate(item.starts_at))} · ${e(displayTime(item.starts_at))}</strong><p>${item.room?`Salon${item.room.includes(';')?'lar':''}: ${e(item.room)}`:'Salon belirtilmemiş'}${item.section?` · Grup/şube: ${e(item.section)}`:''}</p>${item.room?.includes(';')?'<p class="field-help">Dosyada birden fazla salon var; kişisel salon yerleşimini resmi duyurudan kontrol et.</p>':''}<a href="${e(item.source_url)}" target="_blank" rel="noopener noreferrer">Resmi duyuru ↗</a> · <a href="${e(item.file_url)}" target="_blank" rel="noopener noreferrer">Excel kaynağı ↗</a><small>Dosyanın son başarılı kontrolü: ${e(displayDate(item.source_checked_at))} ${e(displayTime(item.source_checked_at))}</small></div>${selectable?button('select-exam','Bu grubu seç','light','check',`data-id="${group.enrollment_id}" data-document="${item.document_id}" data-exam-type="${e(group.exam_type)}" data-sheet="${e(item.sheet)}" data-row="${item.row}"`):''}</div>`;}
  function examCard(group) {
    const known = (group.last_known || []).map(item=>
      `<div><strong>Son bilinen kayıt</strong>${candidate(item,group,false)}</div>`).join('');
    let schedule;
    if (group.status === 'confirmed') {
      schedule = `<span class="pill green">Kesinleşmiş sınav</span>${candidate(group.selected,group,false)}`;
    } else if (group.status === 'source_unavailable') {
      schedule = `<p class="notice">Kaynak doğrulanamadı. Güncel saat için resmî duyuruyu kontrol et.</p>${known}`;
    } else {
      schedule = `${known}<span class="pill amber">Şube seçimi bekleniyor</span>
        <p class="field-help">Kendi kaydına uygun sınavı seç.</p>${group.candidates.map(item=>candidate(item,group,true)).join('')}`;
    }
    return `<article class="exam-period" id="exam-${group.enrollment_id}-${e(group.exam_type)}" tabindex="-1">
      <h4>${e(examTypes[group.exam_type])}</h4>
      ${group.selection_changed && group.status!=='source_unavailable'?'<p class="notice">Kaynak dosyası değişti. Önceki şube seçimini kontrol et.</p>':''}
      ${group.changed_from?`<p class="notice">Sınav tarihi güncellendi. Önceki tarih: ${e(displayDate(group.changed_from))} ${e(displayTime(group.changed_from))}</p>`:''}
      ${schedule}</article>`;
  }
  function publishedSchedules(documents) {
    if (!documents?.length) return '';
    const groups = new Map();
    for (const doc of documents) {
      if (!groups.has(doc.announcement_url)) groups.set(doc.announcement_url, []);
      groups.get(doc.announcement_url).push(doc);
    }
    return '<h2 class="exam-section-title">Yayımlanan sınav programları</h2>' + [...groups].map(([url,docs])=>
      `<details class="exam-errors"><summary>${e(docs[0].title)}</summary><p><a href="${e(url)}" target="_blank" rel="noopener noreferrer">Resmî duyuruyu aç ↗</a></p>
      ${docs.map(doc=>`<div class="exam-candidate"><div><strong>${e(doc.file_url.split('/').pop().replace(/\.xlsx?$/i,'').replaceAll('-',' '))}</strong><p><a href="${e(doc.file_url)}" target="_blank" rel="noopener noreferrer">Kaynak dosyayı aç ↗</a></p></div>
      ${doc.status==='imported'?button('show-exam-file','Programı göster','light','calendar',`data-id="${doc.id}"`):'Dosya kontrol bekliyor.'}</div>`).join('')}</details>`).join('');
  }
  function courseSchedules(state, groups) {
    const courses = new Map((state.courses || []).filter(course=>course.term_id===state.termId && !course.archived_at && course.status==='in_progress').map(course=>[course.id,course]));
    for (const group of groups) if (!courses.has(group.enrollment_id)) courses.set(group.enrollment_id,group);
    if (!courses.size) return '<p>Bu dönemde devam eden dersin yok. Diğer derslerin sınavlarını aşağıda arayabilirsin.</p>';
    function summaryTime(group) {
      if (!group) return 'Tarih bekleniyor';
      if (group.status==='selection_required') return 'Şube seç';
      if (group.status!=='confirmed') return 'Kontrol bekliyor';
      const at=group.selected.starts_at;
      return `<time datetime="${e(at)}">${e(new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',timeZone:'Europe/Istanbul'}).format(new Date(at)))} · ${e(displayTime(at))}</time>${group.changed_from?' · Güncellendi':''}`;
    }
    return `<div class="course-agenda">${[...courses].map(([id,course])=>{
      const exams = groups.filter(group=>group.enrollment_id===id);
      const extras = exams.filter(group=>['makeup','resit'].includes(group.exam_type));
      const line = `<span class="agenda-name"><strong>${e(course.course_name)}</strong><small>${e(course.course_code)}${extras.map(group=>' · '+examTypes[group.exam_type]).join('')}</small></span>
        ${['midterm','final'].map(kind=>`<span class="agenda-date"><small>${examTypes[kind]}</small><span>${summaryTime(exams.find(group=>group.exam_type===kind))}</span></span>`).join('')}`;
      if (!exams.length) return `<div class="exam-course"><div class="agenda-line">${line}</div></div>`;
      return `<details class="exam-course"><summary class="agenda-line">${line}${icon('chevron')}</summary>
        <div class="agenda-detail">${['midterm','final','makeup','resit'].flatMap(kind=>exams.filter(group=>group.exam_type===kind).map(examCard)).join('')}</div></details>`;
    }).join('')}</div>`;

  }
  function searchResults({matches,has_more}) {
    if (!matches.length) return '<p>Bu dönemin okunabilen programlarında eşleşme bulunamadı.</p>';
    return `<p>${has_more?'İlk 80 sonuç gösteriliyor. Aramayı ders koduyla daraltabilirsin.':matches.length+' sınav kaydı bulundu.'}</p>${matches.map(row=>
      `<article class="exam-candidate"><div><strong>${e(row.code)} · ${e(row.name)}</strong><p>${e(examTypes[row.exam_type])} · ${e(displayDate(row.starts_at))} · ${e(displayTime(row.starts_at))}</p><small>${[row.program,row.section && 'Şube '+row.section,row.room && 'Salon '+row.room].filter(Boolean).map(e).join(' · ')}</small></div><a href="${e(row.announcement_url)}" target="_blank" rel="noopener noreferrer">Resmî duyuru ↗</a></article>`).join('')}`;
  }
  function sourceErrors(errors) {
    if (!errors?.length) return '';
    const messages=new Map();
    for (const {message,url} of errors) {
      if (!messages.has(message)) messages.set(message,new Set());
      messages.get(message).add(url);
    }
    return `<details class="exam-errors"><summary>Kontrol bekleyen kaynaklar (${errors.length})</summary><ul>${[...messages].map(([message,urls])=>
      `<li>${e(message)} <span>${[...urls].map((url,i)=>`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">Kaynak ${i+1} ↗</a>`).join(' · ')}</span></li>`).join('')}</ul></details>`;
  }
  function page(state){
    if (state.examState === 'loading') return '<h1>Sınavlar</h1><p role="status">Sınav takvimi yükleniyor…</p>';
    if (state.examState === 'error') return '<h1>Sınavlar</h1>' + emptyState('Sınav takvimi yüklenemedi','Takvimi tekrar yüklemeyi dene.','refresh-exams','Yeniden dene');
    const term=state.terms.find(item=>item.id===state.termId),calendar=state.examCalendars.find(item=>item.term_id===state.termId),sync=state.examSync;
    const exact=calendar?.exams||[];
    const status=sync?.status==='ok'?'Kaynak kontrolü tamamlandı':sync?.status==='partial'?'Bazı kaynaklar kontrol edilemedi':'İlk kaynak kontrolü bekleniyor';
    return `<div class="page-heading"><div><span class="eyebrow">SINAV TAKİBİ</span><h1>Sınavlar</h1><p>Derslerine ait resmi tarihler ve akademik takvim aralıkları.</p></div>${termPicker()}</div>
    ${term?`<h2 class="exam-section-title">Derslerimin sınavları</h2>${courseSchedules(state,exact)}
      <section class="panel panel-padding"><h2>Diğer derslerin sınavları</h2>
      <form data-form="exam-search" class="modal-search"><input type="search" name="query" aria-label="Ders adı veya kodu" placeholder="Ders adı veya kodu" minlength="2" maxlength="100" required><button class="btn primary" type="submit">Ara</button><div class="form-error"></div></form>
      <div data-exam-results aria-live="polite"></div></section>`:''}
    <details class="exam-resources"><summary>Resmî programlar ve kaynak durumu</summary>
    <section class="exam-sync"><div><strong>${e(status)}</strong><p>${sync?.succeeded_at?`Son başarılı kontrol: ${e(displayDate(sync.succeeded_at))} ${e(displayTime(sync.succeeded_at))}<br>`: ''}${sync?.checked_at?`Son deneme: ${e(displayDate(sync.checked_at))} ${e(displayTime(sync.checked_at))}`:'Henüz kontrol kaydı yok.'} · ${sync?.enabled?'Sunucu açıkken otomatik kontrol etkin.':'Otomatik kontrol kapalı.'}</p></div>${button('refresh-exams','Ekranı yenile','light','refresh')}</section>
    ${sourceErrors(sync?.errors)}
    ${publishedSchedules(calendar?.documents)}</details>
    ${!calendar?emptyState('Önce dönemini oluştur','Sınav takvimi seçtiğin akademik yıla ve döneme göre gösterilecek.','new-term','Dönem oluştur',false,'calendar'):calendar.status==='unavailable'?emptyState('Genel takvim henüz doğrulanmadı',calendar.reason,null,null,false,'calendar'):`<h2 class="exam-section-title">Genel sınav aralıkları</h2><div class="exam-source"><span>Kaynak kontrolü: ${e(displayDate(calendar.checked_on+'T12:00:00Z'))} · ${e(termLabel(term))}</span><a href="${e(calendar.source_url)}" target="_blank" rel="noopener noreferrer">Resmi akademik takvimi aç ↗</a></div><div class="exam-periods">${calendar.periods.map(period=>`<article class="exam-period"><span class="eyebrow">AKADEMİK TAKVİM</span><h2>${e(period.label)}</h2><p class="exam-range">${e(displayDate(period.start_date+'T12:00:00Z'))}<br><span>— ${e(displayDate(period.end_date+'T12:00:00Z'))}</span></p><span class="pill amber">Genel aralık · ders tarihi değil</span></article>`).join('')}</div>`}
    <p class="field-help">Tüm saatler Türkiye saatidir (UTC+3). Mazeret ve bütünleme aralıkları sınava giriş hakkı oluşturmaz. Üniversitenin güncel duyurusu esastır. Hazırlık takvimleri henüz otomatik eşleştirmeye dahil değildir.</p>`;
  }
  return {page,searchResults};
}
