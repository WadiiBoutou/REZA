import type {
  AppointmentStatus,
  PrismaClient,
  SubscriptionPlan,
} from '../prisma/generated/prisma/client';
import { hashPassword } from '../src/utils/password';
import {
  avatarUrlFor,
  EMPLOYEE_WORKING_HOURS,
  PASSWORDS,
  REZA_ADMIN,
  REZA_ADMIN_HASHED_PASSWORD,
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
  cashTransactions?: Array<{ type: 'DEPOSIT' | 'WITHDRAWAL'; amount: number; notes?: string }>;
};

const REZA_SALON_1: SalonDef = {
  subdomain: 'reza-salon-1',
  name: 'Reza Salon Casablanca',
  email: 'contact@reza-salon1.ma',
  phone: '+212522000100',
  category: 'Coiffeur',
  address: 'Maarif, Casablanca',
  city: 'Casablanca',
  latitude: 33.573,
  longitude: -7.605,
  coverImage:
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=800&auto=format&fit=crop',
  shortDescription: 'Salon de coiffure moderne à Maarif',
  services: [
    {
      name: 'Coupe homme',
      duration: 30,
      price: 80,
      description: 'Coupe classique ou moderne',
      category: 'Coiffure',
      color: '#3B82F6',
    },
    {
      name: 'Coupe femme',
      duration: 60,
      price: 150,
      description: 'Coupe personnalisée',
      category: 'Coiffure',
      color: '#8B5CF6',
    },
    {
      name: 'Brushing',
      duration: 45,
      price: 100,
      description: 'Brushing professionnel',
      category: 'Coiffure',
      color: '#10B981',
    },
    {
      name: 'Coloration',
      duration: 90,
      price: 250,
      description: 'Coloration permanente',
      category: 'Couleur',
      color: '#F59E0B',
    },
  ],
  clients: [
    {
      firstName: 'Amine',
      lastName: 'El Ouazzani',
      email: 'amine.elouazzani@email.ma',
      phone: '+212600123401',
    },
    {
      firstName: 'Leila',
      lastName: 'Haddad',
      email: 'leila.haddad@email.ma',
      phone: '+212600123402',
    },
    {
      firstName: 'Hassan',
      lastName: 'Benali',
      email: 'hassan.benali@email.ma',
      phone: '+212600123403',
    },
  ],
  employees: [
    {
      firstName: 'Rachid',
      lastName: 'Tazi',
      email: 'rachid.tazi@reza-salon1.ma',
      color: '#7C3AED',
      role: 'Coiffeur',
    },
    {
      firstName: 'Sofia',
      lastName: 'Alaoui',
      email: 'sofia.alaoui@reza-salon1.ma',
      color: '#EC4899',
      role: 'Coloriste',
    },
  ],
  appointments: [
    {
      clientEmail: 'amine.elouazzani@email.ma',
      serviceName: 'Coupe homme',
      dayOffset: 0,
      hour: 10,
      status: 'CONFIRMED',
    },
    {
      clientEmail: 'leila.haddad@email.ma',
      serviceName: 'Brushing',
      dayOffset: 1,
      hour: 14,
      status: 'PENDING',
    },
    {
      clientEmail: 'hassan.benali@email.ma',
      serviceName: 'Coupe homme',
      dayOffset: -2,
      hour: 11,
      status: 'COMPLETED',
    },
    {
      clientEmail: 'leila.haddad@email.ma',
      serviceName: 'Coloration',
      dayOffset: 3,
      hour: 16,
      status: 'CONFIRMED',
    },
    {
      clientEmail: 'amine.elouazzani@email.ma',
      serviceName: 'Coupe homme',
      dayOffset: -5,
      hour: 15,
      status: 'NO_SHOW',
    },
  ],
  paidSales: [
    { clientEmail: 'hassan.benali@email.ma', serviceName: 'Coupe homme', amount: 80 },
    { clientEmail: 'leila.haddad@email.ma', serviceName: 'Brushing', amount: 100 },
  ],
  cashTransactions: [
    { type: 'DEPOSIT', amount: 500, notes: 'Dépôt initial' },
    { type: 'WITHDRAWAL', amount: 200, notes: 'Retrait pour fournitures' },
  ],
};

