'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Client location for the homepage carousels.
 *
 * - On mount, silently resolves an IP-based city-level estimate (NO permission
 *   prompt). If the browser granted precise GPS earlier in this session, that
 *   stored position wins instead.
 * - requestPreciseLocation() only prompts for browser geolocation when the user
 *   explicitly clicks the "Utiliser ma position précise" control.
 * - If every IP lookup fails, location stays null → the UI treats it as
 *   "unknown" (no distances shown, rating-only ranking).
 *
 * The lookup + result are cached at module level so every section on the page
 * shares one request and one location.
 */

export type ClientLocation = {
  lat: number;
  lng: number;
  source: 'ip' | 'gps';
  city?: string | null;
};

const PRECISE_STORAGE_KEY = 'reza_precise_location';

const listeners = new Set<(loc: ClientLocation | null) => void>();
let current: ClientLocation | null = null;
let ipPromise: Promise<ClientLocation | null> | null = null;

function parseCoords(
  data: any
): { lat: number; lng: number; city?: string | null } | null {
  const lat = Number(data?.latitude);
  const lng = Number(data?.longitude);
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  ) {
    return { lat, lng, city: data?.city || null };
  }
  return null;
}

function emit(loc: ClientLocation | null) {
  current = loc;
  listeners.forEach((fn) => fn(loc));
}

/** Free, keyless, CORS-enabled IP geolocation providers (tried in order). */
const IP_PROVIDERS: Array<() => Promise<ClientLocation | null>> = [
  async () => {
    const res = await fetch('https://ipwho.is/');
    const data = await res.json();
    if (data && data.success === false) return null;
    const coords = parseCoords(data);
    return coords ? { ...coords, source: 'ip' } : null;
  },
  async () => {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    const coords = parseCoords(data);
    return coords ? { ...coords, source: 'ip' } : null;
  },
];

async function resolveIpLocation(): Promise<ClientLocation | null> {
  // A precise position granted earlier this session beats any IP estimate.
  if (typeof sessionStorage !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(PRECISE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.lat != null && parsed?.lng != null) {
          return { lat: parsed.lat, lng: parsed.lng, source: 'gps' };
        }
      }
    } catch {
      /* ignore */
    }
  }

  for (const provider of IP_PROVIDERS) {
    try {
      const loc = await provider();
      if (loc) return loc;
    } catch {
      // try next provider
    }
  }
  return null;
}

function getIpLocation(): Promise<ClientLocation | null> {
  if (!ipPromise) {
    ipPromise = resolveIpLocation()
      .then((loc) => {
        emit(loc);
        return loc;
      })
      .catch(() => {
        emit(null);
        return null;
      });
  }
  return ipPromise;
}

export function useClientLocation() {
  // Start from null; the effect below populates from the shared resolver so we
  // never initialize state from mutable module-level data (hydration safety).
  const [location, setLocation] = useState<ClientLocation | null>(null);

  useEffect(() => {
    listeners.add(setLocation);
    void getIpLocation().then((loc) => {
      // Only overwrite if nothing more precise has arrived in the meantime.
      setLocation((prev) => (prev?.source === 'gps' ? prev : loc));
    });
    return () => {
      listeners.delete(setLocation);
    };
  }, []);

  /** Browser GPS — prompts the user for permission. Returns null on deny/fail. */
  const requestPreciseLocation = useCallback(async (): Promise<ClientLocation | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 60_000,
        });
      });
      const loc: ClientLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        source: 'gps',
      };
      try {
        sessionStorage.setItem(PRECISE_STORAGE_KEY, JSON.stringify(loc));
      } catch {
        /* ignore */
      }
      emit(loc);
      setLocation(loc);
      return loc;
    } catch {
      // Denied / unavailable → keep the IP estimate, never block.
      return null;
    }
  }, []);

  return { location, requestPreciseLocation };
}
