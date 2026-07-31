import dotenv from 'dotenv';
import { PrismaClient } from '../prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const action = process.argv[2] || 'check';

  if (action === 'check') {
    console.log('=== ROWS TO DELETE ===\n');

    const aptCount = await prisma.appointment.count();
    const asiCount = await prisma.appointmentServiceItem.count();
    const bgCount = await prisma.bookingGroup.count();
    const bpCount = await prisma.bookingParticipant.count();
    const invoiceAll = await prisma.invoice.count();
    const invoiceSale = await prisma.invoice.count({ where: { type: 'SALE' } });
    const invoiceSub = await prisma.invoice.count({ where: { type: 'SUBSCRIPTION' } });
    const iiCount = await prisma.invoiceItem.count();
    const ctCount = await prisma.cashTransaction.count();

    console.log(`  Appointment:              ${aptCount}`);
    console.log(`  AppointmentServiceItem:   ${asiCount}`);
    console.log(`  BookingGroup:             ${bgCount}`);
    console.log(`  BookingParticipant:       ${bpCount}`);
    console.log(`  Invoice (SALE):           ${invoiceSale}`);
    console.log(`  Invoice (SUBSCRIPTION):   ${invoiceSub}  ← KEPT`);
    console.log(`  InvoiceItem:              ${iiCount}`);
    console.log(`  CashTransaction:          ${ctCount}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  Total to delete:          ${aptCount + asiCount + bgCount + bpCount + invoiceSale + iiCount + ctCount}`);

    console.log('\n=== SAFE TABLES (will NOT be touched) ===\n');
    console.log(`  Tenant:                   ${await prisma.tenant.count()}`);
    console.log(`  TenantSettings:           ${await prisma.tenantSettings.count()}`);
    console.log(`  User:                     ${await prisma.user.count()}`);
    console.log(`  Client:                   ${await prisma.client.count()}`);
    console.log(`  FamilyMember:             ${await prisma.familyMember.count()}`);
    console.log(`  Service:                  ${await prisma.service.count()}`);
    console.log(`  Employee:                 ${await prisma.employee.count()}`);
    console.log(`  EmployeeService:          ${await prisma.employeeService.count()}`);
    console.log(`  Account:                  ${await prisma.account.count()}`);
    console.log(`  Subscription:             ${await prisma.subscription.count()}`);
    console.log(`  SubscriptionPlan:         ${await prisma.subscriptionPlan.count()}`);
    console.log(`  Favorite:                 ${await prisma.favorite.count()}`);
    console.log(`  Review:                   ${await prisma.review.count()}`);
    console.log(`  Notification:             ${await prisma.notification.count()}`);
    console.log(`  EarlyAccessSignup:        ${await prisma.earlyAccessSignup.count()}`);
  }

  if (action === 'clear') {
    console.log('=== CLEARING RESERVATION + CAISSE DATA ===\n');

    // 1. Delete InvoiceItem (child of Invoice, delete first to be safe)
    const iiCount = await prisma.invoiceItem.count();
    console.log(`Deleting ${iiCount} InvoiceItems...`);
    await prisma.invoiceItem.deleteMany();
    console.log('  Done.');

    // 2. Delete SALE invoices only (keep SUBSCRIPTION)
    const saleCount = await prisma.invoice.count({ where: { type: 'SALE' } });
    console.log(`Deleting ${saleCount} SALE invoices...`);
    await prisma.invoice.deleteMany({ where: { type: 'SALE' } });
    console.log('  Done.');

    // 3. Delete AppointmentServiceItems (child of Appointment)
    const asiCount = await prisma.appointmentServiceItem.count();
    console.log(`Deleting ${asiCount} AppointmentServiceItems...`);
    await prisma.appointmentServiceItem.deleteMany();
    console.log('  Done.');

    // 4. Delete BookingParticipants (child of BookingGroup, also has FK to Appointment)
    const bpCount = await prisma.bookingParticipant.count();
    console.log(`Deleting ${bpCount} BookingParticipants...`);
    await prisma.bookingParticipant.deleteMany();
    console.log('  Done.');

    // 5. Delete BookingGroups
    const bgCount = await prisma.bookingGroup.count();
    console.log(`Deleting ${bgCount} BookingGroups...`);
    await prisma.bookingGroup.deleteMany();
    console.log('  Done.');

    // 6. Delete Appointments (after clearing all children/FK references)
    const aptCount = await prisma.appointment.count();
    console.log(`Deleting ${aptCount} Appointments...`);
    await prisma.appointment.deleteMany();
    console.log('  Done.');

    // 7. Delete CashTransactions
    const ctCount = await prisma.cashTransaction.count();
    console.log(`Deleting ${ctCount} CashTransactions...`);
    await prisma.cashTransaction.deleteMany();
    console.log('  Done.');

    // Verify
    console.log('\n=== POST-DELETION VERIFICATION ===\n');
    console.log(`  Appointment:              ${await prisma.appointment.count()}`);
    console.log(`  AppointmentServiceItem:   ${await prisma.appointmentServiceItem.count()}`);
    console.log(`  BookingGroup:             ${await prisma.bookingGroup.count()}`);
    console.log(`  BookingParticipant:       ${await prisma.bookingParticipant.count()}`);
    console.log(`  Invoice (SALE):           ${await prisma.invoice.count({ where: { type: 'SALE' } })}`);
    console.log(`  InvoiceItem:              ${await prisma.invoiceItem.count()}`);
    console.log(`  CashTransaction:          ${await prisma.cashTransaction.count()}`);

    console.log('\n=== SAFE TABLES VERIFICATION ===\n');
    console.log(`  Tenant:                   ${await prisma.tenant.count()}`);
    console.log(`  TenantSettings:           ${await prisma.tenantSettings.count()}`);
    console.log(`  User:                     ${await prisma.user.count()}`);
    console.log(`  Client:                   ${await prisma.client.count()}`);
    console.log(`  FamilyMember:             ${await prisma.familyMember.count()}`);
    console.log(`  Service:                  ${await prisma.service.count()}`);
    console.log(`  Employee:                 ${await prisma.employee.count()}`);
    console.log(`  EmployeeService:          ${await prisma.employeeService.count()}`);
    console.log(`  Invoice (SUBSCRIPTION):   ${await prisma.invoice.count({ where: { type: 'SUBSCRIPTION' } })}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
