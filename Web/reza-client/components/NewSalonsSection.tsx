'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { filterCompleteTenants } from '../lib/utils';
import { fetchSalonCatalog } from '../lib/discovery';
import SalonCarousel from './SalonCarousel';
import { useClientLocation } from '../hooks/useClientLocation';
import { CAROUSEL_SIZE } from '../lib/recommendation';

interface NewSalonsSectionProps {
  /** IDs already shown in another carousel — these will be excluded. */
  excludeIds?: Set<string>;
}

export default function NewSalonsSection({ excludeIds }: NewSalonsSectionProps) {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { location } = useClientLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const tenants = await fetchSalonCatalog();
        if (!cancelled) setCatalog(filterCompleteTenants(tenants));
      } catch (error) {
        console.error('Error fetching new salons:', error);
        if (!cancelled) setCatalog([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // "Nouveaux sur Reza" — newest first, excluding salons already in Recommandés.
  // Always guarantee at least 2 cards by falling back to the last-added salons
  // from the catalog (bottom of the list = most recently registered).
  const newest = useMemo(() => {
    if (catalog.length === 0) return [];

    // Sort by createdAt desc (salons without a date stay at the end)
    const sorted = [...catalog].sort((a: any, b: any) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    const filtered = sorted.filter((s: any) => !excludeIds?.has(s.id));

    if (filtered.length >= 2) return filtered.slice(0, CAROUSEL_SIZE);

    // Not enough unique salons — fill with the tail of the full sorted list
    // (the most recently added ones that Recommandés ranked lowest).
    const tail = [...catalog].reverse().filter(
      (s: any) => !filtered.some((f: any) => f.id === s.id)
    );
    return [...filtered, ...tail].slice(0, 2);
  }, [catalog, excludeIds]);

  return (
    <SalonCarousel
      title="Nouveaux sur Reza"
      subtitle="Découvrez les dernières pépites beauté et bien-être"
      seeAllHref="/search-results"
      salons={newest}
      loading={loading}
      location={location}
    />
  );
}
