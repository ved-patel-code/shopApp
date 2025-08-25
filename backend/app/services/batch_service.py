from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.exception import AppwriteException
from fastapi import HTTPException, status
from app.core import config
from app.services import product_service

async def get_active_batches_for_product(product_id: str, db: Databases) -> list:
    """Fetches all batches for a specific product where quantity > 0."""
    await product_service.get_product_by_id(product_id, db)
    
    try:
        batch_list = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_BATCHES_ID,
            queries=[
                Query.equal("product_id", product_id),
                Query.greater_than("quantity_in_stock", 0) # <-- CORRECTED METHOD NAME
            ]
        )
        return batch_list['documents']
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

async def update_batch_sp(batch_id: str, new_sp: float, db: Databases) -> dict:
    """Updates the selling_price of a specific batch."""
    try:
        updated_batch = db.update_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_BATCHES_ID,
            document_id=batch_id,
            data={"selling_price": new_sp}
        )
        return updated_batch
    except AppwriteException as e:
        if e.code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Batch with ID '{batch_id}' not found.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))