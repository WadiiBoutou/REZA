import dotenv from 'dotenv';
import { PrismaClient } from '../../prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Cleaning up booking & caisse data...\n');

  const steps: [string, Promise<any>][] = [
    ['InvoiceItem', prisma.invoiceItem.deleteMany()],
    ['Invoice', prisma.invoice.deleteMany()],
    ['AppointmentServiceItem', prisma.appointmentServiceItem.deleteMany()],
    ['BookingParticipant', prisma.bookingParticipant.deleteMany()],
    ['BookingGroup', prisma.bookingGroup.deleteMany()],
    ['Appointment', prisma.appointment.deleteMany()],
    ['CashTransaction', prisma.cashTransaction.deleteMany()],
  ];

  for (const [label, query] of steps) {
    const result = await query;
    console.log(`  ✓ ${label}: ${result.count} deleted`);
  }

  console.log('\n✅ Done. Clients, services, employees, tenants, reviews, and favorites preserved.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
