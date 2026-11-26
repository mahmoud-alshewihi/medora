-- Net collected (paidAmount - refundedAmount) is the amount that must not exceed the total:
-- after a partial refund the outstanding balance becomes payable again, which makes gross
-- paidAmount legitimately exceed `total`. The old CHECK rejected that valid state with a 500.
ALTER TABLE "Invoice" DROP CONSTRAINT invoice_amounts_valid;
ALTER TABLE "Invoice" ADD CONSTRAINT invoice_amounts_valid CHECK (
  "subtotal" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "subtotal"
  AND "total" >= 0 AND "paidAmount" >= 0 AND "paidAmount" - "refundedAmount" <= "total"
  AND "refundedAmount" >= 0 AND "refundedAmount" <= "paidAmount");
