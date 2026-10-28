export class ApiError extends Error {
  constructor(message, status, retryAfter = 0) { super(message); this.status = status; this.retryAfter = retryAfter; }
}
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) { onUnauthorized = handler; }
const fieldNames = {full_name:'Ad soyad',email:'E-posta',password:'Parola',token:'Doğrulama kodu',grade:'Not',current_class:'Sınıf',entry_year:'Giriş yılı',custom_ects:'AKTS'};
function errorMessage(body) {
  if (typeof body?.detail === 'string') return body.detail;
  if (Array.isArray(body?.detail)) return body.detail.map(error => {
    const field = error.loc?.at(-1);
    const prefix = fieldNames[field] || 'Bilgi';
    if (error.type === 'string_too_short' && field === 'password') return 'Parolan en az 12 karakter olmalı.';
    if (error.type === 'string_too_long' && field === 'password') return 'Parolan en fazla 128 karakter olabilir.';
    if (error.type === 'missing') return `${prefix} alanını doldur.`;
    if (field === 'token') return 'E-postadaki 43 karakterlik doğrulama kodunun tamamını gir.';
    if (error.msg?.startsWith('Value error, ')) return error.msg.slice(13);
    return `${prefix} bilgisini kontrol et.`;
  }).join(' ');
  return 'İşlem tamamlanamadı. Lütfen tekrar dene.';
}
export async function api(path, {method='GET',body,form=false,quiet401=false,signal}={}) {
  const headers = {'X-HalicMind-Web':'1','Accept':'application/json'};
  if (body !== undefined) headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json';
  let response;
  try {
    response = await fetch(`/api/v1${path}`, {method,headers,credentials:'same-origin',signal,
      body:body === undefined ? undefined : form ? new URLSearchParams(body) : JSON.stringify(body)});
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Bağlantı kurulamadı. İnternet bağlantını ve uygulamanın açık olduğunu kontrol et.',0);
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !quiet401) onUnauthorized();
    const retry = Number(response.headers.get('Retry-After') || 0);
    throw new ApiError(errorMessage(data) + (response.status === 429 && retry ? ` ${retry} saniye sonra tekrar deneyebilirsin.` : ''), response.status, retry);
  }
  return data;
}
export async function allPages(path) {
  const rows = [];
  for (let offset=0; ; offset+=200) {
    const separator = path.includes('?') ? '&' : '?';
    const page = await api(`${path}${separator}limit=200&offset=${offset}`);
    rows.push(...page);
    if (page.length < 200) return rows;
  }
}
