// Transient form state only: no passwords or drafts are persisted in storage.
const tracked=new WeakMap();
const editableTypes=new Set(['profile','term','custom-course','edit-course','assignment']);
const ignored=new Set(['academic_unit_id','program_label','grade_kind']);
function snapshot(form){return JSON.stringify([...new FormData(form)].filter(([key])=>!ignored.has(key)));}
export function rememberForms(container=document){container.querySelectorAll('form[data-form]').forEach(form=>{
  if(editableTypes.has(form.dataset.form) && !tracked.has(form))tracked.set(form,{initial:snapshot(form),touched:false});
});}
export function settleForm(form){const entry=tracked.get(form);if(entry && !entry.touched)entry.initial=snapshot(form);}
export function cleanForm(form){const entry=tracked.get(form);if(entry){entry.initial=snapshot(form);entry.touched=false;}}
export function formDirty(form){const entry=tracked.get(form);return Boolean(entry?.touched && entry.initial!==snapshot(form));}
function formsIn(container){return [...container.querySelectorAll('form[data-form]')];}
export function needsLeaveCheck(container=document){return formsIn(container).some(form=>formDirty(form) || form.dataset.saving==='true');}
let pendingDiscard=null;
function askToDiscard(){
  if(pendingDiscard)return pendingDiscard;
  pendingDiscard=new Promise(resolve=>{
    const trigger=document.activeElement,dialog=document.createElement('dialog');
    dialog.className='discard-dialog';dialog.setAttribute('aria-labelledby','discard-title');dialog.setAttribute('aria-describedby','discard-description');
    dialog.innerHTML='<div class="modal-head"><div><h2 id="discard-title">Değişikliklerin kaydedilmedi</h2><p id="discard-description">Çıkarsan bu formda yaptığın değişiklikler kaybolacak.</p></div></div><div class="modal-foot"><button type="button" class="btn light" data-discard="cancel" autofocus>Düzenlemeye devam et</button><button type="button" class="btn primary" data-discard="leave">Kaydetmeden çık</button></div>';
    const finish=leave=>{dialog.close();dialog.remove();pendingDiscard=null;if(trigger?.isConnected)trigger.focus();resolve(leave);};
    dialog.addEventListener('click',event=>{const button=event.target.closest('[data-discard]');if(button)finish(button.dataset.discard==='leave');});
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
    document.body.append(dialog);dialog.showModal();
  });
  return pendingDiscard;
}
export async function canLeave(container=document){
  const forms=formsIn(container);
  if(forms.some(form=>form.dataset.saving==='true')){document.dispatchEvent(new Event('form-navigation-blocked'));return false;}
  return !forms.some(formDirty) || await askToDiscard();
}
export function setFormBusy(form,busy){
  const button=form.querySelector('[type="submit"]');
  form.dataset.saving=String(busy);form.setAttribute('aria-busy',String(busy));
  if(!button)return;
  if(busy){button.dataset.originalContent=button.innerHTML;button.disabled=true;button.innerHTML='<span class="loader" aria-hidden="true"></span>'+({login:'Giriş yapılıyor…',register:'Hesap oluşturuluyor…',verify:'Doğrulanıyor…','course-search':'Aranıyor…'}[form.dataset.form] || 'Kaydediliyor…');}
  else{button.disabled=false;if(button.dataset.originalContent){button.innerHTML=button.dataset.originalContent;delete button.dataset.originalContent;}}
}
export function clearFormErrors(form){
  form.querySelectorAll('.field-error').forEach(node=>node.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach(control=>{control.removeAttribute('aria-invalid');const id=control.dataset.errorId;if(id){const ids=(control.getAttribute('aria-describedby') || '').split(' ').filter(value=>value!==id);if(ids.length)control.setAttribute('aria-describedby',ids.join(' '));else control.removeAttribute('aria-describedby');delete control.dataset.errorId;}});
  const summary=form.querySelector('.form-error');if(summary)summary.textContent='';
}
export function fieldError(form,name,message){
  let control=form.elements.namedItem(name);
  if(!control)return false;
  if(!control.tagName)control=[...control].find(node=>node.checked) || control[0];
  if(control.type==='hidden' && name==='program_id')control=form.querySelector('[role="combobox"]');
  if(!control || control.disabled || control.closest('[hidden]'))return false;
  const wrapper=control.closest('.field') || control.parentElement;
  const id=`${form.dataset.form}-${name}-error`;
  let error=wrapper.querySelector('.field-error');
  if(!error){error=document.createElement('small');error.className='field-error';error.id=id;error.setAttribute('role','alert');wrapper.append(error);}
  error.textContent=message;control.setAttribute('aria-invalid','true');control.dataset.errorId=error.id;
  const ids=new Set((control.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));ids.add(error.id);control.setAttribute('aria-describedby',[...ids].join(' '));
  return true;
}
export function applyFieldErrors(form,fields={}){let found=false;for(const [name,message] of Object.entries(fields))found=fieldError(form,name,message) || found;if(found)form.querySelector('[aria-invalid="true"]')?.focus();return found;}
document.addEventListener('input',event=>{
  const form=event.target.closest('form');if(!form)return;
  const entry=tracked.get(form);if(entry)entry.touched=true;
  if(event.target.hasAttribute('aria-invalid')){
    const wrapper=event.target.closest('.field');wrapper?.querySelector('.field-error')?.remove();event.target.removeAttribute('aria-invalid');
    const errorId=event.target.dataset.errorId;if(errorId){const ids=(event.target.getAttribute('aria-describedby')||'').split(' ').filter(id=>id!==errorId);if(ids.length)event.target.setAttribute('aria-describedby',ids.join(' '));else event.target.removeAttribute('aria-describedby');delete event.target.dataset.errorId;}
  }
});
document.addEventListener('change',event=>{const entry=tracked.get(event.target.closest('form'));if(entry)entry.touched=true;});
document.addEventListener('invalid',event=>{
  const form=event.target.closest('form[data-form]');if(!form)return;
  event.preventDefault();
  const control=event.target,v=control.validity;
  const message=v.valueMissing?'Bu alanı doldur.':v.typeMismatch?'Geçerli bir e-posta adresi yaz.':v.rangeOverflow?`En fazla ${control.max} olabilir.`:v.rangeUnderflow?`En az ${control.min} olmalı.`:v.tooShort?`En az ${control.minLength} karakter yaz.`:'Bu alanın biçimini kontrol et.';
  fieldError(form,control.name,message);
  queueMicrotask(()=>form.querySelector('[aria-invalid="true"]')?.focus());
},true);
window.addEventListener('beforeunload',event=>{if(formsIn(document).some(form=>formDirty(form) || form.dataset.saving==='true')){event.preventDefault();event.returnValue='';}});
