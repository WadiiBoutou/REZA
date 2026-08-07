-- Add badges (certifications) to TenantSettings
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "badges" JSONB;
