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
  await expect(page.getByText("Cancellation rate")).toBeVisible();
  await expect(page.locator("code")).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Doctor" })).toBeVisible();
});

test("doctor runs a consultation to completion and an invoice is created", async ({ page }) => {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const user = await db.user.findUniqueOrThrow({ where: { email: "doctor@nile.medora.test" } });
  const doctor = await db.doctor.findFirstOrThrow({ where: { userId: user.id } });
  const appt = await db.appointment.findFirstOrThrow({ where: { doctorId: doctor.id, status: "CONFIRMED", invoice: null, consultation: null } });
  await db.appointment.update({ where: { id: appt.id }, data: { status: "WAITING" } });
  await login(page, "doctor@nile.medora.test");
  await page.waitForURL(/\/doctor/);
  await page.goto(`/doctor/consult/${appt.id}`);
  await page.getByRole("button", { name: "Start consultation" }).click();
  await page.getByLabel(/Diagnosis/).fill("Seasonal allergic rhinitis");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByRole("status")).toContainText("Notes saved");
  await page.getByLabel("Medication").fill("Cetirizine");
  await page.getByLabel("Dosage").fill("10 mg");
  await page.getByLabel("Frequency").fill("Once daily");
  await page.getByLabel("Duration").fill("7 days");
  await page.getByRole("button", { name: "Add prescription" }).click();
  await expect(page.getByRole("status")).toContainText("Prescription added");
  await page.getByRole("button", { name: "Complete consultation" }).click();
  await expect(page.getByText("This consultation is completed.")).toBeVisible();
  const inv = await db.invoice.findUnique({ where: { appointmentId: appt.id } });
  expect(inv).not.toBeNull();
  expect((await db.prescription.count({ where: { consultation: { appointmentId: appt.id } } }))).toBe(1);
  await db.$disconnect();
});

test("accountant refunds part of a payment", async ({ page }) => {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const clinic = await db.clinic.findUniqueOrThrow({ where: { slug: "nile-care" } });
  const pay = await db.payment.findFirstOrThrow({ where: { clinicId: clinic.id, amount: { gte: 50 }, refunds: { none: {} } }, include: { invoice: true } });
  await login(page, "accountant@nile.medora.test");
  await page.waitForURL(/\/admin/);
  await page.goto(`/admin/billing/${pay.invoiceId}`);
  await page.getByLabel(`Refund amount ${pay.id}`).fill("10.00");
  await page.getByLabel(`Refund reason ${pay.id}`).fill("E2E partial refund");
  await page.getByRole("button", { name: "Refund", exact: true }).first().click();
  await expect(page.getByText(/refunded.*10\.00/)).toBeVisible();
  expect(await db.refund.count({ where: { paymentId: pay.id } })).toBe(1);
  await db.$disconnect();
});
