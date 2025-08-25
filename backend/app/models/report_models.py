from pydantic import BaseModel , Field
from datetime import date , datetime
from typing import Optional
from app.models.pos_models import CheckoutItem
from typing import List, Any
from pydantic import model_validator
import json


class FinancialSummaryResponse(BaseModel):
    total_profit: float
    total_sales: float
    total_tax_collected: float
    current_inventory_value: float
    vendor_dues: float


class OperatingCostCreate(BaseModel):
    expense_name: str
    amount: float
    expense_date: date # Frontend will send the full datetime string
    description: Optional[str] = None

class OperatingCostResponse(BaseModel):
    id: str = Field(..., alias='$id')
    expense_name: str
    expense_date: datetime
    description: Optional[str] = None
    amount: float

    class Config:
        populate_by_name = True


class SaleHistoryItem(BaseModel):
    id: str = Field(..., alias='$id')
    bill_number: str
    sale_date_time: datetime
    grand_total: float
    payment_method: str

    class Config:
        populate_by_name = True

# Model for the detailed view (floating window)
class SaleDetailResponse(SaleHistoryItem):
    total_before_tax: float
    total_tax_amount: float
    is_printed: bool
    items_sold: List[CheckoutItem] # <-- We will parse the JSON into a list of items

    # Pydantic validator to parse the JSON string from the database
    

    @model_validator(mode='before')
    @classmethod
    def parse_items_sold_json(cls, data: Any) -> Any:
        if isinstance(data, dict):
            items_sold_str = data.get('items_sold')
            if isinstance(items_sold_str, str):
                # Replace the string with the parsed Python object
                data['items_sold'] = json.loads(items_sold_str).get('items', [])
        return data