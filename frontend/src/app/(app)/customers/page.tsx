"use client";

import { Button } from "@/components/ui/button";
import { AddToCreditForm } from "@/components/forms/add-to-credit-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { AddItemToTabModal } from "@/components/modals/add-item-to-tab-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import apiClient from "@/lib/api";
import { AddSupplierForm } from "@/components/forms/add-supplier-form"; // We will rename/replace this
import { AddCustomerForm } from "@/components/forms/add-customer-form"; // This is what we will create
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { SettlePaymentForm } from "@/components/forms/settle-payment-form";

interface Customer {
  id: string;
  name: string;
  contact: string;
  address?: string | null;
  outstanding_balance: number;
}

interface LedgerItem {
  id: string; // Transaction's own ID
  transaction_date: string; // ISO 8601 datetime string
  amount: number;
  items?: BillItemDetails[];
  sales_order_id: string | null;
}

interface BillItemDetails {
  product_name: string;
  quantity: number;
  actual_selling_price_per_unit: number;
}


export default function CustomerTabsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // --- NEW STATE for the ledger panel ---
  const [isAddToCreditModalOpen, setIsAddToCreditModalOpen] = useState(false);
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const { toast } = useToast();
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get("/customers/");
        const formattedCustomers: Customer[] = response.data.map((c: any) => ({
          ...c,
          id: c.$id,
        }));
        setCustomers(formattedCustomers);
        // Automatically select the first customer if the list is not empty
        if (formattedCustomers.length > 0) {
          setSelectedCustomer(formattedCustomers[0]);
        }
      } catch (error) {
        console.error("Failed to fetch customers:", error);
        // You can add a toast notification for the error here
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    // If no customer is selected, do nothing
    if (!selectedCustomer) {
      setLedgerItems([]); // Clear the ledger if no customer is selected
      return;
    }

    const fetchLedger = async () => {
      setIsLedgerLoading(true);
      try {
        const response = await apiClient.get(
          `/customers/${selectedCustomer.id}/ledger`
        );
        const formattedLedger: LedgerItem[] = response.data.map(
          (item: any) => ({
            ...item,
            id: item.$id, // Assuming the backend service maps this for us
          })
        );
        setLedgerItems(formattedLedger);
      } catch (error) {
        console.error("Failed to fetch customer ledger:", error);
        setLedgerItems([]); // Clear ledger on error
        // Optionally, show a toast notification for the error
      } finally {
        setIsLedgerLoading(false);
      }
    };

    fetchLedger();
  }, [selectedCustomer]);

  const handleCustomerAdded = (newCustomer: Customer) => {
    setCustomers((prev) => [newCustomer, ...prev]); // Add new customer to the top of the list
    setSelectedCustomer(newCustomer); // Automatically select the newly added customer
    setIsAddModalOpen(false);
  };

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreditAdded = (updatedCustomer: Customer) => {
    // Close the modal
    setIsAddToCreditModalOpen(false);
    // Update the customer in our main list with the new balance
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === updatedCustomer.id
          ? { ...c, outstanding_balance: updatedCustomer.outstanding_balance }
          : c
      )
    );
    // Update the currently selected customer's details
    setSelectedCustomer((prev) =>
      prev
        ? { ...prev, outstanding_balance: updatedCustomer.outstanding_balance }
        : null
    );
    // Re-fetch the ledger to show the new transaction
    // (This will happen automatically because setSelectedCustomer triggers the ledger useEffect)
    toast({ title: "Success!", description: "Customer's tab updated." }); // Use toast here if not in the form
  };

  const handleViewDetails = async (
    transactionId: string,
    salesOrderId: string | null
  ) => {
    if (!salesOrderId) return; // Can't fetch if there's no ID

    // Find the specific ledger item in our state
    const targetLedgerItem = ledgerItems.find(
      (item) => item.id === transactionId
    );

    // If details are already fetched, don't fetch again (can be toggled)
    if (targetLedgerItem && targetLedgerItem.items) {
      setLedgerItems((prev) =>
        prev.map((item) =>
          item.id === transactionId ? { ...item, items: undefined } : item
        )
      );
      return;
    }

    try {
      const response = await apiClient.get(`/reports/sales/${salesOrderId}`);

      const detailedItems = response.data.items_sold;

      // Update the state, adding the fetched items to the specific ledger entry
      setLedgerItems((prev) =>
        prev.map((item) =>
          item.id === transactionId ? { ...item, items: detailedItems } : item
        )
      );
    } catch (error) {
      console.error("Failed to fetch sale details:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load transaction details.",
      });
    }
  };

  const handlePaymentSettled = (updatedCustomer: Customer) => {
    setIsSettleModalOpen(false); // Close the modal

    // Update the customer in our main list with the new zero balance
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === updatedCustomer.id
          ? { ...c, outstanding_balance: updatedCustomer.outstanding_balance }
          : c
      )
    );

    // Update the currently selected customer's details
    setSelectedCustomer((prev) =>
      prev
        ? { ...prev, outstanding_balance: updatedCustomer.outstanding_balance }
        : null
    );

    // Clear the ledger since the balance is now zero
    setLedgerItems([]);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 h-full">
      {/* --- Left Panel: Customer List --- */}
      <div className="md:col-span-1 lg:col-span-1">
        <Card className="h-full flex flex-col">
          <CardHeader className="p-4">
            <CardTitle>Customers</CardTitle>
            <div className="relative mt-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-grow p-2 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))
                : filteredCustomers.map((customer) => (
                    <Button
                      key={customer.id}
                      variant={
                        customer.id === selectedCustomer?.id
                          ? "secondary"
                          : "ghost"
                      }
                      className="w-full justify-between h-auto py-2"
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <div className="text-left">
                        <div className="font-semibold">{customer.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {customer.outstanding_balance > 0
                            ? `Owes: ₹${customer.outstanding_balance.toFixed(
                                2
                              )}`
                            : "Settled"}
                        </div>
                      </div>
                    </Button>
                  ))}
            </div>
          </CardContent>
          <CardFooter className="p-4 border-t">
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <UserPlus className="mr-2 h-4 w-4" /> Add New Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a New Customer</DialogTitle>
                </DialogHeader>
                <AddCustomerForm onSuccess={handleCustomerAdded} />
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>
      </div>

      {/* --- Right Panel: Customer Ledger --- */}
      <div className="md:col-span-2 lg:col-span-3">
        {selectedCustomer ? (
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>{selectedCustomer.name}</CardTitle>
              <CardDescription>
                {selectedCustomer.contact}{" "}
                {selectedCustomer.address && `| ${selectedCustomer.address}`}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-grow space-y-4 overflow-y-auto p-4">
              {isLedgerLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : ledgerItems.length > 0 ? (
                ledgerItems.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-medium">
                        {new Date(entry.transaction_date).toLocaleString()}
                      </p>
                      {entry.sales_order_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleViewDetails(entry.id, entry.sales_order_id)
                          }
                        >
                          {entry.items ? "Hide Details" : "View Details"}
                        </Button>
                      )}
                    </div>

                    {/* --- CORRECTED AND ENHANCED ITEM DETAILS DISPLAY --- */}
                    {entry.items && (
                      <>
                        <div className="space-y-1 text-sm text-muted-foreground pl-2 border-l-2 ml-1 mt-2">
                          {entry.items.map((item, itemIndex) => (
                            <div
                              key={itemIndex}
                              className="flex justify-between pl-2"
                            >
                              {/* Left side: Name, Quantity, and Price per unit */}
                              <span>
                                {item.product_name}
                                <span className="text-xs">
                                  {" "}
                                  ( {item.quantity} x ₹
                                  {item.actual_selling_price_per_unit.toFixed(
                                    2
                                  )}{" "}
                                  )
                                </span>
                              </span>
                              {/* Right side: Calculated line total */}
                              <span className="font-medium text-foreground">
                                ₹
                                {(
                                  item.quantity *
                                  item.actual_selling_price_per_unit
                                ).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <Separator className="my-2" />
                      </>
                    )}

                    <div className="flex justify-between font-semibold">
                      <span>Transaction Amount</span>
                      <span>₹{entry.amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground pt-12">
                  This customer has no outstanding dues.
                </div>
              )}
            </CardContent>

            <CardFooter className="p-4 border-t flex-col sm:flex-row items-center gap-4">
              <div className="flex-grow text-center sm:text-left">
                <p className="text-sm text-muted-foreground">
                  Total Amount Due
                </p>
                <p className="text-2xl font-bold">
                  ₹{selectedCustomer.outstanding_balance.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsAddToCreditModalOpen(true)}
                >
                  Add Items to Tab
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setIsSettleModalOpen(true)}
                  // Disable the button if there's no outstanding balance
                  disabled={selectedCustomer.outstanding_balance <= 0}
                >
                  Settle Payment
                </Button>
              </div>
            </CardFooter>
          </Card>
        ) : (
          <div className="flex items-center justify-center h-full border rounded-lg bg-muted/20">
            <p className="text-muted-foreground">
              Select a customer to view their ledger.
            </p>
          </div>
        )}
      </div>

      {/* --- Add to Credit Modal --- */}
      {selectedCustomer && (
        <Dialog
          open={isAddToCreditModalOpen}
          onOpenChange={setIsAddToCreditModalOpen}
        >
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>
                Add Items to Tab for: {selectedCustomer.name}
              </DialogTitle>
            </DialogHeader>
            {/* Render the form only when the modal is open to ensure fresh state */}
            {isAddToCreditModalOpen && (
              <AddToCreditForm
                customerId={selectedCustomer.id}
                onSuccess={handleCreditAdded}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* --- NEW Settle Payment Modal --- */}
      {selectedCustomer && (
        <Dialog open={isSettleModalOpen} onOpenChange={setIsSettleModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Settle Dues for {selectedCustomer.name}</DialogTitle>
              <DialogDescription>
                Total amount to be paid: ₹
                {selectedCustomer.outstanding_balance.toFixed(2)}
              </DialogDescription>
            </DialogHeader>
            {/* Render form only when open to reset state on reopen */}
            {isSettleModalOpen && (
              <SettlePaymentForm
                customerId={selectedCustomer.id}
                onSuccess={handlePaymentSettled}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div> // This closes the main grid div
  );
}