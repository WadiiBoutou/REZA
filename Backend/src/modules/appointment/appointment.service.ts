import { prisma } from '../../lib/prisma';
import { createNotification } from '../../utils/notify';
import {
  checkEmployeeWorkingHoursAndBreaks,
  validateAppointmentRules,
} from '../../utils/schedulingValidation';
import { resolveEmployeeUserId } from '../../utils/resolveEmployeeUserId';
import { schedulingService } from './scheduling.service';
import { formatDateForNotification } from '../../utils/dateTime';
import { salonClientsFilter, tenantIdFilter } from '../../utils/salonScope';
import { buildProcheAvatarMap } from '../../utils/familyMemberAvatars';
import * as log from '../../utils/logger';
import {
  getServicePrice,
  serializeAppointmentWithServices,
  stripGeneratedServicesNotes,
} from '../../utils/appointmentServiceItems';

const ACTIVE_APPOINTMENT_STATUSES = new Set(['PENDING', 'CONFIRMED', 'IN_PROGRESS']);
const ACTIVE_APPOINTMENT_STATUS_LIST = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] as const;

// For drag-move conflict analysis a COMPLETED/IN_PROGRESS appointment still
// occupies the slot (client was there, employee was busy) — only CANCELLED and
// NO_SHOW free it. Using the broad list here is intentional.
const MOVE_CONFLICT_STATUS_LIST = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const;

const serviceSelect = {
  id: true,
  name: true,
  color: true,
  duration: true,
  price: true,
  priceFrom: true,
  onQuote: true,
};

const appointmentListInclude = {
  client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
  service: { select: serviceSelect },
  services: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      service: { select: serviceSelect },
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  employee: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  bookingParticipant: { select: { displayName: true, clientId: true } },
  bookingGroup: { select: { id: true, _count: { select: { participants: true } } } },
};

// ─── P1: agenda flattened fetch ───────────────────────────────────────────────
// The Prisma driver-adapter client fires one SQL query per `include` relation
// (even to-one), so the full `appointmentListInclude` chain costs ~10 round trips
// per agenda request. These helpers rebuild the same nested shape from 3 flat
// SQL queries (appointments+relations, service items, count) so a busy day is
// 3 round trips instead of ~10. Behaviour is identical to the include chain.

const AGENDA_SCALARS = [
  'id', 'tenantId', 'clientId', 'serviceId', 'employeeId', 'createdById',
  'startTime', 'endTime', 'duration', 'status', 'source', 'notes',
  'cancelledAt', 'cancelledBy', 'cancellationReason', 'bookingGroupId',
  'createdAt', 'updatedAt',
] as const;

const AGENDA_RELATIONS: Record<string, readonly string[]> = {
  client: ['id', 'firstName', 'lastName', 'email', 'phone', 'avatar'],
  service: ['id', 'name', 'color', 'duration', 'price', 'priceFrom', 'onQuote'],
  employee: ['id', 'firstName', 'lastName'],
  createdBy: ['id', 'firstName', 'lastName'],
  bookingParticipant: ['displayName', 'clientId'],
  bookingGroup: ['id'],
};

function agendaScalarSelect(table: string): string {
  return AGENDA_SCALARS.map((c) => `a."${c}"`).join(', ');
}

function agendaRelationSelect(): string {
  const parts: string[] = [];
  for (const [rel, fields] of Object.entries(AGENDA_RELATIONS)) {
    const t =
      rel === 'bookingParticipant' ? 'bp' : rel === 'bookingGroup' ? 'bg' : rel === 'client' ? 'c' : rel === 'service' ? 's' : rel === 'employee' ? 'em' : 'cb';
    for (const f of fields) parts.push(`${t}."${f}" AS "${rel}.${f}"`);
  }
  parts.push(`(SELECT COUNT(*)::int FROM "booking_participants" bpc WHERE bpc."bookingGroupId" = a."bookingGroupId") AS "bookingGroup._count.participants"`);
  return parts.join(', ');
}

