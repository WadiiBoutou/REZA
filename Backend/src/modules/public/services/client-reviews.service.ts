import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import { createPublicReviewSchema } from '../schemas/public.schema';
import { transformImageUrl } from '../../../utils/imageUrl';
import { resolveEmployeeUserId } from '../../../utils/resolveEmployeeUserId';
import { fail } from '../utils/http';
import * as log from '../../../utils/logger';

export class ClientReviewsService {
  async createReview(body: unknown) {
    try {
    const data = createPublicReviewSchema.parse(body);

    // Verify tenant exists and is active
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { subdomain: data.tenantId },
          { domain: data.tenantId },
          { id: data.tenantId }
        ],
        isActive: true
      },
      select: { id: true }
    });

    if (!tenant) {
      fail(404, {
        error: 'Tenant not found',
        message: 'The requested salon or establishment was not found.'
      });
    }

    // Find or create client
    let client = await prisma.client.findFirst({
      where: {
        tenantId: tenant.id,
        email: data.email
      }
    });

    if (!client) {
      // Create new client
      client = await prisma.client.create({
        data: {
          tenantId: tenant.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || '',
          status: 'ACTIVE'
        }
      });
    } else {
      // Update existing client if needed
      if (data.firstName && data.firstName !== client.firstName) {
        client = await prisma.client.update({
          where: { id: client.id },
          data: { firstName: data.firstName }
        });
      }
      if (data.lastName && data.lastName !== client.lastName) {
        client = await prisma.client.update({
          where: { id: client.id },
          data: { lastName: data.lastName }
        });
      }
      if (data.phone && data.phone !== client.phone) {
        client = await prisma.client.update({
          where: { id: client.id },
          data: { phone: data.phone }
        });
      }
    }

    // Verify appointment if provided
    let appointmentEmployeeUserId: string | null = null;
    if (data.appointmentId) {
      const appointment = await prisma.appointment.findFirst({
        where: {
          id: data.appointmentId,
          tenantId: tenant.id,
          clientId: client.id
        },
        include: { services: { orderBy: { sortOrder: 'asc' } } }
      });

      if (!appointment) {
        fail(404, {
          error: 'Appointment not found',
          message: 'The appointment does not exist or does not belong to this client.'
        });
      }

      // Per-service employee when the appointment has explicit service items,
      // else the legacy top-level appointment employee.
      appointmentEmployeeUserId =
        appointment?.services?.[0]?.employeeId ?? appointment?.employeeId ?? null;
    }

    // Resolve the review's employee: explicit employeeId wins, then the
    // appointment's performing employee.
    const resolvedEmployeeUserId =
      (data.employeeId
        ? await resolveEmployeeUserId(tenant.id, data.employeeId)
        : null) ?? appointmentEmployeeUserId;

    // Create review
    const review = await prisma.review.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        appointmentId: data.appointmentId || null,
        employeeId: resolvedEmployeeUserId,
        rating: data.rating,
        comment: data.comment || null,
        status: 'PENDING' // Reviews need moderation
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        employee: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    // Create notification for tenant users about new review pending moderation
    try {
      // Get all active admin and staff users for this tenant
      const tenantUsers = await prisma.user.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
          role: {
            in: ['ADMIN', 'SUPER_ADMIN', 'STAFF', 'RECEPTIONIST']
          }
        },
        select: {
          id: true
        }
      });

      // Create notification for each user (or create one for all if no specific users)
      if (tenantUsers.length > 0) {
        await Promise.all(
          tenantUsers.map(user =>
            prisma.notification.create({
              data: {
                tenantId: tenant.id,
                userId: user.id,
                type: 'REVIEW_PENDING',
                title: 'Nouvel avis à modérer',
                message: `${client.firstName} ${client.lastName} a laissé un avis de ${data.rating} étoile${data.rating > 1 ? 's' : ''}${data.comment ? ' avec un commentaire' : ''}.`,
                link: `/dashboard/clients/mes-avis/avis-a-moderer`,
                metadata: {
                  reviewId: review.id,
                  clientId: client.id,
                  rating: data.rating,
                  hasComment: !!data.comment
                }
              }
            })
          )
        );
      } else {
        // If no users found, create a general notification (userId = null means for all)
        await prisma.notification.create({
          data: {
            tenantId: tenant.id,
            userId: null,
            type: 'REVIEW_PENDING',
            title: 'Nouvel avis à modérer',
            message: `${client.firstName} ${client.lastName} a laissé un avis de ${data.rating} étoile${data.rating > 1 ? 's' : ''}${data.comment ? ' avec un commentaire' : ''}.`,
            link: `/dashboard/clients/mes-avis/avis-a-moderer`,
            metadata: {
              reviewId: review.id,
              clientId: client.id,
              rating: data.rating,
              hasComment: !!data.comment
            }
          }
        });
      }
    } catch (notificationError) {
      // Log error but don't fail the review creation
      log.error('Error creating notification for review:', notificationError);
    }

    fail(201, {
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt,
        employee: review.employee
          ? { id: review.employee.id, firstName: review.employee.firstName, lastName: review.employee.lastName }
          : null,
        client: {
          firstName: review.client.firstName,
          lastName: review.client.lastName
        }
      },
      message: 'Votre avis a été soumis avec succès. Il sera publié après modération.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(400, {
        error: 'Validation error',
        message: error.errors[0].message
      });
    }
    throw error;
  }
  }

  async getClientReviews(email: string, query: Record<string, unknown>) {
    try {
    const { limit = '50' } = query;

    if (!email) {
      fail(400, {
        error: 'Email is required'
      });
    }

    // Find all clients with this email (user can have client records in multiple tenants)
    const clients = await prisma.client.findMany({
      where: {
        email: email
      },
      select: {
        id: true
      }
    });

    if (!clients || clients.length === 0) {
      return {
        reviews: []
      };
    }

    // Get all client IDs
    const clientIds = clients.map(c => c.id);

    // Get reviews for all clients with this email
    const reviews = await prisma.review.findMany({
      where: {
        clientId: { in: clientIds }
        // Show all reviews for the user's own account (not just approved)
      },
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
      include: {
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
        employee: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    // Get appointments for reviews that have appointmentId
    const appointmentIds = reviews
      .map(r => r.appointmentId)
      .filter((id): id is string => id !== null);

    const appointments = appointmentIds.length > 0
      ? await prisma.appointment.findMany({
          where: { id: { in: appointmentIds } },
          include: {
            service: {
              select: {
                name: true
              }
            },
            employee: { select: { firstName: true, lastName: true } }
          }
        })
      : [];

    const appointmentsMap = new Map(
      appointments.map(apt => [apt.id, apt])
    );

    // Format reviews for frontend
    const formattedReviews = reviews.map(review => {
      const appointment = review.appointmentId 
        ? appointmentsMap.get(review.appointmentId)
        : null;
      
      const appointmentDate = appointment?.startTime 
        ? new Date(appointment.startTime).toLocaleDateString('fr-FR')
        : null;

      // Employee name: prefer the review's stored employee, then the appointment's
      // legacy top-level employee.
      const employee =
        review.employee
          ? { firstName: review.employee.firstName, lastName: review.employee.lastName }
          : appointment?.employee
            ? { firstName: appointment.employee.firstName, lastName: appointment.employee.lastName }
            : null;

      return {
        id: review.id,
        salon: review.tenant?.name || 'Salon',
        salonImage: transformImageUrl(review.tenant?.coverImage || review.tenant?.logo || null),
        salonLocation: review.tenant?.address || review.tenant?.city || null,
        service: appointment?.service?.name || 'Service',
        employeeName: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : null,
        rating: review.rating,
        comment: review.comment || '',
        date: new Date(review.createdAt).toLocaleDateString('fr-FR'),
        appointmentDate: appointmentDate,
        detailedRatings: (review.metadata as any)?.detailedRatings || {
          quality: 0,
          professionalism: 0,
          cleanliness: 0,
          value: 0
        }
      };
    });

    return {
      reviews: formattedReviews
    };
  } catch (error) {
    throw error;
  }
  }

  async updateReview(id: string, body: any) {
    try {
    const { email, rating, comment, detailedRatings } = body;

    if (!email) {
      fail(400, {
        error: 'Email is required',
        message: 'Please provide your email to update the review.'
      });
    }

    // Find the review
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        client: true
      }
    });

    if (!review) {
      fail(404, {
        error: 'Review not found',
        message: 'The review was not found.'
      });
    }

    // Verify the review belongs to a client with this email
    if (review.client.email !== email) {
      fail(403, {
        error: 'Unauthorized',
        message: 'You can only update your own reviews.'
      });
    }

    // Prepare update data
    const updateData: any = {
      rating: rating !== undefined ? rating : review.rating,
      comment: comment !== undefined ? comment : review.comment
    };

    // Handle metadata with detailedRatings
    if (detailedRatings !== undefined) {
      const existingMetadata = (review.metadata as any) || {};
      updateData.metadata = {
        ...existingMetadata,
        detailedRatings
      };
    }

    // Update the review
    const updatedReview = await prisma.review.update({
      where: { id },
      data: updateData,
      include: {
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
        client: true
      }
    });

    // Get appointment if exists
    let appointment = null;
    if (review.appointmentId) {
      appointment = await prisma.appointment.findUnique({
        where: { id: review.appointmentId },
        include: {
          service: {
            select: {
              name: true
            }
          }
        }
      });
    }

    const appointmentDate = appointment?.startTime 
      ? new Date(appointment.startTime).toLocaleDateString('fr-FR')
      : null;

    return {
      review: {
        id: updatedReview.id,
        salon: updatedReview.tenant?.name || 'Salon',
        salonImage: transformImageUrl(updatedReview.tenant?.coverImage || updatedReview.tenant?.logo || null),
        salonLocation: updatedReview.tenant?.address || updatedReview.tenant?.city || null,
        service: appointment?.service?.name || 'Service',
        rating: updatedReview.rating,
        comment: updatedReview.comment || '',
        date: new Date(updatedReview.createdAt).toLocaleDateString('fr-FR'),
        appointmentDate: appointmentDate,
        detailedRatings: (updatedReview.metadata as any)?.detailedRatings || null
      },
      message: 'Review updated successfully'
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(400, {
        error: 'Validation error',
        message: error.errors[0].message
      });
    }
    throw error;
  }
  }

  async deleteReview(id: string, query: Record<string, unknown>) {
    try {
    const { email } = query;

    if (!email) {
      fail(400, {
        error: 'Email is required',
        message: 'Please provide your email to delete the review.'
      });
    }

    // Find the review
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        client: true
      }
    });

    if (!review) {
      fail(404, {
        error: 'Review not found',
        message: 'The review was not found.'
      });
    }

    // Verify the review belongs to a client with this email
    if (review.client.email !== decodeURIComponent(email as string)) {
      fail(403, {
        error: 'Unauthorized',
        message: 'You can only delete your own reviews.'
      });
    }

    // Delete the review
    await prisma.review.delete({
      where: { id }
    });

    return {
      message: 'Review deleted successfully'
    };
  } catch (error) {
    throw error;
  }
  }

}

export const clientReviewsService = new ClientReviewsService();
