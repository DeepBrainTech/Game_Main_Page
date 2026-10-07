"""Date keys for user-local daily and monthly activity."""

from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TZ = "UTC"


def local_now(tz: str) -> datetime:
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo(DEFAULT_TZ)
    return datetime.now(zone)


def today_in_tz(tz: str) -> str:
    return local_now(tz).date().isoformat()


def month_in_tz(tz: str) -> str:
    return local_now(tz).strftime("%Y-%m")
