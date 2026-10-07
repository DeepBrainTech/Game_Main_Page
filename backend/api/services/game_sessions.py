"""game sessions business logic."""

from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from config.game_auth import (
    create_game_token,
    get_game_auth_entry_by_api_slug,
    validate_game_signing,
)
from lib.dates import DEFAULT_TZ
from lib.dates import today_in_tz as _today_in_tz
from models import User
from schemas import APIResponse
from services.assets import get_asset_balances as _get_asset_balances
from services.game_activity import (
    _total_flowers_for_user,
    increment_daily_play,
    record_first_play,
    record_play_stats,
)


def _build_token_response(
    current_user: User,
    game_token: str,
    expires_in: int,
    reward_status: dict,
    flowers_awarded: int,
    total_flowers: int,
    assets: dict,
) -> APIResponse:
    return APIResponse(
        success=True,
        message="ok",
        data={
            "game_token": game_token,
            "expires_in": expires_in,
            "flowers_awarded": flowers_awarded,
            "reward_status": reward_status,
            "total_flowers": total_flowers,
            "assets": assets,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
            },
        },
    )


def _build_game_session_response(
    current_user: User,
    game_token: str,
    expires_in: int,
) -> APIResponse:
    """Build lightweight game session-refresh response."""
    return APIResponse(
        success=True,
        message="ok",
        data={
            "game_token": game_token,
            "expires_in": expires_in,
            "user_id": current_user.id,
            "username": current_user.username,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
            },
        },
    )


def _user_token_claims(user: User) -> dict:
    return {
        "sub": user.username,
        "user_id": user.id,
        "username": user.username,
    }


def _issue_game_token_response(
    current_user: User,
    db: Session,
    game_key: str,
    *,
    track_daily: bool = False,
    user_timezone: str | None = None,
) -> APIResponse:
    """Issue a short-lived game JWT and record portal-side play stats."""
    _validate_signing(game_key)
    if track_daily:
        tz = (user_timezone or "").strip() or DEFAULT_TZ
        increment_daily_play(db, current_user.id, game_key, _today_in_tz(tz))

    record_first_play(db, current_user.id, game_key)
    token, expires_in = create_game_token(game_key, _user_token_claims(current_user))
    _, reward_status, flowers_awarded = record_play_stats(db, current_user, game_key)
    db.commit()
    total_flowers = _total_flowers_for_user(db, current_user.id)
    assets = _get_asset_balances(db, current_user.id)
    return _build_token_response(
        current_user=current_user,
        game_token=token,
        expires_in=expires_in,
        reward_status=reward_status,
        flowers_awarded=flowers_awarded,
        total_flowers=total_flowers,
        assets=assets,
    )


def _refresh_game_session_response(current_user: User, game_key: str) -> APIResponse:
    """Silent refresh: issue a fresh short-lived game token without mutating play stats."""
    _validate_signing(game_key)
    token, expires_in = create_game_token(game_key, _user_token_claims(current_user))
    return _build_game_session_response(
        current_user=current_user,
        game_token=token,
        expires_in=expires_in,
    )


async def issue_game_token(
    api_slug: str, current_user: User, db: Session, x_user_timezone: str | None
):
    """Issue a short-lived JWT for an embedded game (bootstrap / first paint)."""
    entry = get_game_auth_entry_by_api_slug(api_slug)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="unknown_game"
        )

    return _issue_game_token_response(
        current_user,
        db,
        entry.game_key,
        track_daily=entry.track_daily_play,
        user_timezone=x_user_timezone,
    )


async def refresh_game_session(api_slug: str, response: Response, current_user: User):
    """Silent refresh: new game_token via portal cookie; no play-stats side effects."""
    entry = get_game_auth_entry_by_api_slug(api_slug)
    if entry is None or not entry.has_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="unknown_game"
        )

    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return _refresh_game_session_response(current_user, entry.game_key)


def _validate_signing(game_key: str) -> None:
    try:
        validate_game_signing(game_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=503, detail="game_signing_not_configured"
        ) from exc
