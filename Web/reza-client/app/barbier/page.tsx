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

export default function BarbierPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('Barbiers');
  const [location, setLocation] = useState('');
  const [cities, setCities] = useState<Array<{name: string; image: string; text: string; salons: number}>>([]);
  const [loadingCities, setLoadingCities] = useState(true);

  // Fetch all cities with salon counts for Barbier category
  useEffect(() => {
    const fetchCityCounts = async () => {
      try {
        setLoadingCities(true);
        
        // Use all Moroccan cities (excluding "Autre" for display purposes)
        const allMoroccanCities = MOROCCAN_CITIES.filter(city => city !== 'Autre');
        
        // Fetch tenants for Barbier category to count salons per city
        const barbierResponse = await api.searchTenants(undefined, 'Barbier', undefined, 10000);
        
        // For city counting, we only need category and city fields
        // Filter tenants that have at least category and city (required for counting)
        const tenantsWithCityAndCategory = (barbierResponse.tenants || []).filter((tenant: any) => {
          return tenant.category && tenant.category.trim() && 
                 tenant.city && tenant.city.trim();
        });
        
        // Count tenants per city for Barbier category
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
            text: `Découvrez nos barbiers à ${city}`,
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
          { name: 'Casablanca', image: '/city/casa1.jpg', text: 'Découvrez nos barbiers à Casablanca', salons: 0 },
          { name: 'Marrakech', image: '/city/kech.webp', text: 'Découvrez nos barbiers à Marrakech', salons: 0 }
        ]);
      } catch (error) {
        console.error('Error fetching city counts:', error);
        // Fallback to default cities
        setCities([
          { name: 'Casablanca', image: '/city/casa1.jpg', text: 'Découvrez nos barbiers à Casablanca', salons: 0 },
          { name: 'Marrakech', image: '/city/kech.webp', text: 'Découvrez nos barbiers à Marrakech', salons: 0 }
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
    params.append('category', 'Barbier');
    router.push(`/search-results?${params.toString()}`);
  };

  const handleCityClick = (cityName: string) => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('query', searchQuery.trim());
    if (cityName.trim()) params.append('location', cityName.trim());
    params.append('category', 'Barbier');
    router.push(`/search-results?${params.toString()}`);
  };

  const popularServices = [
    { name: "Barbier à Casablanca", search: "Barbier", city: "Casablanca" },
    { name: "Barbier à Marrakech", search: "Barbier", city: "Marrakech" },
    { name: "Rasage traditionnel à Casablanca", search: "Rasage traditionnel", city: "Casablanca" },
    { name: "Rasage traditionnel à Marrakech", search: "Rasage traditionnel", city: "Marrakech" }
  ];

  const frequentSearches = [
    { name: "Taille de barbe Casablanca", search: "Taille de barbe", city: "Casablanca" },
    { name: "Taille de barbe Marrakech", search: "Taille de barbe", city: "Marrakech" },
    { name: "Coupe homme Casablanca", search: "Coupe homme", city: "Casablanca" },
    { name: "Coupe homme Marrakech", search: "Coupe homme", city: "Marrakech" },
    { name: "Rasage à l'ancienne Casablanca", search: "Rasage à l'ancienne", city: "Casablanca" },
    { name: "Rasage à l'ancienne Marrakech", search: "Rasage à l'ancienne", city: "Marrakech" },
    { name: "Barbier traditionnel Casablanca", search: "Barbier traditionnel", city: "Casablanca" },
    { name: "Barbier traditionnel Marrakech", search: "Barbier traditionnel", city: "Marrakech" },
    { name: "Soin barbe Casablanca", search: "Soin barbe", city: "Casablanca" },
    { name: "Soin barbe Marrakech", search: "Soin barbe", city: "Marrakech" }
  ];

  const handleServiceClick = (search: string, city: string) => {
    const params = new URLSearchParams();
    if (search.trim()) params.append('query', search.trim());
    if (city.trim()) params.append('location', city.trim());
    params.append('category', 'Barbier');
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
              Réserver en ligne un RDV avec un barbier
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
                  placeholder="Barbiers"
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
            <h2 className="text-2xl font-light text-gray-900 mb-8">Barbier</h2>
            
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
                Entretien barbe à Casablanca
              </a>
              <a
                href="#"
                className="text-gray-900 underline hover:no-underline text-lg"
              >
                Entretien barbe à Marrakech
              </a>
            </div>
            
            {/* Stats Section */}
            <StatsSection category="Barbier" />
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <p className="text-lg text-gray-700 leading-relaxed mb-12">
              Vous recherchez un barbier professionnel pour une coupe moderne, un rasage traditionnel 
              ou l'entretien de votre barbe ? L'art de la barberie traditionnelle marocaine combine 
              savoir-faire ancestral et techniques contemporaines. Que vous souhaitiez une taille de 
              barbe précise, un rasage au coupe-chou ou une coupe tendance, nos barbiers à Casablanca 
              et Marrakech vous offrent un service d'exception dans une ambiance conviviale et masculine.
            </p>

            {/* Benefits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-[#f5f7f3] border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  <Scissors className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Maîtrise traditionnelle</h3>
                <p className="text-sm text-gray-600">Des barbiers experts formés aux techniques traditionnelles et modernes</p>
              </div>
              <div className="bg-[#f5f7f3] border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Salons à proximité</h3>
                <p className="text-sm text-gray-600">Trouvez le barbier parfait près de chez vous à Casablanca ou Marrakech</p>
              </div>
              <div className="bg-[#f5f7f3] border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Prise de RDV facile</h3>
                <p className="text-sm text-gray-600">Réservez votre créneau en ligne à tout moment, rapidement</p>
              </div>
            </div>
            
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              L'art de la barberie au Maroc
            </h2>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Le barbier marocain, un savoir-faire unique
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-8">
              La barberie marocaine est un art qui se transmet de génération en génération. À Casablanca 
              et Marrakech, nos barbiers perpétuent cette tradition tout en intégrant les tendances 
              contemporaines. Du rasage traditionnel au coupe-chou avec serviette chaude, en passant par 
              les coupes modernes et l'entretien minutieux de la barbe, chaque prestation est réalisée 
              avec précision et passion. L'atmosphère unique des salons de barbier marocains, entre 
              modernité et authenticité, offre un moment de détente privilégié pour les hommes de tous âges.
            </p>
            
            {/* Barber Image */}
            <div className="my-12 rounded-2xl overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1200&q=80"
                alt="Professional barber at work"
                className="w-full h-80 object-cover"
              />
            </div>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Le rasage traditionnel, une expérience authentique
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-12">
              Le rasage traditionnel au coupe-chou est l'une des spécialités les plus prisées de nos 
              barbiers. Cette technique ancestrale offre un rasage de près incomparable et une sensation 
              de fraîcheur unique. Précédé d'une préparation de la peau avec des serviettes chaudes et 
              des huiles essentielles, suivi d'un massage apaisant et de l'application de baumes 
              hydratants, le rasage traditionnel est bien plus qu'un simple soin : c'est un rituel de 
              bien-être masculin. Nos barbiers à Casablanca et Marrakech maîtrisent parfaitement cet art 
              délicat qui requiert précision, dextérité et expérience.
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

            {/* Popular Services Showcase */}
            <h3 className="text-2xl font-light text-gray-900 mb-8 mt-16">Services tendances</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                {/* Rasage traditionnel */}
                <img src="/barbier/rasagetraditionnel.jpg" alt="Rasage traditionnel" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Rasage traditionnel</h4>
                  <p className="text-sm text-gray-600">Au coupe-chou avec serviette chaude</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                {/* Taille de barbe */}
                <img src="/barbier/taillebarbe.webp" alt="Taille de barbe" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Taille de barbe</h4>
                  <p className="text-sm text-gray-600">Sculptage et entretien précis</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                {/* Coupe moderne */}
                <img src="/barbier/moderne.jpg" alt="Coupe moderne" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Coupe moderne</h4>
                  <p className="text-sm text-gray-600">Styles contemporains et tendances</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                {/* Soin barbe */}
                <img src="/barbier/soinbarbe.avif" alt="Soin barbe" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Soin barbe</h4>
                  <p className="text-sm text-gray-600">Huiles et baumes naturels</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Styles and Techniques Section */}
        <section className="py-16 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              Trouvez le style qui vous correspond à Casablanca et Marrakech
            </h2>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              L'entretien de barbe, un art délicat
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-8">
              Une belle barbe nécessite un entretien régulier et professionnel. Nos barbiers à Casablanca 
              et Marrakech sont spécialisés dans la taille, le sculptage et le soin de la barbe. Qu'elle 
              soit courte, longue, hipster ou classique, chaque type de barbe demande une attention 
              particulière. Les barbiers utilisent des techniques de précision avec tondeuse, ciseaux et 
              rasoir pour créer des lignes nettes et des contours parfaits. Ils proposent également des 
              soins spécifiques avec des huiles de barbe, baumes et cires de qualité pour nourrir le poil, 
              adoucir la barbe et lui donner un aspect soigné et brillant.
            </p>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Les coupes tendances pour hommes
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-12">
              Au-delà du rasage et de la barbe, le barbier est aussi l'expert des coupes masculines 
              modernes. Fade, undercut, pompadour, quiff ou coupe classique, les possibilités sont 
              infinies. Les barbiers de Casablanca et Marrakech suivent les dernières tendances 
              internationales tout en respectant les préférences locales. Ils vous conseillent sur la 
              coupe qui mettra le mieux en valeur la forme de votre visage et votre style personnel. 
              Chaque coupe est réalisée avec minutie, associant tondeuse de précision, ciseaux et rasoir 
              pour les finitions. Le résultat : un look impeccable et une coiffure qui dure.
            </p>
          </div>
        </section>

        {/* Barber Owner CTA */}
        <section className="py-0 pb-20 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              Vous êtes gérant d'un salon de barbier au Maroc ?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <img
                  src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80"
                  alt="Barber shop management"
                  className="w-full h-80 object-cover rounded-2xl"
                />
              </div>
              <div>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  Découvrez comment Planity peut transformer la gestion de votre salon de barbier. 
                  Simplifiez vos prises de rendez-vous, attirez une nouvelle clientèle et boostez votre 
                  activité à Casablanca ou Marrakech grâce à notre plateforme dédiée aux professionnels 
                  de la barberie.
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