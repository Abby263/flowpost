"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Small button that cycles light → dark → system → light.
 * The icon reflects the *resolved* theme (so Sun in light, Moon in dark)
 * with a small "system" badge when following OS preference.
 *
 * Renders a placeholder until mounted to avoid SSR/CSR mismatch — next-themes
 * can't know the resolved theme before hydration.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={`h-9 w-9 p-0 ${className}`}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const next =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon =
    theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-9 w-9 p-0 ${className}`}
      aria-label={`Switch to ${next} theme (currently ${theme})`}
      title={`Theme: ${theme}. Click to switch to ${next}.`}
      onClick={() => setTheme(next)}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
