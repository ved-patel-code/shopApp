from appwrite.services.databases import Databases
from appwrite.id import ID
from appwrite.exception import AppwriteException
from fastapi import HTTPException, status
from app.core import config
from app.core.utils import get_current_ist_time
from app.models import purchase_models
from appwrite.query import Query

# --- Import the services we need for validation ---
from app.services import supplier_service, product_service

async def create_product(product_data: dict, db: Databases) -> dict:
    """Creates a new product document in the products collection."""
    try:
        # First, check for uniqueness of product_code and product_name
        # ... (uniqueness check code remains exactly the same)
        code_check = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
            queries=[Query.equal("product_code", product_data["product_code"])]
        )
        if code_check['total'] > 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Item Code already exists.")

        name_check = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
            queries=[Query.equal("product_name", product_data["product_name"])]
        )
        if name_check['total'] > 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product Name already exists.")
        
        # --- THIS IS THE KEY CHANGE ---
        # Prepare the final data payload for Appwrite.
        # We start with the data from the request...
        final_product_data = product_data.copy()
        # ...and then we enforce our business rule by adding the default stock value.
        final_product_data['current_total_stock'] = 0
            
        # If checks pass, create the document using the final payload
        new_product = db.create_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
            document_id=ID.unique(),
            data=final_product_data # <-- Use the modified data dictionary
        )
        return new_product
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

async def get_product_by_id(product_id: str, db: Databases) -> dict:
    """Fetches a single product document by its Appwrite Document ID."""
    try:
        product = db.get_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
            document_id=product_id
        )
        return product
    except AppwriteException as e:
        if e.code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID '{product_id}' not found."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

async def get_all_products(db: Databases) -> list:
    """Fetches all documents from the products collection."""
    try:
        product_list = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
            queries=[Query.order_asc("product_name")] # Sort alphabetically by name
        )
        return product_list['documents']
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

async def search_products(query: str, db: Databases) -> list:
    """
    Searches for products by substring in both product_code and product_name,
    prioritizing code matches and ensuring no duplicates.
    """
    try:
        # --- Query 1: Search by product_code (using contains) ---
        code_matches_list = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
            queries=[Query.contains("product_code", query)]
        )
        code_matches = code_matches_list['documents']

        # --- Query 2: Search by product_name (using contains) ---
        name_matches_list = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
            queries=[Query.contains("product_name", query)]
        )
        name_matches = name_matches_list['documents']

        # --- Merge and Prioritize Results ---
        combined_results = {}

        # 1. Add all code matches first.
        for product in code_matches:
            combined_results[product['$id']] = product
        
        # 2. Add name matches. Duplicates are automatically handled.
        for product in name_matches:
            combined_results[product['$id']] = product
        
        # Convert the dictionary values back to a list.
        final_list = list(combined_results.values())
        
        return final_list

    except AppwriteException as e:
        # Handle potential missing index error
        if 'index not found' in str(e).lower():
             raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail="Search functionality is not configured. Please add a Key index to product_name and product_code attributes in Appwrite."
            )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    
async def update_product_by_id(product_id: str, product_data: dict, db: Databases) -> dict:
    """Updates an existing product document after checking for uniqueness of new code/name."""
    try:
        # Check if the user is trying to update the product_code
        if "product_code" in product_data:
            code_check = db.list_documents(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
                queries=[
                    Query.equal("product_code", product_data["product_code"]),
                    Query.not_equal("$id", product_id) # <--- CORRECTED METHOD NAME
                ]
            )
            if code_check['total'] > 0:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Item Code already exists in another product.")

        # Check if the user is trying to update the product_name
        if "product_name" in product_data:
            name_check = db.list_documents(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
                queries=[
                    Query.equal("product_name", product_data["product_name"]),
                    Query.not_equal("$id", product_id) # <--- CORRECTED METHOD NAME
                ]
            )
            if name_check['total'] > 0:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product Name already exists in another product.")

        # If all checks pass, proceed with the update
        updated_product = db.update_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PRODUCTS_ID,
            document_id=product_id,
            data=product_data
        )
        return updated_product
    except AppwriteException as e:
        if e.code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with ID '{product_id}' not found.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))