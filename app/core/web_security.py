"""Same-origin browser sessions; Swagger continues to use Bearer tokens."""
from fastapi import HTTPException, Request
from app.core.config import settings

SESSION_COOKIE = 'halicmind_session'


def validate_web_request(request: Request):
    # Cross-origin forms cannot set this header. Cross-origin JS would need a
    # successful CORS preflight, which this same-origin application never grants.
    if request.headers.get('X-HalicMind-Web') != '1':
        raise HTTPException(403, 'İstek uygulama üzerinden gönderilmelidir.')
    origin = request.headers.get('origin')
    expected_origin = settings.public_origin or str(request.base_url).rstrip('/')
    if origin and origin != expected_origin:
        raise HTTPException(403, 'Farklı bir kaynaktan gönderilen istek reddedildi.')
