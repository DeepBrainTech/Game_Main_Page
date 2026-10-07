"""Shared portal session policy for registration, login, and profile updates."""

from datetime import timedelta

from fastapi import Response

from auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REMEMBER_ME_EXPIRE_MINUTES,
    create_access_token,
    set_access_token_cookie,
)
from models import User


def issue_portal_session(
    response: Response, user: User, remember_me: bool | None = None
) -> None:
    minutes = (
        REMEMBER_ME_EXPIRE_MINUTES
        if remember_me is True
        else ACCESS_TOKEN_EXPIRE_MINUTES
    )
    token = create_access_token(
        data={"sub": user.username}, expires_delta=timedelta(minutes=minutes)
    )
    set_access_token_cookie(
        response,
        token,
        max_age_seconds=minutes * 60 if remember_me is True else None,
        persistent=remember_me is not False,
    )
