import { prisma } from './src/lib/prisma';
import { serializeAppointmentWithServices } from './src/utils/appointmentServiceItems';
import { appointmentService } from './src/modules/appointment/appointment.service';

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
const where = { tenantId: 'cmspd1x8t00002lise4xa5fz2', startTime: { gte: new Date('2026-08-01T00:00:00Z'), lte: new Date('2026-08-20T23:59:59Z') } };

function canon(v: any): string {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

(async () => {
  const [oldRows, newRes] = await Promise.all([
    prisma.appointment.findMany({ where, orderBy: { startTime: 'asc' }, include: appointmentListInclude }),
    appointmentService.getAppointments(['cmspd1x8t00002lise4xa5fz2'], { startDate: '2026-08-01', endDate: '2026-08-20' }),
  ]);
  const oldSer = oldRows.map(serializeAppointmentWithServices);
  const newSer = newRes.appointments;
  const a = canon(oldSer); const b = canon(newSer);
  console.log('rows:', oldSer.length, newSer.length);
  console.log(a === b ? 'IDENTICAL OUTPUT ✓' : 'DIFFERENT ✗');
  if (a !== b) {
    // show first diff
    for (let i = 0; i < Math.min(oldSer.length, newSer.length); i++) {
      if (canon(oldSer[i]) !== canon(newSer[i])) {
        console.log('diff index', i);
        console.log('OLD:', canon(oldSer[i]).slice(0, 1500));
        console.log('NEW:', canon(newSer[i]).slice(0, 1500));
        break;
      }
    }
  }
  // also test a FILTERED query (employeeId + serviceId + status) through both paths
  const f = { startDate: '2026-08-01', endDate: '2026-08-20', status: 'PENDING' };
  const [oldF, newF] = await Promise.all([
    prisma.appointment.findMany({ where: { ...where, status: 'PENDING' }, orderBy: { startTime: 'asc' }, include: appointmentListInclude }),
    appointmentService.getAppointments(['cmspd1x8t00002lise4xa5fz2'], f),
  ]);
  console.log('filtered status=PENDING:', canon(oldF.map(serializeAppointmentWithServices)) === canon(newF.appointments) ? 'IDENTICAL ✓' : 'DIFFERENT ✗', oldF.length, newF.appointments.length);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
