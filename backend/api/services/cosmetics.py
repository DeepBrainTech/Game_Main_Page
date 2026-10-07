"""cosmetics business logic."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from config.home_system import (
    HOME_SYSTEM_ITEMS,
    get_home_system_item,
    is_free_home_system_item,
)
from models import User, UserHomeSystemInventory, UserHomeSystemLoadout
from schemas import APIResponse, HomeSystemLoadoutBody
from services.assets import balances as _balances_dict
from services.assets import debit_assets, lock_account
from services.idempotency import replay_operation, save_operation
from utils.home_system_entitlements import (
    membership_cosmetic_item_ids,
    sanitize_cosmetic_loadout,
)


async def get_home_system(current_user: User, db: Session):
    """Return the cosmetic catalog, ownership, and current loadout."""
    lock_account(db, current_user.id)
    owned_rows = (
        db.query(UserHomeSystemInventory.item_id)
        .filter(UserHomeSystemInventory.user_id == current_user.id)
        .all()
    )
    owned_item_ids = {row[0] for row in owned_rows}
    owned_item_ids.update(
        item_id
        for item_id, item in HOME_SYSTEM_ITEMS.items()
        if is_free_home_system_item(item)
    )
    membership_item_ids = membership_cosmetic_item_ids(current_user)

    loadout_row = (
        db.query(UserHomeSystemLoadout)
        .filter(UserHomeSystemLoadout.user_id == current_user.id)
        .first()
    )
    loadout = {
        "head": loadout_row.head_item_id if loadout_row else None,
        "body": loadout_row.body_item_id if loadout_row else None,
        "hand": loadout_row.hand_item_id if loadout_row else None,
        "background": loadout_row.background_item_id if loadout_row else None,
        "limited": loadout_row.limited_item_id if loadout_row else None,
    }
    valid_loadout = sanitize_cosmetic_loadout(
        loadout, owned_item_ids, membership_item_ids
    )
    if loadout_row and valid_loadout != loadout:
        for slot, item_id in valid_loadout.items():
            setattr(loadout_row, f"{slot}_item_id", item_id)
        db.commit()
    loadout = valid_loadout
    items = [
        {
            "item_id": item_id,
            **item,
            "is_owned": item_id in owned_item_ids,
            "membership_access": item_id in membership_item_ids,
            "membership_eligible": item["tier"] == "limited",
        }
        for item_id, item in HOME_SYSTEM_ITEMS.items()
    ]

    return APIResponse(
        success=True,
        message="ok",
        data={
            "items": items,
            "owned_item_ids": sorted(owned_item_ids),
            "membership_expires_at": (
                current_user.membership_expires_at.isoformat()
                + ("Z" if current_user.membership_expires_at.tzinfo is None else "")
                if membership_item_ids and current_user.membership_expires_at
                else None
            ),
            "loadout": loadout,
        },
    )


def _home_system_loadout_dict(loadout: UserHomeSystemLoadout) -> dict:
    return {
        slot: getattr(loadout, f"{slot}_item_id")
        for slot in ("head", "body", "hand", "background", "limited")
    }


def _sanitize_home_system_loadout(
    db: Session, user: User, loadout: UserHomeSystemLoadout
):
    # Include pending purchases before validating equipped items.
    db.flush()
    owned_ids = {
        row[0]
        for row in db.query(UserHomeSystemInventory.item_id)
        .filter(UserHomeSystemInventory.user_id == user.id)
        .all()
    }
    valid_loadout = sanitize_cosmetic_loadout(
        _home_system_loadout_dict(loadout),
        owned_ids,
        membership_cosmetic_item_ids(user),
    )
    for slot, item_id in valid_loadout.items():
        setattr(loadout, f"{slot}_item_id", item_id)


def _set_home_system_loadout_item(
    db: Session, user_id: int, slot: str, item_id: str | None
):
    loadout = (
        db.query(UserHomeSystemLoadout)
        .filter(UserHomeSystemLoadout.user_id == user_id)
        .first()
    )
    if loadout is None:
        loadout = UserHomeSystemLoadout(user_id=user_id)
        db.add(loadout)
    setattr(loadout, f"{slot}_item_id", item_id)
    if item_id and slot == "limited":
        loadout.head_item_id = None
        loadout.body_item_id = None
        loadout.hand_item_id = None
    elif item_id and slot in {"head", "body", "hand"}:
        loadout.limited_item_id = None
    return loadout


async def redeem_home_system_item(
    item_id: str,
    current_user: User,
    db: Session,
    equip: bool,
    request_id: UUID | None = None,
):
    """Permanently redeem one home-system cosmetic."""
    lock_account(db, current_user.id)
    payload = {"item_id": item_id, "equip": equip}
    replay = replay_operation(
        db, current_user.id, request_id, "cosmetic.redeem", payload
    )
    if replay is not None:
        return APIResponse(success=True, message="ok", data=replay)
    item = get_home_system_item(item_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_home_system_item"
        )
    if is_free_home_system_item(item):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="item_is_free"
        )

    existing = (
        db.query(UserHomeSystemInventory)
        .filter(
            UserHomeSystemInventory.user_id == current_user.id,
            UserHomeSystemInventory.item_id == item_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="already_owned"
        )

    cost = item["cost"]
    rewards = debit_assets(
        db,
        current_user.id,
        cost,
        source="cosmetic:" + item_id,
        request_id=str(request_id) if request_id else None,
    )
    db.add(UserHomeSystemInventory(user_id=current_user.id, item_id=item_id))
    db.add(rewards)
    loadout = (
        _set_home_system_loadout_item(db, current_user.id, item["slot"], item_id)
        if equip
        else None
    )
    if loadout is not None:
        _sanitize_home_system_loadout(db, current_user, loadout)
    data = {
        "item_id": item_id,
        "item_name": item["name"],
        "cost": cost,
        "assets": _balances_dict(rewards),
        "loadout": _home_system_loadout_dict(loadout) if loadout is not None else None,
    }
    save_operation(db, current_user.id, request_id, "cosmetic.redeem", payload, data)
    db.commit()
    return APIResponse(success=True, message="ok", data=data)


async def update_home_system_loadout(
    body: HomeSystemLoadoutBody, current_user: User, db: Session
):
    """Equip or clear one home-system slot."""
    lock_account(db, current_user.id)
    item = get_home_system_item(body.item_id) if body.item_id else None
    if body.item_id and item is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_home_system_item"
        )
    if item and item["slot"] != body.slot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="item_slot_mismatch"
        )

    if item and not is_free_home_system_item(item):
        owned = (
            db.query(UserHomeSystemInventory)
            .filter(
                UserHomeSystemInventory.user_id == current_user.id,
                UserHomeSystemInventory.item_id == body.item_id,
            )
            .first()
        )
        if owned is None and body.item_id not in membership_cosmetic_item_ids(
            current_user
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="item_not_owned"
            )

    loadout = _set_home_system_loadout_item(
        db, current_user.id, body.slot, body.item_id
    )
    _sanitize_home_system_loadout(db, current_user, loadout)
    db.commit()
    db.refresh(loadout)

    return APIResponse(
        success=True,
        message="ok",
        data={"loadout": _home_system_loadout_dict(loadout)},
    )
