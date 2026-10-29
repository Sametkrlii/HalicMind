import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardData} from '../app/web/dashboard.js';
const base={termId:1,courses:[],assignments:[],examCalendars:[]};
test('dashboard excludes other terms and archives; counts only confirmed exams',()=>{
 const state={...base,courses:[{term_id:1,status:'passed'},{term_id:2,status:'passed'},{term_id:1,status:'failed',archived_at:'x'}],assignments:[{term_id:1,status:'pending',due_at:'2026-10-29T10:00:00+03:00'},{term_id:1,status:'completed',due_at:'2026-10-30T10:00:00+03:00'},{term_id:2,status:'pending',due_at:'2026-10-30T10:00:00+03:00'}],examCalendars:[{term_id:1,exams:[{status:'selection_required'},{status:'confirmed',selected:{starts_at:'2026-10-30T14:00:00+03:00'}}]}]};
 const d=dashboardData(state,new Date('2026-10-29T12:00:00+03:00'));
 assert.equal(d.courses.length,1);assert.equal(d.passed,1);assert.equal(d.pending.length,1);assert.equal(d.completed,1);assert.equal(d.overdue,0);assert.equal(d.exams.length,1);assert.equal(d.days[0].assignments,1);assert.equal(d.agenda.length,2);
});
test('Istanbul day boundaries and empty data do not invent activity',()=>{
 const d=dashboardData(base,new Date('2026-10-29T22:30:00Z'));
 assert.equal(d.days[0].key,'2026-10-30');assert.equal(d.days.length,7);assert.equal(d.completed,0);assert.deepEqual(d.agenda,[]);assert.equal(d.days.reduce((n,x)=>n+x.assignments+x.exams,0),0);
});
