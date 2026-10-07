"""profile business logic."""

from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from config.profile import ALLOWED_AVATAR_MIME_TYPES, MAX_AVATAR_UPLOAD_BYTES
from models import User
from schemas import CompleteProfileBody, UserResponse, compute_age
from services.avatars import avatar_url
from services.portal_sessions import issue_portal_session
from utils.r2_storage import upload_object_bytes


def _build_avatar_url(user: User) -> Optional[str]:
    return avatar_url(user.avatar_object_key, user.google_avatar_url)


def _user_to_response(user: User) -> UserResponse:
    """User to response."""
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        created_at=user.created_at,
        date_of_birth=user.date_of_birth,
        country=user.country,
        avatar_url=_build_avatar_url(user),
        age=compute_age(user.date_of_birth),
        membership_plan=getattr(user, "membership_plan", None) or "free",
        membership_expires_at=getattr(user, "membership_expires_at", None),
        membership_billing_interval=getattr(user, "membership_billing_interval", None),
        membership_pending_plan=getattr(user, "membership_pending_plan", None),
        membership_pending_billing_interval=getattr(
            user, "membership_pending_billing_interval", None
        ),
        membership_pending_effective_at=getattr(
            user, "membership_pending_effective_at", None
        ),
        stripe_customer_id=getattr(user, "stripe_customer_id", None),
        stripe_subscription_id=getattr(user, "stripe_subscription_id", None),
        membership_trial_used=bool(getattr(user, "membership_trial_used", False)),
    )


async def get_current_user_info(current_user: User):
    """Get current user info."""
    return _user_to_response(current_user)


async def update_current_user_profile(
    body: CompleteProfileBody, response: Response, current_user: User, db: Session
):
    """Update current user profile."""
    original_username = current_user.username

    if body.username is not None:
        if len(body.username) < 3 or len(body.username) > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="AUTH_USERNAME_INVALID",
            )
        existing = (
            db.query(User)
            .filter(User.username == body.username, User.id != current_user.id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="AUTH_USERNAME_EXISTS",
            )
        current_user.username = body.username
    if body.date_of_birth is not None:
        current_user.date_of_birth = body.date_of_birth
    if "country" in body.model_fields_set:
        current_user.country = (body.country or "").upper() if body.country else None
    db.commit()
    db.refresh(current_user)

    if body.username is not None and body.username != original_username:
        issue_portal_session(response, current_user)

    return _user_to_response(current_user)


async def upload_avatar(file: UploadFile, current_user: User, db: Session):
    """Upload current user avatar and return the updated profile."""
    mime_type = (file.content_type or "").lower().strip()
    ext = ALLOWED_AVATAR_MIME_TYPES.get(mime_type)
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AUTH_AVATAR_UNSUPPORTED",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AUTH_AVATAR_EMPTY",
        )
    if len(content) > MAX_AVATAR_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AUTH_AVATAR_TOO_LARGE",
        )

    object_key = f"Avatar/{current_user.id}/{uuid4().hex}.{ext}"
    try:
        upload_object_bytes(
            object_key=object_key,
            content=content,
            content_type=mime_type,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AUTH_AVATAR_UPLOAD_FAILED: {str(exc)}",
        ) from exc

    current_user.avatar_object_key = object_key
    db.commit()
    db.refresh(current_user)
    return _user_to_response(current_user)
