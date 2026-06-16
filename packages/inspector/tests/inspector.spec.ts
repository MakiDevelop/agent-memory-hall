import { test, expect } from "@playwright/test";

test.describe("ACA Inspector", () => {
  test("overview page loads with stats", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("ACA Inspector");
    await expect(page.locator("text=Governance Overview")).toBeVisible();
    await expect(page.locator("text=Memories")).toBeVisible();
    await expect(page.locator("text=Audit Events")).toBeVisible();
    await expect(page.locator("text=Decisions")).toBeVisible();
    await expect(page.locator("text=Roles")).toBeVisible();
  });

  test("overview links to decision inspector", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/decisions/dec-001"]');
    await expect(page).toHaveURL(/\/decisions\/dec-001/);
    await expect(page.locator("text=auto-update production constraints")).toBeVisible();
  });

  test("decision inspector shows all 4 sections", async ({ page }) => {
    await page.goto("/decisions/dec-001");
    await expect(page.locator("text=1. Authority")).toBeVisible();
    await expect(page.locator("text=2. Decision + Reviews")).toBeVisible();
    await expect(page.locator("text=3. Provenance")).toBeVisible();
    await expect(page.locator("text=4. Audit Trail")).toBeVisible();
  });

  test("decision inspector shows reviews with positions", async ({ page }) => {
    await page.goto("/decisions/dec-001");
    await expect(page.locator("text=OPPOSE")).toBeVisible();
    await expect(page.locator("text=CONDITIONAL APPROVE")).toBeVisible();
    await expect(page.locator("text=Ratification")).toBeVisible();
    await expect(page.locator("text=Ratified by maki")).toBeVisible();
  });

  test("decision inspector shows authority roles", async ({ page }) => {
    await page.goto("/decisions/dec-001");
    await expect(page.locator("text=agent-claude")).toBeVisible();
    await expect(page.locator("text=Architect")).toBeVisible();
    await expect(page.locator("text=agent-codex")).toBeVisible();
    await expect(page.locator("text=agent-gemini")).toBeVisible();
  });

  test("decision inspector back link works", async ({ page }) => {
    await page.goto("/decisions/dec-001");
    await page.click("a.back");
    await expect(page).toHaveURL("/");
  });

  test("memory explorer loads with table", async ({ page }) => {
    await page.goto("/memories");
    await expect(page.locator("text=Memory Explorer")).toBeVisible();
    await expect(page.locator("text=7 memories")).toBeVisible();
    await expect(page.locator("text=mem-001")).toBeVisible();
    await expect(page.locator("text=mem-007")).toBeVisible();
  });

  test("memory explorer row click opens detail drawer", async ({ page }) => {
    await page.goto("/memories");
    await page.click('tr:has-text("mem-005")');
    await expect(page.locator("text=Trust Proof")).toBeVisible();
    await expect(page.locator("text=Provenance")).toBeVisible();
    await expect(page.locator("text=human_review")).toBeVisible();
  });

  test("navigation between pages works", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/memories"]');
    await expect(page).toHaveURL(/\/memories/);
    await expect(page.locator("text=Memory Explorer")).toBeVisible();
  });
});
