"""game likes business logic."""

from sqlalchemy import func
from sqlalchemy.orm import Session

from config.game_catalog import SUPPORTED_GAME_KEYS
from models import GameLike, User
from schemas import APIResponse
from services.assets import lock_account


def _serialize_like_payload(db: Session, user_id: int) -> list[dict]:
    like_count_rows = (
        db.query(
            GameLike.game_key,
            func.count(GameLike.id),
        )
        .group_by(GameLike.game_key)
        .all()
    )
    liked_rows = db.query(GameLike.game_key).filter(GameLike.user_id == user_id).all()

    like_count_map = {row[0]: int(row[1]) for row in like_count_rows}
    liked_set = {row[0] for row in liked_rows}

    return [
        {
            "game_key": game_key,
            "like_count": like_count_map.get(game_key, 0),
            "liked_by_me": game_key in liked_set,
        }
        for game_key in sorted(SUPPORTED_GAME_KEYS)
    ]


async def get_game_likes(current_user: User, db: Session):
    return APIResponse(
        success=True,
        message="ok",
        data={
            "likes": _serialize_like_payload(db, current_user.id),
        },
    )


async def like_game(game_key: str, current_user: User, db: Session):
    if game_key not in SUPPORTED_GAME_KEYS:
        return APIResponse(
            success=False, message="invalid_game_key", data={"game_key": game_key}
        )

    lock_account(db, current_user.id)
    existing = (
        db.query(GameLike)
        .filter(
            GameLike.user_id == current_user.id,
            GameLike.game_key == game_key,
        )
        .first()
    )
    if not existing:
        db.add(GameLike(user_id=current_user.id, game_key=game_key))
        db.commit()

    return APIResponse(
        success=True,
        message="ok",
        data={
            "likes": _serialize_like_payload(db, current_user.id),
        },
    )


async def unlike_game(game_key: str, current_user: User, db: Session):
    if game_key not in SUPPORTED_GAME_KEYS:
        return APIResponse(
            success=False, message="invalid_game_key", data={"game_key": game_key}
        )

    lock_account(db, current_user.id)
    existing = (
        db.query(GameLike)
        .filter(
            GameLike.user_id == current_user.id,
            GameLike.game_key == game_key,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()

    return APIResponse(
        success=True,
        message="ok",
        data={
            "likes": _serialize_like_payload(db, current_user.id),
        },
    )
