import { Prisma } from "@prisma/client";

export type Money = Prisma.Decimal;
export const D = (v: Prisma.Decimal.Value | null | undefined): Money => new Prisma.Decimal(v ?? 0);
export const round2 = (v: Money): Money => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export interface LineInput { quantity: number; unitPrice: Prisma.Decimal.Value }

/** Server-side invoice maths. Discount is capped to subtotal; tax is applied after discount. */
export function computeInvoiceTotals(lines: LineInput[], discount: Prisma.Decimal.Value, taxRatePercent: Prisma.Decimal.Value) {
  const lineTotals = lines.map((l) => round2(D(l.unitPrice).mul(l.quantity)));
  const subtotal = lineTotals.reduce((a, b) => a.add(b), D(0));
  const disc = round2(D(discount));
  if (disc.isNegative()) throw new RangeError("Discount cannot be negative");
  if (disc.gt(subtotal)) throw new RangeError("Discount cannot exceed the subtotal");
  const taxable = subtotal.sub(disc);
  const tax = round2(taxable.mul(D(taxRatePercent)).div(100));
  const total = taxable.add(tax);
  return { lineTotals, subtotal, discountAmount: disc, taxAmount: tax, total };
}

export function formatMoney(v: Prisma.Decimal.Value, currency = "EGP", locale = "en") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG", { style: "currency", currency }).format(Number(D(v).toFixed(2)));
}
