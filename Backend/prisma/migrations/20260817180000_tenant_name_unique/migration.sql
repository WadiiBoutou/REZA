-- One establishment name = one salon (product rule: salon names are unique).
-- Names in seeds are unique and the database is empty at creation, so the
-- unique index applies cleanly. Application-level checks (auth/register,
-- salon create/rename, public early-access) enforce the same rule with a
-- friendly French message; this index is the hard backstop.
CREATE UNIQUE INDEX "tenants_name_key" ON "tenants"("name");
