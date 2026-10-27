import type {
  AppointmentStatus,
  PrismaClient,
} from '../prisma/generated/prisma/client';
import { hashPassword } from '../src/utils/password';
import {
  EMPLOYEE_WORKING_HOURS,
  PASSWORDS,
  SPA_ROYAL_ADMIN,
  TENANT_BUSINESS_HOURS,
} from './constants';

type ServiceDef = {
  name: string;
  duration: number;
  price: number;
  description: string;
  category: string;
  color?: string;
};

type ClientDef = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type EmployeeDef = {
  firstName: string;
  lastName: string;
  email: string;
  color: string;
  role: string;
};

type AppointmentDef = {
  clientEmail: string;
  serviceName: string;
  /** Days from today (negative = past) */
  dayOffset: number;
  hour: number;
  minute?: number;
  duration?: number;
  status: AppointmentStatus;
};

type SalonDef = {
  subdomain: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  coverImage: string;
  shortDescription: string;
  services: ServiceDef[];
  clients: ClientDef[];
  employees: EmployeeDef[];
  appointments: AppointmentDef[];
  /** PAID invoices for client spend stats (clientEmail → amount) */
  paidSales?: Array<{ clientEmail: string; serviceName: string; amount: number }>;
};

const SPA_ROYAL_CASA: SalonDef = {
  subdomain: 'spa-royal',
  name: 'Spa Royal Casablanca',
  email: 'contact@sparoyal.ma',
  phone: '+212522000003',
  category: 'Spa',
  address: 'Oasis, Casablanca',
  city: 'Casablanca',
  latitude: 33.555,
  longitude: -7.636,
  coverImage:
    'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=800&auto=format&fit=crop',
  shortDescription: 'Spa et hammam à Oasis',
  services: [
    {
      name: 'Hammam traditionnel',
      duration: 60,
      price: 200,
      description: 'Hammam avec gommage au savon beldi',
      category: 'Spa',
      color: '#3B82F6',
    },
    {
      name: 'Massage relaxant',
      duration: 60,
      price: 250,
      description: 'Massage corps complet aux huiles',
      category: 'Massage',
      color: '#8B5CF6',
    },
    {
      name: 'Gommage argan',
      duration: 45,
      price: 180,
      description: "Gommage corps à l'huile d'argan",
      category: 'Spa',
      color: '#10B981',
    },
    {
      name: 'Soin visage premium',
      duration: 50,
      price: 220,
      description: 'Soin visage hydratant et éclat',
      category: 'Soin',
      color: '#F59E0B',
    },
  ],
  clients: [
    {
      firstName: 'Yasmine',
      lastName: 'El Amrani',
      email: 'yasmine.elamrani@email.ma',
      phone: '+212661234501',
    },
    {
      firstName: 'Omar',
      lastName: 'Benjelloun',
      email: 'omar.benjelloun@email.ma',
      phone: '+212661234502',
    },
    {
      firstName: 'Fatima',
      lastName: 'Zahra Alaoui',
      email: 'fatima.alaoui@email.ma',
      phone: '+212661234503',
    },
  ],
  employees: [
    {
      firstName: 'Sara',
      lastName: 'Benali',
      email: 'sara.benali@spa-royal.ma',
      color: '#7C3AED',
      role: 'Esthéticienne',
    },
    {
      firstName: 'Nadia',
      lastName: 'Tazi',
      email: 'nadia.tazi@spa-royal.ma',
      color: '#EC4899',
      role: 'Massothérapeute',
    },
  ],
  appointments: [
    {
      clientEmail: 'yasmine.elamrani@email.ma',
      serviceName: 'Hammam traditionnel',
      dayOffset: 4,
      hour: 10,
      minute: 0,
      status: 'CONFIRMED',
    },
    {
      clientEmail: 'omar.benjelloun@email.ma',
      serviceName: 'Massage relaxant',
      dayOffset: 4,
      hour: 10,
      minute: 0,
      status: 'PENDING',
    },
    {
      clientEmail: 'fatima.alaoui@email.ma',
      serviceName: 'Gommage argan',
      dayOffset: -5,
      hour: 11,
      status: 'COMPLETED',
    },
    {
      clientEmail: 'omar.benjelloun@email.ma',
      serviceName: 'Massage relaxant',
      dayOffset: 7,
      hour: 15,
      status: 'CONFIRMED',
    },
  ],
  paidSales: [
    { clientEmail: 'omar.benjelloun@email.ma', serviceName: 'Massage relaxant', amount: 250 },
    { clientEmail: 'omar.benjelloun@email.ma', serviceName: 'Hammam traditionnel', amount: 200 },
    { clientEmail: 'fatima.alaoui@email.ma', serviceName: 'Gommage argan', amount: 180 },
  ],
};

