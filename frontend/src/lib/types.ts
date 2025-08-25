export interface Supplier {
  id: string;
  name: string;
  contact: string;
  address?: string;
  gstin_number?: string;
}

export interface Product {
  id: string;
  product_name: string;
  product_code: string;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  purchase_date: string;
  total_amount_owed: number;
  payment_status: "Paid" | "Unpaid";
  items_received: string; // Raw JSON string
  supplier_name?: string; // We make this optional as it's added on the client-side
}

export interface PurchaseItem {
  product_id: string;
  product_name: string;
  quantity: number;
  cost_price: number;
}
