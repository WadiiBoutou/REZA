"use client";

import { useState, useRef } from 'react';
import { MapPin, Star, ArrowLeft, Heart, Share2, Gift, Phone, Mail, X, ChevronLeft, ChevronRight, Check, User, Clock, Calendar } from 'lucide-react';
import RezaNavbar from '../../../components/Header';
import Footer from '../../../components/Footer';
import BookingModal, { type BookingData } from '../BookingModal';
import { DEMO_SALON_PHOTOS } from '@/lib/demo-images';

export default function SalonDetail() {
  const [isLiked, setIsLiked] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] = useState<TeamMember | null>(null);
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingData, setBookingData] = useState<BookingData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    notes: '',
    totalPrice: 0,
    totalDuration: '0min'
  });

  const servicesRef = useRef<HTMLDivElement>(null);

  type Service = {
    name: string;
    duration: string;
    price?: number;
    priceType?: string;
  };

  type TeamMember = { 
    name: string; 
    initials: string; 
    specialty: string;
    rating: number;
    experience: string;
  };

  const salon = {
    name: 'Salon Élégance',
    rating: 4.8,
    reviewCount: 156,
    priceLevel: '$$',
    address: 'Boulevard Zerktouni, Casablanca 20250',
    phone: '+212 5 22 98 76 54',
    email: 'contact@salonelegance.ma',
    description: 'Un espace de beauté et de bien-être où le luxe rencontre la simplicité. Notre équipe de professionnels passionnés vous accueille dans un cadre élégant et apaisant pour une expérience beauté exceptionnelle.',
    images: DEMO_SALON_PHOTOS,
    hours: {
      'Lundi': '9h - 19h',
      'Mardi': '9h - 19h',
      'Mercredi': '9h - 19h',
      'Jeudi': '9h - 19h',
      'Vendredi': '9h - 20h',
      'Samedi': '9h - 20h',
      'Dimanche': 'Fermé'
    },
    services: [
      {
        category: 'Coiffure Femme',
        items: [
          { name: 'Coupe & Brushing', duration: '1h 30min', price: 350 },
          { name: 'Coloration Complète', duration: '2h 30min', price: 650 },
          { name: 'Mèches', duration: '2h', price: 550 },
          { name: 'Brushing Seul', duration: '45min', price: 150 }
        ]
      },
      {
        category: 'Soins Capillaires',
        items: [
          { name: 'Soin Restructurant', duration: '45min', price: 280 },
          { name: 'Lissage Brésilien', duration: '3h', price: 1200 },
          { name: 'Botox Capillaire', duration: '2h', price: 800 }
        ]
      },
      {
        category: 'Beauté',
        items: [
          { name: 'Manucure', duration: '45min', price: 150 },
          { name: 'Pédicure', duration: '1h', price: 200 },
          { name: 'Maquillage', duration: '1h', price: 400 }
        ]
      }
    ],
    team: [
      { name: 'Sarah', initials: 'SM', specialty: 'Coloriste', rating: 4.9, experience: '8 ans' },
      { name: 'Karim', initials: 'KL', specialty: 'Coiffeur', rating: 4.8, experience: '6 ans' },
      { name: 'Amina', initials: 'AE', specialty: 'Styliste', rating: 4.7, experience: '5 ans' },
      { name: 'Mehdi', initials: 'MB', specialty: 'Barbier', rating: 4.8, experience: '7 ans' }
    ]
  };

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30'
  ];

  const selectService = (service: Service) => {
    const exists = selectedServices.find(s => s.name === service.name);
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.name !== service.name));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const getTotalPrice = () => {
    return selectedServices.reduce((sum, service) => sum + (service.price || 0), 0);
  };

  const getTotalDuration = () => {
    const minutes = selectedServices.reduce((sum, service) => {
      const match = service.duration.match(/(\d+)h?\s*(\d+)?min?/);
      if (match) {
        const hours = parseInt(match[1]) || 0;
        const mins = parseInt(match[2]) || 0;
        return sum + (hours * 60) + mins;
      }
      return sum;
    }, 0);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}min` : ''}` : `${mins}min`;
  };

  const handleBooking = () => {
    if (selectedServices.length === 0) {
      alert('Veuillez sélectionner au moins un service');
      return;
    }
    setShowBookingModal(true);
    setBookingStep(1);
  };

  const nextImage = () => setSelectedImage((prev) => (prev + 1) % salon.images.length);
  const prevImage = () => setSelectedImage((prev) => (prev - 1 + salon.images.length) % salon.images.length);

  return (
    <div className="min-h-screen bg-[#f5f7f3]">
      {/* Shared Header */}
      <RezaNavbar />

      {/* Page-specific header (back, like, share) */}
      <header className="mt-16 bg-[#f5f7f3] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <button className="w-10 h-10 hover:bg-gray-50 rounded-full transition-all flex items-center justify-center" onClick={() => window.history.back()}>
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsLiked(!isLiked)} className="w-10 h-10 hover:bg-gray-50 rounded-full transition-all flex items-center justify-center">
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
            </button>
            <button className="w-10 h-10 hover:bg-gray-50 rounded-full transition-all flex items-center justify-center">
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <div className="pt-0 pb-20">
        {/* Hero Image Gallery */}
        <div className="max-w-7xl mx-auto px-8 mb-16">
          <div className="grid grid-cols-4 gap-3 h-[500px]">
            <div className="col-span-2 row-span-2 relative rounded-2xl overflow-hidden cursor-pointer group">
              <img src={salon.images[selectedImage]} alt={salon.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" onClick={() => setShowLightbox(true)} />
            </div>
            {salon.images.slice(1, 5).map((img, idx) => (
              <div key={idx} className="relative rounded-2xl overflow-hidden cursor-pointer group" onClick={() => { setSelectedImage(idx + 1); setShowLightbox(true); }}>
                <img src={img} alt={`${salon.name} ${idx + 2}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-16">
              {/* Salon Info */}
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h1 className="text-5xl font-light text-gray-900 mb-4">{salon.name}</h1>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 fill-[#8b7260] text-[#8b7260]" />
                        <span className="text-lg text-gray-400 font-medium">{salon.rating}</span>
                        <span className="text-gray-400">({salon.reviewCount} avis)</span>
                      </div>
                      <span className="text-gray-300">·</span>
                      <span className="text-lg font-medium text-gray-600">{salon.priceLevel}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{salon.address}</span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-lg leading-relaxed">{salon.description}</p>
              </div>

              {/* Services */}
              <div ref={servicesRef}>
                <h2 className="text-3xl font-light text-gray-900 mb-8">Nos Prestations</h2>
                <div className="space-y-10">
                  {salon.services.map((category, idx) => (
                    <div key={idx}>
                      <h3 className="text-xl font-medium text-gray-900 mb-5">{category.category}</h3>
                      <div className="space-y-3">
                        {category.items.map((service, serviceIdx) => {
                          const isSelected = selectedServices.find(s => s.name === service.name);
                          return (
                            <div
                              key={serviceIdx}
                              onClick={() => selectService(service)}
                              className={`flex items-center justify-between p-5 rounded-xl cursor-pointer transition-all border-1 ${
                                isSelected
                                  ? 'border-[#8b7260] bg-[#8b7260]'
                                  : 'border-gray-300 hover:border-gray-300 bg-[#f5f7f3]'
                              }`}
                            >
                              <div className="flex-1">
                                <h4 className={`font-medium mb-2 ${isSelected ? 'text-white' : 'text-gray-900'}`}>{service.name}</h4>
                                <div className={`flex items-center gap-3 text-sm ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                                  <span className="flex items-center gap-1 font-mono">
                                    <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                                    {service.duration}
                                  </span>
                                  <span className={isSelected ? 'text-white/60' : ''}>·</span>
                                  <span className={`font-semibold font-mono ${isSelected ? 'text-white' : 'text-gray-900'}`}>{service.price} MAD</span>
                                </div>
                              </div>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-2 ${
                                isSelected
                                  ? 'border-white text-[#8b7260] bg-white'
                                  : 'border-gray-200 text-gray-300 bg-transparent'
                              }`}>
                                <Check className="w-5 h-5" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team */}
              <div>
                <h3 className="text-3xl font-light text-gray-900 mb-8">Notre Équipe</h3>
                <div className="grid grid-cols-2 gap-6">
                  {salon.team.map((member, idx) => {
                    const isActive = selectedTeamMember?.name === member.name;
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedTeamMember(member)}
                        className={`relative p-4 rounded-xl cursor-pointer transition-all border-1 ${
                          isActive
                            ? 'border-[#8b7260] bg-[#8b7260]'
                            : 'border-gray-300 hover:border-gray-300 bg-[#f5f7f3]'
                        }`}
                      >
                        {/* Top-right rating and experience */}
                        <div className="absolute top-3 right-3 flex items-center gap-2 bg-transparent rounded-full px-2.5 py-0.5 text-sm z-10">
                          <Star className={`w-4 h-4 ${isActive ? 'fill-[#8b7260] text-[#8b7260]' : 'fill-[#8b7260] text-[#8b7260]'}`} />
                          <span className={`font-medium ${isActive ? 'text-[#8b7260]' : 'text-[#8b7260]'}`}>{member.rating}</span>
                          <span className="text-gray-400">·</span>
                          <span className={`font-medium ${isActive ? 'text-[#8b7260]' : 'text-[#8b7260]'}`}>{member.experience}</span>
                        </div>
                        <div className="flex items-center gap-3 mb-2 mt-2">
                          {/* Added mt-2 here */}
                          <div
                            className={`w-12 h-12 rounded-full border flex items-center justify-center text-lg font-medium ${
                              isActive
                                ? 'bg-white text-[#8b7260] border-white'
                                : 'bg-[#8b7260] text-white border-[#8b7260]'
                            }`}
                          >
                            {member.initials}
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium mb-1 ${isActive ? 'text-white' : 'text-gray-900'}`}>{member.name}</p>
                            <p className={`text-sm ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{member.specialty}</p>
                          </div>
                        </div>
                        {/* Remove bottom rating/experience row */}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Sidebar - Sticky */}
            <div className="lg:col-span-1">
              <div className="sticky top-32 space-y-6">
                {/* Booking Summary */}
                {selectedServices.length > 0 ? (
                  <div className="bg-[#8b7260] rounded-2xl p-8 text-white">
                    <h3 className="text-xl font-medium mb-6">Votre sélection</h3>
                    <div className="space-y-3 mb-6">
                      {selectedServices.map((service, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm">
                          <span className="flex-1 pr-4">{service.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); selectService(service); }} className="text-white/60 hover:text-white">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-white/20 pt-6 space-y-3 mb-6">
                      <div className="flex justify-between">
                        <span className="text-white/80">Durée totale</span>
                        <span className="font-medium">{getTotalDuration()}</span>
                      </div>
                      <div className="flex justify-between text-2xl">
                        <span className="font-light">Total</span>
                        <span className="font-medium font-mono">{getTotalPrice()} MAD</span>
                      </div>
                    </div>
                    <button onClick={handleBooking} className="w-full py-3 bg-white text-[#8b7260] rounded-full font-medium hover:bg-gray-50 transition-all">
                      Réserver maintenant
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#f5f7f3] border rounded-2xl p-8 text-center">
                    <p className="text-gray-500 mb-6">Sélectionnez vos services pour commencer</p>
                    <button className="w-full py-3 bg-gray-200 text-gray-400 rounded-full font-medium cursor-not-allowed">
                      Réserver
                    </button>
                  </div>
                )}

                {/* Contact */}
                <div className="bg-[#f5f7f3] border rounded-2xl p-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Contact</h3>
                  <div className="space-y-4">
                    <a href={`tel:${salon.phone}`} className="flex items-center gap-3 text-gray-600 hover:text-[#8b7260] transition-colors">
                      <Phone className="w-5 h-5" />
                      <span>{salon.phone}</span>
                    </a>
                    <a href={`mailto:${salon.email}`} className="flex items-center gap-3 text-gray-600 hover:text-[#8b7260] transition-colors">
                      <Mail className="w-5 h-5" />
                      <span>{salon.email}</span>
                    </a>
                  </div>
                </div>

                {/* Hours */}
                <div className="bg-[#f5f7f3] border rounded-2xl p-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-6">Horaires</h3>
                  <div className="space-y-3">
                    {Object.entries(salon.hours).map(([day, hours]) => (
                      <div key={day} className="flex justify-between text-sm">
                        <span className="text-gray-600">{day}</span>
                        <span className={`font-medium ${hours === 'Fermé' ? 'text-red-500' : 'text-gray-900'}`}>{hours}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {showLightbox && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center">
          <button onClick={() => setShowLightbox(false)} className="absolute top-8 right-8 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all">
            <X className="w-6 h-6 text-white" />
          </button>
          <button onClick={prevImage} className="absolute left-8 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button onClick={nextImage} className="absolute right-8 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all">
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
          <img src={salon.images[selectedImage]} alt={salon.name} className="max-w-full max-h-full object-contain" />
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black/50 px-6 py-3 rounded-full">
            {selectedImage + 1} / {salon.images.length}
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal
        show={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        bookingStep={bookingStep}
        setBookingStep={setBookingStep}
        selectedServices={selectedServices}
        getTotalDuration={getTotalDuration}
        getTotalPrice={getTotalPrice}
        bookingData={bookingData}
        setBookingData={setBookingData}
        timeSlots={timeSlots}
        salonTeam={salon.team}
        selectedTeamMember={selectedTeamMember}
        setSelectedTeamMember={setSelectedTeamMember}
        setSelectedServices={setSelectedServices}
        onAddService={() => {
          setShowBookingModal(false);
          setTimeout(() => {
            servicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 200);
        }}
        salonServices={salon.services} // <-- Pass correct services here
      />

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}