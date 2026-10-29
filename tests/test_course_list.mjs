import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const source=await readFile(new URL('../app/web/course-list.js',import.meta.url),'utf8');
const {visibleCourses}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const rows=[
 {id:1,term_id:7,course_code:'MAT10',course_name:'İleri Matematik',status:'passed',ects:'5',archived_at:null},
 {id:2,term_id:7,course_code:'MAT2',course_name:'Matematik',status:'failed',ects:null,archived_at:null},
 {id:3,term_id:7,course_code:'CEN1',course_name:'Bilgisayar Ağları',status:'in_progress',ects:'7',archived_at:null},
 {id:4,term_id:7,course_code:'TR1',course_name:'Türk Dili',status:'passed',ects:'2',archived_at:'2026-01-01'},
 {id:5,term_id:8,course_code:'MAT1',course_name:'Matematik',status:'passed',ects:'10',archived_at:null},
];
test('search is accent-insensitive and respects term, status and archives together',()=>{
 assert.deepEqual(visibleCourses(rows,{termId:7,query:'ileri mat',status:'passed'}).map(c=>c.id),[1]);
 assert.deepEqual(visibleCourses(rows,{termId:7,query:'aglari'}).map(c=>c.id),[3]);
 assert.equal(visibleCourses(rows,{termId:7,query:'turk'}).length,0);
 assert.deepEqual(visibleCourses(rows,{termId:7,query:'turk',archives:true}).map(c=>c.id),[4]);
});
test('credit sorting is numeric, unknown credits last, and code sorting is natural',()=>{
 assert.deepEqual(visibleCourses(rows,{termId:7,sort:'ects'}).map(c=>c.id),[3,1,2]);
 assert.deepEqual(visibleCourses(rows,{termId:7,sort:'code'}).map(c=>c.id),[3,2,1]);
 assert.deepEqual(visibleCourses(rows,{termId:7,sort:'recent'}).map(c=>c.id),[3,2,1]);
 assert.deepEqual(rows.map(c=>c.id),[1,2,3,4,5]);
});
