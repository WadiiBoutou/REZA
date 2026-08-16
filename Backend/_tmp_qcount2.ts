import { PrismaClient } from './prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
let count = 0; let totalMs = 0; let slowest = 0;
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: [{ emit: 'event', level: 'query' }] });
prisma.$on('query', (e: any) => { count++; totalMs += e.duration; if (e.duration > slowest) slowest = e.duration; });
(async () => {
  const t = 'cmspd1x8t00002lise4xa5fz2';
  const appts = await prisma.appointment.findMany({
    where: { tenantId: t, startTime: { gte: new Date('2026-08-14T00:00:00Z'), lte: new Date('2026-08-14T23:59:59Z') } },
    orderBy: { startTime: 'asc' },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
      service: { select: { id: true, name: true, duration: true, price: true, color: true } },
      services: { orderBy: { sortOrder: 'asc' }, include: { service: true, employee: { select: { id: true, firstName: true, lastName: true } } } },
      employee: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      bookingParticipant: { select: { displayName: true, clientId: true } },
      bookingGroup: { select: { id: true, _count: { select: { participants: true } } } },
    },
  });
  console.log(`findMany: ${appts.length} rows, ${count} queries, ${totalMs.toFixed(0)}ms, slowest ${slowest.toFixed(0)}ms`);
  await pool.end();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
