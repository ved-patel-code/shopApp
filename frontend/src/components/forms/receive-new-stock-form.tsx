"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
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
import { useEffect, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "../ui/card";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "../ui/calendar";

// --- Type Definitions ---
interface Supplier {
  id: string;
  name: string;
}
interface Product {
  id: string;
  product_name: string;
  product_code: string;
}

// --- Zod Validation Schema ---
const formSchema = z.object({
  supplier_id: z.string().min(1, "A supplier must be selected."),
  purchase_date: z
    .date()
    .min(new Date("1900-01-01"), { message: "A purchase date is required." }),
  total_amount_owed: z.coerce.number().min(0, "Total amount must be positive."),
  payment_status: z.enum(["Paid", "Unpaid"]),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1, "Please select a product."),
        product_name: z.string(), // To display in the form
        quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
        cost_price: z.coerce.number().min(0, "Cost price must be positive."),
      })
    )
    .min(1, "You must add at least one item."),
});

interface ReceiveNewStockFormProps {
  suppliers: Supplier[];
  products: Product[];
}

export function ReceiveNewStockForm({
  suppliers,
  products,
}: ReceiveNewStockFormProps) {

  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // --- State for controlling Popovers ---
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  // Use a Record to manage the open state of each dynamic product popover
  const [productPopoversOpen, setProductPopoversOpen] = useState<
    Record<number, boolean>
  >({});

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      payment_status: "Unpaid",
      items: [],
      supplier_id: "",
      purchase_date: new Date(), // Default to today
      total_amount_owed: 0,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  
  const onProductSelect = (index: number, product: Product) => {
    form.setValue(`items.${index}.product_id`, product.id);
    form.setValue(`items.${index}.product_name`, product.product_name);
    setProductPopoversOpen((prev) => ({ ...prev, [index]: false })); // Close this specific popover
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    const payload = {
      ...values,
      purchase_date: format(values.purchase_date, "yyyy-MM-dd"), // Format date for backend
      items: values.items.map(({ product_name, ...rest }) => rest),
    };

    try {
      await apiClient.post("/purchases/", payload);
      toast({
        title: "Success!",
        description: "Stock received and recorded successfully.",
      });
      form.reset(); // Resets all form fields to their default values
      replace([]); // Explicitly removes all items from the field array
    } catch (err: any) {
      // --- ROBUST ERROR HANDLING ---
      let errorMessage = "An unexpected error occurred.";
      if (err.response) {
        if (err.response.status === 422) {
          // Handle detailed validation errors from FastAPI
          const errors = err.response.data.detail;
          const specificError = errors[0]?.msg || "Validation error";
          const errorLocation = errors[0]?.loc?.join(" > ") || "input";
          errorMessage = `Error in '${errorLocation}': ${specificError}`;
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
        title: "Uh oh! Something went wrong.",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="p-4 md:p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* --- Main Details Section --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Supplier</FormLabel>
                  <Popover
                    open={supplierPopoverOpen}
                    onOpenChange={setSupplierPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? suppliers.find((s) => s.id === field.value)?.name
                            : "Select supplier"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Search supplier..." />
                        <CommandList>
                          <CommandEmpty>No supplier found.</CommandEmpty>
                          <CommandGroup>
                            {suppliers.map((supplier) => (
                              <CommandItem
                                value={supplier.name}
                                key={supplier.id}
                                onSelect={() => {
                                  field.onChange(supplier.id);
                                  setSupplierPopoverOpen(false); // Close on select
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    supplier.id === field.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                {supplier.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* --- NEW DATE PICKER FIELD --- */}
            <FormField
              control={form.control}
              name="purchase_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Purchase Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* --- Dynamic Items Section --- */}
          <div>
            <h3 className="text-lg font-medium mb-2">Items Received</h3>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-2 items-start border p-4 rounded-md relative"
                >
                  {/* Product Selection */}
                  <div className="col-span-12 md:col-span-5">
                    <FormField
                      control={form.control}
                      name={`items.${index}.product_id`}
                      render={() => (
                        <FormItem>
                          <FormLabel>Product</FormLabel>
                          <Popover
                            open={productPopoversOpen[index]}
                            onOpenChange={(isOpen) =>
                              setProductPopoversOpen((prev) => ({
                                ...prev,
                                [index]: isOpen,
                              }))
                            }
                          >
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between"
                                >
                                  {form.getValues(
                                    `items.${index}.product_name`
                                  ) || "Select product"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command>
                                <CommandInput placeholder="Search product..." />
                                <CommandList>
                                  <CommandEmpty>No product found.</CommandEmpty>
                                  <CommandGroup>
                                    {products.map((product) => (
                                      <CommandItem
                                        value={`${product.product_name} ${product.product_code}`}
                                        key={product.id}
                                        onSelect={() =>
                                          onProductSelect(index, product)
                                        }
                                      >
                                        {product.product_name} (
                                        {product.product_code})
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Quantity */}
                  <div className="col-span-6 md:col-span-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Cost Price */}
                  <div className="col-span-6 md:col-span-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.cost_price`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost Price</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Remove Button */}
                  <div className="col-span-12 md:col-span-1 flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() =>
                append({
                  product_id: "",
                  product_name: "",
                  quantity: 1,
                  cost_price: 0,
                })
              }
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
            {form.formState.errors.items && (
              <p className="text-sm font-medium text-destructive mt-2">
                {form.formState.errors.items.message}
              </p>
            )}
          </div>

          {/* --- Finalization Section --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
            <FormField
              control={form.control}
              name="total_amount_owed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Amount Owed</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_status"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Payment Status</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <RadioGroupItem value="Unpaid" />
                        </FormControl>
                        <FormLabel className="font-normal">Unpaid</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <RadioGroupItem value="Paid" />
                        </FormControl>
                        <FormLabel className="font-normal">Paid</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full md:w-auto"
            disabled={isLoading}
          >
            {isLoading ? "Recording..." : "Record Purchase"}
          </Button>
        </form>
      </Form>
    </Card>
  );
}
