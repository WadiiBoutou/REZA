'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CityCard = {
  name: string;
  image: string;
  text: string;
  salons: number;
};

type Props = {
  cities: CityCard[];
  loading?: boolean;
  pageSize?: number;
  onCityClick: (cityName: string) => void;
};

export default function PaginatedCityCards({
  cities,
  loading = false,
  pageSize = 6,
  onCityClick,
}: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(cities.length / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const safePage = Math.min(page, totalPages - 1);

  const pageCities = useMemo(() => {
    const start = safePage * pageSize;
    return cities.slice(start, start + pageSize);
  }, [cities, safePage, pageSize]);

  if (!loading && cities.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">Aucune ville disponible</p>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {(loading ? Array.from<CityCard | undefined>({ length: Math.min(pageSize, 4) }) : pageCities).map(
          (city, index) => {
            if (loading || !city) {
              return (
                <div
                  key={`skeleton-${index}`}
                  className="h-64 rounded-2xl bg-gray-200/70 animate-pulse"
                />
              );
            }
            return (
              <div
                key={city.name}
                onClick={() => onCityClick(city.name)}
                className="relative rounded-2xl overflow-hidden group cursor-pointer h-64"
              >
                <img
                  src={city.image}
                  alt={city.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-6 left-6 text-white">
                  <p className="text-xl font-medium mb-1">{city.text}</p>
                  <p className="text-sm text-white/90">
                    {`${city.salons} salon${city.salons > 1 ? 's' : ''} disponible${city.salons > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
            );
          }
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-gray-300 text-sm text-gray-700 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Page précédente"
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </button>
          <span className="text-sm text-gray-500 tabular-nums">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-gray-300 text-sm text-gray-700 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Page suivante"
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
