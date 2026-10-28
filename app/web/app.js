import {api, allPages, setUnauthorizedHandler} from './api.js';
import {icon} from './icons.js';

const root = document.querySelector('#app');
const modal = document.querySelector('#modal');
const statuses = {in_progress:['Devam ediyor','amber'],passed:['Başarılı','green'],failed:['Başarısız','red'],withdrawn:['Bırakıldı','gray'],exempt:['Muaf','blue']};
const termNames = {fall:'Güz',spring:'Bahar',summer:'Yaz',annual:'Yıllık'};
const prepNames = {not_required:'Hazırlık yok',in_progress:'Hazırlık devam ediyor',completed:'Hazırlık tamamlandı',exempt:'Hazırlıktan muaf'};
const state = {user:null,profile:null,terms:[],courses:[],programs:[],units:[],curricula:new Map(),plans:new Map(),termId:null,page:'overview',authMode:'login',email:'',config:{},status:'all',archives:false,modalTab:'suggested',suggestions:[],suggestOffset:0,suggestQuery:'',suggestPeriod:null,searchOffset:0,searchQuery:'',searchRows:[],busy:false};
const e = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Number(value || 0).toLocaleString('tr-TR',{maximumFractionDigits:2});
const selected = (a,b) => String(a) === String(b) ? ' selected' : '';
const applicationName = () => state.config.application_name || 'HaliçMind';
const brand = () => `<a class="brand" href="#/overview"><span class="brand-mark">${icon('brand')}</span>${e(applicationName())}<span aria-hidden="true">.</span></a>`;
const initials = name => (name || 'Öğrenci').trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toLocaleUpperCase('tr-TR');
const currentTerm = () => state.terms.find(term=>term.id === state.termId);
const termLabel = term => `${term.academic_year}–${term.academic_year+1} ${termNames[term.term_type]}${term.is_preparation?' · Hazırlık':''}`;
const programName = id => state.programs.find(p=>p.id===id)?.name_tr || 'Program seçilmedi';
const activeCourses = () => state.courses.filter(course=>!course.archived_at && course.term_id===state.termId);
const pill = status => { const [label,tone] = statuses[status] || statuses.in_progress; return `<span class="pill ${tone}"><span class="dot"></span>${label}</span>`; };
const button = (action,label,kind='primary',glyph='',extra='') => `<button type="button" class="btn ${kind}" data-action="${action}" ${extra}>${glyph?icon(glyph):''}${label}</button>`;

function toast(message,error=false) {
  const item=document.createElement('div'); item.className=`toast${error?' error':''}`;
  item.innerHTML=icon(error?'info':'check'); const text=document.createElement('span'); text.textContent=message; item.append(text);
  document.querySelector('#toasts').append(item); setTimeout(()=>item.remove(),6500);
}
function formError(form,message) { const target=form.querySelector('.form-error'); if(target){target.textContent=message; target.setAttribute('role','alert');} else toast(message,true); }
function showError(error) { if(error.status!==401) toast(error.message || 'Bir sorun oluştu. Lütfen tekrar dene.',true); }
let resendUntil=0, resendTimer;
function syncResendCooldown(){
  clearInterval(resendTimer);
  const update=()=>{
    const button=root.querySelector('[data-action="resend-code"]');
    if(!button){clearInterval(resendTimer);return;}
    const seconds=Math.max(0,Math.ceil((resendUntil-Date.now())/1000));
    button.disabled=seconds>0;button.textContent=seconds?`Yeniden gönder (${seconds} sn)`:'Yeniden gönder';
    if(!seconds)clearInterval(resendTimer);
  };
  update();if(resendUntil>Date.now())resendTimer=setInterval(update,1000);
}
function closeModal(){ if(modal.open) modal.close(); modal.innerHTML=''; }
function dialog(title,subtitle,body,footer='',wide=false) {
  modal.className=wide?'wide-dialog':'';
  modal.innerHTML=`<div class="modal-head"><div><h2 id="modal-title">${e(title)}</h2>${subtitle?`<p>${e(subtitle)}</p>`:''}</div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Pencereyi kapat">${icon('close')}</button></div>${body}${footer?`<div class="modal-foot">${footer}</div>`:''}`;
  if(!modal.open) modal.showModal();
}
function loadingDialog(title) { dialog(title,'',`<div class="dialog-loading"><span class="loader"></span><p>Bilgiler hazırlanıyor…</p></div>`); }
function go(page){location.hash=`/${page}`; if(state.page===page) render();}
function sessionExpired(){
  if(!state.user) return;
  state.user=null; state.profile=null; state.terms=[]; state.courses=[]; state.termId=null; state.status='all'; state.archives=false; closeModal();
  state.authMode='login'; renderAuth(); toast('Oturumun sona erdi. Devam etmek için tekrar giriş yap.',true);
}
setUnauthorizedHandler(sessionExpired);

