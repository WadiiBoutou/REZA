import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema';
import * as log from '../../utils/logger';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.errors[0].message
        });
      }
      if (error.status) {
        return res.status(error.status).json({ error: error.error, message: error.message });
      }
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => {
          if (err.path.includes('tenantId')) {
            return 'Tenant ID is required. If you are creating a new organization, please use the organization creation flow.';
          }
          return `${err.path.join('.')}: ${err.message}`;
        });
        return res.status(400).json({
          error: 'Validation error',
          message: errorMessages.join(', '),
          details: error.errors
        });
      }
      if (error.status) {
        return res.status(error.status).json({ error: error.error, message: error.message });
      }
      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      log.log('[Auth Controller /me] Request received, userId:', req.userId);

      if (!req.userId) {
        log.error('[Auth Controller /me] No userId in request');
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User ID not found in request'
        });
      }

      const result = await authService.getCurrentUser(req.userId, req.tenantId);
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error, message: error.message });
      }
      log.error('[Auth Controller /me] Error:', error);
      next(error);
    }
  }

  async switchSalon(req: Request, res: Response, next: NextFunction) {
    try {
      const schema = z.object({ tenantId: z.string().min(1) });
      const { tenantId } = schema.parse(req.body);
      const result = await authService.switchSalon(req.userId!, tenantId);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.errors[0].message
        });
      }
      if (error.status) {
        return res.status(error.status).json({ error: error.error, message: error.message });
      }
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(data, req);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.errors[0].message
        });
      }
      if (error.status) {
        return res.status(error.status).json({ error: error.error, message: error.message });
      }
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyEmail(req.body);
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error, message: error.message });
      }
      next(error);
    }
  }

  async resendVerificationEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resendVerificationEmail(req.body);
      res.json(result);
    } catch (error: any) {
      if (error.status) {
        return res.status(error.status).json({ error: error.error, message: error.message });
      }
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const data = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(data);
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.errors[0].message
        });
      }
      if (error.status) {
        return res.status(error.status).json({ error: error.error, message: error.message });
      }
      next(error);
    }
  }

  logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
