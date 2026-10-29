export const assignmentPriorities={low:'Düşük',normal:'Normal',high:'Yüksek'};
export function toAssignmentInput(value){return value?new Date(new Date(value).getTime()+3*3600000).toISOString().slice(0,16):'';}
export function fromAssignmentInput(value){return new Date(`${value}${value.length===16?':00':''}+03:00`).toISOString();}
export function assignmentDate(value){return value?new Date(new Date(value).getTime()+3*3600000).toISOString().slice(0,10):'';}
export function assignmentDateOffset(days,now=new Date()){const day=assignmentDate(now);return assignmentDate(new Date(new Date(`${day}T12:00:00+03:00`).getTime()+days*86400000));}
export function assignmentDateEnd(value){return new Date(`${value}T23:59:59.999+03:00`).toISOString();}
export function assignmentDeadline(value){return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',year:'numeric',timeZone:'Etc/GMT-3'}).format(new Date(value));}
export function filterAssignments(items,{termId=null,view='all',archives=false,query='',sort='due',now=Date.now()}={}){
  const normalize=value=>String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
  const words=normalize(query).split(/\s+/).filter(Boolean);
  const rows=items.filter(item=>{
    const time=assignmentDate(item.due_at),today=assignmentDate(now),end=assignmentDateOffset(7,new Date(now)),pending=item.status==='pending';
    return (!termId || item.term_id===termId) && (archives || !item.archived_at)
      && (view==='all' || (view==='pending' && pending) || (view==='completed' && !pending)
        || (view==='overdue' && !item.archived_at && pending && time<today)
        || (view==='upcoming' && !item.archived_at && pending && time>=today && time<end))
      && words.every(word=>normalize(`${item.title} ${item.course_code} ${item.course_name}`).includes(word));
  });
  return rows.sort((a,b)=>{
    if(sort==='recent')return b.id-a.id;
    if(sort==='priority'){const difference={high:0,normal:1,low:2}[a.priority]-{high:0,normal:1,low:2}[b.priority];if(difference)return difference;}
    return Number(a.status==='completed')-Number(b.status==='completed') || new Date(a.due_at)-new Date(b.due_at) || a.id-b.id;
  });
}
export function createAssignmentUI({e,icon,button,termLabel}){
  function status(item){
    if(item.archived_at)return '<span class="pill gray">Arşivde</span>';
    if(item.status==='completed')return '<span class="pill green">Tamamlandı</span>';
    if(assignmentDate(item.due_at)<assignmentDate(new Date()))return '<span class="pill red">Gecikti</span>';
    return '<span class="pill amber">Yapılacak</span>';
  }
  function cards(items,compact=false){
    if(!items.length)return `<div class="empty-state compact"><div class="empty-icon">${icon('check')}</div><h3>Bu görünümde ödev yok.</h3><p>Filtreyi değiştirebilir veya dersine yeni bir ödev ekleyebilirsin.</p></div>`;
    return `<div class="assignment-list">${items.map(item=>`<article class="assignment-item ${item.status==='completed'?'is-completed':''} ${item.archived_at?'is-archived':''}"><div class="assignment-main"><div class="assignment-labels"><span class="assignment-course">${e(item.course_code)}</span>${status(item)}${item.course_archived?'<span class="pill gray">Ders arşivde</span>':''}</div><h3>${e(item.title)}</h3>${!compact && item.description?`<p class="assignment-description">${e(item.description)}</p>`:''}<div class="assignment-meta"><span>${icon('calendar')}<time datetime="${e(item.due_at)}">${e(assignmentDeadline(item.due_at))}</time></span><span class="priority-${item.priority}">Önem: ${assignmentPriorities[item.priority]}</span></div>${!compact?`<small class="assignment-course-name">${e(item.course_name)}</small>`:''}</div><div class="assignment-actions">${compact?`<a class="btn light small" href="#/assignments">Aç ${icon('arrow')}</a>`:item.archived_at?button('restore-assignment','Geri yükle','light small','restore',`data-id="${item.id}"`):`${button('toggle-assignment',item.status==='completed'?'Yeniden aç':'Tamamla',item.status==='completed'?'light small':'primary small',item.status==='completed'?'restore':'check',`data-id="${item.id}" aria-label="${e(item.title)}: ${item.status==='completed'?'yeniden aç':'tamamla'}"`)}<button class="icon-btn" data-action="edit-assignment" data-id="${item.id}" aria-label="${e(item.title)} ödevini düzenle">${icon('edit')}</button>${button('archive-assignment','Kaldır','remove-course small','close',`data-id="${item.id}" aria-label="${e(item.title)} ödevini kaldır"`)}`}</div></article>`).join('')}</div>`;
  }
  function results(state){return cards(filterAssignments(state.assignments,{termId:state.assignmentTermId,view:state.assignmentFilter,archives:state.assignmentArchives,query:state.assignmentQuery,sort:state.assignmentSort}));}
  function page(state){
    const scope=state.assignments.filter(item=>!item.archived_at && (!state.assignmentTermId || item.term_id===state.assignmentTermId));
    const count=view=>filterAssignments(scope,{view}).length;
    const selected=(a,b)=>String(a)===String(b)?' selected':'';
    return `<div class="page-title"><div><h1>Ödevlerim</h1><p>Teslim tarihlerini ve tamamladıklarını takip et.</p></div>${button('new-assignment','Ödev ekle','primary','plus')}</div><div class="assignment-summary"><div><span>Yapılacak</span><strong>${count('pending')}</strong></div><div><span>Geciken</span><strong>${count('overdue')}</strong></div><div><span>Önümüzdeki 7 gün</span><strong>${count('upcoming')}</strong></div><div><span>Tamamlanan</span><strong>${count('completed')}</strong></div></div><div class="toolbar"><select data-change="assignment-term" aria-label="Ödevlerin dönemi"><option value="">Tüm dönemler</option>${state.terms.map(term=>`<option value="${term.id}"${selected(term.id,state.assignmentTermId)}>${e(termLabel(term))}</option>`).join('')}</select><label class="check-line"><input type="checkbox" data-change="assignment-archives" ${state.assignmentArchives?'checked':''}>Arşivlenenler</label></div><div class="course-tools"><div class="search-wrapper">${icon('search')}<input class="search-input" type="search" maxlength="100" aria-label="Ödevlerde ara" placeholder="Ödev veya ders adı" value="${e(state.assignmentQuery)}" data-input="assignment-search"></div><select data-change="assignment-sort" aria-label="Ödevleri sırala"><option value="due"${selected('due',state.assignmentSort)}>Teslim tarihine göre</option><option value="priority"${selected('priority',state.assignmentSort)}>Önemine göre</option><option value="recent"${selected('recent',state.assignmentSort)}>Son eklenen</option></select></div><div class="toolbar"><div class="filter-tabs" role="group" aria-label="Ödev filtresi">${Object.entries({all:'Tümü',pending:'Yapılacak',overdue:'Geciken',upcoming:'7 gün içinde',completed:'Tamamlanan'}).map(([key,label])=>`<button data-action="assignment-filter" data-filter="${key}" aria-pressed="${state.assignmentFilter===key}" class="${state.assignmentFilter===key?'active':''}">${label}</button>`).join('')}</div><span class="result-count" id="assignment-result-count" aria-live="polite">${filterAssignments(state.assignments,{termId:state.assignmentTermId,view:state.assignmentFilter,archives:state.assignmentArchives,query:state.assignmentQuery}).length} ödev</span></div><p class="assignment-time-note">Teslim saatleri Türkiye saatidir (UTC+03:00). “Tamamla” yalnızca kendi takibini günceller; okula teslim yapmaz.</p><div id="assignment-results" class="panel">${results(state)}</div>`;
  }
  function dashboard(state){
    const items=filterAssignments(state.assignments,{termId:state.termId,view:'pending'}).slice(0,3);
    return `<section class="assignment-dashboard"><div class="section-head"><div><h2>Ödev takibin</h2><p>Seçili dönemin yaklaşan ve geciken işleri.</p></div><a class="text-btn" href="#/assignments">Tümünü gör ${icon('arrow')}</a></div><div class="panel">${items.length?cards(items,true):'<div class="assignment-empty-inline">Bu dönemde bekleyen ödev yok.</div>'}</div></section>`;
  }
  return {page,results,cards,dashboard};
}
