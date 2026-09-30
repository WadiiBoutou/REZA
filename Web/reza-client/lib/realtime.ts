'use client';

/**
 * Realtime (Socket.IO) stub for reza-client.
 * The client app does not use live sockets — polling via the REST API is
 * sufficient. These no-ops keep any import sites happy without pulling in
 * socket.io-client as a dependency.
 */

export function getRealtimeSocket(): null {
  return null;
}

export function disconnectRealtime(): void {
  // no-op
}
