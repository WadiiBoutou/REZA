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
  SPA_ROYAL_ADMIN,
  TENANT_BUSINESS_HOURS,
} from './constants';

// ─── Helpers ───────────────────────────────────────────────────

function atDayOffset(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

// ─── Types ─────────────────────────────────────────────────────

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
  withPassword?: boolean;
};

type EmployeeDef = {
  firstName: string;
  lastName: string;
  email: string;
  color: string;
  role: string;
  /** Indices into the salon's services array that this employee performs */
  serviceIndices: number[];
};

type AppointmentServiceDef = {
  serviceName: string;
  /** Email of the employee (Staff User) who performs this service */
  employeeEmail?: string;
};

type AppointmentDef = {
  clientEmail: string;
  /** One or more services for this appointment (enables multi-service) */
  services: AppointmentServiceDef[];
  dayOffset: number;
  hour: number;
  minute?: number;
  status: AppointmentStatus;
};

type PaidSaleDef = {
  clientEmail: string;
  serviceName: string;
  amount: number;
};

type CashTxDef = {
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  notes?: string;
};

type ReviewDef = {
  clientEmail: string;
  appointmentClientEmail: string;
  rating: number;
  comment: string;
  status: 'APPROVED' | 'PENDING';
};

type NotificationDef = {
  type: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
};

type FamilyMemberDef = {
  clientEmail: string;
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string;
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
  paidSales?: PaidSaleDef[];
  cashTransactions?: CashTxDef[];
  reviews?: ReviewDef[];
  notifications?: NotificationDef[];
  familyMembers?: FamilyMemberDef[];
};

