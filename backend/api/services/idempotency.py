"""Inventory request replay; call only after acquiring the account lock."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import CommerceOperation


def replay_operation(
    db: Session, user_id: int, request_id, operation: str, payload: dict
) -> dict | None:
    if request_id is None:
        return None
    row = (
        db.query(CommerceOperation)
        .filter_by(user_id=user_id, request_id=str(request_id))
        .first()
    )
    if row is None:
        return None
    if row.operation != operation or row.payload != payload:
        raise HTTPException(status_code=409, detail="purchase_request_mismatch")
    return row.result


def save_operation(
    db: Session, user_id: int, request_id, operation: str, payload: dict, result: dict
) -> None:
    if request_id is not None:
        db.add(
            CommerceOperation(
                user_id=user_id,
                request_id=str(request_id),
                operation=operation,
                payload=payload,
                result=result,
            )
        )
        db.flush()
