-- Plaintext credentials came from the demo seeding path. Disable those accounts
-- and clear their reusable passwords; deployment preflights that a secure admin remains.
UPDATE "User"
SET "active" = FALSE, "password" = 'disabled$legacy-plaintext$reprovision', "updatedAt" = CURRENT_TIMESTAMP
WHERE "password" NOT LIKE 'scrypt$%';

CREATE INDEX IF NOT EXISTS "FuelEntry_deletedAt_date_idx" ON "FuelEntry"("deletedAt", "date");
CREATE INDEX IF NOT EXISTS "Trip_deletedAt_date_idx" ON "Trip"("deletedAt", "date");
CREATE INDEX IF NOT EXISTS "Maintenance_deletedAt_date_idx" ON "Maintenance"("deletedAt", "date");
