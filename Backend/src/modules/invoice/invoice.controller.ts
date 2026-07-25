import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { invoiceService } from './invoice.service';
import { createInvoiceSchema, createSaleSchema, updateInvoiceSchema } from './invoice.schema';
import { isSalonRequiredError, resolveWriteTenantId } from '../../utils/salonScope';

export class InvoiceController {
  async getInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, type } = req.query;
      const invoices = await invoiceService.getInvoices(
        req.salonIds || [req.tenantId!],
        status as string,
        type as string
      );
      res.json({ invoices });
    } catch (error) {
      next(error);
    }
  }

  async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await invoiceService.getInvoiceById(
        req.salonIds || [req.tenantId!],
        req.params.id
      );
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json({ invoice });
    } catch (error) {
      next(error);
    }
  }

  async createInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createInvoiceSchema.parse(req.body);
      const tenantId = resolveWriteTenantId(req, (req.body as any).tenantId);
      const salonIds = req.salonIds || [tenantId];
      const invoice = await invoiceService.createInvoice(tenantId, data, salonIds);
      res.status(201).json({ invoice });
    } catch (error: any) {
      if (isSalonRequiredError(error)) {
        return res.status(400).json({ error: 'Salon required', message: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      if (error.message === 'CLIENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Client not found' });
      }
      if (error.message === 'APPOINTMENT_NOT_FOUND') {
        return res.status(404).json({
          error: 'Appointment not found',
          message: 'The specified appointment does not exist or does not belong to your establishment.'
        });
      }
      if (error.message === 'CLIENT_MISMATCH') {
        return res.status(400).json({
          error: 'Client mismatch',
          message: 'The specified appointment does not belong to the selected client.'
        });
      }
      next(error);
    }
  }

  async createSale(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createSaleSchema.parse(req.body);
      const tenantId = resolveWriteTenantId(req, data.tenantId);
      const salonIds = req.salonIds || [tenantId];
      const invoice = await invoiceService.createSale(tenantId, data, salonIds);
      res.status(201).json({ invoice });
    } catch (error: any) {
      if (isSalonRequiredError(error)) {
        return res.status(400).json({ error: 'Salon required', message: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      if (error.message === 'CLIENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Client not found' });
      }
      if (error.message === 'CLIENT_WRONG_SALON') {
        return res.status(400).json({
          error: 'Client wrong salon',
          message: 'This client does not belong to the selected salon.'
        });
      }
      if (error.message === 'SERVICE_NOT_FOUND') {
        return res.status(404).json({
          error: 'Service not found',
          message: 'One or more services do not belong to this salon.'
        });
      }
      if (error.message === 'SERVICE_PRICE_REQUIRED') {
        return res.status(400).json({
          error: 'Service price required',
          message: 'A selected service has no price. Set a price override or update the catalog.'
        });
      }
      if (error.message === 'INVALID_AMOUNT') {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      if (error.message === 'APPOINTMENT_NOT_FOUND') {
        return res.status(404).json({
          error: 'Appointment not found',
          message: 'The specified appointment does not exist or does not belong to your establishment.'
        });
      }
      if (error.message === 'CLIENT_MISMATCH') {
        return res.status(400).json({
          error: 'Client mismatch',
          message: 'The specified appointment does not belong to the selected client.'
        });
      }
      if (error.message === 'APPOINTMENT_ALREADY_INVOICED') {
        return res.status(409).json({
          error: 'Appointment already invoiced',
          message: 'Une vente est déjà liée à ce rendez-vous.'
        });
      }
      next(error);
    }
  }

  async updateInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updateInvoiceSchema.parse(req.body);
      const invoice = await invoiceService.updateInvoice(
        req.salonIds || [req.tenantId!],
        req.params.id,
        data
      );
      res.json({ invoice });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', message: error.errors[0].message });
      }
      if (error.message === 'INVOICE_NOT_FOUND') {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      next(error);
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await invoiceService.getStats(req.salonIds || [req.tenantId!]);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
}

export const invoiceController = new InvoiceController();
