import { DEMO_CLIENT } from './demo-mode';
import { DEMO_EMPLOYEE_PHOTOS, DEMO_SALON_PHOTOS, demoClientPhoto } from './demo-images';

const salonNames = [
  ['Atelier Noor', 'Casablanca', 'Institut de beauté'], ['Maison Safran', 'Rabat', 'Coiffeur'],
  ['Studio Sable', 'Marrakech', 'Barbier'], ['Ligne Claire', 'Tanger', 'Manucure'],
  ['Dar Glow', 'Fès', 'Institut de beauté'], ['Le Petit Fauteuil', 'Agadir', 'Barbier'],
  ['Miroir Moderne', 'Meknès', 'Coiffeur'], ['Nacre Studio', 'Casablanca', 'Manucure'],
];

const serviceCatalog = [
  { name: 'Coupe & brushing', category: 'Coiffure', duration: 60, price: 280 },
  { name: 'Coloration signature', category: 'Coiffure', duration: 120, price: 650 },
  { name: 'Soin visage éclat', category: 'Soin visage', duration: 75, price: 420 },
  { name: 'Manucure soin', category: 'Onglerie', duration: 45, price: 180 },
  { name: 'Massage relaxant', category: 'Bien-être', duration: 60, price: 500 },
  { name: 'Balayage lumière', category: 'Coiffure', duration: 150, price: 900 },
  { name: 'Taille de barbe', category: 'Barbier', duration: 30, price: 140 },
];

const staffNames = [['Salma', 'Bennani'], ['Youssef', 'Amrani'], ['Lina', 'Idrissi'], ['Meryem', 'Alaoui']];

const SALON_PHOTO_INDEX = [0, 4, 1, 3, 2, 1, 5, 3];

const salons = salonNames.map(([name, city, category], index) => ({
  id: `demo-salon-${index + 1}`,
  name,
  city,
  category,
  address: `${12 + index} Rue des Orangers, ${city}`,
  shortDescription: ['Un studio de beauté contemporain, pensé pour prendre le temps.', 'Des gestes précis, une atmosphère calme et des équipes passionnées.', 'Votre adresse de quartier pour une parenthèse qui fait du bien.'][index % 3],
  coverImage: DEMO_SALON_PHOTOS[SALON_PHOTO_INDEX[index]],
  settings: {
    coverImages: [
      DEMO_SALON_PHOTOS[(index + 2) % DEMO_SALON_PHOTOS.length],
      DEMO_SALON_PHOTOS[(index + 4) % DEMO_SALON_PHOTOS.length],
    ],
  },
  averageRating: [4.9, 4.8, 4.7, 4.9, 4.6, 4.8, 4.7, 4.9][index],
  rating: [4.9, 4.8, 4.7, 4.9, 4.6, 4.8, 4.7, 4.9][index],
  reviewCount: 38 + index * 17,
  totalReviews: 38 + index * 17,
  subscriptionActive: true,
  services: serviceCatalog.slice(index % 3, index % 3 + 4).map((service) => service.name),
}));

function servicesForSalon(salonId: string) {
  const index = Math.max(0, salons.findIndex((item) => item.id === salonId));
  return serviceCatalog.slice(index % 3, index % 3 + 4).map((service, serviceIndex) => ({
    ...service,
    id: `demo-service-${index + 1}-${serviceIndex + 1}`,
    tenantId: `demo-salon-${index + 1}`,
  }));
}

const staff = staffNames.map(([firstName, lastName], index) => ({
  id: `demo-employee-${index + 1}`, firstName, lastName, name: `${firstName} ${lastName}`,
  avatar: DEMO_EMPLOYEE_PHOTOS[firstName.toLowerCase()], role: ['Coiffeuse', 'Barbier', 'Esthéticienne', 'Prothésiste ongulaire'][index],
}));

const client = {
  id: 'demo-client', email: DEMO_CLIENT.email, firstName: 'Nour', lastName: 'Benali',
  name: 'Nour Benali', phone: '+212 6 12 34 56 78', gender: 'FEMALE',
  avatar: demoClientPhoto('FEMALE', 0),
};

const dayAt = (offset: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
};

const appointmentDay = (index: number, count: number) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const availableDays = Math.floor((endOfNextMonth.getTime() - now.getTime()) / 86400000) + 1;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + Math.floor((index * availableDays) / count));
};

