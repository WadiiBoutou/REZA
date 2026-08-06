'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Clock, Tag, Star, MapPin, Plus } from 'lucide-react';
import api from '../lib/api';
import { useRouter } from 'next/navigation';
import { filterCompleteTenants, getImageUrl, getSalonHref } from '../lib/utils';

interface Slide {
  id: number;
  image: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
}

// Fallback slides (used if API fails)
const defaultSlides: Slide[] = [
  {
    id: 1,
    image: '/prestation/coiffeur.jpeg',
    title: 'Coiffeur',
    subtitle: 'Prestations',
    description: "Envie de changer de style ou simplement de rafraîchir votre coupe ? Nos coiffeurs experts sont là pour révéler votre beauté.",
    accent: '#000000'
  },
  {
    id: 2,
    image: '/prestation/barbier2.jpeg',
    title: 'Barbier',
    subtitle: 'Prestations',
    description: "Nos barbiers professionnels sculptent votre barbe et prennent soin de votre look avec précision et élégance.",
    accent: '#000000'
  },
  {
    id: 3,
    image: '/prestation/beautycenter2.png',
    title: 'Centre de beauté',
    subtitle: 'Prestations',
    description: "Découvrez nos soins du visage et du corps pour une expérience de bien-être complète et personnalisée.",
    accent: '#000000'
  },
  {
    id: 4,
    image: '/prestation/spa.jpeg',
    title: 'Hammam et SPA',
    subtitle: 'Prestations',
    description: "Détendez-vous dans nos hammams et spas, et profitez de rituels traditionnels pour une relaxation absolue.",
    accent: '#000000'
  },
];

// Map category names to images and descriptions
const categoryDefaults: Record<string, { image: string; description: string }> = {
  'Coiffeur': {
    image: '/prestation/coiffeur.jpeg',
    description: "Envie de changer de style ou simplement de rafraîchir votre coupe ? Nos coiffeurs experts sont là pour révéler votre beauté."
  },
  'Barbier': {
    image: '/prestation/barbier2.jpeg',
    description: "Nos barbiers professionnels sculptent votre barbe et prennent soin de votre look avec précision et élégance."
  },
  'Manucure': {
    image: '/prestation/beautycenter2.png',
    description: "Prenez soin de vos mains et pieds avec nos prestations de manucure et pédicure professionnelles."
  },
  'Institut de beauté': {
    image: '/prestation/beautycenter2.png',
    description: "Découvrez nos soins du visage et du corps pour une expérience de bien-être complète et personnalisée."
  },
  'Spa': {
    image: '/prestation/spa.jpeg',
    description: "Détendez-vous dans nos hammams et spas, et profitez de rituels traditionnels pour une relaxation absolue."
  },
  'Massage': {
    image: '/prestation/spa.jpeg',
    description: "Profitez de massages relaxants et thérapeutiques pour libérer les tensions et retrouver votre bien-être."
  },
  'Hammam': {
    image: '/prestation/spa.jpeg',
    description: "Découvrez les bienfaits du hammam traditionnel avec ses rituels de purification et ses soins à l'huile d'argan."
  }
};

