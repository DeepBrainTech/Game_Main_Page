from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import UserNotification


def create_user_notification(
    db: Session,
    *,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
    icon: str,
    source: str | None = None,
    source_event_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    commit: bool = True,
) -> UserNotification | None:
    """Create a notification once; Stripe may retry webhooks with the same event id."""
    if source_event_id:
        existing = (
            db.query(UserNotification)
            .filter(UserNotification.source_event_id == source_event_id)
            .first()
        )
        if existing:
            return existing

    notification = UserNotification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        icon=icon,
        source=source,
        source_event_id=source_event_id,
        notification_metadata=metadata or {},
    )
    db.add(notification)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None
    db.refresh(notification)
    return notification
