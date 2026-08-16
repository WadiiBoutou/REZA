import { prisma } from './src/lib/prisma';
(async () => {
  const tables = ['appointments', 'users', 'booking_participants', 'appointment_service_items', 'clients', 'services', 'invoices', 'reviews'];
  for (const t of tables) {
    const idx = await prisma.$queryRawUnsafe(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '${t}' ORDER BY indexname`);
    console.log(`\n=== ${t} ===`);
    for (const i of idx as any[]) console.log(' ', i.indexname);
  }
  // EXPLAIN the slow-looking query
  const ex = await prisma.$queryRawUnsafe(`EXPLAIN SELECT "id" FROM "appointment_service_items" WHERE "appointmentId" IN ('x1','x2','x3')`);
  console.log('\n=== EXPLAIN appointment_service_items IN ===');
  for (const r of ex as any[]) console.log(' ', (r as any)['QUERY PLAN']);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