const appointments: any[] = Array.from({ length: 34 }, (_, index) => {
  const salon = salons[index % salons.length];
  const salonServices = servicesForSalon(salon.id);
  const service = salonServices[index % salonServices.length];
  const employee = staff[index % staff.length];
  const date = appointmentDay(index, 34);
  const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const status = index % 7 === 0 ? 'completed' : index % 8 === 0 ? 'cancelled' : 'confirmed';
  return {
    id: `demo-client-appointment-${index + 1}`, tenantId: salon.id, tenant: salon, date: dateString,
    image: salon.coverImage,
    salon: salon.name, service: service.name, tenantData: salon, services: [{ service }], employee, employeeId: employee.id,
    serviceId: service.id,
    client, startTime: `${dateString}T${String(10 + index % 8).padStart(2, '0')}:00:00.000Z`,
    endTime: `${dateString}T${String(11 + index % 8).padStart(2, '0')}:00:00.000Z`,
    status, time: `${String(10 + index % 8).padStart(2, '0')}:00`, totalPrice: service.price, price: service.price,
  };
});

const reviews = Array.from({ length: 28 }, (_, index) => ({
  id: `demo-client-review-${index + 1}`, tenantId: salons[index % salons.length].id,
  tenant: salons[index % salons.length], rating: index % 6 === 0 ? 4 : 5,
  salonImage: salons[index % salons.length].coverImage,
  comment: ['Une belle découverte, équipe très attentionnée.', 'Tout était parfait, du début à la fin.', 'Résultat impeccable, je recommande sans hésiter.'][index % 3],
  createdAt: dayAt(-index - 1).toISOString(),
}));

const familyMembers: any[] = [];
const favorites: any[] = [salons[0], salons[2], salons[5]].map((item, index) => ({ id: `demo-favorite-${index + 1}`, tenant: item, tenantId: item.id }));

function emitUpdate(type: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('reza-demo-update', { detail: { app: 'client', type } }));
  }
}

function parseBody(options: RequestInit) {
  if (typeof options.body !== 'string') return {};
  try { return JSON.parse(options.body); } catch { return {}; }
}

function filterSalons(url: URL) {
  const search = (url.searchParams.get('search') || '').toLowerCase();
  const category = (url.searchParams.get('category') || '').toLowerCase();
  const city = (url.searchParams.get('city') || '').toLowerCase();
  return salons.filter((item) => (!search || `${item.name} ${item.city} ${item.category}`.toLowerCase().includes(search)) && (!category || item.category.toLowerCase().includes(category)) && (!city || item.city.toLowerCase().includes(city)));
}

