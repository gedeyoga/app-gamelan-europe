-- Add `Billing.start_date` / `expiry_date` (nullable, no default). Used by `POST /billings/subscribe`
-- and member listing; already declared in schema.prisma but never migrated.
ALTER TABLE "billings" ADD COLUMN "start_date" TIMESTAMP(3),
ADD COLUMN "expiry_date" TIMESTAMP(3);
