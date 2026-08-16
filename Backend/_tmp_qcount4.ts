import { PrismaClient } from './prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const t = 'cmspd1x8t00002lise4xa5fz2';
const where = { tenantId: t, startTime: { gte: new Date('2026-08-14T00:00:00Z'), lte: new Date('2026-08-14T23:59:59Z') } };
const include = {
  client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
  service: { select: { id: true, name: true, duration: true, price: true, color: true } },
  services: { orderBy: { sortOrder: 'asc' }, include: { service: true, employee: { select: { id: true, firstName: true, lastName: true } } } },
  employee: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  bookingParticipant: { select: { displayName: true, clientId: true } },
  bookingGroup: { select: { id: true, _count: { select: { participants: true } } } },
};
(async () => {
  // warmup
  await prisma.appointment.findMany({ where, include });
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    await prisma.appointment.findMany({ where, include });
    console.log(`run ${i}: ${Date.now() - t0}ms`);
  }
  await pool.end();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
