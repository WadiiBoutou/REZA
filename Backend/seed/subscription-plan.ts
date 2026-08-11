import type { PrismaClient } from '../prisma/generated/prisma/client';

/**
 * Seeds the platform-wide BillingConfig for the virement model.
 * (The old SubscriptionPlan reference row was removed — pricing is driven
 * entirely by BillingConfig.)
 */
export async function seedBillingConfig(prisma: PrismaClient) {
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

  console.log('  ✓ Tarification virement : 1000 MAD/salon, 2 employés gratuits, 100 MAD/employé');
}
