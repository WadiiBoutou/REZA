/**
 * REZA data refill — wipes ALL appointment / invoice / review / caisse data
 * while KEEPING the accounts (admins, staff, clients, tenants, settings,
 * services, employees, subscriptions), then regenerates a large realistic
 * dataset so every admin feature is testable end-to-end.
 *
 * Run from Backend/:
 *   npm run seed:refill        → refill data on existing accounts
 *   npm run seed               → full reset (cleanup + accounts + refill)
 *
 * Billing scenario installed by this script (drives the virement flow tests):
 *   - Reza account   → FULLY PAID: both salons covered, all employees covered
 *                      → everything public (clean baseline).
 *   - Spa Royal      → PARTIALLY PAID: salon #2 hidden (added past salonsPaid),
 *                      only 6 of the paid salon's employees covered (the rest
 *                      are sliced out of the public page), with a PENDING
 *                      virement declaration awaiting superadmin approval.
 *
 * NOTE: duplicate client pairs (Doublons page) and the large employee/client
 * counts (pagination triggers) live in the base account seeds — run `npm run
 * seed` (or seed:refill against a DB seeded after this change) to have them.
 */
import { prisma } from '../src/lib/prisma';
import type { PrismaClient } from '../prisma/generated/prisma/client';
import { hashPassword } from '../src/utils/password';
import { subscriptionService } from '../src/modules/subscription/subscription.service';
import { avatarUrlFor } from './constants';

// ─── Deterministic RNG ─────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260806);

