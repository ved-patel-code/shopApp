"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // For the description
import apiClient from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Define the type for the newly created cost object
interface OperatingCost {
  id: string;
  expense_date: string;
  expense_name: string;
  description: string | null;
  amount: number;
}

const formSchema = z.object({
  expense_name: z.string().min(2, "Expense name is required."),
  amount: z.coerce.number().min(0.01, "Amount must be greater than zero."),
  expense_date: z.date({ message: "Please select a date." }),
  description: z.string().optional(),
});

interface AddExpenseFormProps {
  onSuccess: (newCost: OperatingCost) => void;
}

export function AddExpenseForm({ onSuccess }: AddExpenseFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      expense_name: "",
      amount: 0,
      expense_date: new Date(),
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      // Format the date to "YYYY-MM-DD" for the backend
      const payload = {
        ...values,
        expense_date: format(values.expense_date, "yyyy-MM-dd"),
      };
      const response = await apiClient.post(
        "/reports/operating-costs",
        payload
      );
      const newCost = { ...response.data, id: response.data.$id };
      toast({ title: "Success", description: "Operating cost recorded." });
      onSuccess(newCost);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.detail || "Failed to record expense.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="expense_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expense Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Monthly Rent" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (₹)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Note: We will use a simple text input for date for now, but can replace with a Calendar picker */}
        <FormField
          control={form.control}
          name="expense_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expense Date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  value={format(field.value, "yyyy-MM-dd")}
                  onChange={(e) => field.onChange(new Date(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., Bill #ELEC123 for August"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : "Save Expense"}
        </Button>
      </form>
    </Form>
  );
}