function renderAuth() {
  const mode=state.authMode;
  root.innerHTML=`<div class="auth-layout"><aside class="auth-story">${brand()}<div class="story-content"><div class="eyebrow">Öğrenci hayatına biraz düzen</div><h1>Derslerin bir yerde.<br><em>Aklın daha rahat.</em></h1><p>Dönemini planla, derslerini bir araya getir ve kendi akademik yolunu adım adım oluştur.</p><div class="story-art" aria-hidden="true"><div class="art-line"></div><div class="art-arch"></div><div class="art-sun"></div><div class="art-card"><div class="eyebrow">Yeni bir başlangıç</div><strong>Kendi yolunu çiz.</strong><span>Bir dönem, bir adım daha.</span></div></div></div><div class="story-foot">${icon('leaf')}Haliç Üniversitesi öğrencileri için hazırlandı.</div></aside><main class="auth-side" id="main-content"><div class="auth-card">${mode!=='verify'?`<div class="auth-tabs" role="tablist" aria-label="Hesap işlemleri"><button role="tab" aria-selected="${mode==='login'}" class="${mode==='login'?'active':''}" data-action="auth-login">Giriş yap</button><button role="tab" aria-selected="${mode==='register'}" class="${mode==='register'?'active':''}" data-action="auth-register">Hesap oluştur</button></div>`:''}${mode==='login'?loginView():mode==='register'?registerView():verifyView()}<div class="auth-privacy">${icon('lock')}Kişisel akademik alanın, yalnızca sana ait.</div></div></main></div>`;
  syncResendCooldown();
}
function loginView(){ return `<h2>Tekrar hoş geldin.</h2><p>Öğrenci hesabına giriş yap, kaldığın yerden devam et.</p><form data-form="login"><div class="field"><label for="login-email">Okul e-posta adresin</label><input id="login-email" name="email" type="email" autocomplete="username" required placeholder="ogrenci_no@ogr.halic.edu.tr" value="${e(state.email)}"></div><div class="field"><label for="login-password">Parolan</label><input id="login-password" name="password" type="password" autocomplete="current-password" required maxlength="128" placeholder="Parolanı gir"></div><div class="form-error"></div><button class="btn primary wide" type="submit">Giriş yap ${icon('arrow')}</button></form><div class="auth-bottom">E-postanı henüz doğrulamadın mı? <button class="text-btn" data-action="auth-verify">Adresimi doğrula</button></div>`; }
function registerView(){ return `<h2>Yeni bir sayfa aç.</h2><p>Okul e-postanla kaydol, akademik alanını oluşturmaya başla.</p><form data-form="register"><div class="field"><label for="register-name">Adın ve soyadın</label><input id="register-name" name="full_name" autocomplete="name" required maxlength="200" placeholder="Ad Soyad"></div><div class="field"><label for="register-email">Okul e-posta adresin</label><input id="register-email" name="email" type="email" autocomplete="username" required placeholder="ogrenci_no@ogr.halic.edu.tr" value="${e(state.email)}"><small>Yalnızca @ogr.halic.edu.tr uzantılı öğrenci adresleri.</small></div><div class="field"><label for="register-password">Bir parola belirle</label><input id="register-password" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="En az 12 karakter"><small>Başka hesaplarında kullanmadığın bir parola seç.</small></div><div class="form-error"></div><button class="btn primary wide" type="submit">Hesabımı oluştur ${icon('arrow')}</button></form>`; }
function verifyView(){return `<div class="verify-icon">${icon('mail')}</div><h2>Gelen kutuna bir bak.</h2><p>Okul adresine gönderilen tek kullanımlık kodla hesabını doğrula.</p><form data-form="verify"><div class="field"><label for="verify-email">Okul e-posta adresin</label><input id="verify-email" name="email" type="email" autocomplete="email" required value="${e(state.email)}" placeholder="ogrenci_no@ogr.halic.edu.tr"></div><div class="field"><label for="verify-token">Doğrulama kodu</label><input id="verify-token" name="token" autocomplete="one-time-code" required minlength="43" maxlength="43" spellcheck="false" placeholder="E-postadaki kodun tamamını yapıştır"><small>Kod ${Number(state.config.verification_expire_minutes) || 30} dakika geçerli ve yalnızca bir kez kullanılabilir.</small></div><div class="form-error"></div><button class="btn primary wide" type="submit">E-postamı doğrula ${icon('check')}</button></form><div class="auth-bottom">Mesaj gelmedi mi? <button class="text-btn" data-action="resend-code">Yeniden gönder</button></div><div class="auth-bottom"><button class="text-btn" data-action="auth-login">Giriş ekranına dön</button></div>${state.config.local_mailbox?`<div class="mail-note">Yerel geliştirme ortamındasın. Mesajın okul kutun yerine test posta kutusuna gelir.<br><a href="http://127.0.0.1:8025" target="_blank" rel="noopener noreferrer">Test posta kutusunu aç ${icon('arrow')}</a></div>`:''}`;}