/** Translate the Prisma `where` object built in getAppointments to SQL. */
function agendaWhereSql(where: any): { sql: string; params: unknown[] } {
  const conds: string[] = [];
  const params: unknown[] = [];
  const p = () => `$${params.length + 1}`;

  const tenant = where.tenantId;
  if (typeof tenant === 'string') {
    conds.push(`a."tenantId" = ${p()}`); params.push(tenant);
  } else if (tenant && Array.isArray(tenant.in)) {
    conds.push(`a."tenantId" = ANY(${p()}::text[])`); params.push(tenant.in);
  }

  if (where.startTime) {
    if (where.startTime.gte) { conds.push(`a."startTime" >= ${p()}`); params.push(where.startTime.gte); }
    if (where.startTime.lte) { conds.push(`a."startTime" <= ${p()}`); params.push(where.startTime.lte); }
  }
  if (where.cancelledAt) {
    if (where.cancelledAt.gte) { conds.push(`a."cancelledAt" >= ${p()}`); params.push(where.cancelledAt.gte); }
    if (where.cancelledAt.lte) { conds.push(`a."cancelledAt" <= ${p()}`); params.push(where.cancelledAt.lte); }
  }
  if (where.clientId) { conds.push(`a."clientId" = ${p()}`); params.push(where.clientId); }
  if (where.status) { conds.push(`a."status" = ${p()}`); params.push(where.status); }

  // Each OR-group becomes `(cond1 OR cond2 ...)`. The builder in getAppointments
  // produces either `where.OR` (single group) or `where.AND` (two groups AND-ed).
  const orGroups: Array<Array<Record<string, any>>> = [];
  if (Array.isArray(where.OR)) orGroups.push(where.OR);
  if (Array.isArray(where.AND)) {
    for (const andClause of where.AND) {
      if (Array.isArray(andClause.OR)) orGroups.push(andClause.OR);
    }
  }
  for (const group of orGroups) {
    const parts: string[] = [];
    for (const clause of group) {
      if (clause.employeeId) { parts.push(`a."employeeId" = ${p()}`); params.push(clause.employeeId); }
      if (clause.serviceId) { parts.push(`a."serviceId" = ${p()}`); params.push(clause.serviceId); }
      const some = clause.services?.some;
      if (some) {
        if (some.employeeId) {
          parts.push(`EXISTS (SELECT 1 FROM "appointment_service_items" asi WHERE asi."appointmentId" = a.id AND asi."employeeId" = ${p()})`);
          params.push(some.employeeId);
        }
        if (some.serviceId) {
          parts.push(`EXISTS (SELECT 1 FROM "appointment_service_items" asi WHERE asi."appointmentId" = a.id AND asi."serviceId" = ${p()})`);
          params.push(some.serviceId);
        }
      }
    }
    if (parts.length) conds.push(`(${parts.join(' OR ')})`);
  }

  return { sql: conds.join(' AND '), params };
}

/** Rebuild Prisma-shaped nested objects from dotted-alias SQL rows. */
function hydrateAgendaRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rel, fields] of Object.entries(AGENDA_RELATIONS)) {
    const obj: Record<string, unknown> = {};
    let anyNonNull = false;
    for (const f of fields) {
      const v = row[`${rel}.${f}`];
      obj[f] = v;
      if (v !== null && v !== undefined) anyNonNull = true;
    }
    out[rel] = anyNonNull ? obj : null;
    if (rel === 'bookingGroup' && anyNonNull) {
      (obj as any)._count = { participants: (row['bookingGroup._count.participants'] as number) ?? 0 };
    }
  }
  for (const c of AGENDA_SCALARS) out[c] = row[c];
  return out;
}

