"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Sparkles, LayoutDashboard, Coins } from "lucide-react";

export function Navbar() {
  const { isSignedIn } = useUser();
  const pathname = usePathname();

  // Check if we're on the landing page (not in dashboard)
  const isLandingPage = pathname === "/" || pathname === "";
  const isPricingPage = pathname === "/pricing";

  return (
    <nav className="border-b bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-50">
      <div className="px-6 py-4 flex justify-between items-center max-w-[1600px] mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-all group-hover:scale-105">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all">
            FlowPost
          </span>
        </Link>

        {/* Center Navigation Links */}
        {(isLandingPage || isPricingPage) && (
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/#features"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Features
            </Link>
            <Link
              href="/#how-it-works"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/pricing"
              className={`text-sm font-medium transition-colors ${
                isPricingPage
                  ? "text-violet-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pricing
            </Link>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              {/* On landing page, show simple Dashboard link. On dashboard pages, no need to show links since sidebar handles it */}
              {(isLandingPage || isPricingPage) && (
                <Link href="/dashboard/workflows">
                  <Button
                    variant="default"
                    className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              )}
              <div
                className={
                  isLandingPage || isPricingPage ? "ml-2 pl-2 border-l" : ""
                }
              >
                <UserButton afterSignOutUrl="/" />
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <Link href="/sign-in">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
