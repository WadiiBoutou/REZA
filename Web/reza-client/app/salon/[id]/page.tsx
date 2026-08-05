"use client";

import { useState, useRef, useEffect } from 'react';
import { MapPin, Star, ArrowLeft, Heart, Gift, Phone, Mail, X, ChevronLeft, ChevronRight, Check, User, Users, Clock, Calendar, Globe, Instagram, Facebook, Linkedin, Map } from 'lucide-react';

// Brand icons for X and TikTok (not provided by lucide)
const XBrandIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TikTokBrandIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);
import { useParams, useRouter } from 'next/navigation';
import RezaNavbar from '../../../components/Header';
import Footer from '../../../components/Footer';
import BookingModal from '../BookingModal';
import SalonMap from '../../../components/SalonMap';
import api from '../../../lib/api';
import { useAvailability } from '../../../hooks/useAvailability';
import { useAuth } from '../../../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';
import { formatMoroccoDate, getRelativeDate, formatTimeForDisplay, getImageUrl, getSalonSlug } from '../../../lib/utils';

export default function SalonDetail() {
  const params = useParams();
  const salonId = params?.id as string;
  
  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState<any>({ averageRating: 0, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isLiked, setIsLiked] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [showLightbox, setShowLightbox] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showBookingOptionModal, setShowBookingOptionModal] = useState(false);
  const [slotServiceIds, setSlotServiceIds] = useState<string[]>([]);
  const [existingParticipants, setExistingParticipants] = useState<Array<{
    serviceIds: string[];
    startTime: string;
    serviceEmployees?: Array<{ serviceId: string; employeeId: string | null }>;
  }>>([]);
  const [currentServiceEmployees, setCurrentServiceEmployees] = useState<Array<{ serviceId: string; employeeId: string | null }>>([]);
  const [bookingStep, setBookingStep] = useState(1);
  const [isGroupBooking, setIsGroupBooking] = useState(false);
  const [bookingData, setBookingData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    notes: '',
    totalPrice: 0,
    totalDuration: ''
  });

  const servicesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!salonId) return;
    
    const fetchSalonData = async () => {
      try {
        setLoading(true);
        const [tenantRes, servicesRes, employeesRes, reviewsRes] = await Promise.all([
          api.getTenant(salonId),
          api.getTenantServices(salonId),
          api.getTenantEmployees(salonId),
          api.getTenantReviews(salonId, 1, 10)
        ]);

        setSalon(tenantRes.tenant);
        setServices(servicesRes.services);
        setEmployees(employeesRes.employees);

        // Pretty URL: replace CUID in address bar with subdomain when available
        const slug = getSalonSlug(tenantRes.tenant);
        if (slug && salonId && slug !== salonId && typeof window !== 'undefined') {
          window.history.replaceState(null, '', `/salon/${slug}`);
        }
        
        // Format reviews to match frontend expected format
        const formattedReviews = (reviewsRes.reviews || []).map((review: any) => ({
          id: review.id,
          name: review.client ? `${review.client.firstName || ''} ${review.client.lastName || ''}`.trim() : 'Client',
          rating: review.rating || 0,
          text: review.comment || '',
          date: review.createdAt ? formatMoroccoDate(review.createdAt, { day: 'numeric', month: 'long', year: 'numeric' }) : formatMoroccoDate(new Date())
        }));
        
        setReviews(formattedReviews);
        setReviewStats(reviewsRes.stats || { averageRating: 0, totalReviews: 0 });
      } catch (err: any) {
        console.error('Error fetching salon data:', err);
        setError(err.message || 'Failed to load salon information');
      } finally {
        setLoading(false);
      }
    };

    fetchSalonData();
  }, [salonId]);

  // Check if salon is in favorites when salon loads
  useEffect(() => {
    if (!salon?.id || !isAuthenticated || !user?.email) {
      setIsLiked(false);
      setFavoriteId(null);
      return;
    }

    const checkFavorite = async () => {
      try {
        const response = await api.getClientFavorites(user.email);
        const favorites = response.favorites || [];
        const favorite = favorites.find((fav: any) => 
          fav.tenantId === salon.id || fav.tenant?.id === salon.id
        );
        
        if (favorite) {
          setIsLiked(true);
          setFavoriteId(favorite.id);
        } else {
          setIsLiked(false);
          setFavoriteId(null);
        }
      } catch (error) {
        console.error('Error checking favorite:', error);
      }
    };

    checkFavorite();
  }, [salon?.id, isAuthenticated, user?.email]);

  type Service = {
    id?: string;
    name: string;
    duration: string;
    price?: number;
    priceType?: string;
  };

  type TeamMember = { 
    id?: string;
    name: string; 
    initials: string; 
    specialty: string;
  };

  // Transform API data to component format
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
    if (hours > 0) return `${hours}h`;
    return `${mins}min`;
  };

  const formatServices = (services: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    services.forEach(service => {
      const category = service.category || 'Autres';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push({
        id: service.id,
        name: service.name,
        duration: formatDuration(service.duration),
        price: service.price || service.priceFrom || 0,
        priceType: service.priceType
      });
    });
    return Object.entries(grouped).map(([category, items]) => ({
      category,
      items
    }));
  };

  const formatTeam = (employees: any[]) => {
    // Filter only active employees
    const activeEmployees = employees.filter(emp => emp.isActive !== false);
    
    return activeEmployees.map(emp => {
      // Get first service name from services array
      const firstService = emp.services && emp.services.length > 0 
        ? emp.services[0].name 
        : null;
      
      return {
        id: emp.id,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        initials: `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase() || '?',
        specialty: firstService || 'Professionnel'
      };
    });
  };

  const formatHours = (businessHours: any) => {
    if (!businessHours || typeof businessHours !== 'object' || Object.keys(businessHours).length === 0) {
      return {
        'Lundi': '9h - 19h',
        'Mardi': '9h - 19h',
        'Mercredi': '9h - 19h',
        'Jeudi': '9h - 19h',
        'Vendredi': '9h - 20h',
        'Samedi': '9h - 20h',
        'Dimanche': 'Fermé'
      };
    }
    
    // Format business hours using Morocco format (HHhMM)
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const hours: { [key: string]: string } = {};
    
    days.forEach((day) => {
      const dayKey = day.toLowerCase();
      if (businessHours[dayKey] && businessHours[dayKey].open && businessHours[dayKey].close) {
        const openTime = formatTimeForDisplay(businessHours[dayKey].open);
        const closeTime = formatTimeForDisplay(businessHours[dayKey].close);
        hours[day] = `${openTime} - ${closeTime}`;
      } else {
        hours[day] = 'Fermé';
      }
    });
    
    return hours;
  };

  const salonData = salon ? {
    name: salon.name || 'Salon',
    rating: reviewStats.averageRating || 0,
    reviewCount: reviewStats.totalReviews || 0,
    priceLevel: salon.price || null,
    address: salon.address || salon.city || '',
    phone: salon.phone || '',
    email: salon.email || '',
    description: salon.shortDescription || salon.settings?.description || null,
    images: (() => {
      const defaultImage = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80';
      const coverImage = salon.coverImage;
      const coverImages = salon.settings?.coverImages || [];
      const photos = salon.settings?.photos || [];
      const allImages = coverImage
        ? [coverImage, ...coverImages, ...photos]
        : [...coverImages, ...photos];
      // Filter out any null/undefined/empty strings and ensure we have at least one image
      const validImages = allImages
        .filter((img: any) => {
          if (!img) return false;
          // Ensure img is a string before calling trim
          const imgStr = typeof img === 'string' ? img : String(img);
          return imgStr.trim() !== '';
        })
        .map((img: string) => getImageUrl(img)); // Convert all image paths to full URLs
      return validImages.length > 0 ? validImages : [defaultImage];
    })(),
    hours: formatHours(salon.settings?.businessHours),
    services: formatServices(services),
    team: formatTeam(employees),
    tags: salon.tags || [],
    website: salon.website || salon.settings?.website,
    socialMedia: salon.settings?.socialMedia || {},
    coordinates: salon.coordinates,
    googleMapsLink: salon.googleMapsLink,
    amenities: salon.settings?.amenities || [],
    onlineBooking: salon.settings?.onlineBooking || 'open'
  } : null;

  // Use real-time availability hook
  const serviceIds =
    slotServiceIds.length > 0
      ? slotServiceIds
      : (selectedServices.map((s) => s.id).filter(Boolean) as string[]);
  const { slots: timeSlots, loading: slotsLoading, error: slotsError, lastUpdated } = useAvailability({
    tenantId: salon?.id || '',
    date: bookingData.date || null,
    serviceIds,
    enabled: !!salon && !!bookingData.date && serviceIds.length > 0,
    pollInterval: 30000,
    clientEmail: user?.email,
    existingParticipants: existingParticipants.length > 0 ? existingParticipants : undefined,
    serviceEmployees: currentServiceEmployees.length > 0 ? currentServiceEmployees : undefined,
  });

  const selectService = (service: Service) => {
    const exists = selectedServices.find(s => s.id === service.id || s.name === service.name);
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id && s.name !== service.name));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const getTotalPrice = () => {
    return selectedServices.reduce((sum, service) => sum + (service.price || 0), 0);
  };

  const getTotalDuration = () => {
    const minutes = selectedServices.reduce((sum, service) => {
      const duration = service.duration.trim();
      let min = 0;
      const hMatch = duration.match(/(\d+)\s*h/);
      const mMatch = duration.match(/(\d+)\s*min/);
      if (hMatch) min += parseInt(hMatch[1], 10) * 60;
      if (mMatch) min += parseInt(mMatch[1], 10);
      if (!hMatch && !mMatch && /^\d+$/.test(duration)) min += parseInt(duration, 10);
      return sum + min;
    }, 0);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours && mins) return `${hours}h ${mins}min`;
    if (hours) return `${hours}h`;
    return `${mins}min`;
  };

  const [bookingError, setBookingError] = useState<string | null>(null);

  const handleMainReserve = () => {
    const onlineBooking = salon?.settings?.onlineBooking || 'open';
    if (onlineBooking === 'closed') {
      setBookingError('La prise de rendez-vous en ligne est actuellement fermée.');
      setTimeout(() => setBookingError(null), 5000);
      return;
    }
    setShowBookingOptionModal(true);
  };

  const handleBooking = () => {
    // Check if online booking is enabled
    const onlineBooking = salon?.settings?.onlineBooking || 'open';
    if (onlineBooking === 'closed') {
      setBookingError('La prise de rendez-vous en ligne est actuellement fermée.');
      setTimeout(() => setBookingError(null), 5000);
      return;
    }
    
    if (selectedServices.length === 0) {
      setBookingError('Veuillez sélectionner au moins un service');
      setTimeout(() => setBookingError(null), 3000);
      return;
    }
    setBookingError(null);
    setShowBookingModal(true);
    setBookingStep(1);
  };

  const nextImage = () => {
    if (!salonData) return;
    setSelectedImage((prev) => (prev + 1) % salonData.images.length);
  };
  const prevImage = () => {
    if (!salonData) return;
    setSelectedImage((prev) => (prev - 1 + salonData.images.length) % salonData.images.length);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111827] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !salonData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Salon introuvable'}</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-[#111827] text-white rounded-full"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '12px',
            padding: '16px',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#111827',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      {/* Shared Header */}
      <RezaNavbar />

      {/* Page-specific header (back, like) */}
      <header className="mt-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-between">
          <button className="w-10 h-10 hover:bg-gray-50 rounded-full transition-all flex items-center justify-center" onClick={() => window.history.back()}>
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                if (!isAuthenticated || !user?.email) {
                  router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
                  return;
                }

                if (!salon?.id) return;

                try {
                  if (isLiked && favoriteId) {
                    // Remove from favorites
                    await api.removeFavorite(favoriteId, user.email);
                    setIsLiked(false);
                    setFavoriteId(null);
                    // Success feedback will be visual (heart icon changes)
                  } else {
                    // Add to favorites
                    const response = await api.addFavorite(user.email, salon.id);
                    // Response can have favorite.id directly or nested in favorite object
                    const favoriteId = response.favorite?.id || (response as any).id;
                    if (favoriteId) {
                      setIsLiked(true);
                      setFavoriteId(favoriteId);
                      // Success feedback will be visual (heart icon changes)
                    } else {
                      // Re-check favorites to get the ID
                      const favoritesRes = await api.getClientFavorites(user.email);
                      const favorite = favoritesRes.favorites.find((fav: any) => 
                        fav.tenantId === salon.id || fav.tenant?.id === salon.id
                      );
                      if (favorite) {
                        setIsLiked(true);
                        setFavoriteId(favorite.id);
                        // Success feedback will be visual (heart icon changes)
                      }
                    }
                  }
                } catch (error: any) {
                  console.error('Error toggling favorite:', error);
                  alert(error.message || 'Erreur lors de la sauvegarde du favori');
                }
              }}
              className="w-10 h-10 hover:bg-gray-50 rounded-full transition-all flex items-center justify-center"
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="pt-0 pb-12 sm:pb-20">
        {/* Hero Image Gallery */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 sm:mb-12 lg:mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 h-[300px] sm:h-[400px] lg:h-[500px]">
            <div className="relative rounded-2xl overflow-hidden cursor-pointer group" onClick={() => { setSelectedImage(0); setShowLightbox(true); }}>
              <img src={salonData.images[0] || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1774&q=80'} alt={salonData.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="hidden sm:block relative rounded-2xl overflow-hidden cursor-pointer group" onClick={() => { setSelectedImage(1); setShowLightbox(true); }}>
              <img src={salonData.images[1] || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1770&q=80'} alt={`${salonData.name} 2`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12 lg:gap-16">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-8 sm:space-y-12 lg:space-y-16">
              {/* Salon Info */}
              <div>
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                  <div className="flex-1">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light text-gray-900 mb-3 sm:mb-4">{salonData.name}</h1>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-2 sm:mb-3">
                      {salonData.reviewCount > 0 ? (
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-[#111827] text-[#111827]" />
                          <span className="text-base sm:text-lg text-gray-400 font-medium">{salonData.rating.toFixed(1)}</span>
                          <span className="text-sm sm:text-base text-gray-400">({salonData.reviewCount} avis)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300" />
                          <span className="text-base sm:text-lg text-gray-400 font-medium">Nouveau</span>
                          <span className="text-sm sm:text-base text-gray-400">(0 avis)</span>
                        </div>
                      )}
                      {salonData.priceLevel && (
                        <>
                          <span className="text-gray-300 hidden sm:inline">·</span>
                          <span className="text-base sm:text-lg font-medium text-gray-600">{salonData.priceLevel}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm sm:text-base text-gray-600">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>{salonData.address}</span>
                    </div>
                  </div>
                </div>
                {salonData.description && (
                  <p className="text-gray-600 text-base sm:text-lg leading-relaxed">{salonData.description}</p>
                )}
              </div>

              {/* Sub-navigation tabs (Fresha Style) */}
              <div className="border-b border-gray-200 bg-white sticky top-16 z-30 mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6">
                <div className="flex items-center gap-8 overflow-x-auto scrollbar-hide text-sm font-medium">
                  {[
                    { id: 'prestations', label: 'Prestations' },
                    { id: 'equipe', label: 'Équipe' },
                    { id: 'avis', label: 'Avis' },
                    { id: 'portfolio', label: 'Portfolio' },
                    { id: 'apropos', label: 'À propos' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        const el = document.getElementById(tab.id);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`py-4 border-b-2 whitespace-nowrap transition-colors ${
                        tab.id === 'prestations'
                          ? 'border-black text-black font-semibold'
                          : 'border-transparent text-gray-600 hover:text-black'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prestations Section & Category Pills */}
              <div id="prestations" className="scroll-mt-32">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Prestations</h2>

                {/* Category Pills Filter */}
                <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide mb-8 pb-1">
                  {salonData.services.map((cat: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const catEl = document.getElementById(`cat-${idx}`);
                        if (catEl) catEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
                        idx === 0
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-800 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {cat.category}
                    </button>
                  ))}
                </div>

                {/* Service Categories & Cards */}
                <div className="space-y-10">
                  {salonData.services.map((category: any, idx: number) => (
                    <div key={idx} id={`cat-${idx}`} className="scroll-mt-36">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">{category.category}</h3>
                      <div className="space-y-4">
                        {category.items.map((service: Service, serviceIdx: number) => {
                          const isSelected = selectedServices.some(s => s.name === service.name);
                          return (
                            <div
                              key={serviceIdx}
                              className="flex items-center justify-between p-6 rounded-2xl bg-white border border-gray-200 shadow-sm hover:border-gray-300 transition-all"
                            >
                              <div className="flex-1 pr-6">
                                <h4 className="text-base font-semibold text-gray-900 mb-1">{service.name}</h4>
                                <p className="text-sm text-gray-500 mb-3">{service.duration}</p>
                                <p className="text-base font-bold text-gray-900">{service.price} MAD</p>
                              </div>
                              <button
                                onClick={() => selectService(service)}
                                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                                  isSelected
                                    ? 'bg-black text-white border-black'
                                    : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {isSelected ? 'Sélectionné' : 'Réserver'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Équipe Section */}
              <div id="equipe" className="scroll-mt-32 pt-8 border-t border-gray-200">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Équipe</h2>
                {(() => {
                  const displayEmployees = employees && employees.length > 0 ? employees : [
                    { name: 'Youssef', title: 'Maître Barbier', avatar: 'https://images.unsplash.com/photo-1618077360395-f3068be8e001?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
                    { name: 'Amine', title: 'Barbier', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
                    { name: 'Karim', title: 'Coiffeur', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' },
                    { name: 'Driss', title: 'Spécialiste Soins', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }
                  ];
                  
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                      {displayEmployees.map((member: any, idx: number) => (
                        <div key={idx} className="text-center group cursor-pointer">
                          <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto rounded-full overflow-hidden border-2 border-transparent group-hover:border-black shadow-sm mb-3 relative bg-gray-50 flex items-center justify-center transition-all duration-300">
                            {member.avatar ? (
                              <img src={member.avatar} alt={member.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <span className="text-2xl font-bold text-gray-400">
                                {member.name?.charAt(0) || 'E'}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-gray-950 text-sm sm:text-base">{member.name}</h4>
                          <p className="text-xs sm:text-sm text-gray-500 mt-1">{member.title || 'Professionnel'}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Reviews Section */}
              <div id="avis" className="scroll-mt-32 pt-8 border-t border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                  <h2 className="text-3xl font-bold text-gray-900">Avis</h2>
                  {salonData.reviewCount > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="text-lg font-bold text-gray-900">{salonData.rating.toFixed(1)}</span>
                      <span className="text-gray-500">({salonData.reviewCount})</span>
                    </div>
                  )}
                </div>

                {/* Review Form - Only if authenticated */}
                {isAuthenticated && user && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Laisser un avis</h3>
                    <ReviewForm 
                      tenantId={salon?.id}
                      user={user}
                      onReviewSubmitted={async () => {
                        try {
                          const reviewsRes = await api.getTenantReviews(salonId, 1, 10);
                          const formattedReviews = (reviewsRes.reviews || []).map((review: any) => ({
                            id: review.id,
                            name: review.client ? `${review.client.firstName || ''} ${review.client.lastName || ''}`.trim() : 'Client',
                            rating: review.rating || 0,
                            text: review.comment || '',
                            date: review.createdAt ? formatMoroccoDate(review.createdAt, { day: 'numeric', month: 'long', year: 'numeric' }) : formatMoroccoDate(new Date())
                          }));
                          setReviews(formattedReviews);
                          setReviewStats(reviewsRes.stats || { averageRating: 0, totalReviews: 0 });
                        } catch (err) {
                          console.error('Error refreshing reviews:', err);
                        }
                      }}
                    />
                  </div>
                )}

                {/* Reviews List */}
                {reviews.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reviews.map((review: any, idx: number) => (
                      <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                            {review.name?.charAt(0) || 'C'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{review.name || 'Client'}</p>
                            <p className="text-xs text-gray-400">{review.date || formatMoroccoDate(new Date())}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= (review.rating || 0)
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        {review.text && (
                          <p className="text-sm text-gray-700 leading-relaxed">{review.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                    <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Aucun avis pour le moment. Soyez le premier à laisser un avis !</p>
                  </div>
                )}
              </div>

              {/* Portfolio Section */}
              <div id="portfolio" className="scroll-mt-32 pt-8 border-t border-gray-200">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Portfolio</h2>
                {salonData.images && salonData.images.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {salonData.images.map((img: string, idx: number) => (
                      <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer group" onClick={() => { setSelectedImage(idx); setShowLightbox(true); }}>
                        <img src={img} alt={`Portfolio ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Aucune photo de réalisation disponible.</p>
                )}
              </div>

              {/* À propos Section */}
              <div id="apropos" className="scroll-mt-32 pt-8 border-t border-gray-200">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">À propos</h2>
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
                  {salonData.description && (
                    <p className="text-gray-700 leading-relaxed text-base">{salonData.description}</p>
                  )}
                  {salonData.address && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-800" />
                      <span>Situé à {salonData.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column Sticky Card (Fresha Venue Card Style) */}
            <div className="lg:col-span-1 self-start">
              <div className="space-y-6">
                
                {/* Main Salon Venue Card */}
                <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm space-y-6">
                  <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-3">{salonData.name}</h1>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{salonData.rating ? salonData.rating.toFixed(1) : '5,0'}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <span className="text-indigo-600 font-medium text-sm">({salonData.reviewCount || 197})</span>
                    </div>
                  </div>

                  {/* Main Action Button */}
                  <button
                    onClick={handleMainReserve}
                    className="w-full py-4 bg-black hover:bg-gray-900 text-white rounded-[24px] text-[17px] font-bold transition-all shadow-sm active:scale-[0.98]"
                  >
                    Réserver
                  </button>

                  <div className="border-t border-gray-100 pt-6 space-y-5 text-[15px]">
                    {/* Status & Hours */}
                    <div className="flex items-start gap-4">
                      <Clock className="w-5 h-5 text-gray-900 flex-shrink-0" />
                      <div className="leading-tight">
                        <span className="font-semibold text-[#00875A]">Ouvert</span> <span className="text-gray-600">jusqu&apos;à 19:00</span>
                      </div>
                    </div>

                    {/* Address & Navigation */}
                    <div className="flex items-start gap-4">
                      <MapPin className="w-5 h-5 text-gray-900 flex-shrink-0" />
                      <div className="leading-tight">
                        <p className="text-gray-900 mb-1.5">{salonData.address || 'Racine, Casablanca'}</p>
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(salonData.address || 'Casablanca')}`} target="_blank" rel="noopener noreferrer" className="text-[#5C3BFE] hover:underline font-medium">
                          Afficher l&apos;itinéraire
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected Services Box */}
                {selectedServices.length > 0 && (
                  <div className="bg-black text-white rounded-3xl p-6 shadow-xl animate-in fade-in">
                    <h3 className="text-lg font-bold mb-4">Votre sélection ({selectedServices.length})</h3>
                    <div className="space-y-3 mb-6 max-h-48 overflow-y-auto custom-scrollbar">
                      {selectedServices.map((service, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-800 pb-2">
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-xs text-gray-400">{service.duration} · {service.price} MAD</p>
                          </div>
                          <button onClick={() => selectService(service)} className="text-gray-400 hover:text-white p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold mb-4 pt-2 border-t border-gray-800">
                      <span>Total</span>
                      <span>{getTotalPrice()} MAD</span>
                    </div>
                    <button
                      onClick={handleBooking}
                      className="w-full py-3.5 bg-white text-black font-bold rounded-full hover:bg-gray-100 transition-all"
                    >
                      Continuer la réservation
                    </button>
                  </div>
                )}

                {/* Contact & Amenities Card */}
                {(salonData.phone || salonData.email || salonData.website || (salonData.amenities && salonData.amenities.length > 0)) && (
                  <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-5">
                    <h3 className="text-base font-bold text-gray-900">Contact & Infos</h3>
                    <div className="space-y-3">
                      {salonData.phone && (
                        <a href={`tel:${salonData.phone}`} className="flex items-center gap-3 text-sm text-gray-600 hover:text-black transition-colors">
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <span className="break-all">{salonData.phone}</span>
                        </a>
                      )}
                      {salonData.email && (
                        <a href={`mailto:${salonData.email}`} className="flex items-center gap-3 text-sm text-gray-600 hover:text-black transition-colors">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="break-all">{salonData.email}</span>
                        </a>
                      )}
                      {salonData.website && (
                        <a 
                          href={String(salonData.website).startsWith('http') ? String(salonData.website) : `https://${salonData.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-sm text-gray-600 hover:text-black transition-colors"
                        >
                          <Globe className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">Site web</span>
                        </a>
                      )}
                    </div>

                    {salonData.amenities && salonData.amenities.length > 0 && (
                      <div className="pt-3 border-t border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Équipements</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {salonData.amenities.map((amenity: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-700"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
                {/* Social Media */}
                {salonData.socialMedia && Object.keys(salonData.socialMedia).length > 0 && (
                  <div className="mt-6 bg-white border rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 sm:mb-6">Réseaux sociaux</h3>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {salonData.socialMedia.instagram && (
                        <a 
                          href={String(salonData.socialMedia.instagram).startsWith('http') ? String(salonData.socialMedia.instagram) : `https://instagram.com/${salonData.socialMedia.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full hover:opacity-90 transition-opacity text-xs sm:text-sm"
                        >
                          <Instagram className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span>Instagram</span>
                        </a>
                      )}
                      {salonData.socialMedia.facebook && (
                        <a 
                          href={String(salonData.socialMedia.facebook).startsWith('http') ? String(salonData.socialMedia.facebook) : `https://facebook.com/${salonData.socialMedia.facebook}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-full hover:opacity-90 transition-opacity text-xs sm:text-sm"
                        >
                          <Facebook className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span>Facebook</span>
                        </a>
                      )}
                      {(salonData.socialMedia.x || salonData.socialMedia.twitter) && (
                        <a 
                          href={String(salonData.socialMedia.x || salonData.socialMedia.twitter).startsWith('http') ? String(salonData.socialMedia.x || salonData.socialMedia.twitter) : `https://x.com/${String(salonData.socialMedia.x || salonData.socialMedia.twitter)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-900 text-white rounded-full hover:opacity-90 transition-opacity text-xs sm:text-sm"
                        >
                          <XBrandIcon size={16} />
                          <span>X</span>
                        </a>
                      )}
                      {salonData.socialMedia.tiktok && (
                        <a 
                          href={String(salonData.socialMedia.tiktok).startsWith('http') ? String(salonData.socialMedia.tiktok) : `https://tiktok.com/@${String(salonData.socialMedia.tiktok)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-950 text-white rounded-full hover:opacity-90 transition-opacity text-xs sm:text-sm"
                        >
                          <TikTokBrandIcon size={16} />
                          <span>TikTok</span>
                        </a>
                      )}
                      {salonData.socialMedia.linkedin && (
                        <a 
                          href={String(salonData.socialMedia.linkedin).startsWith('http') ? String(salonData.socialMedia.linkedin) : `https://linkedin.com/company/${salonData.socialMedia.linkedin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-700 text-white rounded-full hover:opacity-90 transition-opacity text-xs sm:text-sm"
                        >
                          <Linkedin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span>LinkedIn</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Map embed = OSM (no key); external link = Google Maps only */}
                {(salonData.coordinates || salonData.googleMapsLink) && (
                  <div className="mt-6 bg-white border rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 sm:mb-6">Localisation</h3>
                    <div className="flex flex-wrap gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <a
                        href={
                          salonData.googleMapsLink ||
                          (salonData.coordinates
                            ? `https://www.google.com/maps?q=${salonData.coordinates.lat},${salonData.coordinates.lng}`
                            : '#')
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-gray-600 hover:text-[#111827] transition-colors"
                      >
                        <Map className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Voir sur Google Maps</span>
                      </a>
                    </div>
                    {salonData.coordinates && (
                      <div className="w-full h-48 sm:h-64 rounded-lg overflow-hidden border border-gray-200">
                        <SalonMap
                          lat={Number(salonData.coordinates.lat)}
                          lng={Number(salonData.coordinates.lng)}
                          className="w-full h-full"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Hours */}
                <div className="mt-6 bg-white border rounded-xl sm:rounded-2xl p-5 sm:p-6 lg:p-8">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4 sm:mb-6">Horaires</h3>
                  <div className="space-y-2 sm:space-y-3">
                    {Object.entries(salonData.hours).map(([day, hours]) => (
                      <div key={day} className="flex justify-between text-xs sm:text-sm">
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

      {/* Lightbox */}
      {showLightbox && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <button onClick={() => setShowLightbox(false)} className="absolute top-4 right-4 sm:top-8 sm:right-8 w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all z-10">
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
          <button onClick={prevImage} className="absolute left-4 sm:left-8 w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all z-10">
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
          <button onClick={nextImage} className="absolute right-4 sm:right-8 w-10 h-10 sm:w-12 sm:h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all z-10">
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
          <img src={salonData.images[selectedImage] || salonData.images[0]} alt={salonData.name} className="max-w-full max-h-full object-contain" />
          <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 text-white text-xs sm:text-sm bg-black/50 px-4 sm:px-6 py-2 sm:py-3 rounded-full">
            {selectedImage + 1} / {salonData.images.length}
          </div>
        </div>
      )}

      {/* Booking Option Selection Modal (Fresha Style) */}
      {showBookingOptionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-gray-50 rounded-3xl p-8 max-w-lg w-full relative shadow-2xl space-y-6">
            <button
              onClick={() => setShowBookingOptionModal(false)}
              className="absolute top-6 right-6 w-9 h-9 bg-white hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors border border-gray-200"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Sélectionnez une option</h2>

            <div className="space-y-4">
              {/* Option 1: Solo booking */}
              <button
                onClick={() => {
                  setShowBookingOptionModal(false);
                  setIsGroupBooking(false);
                  if (selectedServices.length === 0 && salonData?.services?.[0]?.items?.[0]) {
                    setSelectedServices([salonData.services[0].items[0]]);
                  }
                  setBookingStep(1);
                  setShowBookingModal(true);
                }}
                className="w-full p-5 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between transition-all group text-left shadow-sm"
              >
                <div>
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-black">Prenez un rendez-vous</h3>
                  <p className="text-sm text-gray-500">Programmez des prestations pour vous</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <User className="w-5 h-5 text-gray-700" />
                </div>
              </button>

              {/* Option 2: Group booking */}
              <button
                onClick={() => {
                  setShowBookingOptionModal(false);
                  setIsGroupBooking(true);
                  if (selectedServices.length === 0 && salonData?.services?.[0]?.items?.[0]) {
                    setSelectedServices([salonData.services[0].items[0]]);
                  }
                  setBookingStep(1);
                  setShowBookingModal(true);
                }}
                className="w-full p-5 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between transition-all group text-left shadow-sm"
              >
                <div>
                  <h3 className="text-base font-bold text-gray-900 group-hover:text-black">Prendre un rendez-vous de groupe</h3>
                  <p className="text-sm text-gray-500">Pour vous-même et pour les autres</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <Users className="w-5 h-5 text-gray-700" />
                </div>
              </button>
            </div>

            <div className="pt-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Plus</h4>
              <div className="p-5 bg-white border border-gray-200 rounded-2xl flex items-center justify-between opacity-60 cursor-not-allowed">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Acheter un forfait</h3>
                  <p className="text-sm text-gray-500">Achetez plusieurs articles ensemble pour faire des économies</p>
                </div>
                <Gift className="w-5 h-5 text-gray-500" />
              </div>
            </div>
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
        isGroupBooking={isGroupBooking}
        timeSlots={timeSlots}
        setSelectedServices={setSelectedServices}
        onSlotServiceIdsChange={setSlotServiceIds}
        onAddService={() => {
          setShowBookingModal(false);
          setTimeout(() => {
            servicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 200);
        }}
        salonServices={salonData.services}
        salonId={salon?.id}
        employees={employees}
        blockedDates={salon?.settings?.businessHours?.blockedDates || []}
        bookingAdvanceDays={salon?.settings?.bookingAdvanceDays ?? 30}
        advanceBooking={salon?.settings?.businessHours?.advanceBooking || null}
        slotsLoading={slotsLoading}
        slotsError={slotsError}
        lastUpdated={lastUpdated}
        onExistingParticipantsChange={setExistingParticipants}
        onServiceEmployeesChange={setCurrentServiceEmployees}
      />

      {/* Shared Footer */}
      <Footer />

      {/* Mobile Sticky Reservation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-0.5">Total</p>
            <p className="text-lg font-bold text-gray-900">{getTotalPrice()} MAD</p>
          </div>
          <button
            onClick={() => {
              if (selectedServices.length > 0) {
                setShowBookingOptionModal(true);
              } else {
                const prestationsEl = document.getElementById('prestations');
                if (prestationsEl) prestationsEl.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex-none bg-[#111827] text-white px-8 py-3.5 rounded-xl font-medium text-sm transition-all hover:bg-gray-800"
          >
            {selectedServices.length > 0 ? 'Réserver' : 'Choisir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Review Form Component
function ReviewForm({ tenantId, user, onReviewSubmitted }: { tenantId?: string; user: any; onReviewSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!rating || rating === 0) {
      toast.error('Veuillez sélectionner une note');
      return;
    }

    if (!tenantId || !user?.email) {
      toast.error('Informations manquantes');
      return;
    }

    if (!tenantId) {
      toast.error('Erreur: ID du salon manquant');
      return;
    }

    setIsSubmitting(true);
    try {
      const nameParts = (user.name || '').split(' ');
      const firstName = user.firstName || nameParts[0] || 'Client';
      const lastName = user.lastName || nameParts.slice(1).join(' ') || '';

      const response = await api.createReview({
        tenantId,
        firstName,
        lastName,
        email: user.email,
        phone: user.phone || '',
        rating,
        comment: comment.trim() || undefined,
      });

      toast.success('Votre avis a été soumis avec succès');
      setRating(0);
      setComment('');
      onReviewSubmitted();
    } catch (error: any) {
      console.error('Error submitting review:', error);
      const errorMessage = error.message || error.error || 'Erreur lors de la soumission de l\'avis';
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Note
        </label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="group"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
            >
              <Star
                className={`w-8 h-8 transition-all cursor-pointer ${
                  star <= (hoverRating || rating)
                    ? 'fill-[#111827] text-[#111827]'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-gray-900 mb-3">
          Votre avis (optionnel)
        </label>
        <textarea
          id="comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] focus:border-transparent resize-none text-gray-900 placeholder:text-gray-400"
          placeholder="Partagez votre expérience..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || rating === 0}
        className="w-full py-3 bg-[#111827] text-white rounded-full font-medium hover:bg-[#1f2937] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Envoi en cours...' : 'Publier l\'avis'}
      </button>
    </form>
  );
}