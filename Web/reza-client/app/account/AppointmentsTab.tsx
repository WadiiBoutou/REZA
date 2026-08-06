import { ChevronLeft, ChevronRight, Clock, Calendar, User, MapPin, Phone, CreditCard, Tag, Star, ArrowLeft } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import EditAppointmentModal from './EditAppointmentModal';
import DeleteModal from './dialogue/deletemodal';
import api from '../../lib/api';
import { formatMoroccoDate, getImageUrl } from '../../lib/utils';

const PAGE_SIZE = 8;

function getStatusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    case 'pending':
      return 'bg-amber-50 text-amber-800 border border-amber-100';
    case 'completed':
      return 'bg-gray-900 text-white border border-[#0000001c]';
    case 'in_progress':
      return 'bg-sky-50 text-sky-700 border border-sky-100';
    case 'cancelled':
    case 'no_show':
      return 'bg-rose-50 text-rose-700 border border-rose-100';
    default:
      return 'bg-gray-50 text-gray-600 border border-gray-200';
  }
}

function canCancelAppointment(status: string): boolean {
  const s = status?.toLowerCase();
  return s === 'pending' || s === 'confirmed';
}

interface Appointment {
  id: string;
  date: string;
  time: string;
  service: string;
  salon: string;
  image?: string;
  address?: string;
  salonPhone?: string;
  price: number | string;
  totalPrice?: number | string;
  duration?: string;
  professional?: string;
  professionalSpecialty?: string;
  professionalYearsExp?: string;
  professionals?: Array<{ name: string; specialty: string }>;
  status: string;
  notes?: string;
  serviceDescription?: string;
  discount?: number;
  tax?: number;
  paymentMethod?: string;
  confirmationCode?: string;
  bookedFor?: string;
  bookingDate?: string;
  tenantId?: string;
  salonId?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientEmail?: string;
  clientPhone?: string;
  email?: string;
  phone?: string;
  services?: Array<{
    id: string;
    serviceId: string;
    name: string;
    duration: number;
    price: number;
  }>;
}

interface AppointmentsTabProps {
  appointments: Appointment[];
  getStatusText: (status: string) => string;
  handleAddReview: (review: any) => void;
  salonTeam?: Array<{ name: string; [key: string]: any }>;
  timeSlots?: string[];
  salonServices?: Array<{ name: string; duration: string; price: number; [key: string]: any }>;
  onUpdateAppointment?: (id: string, data: any) => void;
  onSortChange?: (sortBy: 'createdAt' | 'startTime') => void;
  currentSort?: 'createdAt' | 'startTime';
}

