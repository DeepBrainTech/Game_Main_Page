"""learning commerce business logic."""

import math
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from config.learning_commerce import (
    MENTAL_MATH_COURSE_KEY,
    get_learning_bundle_commerce,
)
from models import User, UserCourseEntitlement
from schemas import APIResponse, MentalMathUnlockDiamondsBody
from services.assets import debit_assets, lock_account
from services.assets import get_or_create_rewards as _get_or_create_rewards
from services.idempotency import replay_operation, save_operation


def _get_course_entitlement(
    db: Session, user_id: int, course_key: str
) -> UserCourseEntitlement | None:
    return (
        db.query(UserCourseEntitlement)
        .filter(
            UserCourseEntitlement.user_id == user_id,
            UserCourseEntitlement.course_key == course_key,
        )
        .first()
    )


def _compute_mental_math_bundle_access(
    user: User, entitlement: UserCourseEntitlement | None
) -> dict:
    """Effective bundle access for lesson list UI (premium > lifetime diamond > timed diamond)."""
    now = datetime.utcnow()

    plan = getattr(user, "membership_plan", None) or "free"
    if plan == "premium":
        exp = getattr(user, "membership_expires_at", None)
        if exp is None or exp > now:
            return {
                "bundle_unlocked": True,
                "access_badge": "premium",
                "days_left": None,
                "expires_at": exp.isoformat() if exp else None,
            }

    if entitlement is not None and entitlement.diamond_tier == "lifetime":
        return {
            "bundle_unlocked": True,
            "access_badge": "full",
            "days_left": None,
            "expires_at": None,
        }

    if (
        entitlement is not None
        and entitlement.diamond_tier == "three_month"
        and entitlement.expires_at is not None
        and entitlement.expires_at > now
    ):
        sec_left = (entitlement.expires_at - now).total_seconds()
        days_left = max(0, math.ceil(sec_left / 86400.0))
        return {
            "bundle_unlocked": True,
            "access_badge": "timed",
            "days_left": days_left,
            "expires_at": entitlement.expires_at.isoformat(),
        }

    return {
        "bundle_unlocked": False,
        "access_badge": "none",
        "days_left": None,
        "expires_at": None,
    }


async def get_mental_math_bundle_access(current_user: User, db: Session):
    """Server-side Mental Math paid bundle + membership; drives learning UI."""
    ent = _get_course_entitlement(db, current_user.id, MENTAL_MATH_COURSE_KEY)
    data = _compute_mental_math_bundle_access(current_user, ent)
    rewards = _get_or_create_rewards(db, current_user.id)
    data["diamonds"] = rewards.diamonds
    return APIResponse(success=True, message="ok", data=data)


async def unlock_mental_math_with_diamonds(
    body: MentalMathUnlockDiamondsBody,
    current_user: User,
    db: Session,
    request_id: UUID | None = None,
):
    """Spend diamonds to unlock the Mental Math bundle (90-day or lifetime)."""
    lock_account(db, current_user.id)
    payload = {"course_key": MENTAL_MATH_COURSE_KEY, "tier": body.tier}
    replay = replay_operation(db, current_user.id, request_id, "course.unlock", payload)
    if replay is not None:
        return APIResponse(success=True, message="ok", data=replay)
    commerce = get_learning_bundle_commerce(MENTAL_MATH_COURSE_KEY)
    cost = (
        commerce.diamonds_three_month
        if body.tier == "three_month"
        else commerce.diamonds_lifetime
    )

    ent = _get_course_entitlement(db, current_user.id, MENTAL_MATH_COURSE_KEY)
    if ent is None:
        ent = UserCourseEntitlement(
            user_id=current_user.id,
            course_key=MENTAL_MATH_COURSE_KEY,
        )
        db.add(ent)

    if ent.diamond_tier == "lifetime":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="already_lifetime_unlocked"
        )

    if body.tier == "lifetime":
        ent.diamond_tier = "lifetime"
        ent.expires_at = None
    else:
        now = datetime.utcnow()
        base = now
        if ent.expires_at and ent.expires_at > now:
            base = ent.expires_at
        ent.diamond_tier = "three_month"
        ent.expires_at = base + timedelta(days=commerce.timed_tier_days)

    rewards = debit_assets(
        db,
        current_user.id,
        {"diamonds": cost},
        source="course:" + MENTAL_MATH_COURSE_KEY,
        request_id=str(request_id) if request_id else None,
        insufficient_detail="insufficient_diamonds",
    )
    db.add(ent)
    db.add(rewards)
    db.flush()
    access = _compute_mental_math_bundle_access(current_user, ent)
    access["diamonds"] = rewards.diamonds
    save_operation(db, current_user.id, request_id, "course.unlock", payload, access)
    db.commit()
    return APIResponse(success=True, message="ok", data=access)
