from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.pos_models import CheckoutItem # <-- Import the item model
from typing import List

class CustomerBase(BaseModel):
    name: str
    contact: str
    address: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    id: str = Field(..., alias='$id')
    outstanding_balance: float

    class Config:
        populate_by_name = True

class AddCreditRequest(BaseModel):
    # This model only contains what's necessary for a credit sale
    items: List[CheckoutItem]

from datetime import datetime

class CustomerTransactionResponse(BaseModel):
    id: str = Field(..., alias='$id')
    customer_id: str
    transaction_date: datetime
    transaction_type: str
    amount: float
    sales_order_id: Optional[str] = None # This will be present for Credit Sales

    class Config:
        populate_by_name = True


class SettlePaymentRequest(BaseModel):
    payment_method: str # Should be "Cash" or "UPI"