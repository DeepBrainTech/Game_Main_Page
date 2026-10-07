"""inventory business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from config.shop_items import (
    SHOP_ITEMS,
    get_shop_items_by_game,
    is_item_available_for_game,
)
from models import User, UserItemInventory
from schemas import APIResponse
from services.assets import balances, debit_assets, lock_account
from services.idempotency import replay_operation, save_operation


async def get_shop_catalog_public(game_mode: str | None):
    """
    Read-only shop prices for embedded game clients. Same source as GET /api/user/shop/items;
    no auth. Redeem/consume endpoints still enforce cost server-side.
    """
    items = get_shop_items_by_game(game_mode)
    return APIResponse(
        success=True,
        message="ok",
        data={"items": items, "game_mode": game_mode},
    )


async def get_shop_item_price_public(item_id: str, game_mode: str | None):
    """Single-item price lookup for games that only need one SKU."""
    item = SHOP_ITEMS.get(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_item_id"
        )
    if game_mode and not is_item_available_for_game(item, game_mode):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="item_not_available_for_game",
        )
    return APIResponse(
        success=True,
        message="ok",
        data={
            "item_id": item_id,
            "name": item["name"],
            "games": item.get("games", []),
            "cost": item["cost"],
        },
    )


async def get_shop_items(game_mode: str | None, current_user: User):
    """Get shop items."""
    _ = current_user
    return APIResponse(
        success=True,
        message="ok",
        data={"items": get_shop_items_by_game(game_mode), "game_mode": game_mode},
    )


async def get_inventory(current_user: User, db: Session):
    """Get inventory."""
    rows = (
        db.query(UserItemInventory)
        .filter(UserItemInventory.user_id == current_user.id)
        .order_by(UserItemInventory.item_id.asc())
        .all()
    )
    return APIResponse(
        success=True,
        message="ok",
        data={"items": [{"item_id": r.item_id, "quantity": r.quantity} for r in rows]},
    )


async def redeem_item(
    item_id: str,
    game_mode: str | None,
    current_user: User,
    db: Session,
    request_id: UUID | None = None,
):
    """Spend portal assets and add inventory once when a request UUID is supplied."""
    lock_account(db, current_user.id)
    payload = {"item_id": item_id, "game_mode": game_mode}
    replay = replay_operation(db, current_user.id, request_id, "shop.redeem", payload)
    if replay is not None:
        return APIResponse(success=True, message="ok", data=replay)
    item = _require_item(item_id, game_mode)
    rewards = debit_assets(
        db,
        current_user.id,
        item["cost"],
        source="shop:" + item_id,
        request_id=str(request_id) if request_id else None,
    )
    inventory = (
        db.query(UserItemInventory)
        .filter_by(user_id=current_user.id, item_id=item_id)
        .first()
    )
    if inventory is None:
        inventory = UserItemInventory(
            user_id=current_user.id, item_id=item_id, quantity=1
        )
        db.add(inventory)
    else:
        inventory.quantity += 1
    data = {
        "item_id": item_id,
        "item_name": item["name"],
        "games": item.get("games", []),
        "game_mode": game_mode,
        "cost": item["cost"],
        "inventory_quantity": inventory.quantity,
        "assets": balances(rewards),
    }
    save_operation(db, current_user.id, request_id, "shop.redeem", payload, data)
    db.commit()
    return APIResponse(success=True, message="ok", data=data)


def _require_item(item_id: str, game_mode: str | None) -> dict:
    item = SHOP_ITEMS.get(item_id)
    if item is None:
        raise HTTPException(status_code=400, detail="invalid_item_id")
    if not is_item_available_for_game(item, game_mode):
        raise HTTPException(status_code=400, detail="item_not_available_for_game")
    return item


async def consume_item(
    item_id: str,
    count: int,
    game_mode: str | None,
    current_user: User,
    db: Session,
    request_id: UUID | None = None,
):
    """Consume inventory once when a request UUID is supplied."""
    lock_account(db, current_user.id)
    payload = {"item_id": item_id, "game_mode": game_mode, "count": count}
    replay = replay_operation(db, current_user.id, request_id, "shop.consume", payload)
    if replay is not None:
        return APIResponse(success=True, message="ok", data=replay)
    _require_item(item_id, game_mode)
    inventory = (
        db.query(UserItemInventory)
        .filter_by(user_id=current_user.id, item_id=item_id)
        .first()
    )
    if inventory is None or inventory.quantity < count:
        raise HTTPException(status_code=400, detail="insufficient_inventory")
    inventory.quantity -= count
    remaining = inventory.quantity
    if remaining == 0:
        db.delete(inventory)
    data = {
        "item_id": item_id,
        "consumed_count": count,
        "inventory_quantity": remaining,
        "game_mode": game_mode,
    }
    save_operation(db, current_user.id, request_id, "shop.consume", payload, data)
    db.commit()
    return APIResponse(success=True, message="ok", data=data)
