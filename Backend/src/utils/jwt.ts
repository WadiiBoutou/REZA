import jwt from 'jsonwebtoken';
import * as log from './logger';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  log.warn('[JWT] JWT_SECRET not set — using insecure dev-only fallback');
  return 'dev-only-insecure-jwt-secret';
}

const JWT_SECRET = resolveJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  tenantId?: string;
  role: string;
}

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

