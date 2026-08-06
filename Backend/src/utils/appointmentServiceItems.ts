type CatalogServiceLike = {
  id: string;
  name: string;
  duration: number;
  price?: number | null;
  priceFrom?: number | null;
  color?: string | null;
  onQuote?: boolean | null;
};

type AppointmentServiceItemLike = {
  id?: string;
  serviceId?: string | null;
  serviceName: string;
  duration: number;
  price: number;
  sortOrder?: number | null;
  employee?: { id: string; firstName: string; lastName: string } | null;
  service?: CatalogServiceLike | null;
};

type AppointmentLike = {
  serviceId?: string | null;
  service?: CatalogServiceLike | null;
  services?: AppointmentServiceItemLike[] | null;
  notes?: string | null;
};

export type ReservationServiceLine = {
  id?: string;
  serviceId: string | null;
  name: string;
  serviceName: string;
  duration: number;
  price: number;
  sortOrder: number;
  employee?: { id: string; firstName: string; lastName: string } | null;
};

const GENERATED_SERVICES_RE =
  /(?:\n{0,2})Services r(?:é|Ã©)serv(?:é|Ã©)s:\s*([^\n\r]*)/i;

const GENERATED_SERVICE_ITEM_RE =
  /([^,()]+?)\s*\((\d+)\s*min\s*-\s*([0-9]+(?:[.,][0-9]+)?)\s*MAD\)/gi;

export function getServicePrice(service: CatalogServiceLike): number {
  if (service.onQuote) return 0;
  if (service.price != null) return service.price;
  if (service.priceFrom != null) return service.priceFrom;
  return 0;
}

export function stripGeneratedServicesNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const cleaned = notes
    .replace(GENERATED_SERVICES_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || null;
}

function parseGeneratedServiceLines(notes?: string | null): ReservationServiceLine[] {
  const match = notes?.match(GENERATED_SERVICES_RE);
  if (!match?.[1]) return [];

  const lines: ReservationServiceLine[] = [];
  for (const item of match[1].matchAll(GENERATED_SERVICE_ITEM_RE)) {
    lines.push({
      serviceId: null,
      name: item[1].trim(),
      serviceName: item[1].trim(),
      duration: Number(item[2]) || 0,
      price: Number(item[3].replace(',', '.')) || 0,
      sortOrder: lines.length,
    });
  }
  return lines;
}

export function normalizeAppointmentServices(appointment: AppointmentLike): ReservationServiceLine[] {
  const persisted = (appointment.services || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((item, index) => ({
      id: item.id,
      serviceId: item.serviceId ?? item.service?.id ?? null,
      name: item.serviceName || item.service?.name || 'Service',
      serviceName: item.serviceName || item.service?.name || 'Service',
      duration: item.duration ?? item.service?.duration ?? 0,
      price: item.price ?? (item.service ? getServicePrice(item.service) : 0),
      sortOrder: item.sortOrder ?? index,
      employee: item.employee ?? null,
    }));

  if (persisted.length > 1) return persisted;

  const parsed = parseGeneratedServiceLines(appointment.notes);
  if (parsed.length > persisted.length) {
    return parsed.map((line, index) => {
      const service =
        appointment.service &&
        appointment.service.name.toLowerCase() === line.name.toLowerCase()
          ? appointment.service
          : null;
      return {
        ...line,
        serviceId: service?.id ?? null,
        sortOrder: index,
      };
    });
  }

  if (persisted.length === 1) return persisted;

  if (appointment.service) {
    return [
      {
        serviceId: appointment.serviceId ?? appointment.service.id,
        name: appointment.service.name,
        serviceName: appointment.service.name,
        duration: appointment.service.duration,
        price: getServicePrice(appointment.service),
        sortOrder: 0,
      },
    ];
  }

  return [];
}

export function sumReservationDuration(services: ReservationServiceLine[]) {
  return services.reduce((sum, service) => sum + (service.duration || 0), 0);
}

export function sumReservationPrice(services: ReservationServiceLine[]) {
  return services.reduce((sum, service) => sum + (service.price || 0), 0);
}

export function serializeAppointmentWithServices<T extends AppointmentLike>(appointment: T) {
  const services = normalizeAppointmentServices(appointment);
  // Remove legacy top-level fields superseded by services[]:
  //   serviceId, service object, employeeId — these are no longer part of the API response.
  const { serviceId: _sid, service: _svc, employeeId: _eid, source: _src, ...rest } = appointment as any;
  return {
    ...rest,
    notes: stripGeneratedServicesNotes(appointment.notes),
    services,
    totalDuration: sumReservationDuration(services),
    totalPrice: sumReservationPrice(services),
    takenOnline: _src === 'ONLINE',
  };
}
