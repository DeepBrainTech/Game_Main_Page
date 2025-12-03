"""
游戏相关路由：签发 FogChess 短期访问令牌
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import APIResponse
from auth import (
    get_current_active_user,
    create_fogchess_token,
    FOG_CHESS_TOKEN_EXPIRE_SECONDS,
  
    create_sudoku_token,
    SUDOKU_TOKEN_EXPIRE_SECONDS,
  
    create_quantumgo_token,
    QUANTUMGO_TOKEN_EXPIRE_SECONDS,
  
    create_chessmater_token,
    CHESSMATER_TOKEN_EXPIRE_SECONDS,
  
    create_tourmaster_token,
    TOURMASTER_TOKEN_EXPIRE_SECONDS,
)


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


@router.post("/sudoku/token", response_model=APIResponse)
async def issue_sudoku_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """为当前登录用户签发 Sudoku 短期令牌

    返回字段：
    - game_token: 供 Sudoku Battle 使用的短期 JWT（建议仅用于首次换取服务端会话）
    - expires_in: 过期秒数
    - user: 基础身份信息（可选，便于前端展示）
    """
    claims = {
        "sub": current_user.username,
        "user_id": current_user.id,
        "username": current_user.username,
        # 可按需加入：roles、locale、avatar 等
    }

    token = create_sudoku_token(claims)

    return APIResponse(
        success=True,
        message="ok",
        data={
            "game_token": token,
            "expires_in": SUDOKU_TOKEN_EXPIRE_SECONDS,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
            },
        },
    )


@router.post("/quantumgo/token", response_model=APIResponse)
async def issue_quantumgo_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """为当前登录用户签发 QuantumGo 短期令牌

    返回字段：
    - game_token: 供 QuantumGo 使用的短期 JWT（建议仅用于首次换取服务端会话）
    - expires_in: 过期秒数
    - user: 基础身份信息（可选，便于前端展示）
    """
    claims = {
        "sub": current_user.username,
        "user_id": current_user.id,
        "username": current_user.username,
        # 可按需加入：roles、locale、avatar 等
    }

    token = create_quantumgo_token(claims)

    return APIResponse(
        success=True,
        message="ok",
        data={
            "game_token": token,
            "expires_in": QUANTUMGO_TOKEN_EXPIRE_SECONDS,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
            },
        },
    )


@router.post("/chessmater/token", response_model=APIResponse)
async def issue_chessmater_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    为当前登录用户签发 ChessMater 短期令牌

    返回字段:
    - game_token: 供 ChessMater 使用的短期 JWT（建议仅用于首次换取服务端会话）
    - expires_in: 过期秒数
    - user: 基础身份信息（可选，便于前端展示）
    """
    claims = {
        "sub": current_user.username,
        "user_id": current_user.id,
        "username": current_user.username,
        # 可以按需加入: roles, locale, avatar 等
    }

    token = create_chessmater_token(claims)

    return APIResponse(
        success=True,
        message="ok",
        data={
            "game_token": token,
            "expires_in": CHESSMATER_TOKEN_EXPIRE_SECONDS,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
            },
        },
    )


@router.post("/chess-tourmaster/token", response_model=APIResponse)
async def issue_tourmaster_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    为当前登录用户签发 Chess-Tourmaster 短期令牌

    返回字段:
    - game_token: 供 Chess-Tourmaster 使用的短期 JWT（建议仅用于首次授权服务器端会话）
    - expires_in: 过期时间
    - user: 基础的身份信息
    """
    claims = {
        "sub": current_user.username,
        "user_id": current_user.id,
        "username": current_user.username,
    }

    token = create_tourmaster_token(claims)

    return APIResponse(
        success=True,
        message="ok",
        data={
            "game_token": token,
            "expires_in": TOURMASTER_TOKEN_EXPIRE_SECONDS,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
            },
        },
    )
