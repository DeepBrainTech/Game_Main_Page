"""HTTP endpoints for notifications."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from auth import get_current_active_user
from database import get_db
from models import User
from schemas import APIResponse
from services import notifications

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=APIResponse)
async def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await notifications.list_notifications(
        limit=limit, current_user=current_user, db=db
    )


@router.patch("/mark-all-read", response_model=APIResponse)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await notifications.mark_all_notifications_read(
        current_user=current_user, db=db
    )


@router.patch("/{notification_id}/read", response_model=APIResponse)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await notifications.mark_notification_read(
        notification_id=notification_id, current_user=current_user, db=db
    )
