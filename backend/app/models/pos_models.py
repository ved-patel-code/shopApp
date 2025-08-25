from pydantic import BaseModel,Field
from typing import List, Optional 

class CheckoutItem(BaseModel):
    product_id: str
    batch_id: str
    quantity: int
    actual_selling_price_per_unit: float
    product_name: Optional[str] = None

class CheckoutRequest(BaseModel):
    payment_method: str # "Cash" or "UPI"
    items: List[CheckoutItem]
    print_bill: bool = False 

class SimulateSaleRequest(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0) # Ensure quantity is a positive integer


class SalesOrderItem(BaseModel):
    product_id: str
    product_name: str # For easier display in history
    product_code: str # For easier display in history
    batch_id: str
    quantity: int
    cost_price_per_unit: float # The actual cost from the batch
    original_selling_price_per_unit: float # The price it SHOULD have been
    actual_selling_price_per_unit: float # The price it was ACTUALLY sold for
    tax_percentage_at_sale: float # The tax rate at the time of sale


