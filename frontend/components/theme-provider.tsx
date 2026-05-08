"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

/**
 * App-wide theme provider. Wraps next-themes with the project's defaults:
 *   attribute="class"        - toggles `.dark` on <html> so Tailwind variants kick in
 *   defaultTheme="system"    - follow OS preference until the user picks
 *   enableSystem             - listen for OS theme changes
 *   disableTransitionOnChange - avoid flash on toggle
 *
 * Also re-exports a Clerk wrapper that switches Clerk's `appearance` to its
 * dark theme when our resolved theme is dark — otherwise Clerk's `<SignIn>`
 * and `<SignUp>` widgets keep a white background and dark-on-dark buttons
 * that disappear in our dark mode.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ClerkThemed>{children}</ClerkThemed>
    </NextThemesProvider>
  );
}

function ClerkThemed({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    "pk_test_Zmxvd3Bvc3QtZGV2LmNsZXJrLmFjY291bnRzLmRldiQ=";
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        baseTheme: resolvedTheme === "dark" ? dark : undefined,
      }}
    >
      {children}
    </ClerkProvider>
  );
}
