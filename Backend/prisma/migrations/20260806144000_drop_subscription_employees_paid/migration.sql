-- Drop the redundant account-level employeesPaid column (per-salon coverage lives on tenants.employeesPaid)
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "employeesPaid";
