"""Shared email-code creation and delivery for signup and password reset."""

from fastapi import HTTPException

from utils.email_service import email_service
from utils.verification_service import verification_service


async def send_email_code(email: str, language: str) -> None:
    code = verification_service.generate_code()
    if not verification_service.save_code(email, code, expire_minutes=5):
        raise HTTPException(status_code=500, detail="VERIFICATION_CODE_SAVE_FAILED")
    locale = language if language in {"zh", "en"} else "zh"
    if not await email_service.send_verification_code(email, code, language=locale):
        raise HTTPException(status_code=500, detail="EMAIL_SEND_FAILED")
