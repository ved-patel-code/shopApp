"use an client";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import apiClient from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Define the updated Customer object we expect back from the API
interface Customer {
  id: string;
  name: string;
  contact: string;
  address?: string | null;
  outstanding_balance: number;
}

// Zod validation schema
const formSchema = z.object({
  payment_method: z.enum(["Cash", "UPI"], {
    error: "You need to select a payment method.",
  }),
});

interface SettlePaymentFormProps {
  customerId: string;
  onSuccess: (updatedCustomer: Customer) => void;
}

export function SettlePaymentForm({
  customerId,
  onSuccess,
}: SettlePaymentFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { payment_method: "Cash" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const response = await apiClient.post(
        `/customers/${customerId}/settle`,
        values
      );
      const updatedCustomer = { ...response.data, id: response.data.$id };
      toast({ title: "Success", description: "Payment settled successfully." });
      onSuccess(updatedCustomer);
    } catch (err: any) {
      let errorMessage =
        err.response?.data?.detail || "An unexpected error occurred.";
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="payment_method"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Select Payment Method</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="Cash" />
                    </FormControl>
                    <FormLabel className="font-normal">Cash</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="UPI" />
                    </FormControl>
                    <FormLabel className="font-normal">UPI</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Processing..." : "Confirm Payment"}
        </Button>
      </form>
    </Form>
  );
}
