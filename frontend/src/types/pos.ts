// Represents a single line item in our POS bill
export interface BillItem {
  lineId: string; // A unique ID for this line in the bill (e.g., batch_id or a UUID)
  productId: string;
  batchId: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  availableStock: number;
  isOutOfStock: boolean;
}

// Represents a product suggestion from our search API
export interface SearchResultProduct {
  id: string; // This is the Appwrite Document ID ($id)
  product_code: string;
  product_name: string;
  current_total_stock: number;
  global_selling_price: number;
}

