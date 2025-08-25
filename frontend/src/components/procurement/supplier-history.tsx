"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge"; // A nice UI for status
import { Skeleton } from "../ui/skeleton";

// --- Type Definitions (based on your API docs) ---
interface Supplier {
  $id: string;
  id?: string;
  name: string;
}
interface PurchaseItem {
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  cost_price: number;
}
interface PurchaseOrder {
  id: string;
  supplier_id: string;
  purchase_date: string;
  total_amount_owed: number;
  payment_status: "Paid" | "Unpaid";
  items_received: PurchaseItem[];
}

export function SupplierHistory() {
  const { toast } = useToast();
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "Paid" | "Unpaid">(
    "all"
  );
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(
    null
  );
  const [allPurchaseOrders, setAllPurchaseOrders] = useState<PurchaseOrder[]>(
    []
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]); // Start with an empty array
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);

  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setIsLoadingSuppliers(true);
        const response = await apiClient.get("/suppliers");
        const normalized = response.data.map((s: any) => ({
          ...s,
          id: s.$id, // map $id → id
        }));
        setSuppliers(normalized);
      } catch (error) {
        console.error("Failed to fetch suppliers", error);
        toast({
          variant: "destructive",
          title: "Error",
          description:
            "Could not load suppliers. Please try refreshing the page.",
        });
      } finally {
        setIsLoadingSuppliers(false);
      }
    };

    fetchSuppliers();
  }, [toast]);

  useEffect(() => {
    const fetchPurchaseOrders = async () => {
      if (!selectedSupplier || !(selectedSupplier.id || selectedSupplier.$id)) {
        setAllPurchaseOrders([]);
        return;
      }

      setIsLoadingOrders(true);
      try {
        const response = await apiClient.get(
          `/purchases/?supplier_id=${
            selectedSupplier.id || selectedSupplier.$id
          }`
        );

        console.log("Raw purchases response:", response.data);

        // response.data is already an array
        const formattedOrders = response.data.map((order: any) => ({
          ...order,
          id: order.$id, // normalize for React keys + table
        }));

        setAllPurchaseOrders(formattedOrders);
      } catch (error) {
        console.error("Failed to fetch purchase orders", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load purchase history for this supplier.",
        });
      } finally {
        setIsLoadingOrders(false);
      }
    };

    fetchPurchaseOrders();
  }, [selectedSupplier, toast]);

  const filteredOrders = useMemo(() => {
    return allPurchaseOrders
      .filter(
        (order) =>
          !selectedSupplier || order.supplier_id === selectedSupplier.id
      )
      .filter(
        (order) =>
          statusFilter === "all" || order.payment_status === statusFilter
      )
      .sort(
        (a, b) =>
          new Date(b.purchase_date).getTime() -
          new Date(a.purchase_date).getTime()
      ); // Newest first
  }, [allPurchaseOrders, statusFilter]);

  const handleMarkAsPaid = async (order: PurchaseOrder) => {
    // Guard clause: do nothing if already paid. This is good practice.
    if (order.payment_status === "Paid") return;

    try {
      // --- LIVE API CALL ---
      // Call the backend endpoint to mark the purchase as paid.
      // We don't need to send a body, just the ID in the URL.
      const response = await apiClient.put(`/purchases/${order.id}/pay`);

      // The backend returns the updated purchase order. We'll use this
      // as the single source of truth to update our state.
      const updatedOrder = { ...response.data, id: response.data.$id };

      // --- UPDATE UI STATE ---
      // Update the state immutably by replacing the old order with the updated one.
      setAllPurchaseOrders((prevOrders) =>
        prevOrders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );

      // --- SUCCESS FEEDBACK ---
      toast({
        title: "Success",
        description: "Purchase order has been marked as paid.",
      });
    } catch (err: any) {
      // --- ROBUST ERROR HANDLING ---
      let errorMessage = "An unexpected error occurred.";
      if (err.response) {
        if (err.response.status === 400) {
          // This is the specific error for an already-paid order
          errorMessage =
            err.response.data.detail || "This order is already paid.";
        } else if (err.response.status === 404) {
          errorMessage =
            err.response.data.detail || "This order could not be found.";
        } else {
          errorMessage =
            err.response.data.detail || `Server error: ${err.response.status}`;
        }
      } else if (err.request) {
        errorMessage =
          "Could not connect to the server. Please check your network.";
      }
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: errorMessage,
      });
    }
  };
  const renderTableBody = () => {
    if (isLoadingOrders) {
      return Array.from({ length: 3 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell colSpan={4}>
            <Skeleton className="h-8 w-full" />
          </TableCell>
        </TableRow>
      ));
    }

    if (!selectedSupplier) {
      return (
        <TableRow>
          <TableCell colSpan={4} className="text-center text-muted-foreground">
            Please select a supplier to view their history.
          </TableCell>
        </TableRow>
      );
    }

    if (filteredOrders.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={4} className="text-center text-muted-foreground">
            No purchase orders found for this supplier.
          </TableCell>
        </TableRow>
      );
    }

    return filteredOrders.map((order) => (
      <TableRow
        key={order.id} // use normalized id
        onClick={() => setSelectedOrder(order)}
        className="cursor-pointer"
      >
        <TableCell>
          {new Date(order.purchase_date).toLocaleDateString()}
        </TableCell>
        <TableCell>₹{order.total_amount_owed.toFixed(2)}</TableCell>
        <TableCell>
          <Badge
            variant={
              order.payment_status === "Paid" ? "default" : "destructive"
            }
          >
            {order.payment_status}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          {order.payment_status !== "Paid" && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleMarkAsPaid(order);
              }}
            >
              Mark as Paid
            </Button>
          )}
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* --- Filters Section --- */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <Popover
          open={supplierPopoverOpen}
          onOpenChange={setSupplierPopoverOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={supplierPopoverOpen}
              className="w-full sm:w-[250px] justify-between"
              disabled={isLoadingSuppliers}
            >
              {isLoadingSuppliers
                ? "Loading..."
                : selectedSupplier
                ? suppliers.find((s) => s.id === selectedSupplier.id)?.name // <-- More robust way to find name
                : "Select a supplier..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Search supplier..." />
              <CommandList>
                <CommandEmpty>
                  {isLoadingSuppliers ? "Loading..." : "No supplier found."}
                </CommandEmpty>
                <CommandGroup>
                  {suppliers.map((supplier) => (
                    <CommandItem
                        key={supplier.id}
                        value={supplier.id} // safer: use supplier.id instead of name
                        onSelect={() => {
                        // directly set supplier object — no fragile lookup by name
                        setSelectedSupplier(supplier);
                        setSupplierPopoverOpen(false);
                        }}
                    >
                        {/* Only render the check icon if this supplier is the selected one */}
                        {selectedSupplier?.id === supplier.id && (
                        <Check className="mr-2 h-4 w-4 opacity-100" />
                        )}
                        {selectedSupplier?.id !== supplier.id && (
                        <span className="mr-2 h-4 w-4" /> 
                        )}
                        {supplier.name}
                    </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            className={cn(
              "flex-1 sm:flex-initial",
              statusFilter === "all" &&
                "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            All
          </Button>
          <Button
            variant={statusFilter === "Paid" ? "default" : "outline"}
            onClick={() => setStatusFilter("Paid")}
            className={cn(
              "flex-1 sm:flex-initial",
              statusFilter === "Paid" &&
                "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Paid
          </Button>
          <Button
            variant={statusFilter === "Unpaid" ? "default" : "outline"}
            onClick={() => setStatusFilter("Unpaid")}
            className={cn(
              "flex-1 sm:flex-initial",
              statusFilter === "Unpaid" &&
                "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Unpaid
          </Button>
        </div>
      </div>

      {/* --- History Table (wrapped in a div for horizontal scrolling on small screens) --- */}
      <div className="border rounded-lg w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Adding min-width to prevent columns from collapsing too much */}
              <TableHead className="min-w-[100px]">Date</TableHead>
              <TableHead className="min-w-[120px]">Total Amount</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
              <TableHead className="text-right min-w-[120px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* The only change is here: we now call the render function */}
            {renderTableBody()}
          </TableBody>
        </Table>
      </div>

      {/* --- RESPONSIVE Order Details Modal --- */}
      <Dialog
        open={!!selectedOrder}
        onOpenChange={(isOpen) => !isOpen && setSelectedOrder(null)}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            {/* --- REVISED MODAL HEADER --- */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pt-2">
              <div className="text-lg font-semibold">
                Total Amount: ₹{selectedOrder?.total_amount_owed.toFixed(2)}
              </div>
              <Badge
                variant={
                  selectedOrder?.payment_status === "Paid"
                    ? "default"
                    : "destructive"
                }
              >
                {selectedOrder?.payment_status}
              </Badge>
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* --- The scrollable table for items --- */}
            <div className="border rounded-lg max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder?.items_received.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell className="font-medium">
                        {item.product_name}
                      </TableCell>
                      <TableCell>{item.product_code}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>₹{item.cost_price.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
