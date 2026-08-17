import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clientId?: string;
      clientEmail?: string;
    }
  }
}

/**
 * Client-facing authentication (public client account endpoints).
 *
 * Verifies a Bearer JWT issued at /public/auth/client-login (or email
 * verification). The token carries { clientId, email, role: 'CLIENT' } — a
 * deliberately distinct shape from staff tokens (which carry userId + tenantId),
 * so a client token can never pass the staff authenticateRequest middleware and
 * a staff token can never pass here.
 *
 * On success attaches req.clientId / req.clientEmail (from the TOKEN, never
 * from client-supplied input) so handlers scope DB operations to the identity
 * proven by the token.
 */
export async function requireClientAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpError(401, {
        error: 'Unauthorized',
        message: 'Veuillez vous connecter pour accéder à vos données.',
      });
    }

    const decoded = verifyToken(authHeader.substring(7));
    if (!decoded || decoded.role !== 'CLIENT' || !decoded.clientId) {
      throw new HttpError(401, {
        error: 'Invalid token',
        message: 'Session expirée ou invalide. Veuillez vous reconnecter.',
      });
    }

    const client = await prisma.client.findUnique({
      where: { id: decoded.clientId },
      select: { id: true, email: true },
    });
    if (!client || !client.email) {
      throw new HttpError(401, {
        error: 'Invalid token',
        message: 'Session invalide. Veuillez vous reconnecter.',
      });
    }

    req.clientId = client.id;
    req.clientEmail = client.email.toLowerCase();
    next();
  } catch (error) {
    next(error);
  }
}
