"""Shared purchase endpoints for registered game products."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from auth import get_current_active_user
from database import get_db
from models import User
from schemas import APIResponse, GamePurchaseRedeemIn
from services.game_purchases import quote_purchase, redeem_purchase, resolve_product

router = APIRouter(tags=["Game Purchases"])


@router.get("/{api_slug}/purchases/{product_id}/quote", response_model=APIResponse)
async def quote_game_purchase(
    api_slug: str,
    product_id: str,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    return APIResponse(
        success=True,
        message="ok",
        data=quote_purchase(db, current_user.id, resolve_product(api_slug, product_id)),
    )


@router.post("/{api_slug}/purchases/{product_id}/redeem", response_model=APIResponse)
async def redeem_game_purchase(
    api_slug: str,
    product_id: str,
    body: GamePurchaseRedeemIn,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    return APIResponse(
        success=True,
        message="ok",
        data=redeem_purchase(
            db,
            current_user.id,
            resolve_product(api_slug, product_id),
            body.request_id,
            body.target,
        ),
    )
