from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.id import ID
from appwrite.exception import AppwriteException
from fastapi import HTTPException, status
from app.core import config
from typing import List
from dateutil import parser
from app.core.utils import get_current_ist_time
from app.services import pos_service, product_service
from app.models.pos_models import CheckoutRequest
import json 

async def create_customer(customer_data: dict, db: Databases) -> dict:
    """Creates a new customer document, ensuring the contact is unique."""
    try:
        # Check for uniqueness of customer contact number
        contact_check = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_CUSTOMERS_ID,
            queries=[Query.equal("contact", customer_data["contact"])]
        )
        if contact_check['total'] > 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A customer with this contact number already exists.")
            
        # Add the default outstanding_balance to the payload
        final_customer_data = customer_data.copy()
        final_customer_data['outstanding_balance'] = 0.0
        
        # If the check passes, create the document
        new_customer = db.create_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_CUSTOMERS_ID,
            document_id=ID.unique(),
            data=final_customer_data
        )
        return new_customer
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    

async def get_all_customers(db: Databases) -> list:
    """Fetches all documents from the customers collection."""
    try:
        # We can add sorting here, for example, by name
        customer_list = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_CUSTOMERS_ID,
            queries=[Query.order_asc("name")] # Sorting alphabetically by name
        )
        return customer_list['documents']
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

async def get_customer_by_id(customer_id: str, db: Databases) -> dict:
    """Fetches a single customer document by its Appwrite Document ID."""
    try:
        customer = db.get_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_CUSTOMERS_ID,
            document_id=customer_id
        )
        return customer
    except AppwriteException as e:
        if e.code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID '{customer_id}' not found."
            )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    


async def get_customer_ledger(customer_id: str, db: Databases) -> List[dict]:
    """
    Fetches the transaction history for a customer's current outstanding balance.
    Final correct version.
    """
    # Step 1: Validate customer and check balance.
    customer = await get_customer_by_id(customer_id, db)
    if customer.get('outstanding_balance', 0) <= 0:
        return []

    # Step 2: Fetch ALL transactions for this customer, sorted oldest to newest.
    all_transactions = db.list_documents(
        database_id=config.APPWRITE_DATABASE_ID,
        collection_id=config.APPWRITE_COLLECTION_CUSTOMER_TRANSACTIONS_ID,
        queries=[
            Query.equal("customer_id", customer_id),
            Query.order_asc("transaction_date")
        ]
    )['documents']

    if not all_transactions:
        return []

    # Step 3: Find the index of the last "Payment" in the sorted list.
    last_payment_index = -1
    for i, trans in enumerate(all_transactions):
        if trans['transaction_type'] == 'Payment':
            last_payment_index = i

    # Step 4: The ledger is all "Credit Sale" transactions that appear AFTER this index.
    
    # Slice the list to get all items after the last payment
    items_after_last_payment = all_transactions[last_payment_index + 1:]
    
    # Filter this smaller list to ensure we only return credit sales
    # (This is a safety check in case other transaction types are added later)
    ledger_transactions = [
        trans for trans in items_after_last_payment 
        if trans['transaction_type'] == 'Credit_Sale' # <-- Corrected your Enum name
    ]

    return ledger_transactions


