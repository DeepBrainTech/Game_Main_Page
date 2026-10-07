"""HTTP endpoints for billing."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from auth import get_current_active_user
from database import get_db
from models import User
from schemas import (
    APIResponse,
    BillingChangeSubscriptionBody,
    BillingCheckoutBody,
    BillingCoinCheckoutBody,
    BillingDiamondCheckoutBody,
    BillingPortalBody,
    BillingUpdatePaymentMethodBody,
)
from services import stripe_checkout, stripe_events, subscriptions

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/status", response_model=APIResponse)
async def billing_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await subscriptions.billing_status(current_user=current_user, db=db)


@router.post("/cancel-scheduled-change", response_model=APIResponse)
async def cancel_scheduled_change(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await subscriptions.cancel_scheduled_change(current_user=current_user, db=db)


@router.post("/checkout-session", response_model=APIResponse)
async def create_checkout_session(
    body: BillingCheckoutBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await subscriptions.create_checkout_session(
        body=body, current_user=current_user, db=db
    )


@router.post("/diamond-checkout-session", response_model=APIResponse)
async def create_diamond_checkout_session(
    body: BillingDiamondCheckoutBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await stripe_checkout.create_diamond_checkout_session(
        body=body, current_user=current_user, db=db
    )


@router.post("/coin-checkout-session", response_model=APIResponse)
async def create_coin_checkout_session(
    body: BillingCoinCheckoutBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await stripe_checkout.create_coin_checkout_session(
        body=body, current_user=current_user, db=db
    )


@router.post("/change-preview", response_model=APIResponse)
async def preview_subscription_change(
    body: BillingChangeSubscriptionBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await subscriptions.preview_subscription_change(
        body=body, current_user=current_user, db=db
    )


@router.post("/change-subscription", response_model=APIResponse)
async def change_subscription(
    body: BillingChangeSubscriptionBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await subscriptions.change_subscription(
        body=body, current_user=current_user, db=db
    )


@router.post("/payment-method-setup", response_model=APIResponse)
async def create_payment_method_setup(
    current_user: User = Depends(get_current_active_user),
):
    return await subscriptions.create_payment_method_setup(current_user=current_user)


@router.post("/payment-method", response_model=APIResponse)
async def update_subscription_payment_method(
    body: BillingUpdatePaymentMethodBody,
    current_user: User = Depends(get_current_active_user),
):
    return await subscriptions.update_subscription_payment_method(
        body=body, current_user=current_user
    )


@router.post("/portal-session", response_model=APIResponse)
async def create_portal_session(
    body: BillingPortalBody,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await subscriptions.create_portal_session(
        body=body, current_user=current_user, db=db
    )


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    return await stripe_events.stripe_webhook(request=request, db=db)
