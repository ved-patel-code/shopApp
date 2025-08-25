from pydantic import BaseModel, Field
from typing import Optional

class SupplierBase(BaseModel):
    name: str
    contact: str
    address: Optional[str] = None
    gstin_number: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass # The data we expect from the client when creating

class SupplierResponse(SupplierBase):
    id: str = Field(..., alias='$id') # Handle Appwrite's '$id'

    class Config:
        populate_by_name = True