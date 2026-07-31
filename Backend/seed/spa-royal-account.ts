import type {
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

type ReviewDef = {
  clientEmail: string;
  rating: number;
  comment: string;
  status: 'APPROVED' | 'PENDING';
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
  reviews?: ReviewDef[];
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
  reviews: [
    { clientEmail: 'fatima.alaoui@email.ma', rating: 5, comment: 'Superbe expérience ! Le hammam suivi du gommage était parfait.', status: 'APPROVED' },
    { clientEmail: 'yasmine.elamrani@email.ma', rating: 5, comment: 'Excellent massage relaxant. Sara est très professionnelle.', status: 'APPROVED' },
    { clientEmail: 'nawal.elfassi@email.ma', rating: 4, comment: 'Très bon accueil et cadre agréable.', status: 'PENDING' },
    { clientEmail: 'amina.benali@email.ma', rating: 3, comment: "Bien mais un peu d'attente.", status: 'PENDING' },
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
};

// ─── Seed one salon ────────────────────────────────────────────

async function seedOneSalon(
  prisma: PrismaClient,
  def: SalonDef,
  accountId: string
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
  for (const e of def.employees) {
    // User record (used by AppointmentServiceItem.employeeId)
    await prisma.user.create({
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

    // Selective EmployeeService links
    const svcList = e.serviceIndices.map((idx) => {
      const s = def.services[idx];
      const svc = services.get(s.name);
      return svc ? { employeeId: emp.id, serviceId: svc.id } : null;
    }).filter(Boolean) as { employeeId: string; serviceId: string }[];

    await prisma.employeeService.createMany({ data: svcList, skipDuplicates: true });
  }

  // ── Reviews ───────────────────────────────────────────────────
  for (const r of def.reviews ?? []) {
    const clientId = clients.get(r.clientEmail);
    if (!clientId) continue;
    await prisma.review.create({
      data: {
        tenantId: tenant.id,
        clientId,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
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
    `${def.employees.length} employés`
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

  const casa = await seedOneSalon(prisma, SPA_ROYAL_CASA, account.id);
  await seedOneSalon(prisma, SPA_ROYAL_2, account.id);

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
