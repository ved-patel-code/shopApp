from pydantic import BaseModel, Field
from typing import Optional

class ProductBase(BaseModel):
    product_name: str
    product_code: str
    tax_percentage: float = 0.0
    global_selling_price: Optional[float] = 0.0



class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    product_code: str | None = None
    product_name: str | None = None
    current_total_stock: int | None = None
    global_selling_price: float | None = None
    tax_percentage: float | None = None # Inherits all fields from ProductBase



class ProductResponse(BaseModel):
    # This tells Pydantic: "The 'id' field in this model
    # should be populated from the key '$id' in the source data."
    id: str = Field(..., alias='$id') 
    
    product_name: str
    product_code: str
    current_total_stock: int
    global_selling_price: Optional[float] = 0.0
    tax_percentage: float = 0.0

    class Config:
        # This allows the model to be created from dictionary keys, including aliases
        populate_by_name = True