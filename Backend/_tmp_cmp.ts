import { prisma } from './src/lib/prisma';
import { serializeAppointmentWithServices } from './src/utils/appointmentServiceItems';

const serviceSelect = { id: true, name: true, color: true, duration: true, price: true, priceFrom: true, onQuote: true };
const appointmentListInclude = {
  client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
  service: { select: serviceSelect },
  services: { orderBy: { sortOrder: 'asc' as const }, include: { service: { select: serviceSelect }, employee: { select: { id: true, firstName: true, lastName: true } } } },
  employee: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  bookingParticipant: { select: { displayName: true, clientId: true } },
  bookingGroup: { select: { id: true, _count: { select: { participants: true } } } },
};

// import the new fetch function via the service module (re-export for test)
import { appointmentService } from './src/modules/appointment/appointment.service';
// re-create new path: replicate the internal call by importing the service and calling getAppointments, then compare against a local include-chain fetch of the same where.
const where = { tenantId: 'cmspd1x8t00002lise4xa5fz2', startTime: { gte: new Date('2026-08-01T00:00:00Z'), lte: new Date('2026-08-20T23:59:59Z') } };

(async () => {
  const [oldRows, newRes] = await Promise.all([
    prisma.appointment.findMany({ where, orderBy: { startTime: 'asc' }, include: appointmentListInclude }),
    appointmentService.getAppointments(['cmspd1x8t00002lise4xa5fz2'], { startDate: '2026-08-01', endDate: '2026-08-20' }),
  ]);
  const oldSer = oldRows.map(serializeAppointmentWithServices);
  const newSer = newRes.appointments;
  console.log('old rows:', oldSer.length, 'new rows:', newSer.length);
  if (oldSer.length !== newSer.length) { console.log('LENGTH MISMATCH'); return; }
  // deep compare with stable stringify
  const norm = (arr: any[]) => JSON.stringify(arr, (k, v) => (v instanceof Date ? v.toISOString() : v));
  const a = norm(oldSer); const b = norm(newSer);
  if (a === b) { console.log('IDENTICAL OUTPUT ✓'); return; }
  // find first difference
  for (let i = 0; i < oldSer.length; i++) {
    const o = JSON.stringify(oldSer[i], (k, v) => (v instanceof Date ? v.toISOString() : v));
    const n = JSON.stringify(newSer[i], (k, v) => (v instanceof Date ? v.toISOString() : v));
    if (o !== n) {
      console.log(`FIRST DIFF at index ${i}:`);
      console.log('OLD:', o.slice(0, 1200));
      console.log('NEW:', n.slice(0, 1200));
      break;
    }
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
