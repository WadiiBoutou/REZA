import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { cashTransactionService } from './cashTransaction.service';
import { createCashTransactionSchema } from './cashTransaction.schema';
import { isSalonRequiredError, resolveWriteTenantId } from '../../utils/salonScope';

export class CashTransactionController {
  async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, type, page = '1', limit = '100' } = req.query;
      const result = await cashTransactionService.getTransactions(
        req.salonIds || [req.tenantId!],
        startDate as string,
        endDate as string,
        type as string,
        parseInt(page as string),
        parseInt(limit as string)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTransactionById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await cashTransactionService.getTransactionById(
        req.salonIds || [req.tenantId!],
        req.params.id
      );
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error });
      }
      next(error);
    }
  }

  async createTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createCashTransactionSchema.parse(req.body);
      const tenantId = resolveWriteTenantId(req, (req.body as { tenantId?: string }).tenantId);
      const result = await cashTransactionService.createTransaction(tenantId, req.userId!, data);
      res.status(201).json(result);
    } catch (error: any) {
      if (isSalonRequiredError(error)) {
        return res.status(400).json({ error: 'Salon required', message: error.message });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.errors[0].message
        });
      }
      next(error);
    }
  }

  async deleteTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await cashTransactionService.deleteTransaction(
        req.salonIds || [req.tenantId!],
        req.params.id
      );
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error });
      }
      next(error);
    }
  }
}

export const cashTransactionController = new CashTransactionController();
