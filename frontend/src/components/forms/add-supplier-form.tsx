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

// Define the full Supplier type
interface Supplier {
  id: string;
  name: string;
  contact: string;
  address?: string;
  gstin_number?: string;
}

// --- CORRECTED FORM SCHEMA with gstin_number ---
const formSchema = z.object({
  name: z.string().min(2, "Supplier name is required."),
  contact: z.string().min(1, "Contact is required."),
  address: z.string().optional(),
  gstin_number: z.string().optional(),
});

// --- CORRECTED onSuccess prop type ---
interface AddSupplierFormProps {
  onSuccess: (newSupplier: Supplier) => void;
}

export function AddSupplierForm({ onSuccess }: AddSupplierFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", contact: "", address: "", gstin_number: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const response = await apiClient.post("/suppliers/", values);
      const newSupplier = { ...response.data, id: response.data.$id };
      toast({ title: "Success", description: "Supplier added successfully." });
      onSuccess(newSupplier); // <-- Now returns the full Supplier object
    } catch (err: any) {
      // --- ROBUST ERROR HANDLING ---
      let errorMessage = "An unexpected error occurred.";
      if (err.response) {
        // Handle specific status codes
        if (err.response.status === 409) {
          errorMessage =
            err.response.data.detail || "This supplier already exists.";
        } else if (err.response.status === 422) {
          // Potentially parse validation errors if needed
          errorMessage = "Please check your input. Some fields are invalid.";
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
              <FormLabel>Supplier Name</FormLabel>
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
              <FormLabel>Contact Info</FormLabel>
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
        {/* --- ADDED gstin_number FIELD --- */}
        <FormField
          control={form.control}
          name="gstin_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GSTIN (Optional)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : "Save Supplier"}
        </Button>
      </form>
    </Form>
  );
}
