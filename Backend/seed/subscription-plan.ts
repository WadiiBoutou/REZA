import type { PrismaClient } from '../prisma/generated/prisma/client';
import { BASE_PLAN } from './constants';

/**
 * Seeds the reference SubscriptionPlan (kept only to satisfy the FK on
 * Subscription.planId — pricing is now driven by BillingConfig) and the
 * platform-wide BillingConfig for the virement model.
 */
export async function seedSubscriptionPlan(prisma: PrismaClient) {
  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: BASE_PLAN.name,
      priceCents: BASE_PLAN.priceCents,
      currency: BASE_PLAN.currency,
      interval: BASE_PLAN.interval,
      maxSalons: BASE_PLAN.maxSalons,
      isActive: true,
    },
  });

  await prisma.billingConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      pricePerSalon: 1000,
      freeEmployeeThreshold: 2,
      pricePerEmployee: 100,
      currency: 'MAD',
    },
    update: {},
  });

  console.log('  ✓ Plan de référence (FK) + Tarification virement : 1000 MAD/salon, 2 employés gratuits, 100 MAD/employé');
  return plan;
}
