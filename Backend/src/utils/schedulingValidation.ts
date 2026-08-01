import { prisma } from '../lib/prisma';

const ACTIVE_APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] as const;

interface ValidationParams {
  tenantId: string;
  employeeId?: string | null;
  serviceIds: string[];
  startTime: Date;
  endTime: Date;
  isPublicBooking: boolean;
  excludeAppointmentId?: string;
  /** When false, only overlap/time rules run (e.g. drag same employee+service). */
  validateServiceCompatibility?: boolean;
  /** When false, a null employeeId is allowed (e.g. drag move keeps existing per-service employees). */
  requireEmployee?: boolean;
  source?: 'ADMIN' | 'PUBLIC';
}

const DAY_NAMES_FR_EN: Record<number, string[]> = {
  0: ['dimanche', 'sunday', '0'],
  1: ['lundi', 'monday', '1'],
  2: ['mardi', 'tuesday', '2'],
  3: ['mercredi', 'wednesday', '3'],
  4: ['jeudi', 'thursday', '4'],
  5: ['vendredi', 'friday', '5'],
  6: ['samedi', 'saturday', '6'],
};

export function isSameDayName(dayInDb: string | undefined | null, dayIndex: number): boolean {
  if (!dayInDb) return false;
  const normalized = dayInDb.trim().toLowerCase();
  return (DAY_NAMES_FR_EN[dayIndex] || []).includes(normalized);
}

export function getMinutesSinceMidnight(date: Date, timeZone: string = 'Africa/Casablanca'): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  let hour = 0;
  let minute = 0;
  for (const part of parts) {
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

export function getDayOfWeekInTimezone(date: Date, timeZone: string = 'Africa/Casablanca'): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  });
  const dayStr = formatter.format(date);
  const days: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return days[dayStr] ?? date.getDay();
}

export interface WorkingHoursCheckResult {
  isAvailable: boolean;
  status?: 400 | 409;
  error?: string;
  message?: string;
  reason?: 'DAY_OFF' | 'OUTSIDE_HOURS' | 'BREAK';
  breakRange?: string;
}

/**
 * Shared checking function for employee working hours, break periods, and days off.
 */
export function checkEmployeeWorkingHoursAndBreaks(params: {
  workingHours: any[] | null;
  startTime: Date;
  endTime: Date;
  timeZone?: string;
}): WorkingHoursCheckResult {
  const { workingHours, startTime, endTime, timeZone = 'Africa/Casablanca' } = params;

  if (!workingHours || !Array.isArray(workingHours) || workingHours.length === 0) {
    return { isAvailable: true };
  }

  const dayIndex = getDayOfWeekInTimezone(startTime, timeZone);
  const dayData = workingHours.find((d: any) => isSameDayName(d.day, dayIndex));

  if (!dayData || !dayData.isWorking) {
    return {
      isAvailable: false,
      status: 400,
      error: 'Employee day off',
      message: 'Cet employé ne travaille pas ce jour-là.',
      reason: 'DAY_OFF',
    };
  }

  const startMinutes = getMinutesSinceMidnight(startTime, timeZone);
  const endMinutes = getMinutesSinceMidnight(endTime, timeZone);

  const [openH, openM] = (dayData.startTime || '00:00').split(':').map(Number);
  const [closeH, closeM] = (dayData.endTime || '23:59').split(':').map(Number);
  const empOpenMinutes = openH * 60 + openM;
  const empCloseMinutes = closeH * 60 + closeM;

  if (startMinutes < empOpenMinutes || endMinutes > empCloseMinutes) {
    return {
      isAvailable: false,
      status: 400,
      error: 'Outside working hours',
      message: `Ce créneau est en dehors des horaires de travail de cet employé (${dayData.startTime} - ${dayData.endTime}).`,
      reason: 'OUTSIDE_HOURS',
    };
  }

  if (dayData.breaks && Array.isArray(dayData.breaks)) {
    for (const b of dayData.breaks) {
      if (!b.start || !b.end) continue;
      const [bsH, bsM] = b.start.split(':').map(Number);
      const [beH, beM] = b.end.split(':').map(Number);
      const breakStart = bsH * 60 + bsM;
      const breakEnd = beH * 60 + beM;

      if (startMinutes < breakEnd && endMinutes > breakStart) {
        return {
          isAvailable: false,
          status: 400,
          error: 'Employee on break',
          message: `Cet employé est en pause à cette heure (${b.start} - ${b.end}).`,
          reason: 'BREAK',
          breakRange: `${b.start}-${b.end}`,
        };
      }
    }
  }

  return { isAvailable: true };
}

