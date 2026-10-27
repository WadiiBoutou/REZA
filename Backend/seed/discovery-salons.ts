import type { PrismaClient } from '../prisma/generated/prisma/client';
import { hashPassword } from '../src/utils/password';
import {
  EMPLOYEE_WORKING_HOURS,
  PASSWORDS,
  TENANT_BUSINESS_HOURS,
} from './constants';

type DiscoveryVenue = {
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
  featured: boolean;
  services: Array<{ name: string; duration: number; price: number; description: string; category: string }>;
};

/** Standalone salons for client discovery (not on Spa Royal account). */
const DISCOVERY_VENUES: DiscoveryVenue[] = [
  {
    subdomain: 'elegance',
    name: 'Salon Élégance',
    email: 'contact@elegance.ma',
    phone: '+212522000001',
    category: 'Coiffeur',
    address: 'Maarif, Casablanca',
    city: 'Casablanca',
    coverImage:
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop',
    latitude: 33.585,
    longitude: -7.635,
    featured: true,
    shortDescription: 'Salon de coiffure premium à Maarif',
    services: [
      { name: 'Coupe femme', duration: 45, price: 150, description: 'Coupe, shampoing et brushing', category: 'Coiffure' },
      { name: 'Coloration', duration: 90, price: 250, description: 'Coloration complète avec soin', category: 'Coloration' },
    ],
  },
  {
    subdomain: 'barber-studio',
    name: 'Barber Studio',
    email: 'contact@barberstudio.ma',
    phone: '+212522000002',
    category: 'Barbier',
    address: 'Racine, Casablanca',
    city: 'Casablanca',
    coverImage:
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop',
    latitude: 33.595,
    longitude: -7.637,
    featured: true,
    shortDescription: 'Barbershop moderne à Racine',
    services: [
      { name: 'Coupe homme', duration: 30, price: 80, description: 'Coupe classique ou moderne', category: 'Barbier' },
      { name: 'Taille de barbe', duration: 20, price: 50, description: 'Taille et entretien de barbe', category: 'Barbier' },
    ],
  },
  {
    subdomain: 'beauty-chic',
    name: 'Beauty Center Chic',
    email: 'contact@beautychic.ma',
    phone: '+212522000004',
    category: 'Institut de beauté',
    address: 'Centre-ville, Casablanca',
    city: 'Casablanca',
    coverImage:
      'https://images.unsplash.com/photo-1600334129128-685c5582fd35?q=80&w=800&auto=format&fit=crop',
    latitude: 33.59,
    longitude: -7.61,
    featured: false,
    shortDescription: 'Centre de beauté en centre-ville',
    services: [
      { name: 'Manucure gel', duration: 60, price: 120, description: 'Pose de gel', category: 'Manucure' },
      { name: 'Épilation jambes', duration: 30, price: 90, description: 'Épilation à la cire', category: 'Esthétique' },
    ],
  },
  {
    subdomain: 'nail-bar',
    name: 'Nail Bar Chic',
    email: 'contact@nailbar.ma',
    phone: '+212522000005',
    category: 'Manucure',
    address: 'Racine, Casablanca',
    city: 'Casablanca',
    coverImage:
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=800&auto=format&fit=crop',
    latitude: 33.594,
    longitude: -7.638,
    featured: false,
    shortDescription: 'Nail bar à Racine',
    services: [
      { name: 'Pose résine', duration: 75, price: 160, description: 'Pose résine avec nail art', category: 'Manucure' },
      { name: 'Vernis semi-permanent', duration: 45, price: 100, description: 'Vernis longue durée', category: 'Manucure' },
    ],
  },
  {
    subdomain: 'zen-spa',
    name: 'Zen Spa',
    email: 'contact@zenspa.ma',
    phone: '+212522000006',
    category: 'Massage',
    address: 'Anfa, Casablanca',
    city: 'Casablanca',
    coverImage:
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop',
    latitude: 33.592,
    longitude: -7.648,
    featured: true,
    shortDescription: 'Massages et bien-être à Anfa',
    services: [
      { name: 'Massage suédois', duration: 60, price: 220, description: 'Massage relaxant complet', category: 'Massage' },
      { name: 'Réflexologie plantaire', duration: 45, price: 160, description: 'Massage des pieds', category: 'Massage' },
    ],
  },
];

