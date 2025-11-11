"""
游戏相关路由：签发 FogChess 短期访问令牌
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import APIResponse
from auth import get_current_active_user, create_fogchess_token, FOG_CHESS_TOKEN_EXPIRE_SECONDS


router = APIRouter(prefix="/api/games", tags=["游戏"])


@router.post("/fogchess/token", response_model=APIResponse)
async def issue_fogchess_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """为当前登录用户签发 FogChess 短期令牌

    返回字段：
    - game_token: 供 FogChess 使用的短期 JWT（建议仅用于首次换取服务端会话）
    - expires_in: 过期秒数
    - user: 基础身份信息（可选，便于前端展示）
    """
    claims = {
        "sub": current_user.username,
        "user_id": current_user.id,
        "username": current_user.username,
        # 可按需加入：roles、locale、avatar 等
    }

    token = create_fogchess_token(claims)

    return APIResponse(
        success=True,
        message="ok",
        data={
            "game_token": token,
            "expires_in": FOG_CHESS_TOKEN_EXPIRE_SECONDS,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
            },
        },
    )


