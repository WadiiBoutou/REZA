import dotenv from 'dotenv';
import { PrismaClient } from '../../prisma/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const SALT_ROUNDS = 10;
const hashPassword = (password: string) => bcrypt.hash(password, SALT_ROUNDS);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ───── Helpers ────────────────────────────────────────────────

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function todayAt(hours: number, minutes: number = 0): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function dayOffset(days: number, hours: number = 9, minutes: number = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

const WEEKDAY_HOURS_FR = [
  { day: 'Lundi', isOpen: true, openTime: '09:00', closeTime: '19:00' },
  { day: 'Mardi', isOpen: true, openTime: '09:00', closeTime: '19:00' },
  { day: 'Mercredi', isOpen: true, openTime: '09:00', closeTime: '19:00' },
  { day: 'Jeudi', isOpen: true, openTime: '09:00', closeTime: '19:00' },
  { day: 'Vendredi', isOpen: true, openTime: '09:00', closeTime: '19:00' },
  { day: 'Samedi', isOpen: true, openTime: '10:00', closeTime: '18:00' },
  { day: 'Dimanche', isOpen: false, openTime: '10:00', closeTime: '18:00' },
];

const BUSINESS_HOURS_EN = {
  monday: { open: '09:00', close: '19:00' },
  tuesday: { open: '09:00', close: '19:00' },
  wednesday: { open: '09:00', close: '19:00' },
  thursday: { open: '09:00', close: '19:00' },
  friday: { open: '09:00', close: '19:00' },
  saturday: { open: '10:00', close: '18:00' },
  sunday: null,
};

const EMPLOYEE_HOURS = [
  { day: 'Lundi', isWorking: true, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
  { day: 'Mardi', isWorking: true, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
  { day: 'Mercredi', isWorking: true, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
  { day: 'Jeudi', isWorking: true, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
  { day: 'Vendredi', isWorking: true, startTime: '09:00', endTime: '19:00', breaks: [{ start: '13:00', end: '14:00' }] },
  { day: 'Samedi', isWorking: true, startTime: '10:00', endTime: '18:00', breaks: [] },
  { day: 'Dimanche', isWorking: false, startTime: '10:00', endTime: '18:00', breaks: [] },
];

const AGENDA_DEFAULTS = {
  timeSlotDuration: 30,
  bufferTime: 5,
  maxAppointmentsPerDay: 12,
  allowOnlineBooking: true,
  status: 'active' as const,
};

// ───── Main ───────────────────────────────────────────────────

async function main() {
  console.log('🧹 Clearing entire database...');
  // Delete in dependency order
  await prisma.bookingParticipant.deleteMany();
  await prisma.appointmentServiceItem.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.review.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.cashTransaction.deleteMany();
  await prisma.bookingGroup.deleteMany();
  await prisma.familyMember.deleteMany();
  await prisma.client.deleteMany();
  await prisma.employeeService.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.service.deleteMany();
  await prisma.tenantSettings.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.earlyAccessSignup.deleteMany();
  console.log('✅ Database cleared');

  // ─── 1. SUBSCRIPTION PLAN ──────────────────────────────────
  console.log('\n📋 Creating subscription plan...');
  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Standard',
      priceCents: 80000,
      currency: 'MAD',
      interval: 'year',
      maxSalons: 3,
      isActive: true,
    },
  });
  console.log(`  ✓ Plan "${plan.name}" — ${plan.priceCents / 100} MAD/an, max ${plan.maxSalons} salons`);

  // ─── 2. SUPERADMIN ──────────────────────────────────────────
  console.log('\n👑 Creating superadmin...');
  const superadmin = await prisma.user.create({
    data: {
      email: 'superadmin@gmail.com',
      password: await hashPassword('123456'),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log(`  ✓ superadmin@gmail.com / 123456 (${superadmin.id})`);

  // ─── 3. CLIENTS (platform client + salon clients) ──────────
  console.log('\n👤 Creating clients...');

  // Platform client (used across the app for client login)
  // We'll create this client on the Spa Royal tenant after creating it
  let platformClientId: string;

  // ─── 4. TENANT: SPA ROYAL CASABLANCA ────────────────────────
  console.log('\n🏪 Creating Spa Royal Casablanca...');

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Spa Royal Casablanca',
      subdomain: 'spa-royal',
      email: 'contact@sparoyal.ma',
      phone: '+212522000003',
      address: 'Oasis, Casablanca',
      city: 'Casablanca',
      category: 'Spa',
      coverImage: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=800&auto=format&fit=crop',
      shortDescription: 'Spa et hammam à Oasis — détente et bien-être',
      latitude: 33.555,
      longitude: -7.636,
      googleMapsLink: 'https://maps.google.com/?q=33.555,-7.636',
      isActive: true,
      subscriptionActive: true,
      tags: ['spa', 'hammam', 'massage', 'casablanca'],
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // ─── 5. TENANT SETTINGS ──────────────────────────────────────
  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      timezone: 'Africa/Casablanca',
      currency: 'MAD',
      language: 'fr',
      bookingAdvanceDays: 30,
      cancellationHours: 24,
      businessHours: { schedules: WEEKDAY_HOURS_FR, ...BUSINESS_HOURS_EN },
      photos: [
        'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop',
      ],
      description: 'Spa Royal Casablanca vous accueille dans un cadre raffiné pour une expérience de détente unique. Hammam traditionnel, massages et soins visage.',
      paymentMethods: [
        { type: 'CASH', label: 'Espèces' },
        { type: 'CARD', label: 'Carte bancaire' },
        { type: 'BANK_TRANSFER', label: 'Virement' },
      ],
      amenities: ['WiFi gratuit', 'Climatisation', 'Parking', 'vestiaire'],
      socialMedia: { instagram: '@sparoyal_casa', facebook: 'sparoyalcasa' },
      featured: true,
      showMap: true,
      showOpeningHours: true,
      showOnlineReservation: true,
      showReviews: true,
      onlineReservationEnabled: true,
    },
  });
  console.log('  ✓ Settings created');

  // ─── 6. SERVICES ────────────────────────────────────────────
  console.log('\n💇 Creating services...');
  const servicesData = [
    { name: 'Hammam traditionnel', abbr: 'HAMMAM', description: 'Hammam avec gommage au savon beldi et soin corporel', category: 'Spa', price: 200, duration: 60, color: '#6366F1' },
    { name: 'Massage relaxant', abbr: 'MASSAGE', description: 'Massage corps complet aux huiles essentielles', category: 'Massage', price: 250, duration: 60, color: '#8B5CF6' },
    { name: 'Gommage à l\'argan', abbr: 'GOMMAGE', description: 'Gommage corps à l\'huile d\'argan et enveloppement', category: 'Spa', price: 180, duration: 45, color: '#10B981' },
    { name: 'Soin visage', abbr: 'SOIN', description: 'Soin visage complet avec masque et modelage', category: 'Soin', price: 220, duration: 45, color: '#EC4899' },
    { name: 'Manucure complète', abbr: 'MANUCURE', description: 'Manucure avec pose de vernis semi-permanent', category: 'Manucure', price: 150, duration: 45, color: '#F59E0B' },
    { name: 'Épilation jambes', abbr: 'EPIL', description: 'Épilation à la cire tiède jambes complètes', category: 'Esthétique', price: 90, duration: 30, color: '#EF4444' },
  ];

  const services = await Promise.all(
    servicesData.map((s, i) =>
      prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: s.name,
          abbreviation: s.abbr,
          description: s.description,
          category: s.category,
          color: s.color,
          price: s.price,
          priceType: 'FIXED',
          duration: s.duration,
          visibility: 'BOOKABLE',
          competences: [s.category],
        },
      })
    )
  );
  console.log(`  ✓ ${services.length} services created`);

  // ─── 7. EMPLOYEES + USERS (STAFF) + SERVICE LINKS ────────────
  console.log('\n👥 Creating employees...');

  const staffData = [
    {
      firstName: 'Yasmine', lastName: 'Benali', email: 'yasmine@sparoyal.ma', phone: '+212600000001',
      role: 'Masseuse', color: '#8B5CF6',
      serviceAssignments: [0, 1, 2], // Hammam, Massage, Gommage
    },
    {
      firstName: 'Karim', lastName: 'Ouazzani', email: 'karim@sparoyal.ma', phone: '+212600000002',
      role: 'Esthéticien', color: '#10B981',
      serviceAssignments: [2, 3, 5], // Gommage, Soin visage, Épilation
    },
    {
      firstName: 'Salma', lastName: 'El Fassi', email: 'salma@sparoyal.ma', phone: '+212600000003',
      role: 'Hammam Thérapeute', color: '#6366F1',
      serviceAssignments: [0, 1, 2], // Hammam, Massage, Gommage
    },
    {
      firstName: 'Nadia', lastName: 'Berrada', email: 'nadia@sparoyal.ma', phone: '+212600000004',
      role: 'Manucure & Beauté', color: '#EC4899',
      serviceAssignments: [3, 4], // Soin visage, Manucure
    },
    {
      firstName: 'Hicham', lastName: 'Alaoui', email: 'hicham@sparoyal.ma', phone: '+212600000005',
      role: 'Massage & Spa', color: '#F59E0B',
      serviceAssignments: [0, 1, 3], // Hammam, Massage, Soin visage
    },
  ];

  interface StaffResult {
    user: { id: string };
    employee: { id: string };
  }

  const staff: StaffResult[] = [];

  for (const s of staffData) {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: s.email,
        password: await hashPassword('staff123'),
        firstName: s.firstName,
        lastName: s.lastName,
        phone: s.phone,
        role: 'STAFF',
        isActive: true,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        phone: s.phone,
        isActive: true,
        workingHours: EMPLOYEE_HOURS,
        agendaSettings: { ...AGENDA_DEFAULTS, color: s.color, role: s.role },
      },
    });

    await prisma.employeeService.createMany({
      data: s.serviceAssignments.map((svcIdx) => ({
        employeeId: employee.id,
        serviceId: services[svcIdx].id,
      })),
      skipDuplicates: true,
    });

    staff.push({ user, employee });
    console.log(`  ✓ ${s.firstName} ${s.lastName} (${s.role}) — ${s.serviceAssignments.length} services`);
  }
  console.log(`  ✅ ${staff.length} employees + STAFF users created`);

  // ─── 8. ADMIN USER + ACCOUNT + SUBSCRIPTION ─────────────────
  console.log('\n🔐 Creating admin account & subscription...');

  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@spa-royal.ma',
      password: await hashPassword('password123'),
      firstName: 'Admin',
      lastName: 'Spa Royal',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const account = await prisma.account.create({
    data: { ownerUserId: adminUser.id, isActive: true },
  });

  // Associate tenant with account
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { accountId: account.id },
  });

  // Active subscription
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

  console.log(`  ✓ admin@spa-royal.ma / password123 (ADMIN)`);
  console.log(`  ✓ Account ${account.id} with active subscription (expires ${periodEnd.toLocaleDateString('fr-FR')})`);

  // ─── 9. CLIENTS (salon clients + platform client) ───────────
  console.log('\n👤 Creating clients...');

  const clientPassword = await hashPassword('123456');

  const client1 = await prisma.client.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Client',
      lastName: 'Demo',
      email: 'client1@gmail.com',
      phone: '+212612345678',
      password: clientPassword,
      status: 'ACTIVE',
    },
  });
  platformClientId = client1.id;
  console.log(`  ✓ client1@gmail.com / 123456 (platform client)`);

  const salonClients = await Promise.all([
    prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Fatima', lastName: 'Zahra',
        email: 'fatima@email.ma', phone: '+212622222201',
        status: 'ACTIVE', notes: 'Cliente fidèle — préfère les massages',
      },
    }),
    prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Amina', lastName: 'Benali',
        email: 'amina@email.ma', phone: '+212622222202',
        status: 'ACTIVE', notes: 'Allergique aux huiles d\'argan',
      },
    }),
    prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Sara', lastName: 'El Idrissi',
        email: 'sara@email.ma', phone: '+212622222203',
        status: 'ACTIVE',
      },
    }),
    prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Mariam', lastName: 'Tazi',
        email: 'mariam@email.ma', phone: '+212622222204',
        status: 'ACTIVE',
      },
    }),
    prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Omar', lastName: 'Bennani',
        email: 'omar@email.ma', phone: '+212622222205',
        status: 'ACTIVE',
      },
    }),
    prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Nawal', lastName: 'El Fassi',
        email: 'nawal@email.ma', phone: '+212622222206',
        status: 'ACTIVE',
      },
    }),
  ]);
  console.log(`  ✓ ${salonClients.length} additional clients created`);

  // ─── 10. FAMILY MEMBERS ─────────────────────────────────────
  console.log('\n👨‍👩‍👧 Creating family members...');
  await prisma.familyMember.create({
    data: {
      clientId: salonClients[0].id, // Fatima
      firstName: 'Hassan', lastName: 'Zahra',
      relationship: 'Époux',
      phone: '+212622222301',
    },
  });
  await prisma.familyMember.create({
    data: {
      clientId: salonClients[2].id, // Sara
      firstName: 'Lina', lastName: 'El Idrissi',
      relationship: 'Fille',
      phone: '+212622222302',
    },
  });
  await prisma.familyMember.create({
    data: {
      clientId: salonClients[5].id, // Nawal
      firstName: 'Imane', lastName: 'El Fassi',
      relationship: 'Sœur',
      phone: '+212622222303',
    },
  });
  console.log('  ✓ 3 family members created');

  // ─── 11. APPOINTMENTS (multi-service) ───────────────────────
  console.log('\n📅 Creating appointments...');

  // Helper: create appointment with service items
  async function createAppointmentWithServices(params: {
    clientId: string;
    startTime: Date;
    status: any;
    notes?: string;
    serviceItems: Array<{ serviceIdx: number; employeeIdx: number }>;
  }) {
    const totalDuration = params.serviceItems.reduce((sum, si) => sum + services[si.serviceIdx].duration, 0);
    const endTime = addMinutes(params.startTime, totalDuration);
    const primaryService = services[params.serviceItems[0].serviceIdx];

    const appointment = await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        clientId: params.clientId,
        serviceId: primaryService.id,
        createdById: adminUser.id,
        startTime: params.startTime,
        endTime,
        duration: totalDuration,
        status: params.status,
        notes: params.notes,
      },
    });

    await prisma.appointmentServiceItem.createMany({
      data: params.serviceItems.map((si, idx) => ({
        appointmentId: appointment.id,
        serviceId: services[si.serviceIdx].id,
        employeeId: staff[si.employeeIdx].user.id,
        serviceName: services[si.serviceIdx].name,
        duration: services[si.serviceIdx].duration,
        price: services[si.serviceIdx].price!,
        sortOrder: idx,
      })),
    });

    return appointment;
  }

  // Past appointment — single service (COMPLETED + reviewed)
  const pastSingle = await createAppointmentWithServices({
    clientId: platformClientId,
    startTime: dayOffset(-5, 10, 0),
    status: 'COMPLETED',
    notes: 'RDV massage relaxant — client satisfaite',
    serviceItems: [{ serviceIdx: 1, employeeIdx: 0 }], // Massage relaxant with Yasmine
  });

  // Past appointment — multi-service (COMPLETED)
  const pastMulti = await createAppointmentWithServices({
    clientId: salonClients[0].id, // Fatima
    startTime: dayOffset(-3, 14, 0),
    status: 'COMPLETED',
    notes: 'Soin complet — hammam + gommage',
    serviceItems: [
      { serviceIdx: 0, employeeIdx: 2 }, // Hammam avec Salma
      { serviceIdx: 2, employeeIdx: 1 }, // Gommage avec Karim
    ],
  });

  // Today appointment — multi-service, afternoon (CONFIRMED)
  const todayAppt = await createAppointmentWithServices({
    clientId: salonClients[1].id, // Amina
    startTime: todayAt(15, 0),
    status: 'CONFIRMED',
    notes: 'Soin visage + manucure',
    serviceItems: [
      { serviceIdx: 3, employeeIdx: 3 }, // Soin visage avec Nadia
      { serviceIdx: 4, employeeIdx: 3 }, // Manucure avec Nadia
    ],
  });

  // Tomorrow appointment — multi-service (CONFIRMED)
  const tomorrowAppt = await createAppointmentWithServices({
    clientId: salonClients[2].id, // Sara
    startTime: dayOffset(1, 10, 0),
    status: 'CONFIRMED',
    notes: 'Pack détente complet',
    serviceItems: [
      { serviceIdx: 0, employeeIdx: 0 }, // Hammam avec Yasmine
      { serviceIdx: 1, employeeIdx: 4 }, // Massage avec Hicham
      { serviceIdx: 2, employeeIdx: 2 }, // Gommage avec Salma
    ],
  });

  // Upcoming appointment (3 days) — multi-service (CONFIRMED)
  const upcomingAppt = await createAppointmentWithServices({
    clientId: platformClientId,
    startTime: dayOffset(3, 11, 30),
    status: 'CONFIRMED',
    notes: 'Matinée bien-être',
    serviceItems: [
      { serviceIdx: 1, employeeIdx: 0 }, // Massage avec Yasmine
      { serviceIdx: 3, employeeIdx: 3 }, // Soin visage avec Nadia
    ],
  });

  // Future appointment (5 days) — single service (PENDING)
  const futurePending = await createAppointmentWithServices({
    clientId: salonClients[4].id, // Omar
    startTime: dayOffset(5, 16, 0),
    status: 'PENDING',
    notes: 'Nouveau client — épilation',
    serviceItems: [{ serviceIdx: 5, employeeIdx: 1 }], // Épilation avec Karim
  });

  // Appointment yesterday — multi-service, IN_PROGRESS (for agenda testing)
  const yesterdayAppt = await createAppointmentWithServices({
    clientId: salonClients[3].id, // Mariam
    startTime: dayOffset(-1, 9, 30),
    status: 'IN_PROGRESS',
    notes: 'Forfait détente',
    serviceItems: [
      { serviceIdx: 0, employeeIdx: 2 }, // Hammam avec Salma
      { serviceIdx: 4, employeeIdx: 3 }, // Manucure avec Nadia
    ],
  });

  // Appointment 2 days ago — CANCELLED
  const cancelledAppt = await createAppointmentWithServices({
    clientId: salonClients[5].id, // Nawal
    startTime: dayOffset(-2, 11, 0),
    status: 'CANCELLED',
    notes: 'Annulé par la cliente — raison personnelle',
    serviceItems: [{ serviceIdx: 1, employeeIdx: 4 }], // Massage avec Hicham
  });

  // Appointment 1 day ago — NO_SHOW
  const noShowAppt = await createAppointmentWithServices({
    clientId: salonClients[1].id, // Amina
    startTime: dayOffset(-1, 14, 0),
    status: 'NO_SHOW',
    notes: 'Cliente non venue',
    serviceItems: [{ serviceIdx: 2, employeeIdx: 1 }], // Gommage avec Karim
  });

  const allAppointments = [pastSingle, pastMulti, cancelledAppt, noShowAppt, yesterdayAppt, todayAppt, tomorrowAppt, upcomingAppt, futurePending];
  console.log(`  ✓ ${allAppointments.length} appointments created (${allAppointments.filter(a => a.status === 'COMPLETED' || a.status === 'CONFIRMED').length} active/completed)`);
  console.log(`    - Multi-service appointments: ${[pastMulti, todayAppt, tomorrowAppt, upcomingAppt, yesterdayAppt].length}`);
  console.log(`    - Single-service appointments: ${allAppointments.length - 5}`);

  // ─── 12. REVIEWS ────────────────────────────────────────────
  console.log('\n⭐ Creating reviews...');
  const reviews = await Promise.all([
    prisma.review.create({
      data: {
        tenantId: tenant.id,
        clientId: platformClientId,
        appointmentId: pastSingle.id,
        rating: 5,
        comment: 'Excellent massage relaxant ! Yasmine est très professionnelle. Je recommande vivement.',
        status: 'APPROVED',
      },
    }),
    prisma.review.create({
      data: {
        tenantId: tenant.id,
        clientId: salonClients[0].id,
        appointmentId: pastMulti.id,
        rating: 5,
        comment: 'Superbe expérience ! Le hammam suivi du gommage était parfait.',
        status: 'APPROVED',
      },
    }),
    prisma.review.create({
      data: {
        tenantId: tenant.id,
        clientId: salonClients[2].id,
        rating: 4,
        comment: 'Très bon accueil, cadre agréable. Le massage était excellent.',
        status: 'PENDING',
      },
    }),
    prisma.review.create({
      data: {
        tenantId: tenant.id,
        clientId: salonClients[3].id,
        rating: 3,
        comment: 'Bien mais un peu d\'attente avant la séance.',
        status: 'PENDING',
      },
    }),
  ]);
  console.log(`  ✓ ${reviews.length} reviews created (${reviews.filter(r => r.status === 'APPROVED').length} approved, ${reviews.filter(r => r.status === 'PENDING').length} pending)`);

  // ─── 13. NOTIFICATIONS ──────────────────────────────────────
  console.log('\n🔔 Creating notifications...');
  await Promise.all([
    prisma.notification.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        type: 'APPOINTMENT_NEW',
        title: 'Nouveau rendez-vous',
        message: `Sara El Idrissi a réservé un pack détente complet pour le ${dayOffset(1, 10, 0).toLocaleDateString('fr-FR')}`,
        link: '/dashboard/rendez-vous',
        isRead: false,
      },
    }),
    prisma.notification.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        type: 'APPOINTMENT_CONFIRMED',
        title: 'Rendez-vous confirmé',
        message: 'Le rendez-vous de Client Demo a été confirmé',
        link: '/dashboard/rendez-vous',
        isRead: false,
      },
    }),
    prisma.notification.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        type: 'REVIEW_PENDING',
        title: 'Nouvel avis en attente',
        message: '2 nouveaux avis clients sont en attente de modération',
        link: '/dashboard/clients/mes-avis/avis-a-moderer',
        isRead: false,
      },
    }),
    prisma.notification.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        type: 'APPOINTMENT_REMINDER',
        title: 'Rappel rendez-vous',
        message: `Amina Benali a rendez-vous aujourd'hui à 15h00 (Soin visage + Manucure)`,
        link: '/dashboard/rendez-vous',
        isRead: false,
      },
    }),
    prisma.notification.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        type: 'SYSTEM',
        title: 'Abonnement actif',
        message: 'Votre abonnement Standard est actif jusqu\'au ' + periodEnd.toLocaleDateString('fr-FR'),
        link: '/dashboard/mes-salons',
        isRead: true,
        readAt: new Date(),
      },
    }),
  ]);
  console.log('  ✓ 5 notifications created');

  // ─── 14. INVOICES ───────────────────────────────────────────
  console.log('\n🧾 Creating invoices...');

  // Invoice for past completed multi-service appointment (Fatima)
  const inv1 = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      clientId: salonClients[0].id,
      appointmentId: pastMulti.id,
      type: 'SALE',
      invoiceNumber: `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-0001`,
      amount: 380,
      tax: 0,
      total: 380,
      status: 'PAID',
      paymentMethod: 'CARD',
      paidAt: dayOffset(-3, 15, 30),
    },
  });

  // Invoice for past single-service appointment (Client Demo)
  const inv2 = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      clientId: platformClientId,
      appointmentId: pastSingle.id,
      type: 'SALE',
      invoiceNumber: `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-0002`,
      amount: 250,
      tax: 0,
      total: 250,
      status: 'PAID',
      paymentMethod: 'CASH',
      paidAt: dayOffset(-5, 11, 15),
    },
  });

  // Subscription invoice (PENDING)
  const subInv = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
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

  // Invoice items
  await prisma.invoiceItem.createMany({
    data: [
      { invoiceId: inv1.id, serviceId: services[0].id, serviceName: services[0].name, price: 200, quantity: 1 },
      { invoiceId: inv1.id, serviceId: services[2].id, serviceName: services[2].name, price: 180, quantity: 1 },
      { invoiceId: inv2.id, serviceId: services[1].id, serviceName: services[1].name, price: 250, quantity: 1 },
    ],
  });

  console.log('  ✓ 3 invoices created (2 SALE + 1 SUBSCRIPTION)');

  // ─── 15. CASH TRANSACTIONS ──────────────────────────────────
  console.log('\n💰 Creating cash transactions...');
  await Promise.all([
    prisma.cashTransaction.create({
      data: {
        tenantId: tenant.id,
        type: 'DEPOSIT',
        amount: 5000,
        paymentMethod: 'CASH',
        notes: 'Dépôt initial — fonds de caisse',
        createdById: adminUser.id,
      },
    }),
    prisma.cashTransaction.create({
      data: {
        tenantId: tenant.id,
        type: 'WITHDRAWAL',
        amount: 250,
        paymentMethod: 'CASH',
        notes: 'Retrait pour courses fournisseur',
        createdById: adminUser.id,
      },
    }),
    prisma.cashTransaction.create({
      data: {
        tenantId: tenant.id,
        type: 'DEPOSIT',
        amount: 380,
        paymentMethod: 'CARD',
        notes: 'Paiement Fatima Zahra — Soin complet',
        createdById: adminUser.id,
      },
    }),
    prisma.cashTransaction.create({
      data: {
        tenantId: tenant.id,
        type: 'WITHDRAWAL',
        amount: 120,
        paymentMethod: 'CASH',
        notes: 'Achat produits d\'entretien',
        createdById: adminUser.id,
      },
    }),
    prisma.cashTransaction.create({
      data: {
        tenantId: tenant.id,
        type: 'DEPOSIT',
        amount: 250,
        paymentMethod: 'CASH',
        notes: 'Paiement Client Demo — Massage relaxant',
        createdById: adminUser.id,
      },
    }),
  ]);
  console.log('  ✓ 5 cash transactions created');

  // ─── 16. FAVORITES ─────────────────────────────────────────
  console.log('\n❤️ Creating favorites...');
  await prisma.favorite.create({
    data: { clientId: platformClientId, tenantId: tenant.id },
  });
  await prisma.favorite.create({
    data: { clientId: salonClients[0].id, tenantId: tenant.id },
  });
  console.log('  ✓ 2 favorites created');

  // ─── 17. BOOKING GROUPS (group booking demo) ────────────────
  console.log('\n👥 Creating booking groups...');
  const bg = await prisma.bookingGroup.create({
    data: {
      tenantId: tenant.id,
      bookerClientId: salonClients[0].id,
      bookerFirstName: 'Fatima',
      bookerLastName: 'Zahra',
      bookerPhone: '+212622222201',
      bookerEmail: 'fatima@email.ma',
      startTime: dayOffset(7, 14, 0),
      status: 'CONFIRMED',
      grandTotal: 380,
    },
  });

  await prisma.bookingParticipant.create({
    data: {
      bookingGroupId: bg.id,
      displayName: 'Fatima Zahra',
      clientId: salonClients[0].id,
      isBooker: true,
      serviceIds: [services[0].id, services[2].id],
      durationMinutes: 105,
      subtotal: 380,
    },
  });
  console.log('  ✓ 1 booking group with 1 participant');

  // ─── 18. EARLY ACCESS SIGNUPS ──────────────────────────────
  await prisma.earlyAccessSignup.create({
    data: {
      fullName: 'Test Professionnel',
      email: 'pro@test.ma',
      phone: '+212600000099',
      establishment: 'Salon Test',
      city: 'Casablanca',
      userType: 'PROFESSIONAL',
    },
  });
  await prisma.earlyAccessSignup.create({
    data: {
      fullName: 'Test Client',
      email: 'client.test@test.ma',
      city: 'Rabat',
      userType: 'CLIENT',
    },
  });
  console.log('  ✓ 2 early access signups');

  // ─── SUMMARY ────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log('🎉 SEED COMPLETE');
  console.log('══════════════════════════════════════════════════');
  console.log('');
  console.log('🔐 Accounts:');
  console.log('   Superadmin : superadmin@gmail.com / 123456');
  console.log('   Admin      : admin@spa-royal.ma / password123');
  console.log('   Client     : client1@gmail.com / 123456');
  console.log('');
  console.log('🏪 Spa Royal Casablanca');
  console.log(`   ${services.length} services`);
  console.log(`   ${staff.length} employees`);
  console.log(`   ${salonClients.length + 1} clients`);
  console.log(`   ${allAppointments.length} appointments`);
  console.log(`     - ${allAppointments.filter(a => a.status === 'COMPLETED').length} completed`);
  console.log(`     - ${allAppointments.filter(a => a.status === 'CONFIRMED').length} confirmed`);
  console.log(`     - ${allAppointments.filter(a => a.status === 'IN_PROGRESS').length} in progress`);
  console.log(`     - ${allAppointments.filter(a => a.status === 'PENDING').length} pending`);
  console.log(`     - ${allAppointments.filter(a => a.status === 'CANCELLED' || a.status === 'NO_SHOW').length} cancelled/no-show`);
  console.log(`   ${reviews.length} reviews`);
  console.log(`   3 invoices (2 SALE, 1 SUBSCRIPTION)`);
  console.log(`   5 cash transactions`);
  console.log(`   5 notifications`);
  console.log(`   3 family members`);
  console.log(`   1 booking group`);
  console.log('');
  console.log('✅ Multi-service appointments with per-employee assignment: ACTIVE');
  console.log('   - Past (completed): Hammam + Gommage (Salma + Karim)');
  console.log('   - Today: Soin visage + Manucure (Nadia)');
  console.log('   - Tomorrow: Hammam + Massage + Gommage (Yasmine + Hicham + Salma)');
  console.log('   - Upcoming: Massage + Soin visage (Yasmine + Nadia)');
  console.log('══════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
