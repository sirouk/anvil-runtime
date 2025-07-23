import { test, expect } from "@playwright/test";

test("bridge health check", async ({ page }) => {
  const response = await page.request.get("http://localhost:3000/api/health");
  expect(response.status()).toBe(200);
  console.log("✅ Bridge health check passed");
});
