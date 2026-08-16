import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { serviceService } from './service.service';
import { createServiceSchema, updateServiceSchema } from './service.schema';
import { isSalonRequiredError, resolveWriteTenantId } from '../../utils/salonScope';

export class ServiceController {
  async getServices(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          error: 'Tenant identification required',
          message: 'Unable to determine tenant'
        });
      }

      const { category, search } = req.query;
      const result = await serviceService.getServices(
        req.salonIds || [req.tenantId],
        category as string,
        search as string
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getServiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await serviceService.getServiceById(req.tenantId!, req.params.id);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }
      res.json({ service });
    } catch (error) {
      next(error);
    }
  }

  async setCategories(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenantId) {
        return res.status(401).json({
          error: 'Tenant identification required',
          message: 'Unable to determine tenant'
        });
      }
      const { categories } = z
        .object({ categories: z.array(z.string()).optional().default([]) })
        .parse(req.body);
      const tenantIds = req.salonIds || [req.tenantId];
      const result = await serviceService.setCategories(tenantIds, categories);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createService(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createServiceSchema.parse(req.body);
      const tenantId = resolveWriteTenantId(req, (req.body as { tenantId?: string }).tenantId);
      const service = await serviceService.createService(tenantId, data);
      res.status(201).json({ service });
    } catch (error: any) {
      if (isSalonRequiredError(error)) {
        return res.status(400).json({ error: 'Salon required', message: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      next(error);
    }
  }

  async updateService(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateServiceSchema.parse(req.body);
      const service = await serviceService.updateService(req.tenantId!, req.params.id, data);
      res.json({ service });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      if (error.message === 'SERVICE_NOT_FOUND') {
        return res.status(404).json({ error: 'Service not found' });
      }
      next(error);
    }
  }

  async deleteService(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await serviceService.deleteService(req.tenantId!, req.params.id);
      res.json({ 
        message: 'Service deleted successfully', 
        deletedAppointmentsCount: result.deletedAppointmentsCount 
      });
    } catch (error: any) {
      if (error.message === 'SERVICE_NOT_FOUND') {
        return res.status(404).json({ error: 'Service not found' });
      }
      if (error.message.startsWith('HAS_INVOICES')) {
        const parts = error.message.split(':');
        return res.status(400).json({
          error: 'Cannot delete service',
          message: `This service cannot be deleted because ${parts[1]} of its ${parts[2]} appointment(s) have associated invoices. Please handle the invoices first.`
        });
      }
      next(error);
    }
  }
}

export const serviceController = new ServiceController();
