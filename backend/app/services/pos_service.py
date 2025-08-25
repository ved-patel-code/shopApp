from appwrite.services.databases import Databases
from appwrite.query import Query
from fastapi import HTTPException, status
from app.core import config
from typing import List, Dict, Any
from appwrite.exception import AppwriteException
import logging
from dateutil import parser
# A helper data class to make the return type clearer
from pydantic import BaseModel
from app.models.pos_models import CheckoutItem
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from app.services import product_service
# ... other imports

class SaleSimulationDetail(BaseModel):
    batch_id: str
    quantity_to_sell: int
    cost_price: float
    suggested_selling_price: float
    available_stock_in_batch: int # <-- CRITICAL ADDITION
    date_received: str # <-- ADDED FOR TRACEABILITY

class SaleSimulationResult(BaseModel): # <-- Renamed for clarity
    is_sufficient_stock: bool
    stock_shortage: int
    line_items: List[SaleSimulationDetail]

class FifoDetail(BaseModel):
    batch_id: str
    quantity_to_deduct: int
    cost_price: float
    selling_price: float

class FifoCalculationResult(BaseModel):
    total_cost_of_sale: float
    deduction_details: List[FifoDetail]
    is_sufficient_stock: bool
    stock_shortage: int

async def simulate_sale_fifo(product_id: str, quantity_to_sell: int, db: Databases) -> SaleSimulationResult:
    """
    Simulates a sale using FIFO, returning a detailed breakdown for a rich frontend UI.
    This is a read-only operation.
    """
    try:
        product_doc = await product_service.get_product_by_id(product_id, db)
        global_sp = product_doc.get('global_selling_price', 0.0)
        # 1. Fetch all active, oldest-first batches for the product
        active_batches = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_BATCHES_ID,
            queries=[
                Query.equal("product_id", product_id),
                Query.greater_than("quantity_in_stock", 0),
                Query.order_asc("date_received")
            ]
        )['documents']

        # 2. Check for sufficient total stock
        total_available_stock = sum(batch['quantity_in_stock'] for batch in active_batches)
        if total_available_stock < quantity_to_sell:
            return SaleSimulationResult(
                is_sufficient_stock=False,
                stock_shortage=quantity_to_sell - total_available_stock,
                line_items=[]
            )

        # 3. Perform the FIFO simulation to generate line items
        remaining_qty_to_sell = quantity_to_sell
        line_items: List[SaleSimulationDetail] = []

        for batch in active_batches:
            if remaining_qty_to_sell <= 0:
                break

            qty_from_this_batch = min(remaining_qty_to_sell, batch['quantity_in_stock'])

            batch_sp = batch.get('selling_price')
            # Use the batch's specific SP if it's a positive number, otherwise fall back to the global SP.
            suggested_price = batch_sp if batch_sp and batch_sp > 0 else global_sp
            
            line_items.append(
                SaleSimulationDetail(
                    batch_id=batch['$id'],
                    quantity_to_sell=qty_from_this_batch,
                    cost_price=batch['cost_price'],
                    # Use the batch's specific SP, fall back to a default if null/missing
                    suggested_selling_price=suggested_price,
                    available_stock_in_batch=batch['quantity_in_stock'], # <-- Pass the batch's current stock
                    date_received=batch['date_received'] # <-- Pass the date
                )
            )
            
            remaining_qty_to_sell -= qty_from_this_batch

        return SaleSimulationResult(
            is_sufficient_stock=True,
            stock_shortage=0,
            line_items=line_items
        )

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error during sale simulation: {str(e)}")
    

async def execute_fifo_deduction(items_to_sell: List[CheckoutItem], db: Databases) -> dict:
    """
    Executes stock deduction and returns rich details for historical records.
    This is a WRITE operation.

    Returns:
        A dictionary containing total COGS and a detailed breakdown for record-keeping.
    """
    total_cost_of_sale = 0.0
    detailed_results = []
    
    # Group quantities by product_id to perform a single stock update per product
    product_stock_updates: Dict[str, int] = {}

    # --- We will perform all validations BEFORE making any database changes ---
    validated_data_list = []
    for item in items_to_sell:
        try:
            # Fetch both the batch and its parent product in the validation phase
            batch_doc = db.get_document(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_BATCHES_ID,
                document_id=item.batch_id
            )
            
            # Since product_id is the same for the item and batch, we use it to fetch the product
            product_doc = db.get_document(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
                document_id=item.product_id
            )

            if batch_doc['quantity_in_stock'] < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient stock for batch {item.batch_id}. "
                           f"Requested: {item.quantity}, Available: {batch_doc['quantity_in_stock']}."
                )

            # Store all necessary data for later processing
            validated_data_list.append({
                'item_from_request': item,
                'batch_doc': batch_doc,
                'product_doc': product_doc
            })
            
            # Aggregate the total quantity to deduct for each product
            product_stock_updates[item.product_id] = product_stock_updates.get(item.product_id, 0) + item.quantity

        except AppwriteException as e:
            if e.code == 404:
                # This could be a missing batch OR a missing product
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Could not find batch or product for item with batch ID {item.batch_id}.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Validation failed: {str(e)}")

    # --- If all validations passed, now we can safely perform all WRITE operations ---
    try:
        # Update batch documents
        for valid_data in validated_data_list:
            item = valid_data['item_from_request']
            batch_doc = valid_data['batch_doc']
            
            item_cost = item.quantity * batch_doc['cost_price']
            total_cost_of_sale += item_cost
            
            new_batch_stock = batch_doc['quantity_in_stock'] - item.quantity
            db.update_document(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_BATCHES_ID,
                document_id=item.batch_id,
                data={"quantity_in_stock": new_batch_stock}
            )
            # Add the validated data to our results list for the return value
            detailed_results.append(valid_data)

        # Update master product documents
        for product_id, total_deduction in product_stock_updates.items():
            # We already fetched the product_doc during validation, but fetching again
            # is safer in case of high concurrency. Let's stick with the safe approach.
            product_doc = db.get_document(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
                document_id=product_id
            )
            new_stock_total = product_doc['current_total_stock'] - total_deduction
            if new_stock_total < 0:
                new_stock_total = 0

            db.update_document(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
                document_id=product_id,
                data={"current_total_stock": new_stock_total}
            )
            
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"A critical error occurred during stock update: {str(e)}")
            
    # Return the rich dictionary object
    return {"total_cogs": total_cost_of_sale, "details": detailed_results}