'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { filterCompleteTenants } from '../lib/utils';
import { fetchSalonCatalog } from '../lib/discovery';
import SalonCarousel from './SalonCarousel';
import { useClientLocation } from '../hooks/useClientLocation';
import { CAROUSEL_SIZE } from '../lib/recommendation';

export default function NewSalonsSection() {
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

  // "Nouveaux sur Reza" is explicitly NOT recommendation-scored — newest first.
  const newest = useMemo(
    () =>
      [...catalog]
        .sort((a: any, b: any) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, CAROUSEL_SIZE),
    [catalog]
  );

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
