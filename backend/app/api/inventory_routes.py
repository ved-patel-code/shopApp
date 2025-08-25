from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.services import product_service , batch_service 
from app.models import product_models , batch_models 
from ..dependencies import get_db,get_current_user

router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"],
    dependencies=[Depends(get_current_user)]
)

@router.post("/products", response_model=product_models.ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_new_product(product: product_models.ProductCreate, db = Depends(get_db)):
    new_product_data = product.model_dump()
    new_product_data['current_total_stock'] = 0
    return await product_service.create_product(new_product_data, db)

@router.get("/products", response_model=List[product_models.ProductResponse])
async def get_all_products_route(db = Depends(get_db)):
    return await product_service.get_all_products(db)

# --- ADD THE SEARCH ENDPOINT HERE ---
# It must come BEFORE the /products/{product_id} endpoint

@router.get("/products/search", response_model=List[product_models.ProductResponse])
async def search_products_route(query: str, db = Depends(get_db)):
    """
    Searches for products by product_name.
    Requires a full-text index on the 'product_name' attribute in Appwrite.
    """
    return await product_service.search_products(query, db)

# --- The GET endpoint with a path parameter comes AFTER search ---

@router.get("/products/{product_id}", response_model=product_models.ProductResponse)
async def get_product_by_id_route(product_id: str, db = Depends(get_db)):
    """
    Fetches a single product by its unique Appwrite Document ID.
    """
    return await product_service.get_product_by_id(product_id, db)

@router.put("/products/{product_id}", response_model=product_models.ProductResponse)
async def update_product_route(
    product_id: str, 
    product: product_models.ProductUpdate, 
    db = Depends(get_db)
):
    update_data = product.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")
    
    return await product_service.update_product_by_id(product_id, update_data, db)


@router.get("/products/{product_id}/batches", response_model=List[batch_models.BatchResponse])
async def get_product_batches_route(product_id: str, db = Depends(get_db)):
    """
    Retrieves a list of all active batches for a specific product.
    """
    return await batch_service.get_active_batches_for_product(product_id, db)

@router.put("/batches/{batch_id}", response_model=batch_models.BatchResponse)
async def update_batch_sp_route(
    batch_id: str, 
    sp_data: batch_models.BatchUpdateSP, 
    db = Depends(get_db)
):
    """
    Updates the selling price of a single inventory batch.
    """
    return await batch_service.update_batch_sp(batch_id, sp_data.selling_price, db)