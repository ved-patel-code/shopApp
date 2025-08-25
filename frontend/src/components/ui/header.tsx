"use client"; // Add this because SheetTrigger uses client-side hooks

import Link from 'next/link';
import { Menu, Package, ShoppingCart, Users, LineChart, Truck, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
    { href: '/pos', icon: ShoppingCart, label: 'Point of Sale' },
    { href: '/inventory', icon: Package, label: 'Inventory' },
    { href: '/customers', icon: Users, label: 'Customer Tabs' },
    { href: '/history', icon: Home, label: 'Order History' },
    { href: '/suppliers', icon: Truck, label: 'Suppliers' },
    { href: '/financials', icon: LineChart, label: 'Financials' },
  ];

export function Header() {
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
            <Link href="#" className="flex items-center gap-2 text-lg font-semibold mb-4">
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
      {/* Future elements like a User Profile dropdown can go here */}
    </header>
  );
}