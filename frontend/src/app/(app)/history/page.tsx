"use client";


import { PaymentDetailsModal } from "@/components/modals/payment-details-modal";
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
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { PaginationControl } from "@/components/ui/pagination-control";
import apiClient from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { BillDetailsModal } from "@/components/modals/bill-details-modal"
interface SaleHistoryItem {
  id: string;
  bill_number: string;
  sale_date_time: string;
  grand_total: number;
  payment_method: string;
}
interface PaginatedData<T> {
  total: number;
  limit: number;
  offset: number;
  data: T[];
}

interface SaleDetailItem {
  product_name: string;
  original_selling_price_per_unit: number;
  actual_selling_price_per_unit: number;
  quantity: number;
}
// NEW type for a sale that HAS an override
interface OverrideSale extends SaleHistoryItem {
  overridden_items: SaleDetailItem[];
}
interface CustomerInfo {
  id: string;
  name: string;
}
// NEW type for the combined timeline entry
interface TimelineEntry {
  id: string; // The transaction ID
  customer_id: string;
  date: string;
  type: "Credit_Sale" | "Payment";
  amount: number;
  items?: SaleDetailItem[]; // Optional item details for credit sales
}

interface TimelineEntry {
  // ...
  sales_order_id: string | null;
  payment_method?: "Cash" | "UPI"; // <-- Add payment_method here
}


