from fastapi import APIRouter, Depends, Query
from app.services import report_service
from app.models import report_models
from ..dependencies import get_db,get_current_user
from datetime import date , datetime, time# We'll use this for default dates
from app.core.utils import get_current_ist_time
from typing import List
from app.models.common_models import PaginatedResponse

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
    dependencies=[Depends(get_current_user)]
    
)

@router.get("/financial-summary", response_model=report_models.FinancialSummaryResponse)
async def get_financial_summary_route(
    start_date: date = Query(default_factory=date.today),
    end_date: date = Query(default_factory=date.today),
    db = Depends(get_db)
):
    

    """
    Retrieves a financial summary for a given date range.
    Dates should be in YYYY-MM-DD format.
    Defaults to today's date if not provided.
    """
    # --- THIS IS THE FIX ---
    # Combine the start date with the beginning of the day (00:00:00)
    start_datetime = datetime.combine(start_date, time.min)
    # Combine the end date with the end of the day (23:59:59.999999)
    end_datetime = datetime.combine(end_date, time.max)
    
    # Convert the full datetime objects to ISO 8601 strings for the Appwrite query
    start_date_str = start_datetime.isoformat()
    end_date_str = end_datetime.isoformat()

    result = await report_service.get_financial_summary(start_date_str, end_date_str, db)

    return result

@router.post("/operating-costs", response_model=report_models.OperatingCostResponse, status_code=201)
async def create_operating_cost_route(
    cost_data: report_models.OperatingCostCreate,
    db = Depends(get_db)
):
    """
    Records a new operating cost/expense.
    """
    # The Pydantic model expects a datetime object for expense_date.
    # We will ensure the time is set to our standard IST.
    # Note: If the frontend sends a full ISO string, Pydantic handles parsing.
    # This is a good place to ensure consistency if needed, but for now, we trust the model.
    
    # Convert model to dictionary to send to the service
    cost_payload = cost_data.model_dump()
    expense_datetime_naive = datetime.combine(cost_data.expense_date, time.min)
    
    # It's good practice to ensure the date is in the right format for the DB
    cost_payload['expense_date'] = cost_data.expense_date.isoformat()

    result = await report_service.create_operating_cost(cost_payload, db)

    return result

@router.get("/operating-costs", response_model=List[report_models.OperatingCostResponse])
async def get_operating_costs_route(
    start_date: date = Query(default_factory=date.today),
    end_date: date = Query(default_factory=date.today),
    db = Depends(get_db)
):
    
    """
    Retrieves a list of operating costs for a given date range.
    """

    # Reuse the same logic from financial-summary to create a full day range
    start_datetime = datetime.combine(start_date, time.min)
    end_datetime = datetime.combine(end_date, time.max)
    
    start_date_str = start_datetime.isoformat()
    end_date_str = end_datetime.isoformat()
    
    result = await report_service.get_operating_costs(start_date_str, end_date_str, db)

    return result





@router.get("/sales", response_model=PaginatedResponse[report_models.SaleHistoryItem])
async def get_sales_history_route(
    db = Depends(get_db),
    # Add a query parameter for the page number, default to 1
    page: int = 1 
):
    """
    Retrieves a paginated summary of all past sales, sorted by most recent first.
    Each page contains up to 100 records.
    """
    # Page 1 should have an offset of 0, Page 2 an offset of 100, etc.
    limit = 100
    offset = (page - 1) * limit
    return await report_service.get_sales_history(db, limit=limit, offset=offset)

@router.get("/sales/{sale_id}", response_model=report_models.SaleDetailResponse)
async def get_sale_details_route(sale_id: str, db = Depends(get_db)):
    """
    Retrieves the full details of a single sales order.
    """
    return await report_service.get_sale_details_by_id(sale_id, db)



