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
import { PASSWORDS, SPA_ROYAL_ADMIN, SUPERADMIN } from './constants';
import { seedDiscoverySalons } from './discovery-salons';
import { seedSpaRoyalAccount } from './spa-royal-account';
import { seedBillingConfig } from './subscription-plan';
import { seedSuperadmin } from './superadmin';

async function main() {
  console.log('🌱 REZA demo seed (mockdata)\n');

  await cleanupDatabase(prisma);

  await seedBillingConfig(prisma);
  await seedSuperadmin(prisma);
  await seedSpaRoyalAccount(prisma);
  await seedDiscoverySalons(prisma);

  console.log('\n🎉 Seed complete\n');
  console.log('Logins:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Pro admin (multi-salon): ${SPA_ROYAL_ADMIN.email} / ${PASSWORDS.admin}`);
  console.log(`  Superadmin:              ${SUPERADMIN.email} / ${PASSWORDS.superadmin}`);
  console.log(`  B2C client:              client1@gmail.com / ${PASSWORDS.client}`);
  console.log(`  Discovery admins:        admin@{subdomain}.ma / ${PASSWORDS.admin}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nSpa Royal account salons: Spa Royal Casablanca + Spa Royal 2');
  console.log('Discovery: Élégance, Barber Studio, Beauty Chic, Nail Bar, Zen Spa');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
