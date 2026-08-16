import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { tenantService } from './tenant.service';
import { createTenantSchema } from './tenant.schema';
import { isSalonRequiredError, resolveWriteTenantId } from '../../utils/salonScope';
import { subscriptionInvoiceService } from '../subscription/subscription-invoice.service';
import { uploadImage } from '../../utils/cloudinary';

export class TenantController {
  async getTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.getTenant(req.tenantId!);
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error });
      }
      next(error);
    }
  }

  async updateTenant(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createTenantSchema.partial().parse(req.body);
      const result = await tenantService.updateTenant(req.tenantId!, data);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.errors[0].message
        });
      }
      next(error);
    }
  }

  async getTenantSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.getTenantSettings(req.tenantId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateTenantSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.updateTenantSettings(req.tenantId!, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAppointmentDisplaySettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.getAppointmentDisplaySettings(req.tenantId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateAppointmentDisplaySettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.updateAppointmentDisplaySettings(req.tenantId!, req.body);
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error, message: error.message });
      }
      next(error);
    }
  }


  async getAppointmentNotificationEmails(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.getAppointmentNotificationEmails(req.tenantId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateAppointmentNotificationEmails(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.updateAppointmentNotificationEmails(req.tenantId!, req.body.emails);
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error, message: error.message });
      }
      next(error);
    }
  }

  async getBusinessHours(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = resolveWriteTenantId(req, (req.query as any).tenantId || (req.query as any).salonId);
      const result = await tenantService.getBusinessHours(tenantId);
      res.json(result);
    } catch (error: any) {
      if (isSalonRequiredError(error)) {
        return res.status(400).json({ error: 'Salon required', message: error.message });
      }
      next(error);
    }
  }

  async updateBusinessHours(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = resolveWriteTenantId(
        req,
        (req.body as { tenantId?: string }).tenantId || (req.body as { salonId?: string }).salonId
      );
      const result = await tenantService.updateBusinessHours(tenantId, req.body);
      res.json(result);
    } catch (error: any) {
      if (isSalonRequiredError(error)) {
        return res.status(400).json({ error: 'Salon required', message: error.message });
      }
      next(error);
    }
  }

  async getPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.getPaymentMethods(req.tenantId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async addPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.addPaymentMethod(req.tenantId!, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updatePaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.updatePaymentMethod(req.tenantId!, req.params.id, req.body);
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error });
      }
      next(error);
    }
  }

  async deletePaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.deletePaymentMethod(req.tenantId!, req.params.id);
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error });
      }
      next(error);
    }
  }

  async getSubscriptionInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionInvoiceService.listForTenant(req.tenantId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getHeaderImage(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.getHeaderImage(req.tenantId!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async uploadHeaderImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please select an image file to upload'
        });
      }

      const fileUrl = await uploadImage(req.file, 'header-images');
      const result = await tenantService.saveHeaderImage(req.tenantId!, fileUrl);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async uploadCoverImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Please select an image file to upload'
        });
      }

      const fileUrl = await uploadImage(req.file, 'cover-images');
      // Note: upload only stores the file and returns its URL. Persisting into
      // tenant.coverImage / settings.coverImages is done explicitly by the
      // frontend (informations-landing-page), so uploading never silently
      // overwrites the current primary cover image.
      res.json({ coverImage: fileUrl });
    } catch (error) {
      next(error);
    }
  }

  async getAcceptedPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      // A multi-salon owner may scope the list to one specific salon (the caisse
      // re-fetches it whenever the user picks a salon). Validate that the salon
      // is within the caller's scope before using it.
      const tenantIdParam = req.query.tenantId as string | undefined;
      let tenantId = req.tenantId!;
      if (tenantIdParam) {
        const scope = req.salonIds || [tenantId];
        if (!scope.includes(tenantIdParam)) {
          return res.status(403).json({
            error: 'Forbidden salon',
            message: 'Ce salon ne fait pas partie de votre compte.',
          });
        }
        tenantId = tenantIdParam;
      }
      const result = await tenantService.getAcceptedPaymentMethods(tenantId);
      res.json(result);
    } catch (error: any) {
      if (error.status) return res.status(error.status).json({ error: error.error });
      next(error);
    }
  }

  async addAcceptedPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Validation error', message: 'Payment method name is required' });
      }
      const result = await tenantService.addAcceptedPaymentMethod(req.tenantId!, name.trim());
      res.json(result);
    } catch (error: any) {
      if (error.status) return res.status(error.status).json({ error: error.error });
      next(error);
    }
  }

  async deleteAcceptedPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.params;
      const result = await tenantService.deleteAcceptedPaymentMethod(req.tenantId!, name);
      res.json(result);
    } catch (error: any) {
      if (error.status) return res.status(error.status).json({ error: error.error });
      next(error);
    }
  }

  async getAutoConfirmSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tenantService.getAutoConfirmSettings(req.tenantId!);
      res.json(result);
    } catch (error: any) {
      if (error.status) return res.status(error.status).json({ error: error.error });
      next(error);
    }
  }

  async updateAutoConfirmSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { enabled } = req.body;
      const result = await tenantService.updateAutoConfirmSettings(req.tenantId!, enabled);
      res.json(result);
    } catch (error: any) {
      if (error.status) return res.status(error.status).json({ error: error.error });
      next(error);
    }
  }

}

export const tenantController = new TenantController();
