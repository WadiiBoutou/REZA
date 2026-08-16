import { prisma } from './src/lib/prisma';
import * as bcrypt from 'bcryptjs';
(async () => {
  const u = await prisma.user.findFirst({ where: { id: 'cmspd1z6h00022liszhqtroqu' }, select: { password: true, email: true } });
  const ok = await bcrypt.compare('boutou2019wadii', u!.password);
  console.log('guess1:', ok);
  const ok2 = await bcrypt.compare('password', u!.password);
  console.log('guess2:', ok2);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
