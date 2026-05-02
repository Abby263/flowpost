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
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
