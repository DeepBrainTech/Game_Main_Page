"""HTTP endpoints for notifications."""

import asyncio
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from auth import (
    ACCESS_TOKEN_COOKIE_NAME,
    ALGORITHM,
    SECRET_KEY,
    get_current_active_user,
)
from database import SessionLocal, get_db
from models import User
from schemas import APIResponse
from services import notifications
from utils.notification_events import create_async_redis_client, notification_channel

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/events")
async def notification_events(request: Request):
    """Stream notification-change events to the authenticated account."""
    raw_token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    try:
        payload = jwt.decode(raw_token or "", SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="AUTH_INVALID_TOKEN"
        ) from exc
    expires_at = payload.get("exp")
    if (
        not isinstance(username, str)
        or not username
        or not isinstance(expires_at, (int, float))
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="AUTH_INVALID_TOKEN"
        )

    with SessionLocal() as db:
        user = db.query(User).filter(User.username == username).first()
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="AUTH_INVALID_TOKEN"
            )
        user_id = user.id

    redis_client = create_async_redis_client()
    try:
        await redis_client.ping()
    except Exception as exc:
        try:
            await redis_client.aclose()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="notification_events_unavailable",
        ) from exc

    async def stream_events():
        pubsub = redis_client.pubsub()
        try:
            await pubsub.subscribe(notification_channel(user_id))
            yield "retry: 3000\nevent: ready\ndata: {}\n\n"
            while time.time() < expires_at and not await request.is_disconnected():
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=15
                )
                if message is not None:
                    yield "event: notification\ndata: {}\n\n"
                else:
                    yield ": keep-alive\n\n"
        except asyncio.CancelledError:
            raise
        finally:
            try:
                await pubsub.unsubscribe(notification_channel(user_id))
            except Exception:
                pass
            try:
                await pubsub.aclose()
            finally:
                await redis_client.aclose()

    return StreamingResponse(
        stream_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("", response_model=APIResponse)
async def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    before_id: int | None = Query(None, ge=1),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await notifications.list_notifications(
        limit=limit, current_user=current_user, db=db, before_id=before_id
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
