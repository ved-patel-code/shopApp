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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import axios from "axios";

// ✅ Validation schema
const formSchema = z.object({
  product_name: z
    .string()
    .min(2, "Product name must be at least 2 characters."),
  product_code: z.string().min(1, "Item code is required."),
  tax_percentage: z.coerce.number().min(0, "Tax must be a positive number."),
  global_selling_price: z.coerce
    .number()
    .min(0, "Price must be a positive number."),
});

// ✅ Single source of truth type
type ProductFormValues = z.infer<typeof formSchema>;

interface AddProductFormProps {
  onSuccess: () => void;
}

export function AddProductForm({ onSuccess }: AddProductFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      product_name: "",
      product_code: "",
      tax_percentage: 0,
      global_selling_price: 0,
    },
  });

  async function onSubmit(values: ProductFormValues) {
    setError(null);
    setIsLoading(true);
    try {
      await apiClient.post("/inventory/products", values);
      onSuccess();
      // Snippet 1: Fix for Error 59:19
    } catch (err: unknown) {
      // Changed 'any' to 'unknown'
      if (axios.isAxiosError(err)) {
        // Use type guard for AxiosError
        if (err.response && err.response.data && err.response.data.detail) {
          setError(err.response.data.detail);
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
      } else if (err instanceof Error) {
        // Handle generic JavaScript errors
        setError(err.message);
      } else {
        // Fallback for any other unknown error type
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="product_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Blue T-Shirt" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="product_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item Code</FormLabel>
              <FormControl>
                <Input placeholder="e.g., TSB-001" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tax_percentage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tax %</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="global_selling_price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Global Selling Price</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : "Save Product"}
        </Button>
      </form>
    </Form>
  );
}
