import { PrismaClient } from './prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
let count = 0; let totalMs = 0;
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: [{ emit: 'event', level: 'query' }] });
prisma.$on('query', (e: any) => { count++; totalMs += e.duration; });
(async () => {
  // Seed 36 appts on tenant from bench? just reuse existing tenant and duplicate its day across 3 days:
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
  // widen window to get ~36 rows
  const t0 = Date.now();
  const rows = await prisma.appointment.findMany({
    where: { tenantId: t, startTime: { gte: new Date('2026-08-01T00:00:00Z'), lte: new Date('2026-08-20T23:59:59Z') } },
    orderBy: { startTime: 'asc' }, include,
  });
  console.log(`rows: ${rows.length}, ${count} queries, ${Date.now() - t0}ms, ${totalMs.toFixed(0)}ms query time`);
  await pool.end();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
