import { PrismaClient } from './prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: [{ emit: 'event', level: 'query' }] });
prisma.$on('query', (e: any) => {
  const sql = e.query.replace(/\s+/g, ' ').slice(0, 110);
  console.log(`${e.duration.toFixed(0)}ms  ${sql}`);
});
(async () => {
  const t = 'cmspd1x8t00002lise4xa5fz2';
  const include = {
    client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
    service: { select: { id: true, name: true, duration: true, price: true, color: true } },
    services: { orderBy: { sortOrder: 'asc' }, include: { service: true, employee: { select: { id: true, firstName: true, lastName: true } } } },
    employee: { select: { id: true, firstName: true, lastName: true } },
    createdBy: { select: { id: true, firstName: true, lastName: true } },
    bookingParticipant: { select: { displayName: true, clientId: true } },
    bookingGroup: { select: { id: true, _count: { select: { participants: true } } } },
  };
  await prisma.appointment.findMany({
    where: { tenantId: t, startTime: { gte: new Date('2026-08-01T00:00:00Z'), lte: new Date('2026-08-20T23:59:59Z') } },
    orderBy: { startTime: 'asc' }, include,
  });
  await pool.end();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