async function loadCatalog(){
  if(state.programs.length) return;
  [state.programs,state.units]=await Promise.all([api('/catalog/programs'),api('/catalog/academic-units')]);
}
async function curriculaFor(programId){
  if(!state.curricula.has(Number(programId))) state.curricula.set(Number(programId),await api(`/catalog/curricula?program_id=${Number(programId)}`));
  return state.curricula.get(Number(programId));
}
async function planFor(curriculumId){
  if(!state.plans.has(Number(curriculumId))){
    const rows=await api(`/catalog/courses?curriculum_id=${Number(curriculumId)}&limit=1`);
    state.plans.set(Number(curriculumId),rows[0]?.period_kind || 'semester');
  }
  return state.plans.get(Number(curriculumId));
}
async function loadWorkspace(){
  await loadCatalog();
  const results=await Promise.all([api('/users/me/academic-profile').catch(error=>{if(error.status===404)return null;throw error;}),allPages('/terms'),allPages('/enrollments?include_archived=true')]);
  [state.profile,state.terms,state.courses]=results;
  if(!state.terms.some(term=>term.id===state.termId)) state.termId=state.terms[0]?.id || null;
  if(state.profile) await curriculaFor(state.profile.program_id);
}
async function refreshCourses(){state.courses=await allPages('/enrollments?include_archived=true');}
function navLink(page,label,glyph,count='') {return `<a class="nav-link ${state.page===page?'active':''}" href="#/${page}" ${state.page===page?'aria-current="page"':''}>${icon(glyph)}${label}${count!==''?`<span class="nav-count">${count}</span>`:''}</a>`;}
function render(){
  if(!state.user) return renderAuth();
  const requested=location.hash.replace(/^#\//,'');
  state.page=state.profile && ['overview','courses','history','profile'].includes(requested)?requested:state.profile?'overview':'profile';
  const labels={overview:'Genel bakış',courses:'Derslerim',history:'Geçmiş dönemler',profile:'Akademik profil'};
  root.innerHTML=`<div class="workspace"><div class="mobile-backdrop" data-action="toggle-menu"></div><aside class="sidebar">${brand()}<div class="side-label">ÖĞRENCİ ALANI</div><nav class="side-nav" aria-label="Ana gezinme">${navLink('overview','Genel bakış','grid')}${navLink('courses','Derslerim','book',activeCourses().length)}${navLink('history','Geçmiş dönemler','history')}${navLink('profile','Akademik profil','user')}</nav><div class="side-note">${icon('leaf')}<h3>Her dönem yeni bir adım.</h3><p>Geçmişini tek seferde doldurmak zorunda değilsin. Bugünden başlayabilirsin.</p></div><div class="side-user"><span class="avatar">${e(initials(state.user.full_name))}</span><div><div class="side-user-name">${e(state.user.full_name)}</div><div class="side-user-role">Öğrenci hesabı</div></div><button data-action="logout" title="Çıkış yap" aria-label="Çıkış yap">${icon('logout')}</button></div></aside><header class="topbar"><button class="icon-btn mobile-menu" data-action="toggle-menu" aria-label="Menüyü aç" aria-expanded="false">${icon('menu')}</button><div class="breadcrumb"><span class="desktop-crumb">Öğrenci alanı</span><span class="mobile-brand">${e(applicationName())}</span>${icon('chevron')}<span>${labels[state.page]}</span></div><div class="topbar-right"><span class="topbar-date">${e(new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'}).format(new Date()))}</span><span class="verified-label">${icon('shield')}Doğrulanmış hesap</span><span class="avatar">${e(initials(state.user.full_name))}</span></div></header><main class="page" id="main-content" tabindex="-1">${state.page==='overview'?overviewView():state.page==='courses'?coursesView():state.page==='history'?historyView():profileView()}</main></div>`;
  if(state.page==='profile') hydrateProfileForm().catch(showError);
}
function termPicker(){return `<div class="term-picker"><select aria-label="Aktif dönem" data-change="active-term">${state.terms.length?state.terms.map(term=>`<option value="${term.id}"${selected(term.id,state.termId)}>${e(termLabel(term))}</option>`).join(''):'<option value="">Henüz dönem yok</option>'}</select><button class="icon-btn" data-action="new-term" title="Yeni dönem oluştur" aria-label="Yeni dönem oluştur">${icon('plus')}</button>${state.termId?`<button class="icon-btn" data-action="edit-term" title="Dönemi düzenle" aria-label="Dönemi düzenle">${icon('edit')}</button>`:''}</div>`;}
function emptyState(title,description,action,label,compact=false,glyph='book'){return `<div class="empty-state ${compact?'compact':''}"><div class="empty-icon">${icon(glyph)}</div><h3>${e(title)}</h3><p>${e(description)}</p>${action?button(action,label,'primary','plus'):''}</div>`;}
function courseIcon(course,index){return `<div class="course-icon tone-${index%4}" aria-hidden="true">${e(course.course_code.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g,'').slice(0,2).toLocaleUpperCase('tr-TR') || 'D')}</div>`;}
function miniCourse(course,index){return `<div class="course-mini">${courseIcon(course,index)}<div class="mini-main"><h3>${e(course.course_name)}</h3><p>${e(course.course_code)}${course.course_id===null?' · Kişisel ders':''}</p></div><div class="mini-end"><span class="credits">${course.ects===null?'AKTS belirtilmedi':`${number(course.ects)} AKTS`}</span>${pill(course.status)}</div></div>`;}
function overviewView(){
  const courses=activeCourses(), completed=courses.filter(course=>['passed','exempt'].includes(course.status)).length;
  const term=currentTerm();
  return `<div class="page-title"><div><h1>Merhaba, ${e(state.user.full_name.split(' ')[0])}.</h1><p>Akademik yolculuğuna bugün nereden devam etmek istersin?</p></div>${termPicker()}</div><section class="welcome-banner"><div><span class="eyebrow">${term?e(termLabel(term)):'Yeni bir dönem, yeni bir başlangıç'}</span><h2>${courses.length?'Dönemine bir bütün olarak bak.':'Küçük bir plan, daha ferah bir zihin.'}</h2><p>${courses.length?'Derslerin ve akademik geçmişin aynı yerde. Her adımı kendi hızında tamamla.':'Aldığın dersleri ekleyerek başla. Önceki dönemlerini daha sonra da tamamlayabilirsin.'}</p></div><div class="banner-symbol" aria-hidden="true">${icon('book')}</div></section><div class="stats-grid"><div class="stat-card"><div class="stat-label">Bu dönemki derslerin</div><span class="stat-icon">${icon('book')}</span><div class="stat-value">${courses.length}</div><div class="stat-sub">Kişisel ders listende</div></div><div class="stat-card"><div class="stat-label">Toplam AKTS</div><span class="stat-icon">${icon('chart')}</span><div class="stat-value">${number(courses.reduce((sum,course)=>sum+Number(course.ects || 0),0))}</div><div class="stat-sub">AKTS bilgisi olan derslerden</div></div><div class="stat-card"><div class="stat-label">Tamamlanan dersler</div><span class="stat-icon">${icon('check')}</span><div class="stat-value">${completed}<span class="muted"> / ${courses.length}</span></div><div class="stat-sub">Başarılı veya muaf olduğun</div></div></div><div class="dashboard-grid"><section><div class="section-head"><div><h2>Dönemindeki dersler</h2><p>${term?'Bir sonraki adımın burada başlıyor.':'Başlamak için kişisel bir dönem oluştur.'}</p></div>${courses.length?`<a href="#/courses" class="text-btn">Tümünü gör ${icon('arrow')}</a>`:''}</div><div class="panel">${courses.length?courses.slice(0,5).map(miniCourse).join(''):emptyState(term?'Derslerine yer açalım.':'İlk dönemini oluşturalım.',term?'Bölümüne uygun dersleri katalogdan seçebilir veya kendi dersini ekleyebilirsin.':'Güz, Bahar, Yaz ya da yıllık dönemini ekle. Derslerini bu dönemde bir araya getireceğiz.',term?'add-course':'new-term',term?'İlk dersini ekle':'Dönem oluştur',true)}</div>${courses.length?`<div class="inline-actions">${button('add-course','Ders ekle','ghost','plus')}</div>`:''}</section><aside><div class="section-head"><div><h2>Akademik pusulan</h2><p>Yolculuğunun başlangıç noktası.</p></div></div><div class="panel panel-padding profile-summary"><div class="eyebrow">${e(state.units.find(unit=>unit.id===state.programs.find(p=>p.id===state.profile.program_id)?.academic_unit_id)?.name_tr || 'Akademik profil')}</div><h3>${e(programName(state.profile.program_id))}</h3><p>${state.profile.current_class===0?'Hazırlık öğrencisi':`${state.profile.current_class}. sınıf öğrencisi`}</p><div class="profile-facts"><div><span>Giriş yılı</span><strong>${state.profile.entry_year}</strong></div><div><span>Hazırlık</span><strong>${e(prepNames[state.profile.preparation_status].replace('Hazırlık ',''))}</strong></div><div><span>Kayıtlı dönem</span><strong>${state.terms.length} dönem</strong></div></div><a class="btn light wide" href="#/profile">Profilimi düzenle ${icon('arrow')}</a></div></aside></div><p class="bottom-caption">Her öğrencinin yolu farklı. Bu alan, senin yoluna eşlik etmek için burada.</p>`;
}
function coursesView(){
  const term=currentTerm();
  const courses=state.courses.filter(course=>course.term_id===state.termId && (state.archives || !course.archived_at) && (state.status==='all' || course.status===state.status));
  return `<div class="page-title"><div><h1>Derslerim</h1><p>Derslerini bir araya getir, sonuçlarını kendi hızında güncelle.</p></div>${button(term?'add-course':'new-term',term?'Ders ekle':'Dönem oluştur','primary','plus')}</div><div class="toolbar">${termPicker()}<label class="check-line muted"><input type="checkbox" data-change="show-archives" ${state.archives?'checked':''}> Arşivlenenleri göster</label></div><div class="toolbar"><div class="filter-tabs" aria-label="Ders durumuna göre filtrele"><button data-action="course-filter" data-status="all" class="${state.status==='all'?'active':''}">Tümü</button>${Object.entries(statuses).map(([key,[label]])=>`<button data-action="course-filter" data-status="${key}" class="${state.status===key?'active':''}">${label}</button>`).join('')}</div></div>${!term?`<div class="panel">${emptyState('Derslerinin bir döneme ihtiyacı var.','Önce bir dönem oluştur. Güncel ya da geçmiş bir dönemden başlayabilirsin.','new-term','İlk dönemimi oluştur')}</div>`:courses.length?`<div class="courses-grid">${courses.map((course,index)=>`<article class="course-card ${course.archived_at?'archived':''}"><div class="course-card-top">${courseIcon(course,index)}${course.archived_at?'<span class="pill gray">Arşivlendi</span>':pill(course.status)}</div><div><h3>${e(course.course_name)}</h3><div class="course-meta"><span>${e(course.course_code)}</span><span>·</span><span>${course.ects===null?'AKTS belirtilmedi':`${number(course.ects)} AKTS`}</span>${course.course_id===null?'<span>· Kişisel ders</span>':''}</div></div><div class="course-card-footer"><span class="grade-label">${course.grade?`Not: <strong>${e(course.grade)}</strong>`:'Not eklenmedi'}</span><div class="card-actions">${course.archived_at?button('restore-course','Geri yükle','light small','restore',`data-id="${course.id}"`):`<button class="icon-btn" data-action="edit-course" data-id="${course.id}" aria-label="${e(course.course_code)} dersini düzenle" title="Sonuç ve notu düzenle">${icon('edit')}</button><button class="icon-btn" data-action="archive-course" data-id="${course.id}" aria-label="${e(course.course_code)} dersini arşivle" title="Dersi arşivle">${icon('archive')}</button>`}</div></div></article>`).join('')}</div>`:`<div class="panel">${emptyState(state.status==='all'?'Bu dönemde henüz ders yok.':'Bu filtrede bir ders bulunamadı.',state.status==='all'?(term.is_preparation?'Hazırlık dersini kendin ekleyebilirsin. Bölüm müfredatı hazırlıktan ayrı tutulur.':'Ders önerilerine göz atabilir, katalogdan seçebilir veya kişisel dersini ekleyebilirsin.'):'Başka bir durum seçebilir veya dönemindeki tüm derslere dönebilirsin.',state.status==='all'?'add-course':'clear-filter',state.status==='all'?'Ders ekle':'Tüm dersleri göster')}</div>`}`;
}
function historyView(){return `<div class="page-title"><div><h1>Geçmiş dönemler</h1><p>Her dönem, akademik yolculuğunun bir parçası.</p></div>${button('new-term','Dönem ekle','primary','plus')}</div><div class="notice">${icon('info')}<p>Geçmiş derslerini doldurmak isteğe bağlı. İstediğin dönemden başlayabilir, bilgilerini daha sonra tamamlayabilirsin.</p></div>${state.terms.length?state.terms.map(term=>{const courses=state.courses.filter(course=>course.term_id===term.id&&!course.archived_at);return `<section class="history-term"><div class="row spread"><div><h3>${e(termLabel(term))}</h3><div class="term-summary">${e(programName(term.program_id))} · ${courses.length} ders</div></div>${button('view-term','Dersleri aç','light small','arrow',`data-id="${term.id}"`)}</div>${courses.length?courses.slice(0,3).map(miniCourse).join(''):`<p class="check-note">Bu dönemin derslerini henüz girmedin. Dönemi açıp ekleyebilirsin.</p>`}</section>`;}).join(''):`<div class="panel">${emptyState('Akademik hikâyen burada birikecek.','Geçmişte aldığın dersleri kaydetmek için bir dönem ekleyebilirsin.','new-term','Dönem ekle',false,'history')}</div>`}`;}

function programOptions(value,unit='',query=''){
  return '<option value="">Bölümünü seç</option>'+state.programs.filter(p=>(!unit || p.academic_unit_id===Number(unit)) && (!query || p.name_tr.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR')))).map(p=>`<option value="${p.id}"${selected(p.id,value)}>${e(p.name_tr)}</option>`).join('');
}
function curriculumOptions(rows,value){return '<option value="">Müfredatını seç</option>'+rows.map(c=>`<option value="${c.id}"${selected(c.id,value)}>${e(c.entry_year?`${c.entry_year} girişliler · ${c.label}`:c.label)}</option>`).join('');}
function profileView(){
  const profile=state.profile;
  const program=state.programs.find(p=>p.id===profile?.program_id);
  return `<div class="${profile?'profile-page':'onboarding'}">${profile?`<div class="page-title"><div><h1>Akademik profil</h1><p>Önerilerini sana uygun hâle getiren bilgiler.</p></div></div>`:`<span class="step-tag">İlk adım · Seni tanıyalım</span><h1>Akademik yolculuğun nereden başlıyor?</h1><p>Bölümünü ve sınıfını seç. Sana uygun dersleri bulalım. Geçmiş dönemlerini daha sonra ekleyebilirsin.</p>`}<div class="panel panel-padding"><div class="profile-intro"><h2>${profile?'Sana ait bir başlangıç noktası.':'Birkaç bilgiyle başlayalım.'}</h2><p>Bilgilerini daha sonra güncelleyebilirsin. Bölüm değişikliği geçmiş dönemlerini ve derslerini etkilemez.</p></div><form data-form="profile" class="form-grid"><div class="field full"><label for="profile-unit">Fakülte / akademik birim</label><select id="profile-unit" name="academic_unit_id" data-change="profile-unit"><option value="">Tüm akademik birimler</option>${state.units.map(unit=>`<option value="${unit.id}"${selected(unit.id,program?.academic_unit_id)}>${e(unit.name_tr)}</option>`).join('')}</select></div><div class="field full"><label for="profile-search">Bölümünü bul</label><input id="profile-search" type="search" name="program_search" placeholder="Bölüm adını yaz…" autocomplete="off" data-input="program-search"></div><div class="field full"><label for="profile-program">Bölüm / program</label><select id="profile-program" name="program_id" required data-change="profile-program">${programOptions(profile?.program_id,program?.academic_unit_id)}</select></div><div class="field full"><label for="profile-curriculum">Müfredat / ders planı</label><select id="profile-curriculum" name="curriculum_id" required data-change="profile-curriculum"><option value="">Önce bölümünü seç</option></select><small>Müfredat yılı kaynakta belirtilmemiş olabilir. Uygun ders planını seç; giriş yılın ayrı tutulur.</small></div><div class="form-section-title">Öğrenim bilgilerin</div><div class="field"><label for="profile-year">Üniversiteye giriş yılın</label><input id="profile-year" name="entry_year" type="number" min="1900" max="${new Date().getFullYear()+1}" required placeholder="Örn. 2023" value="${profile?.entry_year || ''}"></div><div class="field"><label for="profile-preparation">Hazırlık durumun</label><select id="profile-preparation" name="preparation_status" data-change="profile-preparation">${Object.entries(prepNames).map(([key,label])=>`<option value="${key}"${selected(key,profile?.preparation_status || 'not_required')}>${label}</option>`).join('')}</select></div><div class="field"><label for="profile-class">Şu anki sınıfın</label><select id="profile-class" name="current_class" required><option value="1">1. sınıf</option></select><small>Hazırlık, bölümün birinci sınıfından ayrı tutulur.</small></div><div class="field"><label>Okul e-postan</label><input value="${e(state.user.email)}" disabled aria-label="Kayıtlı okul e-postası"><small>Doğrulanmış öğrenci hesabın.</small></div><div class="form-error full"></div><div class="profile-actions"><button type="submit" class="btn primary">${profile?'Değişiklikleri kaydet':'Profilimi oluştur ve devam et'} ${icon('arrow')}</button></div></form></div></div>`;
}
async function hydrateProfileForm(){
  const form=root.querySelector('[data-form="profile"]'); if(!form) return;
  if(state.profile){await fillCurricula(form,state.profile.program_id,state.profile.curriculum_id);updateClass(form,state.profile.current_class);}
}
async function fillCurricula(form,programId,curriculumId=null){
  const select=form.elements.curriculum_id;
  select.innerHTML='<option value="">Yükleniyor…</option>'; select.disabled=true;
  if(!programId){select.innerHTML='<option value="">Önce bölümünü seç</option>';select.disabled=false;return;}
  const rows=await curriculaFor(programId);
  if(!form.isConnected || Number(form.elements.program_id.value)!==Number(programId)) return;
  select.innerHTML=curriculumOptions(rows,curriculumId || (rows.length===1?rows[0].id:null));select.disabled=false;
  if(form.dataset.form==='profile') updateClass(form,state.profile?.current_class);
  else await updateTermPlan(form);
}
function updateClass(form,preferred){
  const rows=state.curricula.get(Number(form.elements.program_id.value)) || [];
  const cu=rows.find(c=>c.id===Number(form.elements.curriculum_id.value));
  const prep=form.elements.preparation_status.value==='in_progress';
  const current=preferred ?? Number(form.elements.current_class.value || 1);
  form.elements.current_class.innerHTML=prep?'<option value="0">Hazırlık</option>':Array.from({length:Math.ceil((cu?.semester_count || 8)/2)},(_,i)=>`<option value="${i+1}"${selected(i+1,current)}>${i+1}. sınıf</option>`).join('');
}

async function openTermDialog(edit=false){
  if(!state.profile) return go('profile');
  const existing=edit?currentTerm():null;
  loadingDialog(edit?'Dönemini düzenle':'Yeni bir dönem oluştur');
  const programId=existing?.program_id || state.profile.program_id;
  const curricula=await curriculaFor(programId);
  const curriculumId=existing?.curriculum_id || state.profile.curriculum_id;
  const kind=await planFor(curriculumId);
  if(!modal.open)return;
  const date=new Date(), month=Number(new Intl.DateTimeFormat('en-US',{month:'numeric',timeZone:'Europe/Istanbul'}).format(date));
  const year=date.getFullYear()-(month<9?1:0);
  const type=existing?.term_type || (kind==='year'?'annual':month>=9?'fall':month>=6?'summer':'spring');
  const prep=existing?.is_preparation ?? state.profile.preparation_status==='in_progress';
  dialog(edit?'Dönemini düzenle':'Bir döneme yer aç.',edit?'Takvim ve müfredat dönemi birbirinden bağımsızdır.':'Bugünden başlayabilir veya geçmiş bir dönemini ekleyebilirsin.',`<form data-form="term" data-id="${existing?.id || ''}"><div class="modal-body form-grid"><div class="field"><label for="term-year">Akademik yılın başlangıcı</label><input id="term-year" name="academic_year" type="number" min="1900" max="${date.getFullYear()+1}" value="${existing?.academic_year || year}" required><small>2026 yazarsan 2026–2027 yılı oluşturulur.</small></div><div class="field"><label for="term-type">Takvim dönemi</label><select id="term-type" name="term_type">${Object.entries(termNames).map(([key,label])=>`<option value="${key}"${selected(key,type)}>${label}</option>`).join('')}</select></div><label class="check-line full"><input type="checkbox" name="is_preparation" data-change="term-preparation" ${prep?'checked':''} ${edit?'disabled':''}> Bu bir hazırlık dönemi</label><div class="field full"><label for="term-program">Dönemin bölümü</label><select id="term-program" name="program_id" data-change="term-program" required ${edit?'disabled':''}>${programOptions(programId)}</select><small>${edit?'Geçmişi korumak için dönemin bölümü değiştirilmez.':'Geçmişte başka bir bölümde okuduysan o dönemin bölümünü seçebilirsin.'}</small></div><div class="field full"><label for="term-curriculum">Dönemin müfredatı</label><select id="term-curriculum" name="curriculum_id" data-change="term-curriculum" required ${edit?'disabled':''}>${curriculumOptions(curricula,curriculumId)}</select></div><div class="field full"><label for="term-period">Önce hangi müfredat dönemini görmek istersin?</label><select id="term-period" name="curriculum_period_number"></select><small>Bu yalnızca ders önerilerinin başlangıç noktasıdır. Başka dönemlerden de ders ekleyebilirsin.</small></div><div class="form-error full"></div></div><div class="modal-foot">${existing?button('delete-term','Boş dönemi sil','ghost','',`data-id="${existing.id}"`):''}${button('close-modal','Vazgeç','light')}<button type="submit" class="btn primary">${edit?'Kaydet':'Dönemi oluştur'} ${icon('arrow')}</button></div></form>`);
  const form=modal.querySelector('form'); form.dataset.periodKind=kind;
  populateTermPeriods(form,existing?.curriculum_period_number ?? (kind==='year'?state.profile.current_class:(Math.max(1,state.profile.current_class)-1)*2+(type==='spring'?2:1)));
}
function populateTermPeriods(form,value){
  const rows=state.curricula.get(Number(form.elements.program_id.value)) || [];
  const cu=rows.find(c=>c.id===Number(form.elements.curriculum_id.value));
  const kind=form.dataset.periodKind || 'semester', maximum=kind==='year'?Math.ceil((cu?.semester_count || 2)/2):(cu?.semester_count || 8);
  const select=form.elements.curriculum_period_number;
  const prep=form.elements.is_preparation.checked;
  select.disabled=prep;
  select.innerHTML=prep?'<option value="">Hazırlık bölüm müfredatından ayrıdır</option>':'<option value="">Daha sonra seçerim</option>'+Array.from({length:maximum},(_,i)=>`<option value="${i+1}"${selected(i+1,value)}>${i+1}. ${kind==='year'?'yıl':'dönem'}</option>`).join('');
}
async function updateTermPlan(form){
  const id=Number(form.elements.curriculum_id.value); if(!id)return;
  form.dataset.periodKind=await planFor(id);
  if(!form.isConnected)return;
  populateTermPeriods(form,1);
  if(form.dataset.periodKind==='year') form.elements.term_type.value='annual';
}

async function openCourseDialog(){
  const term=currentTerm(); if(!term)return openTermDialog();
  state.modalTab=term.is_preparation?'custom':'suggested';state.suggestOffset=0;state.suggestQuery='';state.searchOffset=0;state.searchQuery='';state.searchRows=[];
  const rows=await curriculaFor(term.program_id); const kind=await planFor(term.curriculum_id);
  const maximum=rows.find(c=>c.id===term.curriculum_id)?.semester_count || 8;
  state.suggestKind=kind;state.suggestMax=kind==='year'?Math.ceil(maximum/2):maximum;
  state.suggestPeriod=term.curriculum_period_number || 1;
  drawCourseDialog(); if(state.modalTab==='suggested') await fetchSuggestions();
}
function drawCourseDialog(){
  const term=currentTerm(); if(!term)return;
  const tabs=term.is_preparation?['custom']:['suggested','catalog','custom'];
  const names={suggested:'Önerilen dersler',catalog:'Katalogda ara',custom:'Kişisel ders ekle'};
  const content=state.modalTab==='custom'?customCourseForm():`<div class="modal-body">${state.modalTab==='suggested'?`<div class="period-select">Önerilen müfredat dönemi<select aria-label="Öneriler için müfredat dönemi" data-change="suggest-period">${Array.from({length:state.suggestMax},(_,i)=>`<option value="${i+1}"${selected(i+1,state.suggestPeriod)}>${i+1}. ${state.suggestKind==='year'?'yıl':'dönem'}</option>`).join('')}</select></div>`:''}<form data-form="course-search" class="modal-search"><div class="search-wrapper">${icon('search')}<input class="search-input" name="query" type="search" placeholder="Ders adı veya koduyla ara…" aria-label="Ders adı veya kodu" value="${e(state.modalTab==='suggested'?state.suggestQuery:state.searchQuery)}"></div><button class="btn light small" type="submit">Ara</button></form><div id="course-results"><div class="dialog-loading"><span class="loader"></span><p>Dersler yükleniyor…</p></div></div></div>`;
  dialog('Derslerine bir yenisini ekle.',`${termLabel(term)} · ${programName(term.program_id)}`,`<div class="modal-tabs" role="tablist" aria-label="Ders ekleme yöntemi">${tabs.map(tab=>`<button role="tab" aria-selected="${tab===state.modalTab}" class="${tab===state.modalTab?'active':''}" data-action="course-tab" data-tab="${tab}">${names[tab]}</button>`).join('')}</div>${content}`,'',true);
}
function customCourseForm(){return `<form data-form="custom-course"><div class="modal-body form-grid"><div class="field"><label for="custom-code">Ders kodu</label><input id="custom-code" name="custom_course_code" required maxlength="100" placeholder="Örn. HAZ101"></div><div class="field"><label for="custom-ects">AKTS <span class="muted">· İsteğe bağlı</span></label><input id="custom-ects" name="custom_ects" type="number" min="0" max="120" step="0.01" placeholder="Örn. 3"></div><div class="field full"><label for="custom-name">Ders adı</label><input id="custom-name" name="custom_course_name" required maxlength="500" placeholder="Dersin tam adı"></div>${resultFields()}<p class="check-note full">Bu ders yalnızca senin listene eklenir. Ortak ders kataloğunu değiştirmez.</p><div class="form-error full"></div></div><div class="modal-foot">${button('close-modal','Vazgeç','light')}<button type="submit" class="btn primary">Dersi ekle ${icon('plus')}</button></div></form>`;}
function resultFields(course={status:'in_progress',grade:null}){return `<div class="field"><label for="course-status">Dersin durumu</label><select id="course-status" name="status">${Object.entries(statuses).map(([key,[label]])=>`<option value="${key}"${selected(key,course.status)}>${label}</option>`).join('')}</select></div><div class="field"><label for="course-grade">Notun <span class="muted">· İsteğe bağlı</span></label><input id="course-grade" name="grade" maxlength="20" placeholder="Örn. AA, BA, 85" value="${e(course.grade)}"><small>Notun otomatik olarak başarı durumunu değiştirmez.</small></div>`;}
let requestCounter=0;
async function fetchSuggestions(){
  const request=++requestCounter, term=currentTerm(), tab=state.modalTab;
  const isSuggested=tab==='suggested';
  const params=new URLSearchParams(isSuggested?{period_kind:state.suggestKind,period_number:state.suggestPeriod,q:state.suggestQuery,limit:50,offset:state.suggestOffset}:{curriculum_id:term.curriculum_id,q:state.searchQuery,limit:50,offset:state.searchOffset});
  try{
    const result=await api(isSuggested?`/terms/${term.id}/suggestions?${params}`:`/catalog/courses?${params}`);
    if(request!==requestCounter || !modal.open || state.modalTab!==tab)return;
    if(isSuggested){state.suggestions=result.courses;state.suggestGroups=result.elective_groups;state.suggestCoverage=result.coverage_status;}
    else state.searchRows=result;
    drawSuggestionResults();
  }catch(error){if(request!==requestCounter)return;const target=modal.querySelector('#course-results');if(target){target.innerHTML=`<div class="notice">${icon('info')}<p>${e(error.message)}</p></div>`;}else showError(error);}
}
function drawSuggestionResults(){
  const target=modal.querySelector('#course-results');if(!target)return;
  const suggested=state.modalTab==='suggested', source=suggested?state.suggestions:state.searchRows;
  const rows=[...new Map(source.map(row=>[row.course_revision_id,row])).values()];
  const active=activeCourses();
  target.innerHTML=`${suggested && state.suggestCoverage!=='complete'?`<p class="check-note">Öneriler mevcut katalog bilgileriyle sınırlı. Eksik bir dersi kişisel olarak ekleyebilirsin.</p>`:''}${suggested && state.suggestGroups?.length?`<div class="chip-list">${state.suggestGroups.map(group=>`<span class="pill gray">${e(group.name)}${group.required_course_count!==null?` · ${group.required_course_count} ders`:''}</span>`).join('')}</div>`:''}${rows.length?rows.map((row,index)=>{const added=active.some(course=>course.course_revision_id===row.course_revision_id || (row.course_id && course.course_id===row.course_id));return `<div class="suggestion-row">${courseIcon(row,index)}<div class="suggestion-main"><h3>${e(row.course_name)}</h3><p>${row.course_type?`<span class="pill ${row.course_type==='required'?'green':'gray'}">${row.course_type==='required'?'Zorunlu':'Seçmeli'}</span>`:''}${e(row.course_code)} · ${row.ects===null?'AKTS belirtilmedi':`${number(row.ects)} AKTS`}${row.period_number?` · ${row.period_number}. ${row.period_kind==='year'?'yıl':'dönem'}`:''}</p></div>${added?`<span class="suggestion-added">${icon('check')}Eklendi</span>`:button('enroll-catalog','Ekle','light small','plus',`data-id="${row.course_revision_id}"`)}</div>`;}).join(''):emptyState('Bu aramada bir ders bulunamadı.','Başka bir ders adı veya müfredat dönemi deneyebilir, kişisel ders ekleyebilirsin.','custom-tab','Kişisel ders ekle',true)}<div class="load-more">${(suggested?state.suggestOffset:state.searchOffset)>0?button('previous-results','Önceki','ghost small'):''}${source.length===50?button('more-results','Sonraki dersler','light small','arrow'):''}</div>`;
}
function editCourseDialog(id){
  const course=state.courses.find(row=>row.id===id);if(!course)return;
  const custom=course.course_id===null;
  dialog('Ders bilgilerini güncelle.',`${course.course_code} · ${course.course_name}`,`<form data-form="edit-course" data-id="${id}"><div class="modal-body form-grid">${custom?`<div class="field"><label for="edit-code">Ders kodu</label><input id="edit-code" name="custom_course_code" required maxlength="100" value="${e(course.course_code)}"></div><div class="field"><label for="edit-ects">AKTS</label><input id="edit-ects" name="custom_ects" type="number" min="0" max="120" step="0.01" value="${e(course.ects)}"></div><div class="field full"><label for="edit-name">Ders adı</label><input id="edit-name" name="custom_course_name" required maxlength="500" value="${e(course.course_name)}"></div>`:''}${resultFields(course)}<div class="form-error full"></div></div><div class="modal-foot">${button('close-modal','Vazgeç','light')}<button class="btn primary" type="submit">Değişiklikleri kaydet ${icon('check')}</button></div></form>`);
}
function confirmArchive(id){
  const course=state.courses.find(row=>row.id===id);if(!course)return;
  dialog('Bu dersi arşivleyelim mi?',course.course_name,`<div class="modal-body"><p class="check-note">Ders aktif listenden gizlenir. Sonucun ve notun korunur; arşivlenenleri göstererek istediğin zaman geri yükleyebilirsin.</p></div>`,`${button('close-modal','Vazgeç','light')}${button('confirm-archive','Dersi arşivle','primary','archive',`data-id="${id}"`)}`);
}

async function submitForm(form){
  const data=Object.fromEntries(new FormData(form)), type=form.dataset.form;
  if(type==='profile' && form.elements.curriculum_id.disabled){formError(form,'Müfredat bilgisi yükleniyor. Biraz bekleyip tekrar dene.');return;}
  const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
  const error=form.querySelector('.form-error');if(error)error.textContent='';
  try{
    if(type==='login'){
      state.email=data.email.trim().toLowerCase();
      try{await api('/auth/login',{method:'POST',form:true,body:{username:state.email,password:data.password},quiet401:true});}
      catch(error){if(error.status===403){state.authMode='verify';renderAuth();toast('Giriş yapmadan önce okul adresini doğrula.',true);return;}throw error;}
      state.user=await api('/users/me');await loadWorkspace();location.hash=state.profile?'/overview':'/profile';render();toast('Hoş geldin. Kaldığın yerden devam edebilirsin.');
    }else if(type==='register'){
      state.email=data.email.trim().toLowerCase();
      try{await api('/auth/register',{method:'POST',body:{email:state.email,full_name:data.full_name,password:data.password},quiet401:true});}
      catch(error){if(error.status===503){resendUntil=Date.now()+60_000;state.authMode='verify';renderAuth();toast(error.message,true);return;}throw error;}
      resendUntil=Date.now()+60_000;state.authMode='verify';renderAuth();toast('Hesabın oluşturuldu. Şimdi e-posta adresini doğrula.');
    }else if(type==='verify'){
      state.email=data.email.trim().toLowerCase();
      await api('/auth/verify-email',{method:'POST',body:{token:data.token.trim()},quiet401:true});
      state.authMode='login';renderAuth();toast('E-posta adresin doğrulandı. Giriş yapabilirsin.');
    }else if(type==='profile'){
      const first=!state.profile;
      state.profile=await api('/users/me/academic-profile',{method:'PUT',body:{program_id:Number(data.program_id),curriculum_id:Number(data.curriculum_id),entry_year:Number(data.entry_year),preparation_status:data.preparation_status,current_class:Number(data.current_class)}});
      if(first)location.hash='/overview';render();toast(first?'Profilin hazır. İlk dönemini oluşturarak devam edebilirsin.':'Akademik profilin güncellendi.');
    }else if(type==='term'){
      const editing=Boolean(form.dataset.id), prep=form.elements.is_preparation.checked;
      const body={academic_year:Number(data.academic_year),term_type:data.term_type,curriculum_period_kind:prep || !data.curriculum_period_number?null:form.dataset.periodKind,curriculum_period_number:prep || !data.curriculum_period_number?null:Number(data.curriculum_period_number)};
      if(!editing)Object.assign(body,{is_preparation:prep,program_id:Number(data.program_id),curriculum_id:Number(data.curriculum_id)});
      const term=await api(editing?`/terms/${form.dataset.id}`:'/terms',{method:editing?'PATCH':'POST',body});
      state.terms=await allPages('/terms');state.termId=term.id;closeModal();render();toast(editing?'Dönemin güncellendi.':'Dönemin hazır. Şimdi derslerini ekleyebilirsin.');
    }else if(type==='custom-course' || type==='edit-course'){
      const editing=type==='edit-course';
      const body={status:data.status,grade:data.grade.trim() || null};
      if('custom_course_code' in data)Object.assign(body,{custom_course_code:data.custom_course_code.trim(),custom_course_name:data.custom_course_name.trim(),custom_ects:data.custom_ects===''?null:data.custom_ects});
      if(!editing)body.term_id=state.termId;
      await api(editing?`/enrollments/${form.dataset.id}`:'/enrollments',{method:editing?'PATCH':'POST',body});
      await refreshCourses();closeModal();render();toast(editing?'Ders bilgilerin güncellendi.':'Kişisel dersin listeye eklendi.');
    }else if(type==='course-search'){
      if(state.modalTab==='suggested'){state.suggestQuery=data.query.trim();state.suggestOffset=0;}else{state.searchQuery=data.query.trim();state.searchOffset=0;}
      await fetchSuggestions();
    }
  }catch(error){formError(form,error.message || 'İşlem tamamlanamadı.');}
  finally{if(submit)submit.disabled=false;}
}

document.addEventListener('submit',event=>{const form=event.target.closest('form[data-form]');if(form){event.preventDefault();submitForm(form);}});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target || target.disabled)return;
  const action=target.dataset.action, id=Number(target.dataset.id);
  try{
    if(action.startsWith('auth-')){state.email=root.querySelector('input[name="email"]')?.value || state.email;state.authMode=action.slice(5);renderAuth();}
    else if(action==='resend-code'){
      const email=root.querySelector('#verify-email');if(!email.reportValidity())return;
      target.disabled=true;await api('/auth/resend-verification',{method:'POST',body:{email:email.value.trim().toLowerCase()},quiet401:true});resendUntil=Date.now()+60_000;syncResendCooldown();toast('Uygun bir hesap varsa doğrulama mesajı gönderildi.');
    }else if(action==='logout'){
      await api('/auth/logout',{method:'POST',quiet401:true});state.user=null;state.profile=null;state.courses=[];state.terms=[];state.termId=null;state.status='all';state.archives=false;state.authMode='login';closeModal();renderAuth();toast('Güvenli şekilde çıkış yaptın.');
    }else if(action==='toggle-menu'){
      const workspace=root.querySelector('.workspace');workspace?.classList.toggle('menu-open');const open=workspace?.classList.contains('menu-open');root.querySelector('.mobile-menu')?.setAttribute('aria-expanded',String(open));if(open)root.querySelector('.nav-link')?.focus();else root.querySelector('.mobile-menu')?.focus();
    }else if(action==='close-modal')closeModal();
    else if(action==='new-term')await openTermDialog();
    else if(action==='edit-term')await openTermDialog(true);
    else if(action==='add-course')await openCourseDialog();
    else if(action==='edit-course')editCourseDialog(id);
    else if(action==='archive-course')confirmArchive(id);
    else if(action==='confirm-archive'){
      target.disabled=true;await api(`/enrollments/${id}`,{method:'DELETE'});await refreshCourses();closeModal();render();toast('Ders arşivlendi. İstediğin zaman geri yükleyebilirsin.');
    }else if(action==='restore-course'){
      target.disabled=true;await api(`/enrollments/${id}/restore`,{method:'POST'});await refreshCourses();render();toast('Ders yeniden aktif listende.');
    }else if(action==='course-filter'){state.status=target.dataset.status;render();}
    else if(action==='clear-filter'){state.status='all';render();}
    else if(action==='view-term'){state.termId=id;state.status='all';go('courses');}
    else if(action==='course-tab' || action==='custom-tab'){
      ++requestCounter;state.modalTab=action==='custom-tab'?'custom':target.dataset.tab;drawCourseDialog();if(state.modalTab!=='custom')await fetchSuggestions();
    }else if(action==='enroll-catalog'){
      target.disabled=true;await api('/enrollments',{method:'POST',body:{term_id:state.termId,course_revision_id:id,status:'in_progress'}});
      await refreshCourses();render();drawSuggestionResults();toast('Ders listene eklendi.');
    }else if(action==='more-results' || action==='previous-results'){
      const delta=action==='more-results'?50:-50;
      if(state.modalTab==='suggested')state.suggestOffset=Math.max(0,state.suggestOffset+delta);else state.searchOffset=Math.max(0,state.searchOffset+delta);
      await fetchSuggestions();
    }else if(action==='delete-term'){
      dialog('Boş dönemi silmek istiyor musun?','Ders geçmişi içeren dönemler silinemez.',`<div class="modal-body"><p class="check-note">Bu işlem boş dönemi kaldırır. Ders kaydı bulunan dönemler, dersler arşivlenmiş olsa bile korunur.</p></div>`,`${button('close-modal','Vazgeç','light')}${button('confirm-delete-term','Boş dönemi sil','danger','',`data-id="${id}"`)}`);
    }else if(action==='confirm-delete-term'){
      await api(`/terms/${id}`,{method:'DELETE'});state.terms=await allPages('/terms');state.termId=state.terms[0]?.id || null;closeModal();render();toast('Boş dönem kaldırıldı.');
    }
  }catch(error){if(action==='resend-code' && error.retryAfter){resendUntil=Date.now()+error.retryAfter*1000;syncResendCooldown();}showError(error);}finally{if(target.isConnected)target.disabled=action==='resend-code' && resendUntil>Date.now();}
});
document.addEventListener('change',async event=>{
  const target=event.target, action=target.dataset.change, form=target.closest('form');
  try{
    if(action==='active-term'){state.termId=Number(target.value) || null;render();}
    else if(action==='show-archives'){state.archives=target.checked;render();}
    else if(action==='profile-unit'){
      form.elements.program_search.value='';form.elements.program_id.innerHTML=programOptions(null,target.value);await fillCurricula(form,null);
    }else if(action==='profile-program' || action==='term-program')await fillCurricula(form,target.value);
    else if(action==='profile-curriculum' || action==='profile-preparation')updateClass(form);
    else if(action==='term-curriculum')await updateTermPlan(form);
    else if(action==='term-preparation')populateTermPeriods(form,1);
    else if(action==='suggest-period'){state.suggestPeriod=Number(target.value);state.suggestOffset=0;await fetchSuggestions();}
  }catch(error){showError(error);}
});
document.addEventListener('input',event=>{
  const target=event.target;
  if(target.dataset.input==='program-search'){
    const form=target.closest('form'), previous=form.elements.program_id.value;
    form.elements.program_id.innerHTML=programOptions(previous,form.elements.academic_unit_id.value,target.value);
    if(form.elements.program_id.value!==previous){form.elements.curriculum_id.innerHTML='<option value="">Önce bölümünü seç</option>';}
  }
});
modal.addEventListener('click',event=>{if(event.target===modal){const bounds=modal.getBoundingClientRect();if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom)closeModal();}});
window.addEventListener('hashchange',()=>{if(state.user){render();root.querySelector('main')?.focus({preventScroll:true});}});
async function boot(){
  try{
    state.config=await api('/ui-config',{quiet401:true});
    document.title=`${applicationName()} · Öğrenci alanı`;
    try{state.user=await api('/users/me',{quiet401:true});}catch(error){if(error.status!==401)throw error;}
    if(state.user){await loadWorkspace();render();}else renderAuth();
  }catch(error){renderAuth();toast(error.message,true);}
}
boot();