export async function seedDiscoverySalons(prisma: PrismaClient) {
  console.log('\n📍 Discovery salons (client app)…');

  const adminPassword = await hashPassword(PASSWORDS.admin);
  const clientPassword = await hashPassword(PASSWORDS.client);

  let platformClientTenantId: string | null = null;

  for (const venue of DISCOVERY_VENUES) {
    const tenant = await prisma.tenant.create({
      data: {
        name: venue.name,
        subdomain: venue.subdomain,
        email: venue.email,
        phone: venue.phone,
        address: venue.address,
        category: venue.category,
        coverImage: venue.coverImage,
        shortDescription: venue.shortDescription,
        city: venue.city,
        latitude: venue.latitude,
        longitude: venue.longitude,
        googleMapsLink: `https://maps.google.com/?q=${venue.latitude},${venue.longitude}`,
        isActive: true,
        subscriptionActive: true,
        employeesPaid: 1,
        tags: [venue.category.toLowerCase(), 'casablanca'],
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
        photos: [venue.coverImage],
        description: venue.shortDescription,
        featured: venue.featured,
        showOnlineReservation: true,
        onlineReservationEnabled: true,
        showReviews: true,
        showMap: true,
        showOpeningHours: true,
      },
    });

    const admin = await prisma.user.create({
      data: {
        email: `admin@${venue.subdomain}.ma`,
        password: adminPassword,
        firstName: 'Admin',
        lastName: venue.name.split(' ')[0],
        phone: venue.phone,
        role: 'ADMIN',
        tenantId: tenant.id,
        isActive: true,
      },
    });

    const account = await prisma.account.create({
      data: { ownerUserId: admin.id, isActive: true },
    });
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { accountId: account.id },
    });
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    await prisma.subscription.create({
      data: {
        accountId: account.id,
        status: 'ACTIVE',
        salonsPaid: 1,
        subscribedAt: new Date(),
        currentPeriodEnd: periodEnd,
      },
    });

    const services = [];
    for (const s of venue.services) {
      services.push(
        await prisma.service.create({
          data: {
            tenantId: tenant.id,
            name: s.name,
            abbreviation: s.name.slice(0, 8).toUpperCase().replace(/\s+/g, ''),
            description: s.description,
            category: s.category,
            color: '#111827',
            price: s.price,
            priceType: 'FIXED',
            duration: s.duration,
            visibility: 'BOOKABLE',
            competences: [],
          },
        })
      );
    }

    const employee = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Sara',
        lastName: 'Benali',
        email: `sara@${venue.subdomain}.ma`,
        phone: '+212600000099',
        isActive: true,
        isPublic: true,
        workingHours: EMPLOYEE_WORKING_HOURS,
        agendaSettings: {
          color: '#7C3AED',
          role: 'Styliste',
          timeSlotDuration: 30,
          bufferTime: 5,
          maxAppointmentsPerDay: 14,
          allowOnlineBooking: true,
          status: 'active',
        },
      },
    });

    await prisma.employeeService.createMany({
      data: services.map((svc) => ({ employeeId: employee.id, serviceId: svc.id })),
    });

    if (!platformClientTenantId) {
      platformClientTenantId = tenant.id;
    }

    console.log(`  ✓ ${venue.name} (admin@${venue.subdomain}.ma / ${PASSWORDS.admin})`);
    void admin;
  }

  if (platformClientTenantId) {
    await prisma.client.create({
      data: {
        tenantId: platformClientTenantId,
        email: 'client1@gmail.com',
        password: clientPassword,
        firstName: 'Client',
        lastName: 'Demo',
        phone: '+212612345678',
        status: 'ACTIVE',
      },
    });
    console.log(`  ✓ B2C client client1@gmail.com / ${PASSWORDS.client}`);
  }
}
