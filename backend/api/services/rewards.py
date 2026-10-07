"""rewards business logic."""

from datetime import date, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from config.rewards import (
    CHECK_IN_COINS,
    DAILY_TASK_COINS,
    GAME_MODE_DAILY_1,
    GAME_MODE_DAILY_2,
    GAME_MODE_MONTHLY,
    MONTHLY_TARGET,
    MONTHLY_TASK_DIAMONDS,
    PLUS_CHECK_IN_BONUS_DIAMONDS,
    PREMIUM_CHECK_IN_BONUS_COINS,
    PREMIUM_CHECK_IN_BONUS_DIAMONDS,
    STREAK_DAYS,
    STREAK_DIAMONDS,
    STREAK_TOTAL_COINS,
)
from lib.dates import DEFAULT_TZ
from lib.dates import month_in_tz as _this_month_in_tz
from lib.dates import today_in_tz as _today_in_tz
from models import User, UserCheckIn, UserGamePlayByDay, UserGamePlayed, UserTaskClaim
from schemas import APIResponse
from services.assets import balances as _balances_dict
from services.assets import credit_assets, lock_account
from services.assets import get_or_create_rewards as _get_or_create_rewards


def _check_in_dates_this_month(db: Session, user_id: int, today_iso: str) -> list[str]:
    """Check in dates this month."""
    d = date.fromisoformat(today_iso)
    start = d.replace(day=1).isoformat()
    end = today_iso
    rows = (
        db.query(UserCheckIn.check_in_date)
        .filter(
            UserCheckIn.user_id == user_id,
            UserCheckIn.check_in_date >= start,
            UserCheckIn.check_in_date <= end,
        )
        .order_by(UserCheckIn.check_in_date)
        .all()
    )
    return [r[0] for r in rows]


def _current_streak(
    db: Session, user_id: int, sorted_dates: list[str], today_iso: str
) -> int:
    if not sorted_dates:
        return 0
    if today_iso not in sorted_dates:
        return 0
    streak = 0
    d = date.fromisoformat(today_iso)
    while True:
        key = d.isoformat()
        if key not in sorted_dates:
            break
        streak += 1
        d -= timedelta(days=1)
    return streak


def _active_membership_bonus_plan(user: User) -> str | None:
    plan = getattr(user, "membership_plan", None) or "free"
    if plan not in {"plus", "premium"}:
        return None
    expires_at = getattr(user, "membership_expires_at", None)
    if expires_at is not None and expires_at <= datetime.utcnow():
        return None
    return plan


def _daily_progress_from_games(db: Session, user_id: int, today_iso: str) -> dict:
    """Daily progress from games."""
    out = {}
    for mode, task_id in [
        (GAME_MODE_DAILY_1, "daily-1"),
        (GAME_MODE_DAILY_2, "daily-2"),
    ]:
        r = (
            db.query(UserGamePlayByDay)
            .filter(
                UserGamePlayByDay.user_id == user_id,
                UserGamePlayByDay.game_mode == mode,
                UserGamePlayByDay.play_date == today_iso,
            )
            .first()
        )
        out[task_id] = r.count if r else 0
    return out


def _monthly_progress_from_games(db: Session, user_id: int, month_ym: str) -> int:
    """Monthly progress from games."""
    row = (
        db.query(func.coalesce(func.sum(UserGamePlayByDay.count), 0))
        .filter(
            UserGamePlayByDay.user_id == user_id,
            UserGamePlayByDay.game_mode == GAME_MODE_MONTHLY,
            UserGamePlayByDay.play_date.like(f"{month_ym}-%"),
        )
        .scalar()
    )
    return int(row) if row is not None else 0


def _task_claimed_today(db: Session, user_id: int, today_iso: str) -> list[str]:
    rows = (
        db.query(UserTaskClaim.task_id)
        .filter(
            UserTaskClaim.user_id == user_id, UserTaskClaim.claimed_date == today_iso
        )
        .all()
    )
    return [r[0] for r in rows]


