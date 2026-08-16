import { prisma } from './src/lib/prisma';
import { statsService } from './src/modules/stats/stats.service';
import { appointmentService } from './src/modules/appointment/appointment.service';
import { schedulingService } from './src/modules/appointment/scheduling.service';
import { bookingService } from './src/modules/public/services/booking.service';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function wh(dayIdx: number) {
  return DAYS.map((day, i) => ({
    day,
    isWorking: i === dayIdx,
    startTime: '09:00',
    endTime: '19:00',
    breaks: [{ start: '13:00', end: '14:00' }],
  }));
}

async function main() {
  const suffix = Date.now();
  const tenant = await prisma.tenant.create({
    data: {
      name: `Bench${suffix}`,
      email: `bench${suffix}@test.reza`,
      slug: `bench-${suffix}`,
      subscriptionActive: true,
    },
  });
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `admin${suffix}@test.reza`,
      password: 'x',
      phone: '+212600000000',
      firstName: 'Bench',
      lastName: 'Admin',
      role: 'ADMIN',
    },
  });

  // 6 services
  const services = [];
  for (let i = 0; i < 6; i++) {
    services.push(await prisma.service.create({
      data: { tenantId: tenant.id, name: `Svc${i}`, duration: 30 + i * 10, price: 100 + i * 50 },
    }));
  }

  // 4 employees + user rows
  const empUsers: string[] = [];
  for (let i = 0; i < 4; i++) {
    const u = await prisma.user.create({
      data: {
        tenantId: tenant.id, email: `emp${suffix}${i}@test.reza`, password: 'x', phone: `+2126${i}000000`,
        firstName: `Emp${i}`, lastName: 'X', role: 'STAFF',
      },
    });
    empUsers.push(u.id);
    const emp = await prisma.employee.create({
      data: {
        tenantId: tenant.id, firstName: `Emp${i}`, lastName: 'X', phone: `+2126${i}000000`,
        workingHours: wh(new Date('2026-08-17').getDay()), // Monday busy day
      },
    });
    for (const s of services) {
      await prisma.employeeService.create({ data: { employeeId: emp.id, serviceId: s.id } });
    }
  }

  // clients
  const clients = [];
  for (let i = 0; i < 36; i++) {
    clients.push(await prisma.client.create({
      data: { email: `c${suffix}${i}@test.reza`, firstName: `C${i}`, lastName: 'Z', phone: `+2127${String(i).padStart(9, '0')}` },
    }));
  }

  // 36 appointments on 2026-08-17 (a Monday), 09:00-19:00
  const day = new Date('2026-08-17T09:00:00.000Z');
  const appts = [];
  for (let i = 0; i < 36; i++) {
    const svc = services[i % services.length];
    const start = new Date(day.getTime() + i * 30 * 60000); // 30-min slots -> 36 slots = 9h..27h? use 09:00 + i*30min, cap at 18:00
    const startH = 9 + Math.floor((i * 30) / 60);
    const startM = (i * 30) % 60;
    if (startH >= 18) break;
    const s = new Date(Date.UTC(2026, 7, 17, startH, startM));
    const e = new Date(s.getTime() + svc.duration * 60000);
    appts.push(await prisma.appointment.create({
      data: {
        tenantId: tenant.id, clientId: clients[i].id, serviceId: svc.id,
        startTime: s, endTime: e, duration: svc.duration,
        status: 'CONFIRMED', source: 'STAFF', createdById: adminUser.id,
        employeeId: empUsers[i % empUsers.length],
      },
    }));
  }
  console.log('seeded', appts.length, 'appointments');

  const t0 = Date.now();
  const ov = await statsService.getOverview(tenant.id);
  const t1 = Date.now();
  console.log('stats/overview:', (t1 - t0) + 'ms');

  const t2 = Date.now();
  const ag = await appointmentService.getAppointments([tenant.id], { startDate: '2026-08-17', endDate: '2026-08-17' });
  const t3 = Date.now();
  console.log('agenda getAppointments:', (t3 - t2) + 'ms, rows:', ag.appointments.length);

  const t4 = Date.now();
  await schedulingService.planReservation({
    tenantId: tenant.id,
    serviceIds: [services[0].id],
    date: '2026-08-18',
    startTime: '10:00',
    clientId: clients[0].id,
  } as any);
  const t5 = Date.now();
  console.log('plan (solver):', (t5 - t4) + 'ms');

  const t6 = Date.now();
  const slots = await bookingService.getAvailableSlots(tenant.id, { date: '2026-08-18', serviceId: services[0].id } as any);
  const t7 = Date.now();
  console.log('available-slots:', (t7 - t6) + 'ms, slots:', Array.isArray(slots) ? slots.length : Object.keys(slots).length);

  // cleanup
  await prisma.appointment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.service.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.employee.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.client.deleteMany({ where: { email: { startsWith: `c${suffix}` } } });
  await prisma.tenant.delete({ where: { id: tenant.id } });
  console.log('cleaned up');
}

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
