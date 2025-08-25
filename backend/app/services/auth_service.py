from appwrite.client import Client
from appwrite.services.users import Users
from appwrite.id import ID
from appwrite.exception import AppwriteException
from fastapi import HTTPException, status
from appwrite.services.account import Account
from appwrite.query import Query
from app.core import config
from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.core import config 

# Note: We will pass the Appwrite client to these functions
# to avoid circular dependencies and make them testable.

async def create_new_user(name: str, email: str, users_service: Users) -> dict:
    """
    Creates a new user in the Appwrite authentication system.

    Args:
        name: The name of the user.
        email: The email of the user.
        users_service: An instance of the Appwrite Users service.

    Returns:
        A dictionary containing the newly created user's data.

    Raises:
        HTTPException: If a user with the same email already exists.
    """
    try:
        # Appwrite requires a unique user ID. We can use ID.unique()
        # to let Appwrite generate a secure unique ID.
        new_user = users_service.create(
            user_id=ID.unique(),
            email=email,
            name=name
        )
        return new_user
    except AppwriteException as e:
        # AppwriteException code 409 means a user with that email/ID already exists.
        if e.code == 409:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists."
            )
        # For any other Appwrite error, we raise a generic server error.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred with Appwrite: {e.message}"
        )
    
async def request_login_token(email: str, users_service: Users, account_service: Account) -> dict:
    try:
        users_list = users_service.list(queries=[Query.equal("email", email)])
        if users_list['total'] == 0:
            raise HTTPException(
                status_code=404,
                detail="No user found with this email address. Please sign up first."
            )

        user_id = users_list['users'][0]['$id']  # ✅ real user ID

        token = account_service.create_email_token(
            user_id=user_id,
            email=email
        )
        return token   # ✅ return full token object

    except AppwriteException as e:
        if e.code == 429:
            raise HTTPException(
                status_code=429,
                detail="Too many login requests. Please wait and try again."
            )
        raise HTTPException(status_code=500, detail=f"Appwrite error: {e.message}")
    
    except AppwriteException as e:
        # This will now primarily catch non-user-related errors, like rate limiting.
        if e.code == 429:
             raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You have requested too many login tokens. Please wait and try again."
            )
        # We keep the generic error handler as a fallback.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred with Appwrite: {e.message}"
        )
    

async def verify_otp_and_create_session(email: str, otp: str, users_service: Users, account_service: Account) -> dict:
    """
    Verifies OTP by looking up user_id from email and creating a session.
    """
    try:
        # find user by email
        users_list = users_service.list(queries=[Query.equal("email", email)])
        if users_list['total'] == 0:
            raise HTTPException(status_code=404, detail="No user found with this email")

        user_id = users_list['users'][0]['$id']

        # verify otp
        session = account_service.create_session(
            user_id=user_id,
            secret=otp
        )
        return session
    except AppwriteException as e:
        if e.code == 401 or "invalid" in e.message.lower():
            raise HTTPException(status_code=401, detail="Invalid or expired OTP.")
        raise HTTPException(status_code=500, detail=f"Appwrite error: {e.message}")

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Creates a new JWT access token.

    Args:
        data: The payload to include in the token (e.g., user ID).
        expires_delta: The lifespan of the token.

    Returns:
        The encoded JWT string.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15) # Default expiry
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, config.JWT_SECRET_KEY, algorithm=config.ALGORITHM)
    return encoded_jwt