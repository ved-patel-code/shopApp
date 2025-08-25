"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface PaymentDetailsModalProps {
  transaction: {
    id: string;
    date: string;
    amount: number;
    // The backend would need to provide this. Let's assume it does for now.
    payment_method?: "Cash" | "UPI";
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentDetailsModal({
  transaction,
  isOpen,
  onClose,
}: PaymentDetailsModalProps) {
  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Details</DialogTitle>
          <DialogDescription>
            Transaction ID: {transaction.id}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <p>
            <strong>Date:</strong> {new Date(transaction.date).toLocaleString()}
          </p>
          <p>
            <strong>Amount Paid:</strong>{" "}
            <span className="font-bold text-green-600 dark:text-green-400">
              ₹{transaction.amount.toFixed(2)}
            </span>
          </p>
          <p>
            <strong>Payment Method:</strong>{" "}
            <span className="font-semibold">
              {transaction.payment_method || "N/A"}
            </span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
