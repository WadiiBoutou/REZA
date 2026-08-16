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
  // baseline: trivial query latency
  const t0 = Date.now();
  await prisma.tenant.findUnique({ where: { id: 'cmspd1x8t00002lise4xa5fz2' }, select: { id: true } });
  console.log(`trivial PK query: ${Date.now() - t0}ms`);
  // simple day query WITHOUT includes
  const t1 = Date.now();
  const rows = await prisma.appointment.findMany({
    where: { tenantId: 'cmspd1x8t00002lise4xa5fz2', startTime: { gte: new Date('2026-08-14T00:00:00Z'), lte: new Date('2026-08-14T23:59:59Z') } },
    select: { id: true, startTime: true },
  });
  console.log(`flat select (${rows.length} rows): ${Date.now() - t1}ms`);
  // count query
  const t2 = Date.now();
  await prisma.appointment.count({ where: { tenantId: 'cmspd1x8t00002lise4xa5fz2', startTime: { gte: new Date('2026-08-14T00:00:00Z'), lte: new Date('2026-08-14T23:59:59Z') } } });
  console.log(`count: ${Date.now() - t2}ms`);
  console.log(`total queries: ${count}`);
  await pool.end();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
