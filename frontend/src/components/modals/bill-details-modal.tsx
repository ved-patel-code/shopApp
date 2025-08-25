"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// Define the shape of the data we expect
interface BillItem {
  product_name: string;
  quantity: number;
  actual_selling_price_per_unit: number;
}
interface BillDetails {
  bill_number: string;
  sale_date_time: string;
  payment_method: string;
  grand_total: number;
  items_sold: BillItem[];
}

interface BillDetailsModalProps {
  saleId: string | null;
  isOpen: boolean;
  onClose: () => void;
}



export function BillDetailsModal({
  saleId,
  isOpen,
  onClose,
}: BillDetailsModalProps) {
  const [details, setDetails] = useState<BillDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && saleId) {
      const fetchDetails = async () => {
        setIsLoading(true);
        try {
          const response = await apiClient.get(`/reports/sales/${saleId}`);
          const fullSale = response.data;
          // --- THIS IS THE FIX ---
          const items = fullSale.items_sold; // The data is already an object/array

          setDetails({
            ...fullSale,
            items_sold: items,
            bill_number: fullSale.$id,
          });
        } catch (error) {
          console.error("Failed to fetch bill details:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchDetails();
    }
  }, [isOpen, saleId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bill Details</DialogTitle>
          {details && (
            <DialogDescription>
              Bill No: {details.bill_number}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="py-4">
          {isLoading || !details ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="border rounded-lg p-2">
                <Skeleton className="h-24 w-full" />
              </div>
              <Skeleton className="h-6 w-1/3 ml-auto" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm">
                <p>
                  <strong>Date:</strong>{" "}
                  {new Date(details.sale_date_time).toLocaleString()}
                </p>
                <p>
                  <strong>Payment Method:</strong> {details.payment_method}
                </p>
              </div>
              <div className="border rounded-lg max-h-[40vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.items_sold.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {item.product_name}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{item.actual_selling_price_per_unit.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹
                          {(
                            item.quantity * item.actual_selling_price_per_unit
                          ).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Separator />
              <div className="flex justify-end text-lg font-bold">
                <p>Grand Total: ₹{details.grand_total.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