const SPA_ROYAL_2: SalonDef = {
  subdomain: 'spa-royal-2',
  name: 'Spa Royal 2',
  email: 'contact@spa-royal2.ma',
  phone: '+212537000004',
  category: 'Spa',
  address: 'Agdal, Rabat',
  city: 'Rabat',
  latitude: 34.003,
  longitude: -6.853,
  coverImage:
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=800&auto=format&fit=crop',
  shortDescription: 'Spa urbain à Rabat',
  services: [
    {
      name: 'Manucure spa',
      duration: 45,
      price: 120,
      description: 'Manucure soin complet',
      category: 'Manucure',
      color: '#EC4899',
    },
    {
      name: 'Pédicure royale',
      duration: 55,
      price: 140,
      description: 'Pédicure avec massage des pieds',
      category: 'Manucure',
      color: '#8B5CF6',
    },
    {
      name: 'Massage dos express',
      duration: 30,
      price: 150,
      description: 'Massage ciblé dos et nuque',
      category: 'Massage',
      color: '#3B82F6',
    },
  ],
  clients: [
    {
      firstName: 'Karim',
      lastName: 'Idrissi',
      email: 'karim.idrissi@email.ma',
      phone: '+212661234601',
    },
    {
      firstName: 'Salma',
      lastName: 'Chraibi',
      email: 'salma.chraibi@email.ma',
      phone: '+212661234602',
    },
  ],
  employees: [
    {
      firstName: 'Laila',
      lastName: 'Moussaoui',
      email: 'laila.moussaoui@spa-royal-2.ma',
      color: '#14B8A6',
      role: 'Spa praticienne',
    },
  ],
  appointments: [
    {
      clientEmail: 'karim.idrissi@email.ma',
      serviceName: 'Manucure spa',
      dayOffset: 3,
      hour: 14,
      status: 'CONFIRMED',
    },
    {
      clientEmail: 'salma.chraibi@email.ma',
      serviceName: 'Pédicure royale',
      dayOffset: 5,
      hour: 11,
      status: 'PENDING',
    },
    {
      clientEmail: 'karim.idrissi@email.ma',
      serviceName: 'Massage dos express',
      dayOffset: -3,
      hour: 16,
      status: 'COMPLETED',
    },
  ],
  paidSales: [
    { clientEmail: 'karim.idrissi@email.ma', serviceName: 'Massage dos express', amount: 150 },
  ],
};

