"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import apiClient from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Trash2 } from "lucide-react";

// --- Type Definitions ---
interface Customer {
  id: string;
  name: string;
}
interface Product {
  id: string;
  product_name: string;
  product_code: string;
  current_total_stock: number;
  tax_percentage: number;
}
interface BillItem {
  line_id: string;
  product_id: string;
  product_name: string;
  batch_id: string;
  quantity: number;
  selling_price: number;
  available_stock_in_batch: number;
  current_total_stock: number;
  tax_percentage: number;
}

interface AddItemToTabModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedCustomer: any) => void;
}

export function AddItemToTabModal({
  customer,
  isOpen,
  onClose,
  onSuccess,
}: AddItemToTabModalProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);


  // Fetch all products when the modal opens
  useEffect(() => {
    if (isOpen) {
      apiClient.get("/inventory/products").then((res) => {
        setAllProducts(res.data.map((p: any) => ({ ...p, id: p.$id })));
      });
    }
  }, [isOpen]);

  // Client-side search logic
  const searchResults = useMemo(() => {
    if (searchQuery.trim() === "") return allProducts;
    const query = searchQuery.toLowerCase();
    return allProducts.filter(
      (p) =>
        p.product_name.toLowerCase().includes(query) ||
        p.product_code.toLowerCase().includes(query)
    );
  }, [searchQuery, allProducts]);

  const handleProductSelect = async (product: Product) => {
    // This logic is nearly identical to the main POS page's handler
    // We'll call simulate-sale to get the first batch details
    if (product.current_total_stock === 0) {
      toast({ variant: "destructive", title: "Out of Stock" });
      return;
    }
    try {
      const response = await apiClient.post("/pos/simulate-sale", {
        product_id: product.id,
        quantity: 1,
      });
      const lineItem = response.data.line_items[0];
      const newBillItem: BillItem = {
        line_id: lineItem.batch_id,
        product_id: product.id,
        product_name: product.product_name,
        batch_id: lineItem.batch_id,
        quantity: lineItem.quantity_to_sell,
        selling_price: lineItem.suggested_selling_price,
        available_stock_in_batch: lineItem.available_stock_in_batch,
        current_total_stock: product.current_total_stock,
        tax_percentage: product.tax_percentage,
      };
      setBillItems((prev) => [...prev, newBillItem]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not add item.",
      });
    }
    setPopoverOpen(false);
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  const handleRemoveLineItem = (line_id: string) => {
    setBillItems((prev) => prev.filter((item) => item.line_id !== line_id));
  };

  const handleAddToCredit = async () => {
    if (!customer || billItems.length === 0) return;
    setIsSubmitting(true);
    const payload = {
      items: billItems.map((item) => ({
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        actual_selling_price_per_unit: item.selling_price,
      })),
    };
    try {
      const response = await apiClient.post(
        `/customers/${customer.id}/add-credit`,
        payload
      );
      toast({
        title: "Success",
        description: `Items added to ${customer.name}'s tab.`,
      });
      onSuccess(response.data); // Pass the updated customer data back to the parent
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to Add Items",
        description: err.response?.data?.detail || "An error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset state when the modal is closed
  useEffect(() => {
    if (!isOpen) {
      setBillItems([]);
      setSearchQuery("");
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add Items to Tab for: {customer?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Left side: Product Search */}
          <div>
            <Label htmlFor="product-search-modal">Search Product</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between"
                >
                  Select a product...
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput
                    ref={searchInputRef}
                    placeholder="Search by name or code..." // <-- ADDED PLACEHOLDER
                    value={searchQuery}
                    onValueChange={setSearchQuery} // Use the built-in handler for CommandInput
                  />
                  <CommandList>
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup>
                      {searchResults.map((product) => (
                        <CommandItem
                          key={product.id}
                          onSelect={() => handleProductSelect(product)}
                        >
                          {product.product_name} ({product.product_code})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Right side: Bill */}
          <div className="md:row-span-2 border rounded-lg p-2 flex flex-col">
            <h3 className="text-lg font-semibold p-2">Current Items</h3>
            <div className="flex-grow overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billItems.map((item) => (
                    <TableRow key={item.line_id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>₹{item.selling_price.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLineItem(item.line_id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {billItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-24">
                        Add products to the list
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <Button
              onClick={handleAddToCredit}
              disabled={isSubmitting || billItems.length === 0}
              className="mt-4"
            >
              {isSubmitting ? "Adding..." : "Add to Credit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
