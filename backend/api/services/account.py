"""account business logic."""

from typing import Optional

from fastapi import HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import EmailStr
from sqlalchemy.orm import Session

from auth import (
    authenticate_user,
    clear_access_token_cookie,
    get_password_hash,
)
from models import User
from schemas import (
    APIResponse,
    GoogleTokenRequest,
    ResetPassword,
    SendVerificationCode,
    UserCreate,
)
from services.email_verification import send_email_code
from services.portal_sessions import issue_portal_session
from utils.google_oauth import verify_google_token
from utils.verification_service import verification_service


async def send_verification_code(request: SendVerificationCode):
    """Send verification code."""
    try:
        await send_email_code(request.email, request.language)

        return APIResponse(
            success=True,
            message="VERIFICATION_CODE_SENT",
            data={"email": request.email},
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"发送验证码异常: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="VERIFICATION_CODE_SEND_FAILED",
        )


async def check_availability(
    username: Optional[str], email: Optional[EmailStr], db: Session
):
    """Check whether a registration username or email is available."""
    if username is None and email is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AUTH_AVAILABILITY_FIELD_REQUIRED",
        )

    data = {}
    if username is not None:
        normalized_username = username.strip()
        if not 3 <= len(normalized_username) <= 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="AUTH_USERNAME_INVALID",
            )
        data["username_available"] = (
            db.query(User).filter(User.username == normalized_username).first() is None
        )

    if email is not None:
        normalized_email = str(email).strip()
        data["email_available"] = (
            db.query(User).filter(User.email == normalized_email).first() is None
        )

    return APIResponse(
        success=True,
        message="AUTH_AVAILABILITY_CHECKED",
        data=data,
    )


async def register(user_data: UserCreate, response: Response, db: Session):
    """Register."""

    if not verification_service.verify_code(
        user_data.email, user_data.verification_code
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="VERIFICATION_CODE_INVALID"
        )

    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="AUTH_USERNAME_EXISTS"
        )

    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="AUTH_EMAIL_EXISTS"
        )

    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        date_of_birth=user_data.date_of_birth,
        country=(user_data.country or "").upper() if user_data.country else None,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    issue_portal_session(response, new_user)

    return APIResponse(
        success=True,
        message="AUTH_REGISTER_SUCCESS",
        data={
            "user_id": new_user.id,
            "username": new_user.username,
            "auto_login": True,
        },
    )


async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm,
    remember_me: bool,
    db: Session,
):
    """Login."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="AUTH_INVALID_CREDENTIALS",
        )

    issue_portal_session(response, user, remember_me)

    return APIResponse(
        success=True,
        message="AUTH_LOGIN_SUCCESS",
        data={"username": user.username, "user_id": user.id},
    )


async def google_login(request: GoogleTokenRequest, response: Response, db: Session):
    """Google login."""
    payload = verify_google_token(request.id_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="AUTH_GOOGLE_TOKEN_INVALID",
        )

    google_id = payload.get("sub")
    email = payload.get("email") or ""
    name = (payload.get("name") or email.split("@")[0] or "user").strip()[:50]
    google_avatar_url = payload.get("picture") or None

    if not google_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AUTH_GOOGLE_TOKEN_INVALID",
        )

    user = db.query(User).filter(User.google_id == google_id).first()
    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="AUTH_USER_DISABLED",
            )
    else:
        user = db.query(User).filter(User.email == email).first()
        if user:
            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="AUTH_USER_DISABLED",
                )

            if user.google_id and user.google_id != google_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="AUTH_EMAIL_EXISTS",
                )
            if not user.google_id:
                user.google_id = google_id
            if google_avatar_url:
                user.google_avatar_url = google_avatar_url
            db.commit()
            db.refresh(user)
        else:
            base_username = (name or email.split("@")[0] or "user")[:50]
            base_username = (
                "".join(c for c in base_username if c.isalnum() or c in "._-") or "user"
            )
            username = base_username
            suffix = 0
            while db.query(User).filter(User.username == username).first():
                suffix += 1
                username = f"{base_username}{suffix}"[:50]

            user = User(
                username=username,
                email=email,
                hashed_password=None,
                google_id=google_id,
                google_avatar_url=google_avatar_url,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

    if user and google_avatar_url and user.google_avatar_url != google_avatar_url:
        user.google_avatar_url = google_avatar_url
        db.commit()
        db.refresh(user)

    issue_portal_session(response, user, request.remember_me)
    return APIResponse(
        success=True,
        message="AUTH_LOGIN_SUCCESS",
        data={"username": user.username, "user_id": user.id},
    )


async def verify_token(current_user: User):
    """Verify token."""
    return APIResponse(
        success=True,
        message="AUTH_TOKEN_VALID",
        data={"username": current_user.username, "user_id": current_user.id},
    )


async def logout(response: Response):
    """Clear the cross-subdomain HttpOnly cookie.

    Idempotent: callable even when the caller is already unauthenticated,
    so it's safe to invoke from any UI without a prior auth check.
    """
    clear_access_token_cookie(response)
    return APIResponse(success=True, message="AUTH_LOGOUT_SUCCESS", data=None)


async def send_reset_password_code(request: SendVerificationCode, db: Session):
    """Send reset password code."""
    try:
        user = db.query(User).filter(User.email == request.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="EMAIL_NOT_FOUND"
            )

        await send_email_code(request.email, request.language)

        return APIResponse(
            success=True,
            message="VERIFICATION_CODE_SENT",
            data={"email": request.email},
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"发送重置密码验证码异常: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="VERIFICATION_CODE_SEND_FAILED",
        )


async def reset_password(request: ResetPassword, db: Session):
    """Reset password."""
    try:
        if not verification_service.verify_code(
            request.email, request.verification_code
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="VERIFICATION_CODE_INVALID",
            )

        user = db.query(User).filter(User.email == request.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="EMAIL_NOT_FOUND"
            )

        user.hashed_password = get_password_hash(request.new_password)
        db.commit()

        return APIResponse(
            success=True,
            message="PASSWORD_RESET_SUCCESS",
            data={"email": request.email},
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"重置密码异常: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PASSWORD_RESET_FAILED",
        )