/** Fetch one page of appointments + relations in 3 round trips (P1). */
async function fetchAgendaPage(
  where: any,
  skip: number,
  take: number
): Promise<{ rows: any[]; total: number }> {
  const { sql: whereSql, params } = agendaWhereSql(where);
  const whereClause = whereSql ? ` WHERE ${whereSql}` : '';

  const [apptRows, total] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT ${agendaScalarSelect('a')}, ${agendaRelationSelect()}
       FROM "appointments" a
       LEFT JOIN "clients" c ON c.id = a."clientId"
       LEFT JOIN "services" s ON s.id = a."serviceId"
       LEFT JOIN "users" cb ON cb.id = a."createdById"
       LEFT JOIN "users" em ON em.id = a."employeeId"
       LEFT JOIN "booking_participants" bp ON bp."appointmentId" = a.id
       LEFT JOIN "booking_groups" bg ON bg.id = a."bookingGroupId"
       ${whereClause}
       ORDER BY a."startTime" ASC
       LIMIT ${take} OFFSET ${skip}`,
      ...params,
    ),
    prisma.appointment.count({ where }),
  ]);

  // Service items need the page's appointment ids (fetched above).
  const pageIds = (apptRows as Array<{ id: string }>).map((r) => r.id);
  const items =
    pageIds.length > 0
      ? ((await prisma.$queryRawUnsafe(
          `SELECT asi.id, asi."appointmentId", asi."serviceId", asi."employeeId", asi."serviceName",
                  asi.duration, asi.price, asi."sortOrder", asi."createdAt", asi."updatedAt",
                  svc.id AS "service.id", svc.name AS "service.name", svc.color AS "service.color",
                  svc.duration AS "service.duration", svc.price AS "service.price",
                  svc."priceFrom" AS "service.priceFrom", svc."onQuote" AS "service.onQuote",
                  em.id AS "employee.id", em."firstName" AS "employee.firstName", em."lastName" AS "employee.lastName"
           FROM "appointment_service_items" asi
           LEFT JOIN "services" svc ON svc.id = asi."serviceId"
           LEFT JOIN "users" em ON em.id = asi."employeeId"
           WHERE asi."appointmentId" = ANY($1::text[])
           ORDER BY asi."sortOrder" ASC`,
          pageIds
        )) as Array<Record<string, unknown>>)
      : [];

  const itemsByAppointment = new Map<string, Array<Record<string, unknown>>>();
  for (const item of items) {
    const aid = item.appointmentId as string;
    const arr = itemsByAppointment.get(aid) ?? [];
    arr.push(item);
    itemsByAppointment.set(aid, arr);
  }

  const rows = (apptRows as Array<Record<string, unknown>>).map((row) => {
    const hydrated = hydrateAgendaRow(row);
    (hydrated as any).services = (itemsByAppointment.get(hydrated.id as string) ?? []).map((it) => {
      const nested: any = {
        id: it.id,
        appointmentId: it.appointmentId,
        serviceId: it.serviceId,
        employeeId: it.employeeId,
        serviceName: it.serviceName,
        duration: it.duration,
        price: it.price,
        sortOrder: it.sortOrder,
        createdAt: it.createdAt,
        updatedAt: it.updatedAt,
      };
      const svcId = it['service.id'];
      if (svcId != null) {
        nested.service = {
          id: svcId, name: it['service.name'], color: it['service.color'],
          duration: it['service.duration'], price: it['service.price'],
          priceFrom: it['service.priceFrom'], onQuote: it['service.onQuote'],
        };
      } else {
        nested.service = null;
      }
      const empId = it['employee.id'];
      if (empId != null) {
        nested.employee = { id: empId, firstName: it['employee.firstName'], lastName: it['employee.lastName'] };
      } else {
        nested.employee = null;
      }
      return nested;
    });
    return hydrated;
  });

  return { rows, total: total as number };
}

function throwValidationError(details: {
  status?: number;
  error?: string;
  message?: string;
}): never {
  const error: any = new Error('VALIDATION_ERROR');
  error.details = details;
  throw error;
}

/**
 * Build exact per-employee windows for an appointment: the legacy top-level
 * employee covers the whole span; each service item covers its own chained
 * sub-window (start + cumulative durations in service order).
 */
function buildEmployeeWindows(
  apptEmployeeId: string | null,
  apptStart: number,
  apptDuration: number,
  items: Array<{ employeeId: string | null; duration: number | null }>,
): Map<string, Array<{ start: number; end: number }>> {
  const windows = new Map<string, Array<{ start: number; end: number }>>();
  const push = (empId: string, start: number, end: number) => {
    const arr = windows.get(empId) ?? [];
    arr.push({ start, end });
    windows.set(empId, arr);
  };
  if (apptEmployeeId) {
    push(apptEmployeeId, apptStart, apptStart + apptDuration * 60000);
  }
  let cursor = apptStart;
  for (const item of items) {
    const win = { start: cursor, end: cursor + (item.duration ?? 0) * 60000 };
    cursor = win.end;
    if (item.employeeId) push(item.employeeId, win.start, win.end);
  }
  return windows;
}

export class AppointmentService {
  private getRequestedServiceIds(data: any) {
    const ids =
      data.serviceIds ||
      data.services?.map((service: any) => service.serviceId) ||
      (data.serviceId ? [data.serviceId] : []);
    return [...new Set(ids.filter(Boolean))] as string[];
  }

  private async resolveServices(tenantId: string, data: any) {
    const serviceIds = this.getRequestedServiceIds(data);
    if (serviceIds.length === 0) throw new Error('SERVICE_NOT_FOUND');

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId },
    });

    if (services.length !== serviceIds.length) throw new Error('SERVICE_NOT_FOUND');

    const byId = new Map(services.map((service) => [service.id, service]));
    return serviceIds.map((id) => byId.get(id)!);
  }

  async getAppointments(tenantIds: string | string[], filters: any, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const take = limit;
    const where: any = { tenantId: tenantIdFilter(tenantIds) };

    if (filters.startDate || filters.endDate) {
      where.startTime = {};
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        where.startTime.gte = start;
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.startTime.lte = end;
      }
    }

    // Cancelled appointments are filtered by the cancellation date (cancelledAt),
    // NOT startTime — a just-cancelled future RDV has its startTime in the future
    // and would fall outside any past-window on startTime.
    if (filters.cancelledStartDate || filters.cancelledEndDate) {
      where.cancelledAt = {};
      if (filters.cancelledStartDate) {
        const start = new Date(filters.cancelledStartDate);
        start.setHours(0, 0, 0, 0);
        where.cancelledAt.gte = start;
      }
      if (filters.cancelledEndDate) {
        const end = new Date(filters.cancelledEndDate);
        end.setHours(23, 59, 59, 999);
        where.cancelledAt.lte = end;
      }
    }

    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.employeeId) {
      where.OR = [
        { employeeId: filters.employeeId },
        { services: { some: { employeeId: filters.employeeId } } },
      ];
    }
    if (filters.serviceId) {
      const serviceFilter = [
        { serviceId: filters.serviceId },
        { services: { some: { serviceId: filters.serviceId } } },
      ];
      if (where.OR) {
        // Combine with employee OR filter — both must match
        where.AND = [{ OR: where.OR }, { OR: serviceFilter }];
        delete where.OR;
      } else {
        where.OR = serviceFilter;
      }
    }
    if (filters.status) where.status = filters.status;

    // P1: 3 flat round trips instead of the ~10-query include chain.
    const { rows: appointments, total } = await fetchAgendaPage(where, skip, take);

    // Proche avatars live on the familyMember record, not on the salon Client
    // row created when the proche books — overlay them so the agenda (pro
    // mobile + admin web) shows the same photo the owning client sees.
    const procheAvatarByClientId = await buildProcheAvatarMap(
      appointments.map((a) => a.client).filter((c): c is NonNullable<typeof c> => !!c)
    );
    const appointmentsWithAvatars = appointments.map((a) => {
      if (a.client && !a.client.avatar && procheAvatarByClientId.has(a.client.id)) {
        return { ...a, client: { ...a.client, avatar: procheAvatarByClientId.get(a.client.id) } };
      }
      return a;
    });

    return {
      appointments: appointmentsWithAvatars.map(serializeAppointmentWithServices),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / take),
    };
  }

  async getAppointmentById(tenantIds: string | string[], id: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId: tenantIdFilter(tenantIds) },
      include: {
        client: true,
        service: true,
        services: { orderBy: { sortOrder: 'asc' }, include: { service: true, employee: true } },
        employee: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        invoice: true,
      },
    });
    return appointment ? serializeAppointmentWithServices(appointment) : null;
  }

  async createAppointment(tenantId: string, createdById: string, data: any, isPublicBooking: boolean = false) {
    const startTime = new Date(data.startTime);
    const source = data.source as 'ADMIN' | 'PUBLIC' | undefined;

    // Salon membership: created by this salon OR already booked here (global accounts).
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, ...salonClientsFilter(tenantId) },
    });
    if (!client) throw new Error('CLIENT_NOT_FOUND');

    const services = await this.resolveServices(tenantId, data);
    const serviceIds = services.map((service) => service.id);
    const duration = services.reduce((sum, service) => sum + service.duration, 0);
    const endTime = new Date(startTime.getTime() + duration * 60000);
    const primaryService = services[0];

    // Top-level employeeId: legacy field. When data.employeeId is absent (new services[] flow),
    // this stays null — per-service employees are stored on AppointmentServiceItem.employeeId.
    let userIdForAppointment: string | null = null;
    if (data.employeeId) {
      userIdForAppointment = await resolveEmployeeUserId(tenantId, data.employeeId);
      if (!userIdForAppointment) throw new Error('INVALID_EMPLOYEE');
    }

    const validationResult = await validateAppointmentRules({
      tenantId,
      employeeId: userIdForAppointment,
      serviceIds,
      startTime,
      endTime,
      isPublicBooking,
      validateServiceCompatibility: false,
      source,
    });

    if (!validationResult.isValid) throwValidationError(validationResult);

    // Build per-service employee assignment map from data.services if provided
    const serviceEmployeeMap = new Map<string, string | null>();
    if (data.services && Array.isArray(data.services)) {
      for (const item of data.services) {
        if (item.employeeId) {
          const resolved = await resolveEmployeeUserId(tenantId, item.employeeId);
          serviceEmployeeMap.set(item.serviceId, resolved);
        } else {
          serviceEmployeeMap.set(item.serviceId, null);
        }
      }
    }

    // Re-validate final per-service employee assignments before write
    // (race-window safe — validation and write are in the same execution path)
    if (data.services && data.services.length > 0) {
      const dateStr = startTime.toISOString().split('T')[0];
      const timeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
      const assignments = data.services.map((s: any) => ({
        serviceId: s.serviceId,
        employeeId: s.employeeId || null,
      }));
      const validation = await schedulingService.validateAssignment({
        tenantId,
        serviceIds: data.services.map((s: any) => s.serviceId),
        assignments,
        startTime: timeStr,
        date: dateStr,
        source,
      });
      if (!validation.valid) {
        // Admin overrides employee scheduling conflicts, but skill/day mismatches still block
        const err: any = new Error('VALIDATION_ERROR');
        err.details = { status: 409, error: 'Assignment conflict', message: validation.errors[0].message };
        throw err;
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        clientId: data.clientId,
        serviceId: primaryService.id,
        employeeId: userIdForAppointment,
        createdById,
        startTime,
        endTime,
        duration,
        status: data.status || 'CONFIRMED',
        source: isPublicBooking ? 'ONLINE' : 'STAFF',
        notes: stripGeneratedServicesNotes(data.notes),
        services: {
          create: services.map((service, index) => ({
            serviceId: service.id,
            serviceName: service.name,
            duration: service.duration,
            price: getServicePrice(service),
            sortOrder: index,
            employeeId: serviceEmployeeMap.get(service.id) ?? null,
          })),
        },
      },
      include: appointmentListInclude,
    });

    return serializeAppointmentWithServices(appointment);
  }

  /**
   * Cancel every appointment of a booking group and mark the group itself as
   * CANCELLED, so a group cancellation never leaves orphaned appointments.
   * Completed or already-cancelled appointments are left untouched.
   */
  private async cancelBookingGroup(groupId: string, cancelledBy: string, reason: string) {
    await prisma.appointment.updateMany({
      where: {
        bookingGroupId: groupId,
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: reason,
      },
    });
    await prisma.bookingGroup.update({
      where: { id: groupId },
      data: { status: 'CANCELLED' },
    });
  }

  async updateAppointment(tenantIds: string | string[], id: string, data: any, userId?: string) {
    const existing = await prisma.appointment.findFirst({
      where: { id, tenantId: tenantIdFilter(tenantIds) },
    });
    if (!existing) throw new Error('APPOINTMENT_NOT_FOUND');
    const tenantId = existing.tenantId;

    const updateData: any = { ...data };
    // These fields are read above for validation/lookup but must never be written
    // by an update: client and tenant can't change via this endpoint, and `source`
    // is not a column. Passing them to prisma.update breaks with
    // "Unknown argument" on some client versions.
    delete updateData.clientId;
    delete updateData.source;
    delete updateData.tenantId;
    const servicesChanged =
      data.serviceId !== undefined ||
      data.serviceIds !== undefined ||
      data.services !== undefined;
    const nextServices = servicesChanged ? await this.resolveServices(tenantId, data) : null;

    const startTime = data.startTime ? new Date(data.startTime) : existing.startTime;
    const duration = nextServices
      ? nextServices.reduce((sum, service) => sum + service.duration, 0)
      : data.duration ?? existing.duration;
    const endTime = new Date(startTime.getTime() + duration * 60000);
    const nextStatus = data.status ?? existing.status;
    const timeChanged =
      (data.startTime !== undefined &&
        new Date(data.startTime).getTime() !== existing.startTime.getTime()) ||
      (data.duration !== undefined && data.duration !== existing.duration);

    if (data.employeeId !== undefined) {
      if (data.employeeId) {
        const resolvedId = await resolveEmployeeUserId(tenantId, data.employeeId);
        updateData.employeeId = resolvedId;
        if (!resolvedId) throw new Error('INVALID_EMPLOYEE');
      } else {
        updateData.employeeId = null;
      }
    }

    const employeeUserId =
      updateData.employeeId !== undefined ? updateData.employeeId : existing.employeeId;
    const employeeChanged =
      data.employeeId !== undefined && updateData.employeeId !== existing.employeeId;
    const scheduleChanged = timeChanged || servicesChanged || employeeChanged;

    const source = data.source as 'ADMIN' | 'PUBLIC' | undefined;

    if (scheduleChanged && ACTIVE_APPOINTMENT_STATUSES.has(nextStatus)) {
      const validationResult = await validateAppointmentRules({
        tenantId,
        employeeId: employeeUserId,
        serviceIds: nextServices?.map((service) => service.id) ?? [existing.serviceId],
        startTime,
        endTime,
        isPublicBooking: false,
        excludeAppointmentId: id,
        validateServiceCompatibility: employeeChanged || servicesChanged,
        // An employee is only required when the assignment itself is being changed;
        // a pure time move keeps the existing (possibly per-service) employees.
        requireEmployee: employeeChanged || servicesChanged,
        source,
      });

      if (!validationResult.isValid) throwValidationError(validationResult);

      // The rules above only check the legacy top-level employeeId. Multi-service
      // appointments carry their real assignments on AppointmentServiceItem.employeeId,
      // each covering only its own sub-window inside the appointment. Compare exact
      // per-employee windows (chained by service order) on both sides, so a move
      // only conflicts when a window truly collides — never on the total span.
      // (PUBLIC/warning phase only — ADMIN already confirmed the move.)
      if (source !== 'ADMIN') {
        const selfItems = await prisma.appointmentServiceItem.findMany({
          where: { appointmentId: id },
          orderBy: { sortOrder: 'asc' },
          select: { employeeId: true, duration: true },
        });
        const candidates = buildEmployeeWindows(
          existing.employeeId,
          startTime.getTime(),
          existing.duration,
          selfItems,
        );

        if (candidates.size > 0) {
          const others = await prisma.appointment.findMany({
            where: {
              tenantId,
              status: { in: [...ACTIVE_APPOINTMENT_STATUS_LIST] },
              id: { not: id },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
            select: {
              employeeId: true,
              startTime: true,
              duration: true,
              services: {
                orderBy: { sortOrder: 'asc' },
                select: { employeeId: true, duration: true },
              },
            },
          });

          for (const other of others) {
            const occupied = buildEmployeeWindows(
              other.employeeId,
              other.startTime.getTime(),
              other.duration,
              other.services,
            );
            for (const [empId, wins] of candidates) {
              const occ = occupied.get(empId);
              if (!occ) continue;
              for (const w of wins) {
                for (const o of occ) {
                  if (w.start < o.end && w.end > o.start) {
                    throwValidationError({
                      status: 409,
                      error: 'Overlapping appointment',
                      message: 'Ce collaborateur a déjà un rendez-vous sur ce créneau.',
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    updateData.startTime = startTime;
    updateData.duration = duration;
    updateData.endTime = endTime;
    if (data.notes !== undefined) updateData.notes = stripGeneratedServicesNotes(data.notes);
    delete updateData.serviceIds;
    delete updateData.services;

    if (nextServices) {
      // Build per-service employee assignment map from data.services if provided
      const serviceEmployeeMap = new Map<string, string | null>();
      if (data.services && Array.isArray(data.services)) {
        for (const item of data.services) {
          if (item.employeeId) {
            const resolved = await resolveEmployeeUserId(tenantId, item.employeeId);
            serviceEmployeeMap.set(item.serviceId, resolved);
          } else {
            serviceEmployeeMap.set(item.serviceId, null);
          }
        }
      }

      updateData.serviceId = nextServices[0].id;
      updateData.services = {
        deleteMany: {},
        create: nextServices.map((service, index) => ({
          serviceId: service.id,
          serviceName: service.name,
          duration: service.duration,
          price: getServicePrice(service),
          sortOrder: index,
          employeeId: serviceEmployeeMap.get(service.id) ?? null,
        })),
      };
    }

    // Manual cancellation by an admin/staff cancels the whole booking group,
    // not just this appointment — the other participants must not be orphaned.
    if (nextStatus === 'CANCELLED' && existing.bookingGroupId) {
      await this.cancelBookingGroup(
        existing.bookingGroupId,
        userId || existing.createdById,
        'Cancelled by admin'
      );
    }

    // Record who cancelled and when (also for single appointments) so cancelled
    // appointments are traceable and show up in the corbeille (filtered by cancelledAt).
    if (nextStatus === 'CANCELLED') {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = userId || existing.createdById;
      updateData.cancellationReason = data.cancellationReason || 'Cancelled by admin';
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        ...appointmentListInclude,
        tenant: { select: { id: true, name: true } },
      },
    });

    if (data.status === 'CONFIRMED' && existing.status !== 'CONFIRMED') {
      try {
        const tenantSettings = await prisma.tenantSettings.findUnique({
          where: { tenantId },
          select: { timezone: true },
        });
        const timezone = tenantSettings?.timezone || 'Africa/Casablanca';
        const appointmentDate = formatDateForNotification(appointment.startTime.toISOString(), timezone);

        await createNotification({
          data: {
            tenantId,
            userId: null,
            type: 'APPOINTMENT_CONFIRMED',
            title: 'Rendez-vous confirme',
            message: `Votre rendez-vous pour "${appointment.service.name}" le ${appointmentDate} a ete confirme par ${appointment.tenant.name}.`,
            link: null,
            metadata: {
              appointmentId: appointment.id,
              clientId: appointment.clientId,
              tenantId,
            },
          },
        });
      } catch (e) {
        log.error('Error creating appointment confirmation notification:', e);
      }
    }

    return serializeAppointmentWithServices(appointment);
  }

  /**
   * Dry-run validation for a drag-drop move. Checks the new window against
   * client double-bookings, per-employee windows, and tenant business hours
   * WITHOUT writing anything to the database. Returns ALL conflicts so the UI
   * can show a real confirmation dialog (nothing is persisted until the user
   * confirms the move).
   */
  async validateMove(
    tenantIds: string | string[],
    id: string,
    data: { startTime?: string; tenantId?: string },
  ): Promise<{ conflicts: string[] }> {
    if (!data.startTime) throw new Error('INVALID_MOVE_DATA');
    const existing = await prisma.appointment.findFirst({
      where: { id, tenantId: tenantIdFilter(tenantIds) },
      include: {
        services: {
          orderBy: { sortOrder: 'asc' },
          select: { employeeId: true, duration: true },
        },
      },
    });
    if (!existing) throw new Error('APPOINTMENT_NOT_FOUND');
    const tenantId = existing.tenantId;

    const startTime = new Date(data.startTime);
    const duration = existing.duration;
    const endTime = new Date(startTime.getTime() + duration * 60000);
    const conflicts: string[] = [];

    // 1. Tenant business hours + top-level employee rules (working hours,
    // day off, breaks, skill) — reuse the shared validation.
    const rulesResult = await validateAppointmentRules({
      tenantId,
      employeeId: existing.employeeId,
      serviceIds: existing.serviceId ? [existing.serviceId] : [],
      startTime,
      endTime,
      isPublicBooking: false,
      excludeAppointmentId: id,
      validateServiceCompatibility: false,
      requireEmployee: false,
      source: 'PUBLIC',
    });
    if (!rulesResult.isValid && rulesResult.message) {
      conflicts.push(rulesResult.message);
    }

    // 2. Client double-booking: the same client can't be in two places at once.
    if (existing.clientId) {
      const clientOverlap = await prisma.appointment.findFirst({
        where: {
          tenantId,
          clientId: existing.clientId,
          status: { in: [...MOVE_CONFLICT_STATUS_LIST] },
          id: { not: id },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { id: true, startTime: true, endTime: true },
      });
      if (clientOverlap) {
        conflicts.push('Ce client a déjà un rendez-vous sur ce créneau.');
      }
    }

    // 3. Per-employee windows (per-service employees on multi-service
    // appointments) — compare the moved appointment's employee windows against
    // every other active appointment's windows on both sides.
    const candidates = buildEmployeeWindows(
      existing.employeeId,
      startTime.getTime(),
      existing.duration,
      existing.services,
    );

    if (candidates.size > 0) {
      const others = await prisma.appointment.findMany({
        where: {
          tenantId,
          status: { in: [...MOVE_CONFLICT_STATUS_LIST] },
          id: { not: id },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: {
          employeeId: true,
          startTime: true,
          duration: true,
          services: {
            orderBy: { sortOrder: 'asc' },
            select: { employeeId: true, duration: true },
          },
        },
      });

      for (const other of others) {
        const occupied = buildEmployeeWindows(
          other.employeeId,
          other.startTime.getTime(),
          other.duration,
          other.services,
        );
        for (const [empId, wins] of candidates) {
          const occ = occupied.get(empId);
          if (!occ) continue;
          for (const w of wins) {
            for (const o of occ) {
              if (w.start < o.end && w.end > o.start) {
                conflicts.push('Ce collaborateur a déjà un rendez-vous sur ce créneau.');
              }
            }
          }
        }
      }
    }

    // 4. Employee working hours / breaks / day off for EVERY involved employee
    // (top-level AND per-service). The shared validateAppointmentRules only
    // checks the legacy top-level employee and silently swallows working-hours
    // failures for PUBLIC source, so we check each candidate employee window
    // explicitly here too.
    if (candidates.size > 0) {
      const employeeUserIds = [...candidates.keys()];
      const users = await prisma.user.findMany({
        where: { id: { in: employeeUserIds }, tenantId, isActive: true },
        select: { id: true, email: true },
      });
      const emails = users.map((u) => u.email).filter(Boolean) as string[];

      const employeeWhere: any = {
        tenantId,
        isActive: true,
        OR: [{ id: { in: employeeUserIds } }],
      };
      if (emails.length > 0) employeeWhere.OR.push({ email: { in: emails } });

      const employees = await prisma.employee.findMany({
        where: employeeWhere,
        select: { id: true, email: true, workingHours: true },
      });
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
        select: { timezone: true },
      });
      const timeZone = settings?.timezone || 'Africa/Casablanca';

      const employeeById = new Map(employees.map((e) => [e.id, e]));
      const employeeByEmail = new Map(
        employees.filter((e) => e.email).map((e) => [e.email as string, e]),
      );

      for (const userId of employeeUserIds) {
        const user = users.find((u) => u.id === userId);
        const emp =
          employeeById.get(userId) ||
          (user?.email ? employeeByEmail.get(user.email) : undefined);
        if (!emp || !emp.workingHours) continue;
        const whResult = checkEmployeeWorkingHoursAndBreaks({
          workingHours: emp.workingHours as any[],
          startTime,
          endTime,
          timeZone,
        });
        if (!whResult.isAvailable && whResult.message) {
          conflicts.push(whResult.message);
        }
      }
    }

    // Deduplicate identical messages.
    return { conflicts: [...new Set(conflicts)] };
  }

  async deleteAppointment(tenantIds: string | string[], id: string, userId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId: tenantIdFilter(tenantIds) },
    });
    if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND');

    if (appointment.status === 'CANCELLED') {
      await prisma.appointment.delete({ where: { id } });
      return;
    }

    // Manual cancellation by an admin/staff cancels the whole booking group,
    // not just this appointment — the other participants must not be orphaned.
    if (appointment.bookingGroupId) {
      await this.cancelBookingGroup(appointment.bookingGroupId, userId, 'Cancelled by admin');
    }

    await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: 'Cancelled by admin',
      },
    });
  }
}

export const appointmentService = new AppointmentService();
