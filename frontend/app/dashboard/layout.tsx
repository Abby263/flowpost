"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Workflow,
  Sparkles,
  Activity,
  TrendingUp,
  Lightbulb,
  CalendarPlus,
  History,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/dashboard/connections",
      label: "Connections",
      icon: Shield,
      description: "Manage accounts",
    },
    {
      href: "/dashboard/analytics",
      label: "Analytics",
      icon: Activity,
      description: "Track & insights",
    },
    {
      href: "/dashboard/workflows",
      label: "Workflows",
      icon: Workflow,
      description: "Automation flows",
    },
    {
      href: "/dashboard/content-ideas",
      label: "Content Ideas",
      icon: Lightbulb,
      description: "Trending inspiration",
    },
    {
      href: "/dashboard/schedule-post",
      label: "Schedule Post",
      icon: CalendarPlus,
      description: "Manual scheduling",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <Navbar />
      <div className="flex flex-1">
        <aside className="w-72 border-r bg-white/80 backdrop-blur-sm p-6 hidden md:block shadow-sm">
          <div className="space-y-6">
            {/* Brand Section */}
            <div className="px-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="font-semibold text-lg">Dashboard</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Automate your social presence
              </p>
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Navigation
              </p>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className={`w-full justify-start h-auto py-3 px-3 ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                          : "hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Icon
                          className={`h-5 w-5 shrink-0 ${isActive ? "" : "text-slate-600"}`}
                        />
                        <div className="flex flex-col items-start text-left">
                          <span className="font-medium">{item.label}</span>
                          <span
                            className={`text-xs ${isActive ? "text-blue-100" : "text-muted-foreground"}`}
                          >
                            {item.description}
                          </span>
                        </div>
                      </div>
                    </Button>
                  </Link>
                );
              })}
            </nav>

            {/* Stats/Info Section */}
            <div className="px-3 pt-4 border-t">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">
                    Pro Tip
                  </span>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Schedule workflows to run automatically at specific times for
                  consistent posting.
                </p>
              </div>
            </div>
          </div>
        </aside>
        <main className="flex-1 bg-white overflow-auto">{children}</main>
      </div>
    </div>
  );
}
