import Link from "next/link";
import {
  Home,
  Package,
  ShoppingCart,
  Users,
  LineChart,
  Truck,
} from "lucide-react";

// Define our navigation items
const navItems = [
  { href: "/pos", icon: ShoppingCart, label: "Point of Sale" },
  { href: "/inventory", icon: Package, label: "Inventory" },
  { href: "/customers", icon: Users, label: "Customer Tabs" },
  { href: "/history", icon: Home, label: "Order History" },
  { href: "/suppliers", icon: Truck, label: "Suppliers" },
  { href: "/financials", icon: LineChart, label: "Financials" },
];

export function Sidebar() {
  // This component is hidden on mobile (md:block)
  return (
    <aside className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Package className="h-6 w-6" />
            <span>MyShopApp</span>
          </Link>
        </div>
        <nav className="flex-1 px-2 text-sm font-medium lg:px-4">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
