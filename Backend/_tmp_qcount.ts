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
import { appointmentService } from './src/modules/appointment/appointment.service';
(async () => {
  // find a tenant with appointments on a given day — reuse bench-created? none now. Use a real busy tenant day:
  const appts = await prisma.appointment.findMany({ where: { startTime: { gte: new Date('2026-08-14T00:00:00Z'), lt: new Date('2026-08-15T00:00:00Z') } }, select: { tenantId: true }, take: 5 });
  const tenants = [...new Set(appts.map(a => a.tenantId))];
  console.log('tenants with appts on 08-14:', tenants.length);
  for (const t of tenants.slice(0,1)) {
    count = 0; totalMs = 0;
    const t0 = Date.now();
    const r = await appointmentService.getAppointments([t], { startDate: '2026-08-14', endDate: '2026-08-14' });
    const wall = Date.now() - t0;
    console.log(`tenant ${t}: ${r.appointments.length} rows, ${wall}ms wall, ${count} queries, ${totalMs.toFixed(0)}ms query time`);
  }
  await pool.end();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
