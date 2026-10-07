"""Shared account balances and transaction-safe asset mutations.

Callers own commit/rollback. Every balance writer locks the same user row.
"""

from fastapi import HTTPException
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from models import AssetTransaction, User, UserRewards

ASSET_KEYS = ("coins", "diamonds", "flowers")


def lock_account(db: Session, user_id: int) -> None:
    db.query(User.id).filter(User.id == user_id).with_for_update().one()


def balances(rewards: UserRewards | None) -> dict:
    return {key: int(getattr(rewards, key, 0) or 0) for key in ASSET_KEYS}


def get_or_create_rewards(db: Session, user_id: int) -> UserRewards:
    rewards = db.query(UserRewards).filter(UserRewards.user_id == user_id).first()
    if rewards is None:
        lock_account(db, user_id)
        rewards = db.query(UserRewards).filter(UserRewards.user_id == user_id).first()
        if rewards is None:
            rewards = UserRewards(user_id=user_id, coins=0, diamonds=0, flowers=0)
            db.add(rewards)
            db.flush()
    return rewards


def get_asset_balances(db: Session, user_id: int) -> dict:
    return balances(
        db.query(UserRewards).filter(UserRewards.user_id == user_id).first()
    )


def _validate_amounts(amounts: dict) -> dict:
    if set(amounts) - set(ASSET_KEYS):
        raise ValueError("unknown_asset")
    if any(type(value) is not int or value < 0 for value in amounts.values()):
        raise ValueError("invalid_asset_amount")
    return {key: amounts.get(key, 0) for key in ASSET_KEYS}


def _mutate(
    db: Session,
    user_id: int,
    amounts: dict,
    *,
    debit: bool,
    source: str,
    request_id: str | None = None,
    insufficient_detail: str = "insufficient_assets",
) -> UserRewards:
    amounts = _validate_amounts(amounts)
    lock_account(db, user_id)
    rewards = get_or_create_rewards(db, user_id)
    db.flush()
    statement = update(UserRewards).where(UserRewards.user_id == user_id)
    if debit:
        for key, amount in amounts.items():
            if amount:
                statement = statement.where(
                    func.coalesce(getattr(UserRewards, key), 0) >= amount
                )
    deltas = {key: (-amount if debit else amount) for key, amount in amounts.items()}
    statement = statement.values(
        **{
            key: func.coalesce(getattr(UserRewards, key), 0) + delta
            for key, delta in deltas.items()
            if delta
        }
    )
    if any(deltas.values()):
        result = db.execute(statement.execution_options(synchronize_session=False))
        if result.rowcount != 1:
            raise HTTPException(status_code=400, detail=insufficient_detail)
        db.refresh(rewards)
        db.add(
            AssetTransaction(
                user_id=user_id,
                source=source,
                request_id=request_id,
                changes=deltas,
                balances=balances(rewards),
            )
        )
        db.flush()
    return rewards


def debit_assets(
    db: Session,
    user_id: int,
    amounts: dict,
    *,
    source: str,
    request_id: str | None = None,
    insufficient_detail: str = "insufficient_assets",
) -> UserRewards:
    return _mutate(
        db,
        user_id,
        amounts,
        debit=True,
        source=source,
        request_id=request_id,
        insufficient_detail=insufficient_detail,
    )


def credit_assets(
    db: Session,
    user_id: int,
    amounts: dict,
    *,
    source: str,
    request_id: str | None = None,
) -> UserRewards:
    return _mutate(
        db, user_id, amounts, debit=False, source=source, request_id=request_id
    )


async def get_assets(current_user: User, db: Session):
    from schemas import APIResponse

    return APIResponse(
        success=True, message="ok", data=get_asset_balances(db, current_user.id)
    )
