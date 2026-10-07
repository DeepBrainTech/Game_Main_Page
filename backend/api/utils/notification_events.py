"""Redis-backed notification event fan-out for Server-Sent Events."""

import os

import redis
from sqlalchemy import event
from sqlalchemy.orm import Session

CHANNEL_PREFIX = "portal:notifications:user:"
_publisher: redis.Redis | None = None


def _redis_options() -> dict:
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        return {
            "connection_pool": redis.ConnectionPool.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
        }
    return {
        "host": os.getenv("REDIS_HOST") or os.getenv("REDISHOST", "localhost"),
        "port": int(os.getenv("REDIS_PORT") or os.getenv("REDISPORT", "6379")),
        "db": int(os.getenv("REDIS_DB", "0")),
        "password": os.getenv("REDIS_PASSWORD") or os.getenv("REDISPASSWORD"),
        "decode_responses": True,
    }


def notification_channel(user_id: int) -> str:
    return f"{CHANNEL_PREFIX}{user_id}"


def create_async_redis_client():
    from redis.asyncio import Redis

    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        return Redis.from_url(redis_url, decode_responses=True)
    return Redis(
        host=os.getenv("REDIS_HOST") or os.getenv("REDISHOST", "localhost"),
        port=int(os.getenv("REDIS_PORT") or os.getenv("REDISPORT", "6379")),
        db=int(os.getenv("REDIS_DB", "0")),
        password=os.getenv("REDIS_PASSWORD") or os.getenv("REDISPASSWORD"),
        decode_responses=True,
    )


def schedule_notification_event(db: Session, user_id: int) -> None:
    """Publish only after the transaction that wrote the notification commits."""
    db.info.setdefault("notification_event_user_ids", set()).add(int(user_id))


@event.listens_for(Session, "after_commit")
def _publish_committed_notification_events(db: Session) -> None:
    global _publisher
    user_ids = db.info.pop("notification_event_user_ids", set())
    if not user_ids:
        return
    try:
        if _publisher is None:
            options = _redis_options()
            if "connection_pool" in options:
                _publisher = redis.Redis(connection_pool=options["connection_pool"])
            else:
                options.update(socket_connect_timeout=1, socket_timeout=1)
                _publisher = redis.Redis(**options)
        for user_id in user_ids:
            _publisher.publish(notification_channel(user_id), "notification_changed")
    except Exception:
        # Notifications remain persisted; clients refresh again on reconnect/focus.
        _publisher = None


@event.listens_for(Session, "after_rollback")
def _discard_rolled_back_notification_events(db: Session) -> None:
    db.info.pop("notification_event_user_ids", None)