const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const round2 = (n: number) => Math.round(n * 100) / 100;
const hex4 = () => Math.floor(rand() * 0xffff).toString(16).padStart(4, '0').toUpperCase();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedPick<T>(pairs: [T, number][]): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) {
    r -= w;
    if (r <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

function daysAgo(n: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, randInt(0, 3) * 15, 0, 0);
  return d;
}

// ─── Types ─────────────────────────────────────────────────────

type TenantCtx = {
  tenant: { id: string; name: string; subdomain: string; accountId: string | null };
  clients: { id: string; firstName: string; lastName: string; phone: string | null }[];
  services: { id: string; name: string; duration: number; price: number | null }[];
  staffUsers: { id: string; firstName: string; lastName: string }[];
  adminUserId: string;
  /** serviceId → user ids qualified to perform it */
  staffForService: Map<string, string[]>;
};

type ServiceItem = {
  serviceId: string;
  serviceName: string;
  duration: number;
  price: number;
  employeeId: string;
};

// ─── Content pools ─────────────────────────────────────────────

const CANCELLATION_REASONS = [
  "Annulé par le client",
  "Empêchement de dernière minute",
  "Raison familiale",
  "Déplacement imprévu",
  "Emploi du temps chargé",
  "Changement de programme",
  "Horaires de l'employé modifiés",
  "Employé absent",
  "Doublon de réservation",
  "Surbooking agenda",
];

const REVIEW_COMMENTS = [
  "Excellent service, très professionnel. Je recommande vivement !",
  "Très bon accueil, cadre agréable et propre.",
  "Superbe expérience, je reviendrai !",
  "Très satisfaite du soin, personnel à l'écoute.",
  "Bon rapport qualité/prix, je recommande.",
  "Expérience moyenne, un peu d'attente.",
  "Le service était correct mais sans plus.",
  "Déçu par l'accueil, le soin était moyen.",
  "Personnel très gentil et compétent.",
  "Ambiance relaxante, excellent massage.",
  "Prestation au top, merci !",
  "Très propre et professionnel, parfait.",
];

const REJECT_REASONS = [
  "Avis hors sujet",
  "Langage inapproprié",
  "Contenu promotionnel",
  "Informations personnelles partagées",
  "Avis non lié à une prestation réelle",
];

const WITHDRAWAL_NOTES = [
  "Loyer local",
  "Fournitures",
  "Électricité",
  "Eau",
  "Produits d'entretien",
  "Achat cire et huiles",
  "Maintenance équipement",
  "Publicité locale",
];

const PROCHES = [
  { firstName: 'Hassan', lastName: 'Alaoui', relationship: 'Époux' },
  { firstName: 'Khadija', lastName: 'Bennis', relationship: 'Épouse' },
  { firstName: 'Imane', lastName: 'Tazi', relationship: 'Sœur' },
  { firstName: 'Mehdi', lastName: 'Chraibi', relationship: 'Frère' },
  { firstName: 'Lina', lastName: 'Berrada', relationship: 'Fille' },
  { firstName: 'Adam', lastName: 'El Fassi', relationship: 'Fils' },
  { firstName: 'Salma', lastName: 'Zouiten', relationship: 'Mère' },
  { firstName: 'Rachid', lastName: 'Benjelloun', relationship: 'Père' },
  { firstName: 'Nora', lastName: 'Sekkat', relationship: 'Amie' },
  { firstName: 'Yasmine', lastName: 'Kabli', relationship: 'Cousine' },
];

// ─── Wipe (keeps accounts) ─────────────────────────────────────

export async function wipeData(prismaClient: PrismaClient) {
  await prismaClient.bookingParticipant.deleteMany();
  await prismaClient.invoiceItem.deleteMany();
  await prismaClient.invoice.deleteMany();
  await prismaClient.review.deleteMany();
  await prismaClient.cashTransaction.deleteMany();
  await prismaClient.notification.deleteMany();
  await prismaClient.appointmentServiceItem.deleteMany();
  await prismaClient.appointment.deleteMany();
  await prismaClient.bookingGroup.deleteMany();
  await prismaClient.favorite.deleteMany();
  await prismaClient.familyMember.deleteMany();
  await prismaClient.subscriptionPayment.deleteMany();
}

// ─── Billing scenario ──────────────────────────────────────────

async function setBillingScenario(prismaClient: PrismaClient) {
  const superadmin = await prismaClient.user.findFirst({ where: { role: 'SUPER_ADMIN' } });

  const accounts = await prismaClient.account.findMany({
    include: {
      tenants: {
        include: { _count: { select: { employees: { where: { isActive: true } } } } },
      },
    },
  });

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 86400000);

  for (const account of accounts) {
    const subs = account.tenants.map((t) => t.subdomain);
    const isReza = subs.includes('reza-salon-1');
    const isSpa = subs.includes('spa-royal');
    if (!isReza && !isSpa) continue; // unknown account — leave as-is

    const upsertSub = (data: { status: 'ACTIVE'; salonsPaid: number; subscribedAt: Date; currentPeriodEnd: Date }) =>
      prismaClient.subscription.upsert({
        where: { accountId: account.id },
        create: { accountId: account.id, ...data },
        update: data,
      });

    const mkPayment = (data: object) =>
      prismaClient.subscriptionPayment.create({ data: { accountId: account.id, ...data } as any });

    // A PAID virement approval is reflected as a SUBSCRIPTION invoice (the
    // "Mes factures" historique reads SUBSCRIPTION-type invoices by account).
    const mkSubInvoice = (data: { tenantId: string; amount: number; periodStart: Date; periodEnd: Date }) =>
      prismaClient.invoice.create({
        data: {
          tenantId: data.tenantId,
          accountId: account.id,
          type: 'SUBSCRIPTION',
          invoiceNumber: `INV-SUB-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${hex4()}`,
          amount: data.amount,
          tax: 0,
          total: data.amount,
          status: 'PAID',
          paidAt: data.periodStart,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          notes: 'Abonnement Reza Pro — Mensuel',
          createdAt: data.periodStart,
        } as any,
      });

    if (isReza) {
      // Fully paid baseline: 2 salons + all employees covered → everything public
      const subscribedAt = new Date(now.getTime() - 60 * 86400000);
      await upsertSub({ status: 'ACTIVE', salonsPaid: 2, subscribedAt, currentPeriodEnd: periodEnd });
      for (const t of account.tenants) {
        await prismaClient.tenant.update({
          where: { id: t.id },
          data: { subscriptionActive: true, employeesPaid: Math.max(0, t._count.employees - 2) },
        });
      }
      await mkPayment({
        amount: 2000,
        currency: 'MAD',
        status: 'APPROVED',
        reference: 'VIR-REZA-0001',
        details: { salonsDue: 2, employeesDue: 0, employeesBySalon: {} },
        declaredById: account.ownerUserId ?? null,
        approvedById: superadmin?.id ?? null,
        approvedAt: subscribedAt,
        createdAt: subscribedAt,
      });
      const rezaTenant = account.tenants.find((t) => t.subdomain === 'reza-salon-1')!;
      await mkSubInvoice({
        tenantId: rezaTenant.id,
        amount: 2000,
        periodStart: subscribedAt,
        periodEnd: new Date(subscribedAt.getTime() + 30 * 86400000),
      });
    } else if (isSpa) {
      // Enforcement case: salon #2 hidden, only 6 of the paid salon's employees covered,
      // PENDING virement for the difference (salon fee + 4 uncovered employees).
      const subscribedAt = new Date(now.getTime() - 30 * 86400000);
      await upsertSub({ status: 'ACTIVE', salonsPaid: 1, subscribedAt, currentPeriodEnd: periodEnd });
      for (const t of account.tenants) {
        const isCasa = t.subdomain === 'spa-royal';
        await prismaClient.tenant.update({
          where: { id: t.id },
          data: { subscriptionActive: isCasa, employeesPaid: isCasa ? 6 : 0 },
        });
      }
      // History: one rejected attempt, then the approved original salon fee
      await mkPayment({
        amount: 500,
        currency: 'MAD',
        status: 'REJECTED',
        reference: 'VIR-SPA-0001',
        rejectedReason: 'Virement non reçu sur le compte de la plateforme. Merci de renvoyer la preuve.',
        details: { salonsDue: 1, employeesDue: 0, employeesBySalon: {} },
        declaredById: account.ownerUserId ?? null,
        createdAt: new Date(now.getTime() - 15 * 86400000),
      });
      await mkPayment({
        amount: 1000,
        currency: 'MAD',
        status: 'APPROVED',
        reference: 'VIR-SPA-0002',
        details: { salonsDue: 1, employeesDue: 0, employeesBySalon: {} },
        declaredById: account.ownerUserId ?? null,
        approvedById: superadmin?.id ?? null,
        approvedAt: subscribedAt,
        createdAt: subscribedAt,
      });
      const casaTenant = account.tenants.find((t) => t.subdomain === 'spa-royal')!;
      await mkSubInvoice({
        tenantId: casaTenant.id,
        amount: 1000,
        periodStart: subscribedAt,
        periodEnd: new Date(subscribedAt.getTime() + 30 * 86400000),
      });
      // PENDING = the exact live bill, computed via the real service so the
      // amount always reconciles with what the admin sees on Mon abonnement
      // (even if the superadmin changed the BillingConfig pricing).
      const bill = await subscriptionService.computeBill(account.id);
      await mkPayment({
        amount: bill.total,
        currency: bill.config.currency,
        status: 'PENDING',
        reference: 'VIR-SPA-0003',
        details: {
          salonsDue: bill.salonsDue,
          employeesDue: bill.employeesDue,
          employeesBySalon: bill.employeesBySalon,
        },
        declaredById: account.ownerUserId ?? null,
        createdAt: now,
      });
    }
  }
}

