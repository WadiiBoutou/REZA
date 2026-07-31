'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, ArrowRight, Scissors } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import StatsSection from '@/components/StatsSection';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import PaginatedCityCards from '@/components/PaginatedCityCards';
import { MOROCCAN_CITIES } from '../../lib/utils';

export default function CoiffeurPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('Coiffeurs');
  const [location, setLocation] = useState('');
  const [cities, setCities] = useState<Array<{name: string; image: string; text: string; salons: number}>>([]);
  const [loadingCities, setLoadingCities] = useState(true);

  // Fetch all cities with salon counts for Coiffeur category
  useEffect(() => {
    const fetchCityCounts = async () => {
      try {
        setLoadingCities(true);
        
        // Use all Moroccan cities (excluding "Autre" for display purposes)
        const allMoroccanCities = MOROCCAN_CITIES.filter(city => city !== 'Autre');
        
        // Fetch tenants for Coiffeur category to count salons per city
        const coiffeurResponse = await api.searchTenants(undefined, 'Coiffeur', undefined, 10000);
        
        // For city counting, we only need category and city fields
        // Filter tenants that have at least category and city (required for counting)
        const tenantsWithCityAndCategory = (coiffeurResponse.tenants || []).filter((tenant: any) => {
          return tenant.category && tenant.category.trim() && 
                 tenant.city && tenant.city.trim();
        });
        
        // Count tenants per city for Coiffeur category
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
            text: `Découvrez nos coiffeurs à ${city}`,
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
          { name: 'Casablanca', image: '/city/casa1.jpg', text: 'Découvrez nos coiffeurs à Casablanca', salons: 0 },
          { name: 'Marrakech', image: '/city/kech.webp', text: 'Découvrez nos coiffeurs à Marrakech', salons: 0 }
        ]);
      } catch (error) {
        console.error('Error fetching city counts:', error);
        // Fallback to default cities
        setCities([
          { name: 'Casablanca', image: '/city/casa1.jpg', text: 'Découvrez nos coiffeurs à Casablanca', salons: 0 },
          { name: 'Marrakech', image: '/city/kech.webp', text: 'Découvrez nos coiffeurs à Marrakech', salons: 0 }
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
    params.append('category', 'Coiffeur');
    router.push(`/search-results?${params.toString()}`);
  };

  const handleCityClick = (cityName: string) => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('query', searchQuery.trim());
    if (cityName.trim()) params.append('location', cityName.trim());
    params.append('category', 'Coiffeur');
    router.push(`/search-results?${params.toString()}`);
  };

  const popularServices = [
    { name: "Coiffeur à Casablanca", search: "Coiffeur", city: "Casablanca" },
    { name: "Coiffeur à Marrakech", search: "Coiffeur", city: "Marrakech" },
    { name: "Lissage à Casablanca", search: "Lissage", city: "Casablanca" },
    { name: "Lissage à Marrakech", search: "Lissage", city: "Marrakech" }
  ];

  const frequentSearches = [
    { name: "Coiffure femme Casablanca", search: "Coiffure femme", city: "Casablanca" },
    { name: "Coiffure homme Casablanca", search: "Coiffure homme", city: "Casablanca" },
    { name: "Coiffure femme Marrakech", search: "Coiffure femme", city: "Marrakech" },
    { name: "Coiffure homme Marrakech", search: "Coiffure homme", city: "Marrakech" },
    { name: "Coloration Casablanca", search: "Coloration", city: "Casablanca" },
    { name: "Coloration Marrakech", search: "Coloration", city: "Marrakech" },
    { name: "Brushing Casablanca", search: "Brushing", city: "Casablanca" },
    { name: "Brushing Marrakech", search: "Brushing", city: "Marrakech" },
    { name: "Salon bio Casablanca", search: "Salon bio", city: "Casablanca" },
    { name: "Salon bio Marrakech", search: "Salon bio", city: "Marrakech" }
  ];

  const handleServiceClick = (search: string, city: string) => {
    const params = new URLSearchParams();
    if (search.trim()) params.append('query', search.trim());
    if (city.trim()) params.append('location', city.trim());
    params.append('category', 'Coiffeur');
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
              Réserver en ligne un RDV avec un coiffeur
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
                  placeholder="Coiffeurs"
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
            <h2 className="text-2xl font-light text-gray-900 mb-8">Coiffeur</h2>
            
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
              {/* Example additional element */}
              <a
                href="#"
                className="text-gray-900 underline hover:no-underline text-lg"
              >
                Soin capillaire à Casablanca
              </a>
              <a
                href="#"
                className="text-gray-900 underline hover:no-underline text-lg"
              >
                Soin capillaire à Marrakech
              </a>
            </div>
            
            {/* Stats Section */}
            <StatsSection category="Coiffeur" />
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <p className="text-lg text-gray-700 leading-relaxed mb-12">
              Vous désirez une nouvelle coupe de cheveux pour sublimer votre visage ou une 
              coiffure tendance pour sortir ? Que ce soit pour des cheveux longs, courts ou mi-longs, 
              l'art du coiffage doit être laissé aux professionnels. Pour chaque objectif relooking, 
              il y a une méthode précise que seuls les coiffeurs aguerris peuvent mettre en œuvre. 
              Nous avons sélectionné pour vous des coiffeurs à Casablanca et à Marrakech.
            </p>

            {/* Benefits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-[#f5f7f3] border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  <Scissors className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Expertise professionnelle</h3>
                <p className="text-sm text-gray-600">Des coiffeurs qualifiés et expérimentés pour tous types de cheveux</p>
              </div>
              <div className="bg-[#f5f7f3] border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Proximité garantie</h3>
                <p className="text-sm text-gray-600">Trouvez facilement un salon près de chez vous à Casablanca ou Marrakech</p>
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
              Où trouver un salon de coiffure pour une technique particulière ?
            </h2>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Qu'en est-il de la coiffure pour homme au Maroc ?
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-8">
              Les salons de coiffure dédiés spécialement à la gent masculine sont très populaires à Casablanca et Marrakech. Savant mélange entre le barbier et le salon de coiffure traditionnel, ces salons taillent la barbe, pratiquent le rasage à l'ancienne et coupent les cheveux pour une allure stylée et moderne. Notre sélection des meilleures adresses pour homme vous garantit une prestation complète et une ambiance agréable entre les mains expertes des coiffeurs marocains.
            </p>
            
            {/* Scissors Image */}
            <div className="my-12 rounded-2xl overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&q=80"
                alt="Professional hairdressing scissors"
                className="w-full h-80 object-cover"
              />
            </div>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Adoptez la coiffure bio à Casablanca ou Marrakech
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-12">
              Vous avez les cheveux bouclés, fins et délicats ou peut-être des cheveux secs et 
              très abîmés ? Prenez rendez-vous dans un salon de coiffure qui n'utilise que des 
              produits 100% naturels labellisés : des soins capillaires, des colorations, des 
              shampooings ou des crèmes pour cheveux essentiellement fabriqués avec des 
              ingrédients végétaux et sans produits chimiques pour soigner les cheveux tout en 
              préservant votre santé. Casablanca et Marrakech proposent de nombreux salons bio.
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
                <img src="/coiff/balayage.jpg" alt="Balayage" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Balayage</h4>
                  <p className="text-sm text-gray-600">Effet naturel et lumineux</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                <img src="/coiff/lissage.webp" alt="Lissage marocain" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Lissage marocain</h4>
                  <p className="text-sm text-gray-600">Cheveux lisses et brillants</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                <img src="/coiff/tendance.webp" alt="Coupe moderne" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Coupe tendance</h4>
                  <p className="text-sm text-gray-600">Style contemporain</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                <img src="/coiff/vege.webp" alt="Coloration végétale" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Coloration végétale</h4>
                  <p className="text-sm text-gray-600">100% naturel et bio</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Special Occasions Section */}
        <section className="py-16 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              La coiffure de vos rêves à Casablanca et Marrakech
            </h2>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Des coiffures pour les grandes occasions
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-8">
              Coiffure de mariée ou coiffure de soirée, les coiffeurs de Casablanca et Marrakech proposent de nombreuses 
              options pour être la plus chic et éviter à tout prix le chignon classique un brin 
              ennuyeux. Laissez le coiffeur vous conseiller sur les accessoires tendance comme le headband 
              ou encore les barrettes. Coupe homme, femme, enfant, brushing, coloration, coiffure afro, coiffeur bio... 
              les styles et les tendances rythment les journées des professionnels de ce métier, 
              les incitant à découvrir les nouvelles techniques et les innovations technologiques 
              qui leur permettront de mieux satisfaire leur clientèle et de proposer une large 
              gamme de prix et de prestations.
            </p>
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Quelle coupe de cheveux tendance choisir ?
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-12">
              Envie de changer de tête ? Un coup de ciseau sur votre crinière peut suffire. 
              Désormais, le coiffeur-visagiste est le spécialiste des coupes morpho. Cette 
              technique consiste à étudier la forme du visage pour décider de la coupe à 
              adopter. Pour un visage rond, il privilégiera une coupe au carré pour donner du 
              volume sur le haut et à l'arrière de la tête tandis que pour un visage ovale et fin, il 
              optera pour des mèches sur le front. Pour une coupe tendance, confiez votre 
              chevelure à un artisan coiffeur spécialisé à Casablanca ou Marrakech.
            </p>
          </div>
        </section>

        {/* Salon Owner CTA */}
        <section className="py-0 pb-20 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              Vous êtes gérant d'un salon de coiffure au Maroc ?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <img
                  src="https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=80"
                  alt="Salon management"
                  className="w-full h-80 object-cover rounded-2xl"
                />
              </div>
              <div>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  Pour découvrir comment Planity peut vous aider à gérer vos rendez-vous, attirer 
                  de nouveaux clients et développer votre activité à Casablanca ou Marrakech, rendez-vous sur notre espace 
                  dédié aux pros.
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