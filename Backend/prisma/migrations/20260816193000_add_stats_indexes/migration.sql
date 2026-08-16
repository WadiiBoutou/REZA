-- Add composite indexes for stats/agenda query performance (P4)
CREATE INDEX IF NOT EXISTS "appointments_status_idx" ON "appointments"("status");
CREATE INDEX IF NOT EXISTS "clients_tenantId_createdAt_idx" ON "clients"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "invoices_tenantId_createdAt_idx" ON "invoices"("tenantId", "createdAt");
