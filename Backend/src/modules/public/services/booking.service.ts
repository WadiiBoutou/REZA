import { prisma } from '../../../lib/prisma';
import { createNotification } from '../../../utils/notify';
import { sendMail } from '../../../utils/mailer';
import { formatDateForNotification } from '../../../utils/dateTime';
import { validateAppointmentRules, getBusinessHoursForDate } from '../../../utils/schedulingValidation';
import { resolveEmployeeUserId } from '../../../utils/resolveEmployeeUserId';
import { schedulingService } from '../../appointment/scheduling.service';
import { getServicePrice } from '../../../utils/appointmentServiceItems';
import { HttpError } from '../../../lib/errors';
import { createPublicBookingSchema } from '../schemas/public.schema';
import * as log from '../../../utils/logger';
import {
  isSameDay as sharedIsSameDay,
  minutesSinceMidnight,
  overlapsBreak as sharedOverlapsBreak,
  isOccupied as sharedIsOccupied,
  loadFeasibilityContext as sharedLoadFeasibilityContext,
  solveIntervalAssignment,
  ACTIVE_STATUSES,
} from '../../../utils/feasibility';
import type { Service } from '../../../../prisma/generated/prisma/client';
import fs from 'fs';
import path from 'path';

const BOOKING_TRACE = process.env.REZA_BOOKING_TRACE === '1';
const TRACE_FILE = path.join(process.cwd(), 'logs', 'booking-conflict.log');

