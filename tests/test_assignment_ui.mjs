import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const source=await readFile(new URL('../app/web/assignment-ui.js',import.meta.url),'utf8');
const {toAssignmentInput,fromAssignmentInput,filterAssignments}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('Istanbul input round-trips across UTC date boundaries independently of host time zone',()=>{
 assert.equal(fromAssignmentInput('2026-11-01T00:30'),'2026-10-31T21:30:00.000Z');
 assert.equal(toAssignmentInput('2026-10-31T21:30:00Z'),'2026-11-01T00:30');
 assert.equal(toAssignmentInput(null),'');
});
test('overdue/upcoming filters exclude completed or archived assignments and respect term/search',()=>{
 const now=Date.parse('2026-10-29T12:00:00Z');
 const row={term_id:2,course_code:'CEN1',course_name:'Bilgisayar Ağları',title:'İlk ödev',priority:'normal',status:'pending',archived_at:null};
 const items=[{...row,id:1,due_at:'2026-10-28T12:00:00Z'},{...row,id:2,status:'completed',due_at:'2026-10-28T12:00:00Z'},{...row,id:3,due_at:'2026-10-30T12:00:00Z'},{...row,id:4,archived_at:'2026-10-29T12:00:00Z',due_at:'2026-10-28T12:00:00Z'}];
 assert.deepEqual(filterAssignments(items,{now,view:'overdue',archives:true}).map(i=>i.id),[1]);
 assert.deepEqual(filterAssignments(items,{now,view:'upcoming',query:'ilk aglari',termId:2}).map(i=>i.id),[3]);
 assert.equal(filterAssignments(items,{now,termId:9}).length,0);
 assert.deepEqual(items.map(i=>i.id),[1,2,3,4]);
});

test('date-only deadlines end at Istanbul day end and shortcuts cross month/year boundaries',async()=>{
 const {assignmentDate,assignmentDateEnd,assignmentDateOffset,assignmentDeadline}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 assert.equal(assignmentDateEnd('2026-10-31'),'2026-10-31T20:59:59.999Z');
 assert.equal(assignmentDate('2026-10-31T21:30:00Z'),'2026-11-01');
 assert.equal(assignmentDateOffset(1,new Date('2026-12-31T12:00:00Z')),'2027-01-01');
 assert.equal(assignmentDateOffset(7,new Date('2028-02-25T12:00:00Z')),'2028-03-03');
 assert.doesNotMatch(assignmentDeadline('2026-10-31T20:59:59Z'),/23:59/);
 const today={id:7,term_id:1,title:'Bugün',course_code:'X',course_name:'X',status:'pending',due_at:'2026-10-29T00:00:00+03:00'};
 const options={now:Date.parse('2026-10-29T18:00:00+03:00')};
 assert.equal(filterAssignments([today],{...options,view:'overdue'}).length,0);
 assert.equal(filterAssignments([today],{...options,view:'upcoming'}).length,1);
});