// ─── DATA ──────────────────────────────────────────────────────

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
    { name: 'Hammam traditionnel', duration: 60, price: 200, description: 'Hammam avec gommage au savon beldi', category: 'Spa', color: '#6366F1' },
    { name: 'Massage relaxant', duration: 60, price: 250, description: 'Massage corps complet aux huiles essentielles', category: 'Massage', color: '#8B5CF6' },
    { name: 'Gommage argan', duration: 45, price: 180, description: "Gommage corps à l'huile d'argan", category: 'Spa', color: '#10B981' },
    { name: 'Soin visage premium', duration: 50, price: 220, description: 'Soin visage hydratant et éclat', category: 'Soin', color: '#EC4899' },
    { name: 'Manucure complète', duration: 45, price: 150, description: 'Manucure soin complet avec vernis', category: 'Manucure', color: '#F59E0B' },
    { name: 'Épilation jambes', duration: 30, price: 90, description: 'Épilation à la cire jambes complètes', category: 'Esthétique', color: '#EF4444' },
  ],
  clients: [
    { firstName: 'Client', lastName: 'Demo', email: 'client1@gmail.com', phone: '+212612345678', withPassword: true },
    { firstName: 'Yasmine', lastName: 'El Amrani', email: 'yasmine.elamrani@email.ma', phone: '+212661234501' },
    { firstName: 'Omar', lastName: 'Benjelloun', email: 'omar.benjelloun@email.ma', phone: '+212661234502' },
    { firstName: 'Fatima', lastName: 'Zahra Alaoui', email: 'fatima.alaoui@email.ma', phone: '+212661234503' },
    { firstName: 'Amina', lastName: 'Benali', email: 'amina.benali@email.ma', phone: '+212661234504' },
    { firstName: 'Nawal', lastName: 'El Fassi', email: 'nawal.elfassi@email.ma', phone: '+212661234505' },
  ],
  employees: [
    {
      firstName: 'Sara', lastName: 'Benali', email: 'sara.benali@spa-royal.ma',
      color: '#7C3AED', role: 'Masseuse',
      serviceIndices: [0, 1, 2], // Hammam, Massage, Gommage
    },
    {
      firstName: 'Nadia', lastName: 'Tazi', email: 'nadia.tazi@spa-royal.ma',
      color: '#EC4899', role: 'Esthéticienne',
      serviceIndices: [3, 4, 2], // Soin visage, Manucure, Gommage
    },
    {
      firstName: 'Karim', lastName: 'Ouazzani', email: 'karim.ouazzani@spa-royal.ma',
      color: '#F59E0B', role: 'Spa Thérapeute',
      serviceIndices: [0, 1, 5], // Hammam, Massage, Épilation
    },
    {
      firstName: 'Salma', lastName: 'El Fassi', email: 'salma.elfassi@spa-royal.ma',
      color: '#10B981', role: 'Hammam Thérapeute',
      serviceIndices: [0, 2], // Hammam, Gommage
    },
    {
      firstName: 'Hicham', lastName: 'Alaoui', email: 'hicham.alaoui@spa-royal.ma',
      color: '#3B82F6', role: 'Massothérapeute',
      serviceIndices: [1, 3], // Massage, Soin visage
    },
  ],
  appointments: [
    // Past multi-service (COMPLETED)
    {
      clientEmail: 'fatima.alaoui@email.ma',
      services: [
        { serviceName: 'Hammam traditionnel', employeeEmail: 'salma.elfassi@spa-royal.ma' },
        { serviceName: 'Gommage argan', employeeEmail: 'karim.ouazzani@spa-royal.ma' },
      ],
      dayOffset: -5, hour: 11, status: 'COMPLETED',
    },
    // Past single-service (COMPLETED)
    {
      clientEmail: 'yasmine.elamrani@email.ma',
      services: [{ serviceName: 'Massage relaxant', employeeEmail: 'sara.benali@spa-royal.ma' }],
      dayOffset: -3, hour: 14, status: 'COMPLETED',
    },
    // Past cancelled
    {
      clientEmail: 'nawal.elfassi@email.ma',
      services: [{ serviceName: 'Soin visage premium', employeeEmail: 'nadia.tazi@spa-royal.ma' }],
      dayOffset: -2, hour: 10, status: 'CANCELLED',
    },
    // Past no-show
    {
      clientEmail: 'amina.benali@email.ma',
      services: [{ serviceName: 'Gommage argan', employeeEmail: 'sara.benali@spa-royal.ma' }],
      dayOffset: -1, hour: 16, status: 'NO_SHOW',
    },
    // Today multi-service (CONFIRMED)
    {
      clientEmail: 'yasmine.elamrani@email.ma',
      services: [
        { serviceName: 'Soin visage premium', employeeEmail: 'nadia.tazi@spa-royal.ma' },
        { serviceName: 'Manucure complète', employeeEmail: 'nadia.tazi@spa-royal.ma' },
      ],
      dayOffset: 0, hour: 15, status: 'CONFIRMED',
    },
    // Tomorrow multi-service (CONFIRMED) — 3 services across 3 employees
    {
      clientEmail: 'client1@gmail.com',
      services: [
        { serviceName: 'Hammam traditionnel', employeeEmail: 'sara.benali@spa-royal.ma' },
        { serviceName: 'Massage relaxant', employeeEmail: 'hicham.alaoui@spa-royal.ma' },
        { serviceName: 'Gommage argan', employeeEmail: 'salma.elfassi@spa-royal.ma' },
      ],
      dayOffset: 1, hour: 9, status: 'CONFIRMED',
    },
    // Day after tomorrow multi-service (CONFIRMED)
    {
      clientEmail: 'omar.benjelloun@email.ma',
      services: [
        { serviceName: 'Massage relaxant', employeeEmail: 'sara.benali@spa-royal.ma' },
        { serviceName: 'Soin visage premium', employeeEmail: 'hicham.alaoui@spa-royal.ma' },
      ],
      dayOffset: 2, hour: 14, status: 'CONFIRMED',
    },
    // Future single-service (PENDING)
    {
      clientEmail: 'nawal.elfassi@email.ma',
      services: [{ serviceName: 'Épilation jambes', employeeEmail: 'karim.ouazzani@spa-royal.ma' }],
      dayOffset: 4, hour: 11, status: 'PENDING',
    },
    // Future single-service (CONFIRMED)
    {
      clientEmail: 'amina.benali@email.ma',
      services: [{ serviceName: 'Hammam traditionnel', employeeEmail: 'karim.ouazzani@spa-royal.ma' }],
      dayOffset: 6, hour: 10, status: 'CONFIRMED',
    },
  ],
  paidSales: [
    { clientEmail: 'fatima.alaoui@email.ma', serviceName: 'Hammam traditionnel', amount: 200 },
    { clientEmail: 'fatima.alaoui@email.ma', serviceName: 'Gommage argan', amount: 180 },
  ],
  cashTransactions: [
    { type: 'DEPOSIT', amount: 5000, notes: 'Dépôt initial fonds de caisse' },
    { type: 'WITHDRAWAL', amount: 300, notes: 'Retrait fournitures spa' },
    { type: 'DEPOSIT', amount: 380, notes: 'Règlement Fatima — Soin complet' },
    { type: 'WITHDRAWAL', amount: 150, notes: 'Petites fournitures' },
  ],
  reviews: [
    { clientEmail: 'fatima.alaoui@email.ma', appointmentClientEmail: 'fatima.alaoui@email.ma', rating: 5, comment: 'Superbe expérience ! Le hammam suivi du gommage était parfait.', status: 'APPROVED' },
    { clientEmail: 'yasmine.elamrani@email.ma', appointmentClientEmail: 'yasmine.elamrani@email.ma', rating: 5, comment: 'Excellent massage relaxant. Sara est très professionnelle.', status: 'APPROVED' },
    { clientEmail: 'nawal.elfassi@email.ma', appointmentClientEmail: 'nawal.elfassi@email.ma', rating: 4, comment: 'Très bon accueil et cadre agréable.', status: 'PENDING' },
    { clientEmail: 'amina.benali@email.ma', appointmentClientEmail: 'amina.benali@email.ma', rating: 3, comment: 'Bien mais un peu d\'attente.', status: 'PENDING' },
  ],
  notifications: [
    { type: 'APPOINTMENT_NEW', title: 'Nouveau rendez-vous', message: 'Nouveau pack détente — Yasmine El Amrani (15:00)', link: '/dashboard/rendez-vous', isRead: false },
    { type: 'APPOINTMENT_CONFIRMED', title: 'Rendez-vous confirmé', message: 'Client Demo — Pack bien-être confirmé pour demain 09:00', link: '/dashboard/rendez-vous', isRead: false },
    { type: 'REVIEW_PENDING', title: 'Avis en attente', message: '2 nouveaux avis clients sont en attente de modération', link: '/dashboard/clients/mes-avis/avis-a-moderer', isRead: false },
    { type: 'APPOINTMENT_REMINDER', title: 'Rappel', message: 'Yasmine a RDV aujourd\'hui à 15h (Soin visage + Manucure)', link: '/dashboard/rendez-vous', isRead: false },
    { type: 'SYSTEM', title: 'Abonnement', message: 'Votre abonnement Standard est actif', link: '/dashboard/mes-salons', isRead: true },
  ],
  familyMembers: [
    { clientEmail: 'fatima.alaoui@email.ma', firstName: 'Hassan', lastName: 'Alaoui', relationship: 'Époux', phone: '+212661234601' },
    { clientEmail: 'nawal.elfassi@email.ma', firstName: 'Imane', lastName: 'El Fassi', relationship: 'Sœur', phone: '+212661234602' },
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
    { name: 'Manucure spa', duration: 45, price: 120, description: 'Manucure soin complet', category: 'Manucure', color: '#EC4899' },
    { name: 'Pédicure royale', duration: 55, price: 140, description: 'Pédicure avec massage des pieds', category: 'Manucure', color: '#8B5CF6' },
    { name: 'Massage dos express', duration: 30, price: 150, description: 'Massage ciblé dos et nuque', category: 'Massage', color: '#3B82F6' },
  ],
  clients: [
    { firstName: 'Karim', lastName: 'Idrissi', email: 'karim.idrissi@email.ma', phone: '+212661234601' },
    { firstName: 'Salma', lastName: 'Chraibi', email: 'salma.chraibi@email.ma', phone: '+212661234602' },
  ],
  employees: [
    {
      firstName: 'Laila', lastName: 'Moussaoui', email: 'laila.moussaoui@spa-royal-2.ma',
      color: '#14B8A6', role: 'Spa praticienne',
      serviceIndices: [0, 1, 2],
    },
  ],
  appointments: [
    {
      clientEmail: 'karim.idrissi@email.ma',
      services: [{ serviceName: 'Manucure spa', employeeEmail: 'laila.moussaoui@spa-royal-2.ma' }],
      dayOffset: 3, hour: 14, status: 'CONFIRMED',
    },
    {
      clientEmail: 'salma.chraibi@email.ma',
      services: [{ serviceName: 'Pédicure royale', employeeEmail: 'laila.moussaoui@spa-royal-2.ma' }],
      dayOffset: 5, hour: 11, status: 'PENDING',
    },
    {
      clientEmail: 'karim.idrissi@email.ma',
      services: [{ serviceName: 'Massage dos express', employeeEmail: 'laila.moussaoui@spa-royal-2.ma' }],
      dayOffset: -3, hour: 16, status: 'COMPLETED',
    },
  ],
  paidSales: [
    { clientEmail: 'karim.idrissi@email.ma', serviceName: 'Massage dos express', amount: 150 },
  ],
};

