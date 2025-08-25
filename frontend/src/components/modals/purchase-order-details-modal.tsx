"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// --- Type Definitions ---
interface Product {
  id: string;
  product_name: string;
  product_code: string;
}
interface PurchaseOrderItem {
  product_id: string;
  quantity: number;
  cost_price: number;
}
interface PurchaseOrder {
  id: string;
  supplier_id: string;
  purchase_date: string;
  total_amount_owed: number;
  payment_status: "Paid" | "Unpaid";
  items_received: PurchaseOrderItem[];
}
interface Supplier {
  id: string;
  name: string;
}

interface PurchaseOrderDetailsModalProps {
  order: PurchaseOrder | null;
  products: Product[];
  suppliers: Supplier[];
  isOpen: boolean;
  onClose: () => void;
}

export function PurchaseOrderDetailsModal({
  order,
  products,
  suppliers,
  isOpen,
  onClose,
}: PurchaseOrderDetailsModalProps) {
  if (!order) return null;

  const getProductDetails = (productId: string) => {
    return (
      products.find((p) => p.id === productId) || {
        product_name: "Unknown Product",
        product_code: "N/A",
      }
    );
  };

  const getSupplierName = (supplierId: string) => {
    return (
      suppliers.find((s) => s.id === supplierId)?.name || "Unknown Supplier"
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Purchase Order Details</DialogTitle>
          <DialogDescription>
            From {getSupplierName(order.supplier_id)} on{" "}
            {new Date(order.purchase_date).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-between items-center my-2">
          <p>
            Total Amount:{" "}
            <span className="font-bold">
              ₹{order.total_amount_owed.toFixed(2)}
            </span>
          </p>
          <Badge
            variant={
              order.payment_status === "Paid" ? "default" : "destructive"
            }
          >
            {order.payment_status}
          </Badge>
        </div>
        <div className="border rounded-lg max-h-[50vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead className="text-right">Cost Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items_received.map((item, index) => {
                const productDetails = getProductDetails(item.product_id);
                return (
                  <TableRow key={index}>
                    <TableCell>{productDetails.product_code}</TableCell>
                    <TableCell>{productDetails.product_name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      ₹{item.cost_price.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
