"""HTTP endpoints for games."""

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.orm import Session

from auth import get_current_active_user
from database import get_db
from models import User
from routes.game_purchases import router as game_purchase_router
from routes.flower_gifts import router as flower_gift_router
from schemas import APIResponse, GamePlayRecordIn
from services import game_activity, game_likes, game_sessions, inventory

router = APIRouter(prefix="/api/games", tags=["Games"])
router.include_router(flower_gift_router)


@router.get("/shop/catalog", response_model=APIResponse)
async def get_shop_catalog_public(
    game_mode: str | None = Query(
        None,
        description="If set, only items usable in this mode (e.g. chessmater, chess-tourmaster).",
    ),
):
    return await inventory.get_shop_catalog_public(game_mode=game_mode)


@router.get("/shop/item", response_model=APIResponse)
async def get_shop_item_price_public(
    item_id: str = Query(..., description="Shop item id, e.g. chess_mater_undo"),
    game_mode: str | None = Query(
        None,
        description="If set, returns 400 when the item is not available for this mode.",
    ),
):
    return await inventory.get_shop_item_price_public(
        item_id=item_id, game_mode=game_mode
    )


@router.post("/play-record", response_model=APIResponse)
async def record_game_played(
    body: GamePlayRecordIn,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await game_activity.record_game_played(
        body=body, current_user=current_user, db=db
    )


@router.get("/likes", response_model=APIResponse)
async def get_game_likes(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await game_likes.get_game_likes(current_user=current_user, db=db)


@router.post("/likes/{game_key}", response_model=APIResponse)
async def like_game(
    game_key: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await game_likes.like_game(
        game_key=game_key, current_user=current_user, db=db
    )


@router.delete("/likes/{game_key}", response_model=APIResponse)
async def unlike_game(
    game_key: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await game_likes.unlike_game(
        game_key=game_key, current_user=current_user, db=db
    )


@router.post("/{api_slug}/token", response_model=APIResponse)
async def issue_game_token(
    api_slug: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    x_user_timezone: str | None = Header(None, alias="X-User-Timezone"),
):
    return await game_sessions.issue_game_token(
        api_slug=api_slug,
        current_user=current_user,
        db=db,
        x_user_timezone=x_user_timezone,
    )


@router.get("/{api_slug}/session", response_model=APIResponse)
async def refresh_game_session(
    api_slug: str,
    response: Response,
    current_user: User = Depends(get_current_active_user),
):
    return await game_sessions.refresh_game_session(
        api_slug=api_slug, response=response, current_user=current_user
    )


@router.post("/sudoku/play", response_model=APIResponse)
async def track_sudoku_play(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await game_activity.track_sudoku_play(current_user=current_user, db=db)


@router.get("/rewards/status", response_model=APIResponse)
async def get_reward_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await game_activity.get_reward_status(current_user=current_user, db=db)




router.include_router(game_purchase_router)
