import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "FlowPost - AI-Powered Social Media Automation",
  description:
    "Automate your social media presence with intelligent workflows. FlowPost uses AI to discover content, generate visuals, and post automatically to Instagram, Twitter, and LinkedIn.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ClerkProvider is required while Next prerenders protected client routes
  // that use Clerk hooks. Runtime access remains blocked by middleware until
  // real Clerk environment variables are configured.
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    "pk_test_Zmxvd3Bvc3QtZGV2LmNsZXJrLmFjY291bnRzLmRldiQ=";

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