export async function findOverlappingAppointment(params: {
  tenantId: string;
  employeeId: string;
  startTime: Date;
  endTime: Date;
  excludeAppointmentId?: string;
}) {
  const { tenantId, employeeId, startTime, endTime, excludeAppointmentId } = params;

  return prisma.appointment.findFirst({
    where: {
      tenantId,
      employeeId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { id: true, startTime: true, endTime: true },
  });
}

export async function findTenantWideOverlappingAppointment(params: {
  tenantId: string;
  startTime: Date;
  endTime: Date;
  excludeAppointmentId?: string;
}) {
  const { tenantId, startTime, endTime, excludeAppointmentId } = params;

  return prisma.appointment.findFirst({
    where: {
      tenantId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { id: true, startTime: true, endTime: true },
  });
}

export async function validateAppointmentRules(params: ValidationParams) {
  const {
    tenantId,
    employeeId,
    serviceIds,
    startTime,
    endTime,
    isPublicBooking,
    excludeAppointmentId,
    validateServiceCompatibility = isPublicBooking,
    requireEmployee = isPublicBooking,
    source,
  } = params;

  if (endTime <= startTime) {
    return {
      isValid: false,
      status: 400,
      error: 'Invalid duration',
      message: 'La durée du rendez-vous doit être supérieure à 0.',
    };
  }

  if (isPublicBooking && startTime < new Date()) {
    return {
      isValid: false,
      status: 400,
      error: 'Invalid date',
      message: 'Impossible de réserver un créneau dans le passé.',
    };
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  });

  // Blocked dates check (public bookings only, admins can bypass)
  if (isPublicBooking && source !== 'ADMIN' && settings) {
    const businessHours = settings.businessHours as Record<string, any> | null;
    const blockedDates: string[] = businessHours?.blockedDates || [];
    if (blockedDates.length > 0) {
      const dateStr = startTime.toISOString().slice(0, 10);
      if (blockedDates.includes(dateStr)) {
        return {
          isValid: false,
          status: 400,
          error: 'Date blocked',
          message: "L'établissement est fermé ce jour-là (jour bloqué).",
        };
      }
    }
  }

  // Minimum booking lead time check (public bookings only)
  if (isPublicBooking && source !== 'ADMIN' && settings) {
    const businessHours = settings.businessHours as Record<string, any> | null;
    if (businessHours?.bookingDelay) {
      const delay = businessHours.bookingDelay;
      if (delay.value && delay.unit && !delay.allowLastMoment) {
        const now = new Date();
        let minStartTime = new Date(now);
        if (delay.unit === 'heures') {
          minStartTime.setHours(minStartTime.getHours() + parseInt(delay.value));
        } else if (delay.unit === 'jours') {
          minStartTime.setDate(minStartTime.getDate() + parseInt(delay.value));
        } else if (delay.unit === 'semaines') {
          minStartTime.setDate(minStartTime.getDate() + parseInt(delay.value) * 7);
        }
        if (startTime < minStartTime) {
          return {
            isValid: false,
            status: 400,
            error: 'Lead time not met',
            message: `Les réservations doivent être faites au moins ${delay.value} ${delay.unit} à l'avance.`,
          };
        }
      }
    }
  }

  if (settings && settings.businessHours) {
    const businessHours = settings.businessHours as Record<
      string,
      { open?: string; close?: string } | null
    >;
    const dayNames = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const dayName = dayNames[startTime.getDay()];
    const hours = businessHours[dayName];

    if (!hours || !hours.open || !hours.close) {
      return {
        isValid: false,
        status: 400,
        error: 'Outside business hours',
        message: "L'établissement est fermé ce jour-là.",
      };
    }

    const [openHour, openMin] = hours.open.split(':').map(Number);
    const [closeHour, closeMin] = hours.close.split(':').map(Number);

    const openTime = new Date(startTime);
    openTime.setHours(openHour, openMin, 0, 0);

    const closeTime = new Date(startTime);
    closeTime.setHours(closeHour, closeMin, 0, 0);

    if (startTime < openTime || endTime > closeTime) {
      return {
        isValid: false,
        status: 400,
        error: 'Outside business hours',
        message: `Les rendez-vous doivent être planifiés entre ${hours.open} et ${hours.close}.`,
      };
    }
  }

  if (!employeeId) {
    if (source === 'ADMIN') {
      return { isValid: true };
    }
    if (!requireEmployee) {
      return { isValid: true };
    }
    return {
      isValid: false,
      status: 400,
      error: 'Employee not specified',
      message: 'Aucun collaborateur sélectionné. Veuillez choisir un professionnel.',
    };
  }

  const user = await prisma.user.findFirst({
    where: { id: employeeId, tenantId, isActive: true },
  });

  if (!user) {
    return {
      isValid: false,
      status: 404,
      error: 'Invalid employee',
      message: "Le collaborateur sélectionné n'existe pas ou n'est pas disponible.",
    };
  }

  // 1. Employee Working Hours, Day-Off, and Break Periods Check
  const employee = await prisma.employee.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [{ id: employeeId }, { email: user.email }],
    },
    include: { employeeServices: true },
  });

  if (employee) {
    const employeeStatus = employee.agendaSettings ? (employee.agendaSettings as any).status : undefined;
    if (employeeStatus && employeeStatus !== 'active') {
      if (source === 'ADMIN') {
        return { isValid: true };
      }
      const statusMsg = employeeStatus === 'inactive' ? 'inactif' : 'en vacances';
      return {
        isValid: false,
        status: 400,
        error: `Employee ${employeeStatus}`,
        message: `Ce collaborateur est ${statusMsg} et n'est pas disponible pour de nouvelles réservations.`,
      };
    }
  }

  if (employee && employee.workingHours) {
    const whResult = checkEmployeeWorkingHoursAndBreaks({
      workingHours: employee.workingHours as any[],
      startTime,
      endTime,
      timeZone: settings?.timezone || 'Africa/Casablanca',
    });

    if (!whResult.isAvailable) {
      if (source === 'ADMIN') {
        return { isValid: true };
      }
    }
  }

  // 2. Service Compatibility Check
  if (validateServiceCompatibility && employee) {
    if (source === 'ADMIN') {
      return { isValid: true };
    }
    const employeeAllowedServiceIds = employee.employeeServices.map((es) => es.serviceId);
    if (employeeAllowedServiceIds.length > 0) {
      for (const serviceId of serviceIds) {
        if (!employeeAllowedServiceIds.includes(serviceId)) {
          return {
            isValid: false,
            status: 400,
            error: 'Incompatible service',
            message: "Ce collaborateur n'est pas autorisé à effectuer cette prestation.",
          };
        }
      }
    }
  }

  // 3. Employee Overlap Check
  const overlappingAppointment = await findOverlappingAppointment({
    tenantId,
    employeeId,
    startTime,
    endTime,
    excludeAppointmentId,
  });

  if (overlappingAppointment) {
    if (source === 'ADMIN') {
      return { isValid: true };
    }
    return {
      isValid: false,
      status: 409,
      error: 'Overlapping appointment',
      message: 'Ce collaborateur a déjà un rendez-vous sur ce créneau.',
    };
  }

  return { isValid: true };
}
