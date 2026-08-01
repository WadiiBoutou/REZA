import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { requireTenantId } from '../utils/tenantIsolation';
import { accountService } from '../modules/account/account.service';
import { parseSalonIdsInput } from '../utils/salonScope';
import * as log from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      /** Validated salon (tenant) IDs in read scope. Owners: 1..N; staff: single home tenant. */
      salonIds?: string[];
      userId?: string;
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId: string;
      };
    }
  }
}

/**
 * Validates tenant from authMiddleware (req.tenantId).
 * Resolves req.salonIds from X-Salon-Ids / salonIds (owners only; staff stay single-tenant).
 * x-tenant-id header is only accepted in non-production when ALLOW_TENANT_HEADER=true.
 */
export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let tenantId = req.tenantId;

    const allowDevTenantHeader =
      process.env.NODE_ENV !== 'production' && process.env.ALLOW_TENANT_HEADER === 'true';

    if (!tenantId && allowDevTenantHeader && req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'] as string;
    }

    if (!tenantId) {
      return res.status(401).json({
        error: 'Tenant identification required',
        message: 'Unable to determine tenant. Please provide a valid authentication token.',
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: 'The specified tenant does not exist.',
      });
    }

    if (!tenant.isActive) {
      return res.status(403).json({
        error: 'Tenant inactive',
        message: 'This tenant account has been deactivated.',
      });
    }

    req.tenantId = tenantId;

    try {
      requireTenantId(req);
    } catch (isolationError: any) {
      return res.status(403).json({
        error: 'Tenant validation failed',
        message: isolationError.message || 'Invalid tenant ID',
      });
    }

    // Multi-salon scope for account owners; staff always single home tenant
    const userId = req.userId || req.user?.id;
    if (userId) {
      const ctx = await accountService.getContextForUser(userId);
      const ownedIds = ctx.salons.map((s) => s.id);

      if (ownedIds.length > 0) {
        const requested = parseSalonIdsInput(req);
        if (requested === 'all') {
          req.salonIds = ownedIds;
        } else {
          const invalid = requested.filter((id) => !ownedIds.includes(id));
          if (invalid.length > 0) {
            return res.status(403).json({
              error: 'Forbidden salons',
              message: 'One or more salon ids are not part of your account.',
            });
          }
          req.salonIds = requested.length > 0 ? requested : ownedIds;
        }
      } else {
        // Staff / non-owner: ignore multi header, single tenant only
        req.salonIds = [tenantId];
      }
    } else {
      req.salonIds = [tenantId];
    }

    next();
  } catch (error: any) {
    log.error('[Tenant Middleware] Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while processing tenant identification.',
    });
  }
};
