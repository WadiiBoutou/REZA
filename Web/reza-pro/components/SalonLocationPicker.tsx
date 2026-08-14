'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Loader2,
  MapPin,
  Maximize,
  Minimize,
  Search,
} from 'lucide-react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type LatLng = { lat: number; lng: number };

type SalonLocationPickerProps = {
  value: LatLng | null;
  onChange: (coords: LatLng) => void;
  onAddressSuggest?: (suggestion: { address?: string; city?: string }) => void;
  className?: string;
};

type PlaceSuggestion = {
  lat: number;
  lng: number;
  label: string;
  distanceKm?: number;
};

const DEFAULT_CENTER: LatLng = { lat: 33.5731, lng: -7.5898 };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

async function reverseGeocode(lat: number, lng: number): Promise<{ address?: string; city?: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address || {};
    const city =
      addr.city || addr.town || addr.village || addr.municipality || addr.county || undefined;
    const road = addr.road || addr.neighbourhood || addr.suburb;
    const house = addr.house_number;
    const address = road ? (house ? `${house} ${road}` : road) : data?.display_name?.split(',')[0];
    return { address, city };
  } catch {
    return null;
  }
}

async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      query
    )}&limit=6&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((item: any) => {
        const lat = parseFloat(item?.lat);
        const lng = parseFloat(item?.lon);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        return { lat, lng, label: item?.display_name || `${lat}, ${lng}` };
      })
      .filter((x: PlaceSuggestion | null): x is PlaceSuggestion => x !== null);
  } catch {
    return [];
  }
}

