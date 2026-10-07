"""stripe events business logic."""

import logging

import stripe
from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from config.stripe_billing import get_stripe_webhook_secret
from models import User
from schemas import APIResponse
from services.stripe_checkout import fulfill_asset_checkout
from services.stripe_common import (
    _plan_label,
    _source_event,
    _stripe_configure,
    _stripe_obj_get,
)
from services.subscriptions import (
    _clear_paid_membership,
    _clear_pending_membership,
    _mark_membership_trial_consumed,
    _resolve_plan_from_subscription,
    _resolve_user_for_invoice,
    _resolve_user_for_subscription,
    _sync_pending_from_subscription_schedule,
    _user_by_stripe_customer,
    _user_by_subscription_id,
    sync_user_from_stripe_subscription,
)
from utils.notifications import create_user_notification

logger = logging.getLogger(__name__)


async def stripe_webhook(request: Request, db: Session):
    wh_secret = get_stripe_webhook_secret()
    if not wh_secret:
        raise HTTPException(status_code=503, detail="stripe_webhook_not_configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature") or ""
    try:
        event = stripe.Webhook.construct_event(
            payload=payload, sig_header=sig_header, secret=wh_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid_payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="invalid_signature")

    _stripe_configure()
    event_id = event.get("id")
    etype = event["type"]
    obj = event["data"]["object"]
    previous_attributes = event["data"].get("previous_attributes") or {}

    try:
        if etype in {
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
        }:
            sess = obj
            if sess.get("mode") == "payment":
                fulfill_asset_checkout(db, sess, event_id)
                return APIResponse(success=True, message="ok", data={"received": True})
            if sess.get("mode") != "subscription":
                return APIResponse(success=True, message="ok", data={"received": True})
            uid = (sess.get("metadata") or {}).get("user_id") or sess.get(
                "client_reference_id"
            )
            if not uid:
                logger.warning("checkout.session.completed missing user reference")
                return APIResponse(success=True, message="ok", data={"received": True})
            user = db.query(User).filter(User.id == int(uid)).first()
            if not user:
                logger.warning("checkout session user %s not found", uid)
                return APIResponse(success=True, message="ok", data={"received": True})
            cust = sess.get("customer")
            if cust:
                user.stripe_customer_id = cust
            sub_id = sess.get("subscription")
            if sub_id:
                user.stripe_subscription_id = sub_id
                db.add(user)
                db.commit()
                full_sub = stripe.Subscription.retrieve(sub_id)
                sync_user_from_stripe_subscription(db, user, full_sub)
                plan = (sess.get("metadata") or {}).get("plan") or getattr(
                    user, "membership_plan", None
                )
                interval = (sess.get("metadata") or {}).get("billing_interval")
                is_trial = full_sub.status == "trialing"
                create_user_notification(
                    db,
                    user_id=user.id,
                    notification_type="subscription",
                    title="Free Trial Started"
                    if is_trial
                    else "Subscription Activated",
                    message=(
                        f"Your {_plan_label(plan)} free trial has started."
                        if is_trial
                        else f"Your {_plan_label(plan)} membership is now active."
                    ),
                    icon="subscription",
                    source="stripe",
                    source_event_id=_source_event(event_id, "subscription-activated"),
                    metadata={
                        "plan": plan,
                        "billing_interval": interval,
                        "stripe_subscription_id": sub_id,
                    },
                )

        elif etype == "customer.subscription.deleted":
            sub_id = obj.get("id")
            cust_id = obj.get("customer")
            user = _user_by_subscription_id(db, sub_id) if sub_id else None
            if not user and cust_id:
                user = _user_by_stripe_customer(db, str(cust_id))
            if not user:
                meta = obj.get("metadata") or {}
                uid = meta.get("user_id")
                if uid:
                    user = db.query(User).filter(User.id == int(uid)).first()
            if user:
                _mark_membership_trial_consumed(user)
                _clear_paid_membership(user)
                db.add(user)
                db.commit()
                create_user_notification(
                    db,
                    user_id=user.id,
                    notification_type="subscription",
                    title="Subscription Canceled",
                    message="Your subscription has been canceled.",
                    icon="subscription",
                    source="stripe",
                    source_event_id=_source_event(event_id, "subscription-canceled"),
                    metadata={"stripe_subscription_id": sub_id},
                )

        elif etype in (
            "customer.subscription.created",
            "customer.subscription.updated",
        ):
            sub_id = obj.get("id")
            if not sub_id:
                return APIResponse(success=True, message="ok", data={"received": True})
            full_sub = stripe.Subscription.retrieve(sub_id)
            user = _resolve_user_for_subscription(db, full_sub)
            if not user:
                logger.warning("subscription %s: user not resolved", sub_id)
                return APIResponse(success=True, message="ok", data={"received": True})
            if full_sub.status == "canceled":
                _mark_membership_trial_consumed(user)
                _clear_paid_membership(user)
                db.add(user)
                db.commit()
            else:
                sync_user_from_stripe_subscription(db, user, full_sub)
                _sync_pending_from_subscription_schedule(db, user, full_sub)
                if etype == "customer.subscription.updated" and (
                    "items" in previous_attributes
                    or "plan" in previous_attributes
                    or "cancel_at_period_end" in previous_attributes
                ):
                    resolved = _resolve_plan_from_subscription(full_sub)
                    plan = (
                        resolved[0]
                        if resolved
                        else getattr(user, "membership_plan", None)
                    )
                    create_user_notification(
                        db,
                        user_id=user.id,
                        notification_type="subscription",
                        title="Subscription Updated",
                        message=f"Your {_plan_label(plan)} membership has been updated.",
                        icon="subscription",
                        source="stripe",
                        source_event_id=_source_event(event_id, "subscription-updated"),
                        metadata={
                            "plan": plan,
                            "stripe_subscription_id": sub_id,
                            "previous_attributes": list(previous_attributes.keys()),
                        },
                    )

        elif etype == "invoice.paid":
            user = _resolve_user_for_invoice(db, obj)
            if not user:
                logger.warning("invoice.paid: user not resolved")
                return APIResponse(success=True, message="ok", data={"received": True})
            billing_reason = _stripe_obj_get(obj, "billing_reason")
            if billing_reason == "subscription_create":
                return APIResponse(success=True, message="ok", data={"received": True})
            plan = getattr(user, "membership_plan", None)
            create_user_notification(
                db,
                user_id=user.id,
                notification_type="subscription",
                title="Subscription Renewed",
                message=f"Your {_plan_label(plan)} membership is renewed.",
                icon="subscription",
                source="stripe",
                source_event_id=_source_event(event_id, "subscription-renewed"),
                metadata={
                    "plan": plan,
                    "stripe_invoice_id": _stripe_obj_get(obj, "id"),
                    "billing_reason": billing_reason,
                },
            )

        elif etype.startswith("subscription_schedule."):
            schedule_id = obj.get("id")
            sub_id = obj.get("subscription")
            full_sub = stripe.Subscription.retrieve(sub_id) if sub_id else None
            user = _resolve_user_for_subscription(db, full_sub) if full_sub else None
            if not user and schedule_id:
                user = (
                    db.query(User)
                    .filter(User.stripe_subscription_schedule_id == schedule_id)
                    .first()
                )
            if not user:
                logger.warning(
                    "subscription schedule %s: user not resolved", schedule_id
                )
                return APIResponse(success=True, message="ok", data={"received": True})

            status = obj.get("status")
            if full_sub:
                sync_user_from_stripe_subscription(db, user, full_sub)
            if status in ("released", "canceled", "completed"):
                _clear_pending_membership(user)
                db.add(user)
                db.commit()
            elif full_sub:
                _sync_pending_from_subscription_schedule(db, user, full_sub)

    except Exception as e:
        logger.exception("stripe webhook error: %s", e)
        raise HTTPException(status_code=500, detail="webhook_handler_failed")

    return APIResponse(success=True, message="ok", data={"received": True})
