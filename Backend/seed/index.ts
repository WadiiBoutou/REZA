/**
 * REZA demo seed — wipes DB then fills fresh demo data.
 *
 * Run from Backend/:
 *   npm run seed
 *
 * Safe to re-run: always cleanup first → no duplicates.
 */
import { prisma } from '../src/lib/prisma';
import { cleanupDatabase } from './cleanup';
import { PASSWORDS, REZA_ADMIN, SPA_ROYAL_ADMIN, SUPERADMIN } from './constants';
import { seedRezaAccount } from './reza-account';
import { seedSpaRoyalAccount } from './spa-royal-account';
import { seedSubscriptionPlan } from './subscription-plan';
import { seedSuperadmin } from './superadmin';
import { seedRefill } from './refill-data';

async function main() {
  console.log('🌱 REZA demo seed (mockdata branch)\n');

  await cleanupDatabase(prisma);

  const plan = await seedSubscriptionPlan(prisma);
  await seedSuperadmin(prisma);
  await seedRezaAccount(prisma, plan);
  await seedSpaRoyalAccount(prisma, plan);

  // Wipes data (already empty after cleanup) and generates the large test dataset:
  // ~500 RDV, ~160 factures, ~70 avis, group bookings, billing scenarios.
  await seedRefill(prisma);

  console.log('\n🎉 Seed complete\n');
  console.log('Logins:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Pro admin (multi-salon):  ${REZA_ADMIN.email} / ${PASSWORDS.rezaAdmin}`);
  console.log(`  Spa Royal admin:          ${SPA_ROYAL_ADMIN.email} / ${PASSWORDS.admin}`);
  console.log(`  Superadmin:               ${SUPERADMIN.email} / ${PASSWORDS.superadmin}`);
  console.log(`  Client:                   client1@gmail.com / ${PASSWORDS.client}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nReza account:   Reza Salon Casablanca + Reza Salon Rabat');
  console.log('Spa Royal:      Spa Royal Casablanca + Spa Royal 2');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
