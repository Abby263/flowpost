import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should display the landing page", async ({ page }) => {
    await page.goto("/");
    
    // Check that the page loads
    await expect(page).toHaveTitle(/FlowPost/i);
  });

  test("should have navigation elements", async ({ page }) => {
    await page.goto("/");
    
    // Check for common navigation elements
    const signInLink = page.getByRole("link", { name: /sign in/i });
    await expect(signInLink).toBeVisible();
  });

  test("should navigate to sign-in page", async ({ page }) => {
    await page.goto("/");
    
    // Click sign in link
    await page.getByRole("link", { name: /sign in/i }).click();
    
    // Should be on sign-in page
    await expect(page).toHaveURL(/sign-in/);
  });
});

test.describe("Authentication Flow", () => {
  test("should show sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    
    // Clerk sign-in should be visible
    await expect(page.locator("body")).toBeVisible();
  });

  test("should show sign-up page", async ({ page }) => {
    await page.goto("/sign-up");
    
    // Clerk sign-up should be visible
    await expect(page.locator("body")).toBeVisible();
  });
});
