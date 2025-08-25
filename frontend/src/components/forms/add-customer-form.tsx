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
import apiClient from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

// Define the full Customer type
interface Customer {
  id: string;
  name: string;
  contact: string;
  address?: string | null;
  outstanding_balance: number;
}

const formSchema = z.object({
  name: z.string().min(2, "Customer name is required."),
  contact: z
    .string()
    .max(10, "Contact number cannot exceed 10 characters.")
    .min(1, "Contact is required."),
  address: z.string().optional(),
});

interface AddCustomerFormProps {
  onSuccess: (newCustomer: Customer) => void;
}

export function AddCustomerForm({ onSuccess }: AddCustomerFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", contact: "", address: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/customers/", values);
      // The backend returns the full customer object, just add the '$id' as 'id'
      const newCustomer = { ...response.data, id: response.data.$id };
      toast({ title: "Success", description: "Customer added successfully." });
      onSuccess(newCustomer);
    } catch (err: unknown) {
      let errorMessage = "An unexpected error occurred.";
      if (axios.isAxiosError(err)) {
        if (err.response) {
          // Explicitly check if err.response is defined
          errorMessage =
            err.response.data.detail || `Server error: ${err.response.status}`;
        } else if (err.request) {
          // If response is undefined but request was made (e.g., network error before response)
          errorMessage =
            "Could not connect to the server or no response received.";
        } else {
          // Fallback for Axios errors that don't have response or request (e.g., config error)
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contact"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Info (Unique)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address (Optional)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : "Save Customer"}
        </Button>
      </form>
    </Form>
  );
}
