import { prisma } from '../../lib/prisma';
import { resolveEmployeeUserId } from '../../utils/resolveEmployeeUserId';
import { getBusinessHoursForDate } from '../../utils/schedulingValidation';
import * as log from '../../utils/logger';
import {
  ACTIVE_STATUSES,
  isSameDay,
  minutesSinceMidnight,
  formatMinutes,
  rangesOverlap,
  buildOccupiedRanges,
  resolveEmployeeToUserMap,
  getWorkingHoursForDay,
  isOccupied,
  getSalonDayBreaks,
  overlapsBreaks,
  breakMinutesWithin,
  getVisibleEmployeeIds,
  type WorkingHoursDay,
} from '../../utils/feasibility';

type EmployeeAvailability = {
  employeeId: string;
  employeeName: string;
  available: boolean;
  recommended: boolean;
  reason?: string;
};

type ServiceAssignment = {
  serviceId: string;
  serviceName: string;
  duration: number;
  employeeId: string | null;
  employeeName: string;
};

type ServicePlan = {
  serviceId: string;
  serviceName: string;
  duration: number;
  employees: EmployeeAvailability[];
};

type PlanAlert = {
  severity: 'warning' | 'conflict';
  type: string;
  message: string;
};

type PlanResult = {
  estimatedEndTime: string;
  recommendedAssignment: ServiceAssignment[];
  services: ServicePlan[];
  alerts: PlanAlert[];
  clientAlerts: Record<string, PlanAlert[]>;
};

type PlanInput = {
  tenantId: string;
  serviceIds: string[];
  date: string;
  startTime: string;
  clientId?: string;
  assignments?: { serviceId: string; employeeId: string | null }[];
};

const REASON_DAY_OFF = 'Jour de repos';
const REASON_OUTSIDE_HOURS = 'En dehors des horaires';
const REASON_BREAK = 'En pause';
const REASON_BOOKED = 'Déjà occupé';
const REASON_INACTIF = 'INACTIF';
const REASON_VACATION = 'VACATION';

function formatBreakReason(range: string): string {
  return `${REASON_BREAK} (${range})`;
}

// Return the break range string (e.g. "13:00-14:00") when [rangeStart, rangeEnd]
// overlaps a break, else null. Uses the shared overlap semantics.
function findBreakRange(breaks: { start: number; end: number }[], rangeStart: number, rangeEnd: number): string | null {
  for (const b of breaks) {
    if (rangesOverlap(rangeStart, rangeEnd, b.start, b.end)) {
      return `${formatMinutes(b.start)}-${formatMinutes(b.end)}`;
    }
  }
  return null;
}

