from fastapi import APIRouter, Depends, status
from typing import List
from app.services import customer_service
from app.models import customer_models
from ..dependencies import get_db,get_current_user
from app.models.pos_models import CheckoutRequest
from app.models import customer_models
from app.dependencies import get_db
from app.models.common_models import PaginatedResponse

router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
    dependencies=[Depends(get_current_user)]
)

@router.post("/", response_model=customer_models.CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_new_customer(customer: customer_models.CustomerCreate, db = Depends(get_db)):
    """
    Creates a new customer.
    """
    new_customer = await customer_service.create_customer(customer.model_dump(), db)
    return new_customer

@router.get("/", response_model=List[customer_models.CustomerResponse]) # <-- ADD THIS ENDPOINT
async def get_all_customers_route(db = Depends(get_db)):
    """
    Retrieves a list of all customers, sorted by name.
    """
    return await customer_service.get_all_customers(db)

@router.get("/{customer_id}/ledger", response_model=List[customer_models.CustomerTransactionResponse])
async def get_customer_ledger_route(customer_id: str, db = Depends(get_db)):
    """
    Retrieves the list of unpaid credit transactions for a specific customer.
    """
    return await customer_service.get_customer_ledger(customer_id, db)

@router.post("/{customer_id}/add-credit", response_model=customer_models.CustomerResponse)
async def add_credit_to_customer_route(
    customer_id: str,
    credit_data: customer_models.AddCreditRequest, # <-- USE THE NEW MODEL
    db = Depends(get_db)
):
    """
    Adds items to a customer's credit tab.
    """
    # Our service function still expects a CheckoutRequest object.
    # We will construct one here in the route, providing the fixed 'payment_method'.
    full_checkout_data = {
        "payment_method": "customer_tab", # Hardcoded because it's always a credit sale
        "print_bill": False, # Defaults to false for credit sales
        "items": credit_data.items
    }
    
    # We can create an instance of the CheckoutRequest model from our dictionary
    from app.models.pos_models import CheckoutRequest
    checkout_model_for_service = CheckoutRequest(**full_checkout_data)

    updated_customer = await customer_service.add_items_to_customer_credit(
        customer_id=customer_id, 
        credit_data=checkout_model_for_service, # Pass the fully constructed model
        db=db
    )
    return updated_customer


@router.post("/{customer_id}/settle", response_model=customer_models.CustomerResponse) # <-- ADD THIS
async def settle_dues_route(
    customer_id: str,
    settle_data: customer_models.SettlePaymentRequest,
    db = Depends(get_db)
):
    """
    Settles a customer's outstanding dues.
    """
    updated_customer = await customer_service.settle_customer_dues(
        customer_id=customer_id,
        payment_method=settle_data.payment_method,
        db=db
    )
    return updated_customer


@router.get("/{customer_id}/history", response_model=PaginatedResponse[customer_models.CustomerTransactionResponse])
async def get_customer_history_route(
    customer_id: str,
    db = Depends(get_db),
    page: int = 1
):
    """
    Retrieves a paginated list of ALL transactions (Credit Sales and Payments)
    for a specific customer, sorted by most recent first.
    """
    limit = 100
    offset = (page - 1) * limit
    return await customer_service.get_customer_transaction_history(
        customer_id=customer_id, db=db, limit=limit, offset=offset
    )
