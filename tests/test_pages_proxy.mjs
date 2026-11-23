import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../deploy/pages/worker.mjs';

test('Pages proxy preserves session, CSRF origin, body and cookies without caching', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(request.url, 'https://halicmind.onrender.com/api/v1/auth/login');
    assert.equal(request.headers.get('Origin'), 'https://halicmind.pages.dev');
    assert.equal(request.headers.get('Cookie'), 'halicmind_session=test');
    assert.equal(request.headers.get('X-Forwarded-For'), null);
    assert.equal(await request.text(), 'username=test');
    return new Response('{}', { headers: { 'Set-Cookie': 'halicmind_session=new; HttpOnly; Secure; Path=/api/v1' } });
  };
  try {
    const response = await worker.fetch(new Request('https://halicmind.pages.dev/api/v1/auth/login', {
      method: 'POST', body: 'username=test', headers: {
        Origin: 'https://halicmind.pages.dev', Cookie: 'halicmind_session=test', 'X-Forwarded-For': 'spoofed',
      },
    }), { API_ORIGIN: 'https://halicmind.onrender.com' });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(response.headers.get('Set-Cookie'), /HttpOnly; Secure/);
  } finally { globalThis.fetch = previous; }
});

test('Static requests use Pages assets', async () => {
  const response = await worker.fetch(new Request('https://halicmind.pages.dev/assets/app.js'), {
    ASSETS: { fetch: async () => new Response('asset') },
  });
  assert.equal(await response.text(), 'asset');
});
