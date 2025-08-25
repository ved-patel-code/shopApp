from appwrite.services.databases import Databases
from appwrite.query import Query
from appwrite.id import ID
from appwrite.exception import AppwriteException
from fastapi import HTTPException, status
from app.core import config

async def create_supplier(supplier_data: dict, db: Databases) -> dict:
    """Creates a new supplier document in the suppliers collection."""
    try:
        # Check for uniqueness of supplier name
        name_check = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_SUPPLIERS_ID,
            queries=[Query.equal("name", supplier_data["name"])]
        )
        if name_check['total'] > 0:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A supplier with this name already exists.")
            
        # If the check passes, create the document
        new_supplier = db.create_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_SUPPLIERS_ID,
            document_id=ID.unique(),
            data=supplier_data
        )
        return new_supplier
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

async def get_all_suppliers(db: Databases) -> list:
    """Fetches all documents from the suppliers collection."""
    try:
        supplier_list = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_SUPPLIERS_ID
        )
        return supplier_list['documents']
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    

async def get_supplier_by_id(supplier_id: str, db: Databases) -> dict:
    """Fetches a single supplier document by its Appwrite Document ID."""
    try:
        supplier = db.get_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_SUPPLIERS_ID,
            document_id=supplier_id
        )
        return supplier
    except AppwriteException as e:
        if e.code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Supplier with ID '{supplier_id}' not found."
            )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))