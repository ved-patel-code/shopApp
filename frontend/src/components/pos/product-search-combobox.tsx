"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api";
import { SearchResultProduct } from "@/types/pos";
import useDebounce from "@/hooks/use-debounce";
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
import { Button } from "../ui/button";
import { ChevronsUpDown } from "lucide-react";

interface ProductSearchComboboxProps {
  onProductSelect: (product: SearchResultProduct) => void;
}

interface BackendProductResponse {
  $id: string;
  product_name: string;
  product_code: string;
  current_total_stock: number;
  global_selling_price: number;
  tax_percentage: number;
}


export function ProductSearchCombobox({
  onProductSelect,
}: ProductSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      setIsLoading(true);
      apiClient
        .get(`/inventory/products/search?query=${debouncedQuery}`)
        .then((res) => {
          const formatted: SearchResultProduct[] = res.data.map(
            (p: BackendProductResponse) => ({
              id: p.$id, // Map $id from backend to 'id' in your frontend interface
              product_name: p.product_name,
              product_code: p.product_code,
              current_total_stock: p.current_total_stock,
              global_selling_price: p.global_selling_price,
              tax_percentage: p.tax_percentage,
            })
          );
          setResults(formatted);
        })
        .catch((err) => console.error("Search failed:", err))
        .finally(() => setIsLoading(false));
    } else {
      setResults([]);
    }
  }, [debouncedQuery]);

  const handleSelect = (product: SearchResultProduct) => {
    onProductSelect(product);
    setOpen(false);
    setQuery(""); // Clear the input after selection
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          Search product by name or code...
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder="Type name or code..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading && <div className="p-4 text-sm">Searching...</div>}
            <CommandEmpty>{!isLoading && "No results found."}</CommandEmpty>
            <CommandGroup>
              {results.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.product_name} ${product.product_code}`} // Make both searchable
                  onSelect={() => handleSelect(product)}
                >
                  {product.product_name} ({product.product_code})
                  <span className="ml-auto text-xs text-muted-foreground">
                    Stock: {product.current_total_stock}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
