from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.db.session import engine
from app.api.v1.router import router

@asynccontextmanager
async def lifespan(app):
    yield
    engine.dispose()

app = FastAPI(title='HaliçMind', lifespan=lifespan)
app.include_router(router, prefix='/api/v1')

@app.get('/health')
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1 FROM programs LIMIT 1'))
        return {'status': 'ok', 'database': 'postgresql'}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail='Database unavailable')
