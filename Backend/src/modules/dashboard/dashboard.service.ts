import { prisma } from '../../lib/prisma';
import * as log from '../../utils/logger';

export class DashboardService {
  async getApprovedReviews(tenantId: string) {
    const reviews = await prisma.review.findMany({
      where: {
        tenantId,
        status: 'APPROVED'
      },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Fetch appointment data for reviews
    const reviewsWithAppointments = await Promise.all(
      reviews.map(async (review) => {
        let appointment = null;
        if (review.appointmentId) {
          try {
            appointment = await prisma.appointment.findUnique({
              where: { id: review.appointmentId },
              include: {
                service: { select: { name: true } },
                employee: { select: { firstName: true, lastName: true } }
              }
            });
          } catch (error) {
            log.error('Error fetching appointment for review:', error);
          }
        }
        return { ...review, appointment };
      })
    );

    return { reviews: reviewsWithAppointments };
  }

  async getRejectedReviews(tenantId: string) {
    const reviews = await prisma.review.findMany({
      where: {
        tenantId,
        status: 'REJECTED'
      },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    const reviewsWithAppointments = await Promise.all(
      reviews.map(async (review) => {
        let appointment = null;
        if (review.appointmentId) {
          try {
            appointment = await prisma.appointment.findUnique({
              where: { id: review.appointmentId },
              include: {
                service: { select: { name: true } },
                employee: { select: { firstName: true, lastName: true } }
              }
            });
          } catch (error) {
            log.error('Error fetching appointment for review:', error);
          }
        }
        return { ...review, appointment };
      })
    );

    return { reviews: reviewsWithAppointments };
  }

  async getReviewStatistics(tenantId: string) {
    const allReviews = await prisma.review.findMany({
      where: { tenantId },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const totalReviews = allReviews.length;
    const pendingReviews = allReviews.filter(r => r.status === 'PENDING').length;
    const approvedReviews = allReviews.filter(r => r.status === 'APPROVED').length;
    const rejectedReviews = allReviews.filter(r => r.status === 'REJECTED').length;

    const ratingsSum = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const averageRating = totalReviews > 0 ? ratingsSum / totalReviews : 0;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allReviews.forEach((r) => {
      if (r.rating) distribution[r.rating]++;
    });
    const ratingDistribution = Object.entries(distribution).map(([rating, count]) => ({
      rating: Number(rating),
      count
    }));

    // Calculate trends for last month
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthReviews = allReviews.filter((r) => {
      const reviewDate = new Date(r.createdAt);
      return reviewDate >= lastMonthStart && reviewDate <= now;
    });
    const lastMonthApproved = lastMonthReviews.filter(r => r.status === 'APPROVED').length;
    const lastMonthRejected = lastMonthReviews.filter(r => r.status === 'REJECTED').length;
    const lastMonthRatingsSum = lastMonthReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const lastMonthAvgRating = lastMonthReviews.length > 0 ? lastMonthRatingsSum / lastMonthReviews.length : 0;

    return {
      stats: {
        totalReviews,
        pendingReviews,
        approvedReviews,
        rejectedReviews,
        averageRating,
        totalViews: 0,
        ratingDistribution,
        trendsLastMonth: {
          total: lastMonthReviews.length,
          approved: lastMonthApproved,
          rejected: lastMonthRejected,
          averageRating: lastMonthAvgRating
        }
      },
      reviews: allReviews
    };
  }
}

export const dashboardService = new DashboardService();
