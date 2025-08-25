from fastapi import APIRouter, Depends, status, HTTPException
from app.models.auth_models import UserCreate, UserLogin, VerifyRequest, Token
from app.services.auth_service import (
    create_new_user,
    request_login_token,
    verify_otp_and_create_session,
    create_access_token
)
from ..dependencies import get_users_service, get_account_service
from app.core import config
from datetime import timedelta

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup_user(
    user_data: UserCreate,
    users_service = Depends(get_users_service)
):
    new_user = await create_new_user(
        name=user_data.name,
        email=user_data.email,
        users_service=users_service
    )
    return {
        "status": "success",
        "message": "User created successfully.",
        "user_id": new_user['$id']
    }

@router.post("/login", status_code=status.HTTP_200_OK)
async def login_user(
    login_data: UserLogin,
    users_service = Depends(get_users_service),
    account_service = Depends(get_account_service)
):
    token = await request_login_token(
        email=login_data.email,
        users_service=users_service,
        account_service=account_service
    )
    return {
        "status": "success",
        "message": "Login token sent.",
        "user_id": token['userId']
    }

@router.post("/verify", response_model=Token)
async def verify_login(
    verify_data: VerifyRequest,
    users_service = Depends(get_users_service),
    account_service = Depends(get_account_service)
):
    appwrite_session = await verify_otp_and_create_session(
        email=verify_data.email,
        otp=verify_data.otp,
        users_service=users_service, # Pass the dependency
        account_service=account_service
    )
    user_id = appwrite_session['userId']
    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}