import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '../prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/password';

// Load Backend/.env so the script works regardless of cwd.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/create-superadmin.ts <email> <password>');
    console.error('Example: npx tsx scripts/create-superadmin.ts admin@reza.ma MyStrongPass123');
    process.exit(1);
  }

  const hashed = await hashPassword(password);

  // A global SUPER_ADMIN has tenantId = null. The unique index is (tenantId, email),
  // and NULLs are distinct in Postgres, so find-or-update manually by email instead
  // of relying on upsert with a null key.
  const existing = await prisma.user.findFirst({
    where: { email, tenantId: null },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hashed,
        firstName: existing.firstName || 'Super',
        lastName: existing.lastName || 'Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    console.log(`  ✓ Superadmin ${email} updated (password reset to the provided one)`);
  } else {
    await prisma.user.create({
      data: {
        email,
        password: hashed,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        tenantId: null,
        isActive: true,
      },
    });
    console.log(`  ✓ Superadmin ${email} created → log in at reza-pro /superadmin`);
  }

  console.log('  Role: SUPER_ADMIN · tenant: none (global) · password hashed with bcrypt 12');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
