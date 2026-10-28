from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.encoders import jsonable_encoder
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.db.session import engine
from app.api.v1.router import router
from app.core.config import settings

@asynccontextmanager
async def lifespan(app):
    yield
    engine.dispose()

app = FastAPI(title=settings.application_name, lifespan=lifespan)
app.include_router(router, prefix='/api/v1')
WEB_ROOT = Path(__file__).resolve().parent / 'web'
app.mount('/assets', StaticFiles(directory=WEB_ROOT), name='assets')


@app.get('/', include_in_schema=False)
def student_interface():
    return FileResponse(WEB_ROOT / 'index.html', headers={'Cache-Control': 'no-cache'})


@app.get('/api/v1/ui-config', include_in_schema=False)
def ui_config():
    return {
        'application_name': settings.application_name,
        'local_mailbox': settings.smtp_host in {'127.0.0.1', 'localhost'} and settings.smtp_port == 1025,
        'verification_expire_minutes': settings.email_verification_expire_minutes,
    }


@app.middleware('http')
async def browser_headers(request, call_next):
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    if request.url.path == '/' or request.url.path.startswith('/assets/'):
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
            "connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; "
            "frame-ancestors 'none'; form-action 'self'"
        )
        response.headers['Cache-Control'] = 'no-cache'
    if request.url.path.startswith('/api/v1/') and '/catalog/' not in request.url.path:
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    if request.url.path.startswith('/api/v1/auth/'):
        # Pydantic includes original inputs in errors by default. Passwords and
        # verification codes must not be echoed in validation responses.
        errors = [{key: value for key, value in error.items() if key not in {'input', 'ctx'}} for error in exc.errors()]
        return JSONResponse(status_code=422, content={'detail': jsonable_encoder(errors)})
    return await request_validation_exception_handler(request, exc)

@app.get('/health')
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1 FROM programs LIMIT 1'))
        return {'status': 'ok', 'database': 'postgresql'}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='Database unavailable')
