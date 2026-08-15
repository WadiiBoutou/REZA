import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../../lib/errors';
import { isRedirectError } from './utils/http';
import { discoveryService } from './services/discovery.service';
import { tenantCatalogService } from './services/tenant-catalog.service';
import { clientReviewsService } from './services/client-reviews.service';
import { bookingService } from './services/booking.service';
import { clientAppointmentsService } from './services/client-appointments.service';
import { clientNotificationsService } from './services/client-notifications.service';
import { familyMembersService } from './services/family-members.service';
import { clientAuthService } from './services/client-auth.service';
import { favoritesService } from './services/favorites.service';
import { uploadImage } from '../../utils/cloudinary';
import { clientAccountService } from './services/client-account.service';
import { earlyAccessService } from './services/early-access.service';
import { subscriptionService } from '../subscription/subscription.service';

function handlePublicError(error: unknown, res: Response, next: NextFunction): boolean {
  if (error instanceof HttpError) {
    res.status(error.status).json(error.payload);
    return true;
  }
  if (isRedirectError(error)) {
    res.redirect(error.url);
    return true;
  }
  return false;
}

export class PublicController {
  async getTenantByIdentifier(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await discoveryService.getTenantByIdentifier(req.params.identifier);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getTenantServices(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantCatalogService.getTenantServices(req.params.tenantId, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getTenantEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantCatalogService.getTenantEmployees(req.params.tenantId, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getTenantReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantCatalogService.getTenantReviews(req.params.tenantId, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getEmployeeStats(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantCatalogService.getEmployeeStats(req.params.tenantId, req.params.employeeId);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async createReview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientReviewsService.createReview(req.body);
      res.status(201).json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async searchTenants(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await discoveryService.searchTenants(req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await discoveryService.getCategories();
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getFeaturedEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantCatalogService.getFeaturedEmployees(req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getPublicBillingConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.getPublicBillingConfig();
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getFeaturedServices(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await discoveryService.getFeaturedServices(req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getFeaturedReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await discoveryService.getFeaturedReviews(req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async createBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.createBooking(req.body);
      res.status(201).json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getAvailableSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const query = { ...req.query };
      // Allow participants, existingParticipants, and client-lookup fallback params from POST body
      if (req.body?.participants && !query.participants) {
        query.participants = req.body.participants;
      }
      if (req.body?.existingParticipants && !query.existingParticipants) {
        query.existingParticipants = req.body.existingParticipants;
      }
      if (req.body?.clientPhone && !query.clientPhone) {
        query.clientPhone = req.body.clientPhone;
      }
      if (req.body?.clientEmail && !query.clientEmail) {
        query.clientEmail = req.body.clientEmail;
      }
      const result = await bookingService.getAvailableSlots(req.params.tenantId, query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async checkAvailableSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.getAvailableSlots(req.params.tenantId, { ...req.query, ...req.body });
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getAvailableDays(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.getAvailableDays(
        req.params.tenantId,
        req.query as Record<string, unknown>
      );
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getEmployeeAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const query = { ...req.query };
      if (req.body?.existingParticipants && !query.existingParticipants) {
        query.existingParticipants = req.body.existingParticipants;
      }
      const result = await bookingService.getEmployeeAvailability(req.params.tenantId, query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async validateParticipantAddition(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.validateParticipantAddition(req.params.tenantId, req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getClientAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAppointmentsService.getClientAppointments(req.params.email, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async cancelAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.cancelAppointment(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getClientReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientReviewsService.getClientReviews(req.params.email, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async updateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientReviewsService.updateReview(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async deleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientReviewsService.deleteReview(req.params.id, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getClientNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientNotificationsService.getClientNotifications(req.params.email, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientNotificationsService.markNotificationRead(req.params.id);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getFamilyMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await familyMembersService.getFamilyMembers(req.params.email);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async createFamilyMember(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await familyMembersService.createFamilyMember(req.body);
      res.status(201).json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async updateFamilyMember(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await familyMembersService.updateFamilyMember(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async deleteFamilyMember(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await familyMembersService.deleteFamilyMember(req.params.id, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async registerClient(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAuthService.registerClient(req.body);
      res.status(201).json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async uploadAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Veuillez sélectionner une image',
        });
      }
      const avatar = await uploadImage(req.file, 'avatars');
      res.json({ avatar });
    } catch (error) {
      next(error);
    }
  }

  async checkEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAuthService.checkEmailExists(String(req.query.email || ''));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async loginClient(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAuthService.loginClient(req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async forgotClientPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAuthService.forgotClientPassword(req.body, req);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async resetClientPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAuthService.resetClientPassword(req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async verifyClientEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAuthService.verifyClientEmail(req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async resendClientVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAuthService.resendClientVerification(req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getClientFavorites(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await favoritesService.getClientFavorites(req.params.email);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async addFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await favoritesService.addFavorite(req.body);
      res.status(201).json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async updateClientProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAccountService.updateClientProfile(req.params.email, req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async sendClientPasswordCode(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAccountService.sendClientPasswordCode(req.params.email, req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async changeClientPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAccountService.changeClientPassword(req.params.email, req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async removeFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await favoritesService.removeFavorite(req.params.id, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async signupEarlyAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await earlyAccessService.signupEarlyAccess(req.body);
      res.status(201).json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }
}

export const publicController = new PublicController();
