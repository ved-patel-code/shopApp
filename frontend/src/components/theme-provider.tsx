"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
// Correctly import the props type from the main package entry point
import type { ThemeProviderProps } from "next-themes";


export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
