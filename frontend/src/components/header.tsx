"use client"; // Add this because SheetTrigger uses client-side hooks
import { ThemeToggle } from "./theme-toggle";
import { useAppSettings } from "@/lib/use-app-settings";
import { useState } from "react"; 
import Link from "next/link";
import {
  Menu,
  Package,
  ShoppingCart,
  Users,
  LineChart,
  Truck,
  Home,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // <-- Import more dropdown components
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "./session-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast"; 

const navItems = [
  { href: "/pos", icon: ShoppingCart, label: "Point of Sale" },
  { href: "/inventory", icon: Package, label: "Inventory" },
  { href: "/customers", icon: Users, label: "Customer Tabs" },
  { href: "/history", icon: Home, label: "Order History" },
  { href: "/suppliers", icon: Truck, label: "Suppliers" },
  { href: "/financials", icon: LineChart, label: "Financials" },
];

export function Header() {
    const { logout } = useSession();
    const { settings, updateSettings } = useAppSettings(); // <-- Use the hook
    const { toast } = useToast();

    // --- Local state for the form inside the dropdown ---
    const [localThreshold, setLocalThreshold] = useState(
      settings.lowStockThreshold
    );
    const [localPrint, setLocalPrint] = useState(settings.defaultToPrintBill);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Sync local state if global settings change
      useEffect(() => {
        if (isSettingsOpen) {
          setLocalThreshold(settings.lowStockThreshold);
          setLocalPrint(settings.defaultToPrintBill);
        }
      }, [isSettingsOpen, settings]);

      const handleSaveChanges = () => {
        // When saving, call the global update function
        updateSettings({
          lowStockThreshold: Number(localThreshold),
          defaultToPrintBill: localPrint,
        });
        toast({
          title: "Success",
          description: "Settings saved successfully.",
        });
        setIsSettingsOpen(false); // Close the dropdown after saving
      };
  

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      {/* Mobile Hamburger Menu using shadcn's Sheet and Button */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <nav className="grid gap-2 text-lg font-medium">
            <Link
              href="#"
              className="flex items-center gap-2 text-lg font-semibold mb-4"
            >
              <Package className="h-6 w-6" />
              <span>MyShopApp</span>
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="w-full flex-1">
        {/* Future elements like a global search can go here */}
      </div>
      <div className="flex items-center gap-2">
        {" "}
        {/* <-- Wrapper div updated to gap-2 */}
        <ThemeToggle />
        {/* --- NEW SETTINGS DROPDOWN --- */}
        <DropdownMenu open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">Settings</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-4">
            <DropdownMenuLabel className="text-base font-semibold">
              Settings
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <div className="space-y-2 my-2">
              <Label htmlFor="low-stock-threshold" className="font-normal">
                Low Stock Threshold
              </Label>
              <Input
                id="low-stock-threshold"
                type="number"
                value={localThreshold}
                onChange={(e) => setLocalThreshold(Number(e.target.value))}
              />
            </div>

            <DropdownMenuSeparator />

            <div className="flex items-center space-x-2 my-3">
              <Checkbox
                id="auto-print-bill"
                checked={localPrint}
                onCheckedChange={(checked) => setLocalPrint(Boolean(checked))}
              />
              <Label
                htmlFor="auto-print-bill"
                className="font-normal leading-none cursor-pointer"
              >
                Default to Print Bill
              </Label>
            </div>

            <DropdownMenuSeparator />

            <Button className="w-full mt-2" onClick={handleSaveChanges}>
              Save Changes
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={logout} variant="outline">
          Logout
        </Button>
      </div>
    </header>
  );
}
