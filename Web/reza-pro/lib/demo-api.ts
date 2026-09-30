import { DEMO_ADMIN } from './demo-mode';
import { DEMO_ADMIN_PHOTO, DEMO_EMPLOYEE_PHOTOS, DEMO_SALON_PHOTOS, demoClientPhoto } from './demo-images';

const DEMO_SUBSCRIPTION_END = new Date(Date.UTC(2026, 11, 1, 12, 0, 0)).toISOString(); // 01/12/2026

const salon = {
  id: 'demo-salon',
  name: 'Atelier Noor',
  email: DEMO_ADMIN.email,
  phone: '+212 5 22 00 00 00',
  address: '12 Rue des Orangers',
  city: 'Casablanca',
  category: 'Institut de beauté',
  shortDescription: 'Un studio de beauté contemporain au coeur de Casablanca.',
  coverImage: DEMO_SALON_PHOTOS[0],
  subscriptionActive: true,
};

let services = [
  { id: 'service-cut', name: 'Coupe & brushing', duration: 60, price: 280, priceType: 'FIXED', priceFrom: null, priceTo: null, onQuote: false, category: 'Coiffure', visibility: 'BOOKABLE', competences: [], multipleProviders: false, color: '#d77c65', isActive: true },
  { id: 'service-color', name: 'Coloration signature', duration: 120, price: 650, priceType: 'FIXED', priceFrom: null, priceTo: null, onQuote: false, category: 'Coiffure', visibility: 'BOOKABLE', competences: [], multipleProviders: false, color: '#537f78', isActive: true },
  { id: 'service-facial', name: 'Soin visage éclat', duration: 75, price: 420, priceType: 'FIXED', priceFrom: null, priceTo: null, onQuote: false, category: 'Soin visage', visibility: 'BOOKABLE', competences: [], multipleProviders: false, color: '#bd9a52', isActive: true },
  { id: 'service-mani', name: 'Manucure soin', duration: 45, price: 180, priceType: 'FIXED', priceFrom: null, priceTo: null, onQuote: false, category: 'Onglerie', visibility: 'BOOKABLE', competences: [], multipleProviders: false, color: '#7c7892', isActive: true },
  { id: 'service-massage', name: 'Massage relaxant', duration: 60, price: 500, priceType: 'FIXED', priceFrom: null, priceTo: null, onQuote: false, category: 'Bien-être', visibility: 'BOOKABLE', competences: [], multipleProviders: false, color: '#d77c65', isActive: true },
  { id: 'service-balayage', name: 'Balayage lumière', duration: 150, price: 900, priceType: 'FIXED', priceFrom: null, priceTo: null, onQuote: false, category: 'Coiffure', visibility: 'BOOKABLE', competences: [], multipleProviders: false, color: '#537f78', isActive: true },
];

let serviceCategories = [...new Set(services.map((service) => service.category))];

let employees = [
  { id: 'employee-salma', firstName: 'Salma', lastName: 'Bennani', name: 'Salma Bennani', role: 'Coiffeuse', isActive: true, color: '#d77c65', avatar: DEMO_EMPLOYEE_PHOTOS.salma, tenantId: salon.id, agendaSettings: { color: '#d77c65' } },
  { id: 'employee-youssef', firstName: 'Youssef', lastName: 'Amrani', name: 'Youssef Amrani', role: 'Barbier', isActive: true, color: '#537f78', avatar: DEMO_EMPLOYEE_PHOTOS.youssef, tenantId: salon.id, agendaSettings: { color: '#537f78' } },
  { id: 'employee-lina', firstName: 'Lina', lastName: 'Idrissi', name: 'Lina Idrissi', role: 'Esthéticienne', isActive: true, color: '#bd9a52', avatar: DEMO_EMPLOYEE_PHOTOS.lina, tenantId: salon.id, agendaSettings: { color: '#bd9a52' } },
  { id: 'employee-meryem', firstName: 'Meryem', lastName: 'Alaoui', name: 'Meryem Alaoui', role: 'Prothésiste ongulaire', isActive: true, color: '#7c7892', avatar: DEMO_EMPLOYEE_PHOTOS.meryem, tenantId: salon.id, agendaSettings: { color: '#7c7892' } },
];

const clientNames = [
  ['Amine', 'Khaldi'], ['Nadia', 'Tazi'], ['Mehdi', 'Berrada'], ['Sofia', 'El Fassi'],
  ['Imane', 'Chraibi'], ['Omar', 'Lahlou'], ['Aya', 'Benjelloun'], ['Rayan', 'Fikri'],
  ['Adam', 'Mansouri'], ['Leila', 'Naciri'], ['Yasmine', 'Bennis'], ['Anas', 'Tahiri'],
  ['Salma', 'Zerouali'], ['Mehdi', 'Ait Lahcen'], ['Maya', 'Sefrioui'], ['Ilyas', 'Kettani'],
];

const clientGenders: Array<'MALE' | 'FEMALE'> = [
  'MALE', 'FEMALE', 'MALE', 'FEMALE', 'FEMALE', 'MALE', 'FEMALE', 'MALE',
  'MALE', 'FEMALE', 'FEMALE', 'MALE', 'FEMALE', 'MALE', 'FEMALE', 'MALE',
];
const clientPhotoCursor = { MALE: 0, FEMALE: 0 };
const clientPhotos = clientGenders.map((gender) => demoClientPhoto(gender, clientPhotoCursor[gender]++));

const localDay = (offset: number) => {
  const date = new Date(2026, 6, 1); // July 2026 base
  date.setDate(date.getDate() + offset);
  return date;
};

const appointmentDay = (index: number) => {
  const startDate = new Date(2026, 6, 1); // July 1, 2026
  const endDate = new Date(2026, 9, 31); // October 31, 2026
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1; // 123 days
  // Progressive distribution: sparse in July, denser toward October
  // Power function with exponent 0.75 targets ~28 July, ~35 August, ~47 September, ~60 October
  const progress = index / 149;
  // Clamp to ensure no appointment exceeds October 31
  const weightedDays = Math.min(Math.floor(totalDays * Math.pow(progress, 0.75)), totalDays - 1);
  return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + weightedDays);
};

const localDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const pastDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const now = new Date();
  return date < now;
};

