import { prisma } from '../lib/prisma';
import type { AppointmentStatus } from '../../prisma/generated/prisma/client';

/**
 * Shared feasibility / availability core.
 *
 * Single source of truth for the interval-overlap + employee-availability
 * logic that previously lived in three places:
 *   - src/modules/appointment/scheduling.service.ts (staff/admin path)
 *   - src/modules/public/services/booking.service.ts (public path)
 *   - src/modules/appointment/appointment.service.ts (move-conflict checks)
 *
 * All copies used the SAME semantics:
 *   - overlap predicate:  aStart < bEnd && aEnd > bStart   (boundary-exclusive)
 *   - break overlap:      rangeStart < bEnd && rangeEnd > bStart
 *   - eligibility sequence: agenda status -> skill -> working hours -> break -> occupied
 *   - occupied ranges built from appointment.employeeId + services[].employeeId
 *
 * Known intentional divergences preserved via options:
 *   - checkAgendaStatus=false for resolveAnyone / validateAssignment
 *     (those two never consulted agendaSettings.status)
 *   - skill matching is per-service; resolveAnyone matches ANY of the services
 *   - validateAssignment keeps its own DB overlap query (excludeAppointmentId)
 */

export const ACTIVE_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'];

/**
 * Return the set of employee IDs visible on the public site for a tenant.
 * Visible = employees with isPublic=true (set by superadmin approval).
 * Returns null when the tenant has no subscription info (safe fallback: show all).
 */
export async function getVisibleEmployeeIds(tenantId: string): Promise<Set<string> | null> {
  try {
    const employees = await prisma.employee.findMany({
      where: { tenantId, isActive: true, isPublic: true },
      select: { id: true },
    });
    if (employees.length === 0) return new Set(); // no paid employees → nothing visible
    return new Set(employees.map((e) => e.id));
  } catch {
    return null; // fallback: don't filter
  }
}

const DAY_NAMES_FR_EN: Record<number, string[]> = {
  0: ['dimanche', 'sunday'],
  1: ['lundi', 'monday'],
  2: ['mardi', 'tuesday'],
  3: ['mercredi', 'wednesday'],
  4: ['jeudi', 'thursday'],
  5: ['vendredi', 'friday'],
  6: ['samedi', 'saturday'],
};

export function isSameDay(dayInDb: string | undefined | null, dayIndex: number): boolean {
  if (!dayInDb) return false;
  const normalized = dayInDb.trim().toLowerCase();
  return (DAY_NAMES_FR_EN[dayIndex] || []).includes(normalized);
}

