import {createDashboard} from './dashboard.js';
import {createExamUI} from './exam-ui.js';
import {prepareAccessibility,setMobileMenu} from './accessibility.js';
import {api, allPages, setUnauthorizedHandler} from './api.js';
import {icon} from './icons.js';
import {rememberForms,settleForm,cleanForm,canLeave,needsLeaveCheck,setFormBusy,clearFormErrors,fieldError,applyFieldErrors} from './forms.js';
import {createAssignmentUI,assignmentPriorities,assignmentDate,assignmentDateOffset,assignmentDateEnd,filterAssignments} from './assignment-ui.js';
import {visibleCourses} from './course-list.js';
import {legalTitles, legalContent} from './legal.js';

const root = document.querySelector('#app');
const modal = document.querySelector('#modal');
const statuses = {in_progress:['Devam ediyor','amber'],passed:['Başarılı','green'],failed:['Başarısız','red'],withdrawn:['Dersten çekildim','gray'],exempt:['Muaf','blue']};
const termNames = {fall:'Güz',spring:'Bahar',summer:'Yaz',annual:'Yıllık'};
const prepNames = {not_required:'Hazırlık yok',in_progress:'Hazırlık devam ediyor',completed:'Hazırlık tamamlandı',exempt:'Hazırlıktan muaf'};
const state = {user:null,profile:null,terms:[],examCalendars:[],examSync:null,courses:[],assignments:[],assignmentTermId:null,assignmentFilter:'all',assignmentArchives:false,assignmentQuery:'',assignmentSort:'due',programs:[],units:[],curricula:new Map(),termId:null,page:'overview',authMode:'login',email:'',config:{},status:'all',archives:false,courseView:'cards',courseQuery:'',courseSort:'name',modalTab:'suggested',suggestions:[],suggestPeriod:null,searchOffset:0,searchQuery:'',searchRows:[],busy:false};
const e = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Number(value || 0).toLocaleString('tr-TR',{maximumFractionDigits:2});
const selected = (a,b) => String(a) === String(b) ? ' selected' : '';
const applicationName = () => state.config.application_name || 'HalicMind';
const brand = () => `<a class="brand" href="#/overview"><span class="brand-mark">${icon('brand')}</span>${e(applicationName())}</a>`;
const initials = name => (name || 'Öğrenci').trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toLocaleUpperCase('tr-TR');
const preferredTerm = () => state.terms.find(term=>term.program_id===state.profile?.program_id && term.is_preparation===(state.profile?.preparation_status==='in_progress')) || state.terms[0];
const currentTerm = () => state.terms.find(term=>term.id === state.termId);
const termLabel = term => `${term.academic_year}–${term.academic_year+1} ${termNames[term.term_type]}${term.is_preparation?' · Hazırlık':''}`;
const programName = id => state.programs.find(p=>p.id===id)?.name_tr || 'Program seçilmedi';
const activeCourses = () => state.courses.filter(course=>!course.archived_at && course.term_id===state.termId);
const pill = status => { const [label,tone] = statuses[status] || statuses.in_progress; return `<span class="pill ${tone}"><span class="dot"></span>${label}</span>`; };
const button = (action,label,kind='primary',glyph='',extra='') => `<button type="button" class="btn ${kind}" data-action="${action}" ${extra}>${glyph?icon(glyph):''}${label}</button>`;

const dashboard=createDashboard({e,icon,termPicker,termLabel,button});
const examUI=createExamUI({e,icon,button,termPicker,termLabel,emptyState});
const assignmentUI=createAssignmentUI({e,icon,button,termLabel});

function toast(message,error=false,undoId=null) {
  const item=document.createElement('div'); item.className=`toast${error?' error':''}`;
  item.innerHTML=icon(error?'info':'check'); const text=document.createElement('span'); text.textContent=message; item.append(text);
  if(undoId!==null){
    const undo=document.createElement('button');undo.type='button';undo.className='toast-undo';undo.dataset.action=typeof undoId==='object'?undoId.action:'undo-remove';undo.dataset.id=typeof undoId==='object'?undoId.id:undoId;undo.textContent='Geri al';item.append(undo);
  }
  let container=document.querySelector('#toasts');
  if(modal.open){
    container=modal.querySelector('.modal-feedback');
    if(!container){container=document.createElement('div');container.className='modal-feedback';container.setAttribute('role','status');container.setAttribute('aria-live','polite');modal.append(container);}
  }
  container.append(item);setTimeout(()=>item.remove(),undoId===null?6500:15000);
}
function formError(form,message) { const target=form.querySelector('.form-error'); if(target){target.textContent=message; target.setAttribute('role','alert');target.tabIndex=-1;target.focus();} else toast(message,true); }
function showError(error) { if(error.status!==401) toast(error.message || 'Bir sorun oluştu. Lütfen tekrar dene.',true); }
const verificationRequests = new Map();
const recoveryRequests = new Map();
let resendTimer;
const verificationEmail = value => value.trim().toLowerCase();

function syncVerificationButton() {
  clearTimeout(resendTimer);
  const form = root.querySelector('[data-form="send-verification"], [data-form="request-reset"]');
  if (!form || form.dataset.saving === 'true') return;
  const button = form.querySelector('button[type="submit"]');
  const requests = form.dataset.form === 'request-reset' ? recoveryRequests : verificationRequests;
  const request = requests.get(verificationEmail(form.elements.email.value));
  const seconds = Math.max(0, Math.ceil(((request?.retryAt || 0) - Date.now()) / 1000));
  const label = request?.codeRequested ? 'Yeniden gönder' : 'Kod gönder';
  button.disabled = seconds > 0;
  button.textContent = seconds ? `${label} (${seconds} sn)` : label;
  if (seconds) resendTimer = setTimeout(syncVerificationButton, 1000);
}

function syncVerificationStep(email, focusCode = false) {
  const codeForm = root.querySelector('#verification-code');
  const codeRequested = Boolean(verificationRequests.get(email)?.codeRequested);
  if (codeForm.dataset.email !== email) {
    codeForm.reset();
    clearFormErrors(codeForm);
    codeForm.dataset.email = email;
  }
  codeForm.hidden = !codeRequested;
  if (codeRequested && focusCode) codeForm.elements.token.focus();
}
let modalTrigger=null;
function moveModalToasts(){modal.querySelectorAll('.modal-feedback .toast').forEach(item=>document.querySelector('#toasts').append(item));}
async function closeModal(force=false){if(savingCourses && !force)return false;if(!force && !await canLeave(modal))return false;moveModalToasts();if(modal.open) modal.close(); modal.innerHTML='';if(modalTrigger?.isConnected)modalTrigger.focus({preventScroll:true});else root.querySelector('main')?.focus({preventScroll:true});return true; }
function dialog(title,subtitle,body,footer='',wide=false) {
  if(!modal.open)modalTrigger=document.activeElement;
  const activeTab=modal.contains(document.activeElement)?document.activeElement.dataset.tab:null;
  moveModalToasts();
  modal.className=wide?'wide-dialog':'';
  modal.innerHTML=`<div class="modal-head"><div><h2 id="modal-title">${e(title)}</h2>${subtitle?`<p>${e(subtitle)}</p>`:''}</div><button class="icon-btn" type="button" data-action="close-modal" aria-label="Pencereyi kapat">${icon('close')}</button></div>${body}${footer?`<div class="modal-foot">${footer}</div>`:''}`;
  rememberForms(modal);
  prepareAccessibility(modal);
  if(!modal.open)modal.showModal();
  else if(!modal.contains(document.activeElement)){const tab=activeTab?modal.querySelector(`[data-tab="${activeTab}"]`):null;(tab || modal.querySelector('.modal-head button'))?.focus();}
}
function loadingDialog(title) { dialog(title,'',`<div class="dialog-loading"><span class="loader"></span><p>Bilgiler hazırlanıyor…</p></div>`); }
function go(page){location.hash=`/${page}`; if(state.page===page) render();}
function sessionExpired(){
  if(!state.user) return;
  state.user=null; state.profile=null; state.terms=[];state.examCalendars=[];state.examSync=null; state.courses=[];state.assignments=[];state.assignmentTermId=null;state.assignmentFilter='all';state.assignmentQuery='';state.assignmentArchives=false; state.termId=null; state.status='all'; state.archives=false; closeModal(true);
  state.authMode='login'; renderAuth(); toast('Oturumun sona erdi. Devam etmek için tekrar giriş yap.',true);
}
setUnauthorizedHandler(sessionExpired);

function siteFooter(){return `<footer class="site-footer"><div><strong>${e(applicationName())}</strong><span>© ${new Date().getFullYear()} · MIT lisansı</span></div><nav aria-label="Yasal bilgiler">${Object.entries(legalTitles).map(([key,label])=>`<a href="#/legal/${key}">${label}</a>`).join('')}</nav><p>Bağımsız öğrenci projesi. Resmi üniversite sistemi değildir.</p></footer>`;}
function renderLegal(){
  const key=location.hash.split('/')[2] || 'privacy';
  if(!Object.hasOwn(legalTitles,key))return false;
  closeModal(true);
  root.innerHTML=`<div class="legal-layout"><header>${brand()}<a href="#/${state.user?'overview':'login'}" class="btn light">${icon('arrow')}Uygulamaya dön</a></header><main id="main-content" class="legal-page" tabindex="-1"><div class="eyebrow">Bilgilendirme · 28 Ekim 2026</div><h1>${e(legalTitles[key])}</h1>${legalContent(key,state.config,e)}</main>${siteFooter()}</div>`;
  prepareAccessibility(root);return true;
}
function isLegal(){return location.hash.startsWith('#/legal/');}

function renderAuth() {
  if(isLegal() && renderLegal())return;
  const mode=state.authMode;
  const view = mode === 'login' ? loginView : mode === 'register' ? registerView : mode === 'recover' ? recoveryView : verifyView;
  root.innerHTML = `<div class="login-surface">
    <header class="login-brand">${brand()}</header>
    <main id="main-content" class="login-fields">${view()}</main>
  </div>${siteFooter()}`;
  prepareAccessibility(root);
  syncVerificationButton();
  if (mode === 'verify') syncVerificationStep(verificationEmail(state.email));
}
function loginView(){ return `<h1>Öğrenci girişi</h1><form data-form="login"><div class="field"><label for="login-email">Okul e-posta adresin</label><input id="login-email" name="email" type="email" autocomplete="username" required placeholder="ogrenci_no@ogr.halic.edu.tr" value="${e(state.email)}"></div><div class="field"><label for="login-password">Parolan</label><div class="login-password"><input id="login-password" name="password" type="password" autocomplete="current-password" required maxlength="128" placeholder="Parolanı gir"><button type="button" data-action="toggle-login-password" aria-controls="login-password" aria-label="Parolayı göster">Göster</button></div><button type="button" class="text-btn forgot-password" data-action="auth-recover">Parolamı unuttum</button></div><div class="form-error"></div><button class="btn primary wide" type="submit">Giriş yap ${icon('arrow')}</button></form><div class="auth-bottom">Hesabın yok mu? <button class="text-btn" data-action="auth-register">Kayıt ol</button></div><div class="auth-bottom"><button class="text-btn" data-action="auth-verify">Adresimi doğrula</button></div>`; }
function registerView(){ return `<h1>Hesap oluştur</h1><p>Okul e-postanla kaydol, akademik alanını oluşturmaya başla.</p><form data-form="register"><div class="field"><label for="register-name">Adın ve soyadın</label><input id="register-name" name="full_name" autocomplete="name" required maxlength="200" placeholder="Ad Soyad"></div><div class="field"><label for="register-email">Okul e-posta adresin</label><input id="register-email" name="email" type="email" autocomplete="username" required placeholder="ogrenci_no@ogr.halic.edu.tr" value="${e(state.email)}"><small>Yalnızca @ogr.halic.edu.tr uzantılı öğrenci adresleri.</small></div><div class="field"><label for="register-password">Bir parola belirle</label><input id="register-password" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="En az 12 karakter"><small>Başka hesaplarında kullanmadığın bir parola seç.</small></div><p class="registration-notice">Hesap ve akademik verilerinin kullanımı için <a href="#/legal/privacy">Gizlilik</a> ve <a href="#/legal/kvkk">KVKK aydınlatma taslağını</a> inceleyebilirsin.</p><div class="form-error"></div><button class="btn primary wide" type="submit">Hesabımı oluştur ${icon('arrow')}</button></form><div class="auth-bottom"><button class="text-btn" data-action="auth-login">Giriş ekranına dön</button></div>`; }
function recoveryView() {
  return `<h1>Parolamı unuttum</h1>
    <form data-form="request-reset">
      <div class="field"><label for="reset-email">Okul e-posta adresin</label>
        <div class="verification-email"><input id="reset-email" name="email" type="email" autocomplete="email" required value="${e(state.email)}">
          <button type="submit" class="btn primary">Kod gönder</button></div></div>
      <div class="form-error"></div>
    </form>
    <button type="button" data-action="have-reset-code" class="text-btn">Sıfırlama kodum var</button>
    <form data-form="reset-password" hidden>
      <div class="field"><label for="reset-token">E-postadaki sıfırlama kodu</label>
        <input id="reset-token" name="token" required minlength="43" maxlength="43" autocomplete="one-time-code" spellcheck="false"></div>
      <div class="field"><label for="reset-password">Yeni parola</label>
        <input id="reset-password" name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"><small>En az 12 karakter kullan.</small></div>
      <div class="field"><label for="reset-repeat">Yeni parola tekrarı</label>
        <input id="reset-repeat" name="repeat" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></div>
      <div class="form-error"></div>
      <button type="submit" class="btn primary wide">Parolayı güncelle</button>
    </form>
    <div class="auth-bottom"><button class="text-btn" data-action="auth-login">Giriş ekranına dön</button></div>
    ${state.config.local_mailbox?`<div class="mail-note"><a href="http://127.0.0.1:8025" target="_blank" rel="noopener noreferrer">Test posta kutusunu aç ${icon('arrow')}</a></div>`:''}`;
}

function showResetFields() {
  root.querySelector('[data-action="have-reset-code"]').hidden = true;
  root.querySelector('[data-form="reset-password"]').hidden = false;
  root.querySelector('#reset-token').focus();
}

function verifyView() {
  return `<div class="verify-icon">${icon('mail')}</div>
    <h1>E-postanı doğrula</h1>
    <p>Okul e-posta adresine bir doğrulama kodu iste.</p>
    <form data-form="send-verification">
      <div class="field">
        <label for="verify-email">Okul e-posta adresin</label>
        <div class="verification-email">
          <input id="verify-email" name="email" type="email" autocomplete="email" required value="${e(state.email)}" placeholder="Öğrenci e-postan">
          <button class="btn primary" type="submit" aria-controls="verification-code">Kod gönder</button>
        </div>
      </div>
      <div class="form-error"></div>
    </form>
    <form id="verification-code" data-form="verify" hidden>
      <p class="verification-note">Kod, kayıtlı ve doğrulanmamış adreslere gönderilir. Adresini daha önce doğruladıysan giriş yapabilirsin.</p>
      <div class="field">
        <label for="verify-token">Doğrulama kodu</label>
        <input id="verify-token" name="token" autocomplete="one-time-code" required minlength="43" maxlength="43" spellcheck="false" placeholder="E-postadaki kodun tamamını yapıştır">
        <small>Kod ${Number(state.config.verification_expire_minutes) || 30} dakika geçerli ve yalnızca bir kez kullanılabilir.</small>
      </div>
      <div class="form-error"></div>
      <button class="btn primary wide" type="submit">E-postamı doğrula ${icon('check')}</button>
    </form>
    <div class="auth-bottom"><button class="text-btn" data-action="auth-login">Giriş ekranına dön</button></div>
    ${state.config.local_mailbox ? `<div class="mail-note">Yerel geliştirme ortamında doğrulama kodunu test posta kutusunda bulabilirsin.<br><a href="http://127.0.0.1:8025" target="_blank" rel="noopener noreferrer">Test posta kutusunu aç ${icon('arrow')}</a></div>` : ''}`;
}

async function loadCatalog(){
  if(state.programs.length) return;
  [state.programs,state.units]=await Promise.all([api('/catalog/programs'),api('/catalog/academic-units')]);
}
async function curriculaFor(programId){
  if(!state.curricula.has(Number(programId))) state.curricula.set(Number(programId),await api(`/catalog/curricula?program_id=${Number(programId)}`));
  return state.curricula.get(Number(programId));
}
function planKind(cu){
  return cu?.period_kinds?.length===1?cu.period_kinds[0]:null;
}

async function loadWorkspace(){
  await loadCatalog();
  const results=await Promise.all([api('/users/me/academic-profile').catch(error=>{if(error.status===404)return null;throw error;}),allPages('/terms'),allPages('/enrollments?include_archived=true'),allPages('/assignments?include_archived=true')]);
  [state.profile,state.terms,state.courses,state.assignments]=results;
  if(!state.terms.some(term=>term.id===state.termId)) state.termId=preferredTerm()?.id || null;
  await Promise.all([...new Set([...state.terms.map(t=>t.program_id),...(state.profile?[state.profile.program_id]:[])])].map(curriculaFor));
  void refreshExams();
}

let examRequest = 0;
async function refreshExams(){
  const user = state.user, request = ++examRequest;
  state.examState = 'loading';
  try {
    const data = await Promise.all([api('/exams/calendar'), api('/exams/sync-status')]);
    if (user !== state.user || request !== examRequest) return;
    [state.examCalendars, state.examSync] = data;
    state.examState = 'ready';
  } catch (error) {
    if (user !== state.user || request !== examRequest) return;
    state.examCalendars = [];
    state.examSync = null;
    state.examState = 'error';
  }
  if (['exams','overview'].includes(state.page) && !isLegal()) renderDestination();
}

function applyCourse(course){
  const existing = state.courses.find(row=>row.id===course.id);
  if (existing) Object.assign(existing,course);
  else state.courses.push(course);
  for (const assignment of state.assignments.filter(row=>row.enrollment_id===course.id)) {
    Object.assign(assignment,{course_archived:Boolean(course.archived_at),course_code:course.course_code,course_name:course.course_name});
  }
  void refreshExams();
}
function navLink(page,label,glyph,count='') {return `<a class="nav-link ${state.page===page?'active':''}" href="#/${page}" ${state.page===page?'aria-current="page"':''}>${icon(glyph)}${label}${count!==''?`<span class="nav-count">${count}</span>`:''}</a>`;}
function render(){
  if(isLegal() && renderLegal())return;
  if(!state.user) return renderAuth();
  const requested=location.hash.slice(2).split('?')[0];
  state.page=state.profile && ['overview','courses','assignments','exams','history','profile'].includes(requested)?requested:state.profile?'overview':'profile';
  const labels={overview:'Genel bakış',courses:'Derslerim',assignments:'Ödevlerim',exams:'Sınavlar',history:'Geçmiş dönemler',profile:'Akademik profil'};
  root.innerHTML=`<div class="workspace ${state.page==='overview'?'overview-theme':''}"><div class="mobile-backdrop" data-action="toggle-menu"></div><aside class="sidebar"><button class="icon-btn menu-close" data-action="close-menu" aria-label="Menüyü kapat">${icon('close')}</button>${brand()}<div class="side-label">ÖĞRENCİ ALANI</div><nav class="side-nav" aria-label="Ana gezinme">${navLink('overview','Genel bakış','grid')}${navLink('courses','Derslerim','book',activeCourses().length)}${navLink('assignments','Ödevlerim','calendar',state.assignments.filter(item=>!item.archived_at && item.status==='pending').length)}${navLink('exams','Sınavlar','calendar')}${navLink('history','Geçmiş dönemler','history')}${navLink('profile','Akademik profil','user')}</nav><div class="side-note"><span class="eyebrow">ÇALIŞMA ALANIN</span><h3>Önce bu dönem.</h3><p>Geçmiş derslerini daha sonra da tamamlayabilirsin.</p><a href="#/history">Dönem geçmişini aç ${icon('arrow')}</a></div><div class="side-user"><span class="avatar">${e(initials(state.user.full_name))}</span><div><div class="side-user-name">${e(state.user.full_name)}</div><div class="side-user-role">Öğrenci hesabı</div></div><button data-action="logout" title="Çıkış yap" aria-label="Çıkış yap">${icon('logout')}</button></div></aside><header class="topbar"><button class="icon-btn mobile-menu" data-action="toggle-menu" aria-label="Menüyü aç" aria-expanded="false">${icon('menu')}</button><div class="breadcrumb"><span class="desktop-crumb">Öğrenci alanı</span><span class="mobile-brand">${e(applicationName())}</span>${icon('chevron')}<span>${labels[state.page]}</span></div><div class="topbar-right"><span class="topbar-date">${e(new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'}).format(new Date()))}</span><span class="verified-label">${icon('shield')}Doğrulanmış hesap</span><span class="avatar">${e(initials(state.user.full_name))}</span></div></header><main class="page" id="main-content" tabindex="-1">${state.page==='exams'?examsView():state.page==='overview'?overviewView():state.page==='courses'?coursesView():state.page==='assignments'?assignmentUI.page(state):state.page==='history'?historyView():profileView()}${siteFooter()}</main></div>`;
  prepareAccessibility(root);rememberForms(root);
  if(document.activeElement===document.body && !modal.open)root.querySelector('main')?.focus({preventScroll:true});
  if(state.page==='profile') hydrateProfileForm().then(()=>{const form=root.querySelector('[data-form="profile"]');if(form)settleForm(form);}).catch(showError);
}
function termPicker(){return `<div class="term-picker"><select aria-label="Aktif dönem" data-change="active-term">${state.terms.length?state.terms.map(term=>`<option value="${term.id}"${selected(term.id,state.termId)}>${e(termLabel(term))}</option>`).join(''):'<option value="">Henüz dönem yok</option>'}</select><button class="icon-btn" data-action="new-term" title="Yeni dönem oluştur" aria-label="Yeni dönem oluştur">${icon('plus')}</button>${state.termId?`<button class="icon-btn" data-action="edit-term" title="Dönemi düzenle" aria-label="Dönemi düzenle">${icon('edit')}</button>`:''}</div>`;}
function emptyState(title,description,action,label,compact=false,glyph='book'){return `<div class="empty-state ${compact?'compact':''}"><div class="empty-icon">${icon(glyph)}</div><h3>${e(title)}</h3><p>${e(description)}</p>${action?button(action,label,'primary','plus'):''}</div>`;}
function courseIcon(course,index){return `<div class="course-icon tone-${index%4}" aria-hidden="true">${e(course.course_code.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g,'').slice(0,2).toLocaleUpperCase('tr-TR') || 'D')}</div>`;}
function miniCourse(course,index){return `<div class="course-mini">${courseIcon(course,index)}<div class="mini-main"><h3>${e(course.course_name)}</h3><p>${e(course.course_code)}${course.course_id===null?' · Kişisel ders':''}</p></div><div class="mini-end"><span class="credits">${course.ects===null?'AKTS belirtilmedi':`${number(course.ects)} AKTS`}</span>${pill(course.status)}</div>${removeCourseButton(course)}</div>`;}
function overviewView(){return dashboard.view(state);}

function courseAssignmentButton(course) {
  return button('new-assignment','Ödev ekle','light small','plus',
    `data-course="${course.id}" aria-label="${e(course.course_code)} için ödev ekle"`);
}
function courseCards(courses){return `<div class="courses-grid">${courses.map((course,index)=>`<article class="course-card ${course.archived_at?'archived':''}"><div class="course-card-top">${courseIcon(course,index)}${course.archived_at?'<span class="pill gray">Arşivlendi</span>':pill(course.status)}</div><div><h3>${e(course.course_name)}</h3><div class="course-meta"><span>${e(course.course_code)}</span><span>·</span><span>${course.ects===null?'AKTS belirtilmedi':`${number(course.ects)} AKTS`}</span>${course.course_id===null?'<span>· Kişisel ders</span>':''}</div></div><div class="course-card-footer"><span class="grade-label">${!gradedStatuses.includes(course.status)?(course.status==='in_progress'?'Ders devam ediyor':'Not uygulanmaz'):course.grade?`Not: <strong>${e(course.grade)}</strong>`:'Sonuç notu eklenmedi'}</span><div class="card-actions">${previousResultsButton(course)}${course.archived_at?button('restore-course','Geri yükle','light small','restore',`data-id="${course.id}"`):`${courseAssignmentButton(course)}<button class="icon-btn" data-action="edit-course" data-id="${course.id}" aria-label="${e(course.course_code)} dersini düzenle" title="Sonuç ve notu düzenle">${icon('edit')}<span class="course-edit-label">Sonuç / not</span></button>${removeCourseButton(course)}`}</div></div></article>`).join('')}</div>`;}
function courseList(courses){return `<div class="panel course-list-panel"><div class="table-scroll"><table class="personal-course-table"><thead><tr><th>Ders</th><th>AKTS</th><th>Durum</th><th>Not</th><th><span class="sr-only">İşlemler</span></th></tr></thead><tbody>${courses.map(course=>`<tr class="${course.archived_at?'archived-row':''}"><td><strong>${e(course.course_name)}</strong><small>${e(course.course_code)}${course.course_id===null?' · Kişisel':''}${course.archived_at?' · Arşivde':''}</small></td><td>${course.ects===null?'—':number(course.ects)}</td><td>${pill(course.status)}</td><td>${e(gradedStatuses.includes(course.status)?course.grade || 'Not girilmedi':'—')}</td><td><div class="list-actions">${previousResultsButton(course)}${course.archived_at?button('restore-course','Geri yükle','light small','restore',`data-id="${course.id}"`):`${courseAssignmentButton(course)}<button class="icon-btn" data-action="edit-course" data-id="${course.id}" aria-label="${e(course.course_code)} dersini düzenle">${icon('edit')}<span class="course-edit-label">Sonuç / not</span></button>${removeCourseButton(course)}`}</div></td></tr>`).join('')}</tbody></table></div></div>`;}
function courseResults(){
  const rows=visibleCourses(state.courses,{termId:state.termId,archives:state.archives,status:state.status,query:state.courseQuery,sort:state.courseSort});
  if(rows.length)return state.courseView==='list'?courseList(rows):courseCards(rows);
  const filtered=Boolean(state.courseQuery || state.status!=='all');
  return `<div class="panel">${emptyState(filtered?'Eşleşen ders yok.':'Bu dönemde henüz ders yok.',filtered?'Aramanı veya durum filtresini değiştirebilirsin.':currentTerm()?.is_preparation?'Aldığın hazırlık derslerini ekle.':'Ders planından seç veya kişisel ders ekle.',filtered?'reset-course-search':'add-course',filtered?'Filtreleri temizle':'Ders ekle')}</div>`;
}
function refreshCourseResults(){
  const target=root.querySelector('#personal-course-results');if(target){target.innerHTML=courseResults();prepareAccessibility(target);}
  const count=root.querySelector('#course-result-count');if(count){const rows=visibleCourses(state.courses,{termId:state.termId,archives:state.archives,status:state.status,query:state.courseQuery,sort:state.courseSort});count.textContent=`${rows.length} ders`;}
}
function coursesView(){
  const term=currentTerm();
  return `<div class="page-title"><div><h1>Derslerim</h1><p>Derslerini düzenle, sonuçlarını güncelle.</p></div>${button(term?'add-course':'new-term',term?'Ders ekle':'Dönem oluştur','primary','plus')}</div><div class="toolbar">${termPicker()}<label class="check-line muted"><input type="checkbox" data-change="show-archives" ${state.archives?'checked':''}> Arşivlenenler</label></div>${!term?`<div class="panel">${emptyState('Önce bir dönem oluştur.','Güncel veya geçmiş bir dönemle başlayabilirsin.','new-term','Dönem oluştur')}</div>`:`<div class="course-tools"><div class="search-wrapper">${icon('search')}<input class="search-input" type="search" aria-label="Derslerimde ara" placeholder="Ders adı veya kodu" value="${e(state.courseQuery)}" data-input="personal-course-search"></div><select aria-label="Dersleri sırala" data-change="course-sort"><option value="name"${selected('name',state.courseSort)}>Ders adına göre</option><option value="code"${selected('code',state.courseSort)}>Ders koduna göre</option><option value="ects"${selected('ects',state.courseSort)}>AKTS · Yüksekten düşüğe</option><option value="recent"${selected('recent',state.courseSort)}>Son eklenen</option></select><div class="view-switch" role="group" aria-label="Ders görünümü">${button('course-view','Kart','ghost small','grid',`data-view="cards" aria-pressed="${state.courseView==='cards'}"`)}${button('course-view','Liste','ghost small','menu',`data-view="list" aria-pressed="${state.courseView==='list'}"`)}</div></div><div class="toolbar course-filters"><div class="filter-tabs" aria-label="Ders durumuna göre filtrele"><button data-action="course-filter" data-status="all" aria-pressed="${state.status==='all'}" class="${state.status==='all'?'active':''}">Tümü</button>${Object.entries(statuses).map(([key,[label]])=>`<button data-action="course-filter" data-status="${key}" aria-pressed="${state.status===key}" class="${state.status===key?'active':''}">${label}</button>`).join('')}</div><span id="course-result-count" aria-live="polite">${visibleCourses(state.courses,{termId:state.termId,archives:state.archives,status:state.status,query:state.courseQuery}).length} ders</span></div><div id="personal-course-results">${courseResults()}</div>`}`;
}

const termSpan = {fall:[0,0], spring:[1,1], annual:[0,1], summer:[2,2]};
function priorResults(course) {
  if (!course?.course_id) return [];
  const terms = new Map(state.terms.map(term=>[term.id,term]));
  const current = terms.get(course.term_id);
  if (!current) return [];
  return state.courses.filter(row=>{
    const term = terms.get(row.term_id);
    return row.course_id===course.course_id && term && (term.academic_year<current.academic_year ||
      (term.academic_year===current.academic_year && termSpan[term.term_type][1]<termSpan[current.term_type][0]));
  }).sort((a,b)=>{
    const left=terms.get(a.term_id), right=terms.get(b.term_id);
    return left.academic_year-right.academic_year || termSpan[left.term_type][1]-termSpan[right.term_type][1] || a.id-b.id;
  });
}
function previousResultsButton(course) {
  return priorResults(course).length ? button('previous-course-results','Önceki sonuçlar','light small','history',`data-id="${course.id}"`) : '';
}
function openPreviousResults(id) {
  const course = state.courses.find(item=>item.id===id);
  if (!course) return;
  const rows = priorResults(course).map(row=>{
    const term = state.terms.find(item=>item.id===row.term_id);
    const grade = row.grade || (gradedStatuses.includes(row.status)?'Not girilmedi':'Not uygulanmaz');
    return `<li><strong>${e(termLabel(term))}</strong><small>${e(programName(term.program_id))}</small>
      <div>${pill(row.status)} · ${e(grade)} ${row.archived_at?'<span class="pill gray">Arşivde</span>':''}</div></li>`;
  });
  dialog('Önceki sonuçlar',course.course_code+' · '+course.course_name,
    `<div class="modal-body"><ul class="prior-results">${rows.join('')}</ul></div>`,button('close-modal','Kapat','light'));
}

function historyTerm(term) {
  const all=state.courses.filter(row=>row.term_id===term.id);
  const courses=all.filter(row=>!row.archived_at);
  const credits=courses.reduce((sum,row)=>sum+Number(row.ects || 0),0);
  const cu=(state.curricula.get(term.program_id) || []).find(row=>row.id===term.curriculum_id);
  const count=status=>courses.filter(row=>row.status===status).length;
  return `<article class="panel history-record">
    <button type="button" class="history-open" data-action="view-term" data-id="${term.id}">
      <strong>${e(termLabel(term))}</strong>${icon('arrow')}
      <span>${courses.length} ders · ${count('passed')} başarılı · ${count('failed')} başarısız · ${count('exempt')} muaf</span>
      ${all.length>courses.length?`<small>${all.length-courses.length} arşivlenmiş kayıt</small>`:''}
    </button>
    ${all.length?'':'<p>Bu döneme henüz ders eklenmedi.</p>'}
    <details><summary>Ders ayrıntıları</summary><div class="history-detail"><div class="history-facts"><div><span>Ders planı</span><strong>${e(cu?curriculumLabel(cu):`Plan #${term.curriculum_id}`)}</strong></div><div><span>Öneri dönemi</span><strong>${term.is_preparation?'Hazırlık · bölüm planından ayrı':term.curriculum_period_number?`${term.curriculum_period_number}. ${term.curriculum_period_kind==='year'?'yıl':'dönem'}`:'Seçilmedi'}</strong></div><div><span>Sonuç dağılımı</span><strong>${courses.filter(c=>c.status==='passed').length} başarılı · ${courses.filter(c=>c.status==='failed').length} başarısız · ${courses.filter(c=>c.status==='in_progress').length} devam · ${courses.filter(c=>c.status==='exempt').length} muaf · ${courses.filter(c=>c.status==='withdrawn').length} bırakıldı</strong></div></div>${all.length?`<div class="table-scroll"><table class="history-table"><thead><tr><th>Ders / kod</th><th>Kaynak</th><th>AKTS</th><th>Durum</th><th>Not</th><th>Kayıt</th></tr></thead><tbody>${all.map(course=>`<tr class="${course.archived_at?'archived-row':''}"><td><strong>${e(course.course_name)}</strong><small>${e(course.course_code)}</small>${previousResultsButton(course)}</td><td>${course.course_id===null?'Kişisel':'Katalog'}</td><td>${course.ects===null?'—':number(course.ects)}</td><td>${pill(course.status)}</td><td><strong>${e(gradedStatuses.includes(course.status)?course.grade || 'Not girilmedi':'Uygulanmaz')}</strong></td><td>${course.archived_at?`<span class="pill gray">Arşiv</span><small>${e(new Intl.DateTimeFormat('tr-TR').format(new Date(course.archived_at)))}</small>`:'Aktif'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="check-note">Bu döneme henüz ders eklenmedi.</p>'}<div class="history-actions"><small>AKTS toplamı aktif kayıtlar içindir; resmi transkript veya not ortalaması değildir.</small>${button('view-term','Bu dönemi yönet','light small','arrow',`data-id="${term.id}"`)}</div></div></details></article>`;
}
function historyView(){
  const years = [...new Set(state.terms.map(term=>term.academic_year))].sort((a,b)=>b-a);
  const total = state.courses.filter(course=>!course.archived_at);
  const sections = years.filter(year=>!state.historyYear || String(year)===state.historyYear).map(year=>{
    const terms = state.terms.filter(term=>term.academic_year===year);
    const programs = [...new Set(terms.map(term=>term.program_id))];
    return `<section class="history-year-group"><h2>${year}–${year+1}</h2>${programs.map(id=>{
      const group = terms.filter(term=>term.program_id===id).sort((a,b)=>termSpan[b.term_type][1]-termSpan[a.term_type][1]);
      return `<section><h3>${e(programName(id))}</h3>${group.map(historyTerm).join('')}</section>`;
    }).join('')}</section>`;
  });
  return `<div class="page-title"><div><div class="eyebrow">AKADEMİK ARŞİV</div><h1>Dönem geçmişin</h1><p>Kaydettiğin tüm dönemler, dersler ve sonuçlar. Güncel dönemin de burada görünür.</p></div>${button('new-term','Dönem ekle','primary','plus')}</div><div class="history-overview"><div><strong>${state.terms.length}</strong><span>Kayıtlı dönem</span></div><div><strong>${total.length}</strong><span>Aktif ders kaydı</span></div><div><strong>${total.filter(c=>['passed','exempt'].includes(c.status)).length}</strong><span>Başarılı / muaf kayıt</span></div><div><strong>${state.courses.filter(c=>c.archived_at).length}</strong><span>Arşivlenen kayıt</span></div></div><div class="toolbar"><p class="check-note">Geçmişi doldurmak isteğe bağlıdır. Tekrar alınan dersler kendi dönemlerinde saklanır.</p><select aria-label="Akademik yıla göre filtrele" data-change="history-year"><option value="">Tüm akademik yıllar</option>${years.map(y=>`<option value="${y}"${selected(y,state.historyYear)}>${y}–${y+1}</option>`).join('')}</select></div>${sections.length?sections.join(''):emptyState('Henüz dönem kaydı yok.','Güncel veya geçmiş bir dönem ekleyebilirsin.','new-term','Dönem ekle')}`;
}
const normalizeSearch = value => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function matchingPrograms(unit,query=''){
  const aliases={pc:'bilgisayar',bil:'bilgisayar',computer:'bilgisayar',software:'yazilim',muh:'muhendis',eng:'muhendis'};
  const words=normalizeSearch(query).split(' ').filter(Boolean).map(word=>aliases[word] || word);
  return state.programs.filter(p=>(!unit || p.academic_unit_id===Number(unit)) && words.every(word=>normalizeSearch(p.name_tr).includes(word)));
}
function programPicker(value,unit='',prefix='profile'){
  const p=state.programs.find(row=>row.id===Number(value));
  return `<div class="program-picker" data-unit="${e(unit)}"><input type="hidden" name="program_id" value="${p?.id || ''}"><div class="combo-control">${icon('search')}<input id="${prefix}-program" name="program_label" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${prefix}-program-options" autocomplete="off" placeholder="Bölümünü seç veya yaz…" value="${e(p?.name_tr || '')}" data-input="program-combobox" required><button type="button" data-action="toggle-program" aria-label="Bölüm listesini aç">${icon('chevron')}</button></div><div id="${prefix}-program-options" class="program-options" role="listbox" aria-label="Bölümler" hidden></div><small class="program-selection${prefix==='term'?' sr-only':''}" aria-live="polite">${p?'Seçili: '+e(p.name_tr):'Örn. pc müh, bilgisayar, yazılım müh'}</small></div>`;
}
function showProgramOptions(picker,query=''){
  const input=picker.querySelector('[role="combobox"]'),list=picker.querySelector('[role="listbox"]');
  const rows=matchingPrograms(picker.dataset.unit,query);
  const fields = picker.closest('form').elements;
  const term = picker.closest('form').dataset.form === 'term';
  const options = rows.flatMap(program => {
    const plans = term && program.id !== state.profile?.program_id ? state.curricula.get(program.id) : null;
    const unit = state.units.find(unit => unit.id === program.academic_unit_id)?.name_tr || '';
    const degree = {associate:' · Ön lisans', bachelor:' · Lisans'}[program.degree_level] || '';
    return (plans?.length > 1 ? plans : [null]).map(plan => {
      const active = program.id === Number(fields.program_id.value) && (!plan || plan.id === Number(fields.curriculum_id.value));
      const detail = plan ? `${plan.label} · ${curriculumLabel(plan)}` : unit + degree;
      return `<div id="${list.id}-${program.id}${plan?`-${plan.id}`:''}" role="option" aria-selected="${active}" data-action="select-program" data-id="${program.id}" data-plan="${plan?.id || ''}"><strong>${e(program.name_tr)}</strong><small>${e(detail)}</small></div>`;
    });
  });
  list.innerHTML = options.length ? options.join('') : `<p class="no-results">${term?'Bölüm bulunamadı.':'Bölüm bulunamadı. Kısa bir adla tekrar dene veya fakülte filtresini kaldır.'}</p>`;
  list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');picker.dataset.index='-1';
}
function closeProgramPicker(picker){picker.querySelector('[role="listbox"]').hidden=true;picker.querySelector('[role="combobox"]').setAttribute('aria-expanded','false');picker.querySelector('[role="combobox"]').removeAttribute('aria-activedescendant');}
async function chooseProgram(picker,id,planId){
  const program=state.programs.find(row=>row.id===id);if(!program)return;
  picker.querySelector('[name="program_id"]').value=program.id;picker.querySelector('[role="combobox"]').value=program.name_tr;
  picker.querySelector('.program-selection').textContent='Seçili: '+program.name_tr;closeProgramPicker(picker);
  const form = picker.closest('form');
  if (form.dataset.form === 'profile') {
    resetProfileDetails(form);
    await fillCurricula(form,id);
    return;
  }
  const fields = form.elements;
  setTermPlan(form,null);
  fields.curriculum_id.disabled = true;
  clearFormErrors(form);
  let plans;
  try {
    plans = await curriculaFor(id);
  } catch (error) {
    if (form.isConnected && Number(fields.program_id.value) === id) {
      fields.curriculum_id.disabled = false;
      formError(form,error.message);
      form.querySelector('.form-error').insertAdjacentHTML('beforeend', button('retry-curricula','Tekrar dene','light small'));
    }
    return;
  }
  if (!form.isConnected || Number(fields.program_id.value) !== id) return;
  fields.curriculum_id.disabled = false;
  const preferred = id === state.profile.program_id ? state.profile.curriculum_id : Number(planId);
  const plan = plans.find(row => row.id === preferred) || (plans.length === 1 ? plans[0] : null);
  if (plan) {
    setTermPlan(form,plan);
    if (planId) fields.program_label.value = `${program.name_tr} · ${plan.label}`;
  } else if (plans.length) {
    fields.program_label.focus();
    showProgramOptions(picker,program.name_tr);
    picker.querySelector('.program-selection').textContent = 'Bölümünün planını listeden seç.';
  } else {
    formError(form,'Bu bölüm için ders planı bulunamadı.');
  }
}
function curriculumLabel(c){return `${c.entry_year?`${c.entry_year} girişliler`:'Giriş yılı belirtilmemiş plan'} · ${(c.period_kinds || []).map(kind=>kind==='year'?'Yıllık':'Dönemlik').join(' / ') || 'Plan türü belirtilmemiş'}`;}

function curriculumOptions(rows,value){return '<option value="">Müfredatını seç</option>'+rows.map(c=>`<option value="${c.id}"${selected(c.id,value)}>${e(curriculumLabel(c))}${rows.length>1?` · ${e(c.label)}`:''}</option>`).join('');}
function profileView(){
  const profile=state.profile;
  const program=state.programs.find(p=>p.id===profile?.program_id);
  const heading = profile ? 'Akademik profil' : 'Akademik profilini oluştur';
  return `<div class="${profile ? 'profile-page' : 'onboarding'}">
    <h1>${heading}</h1>
    ${profile && !state.terms.length ? button('new-term','İlk dönemini oluştur','primary','plus') : ''}
    <form data-form="profile" class="panel panel-padding">
      <div class="form-grid">
        <div class="field full"><label for="profile-unit">Fakülte</label><select id="profile-unit" name="academic_unit_id" required data-change="profile-unit"><option value="">Fakülte seç</option>${state.units.map(unit=>`<option value="${unit.id}"${selected(unit.id,program?.academic_unit_id)}>${e(unit.name_tr)}</option>`).join('')}</select></div>
        <div class="field full" hidden><label for="profile-program">Bölüm / program</label>${programPicker(profile?.program_id,program?.academic_unit_id)}</div>
        <div class="field full" hidden><label for="profile-curriculum">Bölümün ders planı</label><select id="profile-curriculum" name="curriculum_id" required data-change="profile-curriculum"><option value="">Önce bölümünü seç</option></select></div>
        <div class="field full" hidden><label for="profile-year">Giriş yılı</label><select id="profile-year" name="entry_year" required><option value="">Yıl seç</option>${Array.from({length: new Date().getFullYear() - 1898}, (_, i) => new Date().getFullYear() + 1 - i).map(year => `<option value="${year}"${selected(year,profile?.entry_year)}>${year}</option>`).join('')}</select></div>
        <div class="field full" hidden><label for="profile-preparation">Hazırlık durumun</label><select id="profile-preparation" name="preparation_status" required data-change="profile-preparation"><option value="">Hazırlık durumu seç</option>${Object.entries(prepNames).map(([key,label])=>`<option value="${key}"${selected(key,profile?.preparation_status)}>${label}</option>`).join('')}</select></div>
        <div class="field full" hidden><label for="profile-class">Şu anki sınıfın</label><select id="profile-class" name="current_class" required><option value="">Sınıf seç</option></select></div>
      </div>
      <div class="form-error full"></div>
      <div class="profile-actions"><button type="submit" class="btn primary">${profile?'Değişiklikleri kaydet':'Profilimi oluştur ve devam et'} ${icon('arrow')}</button></div>
    </form>
  </div>`;
}
function resetProfileDetails(form) {
  for (const name of ['entry_year','preparation_status','current_class']) form.elements[name].value = '';
}

function revealProfileFields(form) {
  const fields = form.elements;
  const show = (control, visible) => { control.closest('.field').hidden = !visible; };
  show(fields.program_id, fields.academic_unit_id.value);
  const ready = fields.program_id.value && fields.curriculum_id.value && !fields.curriculum_id.disabled;
  show(fields.entry_year, ready);
  show(fields.preparation_status, ready && fields.entry_year.value);
  const classReady = ready && fields.entry_year.value && fields.preparation_status.value;
  show(fields.current_class, classReady);
  form.querySelector('.profile-actions').hidden = !(classReady && fields.current_class.value);
}

async function hydrateProfileForm(){
  const form=root.querySelector('[data-form="profile"]'); if(!form) return;
  rememberForms(root);
  revealProfileFields(form);
  if(state.profile) await fillCurricula(form,state.profile.program_id,state.profile.curriculum_id);
}
async function fillCurricula(form,programId,curriculumId=null){
  const select=form.elements.curriculum_id;
  const profileField = select.closest('.field');
  profileField.hidden = !programId;
  form.querySelector('.form-error').textContent = '';
  select.innerHTML='<option value="">Yükleniyor…</option>'; select.disabled=true;
  if(!programId){select.innerHTML='<option value="">Önce bölümünü seç</option>';select.disabled=false;return;}
  revealProfileFields(form);
  let rows;
  try { rows = await curriculaFor(programId); }
  catch (error) {
    if (form.isConnected && Number(form.elements.program_id.value) === Number(programId)) {
      select.innerHTML = '<option value="">Ders planı yüklenemedi</option>';
      formError(form,error.message);
      form.querySelector('.form-error').insertAdjacentHTML('beforeend', button('retry-curricula','Tekrar dene','light small'));
    }
    return;
  }
  if(!form.isConnected || Number(form.elements.program_id.value)!==Number(programId)) return;
  select.innerHTML=curriculumOptions(rows,curriculumId || (rows.length===1?rows[0].id:null));select.disabled=false;
  profileField.hidden = false;
  if (!rows.length) select.innerHTML = '<option value="">Bu bölüm için ders planı bulunamadı</option>';
  updateClass(form,curriculumId ? state.profile?.current_class : undefined);
  revealProfileFields(form);
  settleForm(form);
}
function updateClass(form,preferred){
  const rows=state.curricula.get(Number(form.elements.program_id.value)) || [];
  const cu=rows.find(c=>c.id===Number(form.elements.curriculum_id.value));
  const prep=form.elements.preparation_status.value==='in_progress';
  const current=preferred ?? Number(form.elements.current_class.value);
  const hint=form.querySelector('#preparation-help');if(hint)hint.textContent=prep?'Sınıfın hazırlık olarak kaydedilir. Güncel dönem hazırlık olur; bölümün zorunlu dersleri önerilmez. Hazırlığı tamamlayınca durumunu ve sınıfını güncelle.':'Bölümde okuduğun sınıfı seç. Tamamlanan veya muaf olunan hazırlık, bölüm dönemlerine eklenmez; eski hazırlık kayıtların korunur.';
  form.elements.current_class.innerHTML=prep?'<option value="0">Hazırlık</option>':'<option value="">Sınıf seç</option>'+Array.from({length:Math.ceil((cu?.semester_count || 8)/2)},(_,i)=>`<option value="${i+1}"${selected(i+1,current)}>${i+1}. sınıf</option>`).join('');
}

async function openTermDialog(edit=false){
  if(!state.profile) return go('profile');
  const existing=edit?currentTerm():null;
  loadingDialog(edit?'Dönemini düzenle':'Yeni bir dönem oluştur');
  const programId=existing?.program_id || state.profile.program_id;
  const curricula=await curriculaFor(programId);
  const curriculumId=existing?.curriculum_id || state.profile.curriculum_id;
  const plan = curricula.find(row => row.id === curriculumId);
  if(!modal.open)return;
  const today = new Date();
  const localDate = new Intl.DateTimeFormat('tr-TR',{year:'numeric',month:'numeric',timeZone:'Europe/Istanbul'}).formatToParts(today);
  const year = Number(localDate.find(part => part.type === 'year').value);
  const month = Number(localDate.find(part => part.type === 'month').value);
  const selectedYear = existing?.academic_year ?? year - (month < 9 ? 1 : 0);
  const years = Array.from({length:year + 2 - 2020}, (_,i) => 2020 + i);
  if (existing && !years.includes(selectedYear)) years.push(selectedYear);
  const prep=existing?.is_preparation ?? state.profile.preparation_status==='in_progress';
  const calendarType = month >= 9 ? 'fall' : month >= 6 ? 'summer' : 'spring';
  const type = existing?.term_type || (!prep && planKind(plan) === 'year' ? 'annual' : calendarType);
  dialog(edit?'Dönemi düzenle':'Yeni dönem','',`
    <form data-form="term" data-id="${existing?.id || ''}">
      <div class="modal-body form-grid">
        <div class="field"><label for="term-year">Akademik yıl</label><select id="term-year" name="academic_year" required>${years.sort((a,b)=>a-b).map(y=>`<option value="${y}"${selected(y,selectedYear)}>${y}–${y+1}</option>`).join('')}</select></div>
        <div class="field"><label for="term-type">Takvim dönemi</label><select id="term-type" name="term_type">${Object.entries(termNames).map(([key,label])=>`<option value="${key}"${selected(key,type)}>${label}</option>`).join('')}</select></div>
        <div class="field full"><label for="term-program">Bölüm</label>${edit?`<input id="term-program" value="${e(programName(programId))}" disabled><input type="hidden" name="program_id" value="${programId}">`:programPicker(programId,'','term')}</div>
        <input type="hidden" name="curriculum_id" value="${curriculumId}">
        <label class="check-line full"><input type="checkbox" name="is_preparation" data-change="term-preparation" ${prep?'checked':''} ${edit?'disabled':''}> Hazırlık dönemi</label>
        <div class="field full" hidden><label for="term-kind">Eğitim düzeni</label><select id="term-kind" name="curriculum_period_kind" data-change="term-kind"><option value="">Seç</option><option value="semester">Dönemlik</option><option value="year">Yıllık</option></select></div>
        <div class="field full"><label for="term-period">Kaçıncı dönem?</label><select id="term-period" name="curriculum_period_number" ${existing && existing.curriculum_period_number===null?'':'required'}></select></div>
        <div class="form-error full"></div>
      </div>
      <div class="modal-foot">${existing?button('delete-term','Boş dönemi sil','ghost','',`data-id="${existing.id}"`):''}${button('close-modal','Vazgeç','light')}<button type="submit" class="btn primary">${edit?'Kaydet':'Dönemi oluştur'} ${icon('arrow')}</button></div>
    </form>`);
  const form=modal.querySelector('form');
  setTermPlan(form,plan,existing);
  settleForm(form);
}

function setTermPlan(form,plan,existing=null){
  form.elements.curriculum_id.value = plan?.id || '';
  form.elements.curriculum_period_kind.value = existing?.curriculum_period_kind || planKind(plan) || '';
  updateTermFields(form,existing?.curriculum_period_number);
}

function updateTermFields(form,number){
  const fields = form.elements;
  const kind = fields.curriculum_period_kind.value;
  const prep = fields.is_preparation.checked;
  const plan = state.curricula.get(Number(fields.program_id.value))?.find(row => row.id === Number(fields.curriculum_id.value));
  const kindSelect = fields.curriculum_period_kind;
  kindSelect.closest('.field').hidden = prep || !plan || Boolean(planKind(plan));
  kindSelect.disabled = prep || !plan;
  kindSelect.required = !kindSelect.closest('.field').hidden && fields.curriculum_period_number.required;
  const period = fields.curriculum_period_number;
  period.disabled = prep || !plan || !kind;
  period.closest('.field').hidden = period.disabled;
  const annual = kind === 'year';
  form.querySelector('label[for="term-period"]').textContent = annual ? 'Kaçıncı yıl?' : 'Kaçıncı dönem?';
  const maximum = !plan ? 0 : annual ? Math.ceil(plan.semester_count / 2) : plan.semester_count;
  const prompt = annual ? 'Yıl seç' : 'Dönem seç';
  period.innerHTML = `<option value="">${prompt}</option>` + Array.from({length:maximum}, (_,i) =>
    `<option value="${i+1}"${selected(i+1,number)}>${i+1}. ${annual?'yıl':'dönem'}</option>`).join('');
  const calendar = fields.term_type;
  for (const option of calendar.options) {
    option.disabled = !prep && ((annual && !['annual','summer'].includes(option.value)) || (kind === 'semester' && option.value === 'annual'));
  }
  if (calendar.selectedOptions[0]?.disabled) calendar.value = annual ? 'annual' : 'fall';
}

function showTermCourses() {
  state.status='all';
  state.courseQuery='';
  if (location.hash === '#/courses') render();
  else go('courses');
}
const pickedCourses = new Map();
let batchMessage = '', savingCourses = false;
async function openCourseDialog(){
  pickedCourses.clear();
  batchMessage = '';
  const term=currentTerm(); if(!term)return openTermDialog();
  state.modalTab=term.is_preparation?'custom':'suggested';state.searchOffset=0;state.searchQuery='';state.searchRows=[];
  const rows=await curriculaFor(term.program_id);
  const plan=rows.find(row=>row.id===term.curriculum_id);
  const kind=planKind(plan), maximum=plan?.semester_count || 8;
  state.suggestKind=term.curriculum_period_kind || kind || '';state.suggestMax=state.suggestKind==='year'?Math.ceil(maximum/2):maximum;
  state.suggestPeriod=term.curriculum_period_number || 1;
  drawCourseDialog(); if(state.modalTab==='suggested') await fetchSuggestions();
}
function drawCourseDialog(){
  const term=currentTerm(); if(!term)return;
  const tabs=term.is_preparation?['custom']:['suggested','catalog','custom'];
  const names={suggested:'Ders planından',catalog:'Ders ara',custom:'Elle ders ekle'};
  const content=state.modalTab==='custom'?customCourseForm():`<div class="modal-body">${state.modalTab==='suggested'?`<div class="period-select"><span>Ders planı</span>${!state.suggestKind?`<select aria-label="Öneri plan türü" data-change="suggest-kind"><option value="">Tür seç</option><option value="semester">Dönemlik</option><option value="year">Yıllık</option></select>`:''}<select aria-label="Öneriler için müfredat dönemi" data-change="suggest-period">${Array.from({length:state.suggestMax},(_,i)=>`<option value="${i+1}"${selected(i+1,state.suggestPeriod)}>${i+1}. ${state.suggestKind==='year'?'yıl':'dönem'}</option>`).join('')}</select></div>`:''}<form data-form="course-search" class="modal-search"><div class="search-wrapper">${icon('search')}<input class="search-input" name="query" type="search" maxlength="100" placeholder="Ders adı veya koduyla ara…" aria-label="Ders adı veya kodu" value="${e(state.modalTab==='suggested'?'':state.searchQuery)}"></div><button class="btn light small" type="submit">Ara</button></form><div id="course-results"><div class="dialog-loading"><span class="loader"></span><p>Dersler yükleniyor…</p></div></div></div>`;
  dialog('Ders ekle',`${termLabel(term)} · ${programName(term.program_id)}`,`<div class="modal-tabs" role="tablist" aria-label="Ders ekleme yöntemi">${tabs.map(tab=>`<button role="tab" aria-selected="${tab===state.modalTab}" class="${tab===state.modalTab?'active':''}" data-action="course-tab" data-tab="${tab}">${names[tab]}</button>`).join('')}</div>${content}`,'',true);
}
function customCourseForm(){return `<form data-form="custom-course"><div class="modal-body form-grid"><p class="check-note full">${currentTerm()?.is_preparation?'Hazırlık dersleri bölüm planından ayrıdır. Aldığın dil derslerini burada adlarıyla ekleyebilirsin.':'Katalogda bulamadığın seçmeli veya başka bir dersi elle ekleyebilirsin. Kayıt yalnızca senin hesabında tutulur.'}</p><div class="field"><label for="custom-code">Ders kodu</label><input id="custom-code" name="custom_course_code" required maxlength="100" placeholder="Örn. HAZ101"></div><div class="field"><label for="custom-ects">AKTS <span class="muted">· İsteğe bağlı</span></label><input id="custom-ects" name="custom_ects" type="number" min="0" max="120" step="0.01" placeholder="Örn. 3"></div><div class="field full"><label for="custom-name">Ders adı</label><input id="custom-name" name="custom_course_name" required maxlength="500" placeholder="Dersin tam adı"></div>${resultFields()}<p class="check-note full">Bu ders yalnızca senin listene eklenir. Ortak ders kataloğunu değiştirmez.</p><div class="form-error full"></div></div><div class="modal-foot">${button('close-modal','Vazgeç','light')}<button type="submit" class="btn primary">Dersi ekle ${icon('plus')}</button></div></form>`;}
const letterGrades=['AA','BA','BB','CB','CC','DC','DD','FD','FF'];
function gradeControl(kind,value=''){
  if(kind==='numeric')return `<input id="course-grade" name="grade" data-kind="numeric" maxlength="20" inputmode="decimal" placeholder="Örn. 85 veya 87,5" value="${e(value)}" autocomplete="off" aria-describedby="grade-help">`;
  const options=value && !letterGrades.includes(value)?[value,...letterGrades]:letterGrades;
  return `<select id="course-grade" name="grade" data-kind="letter" aria-describedby="grade-help"><option value="">Not seç · İsteğe bağlı</option>${options.map(item=>`<option value="${e(item)}"${selected(item,value)}>${e(item)}</option>`).join('')}</select>`;
}
const numericGrade = value => /^\d+(?:[.,]\d+)?$/.test(String(value).trim());
const gradedStatuses=['passed','failed','exempt'];
const resultHints={in_progress:'Ders devam ediyor. Sonuçlandığında durumunu ve notunu güncelle.',passed:'Dersi geçtin. Dönem sonu notunu ekleyebilirsin.',failed:'Dersi geçemedin. Dönem sonu notunu ekleyebilirsin.',exempt:'Bu dersten muafsın. Varsa tanınan notunu ekleyebilir veya boş bırakabilirsin.',withdrawn:'Bu dönem dersten çekildin; not tutulmaz. Bu, kaydı listenden kaldırmakla aynı işlem değildir.'};
function resultFields(course={status:'in_progress',grade:null}){
  const kind=course.grade && numericGrade(course.grade)?'numeric':'letter',graded=gradedStatuses.includes(course.status);
  const option=key=>`<label class="result-option"><input type="radio" name="status" data-change="result-status" value="${key}" ${key===course.status?'checked':''}><span class="status-indicator status-${key}" aria-hidden="true"></span><span>${statuses[key][0]}</span></label>`;
  return `<section class="result-editor full"><div class="result-heading"><h3>Ders durumu</h3></div><div class="result-options" role="radiogroup" aria-label="Dersin durumu">${['in_progress','passed','failed'].map(option).join('')}<details class="result-other" ${['exempt','withdrawn'].includes(course.status)?'open':''}><summary>Muafiyet veya dersten çekilme</summary><div>${['exempt','withdrawn'].map(option).join('')}</div></details></div><div class="result-context" aria-live="polite">${icon('info')}<p>${e(resultHints[course.status])}</p></div><div class="result-grade" ${graded?'':'hidden'}><div class="result-heading"><h3>Dönem sonu notu <span>İsteğe bağlı</span></h3></div><div class="grade-layout"><div class="field"><label for="grade-kind">Not türü</label><select id="grade-kind" name="grade_kind" data-change="grade-kind" ${graded?'':'disabled'}><option value="letter"${selected(kind,'letter')}>Harf notu</option><option value="numeric"${selected(kind,'numeric')}>Sayısal not (0–100)</option></select></div><div class="field"><label for="course-grade">Notun</label><div class="grade-entry">${gradeControl(kind,course.grade || '')}</div></div></div><small id="grade-help">Harf notunu seç veya sayısal notunu yaz. Not, seçtiğin başarı durumunu değiştirmez.</small></div></section>`;
}
function syncResultStatus(form){
  const status=form.elements.status.value,graded=gradedStatuses.includes(status),section=form.querySelector('.result-grade');
  section.hidden=!graded;section.querySelectorAll('input,select').forEach(control=>control.disabled=!graded);
  form.querySelector('.result-context p').textContent=resultHints[status]+(!graded && form.elements.grade.value?' Kaydedildiğinde önceki not kaldırılır.':'');
}
function changeGradeKind(form){
  const control=form.elements.grade,kind=form.elements.grade_kind.value;
  form.dataset[control.dataset.kind==='numeric'?'numericGrade':'letterGrade']=control.value;
  form.querySelector('.grade-entry').innerHTML=gradeControl(kind,form.dataset[kind==='numeric'?'numericGrade':'letterGrade'] || '');
}

let requestCounter=0;
async function fetchSuggestions(){
  const request=++requestCounter, term=currentTerm(), tab=state.modalTab;
  const isSuggested=tab==='suggested';
  if(isSuggested && !state.suggestKind){modal.querySelector('#course-results').innerHTML='<p class="check-note">Katalogda plan türü bilinmiyor. Öneriler için dönemlik veya yıllık türünü seç.</p>';return;}
  const electivesOpen = modal.querySelector('.elective-courses')?.open;
  modal.querySelector('#course-results').innerHTML = '<p role="status">Dersler yükleniyor…</p>';
  const params=new URLSearchParams(isSuggested?{period_kind:state.suggestKind,period_number:state.suggestPeriod,limit:50,offset:0}:{all_periods:true,include_university_electives:true,q:state.searchQuery,limit:50,offset:state.searchOffset});
  try{
    const result=await api(`/terms/${term.id}/suggestions?${params}`);
    if(request!==requestCounter || !modal.open || state.modalTab!==tab)return;
    if(isSuggested){
      let page = result.courses;
      while (page.length === 50) {
        params.set('offset',result.courses.length);
        page = (await api(`/terms/${term.id}/suggestions?${params}`)).courses;
        if(request!==requestCounter || !modal.open || state.modalTab!==tab)return;
        result.courses = result.courses.concat(page);
      }
      state.suggestions=result.courses;state.suggestGroups=result.elective_groups;state.suggestCoverage=result.coverage_status;}
    else state.searchRows=result.courses;
    drawSuggestionResults(electivesOpen);
  }catch(error){if(request!==requestCounter)return;const target=modal.querySelector('#course-results');if(target){target.innerHTML=`<div class="notice">${icon('info')}<p>${e(error.message)}</p></div>`;}else showError(error);}
}
function drawSuggestionResults(electivesOpen = modal.querySelector('.elective-courses')?.open){
  const target=modal.querySelector('#course-results');if(!target)return;
  const suggested=state.modalTab==='suggested', source=suggested?state.suggestions:state.searchRows;
  const byRevision = new Map();
  for (const row of source) {
    let course = byRevision.get(row.course_revision_id);
    if (!course) {
      course = {...row, groups:new Set()};
      byRevision.set(row.course_revision_id,course);
    }
    if (row.elective_group_name) course.groups.add(row.elective_group_name);
  }
  const rows = Array.from(byRevision.values());
  const active=activeCourses();
  for (const course of active) pickedCourses.delete(course.course_id);
  const selectionBar = suggested ? `<div class="course-selection">
    ${button('pick-required','Eklenmemiş zorunlu dersleri seç','light small')}
    <button class="btn primary" type="button" data-action="save-picked" ${pickedCourses.size?'':'disabled'}>Seçilenleri ekle (${pickedCourses.size})</button>
    <p role="status">${e(batchMessage)}</p></div>` : '';
  const courseRow = (row,index) => {
    const added=active.find(course=>course.course_revision_id===row.course_revision_id || (row.course_id && course.course_id===row.course_id));
    return `<div class="suggestion-row">${courseIcon(row,index)}<div class="suggestion-main"><h3>${e(row.course_name)}</h3><p>${row.course_type?`<span class="pill ${row.course_type==='required'?'green':'gray'}">${row.is_university_elective?'Üniversite seçmelisi':row.course_type==='required'?'Zorunlu':'Seçmeli'}</span>`:''}${e(row.course_code)}${row.groups.size?` · ${e([...row.groups].join(', '))}`:''} · ${row.ects===null?'AKTS belirtilmedi':`${number(row.ects)} AKTS`}${row.period_number?` · ${row.period_number}. ${row.period_kind==='year'?'yıl':'dönem'}`:''}</p></div>${added?`<div class="suggestion-selection"><span class="suggestion-added">${icon('check')}Eklendi</span>${removeCourseButton(added)}</div>`:suggested?`<label class="course-choice"><input type="checkbox" data-change="pick-course" data-id="${row.course_revision_id}" ${pickedCourses.has(row.course_id)?'checked':''} aria-label="${e(row.course_name)} seç">Seç</label>`:button('enroll-catalog','Ekle','light small','plus',`data-id="${row.course_revision_id}"`)}</div>`;
  };
  const required = rows.filter(row=>row.course_type==='required');
  const electives = rows.filter(row=>row.course_type==='elective');
  const groups = state.suggestGroups || [];
  const groupInfo = suggested && groups.length ? `<div class="elective-info"><h3>${icon('book')}Seçmeli ders havuzları</h3>${groups.map(group=>`<p><strong>${e(group.name)}</strong>${group.required_course_count!==null?` · ${group.required_course_count} ders seçimi`:''}${group.required_ects!==null?` · ${number(group.required_ects)} AKTS`:''}</p>`).join('')}<small>Havuzda bulamadığın dersi elle ekleyebilirsin.</small></div>` : '';
  const showElectives = electives.length || groups.length;
  const electiveList = suggested && showElectives ? `
    <details class="elective-courses" ${electivesOpen?'open':''}>
      <summary><span>${electives.length?`Seçmeli dersler (${electives.length})`:'Seçmeli ders havuzları'}</span>${icon('chevron')}</summary>
      ${groupInfo}${electives.map(courseRow).join('')}
    </details>` : '';
  const courseList = suggested
    ? `${required.length?`<h3 class="required-heading">Zorunlu dersler (${required.length})</h3>`:''}${required.map(courseRow).join('')}${electiveList}`
    : rows.map(courseRow).join('');
  const noResults = !rows.length ? emptyState('Bu aramada bir ders bulunamadı.','Başka bir ders adı veya müfredat dönemi deneyebilir, kişisel ders ekleyebilirsin.','custom-tab','Kişisel ders ekle',true) : '';
  const coverage = suggested && state.suggestCoverage!=='complete' ? '<p class="check-note">Öneriler mevcut katalog bilgileriyle sınırlı. Eksik bir dersi kişisel olarak ekleyebilirsin.</p>' : '';
  const pagination = !suggested ? `<div class="load-more">${state.searchOffset>0?button('previous-results','Önceki','ghost small'):''}${source.length===50?button('more-results','Sonraki dersler','light small','arrow'):''}</div>` : '';
  target.innerHTML = selectionBar + coverage + courseList + noResults + pagination;
}
async function savePickedCourses() {
  if (savingCourses || !pickedCourses.size) return;
  const termId = state.termId;
  const failures = [], saved = [];
  savingCourses = true;
  modal.inert = true;
  modal.querySelector('[data-action="save-picked"]').textContent = 'Dersler ekleniyor…';
  try {
    for (const [courseId,row] of pickedCourses) {
      try {
        const enrollment = await api('/enrollments',{method:'POST',body:{
          term_id:termId, course_revision_id:row.course_revision_id, status:'in_progress'
        }});
        state.courses.push(enrollment);
        pickedCourses.delete(courseId);
        saved.push(row.course_code);
      } catch (error) {
        failures.push({row, message:error.message});
      }
    }
    if (failures.length) {
      try {
        state.courses = await allPages('/enrollments?include_archived=true');
      } catch (error) {
        // Keep confirmed writes and the per-course errors if the connection is still down.
        showError(error);
      }
      for (const {row} of failures) {
        if (activeCourses().some(course=>course.course_id===row.course_id)) {
          pickedCourses.delete(row.course_id);
          saved.push(row.course_code);
        }
      }
    }
    const remaining = failures.filter(({row})=>pickedCourses.has(row.course_id));
    batchMessage = [saved.length && 'Listede: '+saved.join(', '),
      ...remaining.map(({row,message})=>row.course_code+' eklenemedi: '+message)].filter(Boolean).join(' · ');
    if (saved.length) void refreshExams();
    if (remaining.length) render();
    else {await closeModal(true);showTermCourses();toast(batchMessage);}
  } finally {
    modal.inert = false;
    savingCourses = false;
    if(modal.open) drawSuggestionResults();
  }
}
function editCourseDialog(id){
  const course=state.courses.find(row=>row.id===id);if(!course)return;
  const custom=course.course_id===null;
  dialog('Ders kaydını düzenle',`${course.course_code} · ${course.course_name}`,`<form data-form="edit-course" data-id="${id}"><div class="modal-body form-grid">${custom?`<div class="field"><label for="edit-code">Ders kodu</label><input id="edit-code" name="custom_course_code" required maxlength="100" value="${e(course.course_code)}"></div><div class="field"><label for="edit-ects">AKTS</label><input id="edit-ects" name="custom_ects" type="number" min="0" max="120" step="0.01" value="${e(course.ects)}"></div><div class="field full"><label for="edit-name">Ders adı</label><input id="edit-name" name="custom_course_name" required maxlength="500" value="${e(course.course_name)}"></div>`:''}${resultFields(course)}<div class="form-error full"></div></div><div class="modal-foot">${button('close-modal','Vazgeç','light')}<button class="btn primary" type="submit">Değişiklikleri kaydet ${icon('check')}</button></div></form>`);
}
function removeCourseButton(course){return button('archive-course','Kaldır','remove-course small','close',`data-id="${course.id}" aria-label="${e(course.course_code)} dersini kaldır" title="Listeden kaldır; kayıt arşivde korunur"`);}
const pendingCourseChanges=new Set();
async function changeCourseArchive(id,restore=false){
  if(pendingCourseChanges.has(id))return;
  const course=state.courses.find(row=>row.id===id);if(!course)return;
  pendingCourseChanges.add(id);
  try{
    const restored = await api(restore?`/enrollments/${id}/restore`:`/enrollments/${id}`,{method:restore?'POST':'DELETE'});
    applyCourse(restored || {...course, archived_at:new Date().toISOString()});
    render();if(modal.open && modal.querySelector('#course-results'))drawSuggestionResults();
    if(restore){document.querySelectorAll(`[data-action="undo-remove"][data-id="${id}"]`).forEach(button=>button.closest('.toast')?.remove());toast(`${course.course_code} yeniden listende.`);}
    else toast(`${course.course_code} listenden kaldırıldı.`,false,id);
  }finally{pendingCourseChanges.delete(id);}
}

async function refreshAssignments(){state.assignments=await allPages('/assignments?include_archived=true');}
function refreshAssignmentResults(){
  const target=root.querySelector('#assignment-results');if(target)target.innerHTML=assignmentUI.results(state);
  const count=root.querySelector('#assignment-result-count');if(count)count.textContent=`${filterAssignments(state.assignments,{termId:state.assignmentTermId,view:state.assignmentFilter,archives:state.assignmentArchives,query:state.assignmentQuery,sort:state.assignmentSort}).length} ödev`;
}
function openAssignmentDialog(id=null,courseId=null){
  const item=id?state.assignments.find(row=>row.id===id):null;
  if(id && !item)return;
  const sourceCourse = courseId && state.courses.find(course=>course.id===courseId && !course.archived_at);
  const sourceTerm = sourceCourse && state.terms.find(term=>term.id===sourceCourse.term_id);
  const courses=state.courses.filter(course=>!course.archived_at && (!sourceTerm || course.term_id===sourceTerm.id));
  if(!item && !courses.length){dialog('Önce bir ders ekle','Ödevler kişisel ders kayıtlarına bağlanır.',`<div class="modal-body"><p class="check-note">Derslerim ekranından bir ders ekledikten sonra ödev oluşturabilirsin.</p></div>`,button('close-modal','Kapat','light'));return;}
  const preferredCourse=item?.enrollment_id || courseId || courses.find(course=>course.term_id===(state.assignmentTermId || state.termId) && course.status==='in_progress')?.id || '';
  const groups=[...new Set(courses.map(course=>course.term_id))].sort((a,b)=>Number(b===(state.assignmentTermId||state.termId))-Number(a===(state.assignmentTermId||state.termId)));
  dialog(item?'Ödevi düzenle':'Yeni ödev',sourceTerm?termLabel(sourceTerm):'Dersini seç, başlığını yaz, teslim gününü belirle.',`<form data-form="assignment" data-id="${item?.id || ''}"><div class="modal-body assignment-quick-body"><div class="field"><label for="assignment-course">Ders</label>${item?`<input id="assignment-course" value="${e(item.course_code+' · '+item.course_name)}" disabled>`:`<select id="assignment-course" name="enrollment_id" required><option value="">Ders seç</option>${groups.map(termId=>`<optgroup label="${e(termLabel(state.terms.find(term=>term.id===termId)))}">${courses.filter(course=>course.term_id===termId).map(course=>`<option value="${course.id}"${selected(course.id,preferredCourse)}>${e(course.course_code+' · '+course.course_name)}</option>`).join('')}</optgroup>`).join('')}</select>`}</div><div class="field"><label for="assignment-title">Ödev başlığı</label><input id="assignment-title" name="title" required maxlength="200" placeholder="Örn. 3. hafta alıştırmaları" value="${e(item?.title)}"></div><div class="field"><label for="assignment-due">Teslim tarihi</label><input id="assignment-due" name="due_at" type="date" required min="1900-01-01" max="2200-12-31" value="${e(assignmentDate(item?.due_at))}"><div class="assignment-date-shortcuts" role="group" aria-label="Hızlı teslim tarihi">${[[0,'Bugün'],[1,'Yarın'],[7,'1 hafta sonra']].map(([days,label])=>button('assignment-date',label,'light small','',`data-days="${days}"`)).join('')}</div><small>Teslim günü boyunca gecikmiş sayılmaz.</small></div><fieldset class="assignment-priority-picker"><legend>Önem</legend><div>${Object.entries(assignmentPriorities).map(([value,label])=>`<label class="priority-option priority-${value}"><input type="radio" name="priority" value="${value}"${value===(item?.priority || 'normal')?' checked':''}><span><i aria-hidden="true"></i>${label}</span></label>`).join('')}</div></fieldset><details class="assignment-extra"><summary>Not ekle <span>İsteğe bağlı${item?.description?' · Kayıtlı not var':''}</span></summary><div class="field"><label for="assignment-description">Kendine not</label><textarea id="assignment-description" name="description" maxlength="5000" rows="2" placeholder="Eklemek istediğin bir ayrıntı…">${e(item?.description)}</textarea></div></details><div class="form-error"></div></div><div class="modal-foot">${button('close-modal','Vazgeç','light')}<button type="submit" class="btn primary">${item?'Kaydet':'Ödevi ekle'} ${icon('check')}</button></div></form>`);
  modal.classList.add('assignment-dialog');
  if(!item)modal.querySelector(preferredCourse?'#assignment-title':'#assignment-course')?.focus();

}
const pendingAssignments=new Set();
async function changeAssignment(id,action){
  if(pendingAssignments.has(id))return;
  const item=state.assignments.find(row=>row.id===id);if(!item)return;
  pendingAssignments.add(id);
  try{
    if(action==='archive-assignment')await api(`/assignments/${id}`,{method:'DELETE'});
    else if(action==='restore-assignment')await api(`/assignments/${id}/restore`,{method:'POST'});
    else await api(`/assignments/${id}`,{method:'PATCH',body:{status:item.status==='completed'?'pending':'completed'}});
    await refreshAssignments();render();
    if(action==='archive-assignment')toast('Ödev arşivlendi.',false,{action:'restore-assignment',id});
    else{document.querySelectorAll(`[data-action="restore-assignment"][data-id="${id}"]`).forEach(button=>button.closest('.toast')?.remove());toast(action==='restore-assignment'?'Ödev geri yüklendi.':item.status==='completed'?'Ödev yeniden yapılacaklarda.':'Ödev tamamlandı.');}
  }finally{pendingAssignments.delete(id);}
}

async function submitForm(form){
  if(form.dataset.saving==='true')return;
  clearFormErrors(form);
  const data=Object.fromEntries(new FormData(form)), type=form.dataset.form;
  if(['profile','term'].includes(type) && !form.elements.program_id.value){fieldError(form,'program_id','Listeden bir bölüm seç.');form.querySelector('[aria-invalid="true"]')?.focus();return;}
  if((type==='profile' || (type==='term' && !form.dataset.id)) && form.elements.curriculum_id.disabled){formError(form,'Müfredat bilgisi yükleniyor. Biraz bekleyip tekrar dene.');return;}
  if(type==='term' && !form.elements.curriculum_id.value){formError(form,'Bölüm listesinden geçerli bir ders planı seç.');return;}
  setFormBusy(form,true);
  const error=form.querySelector('.form-error');if(error)error.textContent='';
  try{
    if(type==='login'){
      state.email=data.email.trim().toLowerCase();
      try{await api('/auth/login',{method:'POST',form:true,body:{username:state.email,password:data.password},quiet401:true});}
      catch(error){if(error.status===403){state.authMode='verify';renderAuth();toast('Giriş yapmadan önce okul adresini doğrula.',true);return;}throw error;}
      state.user=await api('/users/me');state.historyYear='';await loadWorkspace();location.hash=state.profile?'/overview':'/profile';render();toast('Hoş geldin.');
    }else if(type==='register'){
      state.email=data.email.trim().toLowerCase();
      try{await api('/auth/register',{method:'POST',body:{email:state.email,full_name:data.full_name,password:data.password},quiet401:true});}
      catch(error){
        if(error.status !== 503) throw error;
        verificationRequests.set(state.email, {retryAt: Date.now() + error.retryAfter * 1000, codeRequested: false});
        state.authMode='verify';renderAuth();toast(error.message,true);return;
      }
      verificationRequests.set(state.email, {retryAt: Date.now() + 60_000, codeRequested: true});
      state.authMode='verify';renderAuth();toast('Hesabın oluşturuldu. Şimdi e-posta adresini doğrula.');
    }else if(type==='request-reset'){
      const email = verificationEmail(data.email);
      if (recoveryRequests.get(email)?.retryAt > Date.now()) return;
      const response = await api('/auth/forgot-password',{method:'POST',body:{email},quiet401:true});
      recoveryRequests.set(email,{codeRequested:true,retryAt:Date.now()+response.retry_after*1000});
      if (form.isConnected && verificationEmail(form.elements.email.value) === email) {
        state.email = email;
        showResetFields();
        toast(response.message);
      }
    }else if(type==='reset-password'){
      if (data.password !== data.repeat) {
        fieldError(form,'repeat','Parolalar eşleşmiyor.');
        form.elements.repeat.focus();
        return;
      }
      const response = await api('/auth/reset-password',{method:'POST',
        body:{token:data.token.trim(),password:data.password},quiet401:true});
      state.email = verificationEmail(root.querySelector('#reset-email')?.value || state.email);
      recoveryRequests.delete(state.email);
      state.authMode='login';
      renderAuth();
      toast(response.message);
    }else if(type==='send-verification'){
      const email = verificationEmail(data.email);
      const request = verificationRequests.get(email);
      if (request?.retryAt > Date.now()) return;
      const response = await api('/auth/resend-verification', {method:'POST', body:{email}, quiet401:true});
      verificationRequests.set(email, {retryAt: Date.now() + 60_000, codeRequested: true});
      if (form.isConnected && verificationEmail(form.elements.email.value) === email) {
        state.email = email;
        const codeForm = root.querySelector('#verification-code');
        codeForm.reset();
        clearFormErrors(codeForm);
        syncVerificationStep(email, true);
        toast(response.message);
      }
    }else if(type==='verify'){
      const email = form.dataset.email;
      await api('/auth/verify-email',{method:'POST',body:{token:data.token.trim()},quiet401:true});
      verificationRequests.delete(email);
      state.email = email;
      state.authMode='login';renderAuth();toast('E-posta adresin doğrulandı. Giriş yapabilirsin.');
    }else if(type==='profile'){
      if (form.querySelector('.profile-actions').hidden) return;
      const first=!state.profile, previousPreparation=state.profile?.preparation_status;
      state.profile=await api('/users/me/academic-profile',{method:'PUT',body:{program_id:Number(data.program_id),curriculum_id:Number(data.curriculum_id),entry_year:Number(data.entry_year),preparation_status:data.preparation_status,current_class:Number(data.current_class)}});
      if(previousPreparation!==state.profile.preparation_status)state.termId=preferredTerm()?.id || null;
      cleanForm(form);
      if(first)location.hash='/profile';render();toast(first?'Profilin hazır. İlk dönemini oluşturarak devam edebilirsin.':'Akademik profilin güncellendi.');
    }else if(type==='term'){
      const editing=Boolean(form.dataset.id), prep=form.elements.is_preparation.checked;
      const body={academic_year:Number(data.academic_year),term_type:data.term_type,curriculum_period_kind:prep || !data.curriculum_period_number?null:form.elements.curriculum_period_kind.value,curriculum_period_number:prep || !data.curriculum_period_number?null:Number(data.curriculum_period_number)};
      if(!editing)Object.assign(body,{is_preparation:prep,program_id:Number(data.program_id),curriculum_id:Number(data.curriculum_id)});
      const term=await api(editing?`/terms/${form.dataset.id}`:'/terms',{method:editing?'PATCH':'POST',body});
      cleanForm(form);
      state.terms = [term,...state.terms.filter(item=>item.id!==term.id)].sort((a,b)=>b.academic_year-a.academic_year || a.id-b.id);
      state.termId=term.id;void refreshExams();await closeModal(true);
      if(editing) render(); else showTermCourses();toast(editing?'Dönemin güncellendi.':'Dönemin hazır. Şimdi derslerini ekleyebilirsin.');
    }else if(type==='custom-course' || type==='edit-course'){
      const editing=type==='edit-course';
      let grade=gradedStatuses.includes(data.status)?(data.grade || '').trim():'';
      if(grade && data.grade_kind==='numeric'){
        if(!numericGrade(grade) || Number(grade.replace(',','.'))>100){fieldError(form,'grade','0–100 arasında bir not yaz. Ondalık için virgül veya nokta kullanabilirsin.');form.elements.grade.focus();return;}
        grade=grade.replace(',','.');
      }
      const body={status:data.status,grade:grade || null};
      if('custom_course_code' in data)Object.assign(body,{custom_course_code:data.custom_course_code.trim(),custom_course_name:data.custom_course_name.trim(),custom_ects:data.custom_ects===''?null:data.custom_ects});
      if(!editing)body.term_id=state.termId;
      const course = await api(editing?`/enrollments/${form.dataset.id}`:'/enrollments',{method:editing?'PATCH':'POST',body});
      applyCourse(course);cleanForm(form);await closeModal(true);if(editing) render(); else showTermCourses();toast(editing?'Ders bilgilerin güncellendi.':'Kişisel dersin listeye eklendi.');
    }else if(type==='assignment'){
      const editing=Boolean(form.dataset.id);
      const body={title:data.title.trim(),description:data.description.trim() || null,due_at:assignmentDateEnd(data.due_at),priority:data.priority};
      if(!editing)body.enrollment_id=Number(data.enrollment_id);
      const saved = await api(editing?`/assignments/${form.dataset.id}`:'/assignments',{method:editing?'PATCH':'POST',body});
      state.assignments = [...state.assignments.filter(item=>item.id!==saved.id),saved];
      cleanForm(form);
      await closeModal(true);
      render();
      toast(editing?'Ödev güncellendi.':'Ödev eklendi.');
    }else if(type==='exam-search'){
      const output=form.parentElement.querySelector('[data-exam-results]');
      output.textContent='Sınavlar aranıyor…';
      try {
        const result=await api('/exams/search?'+new URLSearchParams({term_id:state.termId,q:data.query.trim()}));
        output.innerHTML=examUI.searchResults(result);
      } catch(error) {
        output.textContent='';
        throw error;
      }
    }else if(type==='course-search'){
      const query = data.query.trim();
      if (state.modalTab==='catalog' || query) {
        state.searchQuery = query;
        state.searchOffset = 0;
        if (state.modalTab!=='catalog') {
          state.modalTab='catalog';
          drawCourseDialog();
          modal.querySelector('[name="query"]').focus();
        }
      }
      await fetchSuggestions();
    }
  }catch(error){
    if (type === 'send-verification' || type === 'request-reset') {
      const requests = type === 'request-reset' ? recoveryRequests : verificationRequests;
      const email = verificationEmail(data.email);
      if (error.retryAfter) {
        requests.set(email, {
          retryAt: Date.now() + error.retryAfter * 1000,
          codeRequested: Boolean(requests.get(email)?.codeRequested),
        });
      }
      if (!form.isConnected || verificationEmail(form.elements.email.value) !== email) return;
    }
    if(!applyFieldErrors(form,error.fields))formError(form,error.message || 'İşlem tamamlanamadı.');
  }finally{
    setFormBusy(form,false);
    if (type === 'send-verification' || type === 'request-reset') syncVerificationButton();
  }
}

let permittedHash=null;
let currentHash=location.hash;
document.addEventListener('form-navigation-blocked',()=>toast('Kaydetme işlemi sürüyor. Biraz bekle.',true));
const replayedActions=new WeakSet();
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');
  if(target && replayedActions.has(target)){replayedActions.delete(target);return;}
  const link=event.target.closest('a[href^="#/"]');
  if(link && link.hash!==location.hash){
    if(!needsLeaveCheck(document)){permittedHash=link.hash;return;}
    event.preventDefault();event.stopImmediatePropagation();
    if(await canLeave(document)){permittedHash=link.hash;location.hash=link.hash;}
    return;
  }
  const action=target?.dataset.action;
  const replacesModal=['new-term','edit-term','add-course','edit-course','course-tab','custom-tab','delete-term','new-assignment','edit-assignment'];
  const scope=action==='logout'?document:modal.open && replacesModal.includes(action)?modal:null;
  if(scope && needsLeaveCheck(scope)){
    event.preventDefault();event.stopImmediatePropagation();
    if(await canLeave(scope) && target.isConnected){replayedActions.add(target);target.click();}
  }
},true);
root.addEventListener('input', event => {
  if (event.target.id === 'reset-email') {
    const fields = root.querySelector('[data-form="reset-password"]');
    fields.reset();
    clearFormErrors(fields);
    fields.hidden = true;
    root.querySelector('[data-action="have-reset-code"]').hidden = false;
    syncVerificationButton();
    return;
  }
  if (event.target.id !== 'verify-email') return;
  state.email = verificationEmail(event.target.value);
  event.target.form.querySelector('.form-error').textContent = '';
  syncVerificationStep(state.email);
  syncVerificationButton();
});
document.addEventListener('submit',event=>{const form=event.target.closest('form[data-form]');if(form){event.preventDefault();submitForm(form);}});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target || target.disabled)return;
  const action=target.dataset.action, id=Number(target.dataset.id);
  try{
    if(action==='retry-workspace') await boot();
    else if(action==='toggle-program'){const picker=target.closest('.program-picker');const input=picker.querySelector('[role="combobox"]');input.focus();showProgramOptions(picker);}
    else if(action==='select-program')await chooseProgram(target.closest('.program-picker'),id,target.dataset.plan);
    else if(action==='toggle-login-password'){
      const input = root.querySelector('#login-password');
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      const toggle = root.querySelector('[data-action="toggle-login-password"]');
      toggle.textContent = visible ? 'Gizle' : 'Göster';
      toggle.setAttribute('aria-label', visible ? 'Parolayı gizle' : 'Parolayı göster');
    }
    else if(action==='have-reset-code') showResetFields();
    else if(action.startsWith('auth-')){state.email=root.querySelector('input[name="email"]')?.value || state.email;state.authMode=action.slice(5);renderAuth();}
    else if(action==='logout'){
      await api('/auth/logout',{method:'POST',quiet401:true});state.user=null;state.profile=null;state.courses=[];state.assignments=[];state.assignmentTermId=null;state.assignmentFilter='all';state.assignmentQuery='';state.assignmentArchives=false;state.terms=[];state.examCalendars=[];state.examSync=null;state.termId=null;state.status='all';state.archives=false;state.courseQuery='';state.courseSort='name';state.courseView='cards';state.authMode='login';closeModal(true);renderAuth();toast('Güvenli şekilde çıkış yaptın.');
    }else if(action==='toggle-menu' || action==='close-menu'){
      setMobileMenu(root,action==='close-menu'?false:!root.querySelector('.workspace')?.classList.contains('menu-open'));
    }else if(action==='close-modal')await closeModal();
    else if(action==='assignment-date'){
      const input=modal.querySelector('#assignment-due');if(input){input.value=assignmentDateOffset(Number(target.dataset.days));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();}
    }
    else if(action==='new-assignment')openAssignmentDialog(null,Number(target.dataset.course) || null);
    else if(action==='edit-assignment')openAssignmentDialog(id);
    else if(['toggle-assignment','archive-assignment','restore-assignment'].includes(action)){target.disabled=true;await changeAssignment(id,action);}
    else if(action==='assignment-filter'){state.assignmentFilter=target.dataset.filter;render();root.querySelector(`[data-action="assignment-filter"][data-filter="${state.assignmentFilter}"]`)?.focus({preventScroll:true});}
    else if(action==='retry-curricula') {
      const form = target.closest('form');
      if (form.dataset.form === 'term') await chooseProgram(form.querySelector('.program-picker'),Number(form.elements.program_id.value));
      else await fillCurricula(form,form.elements.program_id.value);
    }
    else if(action==='new-term')await openTermDialog();
    else if(action==='edit-term')await openTermDialog(true);
    else if(action==='add-course')await openCourseDialog();
    else if(action==='edit-course')editCourseDialog(id);
    else if(action==='archive-course'){
      target.disabled=true;await changeCourseArchive(id);
    }else if(action==='restore-course' || action==='undo-remove'){
      target.disabled=true;await changeCourseArchive(id,true);
    }else if(action==='course-view'){state.courseView=target.dataset.view;render();root.querySelector(`[data-action="course-view"][data-view="${state.courseView}"]`)?.focus({preventScroll:true});}
    else if(action==='reset-course-search'){state.courseQuery='';state.status='all';render();}
    else if(action==='course-filter'){state.status=target.dataset.status;render();root.querySelector(`[data-action="course-filter"][data-status="${state.status}"]`)?.focus({preventScroll:true});}
    else if(action==='clear-filter'){state.status='all';render();}
    else if(action==='show-exam-file'){
      const rows=await api(`/exams/documents/${id}/rows`);
      if(target.isConnected) dialog('Sınav programı',target.closest('.exam-candidate').querySelector('strong').textContent,
        `<div class="modal-body">${rows.map(row=>`<article class="exam-candidate"><div><strong>${e(row.code)} · ${e(row.name)}</strong><p>${e(new Date(row.starts_at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'medium',timeStyle:'short'}))}</p><small>${[row.program,row.section,row.room].filter(Boolean).map(e).join(' · ')}</small></div></article>`).join('')}</div>`,'',true);
    }
    else if(action==='refresh-exams'){
      target.disabled=true;
      try{await refreshExams();}finally{target.disabled=false;}
    }
    else if(action==='select-exam'){
      target.disabled=true;
      try{await api('/exams/selection',{method:'PUT',body:{enrollment_id:id,exam_type:target.dataset.examType,document_id:Number(target.dataset.document),sheet:target.dataset.sheet,row_number:Number(target.dataset.row)}});void refreshExams();toast('Sınav grubun kaydedildi.');}finally{target.disabled=false;}
    }
    else if(action==='previous-course-results')openPreviousResults(id);
    else if(action==='view-term'){state.termId=id;state.archives=false;showTermCourses();}
    else if(action==='course-tab' || action==='custom-tab'){
      ++requestCounter;state.modalTab=action==='custom-tab'?'custom':target.dataset.tab;drawCourseDialog();if(state.modalTab!=='custom')await fetchSuggestions();
    }else if(action==='pick-required'){
      const active = new Set(activeCourses().map(course=>course.course_id));
      for (const row of state.suggestions) {
        if (row.course_type==='required' && !active.has(row.course_id)) pickedCourses.set(row.course_id,row);
      }
      drawSuggestionResults();
    }else if(action==='save-picked') await savePickedCourses();
    else if(action==='enroll-catalog'){
      target.disabled=true;const course = await api('/enrollments',{method:'POST',body:{term_id:state.termId,course_revision_id:id,status:'in_progress'}});
      applyCourse(course);render();drawSuggestionResults();toast('Ders listene eklendi.');
    }else if(action==='more-results' || action==='previous-results'){
      const delta=action==='more-results'?50:-50;
      state.searchOffset=Math.max(0,state.searchOffset+delta);
      await fetchSuggestions();
    }else if(action==='delete-term'){
      dialog('Boş dönemi silmek istiyor musun?','Ders geçmişi içeren dönemler silinemez.',`<div class="modal-body"><p class="check-note">Bu işlem boş dönemi kaldırır. Ders kaydı bulunan dönemler, dersler arşivlenmiş olsa bile korunur.</p></div>`,`${button('close-modal','Vazgeç','light')}${button('confirm-delete-term','Boş dönemi sil','danger','',`data-id="${id}"`)}`);
    }else if(action==='confirm-delete-term'){
      await api(`/terms/${id}`,{method:'DELETE'});state.terms=await allPages('/terms');void refreshExams();state.termId=preferredTerm()?.id || null;closeModal(true);render();toast('Boş dönem kaldırıldı.');
    }
  }catch(error){showError(error);}finally{if(target.isConnected)target.disabled=false;}
});
document.addEventListener('change',async event=>{
  const target=event.target, action=target.dataset.change, form=target.closest('form');
  if (['active-term','assignment-term'].includes(action) && location.hash.includes('?')) {
    currentHash = location.hash.split('?')[0];
    history.replaceState(null,'',currentHash);
  }
  try{
    if(action==='pick-course'){
      const row = state.suggestions.find(item=>item.course_revision_id===Number(target.dataset.id));
      if (target.checked) pickedCourses.set(row.course_id,row);
      else pickedCourses.delete(row.course_id);
      drawSuggestionResults();
      modal.querySelector(`[data-change="pick-course"][data-id="${row.course_revision_id}"]`)?.focus();
    }else if(action==='result-status')syncResultStatus(form);
    else if(action==='grade-kind')changeGradeKind(form);
    else if(action==='assignment-term'){state.assignmentTermId=Number(target.value) || null;render();root.querySelector('[data-change="assignment-term"]')?.focus({preventScroll:true});}
    else if(action==='assignment-sort'){state.assignmentSort=target.value;refreshAssignmentResults();}
    else if(action==='assignment-archives'){state.assignmentArchives=target.checked;render();root.querySelector('[data-change="assignment-archives"]')?.focus({preventScroll:true});}
    else if(action==='course-sort'){state.courseSort=target.value;refreshCourseResults();}
    else if(action==='active-term'){state.termId=Number(target.value) || null;render();root.querySelector('[data-change="active-term"]')?.focus({preventScroll:true});}
    else if(action==='show-archives'){state.archives=target.checked;render();}
    else if(form?.dataset.form === 'profile') {
      const fields = form.elements;
      if(action === 'profile-unit' || action === 'profile-program') {
        if(action === 'profile-unit') {
          const picker = form.querySelector('.program-picker');
          picker.dataset.unit = target.value;
          fields.program_id.value = '';
          fields.program_label.value = '';
          picker.querySelector('.program-selection').textContent = 'Bölüm seç';
          closeProgramPicker(picker);
        }
        fields.entry_year.value = '';
        fields.preparation_status.value = '';
        fields.current_class.value = '';
        const loading = fillCurricula(form,fields.program_id.value);
        revealProfileFields(form);
        await loading;
      } else if(action === 'profile-curriculum' || action === 'profile-preparation') {
        fields.current_class.value = '';
        updateClass(form);
      }
      revealProfileFields(form);
    } else if(action==='term-preparation')updateTermFields(form,form.elements.curriculum_period_number.value);
    else if(action==='term-kind')updateTermFields(form);
    else if(action==='suggest-kind'){state.suggestKind=target.value;const cu=(state.curricula.get(currentTerm().program_id)||[]).find(c=>c.id===currentTerm().curriculum_id);state.suggestMax=target.value==='year'?Math.ceil((cu?.semester_count||8)/2):(cu?.semester_count||8);drawCourseDialog();await fetchSuggestions();}
    else if(action==='history-year'){state.historyYear=target.value;render();}
    else if(action==='suggest-period'){state.suggestPeriod=Number(target.value);await fetchSuggestions();}
  }catch(error){showError(error);}
});
document.addEventListener('input',event=>{
  const target=event.target;
  if(target.dataset.input==='assignment-search'){state.assignmentQuery=target.value;refreshAssignmentResults();}
  if(target.dataset.input==='personal-course-search'){state.courseQuery=target.value;refreshCourseResults();}
  if(target.dataset.input==='program-combobox'){
    const picker=target.closest('.program-picker'),form=picker.closest('form');
    picker.querySelector('[name="program_id"]').value='';picker.querySelector('.program-selection').textContent='Arama sonuçlarından bir bölüm seç.';
    form.elements.curriculum_id.disabled=false;
    if (form.dataset.form === 'term') {
      setTermPlan(form,null);
    } else {
      form.elements.curriculum_id.innerHTML='<option value="">Önce bölümünü seç</option>';
      resetProfileDetails(form);
      form.elements.curriculum_id.closest('.field').hidden = true;
      revealProfileFields(form);
    }
    showProgramOptions(picker,target.value);
  }
});
document.addEventListener('focusin',event=>{if(event.target.matches('[data-input="program-combobox"]'))showProgramOptions(event.target.closest('.program-picker'));});
document.addEventListener('click',event=>{document.querySelectorAll('.program-picker').forEach(picker=>{if(!picker.contains(event.target))closeProgramPicker(picker);});});
document.addEventListener('keydown',event=>{
  const input=event.target.closest('[data-input="program-combobox"]');if(!input)return;
  const picker=input.closest('.program-picker'),list=picker.querySelector('[role="listbox"]');
  if(event.key==='Escape' || event.key==='Tab'){closeProgramPicker(picker);return;}
  if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
  if(event.key==='Enter' && list.hidden)return;
  event.preventDefault();if(list.hidden)showProgramOptions(picker,input.value);
  const options=[...list.querySelectorAll('[role="option"]')];if(!options.length)return;
  let index=Number(picker.dataset.index ?? -1);
  if(event.key==='Enter'){if(index>=0)chooseProgram(picker,Number(options[index].dataset.id),options[index].dataset.plan).catch(showError);return;}
  index=(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;picker.dataset.index=index;
  options.forEach((option,i)=>option.classList.toggle('keyboard-active',i===index));input.setAttribute('aria-activedescendant',options[index].id);options[index].scrollIntoView({block:'nearest'});
});
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
modal.addEventListener('click',event=>{if(event.target===modal){const bounds=modal.getBoundingClientRect();if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom)closeModal();}});
function renderDestination() {
  const [page, query] = location.hash.slice(2).split('?');
  const params = new URLSearchParams(query);
  const termId = Number(params.get('term'));
  const recordId = Number(params.get('record'));
  let targetId;
  if (recordId && state.terms.some(term=>term.id===termId)) {
    if (page === 'assignments' && state.assignments.some(item=>item.id===recordId && item.term_id===termId)) {
      state.termId = state.assignmentTermId = termId;
      state.assignmentFilter = 'all';
      state.assignmentQuery = '';
      targetId = `assignment-${recordId}`;
    } else if (page === 'exams') {
      state.termId = termId;
      targetId = `exam-${recordId}-${params.get('type')}`;
    }
  }
  render();
  const target = targetId && document.getElementById(targetId);
  if (target) {
    const course=target.closest('details.exam-course');
    if (course) course.open=true;
    target.focus({preventScroll:true});
    target.scrollIntoView({block:'center'});
  } else root.querySelector('main')?.focus({preventScroll:true});
}
window.addEventListener('hashchange',async()=>{
  const requested=location.hash;
  if(requested==='#main-content'){history.replaceState(null,'',currentHash);const main=root.querySelector('main');if(main){main.tabIndex=-1;main.focus();}return;}
  if(permittedHash!==requested && needsLeaveCheck(document)){
    history.replaceState(null,'',currentHash);
    if(await canLeave(document)){permittedHash=requested;location.hash=requested;}
    return;
  }
  permittedHash=null;currentHash=requested;closeModal(true);renderDestination();
});

async function boot(){
  try{
    state.config=await api('/ui-config',{quiet401:true});
    document.title=`${applicationName()} · Öğrenci alanı`;
    try{state.user=await api('/users/me',{quiet401:true});}catch(error){if(error.status!==401)throw error;}
    if(state.user){await loadWorkspace();renderDestination();}else renderAuth();
  }catch(error){
    if(error.status===401) return renderAuth();
    root.innerHTML=emptyState('Öğrenci alanı yüklenemedi',error.message,'retry-workspace','Yeniden dene');
  }
}
boot();

function examsView(){return examUI.page(state);}
