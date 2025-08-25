"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusCircle } from "lucide-react";
import apiClient from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/ui/date-range-picker"; // <-- Import our new component
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"; // Import Dialog components
import { AddExpenseForm } from "@/components/forms/add-expense-form";



// --- Type Definitions ---
interface FinancialSummary {
  total_profit: number;
  total_sales: number;
  total_tax_collected: number;
  current_inventory_value: number;
  vendor_dues: number;
}
interface OperatingCost {
  id: string;
  expense_date: string;
  expense_name: string;
  description: string | null;
  amount: number;
}

export default function FinancialsPage() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [operatingCosts, setOperatingCosts] = useState<OperatingCost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);

  // --- State for the Date Picker ---
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 29)), // Default to last 30 days
    to: new Date(),
  });

  const fetchData = useCallback(async () => {
    if (!dateRange?.from) return;

    const openedTime = new Date().toISOString();
    console.log(`[FRONT] Financials tab opened at: ${openedTime}`);

    setIsLoading(true);
    const startDate = format(dateRange.from, "yyyy-MM-dd");
    const endDate = dateRange.to
      ? format(dateRange.to, "yyyy-MM-dd")
      : startDate;

    try {
      const startReqTime = new Date().toISOString();
      console.log(`[FRONT] Sending requests at: ${startReqTime}`);
      const [summaryRes, costsRes] = await Promise.all([
        apiClient.get(
          `/reports/financial-summary?start_date=${startDate}&end_date=${endDate}`
        ),
        apiClient.get(
          `/reports/operating-costs?start_date=${startDate}&end_date=${endDate}`
        ),
      ]);
      const receiveTime = new Date().toISOString();
      console.log(`[FRONT] Responses received at: ${receiveTime}`);

      console.log("[FRONT] Financial summary response:", summaryRes.data);
      console.log("[FRONT] Operating costs response:", costsRes.data);


      setSummary(summaryRes.data);
      setOperatingCosts(costsRes.data.map((c: any) => ({ ...c, id: c.$id })));

      const stateUpdateTime = new Date().toISOString();
      console.log(`[FRONT] State updated at: ${stateUpdateTime}`);


    } catch (error) {
      console.error("Failed to fetch financial data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load financial data. Please try again.",
      });
    } finally {
      setIsLoading(false);

      const doneTime = new Date().toISOString();
      console.log(`[FRONT] Fetch completed at: ${doneTime}`);
    }
  }, [dateRange, toast]);



  // --- Data Fetching Logic ---
  useEffect(() => {
    console.log(`[FRONT] useEffect triggered at: ${new Date().toISOString()}`);
    fetchData();
  }, [fetchData]); 


  const handleExpenseAdded = (newCost: OperatingCost) => {
    setIsAddExpenseModalOpen(false); // Close the modal
    // Add the new cost to the top of the list for instant UI update
    setOperatingCosts((prevCosts) => [newCost, ...prevCosts]);
    fetchData(); 
  };
  

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Financials</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Showing data for:
          </span>
          {/* --- IMPLEMENTED DateRangePicker --- */}
          <DateRangePicker date={dateRange} onDateChange={setDateRange} />
        </div>
      </header>

      {/* --- Key Metrics Grid --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {isLoading || !summary ? (
          // Skeleton loaders for all cards
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-40 mt-2" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{summary.total_sales.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Gross revenue for the period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{summary.total_profit.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Profit for the period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Tax Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{summary.total_tax_collected.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tax for the period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Inventory Value (CP)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₹{summary.current_inventory_value.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Not date filtered
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Vendor Dues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">
                  ₹{summary.vendor_dues.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Not date filtered
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* --- Operating Costs Section --- */}
      <Card>
        {/* --- ADDED BACK the CardHeader with the Button --- */}
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Operating Costs</CardTitle>
            <p className="text-sm text-muted-foreground">
              Additional business expenses like rent, utilities, etc.
            </p>
          </div>
          <Dialog
            open={isAddExpenseModalOpen}
            onOpenChange={setIsAddExpenseModalOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record a New Operating Cost</DialogTitle>
              </DialogHeader>
              <AddExpenseForm onSuccess={handleExpenseAdded} />
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>{/* ... TableHeader is the same ... */}</TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : operatingCosts.length > 0 ? (
                  operatingCosts.map((cost) => (
                    <TableRow key={cost.id}>
                      <TableCell>
                        {format(new Date(cost.expense_date), "PPP")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {cost.expense_name}
                      </TableCell>
                      <TableCell>{cost.description || "N/A"}</TableCell>
                      <TableCell className="text-right">
                        ₹{cost.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No operating costs recorded for this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