def _monthly_claimed(db: Session, user_id: int, month_ym: str) -> bool:
    return (
        db.query(UserTaskClaim)
        .filter(
            UserTaskClaim.user_id == user_id,
            UserTaskClaim.task_id == "monthly-1",
            UserTaskClaim.claimed_date == month_ym,
        )
        .first()
        is not None
    )


async def get_rewards(current_user: User, db: Session, x_user_timezone: str | None):
    """Get rewards."""
    tz = (x_user_timezone or "").strip() or DEFAULT_TZ
    today_iso = _today_in_tz(tz)
    month_ym = _this_month_in_tz(tz)

    rewards = _get_or_create_rewards(db, current_user.id)
    check_in_dates = _check_in_dates_this_month(db, current_user.id, today_iso)
    all_dates = (
        db.query(UserCheckIn.check_in_date)
        .filter(UserCheckIn.user_id == current_user.id)
        .order_by(UserCheckIn.check_in_date)
        .all()
    )
    sorted_dates = [r[0] for r in all_dates]
    streak = _current_streak(db, current_user.id, sorted_dates, today_iso)
    daily_progress = _daily_progress_from_games(db, current_user.id, today_iso)
    monthly_progress = _monthly_progress_from_games(db, current_user.id, month_ym)
    task_claimed = _task_claimed_today(db, current_user.id, today_iso)
    monthly_claimed = _monthly_claimed(db, current_user.id, month_ym)

    played_game_count = (
        db.query(UserGamePlayed)
        .filter(UserGamePlayed.user_id == current_user.id)
        .count()
    )

    return APIResponse(
        success=True,
        message="ok",
        data={
            "coins": rewards.coins,
            "diamonds": rewards.diamonds,
            "flowers": rewards.flowers,
            "check_in_dates": check_in_dates,
            "has_checked_in_today": today_iso in sorted_dates,
            "current_streak": streak,
            "daily_progress": daily_progress,
            "monthly_progress": monthly_progress,
            "monthly_target": MONTHLY_TARGET,
            "task_claimed_today": task_claimed,
            "monthly_claimed": monthly_claimed,
            "played_game_count": played_game_count,
        },
    )