export default function OrderHistoryPage() {
  const [posSalesCache, setPosSalesCache] = useState<
    Record<number, SaleHistoryItem[]>
  >({});
  const [posSalesTotalPages, setPosSalesTotalPages] = useState(1);
  const [posSalesCurrentPage, setPosSalesCurrentPage] = useState(1);
  const [isPosSalesLoading, setIsPosSalesLoading] = useState(true);
  const [overrideSalesCache, setOverrideSalesCache] = useState<
    Record<number, OverrideSale[]>
  >({});
  const [overridePagesChecked, setOverridePagesChecked] = useState<
    Record<number, boolean>
  >({});
  const [overrideTotalPages, setOverrideTotalPages] = useState(1);
  const [overrideCurrentPage, setOverrideCurrentPage] = useState(1);
  const [isOverrideLoading, setIsOverrideLoading] = useState(true);
  const [viewingSaleId, setViewingSaleId] = useState<string | null>(null);
  const [customerList, setCustomerList] = useState<CustomerInfo[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(
    null
  );
  const [timelineCache, setTimelineCache] = useState<
    Record<number, TimelineEntry[]>
  >({});
  const [timelineTotalPages, setTimelineTotalPages] = useState(1);
  const [timelineCurrentPage, setTimelineCurrentPage] = useState(1);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);


  const handleTimelinePageChange = (page: number) => {
    if (page >= 1 && page <= timelineTotalPages) {
      setTimelineCurrentPage(page);
    }
  };

  const handlePosPageChange = (page: number) => {
    if (page >= 1 && page <= posSalesTotalPages) {
      setPosSalesCurrentPage(page);
    }
  };

  const handleOverridePageChange = (page: number) => {
    if (page >= 1 && page <= overrideTotalPages) {
      setOverrideCurrentPage(page);
    }
  };

  // --- Fetch POS Sales ---
  const fetchPosSales = useCallback(async (page: number) => {
    // If already cached, skip
    if (posSalesCache[page]) return;

    setIsPosSalesLoading(true);
    try {
      const response = await apiClient.get(`/reports/sales?page=${page}`);
      const { total, limit, data } = response.data;

      const formattedData = data.map((item: any) => ({
        ...item,
        id: item.$id,
      }));

      setPosSalesCache((prev) => ({ ...prev, [page]: formattedData }));

      setPosSalesTotalPages((prevTotal) =>
        prevTotal === 1 && total > 0 ? Math.ceil(total / limit) : prevTotal
      );
    } catch (error) {
      console.error("Failed to fetch POS sales:", error);
    } finally {
      setIsPosSalesLoading(false);
    }
  }, []); // 👈 stable, no cache dep

  // --- Fetch Price Overrides ---
  const fetchAndFilterOverrides = useCallback(async (page: number) => {
    // If page already checked, skip
    if (overridePagesChecked[page]) return;

    setOverridePagesChecked((prev) => ({ ...prev, [page]: true }));
    setIsOverrideLoading(true);

    try {
      const summaryRes = await apiClient.get(`/reports/sales?page=${page}`);
      const { total, limit, data: salesSummaries } = summaryRes.data;

      setOverrideTotalPages((prevTotal) =>
        prevTotal === 1 && total > 0 ? Math.ceil(total / limit) : prevTotal
      );

      const validSummaries = salesSummaries.filter(
        (sale: SaleHistoryItem) => sale && sale.id
      );

      if (validSummaries.length === 0) {
        setOverrideSalesCache((prev) => ({ ...prev, [page]: [] }));
        return;
      }

      const detailResponses = await Promise.all(
        validSummaries.map((sale: SaleHistoryItem) =>
          apiClient.get(`/reports/sales/${sale.id}`)
        )
      );

      const salesWithOverrides: OverrideSale[] = [];
      detailResponses.forEach((detailRes) => {
        const fullSale = detailRes.data;
        if (!fullSale?.items_sold) return;

        try {
          const itemsSold: SaleDetailItem[] = fullSale.items_sold; 
          const overriddenItems = itemsSold.filter(
            (item) =>
              item.original_selling_price_per_unit != null &&
            item.actual_selling_price_per_unit != null &&
            item.original_selling_price_per_unit !==
            item.actual_selling_price_per_unit
        );

          if (overriddenItems.length > 0) {
            const summary = validSummaries.find(
              (s: SaleHistoryItem) => s.id === fullSale.$id
            );
            if (summary) {
              salesWithOverrides.push({
                ...summary,
                overridden_items: overriddenItems,
              });
            }
          }
        } catch (e) {
          console.error("Failed to parse items_sold:", fullSale.$id, e);
        }
      });

      setOverrideSalesCache((prev) => ({
        ...prev,
        [page]: salesWithOverrides,
      }));
    } catch (error) {
      console.error("Failed to fetch price overrides:", error);
    } finally {
      setIsOverrideLoading(false);
    }
  }, []);

  // --- Effects ---
  useEffect(() => {
    fetchPosSales(posSalesCurrentPage);
  }, [posSalesCurrentPage, fetchPosSales]);

  useEffect(() => {
    fetchAndFilterOverrides(overrideCurrentPage);
  }, [overrideCurrentPage, fetchAndFilterOverrides]);

  const fetchCustomerTimeline = useCallback(
    async (customerId: string, page: number) => {
      // If we have this page in cache for this customer, don't re-fetch
      if (timelineCache[page]) return;

      setIsTimelineLoading(true);
      try {
        // Step 1: Fetch the transaction history page
        const transRes = await apiClient.get(
          `/customers/${customerId}/history?page=${page}`
        );
        const { total, limit, data: transactions } = transRes.data;

        // Update total pages if not already set
        setTimelineTotalPages((prev) =>
          prev === 1 && total > 0 ? Math.ceil(total / limit) : prev
        );

        // Step 2: For credit sales, create promises to fetch their item details
        const detailPromises = transactions
          .filter(
            (t: any) => t.transaction_type === "Credit_Sale" && t.sales_order_id
          )
          .map((t: any) => apiClient.get(`/reports/sales/${t.sales_order_id}`));

        const detailResponses = await Promise.all(detailPromises);

        // Step 3: Map transaction data to our TimelineEntry format
        const timelineEntries: TimelineEntry[] = transactions.map((t: any) => {
          let items: SaleDetailItem[] | undefined = undefined;
          if (t.transaction_type === "Credit_Sale" && t.sales_order_id) {
            const detail = detailResponses.find(
              (res) => res.data.$id === t.sales_order_id
            );
            if (detail) {
              items = items = detail.data.items_sold;
            }
          }
          return {
            id: t.$id,
            date: t.transaction_date,
            type: t.transaction_type,
            amount: t.amount,
            items: items,
            customer_id: t.customer_id,
            payment_method: t.payment_method
          };
        });

        

        setTimelineCache((prev) => ({ ...prev, [page]: timelineEntries }));
      } catch (error) {
        console.error("Failed to fetch customer timeline:", error);
        // Add toast
      } finally {
        setIsTimelineLoading(false);
      }
    },
    [timelineCache]
  ); // Stable dependency

  const handleCustomerSelect = (customer: CustomerInfo) => {
    // --- THIS IS THE FIX ---
    // 1. Set the new customer
    setSelectedCustomer(customer);
    // 2. Reset all state related to the timeline
    setTimelineCache({});
    setTimelineCurrentPage(1);
    setTimelineTotalPages(1);
    setIsTimelineLoading(true); // Immediately show loading for the new customer
  };

  // Initial fetch for the customer list dropdown
  useEffect(() => {
    apiClient.get("/customers/").then((res) => {
      setCustomerList(res.data.map((c: any) => ({ id: c.$id, name: c.name })));
    });
  }, []);

  // Effect to fetch timeline when customer or page changes
 useEffect(() => {
   // Only run if a customer is selected.
   if (selectedCustomer) {
     // The fetch function will handle the caching logic internally.
     fetchCustomerTimeline(selectedCustomer.id, timelineCurrentPage);
   }
 }, [selectedCustomer, timelineCurrentPage, fetchCustomerTimeline]);


  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-bold">Order History</h1>
      </header>

      <Tabs defaultValue="pos-sales">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pos-sales" className="flex-1 sm:flex-none">
            POS Sales
          </TabsTrigger>
          <TabsTrigger value="customer-history" className="flex-1 sm:flex-none">
            Customer History
          </TabsTrigger>
          <TabsTrigger value="price-overrides" className="flex-1 sm:flex-none">
            Price Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pos-sales">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <CardTitle>Point of Sale Transactions</CardTitle>
                <CardDescription>
                  Click on a row to view the full bill details.
                </CardDescription>
              </div>
              <PaginationControl
                currentPage={posSalesCurrentPage}
                totalPages={posSalesTotalPages}
                onPageChange={handlePosPageChange}
              />
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill Number</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isPosSalesLoading && !posSalesCache[posSalesCurrentPage]
                      ? Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={`loading-${i}`}>
                            <TableCell colSpan={4}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                      : posSalesCache[posSalesCurrentPage]?.map((sale) => (
                          <TableRow
                            key={sale.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setViewingSaleId(sale.id)}
                          >
                            <TableCell className="font-mono">
                              {sale.bill_number}
                            </TableCell>
                            <TableCell>
                              {new Date(sale.sale_date_time).toLocaleString()}
                            </TableCell>
                            <TableCell>{sale.payment_method}</TableCell>
                            <TableCell className="text-right font-semibold">
                              ₹{sale.grand_total.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                    {!isPosSalesLoading &&
                      posSalesCache[posSalesCurrentPage]?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center h-24">
                            No sales found for this page.
                          </TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer-history">
          <Card>
            <CardHeader>
              <CardTitle>Customer Credit History</CardTitle>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                {/* --- Searchable Customer Dropdown --- */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full sm:w-[300px] justify-between"
                    >
                      {selectedCustomer
                        ? selectedCustomer.name
                        : "Select a customer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search customer..." />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customerList.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={customer.name}
                              onSelect={() => {
                                // Call our new handler instead of just setting state
                                handleCustomerSelect(customer);
                                // We can also close the popover manually here
                                // setCustomerPopoverOpen(false); // You would need state for this
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCustomer?.id === customer.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {customer.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* --- Pagination for the Timeline --- */}
                {selectedCustomer && (
                  <PaginationControl
                    currentPage={timelineCurrentPage}
                    totalPages={timelineTotalPages}
                    onPageChange={handleTimelinePageChange}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedCustomer ? (
                isTimelineLoading && !timelineCache[timelineCurrentPage] ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {timelineCache[timelineCurrentPage]?.length > 0 ? (
                      timelineCache[timelineCurrentPage].map((entry) => (
                        <div 
                          key={entry.id}
                          className={`pl-4 relative before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${
                            entry.type === "Payment"
                              ? "before:bg-green-500"
                              : "before:bg-blue-500"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <p className="font-semibold text-lg">
                              {entry.type === "Payment"
                                ? "Payment Received"
                                : "Items Purchased on Credit"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(entry.date).toLocaleString()}
                            </p>
                          </div>
                          <p
                            className={`font-bold text-xl ${
                              entry.type === "Payment"
                                ? "text-green-600 dark:text-green-400"
                                : ""
                            }`}
                          >
                            ₹{entry.amount.toFixed(2)}
                          </p>
                          {/* Conditionally render item details if they exist */}
                          {entry.items && entry.items.length > 0 && (
                            <div className="text-sm mt-2 space-y-1 border-t pt-2">
                              {entry.items.map((item, index) => (
                                <div
                                  key={index}
                                  className="flex justify-between"
                                >
                                  <span>
                                    {item.product_name} (x{item.quantity})
                                  </span>
                                  <span>
                                    ₹
                                    {(
                                      item.quantity *
                                      item.actual_selling_price_per_unit
                                    ).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No history found for this customer on this page.
                      </p>
                    )}
                  </div>
                )
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Please select a customer to view their timeline.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="price-overrides">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <CardTitle>Price Override Log</CardTitle>
                <CardDescription>
                  Showing sales where the price was manually changed.
                </CardDescription>
              </div>
              <PaginationControl
                currentPage={overrideCurrentPage}
                totalPages={overrideTotalPages}
                onPageChange={handleOverridePageChange}
              />
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill Number</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Original Price</TableHead>
                      <TableHead>Sold At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isOverrideLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={4}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : // We need to map through the pages and then the sales in each page
                    Object.values(overrideSalesCache).flat().length > 0 ? (
                      // Displaying from a flattened cache for simplicity
                      overrideSalesCache[overrideCurrentPage]?.map((sale) =>
                        // Since one sale can have multiple overrides, we map again
                        sale.overridden_items.map((item) => (
                          <TableRow
                            key={`${sale.id}-${item.product_name}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setViewingSaleId(sale.id)}
                          >
                            <TableCell className="font-mono">
                              {sale.bill_number}
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.product_name}
                            </TableCell>
                            <TableCell>
                              ₹{item.original_selling_price_per_unit.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-semibold text-orange-500">
                              ₹{item.actual_selling_price_per_unit.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">
                          No price overrides found for this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <BillDetailsModal
        isOpen={!!viewingSaleId}
        saleId={viewingSaleId}
        onClose={() => setViewingSaleId(null)}
      />
    </div>
  );
}