const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const assets = path.resolve(__dirname, '../../app/web');
for (const width of [390, 1440]) {
  test(`course actions survive an exam outage at ${width}px`, async () => {
    const browser = await chromium.launch({channel:'chrome'});
    try {
      const page = await browser.newPage({viewport:{width,height:900}});
      page.setDefaultTimeout(5000);
      let examStatus = 503;
      let releaseCalendar;
      const firstCalendar = new Promise(resolve => { releaseCalendar = resolve; });
      const course = {id:1,term_id:1,course_id:null,archived_at:null,course_code:'TST101',course_name:'Deneme dersi',status:'in_progress',ects:3};
      const term = {id:1,program_id:1,curriculum_id:1,term_type:'fall',academic_year:2026,is_preparation:false};
      const routes = {
        '/ui-config':{}, '/users/me':{full_name:'Test Öğrenci'}, '/users/me/academic-profile':{program_id:1},
        '/catalog/programs':[], '/catalog/academic-units':[], '/catalog/curricula':[],
        '/terms':[term], '/enrollments':[], '/assignments':[], '/exams/sync-status':{}
      };
      await page.route('http://workspace.test/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/api/v1/')) {
          const name = path.basename(url.pathname) || 'index.html';
          const type = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
          return route.fulfill({body:await readFile(path.join(assets,name)),contentType:type[path.extname(name)]});
        }
        const endpoint = url.pathname.slice(7);
        if (endpoint === '/exams/calendar') {
          await firstCalendar;
          return route.fulfill({status:examStatus,json:examStatus === 200 ? [{term_id:1,status:'unavailable',reason:'Güncel deneme takvimi',periods:[],exams:[]}] : {}});
        }
        if (endpoint === '/enrollments/1') return route.fulfill({status:204});
        if (endpoint === '/enrollments/1/restore' || (endpoint === '/enrollments' && route.request().method() === 'POST'))
          return route.fulfill({json:course});
        if (endpoint.endsWith('/suggestions')) return route.fulfill({json:{courses:[],elective_groups:[]}});
        assert.ok(Object.hasOwn(routes,endpoint),endpoint);
        await route.fulfill({json:routes[endpoint]});
      });
      await page.goto('http://workspace.test/#/courses');
      await page.getByRole('heading',{name:'Derslerim'}).waitFor();
      releaseCalendar();
      await page.locator('[data-action="add-course"]').first().click();
      await page.locator('[data-tab="custom"]').first().click();
      const form = page.locator('[data-form="custom-course"]');
      await form.locator('[name="custom_course_code"]').fill(course.course_code);
      await form.locator('[name="custom_course_name"]').fill(course.course_name);
      await form.locator('[type="submit"]').click();
      const title = page.getByRole('heading',{name:course.course_name});
      await title.waitFor();
      await page.locator('[data-action="archive-course"]').click();
      await title.waitFor({state:'hidden'});
      await page.getByRole('button',{name:'Geri al'}).click();
      await title.waitFor();
      await page.evaluate(() => { location.hash='/exams'; });
      await page.getByText('Sınav takvimi yüklenemedi').waitFor();
      examStatus = 200;
      await page.getByRole('button',{name:'Yeniden dene'}).click();
      await page.getByText('Güncel deneme takvimi').waitFor();
      examStatus = 401;
      await page.locator('.exam-resources summary').click();
      await page.locator('[data-action="refresh-exams"]').click();
      await page.locator('[data-form="login"]').waitFor();
    } finally {
      await browser.close();
    }
  });
}
