'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Star, MapPin, ChevronLeft, ChevronRight, Navigation, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getImageUrl, getSalonHref } from '../lib/utils';
import { formatDistanceKm, haversineKm } from '../lib/recommendation';
import type { ClientLocation } from '../hooks/useClientLocation';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop';

type SalonCarouselProps = {
  title: string;
  subtitle: string;
  seeAllHref?: string;
  salons: any[];
  loading?: boolean;
  location?: ClientLocation | null;
  /** Render the "Utiliser ma position précise" control in the header. */
  locationControl?: boolean;
  /** Called when the user clicks the precise-location control. */
  onRequestPrecise?: () => void;
  preciseRequesting?: boolean;
};

export default function SalonCarousel({
  title,
  subtitle,
  seeAllHref = '/search-results',
  salons,
  loading = false,
  location = null,
  locationControl = false,
  onRequestPrecise,
  preciseRequesting = false,
}: SalonCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, salons.length, loading]);

  // When the ranked list changes (e.g. the location resolves and the order
  // reshuffles), start the rail back at the beginning with correct arrows.
  useEffect(() => {
    trackRef.current?.scrollTo({ left: 0 });
    updateArrows();
  }, [salons, updateArrows]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const firstCard = el.querySelector('[data-carousel-card]') as HTMLElement | null;
    const step = firstCard ? firstCard.offsetWidth + 24 : 320; // gap-6 = 24px
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const showPreciseControl =
    locationControl && location?.source !== 'gps';

  return (
    <section className="py-12 bg-white dark:bg-black w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-6 gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#2F2E2C] dark:text-white mb-2">
              {title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {showPreciseControl && (
              <button
                type="button"
                onClick={onRequestPrecise}
                disabled={preciseRequesting}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-[#0a0f2c] dark:hover:border-white hover:text-[#0a0f2c] dark:hover:text-white transition-all disabled:opacity-50"
                title="Utiliser ma position précise pour des distances exactes"
              >
                {preciseRequesting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5" />
                )}
                <span>Utiliser ma position précise</span>
              </button>
            )}

            {seeAllHref && (
              <Link
                href={seeAllHref}
                className="text-sm font-semibold text-[#0a0f2c] dark:text-gray-300 hover:underline hidden sm:block"
              >
                Voir tout
              </Link>
            )}

            {/* Arrow navigation */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                aria-label="Précédent"
                onClick={() => scrollByCard(-1)}
                disabled={!canScrollLeft}
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-[#1a1a1a]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Suivant"
                onClick={() => scrollByCard(1)}
                disabled={!canScrollRight}
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-[#1a1a1a]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-6 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="min-w-[280px] md:min-w-[320px] flex-shrink-0 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-pulse"
              >
                <div className="h-48 bg-gray-100 dark:bg-gray-800" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
                  <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
                  <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : salons.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">
            Aucun salon à afficher pour le moment.
          </div>
        ) : (
          /* Horizontal scroll track: hidden scrollbar + scroll-snap + swipe/trackpad */
          <div
            ref={trackRef}
            className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-6 -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 scroll-smooth"
          >
            {salons.map((salon) => {
              const coords =
                location && salon.coordinates?.lat != null && salon.coordinates?.lng != null
                  ? haversineKm(location.lat, location.lng, salon.coordinates.lat, salon.coordinates.lng)
                  : null;
              const distanceText = coords != null ? formatDistanceKm(coords) : null;
              const cityText =
                salon.city || (salon.address ? String(salon.address).split(',')[0].trim() : '');
              const locationText =
                distanceText && cityText
                  ? `${distanceText} • ${cityText}`
                  : distanceText || cityText || '';

              const tags = salon.services?.length
                ? salon.services
                : salon.tags || [];
              const isNew = !salon.reviews || salon.reviews === 0;

              return (
                <Link
                  key={salon.id}
                  href={getSalonHref(salon)}
                  data-carousel-card
                  className="min-w-[280px] md:min-w-[320px] max-w-[320px] flex-shrink-0 snap-start bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer border border-gray-100 dark:border-gray-800"
                >
                  {/* Image Container */}
                  <div className="relative h-48 w-full overflow-hidden">
                    <img
                      src={getImageUrl(salon.coverImage || salon.logo) || FALLBACK_IMAGE}
                      alt={salon.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate mb-1">
                      {salon.name}
                    </h3>

                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {salon.rating > 0 && (
                        <>
                          <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                            {Number(salon.rating).toFixed(1)}{' '}
                            <Star className="w-3.5 h-3.5 fill-current text-[#0a0f2c] dark:text-white" />
                          </span>
                          {salon.reviews > 0 && (
                            <>
                              <span className="mx-1.5">•</span>
                              <span>{Number(salon.reviews).toLocaleString('fr-FR')} avis</span>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {locationText && (
                      <div className="flex items-center text-sm text-gray-500 mb-4 truncate">
                        <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                        <span className="truncate">{locationText}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {isNew && (
                        <span className="px-2 py-1 bg-[#0a0f2c] text-white text-xs font-medium rounded-md">
                          Nouveau
                        </span>
                      )}
                      {tags.slice(0, 3).map((tag: string, idx: number) => (
                        <span
                          key={`${tag}-${idx}`}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
