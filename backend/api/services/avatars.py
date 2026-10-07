"""Consistent avatar URL resolution for profiles and leaderboard entries."""

from utils.r2_storage import generate_object_read_url


def avatar_url(object_key: str | None, google_url: str | None) -> str | None:
    if object_key:
        try:
            return generate_object_read_url(
                object_key=object_key, expires_seconds=86400
            )
        except Exception:
            pass
    return google_url or None
