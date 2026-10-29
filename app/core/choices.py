"""Shared API choices. Values are stored unchanged as strings in PostgreSQL.

Database CHECK constraints and historical migrations remain explicit; adding a
new value also requires a migration and a matching interface label.
"""
from typing import Literal

CourseStatus = Literal['in_progress', 'passed', 'failed', 'withdrawn', 'exempt']
TermType = Literal['fall', 'spring', 'summer', 'annual']
PeriodKind = Literal['semester', 'year']
PreparationStatus = Literal['not_required', 'in_progress', 'completed', 'exempt']

AssignmentPriority = Literal['low', 'normal', 'high']
AssignmentStatus = Literal['pending', 'completed']
