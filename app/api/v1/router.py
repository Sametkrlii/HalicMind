from fastapi import APIRouter
from app.api.v1.endpoints.catalog import router as catalog_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.academic_profile import router as academic_profile_router
from app.api.v1.endpoints.terms import router as terms_router
from app.api.v1.endpoints.enrollments import router as enrollments_router
from app.api.v1.endpoints.assignments import router as assignments_router
router = APIRouter()
router.include_router(catalog_router)
router.include_router(auth_router)
router.include_router(users_router)
router.include_router(academic_profile_router)
router.include_router(terms_router)
router.include_router(enrollments_router)

router.include_router(assignments_router)

from app.api.v1.endpoints.exams import router as exams_router
router.include_router(exams_router)