export default function SalonLocationPicker({
  value,
  onChange,
  onAddressSuggest,
  className,
}: SalonLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReverseAt = useRef(0);
  const onChangeRef = useRef(onChange);
  const onAddressSuggestRef = useRef(onAddressSuggest);
  const valueRef = useRef(value);
  const mapActiveRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapActive, setMapActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  onChangeRef.current = onChange;
  onAddressSuggestRef.current = onAddressSuggest;
  valueRef.current = value;

  const suggestFromCoords = (coords: LatLng) => {
    if (!onAddressSuggestRef.current) return;
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(async () => {
      const now = Date.now();
      if (now - lastReverseAt.current < 1100) return;
      lastReverseAt.current = now;
      const suggestion = await reverseGeocode(coords.lat, coords.lng);
      if (suggestion) onAddressSuggestRef.current?.(suggestion);
    }, 400);
  };

  const placeMarker = (coords: LatLng, fly = false) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([coords.lat, coords.lng]);
    } else {
      markerRef.current = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(map);
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current?.getLatLng();
        if (!pos) return;
        const next = { lat: pos.lat, lng: pos.lng };
        onChangeRef.current(next);
        suggestFromCoords(next);
      });
    }

    if (fly) {
      map.flyTo([coords.lat, coords.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    } else {
      map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 14));
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import('leaflet');

      // Fix default marker icons in bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;
      const initial = valueRef.current || DEFAULT_CENTER;
      const map = L.map(containerRef.current, {
        center: [initial.lat, initial.lng],
        zoom: valueRef.current ? 15 : 12,
        // Scroll-zoom stays off until the admin clicks the map once — this
        // prevents page scroll from getting trapped over the map.
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (e) => {
        // First interaction activates wheel zoom for the rest of the session.
        if (!mapActiveRef.current) {
          mapActiveRef.current = true;
          setMapActive(true);
          try {
            map.scrollWheelZoom.enable();
          } catch {
            /* ignore */
          }
        }
        const next = { lat: e.latlng.lat, lng: e.latlng.lng };
        onChangeRef.current(next);
        placeMarker(next);
        suggestFromCoords(next);
      });

      mapRef.current = map;
      if (valueRef.current) placeMarker(valueRef.current);
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 100);
    }

    void init();

    return () => {
      cancelled = true;
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady || !value) return;
    const current = markerRef.current?.getLatLng();
    if (
      current &&
      Math.abs(current.lat - value.lat) < 1e-7 &&
      Math.abs(current.lng - value.lng) < 1e-7
    ) {
      return;
    }
    placeMarker(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mapReady]);

  // Reflow the map when toggling fullscreen (container size changes). While
  // fullscreen the map covers the page, so wheel input must zoom the map
  // itself instead of scrolling the page behind it; restoring the click-to-
  // activate state on exit keeps the embedded map scroll-trap-free.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    try {
      if (isFullscreen) {
        map.scrollWheelZoom.enable();
      } else if (!mapActiveRef.current) {
        map.scrollWheelZoom.disable();
      }
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => {
      try {
        mapRef.current?.invalidateSize();
      } catch {
        /* ignore */
      }
    }, 120);
    return () => clearTimeout(t);
  }, [isFullscreen, mapReady]);

  // Debounced search-as-you-type with distance (GPS) sorting.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const places = await searchPlaces(q);
      let list = places;
      if (userCoords) {
        list = places
          .map((p) => ({ ...p, distanceKm: haversineKm(userCoords.lat, userCoords.lng, p.lat, p.lng) }))
          .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      }
      setSuggestions(list);
      setShowSuggestions(list.length > 0);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, userCoords]);

  const applyCoords = (found: LatLng, label?: string) => {
    onChangeRef.current(found);
    placeMarker(found, true);
    suggestFromCoords(found);
    if (label) setSearchQuery(label);
    setShowSuggestions(false);
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    const places = await searchPlaces(q);
    if (places.length === 0) {
      setSearching(false);
      setError('Lieu introuvable. Essayez une autre recherche.');
      return;
    }
    const first = places[0];
    setSearching(false);
    applyCoords({ lat: first.lat, lng: first.lng }, first.label.split(',').slice(0, 2).join(','));
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Géolocalisation non disponible sur cet appareil');
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        applyCoords(coords);
        setGeoLoading(false);
      },
      () => {
        setError("Impossible d'obtenir votre position");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Emplacement sur la carte *
      </label>

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <div className="flex flex-1 gap-2 relative z-40">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="Rechercher un lieu (ex. Racine, Casablanca)"
              className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
            />
            {searching && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
            )}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyCoords({ lat: s.lat, lng: s.lng }, s.label.split(',').slice(0, 2).join(','))}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <span className="truncate">{s.label}</span>
                      {s.distanceKm != null && (
                        <span className="shrink-0 text-[11px] font-medium text-gray-400">
                          {formatDistance(s.distanceKm)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={searching || !searchQuery.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 hover:border-[#002366] hover:text-[#002366] disabled:opacity-50"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            Chercher
          </button>
        </div>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={geoLoading}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-700 hover:border-[#002366] hover:text-[#002366] disabled:opacity-50"
          title="Utiliser ma position (optionnel)"
        >
          {geoLoading ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
          Ma position
        </button>
      </div>

      {/* Map container — becomes a fixed fullscreen overlay when expanded.
          NOTE: the fullscreen branch must NOT also include `relative`/`z-0`/
          `rounded-xl`/`border`: Tailwind emits `relative` AFTER `fixed` in the
          stylesheet, so position:relative would win and `inset-0` would
          collapse the container to zero height instead of covering the screen. */}
      <div
        className={
          isFullscreen
            ? 'fixed inset-0 z-[100] overflow-hidden'
            : 'relative w-full h-80 sm:h-[420px] rounded-xl border border-gray-200 overflow-hidden z-0'
        }
      >
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />

        {!mapActive && !isFullscreen && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] pointer-events-none bg-black/70 text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow-lg">
            Cliquez sur la carte pour activer le zoom
          </div>
        )}

        {/* Fullscreen toggle — bottom right */}
        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          className="absolute bottom-3 right-3 z-[500] w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-[#002366] transition-all"
          title={isFullscreen ? 'Réduire la carte' : 'Plein écran'}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>

        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-3 right-3 z-[500] px-4 py-2 rounded-full bg-white shadow-md border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Fermer (plein écran)
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        {value ? (
          <>
            <span className="font-mono text-gray-700">
              lat {value.lat.toFixed(6)} · lng {value.lng.toFixed(6)}
            </span>
            <span className="text-green-700">Pin défini</span>
          </>
        ) : (
          <span className="text-amber-700">Aucun pin — cliquez sur la carte pour en placer un</span>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
