import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../lib/prisma';
import { accountService } from '../modules/account/account.service';
import * as log from '../utils/logger';

export type AuthResult =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Verify Bearer JWT, load user, attach req.user / req.userId / req.tenantId.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized', message: 'Authentication token required' }
    };
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded || !decoded.userId) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Invalid token', message: 'The provided token is invalid or expired' }
    };
  }

  if (!decoded.tenantId) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'Invalid token',
        message: 'Token does not contain tenant information. Please log in again.'
      }
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      tenantId: true,
      isActive: true
    }
  });

  if (!user) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'User not found',
        message: 'The user associated with this token no longer exists'
      }
    };
  }

  if (!user.isActive) {
    return {
      ok: false,
      status: 403,
      body: { error: 'Account inactive', message: 'Your account has been deactivated' }
    };
  }

  const tokenTenantId = decoded.tenantId;
  let finalTenantId = user.tenantId;
  if (tokenTenantId !== user.tenantId) {
    // Multi-salon: account owners may operate any salon in their account
    // via a token re-issued for that salon (switch-salon).
    const ownsTenant = await accountService.userOwnsTenant(user.id, tokenTenantId);
    if (!ownsTenant) {
      return {
        ok: false,
        status: 403,
        body: {
          error: 'Tenant mismatch',
          message: 'User does not belong to the specified tenant',
        },
      };
    }
    finalTenantId = tokenTenantId;
  }

  if (!finalTenantId || finalTenantId === 'default') {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'Account update required',
        message: 'Your account needs to be updated. Please log out and log back in.'
      }
    };
  }

  req.userId = user.id;
  req.tenantId = finalTenantId;
  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: finalTenantId
  };

  return { ok: true };
}

/** Stricter variant: user.tenantId must match token tenantId */
export async function authenticateRequestStrictTenant(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized', message: 'Authentication token required' }
    };
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'Invalid token',
        message: 'The provided token is invalid or expired. Please log in again.'
      }
    };
  }

  if (!decoded.userId) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'Invalid token',
        message: 'Token does not contain user information. Please log in again.',
      },
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, role: true, tenantId: true, isActive: true }
  });

  // Global SUPER_ADMIN tokens carry no tenantId
  if (!decoded.tenantId) {
    if (user && user.isActive && user.role === 'SUPER_ADMIN') {
      req.userId = user.id;
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: ''
      };
      return { ok: true };
    }
    return {
      ok: false,
      status: 401,
      body: {
        error: 'Invalid token',
        message: 'Token does not contain tenant information. Please log in again.'
      }
    };
  }

  if (!user) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'User not found',
        message: 'The user associated with this token no longer exists'
      }
    };
  }

  if (!user.isActive) {
    return {
      ok: false,
      status: 403,
      body: { error: 'Account inactive', message: 'Your account has been deactivated' }
    };
  }

  if (user.tenantId !== decoded.tenantId) {
    // Multi-salon: account owners may operate any salon in their account
    const ownsTenant = await accountService.userOwnsTenant(user.id, decoded.tenantId);
    if (!ownsTenant) {
      return {
        ok: false,
        status: 403,
        body: { error: 'Tenant mismatch', message: 'User does not belong to the specified tenant' }
      };
    }
  }

  if (decoded.tenantId === 'default') {
    return {
      ok: false,
      status: 403,
      body: { error: 'Account update required', message: 'Invalid tenant configuration.' }
    };
  }

  req.userId = user.id;
  req.tenantId = decoded.tenantId;
  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: decoded.tenantId
  };

  return { ok: true };
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authenticateRequestStrictTenant(req);
    if (result.ok === false) {
      return res.status(result.status).json(result.body);
    }
    next();
  } catch (error) {
    log.error('Auth middleware error:', error);
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'An error occurred while verifying your authentication'
    });
  }
};

/**
 * Auth for global SUPER_ADMIN: verifies JWT + role, no tenant required
 * (superadmin users have no tenantId).
 */
export const superAdminAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ error: 'Unauthorized', message: 'Authentication token required' });
    }

    const decoded = verifyToken(authHeader.substring(7));
    if (!decoded || !decoded.userId) {
      return res
        .status(401)
        .json({ error: 'Invalid token', message: 'The provided token is invalid or expired' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, tenantId: true, isActive: true }
    });

    if (!user) {
      return res
        .status(401)
        .json({ error: 'User not found', message: 'The user associated with this token no longer exists' });
    }
    if (!user.isActive) {
      return res
        .status(403)
        .json({ error: 'Account inactive', message: 'Your account has been deactivated' });
    }
    if (user.role !== 'SUPER_ADMIN') {
      return res
        .status(403)
        .json({ error: 'Forbidden', message: 'Superadmin access required' });
    }

    req.userId = user.id;
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? ''
    };
    next();
  } catch (error) {
    log.error('SuperAdmin auth middleware error:', error);
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'An error occurred while verifying your authentication'
    });
  }
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource'
      });
    }
    next();
  };
};
