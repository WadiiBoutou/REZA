import { X, Check, ArrowRight, CreditCard, Store, Lock, Plus, Calendar, Clock, User, Users, AlertCircle, AlertTriangle, ChevronRight, Shuffle, GripVertical, RefreshCw } from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Receipt from './Receipt';
import Loading from './Loading';
import type { GuestParticipant, FamilyMemberOption } from './GroupParticipantsSection';
import AddServiceModal from './AddServiceModal';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { getMoroccoToday, getMoroccoDate, isMoroccoToday, isMoroccoPast, formatMoroccoDate, formatMoroccoTime, formatMoroccoDateTime, createDateFromMoroccoDateTime, isValidMoroccanPhone, getMoroccanPhoneError } from '../../lib/utils';
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
  isGroupBooking?: boolean;
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
  closedDaysOfWeek?: number[];
  bookingDelay?: {
    value: number;
    unit: 'heures' | 'jours' | 'semaines';
    allowLastMoment?: boolean;
  } | null;
  bookingAdvanceDays?: number;
  advanceBooking?: { unit: string; value: number } | null;
  onExistingParticipantsChange?: (participants: Array<{
    serviceIds: string[];
    startTime: string;
    serviceEmployees?: Array<{ serviceId: string; employeeId: string | null }>;
  }>) => void;
  onServiceEmployeesChange?: (selections: Array<{ serviceId: string; employeeId: string | null }>) => void;
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

// Get total duration in minutes for a list of services
function getDurationMinutes(svcList: Service[]): number {
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
}