export class SchedulingService {
  async planReservation(input: PlanInput): Promise<PlanResult> {
    const { tenantId, serviceIds, date, startTime, clientId, assignments } = input;
    const startMinutes = minutesSinceMidnight(startTime);
    const [year, month, dayNum] = date.split('-').map(Number);
    const dayDate = new Date(year, month - 1, dayNum);
    const dayIndex = dayDate.getDay();

    // Salon-wide pause: employees no longer carry their own breaks — everyone
    // follows the salon's schedule (tenantSettings.businessHours.schedules).
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { businessHours: true },
    });
    const salonBreaks = getSalonDayBreaks(settings?.businessHours, dayIndex);

    // Load services
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
      select: { id: true, name: true, duration: true },
    });

    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const orderedServices = serviceIds.map((id) => serviceMap.get(id)).filter(Boolean) as typeof services;

    log.log('[Feasibility] planReservation: date=' + date + ' startTime=' + startTime +
      ' services=[' + orderedServices.map((s) => s?.name || '?').join(', ') + ']');

    // Load employees with skills
    const employees = await prisma.employee.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        workingHours: true,
        agendaSettings: true,
        employeeServices: {
          select: { serviceId: true },
        },
      },
    });

    // Build skill map: employeeId -> Set<serviceId>
    const skillMap = new Map<string, Set<string>>();
    for (const emp of employees) {
      skillMap.set(emp.id, new Set(emp.employeeServices.map((es) => es.serviceId)));
    }

    // Batch-resolve employee IDs to user IDs for overlap checks (all users in tenant)
    const tenantUsers = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const employeeToUserMap = resolveEmployeeToUserMap(employees as any, tenantUsers);

    // Load existing appointments for the date (all active ones)
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        status: { in: ACTIVE_STATUSES },
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        employeeId: true,
        startTime: true,
        endTime: true,
        clientId: true,
        services: {
          select: { id: true, employeeId: true },
        },
      },
    });

    // Build occupied time ranges per ID (supporting both User ID and Employee ID)
    const occupiedRanges = buildOccupiedRanges(existingAppointments as any);

    function getWorkingHours(emp: typeof employees[0]): { start: number; end: number } | null {
      return getWorkingHoursForDay(emp.workingHours, dayIndex);
    }

    function getBreakMinutesForEmp(wh: { start: number; end: number }): number {
      return breakMinutesWithin(salonBreaks, wh);
    }

    function overlapsBreakForEmp(rangeStart: number, rangeEnd: number): string | null {
      return findBreakRange(salonBreaks, rangeStart, rangeEnd);
    }

    function calcWorkload(emp: typeof employees[0], userId: string): number {
      const wh = getWorkingHours(emp);
      if (!wh) return 1;
      const breakMinutes = getBreakMinutesForEmp(wh);
      const totalMinutes = (wh.end - wh.start) - breakMinutes;
      if (totalMinutes <= 0) return 1;
      const ranges = occupiedRanges.get(userId) || [];
      const occupied = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
      return occupied / totalMinutes;
    }

    const servicesOutput: ServicePlan[] = [];
    const recommendedAssignment: ServiceAssignment[] = [];
    let cursor = startMinutes;

    for (const service of orderedServices) {
      const serviceEnd = cursor + service.duration;
      const serviceEmployees: EmployeeAvailability[] = [];
      const fmtRange = formatMinutes(cursor) + '-' + formatMinutes(serviceEnd);

      log.log('[Feasibility] planReservation service=' + service.name +
        ' range=' + fmtRange);

      let bestEmployees: typeof employees[0][] = [];
      let bestWorkload = Infinity;

      for (const emp of employees) {
        const empSkill = skillMap.get(emp.id);
        const hasSkill = !empSkill || empSkill.size === 0 || empSkill.has(service.id);
        if (!hasSkill) {
          serviceEmployees.push({
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            available: false,
            recommended: false,
            reason: 'Ne peut pas réaliser cette prestation',
          });
          continue;
        }

        const empStatus = emp.agendaSettings ? (emp.agendaSettings as any).status : undefined;
        if (empStatus && empStatus !== 'active') {
          const reason = empStatus === 'inactive' ? REASON_INACTIF : REASON_VACATION;
          serviceEmployees.push({
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            available: false,
            recommended: false,
            reason: reason,
          });
          continue;
        }

        const wh = getWorkingHours(emp);
        if (!wh) {
          serviceEmployees.push({
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            available: false,
            recommended: false,
            reason: REASON_DAY_OFF,
          });
          continue;
        }

        if (cursor < wh.start || serviceEnd > wh.end) {
          serviceEmployees.push({
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            available: false,
            recommended: false,
            reason: REASON_OUTSIDE_HOURS,
          });
          continue;
        }

        const breakReason = overlapsBreakForEmp(cursor, serviceEnd);
        if (breakReason) {
          serviceEmployees.push({
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            available: false,
            recommended: false,
            reason: formatBreakReason(breakReason),
          });
          continue;
        }

        const userId = employeeToUserMap.get(emp.id);
        const conflict = isOccupied(occupiedRanges, emp.id, userId || null, cursor, serviceEnd);

        if (conflict) {
          serviceEmployees.push({
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            available: false,
            recommended: false,
            reason: REASON_BOOKED,
          });
          continue;
        }

        const workload = userId ? calcWorkload(emp, userId) : 0;
        serviceEmployees.push({
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          available: true,
          recommended: false,
        });

        if (workload < bestWorkload) {
          bestWorkload = workload;
          bestEmployees = [emp];
        } else if (workload === bestWorkload) {
          bestEmployees.push(emp);
        }
      }

      const bestEmployee = bestEmployees.length > 0
        ? bestEmployees[Math.floor(Math.random() * bestEmployees.length)]
        : null;

      const availableCount = serviceEmployees.filter((e) => e.available).length;
      log.log('[Feasibility] planReservation service=' + service.name +
        ' available=' + availableCount + '/' + employees.length +
        ' recommended=' + (bestEmployee ? bestEmployee.firstName + ' ' + bestEmployee.lastName : 'none'));

      const recommended = serviceEmployees.find((e) => e.employeeId === bestEmployee?.id);
      if (recommended) recommended.recommended = true;

      serviceEmployees.sort((a, b) => {
        if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
        if (a.available !== b.available) return a.available ? -1 : 1;
        return a.employeeName.localeCompare(b.employeeName);
      });

      recommendedAssignment.push({
        serviceId: service.id,
        serviceName: service.name,
        duration: service.duration,
        employeeId: bestEmployee?.id || null,
        employeeName: bestEmployee ? `${bestEmployee.firstName} ${bestEmployee.lastName}` : '',
      });

      servicesOutput.push({
        serviceId: service.id,
        serviceName: service.name,
        duration: service.duration,
        employees: serviceEmployees,
      });

      cursor = serviceEnd;
    }

    // ---- Diagnostics: single alerts list ----

    const alerts: PlanAlert[] = [];
    const clientAlerts: Record<string, PlanAlert[]> = {};
    const totalDuration = orderedServices.reduce((sum, s) => sum + s.duration, 0);
    const estimatedEnd = startMinutes + totalDuration;

    // Determine which assignments to validate
    const effectiveAssignments = assignments || recommendedAssignment.map((a) => ({
      serviceId: a.serviceId,
      employeeId: a.employeeId,
    }));

    // Validate assignments against the already-computed availability data
    for (const assignment of effectiveAssignments) {
      const svc = servicesOutput.find((s) => s.serviceId === assignment.serviceId);
      if (!svc) {
        alerts.push({ severity: 'conflict', type: 'SERVICE_NOT_FOUND', message: 'Service introuvable' });
        continue;
      }

      if (assignment.employeeId) {
        const empAvail = svc.employees.find((e) => e.employeeId === assignment.employeeId);
        if (!empAvail) {
          const allEmp = employees.find((e) => e.id === assignment.employeeId);
          const name = allEmp ? `${allEmp.firstName} ${allEmp.lastName}` : 'Collaborateur introuvable';
          alerts.push({
            severity: 'conflict',
            type: 'EMPLOYEE_NOT_COMPATIBLE',
            message: `${name} ne peut pas réaliser cette prestation (${svc.serviceName}).`,
          });
          continue;
        }
        if (!empAvail.available) {
          alerts.push({
            severity: 'conflict',
            type: 'EMPLOYEE_UNAVAILABLE',
            message: `${empAvail.employeeName} est ${empAvail.reason?.toLowerCase() || 'indisponible'} pour ${svc.serviceName}.`,
          });
        }
      } else {
        alerts.push({
          severity: 'conflict',
          type: 'NO_EMPLOYEE',
          message: `Aucun employé assigné pour ${svc.serviceName}.`,
        });
      }
    }

    // Client conflict detection — build for ALL clients (for dropdown) + current client alerts
    for (const apt of existingAppointments) {
      if (!apt.clientId) continue;
      const caStart = apt.startTime.getHours() * 60 + apt.startTime.getMinutes();
      const caEnd = apt.endTime.getHours() * 60 + apt.endTime.getMinutes();
      if (caStart < estimatedEnd && caEnd > startMinutes) {
        const fStart = formatMinutes(caStart);
        const fEnd = formatMinutes(caEnd);
        if (!clientAlerts[apt.clientId]) clientAlerts[apt.clientId] = [];
        clientAlerts[apt.clientId].push({
          severity: 'conflict',
          type: 'CLIENT_OVERLAP',
          message: `Ce client possède déjà un rendez-vous de ${fStart} à ${fEnd}.`,
        });
      }
    }

    if (clientId && clientAlerts[clientId]?.length > 0) {
      alerts.push(...clientAlerts[clientId]);
    }

    // Multiple appointments today
    if (clientId) {
      const todayCount = existingAppointments.filter((a) => a.clientId === clientId).length;
      if (todayCount > 1) {
        alerts.push({
          severity: 'warning',
          type: 'CLIENT_MULTIPLE_APPOINTMENTS',
          message: `Ce client a déjà ${todayCount} rendez-vous aujourd'hui.`,
        });
      }
    }

    // Load tenant business hours
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { businessHours: true },
    });
    if (tenantSettings?.businessHours) {
      const bh = tenantSettings.businessHours as Record<string, any>;
      // Check blocked dates
      const blockedDates: string[] = bh.blockedDates || [];
      if (blockedDates.includes(date)) {
        alerts.push({
          severity: 'conflict',
          type: 'DATE_BLOCKED',
          message: "L'établissement est fermé ce jour-là (jour bloqué).",
        });
      }
      const hours = tenantSettings.businessHours as Record<string, { open?: string; close?: string } | null>;
      const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayDate.getDay()];
      const dayHours = hours[dayKey];
      if (dayHours?.close) {
        const closeMinutes = minutesSinceMidnight(dayHours.close);
        if (estimatedEnd > closeMinutes) {
          alerts.push({
            severity: 'conflict',
            type: 'EXCEEDS_OPENING_HOURS',
            message: `Le salon est fermé à cette heure (fermeture à ${dayHours.close}).`,
          });
        } else if (closeMinutes - estimatedEnd > 0 && closeMinutes - estimatedEnd <= 30) {
          alerts.push({
            severity: 'warning',
            type: 'CLOSE_TO_CLOSING',
            message: `Le rendez-vous se termine à ${formatMinutes(estimatedEnd)}, proche de la fermeture à ${dayHours.close}.`,
          });
        }
      }
    }

    // Workload warnings for recommended employees
    for (const assignment of recommendedAssignment) {
      if (assignment.employeeId) {
        const userId = employeeToUserMap.get(assignment.employeeId);
        const emp = employees.find((e) => e.id === assignment.employeeId);
        if (userId && emp) {
          const workload = calcWorkload(emp, userId);
          if (workload > 0.7) {
            const occupiedMin = (occupiedRanges.get(userId) || []).reduce((sum, r) => sum + (r.end - r.start), 0);
            alerts.push({
              severity: 'warning',
              type: 'HIGH_WORKLOAD',
              message: `${assignment.employeeName} a déjà ${Math.round(occupiedMin)} min de réservations aujourd'hui (${Math.round(workload * 100)}% de charge).`,
            });
          }
        }
      }
    }

    return {
      estimatedEndTime: formatMinutes(estimatedEnd),
      recommendedAssignment,
      services: servicesOutput,
      alerts,
      clientAlerts,
    };
  }

  async clientDiagnostics(params: {
    tenantId: string;
    date: string;
    startTime: string;
    estimatedDuration?: number;
  }): Promise<{ clientAlerts: Record<string, PlanAlert[]> }> {
    const { tenantId, date, startTime, estimatedDuration = 60 } = params;
    const startMinutes = minutesSinceMidnight(startTime);
    const dayDate = new Date(date);
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);
    const estimatedEnd = startMinutes + estimatedDuration;

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        status: { in: ACTIVE_STATUSES },
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true, clientId: true, startTime: true, endTime: true },
    });

    const clientAlerts: Record<string, PlanAlert[]> = {};
    for (const apt of appointments) {
      if (!apt.clientId) continue;
      const aptStart = apt.startTime.getHours() * 60 + apt.startTime.getMinutes();
      const aptEnd = apt.endTime.getHours() * 60 + apt.endTime.getMinutes();
      if (aptStart < estimatedEnd && aptEnd > startMinutes) {
        if (!clientAlerts[apt.clientId]) clientAlerts[apt.clientId] = [];
        clientAlerts[apt.clientId].push({
          severity: 'conflict',
          type: 'CLIENT_OVERLAP',
          message: `Ce client possède déjà un rendez-vous de ${formatMinutes(aptStart)} à ${formatMinutes(aptEnd)}.`,
        });
      }
    }

    return { clientAlerts };
  }

  /**
   * Check whether a given start time + services can be fulfilled by any employee(s).
   * Returns false if no employee can cover the entire reservation (considering skills,
   * working hours, breaks, existing appointments).
   * Reuses the same logic as planReservation() — single source of truth.
   */
  async checkSlotAvailability(params: {
    tenantId: string;
    date: string;
    startTime: string;
    serviceIds: string[];
  }): Promise<{ available: boolean; reason?: string }> {
    const { tenantId, date, startTime, serviceIds } = params;
    const startMinutes = minutesSinceMidnight(startTime);
    const [year, month, dayNum] = date.split('-').map(Number);
    const dayDate = new Date(year, month - 1, dayNum);
    const dayIndex = dayDate.getDay();

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
      select: { id: true, name: true, duration: true },
    });
    if (services.length !== serviceIds.length) {
      return { available: false, reason: 'Un ou plusieurs services sont introuvables.' };
    }

    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const orderedServices = serviceIds.map((id) => serviceMap.get(id)).filter(Boolean) as typeof services;

    const totalDuration = orderedServices.reduce((sum, s) => sum + s.duration, 0);
    const overallEnd = startMinutes + totalDuration;

    // Check tenant business hours
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { businessHours: true },
    });
    if (tenantSettings?.businessHours) {
      const businessHours = tenantSettings.businessHours as Record<string, any>;
      // Check blocked dates
      const blockedDates: string[] = businessHours.blockedDates || [];
      if (blockedDates.includes(date)) {
        return { available: false, reason: 'Établissement fermé ce jour (jour bloqué).' };
      }
      const dayHours = getBusinessHoursForDate(businessHours, dayDate);
      if (!dayHours) {
        return { available: false, reason: 'Établissement fermé ce jour.' };
      }
      const openMinutes = minutesSinceMidnight(dayHours.open);
      const closeMinutes = minutesSinceMidnight(dayHours.close);
      if (startMinutes < openMinutes || overallEnd > closeMinutes) {
        return { available: false, reason: 'En dehors des horaires d\'ouverture.' };
      }
    }

    // Load employees with skills
    const employees = await prisma.employee.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        workingHours: true,
        agendaSettings: true,
        employeeServices: { select: { serviceId: true } },
      },
    });

    const skillMap = new Map<string, Set<string>>();
    for (const emp of employees) {
      skillMap.set(emp.id, new Set(emp.employeeServices.map((es) => es.serviceId)));
    }

    // Resolve Employee -> User for overlap checks
    const tenantUsers = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const employeeToUserMap = resolveEmployeeToUserMap(employees as any, tenantUsers);

    // Load existing appointments for the day
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        status: { in: ACTIVE_STATUSES },
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: {
        employeeId: true,
        startTime: true,
        endTime: true,
        services: { select: { employeeId: true } },
      },
    });

    const occupiedRanges = buildOccupiedRanges(existingAppointments as any);

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { businessHours: true },
    });
    const salonBreaks = getSalonDayBreaks(settings?.businessHours, dayIndex);

    function getWorkingHours(emp: typeof employees[0]): { start: number; end: number } | null {
      return getWorkingHoursForDay(emp.workingHours, dayIndex);
    }

    // Try sequential assignment: for each service, find an available employee
    let cursor = startMinutes;
    for (const service of orderedServices) {
      const serviceEnd = cursor + service.duration;
      let found = false;

      for (const emp of employees) {
        const empSkills = skillMap.get(emp.id);
        const hasSkill = !empSkills || empSkills.size === 0 || empSkills.has(service.id);
        if (!hasSkill) continue;

        const empStatus = emp.agendaSettings ? (emp.agendaSettings as any).status : undefined;
        if (empStatus && empStatus !== 'active') continue;

        const wh = getWorkingHours(emp);
        if (!wh) continue;
        if (cursor < wh.start || serviceEnd > wh.end) continue;

        const breakReason = overlapsBreaks(salonBreaks, cursor, serviceEnd);
        if (breakReason) continue;

        const userId = employeeToUserMap.get(emp.id) ?? null;
        if (isOccupied(occupiedRanges, emp.id, userId, cursor, serviceEnd)) continue;

        found = true;
        cursor = serviceEnd;
        break;
      }

      if (!found) {
        return { available: false, reason: 'Aucun professionnel disponible pour une partie de la réservation.' };
      }
    }

    return { available: true };
  }

  async resolveAnyone(params: {
    tenantId: string;
    serviceIds: string[];
    date: string;
    startTime: string;
    timeZone?: string;
    excludeEmployeeIds?: string[];
  }): Promise<{ employeeId: string | null; userEmployeeId: string | null }> {
    const { tenantId, serviceIds, date, startTime, timeZone = 'Africa/Casablanca', excludeEmployeeIds = [] } = params;
    const startMinutes = minutesSinceMidnight(startTime);
    const [year, month, dayNum] = date.split('-').map(Number);
    const dayDate = new Date(year, month - 1, dayNum);
    const dayIndex = dayDate.getDay();

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
      select: { id: true, duration: true },
    });
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const endMinutes = startMinutes + totalDuration;

    let employees = await prisma.employee.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        workingHours: true,
        agendaSettings: true,
        employeeServices: { select: { serviceId: true } },
      },
    });

    // Public-path visibility: only employees the salon has paid for.
    const visibleIds = await getVisibleEmployeeIds(tenantId);
    if (visibleIds) {
      employees = employees.filter((e) => visibleIds.has(e.id));
    }

    const skillMap = new Map<string, Set<string>>();
    for (const emp of employees) {
      skillMap.set(emp.id, new Set(emp.employeeServices.map((es) => es.serviceId)));
    }

    const tenantUsers = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const employeeToUserMap = resolveEmployeeToUserMap(employees as any, tenantUsers);

    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        status: { in: ACTIVE_STATUSES },
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true, employeeId: true, startTime: true, endTime: true, services: { select: { employeeId: true } } },
    });

    const occupiedRanges = buildOccupiedRanges(existingAppointments as any);

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { businessHours: true },
    });
    const salonBreaks = getSalonDayBreaks(settings?.businessHours, dayIndex);

    function calcOccupied(userId: string): number {
      return (occupiedRanges.get(userId) || []).reduce((sum, r) => sum + (r.end - r.start), 0);
    }

    let bestEmployees: (typeof employees)[0][] = [];
    let bestWorkload = Infinity;

    const excludeSet = new Set(excludeEmployeeIds);

    for (const emp of employees) {
      // Skip employees excluded by the caller (e.g., already assigned to another participant)
      if (excludeSet.has(emp.id)) continue;

      const empSkills = skillMap.get(emp.id);
      const hasSkill = !empSkills || empSkills.size === 0 || serviceIds.some((sid) => empSkills.has(sid));
      if (!hasSkill) continue;

      // Never auto-assign an employee the salon has set INACTIVE or on VACATION
      // — downstream validation would reject the booking, so picking them here
      // only produces confusing errors for legitimate "Sans préférence" groups.
      const empStatus = emp.agendaSettings ? (emp.agendaSettings as any).status : undefined;
      if (empStatus && empStatus !== 'active') continue;

      const wh = emp.workingHours as WorkingHoursDay[] | null;
      const daySchedule = wh?.find((d) => isSameDay(d.day, dayIndex));
      if (!daySchedule || !daySchedule.isWorking) continue;

      const whStart = minutesSinceMidnight(daySchedule.startTime);
      const whEnd = minutesSinceMidnight(daySchedule.endTime);
      if (startMinutes < whStart || endMinutes > whEnd) continue;

      const breakReason = overlapsBreaks(salonBreaks, startMinutes, endMinutes);
      if (breakReason) continue;

      const userId = employeeToUserMap.get(emp.id) ?? null;
      if (isOccupied(occupiedRanges, emp.id, userId, startMinutes, endMinutes)) continue;

      const totalMinutes = (whEnd - whStart) - breakMinutesWithin(salonBreaks, { start: whStart, end: whEnd });
      const workload = userId && totalMinutes > 0 ? calcOccupied(userId) / totalMinutes : 0;

      if (workload < bestWorkload) {
        bestWorkload = workload;
        bestEmployees = [emp];
      } else if (workload === bestWorkload) {
        bestEmployees.push(emp);
      }
    }

    if (bestEmployees.length === 0) {
      return { employeeId: null, userEmployeeId: null };
    }

    // Among equally-available candidates, pick one at random so that
    // consecutive "Sans préférence" participants with the same slot don't
    // always land on the same (first) employee.
    const bestEmployee = bestEmployees[Math.floor(Math.random() * bestEmployees.length)];

    let userEmployeeId = employeeToUserMap.get(bestEmployee.id) ?? null;
    // resolveAnyone's internal employee-to-user lookup may miss when no User
    // record matches the employee's email or name. resolveEmployeeUserId handles
    // this by creating a User record on the fly when the employee has an email.
    if (!userEmployeeId && bestEmployee.id) {
      userEmployeeId = await resolveEmployeeUserId(tenantId, bestEmployee.id);
    }
    return { employeeId: bestEmployee.id, userEmployeeId };
  }

  async validateAssignment(params: {
    tenantId: string;
    serviceIds: string[];
    assignments: { serviceId: string; employeeId: string | null }[];
    startTime: string;
    date: string;
    excludeAppointmentId?: string;
    source?: 'ADMIN' | 'PUBLIC';
  }): Promise<{ valid: boolean; errors: { serviceId: string; message: string }[] }> {
    const { tenantId, serviceIds, assignments, startTime, date, excludeAppointmentId, source } = params;
    const isAdmin = source === 'ADMIN';
    const errors: { serviceId: string; message: string }[] = [];
    const startMinutes = minutesSinceMidnight(startTime);
    const [year, month, dayNum] = date.split('-').map(Number);
    const dayDate = new Date(year, month - 1, dayNum);
    const dayIndex = dayDate.getDay();

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { businessHours: true },
    });
    const salonBreaks = getSalonDayBreaks(settings?.businessHours, dayIndex);

    const employees = await prisma.employee.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        workingHours: true,
        employeeServices: { select: { serviceId: true } },
      },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    // Batch-resolve employee IDs to user IDs for overlap checks (all tenant users)
    const tenantUsers = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const validateUserMap = resolveEmployeeToUserMap(employees as any, tenantUsers);

    let cursor = startMinutes;

    for (const assignment of assignments) {
      const service = serviceMap.get(assignment.serviceId);
      if (!service) {
        errors.push({ serviceId: assignment.serviceId, message: 'Service introuvable' });
        continue;
      }

      const serviceEnd = cursor + service.duration;

      if (assignment.employeeId) {
        const emp = empMap.get(assignment.employeeId);
        if (!emp) {
          errors.push({ serviceId: assignment.serviceId, message: 'Collaborateur introuvable' });
          cursor = serviceEnd;
          continue;
        }

        const empSkills = new Set(emp.employeeServices.map((es) => es.serviceId));
        if (empSkills.size > 0 && !empSkills.has(assignment.serviceId)) {
          errors.push({
            serviceId: assignment.serviceId,
            message: `${emp.firstName} ${emp.lastName} ne peut pas réaliser cette prestation`,
          });
          cursor = serviceEnd;
          continue;
        }

        const wh = emp.workingHours as WorkingHoursDay[] | null;
        const daySchedule = wh?.find((d) => isSameDay(d.day, dayIndex));
        if (!daySchedule || !daySchedule.isWorking) {
          errors.push({
            serviceId: assignment.serviceId,
            message: `${emp.firstName} ${emp.lastName} ne travaille pas ce jour`,
          });
          cursor = serviceEnd;
          continue;
        }

        const whStart = minutesSinceMidnight(daySchedule.startTime);
        const whEnd = minutesSinceMidnight(daySchedule.endTime);
        if (cursor < whStart || serviceEnd > whEnd) {
          if (!isAdmin) {
            errors.push({
              serviceId: assignment.serviceId,
              message: `${emp.firstName} ${emp.lastName} est en dehors de ses horaires de travail (disponible de ${daySchedule.startTime} à ${daySchedule.endTime})`,
            });
            cursor = serviceEnd;
            continue;
          }
        }

        const breakReason = findBreakRange(salonBreaks, cursor, serviceEnd);
        if (breakReason) {
          if (!isAdmin) {
            const [bStart, bEnd] = breakReason.split('-');
            errors.push({
              serviceId: assignment.serviceId,
              message: `${emp.firstName} ${emp.lastName} est en pause de ${bStart} à ${bEnd}`,
            });
            cursor = serviceEnd;
            continue;
          }
        }        const userId = validateUserMap.get(assignment.employeeId) ?? null;


        if (userId) {
          const dayStart = new Date(dayDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayDate);
          dayEnd.setHours(23, 59, 59, 999);

          const overlapQuery: any = {
            tenantId,
            employeeId: userId,
            status: { in: ACTIVE_STATUSES },
            startTime: { lt: new Date(dayDate.getTime() + serviceEnd * 60000) },
            endTime: { gt: new Date(dayDate.getTime() + cursor * 60000) },
          };
          if (excludeAppointmentId) {
            overlapQuery.id = { not: excludeAppointmentId };
          }

          const overlap = await prisma.appointment.findFirst({ where: overlapQuery, select: { id: true } });
          if (overlap) {
            if (!isAdmin) {
              errors.push({
                serviceId: assignment.serviceId,
                message: `${emp.firstName} ${emp.lastName} est déjà occupé pendant ce créneau`,
              });
              cursor = serviceEnd;
              continue;
            }
          }
        }
      }

      cursor = serviceEnd;
    }

    return { valid: errors.length === 0, errors };
  }
}

export const schedulingService = new SchedulingService();
