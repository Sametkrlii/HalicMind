from fastapi import APIRouter
from app.api.v1.endpoints.catalog import router as catalog_router
router = APIRouter()
router.include_router(catalog_router)
