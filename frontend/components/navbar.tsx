"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Sparkles, LayoutDashboard } from "lucide-react";

export function Navbar() {
  const { isSignedIn } = useUser();
  const pathname = usePathname();

  // Check if we're on the landing page (not in dashboard)
  const isLandingPage = pathname === "/" || pathname === "";
  const isPricingPage = pathname === "/pricing";
  const isDarkPage = isLandingPage || isPricingPage;

  return (
    <nav
      className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors ${
        isDarkPage
          ? "bg-[#0a0a0f]/80 border-white/5"
          : "bg-white/95 border-slate-200 shadow-sm"
      }`}
    >
      <div className="px-6 py-4 flex justify-between items-center max-w-[1600px] mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all group-hover:scale-105">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span
            className={`text-2xl font-bold transition-all ${
              isDarkPage
                ? "text-white"
                : "bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-purple-600"
            }`}
          >
            FlowPost
          </span>
        </Link>

        {/* Center Navigation Links */}
        {isDarkPage && (
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/#features"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Features
            </Link>
            <Link
              href="/#how-it-works"
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/pricing"
              className={`text-sm font-medium transition-colors ${
                isPricingPage
                  ? "text-cyan-400"
                  : "text-zinc-400 hover:text-white"
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
              {isDarkPage && (
                <Link href="/dashboard/workflows">
                  <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white border-0">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              )}
              <div
                className={
                  isDarkPage ? "ml-2 pl-2 border-l border-white/10" : ""
                }
              >
                <UserButton afterSignOutUrl="/" />
              </div>
            </>
          ) : (
            <div className="flex gap-3">
              <Link href="/sign-in">
                <Button
                  variant="ghost"
                  className={
                    isDarkPage
                      ? "text-zinc-400 hover:text-white hover:bg-white/10"
                      : ""
                  }
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white border-0 shadow-lg shadow-cyan-500/20">
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
