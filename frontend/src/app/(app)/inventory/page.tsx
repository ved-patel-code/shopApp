"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAppSettings } from "@/lib/use-app-settings";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowDown, Edit } from "lucide-react";
import apiClient from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { AddProductForm } from "@/components/forms/add-product-form";
import { EditProductForm } from "@/components/forms/edit-product-form";
import { ViewBatchesModal } from "@/components/modals/view-batches-modal";

// Define a type for our product data for type safety
interface Product {
  id: string;
  product_code: string;
  product_name: string;
  current_total_stock: number;
  tax_percentage: number;
  global_selling_price: number;
}

// Define the possible views for the inventory table
type InventoryView = "all" | "low_stock" | "out_of_stock";

export default function InventoryPage() {
  const { settings } = useAppSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentView, setCurrentView] = useState<InventoryView>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingBatchesFor, setViewingBatchesFor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  
  const lowStockThreshold = settings.lowStockThreshold; 

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get("/inventory/products");
      const formattedProducts: Product[] = response.data.map((p: {
        $id: string;
        product_code: string;
        product_name: string;
        current_total_stock: number;
        tax_percentage: number;
        global_selling_price: number;
      }) => ({
        ...p,
        id: p.$id,
      }));
      setProducts(formattedProducts);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError("Failed to load product data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleProductAdded = () => {
    setIsAddModalOpen(false);
    fetchProducts();
  };

  const handleProductUpdated = () => {
    setEditingProduct(null);
    fetchProducts();
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter based on the selected view
    if (currentView === "low_stock") {
      filtered = products.filter(
        (p) =>
          p.current_total_stock <= lowStockThreshold &&
          p.current_total_stock > 0
      );
    } else if (currentView === "out_of_stock") {
      filtered = products.filter((p) => p.current_total_stock === 0);
    }

    // Further filter the result by the search query
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.product_name.toLowerCase().includes(query) ||
          p.product_code.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [products, searchQuery, currentView, lowStockThreshold]);

  const renderTableBody = () => {
    if (isLoading) {
      return Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-12" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="h-8 w-20 ml-auto" />
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
    if (filteredProducts.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="text-center">
            {searchQuery || currentView !== "all"
              ? "No products match your filters."
              : "No products found. Add one to get started."}
          </TableCell>
        </TableRow>
      );
    }
    return filteredProducts.map((product) => (
      <TableRow key={product.id}>
        <TableCell className="font-medium">{product.product_code}</TableCell>
        <TableCell>{product.product_name}</TableCell>
        <TableCell>
          <span
            className={
              product.current_total_stock === 0 ? "text-red-500 font-bold" : ""
            }
          >
            {product.current_total_stock}
          </span>
        </TableCell>
        <TableCell>{product.tax_percentage}%</TableCell>
        <TableCell className="text-right space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setEditingProduct(product)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setViewingBatchesFor({
                id: product.id,
                name: product.product_name,
              })
            }
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-bold">Inventory Management</h1>
        <div className="flex w-full sm:w-auto items-center gap-2">
          <Input
            placeholder="Search by name or code..."
            className="w-full sm:w-64"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button>Add New Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a New Product</DialogTitle>
              </DialogHeader>
              <AddProductForm onSuccess={handleProductAdded} />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="flex items-center">
        <ToggleGroup
          type="single"
          defaultValue="all"
          value={currentView}
          onValueChange={(value: InventoryView) => {
            if (value) setCurrentView(value);
          }}
        >
          <ToggleGroupItem
            value="all"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            All Items
          </ToggleGroupItem>
          <ToggleGroupItem
            value="low_stock"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            Low Stock
          </ToggleGroupItem>
          <ToggleGroupItem
            value="out_of_stock"
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            Out of Stock
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Code</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Total Quantity</TableHead>
              <TableHead>Tax %</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderTableBody()}</TableBody>
        </Table>
      </div>

      {/* --- MODALS --- */}
      <Dialog
        open={!!editingProduct}
        onOpenChange={(isOpen) => !isOpen && setEditingProduct(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit: {editingProduct?.product_name}</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <EditProductForm
              product={editingProduct}
              onSuccess={handleProductUpdated}
            />
          )}
        </DialogContent>
      </Dialog>

      <ViewBatchesModal
        isOpen={!!viewingBatchesFor}
        product={viewingBatchesFor}
        onClose={() => setViewingBatchesFor(null)}
      />
    </div>
  );
}