const weeklyHighlights = [
  {
    id: 1,
    title: 'Rituel Mains & Pieds',
    image: '/incon/maniandpedi.jpeg',
    establishment: 'Nail Bar Chic',
    location: 'Racine',
    discount: 25,
    timeLeft: '2 jours',
    rating: 4.6,
    reviews: 75,
    badge: 'Beauté',
    description: "Prenez soin de vos mains et pieds avec notre rituel complet incluant bain, gommage et massage."
  },
  {
    id: 2,
    title: "Massage Relaxant",
    image: '/incon/massage.jpeg',
    establishment: 'Zen Spa',
    location: 'Oasis',
    discount: 29,
    timeLeft: '1 jour',
    rating: 4.7,
    reviews: 120,
    badge: 'Bien-être',
    description: "Profitez d'un massage relaxant qui libère les tensions et apporte une sensation de bien-être profond."
  },
  {
    id: 3,
    title: 'Hammam Traditionnel',
    image: '/incon/hammam.jpeg',
    establishment: 'Spa Royal Casablanca',
    location: 'Maarif',
    discount: 29,
    timeLeft: '4 jours',
    rating: 4.9,
    reviews: 98,
    badge: 'Purification',
    description: "Découvrez les bienfaits du hammam traditionnel avec ses rituels de purification et ses soins à l'huile d'argan."
  },
  {
    id: 4,
    image: '/incon/soinvisage.jpeg',
    title: 'Soin du Visage',
    subtitle: 'Prestations',
    description: "Offrez à votre peau un soin du visage personnalisé avec des produits naturels qui hydratent et purifient.",
    accent: '#000000'
  },
  {
    id: 5,
    title: 'Gommage Corporel',
    image: '/incon/gommage.jpeg',
    establishment: 'Spa Royal Casablanca',
    location: 'Maarif',
    discount: 29,
    timeLeft: '4 jours',
    rating: 4.8,
    reviews: 102,
    badge: 'Exfoliation',
    description: "Éliminez les cellules mortes et retrouvez une peau douce et lumineuse grâce à notre gommage corporel."
  },
  {
    id: 6,
    title: 'Enveloppement au Rhassoul',
    image: '/incon/ghassoul.jpeg',
    establishment: 'Spa Royal Casablanca',
    location: 'Maarif',
    discount: 25,
    timeLeft: '2 jours',
    rating: 4.7,
    reviews: 80,
    badge: 'Tradition',
    description: "Cet enveloppement à l'argile naturelle du Maroc purifie la peau en profondeur tout en lui apportant minéraux."
  },
  {
    id: 7,
    title: 'Massage aux Pierres Chaudes',
    image: '/incon/rock.jpeg',
    establishment: 'Zen Spa',
    location: 'Oasis',
    discount: 29,
    timeLeft: '1 jour',
    rating: 4.8,
    reviews: 110,
    badge: 'Thérapie',
    description: "Ressentez la chaleur bienfaisante des pierres volcaniques qui dénoue les tensions musculaires."
  },
  {
    id: 8,
    title: 'Réflexologie Plantaire',
    image: '/incon/refloxologie.jpeg',
    establishment: 'Zen Spa',
    location: 'Oasis',
    discount: 20,
    timeLeft: '3 jours',
    rating: 4.9,
    reviews: 95,
    badge: 'Équilibre',
    description: "Cette technique de massage des pieds stimule les zones réflexes pour un bien-être global."
  },
  {
    id: 9,
    title: 'Rituel Complet Spa',
    image: '/incon/spa.jpeg',
    establishment: 'Spa Royal Casablanca',
    location: 'Maarif',
    discount: 25,
    timeLeft: '2 jours',
    rating: 4.9,
    reviews: 156,
    badge: 'Expérience',
    description: "Offrez-vous une expérience complète avec hammam, gommage, enveloppement et massage pour une détente absolue"
  }
];

