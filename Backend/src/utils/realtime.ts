import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifyToken } from './jwt';
import * as log from './logger';

let io: Server | null = null;

const parseOrigins = (envVar: string | undefined): string[] => {
  if (!envVar) return [];
  return envVar
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
};

function resolveOrigins(): string[] {
  return [
    ...parseOrigins(process.env.FRONTEND_URL),
    process.env.PRO_APP_URL,
    process.env.CLIENT_APP_URL,
    process.env.CLIENT_URL,
    // Always allow localhost for local development/testing
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
  ].filter((x): x is string => Boolean(x));
}

/**
 * Attach Socket.IO to the existing HTTP server. The socket path lives under
 * /api so it works through the Next.js rewrites (polling fallback) and
 * connects directly in production.
 *
 * Authentication: the client sends its JWT via `auth.token` in the handshake.
 * Only authenticated users can connect — each one gets a `user:<id>` room so
 * we can push targeted events later if needed.
 */
export function initRealtime(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    path: '/api/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (process.env.NODE_ENV !== 'production') return callback(null, true);
        const origins = resolveOrigins();
        if (origins.includes(origin)) return callback(null, true);
        log.warn('🚫 Socket CORS blocked origin:', origin);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Authentication token required'));
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) return next(new Error('Invalid token'));
    socket.data.userId = decoded.userId;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    log.log(`🔌 Socket connected: ${socket.id} (user ${userId})`);
    socket.on('disconnect', () => {
      log.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  log.log('🔌 Realtime (Socket.IO) initialized at /api/socket.io');
  return io;
}

export function getRealtime(): Server | null {
  return io;
}

/**
 * Push a lightweight "something changed" signal to every connected client.
 * Clients re-fetch their own notification scope on receipt — the payload is
 * intentionally minimal (no message text) so cross-tenant clients can't read
 * content they aren't allowed to see.
 */
export function emitNotification(notification: { id: string; type: string; createdAt: Date }) {
  try {
    io?.emit('notification:new', {
      id: notification.id,
      type: notification.type,
      createdAt: notification.createdAt,
    });
  } catch (error) {
    // Realtime is best-effort — never break the request that created the notification.
    log.warn('Realtime emit failed:', error);
  }
}
