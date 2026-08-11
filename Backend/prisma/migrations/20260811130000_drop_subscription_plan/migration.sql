-- Remove the vestigial SubscriptionPlan table.
-- Pricing is fully driven by BillingConfig (virement model); the plan was only
-- kept to satisfy the required Subscription.planId FK. Drop the column and the table.
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "planId";
DROP TABLE IF EXISTS "subscription_plans";
