-- Clients become global accounts: a client is tied to a salon only via
-- appointments/reviews (which carry their own tenantId), not via the client
-- row itself. New platform signups use NULL; legacy booking-created rows keep
-- their tenantId.
ALTER TABLE "clients" ALTER COLUMN "tenantId" DROP NOT NULL;
