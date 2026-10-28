"""Student email admission policy, reusable by future registration schemas."""
import re

ALLOWED_STUDENT_EMAIL_DOMAINS = frozenset({'ogr.halic.edu.tr'})


def normalize_student_email(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError('E-posta adresi metin olmalıdır.')
    email = value.strip().lower()
    if not email:
        raise ValueError('Email must not be empty')
    student_number, separator, domain = email.partition('@')
    if (
        not separator
        or domain not in ALLOWED_STUDENT_EMAIL_DOMAINS
        or re.fullmatch(r'[0-9]+', student_number) is None
        or len(email) > 254
    ):
        raise ValueError(
            'Yalnızca öğrenci_numarası@ogr.halic.edu.tr biçimindeki '
            'Haliç Üniversitesi öğrenci e-posta adresleri kabul edilir.'
        )
    return email
