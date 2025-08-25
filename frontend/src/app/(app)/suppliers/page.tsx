"use client";
import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReceiveNewStockForm } from "@/components/forms/receive-new-stock-form";
import { AddSupplierForm } from "@/components/forms/add-supplier-form";
import { Button } from "@/components/ui/button";
import { SupplierHistory } from "@/components/procurement/supplier-history";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import apiClient from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiveStockFormSkeleton } from "@/components/skeletons/receive-stock-form-skeleton";

interface Supplier {
  id: string;
  name: string;
  contact: string;
  address?: string;
  gstin_number?: string;
}
interface Product {
  id: string;
  product_name: string;
  product_code: string;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Use useCallback to memoize fetch function
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch both suppliers and products in parallel for efficiency
      const [supplierRes, productRes] = await Promise.all([
        apiClient.get("/suppliers/"),
        apiClient.get("/inventory/products"),
      ]);

      const formattedSuppliers: Supplier[] = supplierRes.data.map(
        (s: {
          $id: string;
          name: string;
          contact: string;
          address?: string;
          gstin_number?: string;
        }) => ({
          ...s,
          id: s.$id,
        })
      );
       const formattedProducts: Product[] = productRes.data.map(
         (p: { $id: string; product_name: string; product_code: string }) => ({
           ...p,
           id: p.$id,
         })
       );

      setSuppliers(formattedSuppliers);
      setProducts(formattedProducts);
    } catch (error) {
      console.error("Failed to fetch data", error);
      // Here you can set an error state and display a toast
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSupplierAdded = (newSupplier: Supplier) => {
    // When a new supplier is added, we just update the suppliers list.
    // No need to re-fetch everything.
    setSuppliers((prev) => [...prev, newSupplier]);
    setIsAddModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suppliers & Procurement</h1>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button>Add New Supplier</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a New Supplier</DialogTitle>
            </DialogHeader>
            <AddSupplierForm onSuccess={handleSupplierAdded} />
          </DialogContent>
        </Dialog>
      </header>

      <Tabs defaultValue="receive-stock">
        <TabsList>
          <TabsTrigger value="receive-stock">Receive New Stock</TabsTrigger>
          <TabsTrigger value="supplier-list">Supplier List</TabsTrigger>
          <TabsTrigger value="payments">
            Supplier Payments & History
          </TabsTrigger>
        </TabsList>
        <TabsContent value="receive-stock">
          {isLoading ? (
            <ReceiveStockFormSkeleton /> // <-- Show your custom skeleton when loading
          ) : (
            <ReceiveNewStockForm suppliers={suppliers} products={products} /> // <-- Show the real form when done
          )}
        </TabsContent>
        <TabsContent value="supplier-list">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Address</TableHead>
                  {/* --- ADDED GSTIN COLUMN --- */}
                  <TableHead>GSTIN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                      </TableRow>
                    ))
                  : suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">
                          {supplier.name}
                        </TableCell>
                        <TableCell>{supplier.contact}</TableCell>
                        <TableCell>{supplier.address || "N/A"}</TableCell>
                        {/* --- ADDED GSTIN CELL --- */}
                        <TableCell>{supplier.gstin_number || "N/A"}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="payments">
          <SupplierHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