/** Add N minutes to a "HH:MM" string and return "HH:MM". */
function addMinutes(start: string, mins: number): string {
  if (!start) return '';
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Normalize a Moroccan/local phone number to a comparable national form:
 * "+212612345678", "00212612345678" and "0612345678" all become "612345678".
 * Shared by the guest-form and proche-picker duplicate checks.
 */
function normalizePhone(p?: string): string {
  let d = (p || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('212') && d.length > 9) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

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
  isGroupBooking = false,
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
  closedDaysOfWeek = [0],
  bookingDelay = null,
  bookingAdvanceDays = 30,
  advanceBooking = null,
  onExistingParticipantsChange,
  onServiceEmployeesChange,
}) => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  // Calendar 14-day window start. Initialized to today, but will jump to the
  // first bookable day when availableDays loads (see auto-scroll effect below).
  const [currentMonth, setCurrentMonth] = useState(getMoroccoToday());
  // Prevents the calendar from rendering with a default position and then jumping
  // when availableDays loads. Calendar only appears after the initial fetch + jump.
  const [calendarReady, setCalendarReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  // Person selector for 'Ajouter une personne' (choisir proche ou invité)
  const [showPersonSelector, setShowPersonSelector] = useState(false);
  // Accumulated completed people (sequential add-person flow)
  const [savedPeople, setSavedPeople] = useState<GuestParticipant[]>([]);
  // Family-member id of the person currently being configured (for duplicate checks)
  const [currentFamilyMemberId, setCurrentFamilyMemberId] = useState<string | undefined>(undefined);
  // Permanently store booker's contact info so it's not lost when adding people
  const [bookerContact, setBookerContact] = useState<{firstName: string; lastName: string; phone: string; email: string; notes: string}>({firstName: '', lastName: '', phone: '', email: '', notes: ''});
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberOption[]>([]);
  const [familyLoading, setFamilyLoading] = useState(false);
  // Guest form state for "Ajouter un invité"
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestFormError, setGuestFormError] = useState('');
  const [showProchePrompt, setShowProchePrompt] = useState(false);
  const [procheRelation, setProcheRelation] = useState('');
  const [isAddingProche, setIsAddingProche] = useState(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>('any');
  // Step 2: sub-phase (0 = initial choice card, 1 = per-service selection)
  const [step2Phase, setStep2Phase] = useState(0);
  // Whether user chose 'specific per service' mode
  const [perServiceMode, setPerServiceMode] = useState(false);
  // Per-service employee selections (keyed by serviceId/serviceName)
  const [perServiceEmployeeSelections, setPerServiceEmployeeSelections] = useState<Record<string, string>>({});
  // Accumulated participants for sequential group flow
  const [accumulatedParticipants, setAccumulatedParticipants] = useState<Array<{
    firstName: string; lastName: string; phone: string; email?: string;
    serviceIds: string[]; startTimeIso: string;
    serviceEmployees?: Array<{serviceId: string; employeeId: string | null}>;
  }>>([]);

  // Real employee availability map per person: key is 'booker' or participant.id
  const [employeeAvailabilityMap, setEmployeeAvailabilityMap] = useState<Record<string, EmployeeAvailabilityStatus[]>>({});
  const [availabilityLoadingMap, setAvailabilityLoadingMap] = useState<Record<string, boolean>>({});

  const [receiptSummary, setReceiptSummary] = useState<{
    participants: { name: string; services: Service[]; subtotal: number }[];
    grandTotal: number;
  } | null>(null);
  const [receiptBookerName, setReceiptBookerName] = useState<string | undefined>(undefined);

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
    setSavedPeople([
      {
        id: `family-${pending.id}`,
        familyMemberId: pending.id,
        name: displayName,
        sameServicesAsBooker: true,
        serviceIds: [],
        employeeId: 'any',
      },
    ]);
    setCurrentFamilyMemberId(pending.id);
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
            phone: member.phone || undefined,
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
      setSavedPeople([]);
      setCurrentFamilyMemberId(undefined);
      setSelectedTeamMemberId('any');
      setEmployeeAvailabilityMap({});
      setAvailabilityLoadingMap({});
    }
  }, [show]);

  // followsBookerSchedule a été supprimé — plus besoin d'auto-sync sur date/time
  
  // Calculate total steps & step mapping
  // Step 1: Vos prestations
  // Step 2: Choix du professionnel
  // Step 3: Date & Créneau
  // Step 4: Coordonnées (if !isAuthenticated || !userHasAllInfo)
  // Step 5: Paiement (Step 4 if step 4 skipped)
  const effectivePhone = clientProfileData?.phone || user?.phone || '';
  const userHasAllInfo = isAuthenticated && effectivePhone && effectivePhone.trim() !== '';
  const shouldShowStep4 = !isAuthenticated || !userHasAllInfo;
  
  const visibleSteps = shouldShowStep4 ? [1, 2, 3, 4, 5] : [1, 2, 3, 5];
  const displayStep = visibleSteps.indexOf(bookingStep) + 1;
  const totalSteps = visibleSteps.length;

  // "Pour vous / Pour [Nom]" — which person is currently being configured.
  // The booker while savedPeople is empty; afterwards the participant added via
  // addPersonToGroup (whose name is pre-filled into bookingData). Hidden on the
  // final recap step where every participant is already individually labeled.
  const currentPersonLabel = useMemo(() => {
    if (savedPeople.length === 0) return 'Pour vous';
    const prefilled = `${bookingData.firstName || ''} ${bookingData.lastName || ''}`.trim();
    if (prefilled) return `Pour ${prefilled}`;
    // "Réserver pour [proche]" seeds savedPeople with the person being configured.
    if (savedPeople.length === 1 && currentFamilyMemberId && savedPeople[0]?.name) {
      return `Pour ${savedPeople[0].name.trim()}`;
    }
    return 'Pour vous';
  }, [savedPeople, bookingData.firstName, bookingData.lastName, currentFamilyMemberId]);

  const flatServices = salonServices.flatMap((c) => c.items);
  const getServicesTotal = (ids: string[]) =>
    flatServices
      .filter((s) => ids.includes((s.id || s.name) as string))
      .reduce((sum, s) => sum + (s.price || 0), 0);

  const getGroupGrandTotal = () => {
    const bookerTotal = getTotalPrice();
    const savedTotal = savedPeople.reduce((sum, p) => {
      return sum + getServicesTotal(p.serviceIds);
    }, 0);
    return bookerTotal + savedTotal;
  };

  useEffect(() => {
    const bookerIds = selectedServices.map((s) => s.id).filter(Boolean) as string[];
    const savedIds = savedPeople.flatMap((p) => p.serviceIds);
    onSlotServiceIdsChange?.([...new Set([...bookerIds, ...savedIds])]);
  }, [selectedServices, savedPeople, onSlotServiceIdsChange]);

  // Drag-and-drop sensors for reordering services
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /** Stable ID for a service — prefers `id`, falls back to `name`. */
  const serviceKey = (svc: Service, idx: number) => (svc.id || svc.name || `svc-${idx}`);

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = selectedServices.findIndex((s) => serviceKey(s, 0) === active.id);
    const newIdx = selectedServices.findIndex((s) => serviceKey(s, 0) === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = [...selectedServices];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);
    setSelectedServices(reordered);
  }, [selectedServices, setSelectedServices]);

  // Days that have at least 1 available slot (from backend existence check).
  // null = not yet loaded; [] = loaded but zero days; [...] = loaded with results.
  const [availableDays, setAvailableDays] = useState<string[] | null>(null);

  // Fetch available days covering the FULL 14-day window shown by the calendar.
  // Re-fetches only when the window start or service selection changes.
  const prevAvailableDaysDeps = useRef<{ salonId: string | null; currentMonthMs: number; servicesRef: unknown } | null>(null);
  useEffect(() => {
    const cur = { salonId: salonId ?? null, currentMonthMs: currentMonth.getTime(), servicesRef: selectedServices };
    if (prevAvailableDaysDeps.current) {
      const p = prevAvailableDaysDeps.current;
      const changed: string[] = [];
      if (p.salonId !== cur.salonId) changed.push('salonId');
      if (p.currentMonthMs !== cur.currentMonthMs) changed.push('currentMonth');
      if (p.servicesRef !== cur.servicesRef) changed.push('selectedServices');
      if (changed.length > 0) console.log('[AvailableDays] REFIRE cause:', changed.join(','));
    }
    prevAvailableDaysDeps.current = cur;
    if (!salonId) return;
    const serviceIds = selectedServices.map(s => s.id).filter(Boolean) as string[];
    if (serviceIds.length === 0) return;

    const today = getMoroccoToday();
    // from = start of the 14-day window, but never before today
    const from = currentMonth < today ? today : new Date(currentMonth);
    // to = end of the 14-day window (start + 13 days)
    const to = new Date(currentMonth);
    to.setDate(to.getDate() + 13);

    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fromStr = fmt(from);
    const toStr = fmt(to);

    let cancelled = false;
    console.log('[AvailableDays] Fetching:', { salonId, fromStr, toStr, serviceIds, currentMonth: currentMonth.toISOString() });
    api.getAvailableDays(salonId, fromStr, toStr, serviceIds)
      .then(res => {
        console.log('[AvailableDays] Response:', res);
        if (!cancelled) setAvailableDays(res.days || []);
      })
      .catch(err => {
        console.error('[AvailableDays] Error:', err);
        // Don't set availableDays on error — leave as null to skip the check
      });

    return () => { cancelled = true; };
  }, [salonId, currentMonth, selectedServices]);

  // When availableDays first loads, jump the 14-day window start to the first
  // available day so the calendar doesn't start from today with all days greyed out.
  // Also marks calendarReady — the calendar only renders after this runs to avoid
  // rendering with a default position and then visibly jumping.
  // IMPORTANT: after calendarReady is true, subsequent availableDays changes (from
  // date clicks or month navigation) do NOT re-position the calendar — only the
  // initial load triggers positioning.
  useEffect(() => {
    if (!availableDays) return;
    if (!calendarReady) {
      if (availableDays.length > 0) {
        const first = [...availableDays].sort()[0];
        const [y, m, d] = first.split('-').map(Number);
        const firstDate = new Date(y, m - 1, d);
        const desiredStart = new Date(firstDate);
        desiredStart.setDate(desiredStart.getDate() - 3);
        const curStart = new Date(currentMonth);
        curStart.setHours(0, 0, 0, 0);
        if (desiredStart.getTime() > curStart.getTime()) {
          setCurrentMonth(desiredStart);
        }
      }
      setCalendarReady(true);
    }
  }, [availableDays, calendarReady]);

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

  const isDateDisabled = (date: Date) => {
    const today = getMoroccoToday();
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    if (checkDate < today) return true;
    // Check blocked dates
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (blockedDates.includes(dateStr)) return true;
    // Check closed days of week (salon's off days, e.g. Sunday = 0)
    if (closedDaysOfWeek.includes(checkDate.getDay())) return true;
    // Check minimum booking lead time
    if (bookingDelay && bookingDelay.value && bookingDelay.unit && !bookingDelay.allowLastMoment) {
      const now = getMoroccoDate();
      let minDate = new Date(now);
      if (bookingDelay.unit === 'heures') {
        const leadMs = bookingDelay.value * 60 * 60 * 1000;
        minDate = new Date(now.getTime() + leadMs);
      } else if (bookingDelay.unit === 'jours') {
        minDate.setDate(minDate.getDate() + bookingDelay.value);
      } else if (bookingDelay.unit === 'semaines') {
        minDate.setDate(minDate.getDate() + bookingDelay.value * 7);
      }
      const minDay = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
      if (checkDate.getTime() < minDay.getTime()) return true;
    }
    // Check maximum advance booking window
    const maxDay = new Date(today);
    maxDay.setDate(maxDay.getDate() + bookingAdvanceDays);
    if (checkDate.getTime() > maxDay.getTime()) return true;
    // Check availableDays (from backend existence check).
    // Only grey out after the API has responded (availableDays !== null).
    // When availableDays is [] (zero available days), ALL days get greyed out.
    if (availableDays !== null && !availableDays.includes(dateStr)) return true;
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
  }, [selectedServices, savedPeople]);

  // Remonter savedPeople au parent pour les calculs de disponibilité (existingParticipants)
  // Debounced 200ms. flatServices is kept via ref to avoid infinite re-render loops
  // when parent recreates salonServices on every render.
  const flatServicesRef = useRef(flatServices);
  flatServicesRef.current = flatServices;

  useEffect(() => {
    if (!onExistingParticipantsChange) return;

    const timer = setTimeout(() => {
      const fs = flatServicesRef.current;
      const existing: Array<{
        serviceIds: string[];
        startTime: string;
        serviceEmployees?: Array<{ serviceId: string; employeeId: string | null }>;
      }> = [];

      for (const p of savedPeople) {
        const mainTime = bookingData.date && bookingData.time ? `${bookingData.date}T${bookingData.time}:00` : '';
        const pTime = p.customDate && p.customTime
          ? `${p.customDate}T${p.customTime}:00`
          : mainTime;
        if (!pTime || p.serviceIds.length === 0) continue;

        const svcEmployees: Array<{ serviceId: string; employeeId: string | null }> = [];
        if (p.perServiceEmployees && Object.keys(p.perServiceEmployees).length > 0) {
          for (const [svcKey, empId] of Object.entries(p.perServiceEmployees)) {
            if (empId && empId !== 'any') {
              const svc = fs.find((s: any) => (s.id || s.name) === svcKey);
              const realSvcId = svc?.id || svcKey;
              svcEmployees.push({ serviceId: realSvcId, employeeId: empId });
            }
          }
        }

        existing.push({
          serviceIds: p.serviceIds,
          startTime: pTime,
          serviceEmployees: svcEmployees.length > 0 ? svcEmployees : undefined,
        });
      }

      onExistingParticipantsChange(existing.length > 0 ? existing : []);
    }, 200);

    return () => clearTimeout(timer);
  }, [savedPeople, bookingData.date, bookingData.time, onExistingParticipantsChange]);

  // Notify parent about current person's explicit employee choices for availability checking
  useEffect(() => {
    if (!onServiceEmployeesChange || Object.keys(perServiceEmployeeSelections).length === 0) return;
    const fs = flatServicesRef.current;
    const entries = Object.entries(perServiceEmployeeSelections)
      .filter(([_, empId]) => empId && empId !== 'any')
      .map(([svcKey, empId]) => {
        const svc = fs.find((s: any) => (s.id || s.name) === svcKey);
        return { serviceId: svc?.id || svcKey, employeeId: empId };
      });
    onServiceEmployeesChange(entries);
  }, [perServiceEmployeeSelections, onServiceEmployeesChange]);

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

  // Fetch real employee availability whenever a date/time is selected (step 3)
  const availAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!salonId || !bookingData.date || !bookingData.time) return;

    // Cancel any in-flight availability fetches from a previous effect run
    if (availAbortRef.current) {
      availAbortRef.current.abort();
    }
    const controller = new AbortController();
    availAbortRef.current = controller;

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
        if (controller.signal.aborted) return;
        setEmployeeAvailabilityMap(prev => ({ ...prev, [personKey]: res.employees || [] }));
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.error(`Error fetching employee availability for ${personKey}:`, err);
        setEmployeeAvailabilityMap(prev => ({ ...prev, [personKey]: [] }));
      } finally {
        if (!controller.signal.aborted) {
          setAvailabilityLoadingMap(prev => ({ ...prev, [personKey]: false }));
        }
      }
    };

    if (bookingData.time) {
      fetchAvailabilityForPerson('booker', bookingData.time, bookerServiceIds);
    }

    savedPeople.forEach(p => {
      const pDate = p.customDate || bookingData.date;
      const pTime = p.customTime || bookingData.time;
      const pServiceIds = p.serviceIds;
      if (pDate && pTime && pServiceIds.length > 0) {
        fetchAvailabilityForPerson(p.id, pTime, pServiceIds);
      }
    });

    return () => { controller.abort(); };
  }, [salonId, bookingData.date, bookingData.time, selectedServices, savedPeople]);

  const validate = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    
    if (bookingStep === 3) {
      if (!bookingData.date) newErrors.date = true;
      if (!bookingData.time) newErrors.time = true;
    }
    
    if (bookingStep === 4 && shouldShowStep4) {
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
      // No payment validation needed — paiement sur place
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Add a person to the group (from proches or guest), auto-copying the main client's services
  const addPersonToGroup = (opts: { name: string; phone?: string; email?: string; familyMemberId?: string }) => {
    const mainServiceIds = selectedServices.map(s => s.id).filter(Boolean) as string[];
    
    // Save the CURRENT person (who just completed their booking) to savedPeople
    // with ALL their data: services, employees, date/time.
    // This runs EVERY time addPersonToGroup is called — not just the first time.
    // Identity is carried so duplicate prevention can match them later.
    const completedPerson: GuestParticipant = {
      id: savedPeople.length === 0 ? 'booker-saved' : `person-${Date.now()}`,
      name: `${bookingData.firstName || 'Vous'} ${bookingData.lastName || ''}`.trim() || 'Vous',
      phone: bookingData.phone || undefined,
      email: bookingData.email || undefined,
      familyMemberId: currentFamilyMemberId,
      sameServicesAsBooker: false,
      serviceIds: mainServiceIds,
      employeeId: selectedTeamMemberId === 'any' ? null : selectedTeamMemberId,
      perServiceEmployees: Object.keys(perServiceEmployeeSelections).length > 0 ? { ...perServiceEmployeeSelections } : undefined,
      customDate: bookingData.date,
      customTime: bookingData.time,
    };
    if (savedPeople.length === 0) {
      setSavedPeople([completedPerson]);
    } else {
      setSavedPeople(prev => [...prev, completedPerson]);
    }
    // The NEXT person being configured is the one from opts.
    setCurrentFamilyMemberId(opts.familyMemberId);

    // Pre-fill the NEW person's name into bookingData for step 4
    const nameParts = opts.name.trim().split(/\s+/);
    const prefilledFirstName = nameParts[0] || '';
    const prefilledLastName = nameParts.slice(1).join(' ') || '';

    // Pre-fill services from main client for the next person
    const prefilledServices = flatServices.filter(s => s.id && mainServiceIds.includes(s.id));
    setSelectedServices(prefilledServices);
    setSelectedTeamMemberId('any');
    setPerServiceMode(false);
    setStep2Phase(0);
    setPerServiceEmployeeSelections({});
    // Reset bookingData for the new person — pre-fill name from opts
    setBookingData({
      date: bookingData.date || '',
      time: '',
      totalDuration: '0',
      totalPrice: 0,
      firstName: prefilledFirstName,
      lastName: prefilledLastName,
      // The NEW person's contact comes from opts only — never inherit the
      // previous person's phone/email (that would attribute the wrong number
      // to the guest's Client record).
      email: opts.email || '',
      phone: opts.phone || '',
      notes: bookingData.notes || '',
    });
    setBookingStep(1);
  };

  const resetGuestForm = () => {
    setShowGuestForm(false);
    setGuestName('');
    setGuestPhone('');
    setGuestEmail('');
    setGuestFormError('');
    setShowProchePrompt(false);
    setProcheRelation('');
    setIsAddingProche(false);
  };

  const handleGuestSubmit = () => {
    const name = guestName.trim();
    const phone = guestPhone.trim();
    const email = guestEmail.trim();

    if (!name || name.length < 2) {
      setGuestFormError('Le prénom est requis (minimum 2 caractères)');
      return;
    }
    if (!phone) {
      setGuestFormError('Le numéro de téléphone est requis');
      return;
    }
    const phoneErr = getMoroccanPhoneError(phone);
    if (phoneErr) {
      setGuestFormError(phoneErr);
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGuestFormError('Format d\'email invalide');
      return;
    }

    // ── Duplicate-participant prevention (session-scoped only) ──
    // A one-time guest is a duplicate when BOTH normalized name and phone match
    // an already-added participant, the person currently being configured, or
    // the booker themselves. Phone is the reliable signal; name alone is too loose.
    const normPhone = normalizePhone;
    const normName = (n?: string) => (n || '').trim().toLowerCase();
    const gName = normName(name);
    const gPhone = normPhone(phone);

    const existingPeople: Array<{ name: string; phone: string }> = [
      ...savedPeople.map((p) => ({ name: p.name || '', phone: p.phone || '' })),
      // The person currently being configured (may be the booker).
      { name: `${bookingData.firstName || ''} ${bookingData.lastName || ''}`.trim(), phone: bookingData.phone || '' },
    ];
    // If the booker wasn't configured through step 4 (authenticated users skip it),
    // add their identity from the profile so they can't be re-added as a guest.
    if (savedPeople.length === 0) {
      const booker =
        (bookerContact.firstName ? bookerContact : null) ||
        clientProfileData ||
        (user
          ? {
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              phone: user.phone || '',
            }
          : null);
      if (booker) {
        existingPeople.push({
          name: `${booker.firstName || ''} ${booker.lastName || ''}`.trim(),
          phone: booker.phone || '',
        });
      }
    }

    const duplicate = existingPeople.some(
      (p) =>
        gName === normName(p.name) &&
        gPhone !== '' &&
        gPhone === normPhone(p.phone),
    );
    if (duplicate) {
      setGuestFormError('Cette personne a déjà été ajoutée à cette réservation.');
      return;
    }

    setShowProchePrompt(true);
  };

  const handleContinue = async () => {
    setError(null);
    
    if (bookingStep === 1 && selectedServices.length === 0) return;

    if (bookingStep === 1) {
      setBookingStep(2);
      return;
    }

    if (bookingStep === 2) {
      // 2-phase employee choice:
      //   Phase 0 → 'Sans préférence': skip to date step
      //   Phase 0 → 'Sélectionner par prestation': advance to phase 1
      //   Phase 1 → go to date step
      if (step2Phase === 0) {
        if (perServiceMode) {
          // Pre-fill all selected services with 'any' so the resolution at step 5 can find them
          setPerServiceEmployeeSelections(prev => {
            const updated = { ...prev };
            for (const svc of selectedServices) {
              const key = svc.id || svc.name;
              if (key && updated[key] === undefined) {
                updated[key] = 'any';
              }
            }
            return updated;
          });
          setStep2Phase(1);
          return;
        } else {
          // Sans préférence — resolve employees before date step
          setPerServiceEmployeeSelections(prev => {
            const updated = { ...prev };
            for (const svc of selectedServices) {
              const key = svc.id || svc.name;
              if (key && (!updated[key] || updated[key] === 'any')) {
                const capableEmps = employees.filter((emp: Employee) => {
                  if (!emp.services || emp.services.length === 0) return true;
                  return emp.services.some(
                    (es: any) =>
                      (typeof es === 'string' && (es === svc.id || es === svc.name)) ||
                      (es.serviceId === svc.id) || (es.serviceId === svc.name) || (es.name === svc.name)
                  );
                });
                if (capableEmps.length > 0) {
                  updated[key] = capableEmps[0].id;
                }
              }
            }
            return updated;
          });
          setBookingStep(3);
          return;
        }
      } else {
        // Phase 1 — resolve any remaining 'any' selections before date step
        setPerServiceEmployeeSelections(prev => {
          const updated = { ...prev };
          let changed = false;
          for (const [key, empId] of Object.entries(updated)) {
            if (empId === 'any') {
              const svc = selectedServices.find(s => (s.id || s.name) === key);
              if (svc) {
                const capableEmps = employees.filter((emp: Employee) => {
                  if (!emp.services || emp.services.length === 0) return true;
                  return emp.services.some(
                    (es: any) =>
                      (typeof es === 'string' && (es === svc.id || es === svc.name)) ||
                      (es.serviceId === svc.id) || (es.serviceId === svc.name) || (es.name === svc.name)
                  );
                });
                if (capableEmps.length > 0) {
                  updated[key] = capableEmps[0].id;
                  changed = true;
                }
              }
            }
          }
          return changed ? updated : prev;
        });
        setBookingStep(3);
        return;
      }
    }

    if (bookingStep === 3) {
      if (!validate()) return;
      const nextStep = shouldShowStep4 ? 4 : 5;
      setBookingStep(nextStep);
      return;
    }

    if (bookingStep === 4) {
      if (!validate()) return;
      // Save booker contact info permanently (only on first pass)
      if (savedPeople.length === 0) {
        setBookerContact({
          firstName: bookingData.firstName || '',
          lastName: bookingData.lastName || '',
          phone: bookingData.phone || '',
          email: bookingData.email || '',
          notes: bookingData.notes || '',
        });
      }
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
        if (shouldShowStep4) {
          setBookingStep(4);
        }
        return;
      }

      if (finalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
        setError('Veuillez entrer une adresse email valide');
        return;
      }

      const invalidGuest = savedPeople.find((p) => !p.name.trim());
      if (invalidGuest) {
        setError('Veuillez indiquer le prénom de chaque personne ajoutée.');
        return;
      }

      if (selectedServices.length === 0) {
        setError('Veuillez sélectionner au moins un service.');
        return;
      }

      if (!bookingData.date || !bookingData.time) {
        setError('Veuillez sélectionner une date et une heure.');
        return;
      }

      setIsLoading(true);
      try {
        const bookerServiceIds = selectedServices.map(s => s.id).filter(Boolean) as string[];
        const startDateTime = createDateFromMoroccoDateTime(bookingData.date, bookingData.time);

        // Build participants list: savedPeople + current person
        const allParticipants = [
          ...savedPeople.map((p) => {
            const pDate = p.customDate || bookingData.date;
            const pTime = p.customTime || bookingData.time;
            const pStart = createDateFromMoroccoDateTime(pDate, pTime);
            // Translate per-service selections to real service IDs
            const svcEmployees: Array<{ serviceId: string; employeeId: string | null }> = [];
            if (p.perServiceEmployees && Object.keys(p.perServiceEmployees).length > 0) {
              for (const [svcKey, empId] of Object.entries(p.perServiceEmployees)) {
                if (empId && empId !== 'any') {
                  const svc = flatServices.find((s: any) => (s.id || s.name) === svcKey);
                  svcEmployees.push({ serviceId: svc?.id || svcKey, employeeId: empId });
                }
              }
            }
            return {
              name: p.name.trim(),
              sameServicesAsBooker: false,
              serviceIds: p.serviceIds,
              employeeId: null,
              serviceEmployees: svcEmployees.length > 0 ? svcEmployees : undefined,
              startTime: pStart.toISOString(),
              // Carry the participant's real contact info so the backend can
              // reuse/create their Client with the actual phone (not guest_<ts>).
              ...(p.phone ? { phone: p.phone } : {}),
              ...(p.email ? { email: p.email } : {}),
            };
          }),
          {
            name: `${finalFirstName} ${finalLastName}`.trim(),
            sameServicesAsBooker: false,
            serviceIds: bookerServiceIds,
            employeeId: null,
            serviceEmployees: (() => {
              const entries = Object.entries(perServiceEmployeeSelections)
                .filter(([_, empId]) => empId && empId !== 'any');
              if (entries.length === 0) return undefined;
              return entries.map(([svcKey, empId]) => {
                const svc = flatServices.find((s: any) => (s.id || s.name) === svcKey);
                return { serviceId: svc?.id || svcKey, employeeId: empId };
              });
            })(),
            startTime: startDateTime.toISOString(),
            // Same contact-info fix: this participant's phone/email must reach
            // the backend instead of falling back to guest_<timestamp>.
            phone: finalPhone,
            ...(finalEmail ? { email: finalEmail } : {}),
          },
        ];

        // Use the REAL booker's identity for the top-level API fields, NEVER the
        // current participant's name from bookingData (which can be a guest's name
        // after addPersonToGroup resets it). Priority: bookerContact (saved at step 4
        // before any guests were added) → authenticated user → bookingData fallback.
        const bookerIdentity = bookerContact.firstName
          ? bookerContact
          : isAuthenticated && user
          ? { firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', phone: user.phone || '', notes: bookingData.notes }
          : null;
        const primaryContact = bookerIdentity ?? { firstName: finalFirstName, lastName: finalLastName, email: finalEmail, phone: finalPhone, notes: bookingData.notes };

        const bookingResponse = await api.createBooking({
          tenantId: salonId,
          firstName: primaryContact.firstName.trim(),
          lastName: primaryContact.lastName.trim(),
          email: primaryContact.email.trim() || undefined,
          phone: primaryContact.phone.trim(),
          serviceIds: allParticipants[0]?.serviceIds || bookerServiceIds,
          startTime: allParticipants[0]?.startTime || startDateTime.toISOString(),
          employeeId: null,
          serviceEmployees: allParticipants[0]?.serviceEmployees,
          notes: primaryContact.notes,
          includeBooker: true,
          participants: allParticipants.slice(1),
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
        setReceiptBookerName(
          bookingResponse.client
            ? `${bookingResponse.client.firstName} ${bookingResponse.client.lastName}`.trim()
            : undefined,
        );

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
            setSavedPeople([]);
            setReceiptSummary(null);
            setReceiptBookerName(undefined);
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
        clientName={receiptBookerName}
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
  // ─── Conflict resolution handler ──────────────────────────────
  // Called after every employee selection change.
  // Preserves the user's latest choice, reassigns others via backend.
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
                {bookingStep === 1 && 'Vos prestations'}
                {bookingStep === 2 && 'Choix du professionnel'}
                {bookingStep === 3 && 'Date & Créneau'}
                {bookingStep === 4 && 'Vos coordonnées'}
                {bookingStep === 5 && 'Paiement & Confirmation'}
              </h2>
              <p className="text-xs text-gray-500 mt-1">Étape {displayStep} sur {totalSteps}</p>
              {/* 'Pour vous / Pour [Nom]' — which person is being configured.
                  Hidden on the final recap (step 5) where everyone is already
                  individually labeled. */}
              {bookingStep !== 5 && (
                <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">
                  <User className="w-3.5 h-3.5" />
                  {currentPersonLabel}
                </span>
              )}
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
            
            {/* STEP 1: Vos prestations — with drag-and-drop reorder + running total */}
            {bookingStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-gray-900 text-base mb-3">Services sélectionnés</h3>
                  {selectedServices.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      Sélectionnez au moins un service pour continuer.
                    </p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={selectedServices.map((s, i) => serviceKey(s, i))}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {selectedServices.map((service, index) => {
                            const sk = serviceKey(service, index);
                            return (
                              <SortableServiceItem
                                key={sk}
                                id={sk}
                                service={service}
                                index={index}
                                onRemove={() => {
                                  const newServices = selectedServices.filter((_, i) => i !== index);
                                  setSelectedServices(newServices);
                                }}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}

                  {onAddService && (
                    <button
                      onClick={() => setShowAddServiceModal(true)}
                      className="mt-3 w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-xs font-bold text-gray-700 hover:border-black transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Ajouter une prestation
                    </button>
                  )}
                </div>

                {/* Running total */}
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total des prestations</span>
                    <span className="text-lg font-bold text-gray-900">{getTotalPrice()} MAD</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} · {getTotalDuration()}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Choix du professionnel — 2-phase */}
            {bookingStep === 2 && (
              <div className="space-y-6">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-700" />
                  {step2Phase === 0 ? 'Choix du professionnel' : 'Professionnel par prestation'}
                </h3>

                {step2Phase === 0 && (
                  <>
                    <p className="text-xs text-gray-500 mb-2">
                      Comment souhaitez-vous choisir le(s) professionnel(s) pour vos prestations ?
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Option 1: Sans préférence (default) */}
                      <div
                        onClick={() => {
                          setPerServiceMode(false);
                          setSelectedTeamMemberId('any');
                          setPerServiceEmployeeSelections({});
                        }}
                        className={`p-5 border-2 rounded-2xl transition-all cursor-pointer ${
                          !perServiceMode
                            ? 'border-black bg-black/5 shadow-sm'
                            : 'border-gray-100 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                            <Shuffle className="w-6 h-6" />
                          </div>
                          {!perServiceMode && (
                            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-gray-900 mb-1">Sans préférence</h4>
                        <p className="text-xs text-gray-500">
                          Attribution automatique — les meilleurs professionnels disponibles seront choisis pour chaque service.
                        </p>
                      </div>

                      {/* Option 2: Sélectionner par prestation */}
                      <div
                        onClick={() => {
                          setPerServiceMode(true);
                          setSelectedTeamMemberId('any');
                        }}
                        className={`p-5 border-2 rounded-2xl transition-all cursor-pointer ${
                          perServiceMode
                            ? 'border-black bg-black/5 shadow-sm'
                            : 'border-gray-100 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                            <Users className="w-6 h-6" />
                          </div>
                          {perServiceMode && (
                            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-gray-900 mb-1">Sélectionner un employé de choix</h4>
                        <p className="text-xs text-gray-500">
                          Choisissez un professionnel différent pour chaque prestation.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {step2Phase === 1 && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 mb-2">
                      Sélectionnez un professionnel pour chaque prestation.
                    </p>
                    {selectedServices.map((svc) => {
                      const svcKey = svc.id || svc.name;
                      const selectedEmp = perServiceEmployeeSelections[svcKey] || 'any';
                      // Build list of employees capable of this service
                      const capableEmps = employees.filter((emp) => {
                        if (!emp.services || emp.services.length === 0) return true;
                        return emp.services.some(
                          (es: any) =>
                            (typeof es === 'string' && (es === svc.id || es === svc.name)) ||
                            (es.serviceId === svc.id) ||
                            (es.serviceId === svc.name) ||
                            (es.name === svc.name)
                        );
                      });
                      return (
                        <div
                          key={svcKey}
                          className="p-4 bg-gray-50 rounded-2xl space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-sm text-gray-900">{svc.name}</h4>
                              <p className="text-[11px] text-gray-500">{svc.duration} · {svc.price} MAD</p>
                            </div>
                          </div>
                          {/* Custom Employee Select */}
                          <EmployeeSelect
                            value={selectedEmp}
                            onChange={(val) => {
                              const empName = val === 'any' ? 'Sans préférence' : getEmployeeName(val, employees);
                              console.log('[Step2] Employee selected:', { service: svc.name, selectedName: empName });
                              setPerServiceEmployeeSelections((prev) => ({
                                ...prev,
                                [svcKey]: val,
                              }));
                            }}
                            employees={capableEmps}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Date & Créneau — 14-day sliding window */}
            {bookingStep === 3 && (
              <div className="space-y-6">
                {/* 14-Day Picker */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-gray-700" />
                      Sélectionner une date
                    </h3>
                  </div>

                  {!calendarReady ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#002366]"></div>
                    </div>
                  ) : (
                  <div>
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => {
                        const prev = new Date(currentMonth);
                        prev.setDate(prev.getDate() - 14);
                        setCurrentMonth(prev);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"
                    >
                      ←
                    </button>
                    <span className="text-sm font-bold text-gray-900 min-w-[180px] text-center">
                      {(() => {
                        const end = new Date(currentMonth);
                        end.setDate(end.getDate() + 13);
                        const fmt = (d: Date) =>
                          `${d.getDate()} ${monthNames[d.getMonth()].slice(0, 3)}`;
                        return `${fmt(currentMonth)} - ${fmt(end)} ${end.getFullYear()}`;
                      })()}
                    </span>
                    <button
                      onClick={() => {
                        const next = new Date(currentMonth);
                        next.setDate(next.getDate() + 14);
                        setCurrentMonth(next);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 transition-colors"
                    >
                      →
                    </button>
                  </div>

                  {/* 14-day grid: 2 rows × 7 columns */}
                  <div className="space-y-2">
                    {[0, 7].map((offset) => (
                      <div key={offset} className="grid grid-cols-7 gap-2">
                        {Array.from({ length: 7 }).map((_, col) => {
                          const dayOffset = offset + col;
                          const dateObj = new Date(currentMonth);
                          dateObj.setDate(currentMonth.getDate() + dayOffset);

                          if (dayOffset >= 14) return <div key={col} />;

                          const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                          const isBlocked = blockedDates.includes(dateStr);
                          const disabled = isDateDisabled(dateObj);
                          const isSelected = selectedDate && isSameDay(dateObj, selectedDate);
                          const dayName = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][dateObj.getDay()];
                          const dayNum = dateObj.getDate();
                          const isToday =
                            dateObj.getFullYear() === getMoroccoToday().getFullYear() &&
                            dateObj.getMonth() === getMoroccoToday().getMonth() &&
                            dateObj.getDate() === getMoroccoToday().getDate();

                          return (
                            <button
                              key={col}
                              onClick={() => handleDateSelect(dateObj)}
                              disabled={disabled}
                              title={
                                isBlocked
                                  ? 'Fermé'
                                  : disabled
                                  ? 'Indisponible'
                                  : ''
                              }
                              className={`flex flex-col items-center gap-0.5 py-3 rounded-2xl text-sm font-bold transition-all border ${
                                isSelected
                                  ? 'bg-black text-white border-black shadow-md'
                                  : disabled
                                  ? 'text-gray-300 border-transparent cursor-not-allowed'
                                  : isToday
                                  ? 'border-black/20 bg-white hover:bg-gray-50 text-gray-900'
                                  : 'border-gray-100 bg-white hover:bg-gray-50 text-gray-800'
                              }`}
                            >
                              <span className="text-[11px] font-normal text-inherit opacity-70">
                                {dayName}
                              </span>
                              <span className={`text-base ${isSelected ? 'text-white' : ''}`}>
                                {dayNum}
                              </span>
                              {isBlocked && (
                                <span className="text-[8px] text-gray-400 font-normal">
                                  Fermé
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  </div>
                  )}
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

                {/* Saved participants (people already configured) */}
                {savedPeople.length > 0 && (
                  <>
                    {savedPeople.map((p) => {
                      const pServices = flatServices.filter((s) => p.serviceIds.includes((s.id || s.name) as string));
                      const pDuration = p.customDate && p.customTime
                        ? sumDurations(pServices)
                        : bookingData.totalDuration;
                      const pSubtotal = getServicesTotal(p.serviceIds);
                      return (
                        <RecapParticipantSection
                          key={p.id}
                          name={p.name}
                          isPrincipal={savedPeople.indexOf(p) === 0}
                          date={p.customDate || bookingData.date}
                          time={p.customTime || bookingData.time}
                          services={pServices}
                          employeeId={!p.employeeId || p.employeeId === 'any' ? null : p.employeeId}
                          employees={employees}
                          perServiceEmployees={p.perServiceEmployees}
                          totalDuration={pDuration}
                          subtotal={pSubtotal}
                        />
                      );
                    })}
                  </>
                )}

                {/* Current person's recap — only show if person has services or name */}
                {selectedServices.length > 0 && (bookingData.firstName || bookingData.lastName) && (function() {
                  // Use perServiceEmployeeSelections directly (already resolved at step 2)
                  // Filter out any remaining 'any' as safety fallback
                  const resolvedPerService: Record<string, string> | undefined = (() => {
                    const entries = Object.entries(perServiceEmployeeSelections)
                      .filter(([_, empId]) => empId && empId !== 'any');
                    if (entries.length > 0) {
                      return Object.fromEntries(entries);
                    }
                    // Fallback: use selectedTeamMemberId for single-employee mode
                    return undefined;
                  })();
                  
                  // Log for debugging
                  if (resolvedPerService) {
                    const logNames = Object.fromEntries(
                      Object.entries(resolvedPerService).map(([k, v]) => {
                        const name = selectedServices.find(s => (s.id || s.name) === k)?.name || k;
                        return [name, getEmployeeName(v, employees)];
                      })
                    );
                  }
                  
                  return (
                    <RecapParticipantSection
                      name={`${bookingData.firstName || 'Vous'} ${bookingData.lastName || ''}`.trim() || 'Vous'}
                      isPrincipal={savedPeople.length === 0}
                      date={bookingData.date}
                      time={bookingData.time}
                      services={selectedServices}
                      employeeId={selectedTeamMemberId === 'any' ? null : selectedTeamMemberId}
                      employees={employees}
                      perServiceEmployees={resolvedPerService}
                      totalDuration={bookingData.totalDuration}
                      subtotal={getTotalPrice()}
                    />
                  );
                })()}

                {/* Ajouter une personne button — only for group bookings */}
                {isGroupBooking && savedPeople.length + 1 < 4 && (
                  <button
                    onClick={() => setShowPersonSelector(true)}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    Ajouter une personne à la réservation
                  </button>
                )}

                {/* Person Selector Overlay */}
                {showPersonSelector && (
                  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => { resetGuestForm(); setShowPersonSelector(false); }}>
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900">Ajouter une personne</h4>
                        <button onClick={() => { resetGuestForm(); setShowPersonSelector(false); }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mes proches */}
                      {familyMembers.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mes proches</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {familyMembers.map((member) => {
                              // Duplicate if this proche is already added (by id),
                              // is the person currently being configured, or matches
                              // the booker by name — so the booker can't be added as
                              // an extra participant from their own proches list.
                              // ALSO matches by normalized name+phone: a guest created
                              // on the fly during THIS session and saved to "Mes
                              // proches" has no familyMemberId on its savedPeople
                              // entry, so id-only matching would let the same person
                              // be added twice (mobile already compares name+phone).
                              const normPhone = normalizePhone;
                              const memberName = (member.name || '').trim().toLowerCase();
                              const memberPhone = normPhone(member.phone);
                              // Stable booker identity (set at step 4 / from the
                              // profile) — NOT the current in-progress person, whose
                              // name changes per guest. Protects the booker from being
                              // re-added via their own proches list without falsely
                              // greying out a proche who merely shares a guest's name.
                              const bookerName = (
                                bookerContact.firstName
                                  ? `${bookerContact.firstName} ${bookerContact.lastName}`
                                  : clientProfileData?.firstName
                                  ? `${clientProfileData.firstName} ${clientProfileData.lastName || ''}`
                                  : isAuthenticated && user
                                  ? `${user.firstName || ''} ${user.lastName || ''}`
                                  : ''
                              ).trim().toLowerCase();
                              const sameByContact = (name?: string, phone?: string) =>
                                memberName !== '' &&
                                memberPhone !== '' &&
                                (name || '').trim().toLowerCase() === memberName &&
                                normPhone(phone) === memberPhone;
                              const alreadyAdded =
                                savedPeople.some(p => p.familyMemberId === member.id) ||
                                savedPeople.some(p => sameByContact(p.name, p.phone)) ||
                                currentFamilyMemberId === member.id ||
                                // The person currently being configured (guest X
                                // saved to Mes proches mid-session) — not yet in
                                // savedPeople, but still the same person.
                                sameByContact(
                                  `${bookingData.firstName || ''} ${bookingData.lastName || ''}`.trim(),
                                  bookingData.phone,
                                ) ||
                                (memberName !== '' && memberName === bookerName);
                              return (
                                <button
                                  key={member.id}
                                  disabled={alreadyAdded}
                                  onClick={() => {
                                    addPersonToGroup({
                                      name: member.name,
                                      familyMemberId: member.id,
                                    });
                                    setShowPersonSelector(false);
                                  }}
                                  className={`w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                                    alreadyAdded
                                      ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                                      : 'border-gray-200 hover:border-black hover:bg-gray-50 text-gray-900'
                                  }`}
                                >
                                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-gray-500" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-sm block">{member.name}</span>
                                    {member.relationship && (
                                      <span className="text-[11px] text-gray-500">{member.relationship}</span>
                                    )}
                                  </div>
                                  {alreadyAdded && (
                                    <span className="ml-auto text-[11px] text-gray-400">Déjà ajouté</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Ajouter un invité */}
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ajouter un invité</p>

                        {!showGuestForm ? (
                          <button
                            onClick={() => { setShowGuestForm(true); setGuestFormError(''); }}
                            className="w-full p-3 rounded-2xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-black hover:text-black transition-all flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" /> Ajouter
                          </button>
                        ) : showProchePrompt ? (
                          <div className="space-y-3">
                            <p className="text-sm text-gray-700">
                              Ajouter <strong>{guestName}</strong> à Mes proches ?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  addPersonToGroup({ name: guestName, phone: guestPhone, email: guestEmail });
                                  resetGuestForm();
                                  setShowPersonSelector(false);
                                }}
                                className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                              >
                                Non
                              </button>
                              <button
                                onClick={() => setIsAddingProche(true)}
                                className="flex-1 py-2.5 rounded-2xl bg-black text-white text-sm hover:bg-gray-800 transition-colors"
                              >
                                Oui
                              </button>
                            </div>
                            {isAddingProche && (
                              <div className="space-y-2 pt-2">
                                <input
                                  type="text"
                                  value={procheRelation}
                                  onChange={e => setProcheRelation(e.target.value)}
                                  placeholder="Relation (ex: cousin, ami) — optionnel"
                                  className="w-full p-3 rounded-2xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-black placeholder:text-gray-400"
                                />
                                <button
                                  onClick={async () => {
                                    try {
                                      if (user?.email) {
                                        const parts = guestName.trim().split(/\s+/);
                                        await api.createFamilyMember({
                                          clientEmail: user.email,
                                          firstName: parts[0] || guestName,
                                          lastName: parts.slice(1).join(' ') || '',
                                          phone: guestPhone || undefined,
                                          email: guestEmail || undefined,
                                          relationship: procheRelation.trim() || 'Invité',
                                        });
                                        const familyRes = await api.getClientFamilyMembers(user.email);
                                        setFamilyMembers((familyRes.familyMembers || []).map((m: any) => ({
                                          id: m.id,
                                          name: `${m.firstName} ${m.lastName}`,
                                          firstName: m.firstName,
                                          lastName: m.lastName,
                                          relationship: m.relationship,
                                          phone: m.phone || undefined,
                                        })));
                                      }
                                    } catch (err) {
                                      console.error('Failed to save proche:', err);
                                    }
                                    addPersonToGroup({ name: guestName, phone: guestPhone, email: guestEmail });
                                    resetGuestForm();
                                    setShowPersonSelector(false);
                                  }}
                                  className="w-full py-2.5 rounded-2xl bg-black text-white text-sm hover:bg-gray-800 transition-colors"
                                >
                                  Ajouter
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={guestName}
                              onChange={e => { setGuestName(e.target.value); setGuestFormError(''); }}
                              placeholder="Prénom et nom *"
                              className="w-full p-3 rounded-2xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-black placeholder:text-gray-400"
                            />
                            <input
                              type="tel"
                              value={guestPhone}
                              onChange={e => { setGuestPhone(e.target.value); setGuestFormError(''); }}
                              placeholder="Téléphone *"
                              className="w-full p-3 rounded-2xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-black placeholder:text-gray-400"
                            />
                            <input
                              type="email"
                              value={guestEmail}
                              onChange={e => { setGuestEmail(e.target.value); setGuestFormError(''); }}
                              placeholder="Email (optionnel)"
                              className="w-full p-3 rounded-2xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-black placeholder:text-gray-400"
                            />
                            {guestFormError && (
                              <p className="text-xs text-red-500">{guestFormError}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => resetGuestForm()}
                                className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={handleGuestSubmit}
                                className="flex-1 py-2.5 rounded-2xl bg-black text-white text-sm hover:bg-gray-800 transition-colors"
                              >
                                OK
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Grand Total */}
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <div className="flex justify-between items-center text-sm font-bold text-gray-900">
                    <span>TOTAL</span>
                    <span>{getGroupGrandTotal()} MAD</span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Modal Footer Controls */}
          <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-between sticky bottom-0">
            {bookingStep > 1 || (bookingStep === 2 && step2Phase === 1) ? (
              <button
                onClick={() => {
                  setError(null);
                  if (bookingStep === 5) {
                    setBookingStep(shouldShowStep4 ? 4 : 3);
                  } else if (bookingStep === 2 && step2Phase === 1) {
                    setStep2Phase(0);
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

            {(() => {
              // Disable continue when step 3 (date) has no date/time selected
              const stepDisabled = (() => {
                if (bookingStep === 3 && (!bookingData.date || !bookingData.time)) return true;
                return false;
              })();
              return (
                <button
                  onClick={handleContinue}
                  disabled={stepDisabled}
                  className={`px-8 py-3 rounded-2xl text-xs font-bold text-white transition-colors flex items-center gap-2 shadow-lg ${
                    stepDisabled
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-black hover:bg-gray-800'
                  }`}
                >
                  {bookingStep === 5 ? 'Confirmer la réservation' : 'Continuer'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              );
            })()}
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

// ─── Custom Employee Select Component ─────────────────────────────

function EmployeeSelect({
  value,
  onChange,
  employees,
}: {
  value: string;
  onChange: (val: string) => void;
  employees: Array<{ id: string; firstName: string; lastName: string; avatar?: string }>;
}) {
  const [open, setOpen] = useState(false);

  const matchedEmp = value !== 'any' ? employees.find((e) => e.id === value) : null;
  const selectedName = matchedEmp
    ? `${matchedEmp.firstName} ${matchedEmp.lastName}`.trim()
    : 'Sans préférence';

  return (
    <>
      {/* Trigger — shows the selected employee with avatar when chosen */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-sm font-medium transition-all border border-gray-200 bg-white hover:border-gray-300"
      >
        <span className="flex items-center gap-2 min-w-0">
          {value === 'any' ? (
            <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <Shuffle className="w-3.5 h-3.5 text-gray-400" />
            </span>
          ) : (
            <EmployeeAvatar name={selectedName} avatar={matchedEmp?.avatar} size={28} />
          )}
          <span
            className={`truncate ${value === 'any' ? 'text-gray-400' : 'text-gray-900'}`}
          >
            {selectedName}
          </span>
        </span>
        <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
      </button>

      {/* Popup: employees with avatars on the left — more room to show them clearly */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-gray-900 text-base">
                  Choisir un professionnel
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sélectionnez qui prendra en charge la prestation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 -mx-2 px-2">
              <button
                type="button"
                onClick={() => {
                  onChange('any');
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-colors flex items-center gap-3 ${
                  value === 'any'
                    ? 'bg-black/5 text-black font-semibold'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Shuffle className="w-4 h-4 text-gray-400" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">Sans préférence</span>
                  <span className="block text-[11px] text-gray-400 font-normal">
                    Attribution automatique
                  </span>
                </span>
                {value === 'any' && <Check className="w-4 h-4 text-black" />}
              </button>
              <div className="border-t border-gray-100 my-1" />
              {employees.map((emp) => {
                const fullName = `${emp.firstName} ${emp.lastName}`.trim();
                const isActive = value === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      onChange(emp.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-3 rounded-xl text-sm transition-colors flex items-center gap-3 ${
                      isActive
                        ? 'bg-black/5 text-black font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <EmployeeAvatar name={fullName} avatar={emp.avatar} size={36} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{fullName}</span>
                      <span className="block text-[11px] text-gray-400 font-normal">
                        Disponible
                      </span>
                    </span>
                    {isActive && <Check className="w-4 h-4 text-black" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Avatar circle — photo when available, name initial otherwise (state-based
// fallback so a failed image shows the initial in-flow, like mobile).
function EmployeeAvatar({
  name,
  avatar,
  size,
}: {
  name: string;
  avatar?: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().charAt(0).toUpperCase() || '?';
  const fallback = (
    <span
      className="rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  );
  if (!avatar || failed) return fallback;
  return (
    <img
      src={avatar}
      alt={name}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}


// ─── Sortable Service Item Component ──────────────────────────────

function SortableServiceItem({ id, service, index, onRemove }: {
  id: string;
  service: Service;
  index: number;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as any,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 bg-white rounded-2xl flex items-center justify-between border ${
        isDragging ? 'border-black shadow-lg' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          className="cursor-grab active:cursor-grabbing touch-none text-gray-400 hover:text-gray-700 transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[11px] font-bold shrink-0">
              {index + 1}
            </span>
            <h4 className="font-bold text-sm text-gray-900 truncate">{service.name}</h4>
          </div>
          <p className="text-xs text-gray-500 ml-9">{service.duration} • {service.price} MAD</p>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="text-xs text-rose-600 hover:underline font-medium shrink-0 ml-2"
      >
        Supprimer
      </button>
    </div>
  );
}

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
  perServiceEmployees,
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
  perServiceEmployees?: Record<string, string>;
  totalDuration: string;
  subtotal: number;
  followsBooker?: boolean;
}) {
  const empName = getEmployeeName(employeeId, employees);

  // For a single service, get the employee name
  const getEmpForService = (svc: Service): string | null => {
    if (perServiceEmployees) {
      const key = svc.id || svc.name;
      const empId = perServiceEmployees[key];
      if (empId && empId !== 'any') return getEmployeeName(empId, employees);
      return null;
    }
    if (employeeId) return empName;
    return null;
  };

  // Compute service time windows for logging (fires only when the content changes)
  const timeWindowsLogKey = JSON.stringify(services.map((svc) => {
    if (!time) return { name: svc.name, window: '', empName: getEmpForService(svc) };
    const durMinutes = getDurationMinutes([svc]);
    const end = addMinutes(time, durMinutes);
    return { name: svc.name, window: `${time} → ${end}`, empName: getEmpForService(svc) };
  }));
  useEffect(() => {
    if (timeWindowsLogKey === '[]') return;
    const windows = JSON.parse(timeWindowsLogKey) as Array<{ name: string; window: string; empName: string | null }>;
    console.log('[Recap]', name, '-', windows.map(w => `${w.name} ${w.window}${w.empName ? ` (${w.empName})` : ''}`).join(' | '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindowsLogKey]);

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
        {services.map((svc, i) => {
          const empNameForSvc = getEmpForService(svc);
          return (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-gray-900 font-medium">{svc.name}</span>
                {empNameForSvc && (
                  <span className="text-[11px] text-gray-500">par {empNameForSvc}</span>
                )}
              </div>
              <span className="text-gray-500 whitespace-nowrap">{svc.duration} · {svc.price} MAD</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200">
        <span className="text-gray-500">Durée : {totalDuration}</span>
        <span className="font-semibold text-gray-900">{subtotal} MAD</span>
      </div>
    </div>
  );
}

export default BookingModal;