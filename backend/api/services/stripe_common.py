"""stripe common business logic."""

import stripe
from fastapi import HTTPException
from sqlalchemy.orm import Session

from config.stripe_billing import get_stripe_secret_key
from models import User
from services.assets import lock_account


def _stripe_configure() -> None:
    key = get_stripe_secret_key()
    if not key:
        raise HTTPException(status_code=503, detail="stripe_not_configured")
    stripe.api_key = key


def _allowed_locale(locale: str) -> str:
    lo = (locale or "en").split("-")[0].lower()
    if lo in ("en", "zh"):
        return lo
    return "en"


def _stripe_ui_locale(site_locale: str) -> str:
    if site_locale == "zh":
        return "zh"
    return "en"


def _membership_path(locale: str) -> str:
    return f"/{locale}/membership"


def _shop_path(locale: str) -> str:
    return f"/{locale}/shop"


def _stripe_obj_get(obj, key: str, default=None):
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _format_amount(amount: int, currency: str | None) -> str:
    code = (currency or "usd").upper()
    zero_decimal = {
        "BIF",
        "CLP",
        "DJF",
        "GNF",
        "JPY",
        "KMF",
        "KRW",
        "MGA",
        "PYG",
        "RWF",
        "UGX",
        "VND",
        "VUV",
        "XAF",
        "XOF",
        "XPF",
    }
    value = amount if code in zero_decimal else amount / 100
    return f"{code} {value:,.0f}" if code in zero_decimal else f"{code} {value:,.2f}"


def _plan_label(plan: str | None) -> str:
    if plan == "premium":
        return "Premium"
    if plan == "plus":
        return "Plus"
    return "Membership"


def _source_event(event_id: str | None, suffix: str) -> str | None:
    return f"{event_id}:{suffix}" if event_id else None


def get_or_create_stripe_customer(db: Session, user: User) -> str:
    lock_account(db, user.id)
    # The row may have changed while this request waited for the account lock.
    db.refresh(user)
    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            metadata={"user_id": str(user.id)},
            idempotency_key=f"portal-customer-{user.id}",
        )
        user.stripe_customer_id = customer.id
        db.commit()
    return user.stripe_customer_id
