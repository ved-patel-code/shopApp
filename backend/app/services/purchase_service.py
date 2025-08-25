from appwrite.services.databases import Databases
from appwrite.id import ID
from appwrite.exception import AppwriteException
from fastapi import HTTPException, status
from app.core import config
from app.core.utils import get_current_ist_time
from app.models import purchase_models
from appwrite.query import Query
from typing import Optional
import json
from app.services import supplier_service, product_service




async def process_new_purchase(purchase_data: purchase_models.PurchaseCreate, db: Databases) -> dict:
    """
    Main service to process a new stock purchase.
    Validates IDs, creates the Purchase Order, creates Batches, and updates stock.
    """

    # --- Validation Step (Remains the same) ---
    await supplier_service.get_supplier_by_id(purchase_data.supplier_id, db)
    # Storing products in a dictionary for efficient stock update later
    validated_products = {}
    for item in purchase_data.items:
        product_doc = await product_service.get_product_by_id(item.product_id, db)
        validated_products[item.product_id] = product_doc

    # --- Step 1: Create the Purchase Order (Remains the same) ---
    # ... (code for calculating balances and creating po_data_payload) ...
    

    if purchase_data.payment_status == "Paid":
        amount_paid = purchase_data.total_amount_owed
        remaining_balance = 0.0
    else:
        amount_paid = 0.0
        remaining_balance = purchase_data.total_amount_owed
        
    current_time = get_current_ist_time()
    po_data_payload = {
        "supplier_id": purchase_data.supplier_id,
        "purchase_date": current_time.isoformat(),
        "total_amount_owed": purchase_data.total_amount_owed,
        "payment_status": purchase_data.payment_status,
        "amount_paid": amount_paid,
        "remaining_balance": remaining_balance,
         "items_received": json.dumps({
    "items": [item.model_dump() for item in purchase_data.items]
})
    }
    
    try:
        purchase_order_document = db.create_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PURCHASE_ORDERS_ID,
            document_id=ID.unique(),
            data=po_data_payload
        )

        items_str = purchase_order_document.get("items_received")
        if isinstance(items_str, str):
            try:
                purchase_order_document["items_received"] = json.loads(items_str).get("items", [])
            except json.JSONDecodeError:
                purchase_order_document["items_received"] = []
        else:
            purchase_order_document["items_received"] = []

        # --- NEW LOGIC: Step 2: Create Batches and Update Product Stock ---
        
        for item in purchase_data.items:
            # Prepare the data payload for the new batch document
            batch_data = {
                "product_id": item.product_id,
                "quantity_in_stock": item.quantity,
                "initial_quantity": item.quantity,
                "cost_price": item.cost_price,
                "date_received": current_time.isoformat(),
                "supplier_id": purchase_data.supplier_id,
                "purchase_order_id": purchase_order_document['$id'], # Link to the PO we just created
                # Set the batch's initial selling_price from the master product's global_selling_price
                "selling_price": validated_products[item.product_id].get('global_selling_price', 0.0)
            }
            
            # Create the batch document in Appwrite
            db.create_document(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_BATCHES_ID,
                document_id=ID.unique(),
                data=batch_data
            )
            
            # Update the product's total stock
            old_stock = int(validated_products[item.product_id].get('current_total_stock', 0))
            new_stock_total = old_stock + int(item.quantity)

            db.update_document(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
                document_id=item.product_id,
                data={"current_total_stock": new_stock_total}  # ✅ always int
            )

        return purchase_order_document
        
    except AppwriteException as e:
        # Basic rollback: if something fails, try to delete the PO that was created
        if 'purchase_order_document' in locals():
            db.delete_document(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_PURCHASE_ORDERS_ID,
                document_id=purchase_order_document['$id']
            )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to process purchase: {str(e)}")


async def get_purchase_history(supplier_id: Optional[str], db: Databases) -> list:
    """Fetches a list of all purchase orders, newest first. Can be filtered by supplier."""
    try:
        queries = [Query.order_desc("purchase_date")] # Default query to sort by date
        
        if supplier_id:
            queries.append(Query.equal("supplier_id", supplier_id))

        purchase_list = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PURCHASE_ORDERS_ID,
            queries=queries
        )
        documents = purchase_list['documents']
        for doc in documents:
            items_str = doc.get('items_received')
            if isinstance(items_str, str) and items_str:
                try:
                    # Parse the string and replace the original string with the list of items
                    doc['items_received'] = json.loads(items_str).get('items', [])
                except json.JSONDecodeError:
                    # If the string is not valid JSON, default to an empty list to prevent crashes
                    doc['items_received'] = []
            else:
                 # If the field is missing or not a string, ensure it's a list
                doc['items_received'] = []

        return documents

    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    


async def mark_purchase_order_as_paid(purchase_id: str, db: Databases) -> dict:
    """Updates a purchase order's status from 'Unpaid' to 'Paid'."""
    try:
        # First, get the purchase order to ensure it exists and is unpaid
        purchase_order = db.get_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PURCHASE_ORDERS_ID,
            document_id=purchase_id
        )

        if purchase_order['payment_status'] == 'Paid':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This purchase order has already been marked as paid."
            )
        
        # Prepare the update payload
        update_data = {
            "payment_status": "Paid",
            "amount_paid": purchase_order['total_amount_owed'],
            "remaining_balance": 0.0
        }

        updated_po = db.update_document(
    database_id=config.APPWRITE_DATABASE_ID,
    collection_id=config.APPWRITE_COLLECTION_PURCHASE_ORDERS_ID,
    document_id=purchase_id,
    data=update_data
        )

        # normalize items_received
        items_str = updated_po.get('items_received')
        if isinstance(items_str, str):
            try:
                updated_po['items_received'] = json.loads(items_str).get('items', [])
            except json.JSONDecodeError:
                updated_po['items_received'] = []
        else:
            updated_po['items_received'] = []

        return updated_po
        
    except AppwriteException as e:
        if e.code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Purchase order with ID '{purchase_id}' not found."
            )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))