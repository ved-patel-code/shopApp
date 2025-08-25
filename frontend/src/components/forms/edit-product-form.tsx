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

// Define the validation schema (same as the create form)
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

// Define the shape of the product data we expect to receive
interface ProductData {
  id: string;
  product_name: string;
  product_code: string;
  tax_percentage: number;
  global_selling_price: number;
}

interface EditProductFormProps {
  product: ProductData;
  onSuccess: () => void;
}

export function EditProductForm({ product, onSuccess }: EditProductFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    // Pre-fill the form with the existing product data
    defaultValues: {
      product_name: product.product_name,
      product_code: product.product_code,
      tax_percentage: product.tax_percentage,
      global_selling_price: product.global_selling_price || 0,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setError(null);
    setIsLoading(true);
    try {
      // Call the PUT endpoint with the product's ID
      await apiClient.put(`/inventory/products/${product.id}`, values);
      onSuccess(); // Call the success callback to close modal and refresh
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
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
        {/* The FormFields are identical to the AddProductForm */}
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
          {isLoading ? "Saving Changes..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  );
}
