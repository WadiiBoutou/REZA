import { prisma } from '../../lib/prisma';
import { CreateReviewInput, UpdateReviewStatusInput } from './review.schema';
import * as log from '../../utils/logger';

export class ReviewService {
  async getReviews(tenantId: string, status?: string, clientId?: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = { tenantId };

    if (status) where.status = status;
    if (clientId) where.clientId = clientId;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          appointment: {
            include: {
              service: { select: { name: true } },
              employee: { select: { firstName: true, lastName: true } }
            }
          }
        }
      }),
      prisma.review.count({ where })
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    };
  }

  async createReview(tenantId: string, userId: string, input: CreateReviewInput) {
    const { clientId, appointmentId, rating, comment } = input;

    // Verify client belongs to tenant
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId
      }
    });

    if (!client) {
      throw {
        status: 404,
        error: 'Client not found'
      };
    }

    const review = await prisma.review.create({
      data: {
        tenantId,
        clientId,
        appointmentId,
        rating,
        comment,
        status: 'PENDING'
      },
      include: {
        client: true
      }
    });

    // Create notification for tenant users about new review pending moderation
    try {
      const tenantUsers = await prisma.user.findMany({
        where: {
          tenantId,
          isActive: true,
          role: {
            in: ['ADMIN', 'SUPER_ADMIN', 'STAFF', 'RECEPTIONIST']
          }
        },
        select: { id: true }
      });

      if (tenantUsers.length > 0) {
        await Promise.all(
          tenantUsers.map(user =>
            prisma.notification.create({
              data: {
                tenantId,
                userId: user.id,
                type: 'REVIEW_PENDING',
                title: 'Nouvel avis à modérer',
                message: `${review.client.firstName} ${review.client.lastName} a laissé un avis de ${rating} étoile${rating > 1 ? 's' : ''}${comment ? ' avec un commentaire' : ''}.`,
                link: `/dashboard/clients/mes-avis/avis-a-moderer`,
                metadata: {
                  reviewId: review.id,
                  clientId: review.clientId,
                  rating,
                  hasComment: !!comment
                }
              }
            })
          )
        );
      } else {
        await prisma.notification.create({
          data: {
            tenantId,
            userId: null,
            type: 'REVIEW_PENDING',
            title: 'Nouvel avis à modérer',
            message: `${review.client.firstName} ${review.client.lastName} a laissé un avis de ${rating} étoile${rating > 1 ? 's' : ''}${comment ? ' avec un commentaire' : ''}.`,
            link: `/dashboard/clients/mes-avis/avis-a-moderer`,
            metadata: {
              reviewId: review.id,
              clientId: review.clientId,
              rating,
              hasComment: !!comment
            }
          }
        });
      }
    } catch (notificationError) {
      log.error('Error creating notification for review:', notificationError);
    }

    return { review };
  }

  async updateReviewStatus(tenantId: string, userId: string, reviewId: string, input: UpdateReviewStatusInput) {
    const { status } = input;

    const review = await prisma.review.findFirst({
      where: {
        id: reviewId,
        tenantId
      }
    });

    if (!review) {
      throw {
        status: 404,
        error: 'Review not found'
      };
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        status,
        moderatedBy: userId,
        moderatedAt: new Date(),
        // Persist the rejection reason (cleared on non-rejection)
        rejectReason: status === 'REJECTED' ? input.rejectReason || null : null
      },
      include: {
        client: true
      }
    });

    return { review: updated };
  }

  /**
   * Hard-delete a review — RESTRICTED to REJECTED-status reviews (moderation purge).
   * Active/approved reviews can't be removed through this endpoint.
   */
  async deleteReview(tenantId: string, reviewId: string) {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, tenantId },
    });

    if (!review) {
      throw {
        status: 404,
        error: 'Review not found',
      };
    }

    if (review.status !== 'REJECTED') {
      throw {
        status: 400,
        error: 'Seuls les avis refusés peuvent être supprimés définitivement.',
      };
    }

    await prisma.review.delete({ where: { id: reviewId } });
    return { success: true };
  }
}

export const reviewService = new ReviewService();
