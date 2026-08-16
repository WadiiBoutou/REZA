import { prisma } from './src/lib/prisma';
import * as bcrypt from 'bcryptjs';
(async () => {
  const users = await prisma.user.findMany({ where: { tenantId: 'cmspd1x8t00002lise4xa5fz2' }, select: { id: true, email: true, password: true, role: true }, take: 3 });
  for (const u of users) console.log(u.id, u.email, u.role, 'hasPw:', !!u.password);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
