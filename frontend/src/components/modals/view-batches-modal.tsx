"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { EditBatchSPForm } from "../forms/edit-batch-sp-form";

// Define a type for our batch data
interface Batch {
  id: string;
  quantity_in_stock: number;
  cost_price: number;
  selling_price: number;
  date_received: string;
}

// Define the props this component will accept
interface ViewBatchesModalProps {
  product: {
    id: string;
    name: string;
  } | null; // Can be a product object or null
  isOpen: boolean;
  onClose: () => void;
}

export function ViewBatchesModal({
  product,
  isOpen,
  onClose,
}: ViewBatchesModalProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State to manage which batch is currently being edited
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  // Memoize the fetch function to prevent re-creation on every render
  const fetchBatches = useCallback(async () => {
    if (!product) return; // Guard clause if no product is selected

    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(
        `/inventory/products/${product.id}/batches`
      );
       const formattedBatches: Batch[] = response.data.map(
         (b: {
           $id: string;
           quantity_in_stock: number;
           cost_price: number;
           selling_price: number;
           date_received: string;
         }) => ({
           ...b,
           id: b.$id,
         })
       );
      setBatches(formattedBatches);
    } catch (err) {
      console.error("Failed to fetch batches:", err);
      setError("Could not load batch information.");
    } finally {
      setIsLoading(false);
    }
  }, [product]); // Dependency: re-create this function only if the 'product' prop changes

  // Effect to trigger fetching batches when the modal is opened or the product changes
  useEffect(() => {
    if (isOpen && product) {
      fetchBatches();
    }
  }, [isOpen, product, fetchBatches]);

  // Callback function for when the SP update is successful
  const handleSpUpdateSuccess = () => {
    setEditingBatch(null); // Close the small edit modal
    fetchBatches(); // Refresh the list of batches to show the new price
  };

  const renderContent = () => {
    if (isLoading) {
      // Show skeleton loaders while data is fetching
      return Array.from({ length: 3 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-8 w-10" />
          </TableCell>
        </TableRow>
      ));
    }

    if (error) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center text-red-500">
            {error}
          </TableCell>
        </TableRow>
      );
    }

    if (batches.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center">
            No active inventory batches for this product.
          </TableCell>
        </TableRow>
      );
    }

    return batches.map((batch) => (
      <TableRow key={batch.id}>
        <TableCell>
          {new Date(batch.date_received).toLocaleDateString()}
        </TableCell>
        <TableCell>{batch.quantity_in_stock}</TableCell>
        <TableCell>{batch.cost_price.toFixed(2)}</TableCell>
        <TableCell>{batch.selling_price.toFixed(2)}</TableCell>
        <TableCell className="text-right">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setEditingBatch(batch)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <>
      {/* Main Dialog for Viewing Batches */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Active Batches for: {product?.name}</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date Received</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Cost Price</TableHead>
                  <TableHead>Selling Price</TableHead>
                  <TableHead className="text-right">Edit SP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{renderContent()}</TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* NEW DIALOG for Editing a Single Batch's SP */}
      <Dialog
        open={!!editingBatch}
        onOpenChange={(isOpen) => !isOpen && setEditingBatch(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Selling Price</DialogTitle>
          </DialogHeader>
          {editingBatch && (
            <EditBatchSPForm
              batchId={editingBatch.id}
              currentSp={editingBatch.selling_price}
              onSuccess={handleSpUpdateSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
