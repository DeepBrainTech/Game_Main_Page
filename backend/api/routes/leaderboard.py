"""HTTP endpoints for leaderboard."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from auth import get_current_active_user
from database import get_db
from models import User
from schemas import APIResponse
from services import leaderboard

router = APIRouter(prefix="/api/leaderboard", tags=["排行榜"])


@router.get("", response_model=APIResponse)
async def get_leaderboard(
    type: str = Query(
        "total",
        description="total | memory | logic | focus | reaction | strategy | spatial",
    ),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await leaderboard.get_leaderboard(
        type=type, limit=limit, current_user=current_user, db=db
    )


@router.post("/snapshot", response_model=APIResponse)
async def snapshot_global_ranks(
    secret: str = Query(..., description="Admin secret key to trigger snapshot"),
    db: Session = Depends(get_db),
):
    return await leaderboard.snapshot_global_ranks(secret=secret, db=db)
