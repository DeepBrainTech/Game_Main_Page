"""notifications business logic."""

from datetime import datetime

from sqlalchemy.orm import Session

from models import User, UserNotification
from schemas import APIResponse
from utils.notification_events import schedule_notification_event


def _notification_payload(row: UserNotification) -> dict:
    return {
        "id": row.id,
        "type": row.type,
        "title": row.title,
        "message": row.message,
        "icon": row.icon,
        "is_read": bool(row.is_read),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "read_at": row.read_at.isoformat() if row.read_at else None,
        "metadata": row.notification_metadata or {},
    }


async def list_notifications(
    limit: int, current_user: User, db: Session, before_id: int | None = None
):
    query = db.query(UserNotification).filter(UserNotification.user_id == current_user.id)
    if before_id is not None:
        query = query.filter(UserNotification.id < before_id)
    rows = (
        query
        .order_by(UserNotification.id.desc())
        .limit(limit)
        .all()
    )
    unread_count = (
        db.query(UserNotification)
        .filter(
            UserNotification.user_id == current_user.id,
            UserNotification.is_read == False,
        )
        .count()
    )
    return APIResponse(
        success=True,
        message="ok",
        data={
            "notifications": [_notification_payload(row) for row in rows],
            "unread_count": unread_count,
        },
    )


async def mark_all_notifications_read(current_user: User, db: Session):
    now = datetime.utcnow()
    (
        db.query(UserNotification)
        .filter(
            UserNotification.user_id == current_user.id,
            UserNotification.is_read == False,
        )
        .update(
            {
                UserNotification.is_read: True,
                UserNotification.read_at: now,
            },
            synchronize_session=False,
        )
    )
    schedule_notification_event(db, current_user.id)
    db.commit()
    return APIResponse(success=True, message="ok", data={"read_at": now.isoformat()})


async def mark_notification_read(notification_id: int, current_user: User, db: Session):
    now = datetime.utcnow()
    row = (
        db.query(UserNotification)
        .filter(
            UserNotification.id == notification_id,
            UserNotification.user_id == current_user.id,
        )
        .first()
    )
    if row is None:
        return APIResponse(success=True, message="ok", data={})
    row.is_read = True
    row.read_at = now
    db.add(row)
    schedule_notification_event(db, current_user.id)
    db.commit()
    return APIResponse(success=True, message="ok", data={"read_at": now.isoformat()})
