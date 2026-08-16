import { prisma } from './src/lib/prisma';
import { appointmentService } from './src/modules/appointment/appointment.service';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const wh = (dayIdx: number) => DAYS.map((day, i) => ({ day, isWorking: i === dayIdx, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] }));

async function main() {
  const suffix = Date.now();
  const tenant = await prisma.tenant.create({ data: { name: `Bench${suffix}`, email: `bench${suffix}@t.reza`, slug: `bench-${suffix}`, subscriptionActive: true } });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, email: `a${suffix}@t.reza`, password: 'x', phone: '+212600000000', firstName: 'B', lastName: 'A', role: 'ADMIN' } });
  const services = [];
  for (let i = 0; i < 6; i++) services.push(await prisma.service.create({ data: { tenantId: tenant.id, name: `S${i}`, duration: 30 + i * 10, price: 100 + i * 50 } }));
  const empUsers: string[] = [];
  for (let i = 0; i < 4; i++) {
    const u = await prisma.user.create({ data: { tenantId: tenant.id, email: `e${suffix}${i}@t.reza`, password: 'x', phone: `+2126${i}000000`, firstName: `E${i}`, lastName: 'X', role: 'STAFF' } });
    empUsers.push(u.id);
    const emp = await prisma.employee.create({ data: { tenantId: tenant.id, firstName: `E${i}`, lastName: 'X', phone: `+2126${i}000000`, workingHours: wh(1) } });
    for (const s of services) await prisma.employeeService.create({ data: { employeeId: emp.id, serviceId: s.id } });
  }
  const clients = [];
  for (let i = 0; i < 36; i++) clients.push(await prisma.client.create({ data: { email: `c${suffix}${i}@t.reza`, firstName: `C${i}`, lastName: 'Z', phone: `+2127${String(i).padStart(9, '0')}` } }));
  let n = 0;
  for (let h = 9; h < 18 && n < 36; h++) {
    for (let m = 0; m < 60 && n < 36; m += 20) {
      const svc = services[n % services.length];
      const s = new Date(Date.UTC(2026, 7, 17, h, m));
      await prisma.appointment.create({ data: { tenantId: tenant.id, clientId: clients[n].id, serviceId: svc.id, startTime: s, endTime: new Date(s.getTime() + svc.duration * 60000), duration: svc.duration, status: 'CONFIRMED', source: 'STAFF', createdById: admin.id, employeeId: empUsers[n % 4] } });
      n++;
    }
  }
  console.log('seeded', n, 'appointments on 2026-08-17');
  // warm
  await appointmentService.getAppointments([tenant.id], { startDate: '2026-08-17', endDate: '2026-08-17' });
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const r = await appointmentService.getAppointments([tenant.id], { startDate: '2026-08-17', endDate: '2026-08-17' });
    times.push(Date.now() - t0);
    console.log(`run ${i}: ${Date.now() - t0}ms rows ${r.appointments.length}`);
  }
  console.log('avg:', (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0) + 'ms');
  await prisma.appointment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.service.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.employee.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.client.deleteMany({ where: { email: { startsWith: `c${suffix}` } } });
  await prisma.tenant.delete({ where: { id: tenant.id } });
  console.log('cleaned up');
}
main().catch((e) => { console.error('FAIL', e); process.exit(1); });
