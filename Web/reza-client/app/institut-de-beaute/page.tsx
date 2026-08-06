'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, ArrowRight, Sparkles, Star } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import StatsSection from '@/components/StatsSection';
import LocationAutocomplete from '@/components/LocationAutocomplete';
import PaginatedCityCards from '@/components/PaginatedCityCards';
import { MOROCCAN_CITIES } from '../../lib/utils';

export default function BeautyInstitutePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('Institut de beauté');
  const [location, setLocation] = useState('');
  const [cities, setCities] = useState<Array<{name: string; image: string; text: string; salons: number}>>([]);
  const [loadingCities, setLoadingCities] = useState(true);

  // Fetch all cities with salon counts for Institut de beauté category
  useEffect(() => {
    const fetchCityCounts = async () => {
      try {
        setLoadingCities(true);
        
        // Use all Moroccan cities (excluding "Autre" for display purposes)
        const allMoroccanCities = MOROCCAN_CITIES.filter(city => city !== 'Autre');
        
        // Fetch tenants for Institut de beauté category to count salons per city
        const institutResponse = await api.searchTenants(undefined, 'Institut de beauté', undefined, 10000);
        
        // For city counting, we only need category and city fields
        // Filter tenants that have at least category and city (required for counting)
        const tenantsWithCityAndCategory = (institutResponse.tenants || []).filter((tenant: any) => {
          return tenant.category && tenant.category.trim() && 
                 tenant.city && tenant.city.trim();
        });
        
        // Count tenants per city for Institut de beauté category
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
            text: `Découvrez nos instituts de beauté à ${city}`,
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
          { name: 'Casablanca', image: '/city/casa1.jpg', text: 'Découvrez nos instituts de beauté à Casablanca', salons: 0 },
          { name: 'Marrakech', image: '/city/kech.webp', text: 'Découvrez nos instituts de beauté à Marrakech', salons: 0 }
        ]);
      } catch (error) {
        console.error('Error fetching city counts:', error);
        // Fallback to default cities
        setCities([
          { name: 'Casablanca', image: '/city/casa1.jpg', text: 'Découvrez nos instituts de beauté à Casablanca', salons: 0 },
          { name: 'Marrakech', image: '/city/kech.webp', text: 'Découvrez nos instituts de beauté à Marrakech', salons: 0 }
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
    params.append('category', 'Institut de beauté');
    router.push(`/search-results?${params.toString()}`);
  };

  const handleCityClick = (cityName: string) => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('query', searchQuery.trim());
    if (cityName.trim()) params.append('location', cityName.trim());
    params.append('category', 'Institut de beauté');
    router.push(`/search-results?${params.toString()}`);
  };

  const popularServices = [
    { name: "Soin visage à Casablanca", search: "Soin visage", city: "Casablanca" },
    { name: "Soin visage à Marrakech", search: "Soin visage", city: "Marrakech" },
    { name: "Épilation à Casablanca", search: "Épilation", city: "Casablanca" },
    { name: "Épilation à Marrakech", search: "Épilation", city: "Marrakech" }
  ];

  const frequentSearches = [
    { name: "Soin anti-âge Casablanca", search: "Soin anti-âge", city: "Casablanca" },
    { name: "Épilation définitive Casablanca", search: "Épilation définitive", city: "Casablanca" },
    { name: "Soin anti-âge Marrakech", search: "Soin anti-âge", city: "Marrakech" },
    { name: "Épilation définitive Marrakech", search: "Épilation définitive", city: "Marrakech" },
    { name: "Massage relaxant Casablanca", search: "Massage relaxant", city: "Casablanca" },
    { name: "Massage relaxant Marrakech", search: "Massage relaxant", city: "Marrakech" },
    { name: "Maquillage professionnel Casablanca", search: "Maquillage professionnel", city: "Casablanca" },
    { name: "Maquillage professionnel Marrakech", search: "Maquillage professionnel", city: "Marrakech" },
    { name: "Institut bio Casablanca", search: "Institut bio", city: "Casablanca" },
    { name: "Institut bio Marrakech", search: "Institut bio", city: "Marrakech" }
  ];

  const handleServiceClick = (search: string, city: string) => {
    const params = new URLSearchParams();
    if (search.trim()) params.append('query', search.trim());
    if (city.trim()) params.append('location', city.trim());
    params.append('category', 'Institut de beauté');
    router.push(`/search-results?${params.toString()}`);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen pt-24 bg-white">
        {/* Hero Section with Search */}
        <section className="relative bg-white py-16 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-light text-gray-900 mb-8">
              Réserver en ligne un RDV dans un institut de beauté
            </h1>
            
            {/* Search Bar */}
            <div className="max-w-4xl mx-auto bg-white rounded-full p-2 flex flex-col md:flex-row gap-2 items-center">
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
                  placeholder="Institut de beauté"
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
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-light text-gray-900 mb-8">Institut de beauté</h2>
            
            <PaginatedCityCards
              cities={cities}
              loading={loadingCities}
              pageSize={6}
              onCityClick={handleCityClick}
            />
          </div>
        </section>

        {/* Popular Services */}
        <section className="py-16 px-4 bg-white">
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
                Massage corps à Casablanca
              </a>
              <a
                href="#"
                className="text-gray-900 underline hover:no-underline text-lg"
              >
                Massage corps à Marrakech
              </a>
            </div>
            
            {/* Stats Section */}
            <StatsSection category="Institut de beauté" />
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <p className="text-lg text-gray-700 leading-relaxed mb-12">
              Vous recherchez un moment de détente et de bien-être pour prendre soin de vous ? 
              Que ce soit pour un soin du visage revitalisant, une épilation professionnelle, 
              un massage relaxant ou un maquillage sophistiqué, les instituts de beauté offrent 
              une gamme complète de prestations pour sublimer votre beauté naturelle. Pour chaque 
              besoin et chaque type de peau, il existe des techniques spécifiques que seuls les 
              professionnels qualifiés peuvent maîtriser parfaitement. Nous avons sélectionné pour 
              vous les meilleurs instituts de beauté à Casablanca et à Marrakech.
            </p>

            {/* Benefits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-white border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Expertise professionnelle</h3>
                <p className="text-sm text-gray-600">Des esthéticiennes diplômées pour tous types de soins</p>
              </div>
              <div className="bg-white border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Proximité garantie</h3>
                <p className="text-sm text-gray-600">Trouvez facilement un institut près de chez vous à Casablanca ou Marrakech</p>
              </div>
              <div className="bg-white border border-gray-300 rounded-xl p-6">
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
              Où trouver un institut de beauté pour un soin particulier ?
            </h2>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Les soins du visage personnalisés au Maroc
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-8">
              Les instituts de beauté spécialisés dans les soins du visage sont très prisés à 
              Casablanca et Marrakech. Ces établissements proposent des protocoles sur-mesure 
              adaptés à chaque type de peau : hydratation en profondeur pour les peaux sèches, 
              nettoyage purifiant pour les peaux grasses, soins apaisants pour les peaux sensibles 
              ou traitements anti-âge pour préserver la jeunesse de votre épiderme. Les esthéticiennes 
              utilisent des produits haut de gamme et des techniques avancées comme le microneedling, 
              les peelings doux ou les massages faciaux japonais. Notre sélection des meilleures 
              adresses vous garantit une expertise reconnue et des résultats visibles dès la 
              première séance.
            </p>
            
            {/* Beauty Institute Image */}
            <div className="my-12 rounded-2xl overflow-hidden">
              <img
                src="/institut-de-beaute/banner.jpg"
                alt="Professional beauty treatment"
                className="w-full h-80 object-cover"
              />
            </div>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              L'épilation définitive et les techniques modernes
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-12">
              Vous en avez assez des séances d'épilation répétitives et vous souhaitez une 
              solution durable ? Les instituts spécialisés dans l'épilation définitive utilisent 
              des technologies de pointe comme l'épilation au laser ou à la lumière pulsée (IPL) 
              pour éliminer progressivement les poils indésirables. Ces méthodes sont efficaces 
              sur toutes les zones du corps et adaptées à différents types de peau. Pour ceux 
              qui préfèrent les méthodes traditionnelles, l'épilation à la cire orientale reste 
              une option privilégiée dans de nombreux instituts marocains, offrant une peau douce 
              pendant plusieurs semaines. Casablanca et Marrakech regorgent d'instituts équipés 
              des dernières technologies pour répondre à tous vos besoins d'épilation.
            </p>
          </div>
        </section>

        {/* Frequent Searches */}
        <section className="py-0 px-4 bg-white">
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

            {/* Popular Treatments Showcase */}
            <h3 className="text-2xl font-light text-gray-900 mb-8 mt-16">Soins populaires</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl overflow-hidden transition-shadow">
                <img src="/institut-de-beaute/soinhydratant.jpg" alt="Facial treatment" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Soin hydratant</h4>
                  <p className="text-sm text-gray-600">Éclat et confort immédiat</p>
                </div>
              </div>
              <div className="bg-white rounded-xl overflow-hidden transition-shadow">
                <img src="/institut-de-beaute/epilationcomplete.jpg" alt="Waxing" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Épilation complète</h4>
                  <p className="text-sm text-gray-600">Peau douce et lisse</p>
                </div>
              </div>
              <div className="bg-white rounded-xl overflow-hidden transition-shadow">
                <img src="/institut-de-beaute/massagerelaxant.jpg" alt="Massage" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Massage relaxant</h4>
                  <p className="text-sm text-gray-600">Détente et bien-être</p>
                </div>
              </div>
              <div className="bg-white rounded-xl overflow-hidden transition-shadow">
                <img src="/institut-de-beaute/makeupprofessional.jpg" alt="Makeup" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Maquillage pro</h4>
                  <p className="text-sm text-gray-600">Look sophistiqué</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Special Occasions Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              Des soins beauté sur-mesure à Casablanca et Marrakech
            </h2>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Prestations beauté pour les événements spéciaux
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-8">
              Préparation de mariage, maquillage de soirée ou mise en beauté pour une occasion 
              importante, les instituts de beauté de Casablanca et Marrakech proposent des forfaits 
              complets pour être resplendissante le jour J. Les professionnelles vous accompagnent 
              dans le choix du style adapté à votre personnalité et à l'événement : maquillage 
              naturel ou sophistiqué, pose de faux cils, mise en plis élégante. Les instituts 
              offrent également des soins préparatoires dans les jours précédant l'événement pour 
              une peau parfaite et un teint lumineux. Soin visage, corps, épilation, maquillage, 
              extensions de cils... les prestations se combinent pour créer un moment de détente 
              complet et vous permettre d'être sublime pour vos moments importants.
            </p>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Les rituels de beauté orientaux traditionnels
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-12">
              Les instituts marocains perpétuent les traditions ancestrales de beauté orientale 
              qui font la renommée du pays. Le hammam traditionnel suivi d'un gommage au savon 
              noir et d'un enveloppement au rhassoul purifie la peau en profondeur et élimine 
              les cellules mortes. Le massage aux huiles d'argan enrichies en huiles essentielles 
              nourrit intensément l'épiderme tout en procurant une relaxation absolue. Ces rituels 
              millénaires, transmis de génération en génération, sont aujourd'hui proposés dans 
              des espaces modernes et luxueux qui allient authenticité et confort contemporain. 
              Pour une expérience beauté unique mêlant tradition et innovation, confiez-vous aux 
              instituts spécialisés de Casablanca ou Marrakech qui préservent cet héritage tout 
              en intégrant les techniques les plus modernes.
            </p>
          </div>
        </section>

        {/* Additional Services Section */}
        <section className="py-0 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              Une approche holistique de la beauté
            </h2>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              Les soins corps pour une beauté globale
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-8">
              La beauté ne se limite pas au visage. Les instituts proposent désormais des soins 
              corps complets pour prendre soin de vous de la tête aux pieds. Les enveloppements 
              minceur aux algues ou à l'argile, les drainages lymphatiques pour relancer la 
              circulation, les gommages corporels exfoliants ou les modelages sculptants sont 
              autant de techniques qui permettent d'affiner la silhouette, de tonifier la peau 
              et d'éliminer les toxines. Ces soins sont souvent associés à des cures complètes 
              sur plusieurs semaines pour des résultats durables et visibles.
            </p>
            
            <h3 className="text-2xl font-normal text-gray-900 mb-4">
              La cosmétique bio et naturelle au cœur des préoccupations
            </h3>
            <p className="text-base text-gray-700 leading-relaxed mb-12">
              De plus en plus d'instituts marocains adoptent une démarche éco-responsable en 
              privilégiant les produits cosmétiques biologiques et naturels. Ces établissements 
              utilisent des soins certifiés bio, sans parabènes ni substances controversées, 
              formulés à base d'ingrédients végétaux cultivés de manière responsable. L'huile 
              d'argan, le miel de thym, l'eau de rose ou l'argile du Maroc sont des trésors 
              naturels qui constituent la base de nombreux soins proposés. Cette approche respecte 
              non seulement votre peau mais également l'environnement, tout en garantissant une 
              efficacité prouvée par des actifs puissants et concentrés.
            </p>
          </div>
        </section>

        {/* Institute Owner CTA */}
        <section className="py-0 pb-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-light text-gray-900 mb-8">
              Vous êtes gérant d'un institut de beauté au Maroc ?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <img
                  src="https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800&q=80"
                  alt="Beauty salon management"
                  className="w-full h-80 object-cover rounded-2xl"
                />
              </div>
              <div>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  Pour découvrir comment REZA peut vous aider à optimiser la gestion de vos 
                  rendez-vous, attirer une nouvelle clientèle et développer votre activité 
                  d'institut de beauté à Casablanca ou Marrakech, rendez-vous sur notre espace 
                  dédié aux professionnels de l'esthétique et du bien-être.
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
