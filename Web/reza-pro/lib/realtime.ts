'use client';

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
let tokenAtConnect: string | null = null;

/**
 * Mirror of the api.ts base-url logic: relative `/api` when the frontend and
 * backend share an origin (Next.js rewrites), absolute URL otherwise.
 */
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:5000/api';
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  const currentOrigin = window.location.origin;

  if (!envUrl) return '/api';

  try {
    const envUrlObj = new URL(envUrl);
    if (envUrlObj.origin === currentOrigin) return '/api';
    if (
      (envUrl === 'http://localhost:5000/api' || envUrl === 'http://127.0.0.1:5000/api') &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(currentOrigin)
    ) {
      return '/api';
    }
  } catch {
    // fall through to absolute URL
  }

  const url = envUrl || 'https://api.reza.ma/api';
  const cleanUrl = url.replace(/\/$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
}

/**
 * Lazily connect a Socket.IO client authenticated with the stored JWT.
 * Backend listens at /api/socket.io (same origin rewrite in dev, direct in prod).
 */
export function getRealtimeSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;

  if (socket && tokenAtConnect === token && socket.connected) return socket;

  try {
    socket?.disconnect();
  } catch {
    /* ignore */
  }

  socket = io(getApiBaseUrl(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 15000,
  });
  tokenAtConnect = token;
  return socket;
}

export function disconnectRealtime() {
  try {
    socket?.disconnect();
  } catch {
    /* ignore */
  }
  socket = null;
  tokenAtConnect = null;
}
