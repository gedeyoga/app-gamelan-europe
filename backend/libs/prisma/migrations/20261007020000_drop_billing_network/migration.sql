-- Drop `Billing` → `Network` relation (relation no longer used; `Network` still used by User/Event).
ALTER TABLE "billings" DROP CONSTRAINT "billings_network_id_fkey";
DROP INDEX "billings_network_id_idx";
ALTER TABLE "billings" DROP COLUMN "network_id";
