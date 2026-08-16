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
  console.log('login:', r.status, j.error || 'OK');
  const token = j.token || j.accessToken;
  console.log('TOKEN=' + token);
  await prisma.user.delete({ where: { id: u.id } });
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