const REZA_SALON_2: SalonDef = {
  subdomain: 'reza-salon-2',
  name: 'Reza Salon Rabat',
  email: 'contact@reza-salon2.ma',
  phone: '+212537000101',
  category: 'Barbier',
  address: 'Agdal, Rabat',
  city: 'Rabat',
  latitude: 34.011,
  longitude: -6.849,
  coverImage:
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop',
  shortDescription: 'Barbier traditionnel à Agdal',
  services: [
    {
      name: 'Coupe + rasage',
      duration: 45,
      price: 120,
      description: 'Coupe et rasage traditionnel',
      category: 'Barbier',
      color: '#14B8A6',
    },
    {
      name: 'Soin barbe',
      duration: 30,
      price: 70,
      description: 'Soin complet de barbe',
      category: 'Barbier',
      color: '#3B82F6',
    },
    {
      name: 'Coupe classique',
      duration: 25,
      price: 60,
      description: 'Coupe homme classique',
      category: 'Barbier',
      color: '#8B5CF6',
    },
  ],
  clients: [
    {
      firstName: 'Younes',
      lastName: 'El Mansouri',
      email: 'younes.elmansouri@email.ma',
      phone: '+212600123501',
    },
    {
      firstName: 'Anas',
      lastName: 'Chraibi',
      email: 'anas.chraibi@email.ma',
      phone: '+212600123502',
    },
  ],
  employees: [
    {
      firstName: 'Karim',
      lastName: 'Idrissi',
      email: 'karim.idrissi@reza-salon2.ma',
      color: '#059669',
      role: 'Barbier',
    },
  ],
  appointments: [
    {
      clientEmail: 'younes.elmansouri@email.ma',
      serviceName: 'Coupe + rasage',
      dayOffset: 2,
      hour: 11,
      status: 'CONFIRMED',
    },
    {
      clientEmail: 'anas.chraibi@email.ma',
      serviceName: 'Soin barbe',
      dayOffset: 4,
      hour: 15,
      status: 'PENDING',
    },
    {
      clientEmail: 'younes.elmansouri@email.ma',
      serviceName: 'Coupe classique',
      dayOffset: -4,
      hour: 16,
      status: 'COMPLETED',
    },
  ],
  paidSales: [
    { clientEmail: 'younes.elmansouri@email.ma', serviceName: 'Coupe classique', amount: 60 },
  ],
  cashTransactions: [
    { type: 'DEPOSIT', amount: 300, notes: 'Dépôt initial' },
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
        avatar: avatarUrlFor(e.firstName, e.lastName, e.email),
        phone: '+212600000099',
        isActive: true,
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

  for (const tx of def.cashTransactions ?? []) {
    await prisma.cashTransaction.create({
      data: {
        tenantId: tenant.id,
        type: tx.type,
        amount: tx.amount,
        paymentMethod: 'CASH',
        notes: tx.notes,
        createdById: adminUserId,
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
export async function seedRezaAccount(prisma: PrismaClient, plan: SubscriptionPlan) {
  console.log('\n👑 Reza multi-salon account…');

  // Owner user on first salon tenant (tenant linked after account create)
  const adminUser = await prisma.user.create({
    data: {
      email: REZA_ADMIN.email,
      password: REZA_ADMIN_HASHED_PASSWORD,
      firstName: REZA_ADMIN.firstName,
      lastName: REZA_ADMIN.lastName,
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
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodEnd: periodEnd,
    },
  });

  const invoiceSeq = { n: 0 };
  const salon1 = await seedOneSalon(prisma, REZA_SALON_1, account.id, adminUser.id, invoiceSeq);
  await seedOneSalon(prisma, REZA_SALON_2, account.id, adminUser.id, invoiceSeq);

  // Admin JWT tenant = primary salon
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { tenantId: salon1.id },
  });

  console.log(
    `  ✓ Admin ${REZA_ADMIN.email} / ${PASSWORDS.rezaAdmin} → dashboard + Mes salons (2 salons)`
  );
}
