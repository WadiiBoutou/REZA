import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { clientService } from './client.service';
import { createClientSchema, updateClientSchema } from './client.schema';
import { isSalonRequiredError, resolveWriteTenantId } from '../../utils/salonScope';
import { uploadImage } from '../../utils/cloudinary';

export class ClientController {
  async getClients(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, page = '1', limit = '50' } = req.query;
      const result = await clientService.getClients(
        req.salonIds || [req.tenantId!],
        search as string, 
        status as string, 
        parseInt(page as string), 
        parseInt(limit as string)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async detectDuplicates(req: Request, res: Response, next: NextFunction) {
    try {
      const duplicates = await clientService.detectDuplicates(req.salonIds || [req.tenantId!]);
      res.json({ duplicates });
    } catch (error) {
      next(error);
    }
  }

  async getClientById(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await clientService.getClientById(
        req.salonIds || [req.tenantId!],
        req.params.id
      );
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      res.json({ client });
    } catch (error) {
      next(error);
    }
  }

  async createClient(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createClientSchema.parse(req.body);
      const tenantId = resolveWriteTenantId(req, (req.body as any).tenantId);
      const client = await clientService.createClient(tenantId, data);
      res.status(201).json({ client });
    } catch (error: any) {
      if (isSalonRequiredError(error)) {
        return res.status(400).json({ error: 'Salon required', message: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      if (error.message === 'DUPLICATE_EMAIL') {
        return res.status(409).json({
          error: 'Duplicate client',
          message: 'A client with this email already exists'
        });
      }
      next(error);
    }
  }

  async updateClient(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateClientSchema.parse(req.body);
      const client = await clientService.updateClient(
        req.salonIds || [req.tenantId!],
        req.params.id,
        data
      );
      res.json({ client });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      if (error.message === 'CLIENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Client not found' });
      }
      next(error);
    }
  }

  async uploadAvatar(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded',
          message: 'Veuillez sélectionner une image'
        });
      }

      const avatar = await uploadImage(req.file, 'avatars');
      res.json({ avatar });
    } catch (error) {
      next(error);
    }
  }

  async deleteClient(req: Request, res: Response, next: NextFunction) {
    try {
      await clientService.deleteClient(req.salonIds || [req.tenantId!], req.params.id);
      res.json({ message: 'Client deleted successfully' });
    } catch (error: any) {
      if (error.message === 'CLIENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Client not found' });
      }
      next(error);
    }
  }

  async mergeClients(req: Request, res: Response, next: NextFunction) {
    try {
      const { primaryClientId, duplicateClientIds, fields } = req.body;
      if (!primaryClientId || !Array.isArray(duplicateClientIds) || duplicateClientIds.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'primaryClientId and duplicateClientIds array are required'
        });
      }
      
      await clientService.mergeClients(
        req.salonIds || [req.tenantId!],
        primaryClientId,
        duplicateClientIds,
        fields
      );
      res.json({ 
        message: 'Clients merged successfully',
        mergedClientId: primaryClientId
      });
    } catch (error: any) {
      if (error.message === 'PRIMARY_CLIENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Primary client not found' });
      }
      if (error.message === 'DUPLICATE_CLIENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Some duplicate clients not found' });
      }
      next(error);
    }
  }
}

export const clientController = new ClientController();
