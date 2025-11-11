"""
认证相关工具函数
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import os
from dotenv import load_dotenv

from database import get_db
from models import User

load_dotenv()

# JWT 配置
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7天

# FogChess 专用令牌配置（建议使用不同密钥，或改用 RS256 公私钥对）
FOG_CHESS_SECRET = os.getenv("FOG_CHESS_JWT_SECRET", "change-this-fogchess-secret")
FOG_CHESS_ALG = os.getenv("FOG_CHESS_JWT_ALG", "HS256")
FOG_CHESS_AUD = os.getenv("FOG_CHESS_JWT_AUD", "fogchess")
FOG_CHESS_ISS = os.getenv("FOG_CHESS_JWT_ISS", "main-portal")
FOG_CHESS_TOKEN_EXPIRE_SECONDS = int(os.getenv("FOG_CHESS_TOKEN_EXPIRE_SECONDS", "300"))

# 密码加密
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 令牌 URL
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """加密密码"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_fogchess_token(claims: Dict[str, Any], expires_seconds: Optional[int] = None) -> str:
    """创建 FogChess 短期访问令牌
    包含必要的 aud/iss，默认 300s 过期。
    """
    to_encode = claims.copy()
    expire_sec = expires_seconds or FOG_CHESS_TOKEN_EXPIRE_SECONDS
    expire = datetime.utcnow() + timedelta(seconds=expire_sec)
    to_encode.update({
        "exp": expire,
        "iss": FOG_CHESS_ISS,
        "aud": FOG_CHESS_AUD,
    })
    return jwt.encode(to_encode, FOG_CHESS_SECRET, algorithm=FOG_CHESS_ALG)


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """验证用户"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """获取当前用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """获取当前活跃用户"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")
    return current_user
