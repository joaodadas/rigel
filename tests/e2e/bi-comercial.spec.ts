import { test, expect } from "@playwright/test";

test.describe("BI Comercial", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.TEST_EMAIL || "admin@rigel.com");
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD || "test1234");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/");
  });

  test("loads BI page with KPI cards", async ({ page }) => {
    await page.goto("/comercial/bi");
    await page.waitForSelector('[data-testid="kpi-card"]', { timeout: 15000 });

    const cards = page.locator('[data-testid="kpi-card"]');
    await expect(cards).toHaveCount(7);

    // Faturamento should not be R$ 0
    const faturamento = cards.nth(0);
    const value = await faturamento.locator(".tabular-nums").first().textContent();
    expect(value).not.toBe("R$ 0");
  });

  test("month filter changes URL", async ({ page }) => {
    await page.goto("/comercial/bi?mes=1&ano=2026");
    await page.waitForSelector('[data-testid="kpi-card"]');

    // The month selector should show Janeiro
    const monthTrigger = page.locator('button:has-text("Janeiro")');
    await expect(monthTrigger).toBeVisible();
  });

  test("CSV export downloads file", async ({ page }) => {
    await page.goto("/comercial/bi");
    await page.waitForSelector('[data-testid="kpi-card"]');

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('button:has-text("CSV")').first().click(),
    ]);

    expect(download.suggestedFilename()).toContain(".csv");
  });

  test("page renders at tablet viewport without errors", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/comercial/bi");
    await page.waitForSelector('[data-testid="kpi-card"]');

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});
