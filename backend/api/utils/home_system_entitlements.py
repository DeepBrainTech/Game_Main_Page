"""Temporary membership access, kept separate from permanent cosmetic ownership."""

from datetime import datetime, timezone
from typing import Any

from config.home_system import HOME_SYSTEM_ITEMS, is_free_home_system_item


def membership_cosmetic_item_ids(user: Any, now: datetime | None = None) -> set[str]:
    if getattr(user, "membership_plan", None) not in {"plus", "premium"}:
        return set()
    expires_at = getattr(user, "membership_expires_at", None)
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= (now or datetime.now(timezone.utc)):
            return set()
    return {item_id for item_id, item in HOME_SYSTEM_ITEMS.items() if item["tier"] == "limited"}


def sanitize_cosmetic_loadout(loadout: dict, owned_ids: set[str], membership_ids: set[str]) -> dict:
    """Remove unavailable equipment without changing permanent inventory."""
    result = dict(loadout)
    for slot, item_id in result.items():
        if item_id is None:
            continue
        item = HOME_SYSTEM_ITEMS.get(item_id)
        if not item or item["slot"] != slot or not (
            item_id in owned_ids or item_id in membership_ids or is_free_home_system_item(item)
        ):
            result[slot] = None
    return result