// Elite Professionals data with real service references
const professionals = [
  {
    id: 'cms3cc78b000e5kpqeya5j5tg', // Rachid Tazi
    firstName: 'Rachid',
    lastName: 'Tazi',
    specialty: 'Maître Coiffeur & Visagiste',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80',
    rating: 4.9,
    reviews: 142,
    salonName: 'Reza Salon Casablanca',
    tenantId: 'cms3cc76v00055kpqkcsfkign',
    category: 'Coiffeur',
    prestations: [
      { id: 'cms3cc77i00075kpq0d7sfzsl', name: 'Coupe homme', price: '80 DH', duration: '30 min' },
      { id: 'cms3cc77x00085kpqtn2ct6w9', name: 'Coupe femme', price: '150 DH', duration: '60 min' },
      { id: 'cms3cc78000095kpqb4r5fd0e', name: 'Brushing', price: '100 DH', duration: '45 min' },
      { id: 'cms3cc782000a5kpq9l6w3fbk', name: 'Coloration', price: '250 DH', duration: '90 min' }
    ]
  },
  {
    id: 'cms3cc78n000j5kpqa7g43w08', // Sofia Alaoui
    firstName: 'Sofia',
    lastName: 'Sofia',
    specialty: 'Styliste Coloriste & Coiffure',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
    rating: 4.8,
    reviews: 95,
    salonName: 'Reza Salon Casablanca',
    tenantId: 'cms3cc76v00055kpqkcsfkign',
    category: 'Coiffeur',
    prestations: [
      { id: 'cms3cc77x00085kpqtn2ct6w9', name: 'Coupe femme', price: '150 DH', duration: '60 min' },
      { id: 'cms3cc78000095kpqb4r5fd0e', name: 'Brushing', price: '100 DH', duration: '45 min' },
      { id: 'cms3cc782000a5kpq9l6w3fbk', name: 'Coloration', price: '250 DH', duration: '90 min' }
    ]
  },
  {
    id: 'cms3cc7b100185kpqekvo79h1', // Karim Idrissi
    firstName: 'Karim',
    lastName: 'Idrissi',
    specialty: 'Barbier & Soins Masculins',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
    rating: 4.9,
    reviews: 110,
    salonName: 'Reza Salon Rabat',
    tenantId: 'cms3cc7ao00115kpqn7rkiy6q',
    category: 'Barbier',
    prestations: [
      { id: 'cms3cc7as00135kpq18i19nr3', name: 'Coupe + rasage', price: '120 DH', duration: '45 min' },
      { id: 'cms3cc7au00145kpqxi4l0akl', name: 'Soin barbe', price: '70 DH', duration: '30 min' },
      { id: 'cms3cc7aw00155kpqwampe449', name: 'Coupe classique', price: '60 DH', duration: '25 min' }
    ]
  },
  {
    id: 'cms3cc7o000225kpq0exu6taf', // Sara Benali
    firstName: 'Sara',
    lastName: 'Benali',
    specialty: 'Thérapeute Hammam & Massage',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
    rating: 4.9,
    reviews: 185,
    salonName: 'Spa Royal Casablanca',
    tenantId: 'cms3cc7h9001n5kpq744e1r1v',
    category: 'Spa',
    prestations: [
      { id: 'cms3cc7he001p5kpq6p8n23wi', name: 'Hammam traditionnel', price: '200 DH', duration: '60 min' },
      { id: 'cms3cc7hh001q5kpqmfislgdb', name: 'Massage relaxant', price: '250 DH', duration: '60 min' },
      { id: 'cms3cc7hj001r5kpq32gwkrvk', name: 'Gommage argan', price: '180 DH', duration: '45 min' }
    ]
  }
];

