"""Per-game JWT issuance config and helpers for embedded game clients."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from jose import jwt


@dataclass(frozen=True)
class GameAuthEntry:
    """Registry entry for portal-issued game JWTs."""

    game_key: str
    api_slug: str
    env_prefix: str
    default_aud: str
    track_daily_play: bool = False
    has_session: bool = False


GAME_AUTH_ENTRIES: tuple[GameAuthEntry, ...] = (
    GameAuthEntry("fogchess", "fogchess", "FOG_CHESS", "fogchess"),
    GameAuthEntry("online-chess", "online-chess", "ONLINE_CHESS", "online-chess"),
    GameAuthEntry("sudoku", "sudoku", "SUDOKU", "sudoku-battle"),
    GameAuthEntry(
        "quantumgo",
        "quantumgo",
        "QUANTUMGO",
        "quantum-go",
        has_session=True,
    ),
    GameAuthEntry(
        "chessmater",
        "chessmater",
        "CHESSMATER",
        "chessmater",
        track_daily_play=True,
        has_session=True,
    ),
    GameAuthEntry(
        "chess-tourmaster",
        "chess-tourmaster",
        "TOURMASTER",
        "chess-tourmaster",
        track_daily_play=True,
        has_session=True,
    ),
    GameAuthEntry(
        "number-blast",
        "number-blast",
        "NUMBER_BLAST",
        "number-blast",
        has_session=True,
    ),
)

_BY_API_SLUG = {entry.api_slug: entry for entry in GAME_AUTH_ENTRIES}
_BY_GAME_KEY = {entry.game_key: entry for entry in GAME_AUTH_ENTRIES}


def get_game_auth_entry_by_api_slug(api_slug: str) -> GameAuthEntry | None:
    return _BY_API_SLUG.get(api_slug)


def get_game_auth_entry_by_game_key(game_key: str) -> GameAuthEntry | None:
    return _BY_GAME_KEY.get(game_key)


def _default_secret(entry: GameAuthEntry) -> str:
    if entry.env_prefix == "CHESSMATER":
        return "CHESSMATER"
    return f"change-this-{entry.default_aud}-secret"


def _jwt_settings(entry: GameAuthEntry) -> tuple[str, str, str, str, int]:
    prefix = entry.env_prefix
    secret = os.getenv(f"{prefix}_JWT_SECRET", "").strip()
    alg = os.getenv(f"{prefix}_JWT_ALG", "HS256")
    aud = os.getenv(f"{prefix}_JWT_AUD", entry.default_aud)
    iss = os.getenv(f"{prefix}_JWT_ISS", "main-portal")
    expire = int(os.getenv(f"{prefix}_TOKEN_EXPIRE_SECONDS", "300"))
    if not secret or secret in {
        _default_secret(entry),
        f"change-this-{entry.game_key}-secret",
    }:
        raise ValueError("game_signing_not_configured")
    if expire <= 0:
        raise ValueError("invalid_game_token_expiry")
    return secret, alg, aud, iss, expire


def validate_game_signing(game_key: str) -> None:
    entry = get_game_auth_entry_by_game_key(game_key)
    if entry is None:
        raise ValueError("unknown_game")
    _jwt_settings(entry)


def create_game_token(
    game_key: str,
    claims: Dict[str, Any],
    expires_seconds: Optional[int] = None,
    expires_at: Optional[datetime] = None,
) -> Tuple[str, int]:
    """Create a short-lived JWT for an embedded game client."""
    entry = get_game_auth_entry_by_game_key(game_key)
    if entry is None:
        raise ValueError(f"unknown game_key: {game_key}")

    secret, alg, aud, iss, default_expire = _jwt_settings(entry)
    expire_sec = expires_seconds if expires_seconds is not None else default_expire
    expire = expires_at or (datetime.utcnow() + timedelta(seconds=expire_sec))

    to_encode = claims.copy()
    to_encode.update({"exp": expire, "iss": iss, "aud": aud})
    token = jwt.encode(to_encode, secret, algorithm=alg)
    return token, expire_sec
