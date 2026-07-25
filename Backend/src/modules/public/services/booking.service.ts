import { prisma } from '../../../lib/prisma';
import { formatDateForNotification } from '../../../utils/dateTime';
import { validateAppointmentRules } from '../../../utils/schedulingValidation';
import { resolveEmployeeUserId } from '../../../utils/resolveEmployeeUserId';
import { schedulingService } from '../../appointment/scheduling.service';
import { getServicePrice, stripGeneratedServicesNotes } from '../../../utils/appointmentServiceItems';
import { fail } from '../utils/http';
import { HttpError } from '../../../lib/errors';
import { createPublicBookingSchema } from '../schemas/public.schema';
import type { Service } from '../../../../prisma/generated/prisma/client';

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

function buildServicesList(services: Service[]): string {
  return services
    .map((s) => `${s.name} (${s.duration} min - ${getServicePrice(s)} MAD)`)
    .join(', ');
}

export class BookingService {
  async createBooking(body: unknown) {
    try {
      const parsed = createPublicBookingSchema.safeParse(body);
      if (!parsed.success) {
        fail(400, {
          error: 'Validation error',
          message: parsed.error.errors[0]?.message || 'Invalid booking payload',
        });
      }

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

      const tenant = await prisma.tenant.findFirst({
        where: {
          OR: [{ subdomain: tenantId }, { domain: tenantId }, { id: tenantId }],
          isActive: true,
          subscriptionActive: true,
        },
      });

      if (!tenant) {
        fail(404, {
          error: 'Tenant not found',
          message: 'The requested salon or establishment was not found.',
        });
      }

      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: tenant.id },
      });

      if (settings && settings.onlineReservationEnabled === false) {
        fail(403, {
          error: 'Online reservations disabled',
          message: 'This establishment does not accept online reservations.',
        });
      }

      const normalizedEmail = email?.trim() ? email.trim().toLowerCase() : null;

      let bookerClient = await prisma.client.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
            { phone },
          ],
        },
      });

      if (!bookerClient) {
        bookerClient = await prisma.client.create({
          data: {
            tenantId: tenant.id,
            firstName,
            lastName,
            email: normalizedEmail,
            phone,
            status: 'ACTIVE',
          },
        });
      } else {
        bookerClient = await prisma.client.update({
          where: { id: bookerClient.id },
          data: {
            firstName,
            lastName,
            email: normalizedEmail ?? bookerClient.email,
            phone: phone || bookerClient.phone,
          },
        });
      }

      const loadServices = async (ids: string[]) => {
        const services = await prisma.service.findMany({
          where: {
            id: { in: ids },
            tenantId: tenant.id,
            visibility: { in: ['BOOKABLE', 'VISIBLE'] },
          },
        });
        if (services.length !== ids.length) {
          fail(400, {
            error: 'Invalid services',
            message: 'One or more services are not available for booking.',
          });
        }
        return services;
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
          const linkedClient = await prisma.client.findFirst({
            where: { id: participant.clientId, tenantId: tenant.id },
          });
          if (linkedClient) {
            appointmentClientId = linkedClient.id;
            linkedClientId = linkedClient.id;
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

      // Auto-assign employee for any participant with no employeeId ("N'importe qui")
      // Skip auto-assignment when per-service employees are already resolved
      const bookingDate = defaultStart.toISOString().slice(0, 10);
      const bookingTime = `${String(defaultStart.getHours()).padStart(2, '0')}:${String(defaultStart.getMinutes()).padStart(2, '0')}`;

      for (const p of resolved) {
        if (p.serviceEmployees) continue; // per-service already assigned
        if (p.userEmployeeId) continue;
        const pDate = p.startTime.toISOString().slice(0, 10);
        const pTime = `${String(p.startTime.getHours()).padStart(2, '0')}:${String(p.startTime.getMinutes()).padStart(2, '0')}`;
        const assigned = await schedulingService.resolveAnyone({
          tenantId: tenant.id,
          serviceIds: p.serviceIds,
          date: pDate,
          startTime: pTime,
        });
        if (!assigned.employeeId) {
          const prefix = p.isBooker ? '' : `Pour ${p.displayName} : `;
          fail(409, {
            error: 'No available employee',
            message: `${prefix}Aucun professionnel disponible à ce créneau.`,
          });
        }
        p.employeeId = assigned.employeeId;
        p.userEmployeeId = assigned.userEmployeeId;
      }

      // ─── Cross-participant conflict resolution ──────────────
      // Run the solver on all participants to produce authoritative assignments.
      // The solver re-validates skills, hours, breaks, overlap, and workload.
      // Every participant goes through the solver — the participant-level
      // employeeId is used for conflict avoidance. Per-service employees
      // are preserved separately and validated individually below.
      if (resolved.length >= 2) {
        // Build solver input, preserving original resolved[] index
        interface SolverEntry { resolvedIndex: number; index: number; serviceIds: string[]; startTime: string; duration: number; currentEmployeeId: string | null; }
        const solverEntries: SolverEntry[] = [];
        for (let ri = 0; ri < resolved.length; ri++) {
          const p = resolved[ri];
          solverEntries.push({
            resolvedIndex: ri,
            index: solverEntries.length,
            serviceIds: p.serviceIds,
            startTime: `${String(p.startTime.getHours()).padStart(2, '0')}:${String(p.startTime.getMinutes()).padStart(2, '0')}`,
            duration: p.duration,
            currentEmployeeId: p.employeeId,
          });
        }

        if (solverEntries.length >= 2) {
          const solverResult = await this.resolveParticipantConflicts(tenant.id, {
            date: defaultStart.toISOString().slice(0, 10),
            changedParticipantIndex: 0,
            selectedEmployeeId: solverEntries[0].currentEmployeeId,
            participants: solverEntries,
          });

          if (!solverResult.resolved || solverResult.conflict) {
            fail(409, {
              error: 'Employee conflict',
              message: solverResult.message || 'Conflit entre les collaborateurs sélectionnés. Veuillez modifier votre sélection.',
            });
          }

          // Overwrite assignments with solver's authoritative output
          for (const a of solverResult.assignments!) {
            const entry = solverEntries.find((e) => e.index === a.index);
            if (entry) {
              resolved[entry.resolvedIndex].employeeId = a.employeeId;
              resolved[entry.resolvedIndex].userEmployeeId = a.employeeId
                ? await resolveEmployeeUserId(tenant.id, a.employeeId)
                : null;
            }
          }
        }
      }

      if (resolved.length === 0) {
        fail(400, {
          error: 'No participants',
          message:
            'Sélectionnez au moins une personne (vous ou un proche / invité) pour la réservation.',
        });
      }

      // Validate each participant independently with strict public validation rules
      for (const p of resolved) {
        const validationResult = await validateAppointmentRules({
          tenantId: tenant.id,
          employeeId: p.userEmployeeId,
          serviceIds: p.serviceIds,
          startTime: p.startTime,
          endTime: p.endTime,
          isPublicBooking: true,
        });

        if (!validationResult.isValid) {
          fail(validationResult.status || 400, {
            error: validationResult.error || 'Overlapping appointment',
            message: p.isBooker
              ? validationResult.message
              : `Pour ${p.displayName} : ${validationResult.message}`,
          });
        }
      }

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
        fail(500, {
          error: 'System error',
          message: 'No admin user found for this tenant.',
        });
      }

      const grandTotal = resolved.reduce((sum, p) => sum + p.subtotal, 0);
      const pricingSummary = resolved.map((p) => ({
        displayName: p.displayName,
        isBooker: p.isBooker,
        serviceIds: p.serviceIds,
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

      const appointments = [];

      for (const participant of resolved) {
        let appointmentNotes = notes?.trim() || '';

        if (!participant.isBooker) {
          appointmentNotes = appointmentNotes
            ? `Participant: ${participant.displayName}\n${appointmentNotes}`
            : `Participant: ${participant.displayName}`;
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

      try {
        const tenantSettings = await prisma.tenantSettings.findUnique({
          where: { tenantId: tenant.id },
          select: { timezone: true },
        });
        const timezone = tenantSettings?.timezone || 'Africa/Casablanca';
        const appointmentDate = formatDateForNotification(defaultStart.toISOString(), timezone);
        const participantCount = resolved.length;

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
              prisma.notification.create({
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
        console.error('Error creating notification for new booking:', notificationError);
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
                  prisma.notification.create({
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
        console.error('[Auto-Confirm] Error:', autoConfirmError);
      }

      const messageText = globalAutoConfirm
        ? 'Réservation créée et confirmée avec succès.'
        : 'Réservation créée avec succès. Elle apparaîtra dans le calendrier du salon et sera confirmée par l\'établissement.';

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
      // Only log unexpected errors — HttpError is normal flow for validation failures
      if (!(error instanceof HttpError)) {
        console.error('[Public Booking] Unexpected error:', error);
      }
      throw error;
    }
  }

  async getAvailableSlots(tenantId: string, query: Record<string, unknown>) {
    try {
    const { date, serviceIds, employeeId } = query;

    if (!date) {
      fail(400, {
        error: 'Date required',
        message: 'Date parameter is required (YYYY-MM-DD)'
      });
    }

    const serviceIdsArray = Array.isArray(serviceIds) 
      ? serviceIds as string[]
      : serviceIds 
        ? [serviceIds as string]
        : [];

    // Verify tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: tenantId },
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
      fail(404, {
        error: 'Tenant not found'
      });
    }

    // Get services and calculate total duration
    let totalDuration = 60; // Default 1 hour
    if (serviceIdsArray.length > 0) {
      const services = await prisma.service.findMany({
        where: {
          id: { in: serviceIdsArray },
          tenantId: tenant.id
        }
      });
      totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    }

    const businessHours = tenant.settings?.businessHours as any || {};
    
    // Check blocked dates
    const blockedDates: string[] = businessHours.blockedDates || [];
    const dateStr = date as string;
    if (blockedDates.includes(dateStr)) {
      return { slots: [] }; // Blocked/closed on this day
    }

    const defaultHours = {
      monday: { open: '09:00', close: '18:00' },
      tuesday: { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday: { open: '09:00', close: '18:00' },
      friday: { open: '09:00', close: '18:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: null
    };

    const selectedDate = new Date(dateStr);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[selectedDate.getDay()];
    const hours = businessHours[dayName] || defaultHours[dayName as keyof typeof defaultHours];

    if (!hours || !hours.open || !hours.close) {
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

    // Calculate minimum lead time date
    let minLeadDate = new Date(today);
    if (bookingDelay && bookingDelay.value && bookingDelay.unit && !bookingDelay.allowLastMoment) {
      if (bookingDelay.unit === 'heures') {
        minLeadDate.setHours(minLeadDate.getHours() + parseInt(bookingDelay.value));
      } else if (bookingDelay.unit === 'jours') {
        minLeadDate.setDate(minLeadDate.getDate() + parseInt(bookingDelay.value));
      } else if (bookingDelay.unit === 'semaines') {
        minLeadDate.setDate(minLeadDate.getDate() + parseInt(bookingDelay.value) * 7);
      }
    }
    const isBeforeLeadTime = selectedDay.getTime() < new Date(minLeadDate.getFullYear(), minLeadDate.getMonth(), minLeadDate.getDate()).getTime();

    if (isBeforeLeadTime) {
      return { slots: [] }; // Date is within lead time window
    }

    // Generate 30-minute slots
    const slotDuration = 30; // minutes
    let currentTime = new Date(openTime);
    
    while (currentTime.getTime() + totalDuration * 60000 <= closeTime.getTime()) {
      // If the selected date is today, filter out past time slots
      if (isToday && currentTime.getTime() <= now.getTime()) {
        currentTime = new Date(currentTime.getTime() + slotDuration * 60000);
        continue;
      }

      const timeStr = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;

      // Use the scheduling engine to check if this start time is feasible
      const slotCheck = await schedulingService.checkSlotAvailability({
        tenantId: tenant.id,
        serviceIds: serviceIdsArray,
        date: dateStr,
        startTime: timeStr,
      });

      if (slotCheck.available) {
        slots.push(timeStr);
      }

      currentTime = new Date(currentTime.getTime() + slotDuration * 60000);
    }

    return { slots };
  } catch (error) {
    throw error;
  }
  }

  async cancelAppointment(id: string, body: any) {
    try {
    const { email } = body;

    if (!email) {
      fail(400, {
        error: 'Email is required',
        message: 'Please provide your email to cancel the appointment.'
      });
    }

    // Find the appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true
      }
    });

    if (!appointment) {
      fail(404, {
        error: 'Appointment not found',
        message: 'The appointment was not found.'
      });
    }

    // Verify the appointment belongs to a client with this email
    if (appointment.client.email?.toLowerCase() !== email.toLowerCase()) {
      fail(403, {
        error: 'Unauthorized',
        message: 'You can only cancel your own appointments.'
      });
    }

    // Check if appointment can be cancelled (not already completed or cancelled)
    // TODO: Enforce cancellationDelay from tenant settings — currently stored but not validated here
    if (appointment.status === 'COMPLETED') {
      fail(400, {
        error: 'Cannot cancel completed appointment',
        message: 'This appointment has already been completed and cannot be cancelled.'
      });
    }

    if (appointment.status === 'CANCELLED') {
      fail(400, {
        error: 'Appointment already cancelled',
        message: 'This appointment has already been cancelled.'
      });
    }

    // Cancel the appointment
    const cancelledAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: appointment.clientId, // Store clientId to indicate client cancelled
        cancellationReason: 'Cancelled by client'
      }
    });

    return {
      appointment: cancelledAppointment,
      message: 'Appointment cancelled successfully'
    };
  } catch (error) {
    throw error;
  }
  }

  async getEmployeeAvailability(tenantId: string, query: Record<string, unknown>) {
    try {
      const { date, startTime, serviceIds } = query;

      if (!date || !startTime) {
        fail(400, {
          error: 'Date and startTime required',
          message: 'Both date (YYYY-MM-DD) and startTime (HH:MM) parameters are required',
        });
      }

      const tenant = await prisma.tenant.findFirst({
        where: {
          OR: [{ subdomain: tenantId }, { domain: tenantId }, { id: tenantId }],
          isActive: true,
        },
        select: { id: true },
      });

      if (!tenant) {
        fail(404, { error: 'Tenant not found' });
      }

      const serviceIdsArray = Array.isArray(serviceIds)
        ? (serviceIds as string[])
        : typeof serviceIds === 'string'
        ? serviceIds.split(',').filter(Boolean)
        : [];

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

      for (const sPlan of planResult.services) {
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
          }
        }
      }

      // Compute employees who are available for ALL services in the bundle
      const commonEmployeeIds: string[] = [];
      if (planResult.services.length > 0) {
        const serviceAvailableSets = planResult.services.map((s) => {
          const ids = s.employees.filter((e) => e.available).map((e) => e.employeeId);
          return new Set(ids);
        });
        const firstSet = serviceAvailableSets[0];
        if (firstSet && firstSet.size > 0) {
          const intersection = [...firstSet].filter((id) =>
            serviceAvailableSets.every((set) => set.has(id)),
          );
          commonEmployeeIds.push(...intersection);
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

      return { employees: Array.from(empMap.values()), commonEmployeeIds, services: serviceEmployees };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Constraint-solver for cross-participant employee conflicts.
   *
   * Phases:
   *   1. BUILD CONSTRAINTS — load employees, compute eligibility per participant, build overlap graph
   *   2. LOCK USER CHOICE — pin the participant the user just changed to their explicit selection
   *   3. SEARCH + MINIMIZE — backtracking that preserves current assignments, tries fewest changes first
   *   4. RETURN — resolved assignments or conflict
   */
  async resolveParticipantConflicts(
    tenantId: string,
    body: {
      date: string;
      changedParticipantIndex: number;
      /** null when user picked "N'importe qui" — scheduler resolves. Never "any". */
      selectedEmployeeId: string | null;
      participants: Array<{
        index: number;
        serviceIds: string[];
        startTime: string;
        duration: number;
        /** Current assignment in the UI. null if "N'importe qui". Never "any". */
        currentEmployeeId: string | null;
      }>;
    },
  ) {
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ subdomain: tenantId }, { domain: tenantId }, { id: tenantId }],
        isActive: true,
      },
      select: { id: true },
    });
    if (!tenant) {
      fail(404, { error: 'Tenant not found' });
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 1: BUILD CONSTRAINTS
    // ─────────────────────────────────────────────────────────────

    const { date, participants } = body;
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

    // Resolve Employee → User IDs
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
          uid =
            nameToUserId.get(
              `${emp.firstName.toLowerCase()} ${emp.lastName.toLowerCase()}`,
            ) ?? null;
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
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
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

    function isOccupiedByExisting(
      empId: string,
      userId: string | null,
      rs: number,
      re: number,
    ): boolean {
      const ids = [empId];
      if (userId) ids.push(userId);
      return ids.some(
        (id) =>
          occupiedRanges.has(id) &&
          occupiedRanges.get(id)!.some((r) => r.start < re && r.end > rs),
      );
    }

    // Helpers
    const DAY_NAMES: Record<number, string[]> = {
      0: ['dimanche', 'sunday'],
      1: ['lundi', 'monday'],
      2: ['mardi', 'tuesday'],
      3: ['mercredi', 'wednesday'],
      4: ['jeudi', 'thursday'],
      5: ['vendredi', 'friday'],
      6: ['samedi', 'saturday'],
    };
    function isSameDay(dayInDb: string | undefined | null, idx: number): boolean {
      if (!dayInDb) return false;
      return (DAY_NAMES[idx] || []).includes(dayInDb.trim().toLowerCase());
    }
    function mins(time: string): number {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    }
    function overlapsBreak(
      wh: unknown,
      idx: number,
      rs: number,
      re: number,
    ): boolean {
      const arr = wh as Array<{
        day: string;
        breaks?: Array<{ start: string; end: string }>;
      }> | null;
      const dayData = arr?.find((d) => isSameDay(d.day, idx));
      if (!dayData?.breaks) return false;
      return dayData.breaks.some((b) => {
        const bs = mins(b.start);
        const be = mins(b.end);
        return rs < be && re > bs;
      });
    }
    function overlap(
      a: { startMinutes: number; endMinutes: number },
      b: { startMinutes: number; endMinutes: number },
    ): boolean {
      return a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes;
    }

    // Compute workload for tie-breaking
    const workloadMap = new Map<string, number>();
    for (const emp of employees) {
      const uid = employeeToUserMap.get(emp.id);
      let total = 0;
      if (uid) {
        const ranges = occupiedRanges.get(uid) || [];
        total = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
      }
      workloadMap.set(emp.id, total);
    }

    // ── Constraint node: one per participant ──────────────────────
    type ConstraintNode = {
      index: number;
      serviceIds: string[];
      startMinutes: number;
      endMinutes: number;
      eligible: string[];
      currentEmployeeId: string | null;
    };

    const nodes: ConstraintNode[] = participants.map((p) => {
      const startMin = mins(p.startTime);
      const endMin = startMin + p.duration;
      const eligible = employees
        .filter((emp) => {
          const empStatus = emp.agendaSettings ? (emp.agendaSettings as any).status : undefined;
          if (empStatus && empStatus !== 'active') return false;
          const empSkills = skillMap.get(emp.id);
          if (empSkills && empSkills.size > 0) {
            if (!p.serviceIds.every((sid) => empSkills!.has(sid))) return false;
          }
          const wh = emp.workingHours as Array<{
            day: string;
            isWorking: boolean;
            startTime: string;
            endTime: string;
          }> | null;
          const daySched = wh?.find((d) => isSameDay(d.day, dayIndex));
          if (!daySched || !daySched.isWorking) return false;
          const whS = mins(daySched.startTime);
          const whE = mins(daySched.endTime);
          if (startMin < whS || endMin > whE) return false;
          if (overlapsBreak(emp.workingHours, dayIndex, startMin, endMin)) return false;
          const uid = employeeToUserMap.get(emp.id) ?? null;
          if (isOccupiedByExisting(emp.id, uid, startMin, endMin)) return false;
          return true;
        })
        .map((emp) => emp.id);

      return {
        index: p.index,
        serviceIds: p.serviceIds,
        startMinutes: startMin,
        endMinutes: endMin,
        eligible,
        currentEmployeeId: p.currentEmployeeId,
      };
    });

    // ─────────────────────────────────────────────────────────────
    // PHASE 2: LOCK USER CHOICE
    // ─────────────────────────────────────────────────────────────

    // The changed participant's explicit selection is locked.
    // If selectedEmployeeId is null (user chose "N'importe qui"), no lock — scheduler resolves.
    const lockedNodeIndex = body.changedParticipantIndex;
    const explicitSelection = body.selectedEmployeeId;

    // Resolve "N'importe qui" immediately: frontend sends null, backend picks.
    const lockedEmployeeId =
      explicitSelection !== null ? explicitSelection : null;

    // Validation: if the user made an explicit pick, verify it's feasible
    if (lockedEmployeeId !== null) {
      const lockedNode = nodes.find((n) => n.index === lockedNodeIndex);
      if (lockedNode && !lockedNode.eligible.includes(lockedEmployeeId)) {
        return {
          resolved: false,
          conflict: true,
          message:
            'Le collaborateur sélectionné n\'est pas disponible pour cette prestation.',
        };
      }
    }

    // ── Build working state ──────────────────────────────────────
    type Assignment = {
      index: number;
      employeeId: string;
      locked: boolean;
    };

    const assignments: Assignment[] = [];

    // Place the locked assignment
    if (lockedEmployeeId !== null) {
      assignments.push({
        index: lockedNodeIndex,
        employeeId: lockedEmployeeId,
        locked: true,
      });
    }

    // Determine unassigned nodes (sorted by most-constrained-first)
    const unassigned = nodes
      .filter((n) => n.index !== lockedNodeIndex)
      .sort((a, b) => a.eligible.length - b.eligible.length);

    // ─────────────────────────────────────────────────────────────
    // PHASE 3: SEARCH + MINIMIZE CHANGES
    // ─────────────────────────────────────────────────────────────
    //
    // Strategy:
    //   For each unassigned node, try candidates in this order:
    //     1. currentEmployeeId (preserves existing assignment — zero cost)
    //     2. remaining eligible employees sorted by workload
    //
    //   This naturally minimizes changes: we only move a participant
    //   when their current employee conflicts with a locked or more-
    //   constrained participant's assignment.

    let solvable = false;

    function computeConflicts(node: ConstraintNode): Set<string> {
      const used = new Set<string>();
      for (const a of assignments) {
        const other = nodes.find((n) => n.index === a.index);
        if (other && overlap(node, other)) {
          used.add(a.employeeId);
        }
      }
      return used;
    }

    function backtrack(pos: number): boolean {
      if (pos >= unassigned.length) {
        solvable = true;
        return true;
      }

      const node = unassigned[pos];
      const conflicts = computeConflicts(node);

      // Build candidate order: current employee first (stability), then workload-sorted
      const tried = new Set<string>();
      const candidates: string[] = [];

      // 1. Current employee (preserve existing assignment)
      if (node.currentEmployeeId && node.eligible.includes(node.currentEmployeeId)) {
        candidates.push(node.currentEmployeeId);
        tried.add(node.currentEmployeeId);
      }

      // 2. Remaining eligible, sorted by workload (least loaded first)
      const rest = node.eligible
        .filter((eid) => !tried.has(eid))
        .sort((a, b) => (workloadMap.get(a) || 0) - (workloadMap.get(b) || 0));
      candidates.push(...rest);

      for (const eid of candidates) {
        if (conflicts.has(eid)) {
          continue;
        }
        assignments.push({ index: node.index, employeeId: eid, locked: false });
        if (backtrack(pos + 1)) return true;
        assignments.pop();
      }

      return false;
    }

    const searchStarted = unassigned.length > 0;
    if (searchStarted) {
      backtrack(0);
    } else {
      solvable = true; // only locked participant, no conflicts to solve
    }

    // ─────────────────────────────────────────────────────────────
    // PHASE 4: RETURN
    // ─────────────────────────────────────────────────────────────

    const finalAssignments = assignments.map((a) => ({
      index: a.index,
      employeeId: a.employeeId,
      locked: a.locked,
      autoAssigned: !a.locked,
    }));

    // Detect invalid solutions: overlapping participants with same employee
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const a = assignments[i], b = assignments[j];
        if (a.employeeId === b.employeeId) {
          const na = nodes.find((n) => n.index === a.index);
          const nb = nodes.find((n) => n.index === b.index);
          if (na && nb && overlap(na, nb)) {
            console.error("INVALID SOLUTION: participant", a.index, "and", b.index, "share", a.employeeId, "with overlapping times");
          }
        }
      }
    }

    if (!solvable) {
      return {
        resolved: false,
        conflict: true,
        message:
          'Aucun collaborateur disponible pour satisfaire toutes les contraintes.',
      };
    }

    return {
      resolved: true,
      conflict: false,
      assignments: finalAssignments,
    };
  }
}

export const bookingService = new BookingService();