export function minutesSinceMidnight(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Half-open interval overlap — the single overlap predicate used everywhere. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Whether [rangeStart, rangeEnd] overlaps any break of the day's working hours. */
export function overlapsBreak(
  workingHours: WorkingHoursDay[] | null,
  dayIndex: number,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  const dayData = workingHours?.find((d) => isSameDay(d.day, dayIndex));
  if (!dayData?.breaks || !Array.isArray(dayData.breaks)) return false;
  return dayData.breaks.some((b) => {
    const bs = minutesSinceMidnight(b.start);
    const be = minutesSinceMidnight(b.end);
    return rangesOverlap(rangeStart, rangeEnd, bs, be);
  });
}

export function getBreakMinutes(
  workingHours: WorkingHoursDay[] | null,
  dayIndex: number,
  wh: { start: number; end: number },
): number {
  const dayData = workingHours?.find((d) => isSameDay(d.day, dayIndex));
  if (!dayData?.breaks || !Array.isArray(dayData.breaks)) return 0;
  let total = 0;
  for (const b of dayData.breaks) {
    const bs = minutesSinceMidnight(b.start);
    const be = minutesSinceMidnight(b.end);
    if (bs >= wh.start && be <= wh.end) {
      total += be - bs;
    }
  }
  return total;
}

/**
 * The salon-wide break(s) for a given day, from tenantSettings.businessHours.schedules.
 * Employees no longer carry their own breaks: everyone follows the salon's pause.
 * Returns minute-of-day ranges; empty when the salon has no schedule/breaks for the day.
 */
export function getSalonDayBreaks(
  businessHours: unknown,
  dayIndex: number,
): { start: number; end: number }[] {
  const schedules = (businessHours as any)?.schedules;
  if (!Array.isArray(schedules)) return [];
  const sched = schedules.find((s: any) => isSameDay(s?.day, dayIndex));
  if (!sched || sched.isOpen === false || !Array.isArray(sched.breaks)) return [];
  return sched.breaks
    .filter((b: any) => b?.start && b?.end)
    .map((b: any) => ({ start: minutesSinceMidnight(b.start), end: minutesSinceMidnight(b.end) }));
}

/** Whether [rangeStart, rangeEnd] overlaps any of the given break ranges (minutes). */
export function overlapsBreaks(
  breaks: { start: number; end: number }[],
  rangeStart: number,
  rangeEnd: number,
): boolean {
  return breaks.some((b) => rangesOverlap(rangeStart, rangeEnd, b.start, b.end));
}

/** Total minutes of the given breaks fully contained in [wh.start, wh.end]. */
export function breakMinutesWithin(
  breaks: { start: number; end: number }[],
  wh: { start: number; end: number },
): number {
  let total = 0;
  for (const b of breaks) {
    if (b.start >= wh.start && b.end <= wh.end) total += b.end - b.start;
  }
  return total;
}

export type WorkingHoursDay = {
  day: string;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breaks?: { start: string; end: string }[];
};

export type FeasibilityEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  workingHours: unknown;
  agendaSettings: unknown;
  employeeServices: { serviceId: string }[];
};

export type FeasibilityContext = {
  tenantId: string;
  employees: FeasibilityEmployee[];
  skillMap: Map<string, Set<string>>;
  employeeToUserMap: Map<string, string | null>;
  occupiedRanges: Map<string, { start: number; end: number }[]>;
  serviceDurationMap: Map<string, number>;
  dayIndex: number;
  clientOccupiedRanges: { start: number; end: number }[];
  /** The salon-wide pause(s) for the context's day (minutes) — the only breaks that apply. */
  salonBreaks: { start: number; end: number }[];
};

/** Build employeeId -> Set<serviceId> skill map. */
export function buildSkillMap(employees: FeasibilityEmployee[]): Map<string, Set<string>> {
  const skillMap = new Map<string, Set<string>>();
  for (const emp of employees) {
    skillMap.set(emp.id, new Set(emp.employeeServices.map((es) => es.serviceId)));
  }
  return skillMap;
}

/**
 * Resolve Employee records to User records (overlap ranges are keyed by both
 * id spaces: appointments reference User ids on employeeId, employee rows live
 * in a separate id space). Matches by email, then by full name.
 */
export function resolveEmployeeToUserMap(
  employees: FeasibilityEmployee[],
  tenantUsers: { id: string; email: string | null; firstName: string; lastName: string }[],
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const emailToUserId = new Map(
    tenantUsers.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id]),
  );
  const nameToUserId = new Map(
    tenantUsers.map((u) => [`${u.firstName.toLowerCase()} ${u.lastName.toLowerCase()}`, u.id]),
  );
  for (const emp of employees) {
    let uid: string | null = null;
    if (emp.email) uid = emailToUserId.get(emp.email.toLowerCase()) ?? null;
    if (!uid) uid = nameToUserId.get(`${emp.firstName.toLowerCase()} ${emp.lastName.toLowerCase()}`) ?? null;
    if (uid) map.set(emp.id, uid);
  }
  return map;
}

/**
 * Build occupied time ranges (minutes-of-day) per id from a day's appointments.
 * Both the legacy top-level employeeId AND per-service item employeeIds block
 * the employee for the FULL appointment window (the app-wide convention).
 */
