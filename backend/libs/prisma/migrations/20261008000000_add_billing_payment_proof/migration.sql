-- Add `Billing.payment_proof_url` / `payment_proof_name` (nullable). Used by
-- `POST /billings/payment-proof` (URL + original filename) and `POST /billings/subscribe`.
-- Already declared in schema.prisma; applied manually because `migrate dev` detects
-- checksum drift on two already-applied migrations and would require a full reset.
ALTER TABLE "billings"
  ADD COLUMN "payment_proof_url" TEXT,
  ADD COLUMN "payment_proof_name" TEXT;