export default function BeautyCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [offerIndex, setOfferIndex] = useState(0);
  const [offerAnimating, setOfferAnimating] = useState(false);
  const [offerProgress, setOfferProgress] = useState(0);
  const [weeklyHighlightsData, setWeeklyHighlightsData] = useState<any[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [errorOffers, setErrorOffers] = useState<string | null>(null);
  const [slides, setSlides] = useState<Slide[]>(defaultSlides);
  const [loadingSlides, setLoadingSlides] = useState(true);
  const router = useRouter();
  const [selectedProfIndex, setSelectedProfIndex] = useState(0);
  
  const offersCount = weeklyHighlightsData.length;

  // Fetch categories and create slides dynamically
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingSlides(true);
        
        // Fetch categories from API
        const categoriesResponse = await api.getCategories();
        const fetchedCategories = categoriesResponse.categories || [];
        
        // Map main categories to slides
        const mainCategories = ['Coiffeur', 'Barbier', 'Manucure', 'Institut de beauté'];
        const formattedSlides = mainCategories
          .map((catName, index) => {
            const cat = fetchedCategories.find((c: any) => 
              c.name?.toLowerCase().includes(catName.toLowerCase()) ||
              catName.toLowerCase().includes(c.name?.toLowerCase() || '')
            );
            
            // Get default image and description for category
            const defaults = categoryDefaults[catName] || {
              image: '/prestation/beautycenter2.png',
              description: `Découvrez nos prestations ${catName.toLowerCase()} pour une expérience de qualité.`
            };
            
            // Use category description from API if available, otherwise use default
            const description = cat?.description || defaults.description;
            
            // Try to get image from tenant in this category, or use default
            return {
              id: index + 1,
              image: defaults.image,
              title: catName === 'Institut de beauté' ? 'Centre de beauté' : catName,
              subtitle: 'Prestations',
              description: description,
              accent: '#000000'
            };
          })
          .filter(Boolean) as Slide[];
        
        // If we have slides, use them, otherwise use defaults
        if (formattedSlides.length > 0) {
          setSlides(formattedSlides);
        } else {
          setSlides(defaultSlides);
        }
      } catch (error) {
        console.error('Error fetching categories for slides:', error);
        // Fallback to default slides
        setSlides(defaultSlides);
      } finally {
        setLoadingSlides(false);
      }
    };

    fetchCategories();
  }, []);

  // Calculate time left for offers (in days)
  const calculateTimeLeft = (days: number): string => {
    if (days <= 1) return '1 jour';
    return `${days} jours`;
  };

  // Fetch featured services/tenants for weekly highlights - DYNAMIC
  useEffect(() => {
    const fetchFeaturedServices = async () => {
      try {
        setLoadingOffers(true);
        setErrorOffers(null);
        
        // Fetch tenants with reviews to show featured ones (increased limit for better selection)
        const tenantsResponse = await api.searchTenants(undefined, undefined, undefined, 50);
        // Filter to only show tenants with complete information (all required fields from landing page)
        const completeTenants = filterCompleteTenants(tenantsResponse.tenants || []);
        
        if (completeTenants.length === 0) {
          // If no complete tenants, use fallback data
          setWeeklyHighlightsData(weeklyHighlights.slice(0, 9));
          return;
        }
        
        // Filter and sort tenants by rating (best first) - only from complete tenants
        const featuredTenants = completeTenants
          .filter((t: any) => t.rating && t.rating >= 4.0) // Lower threshold to get more results
          .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 12); // Get more than needed to ensure we have enough
        
        if (featuredTenants.length === 0) {
          // If no high-rated tenants, use any available complete tenants
          const availableTenants = completeTenants.slice(0, 9);
          
          const offersPromises = availableTenants.map(async (tenant: any, index: number) => {
            try {
              const servicesRes = await api.getTenantServices(tenant.id);
              const services = servicesRes.services || [];
              
              // Get first service or use tenant name
              const service = services.length > 0 ? services[0] : null;
              
              // Calculate a pseudo-discount based on tenant data or random
              const discount = tenant.discount || Math.floor(Math.random() * 10) + 20;
              
              // Calculate days left (random between 1-5 days for dynamic feel)
              const daysLeft = Math.floor(Math.random() * 5) + 1;
              
              return {
                id: tenant.id || `tenant-${index}`,
                subdomain: tenant.subdomain,
                domain: tenant.domain,
                title: service?.name || tenant.name || 'Prestation',
                image: getImageUrl(tenant.coverImage || tenant.logo) || weeklyHighlights[index % weeklyHighlights.length]?.image || '/incon/soinvisage.jpeg',
                establishment: tenant.name || 'Établissement',
                location: tenant.city || tenant.address || 'Casablanca',
                discount: discount,
                timeLeft: calculateTimeLeft(daysLeft),
                rating: tenant.rating || 4.5,
                reviews: tenant.reviews || tenant.reviewsCount || Math.floor(Math.random() * 100) + 50,
                badge: tenant.category || tenant.categories?.[0] || 'Beauté',
                description: service?.description || service?.name || tenant.description || 'Découvrez cette prestation de qualité'
              };
            } catch (error) {
              console.error(`Error fetching services for tenant ${tenant.id}:`, error);
              // Return basic offer from tenant data only
              const daysLeft = Math.floor(Math.random() * 5) + 1;
              return {
                id: tenant.id || `tenant-${index}`,
                subdomain: tenant.subdomain,
                domain: tenant.domain,
                title: tenant.name || 'Prestation',
                image: getImageUrl(tenant.coverImage || tenant.logo) || weeklyHighlights[index % weeklyHighlights.length]?.image || '/incon/soinvisage.jpeg',
                establishment: tenant.name || 'Établissement',
                location: tenant.city || tenant.address || 'Casablanca',
                discount: Math.floor(Math.random() * 10) + 20,
                timeLeft: calculateTimeLeft(daysLeft),
                rating: tenant.rating || 4.5,
                reviews: tenant.reviews || tenant.reviewsCount || 50,
                badge: tenant.category || tenant.categories?.[0] || 'Beauté',
                description: tenant.description || 'Découvrez cette prestation de qualité'
              };
            }
          });
          
          const fetchedOffers = await Promise.all(offersPromises);
          const validOffers = fetchedOffers.filter((offer): offer is any => offer !== null && offer.id);
          
          if (validOffers.length > 0) {
            setWeeklyHighlightsData(validOffers.slice(0, 9));
          } else {
            // Fallback to static data if no valid offers
            setWeeklyHighlightsData(weeklyHighlights.slice(0, 9));
          }
          return;
        }
        
        // Process featured tenants with services
        const offersPromises = featuredTenants.map(async (tenant: any, index: number) => {
          try {
            const servicesRes = await api.getTenantServices(tenant.id);
            const services = servicesRes.services || [];
            
            // Get first service or use tenant name
            const service = services.length > 0 ? services[Math.floor(Math.random() * Math.min(services.length, 3))] : null;
            
            // Calculate discount (could be from tenant data or random)
            const discount = tenant.discount || Math.floor(Math.random() * 10) + 20;
            
            // Calculate days left dynamically
            const daysLeft = Math.floor(Math.random() * 5) + 1;
            
            return {
              id: tenant.id || `tenant-${index}`,
                subdomain: tenant.subdomain,
                domain: tenant.domain,
              title: service?.name || tenant.name || 'Prestation',
              image: getImageUrl(tenant.coverImage || tenant.logo) || weeklyHighlights[index % weeklyHighlights.length]?.image || '/incon/soinvisage.jpeg',
              establishment: tenant.name || 'Établissement',
              location: tenant.city || tenant.address || 'Casablanca',
              discount: discount,
              timeLeft: calculateTimeLeft(daysLeft),
              rating: tenant.rating || 4.5,
              reviews: tenant.reviews || tenant.reviewsCount || Math.floor(Math.random() * 100) + 50,
              badge: tenant.category || tenant.categories?.[0] || 'Beauté',
              description: service?.description || service?.name || tenant.description || 'Prestation de qualité'
            };
          } catch (error) {
            console.error(`Error fetching services for tenant ${tenant.id}:`, error);
            // Return basic offer from tenant data only
            const daysLeft = Math.floor(Math.random() * 5) + 1;
            return {
              id: tenant.id || `tenant-${index}`,
                subdomain: tenant.subdomain,
                domain: tenant.domain,
              title: tenant.name || 'Prestation',
              image: getImageUrl(tenant.coverImage || tenant.logo) || weeklyHighlights[index % weeklyHighlights.length]?.image || '/incon/soinvisage.jpeg',
              establishment: tenant.name || 'Établissement',
              location: tenant.city || tenant.address || 'Casablanca',
              discount: Math.floor(Math.random() * 10) + 20,
              timeLeft: calculateTimeLeft(daysLeft),
              rating: tenant.rating || 4.5,
              reviews: tenant.reviews || tenant.reviewsCount || 50,
              badge: tenant.category || tenant.categories?.[0] || 'Beauté',
              description: tenant.description || 'Prestation de qualité'
            };
          }
        });
        
        const fetchedOffers = await Promise.all(offersPromises);
        const validOffers = fetchedOffers.filter((offer): offer is any => offer !== null && offer.id);
        
        if (validOffers.length > 0) {
          // Shuffle and take up to 9 offers for variety
          const shuffled = validOffers.sort(() => Math.random() - 0.5);
          setWeeklyHighlightsData(shuffled.slice(0, 9));
          
          // Reset index if current index is out of bounds
          if (offerIndex >= shuffled.length) {
            setOfferIndex(0);
          }
        } else {
          // Fallback to static data if no valid offers
          setWeeklyHighlightsData(weeklyHighlights.slice(0, 9));
        }
      } catch (error) {
        console.error('Error fetching featured services:', error);
        setErrorOffers('Impossible de charger les offres. Utilisation des données par défaut.');
        // Fallback to static data on error
        setWeeklyHighlightsData(weeklyHighlights.slice(0, 9));
      } finally {
        setLoadingOffers(false);
      }
    };

    fetchFeaturedServices();
    
    // Refresh offers every 5 minutes for dynamic updates
    const refreshInterval = setInterval(() => {
      fetchFeaturedServices();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Reset offer index when data changes
  useEffect(() => {
    if (weeklyHighlightsData.length > 0 && offerIndex >= weeklyHighlightsData.length) {
      setOfferIndex(0);
    }
  }, [weeklyHighlightsData.length, offerIndex]);

  const goToSlide = (index: number, force = false) => {
    if (isAnimating && !force) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    setProgress(0);
    setTimeout(() => setIsAnimating(false), 800);
  };

  const goToPrevious = () => {
    const newIndex = currentIndex === 0 ? slides.length - 1 : currentIndex - 1;
    goToSlide(newIndex);
  };

  const goToNext = (force = false) => {
    const newIndex = currentIndex === slides.length - 1 ? 0 : currentIndex + 1;
    goToSlide(newIndex, force);
  };

  const goToOffer = (index: number, force = false) => {
    if (offerAnimating && !force) return;
    if (index < 0 || index >= weeklyHighlightsData.length) return;
    setOfferAnimating(true);
    setOfferIndex(index);
    setOfferProgress(0);
    setTimeout(() => setOfferAnimating(false), 800);
  };

  const goToPrevOffer = () => {
    const newIndex = offerIndex === 0 ? weeklyHighlightsData.length - 1 : offerIndex - 1;
    goToOffer(newIndex);
  };

  const goToNextOffer = (force = false) => {
    const newIndex = offerIndex === weeklyHighlightsData.length - 1 ? 0 : offerIndex + 1;
    goToOffer(newIndex, force);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goToNext(true);
          return 0;
        }
        return prev + 0.5;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isAnimating]);

  useEffect(() => {
    if (offerAnimating || weeklyHighlightsData.length === 0 || loadingOffers) return;
    const interval = setInterval(() => {
      setOfferProgress(prev => {
        if (prev >= 100) {
          goToNextOffer(true);
          return 0;
        }
        return prev + 0.5;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [offerIndex, offerAnimating, weeklyHighlightsData.length, loadingOffers]);

  useEffect(() => {
    setOfferProgress(0);
  }, [offerIndex]);

  const currentSlide = slides[currentIndex] || slides[0];

  // Show loading state if slides are being fetched
  if (loadingSlides || !currentSlide) {
    return (
      <div className="min-h-screen bg-white relative overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des prestations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-white" />

      {/* Carousel Section */}
      <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center p-4 relative">
        <div className="w-full max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left: Content Section */}
            <div className="order-1 lg:order-1 space-y-8 px-2 pt-6 pb-2 lg:px-0 lg:pt-0 lg:pb-0">
              
              <div className="overflow-hidden">
                <h2
                  key={`subtitle-${currentIndex}`}
                  className="text-sm font-medium uppercase tracking-[0.2em] animate-slideUp text-black"
                >
                  {currentSlide.subtitle}
                </h2>
              </div>

              <div className="overflow-hidden">
                <h1
                  key={`title-${currentIndex}`}
                  className="text-3xl md:text-4xl lg:text-5xl font-light text-gray-900 leading-tight animate-slideUp"
                  style={{
                    background: 'none',
                    WebkitBackgroundClip: undefined,
                    WebkitTextFillColor: undefined,
                    backgroundClip: undefined,
                  }}
                >
                  {currentSlide.title}
                </h1>
              </div>

              <div className="h-1 rounded-full animate-expand" style={{ background: '#8b7260' }} />

              <div className="overflow-hidden">
                <p
                  key={`desc-${currentIndex}`}
                  className="text-lg md:text-xl text-black/70 leading-relaxed max-w-xl animate-slideUp font-light"
                >
                  {currentSlide.description}
                </p>
              </div>

              <div className="flex items-center gap-6 -mt-6">
                <button 
                  onClick={() => {
                    // Map display title back to API category name
                    let categoryName = currentSlide.title;
                    if (currentSlide.title === 'Centre de beauté') {
                      categoryName = 'Institut de beauté';
                    }
                    router.push(`/search-results?query=${encodeURIComponent(currentSlide.title)}&category=${encodeURIComponent(categoryName)}`);
                  }}
                  className="px-0 py-4 text-black hover:text-black hover:underline font-medium transition-colors cursor-pointer"
                >
                  En savoir plus
                </button>
              </div>

              <div className="flex flex-col gap-2 pb-12 lg:pb-0">

                <div className="flex items-center gap-2 mt-2 hidden lg:flex">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      disabled={isAnimating}
                      className="group relative h-3 rounded-xl transition-all duration-300 overflow-hidden"
                      style={{ 
                        width: index === currentIndex ? '48px' : '24px',
                        backgroundColor: index === currentIndex ? 'transparent' : 'rgba(0,0,0,0.08)'
                      }}
                    >
                      {index === currentIndex && (
                        <>
                          <div 
                            className="absolute inset-0 rounded-xl opacity-20"
                            style={{ backgroundColor: '#8b7260' }}
                          />
                          <div 
                            className="absolute inset-0 rounded-xl transition-all duration-100"
                            style={{ 
                              backgroundColor: '#8b7260',
                              width: `${progress}%`,
                            }}
                          />
                        </>
                      )}
                    </button>
                  ))}
                  <div className="text-black/40 text-sm font-light ml-2">
                    <span className="text-black font-medium">{(currentIndex + 1).toString().padStart(2, '0')}</span>
                    {' '}/{' '}
                    <span>{slides.length.toString().padStart(2, '0')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Image Section */}
            <div className="order-2 lg:order-2 relative h-[320px] md:h-[600px] lg:h-[700px] w-full flex justify-center items-center mt-4 lg:mt-0 mb-24 lg:mb-0">
              <div className="relative h-full flex items-center justify-center">
                {slides.map((slide, index) => {
                  const offset = index - currentIndex;
                  const isActive = offset === 0;
                  
                  return (
                    <div
                      key={slide.id}
                      className="absolute transition-all duration-700 ease-out"
                      style={{
                        transform: `
                          translateX(${offset * 100}%) 
                          scale(${isActive ? 1 : 0.85}) 
                          rotateY(${offset * -15}deg)
                        `,
                        opacity: isActive ? 1 : 0,
                        zIndex: isActive ? 10 : 0,
                        pointerEvents: isActive ? 'auto' : 'none',
                      }}
                    >
                      <div className="relative w-[320px] h-[480px] md:w-[380px] md:h-[560px] lg:w-[540px] lg:h-[440px]">
                        <div className="absolute inset-0 rounded-lg bg-black/5 backdrop-blur-xl">
                          <div className="relative w-full h-full rounded-lg overflow-hidden">
                            <img
                              src={slide.image}
                              alt={slide.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Professionals & Prestations Section */}
      <div className="py-24 md:py-32 bg-white relative overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section label */}
          <div className="overflow-hidden mb-6">
            <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-black">
              Notre Équipe
            </h2>
          </div>

          {/* Divider */}
          <div className="h-[1px] bg-gray-200 mb-10" />

          {/* Headline + subtitle */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-20 mb-16">
            <h3 className="text-3xl md:text-4xl lg:text-[2.75rem] font-light text-gray-900 leading-[1.15] tracking-tight">
              Réservez avec nos{" "}
              <span className="font-semibold">experts d'élite</span>
            </h3>
            <div className="flex flex-col justify-end">
              <p className="text-base text-gray-500 leading-relaxed font-light">
                Sélectionnez un professionnel et réservez instantanément 
                sa prestation. Coiffeurs, barbiers, spas — tous soigneusement choisis.
              </p>
            </div>
          </div>

          {/* Professional avatars — horizontal selector */}
          <div className="flex gap-8 md:gap-12 overflow-x-auto pb-8 mb-12 no-scrollbar">
            {professionals.map((prof, idx) => {
              const isSelected = selectedProfIndex === idx;
              return (
                <button
                  key={prof.id}
                  onClick={() => setSelectedProfIndex(idx)}
                  className="flex flex-col items-center gap-3 group flex-shrink-0 transition-opacity duration-300"
                  style={{ opacity: isSelected ? 1 : 0.45 }}
                >
                  <div
                    className={`w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-500 ${
                      isSelected ? "border-[1.5px] border-dashed border-black p-1" : "border-[1.5px] border-transparent p-1"
                    }`}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-gray-100">
                      <img
                        src={prof.avatar}
                        alt={`${prof.firstName} ${prof.lastName}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs md:text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {prof.firstName} {prof.lastName}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-400 whitespace-nowrap">
                      {prof.category}
                    </p>
                  </div>
                  <div
                    className={`h-[2px] w-full transition-all duration-300 ${
                      isSelected ? "bg-black" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Active professional detail + prestations */}
          {(() => {
            const currentProf = professionals[selectedProfIndex];
            if (!currentProf) return null;
            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
                {/* Left — professional info */}
                <div className="lg:col-span-4 space-y-6">
                  <div>
                    <p className="text-sm text-gray-400 font-medium mb-1">
                      {currentProf.salonName}
                    </p>
                    <h4 className="text-2xl md:text-3xl font-light text-gray-900 leading-tight">
                      {currentProf.firstName}{" "}
                      <span className="font-semibold">{currentProf.lastName}</span>
                    </h4>
                    <p className="text-sm text-gray-500 mt-2 font-light">
                      {currentProf.specialty}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-light text-gray-900 tabular-nums">
                      {currentProf.rating}
                    </span>
                    <div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              s <= Math.round(currentProf.rating)
                                ? "fill-gray-900 text-gray-900"
                                : "text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {currentProf.reviews} avis
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right — prestations list */}
                <div className="lg:col-span-8">
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-400 mb-6">
                    Prestations disponibles
                  </p>

                  <div className="divide-y divide-gray-100">
                    {currentProf.prestations.map((pres) => (
                      <div
                        key={pres.id}
                        className="group flex items-center justify-between py-5 first:pt-0"
                      >
                        <div className="min-w-0 pr-6">
                          <p className="text-base md:text-lg font-normal text-gray-900 group-hover:text-black transition-colors">
                            {pres.name}
                          </p>
                          <p className="text-sm text-gray-400 mt-0.5 font-light">
                            {pres.duration}
                          </p>
                        </div>

                        <div className="flex items-center gap-6 flex-shrink-0">
                          <span className="text-base font-medium text-gray-900 tabular-nums">
                            {pres.price}
                          </span>
                          <button
                            onClick={() => {
                              router.push(
                                `/salon/${currentProf.tenantId}?employeeId=${currentProf.id}&serviceId=${pres.id}`
                              );
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-black text-white text-xs font-semibold rounded-full hover:bg-gray-800 transition-colors"
                          >
                            Réserver
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>



      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes expand {
          from {
            width: 0;
            opacity: 0;
          }
          to {
            width: 128px;
            opacity: 1;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }

        .animate-slideUp {
          animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-expand {
          animation: expand 1s ease-out forwards;
        }

        .offer-fade-in {
          opacity: 1;
          transform: scale(1);
        }
        .offer-fade-out {
          opacity: 0;
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}