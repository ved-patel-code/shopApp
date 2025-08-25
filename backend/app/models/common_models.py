from pydantic import BaseModel, Field
from typing import List, TypeVar, Generic

# This allows us to create a generic model that can contain any type of data
DataType = TypeVar('DataType')

class PaginatedResponse(BaseModel, Generic[DataType]):
    total: int # The total number of items available across all pages
    limit: int # The number of items requested per page
    offset: int # The starting position of the items in this response
    data: List[DataType] # The actual list of data (e.g., list of sales, customers)