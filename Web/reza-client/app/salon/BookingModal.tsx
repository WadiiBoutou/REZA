import { X, Check, ArrowRight, CreditCard, Store, Lock, Plus, Calendar, Clock, User, Users, AlertCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Receipt from './Receipt';
import Loading from './Loading';
import GroupParticipantsSection, { GuestParticipant, FamilyMemberOption } from './GroupParticipantsSection';
import AddServiceModal from './AddServiceModal';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { getMoroccoToday, getMoroccoDate, isMoroccoToday, isMoroccoPast, formatMoroccoDate, formatMoroccoTime, formatMoroccoDateTime, createDateFromMoroccoDateTime } from '../../lib/utils';
import {
  clearBookingForProche,
  peekBookingForProche,
} from '../../lib/bookingForProche';

type Service = {
  id?: string;
  name: string;
  duration: string;
  price?: number;
  priceType?: string;
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  avatar?: string;
  services?: any[];
};

type BookingData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  notes: string;
  totalPrice: number;
  totalDuration: string;
  paymentMethod?: 'establishment' | 'card';
  cardNumber?: string;
  cardName?: string;
  cardExpiry?: string;
  cardCVV?: string;
};

type BookingModalProps = {
  show: boolean;
  onClose: () => void;
  bookingStep: number;
  setBookingStep: (step: number) => void;
  selectedServices: Service[];
  getTotalDuration: () => string;
  getTotalPrice: () => number;
  bookingData: BookingData;
  setBookingData: (data: BookingData | ((prev: BookingData) => BookingData)) => void;
  timeSlots: string[];
  setSelectedServices: (services: Service[]) => void;
  onAddService?: () => void;
  onSlotServiceIdsChange?: (serviceIds: string[]) => void;
  salonServices: { category: string; items: Service[]; description?: string }[];
  salonId?: string;
  employees?: Employee[];
  slotsLoading?: boolean;
  slotsError?: string | null;
  lastUpdated?: Date | null;
  blockedDates?: string[];
  preferredEmployeeId?: string | null;
};

