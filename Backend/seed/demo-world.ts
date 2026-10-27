/**
 * Seed that mirrors the frontend-only demo on branch `demo`.
 *
 * - Atelier Noor is the pro salon (demo.pro@reza.ma): 6 services, 4 employees,
 *   16 clients, 150 appointments (Jul–Oct 2026), invoices, reviews.
 * - The other seven client-app salons are searchable venues, each with its own account.
 * - Nour Benali (demo.client@reza.ma) has favorites and appointments across those salons.
 * - superadmin@gmail.com is created by seedSuperadmin before this runs.
 */
import type { PrismaClient } from '../prisma/generated/prisma/client';
import { hashPassword } from '../src/utils/password';
import { EMPLOYEE_WORKING_HOURS, PASSWORDS, TENANT_BUSINESS_HOURS } from './constants';

const DEMO_PASSWORD = 'demo1234';

const SALON_PHOTOS = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=800&q=80',
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&q=80',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
];

const portrait = (gender: 'men' | 'women', index: number) =>
  `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;

const FEMALE_PHOTOS = [2, 9, 12, 17, 21, 31, 40, 47].map((n) => portrait('women', n));
const MALE_PHOTOS = [3, 7, 11, 14, 22, 29, 36, 45].map((n) => portrait('men', n));

const STAFF = [
  { firstName: 'Salma', lastName: 'Bennani', role: 'Coiffeuse', color: '#d77c65', avatar: portrait('women', 57) },
  { firstName: 'Youssef', lastName: 'Amrani', role: 'Barbier', color: '#537f78', avatar: portrait('men', 50) },
  { firstName: 'Lina', lastName: 'Idrissi', role: 'Esthéticienne', color: '#bd9a52', avatar: portrait('women', 63) },
  { firstName: 'Meryem', lastName: 'Alaoui', role: 'Prothésiste ongulaire', color: '#7c7892', avatar: portrait('women', 90) },
] as const;

const SERVICES = [
  { name: 'Coupe & brushing', duration: 60, price: 280, category: 'Coiffure', color: '#d77c65' },
  { name: 'Coloration signature', duration: 120, price: 650, category: 'Coiffure', color: '#537f78' },
  { name: 'Soin visage éclat', duration: 75, price: 420, category: 'Soin visage', color: '#bd9a52' },
  { name: 'Manucure soin', duration: 45, price: 180, category: 'Onglerie', color: '#7c7892' },
  { name: 'Massage relaxant', duration: 60, price: 500, category: 'Bien-être', color: '#d77c65' },
  { name: 'Balayage lumière', duration: 150, price: 900, category: 'Coiffure', color: '#537f78' },
  { name: 'Taille de barbe', duration: 30, price: 140, category: 'Barbier', color: '#537f78' },
] as const;

const CLIENT_NAMES = [
  ['Amine', 'Khaldi'], ['Nadia', 'Tazi'], ['Mehdi', 'Berrada'], ['Sofia', 'El Fassi'],
  ['Imane', 'Chraibi'], ['Omar', 'Lahlou'], ['Aya', 'Benjelloun'], ['Rayan', 'Fikri'],
  ['Adam', 'Mansouri'], ['Leila', 'Naciri'], ['Yasmine', 'Bennis'], ['Anas', 'Tahiri'],
  ['Salma', 'Zerouali'], ['Mehdi', 'Ait Lahcen'], ['Maya', 'Sefrioui'], ['Ilyas', 'Kettani'],
] as const;

const CLIENT_GENDERS = [
  'male', 'female', 'male', 'female', 'female', 'male', 'female', 'male',
  'male', 'female', 'female', 'male', 'female', 'male', 'female', 'male',
] as const;

const VENUES = [
  ['Atelier Noor', 'Casablanca', 'Institut de beauté', 'atelier-noor'],
  ['Maison Safran', 'Rabat', 'Coiffeur', 'maison-safran'],
  ['Studio Sable', 'Marrakech', 'Barbier', 'studio-sable'],
  ['Ligne Claire', 'Tanger', 'Manucure', 'ligne-claire'],
  ['Dar Glow', 'Fès', 'Institut de beauté', 'dar-glow'],
  ['Le Petit Fauteuil', 'Agadir', 'Barbier', 'le-petit-fauteuil'],
  ['Miroir Moderne', 'Meknès', 'Coiffeur', 'miroir-moderne'],
  ['Nacre Studio', 'Casablanca', 'Manucure', 'nacre-studio'],
] as const;

const SALON_PHOTO_INDEX = [0, 4, 1, 3, 2, 1, 5, 3];
const BLURBS = [
  'Un studio de beauté contemporain, pensé pour prendre le temps.',
  'Des gestes précis, une atmosphère calme et des équipes passionnées.',
  'Votre adresse de quartier pour une parenthèse qui fait du bien.',
];

const REVIEW_COMMENTS = [
  'Accueil chaleureux et résultat impeccable.',
  'Un vrai moment pour soi, je recommande.',
  'Très professionnel, je reviendrai bientôt.',
];

const NOUR_COMMENTS = [
  'Une belle découverte, équipe très attentionnée.',
  'Tout était parfait, du début à la fin.',
  'Résultat impeccable, je recommande sans hésiter.',
];

type StaffUser = { userId: string; employeeId: string };

function phoneFor(index: number) {
  return `+2126${String(10000000 + index * 7919).slice(0, 8)}`;
}

function emailFor(firstName: string, lastName: string) {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/ /g, '')}@example.com`;
}

