import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const source=await readFile(new URL('../app/web/api.js',import.meta.url),'utf8');
const {api,ApiError}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('422 errors retain field associations for inline feedback',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({detail:[{loc:['body','custom_course_code'],type:'string_too_short',msg:'Invalid',ctx:{min_length:1}}]}),{status:422}));
 await assert.rejects(api('/enrollments',{method:'POST',body:{custom_course_code:''}}),error=>error instanceof ApiError && error.fields.custom_course_code==='Ders kodu alanını doldur.' && error.status===422);
});
test('conflict and network failures remain readable general errors',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({detail:'Bu ders zaten kayıtlı.'}),{status:409}));
 await assert.rejects(api('/enrollments'),error=>error.status===409 && error.message==='Bu ders zaten kayıtlı.' && Object.keys(error.fields).length===0);
 globalThis.fetch=async()=>{throw new TypeError('Network failure');};
 await assert.rejects(api('/enrollments'),error=>error.status===0 && error.message.includes('Bağlantı kurulamadı'));
});
