import json
from appwrite.services.databases import Databases
from appwrite.query import Query
from fastapi import HTTPException, status
from app.core import config
from typing import Optional
from appwrite.exception import AppwriteException
from appwrite.id import ID


async def get_financial_summary(start_date: str, end_date: str, db: Databases) -> dict:
    """
    Calculates key financial metrics for a given date range and overall values.
    Optimized to avoid N+1 queries for batch lookups.
    """
    try:
        # --- 1. Fetch all sales in the given range ---
        sales_in_range = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_SALES_ORDERS_ID,
            queries=[
                Query.greater_than_equal("sale_date_time", start_date),
                Query.less_than_equal("sale_date_time", end_date)
            ]
        )['documents']

        total_sales = sum(sale['grand_total'] for sale in sales_in_range)
        total_tax_collected = sum(sale['total_tax_amount'] for sale in sales_in_range)

        # --- 2. Collect all batch_ids from sales items ---
        batch_ids = set()
        sale_items_map = {}  # sale_id -> list of items
        for sale in sales_in_range:
            try:
                items_data = json.loads(sale['items_sold'])
                items_list = items_data.get("items", [])
                sale_items_map[sale['$id']] = items_list

                for item in items_list:
                    if "batch_id" in item:
                        batch_ids.add(item["batch_id"])
            except (json.JSONDecodeError, KeyError) as e:
                print(f"WARNING: Could not parse items_sold for sale '{sale['$id']}'. Error: {e}")
                sale_items_map[sale['$id']] = []

        # --- 3. Fetch all needed batches in one query ---
        batch_map = {}
        if batch_ids:
            batches = db.list_documents(
                database_id=config.APPWRITE_DATABASE_ID,
                collection_id=config.APPWRITE_COLLECTION_BATCHES_ID,
                queries=[Query.contains("$id", list(batch_ids))]
            )['documents']
            batch_map = {b["$id"]: b["cost_price"] for b in batches}

        # --- 4. Compute COGS ---
        total_cogs = 0.0
        for sale_id, items_list in sale_items_map.items():
            for item in items_list:
                if "batch_id" in item:
                    cost_price = batch_map.get(item["batch_id"], 0)
                    total_cogs += item.get("quantity", 0) * cost_price

        # --- 5. Operating Costs in date range ---
        costs_in_range = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_OPERATING_COSTS_ID,
            queries=[
                Query.greater_than_equal("expense_date", start_date),
                Query.less_than_equal("expense_date", end_date)
            ]
        )['documents']
        total_operating_costs = sum(cost['amount'] for cost in costs_in_range)

        # --- 6. Total Profit ---
        total_profit = total_sales - total_cogs - total_operating_costs

        # --- 7. Current Inventory Value (not date-filtered) ---
        all_active_batches = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_BATCHES_ID,
            queries=[Query.greater_than("quantity_in_stock", 0)]
        )['documents']
        current_inventory_value = sum(
            batch['quantity_in_stock'] * batch['cost_price'] for batch in all_active_batches
        )

        # --- 8. Vendor Dues (not date-filtered) ---
        unpaid_pos = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_PURCHASE_ORDERS_ID,
            queries=[Query.equal("payment_status", "Unpaid")]
        )['documents']
        vendor_dues = sum(po['remaining_balance'] for po in unpaid_pos)

        return {
            "total_profit": round(total_profit, 2),
            "total_sales": round(total_sales, 2),
            "total_tax_collected": round(total_tax_collected, 2),
            "current_inventory_value": round(current_inventory_value, 2),
            "vendor_dues": round(vendor_dues, 2)
        }

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


async def create_operating_cost(cost_data: dict, db: Databases) -> dict:
    """Creates a new operating cost document."""
    try:
        # We don't necessarily need uniqueness checks here, as expenses can have the same name.
        # Just create the document directly.
        new_cost_document = db.create_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_OPERATING_COSTS_ID,
            document_id=ID.unique(),
            data=cost_data
        )
        return new_cost_document
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


async def get_sales_history(db: Databases, limit: int, offset: int) -> list:
    """Fetches a paginated list of all sales orders, newest first."""
    try:
        sales_list = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_SALES_ORDERS_ID,
            queries=[
                Query.order_desc("sale_date_time"),
                Query.limit(limit),   # <-- Appwrite's limit query
                Query.offset(offset)  # <-- Appwrite's offset query
            ]
        )
        return {
            "total": sales_list['total'],
            "limit": limit,
            "offset": offset,
            "data": sales_list['documents']
        }
    except AppwriteException as e: # <-- ADD THIS BLOCK
        # Handle potential Appwrite errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    

async def get_sale_details_by_id(sale_id: str, db: Databases) -> dict:
    """Fetches a single sales order document by its Appwrite Document ID."""
    try:
        sale_document = db.get_document(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_SALES_ORDERS_ID,
            document_id=sale_id
        )
        return sale_document
    except AppwriteException as e:
        if e.code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sales order with ID '{sale_id}' not found."
            )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    

async def get_operating_costs(start_date: str, end_date: str, db: Databases) -> list:
    """Fetches all operating costs within a given date range."""
    try:
        costs_list = db.list_documents(
            database_id=config.APPWRITE_DATABASE_ID,
            collection_id=config.APPWRITE_COLLECTION_OPERATING_COSTS_ID,
            queries=[
                Query.greater_than_equal("expense_date", start_date),
                Query.less_than_equal("expense_date", end_date),
                Query.order_desc("expense_date") # Show newest first
            ]
        )
        return costs_list['documents']
    except AppwriteException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))