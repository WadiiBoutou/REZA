'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Scissors, HandMetal, Sparkles, Paintbrush, User, ArrowRight, X, QrCode } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import api from '../lib/api';
import { MOROCCAN_CITIES, filterCompleteTenants, getImageUrl } from '../lib/utils';

const ScissorsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M6 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M8.6 8.6l10.4 10.4" /><path d="M8.6 15.4l10.4 -10.4" /></svg>
);

const RazorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 3v2" /><path d="M12 3v2" /><path d="M16 3v2" /><path d="M9 12v6a3 3 0 0 0 6 0v-6h-6z" /><path d="M8 5h8l-1 4h-6z" /><path d="M12 17v1" /></svg>
);

const MassageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M9 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M4 22l4 -2v-3h12" /><path d="M11 20h9" /><path d="M8 14l3 -2l1 -4c3 1 3 4 3 6" /></svg>
);

const ManucureIcon = () => (
  <img src="/icons/nail-polish.png" alt="Manucure" width={24} height={24} style={{ display: 'inline-block' }} />
);

const DigitRoll = ({ val }: { val: string }) => {
  if (val === ' ') return <span className="w-1 inline-block" />;
  const num = parseInt(val, 10);
  if (isNaN(num)) return <span>{val}</span>;
  return (
    <span className="inline-flex flex-col h-6 overflow-hidden relative w-[11px] sm:w-[13px] font-bold text-gray-950 text-lg sm:text-xl leading-none">
      <span 
        className="transition-transform duration-700 ease-out flex flex-col"
        style={{ transform: `translateY(-${num * 24}px)` }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="h-6 flex items-center justify-center">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
};

export default function HeroAbout() {
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [count, setCount] = useState(10766);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCount(prev => prev + Math.floor(Math.random() * 2) + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const [locationSearchFilter, setLocationSearchFilter] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [locationCounts, setLocationCounts] = useState<Record<string, number>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Default popular searches (fallback)
  const defaultPopularSearches = [
    { icon: <ScissorsIcon />, title: 'Coupe de cheveux', subtitle: 'Femme & Homme', category: 'Coiffeur' },
    { icon: <RazorIcon />, title: 'Barbier', subtitle: 'Rasage, taille de barbe', category: 'Barbier' },
    { icon: <ManucureIcon />, title: 'Manucure', subtitle: 'Gel, vernis semi-permanent', category: 'Manucure' },
    { icon: <MassageIcon />, title: 'Massage', subtitle: 'Relaxation & bien-être', category: 'Institut de beauté' },
  ];

  const [popularSearches, setPopularSearches] = useState(defaultPopularSearches);

  // Fetch categories and create dynamic popular searches
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesResponse = await api.getCategories();
        const fetchedCategories = categoriesResponse.categories || [];
        
        // Map main categories to popular searches
        const mainCategories = ['Coiffeur', 'Barbier', 'Manucure', 'Institut de beauté'];
        const iconMap: Record<string, React.ReactElement> = {
          'Coiffeur': <ScissorsIcon />,
          'Barbier': <RazorIcon />,
          'Manucure': <ManucureIcon />,
          'Institut de beauté': <MassageIcon />,
        };
        
        const subtitleMap: Record<string, string> = {
          'Coiffeur': 'Femme & Homme',
          'Barbier': 'Rasage, taille de barbe',
          'Manucure': 'Gel, vernis semi-permanent',
          'Institut de beauté': 'Relaxation & bien-être',
        };
        
        const formattedSearches = mainCategories
          .map((catName) => {
            const cat = fetchedCategories.find((c: any) => 
              c.name?.toLowerCase().includes(catName.toLowerCase()) ||
              catName.toLowerCase().includes(c.name?.toLowerCase() || '')
            );
            
            const displayName = catName === 'Institut de beauté' ? 'Centre de beauté' : catName;
            const subtitle = cat?.description 
              ? cat.description.split('.')[0].substring(0, 40) + '...'
              : subtitleMap[catName] || 'Découvrez nos prestations';
            
            return {
              icon: iconMap[catName] || <MassageIcon />,
              title: displayName,
              subtitle: subtitle,
              category: catName
            };
          })
          .filter(Boolean);
        
        if (formattedSearches.length > 0) {
          setPopularSearches(formattedSearches);
        }
      } catch (error) {
        console.error('Error fetching categories for popular searches:', error);
        // Keep default popular searches
      }
    };

    fetchCategories();
  }, []);

  // Helper function to detect if search query matches a category
  const getCategoryFromSearch = (query: string): string | undefined => {
    // Return undefined if query is empty
    if (!query || !query.trim()) {
      return undefined;
    }
    
    const queryLower = query.toLowerCase().trim();
    // Check if query matches any popular search category
    const matchedSearch = popularSearches.find(item => {
      const titleLower = item.title.toLowerCase();
      const categoryLower = item.category?.toLowerCase() || '';
      return titleLower.includes(queryLower) || 
             queryLower.includes(titleLower) ||
             categoryLower.includes(queryLower) ||
             queryLower.includes(categoryLower);
    });
    return matchedSearch?.category;
  };

  // Fetch search suggestions when user types
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length === 0) {
      setSearchSuggestions([]);
      return;
    }

    if (searchQuery.trim().length < 2) {
      return;
    }

    setLoadingSuggestions(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Detect if search matches a category
        const detectedCategory = getCategoryFromSearch(searchQuery);
        const response = await api.searchTenants(
          searchQuery.trim(),
          detectedCategory, // Include category in search
          location.trim() || undefined,
          20 // Get more results to filter
        );
        // Filter to only show tenants with complete information
        const completeTenants = filterCompleteTenants(response.tenants || []);
        setSearchSuggestions(completeTenants.slice(0, 5)); // Limit to 5 suggestions
      } catch (error) {
        console.error('Error fetching search suggestions:', error);
        setSearchSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300); // Debounce 300ms

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, location, popularSearches]);

  // Fetch cities and counts when location dropdown opens
  useEffect(() => {
    if (showLocationDropdown) {
      const fetchCities = async () => {
        try {
          setLoadingCities(true);
          
          // Fetch all tenants to get city counts
          const tenantsResponse = await api.searchTenants(undefined, undefined, undefined, 1000);
          // Filter to only count tenants with complete information
          const completeTenants = filterCompleteTenants(tenantsResponse.tenants || []);
          
          // Create a map of city counts (only for complete tenants)
          const counts: Record<string, number> = {};
          completeTenants.forEach((tenant: any) => {
            if (tenant.city && tenant.city.trim()) {
              const cityName = tenant.city.trim();
              counts[cityName] = (counts[cityName] || 0) + 1;
            }
          });
          
          setLocationCounts(counts);
          
          // Use all Moroccan cities (excluding "Autre" for display)
          // Counts are already filtered for complete tenants only
          const allMoroccanCities = MOROCCAN_CITIES.filter(city => city !== 'Autre');
          
          // Sort cities: priority cities first, then alphabetically
          const priorityCities = ['Casablanca', 'Marrakech'];
          const otherCities = allMoroccanCities
            .filter(city => !priorityCities.some(priority => 
              city.toLowerCase() === priority.toLowerCase()
            ))
            .sort((a, b) => a.localeCompare(b, 'fr'));
          
          const sortedCities = [
            ...priorityCities.filter(priority => 
              allMoroccanCities.some(city => city.toLowerCase() === priority.toLowerCase())
            ),
            ...otherCities
          ];
          
          // Format for the dropdown
          const locationList = sortedCities.map(city => ({
            city: city,
            count: counts[city] || 0
          }));
          
          setLocationSuggestions(locationList);
        } catch (error) {
          console.error('Error fetching cities:', error);
          // Fallback: use all Moroccan cities without counts
          const allMoroccanCities = MOROCCAN_CITIES.filter(city => city !== 'Autre');
          const priorityCities = ['Casablanca', 'Marrakech'];
          const otherCities = allMoroccanCities
            .filter(city => !priorityCities.some(priority => 
              city.toLowerCase() === priority.toLowerCase()
            ))
            .sort((a, b) => a.localeCompare(b, 'fr'));
          
          const sortedCities = [...priorityCities, ...otherCities];
          setLocationSuggestions(sortedCities.map(city => ({ city, count: 0 })));
          setLocationCounts({});
        } finally {
          setLoadingCities(false);
        }
      };

      fetchCities();
      // Reset filter when opening dropdown
      setLocationSearchFilter('');
    }
  }, [showLocationDropdown]);

  // Filter cities based on search input
  const filteredLocationSuggestions = locationSearchFilter.trim()
    ? locationSuggestions.filter(loc => 
        loc.city.toLowerCase().includes(locationSearchFilter.toLowerCase())
      )
    : locationSuggestions;

  // Handle click outside to close dropdown - improved logic
  useEffect(() => {
    if (!showLocationDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside the dropdown
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(target)) {
        // Check if click is on the location input (keep dropdown open)
        const locationInput = document.querySelector('input[placeholder*="ville"], input[placeholder*="Adresse"], input[placeholder*="Adresse, ville"]') as HTMLInputElement;
        if (locationInput && (locationInput.contains(target) || locationInput === target)) {
          // Keep dropdown open if clicking on input
          return;
        }
        // Close dropdown if clicking outside
        setShowLocationDropdown(false);
        setLocationSearchFilter('');
      }
    };

    // Add event listener with delay to allow button clicks to fire first
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 150);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [showLocationDropdown]);

  return (
    <section
      id="about"
      className="relative w-full min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Real background image */}
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }}
      />
      {/* Light white overlay so dark text stays readable */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-[0.5px]" />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 md:px-12 py-20">
        {/* Header Content */}
        <div className="text-center mb-10 space-y-4">
          <h1 className="text-[2.75rem] md:text-6xl font-bold text-[#111111] mb-4 mt-16 animate-slide-up-1 tracking-tight">
            Réservez vos soins
          </h1>
          <p className="text-base md:text-[1.125rem] text-gray-800 font-normal max-w-3xl mx-auto animate-slide-up-2">
            Vos rendez-vous beauté et bien-être en un clic, partout au Maroc.
          </p>
        </div>

        {/* Search Card */}
        <div className="max-w-full md:max-w-[1000px] mx-auto px-4 md:px-0 animate-slide-up-3 relative mt-10">


          <div className="bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 p-2 w-full relative z-20">
            <div className="flex flex-col md:flex-row items-center w-full">
              {/* Search Input */}
              <div className="flex-1 relative w-full mb-2 md:mb-0">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                <input
                  type="text"
                  placeholder="Toutes les prestations"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSearchDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                  className="w-full pl-14 pr-4 py-4 rounded-l-full focus:outline-none transition-all text-gray-900 placeholder-gray-800 font-medium text-base bg-transparent"
                />
                
                {/* Search Dropdown */}
                {showSearchDropdown && (
                  <div className="absolute bottom-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-h-96 overflow-y-auto">
                    <div className="p-3">
                      {searchQuery.trim().length === 0 ? (
                        <>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                            Recherches populaires
                          </p>
                          <div className="space-y-1">
                            {popularSearches.map((item, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  setSearchQuery(item.title);
                                  setShowSearchDropdown(false);
                                  // Redirect to search results with category filter
                                  const params = new URLSearchParams();
                                  params.append('query', item.title);
                                  if (item.category) {
                                    params.append('category', item.category);
                                  }
                                  if (location.trim()) {
                                    params.append('location', location.trim());
                                  }
                                  router.push(`/search-results?${params.toString()}`);
                                }}
                                className="w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 group"
                              >
                                <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl text-xl group-hover:scale-110 transition-transform duration-200">
                                  {item.icon}
                                </div>
                                <div className="flex-1 text-left">
                                  <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                                  <p className="text-xs text-gray-500">{item.subtitle}</p>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ArrowRight className="w-4 h-4 text-gray-400" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : loadingSuggestions ? (
                        <div className="px-3 py-4 text-center text-sm text-gray-500">
                          Recherche en cours...
                        </div>
                      ) : searchSuggestions.length > 0 ? (
                        <>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                            Résultats ({searchSuggestions.length})
                          </p>
                          <div className="space-y-1">
                            {searchSuggestions.map((tenant) => (
                              <button
                                key={tenant.id}
                                onClick={() => {
                                  setSearchQuery(tenant.name);
                                  setShowSearchDropdown(false);
                                  const params = new URLSearchParams();
                                  params.append('query', tenant.name);
                                  if (location.trim()) {
                                    params.append('location', location.trim());
                                  }
                                  router.push(`/search-results?${params.toString()}`);
                                }}
                                className="w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-gray-50 transition-all duration-200 group"
                              >
                                <img 
                                  src={getImageUrl(tenant.coverImage || tenant.logo) || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80'} 
                                  alt={tenant.name}
                                  className="w-10 h-10 rounded-xl object-cover"
                                  onError={(e) => {
                                    // Fallback to default image if both coverImage and logo fail to load
                                    const target = e.target as HTMLImageElement;
                                    if (target.src !== 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80') {
                                      target.src = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80';
                                    } else {
                                      // If default also fails, show icon
                                      target.style.display = 'none';
                                      const fallback = target.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = 'flex';
                                    }
                                  }}
                                />
                                <div 
                                  className="w-10 h-10 hidden items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl text-xl group-hover:scale-110 transition-transform duration-200"
                                >
                                  <User className="w-5 h-5 text-gray-400" />
                                </div>
                                <div className="flex-1 text-left">
                                  <p className="font-medium text-gray-900 text-sm">{tenant.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {tenant.category} {tenant.city ? `• ${tenant.city}` : ''}
                                    {tenant.rating > 0 && ` • ⭐ ${tenant.rating.toFixed(1)}`}
                                  </p>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ArrowRight className="w-4 h-4 text-gray-400" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="px-3 py-4 text-center text-sm text-gray-500">
                          Aucun résultat trouvé
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Separator Line */}
              <div className="hidden md:flex items-center h-8">
                <div className="w-px h-full bg-gray-200" />
              </div>

              {/* Location Input */}
              <div className="flex-1 relative w-full mb-2 md:mb-0">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                <input
                  type="text"
                  placeholder="Adresse, ville..."
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    if (e.target.value.trim()) {
                      setLocationSearchFilter(e.target.value);
                    }
                  }}
                  onFocus={() => {
                    setShowLocationDropdown(true);
                  }}
                  onBlur={(e) => {
                    // Don't close on blur
                  }}
                  className="w-full pl-12 pr-4 py-3 focus:outline-none transition-all text-gray-900 placeholder-gray-500 text-base bg-transparent font-medium"
                />
                
                {/* Location Dropdown */}
                {showLocationDropdown && (
                  <div 
                    ref={locationDropdownRef}
                    className="absolute bottom-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-[60]"
                    style={{ 
                      maxHeight: '300px',
                      display: 'flex', 
                      flexDirection: 'column',
                      position: 'absolute',
                      bottom: 'calc(100% + 0.5rem)',
                      left: 0,
                      right: 0,
                      zIndex: 60,
                      animation: 'fadeIn 0.2s ease-in-out'
                    }}
                  >
                    {/* Header with search - sticky */}
                    <div className="p-2.5 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                        Villes du Maroc <span className="text-gray-400">({filteredLocationSuggestions.length})</span>
                      </p>
                      {/* Search filter for cities */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 z-10" />
                        <input
                          type="text"
                          placeholder="Rechercher une ville..."
                          value={locationSearchFilter}
                          onChange={(e) => {
                            setLocationSearchFilter(e.target.value);
                            setShowLocationDropdown(true);
                          }}
                          onFocus={(e) => {
                            e.stopPropagation();
                            setShowLocationDropdown(true);
                          }}
                          onBlur={(e) => {
                            // Don't close dropdown when search filter loses focus
                            e.stopPropagation();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          className="w-full pl-9 pr-7 py-1.5 text-sm border border-gray-300 rounded-lg focus:border-[#8b7260] focus:outline-none focus:ring-2 focus:ring-[#8b7260]/20 bg-gray-50 text-gray-900 placeholder-gray-400 transition-all"
                        />
                        {locationSearchFilter && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setLocationSearchFilter('');
                            }}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                          >
                            <X className="w-3 h-3 text-gray-400" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Scrollable list of cities */}
                    <div 
                      className="overflow-y-auto flex-1 custom-scrollbar bg-white"
                      style={{ 
                        maxHeight: '240px',
                        minHeight: '120px',
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarGutter: 'stable'
                      }}
                    >
                      <div className="p-1.5 pb-2">
                        {loadingCities ? (
                          <div className="px-3 py-8 text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-2"></div>
                            <p className="text-xs text-gray-500">Chargement des villes...</p>
                          </div>
                        ) : filteredLocationSuggestions.length > 0 ? (
                          <div className="space-y-0.5">
                            {filteredLocationSuggestions.map((loc, index) => {
                              const hasSalons = (loc.count || 0) > 0;
                              return (
                                <button
                                  key={index}
                                  type="button"
                                  onMouseDown={(e) => {
                                    // Prevent input blur when clicking button
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Set location immediately
                                    setLocation(loc.city);
                                    setLocationSearchFilter('');
                                    // Close dropdown after selection
                                    setTimeout(() => {
                                      setShowLocationDropdown(false);
                                    }, 250);
                                  }}
                                  onTouchStart={(e) => {
                                    // Prevent blur on touch devices
                                    e.preventDefault();
                                  }}
                                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8b7260]/20"
                                  tabIndex={0}
                                >
                                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg group-hover:scale-110 transition-transform duration-200 ${
                                    hasSalons 
                                      ? 'bg-gradient-to-br from-[#8b7260]/10 to-[#8b7260]/20' 
                                      : 'bg-gradient-to-br from-black/5 to-black/10'
                                  }`}>
                                    <MapPin className={`w-3.5 h-3.5 ${hasSalons ? 'text-[#8b7260]' : 'text-gray-400'}`} />
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <p className={`font-medium text-sm truncate ${
                                      hasSalons ? 'text-gray-900' : 'text-gray-600'
                                    }`}>
                                      {loc.city}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {hasSalons 
                                        ? `${loc.count} salon${loc.count > 1 ? 's' : ''} disponible${loc.count > 1 ? 's' : ''}`
                                        : 'Aucun salon disponible'
                                      }
                                    </p>
                                  </div>
                                  {hasSalons && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      <ArrowRight className="w-4 h-4 text-[#8b7260]" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-3 py-8 text-center">
                            <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-xs text-gray-500">Aucune ville trouvée</p>
                            <p className="text-xs text-gray-400 mt-1">Essayez une autre recherche</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {filteredLocationSuggestions.length > 0 && !loadingCities && (
                      <div className="px-2.5 py-1.5 border-t border-gray-200 bg-white/50 text-center">
                        <p className="text-[10px] text-gray-400">
                          {filteredLocationSuggestions.length} {filteredLocationSuggestions.length === 1 ? 'ville' : 'villes'} 
                          {locationSearchFilter && ` correspondant à "${locationSearchFilter}"`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Search Button */}
              <div className="w-full md:w-auto px-2 pb-2 md:pb-0 md:px-0">
                <button
                  className="bg-[#101928] text-white px-8 py-3.5 rounded-full font-medium hover:bg-black transition-all duration-300 flex items-center justify-center gap-2 w-full md:w-auto text-base shadow-sm"
                  onClick={() => {
                  const params = new URLSearchParams();
                  const trimmedQuery = searchQuery.trim();
                  
                  // Only add query if user actually typed something
                  if (trimmedQuery) {
                    params.append('query', trimmedQuery);
                    // Detect if search matches a category and include it (only if query is not empty)
                    const detectedCategory = getCategoryFromSearch(trimmedQuery);
                    if (detectedCategory) {
                      params.append('category', detectedCategory);
                    }
                  }
                  
                  // Only add location if provided
                  if (location.trim()) {
                    params.append('location', location.trim());
                  }
                  
                  // Always redirect to search results page (even if params are empty, show all results)
                  const queryString = params.toString();
                  router.push(`/search-results${queryString ? `?${queryString}` : ''}`);
                }}
              >
                <Search className="w-5 h-5" />
                <span className="hidden md:inline font-semibold">Rechercher</span>
                <span className="md:hidden font-semibold">Rechercher</span>
                </button>
              </div>
            </div>
          </div>
          {/* Popular Categories */}
          {/* Removed Populaire and category buttons */}
        </div>

        {/* Counter and Download App Button */}
        <div className="mt-8 flex flex-col items-center justify-center gap-5 text-center animate-slide-up-3">
          <div className="flex items-center justify-center gap-1.5 text-[#111827] text-base sm:text-lg font-medium">
            <span className="inline-flex items-center gap-0.5">
              {count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ").split('').map((char, idx) => (
                <DigitRoll key={idx} val={char} />
              ))}
            </span>
            <span className="text-gray-900 font-medium">rendez-vous pris aujourd&apos;hui</span>
          </div>

          <button className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-950 px-5 py-2.5 rounded-full font-semibold shadow-sm transition-all active:scale-[0.98] border border-gray-200/80 text-sm">
            <span>Télécharger l&apos;app</span>
            <QrCode className="w-4 h-4 text-gray-700" />
          </button>
        </div>

      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />

      <style jsx>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up-1 {
          animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-up-2 {
          animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
          opacity: 0;
        }
        .animate-slide-up-3 {
          animation: slideUpFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          opacity: 0;
        }
        @keyframes float-slow {
          0% { transform: translateY(0) rotate(-6deg) scale(1); }
          50% { transform: translateY(-20px) rotate(-4deg) scale(1.02); }
          100% { transform: translateY(0) rotate(-6deg) scale(1); }
        }
        @keyframes float-slow-reverse {
          0% { transform: translateY(0) rotate(3deg) scale(1); }
          50% { transform: translateY(25px) rotate(5deg) scale(1.03); }
          100% { transform: translateY(0) rotate(3deg) scale(1); }
        }
        @keyframes float-medium {
          0% { transform: translateY(0) rotate(6deg); }
          50% { transform: translateY(-30px) rotate(4deg); }
          100% { transform: translateY(0) rotate(6deg); }
        }
        @keyframes float-medium-reverse {
          0% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(20px) rotate(-5deg); }
          100% { transform: translateY(0) rotate(-3deg); }
        }
        .animate-float-slow {
          animation: float-slow 18s ease-in-out infinite;
        }
        .animate-float-slow-reverse {
          animation: float-slow-reverse 22s ease-in-out infinite;
        }
        .animate-float-medium {
          animation: float-medium 15s ease-in-out infinite;
        }
        .animate-float-medium-reverse {
          animation: float-medium-reverse 17s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
