import { PrismaClient } from './prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('.env') });
// NOTE: the app service uses its OWN prisma singleton — this script can't hook it.
// Instead, time the service call and separately time what middleware does.
import { appointmentService } from './src/modules/appointment/appointment.service';
(async () => {
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const r = await appointmentService.getAppointments(['cmspd1x8t00002lise4xa5fz2'], { startDate: '2026-08-01', endDate: '2026-08-20' });
    console.log(`getAppointments run ${i}: ${Date.now() - t0}ms rows ${r.appointments.length}`);
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
