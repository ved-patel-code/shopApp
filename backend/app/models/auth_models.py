from pydantic import BaseModel, EmailStr , Field 

# --- Request Models ---

class UserCreate(BaseModel):
    """Data model for creating a new user."""
    name: str
    email: EmailStr  # Pydantic automatically validates this is a valid email format

# --- Response Models ---

class Token(BaseModel):
    """Data model for the JWT token response."""
    access_token: str
    token_type: str = "bearer"

class UserInfo(BaseModel):
    """Data model for basic user information response."""
    id: str
    name: str
    email: EmailStr


class UserLogin(BaseModel): # <-- Add this new model
    """Data model for user login request."""
    email: EmailStr

class VerifyRequest(BaseModel):
    email: str
    otp: str

