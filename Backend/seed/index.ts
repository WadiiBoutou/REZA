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
import { PASSWORDS, SUPERADMIN } from './constants';
import { seedDemoWorld } from './demo-world';
import { seedBillingConfig } from './subscription-plan';
import { seedSuperadmin } from './superadmin';

async function main() {
  console.log('🌱 REZA demo seed (frontend demo world)\n');

  await cleanupDatabase(prisma);

  await seedBillingConfig(prisma);
  await seedSuperadmin(prisma);
  await seedDemoWorld(prisma);

  console.log('\n🎉 Seed complete\n');
  console.log('Logins:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Pro admin (Atelier Noor): demo.pro@reza.ma / demo1234');
  console.log(`  Superadmin:               ${SUPERADMIN.email} / ${PASSWORDS.superadmin}`);
  console.log('  B2C client (Nour Benali): demo.client@reza.ma / demo1234');
  console.log(`  Other salon admins:       admin@{subdomain}.ma / ${PASSWORDS.admin}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nAtelier Noor: 6 services, 4 employés, 16 clients, 150 RDV');
  console.log('Discovery: Maison Safran, Studio Sable, Ligne Claire, Dar Glow,');
  console.log('           Le Petit Fauteuil, Miroir Moderne, Nacre Studio');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
