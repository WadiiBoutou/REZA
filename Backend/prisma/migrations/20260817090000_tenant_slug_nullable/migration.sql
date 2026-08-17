-- Align tenants.slug with the schema (String?) and the actual creation flows.
-- Every tenant-creation path (auth/register, public/early-access, admin salon
-- creation) creates the tenant WITHOUT a slug and backfills it right after via
-- slugifyName(name, id). The previous migration (20260813120000) set NOT NULL
-- after backfilling, which made every new-tenant signup fail with a null
-- constraint violation. Relax the column back to nullable; the unique index is
-- kept (schema declares @unique).
ALTER TABLE "tenants" ALTER COLUMN "slug" DROP NOT NULL;