async def add_items_to_customer_credit(customer_id: str, credit_data: CheckoutRequest, db: Databases) -> dict:
    """
    Processes a credit sale safely. Calculates tax on top of the provided price.
    Creates sales records FIRST, then updates inventory.
    """
    # Step 1: Validate customer and check for empty bill
    customer = await get_customer_by_id(customer_id, db)
    if not credit_data.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add an empty bill to credit.")

    # --- Step 2: CORRECTED FINANCIAL CALCULATIONS (Read-only operation) ---
    
    total_before_tax = 0.0
    total_tax_amount = 0.0
    items_with_full_details = [] # We'll store enriched item data here

    for item in credit_data.items:
        product = await product_service.get_product_by_id(item.product_id, db)
        
        # Calculate subtotal for this line item (price * quantity)
        item_subtotal = item.quantity * item.actual_selling_price_per_unit
        total_before_tax += item_subtotal
        
        # Calculate tax for this line item
        tax_rate = product.get('tax_percentage', 0) / 100
        item_tax = item_subtotal * tax_rate
        total_tax_amount += item_tax

        # Enrich the item data with details for storage
        item_details = item.model_dump() # Convert incoming item to a dictionary
        item_details['product_name'] = product.get('product_name') # Ensure the correct name is stored
        item_details['product_code'] = product.get('product_code') # Store the code as well for consistency
        items_with_full_details.append(item_details)

    # Calculate the final grand_total
    grand_total = total_before_tax + total_tax_amount

    # --- Start of WRITE operations ---
    new_sale_order = None
    try:
        # Step 3: Create the sales_order document FIRST.
        current_time = get_current_ist_time()
        unique_bill_id = ID.unique()
        
        # Prepare the items payload for storage, using the enriched data
        items_to_store = {"items": items_with_full_details}
        
        sales_order_payload = {
            "bill_number": unique_bill_id,
            "is_printed": False,
            "sale_date_time": current_time.isoformat(),
            "total_before_tax": round(total_before_tax, 2),
            "total_tax_amount": round(total_tax_amount, 2),
            "grand_total": round(grand_total, 2),
            "payment_method": "customer_tab",
            "items_sold": json.dumps(items_to_store) # Use the enriched items list
        }
        new_sale_order = db.create_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_SALES_ORDERS_ID,
            document_id=unique_bill_id,
            data=sales_order_payload
        )

        # Step 4: Create the customer_transactions record.
        customer_transaction_payload = {
            "customer_id": customer_id,
            "transaction_date": current_time.isoformat(),
            "transaction_type": "Credit_Sale",
            "amount": round(grand_total, 2),
            "sales_order_id": new_sale_order['$id']
        }
        db.create_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_CUSTOMER_TRANSACTIONS_ID,
            document_id=ID.unique(),
            data=customer_transaction_payload
        )

        # Step 5: Update the customer's outstanding balance.
        new_balance = customer.get('outstanding_balance', 0) + round(grand_total, 2)
        updated_customer = db.update_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_CUSTOMERS_ID,
            document_id=customer_id,
            data={"outstanding_balance": new_balance}
        )
        
        # Step 6: ONLY if all sales records are created successfully, execute the inventory deduction.
        await pos_service.execute_fifo_deduction(credit_data.items, db)

        return updated_customer

    except Exception as e:
        # If any step fails, try to delete the sales_order if it was created.
        if new_sale_order:
            db.delete_document(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_SALES_ORDERS_ID,
                document_id=new_sale_order['$id']
            )
        # Re-raise the original exception
        if isinstance(e, AppwriteException):
             raise HTTPException(status_code=500, detail=f"Failed to add credit: {e.message}")
        raise e
    


async def settle_customer_dues(customer_id: str, payment_method: str, db: Databases) -> dict:
    """
    Clears a customer's outstanding balance and records a payment transaction.
    """
    # Step 1: Validate the customer exists and get their current balance.
    customer = await get_customer_by_id(customer_id, db)
    
    current_balance = customer.get('outstanding_balance', 0)

    # Prevent settling an already zero balance.
    if current_balance <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer has no outstanding balance to settle."
        )

    # Step 2: Create the "Payment" transaction record in the ledger.
    payment_transaction_payload = {
        "customer_id": customer_id,
        "transaction_date": get_current_ist_time().isoformat(),
        "transaction_type": "Payment",
        "amount": current_balance # The payment amount is the entire outstanding balance
    }
    db.create_document(
        database_id=config.APPWRITE_DATABASE_ID,
        collection_id=config.APPWRITE_COLLECTION_CUSTOMER_TRANSACTIONS_ID,
        document_id=ID.unique(),
        data=payment_transaction_payload
    )

    # Step 3: Update the customer's outstanding balance to zero.
    updated_customer = db.update_document(
        database_id=config.APPWRITE_DATABASE_ID,
        collection_id=config.APPWRITE_COLLECTION_CUSTOMERS_ID,
        document_id=customer_id,
        data={"outstanding_balance": 0.0}
    )

    return updated_customer



async def get_customer_transaction_history(
    customer_id: str, db: Databases, limit: int, offset: int
) -> dict:
    """
    Fetches a paginated list of all transactions for a specific customer, newest first.
    """
    # First, validate that the customer exists.
    await get_customer_by_id(customer_id, db)

    try:
        transaction_list = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_CUSTOMER_TRANSACTIONS_ID,
            queries=[
                Query.equal("customer_id", customer_id),
                Query.order_desc("transaction_date"), # Newest first for a timeline
                Query.limit(limit),
                Query.offset(offset)
            ]
        )
        return {
            "total": transaction_list['total'],
            "limit": limit,
            "offset": offset,
            "data": transaction_list['documents']
        }
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))