export async function demoApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = new URL(endpoint, 'https://demo.local');
  const path = decodeURIComponent(url.pathname.replace(/\/$/, ''));
  const method = (options.method || 'GET').toUpperCase();
  const body = parseBody(options);
  let result: any = {};

  if (path === '/public/tenants') {
    result = { tenants: filterSalons(url).slice(0, Number(url.searchParams.get('limit') || 50)) };
  } else if (path === '/public/categories') {
    result = { categories: [...new Set(salons.map((item) => item.category))].map((name) => ({ name, count: salons.filter((item) => item.category === name).length })) };
  } else if (path === '/public/employees/featured') {
    result = { employees: staff.map((item, index) => {
      const salon = salons[index];
      return {
        ...item,
        tenant: salon,
        tenantId: salon.id,
        salonName: salon.name,
        specialty: item.role,
        rating: salon.rating,
        reviews: salon.reviewCount,
        services: servicesForSalon(salon.id),
      };
    }) };
  } else if (path.startsWith('/public/tenant/')) {
    const segments = path.split('/');
    const salonId = segments[3];
    const salon = salons.find((item) => item.id === salonId) || salons[0];
    if (segments.length === 4) result = { tenant: salon };
    else if (segments[4] === 'services') result = { services: servicesForSalon(salon.id).filter((item) => !url.searchParams.get('category') || item.category === url.searchParams.get('category')) };
    else if (segments[4] === 'employees') result = { employees: staff.slice(0, 3) };
    else if (segments[4] === 'reviews') result = { reviews: reviews.filter((item) => item.tenantId === salon.id).slice(0, Number(url.searchParams.get('limit') || 10)), pagination: { page: Number(url.searchParams.get('page') || 1), total: salon.reviewCount }, stats: { averageRating: salon.averageRating, totalReviews: salon.reviewCount } };
    else if (segments[4] === 'available-slots') result = { slots: ['09:30', '10:30', '11:00', '13:30', '14:30', '16:00', '17:00'] };
    else if (segments[4] === 'available-days') {
      const from = new Date(url.searchParams.get('from') || new Date().toISOString());
      const to = new Date(url.searchParams.get('to') || dayAt(60).toISOString());
      const days: string[] = [];
      for (const date = new Date(from); date <= to; date.setDate(date.getDate() + 1)) {
        if (date.getDay() !== 0) days.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
      }
      result = { days };
    }
  } else if (path === '/public/auth/client-login' && method === 'POST') {
    result = { client, token: 'reza-client-demo-session', message: 'Connexion démo réussie.' };
  } else if (path === '/public/bookings' && method === 'POST') {
    const salon = salons.find((item) => item.id === body.tenantId) || salons[0];
    const salonServices = servicesForSalon(salon.id);
    const selectedService = salonServices.find((item) => body.serviceIds?.includes(item.id)) || salonServices[0];
    const startTime = body.startTime || new Date().toISOString();
    const created = { id: `demo-client-appointment-${Date.now()}`, tenantId: salon.id, tenant: salon, date: String(startTime).slice(0, 10), image: salon.coverImage, salon: salon.name, tenantData: salon, service: selectedService.name, serviceId: selectedService.id, services: [{ service: selectedService }], employee: staff[0], employeeId: staff[0].id, client, startTime, time: String(startTime).slice(11, 16), status: 'pending', totalPrice: selectedService.price, price: selectedService.price };
    appointments.unshift(created);
    result = { bookingGroup: { id: `demo-booking-${Date.now()}` }, appointments: [created], client, pricing: { participants: [], grandTotal: selectedService.price }, message: 'Demande de réservation envoyée.' };
    emitUpdate('booking-created');
  } else if (path.startsWith('/public/client/') && path.endsWith('/appointments')) {
    result = { appointments, client };
  } else if (path.startsWith('/public/client/') && path.endsWith('/reviews')) {
    result = { reviews };
  } else if (path.startsWith('/public/client/') && path.endsWith('/notifications')) {
    result = { notifications: [], grouped: {}, unreadCount: 0 };
  } else if (path.startsWith('/public/client/') && path.endsWith('/family-members')) {
    result = { familyMembers };
  } else if (path.startsWith('/public/client/') && path.endsWith('/favorites')) {
    result = { favorites, count: favorites.length };
  } else if (path.startsWith('/public/appointments/') && path.endsWith('/cancel')) {
    const appointment = appointments.find((item) => item.id === path.split('/')[2]);
    if (appointment) appointment.status = 'cancelled';
    result = { appointment, message: 'Rendez-vous annulé.' };
    emitUpdate('booking-cancelled');
  } else if (path === '/public/favorites' && method === 'POST') {
    const salon = salons.find((item) => item.id === body.tenantId) || salons[0];
    favorites.push({ id: `demo-favorite-${Date.now()}`, tenant: salon, tenantId: salon.id });
    result = { favorite: favorites[favorites.length - 1], message: 'Ajouté aux favoris.' };
    emitUpdate('favorite-added');
  } else if (path.startsWith('/public/favorites/') && method === 'DELETE') {
    const index = favorites.findIndex((item) => item.id === path.split('/')[3]);
    if (index >= 0) favorites.splice(index, 1);
    result = { message: 'Retiré des favoris.' };
    emitUpdate('favorite-removed');
  } else if (path.startsWith('/public/client/') && method === 'PUT') {
    Object.assign(client, body);
    result = { client, message: 'Profil mis à jour.' };
    emitUpdate('profile-updated');
  } else if (path === '/public/available-days' || path.endsWith('/available-days')) {
    const from = new Date(url.searchParams.get('from') || new Date().toISOString());
    const to = new Date(url.searchParams.get('to') || dayAt(60).toISOString());
    const days: string[] = [];
    for (const date = new Date(from); date <= to; date.setDate(date.getDate() + 1)) {
      if (date.getDay() !== 0) days.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    }
    result = { days };
  } else if (path === '/public/auth/client-register') {
    result = { client: { ...client, ...body }, message: 'Compte démo créé.' };
  } else if (path.includes('/read') || path.includes('password') || path.includes('billing-config')) {
    result = { message: 'Action simulée avec succès.' };
  }

  return result as T;
}