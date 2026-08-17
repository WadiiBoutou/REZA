import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
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

/**
 * Resolve the effective client email from the AUTHENTICATED token (requireClientAuth
 * attaches req.clientEmail). If the request also supplies an email in the URL/body/query
 * (legacy callers), it must MATCH the token identity — otherwise reject, closing the
 * "harvested email reused as a mutation credential" attack chain entirely.
 */
function clientEmailFrom(req: Request, supplied?: unknown): string {
  const tokenEmail = (req as Request & { clientEmail?: string }).clientEmail;
  if (!tokenEmail) {
    throw new HttpError(401, {
      error: 'Unauthorized',
      message: 'Veuillez vous connecter pour accéder à vos données.',
    });
  }
  if (supplied !== undefined && supplied !== null) {
    const raw = String(supplied);
    if (raw.trim() !== '') {
      const norm = raw.trim().toLowerCase();
      if (norm !== tokenEmail) {
        throw new HttpError(403, {
          error: 'Forbidden',
          message: "Vous ne pouvez pas accéder aux données d'un autre compte.",
        });
      }
    }
  }
  return tokenEmail;
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

  async getClientAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, req.params.email);
      const result = await clientAppointmentsService.getClientAppointments(email, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async cancelAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, (req.body as any)?.email);
      const result = await bookingService.cancelAppointment(req.params.id, { ...req.body, email });
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getClientReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, req.params.email);
      const result = await clientReviewsService.getClientReviews(email, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async updateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, (req.body as any)?.email);
      const result = await clientReviewsService.updateReview(req.params.id, { ...req.body, email });
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async deleteReview(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, (req.query as any)?.email);
      const result = await clientReviewsService.deleteReview(req.params.id, { ...req.query, email });
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getClientNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, req.params.email);
      const result = await clientNotificationsService.getClientNotifications(email, req.query);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req);
      const result = await clientNotificationsService.markNotificationRead(req.params.id, email);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getFamilyMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, req.params.email);
      const result = await familyMembersService.getFamilyMembers(email);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async createFamilyMember(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, (req.body as any)?.clientEmail);
      const result = await familyMembersService.createFamilyMember({ ...req.body, clientEmail: email });
      res.status(201).json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async updateFamilyMember(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, (req.body as any)?.clientEmail);
      const result = await familyMembersService.updateFamilyMember(req.params.id, { ...req.body, clientEmail: email });
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async deleteFamilyMember(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, (req.query as any)?.clientEmail);
      const result = await familyMembersService.deleteFamilyMember(req.params.id, { ...req.query, clientEmail: email });
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
      const parsed = z
        .object({ email: z.string().trim().min(1).max(320).email() })
        .safeParse(req.query);
      if (!parsed.success) {
        throw new HttpError(400, { error: 'INVALID_EMAIL', message: 'Email invalide' });
      }
      const result = await clientAuthService.checkEmailExists(parsed.data.email);
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

  async forgotClientPasswordCode(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await clientAuthService.forgotClientPasswordCode(req.body);
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
      const email = clientEmailFrom(req, req.params.email);
      const result = await favoritesService.getClientFavorites(email);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async addFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, (req.body as any)?.clientEmail);
      const result = await favoritesService.addFavorite({ ...req.body, clientEmail: email });
      res.status(201).json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async updateClientProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, req.params.email);
      const result = await clientAccountService.updateClientProfile(email, req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async getClientProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, req.params.email);
      const result = await clientAccountService.getClientProfile(email);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async sendClientPasswordCode(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, req.params.email);
      const result = await clientAccountService.sendClientPasswordCode(email, req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async changeClientPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, req.params.email);
      const result = await clientAccountService.changeClientPassword(email, req.body);
      res.json(result);
    } catch (error) {
      if (handlePublicError(error, res, next)) return;
      next(error);
    }
  }

  async removeFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const email = clientEmailFrom(req, (req.query as any)?.clientEmail);
      const result = await favoritesService.removeFavorite(req.params.id, { ...req.query, clientEmail: email });
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
