"use client";

import { ThemeProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

export function Providers({ children }: ThemeProviderProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}