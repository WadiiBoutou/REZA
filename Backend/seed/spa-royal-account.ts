import type {
  PrismaClient,
  SubscriptionPlan,
} from '../prisma/generated/prisma/client';
import { hashPassword } from '../src/utils/password';
import {
  avatarUrlFor,
  birthDateFor,
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
  /** Override the deterministic birth date if needed */
  dateOfBirth?: string;
  /** Pin the client's createdAt (drives nouveaux-clients / frequences stats windows) */
  createdAtDaysAgo?: number;
};

function daysAgoDate(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

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

export const SPA_ROYAL_CASA: SalonDef = {
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
    // ── Recent (last 30 days → nouveaux-clients current window) ──
    { firstName: 'Imane', lastName: 'Berrada', email: 'imane.berrada@email.ma', phone: '+212661234510', createdAtDaysAgo: 5 },
    { firstName: 'Sara', lastName: 'El Amri', email: 'sara.elamri@email.ma', phone: '+212661234511', createdAtDaysAgo: 8 },
    { firstName: 'Mehdi', lastName: 'Naciri', email: 'mehdi.naciri@email.ma', phone: '+212661234512', createdAtDaysAgo: 12 },
    { firstName: 'Salma', lastName: 'Lahlou', email: 'salma.lahlou@email.ma', phone: '+212661234513', createdAtDaysAgo: 15 },
    { firstName: 'Youssef', lastName: 'Benkiran', email: 'youssef.benkiran@email.ma', phone: '+212661234514', createdAtDaysAgo: 18 },
    { firstName: 'Kenza', lastName: 'Zouiten', email: 'kenza.zouiten@email.ma', phone: '+212661234515', createdAtDaysAgo: 21 },
    { firstName: 'Adil', lastName: 'El Malki', email: 'adil.elmalki@email.ma', phone: '+212661234516', createdAtDaysAgo: 25 },
    { firstName: 'Rania', lastName: 'Bouzidi', email: 'rania.bouzidi@email.ma', phone: '+212661234517', createdAtDaysAgo: 28 },
    // ── Mid (30–58 days ago → previous-period delta window) ──
    { firstName: 'Nisrine', lastName: 'Chahid', email: 'nisrine.chahid@email.ma', phone: '+212661234518', createdAtDaysAgo: 32 },
    { firstName: 'Walid', lastName: 'El Hamidi', email: 'walid.elhamidi@email.ma', phone: '+212661234519', createdAtDaysAgo: 35 },
    { firstName: 'Douae', lastName: 'Lamrani', email: 'douae.lamrani@email.ma', phone: '+212661234520', createdAtDaysAgo: 38 },
    { firstName: 'Reda', lastName: 'Sebti', email: 'reda.sebti@email.ma', phone: '+212661234521', createdAtDaysAgo: 42 },
    { firstName: 'Ilham', lastName: 'Faris', email: 'ilham.faris@email.ma', phone: '+212661234522', createdAtDaysAgo: 45 },
    { firstName: 'Zakaria', lastName: 'Idrissi', email: 'zakaria.idrissi@email.ma', phone: '+212661234523', createdAtDaysAgo: 48 },
    { firstName: 'Hafsa', lastName: 'Bennani', email: 'hafsa.bennani@email.ma', phone: '+212661234524', createdAtDaysAgo: 52 },
    { firstName: 'Marouane', lastName: 'El Fahsi', email: 'marouane.elfahsi@email.ma', phone: '+212661234525', createdAtDaysAgo: 56 },
    // ── Older (60–120 days ago) ──
    { firstName: 'Ghita', lastName: 'Soufiani', email: 'ghita.soufiani@email.ma', phone: '+212661234526', createdAtDaysAgo: 62 },
    { firstName: 'Anass', lastName: 'Loukili', email: 'anass.loukili@email.ma', phone: '+212661234527', createdAtDaysAgo: 68 },
    { firstName: 'Mouna', lastName: 'Belkadi', email: 'mouna.belkadi@email.ma', phone: '+212661234528', createdAtDaysAgo: 74 },
    { firstName: 'Soufiane', lastName: 'Guennoun', email: 'soufiane.guennoun@email.ma', phone: '+212661234529', createdAtDaysAgo: 80 },
    { firstName: 'Latifa', lastName: 'Meskini', email: 'latifa.meskini@email.ma', phone: '+212661234530', createdAtDaysAgo: 86 },
    { firstName: 'Hamza', lastName: 'Talbi', email: 'hamza.talbi@email.ma', phone: '+212661234531', createdAtDaysAgo: 92 },
    { firstName: 'Nada', lastName: 'El Yousfi', email: 'nada.elyousfi@email.ma', phone: '+212661234532', createdAtDaysAgo: 98 },
    { firstName: 'Badr', lastName: 'Charki', email: 'badr.charki@email.ma', phone: '+212661234533', createdAtDaysAgo: 104 },
    { firstName: 'Siham', lastName: 'Kabli', email: 'siham.kabli@email.ma', phone: '+212661234534', createdAtDaysAgo: 110 },
    { firstName: 'Omar', lastName: 'Sekkat', email: 'omar.sekkat@email.ma', phone: '+212661234535', createdAtDaysAgo: 115 },
    { firstName: 'Rajae', lastName: 'Belhaj', email: 'rajae.belhaj@email.ma', phone: '+212661234536', createdAtDaysAgo: 118 },
    { firstName: 'Tarek', lastName: 'Ziani', email: 'tarek.ziani@email.ma', phone: '+212661234537', createdAtDaysAgo: 120 },
    // ── Duplicate pairs (flagged by /clients/fichier-client/doublons) ──
    { firstName: 'Hind', lastName: 'Alaoui', email: 'hind.alaoui@email.ma', phone: '+212661234801' },
    { firstName: 'Hinde', lastName: 'Alaoui', email: 'hinde.alaoui@email.ma', phone: '+212661234801' },
    { firstName: 'Nizar', lastName: 'El Fassi', email: 'nizar.elfassi@email.ma', phone: '+212661234802' },
    { firstName: 'Nissar', lastName: 'El Fassi', email: 'nizar.elfassi@email.ma', phone: '+212661234803' },
    { firstName: 'Salma', lastName: 'Bennani', email: 'salma.bennani@email.ma', phone: '+212661234804' },
    { firstName: 'Salima', lastName: 'Bennani', email: 'salima.bennani@email.ma', phone: '+212661234804' },
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
    // ── Added for pagination / stats volume testing ──
    {
      firstName: 'Imane', lastName: 'Chraibi', email: 'imane.chraibi@spa-royal.ma',
      color: '#0EA5E9', role: 'Esthéticienne',
      serviceIndices: [3, 4],
    },
    {
      firstName: 'Samira', lastName: 'Berrada', email: 'samira.berrada@spa-royal.ma',
      color: '#F97316', role: 'Massothérapeute',
      serviceIndices: [1, 2],
    },
    {
      firstName: 'Yassine', lastName: 'El Idrissi', email: 'yassine.elidrissi@spa-royal.ma',
      color: '#84CC16', role: 'Hammam Thérapeute',
      serviceIndices: [0, 2],
    },
    {
      firstName: 'Khadija', lastName: 'Bennani', email: 'khadija.bennani@spa-royal.ma',
      color: '#D946EF', role: 'Spa praticienne',
      serviceIndices: [0, 1, 3],
    },
    {
      firstName: 'Mehdi', lastName: 'Zouiten', email: 'mehdi.zouiten@spa-royal.ma',
      color: '#06B6D4', role: 'Massothérapeute',
      serviceIndices: [1, 5],
    },
    {
      firstName: 'Hanane', lastName: 'El Amrani', email: 'hanane.elamrani@spa-royal.ma',
      color: '#A855F7', role: 'Esthéticienne',
      serviceIndices: [3, 4, 5],
    },
    {
      firstName: 'Amine', lastName: 'Benslimane', email: 'amine.benslimane@spa-royal.ma',
      color: '#EAB308', role: 'Spa Thérapeute',
      serviceIndices: [0, 1, 2, 5],
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

/**
 * Everything a downstream consumer (test-data seeding) needs to reference
 * the entities created inside this salon.
 */
export type SeededSalonCtx = {
  tenant: { id: string; name: string };
  /** email → client id */
  clients: Map<string, string>;
  /** service name → { id, duration, price } */
  services: Map<string, { id: string; duration: number; price: number | null }>;
  /** STAFF user records (used as AppointmentServiceItem.employeeId / creator) */
  staffUsers: { id: string; firstName: string; lastName: string }[];
};

async function seedOneSalon(
  prisma: PrismaClient,
  def: SalonDef,
  accountId: string
): Promise<SeededSalonCtx> {
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
        // Deterministic birth date → the "Répartition par âge" stat has data
        dateOfBirth: c.dateOfBirth ?? birthDateFor(c.email),
        createdAt: c.createdAtDaysAgo ? daysAgoDate(c.createdAtDaysAgo) : undefined,
      },
    });
    clients.set(c.email, row.id);
  }

  // ── Employees (Employee record + User record with STAFF role) ──
  const staffUsers: SeededSalonCtx['staffUsers'] = [];
  for (const e of def.employees) {
    // User record (used by AppointmentServiceItem.employeeId)
    const staffUser = await prisma.user.create({
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
    staffUsers.push({ id: staffUser.id, firstName: e.firstName, lastName: e.lastName });

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
  return { tenant, clients, services, staffUsers };
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

  // Demo billing state: only the FIRST salon is paid for (one-time salon fee
  // covered). The second salon stays hidden from the public site until the
  // owner declares a virement payment and the superadmin approves it.
  await prisma.subscription.create({
    data: {
      accountId: account.id,
      planId: plan.id,
      status: 'ACTIVE',
      salonsPaid: 1,
      subscribedAt: new Date(),
      currentPeriodEnd: periodEnd,
    },
  });

  const casa = await seedOneSalon(prisma, SPA_ROYAL_CASA, account.id);
  await seedOneSalon(prisma, SPA_ROYAL_2, account.id);

  // Public visibility follows salon coverage: only the paid salon is visible
  await prisma.tenant.updateMany({
    where: { accountId: account.id },
    data: { subscriptionActive: false },
  });
  await prisma.tenant.update({
    where: { id: casa.tenant.id },
    data: { subscriptionActive: true },
  });

  // Cover all current employees of the paid salon for the demo period
  const spaTenants = await prisma.tenant.findMany({
    where: { accountId: account.id },
    include: { _count: { select: { employees: { where: { isActive: true } } } } },
  });
  await Promise.all(
    spaTenants.map((t) =>
      prisma.tenant.update({
        where: { id: t.id },
        data: { employeesPaid: Math.max(0, t._count.employees - 2) },
      })
    )
  );

  // Admin JWT tenant = primary salon
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { tenantId: casa.tenant.id },
  });

  console.log(
    `  ✓ Admin ${SPA_ROYAL_ADMIN.email} / ${PASSWORDS.admin} → dashboard + Mes salons (2 salons)`
  );

  return { casa, adminUserId: adminUser.id };
}
