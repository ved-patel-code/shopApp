from fastapi import APIRouter, Depends, status
from typing import List
from app.services import supplier_service
from app.models import supplier_models
from ..dependencies import get_db,get_current_user

router = APIRouter(
    prefix="/suppliers",
    tags=["Suppliers"],

)

@router.post("/", response_model=supplier_models.SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_new_supplier(supplier: supplier_models.SupplierCreate, db = Depends(get_db)):
    """
    Creates a new supplier.
    """
    # .model_dump() converts the Pydantic model to a dictionary for the service
    new_supplier = await supplier_service.create_supplier(supplier.model_dump(), db)
    return new_supplier

@router.get("/", response_model=List[supplier_models.SupplierResponse])
async def get_all_suppliers_route(db = Depends(get_db)):
    """
    Retrieves a list of all suppliers.
    """
    return await supplier_service.get_all_suppliers(db)