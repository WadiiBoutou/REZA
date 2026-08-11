import type { PrismaClient } from '../prisma/generated/prisma/client';

/**
 * Wipe all application data (dev/demo reset).
 * Order respects FK constraints. Safe to re-run — always starts from empty slate.
 */
export async function cleanupDatabase(prisma: PrismaClient) {
  console.log('🧹 Cleaning database…');

  await prisma.bookingParticipant.deleteMany();
  await prisma.bookingGroup.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.review.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.cashTransaction.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.familyMember.deleteMany();
  await prisma.employeeService.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.service.deleteMany();
  await prisma.client.deleteMany();
  await prisma.tenantSettings.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.earlyAccessSignup.deleteMany();

  console.log('✅ Database cleaned');
}
