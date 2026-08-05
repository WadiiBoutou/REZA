'use client';

import React, { useState } from 'react';
import { Search, MapPin, ArrowRight, Sparkles, Star } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function BeautyInstitutePage() {
  const [searchQuery, setSearchQuery] = useState('Institut de beauté');
  const [location, setLocation] = useState('');

  const cities = [
    {
      name: 'Casablanca',
      image: '/city/casa1.jpg',
      text: 'Découvrez nos instituts de beauté à Casablanca',
      salons: 389
    },
    {
      name: 'Marrakech',
      image: '/city/kech.webp',
      text: 'Découvrez nos instituts de beauté à Marrakech',
      salons: 267
    }
  ];

  const popularServices = [
    { name: "Soin visage à Casablanca", link: "#" },
    { name: "Soin visage à Marrakech", link: "#" },
    { name: "Épilation à Casablanca", link: "#" },
    { name: "Épilation à Marrakech", link: "#" }
  ];

  const frequentSearches = [
    { name: "Soin anti-âge Casablanca", link: "#" },
    { name: "Épilation définitive Casablanca", link: "#" },
    { name: "Soin anti-âge Marrakech", link: "#" },
    { name: "Épilation définitive Marrakech", link: "#" },
    { name: "Massage relaxant Casablanca", link: "#" },
    { name: "Massage relaxant Marrakech", link: "#" },
    { name: "Maquillage professionnel Casablanca", link: "#" },
    { name: "Maquillage professionnel Marrakech", link: "#" },
    { name: "Institut bio Casablanca", link: "#" },
    { name: "Institut bio Marrakech", link: "#" }
  ];

  return (
    <>
      <Header />
      <div className="min-h-screen pt-24 bg-[#f5f7f3]">
        {/* Hero Section with Search */}
        <section className="relative bg-[#f5f7f3] py-16 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-light text-gray-900 mb-8">
              Réserver en ligne un RDV dans un institut de beauté
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
                  placeholder="Institut de beauté"
                  className="w-full px-6 py-3 rounded-full border border-gray-300 focus:outline-none focus:border-black text-gray-900"
                />
              </div>
              
              <div className="flex-1 relative w-full">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Où"
                  className="w-full pl-12 pr-6 py-3 rounded-full border border-gray-300 focus:outline-none focus:border-black text-gray-900"
                />
              </div>
              
              <button className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-900 transition-all flex items-center gap-2 w-full md:w-auto justify-center">
                Rechercher
              </button>
            </div>
          </div>
        </section>

        {/* Cities Section */}
        <section className="py-16 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-light text-gray-900 mb-8">Institut de beauté</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {cities.map((city, index) => (
                <div key={index} className="relative rounded-2xl overflow-hidden group cursor-pointer h-64">
                  <img
                    src={city.image}
                    alt={city.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-6 left-6 text-white">
                    <p className="text-xl font-medium mb-1">{city.text}</p>
                    <p className="text-sm text-white/90">{city.salons} instituts disponibles</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-center">
              <span className="text-gray-500 italic font-medium">
                Plus de villes marocaines arrivent bientôt...
              </span>
            </div>
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
                <a
                  key={index}
                  href={service.link}
                  className="text-gray-900 underline hover:no-underline text-lg"
                >
                  {service.name}
                </a>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-16">
              <div className="bg-[#f5f7f3] rounded-xl p-6 text-center border border-gray-300">
                <div className="text-4xl font-light text-black mb-2">200+</div>
                <div className="text-sm text-gray-600">Instituts partenaires</div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl p-6 text-center border border-gray-300">
                <div className="text-4xl font-light text-black mb-2">3k+</div>
                <div className="text-sm text-gray-600">Réservations par mois</div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl p-6 text-center border border-gray-300">
                <div className="text-4xl font-light text-black mb-2">4.9/5</div>
                <div className="text-sm text-gray-600">Note moyenne</div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl p-6 text-center border border-gray-300">
                <div className="text-4xl font-light text-black mb-2">24/7</div>
                <div className="text-sm text-gray-600">Réservation en ligne</div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16 px-4 bg-[#f5f7f3]">
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
              <div className="bg-[#f5f7f3] border border-gray-300 rounded-xl p-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Expertise professionnelle</h3>
                <p className="text-sm text-gray-600">Des esthéticiennes diplômées pour tous types de soins</p>
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
        <section className="py-0 px-4 bg-[#f5f7f3]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-light text-gray-900 mb-8">Recherches fréquentes</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-3 mb-16">
              {frequentSearches.map((search, index) => (
                <a
                  key={index}
                  href={search.link}
                  className="text-gray-900 underline hover:no-underline text-sm"
                >
                  {search.name}
                </a>
              ))}
            </div>

            {/* Popular Treatments Showcase */}
            <h3 className="text-2xl font-light text-gray-900 mb-8 mt-16">Soins populaires</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                <img src="/institut-de-beaute/soinhydratant.jpg" alt="Facial treatment" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Soin hydratant</h4>
                  <p className="text-sm text-gray-600">Éclat et confort immédiat</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                <img src="/institut-de-beaute/epilationcomplete.jpg" alt="Waxing" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Épilation complète</h4>
                  <p className="text-sm text-gray-600">Peau douce et lisse</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
                <img src="/institut-de-beaute/massagerelaxant.jpg" alt="Massage" className="w-full h-48 object-cover" />
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-1">Massage relaxant</h4>
                  <p className="text-sm text-gray-600">Détente et bien-être</p>
                </div>
              </div>
              <div className="bg-[#f5f7f3] rounded-xl overflow-hidden transition-shadow">
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
        <section className="py-16 px-4 bg-[#f5f7f3]">
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
        <section className="py-0 px-4 bg-[#f5f7f3]">
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
        <section className="py-0 pb-20 px-4 bg-[#f5f7f3]">
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