"""Atomic portal payment and game-bound grants."""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config.game_auth import (
    create_game_token,
    get_game_auth_entry_by_api_slug,
    validate_game_signing,
)
from config.game_commerce import GameProduct, get_game_product
from models import GamePurchase, UserItemInventory
from services.assets import debit_assets, get_asset_balances, lock_account


def resolve_product(api_slug: str, product_id: str) -> GameProduct:
    entry = get_game_auth_entry_by_api_slug(api_slug)
    product = get_game_product(entry.game_key, product_id) if entry else None
    if product is None:
        raise HTTPException(status_code=404, detail="unknown_game_product")
    return product


def _owned_item(db: Session, user_id: int, product: GameProduct):
    if not product.inventory_item_id:
        return None
    return (
        db.query(UserItemInventory)
        .filter_by(user_id=user_id, item_id=product.inventory_item_id)
        .first()
    )


def quote_purchase(db: Session, user_id: int, product: GameProduct) -> dict:
    inventory = _owned_item(db, user_id, product)
    cost = {} if inventory is not None and inventory.quantity > 0 else product.cost
    return {
        "game_key": product.game_key,
        "product_id": product.product_id,
        "cost": cost,
        "duration_seconds": product.duration_seconds,
        "user_id": user_id,
        "assets": get_asset_balances(db, user_id),
    }


def redeem_purchase(
    db: Session, user_id: int, product: GameProduct, request_id, target: str
) -> dict:
    def conflict(suffix: str):
        return HTTPException(status_code=409, detail="purchase_" + suffix)

    try:
        validate_game_signing(product.game_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail="game_signing_not_configured",
        ) from exc
    try:
        target = product.validate_target(target)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not 0 < len(target) <= 256:
        raise HTTPException(status_code=422, detail="invalid_purchase_target")
    if product.duration_seconds <= 0:
        raise HTTPException(status_code=503, detail="invalid_product_duration")
    lock_account(db, user_id)
    purchase = (
        db.query(GamePurchase)
        .filter_by(user_id=user_id, request_id=str(request_id))
        .first()
    )
    now = datetime.utcnow()
    if purchase is not None:
        if (
            purchase.target != target
            or purchase.game_key != product.game_key
            or purchase.product_id != product.product_id
        ):
            raise conflict("request_mismatch")
        if purchase.expires_at <= now:
            raise conflict("session_expired")
    else:
        inventory = _owned_item(db, user_id, product)
        if inventory is not None and inventory.quantity > 0:
            inventory.quantity -= 1
            if inventory.quantity == 0:
                db.delete(inventory)
            cost = {}
        else:
            debit_assets(
                db,
                user_id,
                product.cost,
                source=product.game_key + ":" + product.product_id,
                request_id=str(request_id),
                insufficient_detail="insufficient_assets",
            )
            cost = dict(product.cost)
        fields = dict(
            user_id=user_id,
            request_id=str(request_id),
            target=target,
            expires_at=now + timedelta(seconds=product.duration_seconds),
        )
        fields.update(
            game_key=product.game_key,
            product_id=product.product_id,
            purpose=product.purpose,
            cost=cost,
        )
        purchase = GamePurchase(**fields)
        db.add(purchase)
    expires_at = int(purchase.expires_at.replace(tzinfo=timezone.utc).timestamp())
    remaining = max(1, expires_at - int(datetime.now(timezone.utc).timestamp()))
    token, _ = create_game_token(
        product.game_key,
        {
            "user_id": user_id,
            "purpose": purchase.purpose,
            "target": purchase.target,
            "purchase_id": purchase.request_id,
            "product_id": product.product_id,
            "game_key": product.game_key,
            "exp": expires_at,
        },
        expires_seconds=remaining,
        expires_at=purchase.expires_at,
    )
    # Signing precedes commit so a signing failure cannot leave a charge behind.
    db.commit()
    return {
        "grant_token": token,
        "expires_at": expires_at,
        "user_id": user_id,
        "game_key": product.game_key,
        "product_id": product.product_id,
        "purchase_id": purchase.request_id,
        "assets": get_asset_balances(db, user_id),
        "cost": purchase.cost,
    }
