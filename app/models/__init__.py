"""Import mapped application models to register their tables with Base."""
from app.models.user import User
from app.models.auth import AuthRateLimit, EmailVerification
from app.models import catalog_refs  # noqa: F401 -- catalog FK targets only
from app.models.academic_profile import AcademicProfile
from app.models.academic_term import AcademicTerm
from app.models.enrollment import Enrollment

from app.models.assignment import Assignment

__all__ = ['User', 'AuthRateLimit', 'EmailVerification', 'AcademicProfile', 'AcademicTerm', 'Enrollment', 'Assignment', 'ExamDocument', 'ExamSyncState', 'ExamSelection']

from app.models.exam import ExamDocument, ExamSyncState, ExamSelection
