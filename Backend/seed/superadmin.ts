import type { PrismaClient } from '../prisma/generated/prisma/client';
import { hashPassword } from '../src/utils/password';
import { PASSWORDS, SUPERADMIN } from './constants';

export async function seedSuperadmin(prisma: PrismaClient) {
  const hashed = await hashPassword(PASSWORDS.superadmin);

  const user = await prisma.user.create({
    data: {
      email: SUPERADMIN.email,
      password: hashed,
      firstName: SUPERADMIN.firstName,
      lastName: SUPERADMIN.lastName,
      phone: '+212600000000',
      role: 'SUPER_ADMIN',
      tenantId: null,
      isActive: true,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`  ✓ Superadmin ${user.email} / ${PASSWORDS.superadmin} → /superadmin`);
  return user;
}
