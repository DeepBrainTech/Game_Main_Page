"""HTTP endpoints for monkey chat."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from auth import get_current_active_user
from models import User
from schemas import APIResponse, MonkeyChatRequest
from services import monkey_chat

router = APIRouter(prefix="/api/monkey-chat", tags=["Monkey Chat"])


@router.post("", response_model=APIResponse)
async def chat_with_wukoo(
    body: MonkeyChatRequest,
    current_user: User = Depends(get_current_active_user),
):
    return await monkey_chat.chat_with_wukoo(body=body, current_user=current_user)
