import { describe, expect, it } from "vitest";
import { computeInvoiceTotals, D } from "@/lib/money";
import { canTransition, TRANSITIONS } from "@/server/appointments/transitions";
import { fromMinutes, toMinutes, utcToZonedParts, zonedToUtc, dayRangeUtc } from "@/lib/tz";
import { parseCsv, toCsv } from "@/lib/csv";
import { can, ROLE_PERMISSIONS } from "@/server/auth/permissions";
import { redact } from "@/lib/logger";

describe("money", () => {
  it("is decimal-safe (0.1 + 0.2 style)", () => {
    const t = computeInvoiceTotals([{ quantity: 3, unitPrice: "0.10" }, { quantity: 1, unitPrice: "0.20" }], 0, 0);
    expect(t.subtotal.toString()).toBe("0.5");
    expect(t.total.toFixed(2)).toBe("0.50");
  });
  it("applies discount then tax", () => {
    const t = computeInvoiceTotals([{ quantity: 2, unitPrice: "100.00" }], "50", "14");
    expect(t.subtotal.toFixed(2)).toBe("200.00");
    expect(t.taxAmount.toFixed(2)).toBe("21.00");
    expect(t.total.toFixed(2)).toBe("171.00");
  });
  it("rejects discount above subtotal and negatives", () => {
    expect(() => computeInvoiceTotals([{ quantity: 1, unitPrice: "10" }], "11", 0)).toThrow(/exceed/);
    expect(() => computeInvoiceTotals([{ quantity: 1, unitPrice: "10" }], "-1", 0)).toThrow(/negative/);
  });
  it("rounds half up to 2dp", () => {
    const t = computeInvoiceTotals([{ quantity: 1, unitPrice: "10.005" }], 0, 0);
    expect(D(t.total).toFixed(2)).toBe("10.01");
  });
});

describe("appointment state machine", () => {
  it("allows the happy path", () => {
    const path = ["PENDING", "CONFIRMED", "CHECKED_IN", "WAITING", "IN_PROGRESS", "COMPLETED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });
  it("blocks illegal jumps and terminal states", () => {
    expect(canTransition("PENDING", "COMPLETED")).toBe(false);
    expect(canTransition("COMPLETED", "PENDING")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransition("NO_SHOW", "CHECKED_IN")).toBe(false);
    for (const t of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) expect(TRANSITIONS[t]).toEqual([]);
  });
});

describe("timezone", () => {
  it("converts Cairo wall time to UTC (EET, UTC+2 in winter)", () => {
    expect(zonedToUtc("2026-01-15", "09:00", "Africa/Cairo").toISOString()).toBe("2026-01-15T07:00:00.000Z");
  });
  it("handles Cairo DST (UTC+3 in summer)", () => {
    expect(zonedToUtc("2026-07-15", "09:00", "Africa/Cairo").toISOString()).toBe("2026-07-15T06:00:00.000Z");
  });
  it("roundtrips and computes day range", () => {
    const d = zonedToUtc("2026-03-10", "23:30", "Africa/Cairo");
    expect(utcToZonedParts(d, "Africa/Cairo")).toMatchObject({ date: "2026-03-10", time: "23:30" });
    const r = dayRangeUtc("2026-01-15", "Africa/Cairo");
    expect(r.end.getTime() - r.start.getTime()).toBe(86400000);
    expect(toMinutes(fromMinutes(570))).toBe(570);
  });
});

describe("csv", () => {
  it("roundtrips quotes and commas", () => {
    const csv = toCsv([{ a: 'He said "hi", ok', b: "x" }], ["a", "b"]);
    expect(parseCsv(csv)).toEqual([["a", "b"], ['He said "hi", ok', "x"]]);
  });
  it("neutralises spreadsheet formulas on export", () => {
    expect(toCsv([{ a: "=HYPERLINK(1)" }], ["a"])).toContain("'=HYPERLINK(1)");
  });
});

describe("permissions matrix", () => {
  it("super admin has no clinical/billing permissions", () => {
    for (const p of ["medical.read", "patient.read", "billing.read", "appointment.read"] as const) expect(can("SUPER_ADMIN", p)).toBe(false);
  });
  it("receptionist and accountant cannot read medical records", () => {
    expect(can("RECEPTIONIST", "medical.read")).toBe(false);
    expect(can("ACCOUNTANT", "medical.read")).toBe(false);
    expect(can("BRANCH_MANAGER", "medical.read")).toBe(false);
  });
  it("patient only has portal access", () => {
    expect(ROLE_PERMISSIONS.PATIENT).toEqual(["portal.self"]);
  });
});

describe("log redaction", () => {
  it("redacts sensitive keys", () => {
    expect(redact({ password: "x", nested: { token: "y", name: "ok" } })).toEqual({ password: "[REDACTED]", nested: { token: "[REDACTED]", name: "ok" } });
  });
});
