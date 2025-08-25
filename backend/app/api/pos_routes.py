from fastapi import APIRouter, Depends, status, HTTPException
from app.services import pos_service, product_service
from app.models import pos_models
from ..dependencies import get_db,get_current_user
from appwrite.id import ID
from app.core import config
from app.core.utils import get_current_ist_time
import json
from typing import List
router = APIRouter(
    prefix="/pos",
    tags=["Point of Sale"],
    dependencies=[Depends(get_current_user)]
    
)

# Endpoint for the initial "Add to Bill" action
@router.post("/simulate-sale", response_model=pos_service.SaleSimulationResult)
async def simulate_sale_route(
    simulation_request: pos_models.SimulateSaleRequest, # <-- This is the main change
    db = Depends(get_db)
):
    """
    Simulates a sale for a given product and quantity to determine which
    batches will be used, their prices, and available stock. Read-only.
    """
    # Use the data from the new 'simulation_request' model
    await product_service.get_product_by_id(simulation_request.product_id, db)
    
    simulation_result = await pos_service.simulate_sale_fifo(
        simulation_request.product_id,
        simulation_request.quantity,
        db
    )
    return simulation_result




# Endpoint for the final "Pay with..." action
@router.post("/checkout", status_code=status.HTTP_201_CREATED)
async def checkout_route(checkout_data: pos_models.CheckoutRequest, db = Depends(get_db)):
    """
    Finalizes a sale. This is a WRITE operation that:
    1. Executes FIFO stock deduction.
    2. Calculates final totals.
    3. Creates a permanent sales_order record WITH DETAILED PRICE HISTORY.
    """
    if not checkout_data.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot checkout an empty bill.")

    # --- Step 1: Execute stock deduction and get cost details ---
    # We'll enhance the execute function to return more details
    cogs_and_details = await pos_service.execute_fifo_deduction(checkout_data.items, db)
    total_cost_of_goods_sold = cogs_and_details["total_cogs"]
    
    # --- Step 2: Build the rich items_sold array for historical record ---
    items_sold_for_record: List[dict] = []
    
    # --- CORRECTED CALCULATION LOGIC (EXCLUSIVE TAX MODEL) ---
    total_before_tax = 0
    total_tax_amount = 0

    for item_detail in cogs_and_details["details"]:
        item_from_request = item_detail["item_from_request"]
        batch_doc = item_detail["batch_doc"]
        product_doc = item_detail["product_doc"]

        original_sp = batch_doc.get('selling_price') or product_doc.get('global_selling_price', 0.0)
        
        # This is the subtotal for this specific line item
        line_item_subtotal = item_from_request.quantity * item_from_request.actual_selling_price_per_unit
        total_before_tax += line_item_subtotal
        
        # Calculate the tax on top of this subtotal
        tax_rate = product_doc.get('tax_percentage', 0.0)
        line_item_tax = line_item_subtotal * (tax_rate / 100)
        total_tax_amount += line_item_tax

        item_record = pos_models.SalesOrderItem(
            product_id=product_doc['$id'],
            product_name=product_doc['product_name'],
            product_code=product_doc['product_code'],
            batch_id=batch_doc['$id'],
            quantity=item_from_request.quantity,
            cost_price_per_unit=batch_doc['cost_price'],
            original_selling_price_per_unit=original_sp,
            actual_selling_price_per_unit=item_from_request.actual_selling_price_per_unit,
            tax_percentage_at_sale=tax_rate
        )
        items_sold_for_record.append(item_record.model_dump())

    # The grand total is the sum of the subtotal and the calculated tax
    grand_total = total_before_tax + total_tax_amount

    # --- Step 3: Create the sales_order document (no change here needed) ---
    unique_bill_id = ID.unique()
    sales_order_payload = {
        "bill_number": unique_bill_id,
        "is_printed": checkout_data.print_bill,
        "sale_date_time": get_current_ist_time().isoformat(),
        "total_before_tax": round(total_before_tax, 2),
        "total_tax_amount": round(total_tax_amount, 2),
        "grand_total": round(grand_total, 2),
        "payment_method": checkout_data.payment_method,
        "items_sold": json.dumps({"items": items_sold_for_record})
    }

    new_sale = db.create_document(
        database_id=config.APPWRITE_DATABASE_ID,
        collection_id=config.APPWRITE_COLLECTION_SALES_ORDERS_ID,
        document_id=unique_bill_id,
        data=sales_order_payload
    )

    return {
        "status": "success",
        "message": "Checkout successful.",
        "sale_id": new_sale['$id']
    }