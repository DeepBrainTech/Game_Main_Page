"""Atomic, replayable flower transfers authorized by the game backend."""

from uuid import UUID

from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from config.game_auth import _jwt_settings, create_game_token, get_game_auth_entry_by_game_key
from models import CommerceOperation, User
from services.assets import credit_assets, debit_assets, get_asset_balances, lock_account
from services.idempotency import replay_operation, save_operation

OPERATION = "quantumgo:flower-gift"


def player_balances(db: Session, user_id: int, token: str) -> dict:
    entry = get_game_auth_entry_by_game_key("quantumgo")
    try:
        secret, algorithm, audience, issuer, _ = _jwt_settings(entry)
    except ValueError as exc:
        raise HTTPException(503, "game_signing_not_configured") from exc
    try:
        claims = jwt.decode(token, secret, algorithms=[algorithm], audience=audience,
                            issuer=issuer + ":flower-balances",
                            options={"require_exp": True, "require_aud": True, "require_iss": True})
        if (claims.get("purpose") != "flower-balances" or claims.get("game_key") != "quantumgo"
                or type(claims.get("user_id")) is not int or claims["user_id"] != user_id):
            raise ValueError("invalid_scope")
        players = claims["players"]
        if not isinstance(players, list) or not 1 <= len(players) <= 2:
            raise ValueError("invalid_players")
        result = []
        for player in players:
            game_id = player["user_id"]
            if str(UUID(game_id)) != game_id or UUID(game_id).int == 0:
                raise ValueError("invalid_game_id")
            portal_id = player.get("portal_user_id")
            if portal_id is not None and (type(portal_id) is not int or portal_id <= 0):
                raise ValueError("invalid_account")
            active = portal_id is not None and db.query(User.id).filter(
                User.id == portal_id, User.is_active.is_(True)).first() is not None
            result.append({"user_id": game_id,
                           "flowers": get_asset_balances(db, portal_id)["flowers"] if active else None})
        return {"user_id": user_id, "players": result}
    except (JWTError, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise HTTPException(422, "invalid_flower_balance_scope") from exc


def verify_intent(token: str, user_id: int) -> dict:
    entry = get_game_auth_entry_by_game_key("quantumgo")
    try:
        secret, algorithm, audience, issuer, _ = _jwt_settings(entry)
    except ValueError as exc:
        raise HTTPException(503, "game_signing_not_configured") from exc
    try:
        claims = jwt.decode(token, secret, algorithms=[algorithm], audience=audience,
                            issuer=issuer + ":flower-intent",
                            options={"require_exp": True, "require_aud": True, "require_iss": True})
        if claims.get("purpose") != "flower-intent" or claims.get("game_key") != "quantumgo":
            raise ValueError("invalid_scope")
        if type(claims.get("user_id")) is not int or claims["user_id"] != user_id:
            raise ValueError("invalid_user")
        recipient = claims["recipient_id"]
        if type(recipient) is not int or recipient <= 0 or recipient == user_id:
            raise ValueError("invalid_recipient")
        if type(claims["amount"]) is not int or claims["amount"] not in (1, 5, 10):
            raise ValueError("invalid_amount")
        if type(claims["heat_eligible"]) is not bool:
            raise ValueError("invalid_heat")
        for key in ("request_id", "room_id", "sender_game_id", "recipient_game_id"):
            if str(UUID(claims[key])) != claims[key] or UUID(claims[key]).int == 0:
                raise ValueError("invalid_id")
        return claims
    except (JWTError, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(422, "invalid_flower_intent") from exc


def _response(db: Session, user_id: int, result: dict) -> dict:
    token, _ = create_game_token("quantumgo", {**result, "purpose": "flower-receipt"},
                                 expires_seconds=30 * 24 * 3600)
    return {**result, "receipt_token": token, "assets": get_asset_balances(db, user_id)}


def transfer_flowers(db: Session, user_id: int, token: str) -> dict:
    claims = verify_intent(token, user_id)
    recipient = claims["recipient_id"]
    payload = {key: claims[key] for key in
               ("room_id", "recipient_id", "amount", "sender_game_id", "recipient_game_id")}
    try:
        if db.query(User.id).filter(User.id == recipient, User.is_active.is_(True)).first() is None:
            raise HTTPException(404, "flower_recipient_unavailable")
        # Lock in a stable order so opposite-direction transfers cannot deadlock.
        for account in sorted((user_id, recipient)):
            lock_account(db, account)
        replay = replay_operation(db, user_id, claims["request_id"], OPERATION, payload)
        if replay is not None:
            response = _response(db, user_id, replay)
            db.commit()
            return response
        source = OPERATION + ":" + claims["room_id"]
        debit_assets(db, user_id, {"flowers": claims["amount"]}, source=source,
                     request_id=claims["request_id"])
        credit_assets(db, recipient, {"flowers": claims["amount"]}, source=source,
                      request_id=claims["request_id"])
        result = {**payload, "user_id": user_id, "request_id": claims["request_id"],
                  "game_key": "quantumgo", "heat_eligible": claims["heat_eligible"]}
        save_operation(db, user_id, claims["request_id"], OPERATION, payload, result)
        response = _response(db, user_id, result)
        db.commit()
        return response
    except Exception:
        db.rollback()
        raise


def transfer_status(db: Session, user_id: int, request_id: UUID) -> dict:
    row = db.query(CommerceOperation).filter_by(user_id=user_id,
                                               request_id=str(request_id), operation=OPERATION).first()
    if row is None:
        raise HTTPException(404, "flower_transfer_not_found")
    return _response(db, user_id, row.result)
