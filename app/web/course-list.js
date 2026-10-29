export function normalizeCourseText(value){return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').trim();}
const collator=new Intl.Collator('tr',{numeric:true,sensitivity:'base'});
export function visibleCourses(courses,{termId,archives=false,status='all',query='',sort='name'}={}){
  const words=normalizeCourseText(query).split(/\s+/).filter(Boolean);
  const result=courses.filter(course=>course.term_id===termId && (archives || !course.archived_at) && (status==='all' || course.status===status) && words.every(word=>normalizeCourseText(`${course.course_code} ${course.course_name}`).includes(word)));
  return result.sort((a,b)=>{
    if(sort==='ects'){const difference=(b.ects===null?-1:Number(b.ects))-(a.ects===null?-1:Number(a.ects));if(difference)return difference;}
    if(sort==='recent')return b.id-a.id;
    return collator.compare(sort==='code'?a.course_code:a.course_name,sort==='code'?b.course_code:b.course_name) || a.id-b.id;
  });
}
