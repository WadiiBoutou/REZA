import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Check, Plus } from 'lucide-react';
import AddServiceModal from '../salon/AddServiceModal';
import { getMoroccoToday, getMoroccoDate, isMoroccoPast } from '../../lib/utils';

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

type AppointmentData = {
  services: Service[];
  date: string;
  time: string;
  professional?: TeamMember | null;
  notes?: string;
};

type EditAppointmentModalProps = {
  show: boolean;
  onClose: () => void;
  initialData: AppointmentData;
  salonTeam: TeamMember[];
  timeSlots: string[];
  salonServices: { category: string; items: Service[]; description?: string }[];
  onSave: (data: AppointmentData) => void;
};

function sumDurations(services: Service[]): string {
  let totalMinutes = 0;
  services.forEach(service => {
    // Safely handle missing or non-string duration
    const duration = typeof service.duration === 'string' ? service.duration.trim() : '';
    let min = 0;
    const hMatch = duration.match(/(\d+)\s*h/);
    const mMatch = duration.match(/(\d+)\s*min/);
    if (hMatch) min += parseInt(hMatch[1], 10) * 60;
    if (mMatch) min += parseInt(mMatch[1], 10);
    if (!hMatch && !mMatch && /^\d+$/.test(duration)) min += parseInt(duration, 10);
    totalMinutes += min;
  });
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes} min`;
  if (hours) return `${hours}h`;
  return `${minutes} min`;
}

const EditAppointmentModal: React.FC<EditAppointmentModalProps> = ({
  show,
  onClose,
  initialData,
  salonTeam,
  timeSlots,
  salonServices,
  onSave,
}) => {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>(initialData.services);
  const [date, setDate] = useState(initialData.date);
  const [time, setTime] = useState(initialData.time);
  const [professional, setProfessional] = useState<TeamMember | null>(initialData.professional || null);
  const [notes, setNotes] = useState(initialData.notes || '');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [currentMonth, setCurrentMonth] = useState(() => date ? new Date(date) : getMoroccoToday());
  const [selectedDate, setSelectedDate] = useState<Date | null>(date ? new Date(date) : null);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);

  // Mock time slots if timeSlots is empty
  const getMockTimeSlots = () => [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ];

  // Filter out past time slots if the selected date is today
  const filteredTimeSlots = React.useMemo(() => {
    if (!date) {
      const slots = Array.isArray(timeSlots) && timeSlots.length > 0 ? timeSlots : getMockTimeSlots();
      return slots;
    }
    
    // Check if selected date is today (in Morocco timezone)
    const selectedDateObj = new Date(date);
    const today = getMoroccoToday();
    const isToday = selectedDateObj.getTime() === today.getTime();
    
    if (!isToday) {
      // If not today, return all slots
      return Array.isArray(timeSlots) && timeSlots.length > 0 ? timeSlots : getMockTimeSlots();
    }
    
    // If today, filter out past slots
    const now = getMoroccoDate();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const slots = Array.isArray(timeSlots) && timeSlots.length > 0 ? timeSlots : getMockTimeSlots();
    
    return slots.filter((timeSlot) => {
      const [hours, minutes] = timeSlot.split(':').map(Number);
      
      // Compare hours first, then minutes
      if (hours > currentHour) {
        return true; // Future hour
      } else if (hours === currentHour) {
        return minutes > currentMinute; // Same hour, check minutes
      } else {
        return false; // Past hour
      }
    });
  }, [timeSlots, date]);

  // Clear selected time if it's in the past (when date is today)
  React.useEffect(() => {
    if (!date || !time) return;
    
    const selectedDateObj = new Date(date);
    const today = getMoroccoToday();
    const isToday = selectedDateObj.getTime() === today.getTime();
    
    if (isToday) {
      const now = getMoroccoDate();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const [selectedHours, selectedMinutes] = time.split(':').map(Number);
      
      // Check if selected time is in the past
      const isPast = selectedHours < currentHour || 
                     (selectedHours === currentHour && selectedMinutes <= currentMinute);
      
      if (isPast) {
        // Clear the selected time
        setTime('');
      }
    }
  }, [date, time]);

  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [show]);

  // Calendar helpers
  const daysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };
  const isDateDisabled = (date: Date) => {
    const today = getMoroccoToday();
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };
  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };
  const handleDateSelect = (date: Date) => {
    if (!isDateDisabled(date)) {
      setSelectedDate(date);
      setDate(date.toISOString().split('T')[0]);
      setErrors({...errors, date: false});
    }
  };

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const validate = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    if (step === 1) {
      if (services.length === 0) newErrors.services = true;
    }
    if (step === 2) {
      if (!date) newErrors.date = true;
      if (!time) newErrors.time = true;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    if (step === 1) setStep(2);
    else if (step === 2) {
      onSave({
        services,
        date,
        time,
        professional,
        notes,
      });
      onClose();
    }
  };

  // Remove service by name (like BookingModal)
  const handleRemoveService = (serviceName: string) => {
    setServices(services.filter(s => s.name !== serviceName));
  };

  // Add service(s) from AddServiceModal
  const handleAddServices = (newServices: Service[]) => {
    // Only add services not already selected
    const updated = [
      ...services,
      ...newServices.filter(ns => !services.some(s => s.name === ns.name)),
    ];
    setServices(updated);
    setShowAddServiceModal(false);
  };

  if (!show) return null;

  // Use services from the current appointment as mock if salonServices is empty
  const getMockServicesFromAppointment = () => {
    const main = (initialData && initialData.services && initialData.services.length > 0)
      ? [{
          category: 'Services de la réservation',
          items: initialData.services
        }]
      : [];
    // Add other mock categories/services
    const others = [
      {
        category: 'Coiffure',
        items: [
          { name: 'Coupe homme', duration: '20min', price: 50 },
          { name: 'Coupe femme', duration: '30min', price: 80 },
          { name: 'Brushing', duration: '25min', price: 60 },
          { name: 'Soin capillaire marocain', duration: '40min', price: 120 }
        ]
      },
      {
        category: 'Coloration',
        items: [
          { name: 'Coloration racines', duration: '1h', price: 150 },
          { name: 'Coloration complète', duration: '1h 30min', price: 250 }
        ]
      },
      {
        category: 'Barbier',
        items: [
          { name: 'Rasage traditionnel', duration: '20min', price: 40 },
          { name: 'Taille de barbe', duration: '15min', price: 35 }
        ]
      }
    ];
    return [...main, ...others];
  };

  // Use salonServices if available, otherwise fallback to appointment's services + others
  const availableSalonServices =
    salonServices && salonServices.length > 0
      ? salonServices
      : getMockServicesFromAppointment();

  // Mock professionals if salonTeam is empty
  const getMockProfessionals = () => [
    {
      name: 'Sofia Benali',
      initials: 'SB',
      specialty: 'Coloriste',
      rating: 4.8,
      experience: '6 ans'
    },
    {
      name: 'Yassine El Idrissi',
      initials: 'YE',
      specialty: 'Barbier',
      rating: 4.7,
      experience: '8 ans'
    },
    {
      name: 'Lina Amrani',
      initials: 'LA',
      specialty: 'Coiffeuse',
      rating: 4.9,
      experience: '10 ans'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7f3] overflow-y-auto">
      <div className="min-h-screen flex flex-col max-w-2xl mx-auto">
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-gray-100">
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors group"
          >
            <X className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>
          {/* Step Progress Dots */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-all duration-500 ${
                  s === step ? 'w-8 bg-[#8b7260]' : s < step ? 'w-8 bg-[#8b7260]' : 'w-8 bg-gray-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center">
            <h2 className="text-2xl font-light text-gray-900 tracking-tight">
              {step === 1 && 'Modifier les services'}
              {step === 2 && 'Modifier la date et l\'horaire'}
            </h2>
            {step === 1 && (
              <button
                type="button"
                onClick={() => setShowAddServiceModal(true)}
                className="ml-3 p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Ajouter des services"
              >
                <Plus className="w-5 h-5 text-[#8b7260]" />
              </button>
            )}
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 px-8 py-8">
          {/* Step 1: Edit Services */}
          {step === 1 && (
            <div>
              <div className="space-y-3 mb-6">
                {services.map((service, idx) => (
                  <div 
                    key={idx}
                    className="group flex items-center justify-between py-5 border-b border-gray-300 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex-1 flex items-center justify-between">
                      <p className="px-2 py-0.5 rounded text-gray-900 font-semibold text-lg tracking-wide inline-block">
                        {service.name}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-500 ml-4">
                        <span className="font-mono rounded text-gray-900 font-semibold text-xs tracking-wide">{service.duration}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="font-mono rounded text-gray-900 font-semibold text-xs tracking-wide">{service.price} MAD</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveService(service.name)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 ml-6"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
              {/* Total */}
              <div className="pt-6 flex items-center justify-between">
                <span className="text-gray-800 font-semibold">TOTAL</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono rounded text-gray-900 font-semibold text-base tracking-wide">
                    {sumDurations(services)}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-gray-300" />
                  <span className="font-mono text-gray-900 rounded text-base font-semibold tracking-wide">
                    {services.reduce((acc, s) => acc + (s.price || 0), 0)} MAD
                  </span>
                </div>
              </div>
              {/* Add Service Modal */}
              {showAddServiceModal && (
                <AddServiceModal
                  selectedServices={services}
                  onSelectServices={handleAddServices}
                  onClose={() => setShowAddServiceModal(false)}
                  salonServices={availableSalonServices}
                />
              )}
              {errors.services && (
                <div className="text-xs text-red-500 mt-3">Veuillez sélectionner au moins un service.</div>
              )}
            </div>
          )}
          {/* Step 2: Edit Date/Time/Professional */}
          {step === 2 && (
            <>
              <div className="flex flex-col md:flex-row gap-10">
                {/* Calendar */}
                <div className="w-full md:w-1/2 max-w-xs">
                  <label className="block text-sm text-gray-600 mb-4 tracking-wide uppercase text-[11px] font-medium">Date</label>
                  <div className="bg-transparent rounded-2xl border border-gray-300 p-4">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                        className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div className="text-center">
                        <h3 className="text-base font-light text-gray-900">{monthNames[currentMonth.getMonth()]}</h3>
                        <p className="text-xs text-gray-500">{currentMonth.getFullYear()}</p>
                      </div>
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                        className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    {/* Day Names */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {dayNames.map(day => (
                        <div key={day} className="text-center text-[11px] font-medium text-gray-400 py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        const { days, firstDay } = daysInMonth(currentMonth);
                        const cells = [];
                        for (let i = 0; i < firstDay; i++) {
                          cells.push(<div key={`empty-${i}`} />);
                        }
                        for (let day = 1; day <= days; day++) {
                          const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                          const disabled = isDateDisabled(d);
                          const selected = selectedDate && isSameDay(d, selectedDate);
                          const today = isSameDay(d, getMoroccoToday());
                          cells.push(
                            <button
                              key={day}
                              onClick={() => handleDateSelect(d)}
                              disabled={disabled}
                              className={`aspect-square w-7 h-7 rounded text-xs font-bold transition-all ${
                                selected
                                  ? 'bg-[#8b7260] text-white'
                                  : today
                                  ? 'bg-transparent text-[#8b7260] font-bold'
                                  : disabled
                                  ? 'text-gray-300 cursor-not-allowed '
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                    {errors.date && (
                      <div className="text-xs text-red-500 mt-1">Veuillez choisir une date.</div>
                    )}
                  </div>
                </div>
                {/* Professional */}
                <div className="w-full md:w-1/2">
                  <label className="block text-sm text-gray-600 mb-4 tracking-wide uppercase text-[11px] font-medium">Professionnel</label>
                  <div className="flex flex-col gap-2">
                    {(Array.isArray(salonTeam) && salonTeam.length > 0 ? salonTeam : getMockProfessionals()).map((member, idx) => {
                      const isActive = professional?.name === member.name;
                      return (
                        <button
                          key={idx}
                          onClick={() => setProfessional(isActive ? null : member)}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-all text-left w-full ${
                            isActive
                              ? 'bg-[#8b7260] text-white'
                              : 'bg-transparent border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium ${
                            isActive ? 'bg-white text-[#8b7260]' : 'bg-[#8b7260] text-white'
                          }`}>
                            {member.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>
                              {member.name}
                            </p>
                            <p className={`text-xs truncate ${isActive ? 'text-white/70' : 'text-gray-500'}`}>
                              {member.specialty}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* Time Slots */}
              <div className="mt-10">
                <label className="block text-sm text-gray-600 mb-3 tracking-wide uppercase text-[11px] font-medium">Heure</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filteredTimeSlots.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTime(t);
                        setErrors({...errors, time: false});
                      }}
                      className={`py-2 text-sm font-medium rounded-lg transition-all ${
                        time === t
                          ? 'bg-[#8b7260] text-white'
                          : 'bg-transparent border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {errors.time && (
                  <div className="text-xs text-red-500 mt-1">Veuillez choisir une heure.</div>
                )}
              </div>
              {/* Notes */}
              <div className="mt-8">
                <label className="block text-sm text-gray-600 mb-2 tracking-wide uppercase text-[11px] font-medium">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-0 py-3 text-lg border-0 border-b-2 border-gray-200 focus:border-[#8b7260] focus:outline-none transition-colors resize-none placeholder-gray-400 text-gray-900"
                  rows={2}
                  placeholder="Informations supplémentaires..."
                />
              </div>
            </>
          )}
        </div>
        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-100 flex items-center justify-between bg-[#f5f7f3]">
          <div className="text-sm text-gray-500">
            Étape {step} sur 2
          </div>
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={() => {
                  setStep(step - 1);
                  setErrors({});
                }}
                className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Retour
              </button>
            )}
            <button
              onClick={handleContinue}
              className="px-8 py-3 bg-[#8b7260] text-white rounded-full font-medium hover:bg-[#6d5a4d] transition-all flex items-center gap-2"
            >
              {step === 2 ? 'Enregistrer' : 'Continuer'}
              {step < 2 && <ArrowRight className="w-4 h-4" />}
              {step === 2 && <Check className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditAppointmentModal;