function photoFor(gender: 'male' | 'female', ordinal: number) {
  const pool = gender === 'male' ? MALE_PHOTOS : FEMALE_PHOTOS;
  return pool[ordinal % pool.length];
}

function appointmentDay(index: number) {
  const startDate = new Date(2026, 6, 1);
  const endDate = new Date(2026, 9, 31);
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const progress = index / 149;
  const weightedDays = Math.min(Math.floor(totalDays * Math.pow(progress, 0.75)), totalDays - 1);
  return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + weightedDays);
}

function isBeforeToday(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return start < new Date();
}

async function createAccountFor(
  prisma: PrismaClient,
  admin: { id: string },
  salonsPaid: number,
) {
  const account = await prisma.account.create({
    data: { ownerUserId: admin.id, isActive: true },
  });
  const periodEnd = new Date(Date.UTC(2026, 11, 1, 12, 0, 0));
  await prisma.subscription.create({
    data: {
      accountId: account.id,
      status: 'ACTIVE',
      salonsPaid,
      subscribedAt: new Date(Date.UTC(2026, 6, 1, 12, 0, 0)),
      currentPeriodEnd: periodEnd,
    },
  });
  return account;
}

async function createStaff(
  prisma: PrismaClient,
  tenantId: string,
  subdomain: string,
  staffPassword: string,
): Promise<StaffUser[]> {
  const created: StaffUser[] = [];
  for (let i = 0; i < STAFF.length; i++) {
    const person = STAFF[i];
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@${subdomain}.ma`,
        password: staffPassword,
        firstName: person.firstName,
        lastName: person.lastName,
        phone: `+21260000010${i}`,
        role: 'STAFF',
        avatar: person.avatar,
        isActive: true,
      },
    });
    const employee = await prisma.employee.create({
      data: {
        tenantId,
        firstName: person.firstName,
        lastName: person.lastName,
        email: user.email,
        phone: `+21260000010${i}`,
        avatar: person.avatar,
        isActive: true,
        isPublic: true,
        workingHours: EMPLOYEE_WORKING_HOURS,
        agendaSettings: {
          color: person.color,
          role: person.role,
          timeSlotDuration: 30,
          bufferTime: 5,
          maxAppointmentsPerDay: 14,
          allowOnlineBooking: true,
          status: 'active',
        },
      },
    });
    created.push({ userId: user.id, employeeId: employee.id });
  }
  return created;
}

export async function seedDemoWorld(prisma: PrismaClient) {
  const demoPassword = await hashPassword(DEMO_PASSWORD);
  const discoveryPassword = await hashPassword(PASSWORDS.admin);
  const staffPassword = await hashPassword('staff123');

  console.log('\n🏛️  Atelier Noor (pro demo)…');

  const proAdmin = await prisma.user.create({
    data: {
      email: 'demo.pro@reza.ma',
      password: demoPassword,
      firstName: 'Noor',
      lastName: 'El Fassi',
      phone: '+212522000000',
      role: 'ADMIN',
      avatar: portrait('women', 48),
      tenantId: null,
      isActive: true,
    },
  });
  const proAccount = await createAccountFor(prisma, proAdmin, 1);

  const venueIds: string[] = [];
  const venueStaff: StaffUser[][] = [];

  for (let index = 0; index < VENUES.length; index++) {
    const [name, city, category, subdomain] = VENUES[index];
    const isPro = index === 0;
    const serviceSlice = isPro ? SERVICES.slice(0, 6) : SERVICES.slice(index % 3, (index % 3) + 4);
    const cover = SALON_PHOTOS[SALON_PHOTO_INDEX[index]];
    const blurb = isPro
      ? 'Un studio de beauté contemporain au coeur de Casablanca.'
      : BLURBS[index % 3];

    let adminId = proAdmin.id;
    let accountId = proAccount.id;
    if (!isPro) {
      const admin = await prisma.user.create({
        data: {
          email: `admin@${subdomain}.ma`,
          password: discoveryPassword,
          firstName: 'Admin',
          lastName: name.split(' ')[0],
          phone: `+21253700010${index}`,
          role: 'ADMIN',
          tenantId: null,
          isActive: true,
        },
      });
      const account = await createAccountFor(prisma, admin, 1);
      adminId = admin.id;
      accountId = account.id;
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        slug: subdomain,
        subdomain,
        email: isPro ? 'demo.pro@reza.ma' : `contact@${subdomain}.ma`,
        phone: isPro ? '+212522000000' : `+21253700010${index}`,
        address: isPro ? '12 Rue des Orangers' : `${12 + index} Rue des Orangers, ${city}`,
        city,
        category,
        categories: [...new Set(serviceSlice.map((service) => service.category))],
        coverImage: cover,
        shortDescription: blurb,
        latitude: 33.57 - index * 0.4,
        longitude: -7.59 + index * 0.35,
        googleMapsLink: `https://maps.google.com/?q=${33.57 - index * 0.4},${-7.59 + index * 0.35}`,
        tags: [category.toLowerCase(), city.toLowerCase()],
        isActive: true,
        subscriptionActive: true,
        employeesPaid: STAFF.length,
        accountId,
      },
    });

    if (isPro) {
      await prisma.user.update({ where: { id: proAdmin.id }, data: { tenantId: tenant.id } });
    } else {
      await prisma.user.update({ where: { id: adminId }, data: { tenantId: tenant.id } });
    }

    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        timezone: 'Africa/Casablanca',
        currency: 'MAD',
        language: 'fr',
        bookingAdvanceDays: 30,
        cancellationHours: 24,
        businessHours: TENANT_BUSINESS_HOURS,
        photos: [cover, SALON_PHOTOS[(index + 2) % SALON_PHOTOS.length]],
        description: blurb,
        featured: true,
        showOnlineReservation: true,
        onlineReservationEnabled: true,
        showReviews: true,
        showMap: true,
        showOpeningHours: true,
      },
    });

    const services = [];
    for (const service of serviceSlice) {
      services.push(await prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: service.name,
          abbreviation: service.name.slice(0, 8).toUpperCase().replace(/\s+/g, ''),
          description: service.name,
          category: service.category,
          color: service.color,
          price: service.price,
          priceType: 'FIXED',
          duration: service.duration,
          visibility: 'BOOKABLE',
          competences: [],
        },
      }));
    }

    const staff = await createStaff(prisma, tenant.id, subdomain, staffPassword);
    await prisma.employeeService.createMany({
      data: staff.flatMap((member) => services.map((service) => ({
        employeeId: member.employeeId,
        serviceId: service.id,
      }))),
    });

    venueIds.push(tenant.id);
    venueStaff.push(staff);

    if (!isPro) continue;

    const photoCursor = { male: 0, female: 0 };
    const clients = [];
    for (let i = 0; i < CLIENT_NAMES.length; i++) {
      const [firstName, lastName] = CLIENT_NAMES[i];
      const gender = CLIENT_GENDERS[i];
      const age = 18 + ((i * 7) % 40);
      clients.push(await prisma.client.create({
        data: {
          tenantId: tenant.id,
          firstName,
          lastName,
          email: i % 4 === 3 ? null : emailFor(firstName, lastName),
          phone: phoneFor(i),
          address: `${10 + i} Rue des Fleurs, Casablanca`,
          avatar: photoFor(gender, photoCursor[gender]++),
          gender,
          status: i % 5 === 0 ? 'INACTIVE' : 'ACTIVE',
          dateOfBirth: new Date(Date.UTC(2026 - age, i % 12, (i % 27) + 1)),
          createdAt: new Date(2026, 6, 1 - i * 2),
        },
      }));
    }

    const proServices = services;
    const proStaff = staff;
    const appointmentIds: string[] = [];

    for (let index = 0; index < 150; index++) {
      const rosterSize = index < 23 ? 6 : index < 59 ? 10 : index < 102 ? 13 : 16;
      const clientIndex = index % rosterSize;
      const client = clients[clientIndex];
      const serviceCount = (index * 4 % 10) < 4 ? 2 : 1;
      const selected = Array.from({ length: serviceCount }, (_, si) => proServices[(index * 5 + si * 7) % proServices.length]);
      const lines = selected.map((service, serviceIndex) => ({
        service,
        staff: proStaff[(index + serviceIndex * 3) % proStaff.length],
      }));
      const totalDuration = lines.reduce((sum, line) => sum + line.service.duration, 0);
      const totalPrice = lines.reduce((sum, line) => sum + line.service.price, 0);
      const day = appointmentDay(index);
      const hour = [9, 10, 11, 14, 15, 16][index % 6];
      const start = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour, index % 2 ? 30 : 0));
      const end = new Date(start.getTime() + totalDuration * 60000);
      const past = isBeforeToday(day);
      const isGroup = index % 15 === 0;
      const status = past
        ? (index % 23 === 0 ? 'CANCELLED' : index % 18 === 0 ? 'NO_SHOW' : 'COMPLETED')
        : isGroup ? 'CONFIRMED' : index % 20 === 0 ? 'CANCELLED' : index % 7 === 0 ? 'PENDING' : 'CONFIRMED';
      const source = isGroup ? 'STAFF' : (index % 5 === 3 ? 'ONLINE' : 'STAFF');
      const leadDays = [0, 1, 3, 5, 2, 7, 4, 10, 3, 6][index % 10];
      const bookedAt = new Date(start.getTime() - leadDays * 86400000);

      let bookingGroupId: string | undefined;
      if (isGroup) {
        const group = await prisma.bookingGroup.create({
          data: {
            tenantId: tenant.id,
            bookerClientId: client.id,
            bookerFirstName: client.firstName,
            bookerLastName: client.lastName,
            bookerPhone: client.phone,
            bookerEmail: client.email,
            startTime: start,
            status: status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
            grandTotal: totalPrice,
          },
        });
        bookingGroupId = group.id;
      }

      const cutoff = new Date(2026, 8, 30);
      const invoiceable = day < cutoff;
      const paid = index % 3 !== 0;

      const appointment = await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          serviceId: lines[0].service.id,
          employeeId: proStaff[index % proStaff.length].userId,
          createdById: proAdmin.id,
          startTime: start,
          endTime: end,
          duration: totalDuration,
          status,
          source,
          notes: past ? 'Rendez-vous terminé.' : index % 8 === 0 ? 'Préférence : accueil côté cour.' : null,
          createdAt: bookedAt,
          bookingGroupId,
          cancelledAt: status === 'CANCELLED' ? bookedAt : null,
          services: {
            create: lines.map((line, serviceIndex) => ({
              serviceId: line.service.id,
              serviceName: line.service.name,
              duration: line.service.duration,
              price: line.service.price,
              sortOrder: serviceIndex,
              employeeId: line.staff.userId,
            })),
          },
          ...(invoiceable
            ? {
                invoice: {
                  create: {
                    tenantId: tenant.id,
                    clientId: client.id,
                    invoiceNumber: `FAC-2026-${String(index + 1).padStart(4, '0')}`,
                    amount: totalPrice,
                    tax: 0,
                    total: totalPrice,
                    status: paid ? 'PAID' : 'PENDING',
                    paymentMethod: (['CASH', 'CARD', 'BANK_TRANSFER'] as const)[index % 3],
                    paidAt: paid ? start : null,
                    createdAt: start,
                    items: {
                      create: lines.map((line) => ({
                        serviceId: line.service.id,
                        serviceName: line.service.name,
                        price: line.service.price,
                        quantity: 1,
                      })),
                    },
                  },
                },
              }
            : {}),
        },
      });
      appointmentIds.push(appointment.id);
    }

    for (let index = 0; index < 36; index++) {
      const client = clients[index % clients.length];
      const status = index % 5 === 0 ? 'PENDING' : index % 3 === 0 ? 'REJECTED' : 'APPROVED';
      const appointment = appointmentIds[(index * 4) % appointmentIds.length];
      await prisma.review.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          appointmentId: appointment,
          employeeId: proStaff[index % proStaff.length].userId,
          rating: index % 13 === 0 ? 3 : index % 7 === 0 ? 4 : 5,
          comment: REVIEW_COMMENTS[index % 3],
          status,
          rejectReason: status === 'REJECTED' ? 'Le commentaire ne respecte pas les règles de publication.' : null,
          createdAt: appointmentDay((index * 4) % 150),
        },
      });
    }

    console.log(`  ✓ ${name} — ${clients.length} clients, ${proServices.length} services, 150 RDV`);
  }

  console.log('\n👤 Nour Benali (client demo)…');
  const nour = await prisma.client.create({
    data: {
      tenantId: venueIds[0],
      email: 'demo.client@reza.ma',
      password: demoPassword,
      firstName: 'Nour',
      lastName: 'Benali',
      phone: '+212612345678',
      gender: 'female',
      avatar: FEMALE_PHOTOS[0],
      status: 'ACTIVE',
    },
  });

  for (const favoriteIndex of [0, 2, 5]) {
    await prisma.favorite.create({
      data: { clientId: nour.id, tenantId: venueIds[favoriteIndex] },
    });
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const availableDays = Math.floor((endOfNextMonth.getTime() - now.getTime()) / 86400000) + 1;

  for (let index = 0; index < 34; index++) {
    const venueIndex = index % venueIds.length;
    const tenantId = venueIds[venueIndex];
    const services = await prisma.service.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    const service = services[index % services.length];
    const staff = venueStaff[venueIndex][index % venueStaff[venueIndex].length];
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + Math.floor((index * availableDays) / 34));
    const start = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 10 + (index % 8), 0));
    const end = new Date(start.getTime() + service.duration * 60000);
    const status = index % 7 === 0 ? 'COMPLETED' : index % 8 === 0 ? 'CANCELLED' : 'CONFIRMED';
    const admin = await prisma.user.findFirst({ where: { tenantId, role: 'ADMIN' } });
    await prisma.appointment.create({
      data: {
        tenantId,
        clientId: nour.id,
        serviceId: service.id,
        employeeId: staff.userId,
        createdById: admin?.id || proAdmin.id,
        startTime: start,
        endTime: end,
        duration: service.duration,
        status,
        source: 'ONLINE',
        services: {
          create: [{
            serviceId: service.id,
            serviceName: service.name,
            duration: service.duration,
            price: service.price,
            sortOrder: 0,
            employeeId: staff.userId,
          }],
        },
      },
    });

    if (index < 28) {
      await prisma.review.create({
        data: {
          tenantId: venueIds[index % venueIds.length],
          clientId: nour.id,
          rating: index % 6 === 0 ? 4 : 5,
          comment: NOUR_COMMENTS[index % 3],
          status: 'APPROVED',
          createdAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - index - 1),
        },
      });
    }
  }

  console.log('  ✓ demo.client@reza.ma — 34 RDV, 3 favoris, 28 avis');
  console.log('  ✓ 7 discovery salons, each with its own account');
}
