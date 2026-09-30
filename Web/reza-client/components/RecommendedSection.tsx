'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { filterCompleteTenants } from '../lib/utils';
import { fetchSalonCatalog } from '../lib/discovery';
import SalonCarousel from './SalonCarousel';
import { useClientLocation } from '../hooks/useClientLocation';
import {
  CAROUSEL_SIZE,
  computeBayesianRating,
  haversineKm,
  minMaxNormalize,
  PROXIMITY_WEIGHT,
  RATING_WEIGHT,
} from '../lib/recommendation';

interface RecommendedSectionProps {
  /** Called with the set of salon IDs being displayed, so siblings can exclude them. */
  onRenderedIds?: (ids: Set<string>) => void;
}

export default function RecommendedSection({ onRenderedIds }: RecommendedSectionProps) {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [preciseRequesting, setPreciseRequesting] = useState(false);
  const { location, requestPreciseLocation } = useClientLocation();

  // Fetch the catalog once (shared module-level cache with NewSalonsSection).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const tenants = await fetchSalonCatalog();
        if (!cancelled) setCatalog(filterCompleteTenants(tenants));
      } catch (error) {
        console.error('Error fetching recommended salons:', error);
        if (!cancelled) setCatalog([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ranking recomputes client-side whenever the catalog or the location
  // changes (IP estimate arrives, or the user opts into precise GPS).
  const ranked = useMemo(() => {
    if (catalog.length === 0) return [];

    // C = average rating across ALL salons on the platform. Computed over
    // salons that HAVE reviews: including rating-0 salons in the mean would
    // unfairly depress the global prior for brand-new establishments.
    const reviewed = catalog.filter((s: any) => (s.reviews || 0) > 0);
    const globalAverageRating =
      reviewed.length > 0
        ? reviewed.reduce((sum, s: any) => sum + (s.rating || 0), 0) / reviewed.length
        : 0;

    const scored = catalog.map((s: any) => {
      const bayesianRating = computeBayesianRating(
        s.reviews || 0,
        s.rating || 0,
        globalAverageRating
      );
      const distanceKm =
        location && s.coordinates?.lat != null && s.coordinates?.lng != null
          ? haversineKm(location.lat, location.lng, s.coordinates.lat, s.coordinates.lng)
          : null;
      return { ...s, bayesianRating, distanceKm };
    });

    if (location) {
      // Location known → 0.6 * normalize(bayesian) + 0.4 * normalize(proximity)
      const normBayesian = minMaxNormalize(scored.map((s) => s.bayesianRating));
      const normProximity = minMaxNormalize(
        scored.map((s) => (s.distanceKm != null ? 1 / (1 + s.distanceKm) : 0))
      );
      return scored
        .map((s, i) => ({
          ...s,
          recommendedScore:
            RATING_WEIGHT * normBayesian[i] + PROXIMITY_WEIGHT * normProximity[i],
        }))
        .sort((a, b) => b.recommendedScore - a.recommendedScore)
        .slice(0, CAROUSEL_SIZE);
    }

    // Location unknown → rating-only ranking (recommendedScore = bayesianRating).
    return [...scored]
      .sort((a, b) => b.bayesianRating - a.bayesianRating)
      .slice(0, CAROUSEL_SIZE);
  }, [catalog, location]);

  const handleRequestPrecise = useCallback(async () => {
    setPreciseRequesting(true);
    try {
      await requestPreciseLocation();
    } finally {
      setPreciseRequesting(false);
    }
  }, [requestPreciseLocation]);

  // Notify parent of which IDs are currently displayed so NewSalonsSection can exclude them.
  useEffect(() => {
    if (onRenderedIds && ranked.length > 0) {
      onRenderedIds(new Set(ranked.map((s: any) => s.id)));
    }
  }, [ranked, onRenderedIds]);

  return (
    <SalonCarousel
      title="Recommandés"
      subtitle="Les meilleurs salons et spas sélectionnés pour vous"
      seeAllHref="/search-results"
      salons={ranked}
      loading={loading}
      location={location}
      locationControl
      onRequestPrecise={handleRequestPrecise}
      preciseRequesting={preciseRequesting}
    />
  );
}