// ─── Seed one salon ────────────────────────────────────────────

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

  // ── Services ──────────────────────────────────────────────────
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
        competences: [s.category],
      },
    });
    services.set(s.name, { id: row.id, duration: row.duration, price: row.price });
  }

  // ── Clients (with optional password) ───────────────────────────
  const clients = new Map<string, string>();
  const clientPassword = await hashPassword(PASSWORDS.client);
  for (const c of def.clients) {
    const row = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        password: c.withPassword ? clientPassword : undefined,
        status: 'ACTIVE',
      },
    });
    clients.set(c.email, row.id);
  }

  // ── Employees (Employee record + User record with STAFF role) ──
  const userByEmail = new Map<string, string>(); // email → User.id
  const employeeByEmail = new Map<string, string>(); // email → Employee.id

  for (const e of def.employees) {
    // User record (used by AppointmentServiceItem.employeeId)
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: e.email,
        password: await hashPassword('staff123'),
        firstName: e.firstName,
        lastName: e.lastName,
        role: 'STAFF',
        avatar: avatarUrlFor(e.firstName, e.lastName, e.email),
        isActive: true,
      },
    });
    userByEmail.set(e.email, user.id);

    // Employee record (used for scheduling / working hours)
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
    employeeByEmail.set(e.email, emp.id);

    // Selective EmployeeService links
    const svcList = e.serviceIndices.map((idx) => {
      const s = def.services[idx];
      const svc = services.get(s.name);
      return svc ? { employeeId: emp.id, serviceId: svc.id } : null;
    }).filter(Boolean) as { employeeId: string; serviceId: string }[];

    await prisma.employeeService.createMany({ data: svcList, skipDuplicates: true });
  }

  // ── Appointments with service items ────────────────────────────
  // Track completed appointments for review mapping
  const completedAppointmentsByClient = new Map<string, string[]>();

  for (const appt of def.appointments) {
    const clientId = clients.get(appt.clientEmail);
    if (!clientId) continue;

    // Compute total duration from all services
    const serviceDefs = appt.services.map((s) => {
      const svc = services.get(s.serviceName);
      return { ...s, id: svc?.id ?? null, duration: svc?.duration ?? 0, price: svc?.price ?? 0 };
    });
    const totalDuration = serviceDefs.reduce((sum, s) => sum + s.duration, 0);
    const start = atDayOffset(appt.dayOffset, appt.hour, appt.minute ?? 0);
    const end = addMinutes(start, totalDuration);
    const primaryService = serviceDefs[0];

    const row = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        clientId,
        serviceId: primaryService.id,
        createdById: adminUserId,
        startTime: start,
        endTime: end,
        duration: totalDuration,
        status: appt.status,
        notes: `Seed — ${appt.services.map((s) => s.serviceName).join(' + ')}`,
      },
    });

    // Create AppointmentServiceItem records (multi-service support)
    if (serviceDefs.length > 0) {
      await prisma.appointmentServiceItem.createMany({
        data: serviceDefs.map((s, idx) => ({
          appointmentId: row.id,
          serviceId: s.id,
          employeeId: s.employeeEmail ? userByEmail.get(s.employeeEmail) ?? null : null,
          serviceName: s.serviceName,
          duration: s.duration,
          price: s.price,
          sortOrder: idx,
        })),
      });
    }

    if (appt.status === 'COMPLETED') {
      const existing = completedAppointmentsByClient.get(appt.clientEmail) || [];
      existing.push(row.id);
      completedAppointmentsByClient.set(appt.clientEmail, existing);
    }
  }

  // ── Invoices for completed + paidSales ─────────────────────────
  for (const appt of def.appointments) {
    if (appt.status !== 'COMPLETED') continue;
    const clientId = clients.get(appt.clientEmail);
    if (!clientId) continue;

    const totalAmount = appt.services.reduce((sum, s) => {
      const svc = services.get(s.serviceName);
      return sum + (svc?.price ?? 0);
    }, 0);

    invoiceSeq.n += 1;

    // Find the appointment row we just created
    const apptRow = await prisma.appointment.findFirst({
      where: { tenantId: tenant.id, clientId, status: 'COMPLETED' },
      orderBy: { startTime: 'desc' },
    });
    if (!apptRow) continue;

    await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        clientId,
        appointmentId: apptRow.id,
        invoiceNumber: `INV-SPA-${String(invoiceSeq.n).padStart(4, '0')}`,
        amount: totalAmount,
        tax: 0,
        total: totalAmount,
        status: 'PAID',
        paymentMethod: 'CASH',
        paidAt: addMinutes(apptRow.startTime, totalAmount > 200 ? 75 : 45),
        items: {
          create: appt.services.map((s) => {
            const svc = services.get(s.serviceName);
            return { serviceId: svc?.id, serviceName: s.serviceName, price: svc?.price ?? 0, quantity: 1 };
          }),
        },
      },
    });
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
        invoiceNumber: `INV-SPA-${String(invoiceSeq.n).padStart(4, '0')}`,
        amount: sale.amount,
        tax: 0,
        total: sale.amount,
        status: 'PAID',
        paymentMethod: 'CARD',
        paidAt: new Date(),
        items: { create: { serviceId: svc?.id, serviceName: sale.serviceName, price: sale.amount, quantity: 1 } },
      },
    });
  }

  // ── Cash Transactions ──────────────────────────────────────────
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

  // ── Reviews (tied to appointments if available) ─────────────────
  for (const r of def.reviews ?? []) {
    const clientId = clients.get(r.clientEmail);
    if (!clientId) continue;
    const apptIds = completedAppointmentsByClient.get(r.appointmentClientEmail);
    await prisma.review.create({
      data: {
        tenantId: tenant.id,
        clientId,
        appointmentId: apptIds?.[0] ?? null,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
      },
    });
  }

  // ── Notifications ──────────────────────────────────────────────
  for (const n of def.notifications ?? []) {
    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        userId: adminUserId,
        type: n.type as any,
        title: n.title,
        message: n.message,
        link: n.link,
        isRead: n.isRead,
        readAt: n.isRead ? new Date() : null,
      },
    });
  }

  // ── Family Members ─────────────────────────────────────────────
  for (const fm of def.familyMembers ?? []) {
    const clientId = clients.get(fm.clientEmail);
    if (!clientId) continue;
    await prisma.familyMember.create({
      data: { clientId, firstName: fm.firstName, lastName: fm.lastName, relationship: fm.relationship, phone: fm.phone },
    });
  }

  console.log(
    `  ✓ ${def.name} — ${def.clients.length} clients, ${def.services.length} services, ` +
    `${def.employees.length} employés, ${def.appointments.length} RDV ` +
    `(${def.appointments.filter(a => a.services.length > 1).length} multi-services)`
  );
  return tenant;
}

