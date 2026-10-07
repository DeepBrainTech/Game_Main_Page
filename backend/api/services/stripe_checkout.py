"""Shared one-time Checkout creation and idempotent asset fulfillment."""

import logging

import stripe
from fastapi import HTTPException
from sqlalchemy.orm import Session

from config.stripe_billing import (
    COIN_BUNDLES,
    DIAMOND_BUNDLES,
    get_coin_bundle_price_id,
    get_diamond_bundle_price_id,
    get_public_app_url,
    is_stripe_shop_configured,
)
from models import StripeCheckoutFulfillment, User
from schemas import APIResponse, BillingCoinCheckoutBody, BillingDiamondCheckoutBody
from services.assets import credit_assets, lock_account
from services.stripe_common import (
    _allowed_locale,
    _shop_path,
    _source_event,
    _stripe_configure,
    _stripe_ui_locale,
    get_or_create_stripe_customer,
)
from utils.notifications import create_user_notification

logger = logging.getLogger(__name__)

BUNDLE_TYPES = {
    "diamond_bundle": (
        "diamonds",
        DIAMOND_BUNDLES,
        get_diamond_bundle_price_id,
        "Diamonds",
    ),
    "coin_bundle": ("coins", COIN_BUNDLES, get_coin_bundle_price_id, "Coins"),
}


def fulfill_asset_checkout(db: Session, sess, event_id: str | None = None) -> None:
    session_id = sess.get("id")
    meta = sess.get("metadata") or {}
    entry = BUNDLE_TYPES.get(meta.get("kind"))
    if not session_id or entry is None or sess.get("payment_status") != "paid":
        return
    asset, bundles, _, label = entry
    uid = meta.get("user_id") or sess.get("client_reference_id")
    bundle_id = meta.get("bundle_id")
    amount = bundles.get(bundle_id)
    if not uid or not amount:
        logger.warning("checkout %s missing user or bundle metadata", session_id)
        return
    user = db.query(User).filter(User.id == int(uid)).first()
    if user is None:
        logger.warning("checkout user %s not found", uid)
        return
    lock_account(db, user.id)
    existing = (
        db.query(StripeCheckoutFulfillment)
        .filter_by(stripe_session_id=session_id)
        .first()
    )
    if existing:
        return
    if sess.get("customer") and not user.stripe_customer_id:
        user.stripe_customer_id = str(sess["customer"])
    credit_assets(
        db,
        user.id,
        {asset: amount},
        source="stripe:" + meta["kind"],
        request_id=session_id,
    )
    db.add(
        StripeCheckoutFulfillment(
            stripe_session_id=session_id,
            user_id=user.id,
            kind=meta["kind"],
            amount=amount,
        )
    )
    create_user_notification(
        db,
        user_id=user.id,
        notification_type="purchase",
        title="Purchase Successful",
        message=f"{amount} {label} have been added to your bag.",
        icon="purchase",
        source="stripe",
        source_event_id=_source_event(event_id or session_id, "purchase"),
        metadata={
            "bundle_id": bundle_id,
            asset: amount,
            "stripe_session_id": session_id,
        },
        commit=False,
    )
    db.commit()


async def _create_asset_checkout(body, current_user: User, db: Session, kind: str):
    if not is_stripe_shop_configured():
        raise HTTPException(status_code=503, detail="stripe_not_configured")
    _stripe_configure()
    asset, bundles, get_price_id, _ = BUNDLE_TYPES[kind]
    price_id = get_price_id(body.bundle_id)
    if not price_id:
        raise HTTPException(status_code=503, detail="stripe_price_not_configured")
    locale = _allowed_locale(body.locale)
    base = get_public_app_url()
    customer_id = get_or_create_stripe_customer(db, current_user)
    metadata = {
        "kind": kind,
        "user_id": str(current_user.id),
        "bundle_id": body.bundle_id,
        asset: str(bundles[body.bundle_id]),
    }
    session = stripe.checkout.Session.create(
        mode="payment",
        customer=customer_id,
        client_reference_id=str(current_user.id),
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{base}{_shop_path(locale)}?checkout=success",
        cancel_url=f"{base}{_shop_path(locale)}?checkout=canceled",
        metadata=metadata,
        payment_intent_data={"metadata": metadata},
        locale=_stripe_ui_locale(locale),
    )
    return APIResponse(success=True, message="ok", data={"url": session.url})


async def create_diamond_checkout_session(
    body: BillingDiamondCheckoutBody, current_user: User, db: Session
):
    return await _create_asset_checkout(body, current_user, db, "diamond_bundle")


async def create_coin_checkout_session(
    body: BillingCoinCheckoutBody, current_user: User, db: Session
):
    return await _create_asset_checkout(body, current_user, db, "coin_bundle")
