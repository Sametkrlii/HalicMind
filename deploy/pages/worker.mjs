// Only proxy API requests to the configured backend; never accept a target URL from clients.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const origin = new URL(env.API_ORIGIN);
    if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.username || origin.password) {
      return new Response('Invalid API origin', { status: 503 });
    }
    const target = new URL(url.pathname + url.search, origin);
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('x-forwarded-host');
    headers.delete('x-forwarded-proto');
    headers.delete('x-forwarded-for');
    try {
      const response = await fetch(new Request(target, {
        method: request.method, headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        duplex: 'half',
        redirect: 'manual',
      }));
      const result = new Response(response.body, response);
      result.headers.set('Cache-Control', 'no-store');
      return result;
    } catch {
      return new Response('API temporarily unavailable', { status: 502 });
    }
  },
};
