from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class BatchUpdateSP(BaseModel):
    selling_price: float

class BatchResponse(BaseModel):
    id: str = Field(..., alias='$id')
    product_id: str
    quantity_in_stock: int
    initial_quantity: int
    cost_price: float
    selling_price: Optional[float] = 0.0
    date_received: datetime
    supplier_id: Optional[str] = None
    purchase_order_id: str

    class Config:
        populate_by_name = True