const AppointmentsTab: React.FC<AppointmentsTabProps> = ({ 
  appointments, 
  getStatusText, 
  handleAddReview, 
  salonTeam, 
  timeSlots, 
  salonServices, 
  onUpdateAppointment,
  onSortChange,
  currentSort = 'createdAt'
}) => {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [detailedRatings, setDetailedRatings] = useState({
    quality: 0,
    professionalism: 0,
    cleanliness: 0,
    value: 0
  });
  const [comment, setComment] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(appointments.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedAppointments = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return appointments.slice(start, start + PAGE_SIZE);
  }, [appointments, safePage]);

  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setShowReviewForm(false); // Hide review form on new appointment
    // Reset form
    setRating(0);
    setHoverRating(0);
    setDetailedRatings({
      quality: 0,
      professionalism: 0,
      cleanliness: 0,
      value: 0
    });
    setComment('');
  };

  const closeDetails = () => {
    setSelectedAppointment(null);
  };

  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  const handleSubmitReview = async () => {
    if (!selectedAppointment) return;
    
    if (rating === 0) {
      setReviewError('Veuillez sélectionner une note');
      return;
    }

    setSubmittingReview(true);
    setReviewError(null);
    setReviewSuccess(null);

    try {
      // Get tenant ID from appointment
      const appointmentTenantId = selectedAppointment.tenantId || selectedAppointment.salonId;
      
      if (!appointmentTenantId) {
        throw new Error('ID du salon manquant. Veuillez contacter le support.');
      }

      // Get user info from appointment or use defaults
      const firstName = selectedAppointment.clientFirstName || 'Client';
      const lastName = selectedAppointment.clientLastName || '';
      const email = selectedAppointment.clientEmail || selectedAppointment.email || '';
      const phone = selectedAppointment.clientPhone || selectedAppointment.phone || '';

      await api.createReview({
        tenantId: appointmentTenantId,
        appointmentId: selectedAppointment.id,
        firstName,
        lastName,
        email,
        phone,
        rating,
        comment: comment || undefined,
      });

      setReviewSuccess('Votre avis a été soumis avec succès. Il sera publié après modération.');
      
      // Call parent handler to update UI
      handleAddReview({
        salon: selectedAppointment.salon,
        salonImage: selectedAppointment.image,
        salonLocation: selectedAppointment.address || 'Casablanca',
        service: selectedAppointment.service,
        rating,
        comment,
        appointmentDate: formatMoroccoDate(selectedAppointment.date),
        detailedRatings,
      });

      // Reset form
      setRating(0);
      setComment('');
      setDetailedRatings({
        quality: 0,
        professionalism: 0,
        cleanliness: 0,
        value: 0
      });
      
      setTimeout(() => {
        setShowReviewForm(false);
        setReviewSuccess(null);
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting review:', error);
      setReviewError(error.message || 'Erreur lors de la soumission de l\'avis. Veuillez réessayer.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleEditClick = (apt: Appointment) => {
    setEditData({
      services: (apt as any).services || [{ name: apt.service, duration: apt.duration || '60 min', price: typeof apt.price === 'number' ? apt.price : parseFloat(String(apt.price)) || 0 }],
      date: apt.date,
      time: apt.time,
      professional: apt.professional
        ? salonTeam?.find((m) => m.name === apt.professional) || null
        : null,
      notes: apt.notes || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = (newData: any) => {
    if (selectedAppointment) {
      // Call parent or update logic
      if (onUpdateAppointment) {
        onUpdateAppointment(selectedAppointment.id, newData);
      }
      // Update local selectedAppointment for immediate UI feedback
      setSelectedAppointment({
        ...selectedAppointment,
        ...newData,
        service: newData.services?.map((s: any) => s.name).join(', ') || selectedAppointment.service,
        price: newData.services?.reduce((acc: number, s: any) => acc + (s.price || 0), 0) || selectedAppointment.price,
        duration: newData.services?.map((s: any) => s.duration).join(' + ') || selectedAppointment.duration,
        professional: newData.professional?.name || selectedAppointment.professional,
        notes: newData.notes || selectedAppointment.notes,
      });
    }
    setShowEditModal(false);
  };

  const [cancellingAppointment, setCancellingAppointment] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancelClick = () => {
    if (!selectedAppointment) return;

    const email = selectedAppointment.clientEmail || selectedAppointment.email;
    if (!email) {
      setCancelError('Email non disponible. Veuillez contacter le support.');
      return;
    }

    setShowCancelModal(true);
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;

    const email = selectedAppointment.clientEmail || selectedAppointment.email;
    if (!email) {
      setCancelError('Email non disponible. Veuillez contacter le support.');
      setShowCancelModal(false);
      return;
    }

    setCancellingAppointment(true);
    setCancelError(null);

    try {
      // Cancel appointment - this will automatically notify the admin
      const response = await api.cancelAppointment(selectedAppointment.id, email);
      
      
      // Update local state
      setSelectedAppointment({
        ...selectedAppointment,
        status: 'cancelled'
      });

      // Call parent handler to refresh appointments
      if (onUpdateAppointment) {
        // refreshAppointments doesn't take parameters, but onUpdateAppointment signature expects them
        (onUpdateAppointment as any)();
      }

      // Show success message indicating admin was notified
      setCancelSuccess(true);
      setShowCancelModal(false);
      
      // Close details view after a short delay
      setTimeout(() => {
        closeDetails();
        setCancelSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Error cancelling appointment:', error);
      setCancelError(error.message || 'Erreur lors de l\'annulation du rendez-vous. Veuillez réessayer.');
      setShowCancelModal(false);
    } finally {
      setCancellingAppointment(false);
    }
  };

  // Details page view
  if (selectedAppointment) {
    return (
      <>
        <div className="min-h-screen -m-8 bg-[#f5f7f3]">
       
        {/* Hero Section - Refined */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-8 sm:pt-12 lg:pt-16">
          {/* Top right controls */}
          <div className="flex justify-end mb-6 relative z-50">
            <div className="flex items-center gap-4">
              <button 
                onClick={closeDetails}
                className="flex items-center gap-3 text-gray-400 hover:text-gray-900 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full group-hover:border-gray-900 flex items-center justify-center transition-all">
                  <ArrowLeft className="w-4 h-4" />
                </div>
                <span className="text-sm font-light tracking-wide">Retour</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 -mt-8 sm:-mt-12 lg:-mt-16 gap-6 sm:gap-8 lg:gap-12 mb-8 sm:mb-12 lg:mb-16">
            <div className="sm:col-span-1 lg:col-span-2">
              <div className="aspect-[4/3] rounded-2xl sm:rounded-3xl overflow-hidden relative">
                <img 
                  src={getImageUrl(selectedAppointment.image) || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80'} 
                  alt={selectedAppointment.salon}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80';
                  }}
                />
                {/* Status badge absolutely positioned in top right, now smaller */}
                <div className={`absolute top-3 right-3 px-3 py-1 text-[11px] font-light tracking-widest rounded-full ${
                  getStatusBadgeClass(selectedAppointment.status)
                }`}>
                  {getStatusText(selectedAppointment.status)}
                </div>
              </div>
            </div>
            
            <div className="sm:col-span-2 lg:col-span-3 flex flex-col justify-center space-y-6 sm:space-y-8">
              <div>
                {/* Status badge removed from here */}
                <div className="text-[10px] sm:text-xs font-light tracking-widest text-gray-400 uppercase mb-3 sm:mb-4">
                  Réservation {selectedAppointment.id ? `#REF${selectedAppointment.id.slice(-8).toUpperCase()}` : ''}
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extralight text-gray-900 tracking-tight leading-tight mb-4 sm:mb-6">
                  {selectedAppointment.salon}
                </h1>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 lg:gap-6 text-gray-500">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm font-light">{selectedAppointment.address || 'Casablanca, Morocco'}</span>
                  </div>
                  {selectedAppointment.salonPhone && (
                    <>
                      <span className="hidden sm:inline text-gray-300">•</span>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm font-light">{selectedAppointment.salonPhone}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Key Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-[#f5f7f3] rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-gray-200">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mb-2 sm:mb-3" />
                  <div className="text-[10px] sm:text-xs text-gray-400 mb-1 font-light tracking-wide">DATE</div>
                  <div className="text-sm sm:text-base font-light text-gray-900">
                    {formatMoroccoDate(selectedAppointment.date, { 
                      day: 'numeric', 
                      month: 'short'
                    })}
                  </div>
                </div>

                <div className="bg-[#f5f7f3] rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-gray-200">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mb-2 sm:mb-3" />
                  <div className="text-[10px] sm:text-xs text-gray-400 mb-1 font-light tracking-wide">HEURE</div>
                  <div className="text-sm sm:text-base font-light text-gray-900">{selectedAppointment.time}</div>
                </div>

                <div className="bg-[#f5f7f3] rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-gray-200">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mb-2 sm:mb-3" />
                  <div className="text-[10px] sm:text-xs text-gray-400 mb-1 font-light tracking-wide">TOTAL</div>
                  <div className="text-sm sm:text-base font-light text-gray-900">
                    {selectedAppointment.totalPrice || selectedAppointment.price || 0} MAD
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pb-12 sm:pb-16 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
              {/* Service Details */}
              <div className="bg-[#f5f7f3] rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 xl:p-10 border border-gray-200">
                <div className="text-xs font-light tracking-widest text-gray-400 uppercase mb-6">
                  {selectedAppointment.services && selectedAppointment.services.length > 1 ? 'Services' : 'Service'}
                </div>
                
                {selectedAppointment.services && selectedAppointment.services.length > 0 ? (
                  <div className="space-y-6">
                    {selectedAppointment.services.map((svc, index) => (
                      <div key={svc.id || index} className="flex items-start justify-between pb-6 border-b border-gray-200 last:border-b-0 last:pb-0">
                        <div className="flex-1">
                          <h2 className="text-xl sm:text-2xl font-light text-gray-900 mb-2">
                            {svc.name}
                          </h2>
                          <div className="text-sm text-gray-500 font-light">
                            Durée: {svc.duration} min
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-2xl sm:text-3xl font-extralight text-gray-900">{svc.price}</div>
                          <div className="text-xs text-gray-400 font-light tracking-wide mt-1">MAD</div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total Duration */}
                    {selectedAppointment.services.length > 1 && (
                      <div className="pt-6 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-gray-400 font-light tracking-wide mb-1">DURÉE TOTALE</div>
                            <div className="text-lg font-light text-gray-900">
                              {selectedAppointment.services.reduce((sum, s) => sum + s.duration, 0)} minutes
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 font-light tracking-wide mb-1">PRIX TOTAL</div>
                            <div className="text-lg font-light text-gray-900">
                              {selectedAppointment.services.reduce((sum, s) => sum + s.price, 0)} MAD
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex-1">
                      <h2 className="text-2xl font-light text-gray-900 mb-3">
                        {selectedAppointment.service}
                      </h2>
                      {selectedAppointment.serviceDescription && (
                        <p className="text-sm text-gray-500 leading-relaxed font-light">
                          {selectedAppointment.serviceDescription}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl sm:text-3xl font-extralight text-gray-900">{selectedAppointment.price || 0}</div>
                      <div className="text-xs text-gray-400 font-light tracking-wide mt-1">MAD</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Date & Time Detailed */}
              <div className="bg-[#f5f7f3] rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 xl:p-10 border border-gray-200">
                <div className="text-xs font-light tracking-widest text-gray-400 uppercase mb-6">
                  Horaire de votre rendez-vous
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-gray-900 rounded-2xl flex flex-col items-center justify-center border border-gray-200">
                      <div className="text-2xl font-light text-white">
                        {new Date(selectedAppointment.date).getDate()}
                      </div>
                      <div className="text-xs text-gray-400 font-normal">
                        {formatMoroccoDate(selectedAppointment.date, { month: 'short' }).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xl font-light text-gray-900 mb-1">
                        {formatMoroccoDate(selectedAppointment.date, { 
                          weekday: 'long',
                          day: 'numeric', 
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-gray-500 font-light">{selectedAppointment.time}</div>
                    </div>
                  </div>

                  <div className="h-px bg-gray-100"></div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 font-light">Arrivée recommandée</span>
                    <span className="text-gray-900 font-light">15 minutes avant</span>
                  </div>
                </div>
              </div>

              {/* Professional */}
              {selectedAppointment.professional ? (
                <div className="bg-[#f5f7f3] rounded-2xl p-10 border border-gray-200">
                  <div className="text-xs font-light tracking-widest text-gray-400 uppercase mb-6">
                    Votre professionnel
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center text-white text-xl font-light">
                      {selectedAppointment.professional.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-light text-gray-900 mb-2">
                        {selectedAppointment.professional}
                      </h3>
                      {selectedAppointment.professionalSpecialty && (
                        <p className="text-sm text-gray-500 font-light mb-2">
                          {selectedAppointment.professionalSpecialty}
                        </p>
                      )}
                      {selectedAppointment.professionalYearsExp && (
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-gray-400" />
                            Expert
                          </span>
                          <span>•</span>
                          <span>{selectedAppointment.professionalYearsExp} ans d'expérience</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedAppointment.professionals && selectedAppointment.professionals.length > 1 && (
                    <div className="mt-8 pt-8 border-t border-gray-200">
                      <div className="text-xs text-gray-400 font-light tracking-wide mb-4">ÉQUIPE DÉDIÉE</div>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedAppointment.professionals.map((prof, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50">
                            <div className="w-12 h-12 bg-gray-900 flex items-center justify-center text-white text-xs font-light rounded-full">
                              {prof.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="text-sm font-light text-gray-900">{prof.name}</div>
                              <div className="text-xs text-gray-400">{prof.specialty}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#f5f7f3] rounded-2xl p-10 border border-gray-200">
                  <div className="text-xs font-light tracking-widest text-gray-400 uppercase mb-6">
                    Votre professionnel
                  </div>
                  <div className="text-sm text-gray-500 font-light">
                    Aucun professionnel assigné pour ce rendez-vous
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedAppointment.notes && (
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-10 border border-gray-100">
                  <div className="text-xs font-light tracking-widest text-gray-400 uppercase mb-4">
                    Notes importantes
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed font-light">
                    {(() => {
                      // Clean notes: remove incorrect prices like "30300 MAD"
                      let notes = selectedAppointment.notes || '';
                      
                      // Remove prices >= 10000 MAD (likely incorrect)
                      notes = notes.replace(/\b(\d{4,})\s*MAD\b/gi, '');
                      
                      // Remove prices from "Services réservés:" lines
                      // Transform "Services réservés: serviceName (XX min - XX MAD)" to "Services réservés: serviceName (XX min)"
                      notes = notes.split('\n').map(line => {
                        const trimmed = line.trim();
                        if (trimmed.includes('Services réservés:')) {
                          // Remove price part: " - XX MAD" or " - À partir de XX MAD" or " - XX-YY MAD" or " - Sur devis"
                          return trimmed.replace(/\s*-\s*(?:À partir de\s*)?\d+(?:-\d+)?\s*MAD/g, '')
                                       .replace(/\s*-\s*Sur devis/g, '');
                        }
                        return line;
                      }).join('\n').trim();
                      
                      // Remove "Services réservés:" lines with very high prices (keep this for backward compatibility)
                      notes = notes.split('\n').filter(line => {
                        const trimmed = line.trim();
                        if (trimmed.includes('Services réservés:')) {
                          const hasHighPrice = /\b\d{4,}\s*MAD/.test(trimmed);
                          if (hasHighPrice) {
                            return false; // Remove this line
                          }
                        }
                        return true;
                      }).join('\n').trim();
                      
                      // Clean up multiple spaces and empty lines
                      notes = notes.replace(/\n\s*\n/g, '\n').trim();
                      
                      return notes;
                    })()}
                  </p>
                </div>
              )}

              {/* Opinion Section */}
              {showReviewForm && (
                <div className="bg-[#f5f7f3] rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 xl:p-10 border border-gray-200">
                  <div className="text-xs font-light tracking-widest text-gray-400 uppercase mb-6">
                    Votre avis
                  </div>
                  
                  {/* Error Message */}
                  {reviewError && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                      {reviewError}
                    </div>
                  )}
                  
                  {/* Success Message */}
                  {reviewSuccess && (
                    <div className="mb-6 bg-green-50 border border-green-200 text-green-600 rounded-xl px-4 py-3 text-sm">
                      {reviewSuccess}
                    </div>
                  )}
                  
                  {/* Star Rating */}
                  <div className="mb-6">
                    <div className="text-sm text-gray-600 font-light mb-3">Note globale</div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          className="group"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          aria-label={`${star} étoiles`}
                        >
                          <Star 
                            className={`w-8 h-8 transition-all cursor-pointer ${
                              star <= (hoverRating || rating)
                                ? 'text-gray-900 fill-gray-900'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment Textarea */}
                  <div className="mb-6">
                    <div className="text-sm text-gray-600 font-light mb-3">Votre commentaire</div>
                    <textarea
                      placeholder="Partagez votre expérience avec ce salon..."
                      rows={5}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full px-4 py-3 bg-[#f5f7f3] border border-gray-200 rounded-2xl text-sm text-gray-900 font-light placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-colors resize-none"
                    />
                  </div>

                  {/* Specific Ratings */}
                  <div className="space-y-4 mb-6">
                    <div className="text-sm text-gray-600 font-light mb-3">Évaluations détaillées</div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-light">Qualité du service</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setDetailedRatings({...detailedRatings, quality: star})}
                          >
                            <Star 
                              className={`w-5 h-5 transition-all cursor-pointer ${
                                star <= detailedRatings.quality
                                  ? 'text-gray-900 fill-gray-900'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-light">Professionnalisme</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setDetailedRatings({...detailedRatings, professionalism: star})}
                          >
                            <Star 
                              className={`w-5 h-5 transition-all cursor-pointer ${
                                star <= detailedRatings.professionalism
                                  ? 'text-gray-900 fill-gray-900'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-light">Propreté</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setDetailedRatings({...detailedRatings, cleanliness: star})}
                          >
                            <Star 
                              className={`w-5 h-5 transition-all cursor-pointer ${
                                star <= detailedRatings.cleanliness
                                  ? 'text-gray-900 fill-gray-900'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-light">Rapport qualité/prix</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setDetailedRatings({...detailedRatings, value: star})}
                          >
                            <Star 
                              className={`w-5 h-5 transition-all cursor-pointer ${
                                star <= detailedRatings.value
                                  ? 'text-gray-900 fill-gray-900'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button 
                    onClick={handleSubmitReview}
                    disabled={submittingReview}
                    className="w-full py-4 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-light tracking-wide transition-all rounded-full"
                  >
                    {submittingReview ? 'Publication...' : 'Publier l\'avis'}
                  </button>
                </div>
              )}
            </div>

            {/* Right Sidebar - Sticky */}
            <div className="space-y-4 sm:space-y-6 lg:sticky lg:top-24 lg:self-start">
              {/* Payment Breakdown */}
              <div className="bg-[#f5f7f3] rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 border border-gray-200">
                <div className="text-xs font-light tracking-widest text-gray-400 uppercase mb-6">
                  Détails de paiement
                </div>
                
                <div className="space-y-4">
                  {/* Services List */}
                  {selectedAppointment.services && selectedAppointment.services.length > 0 ? (
                    <>
                      {selectedAppointment.services.map((svc, index) => (
                        <div key={svc.id || index} className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="text-sm text-gray-900 font-light block">{svc.name}</span>
                            <span className="text-xs text-gray-500 font-light">{svc.duration} min</span>
                          </div>
                          <span className="text-sm text-gray-900 font-light whitespace-nowrap">{svc.price} MAD</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-light">Service</span>
                      <span className="text-sm text-gray-900 font-light">{selectedAppointment.price || 0} MAD</span>
                    </div>
                  )}
                  
                  {selectedAppointment.discount && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-light">Réduction</span>
                      <span className="text-sm text-emerald-600 font-light">-{selectedAppointment.discount} MAD</span>
                    </div>
                  )}
                  
                  {selectedAppointment.tax && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-light">TVA (20%)</span>
                      <span className="text-sm text-gray-900 font-light">{selectedAppointment.tax} MAD</span>
                    </div>
                  )}

                  <div className="h-px bg-gray-100 my-4"></div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-base text-gray-900 font-light">Total</span>
                    <span className="text-2xl text-gray-900 font-light">
                      {selectedAppointment.totalPrice || selectedAppointment.price || 0} MAD
                    </span>
                  </div>

                  <div className="pt-4 text-xs text-gray-400 font-light">
                    Mode: {selectedAppointment.paymentMethod || 'Sur place'}
                  </div>
                </div>
              </div>

              {/* Booking Reference */}
              <div className="bg-[#f5f7f3] rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 border border-gray-200">
                <div className="text-xs font-light tracking-widest text-gray-400 uppercase mb-6">
                  Informations
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-400 font-light mb-1">Référence</div>
                    <div className="text-sm font-mono font-light text-gray-900">
                      {selectedAppointment.id ? `#REF${selectedAppointment.id.slice(-8).toUpperCase()}` : 'N/A'}
                    </div>
                  </div>

                  {selectedAppointment.confirmationCode && (
                    <div>
                      <div className="text-xs text-gray-400 font-light mb-1">Code de confirmation</div>
                      <div className="text-sm font-mono font-light text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                        {selectedAppointment.confirmationCode}
                      </div>
                    </div>
                  )}

                  {selectedAppointment.bookedFor && (
                    <div>
                      <div className="text-xs text-gray-400 font-light mb-1">Réservé pour</div>
                      <div className="text-sm font-light text-gray-900">{selectedAppointment.bookedFor}</div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-gray-400 font-light mb-1">Réservé le</div>
                    <div className="text-sm font-light text-gray-900">
                      {selectedAppointment.bookingDate ? 
                        formatMoroccoDate(selectedAppointment.bookingDate, { 
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        }) :
                        formatMoroccoDate(new Date(), { 
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                {cancelError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                    {cancelError}
                  </div>
                )}
                {selectedAppointment.status === 'pending' && (
                  <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-xl px-4 py-3 text-sm font-light">
                    En attente de confirmation par l&apos;établissement. Vous serez notifié une fois le rendez-vous confirmé.
                  </div>
                )}
                {canCancelAppointment(selectedAppointment.status) && (
                  <button 
                    className="w-full py-4 border border-gray-200 hover:border-rose-300 hover:bg-rose-50 text-gray-600 hover:text-rose-700 text-sm font-light tracking-wide transition-all rounded-full"
                    onClick={handleCancelClick}
                  >
                    Annuler
                  </button>
                )}
                {selectedAppointment.status === 'completed' && (
                  <button
                    className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-light tracking-wide transition-all rounded-full"
                    onClick={() => setShowReviewForm(true)}
                  >
                    Laisser un avis
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      <EditAppointmentModal
        show={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialData={editData || {
          services: [],
          date: '',
          time: '',
          professional: null,
          notes: '',
        }}
        salonTeam={(salonTeam || []) as any}
        timeSlots={timeSlots || []}
        salonServices={(salonServices || []) as any}
        onSave={handleSaveEdit}
      />
      
      <DeleteModal
        open={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancelError(null);
        }}
        onConfirm={handleCancelAppointment}
        title="Annuler le rendez-vous"
        description="Êtes-vous sûr de vouloir annuler ce rendez-vous ? L'établissement sera automatiquement notifié de cette annulation. Cette action est irréversible."
        confirmText="Oui, annuler le rendez-vous"
        loading={cancellingAppointment}
      />

      {/* Success Message */}
      {cancelSuccess && (
        <div 
          className="fixed top-4 right-4 z-50 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-6 py-4 shadow-lg max-w-md"
          style={{
            animation: 'slideDown 0.3s ease-out'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs">✓</span>
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium block mb-1">Rendez-vous annulé avec succès</span>
              <span className="text-xs text-emerald-600">L'établissement a été automatiquement notifié de cette annulation.</span>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
    );
  }

  // List view
  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extralight text-gray-900 tracking-tight mb-2">Rendez-vous</h2>
          <p className="text-xs text-gray-400 tracking-wide font-light">
            {appointments.length} réservation{appointments.length !== 1 ? 's' : ''}
            {appointments.length > PAGE_SIZE ? ` · page ${safePage}/${totalPages}` : ''}
          </p>
        </div>
        
        {/* Sort Filter */}
        {onSortChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-light">Trier par:</span>
            <select
              value={currentSort}
              onChange={(e) => onSortChange(e.target.value as 'createdAt' | 'startTime')}
              className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-full text-gray-900 font-light focus:outline-none focus:border-gray-900 transition-colors cursor-pointer"
            >
              <option value="createdAt">Date de réservation</option>
              <option value="startTime">Date du rendez-vous</option>
            </select>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {paginatedAppointments.map((apt: Appointment) => (
          <div 
            key={apt.id} 
            onClick={() => handleAppointmentClick(apt)}
            className="group bg-[#f5f7f3] border border-gray-200 hover:border-gray-300 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 transition-all cursor-pointer"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 lg:gap-8">
              <div className="w-20 h-20 sm:w-24 sm:h-24 overflow-hidden flex-shrink-0 rounded-xl sm:rounded-2xl">
                <img 
                  src={getImageUrl(apt.image) || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80'} 
                  alt={apt.salon} 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80';
                  }}
                />
              </div>
              
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-8">
                <div>
                  <div className="text-[10px] sm:text-xs text-gray-400 tracking-wide font-light mb-1 sm:mb-2">SERVICE DATE</div>
                  <div className="text-xs sm:text-sm font-light text-gray-900 mb-0.5 sm:mb-1">{apt.service}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 font-light mb-1">
                    {formatMoroccoDate(apt.date, { day: 'numeric', month: 'short' })}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-400 font-light">{apt.time}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 font-light mt-1">{apt.salon}</div>
                </div>

                <div className="sm:col-span-1 lg:col-span-1">
                  <div className="text-[10px] sm:text-xs text-gray-400 tracking-wide font-light mb-1 sm:mb-2">PROFESSIONNEL</div>
                  <div className="text-xs sm:text-sm font-light text-gray-900 mb-1">{apt.professional || 'Non assigné'}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 font-light">{apt.price || 0} MAD</div>
                  {apt.status === 'pending' && (
                    <div className="text-[10px] sm:text-xs text-amber-700 font-light mt-1">
                      En attente du salon
                    </div>
                  )}
                </div>

                {/* Desktop status column - hidden on mobile and tablet */}
                <div className="hidden lg:flex items-center justify-end gap-4 lg:col-span-2">
                  {canCancelAppointment(apt.status) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAppointment(apt);
                        handleCancelClick();
                      }}
                      className="px-4 py-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-full border border-rose-200 hover:border-rose-300 transition-all font-light"
                      title="Annuler le rendez-vous"
                    >
                      Annuler
                    </button>
                  )}
                  <div className={`px-3 py-1 text-xs font-light tracking-wide rounded-full ${getStatusBadgeClass(apt.status)}`}>
                    {getStatusText(apt.status)}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-900 transition-colors" />
                </div>
              </div>
              
              {/* Mobile/Tablet status - shown on small screens */}
              <div className="flex items-center justify-between w-full sm:w-auto lg:hidden">
                <div className="flex items-center gap-2">
                  <div className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs font-light tracking-wide rounded-full ${getStatusBadgeClass(apt.status)}`}>
                    {getStatusText(apt.status)}
                  </div>
                  {canCancelAppointment(apt.status) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAppointment(apt);
                        handleCancelClick();
                      }}
                      className="px-2.5 py-1 text-[10px] sm:text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-full border border-rose-200 hover:border-rose-300 transition-all"
                      title="Annuler le rendez-vous"
                    >
                      Annuler
                    </button>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-900 transition-colors" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {appointments.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-gray-300 text-sm font-light text-gray-700 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Page précédente"
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </button>
          <span className="text-sm text-gray-500 tabular-nums font-light">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-gray-300 text-sm font-light text-gray-700 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Page suivante"
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AppointmentsTab;