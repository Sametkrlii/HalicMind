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
const state = {user:null,profile:null,terms:[],examCalendars:[],examSync:null,courses:[],assignments:[],assignmentTermId:null,assignmentFilter:'all',assignmentArchives:false,assignmentQuery:'',assignmentSort:'due',programs:[],units:[],curricula:new Map(),termId:null,page:'overview',authMode:'login',email:'',config:{},status:'all',archives:false,courseView:'cards',courseQuery:'',courseSort:'name',modalTab:'suggested',suggestions:[],suggestOffset:0,suggestQuery:'',suggestPeriod:null,searchOffset:0,searchQuery:'',searchRows:[],busy:false};
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
let modalTrigger=null;
function moveModalToasts(){modal.querySelectorAll('.modal-feedback .toast').forEach(item=>document.querySelector('#toasts').append(item));}
async function closeModal(force=false){if(!force && !await canLeave(modal))return false;moveModalToasts();if(modal.open) modal.close(); modal.innerHTML='';if(modalTrigger?.isConnected)modalTrigger.focus({preventScroll:true});else root.querySelector('main')?.focus({preventScroll:true});return true; }
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
  root.innerHTML=`<div class="auth-layout"><aside class="auth-story">${brand()}<div class="story-content"><div class="eyebrow">HALİÇ'TEN BAŞLAYAN BİR YOL</div><h1>Kendi döneminin<br><em>kontrolünü al.</em></h1><p>Derslerin, planın ve akademik geçmişin.<br>Hepsi senin düzeninde.</p><div class="story-art" aria-hidden="true"><img src="/assets/halic-lines.svg" alt=""><div class="art-caption"><span>41.08585° N · 28.95219° E</span><strong>5. Levent Yerleşkesi</strong></div></div></div><div class="story-foot">${icon('graduation')}Haliç öğrencileri için bağımsız bir çalışma alanı.</div></aside><main class="auth-side" id="main-content"><div class="auth-card"><div class="eyebrow">ÖĞRENCİ ÇALIŞMA ALANI</div>${mode!=='verify'?`<div class="auth-tabs" role="tablist" aria-label="Hesap işlemleri"><button role="tab" aria-selected="${mode==='login'}" class="${mode==='login'?'active':''}" data-action="auth-login">Giriş yap</button><button role="tab" aria-selected="${mode==='register'}" class="${mode==='register'?'active':''}" data-action="auth-register">Hesap oluştur</button></div>`:''}${mode==='login'?loginView():mode==='register'?registerView():verifyView()}<div class="auth-privacy">${icon('shield')}Doğrulanmış okul e-postasıyla erişim.</div></div></main></div>${siteFooter()}`;
  prepareAccessibility(root);syncResendCooldown();
}
function loginView(){ return `<h2>Çalışma alanına giriş yap.</h2><p>Öğrenci hesabına giriş yap, kaldığın yerden devam et.</p><form data-form="login"><div class="field"><label for="login-email">Okul e-posta adresin</label><input id="login-email" name="email" type="email" autocomplete="username" required placeholder="ogrenci_no@ogr.halic.edu.tr" value="${e(state.email)}"></div><div class="field"><label for="login-password">Parolan</label><input id="login-password" name="password" type="password" autocomplete="current-password" required maxlength="128" placeholder="Parolanı gir"></div><div class="form-error"></div><button class="btn primary wide" type="submit">Giriş yap ${icon('arrow')}</button></form><div class="auth-bottom">E-postanı henüz doğrulamadın mı? <button class="text-btn" data-action="auth-verify">Adresimi doğrula</button></div>`; }
function registerView(){ return `<h2>Öğrenci hesabını oluştur.</h2><p>Okul e-postanla kaydol, akademik alanını oluşturmaya başla.</p><form data-form="register"><div class="field"><label for="register-name">Adın ve soyadın</label><input id="register-name" name="full_name" autocomplete="name" required maxlength="200" placeholder="Ad Soyad"></div><div class="field"><label for="register-email">Okul e-posta adresin</label><input id="register-email" name="email" type="email" autocomplete="username" required placeholder="ogrenci_no@ogr.halic.edu.tr" value="${e(state.email)}"><small>Yalnızca @ogr.halic.edu.tr uzantılı öğrenci adresleri.</small></div><div class="field"><label for="register-password">Bir parola belirle</label><input id="register-password" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="128" placeholder="En az 12 karakter"><small>Başka hesaplarında kullanmadığın bir parola seç.</small></div><p class="registration-notice">Hesap ve akademik verilerinin kullanımı için <a href="#/legal/privacy">Gizlilik</a> ve <a href="#/legal/kvkk">KVKK aydınlatma taslağını</a> inceleyebilirsin.</p><div class="form-error"></div><button class="btn primary wide" type="submit">Hesabımı oluştur ${icon('arrow')}</button></form>`; }
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
  const cu=[...state.curricula.values()].flat().find(row=>row.id===Number(curriculumId));
  return cu?.period_kinds?.length===1?cu.period_kinds[0]:null;
}

async function loadWorkspace(){
  await loadCatalog();
  const results=await Promise.all([api('/users/me/academic-profile').catch(error=>{if(error.status===404)return null;throw error;}),allPages('/terms'),allPages('/enrollments?include_archived=true'),allPages('/assignments?include_archived=true'),api('/exams/calendar'),api('/exams/sync-status')]);
  [state.profile,state.terms,state.courses,state.assignments,state.examCalendars,state.examSync]=results;
  if(!state.terms.some(term=>term.id===state.termId)) state.termId=preferredTerm()?.id || null;
  await Promise.all([...new Set([...state.terms.map(t=>t.program_id),...(state.profile?[state.profile.program_id]:[])])].map(curriculaFor));
}
async function refreshCourses(){state.courses=await allPages('/enrollments?include_archived=true');await refreshAssignments();state.examCalendars=await api('/exams/calendar');}
function navLink(page,label,glyph,count='') {return `<a class="nav-link ${state.page===page?'active':''}" href="#/${page}" ${state.page===page?'aria-current="page"':''}>${icon(glyph)}${label}${count!==''?`<span class="nav-count">${count}</span>`:''}</a>`;}
function render(){
  if(isLegal() && renderLegal())return;
  if(!state.user) return renderAuth();
  const requested=location.hash.replace(/^#\//,'');
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

function courseCards(courses){return `<div class="courses-grid">${courses.map((course,index)=>`<article class="course-card ${course.archived_at?'archived':''}"><div class="course-card-top">${courseIcon(course,index)}${course.archived_at?'<span class="pill gray">Arşivlendi</span>':pill(course.status)}</div><div><h3>${e(course.course_name)}</h3><div class="course-meta"><span>${e(course.course_code)}</span><span>·</span><span>${course.ects===null?'AKTS belirtilmedi':`${number(course.ects)} AKTS`}</span>${course.course_id===null?'<span>· Kişisel ders</span>':''}</div></div><div class="course-card-footer"><span class="grade-label">${!gradedStatuses.includes(course.status)?(course.status==='in_progress'?'Ders devam ediyor':'Not uygulanmaz'):course.grade?`Not: <strong>${e(course.grade)}</strong>`:'Sonuç notu eklenmedi'}</span><div class="card-actions">${course.archived_at?button('restore-course','Geri yükle','light small','restore',`data-id="${course.id}"`):`<button class="icon-btn" data-action="edit-course" data-id="${course.id}" aria-label="${e(course.course_code)} dersini düzenle" title="Sonuç ve notu düzenle">${icon('edit')}</button>${removeCourseButton(course)}`}</div></div></article>`).join('')}</div>`;}
function courseList(courses){return `<div class="panel course-list-panel"><div class="table-scroll"><table class="personal-course-table"><thead><tr><th>Ders</th><th>AKTS</th><th>Durum</th><th>Not</th><th><span class="sr-only">İşlemler</span></th></tr></thead><tbody>${courses.map(course=>`<tr class="${course.archived_at?'archived-row':''}"><td><strong>${e(course.course_name)}</strong><small>${e(course.course_code)}${course.course_id===null?' · Kişisel':''}${course.archived_at?' · Arşivde':''}</small></td><td>${course.ects===null?'—':number(course.ects)}</td><td>${pill(course.status)}</td><td>${e(gradedStatuses.includes(course.status)?course.grade || '—':'—')}</td><td><div class="list-actions">${course.archived_at?button('restore-course','Geri yükle','light small','restore',`data-id="${course.id}"`):`<button class="icon-btn" data-action="edit-course" data-id="${course.id}" aria-label="${e(course.course_code)} dersini düzenle">${icon('edit')}</button>${removeCourseButton(course)}`}</div></td></tr>`).join('')}</tbody></table></div></div>`;}
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

function historyView(){
  const visible=state.terms.filter(t=>!state.historyYear || String(t.academic_year)===state.historyYear).sort((a,b)=>b.academic_year-a.academic_year || Number(a.is_preparation)-Number(b.is_preparation) || ({annual:0,summer:1,spring:2,fall:3}[a.term_type]-{annual:0,summer:1,spring:2,fall:3}[b.term_type]));
  const total=state.courses.filter(c=>!c.archived_at);
  return `<div class="page-title"><div><div class="eyebrow">AKADEMİK ARŞİV</div><h1>Dönem geçmişin</h1><p>Kaydettiğin tüm dönemler, dersler ve sonuçlar. Güncel dönemin de burada görünür.</p></div>${button('new-term','Dönem ekle','primary','plus')}</div><div class="history-overview"><div><strong>${state.terms.length}</strong><span>Kayıtlı dönem</span></div><div><strong>${total.length}</strong><span>Aktif ders kaydı</span></div><div><strong>${total.filter(c=>['passed','exempt'].includes(c.status)).length}</strong><span>Başarılı / muaf kayıt</span></div><div><strong>${state.courses.filter(c=>c.archived_at).length}</strong><span>Arşivlenen kayıt</span></div></div><div class="toolbar"><p class="check-note">Geçmişi doldurmak isteğe bağlıdır. Tekrar alınan dersler kendi dönemlerinde saklanır.</p><select aria-label="Akademik yıla göre filtrele" data-change="history-year"><option value="">Tüm akademik yıllar</option>${[...new Set(state.terms.map(t=>t.academic_year))].map(y=>`<option value="${y}"${selected(y,state.historyYear)}>${y}–${y+1}</option>`).join('')}</select></div>${visible.length?visible.map((term,index)=>{
    const all=state.courses.filter(c=>c.term_id===term.id),courses=all.filter(c=>!c.archived_at),credits=courses.reduce((sum,c)=>sum+Number(c.ects || 0),0);
    const cu=(state.curricula.get(term.program_id) || []).find(c=>c.id===term.curriculum_id);
    return `<details class="history-term" ${index===0?'open':''}><summary><span class="history-year">${term.academic_year}<small>${e(termNames[term.term_type])}</small></span><span class="history-heading"><strong>${e(termLabel(term))}</strong><span>${e(programName(term.program_id))}</span></span><span class="history-total">${courses.length} ders <small>${number(credits)} AKTS ${icon('chevron')}</small></span></summary><div class="history-detail"><div class="history-facts"><div><span>Ders planı</span><strong>${e(cu?curriculumLabel(cu):`Plan #${term.curriculum_id}`)}</strong></div><div><span>Öneri dönemi</span><strong>${term.is_preparation?'Hazırlık · bölüm planından ayrı':term.curriculum_period_number?`${term.curriculum_period_number}. ${term.curriculum_period_kind==='year'?'yıl':'dönem'}`:'Seçilmedi'}</strong></div><div><span>Sonuç dağılımı</span><strong>${courses.filter(c=>c.status==='passed').length} başarılı · ${courses.filter(c=>c.status==='failed').length} başarısız · ${courses.filter(c=>c.status==='in_progress').length} devam · ${courses.filter(c=>c.status==='exempt').length} muaf · ${courses.filter(c=>c.status==='withdrawn').length} bırakıldı</strong></div></div>${all.length?`<div class="table-scroll"><table class="history-table"><thead><tr><th>Ders / kod</th><th>Kaynak</th><th>AKTS</th><th>Durum</th><th>Not</th><th>Kayıt</th></tr></thead><tbody>${all.map(course=>`<tr class="${course.archived_at?'archived-row':''}"><td><strong>${e(course.course_name)}</strong><small>${e(course.course_code)}</small></td><td>${course.course_id===null?'Kişisel':'Katalog'}</td><td>${course.ects===null?'—':number(course.ects)}</td><td>${pill(course.status)}</td><td><strong>${e(gradedStatuses.includes(course.status)?course.grade || '—':'—')}</strong></td><td>${course.archived_at?`<span class="pill gray">Arşiv</span><small>${e(new Intl.DateTimeFormat('tr-TR').format(new Date(course.archived_at)))}</small>`:'Aktif'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="check-note">Bu döneme henüz ders eklenmedi.</p>'}<div class="history-actions"><small>AKTS toplamı aktif kayıtlar içindir; resmi transkript veya not ortalaması değildir.</small>${button('view-term','Bu dönemi yönet','light small','arrow',`data-id="${term.id}"`)}</div></div></details>`;
  }).join(''):`<div class="panel">${emptyState('Henüz dönem kaydı yok.','Güncel veya geçmiş bir dönem ekleyerek başlayabilirsin.','new-term','Dönem ekle',false,'history')}</div>`}`;
}
const normalizeSearch = value => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function matchingPrograms(unit,query=''){
  const aliases={pc:'bilgisayar',bil:'bilgisayar',computer:'bilgisayar',software:'yazilim',muh:'muhendis',eng:'muhendis'};
  const words=normalizeSearch(query).split(' ').filter(Boolean).map(word=>aliases[word] || word);
  return state.programs.filter(p=>(!unit || p.academic_unit_id===Number(unit)) && words.every(word=>normalizeSearch(p.name_tr).includes(word)));
}
function programPicker(value,unit='',prefix='profile'){
  const p=state.programs.find(row=>row.id===Number(value));
  return `<div class="program-picker" data-unit="${e(unit)}"><input type="hidden" name="program_id" value="${p?.id || ''}"><div class="combo-control">${icon('search')}<input id="${prefix}-program" name="program_label" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${prefix}-program-options" autocomplete="off" placeholder="Bölümünü seç veya yaz…" value="${e(p?.name_tr || '')}" data-input="program-combobox" required><button type="button" data-action="toggle-program" aria-label="Bölüm listesini aç">${icon('chevron')}</button></div><div id="${prefix}-program-options" class="program-options" role="listbox" aria-label="Bölümler" hidden></div><small class="program-selection" aria-live="polite">${p?'Seçili: '+e(p.name_tr):'Örn. pc müh, bilgisayar, yazılım müh'}</small></div>`;
}
function showProgramOptions(picker,query=''){
  const input=picker.querySelector('[role="combobox"]'),list=picker.querySelector('[role="listbox"]');
  const rows=matchingPrograms(picker.dataset.unit,query);
  list.innerHTML=rows.length?rows.map((p,i)=>`<div id="${list.id}-${p.id}" role="option" aria-selected="${String(p.id)===picker.querySelector('[name="program_id"]').value}" data-action="select-program" data-id="${p.id}" data-index="${i}"><strong>${e(p.name_tr)}</strong><small>${e(state.units.find(u=>u.id===p.academic_unit_id)?.name_tr || '')}${p.degree_level==='associate'?' · Ön lisans':p.degree_level==='bachelor'?' · Lisans':''}</small></div>`).join(''):'<p class="no-results">Bölüm bulunamadı. Kısa bir adla tekrar dene veya fakülte filtresini kaldır.</p>';
  list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');picker.dataset.index='-1';
}
function closeProgramPicker(picker){picker.querySelector('[role="listbox"]').hidden=true;picker.querySelector('[role="combobox"]').setAttribute('aria-expanded','false');picker.querySelector('[role="combobox"]').removeAttribute('aria-activedescendant');}
async function chooseProgram(picker,id){
  const program=state.programs.find(row=>row.id===id);if(!program)return;
  picker.querySelector('[name="program_id"]').value=program.id;picker.querySelector('[role="combobox"]').value=program.name_tr;
  picker.querySelector('.program-selection').textContent='Seçili: '+program.name_tr;closeProgramPicker(picker);
  await fillCurricula(picker.closest('form'),id);
}
function curriculumLabel(c){return `${c.entry_year?`${c.entry_year} girişliler`:'Giriş yılı belirtilmemiş plan'} · ${Math.ceil(c.semester_count/2)} yıllık program`;}

function curriculumOptions(rows,value){return '<option value="">Müfredatını seç</option>'+rows.map(c=>`<option value="${c.id}"${selected(c.id,value)}>${e(curriculumLabel(c))}${rows.length>1?` · ${e(c.label)}`:''}</option>`).join('');}
function profileView(){
  const profile=state.profile;
  const program=state.programs.find(p=>p.id===profile?.program_id);
  return `<div class="${profile?'profile-page':'onboarding'}">${profile?`<div class="page-title"><div><h1>Akademik profil</h1><p>Önerilerini sana uygun hâle getiren bilgiler.</p></div></div>`:`<span class="step-tag">İlk adım · Seni tanıyalım</span><h1>Akademik profilini oluştur.</h1><p>Bölümünü ve sınıfını seç. Geçmişini daha sonra ekleyebilirsin.</p>`}<div class="panel panel-padding"><div class="profile-intro"><h2>Öğrenim bilgilerin</h2><p>Bilgilerini güncelleyebilirsin. Eski dönemlerin korunur.</p></div><form data-form="profile" class="form-grid"><div class="field full"><label for="profile-unit">Fakülte / akademik birim</label><select id="profile-unit" name="academic_unit_id" data-change="profile-unit"><option value="">Tüm akademik birimler</option>${state.units.map(unit=>`<option value="${unit.id}"${selected(unit.id,program?.academic_unit_id)}>${e(unit.name_tr)}</option>`).join('')}</select></div><div class="field full"><label for="profile-program">Bölüm / program</label>${programPicker(profile?.program_id,program?.academic_unit_id)}<small>Listeden seç veya bölüm adını yaz.</small></div><div class="field full"><label for="profile-curriculum">Bölümün ders planı</label><select id="profile-curriculum" name="curriculum_id" required data-change="profile-curriculum"><option value="">Önce bölümünü seç</option></select><small>Ders önerilerin bu plana göre hazırlanır.</small><details class="field-help"><summary>Ders planı nedir?</summary><p>Bölüm derslerinin dönemlere dağılımıdır; üniversiteye giriş yılından farklıdır. Tek plan varsa otomatik seçilir. Kaynakta yılı bilinmiyorsa tahmin edilmez.</p></details></div><div class="form-section-title">Öğrenim bilgilerin</div><div class="field"><label for="profile-year">Üniversiteye giriş yılın</label><input id="profile-year" name="entry_year" type="number" min="1900" max="${new Date().getFullYear()+1}" required placeholder="Örn. 2023" value="${profile?.entry_year || ''}"></div><div class="field"><label for="profile-preparation">Hazırlık durumun</label><select id="profile-preparation" name="preparation_status" data-change="profile-preparation">${Object.entries(prepNames).map(([key,label])=>`<option value="${key}"${selected(key,profile?.preparation_status || 'not_required')}>${label}</option>`).join('')}</select></div><div class="field"><label for="profile-class">Şu anki sınıfın</label><select id="profile-class" name="current_class" required><option value="1">1. sınıf</option></select><small id="preparation-help">Hazırlık, bölümün birinci sınıfından ayrı tutulur.</small></div><div class="field"><label>Okul e-postan</label><input value="${e(state.user.email)}" disabled aria-label="Kayıtlı okul e-postası"><small>Doğrulanmış öğrenci hesabın.</small></div><div class="form-error full"></div><div class="profile-actions"><button type="submit" class="btn primary">${profile?'Değişiklikleri kaydet':'Profilimi oluştur ve devam et'} ${icon('arrow')}</button></div></form></div></div>`;
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
  const hint=form.querySelector('#preparation-help');if(hint)hint.textContent=prep?'Sınıfın hazırlık olarak kaydedilir. Güncel dönem hazırlık olur; bölümün zorunlu dersleri önerilmez. Hazırlığı tamamlayınca durumunu ve sınıfını güncelle.':'Bölümde okuduğun sınıfı seç. Tamamlanan veya muaf olunan hazırlık, bölüm dönemlerine eklenmez; eski hazırlık kayıtların korunur.';
  form.elements.current_class.innerHTML=prep?'<option value="0">Hazırlık</option>':Array.from({length:Math.ceil((cu?.semester_count || 8)/2)},(_,i)=>`<option value="${i+1}"${selected(i+1,current)}>${i+1}. sınıf</option>`).join('');
}

async function openTermDialog(edit=false){
  if(!state.profile) return go('profile');
  const existing=edit?currentTerm():null;
  loadingDialog(edit?'Dönemini düzenle':'Yeni bir dönem oluştur');
  const programId=existing?.program_id || state.profile.program_id;
  const curricula=await curriculaFor(programId);
  const curriculumId=existing?.curriculum_id || state.profile.curriculum_id;
  const kind=existing?.curriculum_period_kind || await planFor(curriculumId);
  if(!modal.open)return;
  const date=new Date(), month=Number(new Intl.DateTimeFormat('en-US',{month:'numeric',timeZone:'Europe/Istanbul'}).format(date));
  const year=date.getFullYear()-(month<9?1:0);
  const type=existing?.term_type || (kind==='year' && state.profile.preparation_status!=='in_progress'?'annual':month>=9?'fall':month>=6?'summer':'spring');
  const prep=existing?.is_preparation ?? state.profile.preparation_status==='in_progress';
  dialog(edit?'Dönemini düzenle':'Yeni dönem',edit?'Takvim ve müfredat dönemi birbirinden bağımsızdır.':'Güncel veya geçmiş dönem ekle.',`<form data-form="term" data-id="${existing?.id || ''}"><div class="modal-body form-grid"><div class="field"><label for="term-year">Akademik yılın başlangıcı</label><input id="term-year" name="academic_year" type="number" min="1900" max="${date.getFullYear()+1}" value="${existing?.academic_year || year}" required><small>2026 yazarsan 2026–2027 yılı oluşturulur.</small></div><div class="field"><label for="term-type">Takvim dönemi</label><select id="term-type" name="term_type">${Object.entries(termNames).map(([key,label])=>`<option value="${key}"${selected(key,type)}>${label}</option>`).join('')}</select></div><label class="check-line full"><input type="checkbox" name="is_preparation" data-change="term-preparation" ${prep?'checked':''} ${edit?'disabled':''}> Bu bir hazırlık dönemi</label><div class="field full"><label for="term-program">Dönemin bölümü</label>${edit?`<input value="${e(programName(programId))}" disabled><input type="hidden" name="program_id" value="${programId}">`:programPicker(programId,'','term')}<small>${edit?'Geçmişi korumak için dönemin bölümü değiştirilmez.':'Geçmişte başka bir bölümde okuduysan o dönemin bölümünü seçebilirsin.'}</small></div><div class="field full"><label for="term-curriculum">Dönemin müfredatı</label><select id="term-curriculum" name="curriculum_id" data-change="term-curriculum" required ${edit?'disabled':''}>${curriculumOptions(curricula,curriculumId)}</select></div><div class="field full" ${kind?'hidden':''}><label for="term-kind">Ders planı türü</label><select id="term-kind" name="curriculum_period_kind" data-change="term-kind"><option value="">Plan türünü seç</option><option value="semester"${selected(kind,'semester')}>Dönemlik (Güz / Bahar)</option><option value="year"${selected(kind,'year')}>Yıllık</option></select><small>Katalogda biliniyorsa otomatik seçilir; hazırlıkta kullanılmaz.</small></div><div class="field full"><label for="term-period">Önerilecek derslerin dönemi</label><select id="term-period" name="curriculum_period_number"></select><small>Bu seçim önerileri belirler; başka dönemlerden de ders alabilirsin.</small></div><div class="form-error full"></div></div><div class="modal-foot">${existing?button('delete-term','Boş dönemi sil','ghost','',`data-id="${existing.id}"`):''}${button('close-modal','Vazgeç','light')}<button type="submit" class="btn primary">${edit?'Kaydet':'Dönemi oluştur'} ${icon('arrow')}</button></div></form>`);
  const form=modal.querySelector('form'); form.dataset.periodKind=kind || existing?.curriculum_period_kind || '';
  populateTermPeriods(form,existing?.curriculum_period_number ?? (kind==='year'?state.profile.current_class:(Math.max(1,state.profile.current_class)-1)*2+(type==='spring'?2:1)));
  syncPlanCalendar(form);
}
function populateTermPeriods(form,value){
  const rows=state.curricula.get(Number(form.elements.program_id.value)) || [];
  const cu=rows.find(c=>c.id===Number(form.elements.curriculum_id.value));
  const kind=form.dataset.periodKind, maximum=kind==='year'?Math.ceil((cu?.semester_count || 2)/2):(cu?.semester_count || 8);
  const select=form.elements.curriculum_period_number;
  const prep=form.elements.is_preparation.checked;
  select.disabled=prep || !kind;
  form.elements.curriculum_period_kind.disabled=prep;
  select.innerHTML=prep?'<option value="">Hazırlık bölüm müfredatından ayrıdır</option>':!kind?'<option value="">Önce ders planı türünü seç</option>':'<option value="">Daha sonra seçerim</option>'+Array.from({length:maximum},(_,i)=>`<option value="${i+1}"${selected(i+1,value)}>${i+1}. ${kind==='year'?'yıl':'dönem'}</option>`).join('');
}
function syncPlanCalendar(form){
  const prep=form.elements.is_preparation.checked, kind=form.dataset.periodKind, select=form.elements.term_type;
  for(const option of select.options)option.disabled=!prep && ((kind==='year' && !['annual','summer'].includes(option.value)) || (kind==='semester' && option.value==='annual'));
  if(select.selectedOptions[0]?.disabled)select.value=kind==='year'?'annual':'fall';
}
async function updateTermPlan(form){
  const id=Number(form.elements.curriculum_id.value); if(!id)return;
  form.dataset.periodKind=await planFor(id) || '';
  form.elements.curriculum_period_kind.value=form.dataset.periodKind;
  form.elements.curriculum_period_kind.closest('.field').hidden=Boolean(form.dataset.periodKind);
  if(!form.isConnected)return;
  populateTermPeriods(form,1);
  syncPlanCalendar(form);
}

async function openCourseDialog(){
  const term=currentTerm(); if(!term)return openTermDialog();
  state.modalTab=term.is_preparation?'custom':'suggested';state.suggestOffset=0;state.suggestQuery='';state.searchOffset=0;state.searchQuery='';state.searchRows=[];
  const rows=await curriculaFor(term.program_id); const kind=await planFor(term.curriculum_id);
  const maximum=rows.find(c=>c.id===term.curriculum_id)?.semester_count || 8;
  state.suggestKind=term.curriculum_period_kind || kind || '';state.suggestMax=state.suggestKind==='year'?Math.ceil(maximum/2):maximum;
  state.suggestPeriod=term.curriculum_period_number || 1;
  drawCourseDialog(); if(state.modalTab==='suggested') await fetchSuggestions();
}
function drawCourseDialog(){
  const term=currentTerm(); if(!term)return;
  const tabs=term.is_preparation?['custom']:['suggested','catalog','custom'];
  const names={suggested:'Ders planından',catalog:'Tüm planı ara',custom:'Elle ders ekle'};
  const content=state.modalTab==='custom'?customCourseForm():`<div class="modal-body">${state.modalTab==='suggested'?`<div class="period-select"><span>Ders planı</span>${!state.suggestKind?`<select aria-label="Öneri plan türü" data-change="suggest-kind"><option value="">Tür seç</option><option value="semester">Dönemlik</option><option value="year">Yıllık</option></select>`:''}<select aria-label="Öneriler için müfredat dönemi" data-change="suggest-period">${Array.from({length:state.suggestMax},(_,i)=>`<option value="${i+1}"${selected(i+1,state.suggestPeriod)}>${i+1}. ${state.suggestKind==='year'?'yıl':'dönem'}</option>`).join('')}</select></div>`:''}<form data-form="course-search" class="modal-search"><div class="search-wrapper">${icon('search')}<input class="search-input" name="query" type="search" placeholder="Ders adı veya koduyla ara…" aria-label="Ders adı veya kodu" value="${e(state.modalTab==='suggested'?state.suggestQuery:state.searchQuery)}"></div><button class="btn light small" type="submit">Ara</button></form><div id="course-results"><div class="dialog-loading"><span class="loader"></span><p>Dersler yükleniyor…</p></div></div></div>`;
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
  const params=new URLSearchParams(isSuggested?{period_kind:state.suggestKind,period_number:state.suggestPeriod,q:state.suggestQuery,limit:50,offset:state.suggestOffset}:{all_periods:true,q:state.searchQuery,limit:50,offset:state.searchOffset});
  try{
    const result=await api(`/terms/${term.id}/suggestions?${params}`);
    if(request!==requestCounter || !modal.open || state.modalTab!==tab)return;
    if(isSuggested){state.suggestions=result.courses;state.suggestGroups=result.elective_groups;state.suggestCoverage=result.coverage_status;}
    else state.searchRows=result.courses;
    drawSuggestionResults();
  }catch(error){if(request!==requestCounter)return;const target=modal.querySelector('#course-results');if(target){target.innerHTML=`<div class="notice">${icon('info')}<p>${e(error.message)}</p></div>`;}else showError(error);}
}
function drawSuggestionResults(){
  const target=modal.querySelector('#course-results');if(!target)return;
  const suggested=state.modalTab==='suggested', source=suggested?state.suggestions:state.searchRows;
  const rows=[...new Map(source.map(row=>[row.course_revision_id,row])).values()];
  const active=activeCourses();
  target.innerHTML=`${suggested && state.suggestCoverage!=='complete'?`<p class="check-note">Öneriler mevcut katalog bilgileriyle sınırlı. Eksik bir dersi kişisel olarak ekleyebilirsin.</p>`:''}${suggested && state.suggestGroups?.length?`<div class="elective-info"><h3>${icon('book')}Seçmeli ders havuzları</h3>${state.suggestGroups.map(group=>`<p><strong>${e(group.name)}</strong>${group.required_course_count!==null?` · ${group.required_course_count} ders seçimi`:''}${group.required_ects!==null?` · ${number(group.required_ects)} AKTS`:''}</p>`).join('')}<small>Aşağıdaki seçmeli derslerden kendin seç. Havuzda görünmeyen ders için Elle ders ekle'yi kullan.</small></div>`:''}${rows.length?rows.map((row,index)=>{const added=active.find(course=>course.course_revision_id===row.course_revision_id || (row.course_id && course.course_id===row.course_id));return `<div class="suggestion-row">${courseIcon(row,index)}<div class="suggestion-main"><h3>${e(row.course_name)}</h3><p>${row.course_type?`<span class="pill ${row.course_type==='required'?'green':'gray'}">${row.course_type==='required'?'Zorunlu':'Seçmeli'}</span>`:''}${e(row.course_code)}${row.elective_group_name?` · ${e(row.elective_group_name)}`:''} · ${row.ects===null?'AKTS belirtilmedi':`${number(row.ects)} AKTS`}${row.period_number?` · ${row.period_number}. ${row.period_kind==='year'?'yıl':'dönem'}`:''}</p></div>${added?`<div class="suggestion-selection"><span class="suggestion-added">${icon('check')}Eklendi</span>${removeCourseButton(added)}</div>`:button('enroll-catalog','Ekle','light small','plus',`data-id="${row.course_revision_id}"`)}</div>`;}).join(''):emptyState('Bu aramada bir ders bulunamadı.','Başka bir ders adı veya müfredat dönemi deneyebilir, kişisel ders ekleyebilirsin.','custom-tab','Kişisel ders ekle',true)}<div class="load-more">${(suggested?state.suggestOffset:state.searchOffset)>0?button('previous-results','Önceki','ghost small'):''}${source.length===50?button('more-results','Sonraki dersler','light small','arrow'):''}</div>`;
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
    await api(restore?`/enrollments/${id}/restore`:`/enrollments/${id}`,{method:restore?'POST':'DELETE'});
    await refreshCourses();render();if(modal.open && modal.querySelector('#course-results'))drawSuggestionResults();
    if(restore){document.querySelectorAll(`[data-action="undo-remove"][data-id="${id}"]`).forEach(button=>button.closest('.toast')?.remove());toast(`${course.course_code} yeniden listende.`);}
    else toast(`${course.course_code} listenden kaldırıldı.`,false,id);
  }finally{pendingCourseChanges.delete(id);}
}

async function refreshAssignments(){state.assignments=await allPages('/assignments?include_archived=true');}
function refreshAssignmentResults(){
  const target=root.querySelector('#assignment-results');if(target)target.innerHTML=assignmentUI.results(state);
  const count=root.querySelector('#assignment-result-count');if(count)count.textContent=`${filterAssignments(state.assignments,{termId:state.assignmentTermId,view:state.assignmentFilter,archives:state.assignmentArchives,query:state.assignmentQuery,sort:state.assignmentSort}).length} ödev`;
}
function openAssignmentDialog(id=null){
  const item=id?state.assignments.find(row=>row.id===id):null;
  if(id && !item)return;
  const courses=state.courses.filter(course=>!course.archived_at);
  if(!item && !courses.length){dialog('Önce bir ders ekle','Ödevler kişisel ders kayıtlarına bağlanır.',`<div class="modal-body"><p class="check-note">Derslerim ekranından bir ders ekledikten sonra ödev oluşturabilirsin.</p></div>`,button('close-modal','Kapat','light'));return;}
  const preferredCourse=item?.enrollment_id || courses.find(course=>course.term_id===(state.assignmentTermId || state.termId) && course.status==='in_progress')?.id || '';
  const groups=[...new Set(courses.map(course=>course.term_id))].sort((a,b)=>Number(b===(state.assignmentTermId||state.termId))-Number(a===(state.assignmentTermId||state.termId)));
  dialog(item?'Ödevi düzenle':'Yeni ödev','Dersini seç, başlığını yaz, teslim gününü belirle.',`<form data-form="assignment" data-id="${item?.id || ''}"><div class="modal-body assignment-quick-body"><div class="field"><label for="assignment-course">Ders</label>${item?`<input id="assignment-course" value="${e(item.course_code+' · '+item.course_name)}" disabled>`:`<select id="assignment-course" name="enrollment_id" required><option value="">Ders seç</option>${groups.map(termId=>`<optgroup label="${e(termLabel(state.terms.find(term=>term.id===termId)))}">${courses.filter(course=>course.term_id===termId).map(course=>`<option value="${course.id}"${selected(course.id,preferredCourse)}>${e(course.course_code+' · '+course.course_name)}</option>`).join('')}</optgroup>`).join('')}</select>`}</div><div class="field"><label for="assignment-title">Ödev başlığı</label><input id="assignment-title" name="title" required maxlength="200" placeholder="Örn. 3. hafta alıştırmaları" value="${e(item?.title)}"></div><div class="field"><label for="assignment-due">Teslim tarihi</label><input id="assignment-due" name="due_at" type="date" required min="1900-01-01" max="2200-12-31" value="${e(assignmentDate(item?.due_at))}"><div class="assignment-date-shortcuts" role="group" aria-label="Hızlı teslim tarihi">${[[0,'Bugün'],[1,'Yarın'],[7,'1 hafta sonra']].map(([days,label])=>button('assignment-date',label,'light small','',`data-days="${days}"`)).join('')}</div><small>Teslim günü boyunca gecikmiş sayılmaz.</small></div><fieldset class="assignment-priority-picker"><legend>Önem</legend><div>${Object.entries(assignmentPriorities).map(([value,label])=>`<label class="priority-option priority-${value}"><input type="radio" name="priority" value="${value}"${value===(item?.priority || 'normal')?' checked':''}><span><i aria-hidden="true"></i>${label}</span></label>`).join('')}</div></fieldset><details class="assignment-extra"><summary>Not ekle <span>İsteğe bağlı${item?.description?' · Kayıtlı not var':''}</span></summary><div class="field"><label for="assignment-description">Kendine not</label><textarea id="assignment-description" name="description" maxlength="5000" rows="2" placeholder="Eklemek istediğin bir ayrıntı…">${e(item?.description)}</textarea></div></details><div class="form-error"></div></div><div class="modal-foot">${button('close-modal','Vazgeç','light')}<button type="submit" class="btn primary">${item?'Kaydet':'Ödevi ekle'} ${icon('check')}</button></div></form>`);
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
  if(type==='profile' && form.elements.curriculum_id.disabled){formError(form,'Müfredat bilgisi yükleniyor. Biraz bekleyip tekrar dene.');return;}
  setFormBusy(form,true);
  const error=form.querySelector('.form-error');if(error)error.textContent='';
  try{
    if(type==='login'){
      state.email=data.email.trim().toLowerCase();
      try{await api('/auth/login',{method:'POST',form:true,body:{username:state.email,password:data.password},quiet401:true});}
      catch(error){if(error.status===403){state.authMode='verify';renderAuth();toast('Giriş yapmadan önce okul adresini doğrula.',true);return;}throw error;}
      state.user=await api('/users/me');await loadWorkspace();location.hash=state.profile?'/overview':'/profile';render();toast('Hoş geldin.');
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
      const first=!state.profile, previousPreparation=state.profile?.preparation_status;
      state.profile=await api('/users/me/academic-profile',{method:'PUT',body:{program_id:Number(data.program_id),curriculum_id:Number(data.curriculum_id),entry_year:Number(data.entry_year),preparation_status:data.preparation_status,current_class:Number(data.current_class)}});
      if(previousPreparation!==state.profile.preparation_status)state.termId=preferredTerm()?.id || null;
      cleanForm(form);
      if(first)location.hash='/overview';render();toast(first?'Profilin hazır. İlk dönemini oluşturarak devam edebilirsin.':'Akademik profilin güncellendi.');
    }else if(type==='term'){
      const editing=Boolean(form.dataset.id), prep=form.elements.is_preparation.checked;
      const body={academic_year:Number(data.academic_year),term_type:data.term_type,curriculum_period_kind:prep || !data.curriculum_period_number?null:form.dataset.periodKind,curriculum_period_number:prep || !data.curriculum_period_number?null:Number(data.curriculum_period_number)};
      if(!editing)Object.assign(body,{is_preparation:prep,program_id:Number(data.program_id),curriculum_id:Number(data.curriculum_id)});
      const term=await api(editing?`/terms/${form.dataset.id}`:'/terms',{method:editing?'PATCH':'POST',body});
      cleanForm(form);state.terms=await allPages('/terms');state.examCalendars=await api('/exams/calendar');state.termId=term.id;closeModal(true);render();toast(editing?'Dönemin güncellendi.':'Dönemin hazır. Şimdi derslerini ekleyebilirsin.');
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
      await api(editing?`/enrollments/${form.dataset.id}`:'/enrollments',{method:editing?'PATCH':'POST',body});
      cleanForm(form);await refreshCourses();closeModal(true);render();toast(editing?'Ders bilgilerin güncellendi.':'Kişisel dersin listeye eklendi.');
    }else if(type==='assignment'){
      const editing=Boolean(form.dataset.id);
      const body={title:data.title.trim(),description:data.description.trim() || null,due_at:assignmentDateEnd(data.due_at),priority:data.priority};
      if(!editing)body.enrollment_id=Number(data.enrollment_id);
      await api(editing?`/assignments/${form.dataset.id}`:'/assignments',{method:editing?'PATCH':'POST',body});
      cleanForm(form);await refreshAssignments();closeModal(true);render();toast(editing?'Ödev güncellendi.':'Ödev eklendi.');
    }else if(type==='course-search'){
      if(state.modalTab==='suggested'){state.suggestQuery=data.query.trim();state.suggestOffset=0;}else{state.searchQuery=data.query.trim();state.searchOffset=0;}
      await fetchSuggestions();
    }
  }catch(error){if(!applyFieldErrors(form,error.fields))formError(form,error.message || 'İşlem tamamlanamadı.');}
  finally{setFormBusy(form,false);}
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
document.addEventListener('submit',event=>{const form=event.target.closest('form[data-form]');if(form){event.preventDefault();submitForm(form);}});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target || target.disabled)return;
  const action=target.dataset.action, id=Number(target.dataset.id);
  try{
    if(action==='toggle-program'){const picker=target.closest('.program-picker');const input=picker.querySelector('[role="combobox"]');input.focus();showProgramOptions(picker);}
    else if(action==='select-program')await chooseProgram(target.closest('.program-picker'),id);
    else if(action.startsWith('auth-')){state.email=root.querySelector('input[name="email"]')?.value || state.email;state.authMode=action.slice(5);renderAuth();}
    else if(action==='resend-code'){
      const email=root.querySelector('#verify-email');if(!email.reportValidity())return;
      target.disabled=true;await api('/auth/resend-verification',{method:'POST',body:{email:email.value.trim().toLowerCase()},quiet401:true});resendUntil=Date.now()+60_000;syncResendCooldown();toast('Uygun bir hesap varsa doğrulama mesajı gönderildi.');
    }else if(action==='logout'){
      await api('/auth/logout',{method:'POST',quiet401:true});state.user=null;state.profile=null;state.courses=[];state.assignments=[];state.assignmentTermId=null;state.assignmentFilter='all';state.assignmentQuery='';state.assignmentArchives=false;state.terms=[];state.examCalendars=[];state.examSync=null;state.termId=null;state.status='all';state.archives=false;state.courseQuery='';state.courseSort='name';state.courseView='cards';state.authMode='login';closeModal(true);renderAuth();toast('Güvenli şekilde çıkış yaptın.');
    }else if(action==='toggle-menu' || action==='close-menu'){
      setMobileMenu(root,action==='close-menu'?false:!root.querySelector('.workspace')?.classList.contains('menu-open'));
    }else if(action==='close-modal')await closeModal();
    else if(action==='assignment-date'){
      const input=modal.querySelector('#assignment-due');if(input){input.value=assignmentDateOffset(Number(target.dataset.days));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();}
    }
    else if(action==='new-assignment')openAssignmentDialog();
    else if(action==='edit-assignment')openAssignmentDialog(id);
    else if(['toggle-assignment','archive-assignment','restore-assignment'].includes(action)){target.disabled=true;await changeAssignment(id,action);}
    else if(action==='assignment-filter'){state.assignmentFilter=target.dataset.filter;render();root.querySelector(`[data-action="assignment-filter"][data-filter="${state.assignmentFilter}"]`)?.focus({preventScroll:true});}
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
    else if(action==='refresh-exams'){
      target.disabled=true;
      try{[state.examCalendars,state.examSync]=await Promise.all([api('/exams/calendar'),api('/exams/sync-status')]);render();}finally{target.disabled=false;}
    }
    else if(action==='select-exam'){
      target.disabled=true;
      try{await api('/exams/selection',{method:'PUT',body:{enrollment_id:id,exam_type:target.dataset.examType,document_id:Number(target.dataset.document),sheet:target.dataset.sheet,row_number:Number(target.dataset.row)}});state.examCalendars=await api('/exams/calendar');render();toast('Sınav grubun kaydedildi.');}finally{target.disabled=false;}
    }
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
      await api(`/terms/${id}`,{method:'DELETE'});state.terms=await allPages('/terms');state.examCalendars=await api('/exams/calendar');state.termId=preferredTerm()?.id || null;closeModal(true);render();toast('Boş dönem kaldırıldı.');
    }
  }catch(error){if(action==='resend-code' && error.retryAfter){resendUntil=Date.now()+error.retryAfter*1000;syncResendCooldown();}showError(error);}finally{if(target.isConnected)target.disabled=action==='resend-code' && resendUntil>Date.now();}
});
document.addEventListener('change',async event=>{
  const target=event.target, action=target.dataset.change, form=target.closest('form');
  try{
    if(action==='result-status')syncResultStatus(form);
    else if(action==='grade-kind')changeGradeKind(form);
    else if(action==='assignment-term'){state.assignmentTermId=Number(target.value) || null;render();root.querySelector('[data-change="assignment-term"]')?.focus({preventScroll:true});}
    else if(action==='assignment-sort'){state.assignmentSort=target.value;refreshAssignmentResults();}
    else if(action==='assignment-archives'){state.assignmentArchives=target.checked;render();root.querySelector('[data-change="assignment-archives"]')?.focus({preventScroll:true});}
    else if(action==='course-sort'){state.courseSort=target.value;refreshCourseResults();}
    else if(action==='active-term'){state.termId=Number(target.value) || null;render();root.querySelector('[data-change="active-term"]')?.focus({preventScroll:true});}
    else if(action==='show-archives'){state.archives=target.checked;render();}
    else if(action==='profile-unit'){
      const picker=form.querySelector('.program-picker');picker.dataset.unit=target.value;picker.querySelector('[name="program_id"]').value='';picker.querySelector('[role="combobox"]').value='';picker.querySelector('.program-selection').textContent='Bölüm seçilmedi';closeProgramPicker(picker);await fillCurricula(form,null);
    }else if(action==='profile-program' || action==='term-program')await fillCurricula(form,target.value);
    else if(action==='profile-curriculum' || action==='profile-preparation')updateClass(form);
    else if(action==='term-curriculum')await updateTermPlan(form);
    else if(action==='term-preparation'){populateTermPeriods(form,1);syncPlanCalendar(form);}
    else if(action==='term-kind'){form.dataset.periodKind=target.value;populateTermPeriods(form,1);syncPlanCalendar(form);}
    else if(action==='suggest-kind'){state.suggestKind=target.value;const cu=(state.curricula.get(currentTerm().program_id)||[]).find(c=>c.id===currentTerm().curriculum_id);state.suggestMax=target.value==='year'?Math.ceil((cu?.semester_count||8)/2):(cu?.semester_count||8);drawCourseDialog();await fetchSuggestions();}
    else if(action==='history-year'){state.historyYear=target.value;render();}
    else if(action==='suggest-period'){state.suggestPeriod=Number(target.value);state.suggestOffset=0;await fetchSuggestions();}
  }catch(error){showError(error);}
});
document.addEventListener('input',event=>{
  const target=event.target;
  if(target.dataset.input==='assignment-search'){state.assignmentQuery=target.value;refreshAssignmentResults();}
  if(target.dataset.input==='personal-course-search'){state.courseQuery=target.value;refreshCourseResults();}
  if(target.dataset.input==='program-combobox'){
    const picker=target.closest('.program-picker'),form=picker.closest('form');
    picker.querySelector('[name="program_id"]').value='';picker.querySelector('.program-selection').textContent='Arama sonuçlarından bir bölüm seç.';
    form.elements.curriculum_id.innerHTML='<option value="">Önce bölümünü seç</option>';form.elements.curriculum_id.disabled=false;
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
  event.preventDefault();if(list.hidden)showProgramOptions(picker);
  const options=[...list.querySelectorAll('[role="option"]')];if(!options.length)return;
  let index=Number(picker.dataset.index ?? -1);
  if(event.key==='Enter'){if(index>=0)chooseProgram(picker,Number(options[index].dataset.id)).catch(showError);return;}
  index=(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;picker.dataset.index=index;
  options.forEach((option,i)=>option.classList.toggle('keyboard-active',i===index));input.setAttribute('aria-activedescendant',options[index].id);options[index].scrollIntoView({block:'nearest'});
});
modal.addEventListener('cancel',event=>{event.preventDefault();closeModal();});
modal.addEventListener('click',event=>{if(event.target===modal){const bounds=modal.getBoundingClientRect();if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom)closeModal();}});
window.addEventListener('hashchange',async()=>{
  const requested=location.hash;
  if(requested==='#main-content'){history.replaceState(null,'',currentHash);const main=root.querySelector('main');if(main){main.tabIndex=-1;main.focus();}return;}
  if(permittedHash!==requested && needsLeaveCheck(document)){
    history.replaceState(null,'',currentHash);
    if(await canLeave(document)){permittedHash=requested;location.hash=requested;}
    return;
  }
  permittedHash=null;currentHash=requested;closeModal(true);render();root.querySelector('main')?.focus({preventScroll:true});
});

async function boot(){
  try{
    state.config=await api('/ui-config',{quiet401:true});
    document.title=`${applicationName()} · Öğrenci alanı`;
    try{state.user=await api('/users/me',{quiet401:true});}catch(error){if(error.status!==401)throw error;}
    if(state.user){await loadWorkspace();render();}else renderAuth();
  }catch(error){renderAuth();toast(error.message,true);}
}
boot();

function examsView(){return examUI.page(state);}
