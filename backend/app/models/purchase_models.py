from pydantic import BaseModel, Field, model_validator 
from typing import List, Optional, Any 
from datetime import date ,datetime
import json 


# This model defines a single item within a purchase order request
class ItemReceived(BaseModel):
    product_id: str
    quantity: int
    cost_price: float
    product_name: Optional[str] = None
    product_code: Optional[str] = None

# This is the main request body for creating a new purchase
class PurchaseCreate(BaseModel):
    supplier_id: str
    total_amount_owed: float
    payment_status: str # Should be "Paid" or "Unpaid"
    items: List[ItemReceived] # A list of items received
    purchase_date: Optional[date] = None

# This will be our response model
class PurchaseResponse(BaseModel):
    id: str = Field(..., alias='$id')
    supplier_id: str
    purchase_date: datetime
    total_amount_owed: float
    payment_status: str
    amount_paid: float
    remaining_balance: float
    items_received: List[ItemReceived]

    class Config:
        populate_by_name = True
