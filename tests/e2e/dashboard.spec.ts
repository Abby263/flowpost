import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  // Note: These tests require authentication
  // In a real scenario, you would set up test authentication

  test.describe("Unauthenticated Access", () => {
    test("should redirect unauthenticated users from dashboard", async ({
      page,
    }) => {
      await page.goto("/dashboard");

      // Should redirect to sign-in or show unauthorized
      // The exact behavior depends on Clerk middleware configuration
      await expect(page).not.toHaveURL("/dashboard");
    });

    test("should redirect from workflows page", async ({ page }) => {
      await page.goto("/dashboard/workflows");

      // Should redirect to sign-in
      await expect(page).not.toHaveURL("/dashboard/workflows");
    });

    test("should redirect from connections page", async ({ page }) => {
      await page.goto("/dashboard/connections");

      // Should redirect to sign-in
      await expect(page).not.toHaveURL("/dashboard/connections");
    });
  });
});

test.describe("Dashboard Layout", () => {
  test.skip("should display navbar when authenticated", async ({ page }) => {
    // This test is skipped until authentication is set up for E2E tests
    // Implement with Clerk test mode or mock authentication
    await page.goto("/dashboard");

    const navbar = page.locator("nav");
    await expect(navbar).toBeVisible();
  });

  test.skip("should display sidebar navigation", async ({ page }) => {
    // This test is skipped until authentication is set up for E2E tests
    await page.goto("/dashboard");

    // Check for sidebar links
    await expect(page.getByRole("link", { name: /workflows/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /connections/i }),
    ).toBeVisible();
  });
});
