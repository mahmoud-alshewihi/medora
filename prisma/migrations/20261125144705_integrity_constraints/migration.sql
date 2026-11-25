CREATE EXTENSION IF NOT EXISTS btree_gist;

-- A doctor can never have two overlapping active appointments, across ALL branches.
ALTER TABLE "Appointment" ADD CONSTRAINT appointment_doctor_no_overlap
  EXCLUDE USING gist ("doctorId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" NOT IN ('CANCELLED','NO_SHOW'));
ALTER TABLE "Appointment" ADD CONSTRAINT appointment_time_order CHECK ("endsAt" > "startsAt");

ALTER TABLE "Invoice" ADD CONSTRAINT invoice_amounts_valid CHECK (
  "subtotal" >= 0 AND "discountAmount" >= 0 AND "discountAmount" <= "subtotal"
  AND "total" >= 0 AND "paidAmount" >= 0 AND "paidAmount" <= "total" AND "refundedAmount" >= 0 AND "refundedAmount" <= "paidAmount");
ALTER TABLE "Payment" ADD CONSTRAINT payment_positive CHECK ("amount" > 0);
ALTER TABLE "Refund" ADD CONSTRAINT refund_positive CHECK ("amount" > 0);
ALTER TABLE "InventoryBatch" ADD CONSTRAINT batch_non_negative CHECK ("quantity" >= 0);
ALTER TABLE "InventoryItem" ADD CONSTRAINT item_min_non_negative CHECK ("minStock" >= 0);
