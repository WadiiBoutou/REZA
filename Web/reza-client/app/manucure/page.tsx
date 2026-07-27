'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import StatsSection from '@/components/StatsSection';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import PaginatedCityCards from '@/components/PaginatedCityCards';
import { MOROCCAN_CITIES } from '../../lib/utils';

export default function ManicurePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('Manucure');
  const [location, setLocation] = useState('');
  const [cities, setCities] = useState<Array<{name: string; image: string; text: string; salons: number}>>([]);
  const [loadingCities, setLoadingCities] = useState(true);

  // Fetch all cities with salon counts for Manucure category
  useEffect(() => {
    const fetchCityCounts = async () => {
      try {
        setLoadingCities(true);
        
        // Use all Moroccan cities (excluding "Autre" for display purposes)
        const allMoroccanCities = MOROCCAN_CITIES.filter(city => city !== 'Autre');
        
        // Fetch tenants for Manucure category to count salons per city
        const manucureResponse = await api.searchTenants(undefined, 'Manucure', undefined, 10000);
        console.log('[Manucure] Total tenants from API:', manucureResponse.tenants?.length || 0);
        
        // For city counting, we only need category and city fields
        // Filter tenants that have at least category and city (required for counting)
        const tenantsWithCityAndCategory = (manucureResponse.tenants || []).filter((tenant: any) => {
          return tenant.category && tenant.category.trim() && 
                 tenant.city && tenant.city.trim();
        });
        console.log('[Manucure] Tenants with category and city:', tenantsWithCityAndCategory.length);
        
        // Count tenants per city for Manucure category
        const cityCountMap = new Map<string, number>();
        tenantsWithCityAndCategory.forEach((tenant: any) => {
          const cityName = tenant.city.trim().toLowerCase();
          const currentCount = cityCountMap.get(cityName) || 0;
          cityCountMap.set(cityName, currentCount + 1);
        });
        
        // Ensure all Moroccan cities are in the map (even with 0 count)
        allMoroccanCities.forEach(city => {
          const cityKey = city.toLowerCase();
          if (!cityCountMap.has(cityKey)) {
            cityCountMap.set(cityKey, 0);
          }
        });
        
        console.log('[Manucure] Cities with counts:', Array.from(cityCountMap.entries()));
        
        // Map city images (use available images or default)
        const cityImageMap: Record<string, string> = {
          'Casablanca': '/city/casa1.jpg',
          'Marrakech': '/city/kech.webp',
          'Rabat': '/city/casa1.jpg',
          'Tanger': '/city/casa1.jpg',
          'Fès': '/city/casa1.jpg',
          'Agadir': '/city/kech.webp',
        };
        
        // Convert map to array and format - use original city names from MOROCCAN_CITIES
        const formattedCities = allMoroccanCities.map(city => {
          const cityKey = city.toLowerCase();
          const count = cityCountMap.get(cityKey) || 0;
          return {
            name: city, // Use original name from MOROCCAN_CITIES to preserve capitalization
            image: cityImageMap[city] || '/city/casa1.jpg',
            text: `Découvrez nos instituts de manucure à ${city}`,
            salons: count
          };
        });

        // Sort: priority cities first (case-insensitive), then alphabetically (not by count to show all cities)
        const priorityCities = ['Casablanca', 'Marrakech'];
        const sortedCities = [
          ...formattedCities.filter(c => 
            priorityCities.some(priority => 
              c.name.toLowerCase() === priority.toLowerCase()
            )
          ),
          ...formattedCities.filter(c => 
            !priorityCities.some(priority => 
              c.name.toLowerCase() === priority.toLowerCase()
            )
          ).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        ];

        setCities(sortedCities.length > 0 ? sortedCities : [
          { name: 'Casablanca', image: '/city/casa1.jpg', text: 'Découvrez nos instituts de manucure à Casablanca', salons: 0 },
          { name: 'Marrakech', image: '/city/kech.webp', text: 'Découvrez nos instituts de manucure à Marrakech', salons: 0 }
        ]);
      } catch (error) {
        console.error('Error fetching city counts:', error);
        // Fallback to default cities
        setCities([
          { name: 'Casablanca', image: '/city/casa1.jpg', text: 'Découvrez nos instituts de manucure à Casablanca', salons: 0 },
          { name: 'Marrakech', image: '/city/kech.webp', text: 'Découvrez nos instituts de manucure à Marrakech', salons: 0 }
        ]);
      } finally {
        setLoadingCities(false);
      }
    };

    fetchCityCounts();
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('query', searchQuery.trim());
    if (location.trim()) params.append('location', location.trim());
    params.append('category', 'Manucure');
    router.push(`/search-results?${params.toString()}`);
  };

  const handleCityClick = (cityName: string) => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('query', searchQuery.trim());
    if (cityName.trim()) params.append('location', cityName.trim());
    params.append('category', 'Manucure');
    router.push(`/search-results?${params.toString()}`);
  };

  const popularServices = [
    { name: "Manucure à Casablanca", search: "Manucure", city: "Casablanca" },
    { name: "Manucure à Marrakech", search: "Manucure", city: "Marrakech" },
    { name: "Pose de vernis à Casablanca", search: "Pose de vernis", city: "Casablanca" },
    { name: "Pose de vernis à Marrakech", search: "Pose de vernis", city: "Marrakech" }
  ];

  const frequentSearches = [
    { name: "Manucure gel Casablanca", search: "Manucure gel", city: "Casablanca" },
    { name: "Manucure semi-permanente Casablanca", search: "Manucure semi-permanente", city: "Casablanca" },
    { name: "Manucure gel Marrakech", search: "Manucure gel", city: "Marrakech" },
    { name: "Manucure semi-permanente Marrakech", search: "Manucure semi-permanente", city: "Marrakech" },
    { name: "Nail art Casablanca", search: "Nail art", city: "Casablanca" },
    { name: "Nail art Marrakech", search: "Nail art", city: "Marrakech" },
    { name: "Pédicure Casablanca", search: "Pédicure", city: "Casablanca" },
    { name: "Pédicure Marrakech", search: "Pédicure", city: "Marrakech" },
    { name: "Manucure française Casablanca", search: "Manucure française", city: "Casablanca" },
    { name: "Manucure française Marrakech", search: "Manucure française", city: "Marrakech" }
  ];

  const handleServiceClick = (search: string, city: string) => {
    const params = new URLSearchParams();
    if (search.trim()) params.append('query', search.trim());
    if (city.trim()) params.append('location', city.trim());
    params.append('category', 'Manucure');
    router.push(`/search-results?${params.toString()}`);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen pt-24 bg-[#f5f7f3]">
        {/* Hero Section with Search */}
        <section className="relative bg-[#f5f7f3] py-16 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-light text-gray-900 mb-8">
              Réserver en ligne un RDV pour une manucure
            </h1>
            
            {/* Search Bar */}
            <div className="max-w-4xl mx-auto bg-[#f5f7f3] rounded-full p-2 flex flex-col md:flex-row gap-2 items-center">
              <div className="flex-1 relative w-full">
                <label className="text-xs text-gray-500 absolute -top-5 left-4">
                  Que cherchez-vous ?
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  placeholder="Manucure"
                  className="w-full px-6 py-3 rounded-full border border-gray-300 focus:outline-none focus:border-black text-gray-900"
                />
              </div>
              
              <div className="flex-1 relative w-full">
                <LocationAutocomplete
                  value={location}
                  onChange={setLocation}
                  onEnter={handleSearch}
                  placeholder="Où"
                />
              </div>
              
              <button 
                onClick={handleSearch}
                className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-900 transition-all flex items-center gap-2 w-full md:w-auto justify-center"
              >
                Rechercher
              </button>
            </div>
          </div>
        </section>

        {/* Cities Section */}
        <section className="py-16 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-light text-gray-900 mb-8">Manucure</h2>
            
            <PaginatedCityCards
              cities={cities}
              loading={loadingCities}
              pageSize={6}
              onCityClick={handleCityClick}
            />
          </div>
        </section>

        {/* Popular Services */}
        <section className="py-16 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-light text-gray-900 mb-12">
              Nos prestations populaires à Casablanca et Marrakech
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-28 gap-y-8 mb-12">
              {popularServices.map((service, index) => (
                <button
                  key={index}
                  onClick={() => handleServiceClick(service.search, service.city)}
                  className="text-gray-900 underline hover:no-underline text-lg text-left"
                >
                  {service.name}
                </button>
              ))}
              <a
                href="#"
                className="text-gray-900 underline hover:no-underline text-lg"
              >
                Extensions d'ongles à Casablanca
              </a>
              <a
                href="#"
                className="text-gray-900 underline hover:no-underline text-lg"
              >
                Extensions d'ongles à Marrakech
              </a>
            </div>
            
            {/* Stats Section */}
            <StatsSection category="Manucure" />
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <p className="text-lg text-gray-700 leading-relaxed mb-12">
              Vous recherchez une manucure impeccable pour sublimer vos mains ou une pose de 
              vernis tendance pour une occasion spéciale ? Que ce soit pour des ongles naturels, 
              gel ou capsules, l'art de la manucure doit être confié à des professionnels qualifiés. 
              Pour chaque envie et chaque style, il existe une technique précise que seuls les 
              experts en beauté des ongles maîtrisent parfaitement. Nous avons sélectionné pour 
              vous les meilleurs instituts de manucure à Casablanca et à Marrakech.
            </p>

            {/* Benefits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-[#f5f7f3] border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  {/* replaced Sparkles icon with provided SVG */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M12 5v6m0 3v1.5m0 3v.5" />
                    <path d="M18 11l-6 -6" />
                    <path d="M6 11l6 -6" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Expertise professionnelle</h3>
                <p className="text-sm text-gray-600">Des prothésistes ongulaires qualifiées pour toutes vos envies</p>
              </div>
              <div className="bg-[#f5f7f3] border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Proximité garantie</h3>
                <p className="text-sm text-gray-600">Trouvez facilement un institut près de chez vous à Casablanca ou Marrakech</p>
              </div>
              <div className="bg-[#f5f7f3] border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Réservation instantanée</h3>
                <p className="text-sm text-gray-600">Prenez rendez-vous en ligne 24h/24 en quelques clics</p>
              </div>
            </div>
            
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              Où trouver un institut de manucure pour une technique particulière ?
            </h2>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              La manucure gel semi-permanente au Maroc
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-8">
              Les instituts spécialisés dans la manucure gel et semi-permanente sont très populaires 
              à Casablanca et Marrakech. Cette technique révolutionnaire permet d'obtenir des ongles 
              impeccables pendant 2 à 3 semaines sans écaillage. Les professionnelles maîtrisent 
              parfaitement la pose sous lampe UV/LED, le limage délicat et l'application de vernis 
              longue durée pour un résultat brillant et résistant. Notre sélection des meilleures 
              adresses vous garantit une prestation de qualité avec des produits haut de gamme et 
              une technique irréprochable pour des mains sublimes.
            </p>
            
            {/* Manicure Image */}
            <div className="my-12 rounded-2xl overflow-hidden">
              <img
                src="/manucure/banner.jpg"
                alt="Professional manicure tools"
                className="w-full h-80 object-cover"
              />
            </div>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Optez pour la manucure naturelle et bio à Casablanca ou Marrakech
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-12">
              Vous avez les ongles fragiles, cassants ou simplement sensibles aux produits chimiques ? 
              Prenez rendez-vous dans un institut qui privilégie les soins naturels et les vernis 
              bio certifiés. Des formules sans formaldéhyde, sans toluène et sans DBP, enrichies 
              en ingrédients végétaux comme l'huile d'argan ou le beurre de karité pour nourrir 
              vos ongles en profondeur. Ces instituts utilisent également des dissolvants doux 
              et des huiles cuticules naturelles pour préserver la santé de vos ongles tout en 
              obtenant un résultat esthétique parfait. Casablanca et Marrakech proposent de 
              nombreux instituts engagés dans la beauté responsable.
            </p>
          </div>
        </section>

        {/* Frequent Searches */}
        <section className="py-0 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-light text-gray-900 mb-8">Recherches fréquentes</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-3 mb-16">
              {frequentSearches.map((searchItem, index) => (
                <button
                  key={index}
                  onClick={() => handleServiceClick(searchItem.search, searchItem.city)}
                  className="text-gray-900 underline hover:no-underline text-sm text-left"
                >
                  {searchItem.name}
                </button>
              ))}
            </div>

            {/* Popular Techniques Showcase */}
            <h3 className="text-2xl font-light text-gray-900 mb-8 mt-16">Techniques tendances</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                <img src="/manucure/french.avif" alt="French manicure" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">French manucure</h4>
                  <p className="text-sm text-gray-600">Élégance classique et intemporelle</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                <img src="/manucure/gluv.jpg" alt="Gel nails" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Gel UV</h4>
                  <p className="text-sm text-gray-600">Brillance et tenue longue durée</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                <img src="/manucure/nailartcréatif.webp" alt="Nail art" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Nail art créatif</h4>
                  <p className="text-sm text-gray-600">Designs artistiques personnalisés</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                <img src="/manucure/soinnaturel.jpg" alt="Natural nails" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Soin naturel</h4>
                  <p className="text-sm text-gray-600">Produits bio et respectueux</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Special Occasions Section */}
        <section className="py-16 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              La manucure de vos rêves à Casablanca et Marrakech
            </h2>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Des manucures pour les grandes occasions
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-8">
              Manucure de mariée ou manucure de soirée, les instituts de beauté de Casablanca 
              et Marrakech proposent de nombreuses options pour avoir des ongles parfaits lors 
              de vos événements importants. Les professionnelles vous conseilleront sur les 
              dernières tendances comme le nail art minimaliste, les strass délicats ou encore 
              les dégradés sophistiqués. Manucure classique, gel, capsules, baby boomer, ombré... 
              les styles et les techniques se multiplient, incitant les prothésistes ongulaires 
              à se former continuellement aux nouvelles méthodes et aux innovations qui leur 
              permettront de mieux satisfaire leur clientèle et de proposer une large gamme de 
              prix et de prestations adaptées à tous les budgets.
            </p>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Quelle forme d'ongles tendance choisir ?
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-12">
              Envie de transformer vos mains ? Le choix de la forme d'ongles est essentiel pour 
              un résultat harmonieux. Désormais, la prothésiste ongulaire est une véritable 
              experte qui saura vous conseiller selon la forme de vos doigts et votre style de vie. 
              Pour des mains fines et élégantes, elle privilégiera une forme amande ou ovale qui 
              allonge visuellement les doigts. Pour des mains plus larges, elle optera pour une 
              forme carrée ou ballerine qui apporte de la structure. Les ongles courts peuvent 
              être sublimés avec une forme ronde ou squoval (carré arrondi) pour un look naturel 
              et moderne. Pour une manucure tendance et personnalisée, confiez vos mains à une 
              professionnelle qualifiée à Casablanca ou Marrakech.
            </p>
          </div>
        </section>

        {/* Salon Owner CTA */}
        <section className="py-0 pb-20 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              Vous êtes gérant d'un institut de beauté au Maroc ?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <img
                  src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80"
                  alt="Nail salon management"
                  className="w-full h-80 object-cover rounded-2xl"
                />
              </div>
              <div>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  Pour découvrir comment REZA peut vous aider à gérer vos rendez-vous, attirer 
                  de nouvelles clientes et développer votre activité de manucure à Casablanca ou 
                  Marrakech, rendez-vous sur notre espace dédié aux professionnels de la beauté.
                </p>
                
                <button className="bg-black text-white px-6 py-3 rounded-full font-medium hover:bg-gray-900 transition-all flex items-center gap-2">
                  En savoir plus
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}