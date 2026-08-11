-- Email verification for client accounts: a registration is locked until the
-- owner clicks the confirmation link. Token stored hashed; expiry enforced at verify.
ALTER TABLE "clients" ADD COLUMN "verifyEmailToken" VARCHAR(255);
ALTER TABLE "clients" ADD COLUMN "verifyEmailExpires" TIMESTAMP(3);

-- Pro user accounts: the verifyEmailToken column already exists; add the expiry.
ALTER TABLE "users" ADD COLUMN "verifyEmailExpires" TIMESTAMP(3);
