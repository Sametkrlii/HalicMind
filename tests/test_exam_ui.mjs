import test from 'node:test';
import assert from 'node:assert/strict';
import {createExamUI} from '../app/web/exam-ui.js';
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui=createExamUI({e,icon:()=>'',button:(action,label,kind,glyph,attrs='')=>`<button data-action="${action}" ${attrs}>${label}</button>`,termPicker:()=>'',termLabel:()=>'',emptyState:(title,reason)=>`<p>${e(title)} ${e(reason)}</p>`});
const state={terms:[{id:1}],termId:1,examCalendars:[{term_id:1,status:'unavailable',reason:'Takvim yok',exams:[]}],examSync:{enabled:true,status:'partial',checked_at:'2026-10-29T12:00:00Z',errors:[{url:'https://halic.edu.tr',message:'HTTP 403'}]}};
const candidate={document_id:2,exam_type:'final',source_url:'https://halic.edu.tr/tr/duyurular/x',file_url:'https://halic.edu.tr/x.xlsx',source_checked_at:'2026-10-29T12:00:00Z',starts_at:'2026-12-28T10:30:00+03:00',room:'A101; A102',section:'B',sheet:'Sınavlar',row:2001};

test('source failures stay visible and do not claim a schedule is unpublished',()=>{
 const html=ui.page(state);
 assert.match(html,/HTTP 403/);
 assert.match(html,/yayımlanmadığı anlamına gelmez/);
 assert.match(html,/Bazı kaynaklar kontrol edilemedi/);
});
test('uncertain candidates expose stable selection fields and shared-room notice',()=>{
 const group={enrollment_id:4,course_code:'MAT101',course_name:'<script>alert(1)</script>',exam_type:'final',status:'selection_required',candidates:[candidate]};
 const html=ui.page({...state,examCalendars:[{...state.examCalendars[0],exams:[group]}]});
 assert.match(html,/data-row="2001"/);
 assert.match(html,/data-document="2"/);
 assert.match(html,/kişisel salon yerleşimini/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.doesNotMatch(html,/Resmi dosyayla eşleşti/);
});
test('confirmed revised date displays new Turkey time and prior-date warning',()=>{
 const group={enrollment_id:4,course_code:'MAT101',course_name:'Matematik',exam_type:'final',status:'confirmed',selected:candidate,changed_from:'2026-12-28T09:30:00+03:00'};
 const html=ui.page({...state,examCalendars:[{...state.examCalendars[0],exams:[group]}]});
 assert.match(html,/10:30/);
 assert.match(html,/09:30/);
 assert.match(html,/Sınav tarihi güncellendi/);
 assert.doesNotMatch(html,/Bu grubu seç/);
});
