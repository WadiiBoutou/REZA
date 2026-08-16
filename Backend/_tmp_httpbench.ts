import { prisma } from './src/lib/prisma';
import * as bcrypt from 'bcryptjs';
(async () => {
  const email = `benchadmin${Date.now()}@test.reza`;
  const u = await prisma.user.create({
    data: { tenantId: 'cmspd1x8t00002lise4xa5fz2', email, password: await bcrypt.hash('BenchPass123!', 10), phone: '+212699999999', firstName: 'Bench', lastName: 'Admin', role: 'ADMIN' },
  });
  const r = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'BenchPass123!' }),
  });
  const j: any = await r.json();
  const token = j.token || j.accessToken;
  // warm up
  await fetch('http://localhost:5000/api/appointments?startDate=2026-08-01&endDate=2026-08-20', { headers: { Authorization: `Bearer ${token}` } });
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const res = await fetch('http://localhost:5000/api/appointments?startDate=2026-08-01&endDate=2026-08-20', { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await res.json();
    console.log(`HTTP agenda run ${i}: ${Date.now() - t0}ms status ${res.status} rows ${body?.appointments?.length}`);
  }
  await prisma.user.delete({ where: { id: u.id } });
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
