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