export function buildOccupiedRanges(
  appointments: {
    employeeId: string | null;
    startTime: Date;
    endTime: Date;
    services?: { employeeId: string | null }[];
  }[],
): Map<string, { start: number; end: number }[]> {
  const occupiedRanges = new Map<string, { start: number; end: number }[]>();
  for (const apt of appointments) {
    const s = apt.startTime.getHours() * 60 + apt.startTime.getMinutes();
    const e = apt.endTime.getHours() * 60 + apt.endTime.getMinutes();
    const addRange = (eid: string | null) => {
      if (!eid) return;
      if (!occupiedRanges.has(eid)) occupiedRanges.set(eid, []);
      occupiedRanges.get(eid)!.push({ start: s, end: e });
    };
    addRange(apt.employeeId);
    for (const item of apt.services || []) addRange(item.employeeId);
  }
  return occupiedRanges;
}

/** Occupied check against BOTH the employee id and the linked user id. */
export function isOccupied(
  occupiedRanges: Map<string, { start: number; end: number }[]>,
  empId: string,
  userId: string | null,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  const idsToCheck = [empId];
  if (userId && userId !== empId) idsToCheck.push(userId);
  for (const id of idsToCheck) {
    const ranges = occupiedRanges.get(id);
    if (ranges && ranges.some((r) => rangesOverlap(rangeStart, rangeEnd, r.start, r.end))) {
      return true;
    }
  }
  return false;
}

/** Working hours for the given day index, or null when day off / missing. */
export function getWorkingHoursForDay(
  workingHours: unknown,
  dayIndex: number,
): { start: number; end: number } | null {
  const wh = workingHours as WorkingHoursDay[] | null;
  if (!wh || !Array.isArray(wh)) return null;
  const day = wh.find((d) => isSameDay(d.day, dayIndex));
  if (!day || !day.isWorking) return null;
  return {
    start: minutesSinceMidnight(day.startTime),
    end: minutesSinceMidnight(day.endTime),
  };
}

export type EligibilityOptions = {
  /** Whether agendaSettings.status must be 'active' (false for resolveAnyone/validateAssignment). */
  checkAgendaStatus?: boolean;
};

/**
 * The canonical per-employee eligibility check for one service interval.
 * Returns a reason string when ineligible (callers format their own messages).
 */
export function isEmployeeEligibleForInterval(
  emp: FeasibilityEmployee,
  serviceId: string,
  skillMap: Map<string, Set<string>>,
  employeeToUserMap: Map<string, string | null>,
  occupiedRanges: Map<string, { start: number; end: number }[]>,
  dayIndex: number,
  intervalStart: number,
  intervalEnd: number,
  opts: EligibilityOptions = {},
  salonBreaks: { start: number; end: number }[] = [],
): { eligible: boolean; reason?: string } {
  const { checkAgendaStatus = true } = opts;

  if (checkAgendaStatus) {
    const empStatus = emp.agendaSettings ? (emp.agendaSettings as any).status : undefined;
    if (empStatus && empStatus !== 'active') {
      return { eligible: false, reason: empStatus === 'inactive' ? 'INACTIF' : 'VACATION' };
    }
  }

  const empSkills = skillMap.get(emp.id);
  const hasSkill = !empSkills || empSkills.size === 0 || empSkills.has(serviceId);
  if (!hasSkill) {
    return { eligible: false, reason: 'SKILL' };
  }

  const wh = getWorkingHoursForDay(emp.workingHours, dayIndex);
  if (!wh) {
    return { eligible: false, reason: 'DAY_OFF' };
  }
  if (intervalStart < wh.start || intervalEnd > wh.end) {
    return { eligible: false, reason: 'OUTSIDE_HOURS' };
  }

  if (overlapsBreaks(salonBreaks, intervalStart, intervalEnd)) {
    return { eligible: false, reason: 'BREAK' };
  }

  const userId = employeeToUserMap.get(emp.id) ?? null;
  if (isOccupied(occupiedRanges, emp.id, userId, intervalStart, intervalEnd)) {
    return { eligible: false, reason: 'BOOKED' };
  }

  return { eligible: true };
}

