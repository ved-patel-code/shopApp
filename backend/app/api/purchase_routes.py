from fastapi import APIRouter, Depends, status , HTTPException
from app.models import purchase_models
from ..dependencies import get_db,get_current_user
from app.core.utils import get_current_ist_time
from app.services import purchase_service
from datetime import date, datetime, time
from typing import List, Optional

router = APIRouter(
    prefix="/purchases",
    tags=["Purchases"],
    dependencies=[Depends(get_current_user)]
    
)

@router.post("/", response_model=purchase_models.PurchaseResponse, status_code=status.HTTP_201_CREATED)
async def record_new_stock_purchase(
    purchase_data: purchase_models.PurchaseCreate, 
    db = Depends(get_db)
):
    """
    Records a new stock purchase.
    Handles date-only input and validates against future dates.
    """
    # --- Date Handling and Validation ---
    
    # 1. Determine the purchase date
    purchase_date_to_use = purchase_data.purchase_date
    if purchase_date_to_use is None:
        # If frontend sends nothing, default to today's date
        purchase_date_to_use = date.today()

    # 2. Validate against future dates
    if purchase_date_to_use > date.today():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Purchase date cannot be in the future."
        )

    # 3. Convert the final date to a full datetime object (set to midnight)
    purchase_datetime = datetime.combine(purchase_date_to_use, time.min)

    # --- Prepare the data for the service ---
    # We will now create the final data payload to send to the service,
    # ensuring the purchase_date is in the correct format.

    # Start with the data from the request
    service_payload = purchase_data.model_dump()
    # Overwrite the purchase_date with our processed, full datetime object
    service_payload['purchase_date'] = purchase_datetime

    # Our service layer expects a Pydantic model, so we can re-validate it
    # (This is optional but good practice)
    final_purchase_data = purchase_models.PurchaseCreate(**service_payload)

    # Call the service with the corrected data
    created_purchase_order = await purchase_service.process_new_purchase(final_purchase_data, db)
    return created_purchase_order

@router.get("/", response_model=List[purchase_models.PurchaseResponse])
async def get_purchase_history_route(
    supplier_id: Optional[str] = None, # <-- Make supplier_id an optional query parameter
    db = Depends(get_db)
):
    """
    Retrieves a list of all purchase orders, newest first.
    Can be optionally filtered by supplier_id.
    """
    return await purchase_service.get_purchase_history(supplier_id, db)


@router.put("/{purchase_id}/pay", response_model=purchase_models.PurchaseResponse)
async def mark_as_paid_route(purchase_id: str, db = Depends(get_db)):
    """
    Marks an 'Unpaid' purchase order as 'Paid'. This action is irreversible.
    """
    return await purchase_service.mark_purchase_order_as_paid(purchase_id, db)