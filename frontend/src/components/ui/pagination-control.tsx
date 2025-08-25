"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControl({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationControlProps) {
  const [inputPage, setInputPage] = useState<string>(currentPage.toString());
  const { toast } = useToast();

  // When the currentPage prop changes from the parent, update our local input
  useEffect(() => {
    setInputPage(currentPage.toString());
  }, [currentPage]);

  const handleGoToPage = () => {
    let page = parseInt(inputPage, 10);
    if (isNaN(page) || page < 1) {
      page = 1;
    } else if (page > totalPages) {
      toast({
        variant: "destructive",
        title: "Invalid Page Number",
        description: `Page number cannot be greater than ${totalPages}.`,
      });
      page = totalPages;
    }
    setInputPage(page.toString());
    onPageChange(page);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPage(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleGoToPage();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only sm:ml-2">Prev</span>
      </Button>

      <div className="flex items-center gap-1.5 text-sm">
        <span>Page</span>
        <Input
          type="text"
          className="w-12 h-8 text-center"
          value={inputPage}
          onChange={handleInputChange}
          onBlur={handleGoToPage} // Go to page when input loses focus
          onKeyDown={handleInputKeyDown} // Go to page on Enter
        />
        <span>of {totalPages}</span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        <span className="sr-only sm:not-sr-only sm:mr-2">Next</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
