import { expect, test, type Page } from "@playwright/test";
const PW = "Medora#Demo2026";
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).first().fill(PW);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
}
test("public site and booking page load", async ({ page }) => {
  await page.goto("/c/nile-care");
  await expect(page.getByText(/Nile Care/i).first()).toBeVisible();
  await page.goto("/c/nile-care/book");
  await expect(page).toHaveURL(/book/);
});
test("owner reaches dashboard and patients", async ({ page }) => {
  await login(page, "owner@nile.medora.test");
  await page.waitForURL(/\/admin/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/admin/patients");
  await expect(page.getByRole("heading", { name: "Patients" })).toBeVisible();
});
test("doctor cannot open admin", async ({ page }) => {
  await login(page, "doctor@nile.medora.test");
  await page.waitForURL(/\/doctor/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/doctor/);
});

test("accountant records a payment from the invoice page", async ({ page }) => {
  await login(page, "accountant@nile.medora.test");
  await page.waitForURL(/\/admin/);
  await page.goto("/admin/billing");
  const rows = page.locator("tbody tr", { hasText: /ISSUED|PARTIALLY_PAID/ });
  await rows.first().getByRole("link").click();
  await expect(page.getByRole("heading", { name: /Invoice/ })).toBeVisible();
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/RCT-\d+/).first()).toBeVisible();
  await expect(page.getByText("Record payment")).toHaveCount(0);
});

test("accountant adds an expense", async ({ page }) => {
  await login(page, "accountant@nile.medora.test");
  await page.waitForURL(/\/admin/);
  await page.goto("/admin/expenses");
  const desc = "E2E expense " + Date.now();
  await page.getByLabel("Description").fill(desc);
  await page.getByLabel("Amount").fill("125.50");
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByText(desc)).toBeVisible();
});

test("owner adds staff and saves settings", async ({ page }) => {
  await login(page, "owner@nile.medora.test");
  await page.waitForURL(/\/admin/);
  await page.goto("/admin/staff");
  const email = `e2e${Date.now()}@nile.medora.test`;
  await page.getByLabel("Full name").fill("E2E Nurse");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Temporary password").fill("TempPass#2026");
  await page.getByLabel("Role").selectOption("NURSE");
  await page.getByRole("button", { name: "Add staff" }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("Settings saved");
});

test("owner opens reports", async ({ page }) => {
  await login(page, "owner@nile.medora.test");
  await page.waitForURL(/\/admin/);
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText("Net income")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Doctor" })).toBeVisible();
});
