"""game activity business logic."""

from datetime import datetime

from sqlalchemy.orm import Session

from config.game_catalog import REWARD_STATUS_GAME_KEYS, SUPPORTED_GAME_KEYS
from models import User, UserGamePlayByDay, UserGamePlayed, UserGameReward
from schemas import APIResponse, GamePlayRecordIn
from services.assets import get_asset_balances as _get_asset_balances
from services.assets import lock_account


def record_first_play(db: Session, user_id: int, game_key: str) -> bool:
    """Insert first-play row if missing; flush only. Caller commits. Returns True if inserted."""
    lock_account(db, user_id)
    existing = (
        db.query(UserGamePlayed)
        .filter(
            UserGamePlayed.user_id == user_id,
            UserGamePlayed.game_key == game_key,
        )
        .first()
    )
    if existing:
        return False
    db.add(UserGamePlayed(user_id=user_id, game_key=game_key))
    db.flush()
    return True


def increment_daily_play(
    db: Session, user_id: int, game_mode: str, today_iso: str
) -> None:
    """Increment daily play."""
    lock_account(db, user_id)
    row = (
        db.query(UserGamePlayByDay)
        .filter(
            UserGamePlayByDay.user_id == user_id,
            UserGamePlayByDay.game_mode == game_mode,
            UserGamePlayByDay.play_date == today_iso,
        )
        .first()
    )
    if row:
        row.count += 1
        db.add(row)
    else:
        db.add(
            UserGamePlayByDay(
                user_id=user_id, game_mode=game_mode, play_date=today_iso, count=1
            )
        )
    db.flush()


def _build_reward_status(record: UserGameReward, now: datetime) -> dict:
    _ = now
    return {
        "game_mode": record.game_mode,
        "flowers_earned": record.flowers_earned,
        "click_count": record.click_count,
        "last_played_at": record.last_played_at.isoformat()
        if record.last_played_at
        else None,
        "last_claimed_at": record.last_claimed_at.isoformat()
        if record.last_claimed_at
        else None,
        "can_claim_now": False,
        "seconds_until_next_claim": 0,
    }


def _get_or_create_reward_record(
    db: Session, user_id: int, game_mode: str
) -> UserGameReward:
    lock_account(db, user_id)
    record = (
        db.query(UserGameReward)
        .filter(
            UserGameReward.user_id == user_id,
            UserGameReward.game_mode == game_mode,
        )
        .first()
    )
    if record:
        return record

    record = UserGameReward(user_id=user_id, game_mode=game_mode)
    db.add(record)
    db.flush()
    return record


def record_play_stats(
    db: Session, user: User, game_mode: str
) -> tuple[UserGameReward, dict, int]:
    """Updates per-game click stats only; does not grant flowers or touch cooldown."""
    now = datetime.utcnow()
    record = _get_or_create_reward_record(db, user.id, game_mode)

    record.click_count += 1
    record.last_played_at = now

    db.add(record)
    db.flush()

    reward_status = _build_reward_status(record, now)
    return record, reward_status, 0


def _total_flowers_for_user(db: Session, user_id: int) -> int:
    return _get_asset_balances(db, user_id)["flowers"]


async def record_game_played(body: GamePlayRecordIn, current_user: User, db: Session):
    """Record that the user opened a game from the portal (distinct games only; independent of rewards)."""
    if body.game_key not in SUPPORTED_GAME_KEYS:
        return APIResponse(
            success=False, message="invalid_game_key", data={"game_key": body.game_key}
        )

    is_new = record_first_play(db, current_user.id, body.game_key)
    db.commit()
    total = (
        db.query(UserGamePlayed)
        .filter(UserGamePlayed.user_id == current_user.id)
        .count()
    )

    return APIResponse(
        success=True,
        message="ok",
        data={
            "played_game_count": total,
            "is_new": is_new,
        },
    )


async def track_sudoku_play(current_user: User, db: Session):
    record_first_play(db, current_user.id, "sudoku")
    _, reward_status, flowers_awarded = record_play_stats(db, current_user, "sudoku")
    db.commit()
    total_flowers = _total_flowers_for_user(db, current_user.id)
    return APIResponse(
        success=True,
        message="ok",
        data={
            "flowers_awarded": flowers_awarded,
            "reward_status": reward_status,
            "total_flowers": total_flowers,
            "assets": _get_asset_balances(db, current_user.id),
            "server_time": datetime.utcnow().isoformat(),
        },
    )


async def get_reward_status(current_user: User, db: Session):
    """Per-mode play stats and balances (legacy reward-status shape; no active cooldown claims)."""
    now = datetime.utcnow()
    modes = REWARD_STATUS_GAME_KEYS
    rewards = (
        db.query(UserGameReward).filter(UserGameReward.user_id == current_user.id).all()
    )
    reward_map = {item.game_mode: item for item in rewards}

    statuses = []
    for mode in modes:
        record = reward_map.get(mode)
        if record is None:
            statuses.append(
                {
                    "game_mode": mode,
                    "flowers_earned": 0,
                    "click_count": 0,
                    "last_played_at": None,
                    "last_claimed_at": None,
                    "can_claim_now": False,
                    "seconds_until_next_claim": 0,
                }
            )
            continue
        statuses.append(_build_reward_status(record, now))

    return APIResponse(
        success=True,
        message="ok",
        data={
            "total_flowers": _total_flowers_for_user(db, current_user.id),
            "assets": _get_asset_balances(db, current_user.id),
            "rewards": statuses,
            "server_time": now.isoformat(),
        },
    )