// Utility to sum durations
function sumDurations(services: Service[]): string {
  let totalMinutes = 0;
  services.forEach(service => {
    const duration = service.duration.trim();
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

// Format card number with spaces
const formatCardNumber = (value: string) => {
  const cleaned = value.replace(/\s/g, '');
  const chunks = cleaned.match(/.{1,4}/g);
  return chunks ? chunks.join(' ') : cleaned;
};

// Format expiry date
const formatExpiry = (value: string) => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
  }
  return cleaned;
};

type EmployeeAvailabilityStatus = {
  id: string;
  firstName: string;
  lastName: string;
  available: boolean;
  reason: string | null;
  recommended: boolean;
};

const BookingModal: React.FC<BookingModalProps> = ({
  show,
  onClose,
  bookingStep,
  setBookingStep,
  selectedServices,
  getTotalDuration,
  getTotalPrice,
  bookingData,
  setBookingData,
  timeSlots,
  setSelectedServices,
  onAddService,
  onSlotServiceIdsChange,
  salonServices,
  salonId,
  employees = [],
  slotsLoading = false,
  slotsError = null,
  lastUpdated = null,
  blockedDates = [],
  preferredEmployeeId = null,
}) => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(getMoroccoToday());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [groupParticipants, setGroupParticipants] = useState<GuestParticipant[]>([]);
  const [includeBooker, setIncludeBooker] = useState(true);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberOption[]>([]);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>('any');

  useEffect(() => {
    if (show) {
      setSelectedTeamMemberId(preferredEmployeeId || 'any');
    }
  }, [show, preferredEmployeeId]);

  // "Même employé pour tous les services" feature
  const [sameEmployeeForAll, setSameEmployeeForAll] = useState(true);
  const [commonEmployeeIdsPerPerson, setCommonEmployeeIdsPerPerson] = useState<Record<string, string[]>>({});
  const [perServiceEmployeeMap, setPerServiceEmployeeMap] = useState<Record<string, Record<string, string>>>({});

  // Per-service employee availability data from backend (for "Même employé" unchecked view)
  const [serviceEmployeeData, setServiceEmployeeData] = useState<Record<string, any[]>>({});

  // Conflict resolution state
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolvingEmployees, setResolvingEmployees] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const resolveCounterRef = useRef(0);
  const applyingResolvedStateRef = useRef(false);
  
  // Real employee availability map per person: key is 'booker' or participant.id
  const [employeeAvailabilityMap, setEmployeeAvailabilityMap] = useState<Record<string, EmployeeAvailabilityStatus[]>>({});
  const [availabilityLoadingMap, setAvailabilityLoadingMap] = useState<Record<string, boolean>>({});

  const [receiptSummary, setReceiptSummary] = useState<{
    participants: { name: string; services: Service[]; subtotal: number }[];
    grandTotal: number;
  } | null>(null);

  const [salonData, setSalonData] = useState<{
    name?: string;
    address?: string;
    city?: string;
    phone?: string;
    ice?: string;
    rc?: string;
    if?: string;
  } | null>(null);
  
  const [clientProfileData, setClientProfileData] = useState<{
    phone?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null>(null);

  // Fetch client profile data when modal opens (if authenticated)
  useEffect(() => {
    const fetchClientData = async () => {
      if (isAuthenticated && user?.email && show) {
        try {
          const response = await api.getClientAppointments(user.email, undefined, 1);
          if (response.client) {
            setClientProfileData({
              phone: response.client.phone || '',
              firstName: response.client.firstName || '',
              lastName: response.client.lastName || '',
              email: response.client.email || ''
            });
          }
        } catch (err) {
          console.error('Error fetching client data:', err);
          setClientProfileData({
            phone: user.phone || '',
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || ''
          });
        }
      }
    };
    
    fetchClientData();
  }, [isAuthenticated, user?.email, show]);

  // "Réserver pour [proche]" — keep intent until modal closes
  useEffect(() => {
    if (!show) return;
    const pending = peekBookingForProche();
    if (!pending?.id) return;

    const displayName =
      pending.name.trim() ||
      [pending.firstName, pending.lastName].filter(Boolean).join(' ').trim();
    setIncludeBooker(false);
    setGroupParticipants([
      {
        id: `family-${pending.id}`,
        familyMemberId: pending.id,
        name: displayName,
        sameServicesAsBooker: true,
        serviceIds: [],
        employeeId: 'any',
        followsBookerSchedule: true,
      },
    ]);
  }, [show]);

  // Load Mes proches when logged-in client opens booking modal
  useEffect(() => {
    if (!show) return;
    if (!isAuthenticated || !user?.email) {
      setFamilyMembers([]);
      setFamilyLoading(false);
      return;
    }

    let cancelled = false;
    const loadFamily = async () => {
      setFamilyLoading(true);
      try {
        const familyRes = await api.getClientFamilyMembers(user.email);
        if (cancelled) return;
        const formatted: FamilyMemberOption[] = (familyRes.familyMembers || []).map(
          (member: any) => ({
            id: member.id,
            name: `${member.firstName || ''} ${member.lastName || ''}`.trim(),
            firstName: member.firstName,
            lastName: member.lastName,
            relationship: member.relationship,
          })
        );
        setFamilyMembers(formatted);
      } catch (err) {
        console.error('Error fetching family members for booking:', err);
        if (!cancelled) setFamilyMembers([]);
      } finally {
        if (!cancelled) setFamilyLoading(false);
      }
    };

    loadFamily();
    return () => {
      cancelled = true;
    };
  }, [show, isAuthenticated, user?.email]);

  // Reset state when modal closes
  useEffect(() => {
    if (!show) {
      clearBookingForProche();
      setGroupParticipants([]);
      setIncludeBooker(true);
      setSelectedTeamMemberId('any');
      setEmployeeAvailabilityMap({});
      setAvailabilityLoadingMap({});
    }
  }, [show]);

  // Auto-sync: when booker date/time changes, clear stale overrides for linked participants
  useEffect(() => {
    setGroupParticipants(prev =>
      prev.map(p =>
        p.followsBookerSchedule !== false
          ? { ...p, customTime: undefined, customDate: undefined }
          : p
      )
    );
  }, [bookingData.date, bookingData.time]);
  
  // Calculate total steps & step mapping
  // Step 1: Prestations & Groupe
  // Step 2: Date & Créneau
  // Step 3: Professionnel
  // Step 4: Coordonnées (if !isAuthenticated || !userHasAllInfo)
  // Step 5: Paiement (Step 4 if step 4 skipped)
  const effectivePhone = clientProfileData?.phone || user?.phone || '';
  const userHasAllInfo = isAuthenticated && effectivePhone && effectivePhone.trim() !== '';
  const shouldShowStep3 = !isAuthenticated || !userHasAllInfo;
  
  const visibleSteps = shouldShowStep3 ? [1, 2, 3, 4, 5] : [1, 2, 3, 5];
  const displayStep = visibleSteps.indexOf(bookingStep) + 1;
  const totalSteps = visibleSteps.length;

  const flatServices = salonServices.flatMap((c) => c.items);
  const getServicesTotal = (ids: string[]) =>
    flatServices
      .filter((s) => ids.includes((s.id || s.name) as string))
      .reduce((sum, s) => sum + (s.price || 0), 0);

  const getGroupGrandTotal = () => {
    const bookerTotal = getTotalPrice();
    const guestsTotal = groupParticipants.reduce((sum, p) => {
      if (p.sameServicesAsBooker) return sum + bookerTotal;
      return sum + getServicesTotal(p.serviceIds);
    }, 0);
    return (includeBooker ? bookerTotal : 0) + guestsTotal;
  };

  useEffect(() => {
    const bookerIds = selectedServices.map((s) => s.id).filter(Boolean) as string[];
    const extraIds = groupParticipants.flatMap((p) =>
      p.sameServicesAsBooker ? bookerIds : p.serviceIds
    );
    onSlotServiceIdsChange?.([...new Set([...bookerIds, ...extraIds])]);
  }, [selectedServices, groupParticipants, onSlotServiceIdsChange]);

  const [filterUpdateKey, setFilterUpdateKey] = useState(0);
  
  useEffect(() => {
    if (!bookingData.date) return;
    const interval = setInterval(() => {
      setFilterUpdateKey(prev => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, [bookingData.date]);

  // Fetch salon data
  useEffect(() => {
    if (!salonId) return;
    const fetchSalonData = async () => {
      try {
        const tenantRes = await api.getTenant(salonId);
        const tenant = tenantRes.tenant;
        setSalonData({
          name: tenant?.name,
          address: tenant?.address,
          city: tenant?.city,
          phone: tenant?.phone,
          ice: tenant?.ice || tenant?.settings?.ice,
          rc: tenant?.rc || tenant?.settings?.rc,
          if: tenant?.if || tenant?.settings?.if || tenant?.fiscalId || tenant?.settings?.fiscalId,
        });
      } catch (err) {
        console.error('Error fetching salon data:', err);
      }
    };
    fetchSalonData();
  }, [salonId]);

  // Filter time slots
  const filteredTimeSlots = useMemo(() => {
    if (!bookingData.date) return timeSlots;
    const dateParts = bookingData.date.split('-');
    if (dateParts.length !== 3) return timeSlots;
    
    const selectedYear = parseInt(dateParts[0], 10);
    const selectedMonth = parseInt(dateParts[1], 10) - 1;
    const selectedDay = parseInt(dateParts[2], 10);
    
    if (isNaN(selectedYear) || isNaN(selectedMonth) || isNaN(selectedDay)) {
      return timeSlots;
    }
    
    const today = getMoroccoToday();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    
    const selectedDateObj = new Date(selectedYear, selectedMonth, selectedDay);
    const todayDateObj = new Date(todayYear, todayMonth, todayDay);
    
    const isToday = selectedYear === todayYear && 
                   selectedMonth === todayMonth && 
                   selectedDay === todayDay;
    
    const isPast = selectedDateObj < todayDateObj;
    if (isPast) return [];
    if (!isToday) return timeSlots;
    
    const now = getMoroccoDate();
    const nowHour = now.getHours();
    const nowMinute = now.getMinutes();
    
    let referenceHour = nowHour;
    let referenceMinute = nowMinute;
    
    if (lastUpdated && lastUpdated instanceof Date && !isNaN(lastUpdated.getTime())) {
      try {
        const moroccoTimeString = lastUpdated.toLocaleString("en-US", {
          timeZone: 'Africa/Casablanca',
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        });
        
        const [_, timePart] = moroccoTimeString.split(", ");
        if (timePart) {
          const [hours, minutes] = timePart.split(":").map(Number);
          if (!isNaN(hours) && !isNaN(minutes)) {
            if (hours > nowHour || (hours === nowHour && minutes >= nowMinute)) {
              referenceHour = hours;
              referenceMinute = minutes;
            }
          }
        }
      } catch (err) {
        console.error('Error converting lastUpdated to Morocco time:', err);
      }
    }
    
    return timeSlots.filter((timeSlot) => {
      const [hours, minutes] = timeSlot.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return true;
      const slotTimeInMinutes = hours * 60 + minutes;
      const referenceTimeInMinutes = referenceHour * 60 + referenceMinute;
      return slotTimeInMinutes > referenceTimeInMinutes;
    });
  }, [timeSlots, bookingData.date, lastUpdated, filterUpdateKey]);

  // Clear selected time if it's in the past
  useEffect(() => {
    if (!bookingData.date || !bookingData.time) return;
    const dateParts = bookingData.date.split('-');
    if (dateParts.length !== 3) return;
    
    const selectedYear = parseInt(dateParts[0], 10);
    const selectedMonth = parseInt(dateParts[1], 10) - 1;
    const selectedDay = parseInt(dateParts[2], 10);
    
    if (isNaN(selectedYear) || isNaN(selectedMonth) || isNaN(selectedDay)) return;
    
    const today = getMoroccoToday();
    const isToday = selectedYear === today.getFullYear() && 
                   selectedMonth === today.getMonth() && 
                   selectedDay === today.getDate();
    
    if (isToday) {
      const now = getMoroccoDate();
      const nowHour = now.getHours();
      const nowMinute = now.getMinutes();
      let referenceHour = nowHour;
      let referenceMinute = nowMinute;
      
      if (lastUpdated) {
        const moroccoTimeString = lastUpdated.toLocaleString("en-US", {
          timeZone: 'Africa/Casablanca',
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        });
        const [_, timePart] = moroccoTimeString.split(", ");
        if (timePart) {
          const [hours, minutes] = timePart.split(":").map(Number);
          if (hours > nowHour || (hours === nowHour && minutes >= nowMinute)) {
            referenceHour = hours;
            referenceMinute = minutes;
          }
        }
      }
      const [selectedHours, selectedMinutes] = bookingData.time.split(':').map(Number);
      if (isNaN(selectedHours) || isNaN(selectedMinutes)) return;
      const isPast = selectedHours < referenceHour || 
                     (selectedHours === referenceHour && selectedMinutes <= referenceMinute);
      if (isPast) {
        setBookingData(prev => ({ ...prev, time: '' }));
      }
    }
  }, [bookingData.date, bookingData.time, lastUpdated, setBookingData]);

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
    if (checkDate < today) return true;
    // Check blocked dates
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (blockedDates.includes(dateStr)) return true;
    return false;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const handleDateSelect = (date: Date) => {
    if (!isDateDisabled(date)) {
      setSelectedDate(date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setBookingData({...bookingData, date: formattedDate});
      setErrors({...errors, date: false});
    }
  };

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  useEffect(() => {
    if (bookingData.date) {
      const dateParts = bookingData.date.split('-');
      if (dateParts.length === 3) {
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const date = new Date(year, month, day);
          setSelectedDate(prevDate => {
            if (!prevDate || !isSameDay(date, prevDate)) return date;
            return prevDate;
          });
          setCurrentMonth(new Date(year, month, 1));
        }
      }
    } else {
      setSelectedDate(null);
    }
  }, [bookingData.date]);

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

  useEffect(() => {
    const totalPrice = getGroupGrandTotal();
    const totalDuration = sumDurations(selectedServices);
    setBookingData((prev: BookingData) => ({
      ...prev,
      totalPrice,
      totalDuration,
    }));
  }, [selectedServices, groupParticipants, includeBooker]);

  // Pre-fill booking data with user info
  useEffect(() => {
    if (isAuthenticated && show) {
      const sourceData = clientProfileData || user;
      if (!sourceData) return;
      
      let firstName = sourceData.firstName || '';
      let lastName = sourceData.lastName || '';
      
      if (!firstName && !lastName && user?.name) {
        const nameParts = user.name.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          firstName = nameParts[0];
        }
      }
      
      const email = sourceData.email || user?.email || '';
      const phone = sourceData.phone || user?.phone || '';
      
      setBookingData((prev: BookingData) => ({
        ...prev,
        firstName: prev.firstName || firstName || '',
        lastName: prev.lastName || lastName || '',
        email: prev.email || email || '',
        phone: prev.phone || phone || ''
      }));
    }
  }, [isAuthenticated, user, clientProfileData, show]);

  useEffect(() => {
    if (bookingStep === 5 && !bookingData.paymentMethod) {
      setBookingData((prev: BookingData) => ({ ...prev, paymentMethod: 'establishment' }));
    }
  }, [bookingStep]);

  // Fetch real employee availability whenever entering Step 3 or when Date/Time changes
  useEffect(() => {
    if (bookingStep !== 3 || !salonId || !bookingData.date) return;

    const bookerServiceIds = selectedServices.map(s => s.id).filter(Boolean) as string[];

    const fetchAvailabilityForPerson = async (
      personKey: string,
      timeSlot: string,
      serviceIds: string[]
    ) => {
      if (!timeSlot || serviceIds.length === 0) return;
      setAvailabilityLoadingMap(prev => ({ ...prev, [personKey]: true }));
      try {
        const res = await api.getEmployeeAvailability(salonId, bookingData.date, timeSlot, serviceIds);
        setEmployeeAvailabilityMap(prev => ({ ...prev, [personKey]: res.employees || [] }));
        setCommonEmployeeIdsPerPerson(prev => ({ ...prev, [personKey]: res.commonEmployeeIds || [] }));
        setServiceEmployeeData(prev => ({ ...prev, [personKey]: (res as any).services || [] }));
      } catch (err) {
        console.error(`Error fetching employee availability for ${personKey}:`, err);
        setEmployeeAvailabilityMap(prev => ({ ...prev, [personKey]: [] }));
      } finally {
        setAvailabilityLoadingMap(prev => ({ ...prev, [personKey]: false }));
      }
    };

    if (includeBooker && bookingData.time) {
      fetchAvailabilityForPerson('booker', bookingData.time, bookerServiceIds);
    }

    groupParticipants.forEach(p => {
      const pDate = p.followsBookerSchedule !== false ? bookingData.date : (p.customDate || bookingData.date);
      const pTime = p.followsBookerSchedule !== false ? bookingData.time : (p.customTime || bookingData.time);
      const pServiceIds = p.sameServicesAsBooker ? bookerServiceIds : p.serviceIds;
      if (pDate && pTime && pServiceIds.length > 0) {
        fetchAvailabilityForPerson(p.id, pTime, pServiceIds);
      }
    });
  }, [bookingStep, salonId, bookingData.date, bookingData.time, selectedServices, groupParticipants, includeBooker]);

  // Auto-uncheck "Même employé" when no employee can perform all selected services
  useEffect(() => {
    if (selectedServices.length < 2 || !sameEmployeeForAll) return;
    const bookerCommon = commonEmployeeIdsPerPerson['booker'];
    if (bookerCommon && bookerCommon.length === 0) {
      setSameEmployeeForAll(false);
    }
  }, [commonEmployeeIdsPerPerson, selectedServices.length, sameEmployeeForAll]);

  const validate = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    
    if (bookingStep === 2) {
      if (!bookingData.date) newErrors.date = true;
      if (!bookingData.time) newErrors.time = true;
    }
    
    if (bookingStep === 4 && shouldShowStep3) {
      if (!(bookingData.firstName || '').trim()) newErrors.firstName = true;
      if (!(bookingData.lastName || '').trim()) newErrors.lastName = true;
      if (!(bookingData.phone || '').trim()) newErrors.phone = true;
      if (
        (bookingData.email || '').trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingData.email || '')
      ) {
        newErrors.email = true;
      }
    }

    if (bookingStep === 5) {
      if (!bookingData.paymentMethod) newErrors.paymentMethod = true;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    setError(null);
    
    if (bookingStep === 1 && selectedServices.length === 0) return;
    if (bookingStep === 1 && !includeBooker && groupParticipants.length === 0) {
      setError('Sélectionnez au moins une personne (Moi ou un proche / invité).');
      return;
    }

    if (bookingStep === 1) {
      setBookingStep(2);
      return;
    }

    if (bookingStep === 2) {
      if (!validate()) return;
      setBookingStep(3);
      return;
    }

    if (bookingStep === 3) {
      const nextStep = shouldShowStep3 ? 4 : 5;
      setBookingStep(nextStep);
      return;
    }

    if (bookingStep === 4) {
      if (!validate()) return;
      setBookingStep(5);
      return;
    }

    // Step 5: Submit booking to backend
    if (bookingStep === 5) {
      if (!salonId) {
        setErrors({ salonId: true });
        setBookingStep(1);
        return;
      }

      const effectivePhoneForSubmission = clientProfileData?.phone || user?.phone || '';
      const userHasAllInfo = isAuthenticated && effectivePhoneForSubmission && effectivePhoneForSubmission.trim() !== '';
      const shouldSkipStep4 = isAuthenticated && userHasAllInfo;
      
      let userFirstName = user?.firstName || '';
      let userLastName = user?.lastName || '';
      
      if (isAuthenticated && user && !userFirstName && !userLastName && user.name) {
        const nameParts = user.name.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          userFirstName = nameParts[0];
          userLastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          userFirstName = nameParts[0];
        }
      }
      
      const finalFirstName = bookingData.firstName?.trim() || (isAuthenticated && user ? userFirstName : '');
      const finalLastName = bookingData.lastName?.trim() || (isAuthenticated && user ? userLastName : '');
      const finalEmail = bookingData.email?.trim() || (isAuthenticated && user?.email ? user.email : '');
      const finalPhone = bookingData.phone?.trim() || (isAuthenticated && user?.phone ? user.phone : '');

      if (!finalFirstName || !finalLastName || !finalPhone) {
        const missingFields = [];
        if (!finalFirstName) missingFields.push('Prénom');
        if (!finalLastName) missingFields.push('Nom');
        if (!finalPhone) missingFields.push('Téléphone');
        
        setError(`Veuillez remplir tous les champs obligatoires : ${missingFields.join(', ')}`);
        if (shouldShowStep3) {
          setBookingStep(4);
        }
        return;
      }

      if (finalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
        setError('Veuillez entrer une adresse email valide');
        return;
      }

      const invalidGuest = groupParticipants.find((p) => !p.name.trim());
      if (invalidGuest) {
        setError('Veuillez indiquer le prénom de chaque personne ajoutée.');
        setBookingStep(1);
        return;
      }

      if (!includeBooker && groupParticipants.length === 0) {
        setError('Sélectionnez au moins une personne (Moi ou un proche / invité).');
        setBookingStep(1);
        return;
      }

      setIsLoading(true);
      try {
        const bookerServiceIds = selectedServices.map(s => s.id).filter(Boolean) as string[];
        if (includeBooker && bookerServiceIds.length === 0) {
          throw new Error('Aucun service sélectionné pour le réservant');
        }

        if (!bookingData.date || !bookingData.time) {
          throw new Error('Veuillez sélectionner une date et une heure');
        }

        const startDateTime = createDateFromMoroccoDateTime(bookingData.date, bookingData.time);

        // Compute per-service employees for the booker
        const bookerServiceEmployees = !sameEmployeeForAll && selectedServices.length > 1 && perServiceEmployeeMap['booker']
          ? selectedServices.map(s => ({
              serviceId: s.id || s.name,
              employeeId: (perServiceEmployeeMap['booker'] || {})[s.id || s.name] &&
                (perServiceEmployeeMap['booker'] || {})[s.id || s.name] !== 'any'
                ? (perServiceEmployeeMap['booker'] || {})[s.id || s.name] : null,
            }))
          : undefined;

        const bookingResponse = await api.createBooking({
          tenantId: salonId,
          firstName: finalFirstName.trim(),
          lastName: finalLastName.trim(),
          email: finalEmail.trim() || undefined,
          phone: finalPhone.trim(),
          serviceIds: bookerServiceIds,
          startTime: startDateTime.toISOString(),
          employeeId: selectedTeamMemberId === 'any' ? null : selectedTeamMemberId,
          ...(bookerServiceEmployees ? { serviceEmployees: bookerServiceEmployees } : {}),
          notes: bookingData.notes,
          includeBooker,
          participants: groupParticipants.map((p) => {
            const pDate = p.followsBookerSchedule !== false ? bookingData.date : (p.customDate || bookingData.date);
            const pTime = p.followsBookerSchedule !== false ? bookingData.time : (p.customTime || bookingData.time);
            const pServices = p.sameServicesAsBooker ? selectedServices : flatServices.filter((s) => p.serviceIds.includes((s.id || s.name) as string));
            const pServiceEmployees = !sameEmployeeForAll && pServices.length > 1 && perServiceEmployeeMap[p.id]
              ? pServices.map(s => ({
                  serviceId: s.id || s.name,
                  employeeId: (perServiceEmployeeMap[p.id] || {})[s.id || s.name] &&
                    (perServiceEmployeeMap[p.id] || {})[s.id || s.name] !== 'any'
                    ? (perServiceEmployeeMap[p.id] || {})[s.id || s.name] : null,
                }))
              : undefined;
            const pStart = createDateFromMoroccoDateTime(pDate, pTime);
            return {
              name: p.name.trim(),
              sameServicesAsBooker: p.sameServicesAsBooker,
              serviceIds: p.sameServicesAsBooker ? undefined : p.serviceIds,
              employeeId: !p.employeeId || p.employeeId === 'any' ? null : p.employeeId,
              ...(pServiceEmployees ? { serviceEmployees: pServiceEmployees } : {}),
              startTime: pStart.toISOString(),
            };
          }),
        });

        const refNum = bookingResponse.appointments?.[0]?.id
          ? `REF${bookingResponse.appointments[0].id.slice(-9).toUpperCase()}`
          : bookingResponse.bookingGroup?.id
          ? `REF${bookingResponse.bookingGroup.id.slice(-9).toUpperCase()}`
          : `REF${Date.now().toString(36).toUpperCase().slice(-9)}`;
        setReferenceNumber(refNum);

        const pricingParticipants = (bookingResponse.pricing?.participants || []).map((p: any) => ({
          name: p.displayName as string,
          subtotal: p.subtotal as number,
          services: flatServices.filter((s) => p.serviceIds?.includes(s.id)),
        }));
        setReceiptSummary({
          participants: pricingParticipants,
          grandTotal: bookingResponse.pricing?.grandTotal ?? getTotalPrice(),
        });

        setIsLoading(false);
        setShowReceipt(true);
      } catch (err: any) {
        console.error('Booking error:', err);
        setIsLoading(false);
        setErrors({ booking: true });
        
        const errorMessage = err.message || '';
        if (errorMessage.includes('Online booking closed') || 
            errorMessage.includes('réservations disabled') ||
            errorMessage.includes('fermée')) {
          setError('La prise de rendez-vous en ligne est actuellement fermée. Veuillez contacter l\'établissement directement.');
        } else {
          setError(errorMessage || 'Erreur lors de la réservation. Veuillez réessayer.');
        }
      }
    }
  };

  if (!show) return null;

  if (isLoading) {
    return <Loading />;
  }

  if (showReceipt) {
    return (
      <Receipt
        bookingData={bookingData}
        selectedServices={selectedServices}
        receiptSummary={receiptSummary}
        onClose={() => {
          setShowReceipt(false);
          setIsLoading(true);
          setTimeout(() => {
            setIsLoading(false);
            onClose();
            setSelectedServices([]);
            setGroupParticipants([]);
            setReceiptSummary(null);
            setBookingStep(1);
            setBookingData({
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              date: '',
              time: '',
              notes: '',
              totalPrice: 0,
              totalDuration: '',
              paymentMethod: undefined,
              cardNumber: '',
              cardName: '',
              cardExpiry: '',
              cardCVV: '',
            });
            setErrors({});
            setError(null);
            setReferenceNumber(null);
            if (isAuthenticated) {
              router.push('/account');
            }
          }, 1200);
        }}
        referenceNumber={referenceNumber || undefined}
        salonName={salonData?.name}
        clientName={`${bookingData.firstName} ${bookingData.lastName}`}
        salonAddress={salonData?.address}
        salonCity={salonData?.city}
        salonPhone={salonData?.phone}
        salonIce={salonData?.ice}
        salonRc={salonData?.rc}
        salonIf={salonData?.if}
      />
    );
  }

  // Helper: get total duration in minutes for a set of services
  const getDurationMinutes = (svcList: Service[]): number => {
    return svcList.reduce((sum, s) => {
      const d = s.duration.trim();
      let m = 0;
      const h = d.match(/(\d+)\s*h/);
      const mn = d.match(/(\d+)\s*min/);
      if (h) m += parseInt(h[1], 10) * 60;
      if (mn) m += parseInt(mn[1], 10);
      if (!h && !mn && /^\d+$/.test(d)) m += parseInt(d, 10);
      return sum + m;
    }, 0);
  };

  // ─── Conflict resolution handler ──────────────────────────────
  // Called after every employee selection change.
  // Preserves the user's latest choice, reassigns others via backend.
  const handleEmployeeSelection = async (
    personKey: string,
    employeeIdVal: string,
    immediateUpdate: () => void,
  ) => {
    // Guard: ignore if triggered by applying resolved state (not user interaction)
    if (applyingResolvedStateRef.current) return;

    // 1. Apply the user's selection immediately
    immediateUpdate();
    setConflictMessage(null);

    // 2. Resolve cross-participant conflicts via backend
    if (!bookingData.time || !salonId) return;

    // 3. Build the participants array for the backend
    const bookerServiceIds = selectedServices.map((s) => s.id).filter(Boolean) as string[];
    const bookerDuration = getDurationMinutes(selectedServices);

    // Determine which participant index just changed
    const changedIndex = personKey === 'booker' ? 0 : groupParticipants.findIndex((p) => p.id === personKey) + 1;
    // null means "N'importe qui" → backend resolves. Never send the string "any".
    const selectedEmpId = employeeIdVal === 'any' ? null : employeeIdVal;

    const participants: Array<{
      index: number;
      serviceIds: string[];
      startTime: string;
      duration: number;
      currentEmployeeId: string | null;
    }> = [];

    if (includeBooker) {
      const currentEmp = selectedTeamMemberId === 'any' ? null : selectedTeamMemberId;
      participants.push({
        index: 0,
        serviceIds: bookerServiceIds,
        startTime: bookingData.time,
        duration: bookerDuration,
        currentEmployeeId: currentEmp,
      });
    }

    groupParticipants.forEach((p, i) => {
      const idx = i + 1;
      participants.push({
        index: idx,
        serviceIds: p.sameServicesAsBooker
          ? bookerServiceIds
          : p.serviceIds.filter(Boolean),
        startTime: p.customTime || bookingData.time,
        duration: getDurationMinutes(
          p.sameServicesAsBooker
            ? selectedServices
            : flatServices.filter((s) => p.serviceIds.includes((s.id || s.name) as string)),
        ),
        currentEmployeeId: p.employeeId && p.employeeId !== 'any' ? p.employeeId : null,
      });
    });

    if (participants.length < 2) return; // no conflict possible with 1 participant

        setResolvingEmployees(true);
    const thisCall = ++resolveCounterRef.current;
    try {
      const result = await api.resolveConflicts(
        salonId,
        bookingData.date || '',
        changedIndex,
        selectedEmpId,
        participants,
      );
      if (thisCall !== resolveCounterRef.current) return; // stale, newer request in flight

      if (result.resolved && result.assignments) {
        // Check if any auto-assignments were made   (excluding the one just changed)
        const autoCount = result.assignments.filter(
          (a) => a.autoAssigned && a.employeeId !== employeeIdVal,
        ).length;
        if (autoCount > 0) {
          setToastMessage(
            'Les collaborateurs ont été réaffectés automatiquement afin d\'éviter un conflit.',
          );
          setTimeout(() => setToastMessage(null), 4000);
        }

        // Mark that we're about to apply resolved state,
        // so spurious onChange events during the re-render are dropped.
        applyingResolvedStateRef.current = true;

        // Apply resolved assignments
        try {
          for (const a of result.assignments) {
            // Resolve the participant and their services
            const participant = a.index === 0 ? null : groupParticipants[a.index - 1];
            const personKey = a.index === 0 ? 'booker' : participant?.id;
            const ownSvcIds = participant?.serviceIds || [];
            const pServices = a.index === 0
              ? selectedServices
              : participant?.sameServicesAsBooker
                ? selectedServices
                : ownSvcIds.length > 0
                  ? flatServices.filter((s) =>
                      ownSvcIds.includes((s.id || s.name) as string),
                    )
                  : [];

            // Write to the participant's employee slot
            if (a.index === 0) {
              if (a.employeeId !== selectedTeamMemberId) {
                setSelectedTeamMemberId(a.employeeId);
              }
            } else {
              const pIdx = a.index - 1;
              setGroupParticipants((prev) =>
                prev.map((item, i) =>
                  i === pIdx && item.employeeId !== a.employeeId
                    ? { ...item, employeeId: a.employeeId }
                    : item,
                ),
              );
            }

            // Always write the resolver's assignment into perServiceEmployeeMap
            // for every service of this participant, so per-service dropdowns
            // reflect the resolved state (not a stale per-service override).
            if (personKey && pServices.length > 0) {
              setPerServiceEmployeeMap((prev) => ({
                ...prev,
                [personKey]: Object.fromEntries(
                  pServices.map((s) => [s.id || s.name, a.employeeId]),
                ),
              }));
            }
          }
        } finally {
          // Clear guard after React has committed the re-render
          setTimeout(() => {
            applyingResolvedStateRef.current = false;
          }, 0);
        }
      } else if (result.conflict) {
        setConflictMessage(
          result.message ||
            'Aucun collaborateur disponible pour satisfaire toutes les contraintes.',
        );
        setTimeout(() => setConflictMessage(null), 6000);
      }
    } catch (err) {
      console.error('Conflict resolution error:', err);
    } finally {
      // Only clear resolving after ALL state updates above have been applied
      setResolvingEmployees(false);
    }
  };

  // Per-service employee dropdown pickers (when "Même employé" is unchecked)
  const renderPerServicePickers = (
    personKey: string,
    timeSlot: string,
    svcs: Service[],
    currentSelectedId: string,
    onSingleSelect: (empId: string) => void
  ) => {
    const availabilities = employeeAvailabilityMap[personKey] || [];
    const loadingAvail = availabilityLoadingMap[personKey] || false;
    const personServices = serviceEmployeeData[personKey] || [];
    const personPerService = perServiceEmployeeMap[personKey] || {};

    const setPersonService = (serviceId: string, empIdVal: string) => {
      setPerServiceEmployeeMap(prev => ({
        ...prev,
        [personKey]: { ...(prev[personKey] || {}), [serviceId]: empIdVal },
      }));
    };

    if (loadingAvail) {
      return (
        <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-xl animate-pulse">
          Vérification des disponibilités...
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {svcs.map((svc) => {
          const svcId = svc.id || svc.name;
          const svcAvail = personServices.find((s: any) => s.serviceId === svcId)?.employees || availabilities;
          const selectedEmp = personPerService[svcId] || currentSelectedId;
          return (
            <div key={svcId} className="p-3 bg-gray-50 rounded-xl space-y-2">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">
                  {svcs.indexOf(svc) + 1}
                </span>
                {svc.name}
                <span className="font-normal text-gray-400">({svc.duration} min)</span>
              </label>
              <select
                value={selectedEmp}
                onChange={(e) => {
                  // Guard: drop spurious onChange from post-resolve re-render
                  if (applyingResolvedStateRef.current) return;

                  const val = e.target.value;

                  setPersonService(svcId, val);
                  onSingleSelect(val);
                }}
                className="w-full p-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-black"
              >
                <option value="any">N'importe qui</option>
                {svcAvail.map((emp: any) => {
                  const isAvail = emp.available !== false;
                  const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || emp.id;
                  return (
                    <option key={emp.id} value={emp.id} disabled={!isAvail}>
                      {fullName}{isAvail ? '' : ' — Indisponible'}
                    </option>
                  );
                })}
              </select>
              {selectedEmp !== 'any' && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Affecté à ce service
                </div>
              )}
            </div>
          );
        })}
        {/* No common employee informational message */}
        {commonEmployeeIdsPerPerson[personKey]?.length === 0 && svcs.length > 1 && (
          <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl">
            Aucun collaborateur ne peut réaliser toutes les prestations sélectionnées.
            Veuillez choisir un collaborateur pour chaque prestation.
          </p>
        )}
      </div>
    );
  };

  // Render Employee Selection Cards Component for a specific person
  const renderEmployeeCards = (
    personKey: string,
    currentSelectedId: string,
    onSelect: (empId: string) => void,
    employeeIdFilter?: string[]
  ) => {
    const availabilities = employeeAvailabilityMap[personKey] || [];
    const loadingAvail = availabilityLoadingMap[personKey] || false;

    // Filter employees from props or availability
    const allEmployeesList = employees.length > 0
      ? employees
      : availabilities.map(a => ({ id: a.id, firstName: a.firstName, lastName: a.lastName, role: '', avatar: undefined }));

    const filteredList = employeeIdFilter && employeeIdFilter.length > 0
      ? allEmployeesList.filter(emp => employeeIdFilter.includes(emp.id))
      : allEmployeesList;

    const anyAvailable = availabilities.some(a => a.available);

    // ---- Cross-participant conflict prevention ----
    // Build set of employee IDs already selected by OTHER participants whose time window overlaps
    const blockedByOthers = new Map<string, string>(); // employeeId -> participantName
    const bookerStart = bookingData.time;
    const bookerTotalMinutes = getDurationMinutes(selectedServices);
    const parseMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    const getOverlap = (t1: string, t2: string) => {
      // Two time ranges [t1, t1+dur1) and [t2, t2+dur2) overlap
      // Simple: same start time = same duration = full overlap
      // Different start times: check if intervals intersect
      const s1 = parseMin(t1), s2 = parseMin(t2);
      const e1 = s1 + (personKey === 'booker' ? bookerTotalMinutes : parseMin(bookingData.time) + bookerTotalMinutes - parseMin(bookingData.time));
      // Use booker duration as reference for simplicity
      const dur = bookerTotalMinutes;
      const e2 = s2 + dur;
      return s1 < e2 && e1 > s2;
    };

    // Get this person's start time
    const thisPersonTime = personKey === 'booker'
      ? bookingData.time
      : (groupParticipants.find(p => p.id === personKey)?.customTime || bookingData.time);

    // Check booker's selection against this person
    if (personKey !== 'booker' && includeBooker && selectedTeamMemberId && selectedTeamMemberId !== 'any' && bookingData.time && thisPersonTime) {
      if (getOverlap(thisPersonTime, bookingData.time)) {
        blockedByOthers.set(selectedTeamMemberId, 'vous');
      }
    }

    // Check other participants' selections against this person
    for (const otherP of groupParticipants) {
      if (otherP.id === personKey) continue;
      if (!otherP.employeeId || otherP.employeeId === 'any') continue;
      const otherTime = otherP.customTime || bookingData.time;
      if (thisPersonTime && otherTime && getOverlap(thisPersonTime, otherTime)) {
        blockedByOthers.set(otherP.employeeId, otherP.name);
      }
    }
    // ---- end cross-participant ----

    return (
      <div className="space-y-3">
        {loadingAvail ? (
          <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-xl animate-pulse">
            Vérification des disponibilités...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Anyone / N'importe qui Option */}
            <div
              onClick={() => onSelect('any')}
              className={`p-4 border-2 rounded-2xl cursor-pointer transition-all flex items-center justify-between ${
                currentSelectedId === 'any'
                  ? 'border-black bg-black/5 shadow-sm'
                  : 'border-gray-100 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">N'importe qui</h4>
                  <p className="text-xs text-gray-500">Maximum de disponibilité</p>
                </div>
              </div>
              {currentSelectedId === 'any' && (
                <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </div>
              )}
            </div>

            {/* Individual Employee Cards */}
            {filteredList.map(emp => {
              const avail = availabilities.find(a => a.id === emp.id);
              let isAvailable = avail ? avail.available : true;
              const reason = avail?.reason;
              const isRecommended = avail?.recommended;

              // Cross-participant conflict: blocked by another participant
              const blockedByName = blockedByOthers.get(emp.id) || blockedByOthers.get(emp.id);
              const isBlocked = blockedByOthers.has(emp.id);
              if (isBlocked) isAvailable = false;

              let statusLabel = 'Disponible';
              let statusStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              let statusIcon = null;

              if (isBlocked) {
                statusLabel = `Déjà choisi par ${blockedByOthers.get(emp.id)}`;
                statusStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                statusIcon = <AlertTriangle className="w-3 h-3 inline mr-1" />;
              } else if (!isAvailable) {
                statusStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                statusIcon = <AlertTriangle className="w-3 h-3 inline mr-1" />;
                if (reason === 'BREAK') statusLabel = 'En pause';
                else if (reason === 'BOOKED') statusLabel = 'Déjà réservé';
                else if (reason === 'OUTSIDE_HOURS') statusLabel = 'En dehors des horaires';
                else if (reason === 'INACTIF') statusLabel = 'Employé inactif';
                else if (reason === 'VACATION') statusLabel = 'En vacances';
                else statusLabel = 'Indisponible';
              } else if (isRecommended) {
                statusLabel = 'Recommandé';
                statusStyle = 'bg-blue-50 text-blue-700 border-blue-200';
              }

              const fullName = `${emp.firstName} ${emp.lastName}`.trim();
              const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase();
              const isSelected = currentSelectedId === emp.id;
              return (
                <div
                  key={emp.id}
                  onClick={() => onSelect(emp.id)}
                  className={`p-4 border-2 rounded-2xl transition-all flex items-center justify-between cursor-pointer hover:border-gray-300 ${
                    isSelected
                      ? 'border-black bg-black/5 shadow-sm'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {emp.avatar ? (
                      <img src={emp.avatar} alt={fullName} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-800 flex items-center justify-center font-bold text-xs">
                        {initials}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{fullName}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${statusStyle}`}>
                          {statusIcon}{statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .page-content {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
      
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
          
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {bookingStep === 1 && 'Prestations & Groupe'}
                {bookingStep === 2 && 'Date & Créneau'}
                {bookingStep === 3 && 'Choix du professionnel'}
                {bookingStep === 4 && 'Vos coordonnées'}
                {bookingStep === 5 && 'Paiement & Confirmation'}
              </h2>
              <p className="text-xs text-gray-500 mt-1">Étape {displayStep} sur {totalSteps}</p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Progress Dots */}
          <div className="px-6 pt-3 flex gap-1.5 justify-center">
            {visibleSteps.map((stepNum, idx) => (
              <div
                key={stepNum}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  bookingStep === stepNum
                    ? 'w-8 bg-black'
                    : visibleSteps.indexOf(bookingStep) > idx
                    ? 'w-4 bg-gray-400'
                    : 'w-4 bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Global Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Scrollable Modal Content */}
          <div className="p-6 overflow-y-auto flex-1 page-content space-y-6">
            
            {/* STEP 1: Prestations & Groupe */}
            {bookingStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-gray-900 text-base mb-3">Services sélectionnés</h3>
                  <div className="space-y-2">
                    {selectedServices.map((service, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-gray-900">{service.name}</h4>
                          <p className="text-xs text-gray-500">{service.duration} • {service.price} MAD</p>
                        </div>
                        <button
                          onClick={() => {
                            const newServices = selectedServices.filter((_, i) => i !== index);
                            setSelectedServices(newServices);
                          }}
                          className="text-xs text-rose-600 hover:underline font-medium"
                        >
                          Supprimer
                        </button>
                      </div>
                    ))}
                  </div>

                  {onAddService && (
                    <button
                      onClick={() => setShowAddServiceModal(true)}
                      className="mt-3 w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-xs font-bold text-gray-700 hover:border-black transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Ajouter une prestation
                    </button>
                  )}
                </div>

                <GroupParticipantsSection
                  participants={groupParticipants}
                  onChange={setGroupParticipants}
                  includeBooker={includeBooker}
                  onIncludeBookerChange={setIncludeBooker}
                  bookerTotal={getTotalPrice()}
                  allServices={flatServices}
                  getServicesTotal={getServicesTotal}
                  familyMembers={familyMembers}
                  familyLoading={familyLoading}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            )}

            {/* STEP 2: Date & Créneau */}
            {bookingStep === 2 && (
              <div className="space-y-6">
                {/* Date Picker */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-gray-700" />
                      Sélectionner une date
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const prev = new Date(currentMonth);
                          prev.setMonth(prev.getMonth() - 1);
                          setCurrentMonth(prev);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"
                      >
                        ←
                      </button>
                      <span className="text-sm font-bold text-gray-900 min-w-[120px] text-center">
                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                      </span>
                      <button
                        onClick={() => {
                          const next = new Date(currentMonth);
                          next.setMonth(next.getMonth() + 1);
                          setCurrentMonth(next);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400 mb-2">
                    {dayNames.map(d => <div key={d} className="py-1">{d}</div>)}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: daysInMonth(currentMonth).firstDay }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth(currentMonth).days }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNum);
                      const isBlocked = blockedDates.includes(
                        `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                      );
                      const disabled = isDateDisabled(dateObj);
                      const isSelected = selectedDate && isSameDay(dateObj, selectedDate);

                      return (
                        <button
                          key={dayNum}
                          onClick={() => handleDateSelect(dateObj)}
                          disabled={disabled}
                          title={isBlocked ? 'Fermé' : undefined}
                          className={`py-3 rounded-2xl text-sm font-bold transition-all relative ${
                            isSelected
                              ? 'bg-black text-white shadow-md'
                              : disabled
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'hover:bg-gray-100 text-gray-800'
                          }`}
                        >
                          <span>{dayNum}</span>
                          {isBlocked && (
                            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] text-gray-400 font-normal">
                              Fermé
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Main Booker Time Slot Selection */}
                {selectedDate && (
                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                      <Clock className="w-5 h-5 text-gray-700" />
                      Créneau horaire principal
                    </h3>

                    {slotsLoading ? (
                      <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 rounded-2xl animate-pulse">
                        Chargement des créneaux disponibles...
                      </div>
                    ) : filteredTimeSlots.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm">
                        Aucun créneau disponible pour cette date. Veuillez choisir une autre date.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {filteredTimeSlots.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => {
                              setBookingData(prev => ({ ...prev, time: slot }));
                              setErrors(prev => ({ ...prev, time: false }));
                            }}
                            className={`py-3 px-2 rounded-2xl text-xs font-bold transition-all border ${
                              bookingData.time === slot
                                ? 'bg-black text-white border-black shadow-md'
                                : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Per-Participant Schedule Overrides */}
                {groupParticipants.length > 0 && selectedDate && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h4 className="font-bold text-sm text-gray-900">Participants</h4>
                    {groupParticipants.map((p) => {
                      const isLinked = p.followsBookerSchedule !== false;
                      return (
                        <div key={p.id} className="p-4 bg-gray-50 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-gray-800">{p.name}</span>
                          </div>

                          {/* Même créneau que moi checkbox */}
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isLinked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setGroupParticipants(prev =>
                                  prev.map(item =>
                                    item.id === p.id
                                      ? {
                                          ...item,
                                          followsBookerSchedule: checked,
                                          customTime: checked ? undefined : (item.customTime || bookingData.time),
                                          customDate: checked ? undefined : (item.customDate || bookingData.date),
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="rounded border-gray-300"
                            />
                            Même créneau que moi
                          </label>

                          {isLinked ? (
                            /* Synchronized: show mirrored info */
                            <div className="text-xs text-gray-500 space-y-1">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {bookingData.date || '—'} à {bookingData.time || '—'}
                              </span>
                            </div>
                          ) : (
                            /* Independent: show date + time pickers */
                            <div className="space-y-3 pt-1">
                              {/* Date input */}
                              <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">
                                  Date
                                </label>
                                <input
                                  type="date"
                                  value={p.customDate || bookingData.date || ''}
                                  min={getMoroccoToday().toISOString().slice(0, 10)}
                                  onChange={(e) => {
                                    setGroupParticipants(prev =>
                                      prev.map(item =>
                                        item.id === p.id ? { ...item, customDate: e.target.value } : item
                                      )
                                    );
                                  }}
                                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-black bg-white"
                                />
                              </div>
                              {/* Time slots */}
                              <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">
                                  Horaire
                                </label>
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                                  {filteredTimeSlots.map((slot) => {
                                    const isSelected = (p.customTime || bookingData.time) === slot;
                                    return (
                                      <button
                                        key={slot}
                                        onClick={() => {
                                          setGroupParticipants(prev =>
                                            prev.map(item =>
                                              item.id === p.id ? { ...item, customTime: slot } : item
                                            )
                                          );
                                        }}
                                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                                          isSelected
                                            ? 'bg-black text-white border-black'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                                        }`}
                                      >
                                        {slot}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Choix du professionnel */}
            {bookingStep === 3 && (
              <div className="space-y-6">
                {/* "Même employé pour tous les services" toggle — only for multi-service */}
                {selectedServices.length > 1 && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <div
                        onClick={() => {
                          const newVal = !sameEmployeeForAll;
                          setSameEmployeeForAll(newVal);
                          if (newVal) {
                            setPerServiceEmployeeMap({});
                          }
                        }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                          sameEmployeeForAll ? 'bg-black border-black' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {sameEmployeeForAll && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        Même employé pour tous les services
                      </span>
                    </div>
                    {!sameEmployeeForAll && commonEmployeeIdsPerPerson['booker']?.length === 0 && (
                      <span className="text-[11px] text-amber-700 text-right max-w-[200px]">
                        Aucun collaborateur ne peut réaliser toutes les prestations sélectionnées.
                      </span>
                    )}
                  </div>
                )}

                {/* Auto-reassignment toast */}
                {toastMessage && (
                  <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    {toastMessage}
                  </div>
                )}

                {/* Conflict message */}
                {conflictMessage && (
                  <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center text-[10px] font-bold shrink-0">!</span>
                    {conflictMessage}
                  </div>
                )}

                {/* Employee selection content with resolving overlay */}
                <div className="relative">
                  {resolvingEmployees && (
                    <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center pointer-events-none" style={{ minHeight: '200px' }}>
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/90 rounded-xl shadow-sm border border-gray-100">
                        <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                        <span className="text-sm text-gray-600">Réaffectation en cours...</span>
                      </div>
                    </div>
                  )}

                  {/* Booker Professional Selection */}
                  {includeBooker && (
                    <div className="space-y-3">
                    <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                      <User className="w-5 h-5 text-gray-700" />
                      Professionnel pour vous
                    </h3>
                    {sameEmployeeForAll || selectedServices.length <= 1 ? (
                      renderEmployeeCards('booker', selectedTeamMemberId, (empId) => {
                        handleEmployeeSelection('booker', empId, () => setSelectedTeamMemberId(empId));
                      },
                        sameEmployeeForAll && selectedServices.length > 1 ? commonEmployeeIdsPerPerson['booker'] : undefined
                      )
                    ) : (
                      renderPerServicePickers('booker', bookingData.time || '', selectedServices, selectedTeamMemberId, (empId) => {
                        handleEmployeeSelection('booker', empId, () => setSelectedTeamMemberId(empId));
                      })
                    )}
                  </div>
                )}

                {/* Per-Participant Professional Selection */}
                {groupParticipants.map((p) => {
                  const pServices = p.sameServicesAsBooker ? selectedServices : flatServices.filter((s) => p.serviceIds.includes((s.id || s.name) as string));
                  return (
                    <div key={p.id} className="space-y-3 pt-4 border-t border-gray-100">
                      <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-700" />
                        Professionnel pour {p.name}
                      </h3>
                      {sameEmployeeForAll || pServices.length <= 1 ? (
                        renderEmployeeCards(
                          p.id,
                          p.employeeId || 'any',
                          (empId) => {
                            handleEmployeeSelection(p.id, empId, () => {
                              setGroupParticipants(prev =>
                                prev.map(item =>
                                  item.id === p.id ? { ...item, employeeId: empId } : item
                                )
                              );
                            });
                          },
                          sameEmployeeForAll && pServices.length > 1 ? commonEmployeeIdsPerPerson[p.id] : undefined
                        )
                      ) : (
                        renderPerServicePickers(
                          p.id,
                          (p.customTime || bookingData.time),
                          pServices,
                          p.employeeId || 'any',
                          (empId) => {
                            handleEmployeeSelection(p.id, empId, () => {
                              setGroupParticipants(prev =>
                                prev.map(item =>
                                  item.id === p.id ? { ...item, employeeId: empId } : item
                                )
                              );
                            });
                          }
                        )
                      )}
                    </div>
                  );
                })}
                </div>{/* end overlay wrapper */}
              </div>
            )}

            {/* STEP 4: Coordonnées (Contact Info) */}
            {bookingStep === 4 && (
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 text-base">Vos informations personnelles</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Prénom *</label>
                    <input
                      type="text"
                      value={bookingData.firstName}
                      onChange={(e) => setBookingData({ ...bookingData, firstName: e.target.value })}
                      className={`w-full p-3 rounded-2xl border ${
                        errors.firstName ? 'border-rose-500' : 'border-gray-200'
                      } text-sm focus:outline-none focus:border-black`}
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom *</label>
                    <input
                      type="text"
                      value={bookingData.lastName}
                      onChange={(e) => setBookingData({ ...bookingData, lastName: e.target.value })}
                      className={`w-full p-3 rounded-2xl border ${
                        errors.lastName ? 'border-rose-500' : 'border-gray-200'
                      } text-sm focus:outline-none focus:border-black`}
                      placeholder="Nom"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone *</label>
                  <input
                    type="tel"
                    value={bookingData.phone}
                    onChange={(e) => setBookingData({ ...bookingData, phone: e.target.value })}
                    className={`w-full p-3 rounded-2xl border ${
                      errors.phone ? 'border-rose-500' : 'border-gray-200'
                    } text-sm focus:outline-none focus:border-black`}
                    placeholder="0612345678"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email (optionnel)</label>
                  <input
                    type="email"
                    value={bookingData.email}
                    onChange={(e) => setBookingData({ ...bookingData, email: e.target.value })}
                    className={`w-full p-3 rounded-2xl border ${
                      errors.email ? 'border-rose-500' : 'border-gray-200'
                    } text-sm focus:outline-none focus:border-black`}
                    placeholder="exemple@email.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Notes / Instructions particulières</label>
                  <textarea
                    value={bookingData.notes}
                    onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                    rows={3}
                    className="w-full p-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-black"
                    placeholder="Allergies, préférences..."
                  />
                </div>
              </div>
            )}

            {/* STEP 5: Paiement & Confirmation */}
            {bookingStep === 5 && (
              <div className="space-y-6">
                <h4 className="font-bold text-sm text-gray-900">Récapitulatif de la réservation</h4>

                {/* Booker Section */}
                {includeBooker && (
                  <RecapParticipantSection
                    name={`${bookingData.firstName || 'Vous'} ${bookingData.lastName || ''}`.trim() || 'Vous'}
                    isPrincipal
                    date={bookingData.date}
                    time={bookingData.time}
                    services={selectedServices}
                    employeeId={selectedTeamMemberId === 'any' ? null : selectedTeamMemberId}
                    employees={employees}
                    totalDuration={bookingData.totalDuration}
                    subtotal={getTotalPrice()}
                  />
                )}

                {/* Participant Sections */}
                {groupParticipants.map((p) => {
                  const pServices = p.sameServicesAsBooker
                    ? selectedServices
                    : flatServices.filter((s) => p.serviceIds.includes((s.id || s.name) as string));
                  const pDuration = p.sameServicesAsBooker
                    ? bookingData.totalDuration
                    : sumDurations(pServices);
                  const pSubtotal = p.sameServicesAsBooker
                    ? getTotalPrice()
                    : getServicesTotal(p.serviceIds);
                  const pDate = p.followsBookerSchedule !== false ? bookingData.date : (p.customDate || bookingData.date);
                  const pTime = p.followsBookerSchedule !== false ? bookingData.time : (p.customTime || bookingData.time);
                  return (
                    <RecapParticipantSection
                      key={p.id}
                      name={p.name || 'Invité'}
                      isPrincipal={false}
                      date={pDate}
                      time={pTime}
                      services={pServices}
                      employeeId={!p.employeeId || p.employeeId === 'any' ? null : p.employeeId}
                      employees={employees}
                      totalDuration={pDuration}
                      subtotal={pSubtotal}
                      followsBooker={p.followsBookerSchedule !== false}
                    />
                  );
                })}

                {/* Grand Total */}
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <div className="flex justify-between items-center text-sm font-bold text-gray-900">
                    <span>TOTAL</span>
                    <span>{getGroupGrandTotal()} MAD</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-gray-900">Mode de paiement</h4>
                  <div
                    onClick={() => setBookingData({ ...bookingData, paymentMethod: 'establishment' })}
                    className="p-4 border-2 border-black bg-black/5 rounded-2xl flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Store className="w-5 h-5 text-gray-900" />
                      <div>
                        <h5 className="font-bold text-sm text-gray-900">Paiement sur place</h5>
                        <p className="text-xs text-gray-500">Réglez directement le jour de votre rendez-vous</p>
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Modal Footer Controls */}
          <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-between sticky bottom-0">
            {bookingStep > 1 ? (
              <button
                onClick={() => {
                  setError(null);
                  if (bookingStep === 5) {
                    setBookingStep(shouldShowStep3 ? 4 : 3);
                  } else {
                    setBookingStep(bookingStep - 1);
                  }
                }}
                className="px-6 py-3 rounded-2xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Retour
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={handleContinue}
              className="px-8 py-3 rounded-2xl text-xs font-bold text-white bg-black hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-lg"
            >
              {bookingStep === 5 ? 'Confirmer la réservation' : 'Continuer'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {showAddServiceModal && (
        <AddServiceModal
          onClose={() => setShowAddServiceModal(false)}
          salonServices={salonServices}
          selectedServices={selectedServices}
          onSelectServices={(services: Service[]) => setSelectedServices(services)}
        />
      )}
    </>
  );
};

// ─── Recap Participant Section ────────────────────────────────────

function getEmployeeName(empId: string | null | undefined, employees: Employee[]): string {
  if (!empId) return 'À déterminer';
  const emp = employees.find((e) => e.id === empId);
  return emp ? `${emp.firstName} ${emp.lastName}`.trim() : empId;
}

function RecapParticipantSection({
  name,
  isPrincipal,
  date,
  time,
  services,
  employeeId,
  employees,
  totalDuration,
  subtotal,
  followsBooker,
}: {
  name: string;
  isPrincipal: boolean;
  date: string;
  time: string;
  services: Service[];
  employeeId: string | null;
  employees: Employee[];
  totalDuration: string;
  subtotal: number;
  followsBooker?: boolean;
}) {
  const empName = getEmployeeName(employeeId, employees);

  return (
    <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-gray-900">{name}</span>
          {isPrincipal && (
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
              Principal
            </span>
          )}
        </div>
        {followsBooker && !isPrincipal && (
          <span className="text-[11px] text-gray-400 italic">Suit le créneau principal</span>
        )}
      </div>

      <div className="text-xs text-gray-600 space-y-1">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-gray-400" />
          <span>{date} à {time || '—'}</span>
        </div>
      </div>

      <div className="space-y-2">
        {services.map((svc, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-900 font-medium">{svc.name}</span>
              {employeeId && (
                <span className="text-gray-500 ml-1">→ {empName}</span>
              )}
            </div>
            <span className="text-gray-500">{svc.duration} · {svc.price} MAD</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200">
        <span className="text-gray-500">Durée : {totalDuration}</span>
        <span className="font-semibold text-gray-900">{subtotal} MAD</span>
      </div>
    </div>
  );
}

export default BookingModal;