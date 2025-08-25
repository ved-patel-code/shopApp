from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.users import Users
from appwrite.services.account import Account
from app.core import config

# --- Create a single, reusable Appwrite client ---
client = Client()
client.set_endpoint('https://cloud.appwrite.io/v1')
client.set_project(config.APPWRITE_PROJECT_ID)
client.set_key(config.APPWRITE_API_KEY)

# --- Create service instances from the single client ---
db_provider = Databases(client)
users_provider = Users(client)
account_provider = Account(client)

# --- Define Dependency Functions ---

def get_db() -> Databases:
    """Dependency to get the Appwrite Databases service."""
    return db_provider

def get_users_service() -> Users:
    """Dependency to get the Appwrite Users service."""
    return users_provider

def get_account_service() -> Account:
    """Dependency to get the Appwrite Account service."""
    return account_provider

# --- Security Dependency ---

security_scheme = HTTPBearer()

async def get_current_user(
    authorization: HTTPAuthorizationCredentials = Depends(security_scheme),
    # Use our dependency function to get the users_service instance
    users_service: Users = Depends(get_users_service)
) -> dict:
    """
    Decodes the JWT token to get the user's ID and then fetches the user's data.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = authorization.credentials
    try:
        payload = jwt.decode(token, config.JWT_SECRET_KEY, algorithms=[config.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    try:
        user = users_service.get(user_id=user_id)
        if user is None:
            raise credentials_exception
        return user
    except Exception:
        raise credentials_exception