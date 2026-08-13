-- Add a public URL slug to tenants (pretty, non-CUID URLs for the client site).
ALTER TABLE "tenants" ADD COLUMN "slug" TEXT;

-- Backfill existing tenants: slugify the name (accents stripped) + a 6-char
-- id hash for guaranteed uniqueness.
WITH base AS (
  SELECT
    "id",
    regexp_replace(
      regexp_replace(
        translate(lower(trim(COALESCE("name", 'salon'))),
          'áàâäãåçéèêëíìîïñóòôöõúùûüýÿæœ',
          'aaaaaaceeeeiiiinooooouuuuyyaeoe'),
        '[^a-z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    ) AS slug_base
  FROM "tenants"
)
UPDATE "tenants" t SET "slug" = CASE
  WHEN b.slug_base = '' THEN 'salon-' || substr(md5(t."id"), 1, 6)
  ELSE b.slug_base || '-' || substr(md5(t."id"), 1, 6)
END
FROM base b WHERE b."id" = t."id";

ALTER TABLE "tenants" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
