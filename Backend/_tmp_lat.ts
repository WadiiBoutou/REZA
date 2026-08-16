import { prisma } from './src/lib/prisma';
(async () => {
  // 5 sequential identical simple queries
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT "id" FROM "appointment_service_items" LIMIT 5`;
    console.log(`raw query ${i}: ${Date.now() - t0}ms`);
  }
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    await prisma.appointment.findMany({ where: { tenantId: 'cmspd1x8t00002lise4xa5fz2' }, select: { id: true }, take: 1 });
    console.log(`appt query ${i}: ${Date.now() - t0}ms`);
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
