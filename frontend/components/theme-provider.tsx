"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * App-wide theme provider. Wraps next-themes with the project's defaults:
 *   attribute="class"        - toggles `.dark` on <html> so Tailwind variants kick in
 *   defaultTheme="system"    - follow OS preference until the user picks
 *   enableSystem             - listen for OS theme changes
 *   disableTransitionOnChange - avoid flash on toggle
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