// ─── Entry point ────────────────────────────────────────────────

export async function seedSpaRoyalAccount(prisma: PrismaClient, plan: SubscriptionPlan) {
  console.log('\n👑 Spa Royal multi-salon account…');

  const adminPassword = await hashPassword(PASSWORDS.admin);

  const adminUser = await prisma.user.create({
    data: {
      email: SPA_ROYAL_ADMIN.email,
      password: adminPassword,
      firstName: SPA_ROYAL_ADMIN.firstName,
      lastName: SPA_ROYAL_ADMIN.lastName,
      role: 'ADMIN',
      tenantId: null,
      isActive: true,
    },
  });

  const account = await prisma.account.create({
    data: { ownerUserId: adminUser.id, isActive: true },
  });

  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  await prisma.subscription.create({
    data: { accountId: account.id, planId: plan.id, status: 'ACTIVE', currentPeriodEnd: periodEnd },
  });

  const invoiceSeq = { n: 0 };
  const casa = await seedOneSalon(prisma, SPA_ROYAL_CASA, account.id, adminUser.id, invoiceSeq);
  await seedOneSalon(prisma, SPA_ROYAL_2, account.id, adminUser.id, invoiceSeq);

  // Subscription invoice (after salons exist so tenantId is available)
  await prisma.invoice.create({
    data: {
      tenantId: casa.id,
      accountId: account.id,
      type: 'SUBSCRIPTION',
      invoiceNumber: `INV-SUB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-0001`,
      amount: 800,
      tax: 0,
      total: 800,
      status: 'PAID',
      paymentMethod: 'BANK_TRANSFER',
      paidAt: new Date(),
      periodStart: new Date(),
      periodEnd,
      notes: 'Standard — Annuel',
    },
  });

  // Admin JWT tenant = primary salon
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { tenantId: casa.id },
  });

  console.log(
    `  ✓ Admin ${SPA_ROYAL_ADMIN.email} / ${PASSWORDS.admin} → dashboard + Mes salons (2 salons)`
  );
}
