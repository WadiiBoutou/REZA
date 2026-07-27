'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Star, Heart, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const MOCK_NEW = [
  {
    id: '6',
    name: 'Glow Beauty Lounge',
    rating: 5.0,
    reviews: 12,
    location: 'Palmier, Casablanca',
    category: 'Coiffure',
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop',
    featured: true,
  },
  {
    id: '7',
    name: 'The Gentlemen\'s Club',
    rating: 0,
    reviews: 0,
    location: 'Gauthier, Casablanca',
    category: 'Barbier',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop',
    featured: true,
  },
  {
    id: '8',
    name: 'Pure Zen Spa',
    rating: 4.5,
    reviews: 8,
    location: 'CIL, Casablanca',
    category: 'Spa',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop',
    featured: true,
  },
  {
    id: '9',
    name: 'Color Studio by S',
    rating: 5.0,
    reviews: 24,
    location: 'Maarif, Casablanca',
    category: 'Coloration',
    image: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=800&auto=format&fit=crop',
    featured: true,
  },
  {
    id: '10',
    name: 'Le Cercle Beauté',
    rating: 0,
    reviews: 0,
    location: 'Anfa, Casablanca',
    category: 'Esthétique',
    image: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?q=80&w=800&auto=format&fit=crop',
    featured: true,
  }
];

export default function NewSalonsSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = direction === 'left' ? -current.offsetWidth / 2 : current.offsetWidth / 2;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-12 bg-white dark:bg-black w-full relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#2F2E2C] dark:text-white mb-2">Nouveaux sur Reza</h2>
          </div>
          <Link href="/search-results" className="text-sm font-semibold text-[#0a0f2c] dark:text-gray-300 hover:underline hidden sm:block">
            Voir tout
          </Link>
        </div>

        {/* Scroll Buttons */}
        {showLeftArrow && (
          <button 
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-100 hover:scale-105 transition-transform"
            aria-label="Défiler vers la gauche"
          >
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
        )}
        
        {showRightArrow && (
          <button 
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-100 hover:scale-105 transition-transform"
            aria-label="Défiler vers la droite"
          >
            <ArrowRight className="w-5 h-5 text-gray-800" />
          </button>
        )}

        {/* Horizontal Scroll Container */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 gap-6 no-scrollbar snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {MOCK_NEW.map((salon) => (
            <div key={salon.id} className="min-w-[280px] md:min-w-[320px] max-w-[320px] flex-shrink-0 snap-start bg-transparent group cursor-pointer">
              {/* Image Container */}
              <div className="relative h-48 w-full overflow-hidden rounded-xl mb-3">
                <img 
                  src={salon.image} 
                  alt={salon.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                
                {/* Badges Overlay */}
                <div className="absolute inset-0 p-3 flex justify-between items-start">
                  {salon.featured && (
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-semibold rounded-full shadow-sm">
                      Nouveau
                    </span>
                  )}
                  <button className="p-2 bg-black/20 backdrop-blur-sm rounded-full hover:bg-black/40 transition-colors ml-auto">
                    <Heart className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div>
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-[15px] font-bold text-gray-900 dark:text-white line-clamp-1 pr-2">
                    {salon.name}
                  </h3>
                  <div className="flex items-center text-[13px] font-semibold text-gray-900 dark:text-white shrink-0">
                    <Star className="w-3.5 h-3.5 fill-[#FFB800] text-[#FFB800] mr-1" />
                    {salon.rating > 0 ? salon.rating.toFixed(1).replace('.', ',') : 'N/A'}
                  </div>
                </div>
                
                <p className="text-[14px] text-gray-500 dark:text-gray-400 truncate mb-0.5">
                  {salon.location}
                </p>
                
                <p className="text-[13px] text-gray-500 dark:text-gray-400">
                  {salon.category} {salon.reviews > 0 ? `• ${salon.reviews} avis` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
