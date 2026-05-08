"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Two-state Light / Dark theme switch.
 *
 * Clicking flips between explicit "light" and "dark" — no system mode
 * (most users find tri-state confusing). The first interaction also drops
 * the OS preference, by design: once you've expressed an opinion we honor
 * it.
 *
 * Renders a placeholder until mounted to avoid SSR/CSR mismatch — we don't
 * know the resolved theme before hydration.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={`h-9 w-9 p-0 ${className}`}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-9 w-9 p-0 ${className}`}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-yellow-400" />
      ) : (
        <Moon className="h-4 w-4 text-foreground" />
      )}
    </Button>
  );
}
