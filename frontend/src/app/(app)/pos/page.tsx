"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Trash2 } from "lucide-react";
import apiClient from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/lib/use-app-settings"; 
// --- Type Definitions for our data ---
interface ProductSearchResult {
  id: string;
  product_name: string;
  product_code: string;
  current_total_stock: number;
  global_selling_price: number;
  tax_percentage: number; // Add selling price for adding to bill
}
interface BillItem {
  line_id: string;
  product_id: string;
  product_name: string;
  batch_id: string;
  quantity: number;
  cost_price: number;
  selling_price: number; // This will now be the editable price
  available_stock_in_batch: number;
  current_total_stock: number;
  tax_percentage: number;
}

export default function PosPage() {
  // --- STATE MANAGEMENT ---
  // State for the bill items
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const { toast } = useToast();
  // State for the search functionality
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [updatingLineId, setUpdatingLineId] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false); // <-- NEW state for loading
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useAppSettings(); // <-- Use the hook

  // --- Initialize printBill state from our global settings ---
  const [printBill, setPrintBill] = useState(false); 
  useEffect(() => {
    setPrintBill(settings.defaultToPrintBill);
  }, [settings.defaultToPrintBill]);

   const billTotals = useMemo(() => {
     let subtotal = 0;
     let totalTax = 0;

     for (const item of billItems) {
       // Calculate the total for this line item before tax
       const lineItemTotal = item.quantity * item.selling_price;
       subtotal += lineItemTotal;

       // Calculate the tax for this specific line item and add it to the total tax
       if (item.tax_percentage > 0) {
         const lineItemTax = lineItemTotal * (item.tax_percentage / 100);
         totalTax += lineItemTax;
       }
     }

     const grandTotal = subtotal + totalTax;

     return { subtotal, tax: totalTax, grandTotal };
   }, [billItems]);

    useEffect(() => {
      setPrintBill(settings.defaultToPrintBill);
    }, [settings.defaultToPrintBill]);




  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    const searchTimer = setTimeout(async () => {
      try {
        const response = await apiClient.get(
          `/inventory/products/search?query=${searchQuery}`
        );
        setSearchResults(response.data.map((p: any) => ({ ...p, id: p.$id })));
      } catch (error) {
        console.error("Failed to search products:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200); // 300ms delay

    return () => clearTimeout(searchTimer);
  }, [searchQuery]);

  // --- Debounced Quantity Change Logic ---
  useEffect(() => {
    if (!updatingLineId) return;

    const itemToUpdate = billItems.find(
      (item) => item.line_id === updatingLineId
    );
    if (!itemToUpdate) return;

    const debounceTimer = setTimeout(() => {
      runFifoSimulation(itemToUpdate);
      setUpdatingLineId(null);
    }, 750); // 750ms delay

    return () => clearTimeout(debounceTimer);
  }, [billItems, updatingLineId]); // Note: We will define runFifoSimulation with useCallback so it's stable

  // --- Handler Functions ---

  const handleProductSelect = async (product: ProductSearchResult) => {
    const isAlreadyInBill = billItems.some(
      (item) => item.product_id === product.id
    );
    if (isAlreadyInBill) {
      toast({
        title: "Item Already in Bill",
        description: "Please increase the quantity on the existing line item.",
      });
      return; // Stop execution
    }

    if (product.current_total_stock === 0) {
      toast({
        variant: "destructive",
        title: "Out of Stock",
        description: `${product.product_name} is currently out of stock.`,
      });
      return;
    }

    try {
      const payload = { product_id: String(product.id), quantity: 1 };
      const response = await apiClient.post("/pos/simulate-sale", payload);

      if (!response.data.line_items || response.data.line_items.length === 0) {
        throw new Error("Simulation failed to return a valid batch.");
      }

      const lineItem = response.data.line_items[0];
      const newBillItem: BillItem = {
        line_id: lineItem.batch_id,
        product_id: product.id,
        product_name: product.product_name,
        batch_id: lineItem.batch_id,
        quantity: lineItem.quantity_to_sell,
        cost_price: lineItem.cost_price,
        selling_price: lineItem.suggested_selling_price,
        available_stock_in_batch: lineItem.available_stock_in_batch,
        current_total_stock: product.current_total_stock, // Store this for later checks
        tax_percentage: product.tax_percentage,
      };

      setBillItems((prevItems) => [...prevItems, newBillItem]);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err.response?.data?.detail || "Failed to add product to bill.",
      });
    } finally {
      setSearchQuery("");
      setSearchResults([]);
      setIsPopoverOpen(false);
      searchInputRef.current?.focus();
    }
  };

  const handleLocalQuantityChange = (line_id: string, newQuantity: number) => {
    setBillItems((prevItems) =>
      prevItems.map((item) =>
        item.line_id === line_id ? { ...item, quantity: newQuantity } : item
      )
    );
    setUpdatingLineId(line_id);
  };

  const handleRemoveItem = (product_id: string) => {
    setBillItems((prevItems) =>
      prevItems.filter((item) => item.product_id !== product_id)
    );
  };

  const handlePriceChange = (line_id: string, newPrice: number) => {
    // This is a simple local update, no backend call needed until checkout.
    setBillItems((prevItems) =>
      prevItems.map((item) =>
        item.line_id === line_id ? { ...item, selling_price: newPrice } : item
      )
    );
  };

  // This function now removes a specific line item, not all items of a product.
  const handleRemoveLineItem = (line_id_to_remove: string) => {
    setBillItems((prevItems) =>
      prevItems.filter((item) => item.line_id !== line_id_to_remove)
    );
  };


  const handleCheckout = async (paymentMethod: "Cash" | "UPI") => {
    if (billItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Checkout",
        description: "The bill is empty.",
      });
      return;
    }

    setIsCheckingOut(true);

    // --- Construct the payload from our billItems state ---
    const payload = {
      payment_method: paymentMethod,
      print_bill: printBill,
      items: billItems.map((item) => ({
        product_id: item.product_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        actual_selling_price_per_unit: item.selling_price,
      })),
    };

    try {
      const response = await apiClient.post("/pos/checkout", payload);
      toast({
        title: "Checkout Successful!",
        description: `Sale ID: ${response.data.sale_id}`,
      });

      // --- Reset the entire POS screen for the next customer ---
      setBillItems([]);
      setSearchQuery("");
      setPrintBill(settings.defaultToPrintBill);
    } catch (err: any) {
      let errorMessage = "An unexpected error occurred during checkout.";
      if (err.response) {
        // Handle specific errors from the backend
        if (err.response.status === 409) {
          errorMessage =
            "Stock levels changed. Please review the bill and try again.";
        } else {
          errorMessage =
            err.response.data.detail || `Server error: ${err.response.status}`;
        }
      } else if (err.request) {
        errorMessage = "Could not connect to the server.";
      }
      toast({
        variant: "destructive",
        title: "Checkout Failed",
        description: errorMessage,
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const runFifoSimulation = useCallback(
    async (itemToUpdate: BillItem, isRevertAttempt: boolean = false) => {
      const totalDesiredQuantity = billItems
        .filter((item) => item.product_id === itemToUpdate.product_id)
        .reduce((sum, item) => sum + item.quantity, 0);

      // If the quantity is 0 or less after user input, remove all lines for that product.
      if (totalDesiredQuantity <= 0) {
        handleRemoveItem(itemToUpdate.product_id);
        return;
      }

      // Optimization: if the update is simple (one line item and within its batch's stock),
      // we don't need to call the API.
      const lineItemsForProduct = billItems.filter(
        (i) => i.product_id === itemToUpdate.product_id
      );
      if (
        lineItemsForProduct.length === 1 &&
        totalDesiredQuantity <= lineItemsForProduct[0].available_stock_in_batch
      ) {
        return; // The local state is already correct.
      }

      try {
        const response = await apiClient.post("/pos/simulate-sale", {
          product_id: itemToUpdate.product_id,
          // On a revert attempt, we use the known max stock. Otherwise, use the user's desired quantity.
          quantity: isRevertAttempt
            ? itemToUpdate.current_total_stock
            : totalDesiredQuantity,
        });

        if (response.data.is_sufficient_stock) {
          const newBillItemsFromSim = response.data.line_items.map(
            (simItem: any): BillItem => ({
              line_id: simItem.batch_id,
              product_id: itemToUpdate.product_id,
              product_name: itemToUpdate.product_name,
              batch_id: simItem.batch_id,
              quantity: simItem.quantity_to_sell,
              cost_price: simItem.cost_price,
              // Preserve the user's custom price if there's only one resulting line item.
              selling_price:
                response.data.line_items.length === 1
                  ? itemToUpdate.selling_price
                  : simItem.suggested_selling_price,
              available_stock_in_batch: simItem.available_stock_in_batch,
              current_total_stock: itemToUpdate.current_total_stock,
              tax_percentage: itemToUpdate.tax_percentage,
            })
          );

          // Atomically replace the old lines with the new ones from the simulation.
          setBillItems((prevItems) => [
            ...prevItems.filter(
              (item) => item.product_id !== itemToUpdate.product_id
            ),
            ...newBillItemsFromSim,
          ]);
        } else {
          // This block now specifically handles the "insufficient stock" response from the initial attempt.
          toast({
            variant: "destructive",
            title: "Insufficient Stock",
            description: `Only ${itemToUpdate.current_total_stock} units available. Setting quantity to max.`,
          });

          // If total stock is greater than 0, trigger the revert by calling this function again.
          if (itemToUpdate.current_total_stock > 0) {
            // We pass a flag to indicate this is a programmatic revert attempt.
            // The quantity will be capped at the max available inside this recursive call.
            await runFifoSimulation(itemToUpdate, true);
          } else {
            // If total stock is 0, just remove the item.
            handleRemoveItem(itemToUpdate.product_id);
          }
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description:
            error.response?.data?.detail || "Failed to update quantity.",
        });
        // On API error, it's safest to just log and let the user manually correct.
        console.error("API error during simulation:", error);
      }
    },
    [billItems, toast, handleRemoveItem]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* --- Left Side: Bill / Cart --- */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Bill</CardTitle>
            {/* --- Main Product Search Bar --- */}
            <div className="mt-4">
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Label htmlFor="product-search" className="sr-only">
                      Search Products
                    </Label>
                    <Input
                      ref={searchInputRef}
                      id="product-search"
                      placeholder="Scan or search by product name or code..."
                      value={searchQuery}
                      // --- KEY CHANGES HERE ---
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        // Manually open the popover as soon as the user starts typing
                        if (!isPopoverOpen) setIsPopoverOpen(true);
                      }}
                      // Open the popover when the user clicks into an empty input
                      onClick={() => {
                        if (!isPopoverOpen) setIsPopoverOpen(true);
                      }}
                      autoComplete="off"
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                  // Prevent the popover from stealing focus when it opens
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <Command>
                    <CommandList>
                      {isSearching && (
                        <div className="p-4 text-sm">Searching...</div>
                      )}
                      {!isSearching &&
                        searchResults.length === 0 &&
                        searchQuery.length > 1 && (
                          <div className="p-4 text-sm">
                            No products found for "{searchQuery}".
                          </div>
                        )}
                      {searchResults.length > 0 && (
                        <CommandGroup>
                          {searchResults.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={`${product.product_name} ${product.product_code}`}
                              onSelect={() => handleProductSelect(product)}
                              className="flex justify-between"
                            >
                              <span>
                                {product.product_name} ({product.product_code})
                              </span>
                              <span
                                className={
                                  product.current_total_stock === 0
                                    ? "text-red-500 font-bold"
                                    : ""
                                }
                              >
                                Stock: {product.current_total_stock}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60%]">Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billItems.map((item) => (
                    <TableRow key={item.line_id}>
                      <TableCell className="font-medium">
                        {item.product_name}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            // Allow empty input for typing, but treat as 0
                            const newQty =
                              e.target.value === ""
                                ? 0
                                : parseInt(e.target.value, 10);
                            if (!isNaN(newQty) && newQty >= 0) {
                              handleLocalQuantityChange(item.line_id, newQty);
                            }
                          }}
                          className="w-16 h-8"
                        />
                      </TableCell>
                      <TableCell>
                        {/* --- CONNECTED PRICE INPUT --- */}
                        <Input
                          type="number"
                          step="0.01" // Allows decimal input
                          value={item.selling_price}
                          onChange={(e) => {
                            const newPrice =
                              e.target.value === ""
                                ? 0
                                : parseFloat(e.target.value);
                            if (!isNaN(newPrice) && newPrice >= 0) {
                              handlePriceChange(item.line_id, newPrice);
                            }
                          }}
                          className="w-24 h-8"
                        />
                      </TableCell>
                      <TableCell className="font-semibold">
                        {/* --- DYNAMIC TOTAL CALCULATION --- */}₹
                        {(item.quantity * item.selling_price).toFixed(2)}
                      </TableCell>
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
                      <TableCell colSpan={5} className="text-center h-24">
                        Scan or search for a product to begin
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Right Side: Summary & Payment --- */}
      {/* --- Right Side: Summary & Payment --- */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              {/* --- CONNECTED TO DYNAMIC DATA --- */}
              <span className="font-medium">
                ₹{billTotals.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tax</span>
              {/* --- CONNECTED TO DYNAMIC DATA --- */}
              <span className="font-medium">₹{billTotals.tax.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Grand Total</span>
              {/* --- CONNECTED TO DYNAMIC DATA --- */}
              <span>₹{billTotals.grandTotal.toFixed(2)}</span>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="flex items-center space-x-2">
              {/* --- CONNECTED CHECKBOX --- */}
              <Checkbox
                id="print-bill"
                checked={printBill}
                onCheckedChange={(checked) => setPrintBill(Boolean(checked))}
              />
              <Label
                htmlFor="print-bill"
                className="text-sm font-medium leading-none"
              >
                Print Bill
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full">
              {/* --- CONNECTED BUTTONS --- */}
              <Button
                size="lg"
                onClick={() => handleCheckout("Cash")}
                disabled={isCheckingOut || billItems.length === 0}
              >
                {isCheckingOut ? "Processing..." : "Pay with Cash"}
              </Button>
              <Button
                size="lg"
                onClick={() => handleCheckout("UPI")}
                disabled={isCheckingOut || billItems.length === 0}
              >
                {isCheckingOut ? "Processing..." : "Pay with UPI"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}