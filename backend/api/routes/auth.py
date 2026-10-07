"""HTTP endpoints for auth."""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import EmailStr
from sqlalchemy.orm import Session

from auth import get_current_active_user
from database import get_db
from models import User
from schemas import (
    APIResponse,
    CompleteProfileBody,
    GoogleTokenRequest,
    ResetPassword,
    SendVerificationCode,
    UserCreate,
    UserResponse,
)
from services import account, profile

router = APIRouter(prefix="/api/auth", tags=["认证"])


@router.post("/send-verification-code", response_model=APIResponse)
async def send_verification_code(request: SendVerificationCode):
    return await account.send_verification_code(request=request)


@router.get("/check-availability", response_model=APIResponse)
async def check_availability(
    username: Optional[str] = None,
    email: Optional[EmailStr] = None,
    db: Session = Depends(get_db),
):
    return await account.check_availability(username=username, email=email, db=db)


@router.post(
    "/register", response_model=APIResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    user_data: UserCreate, response: Response, db: Session = Depends(get_db)
):
    return await account.register(user_data=user_data, response=response, db=db)


@router.post("/login", response_model=APIResponse)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False),
    db: Session = Depends(get_db),
):
    return await account.login(
        response=response, form_data=form_data, remember_me=remember_me, db=db
    )


@router.post("/google", response_model=APIResponse)
async def google_login(
    request: GoogleTokenRequest, response: Response, db: Session = Depends(get_db)
):
    return await account.google_login(request=request, response=response, db=db)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
):
    return await profile.get_current_user_info(current_user=current_user)


@router.patch("/me", response_model=UserResponse)
async def update_current_user_profile(
    body: CompleteProfileBody,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await profile.update_current_user_profile(
        body=body, response=response, current_user=current_user, db=db
    )


@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return await profile.upload_avatar(file=file, current_user=current_user, db=db)


@router.get("/verify", response_model=APIResponse)
async def verify_token(current_user: User = Depends(get_current_active_user)):
    return await account.verify_token(current_user=current_user)


@router.post("/logout", response_model=APIResponse)
async def logout(response: Response):
    return await account.logout(response=response)


@router.post("/send-reset-password-code", response_model=APIResponse)
async def send_reset_password_code(
    request: SendVerificationCode, db: Session = Depends(get_db)
):
    return await account.send_reset_password_code(request=request, db=db)


@router.post("/reset-password", response_model=APIResponse)
async def reset_password(request: ResetPassword, db: Session = Depends(get_db)):
    return await account.reset_password(request=request, db=db)
