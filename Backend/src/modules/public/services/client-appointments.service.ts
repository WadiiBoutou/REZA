import { prisma } from '../../../lib/prisma';
import { formatDateTimeForAPI } from '../../../utils/dateTime';
import { transformImageUrl } from '../../../utils/imageUrl';
import { fail } from '../utils/http';
import * as log from '../../../utils/logger';

export class ClientAppointmentsService {
  async getClientAppointments(email: string, query: Record<string, unknown>) {
    try {
    const { status, limit = '100', sortBy = 'createdAt' } = query;

    if (!email) {
      fail(400, {
        error: 'Email is required'
      });
    }

    // Find ALL clients by email across all tenants (a client can have multiple records, one per tenant)
    const clients = await prisma.client.findMany({
      where: {
        email: email.trim().toLowerCase()
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        avatar: true,
        tenantId: true
      } as any // Temporary cast until Prisma client is regenerated
    });

    if (!clients || clients.length === 0) {
      return {
        appointments: [],
        client: null
      };
    }

    // Get the first client for the response (prefer the most recent one)
    const client: { id: string; firstName: string; lastName: string; email: string; phone: string | null; address: string | null; avatar: string | null; tenantId: string } = clients[0] as any;
    
    // Log avatar for debugging - check if avatar exists in the client object
    const avatarValue: string | null = client.avatar;
    log.log('[getClientAppointments] Client avatar from Prisma findMany:', avatarValue ? `present (type: ${typeof avatarValue}, length: ${avatarValue.length || 0})` : 'null');
    
    // Always query the database directly to ensure we get the avatar
    // This is necessary because Prisma findMany might not return very large strings correctly
    let verifiedAvatar: string | null = avatarValue;
    if (client.id) {
      const directClient = await prisma.client.findUnique({
        where: { id: client.id },
        select: { avatar: true }
      });
      if (directClient && directClient.avatar) {
        verifiedAvatar = typeof directClient.avatar === 'string' ? directClient.avatar : null;
        log.log('[getClientAppointments] Direct DB query avatar:', verifiedAvatar ? `present (length: ${verifiedAvatar.length})` : 'null');
      } else {
        log.log('[getClientAppointments] Direct DB query avatar: null');
      }
    }

    // Get all client IDs to fetch appointments from all tenants
    const clientIds = clients.map(c => c.id);
    const where: any = {
      clientId: { in: clientIds }
    };

    if (status) {
      where.status = status;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: sortBy === 'startTime' ? { startTime: 'desc' } : { createdAt: 'desc' },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            duration: true,
            price: true,
            priceType: true,
            category: true
          }
        },
        services: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            serviceId: true,
            serviceName: true,
            duration: true,
            price: true,
            sortOrder: true,
            employeeId: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true
              }
            }
          }
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            logo: true,
            coverImage: true,
            address: true,
            city: true
          }
        },
        bookingParticipant: {
          select: {
            displayName: true,
            isBooker: true
          }
        }
      }
    });

    // Format appointments for frontend
    const formattedAppointments = await Promise.all(appointments.map(async (apt) => {
      // Parse UTC date from database and convert to local timezone for display
      const startTime = new Date(apt.startTime);
      const endTime = apt.endTime ? new Date(apt.endTime) : new Date(startTime.getTime() + (apt.duration || 60) * 60000);
      
      // Map status
      const statusMap: Record<string, string> = {
        'PENDING': 'pending',
        'CONFIRMED': 'confirmed',
        'IN_PROGRESS': 'in_progress',
        'COMPLETED': 'completed',
        'CANCELLED': 'cancelled',
        'NO_SHOW': 'no_show'
      };

      // Format duration (convert minutes to "Xh Y min" format)
      const durationMinutes = apt.duration || apt.service?.duration || 60;
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      let durationFormatted = '';
      if (hours > 0 && minutes > 0) {
        durationFormatted = `${hours}h ${minutes} min`;
      } else if (hours > 0) {
        durationFormatted = `${hours}h`;
      } else {
        durationFormatted = `${minutes} min`;
      }

      // Try to get Employee info - first from User relation, then from notes, then by searching Employee by email
      let professionalName: string | null = null;
      
      // First, try to extract Employee ID from notes if present
      let employeeIdFromNotes: string | null = null;
      if (apt.notes) {
        const employeeIdMatch = apt.notes.match(/Employee ID: ([a-z0-9]+)/i);
        if (employeeIdMatch) {
          employeeIdFromNotes = employeeIdMatch[1];
        }
      }
      
      if (employeeIdFromNotes) {
        // Try to find Employee by ID from notes
        const employee = await prisma.employee.findFirst({
          where: {
            id: employeeIdFromNotes,
            tenantId: apt.tenantId,
            isActive: true
          },
          select: {
            firstName: true,
            lastName: true
          }
        });
        if (employee) {
          professionalName = `${employee.firstName} ${employee.lastName}`;
        }
      } else if (apt.employee) {
        // If we have a User, try to find the corresponding Employee by email
        const employeeEmail = (apt.employee as any).email;
        const employee = await prisma.employee.findFirst({
          where: {
            tenantId: apt.tenantId,
            email: employeeEmail || undefined,
            isActive: true
          },
          select: {
            firstName: true,
            lastName: true
          }
        });
        if (employee) {
          professionalName = `${employee.firstName} ${employee.lastName}`;
        } else {
          // Fallback to User name if no Employee found
          professionalName = `${apt.employee.firstName} ${apt.employee.lastName}`;
        }
      }

      // Format date and time consistently using utility function (handles timezone correctly)
      const { date: dateStr, time: timeStr } = formatDateTimeForAPI(apt.startTime.toISOString());

      // Calculate total price and service names from service items
      const serviceItems = apt.services || [];
      const totalPrice = serviceItems.length > 0
        ? serviceItems.reduce((sum, item) => sum + (item.price || 0), 0)
        : (apt.service?.price || 0);
      
      const serviceName = serviceItems.length > 1
        ? `${serviceItems[0].serviceName} +${serviceItems.length - 1}`
        : serviceItems.length === 1
          ? serviceItems[0].serviceName
          : (apt.service?.name || 'Service');

      // Prepare detailed services array for the details page
      const detailedServices = serviceItems.length > 0
        ? serviceItems.map(item => ({
            id: item.id,
            serviceId: item.serviceId,
            name: item.serviceName,
            duration: item.duration,
            price: item.price
          }))
        : [{
            id: apt.service?.id,
            serviceId: apt.service?.id,
            name: apt.service?.name || 'Service',
            duration: apt.service?.duration || apt.duration,
            price: apt.service?.price || 0
          }];

      return {
        id: apt.id,
        salon: apt.tenant?.name || 'Salon',
        salonId: apt.tenantId,
        tenantId: apt.tenantId,
        service: serviceName,
        services: detailedServices,
        date: dateStr,
        time: timeStr,
        status: statusMap[apt.status] || apt.status.toLowerCase(),
        price: totalPrice,
        duration: durationFormatted,
        professional: professionalName,
        image: transformImageUrl(apt.tenant?.coverImage || apt.tenant?.logo || null),
        address: apt.tenant?.address || apt.tenant?.city || null,
        notes: apt.notes,
        clientId: apt.clientId,
        clientFirstName: client.firstName,
        clientLastName: client.lastName,
        clientEmail: client.email,
        clientPhone: client.phone,
        startTime: apt.startTime.toISOString(),
        bookedFor: (apt as any).bookingParticipant?.displayName || null,
      };
    }));

    // Prepare client response with avatar
    // Use the verified avatar from the direct DB query
    const clientAvatar = verifiedAvatar;
    
    log.log('[getClientAppointments] Returning client avatar:', clientAvatar ? `present (length: ${clientAvatar.length})` : 'null');
    
    const clientResponse = {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      address: client.address,
      avatar: clientAvatar || null
    };
    
    // Log the response size to check if it's being truncated
    const responseSize = JSON.stringify(clientResponse).length;
    log.log('[getClientAppointments] Client response size:', responseSize, 'bytes');
    
    return {
      appointments: formattedAppointments,
      client: clientResponse
    };
  } catch (error) {
    throw error;
  }
  }

}

export const clientAppointmentsService = new ClientAppointmentsService();