/**
 * Load everything needed for feasibility checks in ONE batch of queries,
 * shared by the staff path and the public path (P3: load once per request,
 * never re-fetch per candidate slot).
 */
export async function loadFeasibilityContext(
  tenantId: string,
  date: string,
  serviceIds?: string[],
  clientId?: string,
): Promise<FeasibilityContext> {
  const [year, month, dayNum] = date.split('-').map(Number);
  const dayDate = new Date(year, month - 1, dayNum);
  const dayIndex = dayDate.getDay();

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

  // Public-path visibility: only show employees the salon has paid for.
  const visibleIds = await getVisibleEmployeeIds(tenantId);
  if (visibleIds) {
    employees = employees.filter((e) => visibleIds.has(e.id));
  }

  const skillMap = buildSkillMap(employees as FeasibilityEmployee[]);

  const tenantUsers = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  const employeeToUserMap = resolveEmployeeToUserMap(
    employees as FeasibilityEmployee[],
    tenantUsers,
  );

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

  const occupiedRanges = buildOccupiedRanges(existingAppointments);

  const allTenantServices = serviceIds && serviceIds.length > 0
    ? await prisma.service.findMany({ where: { id: { in: serviceIds }, tenantId }, select: { id: true, duration: true } })
    : await prisma.service.findMany({ where: { tenantId }, select: { id: true, duration: true } });
  const serviceDurationMap = new Map(allTenantServices.map((s) => [s.id, s.duration]));

  // Client's own appointments for the day (client-conflict constraint).
  // NOT scoped to this tenant: a client's schedule spans every salon.
  const clientOccupiedRanges: { start: number; end: number }[] = [];
  if (clientId) {
    const clientApts = await prisma.appointment.findMany({
      where: {
        clientId,
        status: { in: ACTIVE_STATUSES },
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: { startTime: true, endTime: true },
    });
    for (const ca of clientApts) {
      clientOccupiedRanges.push({
        start: ca.startTime.getHours() * 60 + ca.startTime.getMinutes(),
        end: ca.endTime.getHours() * 60 + ca.endTime.getMinutes(),
      });
    }
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { businessHours: true },
  });
  const salonBreaks = getSalonDayBreaks(settings?.businessHours, dayIndex);

  return {
    tenantId,
    employees: employees as FeasibilityEmployee[],
    skillMap,
    employeeToUserMap,
    occupiedRanges,
    serviceDurationMap,
    dayIndex,
    clientOccupiedRanges,
    salonBreaks,
  };
}

/**
 * Minimal backtracking solver over service intervals. Each interval carries the
 * list of eligible employee ids; the same employee can only serve non-overlapping
 * intervals. Returns whether a valid assignment exists.
 */
export function solveIntervalAssignment(
  intervals: { startMinutes: number; endMinutes: number; eligible: string[] }[],
): boolean {
  if (intervals.length === 0) return true;
  const sorted = [...intervals].sort((a, b) => a.eligible.length - b.eligible.length);
  const assignment = new Map<number, string>();

  function backtrack(pos: number): boolean {
    if (pos >= sorted.length) return true;
    const interval = sorted[pos];
    for (const eid of interval.eligible) {
      let conflict = false;
      for (const [assignedIdx, assignedEmp] of assignment) {
        if (assignedEmp !== eid) continue;
        if (rangesOverlap(sorted[assignedIdx].startMinutes, sorted[assignedIdx].endMinutes, interval.startMinutes, interval.endMinutes)) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;
      assignment.set(pos, eid);
      if (backtrack(pos + 1)) return true;
      assignment.delete(pos);
    }
    return false;
  }

  return backtrack(0);
}
