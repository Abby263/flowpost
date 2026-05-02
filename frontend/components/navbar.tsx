"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Sparkles } from "lucide-react";

export function Navbar() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <NavbarContent isSignedIn={false} authUnavailable />;
  }

  return <NavbarWithClerk />;
}

function NavbarWithClerk() {
  const { isSignedIn } = useUser();

  return (
    <NavbarContent
      isSignedIn={isSignedIn}
      userMenu={<UserButton afterSignOutUrl="/" />}
    />
  );
}

function NavbarContent({
  isSignedIn,
  userMenu,
  authUnavailable = false,
}: {
  isSignedIn: boolean | undefined;
  userMenu?: React.ReactNode;
  authUnavailable?: boolean;
}) {
  const pathname = usePathname();

  // Check if we're on the landing page (not in dashboard)
  const isLandingPage = pathname === "/" || pathname === "";
  const isPricingPage = pathname === "/pricing";

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-950 text-white shadow-sm transition group-hover:bg-neutral-800">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
            FlowPost
          </span>
        </Link>

        {(isLandingPage || isPricingPage) && (
          <div className="hidden items-center gap-6 md:flex">
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

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {isSignedIn ? (
            <>
              {(isLandingPage || isPricingPage) && (
                <Button asChild className="bg-neutral-950 hover:bg-neutral-800">
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              )}
              {userMenu && (
                <div
                  className={
                    isLandingPage || isPricingPage ? "ml-1 border-l pl-3" : ""
                  }
                >
                  {userMenu}
                </div>
              )}
            </>
          ) : authUnavailable ? (
            <Button variant="outline" disabled>
              Auth unavailable
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild className="bg-neutral-950 hover:bg-neutral-800">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