function atDayOffset(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function seedOneSalon(
  prisma: PrismaClient,
  def: SalonDef,
  accountId: string,
  adminUserId: string,
  invoiceSeq: { n: number }
) {
  const tenant = await prisma.tenant.create({
    data: {
      name: def.name,
      subdomain: def.subdomain,
      email: def.email,
      phone: def.phone,
      address: def.address,
      category: def.category,
      coverImage: def.coverImage,
      shortDescription: def.shortDescription,
      city: def.city,
      latitude: def.latitude,
      longitude: def.longitude,
      googleMapsLink: `https://maps.google.com/?q=${def.latitude},${def.longitude}`,
      isActive: true,
      subscriptionActive: true,
      employeesPaid: def.employees.length,
      tags: [def.category.toLowerCase(), def.city.toLowerCase()],
      accountId,
    },
  });

  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      timezone: 'Africa/Casablanca',
      currency: 'MAD',
      language: 'fr',
      bookingAdvanceDays: 30,
      cancellationHours: 24,
      businessHours: TENANT_BUSINESS_HOURS,
      photos: [def.coverImage],
      description: def.shortDescription,
      featured: true,
      showOnlineReservation: true,
      onlineReservationEnabled: true,
      showReviews: true,
      showMap: true,
      showOpeningHours: true,
    },
  });

  const services = new Map<string, { id: string; duration: number; price: number | null }>();
  for (const s of def.services) {
    const row = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: s.name,
        abbreviation: s.name.slice(0, 8).toUpperCase().replace(/\s+/g, ''),
        description: s.description,
        category: s.category,
        color: s.color ?? '#111827',
        price: s.price,
        priceType: 'FIXED',
        duration: s.duration,
        visibility: 'BOOKABLE',
        competences: [],
      },
    });
    services.set(s.name, { id: row.id, duration: row.duration, price: row.price });
  }

  const clients = new Map<string, string>();
  for (const c of def.clients) {
    const row = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        status: 'ACTIVE',
      },
    });
    clients.set(c.email, row.id);
  }

  for (const e of def.employees) {
    const emp = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: '+212600000099',
        isActive: true,
        isPublic: true,
        workingHours: EMPLOYEE_WORKING_HOURS,
        agendaSettings: {
          color: e.color,
          role: e.role,
          timeSlotDuration: 30,
          bufferTime: 5,
          maxAppointmentsPerDay: 14,
          allowOnlineBooking: true,
          status: 'active',
        },
      },
    });
    await prisma.employeeService.createMany({
      data: [...services.values()].map((svc) => ({
        employeeId: emp.id,
        serviceId: svc.id,
      })),
    });
  }

  for (const appt of def.appointments) {
    const clientId = clients.get(appt.clientEmail);
    const svc = services.get(appt.serviceName);
    if (!clientId || !svc) continue;

    const start = atDayOffset(appt.dayOffset, appt.hour, appt.minute ?? 0);
    const duration = appt.duration ?? svc.duration;
    const end = new Date(start.getTime() + duration * 60_000);

    const row = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        clientId,
        serviceId: svc.id,
        createdById: adminUserId,
        startTime: start,
        endTime: end,
        duration,
        status: appt.status,
        notes: 'Seed demo',
      },
    });

    if (appt.status === 'COMPLETED') {
      invoiceSeq.n += 1;
      const amount = svc.price ?? 0;
      await prisma.invoice.create({
        data: {
          tenantId: tenant.id,
          clientId,
          appointmentId: row.id,
          invoiceNumber: `INV-${def.subdomain.toUpperCase()}-${String(invoiceSeq.n).padStart(4, '0')}`,
          amount,
          tax: 0,
          total: amount,
          status: 'PAID',
          paymentMethod: 'CASH',
          paidAt: end,
          items: {
            create: {
              serviceId: svc.id,
              serviceName: appt.serviceName,
              price: amount,
              quantity: 1,
            },
          },
        },
      });
    }
  }

  for (const sale of def.paidSales ?? []) {
    const clientId = clients.get(sale.clientEmail);
    const svc = services.get(sale.serviceName);
    if (!clientId) continue;

    invoiceSeq.n += 1;
    await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        clientId,
        invoiceNumber: `INV-${def.subdomain.toUpperCase()}-${String(invoiceSeq.n).padStart(4, '0')}`,
        amount: sale.amount,
        tax: 0,
        total: sale.amount,
        status: 'PAID',
        paymentMethod: 'CARD',
        paidAt: new Date(),
        items: {
          create: {
            serviceId: svc?.id,
            serviceName: sale.serviceName,
            price: sale.amount,
            quantity: 1,
          },
        },
      },
    });
  }

  console.log(
    `  ✓ ${def.name} — ${def.clients.length} clients, ${def.services.length} services, ${def.appointments.length} RDV`
  );
  return tenant;
}

/**
 * One account, two salons, shared admin login.
 */
export async function seedSpaRoyalAccount(prisma: PrismaClient) {
  console.log('\n👑 Spa Royal multi-salon account…');

  const adminPassword = await hashPassword(PASSWORDS.admin);

  // Owner user on first salon tenant (tenant linked after account create)
  const adminUser = await prisma.user.create({
    data: {
      email: SPA_ROYAL_ADMIN.email,
      password: adminPassword,
      firstName: SPA_ROYAL_ADMIN.firstName,
      lastName: SPA_ROYAL_ADMIN.lastName,
      phone: '+212522000003',
      role: 'ADMIN',
      tenantId: null,
      isActive: true,
    },
  });

  const account = await prisma.account.create({
    data: {
      ownerUserId: adminUser.id,
      isActive: true,
    },
  });

  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  await prisma.subscription.create({
    data: {
      accountId: account.id,
      status: 'ACTIVE',
      salonsPaid: 2,
      subscribedAt: new Date(),
      currentPeriodEnd: periodEnd,
    },
  });

  const invoiceSeq = { n: 0 };
  const casa = await seedOneSalon(prisma, SPA_ROYAL_CASA, account.id, adminUser.id, invoiceSeq);
  await seedOneSalon(prisma, SPA_ROYAL_2, account.id, adminUser.id, invoiceSeq);

  // Admin JWT tenant = primary salon
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { tenantId: casa.id },
  });

  console.log(
    `  ✓ Admin ${SPA_ROYAL_ADMIN.email} / ${PASSWORDS.admin} → dashboard + Mes salons (2 salons)`
  );
}
