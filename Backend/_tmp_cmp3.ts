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
function canon(v: any): string {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
async function cmp(label: string, filters: any, buildWhere: (w: any) => any) {
  const [oldF, newF] = await Promise.all([
    prisma.appointment.findMany({ where: buildWhere({ tenantId: 'cmspd1x8t00002lise4xa5fz2' }), orderBy: { startTime: 'asc' }, include: appointmentListInclude }),
    appointmentService.getAppointments(['cmspd1x8t00002lise4xa5fz2'], filters),
  ]);
  const same = canon(oldF.map(serializeAppointmentWithServices)) === canon(newF.appointments);
  console.log(`${label}: ${same ? 'IDENTICAL ✓' : 'DIFFERENT ✗'} (${oldF.length}/${newF.appointments.length})`);
  if (!same) { console.log('OLD:', canon(oldF.map(serializeAppointmentWithServices)).slice(0,600)); console.log('NEW:', canon(newF.appointments).slice(0,600)); }
}
(async () => {
  await cmp('employeeId', { startDate: '2026-08-01', endDate: '2026-08-20', employeeId: 'cmsqm2dkw00082lh7i214n9wt' },
    (w: any) => ({ ...w, OR: [{ employeeId: 'cmsqm2dkw00082lh7i214n9wt' }, { services: { some: { employeeId: 'cmsqm2dkw00082lh7i214n9wt' } } }] }));
  await cmp('serviceId', { startDate: '2026-08-01', endDate: '2026-08-20', serviceId: 'cmsq33b4m000023dzabmxl14r' },
    (w: any) => ({ ...w, OR: [{ serviceId: 'cmsq33b4m000023dzabmxl14r' }, { services: { some: { serviceId: 'cmsq33b4m000023dzabmxl14r' } } }] }));
  await cmp('employeeId AND serviceId', { startDate: '2026-08-01', endDate: '2026-08-20', employeeId: 'cmsqm2dkw00082lh7i214n9wt', serviceId: 'cmsq33b4m000023dzabmxl14r' },
    (w: any) => ({ ...w, AND: [{ OR: [{ employeeId: 'cmsqm2dkw00082lh7i214n9wt' }, { services: { some: { employeeId: 'cmsqm2dkw00082lh7i214n9wt' } } }] }, { OR: [{ serviceId: 'cmsq33b4m000023dzabmxl14r' }, { services: { some: { serviceId: 'cmsq33b4m000023dzabmxl14r' } } }] }] }));
  await cmp('cancelled window', { cancelledStartDate: '2026-08-10', cancelledEndDate: '2026-08-20' },
    (w: any) => ({ ...w, cancelledAt: { gte: new Date('2026-08-10T00:00:00Z'), lte: new Date('2026-08-20T23:59:59.999Z') } }));
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
