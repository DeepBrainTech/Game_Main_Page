"""Portal flower balances, transfers and retry recovery for QuantumGo."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_active_user
from database import get_db
from models import User
from schemas import APIResponse
from services.assets import get_asset_balances
from services.flower_gifts import transfer_flowers, transfer_status

router = APIRouter(prefix="/quantumgo/flowers", tags=["Flower Gifts"])


class FlowerTransferIn(BaseModel):
    intent_token: str = Field(min_length=1, max_length=8192)


@router.get("/balance", response_model=APIResponse)
async def balance(response: Response, current_user: User = Depends(get_current_active_user),
                  db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return APIResponse(success=True, message="ok",
                       data={"user_id": current_user.id, "assets": get_asset_balances(db, current_user.id)})


@router.post("/transfers", response_model=APIResponse)
async def transfer(body: FlowerTransferIn, response: Response,
                   current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return APIResponse(success=True, message="ok",
                       data=transfer_flowers(db, current_user.id, body.intent_token))


@router.get("/transfers/{request_id}", response_model=APIResponse)
async def status(request_id: UUID, response: Response,
                 current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return APIResponse(success=True, message="ok",
                       data=transfer_status(db, current_user.id, request_id))