const appointments: any[] = Array.from({ length: 150 }, (_, index) => {
  // Client assignment: staggered roster so each month introduces new clients
  // (6 clients in July, 10 by August, 13 by September, 16 by October) while
  // existing clients keep booking. This drives the "nouveaux clients" stats.
  const rosterSize = index < 23 ? 6 : index < 59 ? 10 : index < 102 ? 13 : 16;
  const clientIndex = index % rosterSize;
  const [firstName, lastName] = clientNames[clientIndex % clientNames.length];

  // Service variety: mostly 1 service, some 2-services, few 3-services
  const serviceCount = (index * 4 % 10) < 4 ? 2 : 1;
  const serviceIndices = [];
  for (let i = 0; i < serviceCount; i++) {
    serviceIndices.push(i);
  }
  // Distribute services differently per employee for realism
  const selectedServices = serviceIndices.map((si) => services[(index * 5 + si * 7) % services.length]);
  const serviceList = selectedServices;
  const appointmentServices = serviceList.map((item, serviceIndex) => ({
    id: `${item.id}-${index + 1}-${serviceIndex + 1}`,
    serviceId: item.id,
    name: item.name,
    duration: item.duration,
    price: item.price,
    sortOrder: serviceIndex,
    employee: employees[(index + serviceIndex * 3) % employees.length],
  }));
  const totalDuration = appointmentServices.reduce((sum, item) => sum + item.duration, 0);
  const totalPrice = appointmentServices.reduce((sum, item) => sum + item.price, 0);
  const date = appointmentDay(index);
  // Peak hours: 9-11am and 2-4pm busiest, lighter at lunch and evening
  const hourRanges = [9, 10, 11, 14, 15, 16];
  const hour = hourRanges[index % hourRanges.length];
  const startDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hour, index % 2 ? 30 : 0));
  const isPast = pastDate(localDateString(date));
  // Booking lead time: how far in advance the client booked (drives advanceBookingRate)
  const leadDays = [0, 1, 3, 5, 2, 7, 4, 10, 3, 6][index % 10];
  const bookedAt = new Date(startDate.getTime() - leadDays * 86400000);
  // Status: past=completed, future: mix of pending/confirmed, with some cancellations
  const sourceWeights = ['SALON', 'SALON', 'SALON', 'ONLINE', 'SALON'];
  // Group reservations: every 15th appointment
  const isGroup = index % 15 === 0;
  const status = isPast
    ? (index % 23 === 0 ? 'CANCELLED' : index % 18 === 0 ? 'NO_SHOW' : 'COMPLETED')
    : isGroup ? 'CONFIRMED' : index % 20 === 0 ? 'CANCELLED' : index % 7 === 0 ? 'PENDING' : 'CONFIRMED';
  const source = isGroup ? 'SALON' : sourceWeights[index % sourceWeights.length];
  // Group reservation details
  const groupParticipantCount = isGroup ? 3 + (index % 4) : null;
  const bookingGroupId = isGroup ? `booking-group-${Math.floor(index / 15) + 1}` : null;
  // Notes: past appointments have termination notes, some future have preferences
  const notes = isPast ? 'Rendez-vous terminé.' : index % 8 === 0 ? 'Préférence : accueil côté cour.' : '';

  return {
    id: `demo-appointment-${index + 1}`,
    tenantId: salon.id,
    date: localDateString(date),
    startTime: startDate.toISOString(),
    endTime: new Date(startDate.getTime() + totalDuration * 60000).toISOString(),
    createdAt: bookedAt.toISOString(),
    status,
    source,
    clientId: `demo-client-${clientIndex + 1}`,
    client: { id: `demo-client-${clientIndex + 1}`, firstName, lastName, avatar: clientPhotos[clientIndex], email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replaceAll(' ', '')}@example.com`, phone: `+212 6${String(10000000 + index * 7919).slice(0, 8)}` },
    employeeId: employees[(index % employees.length)].id,
    employee: employees[index % employees.length],
    serviceId: serviceList[0].id,
    service: serviceList[0],
    services: appointmentServices,
    duration: totalDuration,
    totalDuration,
    price: totalPrice,
    totalPrice,
    notes,
    bookingGroupId,
    bookingGroupParticipantCount: groupParticipantCount,
  };
});

let demoClients: any[] = clientNames.map(([firstName, lastName], index) => ({
  id: `demo-client-${index + 1}`,
  firstName,
  lastName,
  email: index % 4 === 3 ? null : `${firstName.toLowerCase()}.${lastName.toLowerCase().replaceAll(' ', '')}@example.com`,
  phone: `+212 6${String(10000000 + index * 7919).slice(0, 8)}`,
  address: `${10 + index} Rue des Fleurs, Casablanca`,
  avatar: clientPhotos[index],
  gender: clientGenders[index],
  age: 18 + ((index * 7) % 40),
  status: index % 5 === 0 ? 'INACTIVE' : 'ACTIVE',
  notes: null,
  createdAt: localDay(-index * 2).toISOString(),
  updatedAt: localDay(-index).toISOString(),
  addedAs: index % 4 === 3 ? 'INVITE' : null,
  addedByClient: index % 4 === 3 ? { id: 'demo-booker', firstName: 'Nour', lastName: 'Benali' } : null,
}));

let reviews = Array.from({ length: 36 }, (_, index) => {
  const [firstName, lastName] = clientNames[index % clientNames.length];
  // Statuses interleaved so every month has approved reviews (drives satisfaction stats)
  const status = index % 5 === 0 ? 'PENDING' : index % 3 === 0 ? 'REJECTED' : 'APPROVED';
  // Spread review dates across the whole Jul-Oct appointment window
  const reviewAppointment = appointments[(index * 4) % appointments.length];
  return {
    id: `demo-review-${index + 1}`,
    rating: index % 13 === 0 ? 3 : index % 7 === 0 ? 4 : 5,
    comment: ['Accueil chaleureux et résultat impeccable.', 'Un vrai moment pour soi, je recommande.', 'Très professionnel, je reviendrai bientôt.'][index % 3],
    status,
    createdAt: reviewAppointment.startTime,
    moderatedAt: status === 'PENDING' ? null : reviewAppointment.startTime,
    rejectReason: status === 'REJECTED' ? 'Le commentaire ne respecte pas les règles de publication.' : null,
    client: { id: `demo-client-${(index % clientNames.length) + 1}`, firstName, lastName, avatar: demoClients[index % clientNames.length].avatar, email: demoClients[index % clientNames.length].email },
    service: services[index % services.length],
    employee: employees[index % employees.length],
    appointment: { service: services[index % services.length], employee: employees[index % employees.length] },
  };
});

let invoices = Array.from({ length: 150 }, (_, index) => {
  const appointment = appointments[index];
  // Only generate invoice if appointment is before Sept 30, 2026 (past)
  const dateStr = appointment.date;
  const [year, month, day] = dateStr.split('-').map(Number);
  const appDate = new Date(year, month - 1, day);
  const cutoffDate = new Date(2026, 8, 30); // Sept 30, 2026
  const isPast = appDate < cutoffDate;
  
  // If future appointment, skip invoice generation
  if (!isPast) {
    return null;
  }
  
  const items = appointment.services.map((service: any, itemIndex: number) => ({
    id: `demo-invoice-item-${index + 1}-${itemIndex + 1}`,
    serviceId: service.serviceId,
    serviceName: service.name,
    price: service.price,
    quantity: 1,
    employee: service.employee,
  }));
  const total = appointment.totalPrice;
  // Past appointments: 70% PAID, 30% UNPAID to reflect real-world mix
  const status = index % 3 === 0 ? 'UNPAID' : 'PAID';

  return {
    id: `demo-invoice-${index + 1}`,
    invoiceNumber: `FAC-2026-${String(index + 1).padStart(4, '0')}`,
    number: `FAC-2026-${String(index + 1).padStart(4, '0')}`,
    amount: total,
    tax: 0,
    total,
    status,
    paymentMethod: ['CASH', 'CARD', 'BANK_TRANSFER'][index % 3],
    paidAt: status === 'PAID' ? appointment.startTime : null,
    notes: null,
    createdAt: appointment.startTime,
    client: appointment.client,
    employee: appointment.employee,
    items,
    appointment: {
      id: appointment.id,
      startTime: appointment.startTime,
      service: { name: appointment.service.name },
      employee: appointment.employee,
      services: appointment.services.map((service: any) => ({
        id: service.id,
        serviceId: service.serviceId,
        serviceName: service.name,
        employeeId: service.employee.id,
        employee: service.employee,
      })),
    },
  };
}).filter((item): item is NonNullable<typeof item> => item !== null);

const demoUser = {
  id: 'demo-admin', email: DEMO_ADMIN.email, firstName: 'Amal', lastName: 'El Mansouri',
  avatar: DEMO_ADMIN_PHOTO,
  role: 'TENANT_ADMIN', tenantId: salon.id, emailVerified: true, tenant: { id: salon.id, name: salon.name },
};

function emitUpdate(type: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('reza-demo-update', { detail: { app: 'pro', type } }));
  }
}

function bodyOf(options?: RequestInit): any {
  if (typeof options?.body !== 'string') return {};
  try { return JSON.parse(options.body); } catch { return {}; }
}

function startOfPeriod(period: string | null): Date | null {
  const now = new Date();
  if (period === 'week') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
  return null;
}

function appointmentsForClient(clientId: string) {
  return appointments.filter((appointment) => appointment.clientId === clientId);
}

function getEmployeeServiceEntries(url: URL) {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const categoryId = url.searchParams.get('categoryId');
  const serviceId = url.searchParams.get('serviceId');

  return appointments.flatMap((appointment) => {
    const appointmentDate = new Date(appointment.startTime).getTime();
    if (startDate && appointmentDate < new Date(startDate).getTime()) return [];
    if (endDate && appointmentDate > new Date(endDate).getTime()) return [];
    if (['CANCELLED', 'NO_SHOW'].includes(appointment.status)) return [];

    return (appointment.services || []).filter((service: any) => {
      if (serviceId && serviceId !== 'all' && service.serviceId !== serviceId) return false;
      if (categoryId && categoryId !== 'all') {
        const catalogService = services.find((item) => item.id === service.serviceId);
        if (catalogService?.category !== categoryId) return false;
      }
      return true;
    }).map((service: any) => ({ appointment, service }));
  });
}

function getWorkingDays(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return 22;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return 22;
  let days = 0;
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    if (date.getDay() !== 0) days++;
  }
  return Math.max(days, 1);
}

function getStatsWindow(url: URL) {
  const explicitStart = url.searchParams.get('startDate');
  const explicitEnd = url.searchParams.get('endDate');
  if (explicitStart || explicitEnd) {
    return {
      start: explicitStart ? new Date(explicitStart) : null,
      end: explicitEnd ? new Date(explicitEnd) : null,
    };
  }

  const now = new Date();
  const period = url.searchParams.get('period');
  if (period === 'week') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    };
  }
  if (period === 'month') {
    const year = Number(url.searchParams.get('year') || now.getFullYear());
    const month = Number(url.searchParams.get('month') ?? now.getMonth());
    return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0, 23, 59, 59, 999) };
  }
  if (period === 'year') {
    const year = Number(url.searchParams.get('year') || now.getFullYear());
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) };
  }
  return { start: null, end: null };
}

function appointmentsForStats(url: URL) {
  const { start, end } = getStatsWindow(url);
  return appointments.filter((appointment) => {
    const time = new Date(appointment.startTime).getTime();
    return (!start || time >= start.getTime()) && (!end || time <= end.getTime());
  });
}

// Window immediately before the current one (same length), used for real
// period-over-period deltas. Returns null when there is no comparable window.
function getPreviousStatsWindow(start: Date | null, end: Date | null, period: string | null) {
  if (!start || !end) return null;
  if (period === 'week') {
    return { start: new Date(start.getTime() - 7 * 86400000), end: new Date(start.getTime() - 1) };
  }
  if (period === 'month') {
    return {
      start: new Date(start.getFullYear(), start.getMonth() - 1, 1),
      end: new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999),
    };
  }
  if (period === 'year') {
    return {
      start: new Date(start.getFullYear() - 1, 0, 1),
      end: new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
    };
  }
  return null;
}

function serviceEntriesForAppointments(rangeAppointments: any[]) {
  return rangeAppointments.flatMap((appointment) => (appointment.services || []).map((service: any) => ({ appointment, service })));
}

export async function demoApiRequest<T extends Record<string, any>>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = new URL(endpoint, 'https://demo.local');
  const path = url.pathname.replace(/\/$/, '');
  const method = (options.method || 'GET').toUpperCase();
  const body = bodyOf(options);
  let result: any = {};

  if (path === '/auth/login' && method === 'POST') {
    result = { token: 'reza-demo-session', user: demoUser, salons: [salon], activeTenantId: salon.id, salonLimit: 3, subscription: { status: 'ACTIVE', currentPeriodEnd: DEMO_SUBSCRIPTION_END, salonsPaid: 1 } };
  } else if (path === '/auth/me') {
    result = { user: demoUser, salons: [salon], activeTenantId: salon.id, salonLimit: 3, subscription: { status: 'ACTIVE', currentPeriodEnd: DEMO_SUBSCRIPTION_END, salonsPaid: 1 } };
  } else if (path === '/auth/logout') {
    result = { success: true };
  } else if (path === '/salons' && method === 'GET') {
    result = { salons: [salon], salonLimit: 3, subscription: { status: 'ACTIVE' }, account: { id: 'demo-account', isActive: true } };
  } else if (path === '/appointments' && method === 'GET') {
    let filtered = [...appointments];
    const from = url.searchParams.get('startDate');
    const to = url.searchParams.get('endDate');
    if (from) filtered = filtered.filter((item) => item.date >= from.slice(0, 10));
    if (to) filtered = filtered.filter((item) => item.date <= to.slice(0, 10));
    const status = url.searchParams.get('status');
    if (status) filtered = filtered.filter((item) => item.status === status);
    result = { appointments: filtered, total: filtered.length, page: Number(url.searchParams.get('page') || 1), limit: Number(url.searchParams.get('limit') || filtered.length) };
  } else if (path === '/appointments' && method === 'POST') {
    const date = String(body.startTime || body.date || localDateString(localDay(0))).slice(0, 10);
    const selectedService = services.find((item) => item.id === body.serviceId || item.id === body.serviceIds?.[0]) || services[0];
    const selectedEmployee = employees.find((item) => item.id === body.employeeId) || employees[0];
    const created = { ...body, id: `demo-appointment-${Date.now()}`, tenantId: salon.id, date, status: body.status || 'CONFIRMED', service: selectedService, services: [{ id: selectedService.id, serviceId: selectedService.id, name: selectedService.name, duration: selectedService.duration, price: selectedService.price, employee: selectedEmployee }], employee: selectedEmployee, client: body.client || { firstName: body.firstName || 'Nouveau', lastName: body.lastName || 'Client' }, totalPrice: body.price || selectedService.price };
    appointments.unshift(created);
    result = { appointment: created, success: true };
    emitUpdate('appointment-created');
  } else if (path.startsWith('/appointments/')) {
    const id = path.split('/')[2];
    const index = appointments.findIndex((item) => item.id === id);
    if (path.endsWith('/validate-move')) result = { conflicts: [] };
    else if (method === 'DELETE') {
      appointments.splice(index, 1);
      result = { success: true };
      emitUpdate('appointment-deleted');
    } else if (index >= 0) {
      appointments[index] = { ...appointments[index], ...body };
      result = { appointment: appointments[index], success: true };
      emitUpdate('appointment-updated');
    }
  } else if (path === '/services' && method === 'GET') {
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const category = url.searchParams.get('category');
    const matchingServices = services.filter((service) => {
      const matchesSearch =
        !search ||
        `${service.name} ${service.category}`.toLowerCase().includes(search);
      const matchesCategory = !category || service.category === category;
      return matchesSearch && matchesCategory;
    });
    result = {
      services: matchingServices,
      total: matchingServices.length,
      categories: serviceCategories,
    };
  } else if (path === '/services/categories' && method === 'PUT') {
    const next: string[] = Array.isArray(body.categories) ? body.categories.filter(Boolean).map(String) : serviceCategories;
    serviceCategories = [...new Set(next)];
    result = { categories: serviceCategories, success: true };
    emitUpdate('service-updated');
  } else if (path === '/employees') {
    result = { employees, total: employees.length };
  } else if (path === '/employees' && method === 'POST') {
    const newEmployee = { id: `employee-${Date.now()}`, ...body, isActive: true };
    employees = [newEmployee, ...employees];
    result = { employee: newEmployee, employees, total: employees.length };
    emitUpdate('employee-created');
  } else if (path.startsWith('/employees/') && method === 'PUT') {
    const employeeId = path.split('/')[2];
    const index = employees.findIndex((item) => item.id === employeeId);
    if (index >= 0) {
      employees[index] = { ...employees[index], ...body };
      result = { employee: employees[index], success: true };
      emitUpdate('employee-updated');
    } else { result = { employee: null, success: false }; }
  } else if (path.startsWith('/employees/') && method === 'DELETE') {
    const employeeId = path.split('/')[2];
    employees = employees.filter((item) => item.id !== employeeId);
    result = { success: true };
    emitUpdate('employee-deleted');
  } else if (path.startsWith('/employees/') && method === 'GET') {
    const employeeId = path.split('/')[2];
    const found = employees.find((item) => item.id === employeeId);
    result = found ? { employee: found } : { employee: null };
  } else if (path === '/clients' && method === 'GET') {
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const status = url.searchParams.get('status');
    const matchingClients = demoClients.filter((client) => {
      const matchesSearch = !search || `${client.firstName} ${client.lastName} ${client.email || ''} ${client.phone}`.toLowerCase().includes(search);
      return matchesSearch && (!status || client.status === status);
    }).map((client) => ({ ...client, _count: { appointments: appointmentsForClient(client.id).length } }));
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || matchingClients.length || 1);
    result = { clients: matchingClients.slice((page - 1) * limit, page * limit), total: matchingClients.length, page, limit };
  } else if (path === '/clients' && method === 'POST') {
    const client = {
      ...body,
      id: `demo-client-${Date.now()}`,
      email: body.email || null,
      status: body.status || 'ACTIVE',
      avatar: body.avatar || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      addedAs: body.addedAs || null,
      addedByClient: null,
      _count: { appointments: 0 },
    };
    demoClients = [client, ...demoClients];
    result = { client };
    emitUpdate('client-created');
  } else if (path.startsWith('/clients/') && method === 'PUT') {
    const index = demoClients.findIndex((client) => client.id === path.split('/')[2]);
    if (index >= 0) {
      demoClients[index] = { ...demoClients[index], ...body, updatedAt: new Date().toISOString() };
      result = { client: demoClients[index] };
      emitUpdate('client-updated');
    }
  } else if (path.startsWith('/clients/') && method === 'DELETE') {
    demoClients = demoClients.filter((client) => client.id !== path.split('/')[2]);
    result = { success: true };
    emitUpdate('client-deleted');
  } else if (path === '/reviews') {
    const status = url.searchParams.get('status')?.toUpperCase();
    const filteredReviews = status ? reviews.filter((review) => review.status === status) : reviews;
    result = { reviews: filteredReviews, total: filteredReviews.length, page: Number(url.searchParams.get('page') || 1), limit: Number(url.searchParams.get('limit') || filteredReviews.length) };
  } else if (path.startsWith('/reviews/') && path.endsWith('/status') && method === 'PUT') {
    const review = reviews.find((item) => item.id === path.split('/')[2]);
    if (review) {
      review.status = body.status;
      review.rejectReason = body.status === 'REJECTED' ? body.rejectReason || null : null;
      review.moderatedAt = body.status === 'PENDING' ? null : new Date().toISOString();
      result = { review };
      emitUpdate('review-moderated');
    }
  } else if (path.startsWith('/reviews/') && method === 'DELETE') {
    reviews = reviews.filter((review) => review.id !== path.split('/')[2]);
    result = { success: true };
    emitUpdate('review-deleted');
  } else if (path === '/dashboard/clients/mes-avis/avis-moderes') {
    const approvedReviews = reviews.filter((review) => review.status === 'APPROVED');
    result = { reviews: approvedReviews, total: approvedReviews.length };
  } else if (path === '/dashboard/clients/mes-avis/avis-refuses') {
    const rejectedReviews = reviews.filter((review) => review.status === 'REJECTED');
    result = { reviews: rejectedReviews, total: rejectedReviews.length };
  } else if (path === '/dashboard/clients/statistiques/avis') {
    const pendingReviews = reviews.filter((review) => review.status === 'PENDING').length;
    const approvedReviews = reviews.filter((review) => review.status === 'APPROVED').length;
    const rejectedReviews = reviews.filter((review) => review.status === 'REJECTED').length;
    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({ rating, count: reviews.filter((review) => review.rating === rating).length }));
    const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
    result = {
      stats: {
        totalReviews: reviews.length,
        pendingReviews,
        approvedReviews,
        rejectedReviews,
        averageRating,
        ratingDistribution,
        trendsLastMonth: {
          total: reviews.filter((review) => new Date(review.createdAt) >= startOfPeriod('month')!).length,
          approved: approvedReviews,
          rejected: rejectedReviews,
          averageRating,
        },
      },
    };
  } else if (path === '/stats/clients/top') {
    const periodStart = startOfPeriod(url.searchParams.get('period'));
    const topClients = demoClients.map((client) => {
      const clientAppointments = appointmentsForClient(client.id).filter((appointment) => !periodStart || new Date(appointment.startTime) >= periodStart);
      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        visits: clientAppointments.length,
        revenue: clientAppointments.reduce((sum, appointment) => sum + Number(appointment.totalPrice || 0), 0),
        lastVisit: clientAppointments.map((appointment) => appointment.startTime).sort().at(-1) || null,
      };
    }).filter((client) => client.visits > 0).sort((a, b) => b.revenue - a.revenue || b.visits - a.visits);
    result = { clients: topClients.slice(0, Number(url.searchParams.get('limit') || 100)), total: topClients.length };
  } else if (path === '/stats/clients/new') {
    const periodStart = startOfPeriod(url.searchParams.get('period'));
    const newClients = demoClients.filter((client) => !periodStart || new Date(client.createdAt) >= periodStart).map((client) => ({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      createdAt: client.createdAt,
      appointmentCount: appointmentsForClient(client.id).length,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    result = { clients: newClients, total: newClients.length };
  } else if (path === '/stats/clients/frequency') {
    const clientVisits = demoClients.map((client) => ({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      visits: appointmentsForClient(client.id).length,
    }));
    const bucketDefinitions = [
      { type: 'Sans visite', desc: 'Aucun rendez-vous', color: '#d77c65', matches: (visits: number) => visits === 0 },
      { type: '1-2 visites', desc: 'Clients occasionnels', color: '#bd9a52', matches: (visits: number) => visits >= 1 && visits <= 2 },
      { type: '3-5 visites', desc: 'Clients réguliers', color: '#537f78', matches: (visits: number) => visits >= 3 && visits <= 5 },
      { type: '6+ visites', desc: 'Clients fidèles', color: '#7c7892', matches: (visits: number) => visits >= 6 },
    ];
    const frequencyBuckets = bucketDefinitions.map(({ matches, ...bucket }) => {
      const matchingClients = clientVisits.filter((client) => matches(client.visits));
      return { ...bucket, count: matchingClients.length, clients: matchingClients };
    });
    const totalVisits = clientVisits.reduce((sum, client) => sum + client.visits, 0);
    const clientsWithVisits = clientVisits.filter((client) => client.visits > 0).length;
    result = {
      frequencyBuckets,
      stats: {
        clientsWithVisits,
        clientsWithoutVisits: clientVisits.length - clientsWithVisits,
        totalClients: clientVisits.length,
        avgVisits: clientVisits.length ? Number((totalVisits / clientVisits.length).toFixed(1)) : 0,
        totalVisits,
      },
    };
  } else if (path === '/stats/collaborateurs') {
    const entries = getEmployeeServiceEntries(url);
    const collaborators = employees.map((employee) => {
      const employeeEntries = entries.filter(({ service }) => service.employee?.id === employee.id);
      const inSalon = employeeEntries.filter(({ appointment }) => appointment.source === 'SALON').length;
      const online = employeeEntries.filter(({ appointment }) => appointment.source === 'ONLINE').length;
      const totalServices = employeeEntries.length;
      return {
        id: employee.id,
        name: employee.name,
        color: employee.color,
        totalServices,
        inSalon,
        online,
        onlineRate: totalServices ? Number(((online / totalServices) * 100).toFixed(1)) : 0,
        revenue: employeeEntries.reduce((sum, { service }) => sum + Number(service.price || 0), 0),
      };
    });
    const totalServices = collaborators.reduce((sum, employee) => sum + employee.totalServices, 0);
    const inSalon = collaborators.reduce((sum, employee) => sum + employee.inSalon, 0);
    const online = collaborators.reduce((sum, employee) => sum + employee.online, 0);
    result = {
      collaborators,
      totals: {
        totalServices,
        inSalon,
        online,
        revenue: collaborators.reduce((sum, employee) => sum + employee.revenue, 0),
        onlineRate: totalServices ? Number(((online / totalServices) * 100).toFixed(1)) : 0,
      },
    };
  } else if (path === '/stats/occupation/collaborateurs') {
    const entries = getEmployeeServiceEntries(url);
    const capacityHours = getWorkingDays(url.searchParams.get('startDate'), url.searchParams.get('endDate')) * 8;
    const collaborators = employees.map((employee) => {
      const employeeEntries = entries.filter(({ service }) => service.employee?.id === employee.id);
      const workedMinutes = employeeEntries.reduce((sum, { service }) => sum + Number(service.duration || 0), 0);
      const workedHours = Number((workedMinutes / 60).toFixed(1));
      const appointmentCount = new Set(employeeEntries.map(({ appointment }) => appointment.id)).size;
      return {
        id: employee.id,
        name: employee.name,
        color: employee.color,
        appointmentCount,
        workedHours,
        occupationRate: Number(((workedHours / capacityHours) * 100).toFixed(1)),
        revenue: employeeEntries.reduce((sum, { service }) => sum + Number(service.price || 0), 0),
      };
    });
    const totalWorkedHours = collaborators.reduce((sum, employee) => sum + employee.workedHours, 0);
    const totalCapacity = capacityHours * employees.length;
    result = {
      collaborators,
      totals: {
        occupationRate: totalCapacity ? Number(((totalWorkedHours / totalCapacity) * 100).toFixed(1)) : 0,
        workedHours: Number(totalWorkedHours.toFixed(1)),
        revenue: collaborators.reduce((sum, employee) => sum + employee.revenue, 0),
        appointmentCount: collaborators.reduce((sum, employee) => sum + employee.appointmentCount, 0),
      },
    };
  } else if (path === '/stats/autres') {
    const reportAppointments = appointmentsForStats(url);
    const countedAppointments = reportAppointments.filter((appointment) => !['CANCELLED', 'NO_SHOW'].includes(appointment.status));
    const entries = serviceEntriesForAppointments(countedAppointments);
    const colors = ['#537f78', '#d77c65', '#bd9a52', '#7c7892', '#7a9e9f', '#a36f5d'];
    const toDonut = (rows: Array<{ name: string; count: number }>) => {
      const total = rows.reduce((sum, row) => sum + row.count, 0);
      return rows.map((row, index) => ({
        name: row.name,
        value: total ? Number(((row.count / total) * 100).toFixed(1)) : 0,
        color: colors[index % colors.length],
      }));
    };
    const countByEmployee = (source?: string) => employees.map((employee) => ({
      name: employee.name,
      count: entries.filter(({ service, appointment }) => service.employee?.id === employee.id && (!source || appointment.source === source)).length,
    }));
    const countByService = (source?: string) => services.map((service) => ({
      name: service.name,
      count: entries.filter(({ service: entryService, appointment }) => entryService.serviceId === service.id && (!source || appointment.source === source)).length,
    }));
    const onlineCount = countedAppointments.filter((appointment) => appointment.source === 'ONLINE').length;
    const salonCount = countedAppointments.filter((appointment) => appointment.source === 'SALON').length;
    const performanceData = employees.map((employee) => {
      const employeeEntries = entries.filter(({ service }) => service.employee?.id === employee.id);
      const appointmentsForEmployee = new Set(employeeEntries.map(({ appointment }) => appointment.id));
      const online = employeeEntries.filter(({ appointment }) => appointment.source === 'ONLINE').length;
      return {
        name: employee.name,
        initials: employee.name.split(' ').map((part: string) => part[0]).join('').slice(0, 2),
        avatar: employee.avatar || null,
        prestations: employeeEntries.length,
        rdv: appointmentsForEmployee.size,
        taux: employeeEntries.length ? Math.round((online / employeeEntries.length) * 100) : 0,
      };
    });
    result = {
      totalRDV: countedAppointments.length,
      activeCollaborateurs: performanceData.filter((employee) => employee.rdv > 0).length,
      totalServices: entries.length,
      avgDuration: entries.length ? Math.round(entries.reduce((sum, entry) => sum + Number(entry.service.duration || 0), 0) / entries.length) : 0,
      rdvPrisData: toDonut([{ name: 'Pris en salon', count: salonCount }, { name: 'Pris en ligne', count: onlineCount }]),
      prestationsSalonData: toDonut(countByEmployee('SALON')),
      prestationsLigneData: toDonut(countByEmployee('ONLINE')),
      totalPrestationsData: toDonut(countByService()),
      rdvSalonParPrestationData: toDonut(countByService('SALON')),
      rdvLigneParPrestationData: toDonut(countByService('ONLINE')),
      totalRdvParPrestationData: toDonut(countByService()),
      performanceData,
    };
  } else if (path === '/stats/prestations') {
    const reportAppointments = appointmentsForStats(url).filter((appointment) => !['CANCELLED', 'NO_SHOW'].includes(appointment.status));
    const entries = serviceEntriesForAppointments(reportAppointments);
    const prestationsData = [...new Set(services.map((service) => service.category))].map((category) => ({
      category,
      items: services.filter((service) => service.category === category).map((service) => {
        const serviceEntries = entries.filter(({ service: entryService }) => entryService.serviceId === service.id);
        const salonCount = serviceEntries.filter(({ appointment }) => appointment.source === 'SALON').length;
        const onlineCount = serviceEntries.filter(({ appointment }) => appointment.source === 'ONLINE').length;
        const total = serviceEntries.length;
        return {
          name: service.name,
          total,
          salon: salonCount,
          ligne: onlineCount,
          taux: total ? Number(((onlineCount / total) * 100).toFixed(1)) : 0,
          revenue: serviceEntries.reduce((sum, entry) => sum + Number(entry.service.price || 0), 0),
        };
      }),
    }));
    const totalPrestations = entries.length;
    const prisEnSalon = entries.filter(({ appointment }) => appointment.source === 'SALON').length;
    const prisEnLigne = entries.filter(({ appointment }) => appointment.source === 'ONLINE').length;
    result = {
      totalPrestations,
      prisEnSalon,
      prisEnLigne,
      tauxEnLigne: totalPrestations ? Number(((prisEnLigne / totalPrestations) * 100).toFixed(1)) : 0,
      prestationsData,
    };
  } else if (path === '/stats/rdv') {
    const reportAppointments = appointmentsForStats(url);
    const countedAppointments = reportAppointments.filter((appointment) => !['CANCELLED', 'NO_SHOW'].includes(appointment.status));
    const entries = serviceEntriesForAppointments(countedAppointments);
    const dayMap = new Map<string, any>();
    for (const appointment of reportAppointments) {
      const dayKey = String(appointment.date).slice(0, 10);
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, { date: new Date(`${dayKey}T12:00:00`).toLocaleDateString('fr-FR'), totalPrestations: 0, inSalon: 0, online: 0, annules: 0, absents: 0 });
      const day = dayMap.get(dayKey);
      if (appointment.status === 'CANCELLED') day.annules++;
      else if (appointment.status === 'NO_SHOW') day.absents++;
    }
    for (const { appointment } of entries) {
      const day = dayMap.get(String(appointment.date).slice(0, 10));
      if (!day) continue;
      day.totalPrestations++;
      if (appointment.source === 'ONLINE') day.online++;
      else day.inSalon++;
    }
    const dailyData = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date, 'fr'));
    for (const day of dailyData) {
      day.onlineRate = day.totalPrestations ? `${Math.round((day.online / day.totalPrestations) * 100)}%` : '0%';
      day.tauxAnnulation = day.totalPrestations ? `${Math.round((day.annules / day.totalPrestations) * 100)}%` : '0%';
      day.tauxAbsence = day.totalPrestations ? `${Math.round((day.absents / day.totalPrestations) * 100)}%` : '0%';
    }
    const inSalon = entries.filter(({ appointment }) => appointment.source === 'SALON').length;
    const online = entries.filter(({ appointment }) => appointment.source === 'ONLINE').length;
    const annules = reportAppointments.filter((appointment) => appointment.status === 'CANCELLED').length;
    const absents = reportAppointments.filter((appointment) => appointment.status === 'NO_SHOW').length;
    const totalPrestations = entries.length;
    const denominator = Math.max(reportAppointments.length, 1);
    const onlineRateValue = totalPrestations ? Math.round((online / totalPrestations) * 100) : 0;
    const absenceRateValue = Math.round((absents / denominator) * 100);
    const cancellationRateValue = Math.round((annules / denominator) * 100);

    // Real period-over-period deltas (null when no previous-period data exists)
    const rdvTotalsFor = (rangeAppointments: any[]) => {
      const rangeCounted = rangeAppointments.filter((appointment) => !['CANCELLED', 'NO_SHOW'].includes(appointment.status));
      const rangeEntries = serviceEntriesForAppointments(rangeCounted);
      const rangeOnline = rangeEntries.filter(({ appointment }) => appointment.source === 'ONLINE').length;
      const rangeCancelled = rangeAppointments.filter((appointment) => appointment.status === 'CANCELLED').length;
      const rangeNoShows = rangeAppointments.filter((appointment) => appointment.status === 'NO_SHOW').length;
      const rangeDenominator = Math.max(rangeAppointments.length, 1);
      return {
        totalAppointments: rangeAppointments.length,
        totalPrestations: rangeEntries.length,
        inSalon: rangeEntries.length - rangeOnline,
        online: rangeOnline,
        totalOnlineRate: rangeEntries.length ? Math.round((rangeOnline / rangeEntries.length) * 100) : 0,
        absents: rangeNoShows,
        totalTauxAbsence: Math.round((rangeNoShows / rangeDenominator) * 100),
        annules: rangeCancelled,
        totalTauxAnnulation: Math.round((rangeCancelled / rangeDenominator) * 100),
      };
    };
    const statsWindow = getStatsWindow(url);
    const previousWindow = getPreviousStatsWindow(statsWindow.start, statsWindow.end, url.searchParams.get('period'));
    const previousTotals = previousWindow
      ? rdvTotalsFor(
          appointments.filter((appointment) => {
            const time = new Date(appointment.startTime).getTime();
            return time >= previousWindow.start.getTime() && time <= previousWindow.end.getTime();
          })
        )
      : null;
    const hasPrevious = previousTotals !== null && previousTotals.totalAppointments > 0;
    const pctChange = (currentValue: number, previousValue: number | undefined) =>
      hasPrevious && previousValue ? Math.round(((currentValue - previousValue) / previousValue) * 100) : null;
    const pointChange = (currentValue: number, previousValue: number | undefined) =>
      hasPrevious && previousValue !== undefined ? currentValue - previousValue : null;

    result = {
      dailyData,
      totals: {
        totalPrestations,
        inSalon,
        online,
        totalOnlineRate: `${onlineRateValue}%`,
        absents,
        totalTauxAbsence: `${absenceRateValue}%`,
        annules,
        totalTauxAnnulation: `${cancellationRateValue}%`,
      },
      deltas: {
        totalPrestations: pctChange(totalPrestations, previousTotals?.totalPrestations),
        inSalon: pctChange(inSalon, previousTotals?.inSalon),
        online: pctChange(online, previousTotals?.online),
        totalOnlineRate: pointChange(onlineRateValue, previousTotals?.totalOnlineRate),
        absents: pctChange(absents, previousTotals?.absents),
        totalTauxAbsence: pointChange(absenceRateValue, previousTotals?.totalTauxAbsence),
        annules: pctChange(annules, previousTotals?.annules),
        totalTauxAnnulation: pointChange(cancellationRateValue, previousTotals?.totalTauxAnnulation),
      },
    };
  } else if (path === '/stats/occupation/vue-ensemble') {
    const month = Number(url.searchParams.get('month') ?? new Date().getMonth());
    const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());
    const employeeId = url.searchParams.get('employeeId');
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const monthAppointments = appointments.filter((appointment) => {
      const time = new Date(appointment.startTime).getTime();
      return time >= start.getTime() && time <= end.getTime() && !['CANCELLED', 'NO_SHOW'].includes(appointment.status);
    });
    const dayKeys = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
    const timeSlots = Array.from({ length: 10 }, (_, index) => `${String(index + 9).padStart(2, '0')}:00 - ${String(index + 10).padStart(2, '0')}:00`);
    const occupancyData: Record<string, Record<string, number>> = {};
    const dayOccurrences: Record<string, number> = {};
    for (const day of dayKeys) {
      occupancyData[day] = Object.fromEntries(timeSlots.map((slot) => [slot, 0]));
      dayOccurrences[day] = 0;
    }
    for (const date = new Date(year, month, 1); date.getMonth() === month; date.setDate(date.getDate() + 1)) {
      dayOccurrences[dayKeys[date.getDay()]]++;
    }
    const bookedMinutes: Record<string, Record<string, number>> = Object.fromEntries(dayKeys.map((day) => [day, Object.fromEntries(timeSlots.map((slot) => [slot, 0]))]));
    for (const appointment of monthAppointments) {
      const dayIndex = new Date(`${appointment.date}T12:00:00Z`).getUTCDay();
      const dayKey = dayKeys[dayIndex];
      const startDate = new Date(appointment.startTime);
      let serviceStart = startDate.getUTCHours() * 60 + startDate.getUTCMinutes() + 60;
      for (const service of appointment.services || []) {
        if (!employeeId || service.employee?.id === employeeId) {
          const serviceEnd = serviceStart + Number(service.duration || 0);
          for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex++) {
            const slotStart = (slotIndex + 9) * 60;
            const overlap = Math.max(0, Math.min(serviceEnd, slotStart + 60) - Math.max(serviceStart, slotStart));
            bookedMinutes[dayKey][timeSlots[slotIndex]] += overlap;
          }
        }
        serviceStart += Number(service.duration || 0);
      }
    }
    const activeEmployeeCount = employeeId ? 1 : employees.length;
    for (const day of dayKeys) {
      for (const time of timeSlots) {
        const capacity = Math.max(dayOccurrences[day], 1) * 60 * activeEmployeeCount;
        occupancyData[day][time] = Math.min(100, Math.round((bookedMinutes[day][time] / capacity) * 100));
      }
    }
    const values = dayKeys.flatMap((day) => timeSlots.map((time) => ({ day, time, value: occupancyData[day][time] })));
    const peak = values.reduce((best, current) => current.value > best.value ? current : best, values[0]);
    result = {
      occupancyData,
      stats: {
        average: Math.round(values.reduce((sum, item) => sum + item.value, 0) / Math.max(values.length, 1)),
        peak: peak?.value || 0,
        peakDay: peak?.day || '',
        peakTime: peak?.time || '',
      },
    };
  } else if (path === '/stats/occupation/prestations') {
    const month = Number(url.searchParams.get('month') ?? new Date().getMonth());
    const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());
    const employeeId = url.searchParams.get('employeeId');
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const monthAppointments = appointments.filter((appointment) => {
      const time = new Date(appointment.startTime).getTime();
      return time >= start.getTime() && time <= end.getTime() && !['CANCELLED', 'NO_SHOW'].includes(appointment.status);
    });
    const entries = serviceEntriesForAppointments(monthAppointments).filter(({ service }) => !employeeId || service.employee?.id === employeeId);
    const capacityHours = getWorkingDays(start.toISOString(), end.toISOString()) * 8 * (employeeId ? 1 : employees.length);
    const servicesData = [...new Set(services.map((service) => service.category))].map((category) => ({
      category,
      services: services.filter((service) => service.category === category).map((service) => {
        const serviceEntries = entries.filter(({ service: entryService }) => entryService.serviceId === service.id);
        const workedMinutes = serviceEntries.reduce((sum, entry) => sum + Number(entry.service.duration || 0), 0);
        const revenue = serviceEntries.reduce((sum, entry) => sum + Number(entry.service.price || 0), 0);
        return {
          name: service.name,
          occupancyRate: capacityHours ? Number(((workedMinutes / 60 / capacityHours) * 100).toFixed(2)) : 0,
          hoursWorked: `${(workedMinutes / 60).toFixed(1)} h`,
          totalRevenue: revenue,
        };
      }),
    }));
    const workedMinutes = entries.reduce((sum, entry) => sum + Number(entry.service.duration || 0), 0);
    const totalRevenue = entries.reduce((sum, entry) => sum + Number(entry.service.price || 0), 0);
    result = {
      servicesData,
      stats: {
        totalRevenue,
        totalHours: Number((workedMinutes / 60).toFixed(1)),
        avgOccupancy: capacityHours ? Number(((workedMinutes / 60 / capacityHours) * 100).toFixed(2)) : 0,
      },
    };
  } else if (path === '/stats/dashboard') {
    const { start, end } = getStatsWindow(url);
    const periodParam = url.searchParams.get('period');

    const computeDashboard = (winStart: Date | null, winEnd: Date | null) => {
      const inTime = (time: string | number) => {
        const value = new Date(time).getTime();
        return (!winStart || value >= winStart.getTime()) && (!winEnd || value <= winEnd.getTime());
      };
      const rangeAppointments = appointments.filter((appointment) => inTime(appointment.startTime));
      const counted = rangeAppointments.filter((appointment) => !['CANCELLED', 'NO_SHOW'].includes(appointment.status));
      const entries = serviceEntriesForAppointments(counted);

      const totalAppointments = rangeAppointments.length;
      const onlineAppointments = rangeAppointments.filter((appointment) => appointment.source === 'ONLINE').length;
      const onlineRate = totalAppointments ? Math.round((onlineAppointments / totalAppointments) * 100) : 0;
      const cancelled = rangeAppointments.filter((appointment) => appointment.status === 'CANCELLED').length;
      const noShows = rangeAppointments.filter((appointment) => appointment.status === 'NO_SHOW').length;
      const expected = rangeAppointments.filter((appointment) => appointment.status !== 'CANCELLED').length;
      const attendanceRate = expected ? Number((((expected - noShows) / expected) * 100).toFixed(1)) : 0;
      const cancellationRate = totalAppointments ? Number(((cancelled / totalAppointments) * 100).toFixed(1)) : 0;

      const totalRevenue = counted.reduce((sum, appointment) => sum + Number(appointment.totalPrice || 0), 0);
      const avgBasket = counted.length ? Math.round(totalRevenue / counted.length) : 0;
      const avgDuration = counted.length
        ? Math.round(counted.reduce((sum, appointment) => sum + Number(appointment.totalDuration || 0), 0) / counted.length)
        : 0;

      // New clients: clients whose first-ever appointment falls inside the window
      const firstAppointmentByClient = new Map<string, any>();
      for (const appointment of appointments) {
        const existing = firstAppointmentByClient.get(appointment.clientId);
        if (!existing || new Date(appointment.startTime) < new Date(existing.startTime)) {
          firstAppointmentByClient.set(appointment.clientId, appointment);
        }
      }
      const newClients = [...firstAppointmentByClient.values()].filter((appointment) => inTime(appointment.startTime));
      const newOnlineClients = newClients.filter((appointment) => appointment.source === 'ONLINE').length;
      const newSalonClients = newClients.length - newOnlineClients;

      // Loyalty: clients with 3+ visits inside the window
      const visitsByClient = new Map<string, number>();
      for (const appointment of counted) {
        visitsByClient.set(appointment.clientId, (visitsByClient.get(appointment.clientId) || 0) + 1);
      }
      const loyalClientsCount = [...visitsByClient.values()].filter((visits) => visits >= 3).length;
      const loyaltyRate = visitsByClient.size ? Math.round((loyalClientsCount / visitsByClient.size) * 100) : 0;

      // Satisfaction: approved reviews inside the window (fallback: all approved reviews)
      const allApprovedReviews = reviews.filter((review) => review.status === 'APPROVED');
      const windowApprovedReviews = allApprovedReviews.filter((review) => inTime(review.createdAt));
      const satisfactionSource = windowApprovedReviews.length ? windowApprovedReviews : allApprovedReviews;
      const avgSatisfaction = satisfactionSource.length
        ? Number((satisfactionSource.reduce((sum, review) => sum + Number(review.rating || 0), 0) / satisfactionSource.length).toFixed(1))
        : 0;

      // Advance booking: booked more than 2 days before the appointment
      const advanceBookings = rangeAppointments.filter((appointment) => {
        if (!appointment.createdAt) return false;
        return new Date(appointment.startTime).getTime() - new Date(appointment.createdAt).getTime() > 2 * 86400000;
      }).length;
      const advanceBookingRate = totalAppointments ? Math.round((advanceBookings / totalAppointments) * 100) : 0;

      // Daily trend: last 7 days with appointments, salon vs online
      const dayTotals = new Map<string, { salon: number; online: number }>();
      for (const appointment of counted) {
        const key = String(appointment.date).slice(0, 10);
        const bucket = dayTotals.get(key) || { salon: 0, online: 0 };
        if (appointment.source === 'ONLINE') bucket.online++;
        else bucket.salon++;
        dayTotals.set(key, bucket);
      }
      const appointmentsTrend = [...dayTotals.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-7)
        .map(([key, bucket]) => ({
          day: `${new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' })} ${Number(key.slice(8))}`,
          ...bucket,
        }));

      // Revenue by month: last 6 months ending at the window end (month picker shifts it)
      const anchor = winEnd ? new Date(winEnd) : new Date();
      const revenueData = Array.from({ length: 6 }, (_, index) => {
        const monthDate = new Date(anchor.getFullYear(), anchor.getMonth() - 5 + index, 1);
        const monthStart = monthDate.getTime();
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        const value = appointments
          .filter((appointment) => !['CANCELLED', 'NO_SHOW'].includes(appointment.status))
          .filter((appointment) => {
            const time = new Date(appointment.startTime).getTime();
            return time >= monthStart && time <= monthEnd;
          })
          .reduce((sum, appointment) => sum + Number(appointment.totalPrice || 0), 0);
        return { name: monthDate.toLocaleDateString('fr-FR', { month: 'short' }), value };
      });
      const avgRevenue = Math.round(revenueData.reduce((sum, month) => sum + month.value, 0) / Math.max(revenueData.length, 1));

      // Peak day (French weekday name) from taken appointments
      const weekdayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const weekdayCounts = new Map<number, number>();
      for (const appointment of counted) {
        const weekday = new Date(`${String(appointment.date).slice(0, 10)}T12:00:00`).getDay();
        weekdayCounts.set(weekday, (weekdayCounts.get(weekday) || 0) + 1);
      }
      const peakEntry = [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      const peakDay = peakEntry ? weekdayNames[peakEntry[0]] : 'N/A';

      // Service distribution from real service entries
      const serviceCounts = new Map<string, number>();
      for (const { service } of entries) {
        serviceCounts.set(service.serviceId, (serviceCounts.get(service.serviceId) || 0) + 1);
      }
      const serviceData = services
        .map((service) => ({ name: service.name, value: serviceCounts.get(service.id) || 0 }))
        .filter((service) => service.value > 0)
        .sort((a, b) => b.value - a.value);

      // Employee performance: appointments, revenue and rating from approved reviews
      const employeeData = employees.map((employee) => {
        const employeeEntries = entries.filter(({ service }) => service.employee?.id === employee.id);
        const employeeAppointments = new Set(employeeEntries.map(({ appointment }) => appointment.id)).size;
        const employeeRevenue = employeeEntries.reduce((sum, { service }) => sum + Number(service.price || 0), 0);
        const windowReviews = windowApprovedReviews.filter((review) => review.employee?.id === employee.id);
        const employeeReviews = windowReviews.length
          ? windowReviews
          : allApprovedReviews.filter((review) => review.employee?.id === employee.id);
        const rating = employeeReviews.length
          ? Number((employeeReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / employeeReviews.length).toFixed(1))
          : 4.5;
        return { name: employee.name, avatar: employee.avatar || null, appointments: employeeAppointments, revenue: employeeRevenue, rating };
      });

      // Popularity per start hour (09:00 - 17:00)
      const timeSlotData = Array.from({ length: 9 }, (_, index) => {
        const hour = index + 9;
        return {
          slot: `${String(hour).padStart(2, '0')}:00`,
          count: counted.filter((appointment) => new Date(appointment.startTime).getUTCHours() === hour).length,
        };
      });

      // Peak hours: real occupancy rate per hour (booked minutes vs capacity)
      const workingDays = getWorkingDays(winStart ? winStart.toISOString() : null, winEnd ? winEnd.toISOString() : null);
      const capacityMinutes = Math.max(workingDays, 1) * 60 * employees.length;
      const peakHours: { time: string; rate: number }[] = [];
      for (let hour = 9; hour <= 17; hour++) {
        let bookedMinutes = 0;
        for (const appointment of counted) {
          const start = new Date(appointment.startTime);
          let cursor = start.getUTCHours() * 60 + start.getUTCMinutes();
          for (const service of appointment.services || []) {
            const serviceEnd = cursor + Number(service.duration || 0);
            bookedMinutes += Math.max(0, Math.min(serviceEnd, (hour + 1) * 60) - Math.max(cursor, hour * 60));
            cursor = serviceEnd;
          }
        }
        const rate = Math.min(100, Math.round((bookedMinutes / capacityMinutes) * 100));
        if (rate > 0) {
          peakHours.push({ time: `${String(hour).padStart(2, '0')}:00 - ${String(hour + 1).padStart(2, '0')}:00`, rate });
        }
      }
      peakHours.sort((a, b) => b.rate - a.rate);

      const bookingChannels = [
        { channel: 'Site web', count: onlineAppointments, icon: 'globe' },
        { channel: 'En salon', count: totalAppointments - onlineAppointments, icon: 'store' },
      ];

      const ageBands = [
        { label: '18-25', min: 18, max: 25 },
        { label: '26-35', min: 26, max: 35 },
        { label: '36-50', min: 36, max: 50 },
        { label: '51+', min: 51, max: 200 },
      ];
      const ageDistribution = ageBands.map((band) => ({
        age: band.label,
        count: demoClients.filter((client) => Number(client.age) >= band.min && Number(client.age) <= band.max).length,
      }));

      const visitFrequency = [
        { type: 'Sans visite', desc: 'Aucun rendez-vous', color: '#d77c65', matches: (visits: number) => visits === 0 },
        { type: '1-2 visites', desc: 'Clients occasionnels', color: '#bd9a52', matches: (visits: number) => visits >= 1 && visits <= 2 },
        { type: '3-5 visites', desc: 'Clients réguliers', color: '#537f78', matches: (visits: number) => visits >= 3 && visits <= 5 },
        { type: '6+ visites', desc: 'Clients fidèles', color: '#7c7892', matches: (visits: number) => visits >= 6 },
      ].map(({ matches, ...bucket }) => ({
        ...bucket,
        count: demoClients.filter((client) => matches(visitsByClient.get(client.id) || 0)).length,
      }));

      const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      const timePreferences = dayLabels.map((label, index) => {
        const weekday = (index + 1) % 7; // JS: 0=Dim .. 6=Sat
        const dayAppointments = counted.filter(
          (appointment) => new Date(`${String(appointment.date).slice(0, 10)}T12:00:00`).getDay() === weekday
        );
        const morning = dayAppointments.filter((appointment) => new Date(appointment.startTime).getUTCHours() < 12).length;
        const afternoon = dayAppointments.filter((appointment) => {
          const hour = new Date(appointment.startTime).getUTCHours();
          return hour >= 12 && hour < 18;
        }).length;
        const evening = dayAppointments.length - morning - afternoon;
        const base = Math.max(dayAppointments.length, 1);
        return {
          day: label,
          morning: Math.round((morning / base) * 100),
          afternoon: Math.round((afternoon / base) * 100),
          evening: Math.round((evening / base) * 100),
        };
      });

      return {
        scalars: {
          onlineAppointments,
          totalAppointments,
          onlineRate,
          newOnlineClients,
          newSalonClients,
          totalRevenue,
          avgRevenue,
          avgBasket,
          attendanceRate,
          avgDuration,
          avgSatisfaction,
          loyaltyRate,
          loyalClientsCount,
          cancellationRate,
          advanceBookingRate,
        },
        arrays: {
          appointmentsTrend,
          revenueData,
          peakDay,
          serviceData,
          employeeData,
          timeSlotData,
          peakHours,
          bookingChannels,
          ageDistribution,
          visitFrequency,
          timePreferences,
        },
      };
    };

    const current = computeDashboard(start, end);
    const previousWindow = getPreviousStatsWindow(start, end, periodParam);
    const previous = previousWindow ? computeDashboard(previousWindow.start, previousWindow.end) : null;
    const hasPrevious = previous !== null && previous.scalars.totalAppointments > 0;
    const pctChange = (currentValue: number, previousValue: number | undefined) =>
      hasPrevious && previousValue ? Math.round(((currentValue - previousValue) / previousValue) * 100) : null;
    const pointChange = (currentValue: number, previousValue: number | undefined) =>
      hasPrevious && previousValue !== undefined ? Number((currentValue - previousValue).toFixed(1)) : null;

    result = {
      ...current.scalars,
      ...current.arrays,
      deltas: {
        onlineAppointments: pctChange(current.scalars.onlineAppointments, previous?.scalars.onlineAppointments),
        totalAppointments: pctChange(current.scalars.totalAppointments, previous?.scalars.totalAppointments),
        onlineRate: pointChange(current.scalars.onlineRate, previous?.scalars.onlineRate),
        newOnlineClients: pctChange(current.scalars.newOnlineClients, previous?.scalars.newOnlineClients),
        newSalonClients: pctChange(current.scalars.newSalonClients, previous?.scalars.newSalonClients),
        attendanceRate: pointChange(current.scalars.attendanceRate, previous?.scalars.attendanceRate),
        avgDuration: hasPrevious ? current.scalars.avgDuration - (previous?.scalars.avgDuration ?? 0) : null,
        avgSatisfaction: hasPrevious
          ? Number((current.scalars.avgSatisfaction - (previous?.scalars.avgSatisfaction ?? 0)).toFixed(1))
          : null,
        loyaltyRate: pointChange(current.scalars.loyaltyRate, previous?.scalars.loyaltyRate),
        cancellationRate: pointChange(current.scalars.cancellationRate, previous?.scalars.cancellationRate),
        advanceBookingRate: pointChange(current.scalars.advanceBookingRate, previous?.scalars.advanceBookingRate),
        avgBasket: pctChange(current.scalars.avgBasket, previous?.scalars.avgBasket),
        loyalClientsCount: pctChange(current.scalars.loyalClientsCount, previous?.scalars.loyalClientsCount),
        totalRevenue: pctChange(current.scalars.totalRevenue, previous?.scalars.totalRevenue),
      },
    };
  } else if (path === '/invoices') {
    const paid = invoices.filter((item) => item.status === 'PAID').length;
    const unpaid = invoices.filter((item) => item.status === 'UNPAID').length;
    result = { invoices, total: invoices.length, summary: { paid, unpaid } };
  } else if (path === '/cash-transactions') {
    const transactions = [];
    // 1. Initial depot: starting money for change (before first appointment, mid-June 2026)
    transactions.push({
      id: 'depot-initial',
      invoiceId: '',
      amount: 500,
      status: 'DEPOSIT',
      paymentMethod: null,
      paidAt: new Date(2026, 5, 15).toISOString(), // mid-June 2026
      date: 'DEPOT-INITIAL',
      client: { id: 'demo-admin', firstName: 'Amal', lastName: 'El Mansouri', email: 'amal@exemple.com', phone: '+212 5 22 00 00 00' },
      employee: { id: 'employee-salma', firstName: 'Salma', lastName: 'Bennani', name: 'Salma Bennani', role: 'Coiffeuse', color: '#d77c65', avatar: DEMO_EMPLOYEE_PHOTOS.salma },
      notes: 'Dépôt initial pour la caisse (argent pour la monnaie)',
    });
    // 2. Weekly collections: 1 collection per week during the appointment period (July 1 - Oct 31, 2026 = ~18 weeks)
    // These are deposits collected from weekly sales, kept in caisse (null method as requested - internal caisse operation)
    const weekDates = [];
    for (let w = 0; w < 18; w++) {
      const d = new Date(2026, 6, 1 + w * 7); // July 1 + w weeks
      weekDates.push(d);
    }
    // Generate 18 weekly collection/deposit transactions (1 per week, null method as requested)
    for (let i = 0; i < 18; i++) {
      const weekDate = weekDates[i];
      transactions.push({
        id: `semaine-collecte-${i + 1}`,
        invoiceId: '',
        amount: 400 + (i * 25), // gradually increasing: 400, 425, 450, etc.
        status: 'DEPOSIT',
        paymentMethod: null, // null method as requested - internal caisse operation, no client payment
        paidAt: new Date(weekDate.getTime() + 2 * 60 * 60 * 1000).toISOString(), // morning collection day
        date: `2026-${String(weekDate.getMonth() + 1).padStart(2, '0')}-${String(weekDate.getDate()).padStart(2, '0')}`,
        client: { id: `demo-client-${(i % 8) + 1}`, firstName: 'Client', lastName: 'Collecte', email: `client${i}@example.com`, phone: `+212 6${String(10000000 + i * 7919).slice(0, 8)}` },
        employee: employees[i % employees.length],
        notes: `Collecte semaine ${i + 1} - ${weekDate.toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' })}`,
      });
    }
    // 3. Ventes: sales from appointments - 10 ventes over the period
    const venteLabels = ['Vente semaine 1', 'Vente semaine 2', 'Vente semaine 3', 'Vente semaine 4', 'Vente semaine 5', 'Vente semaine 6', 'Vente semaine 7', 'Vente semaine 8', 'Vente semaine 9', 'Vente semaine 10'];
    const venteAmounts = [3500, 3200, 3800, 3100, 3600, 2900, 3400, 3000, 3700, 2800];
    for (let i = 0; i < 10; i++) {
      transactions.push({
        id: `vente-${i + 1}`,
        invoiceId: '',
        amount: venteAmounts[i],
        status: 'PAID',
        paymentMethod: ['CASH', 'CARD', 'BANK_TRANSFER'][i % 3],
        paidAt: new Date(2026, 6, 1 + i * 5).toISOString(), // every 5 days in July-August period
        date: `2026-${String(7 + Math.floor((i + 1) / 4) + 1).padStart(2, '0')}-${String((i % 4) + 1).padStart(2, '0')}`,
        client: { id: `demo-client-${i + 1}`, firstName: 'Client', lastName: 'Client', email: `client${i + 1}@example.com`, phone: `+212 6${String(10000000 + (i + 1) * 7919).slice(0, 8)}` },
        employee: employees[i % employees.length],
        notes: venteLabels[i],
      });
    }
    const totalDeposits = transactions.filter((t) => t.status === 'DEPOSIT' || t.status === 'PAID').reduce((sum, t) => sum + t.amount, 0);
    const totalWithdrawals = transactions.filter((t) => t.status === 'RETRAIT').reduce((sum, t) => sum + t.amount, 0);
    result = { transactions, total: transactions.length, summary: { deposits: totalDeposits, withdrawals: totalWithdrawals } };
} else if (path === '/tenant') {
    result = { tenant: { id: salon.id, name: salon.name, email: salon.email, phone: salon.phone, address: salon.address, city: salon.category, shortDescription: salon.shortDescription, coverImage: salon.coverImage, subscriptionActive: salon.subscriptionActive } };
  } else if (path === '/param-agenda/gestion-de-prestations') {
    // Services and categories that the salon provides
    const categories = [...new Set(services.map((s) => s.category))];
    const categoriesData = categories.map((cat) => ({
      category: cat,
      services: services.filter((s) => s.category === cat).map((s) => ({
        id: s.id,
        name: s.name,
        duration: s.duration,
        price: s.price,
        color: s.color,
      })),
    }));
    const allServices = services.map((s) => ({
      id: s.id,
      name: s.name,
      duration: s.duration,
      price: s.price,
      category: s.category,
      color: s.color,
    }));
    result = {
      categories: categoriesData,
      allServices: allServices,
      totalCategories: categories.length,
      totalServices: services.length,
    };
  } else if (path === '/tenant/settings') {
    result = { settings: { amenities: [], badges: [], socialMedia: { instagram: '', facebook: '', x: '', tiktok: '', whatsapp: '' }, showMap: true, showOpeningHours: true, showOnlineReservation: true, showReviews: true, onlineReservationEnabled: false } };
  } else if (path === '/subscription') {
    const currentPeriodEnd = DEMO_SUBSCRIPTION_END;
    const subscriptionStatus = 'ACTIVE';
    const subscribedAt = new Date(2026, 7, 1).toISOString(); // 01/08/2026 (3 months before)
    const salonsPaid = 1;
    const billConfig = {
      pricePerSalon: 500,
      freeEmployeeThreshold: 3,
      pricePerEmployee: 200,
      employeeTiers: [
        { min: 1, max: 3, price: 0 },
        { min: 4, max: 10, price: 50 },
        { min: 11, max: null, price: 100 }
      ]
    };
    const salons: any[] = [{
      id: salon.id,
      name: salon.name,
      subscriptionActive: true,
      salonCovered: true,
      employeeCount: employees.length,
      employeesPaid: 2,
      billableEmployees: employees.length,
      salonFee: 500,
      employeeFee: 200,
      total: 700
    }];
    const payments: any[] = [];
    const totalRevenue = salons.reduce((sum, s) => sum + s.total, 0);
    result = {
      account: { id: 'demo-account' },
      subscription: {
        status: subscriptionStatus,
        subscribedAt,
        currentPeriodEnd,
        salonsPaid
      },
      bill: {
        config: billConfig,
        salonCount: 1,
        salonsPaid: 1,
        salonsDue: 0,
        salonFee: 500,
        employeeCount: employees.length,
        employeesDue: 0,
        employeeFee: 200,
        total: totalRevenue,
        periodActive: true,
        status: subscriptionStatus,
        subscribedAt,
        currentPeriodEnd
      },
      salons,
      payments
    };
  } else if (path.includes('/settings/')) {
    result = { enabled: true, methods: ['Espèces', 'Carte bancaire', 'Virement'], fields: [], schedules: [] };
  } else if (path.startsWith('/invoices/') && method !== 'GET') {
    invoices = invoices.map((invoice) => invoice.id === path.split('/')[2] ? { ...invoice, ...body } : invoice);
    result = { success: true };
    emitUpdate('invoice-updated');
  } else if (path === '/services' && method === 'POST') {
    const newService = { id: `service-${Date.now()}`, ...body, isActive: true };
    services = [newService, ...services];
    if (newService.category && !serviceCategories.includes(newService.category)) {
      serviceCategories = [...serviceCategories, newService.category];
    }
    result = { service: newService, services, total: services.length };
    emitUpdate('service-created');
  } else if (path.startsWith('/services/') && method === 'PUT') {
    const serviceId = path.split('/')[2];
    const index = services.findIndex((item) => item.id === serviceId);
    if (index >= 0) {
      services[index] = { ...services[index], ...body };
      if (services[index].category && !serviceCategories.includes(services[index].category)) {
        serviceCategories = [...serviceCategories, services[index].category];
      }
      result = { service: services[index], success: true };
      emitUpdate('service-updated');
    } else { result = { service: null, success: false }; }
  } else if (path.startsWith('/services/') && method === 'DELETE') {
    const serviceId = path.split('/')[2];
    services = services.filter((item) => item.id !== serviceId);
    result = { success: true };
    emitUpdate('service-deleted');
  } else if (path.startsWith('/services/') && method === 'GET') {
    const serviceId = path.split('/')[2];
    const found = services.find((item) => item.id === serviceId);
    result = found ? { service: found } : { service: null };
  } else {
    // Unknown endpoint - return default empty result
    result = {};
  }

  return result as T;
}