// ─── Tenant context ────────────────────────────────────────────

async function loadTenantCtx(prismaClient: PrismaClient, tenant: { id: string; name: string; subdomain: string }): Promise<TenantCtx> {
  const [clients, services, users, employees, employeeServices] = await Promise.all([
    prismaClient.client.findMany({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
    prismaClient.service.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, duration: true, price: true },
    }),
    prismaClient.user.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    }),
    prismaClient.employee.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    }),
    prismaClient.employeeService.findMany({
      where: { employee: { tenantId: tenant.id } },
      select: { employeeId: true, serviceId: true },
    }),
  ]);

  // The reza-account seed only creates Employee rows (no STAFF User records), but
  // AppointmentServiceItem references User — ensure every employee has one.
  const userByEmail = new Map(users.filter((u) => u.email).map((u) => [u.email, u]));
  const createdUsers: typeof users = [];
  const missingUsers = employees.filter((e) => e.email && !userByEmail.has(e.email));
  if (missingUsers.length > 0) {
    const hashed = await hashPassword('staff123');
    for (const e of missingUsers) {
      const u = await prismaClient.user.create({
        data: {
          tenantId: tenant.id,
          email: e.email!,
          password: hashed,
          firstName: e.firstName,
          lastName: e.lastName,
          phone: e.phone,
          role: 'STAFF',
          isActive: true,
          avatar: avatarUrlFor(e.firstName, e.lastName, e.email!),
        },
      });
      userByEmail.set(e.email!, u);
      createdUsers.push(u);
    }
  }
  const allUsers = [...users, ...createdUsers];

  const empEmailToId = new Map(employees.map((e) => [e.email, e.id]));

  // Staff users = users whose email matches an Employee record (seed convention).
  // Fallback: any STAFF/RECEPTIONIST user if the match fails (UI-created accounts).
  let staffUsers = allUsers.filter((u) => u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN' && empEmailToId.has(u.email));
  if (staffUsers.length === 0) {
    staffUsers = allUsers.filter((u) => u.role === 'STAFF' || u.role === 'RECEPTIONIST');
  }
  if (staffUsers.length === 0) staffUsers = allUsers;

  const staffForService = new Map<string, string[]>();
  for (const es of employeeServices) {
    const emp = employees.find((e) => e.id === es.employeeId);
    const user = emp?.email ? userByEmail.get(emp.email) : undefined;
    if (!user) continue;
    const list = staffForService.get(es.serviceId) ?? [];
    list.push(user.id);
    staffForService.set(es.serviceId, list);
  }
  // Any service with no qualified user can be done by any staff member
  for (const s of services) {
    if (!staffForService.has(s.id)) {
      staffForService.set(s.id, staffUsers.map((u) => u.id));
    }
  }

  const adminUserId =
    allUsers.find((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN')?.id ?? allUsers[0]?.id ?? staffUsers[0]?.id;
  if (!adminUserId) throw new Error(`No user found for tenant ${tenant.name}`);

  return {
    tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain, accountId: null },
    clients,
    services,
    staffUsers: staffUsers.map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
    adminUserId,
    staffForService,
  };
}

// ─── Appointment shape helpers ─────────────────────────────────

function buildServiceItems(ctx: TenantCtx, count: number): ServiceItem[] {
  const picked = shuffle(ctx.services).slice(0, count);
  const items: ServiceItem[] = [];
  const usedEmp = new Set<string>();
  for (const svc of picked) {
    const pool = ctx.staffForService.get(svc.id) ?? ctx.staffUsers.map((u) => u.id);
    const unused = pool.filter((id) => !usedEmp.has(id));
    const emp = unused.length > 0 ? unused[Math.floor(rand() * unused.length)] : pool[Math.floor(rand() * pool.length)];
    usedEmp.add(emp);
    items.push({
      serviceId: svc.id,
      serviceName: svc.name,
      duration: svc.duration,
      price: svc.price ?? 0,
      employeeId: emp,
    });
  }
  return items;
}

function randomDayOffset(): number {
  const bucket = weightedPick([[0, 45], [30, 30], [60, 15], [90, 10]]);
  return bucket + Math.floor(rand() * 30); // 0-29 / 30-59 / 60-89 / 90-119
}

function startTimeFor(totalDuration: number): Date {
  for (let i = 0; i < 25; i++) {
    const d = new Date();
    d.setDate(d.getDate() - randomDayOffset());
    if (d.getDay() === 0) continue; // Sunday closed
    const isSat = d.getDay() === 6;
    const open = isSat ? 10 : 9;
    const close = isSat ? 18 : 19;
    const latest = close - totalDuration / 60;
    if (latest < open) continue;
    const hour = open + Math.floor(rand() * (Math.floor(latest) - open + 1));
    const minute = randInt(0, 3) * 15;
    d.setHours(hour, minute, 0, 0);
    return d;
  }
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  return d;
}

function pickStatusSource() {
  const status = weightedPick([
    ['COMPLETED', 52],
    ['CONFIRMED', 14],
    ['PENDING', 5],
    ['NO_SHOW', 8],
    ['CANCELLED', 21],
  ] as [string, number][]);
  const source = status === 'CANCELLED' ? (rand() < 0.65 ? 'ONLINE' : 'STAFF') : rand() < 0.4 ? 'ONLINE' : 'STAFF';
  return { status, source };
}

function pickCancellation(ctx: TenantCtx, clientId: string) {
  const byClient = rand() < 0.55;
  return { cancelledBy: byClient ? clientId : pick(ctx.staffUsers).id, reason: pick(CANCELLATION_REASONS) };
}

// ─── Create appointment ────────────────────────────────────────

async function createAppointment(
  prismaClient: PrismaClient,
  ctx: TenantCtx,
  spec: {
    startTime: Date;
    status: string;
    source: string;
    clientId: string;
    services: ServiceItem[];
    bookingGroupId?: string;
    cancelledBy?: string;
    cancellationReason?: string;
  }
) {
  const startTime = spec.startTime;
  const duration = spec.services.reduce((s, it) => s + it.duration, 0);
  const endTime = new Date(startTime.getTime() + duration * 60000);
  const isCancelled = spec.status === 'CANCELLED';
  const createdById = spec.source === 'ONLINE' ? ctx.adminUserId : spec.services[0].employeeId;

  const appt = await prismaClient.appointment.create({
    data: {
      tenantId: ctx.tenant.id,
      clientId: spec.clientId,
      serviceId: spec.services[0].serviceId,
      employeeId: spec.services[0].employeeId,
      createdById,
      startTime,
      endTime,
      duration,
      status: spec.status,
      source: spec.source,
      notes: spec.source === 'ONLINE' ? 'Réservé via le site web' : undefined,
      bookingGroupId: spec.bookingGroupId ?? undefined,
      ...(isCancelled
        ? {
            cancelledAt: new Date(startTime.getTime() - 2 * 3600000),
            cancelledBy: spec.cancelledBy,
            cancellationReason: spec.cancellationReason,
          }
        : {}),
      services: {
        create: spec.services.map((s, i) => ({
          serviceId: s.serviceId,
          employeeId: s.employeeId,
          serviceName: s.serviceName,
          duration: s.duration,
          price: s.price,
          sortOrder: i,
        })),
      },
    } as any,
  });
  return appt;
}

// ─── Invoices / cash / reviews / family ────────────────────────

async function createInvoice(
  prismaClient: PrismaClient,
  ctx: TenantCtx,
  opts: {
    clientId?: string;
    appointmentId?: string;
    bookingGroupId?: string;
    items: { serviceId?: string; serviceName: string; price: number; participantName?: string }[];
    status: 'PAID' | 'PENDING' | 'CANCELLED';
    paymentMethod: string;
    createdAt: Date;
  }
) {
  const amount = round2(opts.items.reduce((s, it) => s + it.price, 0));
  const y = opts.createdAt.getFullYear();
  const m = String(opts.createdAt.getMonth() + 1).padStart(2, '0');
  return prismaClient.invoice.create({
    data: {
      tenantId: ctx.tenant.id,
      clientId: opts.clientId ?? null,
      appointmentId: opts.appointmentId ?? null,
      bookingGroupId: opts.bookingGroupId ?? null,
      type: 'SALE',
      invoiceNumber: `INV-${y}${m}-${hex4()}`,
      amount,
      tax: 0,
      total: amount,
      status: opts.status,
      paymentMethod: opts.paymentMethod,
      paidAt: opts.status === 'PAID' ? opts.createdAt : null,
      createdAt: opts.createdAt,
      items: {
        create: opts.items.map((it) => ({
          serviceId: it.serviceId ?? null,
          serviceName: it.serviceName,
          price: it.price,
          quantity: 1,
          participantName: it.participantName ?? null,
        })),
      },
    } as any,
  });
}

async function generateCashTx(prismaClient: PrismaClient, ctx: TenantCtx, count: number) {
  for (let i = 0; i < count; i++) {
    const type = weightedPick([
      ['DEPOSIT', 75],
      ['WITHDRAWAL', 20],
      ['REFUND', 5],
    ]);
    const amount =
      type === 'DEPOSIT' ? randInt(20, 1500) : type === 'WITHDRAWAL' ? randInt(100, 2500) : randInt(30, 300);
    const pm = weightedPick([
      ['CASH', 50],
      ['CARD', 30],
      ['BANK_TRANSFER', 10],
      ['ONLINE', 10],
    ]);
    await prismaClient.cashTransaction.create({
      data: {
        tenantId: ctx.tenant.id,
        type,
        amount: round2(amount),
        paymentMethod: pm,
        notes: type === 'WITHDRAWAL' ? pick(WITHDRAWAL_NOTES) : type === 'REFUND' ? 'Remboursement client' : null,
        createdById: pick(ctx.staffUsers).id,
        createdAt: daysAgo(randInt(0, 119), randInt(9, 18)),
      } as any,
    });
  }
}

async function generateReviews(
  prismaClient: PrismaClient,
  ctx: TenantCtx,
  count: number,
  completedAppts: { id: string; clientId: string; startTime: Date }[]
) {
  if (completedAppts.length === 0) return 0;
  let created = 0;
  for (let i = 0; i < count; i++) {
    const appt = pick(completedAppts);
    const rating = weightedPick([
      [5, 45],
      [4, 35],
      [3, 12],
      [2, 5],
      [1, 3],
    ]);
    const status = weightedPick([
      ['APPROVED', 55],
      ['PENDING', 30],
      ['REJECTED', 15],
    ]);
    const createdAt = new Date(appt.startTime.getTime() + randInt(1, 3) * 86400000);
    await prismaClient.review.create({
      data: {
        tenantId: ctx.tenant.id,
        clientId: appt.clientId,
        appointmentId: appt.id,
        rating,
        comment: pick(REVIEW_COMMENTS),
        status,
        moderatedBy: status === 'PENDING' ? null : pick(ctx.staffUsers).id,
        moderatedAt: status === 'PENDING' ? null : createdAt,
        rejectReason: status === 'REJECTED' ? pick(REJECT_REASONS) : null,
        createdAt,
      } as any,
    });
    created++;
  }
  return created;
}

async function generateFamilyMembers(prismaClient: PrismaClient, ctx: TenantCtx, count: number) {
  for (let i = 0; i < count; i++) {
    const client = pick(ctx.clients);
    const p = pick(PROCHES);
    await prismaClient.familyMember.create({
      data: {
        clientId: client.id,
        firstName: p.firstName,
        lastName: p.lastName,
        relationship: p.relationship,
        phone: `+2126${randInt(10000000, 99999999)}`,
      },
    });
  }
}

// ─── Group bookings ────────────────────────────────────────────

async function generateGroups(prismaClient: PrismaClient, ctx: TenantCtx, count: number) {
  let apptCount = 0;
  let groupCount = 0;
  let invoiceCount = 0;

  for (let g = 0; g < count; g++) {
    const participantsCount = randInt(2, 4);
    const shuffled = shuffle(ctx.clients);
    if (shuffled.length < 2) break;
    const participants = shuffled.slice(0, participantsCount);
    const booker = participants[0];

    // groupDone: all participant appointments happened (group gets invoiced).
    // BookingGroup.status itself is only PENDING/CONFIRMED/CANCELLED.
    const groupDone = rand() < 0.6;
    const groupApptStatus = groupDone ? 'COMPLETED' : 'CONFIRMED';
    const groupSource = rand() < 0.6 ? 'ONLINE' : 'STAFF';
    const shapes = participants.map(() => buildServiceItems(ctx, rand() < 0.7 ? 1 : 2));
    const maxDur = Math.max(...shapes.map((s) => s.reduce((a, b) => a + b.duration, 0)));
    const startTime = startTimeFor(maxDur);

    const group = await prismaClient.bookingGroup.create({
      data: {
        tenantId: ctx.tenant.id,
        bookerClientId: booker.id,
        bookerFirstName: booker.firstName,
        bookerLastName: booker.lastName,
        bookerPhone: booker.phone ?? `+2126${randInt(10000000, 99999999)}`,
        startTime,
        status: 'CONFIRMED',
      } as any,
    });

    let grandTotal = 0;
    const pricingSummary: { displayName: string; subtotal: number; services: string[] }[] = [];

    for (let pi = 0; pi < participants.length; pi++) {
      const p = participants[pi];
      const items = shapes[pi];
      const subtotal = round2(items.reduce((s, it) => s + it.price, 0));
      const duration = items.reduce((s, it) => s + it.duration, 0);
      grandTotal += subtotal;

      const appt = await createAppointment(prismaClient, ctx, {
        startTime,
        status: groupApptStatus,
        source: groupSource,
        clientId: p.id,
        services: items,
        bookingGroupId: group.id,
      });

      pricingSummary.push({
        displayName: `${p.firstName} ${p.lastName}`,
        subtotal,
        services: items.map((i) => i.serviceName),
      });

      await prismaClient.bookingParticipant.create({
        data: {
          bookingGroupId: group.id,
          displayName: `${p.firstName} ${p.lastName}`,
          clientId: p.id,
          isBooker: pi === 0,
          serviceIds: items.map((i) => i.serviceId),
          durationMinutes: duration,
          subtotal,
          appointmentId: appt.id,
        },
      });
      apptCount++;
    }

    await prismaClient.bookingGroup.update({
      where: { id: group.id },
      data: { grandTotal: round2(grandTotal), pricingSummary },
    });

    // Completed groups get a group sale invoice (line items per participant)
    if (groupDone) {
      const billedAt = new Date(startTime.getTime() + 3 * 3600000);
      await createInvoice(prismaClient, ctx, {
        clientId: booker.id,
        bookingGroupId: group.id,
        items: participants.flatMap((p, pi) =>
          shapes[pi].map((it) => ({
            serviceId: it.serviceId,
            serviceName: it.serviceName,
            price: it.price,
            participantName: `${p.firstName} ${p.lastName}`,
          }))
        ),
        status: weightedPick([['PAID', 80], ['PENDING', 15], ['CANCELLED', 5]]),
        paymentMethod: weightedPick([['CASH', 40], ['CARD', 35], ['BANK_TRANSFER', 10], ['CHECK', 5], ['ONLINE', 10]]),
        createdAt: billedAt,
      });
      invoiceCount++;
    }
    groupCount++;
  }

  return { apptCount, groupCount, invoiceCount };
}

// ─── Per-tenant fill ───────────────────────────────────────────

type FillVolumes = {
  appointments: number;
  groups?: number;
  reviews?: number;
  cash?: number;
  family?: number;
};

async function fillTenant(prismaClient: PrismaClient, ctx: TenantCtx, v: FillVolumes) {
  // Guard: a tenant with no clients gets a few so generation works
  if (ctx.clients.length === 0) {
    for (let i = 0; i < 15; i++) {
      const row = await prismaClient.client.create({
        data: {
          tenantId: ctx.tenant.id,
          firstName: `Client${i}`,
          lastName: 'Refill',
          email: `refill${i}@email.ma`,
          phone: `+2126${randInt(10000000, 99999999)}`,
          avatar: avatarUrlFor(`Client${i}`, 'Refill', `refill${i}@email.ma`),
          status: 'ACTIVE',
        },
      });
      ctx.clients.push({ id: row.id, firstName: `Client${i}`, lastName: 'Refill', phone: null });
    }
  }

  const groupsRes = (v.groups ?? 0) > 0 ? await generateGroups(prismaClient, ctx, v.groups!) : { apptCount: 0, groupCount: 0, invoiceCount: 0 };
  const individual = Math.max(0, v.appointments - groupsRes.apptCount);

  const completedAppts: { id: string; clientId: string; startTime: Date }[] = [];
  let cancelledTotal = 0;
  let cancelledOnline = 0;
  let cancelledByClient = 0;

  for (let i = 0; i < individual; i++) {
    const client = pick(ctx.clients);
    const items = buildServiceItems(ctx, weightedPick([[1, 65], [2, 25], [3, 10]]));
    const { status, source } = pickStatusSource();
    const startTime = startTimeFor(items.reduce((s, it) => s + it.duration, 0));

    let cancelledBy: string | undefined;
    let reason: string | undefined;
    if (status === 'CANCELLED') {
      cancelledTotal++;
      if (source === 'ONLINE') cancelledOnline++;
      const c = pickCancellation(ctx, client.id);
      cancelledBy = c.cancelledBy;
      reason = c.reason;
      if (cancelledBy === client.id) cancelledByClient++;
    }

    const appt = await createAppointment(prismaClient, ctx, {
      startTime,
      status,
      source,
      clientId: client.id,
      services: items,
      cancelledBy,
      cancellationReason: reason,
    });

    if (status === 'COMPLETED') {
      completedAppts.push({ id: appt.id, clientId: client.id, startTime });
    }
  }

  // Invoices for ~62% of completed appointments
  let invoiceCount = groupsRes.invoiceCount;
  for (const c of completedAppts) {
    const r = rand();
    if (r >= 0.62) continue;
    const status = r < 0.62 * 0.8 ? 'PAID' : rand() < 0.75 ? 'PENDING' : 'CANCELLED';
    const paymentMethod = weightedPick([['CASH', 45], ['CARD', 30], ['BANK_TRANSFER', 10], ['CHECK', 5], ['ONLINE', 10]]);
    const createdAt = new Date(c.startTime.getTime() + randInt(1, 8) * 3600000);
    const appt = await prismaClient.appointment.findUnique({
      where: { id: c.id },
      select: { services: { select: { serviceId: true, serviceName: true, price: true } } },
    });
    await createInvoice(prismaClient, ctx, {
      clientId: c.clientId,
      appointmentId: c.id,
      items: (appt?.services ?? []).map((it) => ({
        serviceId: it.serviceId ?? undefined,
        serviceName: it.serviceName,
        price: it.price,
      })),
      status,
      paymentMethod,
      createdAt,
    });
    invoiceCount++;
  }

  const reviewCount = await generateReviews(prismaClient, ctx, v.reviews ?? 0, completedAppts);
  await generateCashTx(prismaClient, ctx, v.cash ?? 0);
  await generateFamilyMembers(prismaClient, ctx, v.family ?? 0);

  const normal = individual - cancelledTotal;
  console.log(
    `  ✓ ${ctx.tenant.name} — ${v.appointments} RDV (${individual} individuels + ${groupsRes.apptCount} groupe), ` +
      `${cancelledTotal} annulés (${Math.round((cancelledOnline / Math.max(1, cancelledTotal)) * 100)}% en ligne, ` +
      `${Math.round((cancelledByClient / Math.max(1, cancelledTotal)) * 100)}% par le client), ` +
      `${normal} non annulés, ${invoiceCount} factures, ${reviewCount} avis, ${v.cash ?? 0} op. caisse, ${v.family ?? 0} proches`
  );

  return { appointments: v.appointments, invoices: invoiceCount, reviews: reviewCount, cash: v.cash ?? 0, groups: groupsRes.groupCount };
}

// ─── Entry point ───────────────────────────────────────────────

export async function seedRefill(prismaClient: PrismaClient) {
  console.log('🧹 Refill — wiping data (accounts kept)…');
  await wipeData(prismaClient);

  console.log('💳 Setting billing scenario (paid baseline / pending virement / enforcement case)…');
  await setBillingScenario(prismaClient);

  const tenants = await prismaClient.tenant.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  const ctxs: TenantCtx[] = [];
  for (const t of tenants) {
    ctxs.push(await loadTenantCtx(prismaClient, t));
  }

  const volumes: Record<string, FillVolumes> = {
    'spa-royal': { appointments: 450, groups: 14, reviews: 60, cash: 90, family: 14 },
    'spa-royal-2': { appointments: 30, reviews: 4, cash: 10, family: 2 },
    'reza-salon-1': { appointments: 22, reviews: 3, cash: 8, family: 2 },
    'reza-salon-2': { appointments: 16, reviews: 2, cash: 6, family: 1 },
  };

  let total = { appointments: 0, invoices: 0, reviews: 0, cash: 0, groups: 0 };
  for (const ctx of ctxs) {
    const v = volumes[ctx.tenant.subdomain];
    if (!v) continue;
    const res = await fillTenant(prismaClient, ctx, v);
    total.appointments += res.appointments;
    total.invoices += res.invoices;
    total.reviews += res.reviews;
    total.cash += res.cash;
    total.groups += res.groups;
  }

  console.log(
    `\n  Σ ${total.appointments} RDV · ${total.invoices} factures · ${total.reviews} avis · ` +
      `${total.cash} opérations caisse · ${total.groups} réservations de groupe`
  );
}

// Standalone runner (npm run seed:refill) — guarded so importing this module
// from seed/index.ts doesn't trigger it.
async function main() {
  console.log('📦 REZA data refill — keeps accounts, regenerates all test data\n');
  await seedRefill(prisma);
  console.log('\n🎉 Refill complete');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Refill failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
