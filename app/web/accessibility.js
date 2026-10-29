const focusable='a[href],button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]';
export function prepareAccessibility(container=document){
  container.querySelectorAll('main').forEach(main=>main.tabIndex=-1);
  container.querySelectorAll('.table-scroll').forEach(region=>{
    const overflow=region.scrollWidth>region.clientWidth+1;
    region.setAttribute('role','region');region.setAttribute('aria-label','Yatay kaydırılabilir tablo');region.tabIndex=overflow?0:-1;
    let hint=region.nextElementSibling;
    if(!hint?.classList.contains('table-scroll-hint')){hint=document.createElement('p');hint.className='table-scroll-hint';hint.textContent='Diğer alanları görmek için tabloyu yana kaydırabilirsin.';region.after(hint);}
    hint.hidden=!overflow;
  });
  container.querySelectorAll('button[title]').forEach(button=>{if(!button.textContent.trim() && !button.hasAttribute('aria-label'))button.setAttribute('aria-label',button.title);});
}
export function setMobileMenu(root,open){
  const workspace=root.querySelector('.workspace');if(!workspace)return;
  open=Boolean(open && innerWidth<=850);
  workspace.classList.toggle('menu-open',open);
  const sidebar=workspace.querySelector('.sidebar');
  workspace.querySelector('.mobile-menu')?.setAttribute('aria-expanded',String(open));
  workspace.querySelectorAll('.page,.topbar').forEach(element=>element.inert=open);
  if(open){sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');sidebar.setAttribute('aria-label','Ana menü');sidebar.querySelector('[data-action="close-menu"]')?.focus();}
  else{sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');sidebar.removeAttribute('aria-label');workspace.querySelector('.mobile-menu')?.focus({preventScroll:true});}
}
document.addEventListener('keydown',event=>{
  const root=document.querySelector('#app'),workspace=root?.querySelector('.workspace.menu-open');
  if(!workspace || document.querySelector('dialog[open]'))return;
  if(event.key==='Escape'){event.preventDefault();setMobileMenu(root,false);return;}
  if(event.key!=='Tab')return;
  const elements=[...workspace.querySelector('.sidebar').querySelectorAll(focusable)].filter(element=>element.getClientRects().length);
  const first=elements[0],last=elements.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
});
window.addEventListener('resize',()=>{
  prepareAccessibility();
  const root=document.querySelector('#app');
  if(innerWidth>850 && root?.querySelector('.workspace.menu-open'))setMobileMenu(root,false);
});
