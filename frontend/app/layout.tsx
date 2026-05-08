import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "FlowPost - AI Social Publishing Command Center",
  description:
    "Generate social drafts, schedule posts, and monitor publishing workflows from one Vercel-hosted dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ClerkProvider lives inside ThemeProvider so it can pick up the resolved
  // light/dark theme and apply Clerk's matching `<SignIn>` / `<SignUp>`
  // appearance — without that, Clerk widgets show a white background even
  // in dark mode.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
