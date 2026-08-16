import { Request, Response, NextFunction } from 'express';
import { Prisma } from '../../prisma/generated/prisma/client';
import { HttpError } from '../lib/errors';
import * as log from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError | Prisma.PrismaClientKnownRequestError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  log.error('========== ERROR HANDLER ==========');
  log.error('Error type:', err?.constructor?.name);
  log.error('Error message:', err?.message);
  log.error('Request path:', req.path);
  log.error('Request method:', req.method);

  if (err instanceof HttpError) {
    return res.status(err.status).json(err.payload);
  }

  // Legacy public module errors (isAppError in message)
  if (err instanceof Error && err.message.includes('isAppError')) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed.isAppError) {
        return res.status(parsed.status).json(parsed.payload);
      }
    } catch {
      // fall through
    }
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A record with this information already exists'
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Not found',
        message: 'The requested record was not found'
      });
    }
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while processing your request'
    });
  }

  // Custom application errors: never leak raw err.message to the client.
  // Full details are already logged above (type, message, path, method).
  const statusCode = (err as AppError).statusCode || 500;
  res.status(statusCode).json({
    error: 'Internal error',
    message: 'Une erreur interne est survenue. Veuillez réessayer.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

