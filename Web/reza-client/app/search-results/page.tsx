"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { Search, MapPin, Star, Clock, ArrowRight, SlidersHorizontal, Heart, Navigation, ListFilter, ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from 'lucide-react';
import ModalFilters from '../../components/ModalFilters';
import RezaNavbar from '../../components/Header';
import Footer from '../../components/Footer';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { filterCompleteTenants, formatTimeForDisplay, getImageUrl, getSalonHref } from '../../lib/utils';
import LocationAutocomplete from '../../components/LocationAutocomplete';

// Mock data removed - all data now comes from API

const sortOptions = [
	{ key: 'recommended', label: 'Recommandé' },
	{ key: 'rating', label: 'Meilleure note' },
	{ key: 'distance', label: 'Plus proche' },
	{ key: 'price', label: 'Prix' }
];

// Helper function to extract coordinates from Google Maps URL
const extractCoordinatesFromGoogleMapsUrl = async (url: string): Promise<{ lat: number; lng: number } | null> => {
	try {
		let finalUrl = url;
		
		// For short URLs like https://maps.app.goo.gl/..., we need to follow redirects
		if (url.includes('maps.app.goo.gl') || url.includes('goo.gl')) {
			try {
				// Try to fetch the redirect URL (may fail due to CORS)
				const response = await fetch(url, { 
					method: 'HEAD', 
					redirect: 'follow',
					mode: 'no-cors' // Use no-cors to avoid CORS issues, but we won't get the final URL
				});
				// Note: With no-cors, we can't access response.url, so we'll try to parse the original URL
				// or use a proxy service
			} catch (fetchError) {
				console.warn('[Search Results] Could not follow redirect for short URL, coordinates may not be extracted');
			}
		}
		
		// Try to extract coordinates from URL patterns
		// Pattern 1: @lat,lng (most common in Google Maps URLs)
		const atMatch = finalUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
		if (atMatch) {
			return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
		}
		
		// Pattern 2: ?q=lat,lng or &q=lat,lng
		const coordMatch = finalUrl.match(/[?&]q=([^&]+)/);
		if (coordMatch) {
			const query = decodeURIComponent(coordMatch[1]);
			const latLngMatch = query.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
			if (latLngMatch) {
				return { lat: parseFloat(latLngMatch[1]), lng: parseFloat(latLngMatch[2]) };
			}
		}
		
		// Pattern 3: /place/.../@lat,lng
		const placeMatch = finalUrl.match(/\/place\/[^/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
		if (placeMatch) {
			return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
		}
	} catch (error) {
		console.warn('[Search Results] Error extracting coordinates from Google Maps URL:', error);
	}
	return null;
};

function LuxurySearchResultsContent() {
	const searchParams = useSearchParams();
	const [query, setQuery] = useState(searchParams?.get('query') || searchParams?.get('q') || '');
	const [location, setLocation] = useState(searchParams?.get('location') || '');
	const [results, setResults] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedSalon, setSelectedSalon] = useState<string | null>(null);
	const [selectedSalonDetails, setSelectedSalonDetails] = useState<any | null>(null);
	const [galleryIndex, setGalleryIndex] = useState(0);
	const [mapFullscreen, setMapFullscreen] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [sortBy, setSortBy] = useState('recommended');
	const [likedSalons, setLikedSalons] = useState(new Set<string>());
	const [favoritesMap, setFavoritesMap] = useState<Map<string, string>>(new Map()); // Map of tenantId -> favoriteId
	const [showMobileMap, setShowMobileMap] = useState(false);
	const { user, isAuthenticated } = useAuth();
	const [filterValues, setFilterValues] = useState({
		availability: '',
		selectedDate: null as Date | null,
		selectedTime: null as string | null,
		rating: null as number | null,
		priceRange: [0, 1000] as [number, number],
		categories: [] as string[],
		distance: 10,
		bestPro: false,
	});

	const mapRef = useRef<HTMLDivElement | null>(null);
	const leafletMapRef = useRef<any>(null);
	const markersLayerRef = useRef<any>(null);
	const markersRef = useRef<any[]>([]);
	const hasFitBoundsOnceRef = useRef(false);
	const [mapReady, setMapReady] = useState(false);
	const [popupAnchor, setPopupAnchor] = useState<{ x: number; y: number } | null>(null);
	const router = useRouter();
	const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
	const [geoLoading, setGeoLoading] = useState(false);
	/** null = not decided, true = prompt visible, false = dismissed this session */
	const [showGeoPrompt, setShowGeoPrompt] = useState<boolean | null>(null);

	const geoErrorCodeName = (code: number): string => {
		switch (code) {
			case 1:
				return 'PERMISSION_DENIED';
			case 2:
				return 'POSITION_UNAVAILABLE';
			case 3:
				return 'TIMEOUT';
			default:
				return `UNKNOWN_${code}`;
		}
	};

	const dismissGeoSilently = () => {
		setShowGeoPrompt(false);
		try {
			sessionStorage.setItem('reza_geo_prompt_dismissed', '1');
		} catch {
			/* ignore */
		}
	};

	const getPositionOnce = (
		options: PositionOptions
	): Promise<GeolocationPosition> =>
		new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject, options);
		});

	/**
	 * Ask browser for GPS. On deny/fail → silent: keep null (ALL salons, no km), hide prompt.
	 * No Casablanca fake coordinates. No error banner.
	 */
	const requestUserLocation = (): Promise<boolean> => {
		return (async () => {
			if (typeof navigator === 'undefined' || !navigator.geolocation) {
				setUserLocation(null);
				dismissGeoSilently();
				return false;
			}

			setGeoLoading(true);

			const primary: PositionOptions = {
				enableHighAccuracy: false,
				timeout: 15_000,
				maximumAge: 60_000,
			};
			const retry: PositionOptions = {
				enableHighAccuracy: true,
				timeout: 15_000,
				maximumAge: 0,
			};

			try {
				let position: GeolocationPosition;
				try {
					position = await getPositionOnce(primary);
				} catch (firstErr: unknown) {
					const first = firstErr as GeolocationPositionError;
					// Code 2 often succeeds on flip (desktop Wi‑Fi vs high-accuracy)
					if (first?.code === 2) {
						position = await getPositionOnce(retry);
					} else {
						throw firstErr;
					}
				}

				setUserLocation({
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				});
				setGeoLoading(false);
				setShowGeoPrompt(false);
				try {
					sessionStorage.setItem('reza_geo_granted', '1');
					sessionStorage.removeItem('reza_geo_prompt_dismissed');
				} catch {
					/* ignore */
				}
				return true;
			} catch (err: unknown) {
				const error = err as GeolocationPositionError;
				const code = typeof error?.code === 'number' ? error.code : -1;
				if (process.env.NODE_ENV === 'development') {
					console.warn(
						`Geolocation error: ${geoErrorCodeName(code)}`,
						error?.message || '(empty browser message)'
					);
				}
				setUserLocation(null);
				setGeoLoading(false);
				dismissGeoSilently();
				return false;
			}
		})();
	};

	// Calculate distance between two coordinates using Haversine formula
	const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
		const R = 6371; // Radius of the Earth in kilometers
		const dLat = (lat2 - lat1) * Math.PI / 180;
		const dLon = (lon2 - lon1) * Math.PI / 180;
		const a = 
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
			Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c; // Distance in kilometers
	};

	// Update state when URL params change
	useEffect(() => {
		const urlQuery = searchParams?.get('query') || searchParams?.get('q') || '';
		if (urlQuery !== query) {
			setQuery(urlQuery);
		}
		const urlLocation = searchParams?.get('location') || '';
		if (urlLocation !== location) {
			setLocation(urlLocation);
		}
	}, [searchParams]);

	// Keep the URL in sync with the search bar: clearing the input removes the
	// ?query= param (instead of leaving a stale one that re-fills on navigation).
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const params = new URLSearchParams(window.location.search);
		const current = params.get('query') || params.get('q') || '';
		if (current === query) return;
		if (query) {
			params.set('query', query);
		} else {
			params.delete('query');
			params.delete('q');
		}
		const qs = params.toString();
		router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [query]);

	// Location ask: show soft prompt on search (don't fake Casablanca coords).
	// Auto-retry only if user already granted earlier this session.
	useEffect(() => {
		try {
			if (sessionStorage.getItem('reza_geo_prompt_dismissed') === '1') {
				setShowGeoPrompt(false);
				return;
			}
			if (sessionStorage.getItem('reza_geo_granted') === '1') {
				requestUserLocation();
				return;
			}
		} catch {
			/* ignore */
		}
		setShowGeoPrompt(true);
	}, []);

	// Categories chosen on the dashboard arrive via sessionStorage so the URL
	// stays clean (no ?category=…). Deep links / footer links may still carry
	// ?category= — read it ONCE into the modal state so the user can change or
	// clear it freely instead of being stuck to a URL param.
	useEffect(() => {
		if (typeof window === 'undefined') return;
		let cats: string[] = [];
		try {
			const stored = sessionStorage.getItem('reza_search_categories');
			if (stored) {
				sessionStorage.removeItem('reza_search_categories');
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) cats = parsed.map((c: string) => String(c).trim()).filter(Boolean);
			}
		} catch {
			/* ignore */
		}
		if (cats.length === 0) {
			cats = (searchParams?.get('category') || '').split(',').map((c) => c.trim()).filter(Boolean);
		}
		if (cats.length > 0) {
			setFilterValues((prev) => ({ ...prev, categories: Array.from(new Set(cats)) }));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Fetch tenants from API
	useEffect(() => {
		const fetchTenants = async () => {
			try {
				setLoading(true);
				// Selected categories (filter modal state only — the source of truth
				// after the initial seed) — backend applies AND semantics.
				const categoryParam = filterValues.categories.length > 0 ? filterValues.categories.join(',') : undefined;
				// Only pass query if it's not empty (trim whitespace)
				const searchQuery = query && query.trim() ? query.trim() : undefined;
				const geo =
					userLocation != null
						? {
								lat: userLocation.lat,
								lng: userLocation.lng,
								radiusKm: filterValues.distance,
							}
						: undefined;
				const response = await api.searchTenants(
					searchQuery,
					categoryParam,
					location && location.trim() ? location.trim() : undefined,
					50,
					geo
				);
				// Filter to only show tenants with complete information (all required fields from landing page)
				const completeTenants = filterCompleteTenants(response.tenants || []);
				
				// Extract coordinates from googleMapsLink if coordinates are not set
				const tenantsWithCoords = await Promise.all(
					completeTenants.map(async (tenant: any) => {
						// If coordinates are already set and valid, use them
						if (tenant.coordinates && tenant.coordinates.lat && tenant.coordinates.lng) {
							return tenant;
						}
						
						// If googleMapsLink is set but no coordinates, try to extract from URL
						if (tenant.googleMapsLink) {
							try {
								const coords = await extractCoordinatesFromGoogleMapsUrl(tenant.googleMapsLink);
								if (coords) {
									return { ...tenant, coordinates: coords };
								}
							} catch (err) {
								console.warn(`Failed to extract coordinates from ${tenant.googleMapsLink}:`, err);
							}
						}
						
						return tenant;
					})
				);
				
				setResults(tenantsWithCoords);
			} catch (error) {
				console.error('Error fetching tenants:', error);
				setResults([]);
			} finally {
				setLoading(false);
			}
		};

		fetchTenants();
	}, [query, location, filterValues.categories, filterValues.distance, userLocation]);

	// Filter results based on filter values
	const getFilteredResults = () => {
		let filtered = [...results];

			// Filter by availability: any concrete date/time choice only keeps salons
		// that actually accept online reservations (exact slot is checked at booking).
		if (filterValues.availability && filterValues.availability !== 'anytime') {
			filtered = filtered.filter(salon => salon.onlineReservationEnabled !== false);
		}

		// Filter by rating
		if (filterValues.rating !== null && filterValues.rating > 0) {
			filtered = filtered.filter(salon => {
				const rating = salon.rating || 0;
				return rating >= filterValues.rating!;
			});
		}

		// Filter by price range
		if (filterValues.priceRange && (filterValues.priceRange[0] > 0 || filterValues.priceRange[1] < 1000)) {
			filtered = filtered.filter(salon => {
				// Extract price from price range if available
				if (salon.priceRange) {
					const avgPrice = salon.priceRange.avg || salon.priceRange.min || 0;
					return avgPrice >= filterValues.priceRange[0] && avgPrice <= filterValues.priceRange[1];
				}
				// If no priceRange, include it (to not exclude salons without price data)
				return true;
			});
		}

		// Categories are filtered by the backend (AND semantics on the merged
		// URL + modal categories). No client-side re-filter here — matching
		// service NAMES against categories would wrongly drop valid salons.

		// Filter by distance radius (client-side fallback)
		if (userLocation && filterValues.distance > 0) {
			filtered = filtered.filter((salon) => {
				if (salon.distanceKm != null) {
					return salon.distanceKm <= filterValues.distance;
				}
				if (!salon.coordinates?.lat || !salon.coordinates?.lng) return true;
				return (
					calculateDistance(
						userLocation.lat,
						userLocation.lng,
						salon.coordinates.lat,
						salon.coordinates.lng
					) <= filterValues.distance
				);
			});
		}

		// Note: Availability filters
		// checking actual salon availability, which needs API calls or availability data
		// This is typically handled at the API level or requires real-time availability checks

		// Sort results
		switch (sortBy) {
			case 'rating':
				filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
				break;
			case 'distance':
				// Sort by distance calculated from coordinates
				if (userLocation) {
					// Map salons with calculated distances
					const salonsWithDistance = filtered.map(salon => {
						if (!salon.coordinates || !salon.coordinates.lat || !salon.coordinates.lng) {
							return { ...salon, _calculatedDistance: Infinity };
						}
						const distance = calculateDistance(
							userLocation.lat,
							userLocation.lng,
							salon.coordinates.lat,
							salon.coordinates.lng
						);
						const distanceDisplay = distance < 1 
							? `${Math.round(distance * 1000)} m` 
							: `${distance.toFixed(1)} km`;
						return { 
							...salon, 
							_calculatedDistance: distance,
							distance: distanceDisplay 
						};
					});
					
					// Sort by calculated distance
					salonsWithDistance.sort((a, b) => a._calculatedDistance - b._calculatedDistance);
					
					// Remove the temporary _calculatedDistance property
					filtered = salonsWithDistance.map(({ _calculatedDistance, ...salon }) => salon);
				} else {
					// Fallback: try to use existing distance property if available
					filtered.sort((a, b) => {
						const distA = a.distance 
							? parseFloat((a.distance || '999').toString().replace(' km', '').replace(' m', '').replace(',', '.')) || 999
							: 999;
						const distB = b.distance
							? parseFloat((b.distance || '999').toString().replace(' km', '').replace(' m', '').replace(',', '.')) || 999
							: 999;
						return distA - distB;
					});
				}
				break;
			case 'price':
				filtered.sort((a, b) => {
					const priceA = a.priceRange?.avg || a.priceRange?.min || 0;
					const priceB = b.priceRange?.avg || b.priceRange?.min || 0;
					return priceA - priceB;
				});
				break;
			default: // 'recommended'
				// If bestPro is enabled, prioritize high-rated salons
				if (filterValues.bestPro) {
					filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
				}
				// Otherwise keep original order (already sorted by API)
				break;
		}

		return filtered;
	};

	const filteredResults = getFilteredResults();

	// Distance / km only when real GPS granted — never without userLocation
	const getDistanceForDisplay = (salon: any): string | null => {
		if (!userLocation) return null;

		if (salon.distanceKm != null) {
			const distance = salon.distanceKm as number;
			return distance < 1
				? `${Math.round(distance * 1000)} m`
				: `${distance.toFixed(1)} km`;
		}

		if (!salon.coordinates?.lat || !salon.coordinates?.lng) return null;

		const distance = calculateDistance(
			userLocation.lat,
			userLocation.lng,
			salon.coordinates.lat,
			salon.coordinates.lng
		);

		return distance < 1
			? `${Math.round(distance * 1000)} m`
			: `${distance.toFixed(1)} km`;
	};

	const dismissGeoPrompt = () => {
		dismissGeoSilently();
	};

	// Helper function to get today's hours for a salon
	const getTodayHours = (salon: any): string | null => {
		if (!salon.settings?.businessHours) return null;
		
		const businessHours = salon.settings.businessHours;
		const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
		const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
		const dayKey = days[today];
		
		if (businessHours[dayKey] && businessHours[dayKey].open && businessHours[dayKey].close) {
			const openTime = formatTimeForDisplay(businessHours[dayKey].open);
			const closeTime = formatTimeForDisplay(businessHours[dayKey].close);
			return `${openTime} - ${closeTime}`;
		}
		
		return 'Fermé';
	};

	// Load user's favorites on mount and when user changes
	useEffect(() => {
		if (!isAuthenticated || !user?.email) return;

		const loadFavorites = async () => {
			try {
				const response = await api.getClientFavorites(user.email);
				const favorites = response.favorites || [];
				
				// Create a Set of favorite tenant IDs and a Map of tenantId -> favoriteId
				// Use tenant.id (database ID) as the key
				const likedSet = new Set<string>();
				const favoritesMapData = new Map<string, string>();
				
				favorites.forEach((fav: any) => {
					// Use tenant.id (database ID) as the primary identifier
					const tenantDbId = fav.tenant?.id || fav.tenantId;
					if (tenantDbId) {
						likedSet.add(tenantDbId);
						if (fav.id) {
							favoritesMapData.set(tenantDbId, fav.id);
						}
					}
				});
				
				setLikedSalons(likedSet);
				setFavoritesMap(favoritesMapData);
			} catch (error) {
				console.error('Error loading favorites:', error);
			}
		};

		loadFavorites();
	}, [isAuthenticated, user?.email]);

	// Leaflet map (OSM tiles) — no Google API key required
	useEffect(() => {
		let disposed = false;
		let map: any = null;

		(async () => {
			if (!mapRef.current) return;
			const L = (await import('leaflet')).default;
			await import('leaflet/dist/leaflet.css');
			if (disposed || !mapRef.current) return;

			const defaultCenter: [number, number] = [33.5731, -7.6298];
			map = L.map(mapRef.current, {
				zoomControl: false,
				attributionControl: true,
			}).setView(defaultCenter, 13);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
				maxZoom: 19,
			}).addTo(map);

			const layer = L.layerGroup().addTo(map);
			if (disposed) {
				map.remove();
				return;
			}

			markersLayerRef.current = layer;
			leafletMapRef.current = map;
			setMapReady(true);

			// Sticky panel: tiles need invalidateSize after layout settles
			requestAnimationFrame(() => {
				try {
					map.invalidateSize();
				} catch {
					/* ignore */
				}
			});
			window.setTimeout(() => {
				try {
					map?.invalidateSize();
				} catch {
					/* ignore */
				}
			}, 150);
		})();

		return () => {
			disposed = true;
			setMapReady(false);
			hasFitBoundsOnceRef.current = false;
			markersRef.current = [];
			markersLayerRef.current = null;
			leafletMapRef.current = null;
			if (map) {
				try {
					map.remove();
				} catch {
					/* ignore */
				}
			}
			// Strict Mode remount: clear Leaflet leftover on same DOM node
			if (mapRef.current) {
				mapRef.current.innerHTML = '';
				delete (mapRef.current as any)._leaflet_id;
			}
		};
	}, []);

	// Reflow map when mobile carte toggle / sticky panel size changes
	useEffect(() => {
		const map = leafletMapRef.current;
		if (!map || !mapReady) return;
		const t = window.setTimeout(() => {
			try {
				map.invalidateSize();
			} catch {
				/* ignore */
			}
		}, 50);
		return () => window.clearTimeout(t);
	}, [showMobileMap, mapReady]);

	// Reflow map when entering/leaving fullscreen (tiles only render once
	// the container is measured — retry across frames so the swap always lands)
	useEffect(() => {
		const map = leafletMapRef.current;
		if (!map || !mapReady) return;
		const run = () => {
			try {
				map.invalidateSize({ animate: false });
			} catch {
				/* ignore */
			}
		};
		const raf = requestAnimationFrame(run);
		const t1 = window.setTimeout(run, 100);
		const t2 = window.setTimeout(run, 400);
		return () => {
			cancelAnimationFrame(raf);
			window.clearTimeout(t1);
			window.clearTimeout(t2);
		};
	}, [mapFullscreen, mapReady]);

	// Close the pin card when clicking the map itself
	useEffect(() => {
		const map = leafletMapRef.current;
		if (!map || !mapReady) return;
		const close = () => setSelectedSalonDetails(null);
		map.on('click', close);
		return () => {
			map.off('click', close);
		};
	}, [mapReady]);

	// Anchor the pin card above the selected marker, following map moves
	useEffect(() => {
		const map = leafletMapRef.current;
		if (!map || !mapReady || !selectedSalonDetails) {
			setPopupAnchor(null);
			return;
		}
		const salon = selectedSalonDetails;
		// Anchor the card using the marker's REAL on-screen position (DOM rects,
		// same coordinate space as the map container) — never layout-space math
		// like latLngToContainerPoint, which breaks when the map is scaled.
		const update = () => {
			try {
				const mapEl = map.getContainer();
				const mapRect = mapEl.getBoundingClientRect();
				if (mapRect.width <= 0 || mapRect.height <= 0) {
					setPopupAnchor(null);
					return;
				}
				const entry = markersRef.current.find((m) => m.id === salon.id);
				const iconEl = entry?.marker?.getElement?.();
				if (!iconEl) {
					setPopupAnchor(null);
					return;
				}
				const iconRect = iconEl.getBoundingClientRect();
				// Marker tip: divIcon is ~28px tall with iconAnchor [32, 16].
				const anchorX = iconRect.left - mapRect.left + iconRect.width / 2;
				const anchorY = iconRect.top - mapRect.top + 16;
				// Clamp horizontally so the 320px card never leaves the map sides.
				const x = Math.max(170, Math.min(anchorX, mapRect.width - 170));
				// Always open ABOVE the pin; keep the whole card inside the map by
				// pinning its top to the map's top edge when the pin is too high.
				const CARD_H = 400;
				const y = Math.max(CARD_H, anchorY);
				setPopupAnchor({ x, y });
			} catch {
				/* ignore */
			}
		};
		map.on('move', update);
		map.on('zoom', update);
		map.on('moveend', update);
		update();
		return () => {
			map.off('move', update);
			map.off('zoom', update);
			map.off('moveend', update);
		};
	}, [mapReady, selectedSalonDetails]);

	// Update map markers when filtered results change
	useEffect(() => {
		if (!mapReady || loading) return;
		const map = leafletMapRef.current;
		const layer = markersLayerRef.current;
		if (!map || !layer) return;

		let cancelled = false;

		(async () => {
			const L = (await import('leaflet')).default;
			if (cancelled || !leafletMapRef.current || !markersLayerRef.current) return;

			markersLayerRef.current.clearLayers();
			markersRef.current = [];

			const bounds: [number, number][] = [];

			// Only place markers for salons that have real GPS coordinates
			const salonsWithCoords = filteredResults.filter(
				(salon) => salon.coordinates?.lat && salon.coordinates?.lng
			);

			salonsWithCoords.forEach((salon) => {
				const latLng: [number, number] = [salon.coordinates.lat, salon.coordinates.lng];
				bounds.push(latLng);

				// Marker label: star rating by default; price range only when the
				// user sorts by Prix (then min-max, or a single number when equal);
				// real distance only when the user sorts by Plus proche with GPS on.
				const showPrice = sortBy === 'price';
				const showDistance = sortBy === 'distance' && userLocation != null;
				let markerLabel: string | null = null;
				if (showPrice) {
					const r = salon.priceRange;
					if (r?.min != null && r?.max != null && r.min !== r.max) {
						markerLabel = `${Math.round(r.min)}-${Math.round(r.max)} MAD`;
					} else if (r?.min != null) {
						markerLabel = `${Math.round(r.min)} MAD`;
					} else if (salon.price) {
						markerLabel = salon.price;
					}
				} else if (showDistance) {
					markerLabel = getDistanceForDisplay(salon);
				} else if (typeof salon.rating === 'number' && salon.rating > 0) {
					markerLabel = `★ ${salon.rating.toFixed(1)}`;
				}

				const isSelected = selectedSalon === salon.id;
				const markerHtml = markerLabel
					? `<div class="reza-map-marker${isSelected ? ' reza-map-marker--selected' : ''}">
						<span class="reza-map-price">${markerLabel}</span>
					</div>`
					: `<div class="reza-map-marker${isSelected ? ' reza-map-marker--selected' : ''}">
						<span class="reza-map-dot"></span>
					</div>`;

				const icon = L.divIcon({
					className: '',
					html: markerHtml,
					iconAnchor: [32, 16],
				});

				const marker = L.marker(latLng, { icon });

				marker.on('mouseover', () => setSelectedSalon(salon.id));
				marker.on('mouseout', () => setSelectedSalon(null));
				marker.on('click', () => {
					setSelectedSalon(salon.id);
					setGalleryIndex(0);
					setSelectedSalonDetails(salon);
				});

				marker.addTo(markersLayerRef.current);
				markersRef.current.push({ marker, id: salon.id });
			});

			// One-time fit on first markers load; later list filter/sync keep user zoom/center
			if (!hasFitBoundsOnceRef.current) {
				if (bounds.length > 0) {
					try {
						leafletMapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
						hasFitBoundsOnceRef.current = true;
					} catch {
						/* ignore */
					}
				} else {
					try {
						leafletMapRef.current.setView([33.5731, -7.6298], 13);
						hasFitBoundsOnceRef.current = true;
					} catch {
						/* ignore */
					}
				}
			}

			requestAnimationFrame(() => {
				try {
					leafletMapRef.current?.invalidateSize();
				} catch {
					/* ignore */
				}
			});
		})();

		return () => {
			cancelled = true;
		};
	}, [filteredResults, loading, mapReady, selectedSalon, sortBy]);

	// Note: marker selected state is handled in the main markers effect (via reza-map-marker--selected class)

	const toggleLike = async (salon: any) => {
		if (!isAuthenticated || !user?.email) {
			// Redirect to login if not authenticated
			router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
			return;
		}

		// Use salon.id (database ID) as the primary identifier
		const tenantDbId = salon.id;
		if (!tenantDbId) return;

		const isCurrentlyLiked = likedSalons.has(tenantDbId);
		
		try {
			if (isCurrentlyLiked) {
				// Remove from favorites
				const favoriteId = favoritesMap.get(tenantDbId);
				if (favoriteId) {
					await api.removeFavorite(favoriteId, user.email);
					
					// Update local state
					setLikedSalons(prev => {
						const newLiked = new Set(prev);
						newLiked.delete(tenantDbId);
						return newLiked;
					});
					
					setFavoritesMap(prev => {
						const newMap = new Map(prev);
						newMap.delete(tenantDbId);
						return newMap;
					});
				}
			} else {
				// Add to favorites - use salon.id (database ID)
				const response = await api.addFavorite(user.email, tenantDbId);
				
				// Update local state - use tenant.id from response if available
				const responseTenantId = response.favorite?.tenant?.id || response.favorite?.tenantId || tenantDbId;
				if (response.favorite?.id && responseTenantId) {
					setLikedSalons(prev => new Set(prev).add(responseTenantId));
					setFavoritesMap(prev => {
						const newMap = new Map(prev);
						newMap.set(responseTenantId, response.favorite.id);
						return newMap;
					});
				}
			}
		} catch (error: any) {
			console.error('Error toggling favorite:', error);
			// Optionally show a toast/notification here
			alert(error.message || 'Erreur lors de la sauvegarde du favori');
		}
	};

	return (
		<div className="min-h-screen bg-white">
			<style jsx global>{`
				* {
					-webkit-font-smoothing: antialiased;
					-moz-osx-font-smoothing: grayscale;
				}
				
				::-webkit-scrollbar {
					width: 6px;
				}
				
				::-webkit-scrollbar-track {
					background: transparent;
				}
				
				::-webkit-scrollbar-thumb {
					background: rgba(139, 114, 96, 0.2);
					border-radius: 3px;
				}
				
				::-webkit-scrollbar-thumb:hover {
					background: rgba(139, 114, 96, 0.4);
				}

				@keyframes fadeInUp {
					from {
						opacity: 0;
						transform: translateY(20px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				.animate-fadeInUp {
					animation: fadeInUp 0.5s ease-out forwards;
				}
				
				/* Hide scrollbar for Chrome, Safari and Opera */
				.scrollbar-hide::-webkit-scrollbar {
					display: none;
				}
				
				/* Hide scrollbar for IE, Edge and Firefox */
				.scrollbar-hide {
					-ms-overflow-style: none;  /* IE and Edge */
					scrollbar-width: none;  /* Firefox */
				}

				#map.leaflet-container,
				#map {
					width: 100%;
					height: 100%;
					background: #e8ebe6;
				}
			`}</style>

			<style>{`
				/* Custom Fresha-style map markers */
				.reza-map-marker {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					background: #111827;
					color: white;
					border-radius: 20px;
					padding: 4px 10px;
					font-size: 11px;
					font-weight: 700;
					white-space: nowrap;
					box-shadow: 0 2px 8px rgba(0,0,0,0.25);
					border: 2px solid white;
					cursor: pointer;
					transition: all 0.15s ease;
					min-width: 28px;
					min-height: 28px;
				}
				.reza-map-marker:hover,
				.reza-map-marker--selected {
					background: #4a3728;
					transform: scale(1.15);
					z-index: 999 !important;
					box-shadow: 0 4px 16px rgba(0,0,0,0.35);
				}
				.reza-map-dot {
					display: block;
					width: 8px;
					height: 8px;
					background: white;
					border-radius: 50%;
				}
				.reza-map-price {
					letter-spacing: 0.02em;
				}
			`}</style>

			{/* Header - Fixed */}
			<RezaNavbar />

			{/* Main Content — results ~55% + map ~45% fill viewport */}
			<div className="flex w-full pt-20 relative z-10 min-h-[calc(100vh-5rem)]">
				{/* Left Side - Results */}
				<div className={`w-full lg:w-[55%] lg:flex-shrink-0 ${showMobileMap ? 'hidden lg:block' : 'block'} relative z-10 bg-white min-h-[calc(100vh-5rem)]`}>
					<div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8 relative z-10">
						{/* Header with search pills and sort pills on the right */}
						<div className="mb-6 sm:mb-8 lg:mb-10">
							<div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6">
								<div className="flex-shrink-0">
									{/* Number on its own line, label below */}
									<h1 className="text-3xl sm:text-4xl font-light text-gray-900 leading-none">{loading ? '...' : filteredResults.length}</h1>
									<span className="block text-base sm:text-lg mt-1" style={{ color: '#111827' }}>Salons</span>
									<p className="text-xs sm:text-sm text-gray-400 mt-2">
										{location?.trim()
											? location
											: userLocation
												? 'Près de vous'
												: 'Tous les salons'}
									</p>
								</div>
								{/* Right: Pills (search/location/filter + sort) */}
								<div className="flex flex-col gap-3 w-full lg:w-auto lg:max-w-lg relative z-[100]">
									<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
										<div className="flex items-center gap-2 sm:gap-3 bg-white rounded-full px-3 sm:px-4 py-2.5 border border-gray-300 hover:border-gray-400 transition-all flex-1 sm:flex-initial relative z-[100] shadow-sm">
											<Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
											<input
												type="text"
												placeholder="Rechercher un salon ou service"
												className="flex-1 min-w-0 outline-none bg-transparent text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
												value={query}
												onChange={(e) => setQuery(e.target.value)}
											/>
										</div>
										<div className="flex items-center gap-2 sm:gap-3 bg-white rounded-full px-3 sm:px-4 py-1 border border-gray-300 hover:border-gray-400 transition-all flex-1 sm:flex-initial relative z-[200] shadow-sm min-w-0">
											<div className="flex-1 min-w-0">
												<LocationAutocomplete
													value={location}
													onChange={setLocation}
													placeholder="Ville ou quartier"
													inputClassName="w-full pl-10 pr-2 py-2 rounded-full border-0 focus:outline-none bg-transparent text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
												/>
											</div>
											<button
												type="button"
												onClick={() => void requestUserLocation()}
												disabled={geoLoading}
												className={`p-1 rounded-full hover:bg-gray-100 disabled:opacity-50 flex-shrink-0 ${
													userLocation ? 'text-emerald-600' : 'text-[#111827]'
												}`}
												title="Utiliser ma position"
												aria-label="Utiliser ma position"
											>
												<Navigation className={`w-4 h-4 ${geoLoading ? 'animate-pulse' : ''}`} />
											</button>
										</div>
										<button
											onClick={() => setShowFilters(true)}
											className="px-4 py-2.5 rounded-full bg-white border border-gray-300 hover:border-gray-400 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm font-medium whitespace-nowrap relative z-[100] shadow-sm h-fit"
										>
											<SlidersHorizontal className="w-4 h-4 text-gray-700" />
											<span className="text-gray-700">Filtres</span>
										</button>
									</div>
									<div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 sm:-mx-6 px-4 sm:px-6 lg:px-0 lg:mx-0 lg:justify-end relative z-[100] mt-0">
										{sortOptions.map((opt) => (
											<button
												key={opt.key}
												onClick={() => {
													if (opt.key === 'distance' && !userLocation) {
														void requestUserLocation().then((ok) => {
															if (ok) setSortBy('distance');
														});
														return;
													}
													setSortBy(opt.key);
												}}
												className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border relative z-[100] shadow-sm flex-shrink-0 ${
													sortBy === opt.key
														? 'bg-[#111827] text-white border-[#111827]'
														: 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
												}`}
											>
												{opt.label}
											</button>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Soft location prompt — once; hide silently after deny / Plus tard */}
						{showGeoPrompt === true && !userLocation && (
							<div
								className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-[#111827]/30 bg-white px-4 py-3 shadow-sm"
							>
								<div className="flex items-start gap-3 flex-1 min-w-0">
									<div className="mt-0.5 rounded-full p-2 flex-shrink-0 bg-[#111827]/10">
										<MapPin className="w-4 h-4 text-[#111827]" />
									</div>
									<div className="min-w-0">
										<p className="text-sm font-medium text-gray-900">
											Afficher les salons près de vous ?
										</p>
										<p className="text-xs mt-0.5 text-gray-500">
											Autorisez la localisation pour le tri « Plus proche » et les distances. Sinon, tous les salons restent visibles.
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2 flex-shrink-0 sm:self-center">
									<button
										type="button"
										onClick={dismissGeoPrompt}
										className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-800"
									>
										Plus tard
									</button>
									<button
										type="button"
										onClick={() => void requestUserLocation()}
										disabled={geoLoading}
										className="px-4 py-2 rounded-full bg-[#111827] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
									>
										{geoLoading ? 'Localisation…' : 'Utiliser ma position'}
									</button>
								</div>
							</div>
						)}

						{/* Results */}
						{loading ? (
							<div className="flex items-center justify-center py-20">
								<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111827]"></div>
							</div>
						) : filteredResults.length === 0 ? (
							<div className="text-center py-20">
								<p className="text-gray-500">Aucun salon trouvé</p>
							</div>
						) : (
						<div className="space-y-6">
							{filteredResults.map((salon, index) => (
								<div
									key={salon.id}
									className="group cursor-pointer animate-fadeInUp relative z-[50]"
									style={{ animationDelay: `${index * 100}ms` }}
									onMouseEnter={() => setSelectedSalon(salon.id)}
									onMouseLeave={() => setSelectedSalon(null)}
									onClick={() => router.push(getSalonHref(salon))}
								>
									<div className={`flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white border-2 transition-colors duration-200 relative z-[50] ${
										selectedSalon === salon.id 
											? 'border-[#111827]' 
											: 'border-transparent hover:border-gray-200'
									}`}>
										{/* Image */}
										<div className="relative w-full sm:w-56 h-48 sm:h-56 flex-shrink-0 overflow-hidden rounded-xl sm:rounded-2xl">
											<img
												src={getImageUrl(salon.coverImage || salon.logo) || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80'}
												alt={salon.name}
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
											/>
											<button
												onClick={(e) => {
													e.stopPropagation();
													toggleLike(salon);
												}}
												className="absolute top-4 right-4 w-9 h-9 rounded-full backdrop-blur-sm bg-white/90 flex items-center justify-center hover:scale-110 transition-transform z-[100] shadow-sm"
											>
												<Heart
													className={`w-4 h-4 transition-all ${
														likedSalons.has(salon.id)
															? 'fill-red-500 text-red-500'
															: 'text-gray-600'
													}`}
												/>
											</button>
										</div>

										{/* Content */}
										<div className="flex-1 flex flex-col justify-between py-1">
											<div>
												<h3 className="text-xl sm:text-2xl font-medium text-gray-900 mb-2 sm:mb-3 group-hover:text-[#111827] transition-colors">
													{salon.name}
												</h3>
												
												<div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
													<div className="flex items-center gap-1.5">
														<Star className="w-4 h-4 fill-[#111827] text-[#111827]" />
														<span className="text-xs sm:text-sm font-semibold text-gray-900">{(salon.rating || 0).toFixed(1)}</span>
														<span className="text-xs sm:text-sm text-gray-400">({salon.reviews || 0})</span>
													</div>
													{salon.priceRange && (
														<>
															<div className="h-1 w-1 rounded-full bg-gray-300" />
															<span className="text-xs sm:text-sm font-medium text-gray-600">
																{salon.priceRange.min !== null && salon.priceRange.min !== undefined && salon.priceRange.max !== null && salon.priceRange.max !== undefined
																	? `${Math.round(salon.priceRange.min)}-${Math.round(salon.priceRange.max)} MAD`
																	: salon.priceRange.avg !== null && salon.priceRange.avg !== undefined
																	? `${Math.round(salon.priceRange.avg)} MAD`
																	: salon.priceRange.min !== null && salon.priceRange.min !== undefined
																	? `À partir de ${Math.round(salon.priceRange.min)} MAD`
																	: salon.price || ''
																}
															</span>
														</>
													)}
													{!salon.priceRange && salon.price && (
														<>
															<div className="h-1 w-1 rounded-full bg-gray-300" />
															<span className="text-xs sm:text-sm font-medium text-gray-600">{salon.price}</span>
														</>
													)}
												</div>

												<div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
													<MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
													<span>{salon.address || salon.city || 'Casablanca'}</span>
													{(() => {
														const distance = getDistanceForDisplay(salon);
														return distance ? (
															<span className="text-[10px] sm:text-xs text-gray-400">• {distance}</span>
														) : null;
													})()}
												</div>

												{(() => {
													const todayHours = getTodayHours(salon);
													return todayHours ? (
														<div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
															<Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#111827]" />
															<span className="font-medium">
																{todayHours === 'Fermé' ? (
																	<span className="text-red-500">{todayHours}</span>
																) : (
																	<span>Aujourd'hui: {todayHours}</span>
																)}
															</span>
														</div>
													) : null;
												})()}

												{salon.services && salon.services.length > 0 && (
													<div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-0">
														{salon.services.slice(0, 3).map((service: string, idx: number) => (
															<span
																key={idx}
																className="px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs text-gray-600 bg-white rounded-full border border-gray-200"
															>
																{service}
															</span>
														))}
													</div>
												)}
											</div>

											<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 mt-4 border-t border-gray-100 gap-3 sm:gap-0">
												{salon.nextAvailable && (
													<div className="flex items-center gap-2">
														<Clock className="w-4 h-4 text-green-600" />
														<span className="text-xs sm:text-sm font-medium text-green-600">{salon.nextAvailable}</span>
													</div>
												)}
												<button
													className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#111827] text-white text-xs sm:text-sm font-medium hover:bg-[#1f2937] transition-all flex items-center justify-center gap-2 group/btn relative z-[100] shadow-sm"
													onClick={(e) => {
														e.stopPropagation(); // Prevent card onClick from firing
														router.push(getSalonHref(salon));
													}}
												>
													<span>Réserver</span>
													<ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
												</button>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
						)}
					</div>
				</div>

				{/* Right Side - Map: sticky desktop panel; fixed fullscreen on mobile toggle */}
				<div
					className={
						mapFullscreen
							? 'fixed inset-0 z-[100] block w-full'
							: `${showMobileMap
									? 'fixed inset-x-0 top-20 bottom-0 z-[1] block w-full lg:static lg:inset-auto'
									: 'hidden'
								} lg:block lg:w-[45%] lg:flex-shrink-0 lg:sticky lg:top-28 lg:h-[calc(100vh-7rem)] lg:self-start lg:z-[1] lg:mt-8 lg:pr-4 lg:pb-4`
					}
				>
				<div className={`relative w-full h-full ${mapFullscreen ? '' : 'rounded-2xl overflow-hidden'}`}>
					<div
						id="map"
						ref={mapRef}
						className={`w-full h-full ${mapFullscreen ? '' : 'min-h-[calc(100vh-5rem)] lg:min-h-0'}`}
						style={{ zIndex: 1 }}
					/>
					{/* Overlay when results exist but none have GPS coordinates */}
					{!loading && filteredResults.length > 0 && filteredResults.every(s => !s.coordinates?.lat) && (
						<div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
							<div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-4 text-center shadow-lg border border-gray-200 mx-4">
								<MapPin className="w-8 h-8 text-[#111827] mx-auto mb-2" />
								<p className="text-sm font-medium text-gray-800">Aucune adresse GPS disponible</p>
								<p className="text-xs text-gray-500 mt-1">Les salons n&apos;ont pas encore ajouté leur localisation</p>
							</div>
						</div>
					)}
					{/* Pin card — opens right above the clicked ticket, follows the marker */}
					{selectedSalonDetails && popupAnchor && (() => {
						const salon = selectedSalonDetails;
						const gallery = [salon.coverImage, salon.logo, ...(Array.isArray(salon.images) ? salon.images : [])]
							.map((img: string | null | undefined) => getImageUrl(img))
							.filter((u: string) => Boolean(u));
						const gallerySrcs = Array.from(new Set(gallery));
						const safeIndex = gallerySrcs.length > 0 ? Math.min(galleryIndex, gallerySrcs.length - 1) : 0;
						return (
							<div
								className="absolute z-[500] w-80"
								style={{
									left: popupAnchor.x,
									top: popupAnchor.y,
									transform: 'translate(-50%, calc(-100% - 14px))',
								}}
							>
								<div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-fadeInUp">
									{/* Image carousel */}
									<div className="relative h-44 bg-gray-100">
										{gallerySrcs.length > 0 ? (
											<img
												src={gallerySrcs[safeIndex]}
												alt={salon.name}
												className="w-full h-full object-cover"
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center">
												<MapPin className="w-8 h-8 text-gray-300" />
											</div>
										)}
										<button
											type="button"
											onClick={() => setSelectedSalonDetails(null)}
											className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-gray-700 hover:bg-white transition-all"
											aria-label="Fermer"
										>
											<X size={16} />
										</button>
										{gallerySrcs.length > 1 && (
											<>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														setGalleryIndex((i) => (i - 1 + gallerySrcs.length) % gallerySrcs.length);
													}}
													className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-gray-700 hover:bg-white transition-all"
													aria-label="Image précédente"
												>
													<ChevronLeft size={18} />
												</button>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														setGalleryIndex((i) => (i + 1) % gallerySrcs.length);
													}}
													className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-gray-700 hover:bg-white transition-all"
													aria-label="Image suivante"
												>
													<ChevronRight size={18} />
												</button>
												<span className="absolute bottom-2.5 right-2.5 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
													{safeIndex + 1} / {gallerySrcs.length}
												</span>
											</>
										)}
									</div>

									<div className="p-4">
										<h3 className="text-base font-medium text-gray-900 leading-snug">{salon.name}</h3>
										<div className="flex items-center gap-1.5 mt-1.5">
											<Star className="w-3.5 h-3.5 fill-[#111827] text-[#111827]" />
											<span className="text-sm font-semibold text-gray-900">{(salon.rating || 0).toFixed(1)}</span>
											<span className="text-xs text-gray-400">({salon.reviews || 0} avis)</span>
										</div>
										<p className="flex items-center gap-1.5 text-xs text-gray-500 mt-1.5">
											<MapPin className="w-3.5 h-3.5 shrink-0" />
											<span className="truncate">{salon.address || salon.city || 'Casablanca'}</span>
										</p>
										{salon.shortDescription && (
											<p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-2">{salon.shortDescription}</p>
										)}
										<button
											type="button"
											onClick={() => {
												setSelectedSalonDetails(null);
												router.push(getSalonHref(salon));
											}}
											className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#111827] text-white text-xs font-medium hover:bg-[#1f2937] transition-all"
										>
											<span>Aller au salon</span>
											<ArrowRight className="w-3.5 h-3.5" />
										</button>
									</div>
								</div>
								{/* Pointer to the ticket (card always sits above it) */}
								<div className="absolute left-1/2 -bottom-1.5 w-3 h-3 bg-white border-gray-200 -translate-x-1/2 rotate-45 border-b border-r" />
							</div>
						);
					})()}
					<button
						type="button"
						onClick={() => setMapFullscreen(v => !v)}
						className="absolute bottom-4 right-4 z-[100] w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-all"
						title={mapFullscreen ? 'Réduire la carte' : 'Plein écran'}
					>
						{mapFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
					</button>
					{mapFullscreen && (
						<button
							type="button"
							onClick={() => setMapFullscreen(false)}
							className="absolute top-4 right-4 z-[100] px-4 py-2 rounded-full bg-white shadow-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100"
						>
							Fermer la carte
						</button>
					)}
				</div>
			</div>

				{/* Mobile Map Toggle */}
				<button
					onClick={() => setShowMobileMap(!showMobileMap)}
					className="lg:hidden fixed bottom-8 right-6 z-50 px-6 py-4 rounded-full bg-[#111827] text-white shadow-2xl flex items-center gap-3 font-medium hover:bg-[#1f2937] transition-all"
				>
					{showMobileMap ? (
						<>
							<ListFilter className="w-5 h-5" />
							<span>Liste</span>
						</>
					) : (
						<>
							<Navigation className="w-5 h-5" />
							<span>Carte</span>
						</>
					)}
				</button>
			</div>


			{/* External Filter Modal */}
			<ModalFilters
				open={showFilters}
				filterValues={{
					availability: filterValues.availability,
					selectedDate: filterValues.selectedDate,
					selectedTime: filterValues.selectedTime,
					rating: filterValues.rating,
					bestPro: filterValues.bestPro,
					categories: filterValues.categories,
				}}
				setFilterValues={(vals: any) => setFilterValues({ ...filterValues, ...vals })}
				onClose={() => setShowFilters(false)}
			/>

		{/* Added shared Footer component */}
		<Footer />
	</div>
	);
}

export default function LuxurySearchResults() {
	return (
		<Suspense fallback={
			<div className="min-h-screen flex items-center justify-center bg-[#f6f6ef]">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#002366] mx-auto mb-4"></div>
					<p className="text-gray-600">Chargement...</p>
				</div>
			</div>
		}>
			<LuxurySearchResultsContent />
		</Suspense>
	);
}