async def do_check_in(current_user: User, db: Session, x_user_timezone: str | None):
    """Daily check-in (user timezone). Base CHECK_IN_COINS; each 7-day streak milestone adds streak coins to STREAK_TOTAL_COINS that day and STREAK_DIAMONDS once per 7-day window."""
    lock_account(db, current_user.id)
    tz = (x_user_timezone or "").strip() or DEFAULT_TZ
    today = _today_in_tz(tz)

    existing = (
        db.query(UserCheckIn)
        .filter(
            UserCheckIn.user_id == current_user.id, UserCheckIn.check_in_date == today
        )
        .first()
    )
    if existing:
        return APIResponse(
            success=True,
            message="already_checked_in",
            data={
                "coins": 0,
                "membership_bonus_plan": None,
                "membership_bonus_coins": 0,
                "membership_bonus_diamonds": 0,
                "diamonds": 0,
                "flowers": 0,
            },
        )

    db.add(UserCheckIn(user_id=current_user.id, check_in_date=today))
    rewards = _get_or_create_rewards(db, current_user.id)
    coins_awarded = CHECK_IN_COINS
    diamonds_awarded = 0
    membership_bonus_plan = _active_membership_bonus_plan(current_user)
    membership_bonus_coins = 0
    membership_bonus_diamonds = 0
    if membership_bonus_plan == "plus":
        membership_bonus_diamonds = PLUS_CHECK_IN_BONUS_DIAMONDS
    elif membership_bonus_plan == "premium":
        membership_bonus_coins = PREMIUM_CHECK_IN_BONUS_COINS
        membership_bonus_diamonds = PREMIUM_CHECK_IN_BONUS_DIAMONDS
    # Session is configured with autoflush=False, so persist pending check-in
    # before querying streak dates; otherwise "today" is missing from all_dates.
    db.flush()

    all_dates = [
        r[0]
        for r in db.query(UserCheckIn.check_in_date)
        .filter(UserCheckIn.user_id == current_user.id)
        .order_by(UserCheckIn.check_in_date)
        .all()
    ]
    streak = _current_streak(db, current_user.id, all_dates, today)
    if streak >= STREAK_DAYS and streak % STREAK_DAYS == 0:
        streak_start = date.fromisoformat(today) - timedelta(days=STREAK_DAYS - 1)
        streak_start_str = streak_start.isoformat()
        if rewards.last_streak_award_start != streak_start_str:
            # Milestone day total should be 200 coins, not 200 + daily base.
            milestone_extra_coins = max(0, STREAK_TOTAL_COINS - CHECK_IN_COINS)
            coins_awarded += milestone_extra_coins
            rewards.last_streak_award_start = streak_start_str
            diamonds_awarded = STREAK_DIAMONDS
    rewards = credit_assets(
        db,
        current_user.id,
        {
            "coins": coins_awarded + membership_bonus_coins,
            "diamonds": diamonds_awarded + membership_bonus_diamonds,
        },
        source="check-in",
        request_id=today,
    )
    db.commit()
    db.refresh(rewards)
    return APIResponse(
        success=True,
        message="ok",
        data={
            "coins": coins_awarded,
            "membership_bonus_plan": membership_bonus_plan,
            "membership_bonus_coins": membership_bonus_coins,
            "membership_bonus_diamonds": membership_bonus_diamonds,
            "diamonds": diamonds_awarded,
            "flowers": 0,
        },
    )


async def claim_task(
    task_id: str, current_user: User, db: Session, x_user_timezone: str | None
):
    """Claim task."""
    lock_account(db, current_user.id)
    tz = (x_user_timezone or "").strip() or DEFAULT_TZ
    today = _today_in_tz(tz)
    month = _this_month_in_tz(tz)

    rewards = _get_or_create_rewards(db, current_user.id)

    if task_id == "daily-1":
        progress = _daily_progress_from_games(db, current_user.id, today).get(
            "daily-1", 0
        )
        if progress < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="task_not_completed"
            )
        if task_id in _task_claimed_today(db, current_user.id, today):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="already_claimed"
            )
        rewards = credit_assets(
            db,
            current_user.id,
            {"coins": DAILY_TASK_COINS},
            source="task:" + task_id,
            request_id=today,
        )
        db.add(
            UserTaskClaim(user_id=current_user.id, task_id=task_id, claimed_date=today)
        )
    elif task_id == "daily-2":
        progress = _daily_progress_from_games(db, current_user.id, today).get(
            "daily-2", 0
        )
        if progress < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="task_not_completed"
            )
        if task_id in _task_claimed_today(db, current_user.id, today):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="already_claimed"
            )
        rewards = credit_assets(
            db,
            current_user.id,
            {"coins": DAILY_TASK_COINS},
            source="task:" + task_id,
            request_id=today,
        )
        db.add(
            UserTaskClaim(user_id=current_user.id, task_id=task_id, claimed_date=today)
        )
    elif task_id == "monthly-1":
        progress = _monthly_progress_from_games(db, current_user.id, month)
        if progress < MONTHLY_TARGET:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="task_not_completed"
            )
        if _monthly_claimed(db, current_user.id, month):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="already_claimed"
            )
        rewards = credit_assets(
            db,
            current_user.id,
            {"diamonds": MONTHLY_TASK_DIAMONDS},
            source="task:" + task_id,
            request_id=month,
        )
        db.add(
            UserTaskClaim(user_id=current_user.id, task_id=task_id, claimed_date=month)
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_task_id"
        )
    db.commit()
    db.refresh(rewards)
    return APIResponse(success=True, message="ok", data=_balances_dict(rewards))