/** File-appended trace of the cross-participant interval checks (env REZA_BOOKING_TRACE=1). */
function traceBooking(line: string): void {
  if (!BOOKING_TRACE) return;
  try {
    fs.mkdirSync(path.dirname(TRACE_FILE), { recursive: true });
    fs.appendFileSync(TRACE_FILE, `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* trace is best-effort */
  }
}

type FeasibilityContext = {
  tenantId: string;
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    workingHours: unknown;
    agendaSettings: unknown;
    employeeServices: { serviceId: string }[];
  }>;
  skillMap: Map<string, Set<string>>;
  employeeToUserMap: Map<string, string | null>;
  occupiedRanges: Map<string, { start: number; end: number }[]>;
  serviceDurationMap: Map<string, number>;
  dayIndex: number;
  /** Client's own occupied ranges on this day (keyed by clientId). */
  clientOccupiedRanges: { start: number; end: number }[];
};

type ResolvedParticipant = {
  displayName: string;
  appointmentClientId: string;
  linkedClientId: string | null;
  isBooker: boolean;
  serviceIds: string[];
  services: Service[];
  duration: number;
  subtotal: number;
  employeeId: string | null;
  userEmployeeId: string | null;
  startTime: Date;
  endTime: Date;
  /** Per-service employee assignment (when "Même employé" is unchecked). */
  serviceEmployees?: { serviceId: string; employeeId: string | null; userEmployeeId: string | null }[];
};

export class BookingService {
  async createBooking(body: unknown) {
    let parsedSuccess = false;
    try {
      const parsed = createPublicBookingSchema.safeParse(body);
      if (!parsed.success) {
        const zodMsg = parsed.error.errors.map((e) => `${e.path.join('.') || '<root>'}: ${e.message}`).join(' ; ');
        log.error(`[createBooking] ÉCHEC validation Zod: ${zodMsg || (parsed.error.errors[0]?.message ?? 'Invalid booking payload')}`);
        throw new HttpError(400, {
          error: 'Validation error',
          message: zodMsg || parsed.error.errors[0]?.message || 'Invalid booking payload',
        });
      }
      parsedSuccess = true;

      const {
        tenantId,
        firstName,
        lastName,
        email,
        phone,
        serviceIds,
        startTime,
        employeeId: bookerEmployeeId,
        notes,
        includeBooker = true,
        participants: extraParticipants = [],
      } = parsed.data;

      traceBooking(`REQ booker="${firstName} ${lastName}" phone=${phone} email=${email ?? 'N/A'} startTime=${startTime} includeBooker=${includeBooker} participants=${JSON.stringify(extraParticipants)}`);

      log.log(`[Booking] createBooking START: tenant=${tenantId} booker="${firstName} ${lastName}" phone=${phone} email=${email ?? 'N/A'} services=${serviceIds.length} participants=${extraParticipants.length + (includeBooker !== false ? 1 : 0)} start=${startTime}`);

      const tenant = await prisma.tenant.findFirst({
        where: {
          OR: [{ slug: tenantId }, { subdomain: tenantId }, { domain: tenantId }, { id: tenantId }],
          isActive: true,
          subscriptionActive: true,
        },
      });

      if (!tenant) {
        throw new HttpError(404, {
          error: 'Tenant not found',
          message: 'The requested salon or establishment was not found.',
        });
      }

      log.log(`[Booking] Tenant resolved: id=${tenant.id} name=${tenant.name}`);

      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: tenant.id },
      });

      if (settings && settings.onlineReservationEnabled === false) {
        throw new HttpError(403, {
          error: 'Online reservations disabled',
          message: 'This establishment does not accept online reservations.',
        });
      }

      const normalizedEmail = email?.trim() ? email.trim().toLowerCase() : null;

      // Global client lookup: a client account belongs to the platform, not to a
      // salon. Prefer email, then phone — never scope by tenantId (a person who
      // books at several salons must stay ONE row, not one per salon).
      let bookerClient = normalizedEmail
        ? await prisma.client.findFirst({ where: { email: normalizedEmail } })
        : null;
      if (!bookerClient) {
        bookerClient = await prisma.client.findFirst({ where: { phone } });
      }

      if (!bookerClient) {
        bookerClient = await prisma.client.create({
          data: {
            firstName,
            lastName,
            email: normalizedEmail,
            phone,
            status: 'ACTIVE',
          },
        });
      } else {
        // SAFETY: never overwrite an existing client's name with request data.
        // The request's firstName/lastName may come from a guest participant being
        // configured in the group-booking UI rather than the actual booker's identity.
        // Only update email/phone (the lookup fields) if provided.
        bookerClient = await prisma.client.update({
          where: { id: bookerClient.id },
          data: {
            email: normalizedEmail ?? bookerClient.email,
            phone: phone || bookerClient.phone,
          },
        });
      }

      // Per-salon block: the salon may have flagged this client (INACTIVE) to
      // prevent them from booking ONLINE here. This never affects the client's
      // platform account (login, other salons) nor admin-created appointments.
      const block = await prisma.clientBlock.findUnique({
        where: {
          clientId_tenantId: { clientId: bookerClient.id, tenantId: tenant.id },
        },
      });
      if (block) {
        throw new HttpError(403, {
          error: 'Client blocked',
          message:
            "Ce salon ne vous permet pas actuellement de prendre rendez-vous en ligne. Contactez l'établissement pour plus d'informations.",
        });
      }

      log.log(`[Booking] Booker client resolved: id=${bookerClient.id} name=${bookerClient.firstName} ${bookerClient.lastName} phone=${bookerClient.phone}`);

      const loadServices = async (ids: string[]) => {
        const services = await prisma.service.findMany({
          where: {
            id: { in: ids },
            tenantId: tenant.id,
            visibility: { in: ['BOOKABLE', 'VISIBLE'] },
          },
        });
        if (services.length !== ids.length) {
          throw new HttpError(400, {
            error: 'Invalid services',
            message: 'One or more services are not available for booking.',
          });
        }
        // Prisma `in` returns rows in DB order — reorder to the requested order so
        // the cumulative interval chain matches what the frontend computed/shown.
        const byId = new Map(services.map((s) => [s.id, s]));
        return ids
          .map((id) => byId.get(id))
          .filter((s): s is Service => !!s);
      };

      const bookerServices = await loadServices(serviceIds);
      const resolved: ResolvedParticipant[] = [];
      const defaultStart = new Date(startTime);

      const bookerServiceEmployees = parsed.data.serviceEmployees;
      if (includeBooker !== false) {
        const duration = bookerServices.reduce((sum, s) => sum + s.duration, 0);
        const bookerUserEmployeeId = bookerEmployeeId
          ? await resolveEmployeeUserId(tenant.id, bookerEmployeeId)
          : null;

        const resolvedServiceEmployees = bookerServiceEmployees
          ? await Promise.all(
              bookerServiceEmployees.map(async (se) => ({
                serviceId: se.serviceId,
                employeeId: se.employeeId,
                userEmployeeId: se.employeeId
                  ? await resolveEmployeeUserId(tenant.id, se.employeeId)
                  : null,
              })),
            )
          : undefined;

        resolved.push({
          displayName: `${firstName} ${lastName}`.trim(),
          appointmentClientId: bookerClient.id,
          linkedClientId: bookerClient.id,
          isBooker: true,
          serviceIds,
          services: bookerServices,
          duration,
          subtotal: bookerServices.reduce((sum, s) => sum + getServicePrice(s), 0),
          employeeId: bookerEmployeeId || null,
          userEmployeeId: bookerUserEmployeeId,
          startTime: defaultStart,
          endTime: new Date(defaultStart.getTime() + duration * 60000),
          serviceEmployees: resolvedServiceEmployees,
        });
      }

      for (const participant of extraParticipants) {
        const participantServiceIds =
          participant.sameServicesAsBooker || !participant.serviceIds?.length
            ? serviceIds
            : participant.serviceIds;

        const services = await loadServices(participantServiceIds);
        const duration = services.reduce((sum, s) => sum + s.duration, 0);
        let appointmentClientId = bookerClient.id;
        let linkedClientId: string | null = null;

        if (participant.clientId) {
          // A guest participant is by definition a different person than the
          // booker — never honour a link that points back at the booker's own
          // client (e.g. a family-member record whose clientId is the booker's).
          if (participant.clientId !== bookerClient.id) {
            const linkedClient = await prisma.client.findFirst({
              where: { id: participant.clientId },
            });
            if (linkedClient) {
              appointmentClientId = linkedClient.id;
              linkedClientId = linkedClient.id;
            }
          }
        }

        // If no linked client found, create or reuse a lightweight Client for this guest
        if (!linkedClientId) {
          const guestName = (participant.name || '').trim();
          const guestPhone = participant.phone?.trim() || '';
          const guestEmail = participant.email?.trim() || null;

          if (guestName) {
            const nameParts = guestName.split(' ');
            const guestFirstName = nameParts[0] || guestName;
            const guestLastName = nameParts.slice(1).join(' ') || '';

            // Names must match before we reuse an existing client: the same
            // phone is often shared by two different people (e.g. a family
            // member booking with the booker's number). Reusing a client whose
            // name disagrees would merge the guest into someone else's record
            // and make the group billing show the same person twice.
            const guestMatches = (c: { firstName: string | null; lastName: string | null }) => {
              if (!guestFirstName) return true; // no name given — trust phone/email
              const cFirst = (c.firstName || '').trim().toLowerCase();
              const cLast = (c.lastName || '').trim().toLowerCase();
              if (!cFirst && !cLast) return true; // record has no name — trust match
              const gFirst = guestFirstName.toLowerCase();
              const gLast = guestLastName.toLowerCase();
              return (cFirst === gFirst && cLast === gLast) || `${cFirst} ${cLast}`.trim() === `${gFirst} ${gLast}`.trim();
            };
            const isBooker = (c: { id: string }) => c.id === bookerClient.id;

            // 1) Try to reuse an existing client by phone (global — the same
            //    person must map to the same row no matter which salon they book)
            let guestClient = guestPhone
              ? await prisma.client.findFirst({
                  where: { phone: guestPhone },
                })
              : null;
            if (guestClient && (isBooker(guestClient) || !guestMatches(guestClient))) {
              guestClient = null;
            }

            // 2) Try by email if provided
            if (!guestClient && guestEmail) {
              guestClient = await prisma.client.findFirst({
                where: { email: guestEmail.toLowerCase() },
              });
              if (guestClient && (isBooker(guestClient) || !guestMatches(guestClient))) {
                guestClient = null;
              }
            }

            // 3) Try by firstName+lastName (name-based dedup, global) — never
            //    into the booker's own record
            if (!guestClient) {
              guestClient = await prisma.client.findFirst({
                where: {
                  firstName: guestFirstName,
                  lastName: guestLastName,
                },
              });
              if (guestClient && isBooker(guestClient)) {
                guestClient = null;
              }
            }

            if (!guestClient) {
              // Create a new lightweight global client record for this guest
              guestClient = await prisma.client.create({
                data: {
                  firstName: guestFirstName,
                  lastName: guestLastName,
                  phone: guestPhone || '',
                  email: guestEmail?.toLowerCase() || null,
                  status: 'ACTIVE',
                },
              });
            }

            appointmentClientId = guestClient.id;
            linkedClientId = guestClient.id;
          }
        }

        const participantStart = participant.startTime
          ? new Date(participant.startTime)
          : defaultStart;
        const participantEmployeeId = participant.employeeId || null;
        const participantUserEmployeeId = participantEmployeeId
          ? await resolveEmployeeUserId(tenant.id, participantEmployeeId)
          : null;

        const resolvedServiceEmployees = participant.serviceEmployees
          ? await Promise.all(
              participant.serviceEmployees.map(async (se) => ({
                serviceId: se.serviceId,
                employeeId: se.employeeId,
                userEmployeeId: se.employeeId
                  ? await resolveEmployeeUserId(tenant.id, se.employeeId)
                  : null,
              })),
            )
          : undefined;

        resolved.push({
          displayName: participant.name.trim(),
          appointmentClientId,
          linkedClientId,
          isBooker: false,
          serviceIds: participantServiceIds,
          services,
          duration,
          subtotal: services.reduce((sum, s) => sum + getServicePrice(s), 0),
          employeeId: participantEmployeeId,
          userEmployeeId: participantUserEmployeeId,
          startTime: participantStart,
          endTime: new Date(participantStart.getTime() + duration * 60000),
          serviceEmployees: resolvedServiceEmployees,
        });
      }

      log.log(`[Booking] All participants resolved: total=${resolved.length} (booker=${resolved.filter(p => p.isBooker).length}, guests=${resolved.filter(p => !p.isBooker).length})`);

      // Auto-assign + per-participant validation is now done in the interval-walk loop below,
      // correctly handling BOTH per-service (distinct employees) and aggregate (one employee
      // for all services) modes. The legacy per-participant aggregate blocks were moved.

      // ─── Per-interval auto-assign: no solver needed ──────────
      // Each participant is always in per-service mode (sameEmployeeForAll removed).
      // Each participant's serviceEmployees[] is already populated from the frontend.
      // Any service with employeeId=null gets auto-assigned below.

      // ─── Per-interval (per-service) auto-assign remaining gaps, then strict validation ──
      // For every participant, walk the ordered sequence of services with their explicit
      // serviceEmployees[] assignments (per-service mode) or single aggregate employeeId.
      // Any service still having employeeId = null → scheduleService.resolveAnyone(serviceId).
      // Then call validateAppointmentRules ONCE PER SERVICE INTERVAL (not once per participant
      // with all serviceIds — that was incorrectly requiring one employee qualified for ALL
      // services in per-service mode where each svc had a DIFFERENT employee).
      //
      // CROSS-PARTICIPANT CONFLICT TRACKING:
      // localAssignments tracks all employee assignments made within THIS booking request.
      // When auto-assigning or validating, we check both DB appointments AND localAssignments
      // to prevent the same employee from being assigned to overlapping intervals across
      // different participants in the same group booking.
      {
        const bookingDateIso = defaultStart.toISOString().slice(0, 10);
        // Map<employeeId, Array<{start: number, end: number}>> — tracks in-request assignments
        const localAssignments = new Map<string, Array<{ start: number; end: number }>>();

        function localOverlap(empId: string, uid: string | null, startMs: number, endMs: number): boolean {
          const ids = [empId];
          if (uid) ids.push(uid);
          for (const id of ids) {
            const ranges = localAssignments.get(id);
            if (ranges) {
              for (const r of ranges) {
                if (r.start < endMs && r.end > startMs) return true;
              }
            }
          }
          return false;
        }

        // Build employee name map for clear conflict error messages
        const allEmpIds = [...new Set(resolved.flatMap((r: any) =>
          (r.serviceEmployees || []).map((se: any) => se.employeeId).filter(Boolean)
        ))];
        const empRecords = allEmpIds.length > 0
          ? await prisma.employee.findMany({ where: { id: { in: allEmpIds } }, select: { id: true, firstName: true, lastName: true } })
          : [];
        const employeeNameMap = new Map(empRecords.map((e: any) => [e.id, `${e.firstName} ${e.lastName}`.trim()]));

        for (const p of resolved) {
          // Normalize / guarantee serviceEmployees[] presence with correct per-svc entries.
          if (!p.serviceEmployees || p.serviceEmployees.length === 0) {
            // Legacy aggregate mode → replicate employeeId to all services.
            // Then validateAppointmentRules below will treat as distinct intervals, same emp.
            p.serviceEmployees = p.services.map((s) => ({
              serviceId: s.id,
              employeeId: p.employeeId ?? null,
              userEmployeeId: p.userEmployeeId ?? null,
            }));
          }

            // Walk services in order tracking cumulative startTime minutes from p.startTime.
          let intervalCursor = new Date(p.startTime.getTime());
          traceBooking(`WALK participant="${p.displayName}" rawStart="${p.startTime.toISOString()}" ms=${p.startTime.getTime()} services=${p.services.map((s: any) => `${s.name}(${s.duration}min)`).join(',')}`);
          for (let si = 0; si < p.services.length; si++) {
            const svc = p.services[si];
            const intervalStart = new Date(intervalCursor.getTime());
            const intervalEnd = new Date(intervalStart.getTime() + svc.duration * 60000);
            const existingIdx = p.serviceEmployees.findIndex((se) => se.serviceId === svc.id);
            let se = existingIdx >= 0 ? p.serviceEmployees[existingIdx] : undefined;
            if (!se) {
              se = { serviceId: svc.id, employeeId: null, userEmployeeId: null };
              p.serviceEmployees.push(se);
            }
            traceBooking(`  INTERVAL svc="${svc.name}" [${intervalStart.toISOString()} → ${intervalEnd.toISOString()}] (${intervalStart.getTime()}..${intervalEnd.getTime()}) se.employeeId=${se.employeeId ?? 'null'}`);

            const pTime = `${String(intervalStart.getHours()).padStart(2, '0')}:${String(intervalStart.getMinutes()).padStart(2, '0')}`;

            if (se.employeeId) {
              // CLIENT EXPLICITLY CHOSE AN EMPLOYEE → validate, never silently reassign
              const conflictRange = (() => {
                const ids = [se.employeeId];
                if (se.userEmployeeId) ids.push(se.userEmployeeId);
                for (const id of ids) {
                  const ranges = localAssignments.get(id);
                  if (ranges) {
                    for (const r of ranges) {
                      if (r.start < intervalEnd.getTime() && r.end > intervalStart.getTime()) return { id, r };
                    }
                  }
                }
                return null;
              })();
              if (conflictRange) {
                traceBooking(`  ✗ CONFLICT participant="${p.displayName}" svc="${svc.name}" interval=[${intervalStart.toISOString()} → ${intervalEnd.toISOString()}] overlapped by localAssignment emp=${conflictRange.id} range=[${new Date(conflictRange.r.start).toISOString()} → ${new Date(conflictRange.r.end).toISOString()}] (${conflictRange.r.start}..${conflictRange.r.end}) check: ${conflictRange.r.start} < ${intervalEnd.getTime()} && ${conflictRange.r.end} > ${intervalStart.getTime()}`);
                const empName = employeeNameMap.get(se.employeeId) || se.employeeId;
                const prefix = p.isBooker ? '' : `Pour ${p.displayName} : `;
                throw new HttpError(409, {
                  error: 'Employee conflict',
                  message: `${prefix}${empName} n'est pas disponible pour ${svc.name} à ${pTime} — déjà réservé sur cet intervalle.`,
                });
              }
            } else {
              // Sans préférence → auto-assign via resolveAnyone
              const excludeIds: string[] = [];
              for (const [empId, ranges] of localAssignments) {
                for (const r of ranges) {
                  if (r.start < intervalEnd.getTime() && r.end > intervalStart.getTime()) {
                    excludeIds.push(empId);
                    break;
                  }
                }
              }

              const assigned = await schedulingService.resolveAnyone({
                tenantId: tenant.id,
                serviceIds: [svc.id],
                date: bookingDateIso,
                startTime: pTime,
                excludeEmployeeIds: excludeIds,
              });
              if (!assigned.employeeId) {
                const prefix = p.isBooker ? '' : `Pour ${p.displayName} : `;
                throw new HttpError(409, {
                  error: 'No available employee',
                  message: `${prefix}Aucun professionnel disponible pour ${svc.name} à ${pTime}.`,
                });
              }

              // Check if the auto-assigned employee conflicts with another participant
              if (localOverlap(assigned.employeeId, assigned.userEmployeeId, intervalStart.getTime(), intervalEnd.getTime())) {
                const prefix = p.isBooker ? '' : `Pour ${p.displayName} : `;
                throw new HttpError(409, {
                  error: 'Employee conflict',
                  message: `${prefix}Le professionnel assigné à ${svc.name} à ${pTime} est déjà occupé sur cet intervalle dans cette réservation.`,
                });
              }

              se.employeeId = assigned.employeeId;
              se.userEmployeeId = assigned.userEmployeeId;
              if (p.employeeId == null) {
                p.employeeId = se.employeeId;
                p.userEmployeeId = se.userEmployeeId;
              } else if (p.employeeId !== se.employeeId) {
                p.employeeId = null;
                p.userEmployeeId = null;
              }
            }

            // Record this assignment in local tracking to catch cross-participant conflicts
            const empId = se.employeeId!;
            const uid = se.userEmployeeId;
            if (!localAssignments.has(empId)) localAssignments.set(empId, []);
            localAssignments.get(empId)!.push({ start: intervalStart.getTime(), end: intervalEnd.getTime() });
            if (uid && uid !== empId) {
              if (!localAssignments.has(uid)) localAssignments.set(uid, []);
              localAssignments.get(uid)!.push({ start: intervalStart.getTime(), end: intervalEnd.getTime() });
            }
            traceBooking(`  ✓ RECORDED emp=${empId} interval=[${new Date(intervalStart.getTime()).toISOString()} → ${new Date(intervalEnd.getTime()).toISOString()}] (${intervalStart.getTime()}..${intervalEnd.getTime()}) for participant="${p.displayName}" svc="${svc.name}"`);

            // Validate this interval: employee works during intervalStart..intervalEnd,
            // is qualified for this svc, no overlapping existing appointment.
            const vr = await validateAppointmentRules({
              tenantId: tenant.id,
              employeeId: se.userEmployeeId,
              serviceIds: [svc.id],
              startTime: intervalStart,
              endTime: intervalEnd,
              isPublicBooking: true,
            });
            if (!vr.isValid) {
              throw new HttpError(vr.status || 400, {
                error: vr.error || 'Overlapping appointment',
                message: p.isBooker
                  ? `(${svc.name}) ${vr.message}`
                  : `Pour ${p.displayName} — (${svc.name}) ${vr.message}`,
              });
            }
            intervalCursor = intervalEnd;
          }
          // p.endTime was already set to sum of all durations during the resolved[] build.
          // Clamp / sanity check: cursor at end of last service must match p.endTime (±ms).
          // (If a service item has a different duration than the aggregate reduced sum, we
          //  prefer the per-service sum since that's what validateAppointmentRules scanned.)
          p.endTime = new Date(intervalCursor.getTime());
        }
      }
      // Run the same feasibility check that was used to show the slot as available.
      // Another client may have booked this slot in the meantime.
      // Split participants into same-time groups based on their startTime:
      // the isFeasible solver checks cross-interval conflicts within each group,
      // but participants at different times are non-overlapping so don't conflict.
      // This re-validation catches race conditions where a slot was available
      // when shown but booked by another client milliseconds before this request.
      for (const rp of resolved) {
        const svcs = rp.serviceEmployees.map(se => {
          const svcObj = rp.services.find((s: any) => s.id === se.serviceId);
          return `${svcObj?.name || se.serviceId}→emp=${se.employeeId || 'null'}`;
        }).join(', ');
        log.log(`[Feasibility] RESOLVED participant: ${rp.displayName} start=${rp.startTime.toISOString()} svcs=[${svcs}]`);
      }
      const timeGroups = new Map<string, Array<{ serviceIds: string[]; startTime: string }>>();
      for (const p of resolved) {
        const key = p.startTime.getTime().toString();
        if (!timeGroups.has(key)) timeGroups.set(key, []);
        timeGroups.get(key)!.push({
          serviceIds: p.serviceIds,
          startTime: `${String(p.startTime.getHours()).padStart(2, '0')}:${String(p.startTime.getMinutes()).padStart(2, '0')}`,
        });
      }

      for (const [, group] of timeGroups) {
        log.log('[Feasibility] BOOKING-CREATION re-validation: participants=' + group.length +
          ' date=' + defaultStart.toISOString().slice(0, 10) +
          ' startTime=' + group[0].startTime +
          ' clientId=' + (bookerClient.id || 'none') +
          ' services=' + group.map(g => g.serviceIds.join('+')).join(','));
        const fResult = await this.isFeasible(tenant.id, defaultStart.toISOString().slice(0, 10), group, undefined, bookerClient.id);
        log.log('[Feasibility] BOOKING-CREATION re-validation: ' +
          (fResult.feasible ? 'FEASIBLE — proceeding' : 'INFEASIBLE — rejecting'));
        if (!fResult.feasible) {
          throw new HttpError(409, {
            error: 'Slot no longer available',
            message: 'Ce créneau n\'est plus disponible. Veuillez choisir un autre horaire.',
            details: 'La vérification de disponibilité a échoué au moment de la réservation. Consultez les logs serveur pour plus de détails.',
          });
        }
      }

      if (resolved.length === 0) {
        throw new HttpError(400, {
          error: 'No participants',
          message:
            'Sélectionnez au moins une personne (vous ou un proche / invité) pour la réservation.',
        });
      }

      // Note: per-interval (per-service) employee validation (working hours,
      //       service qualification, overlap, public-booking constraints) has already
      //       been run per service interval in the loop above using serviceEmployees[]
      //       data. Do NOT re-run per-participant aggregate validation here because
      //       participants in distinct-per-service mode will have userEmployeeId=null
      //       and a single aggregate check against ALL serviceIds would incorrectly
      //       require one employee qualified for everything.

      let systemUser = await prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          isActive: true,
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        },
      });

      if (!systemUser) {
        systemUser = await prisma.user.findFirst({
          where: {
            tenantId: tenant.id,
            isActive: true,
          },
        });
      }

      if (!systemUser) {
        throw new HttpError(500, {
          error: 'System error',
          message: 'No admin user found for this tenant.',
        });
      }

      const grandTotal = resolved.reduce((sum, p) => sum + p.subtotal, 0);
      const pricingSummary = resolved.map((p) => ({
        displayName: p.displayName,
        isBooker: p.isBooker,
        serviceIds: p.serviceIds,
        // Per-participant service snapshot — lets the receipt render each
        // client's own services, timing and price (mirrors the web receipt).
        services: p.services.map((s: any) => ({
          id: s.id,
          name: s.name,
          duration: s.duration ?? 0,
          price: Math.round(getServicePrice(s) * 100) / 100,
        })),
        duration: p.duration,
        subtotal: Math.round(p.subtotal * 100) / 100,
        employeeId: p.employeeId,
        startTime: p.startTime.toISOString(),
      }));

      const bookingGroup = await prisma.bookingGroup.create({
        data: {
          tenantId: tenant.id,
          bookerClientId: bookerClient.id,
          bookerFirstName: firstName,
          bookerLastName: lastName,
          bookerPhone: phone,
          bookerEmail: normalizedEmail,
          startTime: defaultStart,
          status: 'PENDING',
          grandTotal: Math.round(grandTotal * 100) / 100,
          pricingSummary,
        },
      });

      log.log(`[Booking] BookingGroup created: id=${bookingGroup.id} grandTotal=${grandTotal}`);

      const appointments = [];

      for (const participant of resolved) {
        let appointmentNotes = notes?.trim() || '';

        if (!participant.isBooker) {
          const bookerName = `${firstName} ${lastName}`.trim();
          appointmentNotes = appointmentNotes
            ? `Réservation prise par ${bookerName}\n${appointmentNotes}`
            : `Réservation prise par ${bookerName}`;
        }

        // Build per-service employee map if provided
        const serviceEmpMap = new Map<string, string | null>();
        if (participant.serviceEmployees) {
          for (const se of participant.serviceEmployees) {
            serviceEmpMap.set(se.serviceId, se.userEmployeeId);
          }
        }

        const appointment = await prisma.appointment.create({
          data: {
            tenantId: tenant.id,
            clientId: participant.appointmentClientId,
            serviceId: participant.services[0].id,
            employeeId: participant.serviceEmployees ? null : participant.userEmployeeId,
            createdById: systemUser.id,
            source: 'ONLINE',
            startTime: participant.startTime,
            endTime: participant.endTime,
            duration: participant.duration,
            status: 'PENDING',
            notes: appointmentNotes || null,
            bookingGroupId: bookingGroup.id,
            services: {
              create: participant.services.map((service, index) => ({
                serviceId: service.id,
                serviceName: service.name,
                duration: service.duration,
                price: getServicePrice(service),
                employeeId: participant.serviceEmployees
                  ? (serviceEmpMap.get(service.id) ?? participant.userEmployeeId)
                  : participant.userEmployeeId,
                sortOrder: index,
              })),
            },
          },
          include: {
            client: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            },
            service: {
              select: { id: true, name: true, duration: true, price: true },
            },
          },
        });

        await prisma.bookingParticipant.create({
          data: {
            bookingGroupId: bookingGroup.id,
            displayName: participant.displayName,
            clientId: participant.linkedClientId,
            isBooker: participant.isBooker,
            serviceIds: participant.serviceIds,
            durationMinutes: participant.duration,
            subtotal: Math.round(participant.subtotal * 100) / 100,
            appointmentId: appointment.id,
          },
        });

        appointments.push(appointment);
      }

      log.log(`[Booking] All appointments created: ${appointments.length} for group ${bookingGroup.id}`);

      const tenantSettingsForNotif = await prisma.tenantSettings.findUnique({
        where: { tenantId: tenant.id },
        select: { timezone: true },
      });
      const timezone = tenantSettingsForNotif?.timezone || 'Africa/Casablanca';
      const appointmentDate = formatDateForNotification(defaultStart.toISOString(), timezone);
      const participantCount = resolved.length;

      // ---- Email notification to the salon's configured RDV emails ----
      try {
        const notifSettings = await prisma.tenantSettings.findUnique({
          where: { tenantId: tenant.id },
          select: { emailNotifications: true },
        });
        const appointmentEmails =
          ((notifSettings?.emailNotifications as any)?.appointmentEmails as string[]) || [];
        if (appointmentEmails.length > 0) {
          const clientName = `${firstName} ${lastName}`.trim();
          const serviceNames = resolved
            .map((p) => p.services.map((s: any) => s.name).join(', '))
            .filter(Boolean);
          await sendMail({
            to: appointmentEmails,
            subject: `Nouveau rendez-vous — ${tenant.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #002366;">Nouveau rendez-vous pris en ligne</h2>
                <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                  <tr><td style="padding: 6px 0; color: #666;">Client</td><td style="padding: 6px 0; font-weight: bold;">${clientName}</td></tr>
                  <tr><td style="padding: 6px 0; color: #666;">Service(s)</td><td style="padding: 6px 0; font-weight: bold;">${serviceNames.join('<br/>')}</td></tr>
                  <tr><td style="padding: 6px 0; color: #666;">Date</td><td style="padding: 6px 0; font-weight: bold;">${appointmentDate}</td></tr>
                  <tr><td style="padding: 6px 0; color: #666;">Participant(s)</td><td style="padding: 6px 0; font-weight: bold;">${participantCount}</td></tr>
                  <tr><td style="padding: 6px 0; color: #666;">Téléphone</td><td style="padding: 6px 0; font-weight: bold;">${phone || '—'}</td></tr>
                </table>
                <p style="font-size: 13px; color: #666;">Connectez-vous à votre tableau de bord Reza Pro pour confirmer ou gérer ce rendez-vous.</p>
              </div>
            `,
          });
        }
      } catch (emailError: any) {
        log.error('[Booking] RDV notification email failed:', emailError?.message || emailError);
      }


      try {
        const tenantUsers = await prisma.user.findMany({
          where: {
            tenantId: tenant.id,
            isActive: true,
            role: { in: ['ADMIN', 'SUPER_ADMIN', 'STAFF', 'RECEPTIONIST'] },
          },
          select: { id: true },
        });

        const message =
          participantCount > 1
            ? `${firstName} ${lastName} a réservé pour ${participantCount} personnes le ${appointmentDate}.`
            : `${firstName} ${lastName} a réservé "${appointments[0].service.name}" le ${appointmentDate}.`;

        if (tenantUsers.length > 0) {
          await Promise.all(
            tenantUsers.map((user) =>
              createNotification({
                data: {
                  tenantId: tenant.id,
                  userId: user.id,
                  type: 'APPOINTMENT_NEW',
                  title: 'Nouveau rendez-vous en ligne',
                  message,
                  link: `/dashboard/rendez-vous`,
                  metadata: {
                    bookingGroupId: bookingGroup.id,
                    appointmentIds: appointments.map((a) => a.id),
                    clientId: bookerClient.id,
                    tenantId: tenant.id,
                  },
                },
              })
            )
          );
        }
      } catch (notificationError) {
        log.error('Error creating notification for new booking:', notificationError);
      }

      // ---- Auto-confirm logic ----
      const tenantAutoConfirm = settings?.emailNotifications as any;
      const globalAutoConfirm = tenantAutoConfirm?.autoConfirm === true;
      try {
        if (globalAutoConfirm) {
          for (const appointment of appointments) {
            // Check per-client override
            let shouldAutoConfirm = true;
            const participant = resolved.find((p) => p.appointmentClientId === appointment.clientId);
            if (participant) {
              const clientRec = await prisma.client.findUnique({
                where: { id: participant.appointmentClientId },
                select: { notes: true },
              });
              // Per-client override stored in notes as __ACO:MANUAL or __ACO:AUTO
              const clientNotes = clientRec?.notes || '';
              const acoMatch = clientNotes.match(/__ACO:(AUTO|MANUAL)/);
              if (acoMatch) {
                shouldAutoConfirm = acoMatch[1] === 'AUTO';
              }
            }

            if (shouldAutoConfirm) {
              await prisma.appointment.update({
                where: { id: appointment.id },
                data: { status: 'CONFIRMED' },
              });

              // Create confirmation notification for tenant
              const tenantUsers = await prisma.user.findMany({
                where: { tenantId: tenant.id, isActive: true },
                select: { id: true },
              });
              await Promise.all(
                tenantUsers.map((u) =>
                  createNotification({
                    data: {
                      tenantId: tenant.id,
                      userId: u.id,
                      type: 'APPOINTMENT_CONFIRMED',
                      title: 'Rendez-vous confirmé automatiquement',
                      message: `Le rendez-vous de ${appointment.client?.firstName || firstName} ${appointment.client?.lastName || lastName} a été automatiquement confirmé.`,
                      link: `/dashboard/rendez-vous`,
                      metadata: { appointmentId: appointment.id, tenantId: tenant.id },
                    },
                  }).catch(() => {})
                )
              );
            }
          }
        }
      } catch (autoConfirmError) {
        log.error('[Auto-Confirm] Error:', autoConfirmError);
      }

      const messageText = globalAutoConfirm
        ? 'Réservation créée et confirmée avec succès.'
        : 'Réservation créée avec succès. Elle apparaîtra dans le calendrier du salon et sera confirmée par l\'établissement.';

      log.log(`[Booking] createBooking SUCCESS: group=${bookingGroup.id} appointments=${appointments.length} autoConfirm=${globalAutoConfirm}`);

      return {
        bookingGroup,
        appointments,
        client: bookerClient,
        pricing: {
          participants: pricingSummary,
          grandTotal: Math.round(grandTotal * 100) / 100,
        },
        message: messageText,
      };
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        const payloadAny = (error as any).payload as Record<string, unknown> | undefined;
        const status = (error as any).status as number;
        const errId = payloadAny?.error as string | undefined;
        const errMsg = payloadAny?.message as string | undefined;
        log.error(
          `[createBooking] ÉCHEC (${status}) [${errId ?? 'unknown'}] ${errMsg ?? ''}${parsedSuccess ? '' : ' (Zod pré-val)'}`,
        );
      } else {
        log.error('[Public Booking] Unexpected error:', error);
      }
      throw error;
    }
  }

  async getAvailableSlots(tenantId: string, query: Record<string, unknown>) {
    const { date, serviceIds, employeeId, participants, existingParticipants, clientId: rawClientId, clientPhone, clientEmail } = query;

    // Resolve clientId: use explicit clientId if provided, otherwise look up by phone/email.
    // This ensures the client-conflict check works even when the caller doesn't have the
    // clientId directly (e.g. mobile non-logged-in flow sends phone/email instead).
    let clientId = rawClientId as string | undefined;
    if (!clientId && (clientPhone || clientEmail)) {
      const whereClause: any = {};
      if (clientPhone) whereClause.phone = clientPhone as string;
      if (clientEmail) whereClause.email = (clientEmail as string).trim().toLowerCase();
      const resolvedClient = await prisma.client.findFirst({ where: whereClause, select: { id: true } });
      if (resolvedClient) clientId = resolvedClient.id;
    }

    if (!date) {
      throw new HttpError(400, {
        error: 'Date required',
        message: 'Date parameter is required (YYYY-MM-DD)'
      });
    }

    const serviceIdsArray = Array.isArray(serviceIds) 
      ? serviceIds as string[]
      : typeof serviceIds === 'string'
        ? serviceIds.split(',').filter(Boolean)
        : [];

    // Parse participants if provided (JSON string or array from query/POST body)
    const participantList: Array<{ serviceIds: string[]; startTime: string }> =
      participants
        ? typeof participants === 'string'
          ? JSON.parse(participants)
          : (participants as any[])
        : [];

    // Normalize: if no participants explicitly provided, treat as a single-participant (booker) request
    const hasExplicitParticipants = participantList.length > 0;

    // Parse existing participants (already-confirmed group members) to treat their
    // locked employees as busy during their intervals. These are NOT persisted in DB
    // yet — they are virtual constraints from the in-progress group booking session.
    const existingParticipantsList: Array<{
      serviceIds: string[];
      startTime: string;
      duration: number;
      serviceEmployees: Array<{ serviceId: string; employeeId: string | null }>;
    }> = existingParticipants
      ? typeof existingParticipants === 'string'
        ? JSON.parse(existingParticipants)
        : (existingParticipants as any[])
      : [];

    if (existingParticipantsList.length > 0) {
      log.log('[Feasibility] RAW existingParticipants: ' + JSON.stringify(existingParticipantsList));
    }

    // Parse the current participant's explicit employee selections (from per-service step).
    // These are the client's EXPLICIT choices ("Sans préférence" entries with null employeeId
    // are included so we know which services still need auto-assignment).
    const currentServiceEmployees: Array<{ serviceId: string; employeeId: string | null }> | undefined =
      query.serviceEmployees
        ? typeof query.serviceEmployees === 'string'
          ? JSON.parse(query.serviceEmployees)
          : (query.serviceEmployees as any[])
        : undefined;

    // Verify tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantId }, { subdomain: tenantId },
          { domain: tenantId },
          { id: tenantId }
        ],
        isActive: true
      },
      include: {
        settings: true
      }
    });

    if (!tenant) {
      throw new HttpError(404, {
        error: 'Tenant not found'
      });
    }

    // Get services and calculate total duration (for single-participant lead-time check)
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIdsArray }, tenantId: tenant.id },
    });
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0) || 60;

    const businessHours = tenant.settings?.businessHours as any || {};
    
    // Check blocked dates
    const blockedDates: string[] = businessHours.blockedDates || [];
    const dateStr = date as string;
    if (blockedDates.includes(dateStr)) {
      return { slots: [] }; // Blocked/closed on this day
    }

    // Resolve the day's REAL opening hours from the stored schedule. Supports the
    // current `schedules[]` format (French day names, what the Pro dashboard saves)
    // and the legacy day-keyed format. NO default fallback: a salon that didn't
    // configure hours gets no slots rather than fake 09:00-18:00 ones that
    // contradict the hours shown on its public page.
    const selectedDate = new Date(dateStr);
    const hours = getBusinessHoursForDate(businessHours, selectedDate);

    if (!hours) {
      return { slots: [] }; // Closed on this day
    }

    // Minimum booking lead time check: skip past dates and dates within lead time window
    const bookingDelay = businessHours.bookingDelay || null;

    // Generate available slots — each slot is validated against the scheduling engine
    const slots: string[] = [];
    const [openHour, openMin] = hours.open.split(':').map(Number);
    const [closeHour, closeMin] = hours.close.split(':').map(Number);
    
    const openTime = new Date(selectedDate);
    openTime.setHours(openHour, openMin, 0, 0);
    
    const closeTime = new Date(selectedDate);
    closeTime.setHours(closeHour, closeMin, 0, 0);

    // Check if selected date is within lead time window
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const isToday = today.getTime() === selectedDay.getTime();

    // Calculate minimum bookable time based on lead time (must match createBooking logic)
    let minStartTime: Date | null = null;
    if (bookingDelay && bookingDelay.value && bookingDelay.unit && !bookingDelay.allowLastMoment) {
      minStartTime = new Date(now);
      if (bookingDelay.unit === 'heures') {
        minStartTime.setHours(minStartTime.getHours() + parseInt(bookingDelay.value));
      } else if (bookingDelay.unit === 'jours') {
        minStartTime.setDate(minStartTime.getDate() + parseInt(bookingDelay.value));
      } else if (bookingDelay.unit === 'semaines') {
        minStartTime.setDate(minStartTime.getDate() + parseInt(bookingDelay.value) * 7);
      }
    }
    // Quick date-level bail: if the entire selected day is before the lead time, skip it
    if (minStartTime) {
      const minLeadDay = new Date(minStartTime.getFullYear(), minStartTime.getMonth(), minStartTime.getDate());
      if (selectedDay.getTime() < minLeadDay.getTime()) {
        return { slots: [] };
      }
    }

    // Pre-load feasibility data once for the entire day so each slot check
    // reuses the same employee/user/appointment/service data instead of
    // running 5 independent DB queries per candidate slot.
    // Collect all service IDs referenced across any participant for the duration-map.
    const allSvcIds = hasExplicitParticipants
      ? [...new Set(participantList.flatMap((p: any) => p.serviceIds))]
      : serviceIdsArray;
    const feasibilityCtx = await this.loadFeasibilityContext(tenant.id, dateStr, allSvcIds, clientId as string | undefined);

    log.log('[Feasibility] Computing slots for ' + dateStr + ' | services=' + serviceIdsArray.join(',') + ' | existingParticipants=' + existingParticipantsList.length + ' | clientId=' + (clientId || 'none'));

    // Inject virtual occupied ranges from existing participants (in-progress group session).
    // These participants are NOT in the database yet, but their locked employee assignments
    // must block those employees for overlapping intervals.
    // When employeeId is null ("Sans préférence"), simulate auto-assignment via resolveAnyone
    // to find which employee the backend would assign and block that employee.
    const autoAssignedByEP = new Map<string, string[]>(); // empId -> [svcIds] tracked per EP for logging
    for (const ep of existingParticipantsList) {
      log.log('[Feasibility] ' + dateStr + ' EP: startTime=' + ep.startTime + ' serviceIds=' + JSON.stringify(ep.serviceIds) + ' serviceEmployees=' + JSON.stringify(ep.serviceEmployees));
      // Parse startTime — could be "HH:MM" or ISO "YYYY-MM-DDTHH:MM:SS"
      let h = 0, m = 0;
      if (ep.startTime && ep.startTime.includes('T')) {
        const timePart = ep.startTime.split('T')[1]; // "11:15:00"
        [h, m] = timePart.split(':').map(Number);
      } else if (ep.startTime) {
        [h, m] = ep.startTime.split(':').map(Number);
      }
      if (isNaN(h) || isNaN(m)) {
        log.log('[Feasibility] ' + dateStr + ' EP SKIP — invalid startTime format: ' + ep.startTime);
        continue;
      }
      let cursor = h * 60 + m;
      const excludeIds: string[] = []; // track auto-assigned employees within this EP to avoid double-assignment
      for (let si = 0; si < ep.serviceIds.length; si++) {
        const svcId = ep.serviceIds[si];
        const empEntry = ep.serviceEmployees?.find((se: any) => se.serviceId === svcId);
        const empId = empEntry?.employeeId;
        // Use service duration from the context's duration map
        const dur = feasibilityCtx.serviceDurationMap.get(svcId) || 30;
        const sMin = cursor;
        const eMin = cursor + dur;
        log.log('[Feasibility] ' + dateStr + ' EP svc=' + svcId + ' empEntry=' + JSON.stringify(empEntry) + ' empId=' + empId + ' range=' + sMin + '-' + eMin);

        let resolvedEmpId = empId;
        let resolvedUserEmpId: string | null = null;

        if (!resolvedEmpId) {
          // "Sans préférence" — simulate auto-assignment to find who would be assigned
          const timeStr = `${String(Math.floor(sMin / 60)).padStart(2, '0')}:${String(sMin % 60).padStart(2, '0')}`;
          try {
            const resolved = await schedulingService.resolveAnyone({
              tenantId: feasibilityCtx.tenantId,
              serviceIds: [svcId],
              date: dateStr,
              startTime: timeStr,
              excludeEmployeeIds: excludeIds,
            });
            if (resolved.employeeId) {
              resolvedEmpId = resolved.employeeId;
              resolvedUserEmpId = resolved.userEmployeeId;
              log.log('[Feasibility] ' + dateStr + ' EP AUTO-RESOLVED svc=' + svcId + ' -> emp=' + resolvedEmpId + ' userEmp=' + resolvedUserEmpId + ' range=' + sMin + '-' + eMin);
            } else {
              log.log('[Feasibility] ' + dateStr + ' EP AUTO-RESOLVE FAILED svc=' + svcId + ' no employee available');
            }
          } catch (err) {
            log.log('[Feasibility] ' + dateStr + ' EP AUTO-RESOLVE ERROR svc=' + svcId + ': ' + (err as Error).message);
          }
        }

        if (resolvedEmpId) {
          if (!feasibilityCtx.occupiedRanges.has(resolvedEmpId)) {
            feasibilityCtx.occupiedRanges.set(resolvedEmpId, []);
          }
          feasibilityCtx.occupiedRanges.get(resolvedEmpId)!.push({ start: sMin, end: eMin });
          excludeIds.push(resolvedEmpId);
          // Also track the user employee ID if different
          if (resolvedUserEmpId && resolvedUserEmpId !== resolvedEmpId) {
            if (!feasibilityCtx.occupiedRanges.has(resolvedUserEmpId)) {
              feasibilityCtx.occupiedRanges.set(resolvedUserEmpId, []);
            }
            feasibilityCtx.occupiedRanges.get(resolvedUserEmpId)!.push({ start: sMin, end: eMin });
          }
          if (!autoAssignedByEP.has(resolvedEmpId)) autoAssignedByEP.set(resolvedEmpId, []);
          autoAssignedByEP.get(resolvedEmpId)!.push(svcId);
        }
        cursor = eMin;
      }
    }

    if (existingParticipantsList.length > 0) {
      const virtualCount = Array.from(feasibilityCtx.occupiedRanges.values()).reduce((sum, r) => sum + r.length, 0);
      log.log('[Feasibility] ' + dateStr + ' Injected ' + virtualCount + ' virtual occupied ranges from ' + existingParticipantsList.length + ' existing participants' +
        (autoAssignedByEP.size > 0 ? ' (auto-resolved: ' + Array.from(autoAssignedByEP.entries()).map(([eid, svcs]) => eid + '=[' + svcs.join(',') + ']').join(', ') + ')' : ''));
    }

    // Generate 30-minute slots
    const slotDuration = 30; // minutes
    let currentTime = new Date(openTime);
    
    while (currentTime.getTime() + totalDuration * 60000 <= closeTime.getTime()) {
      // Filter out past time slots and slots within lead time window
      if (currentTime.getTime() <= now.getTime() || (minStartTime && currentTime.getTime() < minStartTime.getTime())) {
        currentTime = new Date(currentTime.getTime() + slotDuration * 60000);
        continue;
      }

      const timeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;

      // Unified feasibility check: ALL paths (single-participant, group, POST)
      // use the same sequential-chain isFeasible() solver.
      const participantsForSlot = hasExplicitParticipants
        ? participantList.map((p) => ({
            serviceIds: p.serviceIds,
            startTime: p.startTime || timeStr,
          }))
        : [{ serviceIds: serviceIdsArray, startTime: timeStr, serviceEmployees: currentServiceEmployees }];
      const { feasible } = await this.isFeasible(tenant.id, dateStr, participantsForSlot, feasibilityCtx, clientId as string | undefined);

      if (!feasible) {
        log.log('[Feasibility] ' + dateStr + ' Slot ' + timeStr + ' -> UNAVAILABLE');
      }

      if (feasible) {
        slots.push(timeStr);
      }

      currentTime = new Date(currentTime.getTime() + slotDuration * 60000);
    }

    // ── DYNAMIC BOUNDARY SLOTS ──────────────────────────────────
    // After the standard 30-min grid, inject exact boundary times where
    // a busy period ends between two grid points. This lets clients
    // book the exact moment a previous appointment finishes (e.g. 9:35)
    // instead of losing the window until the next grid point (10:00).
    const boundaryMinutes = new Set<number>();
    for (const [, ranges] of feasibilityCtx.occupiedRanges) {
      for (const r of ranges) {
        // Only consider end times that fall strictly between grid points
        if (r.end % slotDuration !== 0) {
          boundaryMinutes.add(r.end);
        }
      }
    }
    // Also check client occupied ranges for boundary slots
    for (const r of feasibilityCtx.clientOccupiedRanges) {
      if (r.end % slotDuration !== 0) {
        boundaryMinutes.add(r.end);
      }
    }

    const slotTimeSet = new Set(slots);
    for (const endMin of boundaryMinutes) {
      const [bH, bM] = [Math.floor(endMin / 60), endMin % 60];
      const boundaryTime = new Date(selectedDate);
      boundaryTime.setHours(bH, bM, 0, 0);

      // Skip if outside business hours, in the past, or within lead time
      if (boundaryTime.getTime() < openTime.getTime()) continue;
      if (boundaryTime.getTime() + totalDuration * 60000 > closeTime.getTime()) continue;
      if (boundaryTime.getTime() <= now.getTime()) continue;
      if (minStartTime && boundaryTime.getTime() < minStartTime.getTime()) continue;

      const bTimeStr = `${String(bH).padStart(2, '0')}:${String(bM).padStart(2, '0')}`;
      if (slotTimeSet.has(bTimeStr)) continue; // already in the grid

      // Run full feasibility check on this boundary slot
      const bParticipants = hasExplicitParticipants
        ? participantList.map((p) => ({
            serviceIds: p.serviceIds,
            startTime: p.startTime || bTimeStr,
          }))
        : [{ serviceIds: serviceIdsArray, startTime: bTimeStr, serviceEmployees: currentServiceEmployees }];
      const { feasible } = await this.isFeasible(tenant.id, dateStr, bParticipants, feasibilityCtx, clientId as string | undefined);

      if (feasible) {
        slots.push(bTimeStr);
        slotTimeSet.add(bTimeStr);
        log.log('[Feasibility] Boundary slot INJECTED: ' + bTimeStr);
      }
    }

    // Sort slots chronologically before returning
    slots.sort();

    return { slots };
  }

  /**
   * Lightweight existence check: for each day in the given range,
   * determine whether at least ONE feasible slot exists.
   * Used by the frontend calendar to pre-grey days with zero availability.
   * Much cheaper than getAvailableSlots because:
   *   - Loads feasibility context once per tenant (not per day)
   *   - Stops at the first feasible slot per day
   *   - Skips days that fail date-level rules (lead time, max window, blocked, closed)
   */
  async getAvailableDays(
    tenantId: string,
    query: Record<string, unknown>
  ): Promise<{ days: string[] }> {
    const { from, to, serviceIds } = query;

    if (!from || !to) {
      throw new HttpError(400, {
        error: 'Date range required',
        message: 'Both `from` and `to` (YYYY-MM-DD) query params are required',
      });
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantId }, { subdomain: tenantId }, { domain: tenantId }, { id: tenantId }],
        isActive: true,
      },
      include: { settings: true },
    });

    if (!tenant) {
      throw new HttpError(404, { error: 'Tenant not found' });
    }

    const businessHours = (tenant.settings?.businessHours as any) || {};
    const blockedDates: string[] = businessHours.blockedDates || [];
    const bookingDelay = businessHours.bookingDelay || null;
    const bookingAdvanceDays = tenant.settings?.bookingAdvanceDays ?? 30;

    const serviceIdsArray = Array.isArray(serviceIds)
      ? (serviceIds as string[])
      : typeof serviceIds === 'string'
        ? serviceIds.split(',').filter(Boolean)
        : [];

    // Early exit: without any services there's nothing to check
    if (serviceIdsArray.length === 0) return { days: [] };

    const fromDate = new Date(from as string);
    const toDate = new Date(to as string);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Compute min lead time boundary (date-level)
    let minLeadDay: Date | null = null;
    if (bookingDelay && bookingDelay.value && bookingDelay.unit && !bookingDelay.allowLastMoment) {
      minLeadDay = new Date(today);
      if (bookingDelay.unit === 'jours') {
        minLeadDay.setDate(minLeadDay.getDate() + parseInt(bookingDelay.value));
      } else if (bookingDelay.unit === 'semaines') {
        minLeadDay.setDate(minLeadDay.getDate() + parseInt(bookingDelay.value) * 7);
      } else if (bookingDelay.unit === 'heures') {
        // For hours, only same-day slots are filtered; the day itself stays available
        minLeadDay = null;
      }
    }

    // Compute max advance boundary (date-level)
    const maxDay = new Date(today);
    maxDay.setDate(maxDay.getDate() + bookingAdvanceDays);

    const resultDays: string[] = [];

    // Iterate day by day
    const cursorDay = new Date(fromDate);
    while (cursorDay <= toDate) {
      const dateStr = cursorDay.toISOString().slice(0, 10);

      // 1) Date-level rules (no DB needed)
      if (blockedDates.includes(dateStr)) {
        cursorDay.setDate(cursorDay.getDate() + 1);
        continue;
      }

      const hours = getBusinessHoursForDate(businessHours, cursorDay);
      if (!hours) {
        cursorDay.setDate(cursorDay.getDate() + 1);
        continue;
      }

      const selectedDay = new Date(cursorDay.getFullYear(), cursorDay.getMonth(), cursorDay.getDate());
      if (selectedDay < today) {
        cursorDay.setDate(cursorDay.getDate() + 1);
        continue;
      }

      if (minLeadDay && selectedDay < minLeadDay) {
        cursorDay.setDate(cursorDay.getDate() + 1);
        continue;
      }

      if (selectedDay > maxDay) {
        // Days beyond max window are unreachable — stop iteration entirely
        break;
      }

      // 2) Compute time-level lead time boundary (must match getAvailableSlots logic).
      // Reuse the outer `now` captured at request-start so lead time is consistent
      // across all days in the range (same as getAvailableSlots behaviour).
      let minSlotTime: Date | null = null;
      if (bookingDelay && bookingDelay.value && bookingDelay.unit && !bookingDelay.allowLastMoment) {
        minSlotTime = new Date(now);
        if (bookingDelay.unit === 'heures') {
          minSlotTime.setHours(minSlotTime.getHours() + parseInt(bookingDelay.value));
        } else if (bookingDelay.unit === 'jours') {
          minSlotTime.setDate(minSlotTime.getDate() + parseInt(bookingDelay.value));
        } else if (bookingDelay.unit === 'semaines') {
          minSlotTime.setDate(minSlotTime.getDate() + parseInt(bookingDelay.value) * 7);
        }
      }

      // Load feasibility context for this day
      const ctx = await this.loadFeasibilityContext(tenant.id, dateStr, serviceIdsArray.length ? serviceIdsArray : undefined);

      const [openHour, openMin] = hours.open.split(':').map(Number);
      const [closeHour, closeMin] = hours.close.split(':').map(Number);
      const openTime = new Date(cursorDay);
      openTime.setHours(openHour, openMin, 0, 0);
      const closeTime = new Date(cursorDay);
      closeTime.setHours(closeHour, closeMin, 0, 0);

      // Get total duration for the requested services
      let totalDuration = 60;
      if (serviceIdsArray.length > 0 && ctx.serviceDurationMap.size > 0) {
        totalDuration = serviceIdsArray.reduce((sum, sid) => sum + (ctx.serviceDurationMap.get(sid) || 0), 0);
      }

      // Scan slots — stop at first feasible one that also passes the time-level lead time
      const slotDuration = 30;
      let found = false;
      const startMinutes = openTime.getHours() * 60 + openTime.getMinutes();
      const endMinutes = closeTime.getHours() * 60 + closeTime.getMinutes();

      for (let mins = startMinutes; mins + totalDuration <= endMinutes; mins += slotDuration) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;

        // Apply time-level lead time filter (same as getAvailableSlots)
        const slotDate = new Date(cursorDay);
        slotDate.setHours(h, m, 0, 0);
        if (slotDate.getTime() <= now.getTime() || (minSlotTime && slotDate.getTime() < minSlotTime.getTime())) {
          continue;
        }

        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        const { feasible } = await this.isFeasible(
          tenant.id,
          dateStr,
          [{ serviceIds: serviceIdsArray, startTime: timeStr }],
          ctx,
        );

        if (feasible) {
          found = true;
          break;
        }
      }

      if (found) {
        resultDays.push(dateStr);
      }

      cursorDay.setDate(cursorDay.getDate() + 1);
    }

    return { days: resultDays };
  }

  async cancelAppointment(id: string, body: any) {
    const { email } = body;

    if (!email) {
      throw new HttpError(400, {
        error: 'Email is required',
        message: 'Please provide your email to cancel the appointment.'
      });
    }

    // Find the appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        service: { select: { name: true } },
        tenant: { select: { name: true } },
        bookingParticipant: { select: { isBooker: true } },
        bookingGroup: { select: { id: true, bookerClientId: true } },
      }
    });

    if (!appointment) {
      throw new HttpError(404, {
        error: 'Appointment not found',
        message: 'The appointment was not found.'
      });
    }

    // Verify the appointment belongs to a client with this email
    if (appointment.client.email?.toLowerCase() !== email.toLowerCase()) {
      throw new HttpError(403, {
        error: 'Unauthorized',
        message: 'You can only cancel your own appointments.'
      });
    }

    // Check if appointment can be cancelled (not already completed or cancelled)
    // TODO: Enforce cancellationDelay from tenant settings — currently stored but not validated here
    if (appointment.status === 'COMPLETED') {
      throw new HttpError(400, {
        error: 'Cannot cancel completed appointment',
        message: 'This appointment has already been completed and cannot be cancelled.'
      });
    }

    if (appointment.status === 'CANCELLED') {
      throw new HttpError(400, {
        error: 'Appointment already cancelled',
        message: 'This appointment has already been cancelled.'
      });
    }

    // The main client (booker) cancelling one appointment of a group cancels the
    // whole group — otherwise the other participants' appointments would be left
    // orphaned with no way to cancel them.
    const isGroupBookerCancel =
      !!appointment.bookingGroupId &&
      (appointment.bookingParticipant?.isBooker === true ||
        appointment.bookingGroup?.bookerClientId === appointment.clientId);

    const cancelledAt = new Date();
    let cancelledAppointment;

    if (isGroupBookerCancel) {
      // Cancel every appointment of the group so none is left orphaned
      await prisma.appointment.updateMany({
        where: {
          bookingGroupId: appointment.bookingGroupId!,
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt,
          cancelledBy: appointment.clientId, // Store clientId to indicate client cancelled
          cancellationReason: 'Cancelled by client',
        },
      });

      await prisma.bookingGroup.update({
        where: { id: appointment.bookingGroupId! },
        data: { status: 'CANCELLED' },
      });

      cancelledAppointment = await prisma.appointment.findUnique({ where: { id } });
    } else {
      // Cancel the appointment
      cancelledAppointment = await prisma.appointment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt,
          cancelledBy: appointment.clientId, // Store clientId to indicate client cancelled
          cancellationReason: 'Cancelled by client'
        }
      });
    }

    // Email the salon's configured RDV notification addresses
    try {
      const notifSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: appointment.tenantId },
        select: { emailNotifications: true },
      });
      const appointmentEmails =
        ((notifSettings?.emailNotifications as any)?.appointmentEmails as string[]) || [];
      if (appointmentEmails.length > 0) {
        const clientName = `${appointment.client.firstName || ''} ${appointment.client.lastName || ''}`.trim();
        const serviceName = (appointment.service as any)?.name || 'Rendez-vous';
        await sendMail({
          to: appointmentEmails,
          subject: isGroupBookerCancel
            ? `Réservation de groupe annulée — ${appointment.tenant?.name || ''}`
            : `Rendez-vous annulé — ${appointment.tenant?.name || ''}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #B00020;">${isGroupBookerCancel ? 'Réservation de groupe annulée par le client' : 'Rendez-vous annulé par le client'}</h2>
              <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                <tr><td style="padding: 6px 0; color: #666;">Client</td><td style="padding: 6px 0; font-weight: bold;">${clientName}</td></tr>
                <tr><td style="padding: 6px 0; color: #666;">Service</td><td style="padding: 6px 0; font-weight: bold;">${serviceName}</td></tr>
              </table>
              <p style="font-size: 13px; color: #666;">Connectez-vous à votre tableau de bord Reza Pro pour plus de détails.</p>
            </div>
          `,
        });
      }
    } catch (emailError: any) {
      log.error('[Booking] Cancellation notification email failed:', emailError?.message || emailError);
    }

    return {
      appointment: cancelledAppointment,
      message: 'Appointment cancelled successfully'
    };
  }

  async getEmployeeAvailability(tenantId: string, query: Record<string, unknown>) {
    const { date, startTime, serviceIds, existingParticipants } = query;

      if (!date || !startTime) {
        throw new HttpError(400, {
          error: 'Date and startTime required',
          message: 'Both date (YYYY-MM-DD) and startTime (HH:MM) parameters are required',
        });
      }

      const tenant = await prisma.tenant.findFirst({
        where: {
          OR: [{ slug: tenantId }, { subdomain: tenantId }, { domain: tenantId }, { id: tenantId }],
          isActive: true,
        },
        select: { id: true },
      });

      if (!tenant) {
        throw new HttpError(404, { error: 'Tenant not found' });
      }

      const serviceIdsArray = Array.isArray(serviceIds)
        ? (serviceIds as string[])
        : typeof serviceIds === 'string'
        ? serviceIds.split(',').filter(Boolean)
        : [];

      // Parse existing participants (already-confirmed group members) to treat their
      // locked employees as busy during their intervals.
      const existingParticipantsList: Array<{
        serviceIds: string[];
        startTime: string;
        duration: number;
        serviceEmployees: Array<{ serviceId: string; employeeId: string | null }>;
      }> = existingParticipants
        ? typeof existingParticipants === 'string'
          ? JSON.parse(existingParticipants)
          : (existingParticipants as any[])
        : [];

      // Build virtual occupied ranges from existing participants.
      // Load actual service durations from the DB to compute correct time ranges.
      const allEpSvcIds = [...new Set(existingParticipantsList.flatMap((ep) => ep.serviceIds))];
      const epSvcDurations = allEpSvcIds.length > 0
        ? await prisma.service.findMany({ where: { id: { in: allEpSvcIds }, tenantId: tenant.id }, select: { id: true, duration: true } })
        : [];
      const epDurationMap = new Map(epSvcDurations.map((s) => [s.id, s.duration]));

      const virtualOccupied = new Map<string, Array<{ start: number; end: number }>>();
      const epAutoResolved: string[] = [];
      for (const ep of existingParticipantsList) {
        const [h, m] = ep.startTime.split(':').map(Number);
        let cursor = h * 60 + m;
        const excludeIds: string[] = [];
        for (let si = 0; si < ep.serviceIds.length; si++) {
          const svcId = ep.serviceIds[si];
          const empEntry = ep.serviceEmployees?.find((se) => se.serviceId === svcId);
          const empId = empEntry?.employeeId;
          const dur = epDurationMap.get(svcId) || 30;
          const sMin = cursor;
          const eMin = cursor + dur;

          let resolvedEmpId = empId;

          if (!resolvedEmpId) {
            // "Sans préférence" — simulate auto-assignment
            const timeStr = `${String(Math.floor(sMin / 60)).padStart(2, '0')}:${String(sMin % 60).padStart(2, '0')}`;
            try {
              const resolved = await schedulingService.resolveAnyone({
                tenantId: tenant.id,
                serviceIds: [svcId],
                date: date as string,
                startTime: timeStr,
                excludeEmployeeIds: excludeIds,
              });
              if (resolved.employeeId) {
                resolvedEmpId = resolved.employeeId;
                epAutoResolved.push(svcId + '→' + resolvedEmpId);
              }
            } catch (_) {}
          }

          if (resolvedEmpId) {
            if (!virtualOccupied.has(resolvedEmpId)) virtualOccupied.set(resolvedEmpId, []);
            virtualOccupied.get(resolvedEmpId)!.push({ start: sMin, end: eMin });
            excludeIds.push(resolvedEmpId);
          }
          cursor = eMin;
        }
      }

      const planResult = await schedulingService.planReservation({
        tenantId: tenant.id,
        serviceIds: serviceIdsArray,
        date: date as string,
        startTime: startTime as string,
      });

      const empMap = new Map<string, { id: string; firstName: string; lastName: string; available: boolean; reason: string | null; recommended: boolean }>();

      const tenantEmployees = await prisma.employee.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, firstName: true, lastName: true },
      });

      for (const emp of tenantEmployees) {
        empMap.set(emp.id, {
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          available: true,
          reason: null,
          recommended: false,
        });
      }

      // Check virtual occupation from existing participants
      const [startH, startM] = (startTime as string).split(':').map(Number);
      const startMin = startH * 60 + startM;

      for (const sPlan of planResult.services) {
        // Compute interval for this service
        const svcIdx = serviceIdsArray.indexOf(sPlan.serviceId);
        let svcStart = startMin;
        for (let i = 0; i < svcIdx; i++) {
          const prevDur = planResult.services[i]?.duration || 30;
          svcStart += prevDur;
        }
        const svcEnd = svcStart + (sPlan.duration || 30);

        for (const empAvail of sPlan.employees) {
          const existing = empMap.get(empAvail.employeeId);
          if (existing) {
            if (!empAvail.available) {
              existing.available = false;
              existing.reason = empAvail.reason || 'Indisponible';
            }
            if (empAvail.recommended) {
              existing.recommended = true;
            }
            // Check virtual occupation from existing participants
            const ranges = virtualOccupied.get(empAvail.employeeId);
            if (ranges && ranges.some((r) => r.start < svcEnd && r.end > svcStart)) {
              existing.available = false;
              existing.reason = 'Déjà assigné à un autre participant du groupe';
            }
          }
        }
      }

      // Build per-service employee data for the frontend
      const serviceEmployees = planResult.services.map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        employees: s.employees.map((e) => ({
          id: e.employeeId,
          firstName:
            tenantEmployees.find((te) => te.id === e.employeeId)?.firstName || '',
          lastName:
            tenantEmployees.find((te) => te.id === e.employeeId)?.lastName || '',
          available: e.available,
          reason: e.reason || null,
          recommended: e.recommended,
        })),
      }));

      return { employees: Array.from(empMap.values()), services: serviceEmployees };
  }

  // ─── Shared helpers (reused by feasibility check and conflict solver) ─────

  private DAY_NAMES: Record<number, string[]> = {
    0: ['dimanche', 'sunday'],
    1: ['lundi', 'monday'],
    2: ['mardi', 'tuesday'],
    3: ['mercredi', 'wednesday'],
    4: ['jeudi', 'thursday'],
    5: ['vendredi', 'friday'],
    6: ['samedi', 'saturday'],
  };

  private async loadNameMaps(tenantId: string, serviceIds?: string[]) {
    const empQ: any = { where: { tenantId, isActive: true }, select: { id: true, firstName: true, lastName: true } };
    const svcQ: any = serviceIds && serviceIds.length
      ? { where: { tenantId, id: { in: serviceIds } }, select: { id: true, name: true } }
      : { where: { tenantId }, select: { id: true, name: true } };
    const [emps, svcs] = await Promise.all([prisma.employee.findMany(empQ), prisma.service.findMany(svcQ)]);
    const empName = new Map<string, string>();
    for (const e of emps) empName.set(e.id, `${e.firstName} ${e.lastName}`.trim() || e.id);
    const svcName = new Map<string, string>();
    for (const s of svcs) svcName.set(s.id, s.name || s.id);
    return { empName, svcName };
  }

  private isSameDay(dayInDb: string | undefined | null, idx: number): boolean {
    return sharedIsSameDay(dayInDb, idx);
  }

  private mins(time: string): number {
    return minutesSinceMidnight(time);
  }

  private overlapsBreak(
    wh: unknown, idx: number, rs: number, re: number,
  ): boolean {
    return sharedOverlapsBreak(wh as any, idx, rs, re);
  }

  // ─── Pre-loaded context for per-request caching (available-slots) ──────

  private async loadFeasibilityContext(
    tenantId: string, date: string, serviceIds?: string[], clientId?: string,
  ): Promise<FeasibilityContext & { tenantId: string }> {
    return sharedLoadFeasibilityContext(tenantId, date, serviceIds, clientId);
  }

  /**
   * Feasibility mode: reuses the same constraint logic as resolveParticipantConflicts
   * but only determines whether at least one valid employee assignment exists.
   * Works at per-service-interval granularity so multi-participant chains
   * are correctly validated.
   *
   * This is the single source of truth for "can this slot really be booked by
   * these participants?" — used by available-slots filtering AND booking-creation
   * race-condition gating.
   *
   * When called from getAvailableSlots() multiple times per request, pass a
   * pre-built `cached` context so the DB queries run once instead of every slot.
   */
  async isFeasible(
    tenantId: string,
    date: string,
    participants: Array<{ serviceIds: string[]; startTime: string }>,
    cached?: FeasibilityContext,
    clientId?: string,
  ): Promise<{ feasible: boolean }> {
    let tenant: { id: string } | null;
    let ctx: FeasibilityContext;

    if (cached) {
      ctx = cached;
      tenant = { id: cached.tenantId };
    } else {
      tenant = await prisma.tenant.findFirst({
        where: {
          OR: [{ slug: tenantId }, { subdomain: tenantId }, { domain: tenantId }, { id: tenantId }],
          isActive: true,
        },
        select: { id: true },
      });
      if (!tenant) {
        log.log('[Feasibility] Tenant not found for date=' + date);
        return { feasible: false };
      }

      // Use the shared data loader so the employee/user/appointment/service
      // queries are defined in one place, not duplicated across two code paths.
      ctx = await this.loadFeasibilityContext(tenant.id, date, undefined, clientId);
    }

    const allSvcIds = [...new Set(participants.flatMap((p) => p.serviceIds))];
    const { empName, svcName } = await this.loadNameMaps(ctx.tenantId, allSvcIds);
    function enm(id: string) { return empName.get(id) || id; }
    function snm(id: string) { return svcName.get(id) || id; }
    function pnm(i: number, svcs: string[]) { return `P${i}(${svcs.map(snm).join('+')})`; }

    const { employees, skillMap, employeeToUserMap, occupiedRanges, serviceDurationMap, dayIndex, clientOccupiedRanges } = ctx;

    function isOccupiedByExisting(empId: string, uid: string | null, rs: number, re: number): boolean {
      return sharedIsOccupied(occupiedRanges, empId, uid, rs, re);
    }

    /** Check whether a time interval overlaps any of the client's existing appointments. */
    function isClientConflict(rs: number, re: number): boolean {
      return clientOccupiedRanges.some((r) => r.start < re && r.end > rs);
    }

    // ── Build per-service INTERVALS for all participants ─────────
    type Interval = {
      participantIdx: number;
      serviceIdx: number;
      serviceId: string;
      startMinutes: number;
      endMinutes: number;
      eligible: string[];
      ineligibleReasons: Array<{ employeeId: string; reason: string }>;
    };

    const intervals: Interval[] = [];

    for (let pi = 0; pi < participants.length; pi++) {
      const p = participants[pi];
      let cursor = this.mins(p.startTime);

      for (let si = 0; si < p.serviceIds.length; si++) {
        const sid = p.serviceIds[si];
        const duration = serviceDurationMap.get(sid);
        if (!duration) continue;

        const intervalStart = cursor;
        const intervalEnd = cursor + duration;

        // ── CLIENT-CONFLICT HARD CONSTRAINT ──────────────────────
        // If this participant is a known client, reject any interval that
        // overlaps an existing appointment for that same client.
        if (clientId && isClientConflict(intervalStart, intervalEnd)) {
          const fmtMC = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          log.log('[Feasibility] ' + date + ' Slot REJECTED: P' + pi + ' svc=' + snm(sid) + ' ' + fmtMC(intervalStart) + '-' + fmtMC(intervalEnd) + ' CLIENT CONFLICT');
          return { feasible: false };
        }

        const ineligibleReasons: Array<{ employeeId: string; reason: string }> = [];
        let eligible = employees
          .filter((emp) => {
            const empStatus = emp.agendaSettings ? (emp.agendaSettings as any).status : undefined;
            if (empStatus && empStatus !== 'active') {
              ineligibleReasons.push({ employeeId: emp.id, reason: `statut=${empStatus}` });
              return false;
            }

            const empSkills = skillMap.get(emp.id);
            if (empSkills && empSkills.size > 0 && !empSkills.has(sid)) {
              ineligibleReasons.push({ employeeId: emp.id, reason: `non qualifié pour ${snm(sid)}` });
              return false;
            }

            const wh = emp.workingHours as Array<{
              day: string; isWorking: boolean; startTime: string; endTime: string;
            }> | null;
            const daySched = wh?.find((d) => this.isSameDay(d.day, dayIndex));
            if (!daySched || !daySched.isWorking) {
              ineligibleReasons.push({ employeeId: emp.id, reason: 'ne travaille pas ce jour' });
              return false;
            }

            const whS = this.mins(daySched.startTime);
            const whE = this.mins(daySched.endTime);
            const fmtM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
            if (intervalStart < whS || intervalEnd > whE) {
              ineligibleReasons.push({ employeeId: emp.id, reason: `horaires hors ${daySched.startTime}-${daySched.endTime} (intervalle ${fmtM(intervalStart)}-${fmtM(intervalEnd)})` });
              return false;
            }

            if (this.overlapsBreak(emp.workingHours, dayIndex, intervalStart, intervalEnd)) {
              ineligibleReasons.push({ employeeId: emp.id, reason: 'pendant une pause' });
              return false;
            }

            const uid = employeeToUserMap.get(emp.id) ?? null;
            if (isOccupiedByExisting(emp.id, uid, intervalStart, intervalEnd)) {
              ineligibleReasons.push({ employeeId: emp.id, reason: 'déjà réservé sur cet intervalle' });
              return false;
            }

            return true;
          })
          .map((emp) => emp.id);

        // If the participant has explicit employee choices, restrict eligible list
        // to ONLY that specific employee. This ensures availability reflects the
        // client's actual selection, not a generic "some employee exists" solvability.
        const pServiceEmployees = (p as any).serviceEmployees as Array<{ serviceId: string; employeeId: string | null }> | undefined;
        if (pServiceEmployees) {
          const explicitChoice = pServiceEmployees.find((se: any) => se.serviceId === sid);
          if (explicitChoice && explicitChoice.employeeId) {
            if (!eligible.includes(explicitChoice.employeeId)) {
              eligible = [];
              log.log(`[Feasibility] P${pi} svc=${snm(sid)} explicit choice=${enm(explicitChoice.employeeId)} not eligible — blocked`);
            } else {
              eligible = [explicitChoice.employeeId];
            }
          }
        }

        const fmtM2 = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const summaryBad = ineligibleReasons.length > 0 && eligible.length === 0
          ? (' — bloqué: ' + Array.from(new Set(ineligibleReasons.map((r) => r.reason))).slice(0, 3).join(' ; '))
          : '';
        if (summaryBad) {
          log.log('[Feasibility] ' + date + ' P' + pi + ' ' + snm(sid) + ' ' + fmtM2(intervalStart) + '-' + fmtM2(intervalEnd) + summaryBad);
        }

        // ── CRITICAL: if zero employees are eligible for any service interval,
        // the slot is immediately infeasible — no need to continue building
        // intervals or running the backtracking solver.
        if (eligible.length === 0) {
          log.log('[Feasibility] ' + date + ' Slot REJECTED: P' + pi + ' svc=' + snm(sid) + ' ' + fmtM2(intervalStart) + '-' + fmtM2(intervalEnd) + ' has 0 eligible employees');
          return { feasible: false };
        }

        intervals.push({
          participantIdx: pi,
          serviceIdx: si,
          serviceId: sid,
          startMinutes: intervalStart,
          endMinutes: intervalEnd,
          eligible,
          ineligibleReasons,
        });

        cursor = intervalEnd;
      }
    }

    // If no intervals, no work to do — technically feasible (vacuous truth)
    if (intervals.length === 0) {
      return { feasible: true };
    }

    // ── Backtracking search for a valid assignment (shared solver) ──
    const feasible = solveIntervalAssignment(
      intervals.map((i) => ({ startMinutes: i.startMinutes, endMinutes: i.endMinutes, eligible: i.eligible })),
    );
    if (!feasible) {
      // Diagnose the first blocking interval for the log (same detail as before).
      const sorted = [...intervals].sort((a, b) => a.eligible.length - b.eligible.length);
      const blocking = sorted.find((i) => i.eligible.length === 0) || sorted[0];
      const pLabel = pnm(blocking.participantIdx, participants[blocking.participantIdx].serviceIds);
      const reason = blocking.eligible.length === 0
        ? Array.from(new Set(blocking.ineligibleReasons.map((r) => r.reason))).slice(0, 3).join(' ; ')
        : blocking.eligible.map(enm).join(', ') + ' tous en conflit';
      log.log('[Feasibility] RESULT: INFEASIBLE blocage: ' + pLabel + ' svc=' + snm(blocking.serviceId) + ' — ' + reason);
    }
    return { feasible };
  }

  /**
   * Validate a new participant addition to an in-progress group booking.
   *
   * This replaces the old resolveParticipantConflicts solver. Instead of solving
   * for ALL participants simultaneously, this only validates ONE new participant
   * against the locked constraints of already-confirmed participants.
   *
   * Input:
   *   - existingParticipants: array of already-confirmed participants with locked
   *     intervals and employee assignments (NOT persisted in DB yet)
   *   - newParticipant: the participant being added (services, start time, optional
   *     per-service employee selections)
   *
   * Output:
   *   - success with the complete assignments for the new participant, OR
   *   - a detailed conflict object pointing to the exact participant/service
   *
   * Never reassigns any locked participant.
   */
  async validateParticipantAddition(
    tenantId: string,
    body: {
      date: string;
      existingParticipants: Array<{
        index: number;
        serviceIds: string[];
        startTime: string;
        duration: number;
        serviceEmployees: Array<{ serviceId: string; employeeId: string | null }>;
      }>;
      newParticipant: {
        serviceIds: string[];
        startTime: string;
        duration: number;
        serviceEmployees?: Array<{ serviceId: string; employeeId: string | null }>;
      };
    },
  ) {
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ slug: tenantId }, { subdomain: tenantId }, { domain: tenantId }, { id: tenantId }],
        isActive: true,
      },
      select: { id: true },
    });
    if (!tenant) {
      throw new HttpError(404, { error: 'Tenant not found' });
    }

    const { date, existingParticipants, newParticipant } = body;
    const [year, month, dayNum] = date.split('-').map(Number);
    const dayDate = new Date(year, month - 1, dayNum);
    const dayIndex = dayDate.getDay();

    // Load employees with skills & working hours
    const employees = await prisma.employee.findMany({
      where: { tenantId: tenant.id, isActive: true },
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

    const employeeToUserMap = new Map<string, string | null>();
    {
      const tenantUsers = await prisma.user.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      const emailToUserId = new Map(
        tenantUsers.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id]),
      );
      const nameToUserId = new Map(
        tenantUsers.map((u) => [
          `${u.firstName.toLowerCase()} ${u.lastName.toLowerCase()}`,
          u.id,
        ]),
      );
      for (const emp of employees) {
        let uid: string | null = null;
        if (emp.email) uid = emailToUserId.get(emp.email.toLowerCase()) ?? null;
        if (!uid)
          uid = nameToUserId.get(`${emp.firstName.toLowerCase()} ${emp.lastName.toLowerCase()}`) ?? null;
        if (uid) employeeToUserMap.set(emp.id, uid);
      }
    }

    // Load existing appointments for the date
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] as any },
        startTime: { gte: dayStart, lte: dayEnd },
      },
      select: {
        employeeId: true,
        startTime: true,
        endTime: true,
        services: { select: { employeeId: true } },
      },
    });

    // Build occupied ranges from existing appointments
    type Range = { start: number; end: number };
    const occupiedRanges = new Map<string, Range[]>();
    for (const apt of existingAppointments) {
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

    // Inject virtual occupied ranges from existing participants (locked constraints)
    // When employeeId is null ("Sans préférence"), simulate auto-assignment to find
    // which employee the backend would assign and block that employee.
    for (const ep of existingParticipants) {
      const [h, m] = ep.startTime.split(':').map(Number);
      let cursor = h * 60 + m;
      const excludeIds: string[] = [];
      for (let si = 0; si < ep.serviceIds.length; si++) {
        const svcId = ep.serviceIds[si];
        const empEntry = ep.serviceEmployees?.find((se) => se.serviceId === svcId);
        const empId = empEntry?.employeeId;
        const durRows = await prisma.service.findMany({
          where: { id: { in: ep.serviceIds }, tenantId: tenant.id },
          select: { id: true, duration: true },
        });
        const durMap = new Map(durRows.map((s) => [s.id, s.duration]));
        const dur = durMap.get(svcId) || 30;
        const sMin = cursor;
        const eMin = cursor + dur;

        let resolvedEmpId = empId;

        if (!resolvedEmpId) {
          // "Sans préférence" — simulate auto-assignment
          const timeStr = `${String(Math.floor(sMin / 60)).padStart(2, '0')}:${String(sMin % 60).padStart(2, '0')}`;
          try {
            const resolved = await schedulingService.resolveAnyone({
              tenantId: tenant.id,
              serviceIds: [svcId],
              date,
              startTime: timeStr,
              excludeEmployeeIds: excludeIds,
            });
            if (resolved.employeeId) {
              resolvedEmpId = resolved.employeeId;
            }
          } catch (_) {}
        }

        if (resolvedEmpId) {
          if (!occupiedRanges.has(resolvedEmpId)) occupiedRanges.set(resolvedEmpId, []);
          occupiedRanges.get(resolvedEmpId)!.push({ start: sMin, end: eMin });
          excludeIds.push(resolvedEmpId);
        }
        cursor = eMin;
      }
    }

    function isOccupiedByExisting(empId: string, userId: string | null, rs: number, re: number): boolean {
      return sharedIsOccupied(occupiedRanges, empId, userId, rs, re);
    }

    // Name helpers
    const allSvcIds = [...new Set([...existingParticipants.flatMap((p) => p.serviceIds), ...newParticipant.serviceIds])];
    const { empName, svcName } = await this.loadNameMaps(tenant.id, allSvcIds);
    function enm(id: string | null) { return id === null ? 'Sans préférence' : empName.get(id) || id; }
    function snm(id: string) { return svcName.get(id) || id; }
    function tmm(m: number) { const h = Math.floor(m / 60), mm = m % 60; return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }

    const DAY_NAMES: Record<number, string[]> = {
      0: ['dimanche', 'sunday'], 1: ['lundi', 'monday'], 2: ['mardi', 'tuesday'],
      3: ['mercredi', 'wednesday'], 4: ['jeudi', 'thursday'], 5: ['vendredi', 'friday'], 6: ['samedi', 'saturday'],
    };
    function isSameDay(dayInDb: string | undefined | null, idx: number): boolean {
      if (!dayInDb) return false;
      return (DAY_NAMES[idx] || []).includes(dayInDb.trim().toLowerCase());
    }
    function mins(time: string): number { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
    function overlapsBreak(wh: unknown, idx: number, rs: number, re: number): boolean {
      const arr = wh as Array<{ day: string; breaks?: Array<{ start: string; end: string }>; }> | null;
      const dayData = arr?.find((d) => isSameDay(d.day, idx));
      if (!dayData?.breaks) return false;
      return dayData.breaks.some((b) => { const bs = mins(b.start); const be = mins(b.end); return rs < be && re > bs; });
    }

    // Load service durations for the new participant
    const svcDurRows = await prisma.service.findMany({
      where: { id: { in: newParticipant.serviceIds }, tenantId: tenant.id },
      select: { id: true, duration: true },
    });
    const durMap = new Map(svcDurRows.map((s) => [s.id, s.duration]));

    // ── Build intervals for the new participant ──────────────────
    type NewInterval = {
      serviceId: string;
      startMinutes: number;
      endMinutes: number;
      eligible: string[];
      ineligible: Map<string, string>;
      chosenEmployeeId: string | null;
    };

    const newIntervals: NewInterval[] = [];
    let cursor = mins(newParticipant.startTime);
    for (let si = 0; si < newParticipant.serviceIds.length; si++) {
      const sid = newParticipant.serviceIds[si];
      const dur = durMap.get(sid) || 30;
      const startMin = cursor;
      const endMin = cursor + dur;
      cursor = endMin;

      // Compute eligibility for this interval
      const ineligible = new Map<string, string>();
      const eligible = employees.filter((emp) => {
        const empStatus = emp.agendaSettings ? (emp.agendaSettings as any).status : undefined;
        if (empStatus && empStatus !== 'active') { ineligible.set(emp.id, `statut=${empStatus}`); return false; }
        const empSkills = skillMap.get(emp.id);
        if (empSkills && empSkills.size > 0 && !empSkills.has(sid)) { ineligible.set(emp.id, `non qualifié pour ${snm(sid)}`); return false; }
        const wh = emp.workingHours as Array<{ day: string; isWorking: boolean; startTime: string; endTime: string; }> | null;
        const daySched = wh?.find((d) => isSameDay(d.day, dayIndex));
        if (!daySched || !daySched.isWorking) { ineligible.set(emp.id, `ne travaille pas ce jour`); return false; }
        const whS = mins(daySched.startTime); const whE = mins(daySched.endTime);
        if (startMin < whS || endMin > whE) { ineligible.set(emp.id, `horaires hors ${tmm(whS)}-${tmm(whE)}`); return false; }
        if (overlapsBreak(emp.workingHours, dayIndex, startMin, endMin)) { ineligible.set(emp.id, `pendant une pause`); return false; }
        const uid = employeeToUserMap.get(emp.id) ?? null;
        if (isOccupiedByExisting(emp.id, uid, startMin, endMin)) { ineligible.set(emp.id, `déjà réservé sur ${tmm(startMin)}-${tmm(endMin)}`); return false; }
        return true;
      }).map((emp) => emp.id);

      // Find the explicitly chosen employee for this service (if any)
      const chosenEmp = newParticipant.serviceEmployees?.find((se) => se.serviceId === sid)?.employeeId ?? null;

      newIntervals.push({ serviceId: sid, startMinutes: startMin, endMinutes: endMin, eligible, ineligible, chosenEmployeeId: chosenEmp });
    }

    // ── Validate explicit selections and auto-assign ──────────────
    const assignments: Array<{ serviceId: string; employeeId: string; autoAssigned: boolean }> = [];
    const blockedEmployees = new Set<string>(); // employees already assigned to overlapping intervals

    // Sort intervals by most-constrained first (fewest eligible)
    const sorted = [...newIntervals].sort((a, b) => a.eligible.length - b.eligible.length);

    const conflictedParticipants: Array<{ serviceId: string; reason: string }> = [];

    for (const interval of sorted) {
      if (interval.eligible.length === 0) {
        const reasons = [...interval.ineligible.entries()].slice(0, 2);
        const details = reasons.map(([eid, r]) => `${enm(eid)}: ${r}`).join(' ; ');
        conflictedParticipants.push({
          serviceId: interval.serviceId,
          reason: `Aucun collaborateur éligible pour ${snm(interval.serviceId)} à ${tmm(interval.startMinutes)}-${tmm(interval.endMinutes)}. ${details}`,
        });
        continue;
      }

      if (interval.chosenEmployeeId) {
        // Validate the explicit selection
        if (!interval.eligible.includes(interval.chosenEmployeeId)) {
          const reason = interval.ineligible.get(interval.chosenEmployeeId) || 'indisponible';
          conflictedParticipants.push({
            serviceId: interval.serviceId,
            reason: `${enm(interval.chosenEmployeeId)} ne peut pas assurer ${snm(interval.serviceId)} à ${tmm(interval.startMinutes)}-${tmm(interval.endMinutes)} (${reason}).`,
          });
          continue;
        }
        if (blockedEmployees.has(interval.chosenEmployeeId)) {
          conflictedParticipants.push({
            serviceId: interval.serviceId,
            reason: `${enm(interval.chosenEmployeeId)} est déjà assigné à un intervalle qui se chevauche avec ${snm(interval.serviceId)}.`,
          });
          continue;
        }
        assignments.push({ serviceId: interval.serviceId, employeeId: interval.chosenEmployeeId, autoAssigned: false });
        blockedEmployees.add(interval.chosenEmployeeId);
      } else {
        // Auto-assign: pick the least-loaded eligible employee not already blocked
        const candidates = interval.eligible.filter((eid) => !blockedEmployees.has(eid));
        if (candidates.length === 0) {
          conflictedParticipants.push({
            serviceId: interval.serviceId,
            reason: `Tous les collaborateurs éligibles pour ${snm(interval.serviceId)} sont déjà assignés à des intervalles qui se chevauchent.`,
          });
          continue;
        }
        // Pick the first available (they're already filtered by eligibility)
        const chosen = candidates[0];
        assignments.push({ serviceId: interval.serviceId, employeeId: chosen, autoAssigned: true });
        blockedEmployees.add(chosen);
      }
    }

    if (conflictedParticipants.length > 0) {
      log.log(`[ValidateParticipant] CONFLICT for new participant: ${conflictedParticipants.map((c) => `${snm(c.serviceId)}: ${c.reason}`).join(' | ')}`);
      return {
        valid: false,
        conflict: true,
        message: conflictedParticipants[0].reason,
        conflictedServices: conflictedParticipants,
      };
    }

    log.log(`[ValidateParticipant] OK: new participant validated. Assignments: ${assignments.map((a) => `${snm(a.serviceId)}→${enm(a.employeeId)}${a.autoAssigned ? '(auto)' : ''}`).join(', ')}`);
    return {
      valid: true,
      conflict: false,
      assignments,
    };
  }
}

export const bookingService = new BookingService();
