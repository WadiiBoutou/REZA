'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, Clock, User, Phone, Mail, X, ChevronLeft, ChevronRight, MoreVertical, Plus, CalendarIcon, MapPin, Check, UserX, Flag, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn, getImageUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import ReactSelect from 'react-select';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { NewAppointmentModal } from './NewAppointmentModal';
import { AppointmentCard } from './AppointmentCard';
import {
  ApiAppointment,
  Appointment,
  Client,
  FinalizePaymentMethod,
  FinalizeModalState,
  GroupReviewModalState,
  GroupReviewParticipant,
  ServiceCardData,
} from './types';

// Transform API appointment to frontend format
const transformApiAppointment = (apiApt: ApiAppointment): Appointment => {
  // Parse UTC date from API
  // The backend stores dates in UTC (e.g., "2024-12-24T15:30:00.000Z" for 16:30 Morocco time)
  const utcDate = new Date(apiApt.startTime);
  
  // Extract UTC time components directly from the stored UTC time
  const utcHours = utcDate.getUTCHours();
  const utcMinutes = utcDate.getUTCMinutes();
  
  // Convert UTC to Morocco time (UTC+1) by adding 1 hour
  let moroccoHours = utcHours + 1;
  const moroccoMinutes = utcMinutes;
  
  // Extract UTC date components
  let utcYear = utcDate.getUTCFullYear();
  let utcMonth = utcDate.getUTCMonth();
  let utcDay = utcDate.getUTCDate();
  
  // Handle hour overflow (e.g., 23:30 UTC + 1 hour = 00:30 next day)
  if (moroccoHours >= 24) {
    moroccoHours = moroccoHours - 24;
    // Move to next day
    const nextDay = new Date(Date.UTC(utcYear, utcMonth, utcDay + 1));
    utcYear = nextDay.getUTCFullYear();
    utcMonth = nextDay.getUTCMonth();
    utcDay = nextDay.getUTCDate();
  }
  
  const time = `${moroccoHours.toString().padStart(2, '0')}:${moroccoMinutes.toString().padStart(2, '0')}`;
  
  // Compute end time from start time + duration for display
  const durationMinutes = apiApt.totalDuration ?? apiApt.duration ?? 0;
  const endTotalMinutes = moroccoHours * 60 + moroccoMinutes + durationMinutes;
  const endHours = Math.floor(endTotalMinutes / 60) % 24;
  const endMinutes = endTotalMinutes % 60;
  const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  
  // Create date object using UTC components to avoid timezone conversion issues
  // This ensures the date picker shows the correct date regardless of browser timezone
  const date = new Date(Date.UTC(utcYear, utcMonth, utcDay));
  date.setHours(0, 0, 0, 0); // Ensure it's at midnight
  
  // Map API status to frontend status
  const statusMap: Record<string, string> = {
    'PENDING': 'pending',
    'CONFIRMED': 'confirmed',
    'IN_PROGRESS': 'in_progress',
    'COMPLETED': 'completed',
    'CANCELLED': 'cancelled',
    'NO_SHOW': 'no_show'
  };
  
  const services = (apiApt.services || []).map((service) => ({
    id: service.id,
    serviceId: service.serviceId ?? null,
    name: service.name || service.serviceName,
    duration: service.duration,
    price: service.price,
    sortOrder: service.sortOrder,
    employee: service.employee ?? null,
  }));

  return {
    id: apiApt.id,
    clientName: apiApt.bookingParticipant?.displayName || `${apiApt.client.firstName} ${apiApt.client.lastName}`,
    service: services.length > 0 ? services[0].name : 'Service',
    services,
    serviceIds: services.map((service) => service.serviceId ?? service.id ?? '').filter(Boolean),
    time,
    endTime,
    duration: apiApt.totalDuration ?? apiApt.duration,
    status: statusMap[apiApt.status] || apiApt.status.toLowerCase(),
    employee: apiApt.employee ? `${apiApt.employee.firstName} ${apiApt.employee.lastName}` : 'Non assigné',
    phone: apiApt.client.phone || undefined,
    email: apiApt.client.email || undefined,
    date,
    notes: apiApt.notes || undefined,
    cancelledByClient: apiApt.cancelledBy === apiApt.clientId,
    clientId: apiApt.clientId,
    serviceId: services.length > 0 ? (services[0].serviceId ?? services[0].id ?? '') : '',
    employeeId: services.length > 0 ? (services[0].employee?.id ?? null) : (apiApt.employee?.id ?? null),
    tenantId: apiApt.tenantId,
    servicePrice: services.length > 0 ? services[0].price : null,
    totalDuration: apiApt.totalDuration ?? apiApt.duration,
    totalPrice: apiApt.totalPrice ?? (services.length > 0 ? services[0].price : null),
    bookingGroupId: apiApt.bookingGroup?.id,
    bookingGroupParticipantCount: apiApt.bookingGroup?._count?.participants ?? 0,
  };
};

// Transform frontend appointment to API format
const transformToApiAppointment = (apt: Appointment, date: Date, time: string): any => {
  // Combine date and time in Morocco timezone (UTC+1), then convert to UTC ISO string
  // The date parameter is a Date object created with UTC components (from transformApiAppointment)
  // So we use UTC methods to extract components
  const [hours, minutes] = time.split(':').map(Number);
  
  // Create date in Morocco timezone (treating the date/time as if it were Morocco local time)
  // We create a UTC date with the Morocco date/time components
  const moroccoDateTime = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  ));
  
  // Convert Morocco time to UTC by subtracting 1 hour offset
  const moroccoOffset = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
  const utcDateTime = new Date(moroccoDateTime.getTime() - moroccoOffset);
  
  // Convert to ISO string (UTC) for database storage
  const startTimeISO = utcDateTime.toISOString();
  
  // Map frontend status to API status
  const statusMap: Record<string, string> = {
    'pending': 'PENDING',
    'confirmed': 'CONFIRMED',
    'in_progress': 'IN_PROGRESS',
    'completed': 'COMPLETED',
    'cancelled': 'CANCELLED',
    'no_show': 'NO_SHOW'
  };
  
  const body: Record<string, unknown> = {
    clientId: apt.clientId!,
    source: 'ADMIN',
    startTime: startTimeISO,
    notes: apt.notes || undefined,
    status: statusMap[apt.status] || 'CONFIRMED',
    ...(apt.tenantId ? { tenantId: apt.tenantId } : {}),
  };

  if (apt.servicesPayload && apt.servicesPayload.length > 0) {
    body.services = apt.servicesPayload.map((s) => ({
      serviceId: s.serviceId,
      ...(s.employeeId ? { employeeId: s.employeeId } : {}),
    }));
  } else {
    const serviceIds = (apt.serviceIds && apt.serviceIds.length > 0
      ? apt.serviceIds
      : apt.serviceId
        ? [apt.serviceId]
        : []);
    if (serviceIds.length > 0) body.serviceIds = serviceIds;
    if (apt.serviceId) body.serviceId = apt.serviceId;
    body.employeeId = apt.employeeId || undefined;
    body.duration = apt.duration;
  }

  return body;
};

// ─── Per-service agenda cards ─────────────────────────────────────────────────
// The backend stores per-service rows (AppointmentServiceItem) with a duration
// and a sortOrder but no per-service start time. Services run sequentially
// within an appointment, so each service's own slot is derived as cumulative
// offsets from the appointment start time (e.g. 09:00-09:45 then 09:45-10:30).


// Fixed palette used as a deterministic fallback when an employee has no
// admin-assigned color in their agendaSettings — keeps cards distinguishable
// instead of everyone defaulting to the same blue.
const EMPLOYEE_COLOR_PALETTE = [
  '#6366F1', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16',
];
const UNASSIGNED_COLOR = '#9CA3AF';
const MINUTE_HEIGHT_REM = 5 / 30; // 5rem per 30-min slot (same scale as the old min-h-20)

// Minimum readable width for a single lane of agenda cards (px).
const MIN_LANE_WIDTH_PX = 160;

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesToTime = (min: number): string => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const isSameDay = (a: Date, b: Date): boolean => {
  const da = new Date(a);
  da.setHours(0, 0, 0, 0);
  const db = new Date(b);
  db.setHours(0, 0, 0, 0);
  return da.getTime() === db.getTime();
};

// Current time in Morocco wall time (UTC+1, matching the appointment time
// conversion in transformApiAppointment) as minutes since midnight — used for
// the red "now" line on the agenda.
/**
 * Visible date range for the current agenda view (day/week/month).
 * Shared by the appointments fetch and the backend availability fetch.
 */
const getViewDateRange = (view: string, anchor: Date): { startDate: Date; endDate: Date } => {
  if (view === 'day') {
    const startDate = new Date(anchor);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(anchor);
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  }
  if (view === 'week') {
    const weekStart = new Date(anchor);
    const dayOfWeek = weekStart.getDay();
    const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { startDate: weekStart, endDate: weekEnd };
  }
  // month
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  return { startDate: monthStart, endDate: monthEnd };
};

const getMoroccoNowMin = (): number => {
  const now = new Date();
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 60) % 1440;
};

// Resolve an employee's color: reuse the admin-assigned agendaSettings.color
// when present (editable in Paramètres → Agenda → Gestion des agendas),
// otherwise pick a deterministic palette color derived from the name.
const resolveEmployeeColor = (
  employeeName: string | undefined,
  employeesData: Array<{ name: string; agendaSettings?: { color?: string } }>
): string => {
  if (!employeeName || employeeName === 'Non assigné') return UNASSIGNED_COLOR;
  const emp = employeesData.find((e) => e.name === employeeName);
  const assigned = emp?.agendaSettings?.color;
  if (typeof assigned === 'string' && assigned.trim()) return assigned.trim();
  let hash = 0;
  for (let i = 0; i < employeeName.length; i++) {
    hash = (hash * 31 + employeeName.charCodeAt(i)) >>> 0;
  }
  return EMPLOYEE_COLOR_PALETTE[hash % EMPLOYEE_COLOR_PALETTE.length];
};

// Expand an appointment into one card per service, each positioned/sized by the
// service's own sequential slot. Single-service and legacy appointments yield a
// single card exactly as before.
const expandAppointmentToServiceCards = (
  apt: Appointment,
  employeesData: Array<{ name: string; agendaSettings?: { color?: string } }>
): ServiceCardData[] => {
  const aptStartMin = timeToMinutes(apt.time);
  const services = [...(apt.services || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  if (services.length === 0) {
    const duration = apt.duration || 0;
    const employeeName =
      apt.employee && apt.employee !== 'Non assigné' ? apt.employee : 'Non assigné';
    return [{
      key: `${apt.id}:0`,
      apt,
      serviceIndex: 0,
      serviceCount: 1,
      serviceName: apt.service,
      duration,
      startMin: aptStartMin,
      endMin: aptStartMin + duration,
      startLabel: apt.time,
      endLabel: apt.endTime,
      employeeName,
      employeeId: apt.employeeId ?? null,
      color: resolveEmployeeColor(employeeName, employeesData),
    }];
  }

  let cursor = aptStartMin;
  return services.map((s, i) => {
    const duration = s.duration || 0;
    const start = cursor;
    const end = start + duration;
    cursor = end;
    const employeeName = s.employee
      ? `${s.employee.firstName} ${s.employee.lastName}`
      : apt.employee && apt.employee !== 'Non assigné'
        ? apt.employee
        : 'Non assigné';
    return {
      key: `${apt.id}:${s.sortOrder ?? i}`,
      apt,
      serviceIndex: i,
      serviceCount: services.length,
      serviceName: s.name,
      duration,
      startMin: start,
      endMin: end,
      startLabel: minutesToTime(start),
      endLabel: minutesToTime(end),
      employeeName,
      employeeId: s.employee?.id ?? apt.employeeId ?? null,
      color: resolveEmployeeColor(employeeName, employeesData),
    };
  });
};

type LaidOutServiceCard = ServiceCardData & { lane: number; laneCount: number };

// Day column width = the day's own peak concurrent-lane count × the minimum
// readable card width. A genuinely busy hour widens the column; quiet days
// stay narrow. Cards within the column are positioned by LOCAL lane count.
const dayColumnWidthPx = (laid: LaidOutServiceCard[]): number =>
  Math.max(1, ...laid.map((c) => c.laneCount)) * MIN_LANE_WIDTH_PX;

// Assign concurrent cards to side-by-side lanes with booking-group awareness:
// ALL sibling cards of the same booking are treated as ONE atomic block and
// assigned to the SAME lane. Only cards from DIFFERENT bookings that genuinely
// overlap in time are split into separate lanes.
//
// Algorithm:
//   1. Collapse each booking into a single [startMin, endMin] span (the union
//      of its service cards' spans — i.e. from first card start to last card end).
//   2. Run the greedy lane-assignment on these booking-level spans (not on
//      individual service cards), so a booking's internal service sequence
//      never falsely inflates the lane count.
//   3. Compute each booking's laneCount as the max number of booking blocks
//      active at any single moment WITHIN that booking's own span — NOT the
//      day's global max. A booking that never overlaps anything renders at
//      full column width even if unrelated bookings elsewhere in the day
//      needed 2+ lanes; a booking that genuinely overlaps others is divided
//      only by the real number of concurrent lanes it contends with.
//   4. Propagate the assigned lane + per-booking laneCount to every service
//      card of that booking (all siblings share one lane and one laneCount, so
//      a booking's cards always stay visually consistent in width).
const layoutConcurrentCards = (cards: ServiceCardData[]): LaidOutServiceCard[] => {
  if (cards.length === 0) return [];

  // ── Step 1: group cards by booking (apt.id) ──────────────────────────────
  const bookingMap = new Map<string, ServiceCardData[]>();
  for (const c of cards) {
    const arr = bookingMap.get(c.apt.id);
    if (arr) arr.push(c);
    else bookingMap.set(c.apt.id, [c]);
  }

  // Represent each booking as its union time span
  type BookingSpan = { aptId: string; startMin: number; endMin: number };
  const spans: BookingSpan[] = [];
  for (const [aptId, group] of bookingMap) {
    spans.push({
      aptId,
      startMin: Math.min(...group.map((c) => c.startMin)),
      endMin: Math.max(...group.map((c) => c.endMin)),
    });
  }

  // Sort bookings by start time, then longest first (stable calendar heuristic)
  spans.sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

  // ── Step 2: greedy lane assignment at the booking level ───────────────────
  const laneEnds: number[] = [];
  const bookingLane = new Map<string, number>();
  for (const span of spans) {
    let lane = laneEnds.findIndex((end) => end <= span.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(span.endMin);
    } else {
      laneEnds[lane] = span.endMin;
    }
    bookingLane.set(span.aptId, lane);
  }

  // ── Step 3: per-booking lane count (momentary max concurrency) ────────────
  // The active booking count only changes at booking start/end boundaries, so
  // scanning those moments inside each booking's own span gives the exact max
  // number of lanes that booking ever genuinely contends with. Greedy lane
  // assignment guarantees lane < this count (a booking's lane never exceeds
  // the number of blocks active at its start), so left/width never overflow.
  const moments = [...new Set(spans.flatMap((s) => [s.startMin, s.endMin]))].sort(
    (a, b) => a - b
  );
  const bookingLaneCount = new Map<string, number>();
  for (const span of spans) {
    let maxActive = 1;
    for (const m of moments) {
      if (m < span.startMin || m >= span.endMin) continue;
      let active = 0;
      for (const other of spans) {
        if (other.startMin <= m && other.endMin > m) active++;
      }
      if (active > maxActive) maxActive = active;
    }
    bookingLaneCount.set(span.aptId, Math.max(maxActive, 1));
  }

  // ── Step 4: stamp every service card with its booking's lane + laneCount ─
  return cards.map((c) => ({
    ...c,
    lane: bookingLane.get(c.apt.id) ?? 0,
    laneCount: bookingLaneCount.get(c.apt.id) ?? 1,
  }));
};



const canConfirmStatus = (status: string) => status === 'pending';
const canMarkAbsentOrDone = (status: string) =>
  status === 'pending' || status === 'confirmed' || status === 'in_progress';

const DEFAULT_PAYMENT_METHODS = ['Espèces', 'Carte', 'Virement', 'Chèque'];
const PAYMENT_METHOD_LABELS: Record<FinalizePaymentMethod, string> = {
  CASH: 'Espèces',
  CARD: 'Carte',
  BANK_TRANSFER: 'Virement',
  CHECK: 'Chèque',
};
const API_PAYMENT_KEY: Record<string, FinalizePaymentMethod> = {
  'Espèces': 'CASH',
  'Carte': 'CARD',
  'Carte bancaire': 'CARD',
  'Virement': 'BANK_TRANSFER',
  'Chèque': 'CHECK',
};

const getPaymentMethodOptions = (methods: string[]) => {
  const orderedMethods = [...methods].sort((left, right) =>
    Number(!API_PAYMENT_KEY[left]) - Number(!API_PAYMENT_KEY[right])
  );
  const seenValues = new Set<FinalizePaymentMethod>();

  return orderedMethods.flatMap((method) => {
    const value = API_PAYMENT_KEY[method] || 'CASH';
    if (seenValues.has(value)) return [];
    seenValues.add(value);
    return [{ method, value }];
  });
};

// Extract unique employee display info from appointment (per-service or top-level)
const getAppointmentEmployeeLabel = (apt: Appointment): string => {
  const names = new Set<string>();
  if (apt.services && apt.services.length > 0) {
    for (const s of apt.services) {
      if (s.employee) names.add(`${s.employee.firstName} ${s.employee.lastName}`);
    }
  }
  if (names.size === 0 && apt.employee && apt.employee !== 'Non assigné') names.add(apt.employee);
  if (names.size === 0) return 'Non assigné';
  const sorted = [...names].sort();
  if (sorted.length === 1) return sorted[0];
  return `${sorted[0]} +${sorted.length - 1}`;
};

// Check if an appointment involves a given employee name
const appointmentHasEmployee = (apt: Appointment, employeeName: string): boolean => {
  const target = employeeName.trim().toLowerCase();
  if (apt.services && apt.services.length > 0) {
    for (const s of apt.services) {
      if (s.employee) {
        const name = `${s.employee.firstName} ${s.employee.lastName}`.trim().toLowerCase();
        if (name === target) return true;
      }
    }
  }
  if (apt.employee) {
    return apt.employee.trim().toLowerCase() === target;
  }
  return false;
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === 'object') {
    const e = err as any;
    if (e.details?.message) return e.details.message;
    if (e.message) return e.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};



const RendezVousPage = () => {	const { isAuthenticated, salonFilter, effectiveSalonIds } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [mounted, setMounted] = useState(false);
  // View + date survive the salon-switch remount (layout salonKey) via sessionStorage,
  // so switching salons doesn't throw the admin back to today/week view.
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('rdv:view');
      if (saved === 'day' || saved === 'week' || saved === 'month') return saved;
    }
    return 'week'; // day, week, month
  });
  const [currentDate, setCurrentDate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('rdv:currentDate');
      if (saved) {
        const d = new Date(saved);
        if (!isNaN(d.getTime())) {
          d.setHours(0, 0, 0, 0);
          return d;
        }
      }
    }
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNewRDV, setShowNewRDV] = useState(false);
  const [newRdvInitialDate, setNewRdvInitialDate] = useState<Date | undefined>(undefined);
  const [newRdvInitialTime, setNewRdvInitialTime] = useState<string>('');
  const [draggedEvent, setDraggedEvent] = useState<Appointment | null>(null);
  // Booking id currently hovered → highlights all of that booking's service cards.
  const [hoveredBookingId, setHoveredBookingId] = useState<string | null>(null);
  const [moveConfirm, setMoveConfirm] = useState<{
    id: string;
    data: any;
    conflicts: string[];
  } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [finalizeModal, setFinalizeModal] = useState<FinalizeModalState | null>(null);
  const [groupReviewModal, setGroupReviewModal] = useState<GroupReviewModalState | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  // Multi-select employee filter (names). Empty array = show everyone ('Tous').
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
	const [refreshKey, setRefreshKey] = useState(0);
  
  // Load employee agendas and services for colors
  const [employeeAgendas, setEmployeeAgendas] = useState<Array<{id: string, name: string, color: string}>>([]);
  
  // Dynamic payment methods for finalize modal
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<string[]>(['Espèces', 'Carte', 'Virement', 'Chèque']);

  // Agenda display range
  const [agendaStart, setAgendaStart] = useState('09:00');
  const [agendaEnd, setAgendaEnd] = useState('23:30');
  const [services, setServices] = useState<Array<{id: string, name: string, color?: string, duration?: number, tenantId?: string}>>([]);
  const [displaySettings, setDisplaySettings] = useState<{
    showColorInRDV: boolean;
    fields?: Array<{ id: string; label: string; visible: boolean; order: number }>;
  }>({ 
    showColorInRDV: true,
    fields: [
      { id: 'hours', label: 'Horaires', visible: true, order: 1 },
      { id: 'clientName', label: 'Nom du client', visible: true, order: 2 },
      { id: 'services', label: 'Prestation(s)', visible: true, order: 3 },
      { id: 'notes', label: 'Titre ou note', visible: true, order: 4 },
    ]
  });

  // Store full employee data with working hours
  const [employeesData, setEmployeesData] = useState<Array<{
    id: string;
    name: string;
    color: string;
    workingHours: any;
    agendaSettings: any;
  }>>([]);

  // Fetch employees and services from API
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    
    const fetchData = async () => {
      try {
        // Fetch employees from API
        const employeesResponse = await api.getEmployees({ active: true });
        const employees = employeesResponse.employees || [];
        
        // Transform employees to extract name, color, and working hours
        const transformedEmployees = employees.map((emp: any) => {
          const agendaSettings = emp.agendaSettings || {};
          const name = `${emp.firstName} ${emp.lastName}`;
          const color = agendaSettings.color || '#3B82F6';
          return { 
            id: emp.id, 
            name, 
            color,
            workingHours: emp.workingHours,
            agendaSettings: agendaSettings,
            tenantId: emp.tenantId
          };
        });
        setEmployeeAgendas(transformedEmployees.map((e: any) => ({ id: e.id, name: e.name, color: e.color })));
        setEmployeesData(transformedEmployees);

        // Fetch services from API
        const servicesResponse = await api.getServices();
        const allServices = servicesResponse.services || [];
        setServices(allServices.map((s: any) => ({ id: s.id, name: s.name, color: s.color, duration: s.duration, tenantId: s.tenantId })));

        // Fetch accepted payment methods
        try {
          const pmRes = await api.getAcceptedPaymentMethods();
          if (pmRes.methods && pmRes.methods.length > 0) {
            setAcceptedPaymentMethods(pmRes.methods);
          }
        } catch { /* use defaults */ }

        // Fetch agenda display range
        try {
          const bhRes = await api.getBusinessHours();
          if (bhRes.agendaStart) setAgendaStart(bhRes.agendaStart);
          if (bhRes.agendaEnd) setAgendaEnd(bhRes.agendaEnd);
        } catch { /* use defaults */ }
      } catch (err) {
        console.error('Error fetching employees/services:', err);
        // Fallback to localStorage if API fails
        if (typeof window !== 'undefined') {
          const storedAgendas = localStorage.getItem('employeeAgendas');
          if (storedAgendas) {
            const agendas = JSON.parse(storedAgendas);
            setEmployeeAgendas(agendas.map((a: any) => ({ id: a.id, name: a.name, color: a.color })));
          }
          const storedServices = localStorage.getItem('services');
          if (storedServices) {
            const servicesData = JSON.parse(storedServices);
            setServices(servicesData.map((s: any) => ({ id: s.id, name: s.name, color: s.color })));
          }
        }
      }
    };	    fetchData();

	    // Load display settings from API
    const fetchDisplaySettings = async () => {
      try {
        const response = await api.getAppointmentDisplaySettings();
        const settings = response.settings || {};
        setDisplaySettings({
          showColorInRDV: settings.showColorInRDV !== undefined ? settings.showColorInRDV : true,
          fields: settings.fields || [
            { id: 'hours', label: 'Horaires', visible: true, order: 1 },
            { id: 'clientName', label: 'Nom du client', visible: true, order: 2 },
            { id: 'services', label: 'Prestation(s)', visible: true, order: 3 },
            { id: 'notes', label: 'Titre ou note', visible: true, order: 4 },
          ]
        });
      } catch (err) {
        console.error('Error fetching display settings:', err);
        // Fallback to default settings
        setDisplaySettings({
          showColorInRDV: true,
          fields: [
            { id: 'hours', label: 'Horaires', visible: true, order: 1 },
            { id: 'clientName', label: 'Nom du client', visible: true, order: 2 },
            { id: 'services', label: 'Prestation(s)', visible: true, order: 3 },
            { id: 'notes', label: 'Titre ou note', visible: true, order: 4 },
          ]
        });
      }
    };
    
    fetchDisplaySettings();
  }, [isAuthenticated, salonFilterKey]);

  // Get selected employee's color for calendar background (single selection only)
  const getSelectedEmployeeColor = () => {
    if (selectedEmployees.length !== 1) return null;
    const employee = employeeAgendas.find(e => e.name === selectedEmployees[0]);
    return employee?.color || null;
  };

  // Generate subtle background color style for calendar cells
  const getCalendarCellStyle = () => {
    if (selectedEmployees.length !== 1) {
      return {};
    }
    
    const color = getSelectedEmployeeColor();
    if (!color) {
      return {};
    }
    
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // More visible when employee is selected
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
    };
  };

  // Listen for sidebar filter changes and sidebar date changes
  useEffect(() => {
    const handleEmployeeFilter = (event: Event) => {
      const ev = event as CustomEvent<string[]>;
      setSelectedEmployees(Array.isArray(ev.detail) ? ev.detail : []);
    };
    const handleStatusFilter = (event: Event) => {
      const ev = event as CustomEvent<string>;
      setFilterStatus(ev.detail);
    };
    const handleSidebarDateChange = (event: Event) => {
      const ev = event as CustomEvent<string>;
      setCurrentDate(new Date(ev.detail));
    };
    window.addEventListener('employeeFilterChange', handleEmployeeFilter as EventListener);
    window.addEventListener('statusFilterChange', handleStatusFilter as EventListener);
    window.addEventListener('sidebarDateChange', handleSidebarDateChange as EventListener);
    return () => {
      window.removeEventListener('employeeFilterChange', handleEmployeeFilter as EventListener);
      window.removeEventListener('statusFilterChange', handleStatusFilter as EventListener);
      window.removeEventListener('sidebarDateChange', handleSidebarDateChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearTimeout(t);
      clearInterval(timer);
    };
  }, []);

  // Persist view + date so they survive the salon-switch remount
  useEffect(() => {
    try {
      sessionStorage.setItem('rdv:view', view);
    } catch {}
  }, [view]);
  useEffect(() => {
    try {
      sessionStorage.setItem('rdv:currentDate', currentDate.toISOString());
    } catch {}
  }, [currentDate]);

  // Tell the sidebar this page is mounted so it re-sends the current employee/
  // status filters (needed after a salon switch, where the layout remounts the page).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('rendezVousPageReady'));
  }, []);

  // Appointments state - fetched from API
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // Stable string key for currentDate to use as useEffect dependency
  // (Date objects get new references on every `new Date(...)` call, even with the same value)
  const currentDateKey = useMemo(
    () => `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`,
    [currentDate]
  );

  // Fetch appointments from API based on current view date range
  const fetchAppointments = async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoadingAppointments(true);
      
      // Calculate date range based on current view
      const { startDate, endDate } = getViewDateRange(view, currentDate);
      
      const response = await api.getAppointments({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 1000 // Get all appointments in range
      });
      
      const apiAppointments = response.appointments || [];
      const transformed = apiAppointments.map(transformApiAppointment);
      setAppointments(transformed);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  };
  
  // ─── Backend-provided per-slot availability (agenda shading) ──────────────
  // The “no employee available” strip shading is computed by the backend with
  // the booking solver's own primitives (agenda status -> working hours ->
  // breaks). No client-side reimplementation of working-hours logic.
  const [dayAvailability, setDayAvailability] = useState<Record<string, Record<string, boolean>> | null>(null);

  const fetchDayAvailability = async () => {
    if (!isAuthenticated) return;
    const { startDate, endDate } = getViewDateRange(view, currentDate);
    try {
      const res = await api.getDayAvailability(
        startDate.toISOString().slice(0, 10),
        endDate.toISOString().slice(0, 10)
      );
      setDayAvailability(res.days || {});
    } catch (err) {
      console.error('Error fetching day availability:', err);
      setDayAvailability(null);
    }
  };

  // Fetch appointments when view, date, or salon filter changes
  useEffect(() => {
    fetchAppointments();
    fetchDayAvailability();
  }, [isAuthenticated, view, currentDateKey, salonFilterKey]);

  /** Backend's per-slot map for a given local date, or undefined while loading. */
  const availabilityForDate = (d: Date): Record<string, boolean> | undefined => {
    if (!dayAvailability) return undefined;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return dayAvailability[key];
  };

  /** True when NO employee of the filtered salons works this slot (backend verdict). */
  const hasNoEmployeeAvailable = (d: Date, time: string): boolean => {
    const slots = availabilityForDate(d);
    // Not loaded yet (or fetch failed) — keep the pre-fix all-gray behavior.
    if (!slots) return true;
    return slots[time] !== true;
  };

  // Dispatch event when main calendar date changes to sync sidebar
  useEffect(() => {
    if (mounted) {
      window.dispatchEvent(new CustomEvent('mainCalendarDateChange', { detail: currentDate }));
    }
  }, [currentDate, mounted]);

  // Generate time slots from agendaStart to agendaEnd with 30-min intervals
  const timeSlots = useMemo(() => {
    const [startH, startM] = agendaStart.split(':').map(Number);
    const [endH, endM] = agendaEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const slots: string[] = [];
    for (let m = startMinutes; m < endMinutes; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }
    return slots;
  }, [agendaStart, agendaEnd]);

  // ─── Fresha-style absolute grid metrics ───────────────────────────────────
  // Same scale as the old slot rows: 5rem per 30-minute slot.
  const agendaStartMin = timeToMinutes(agendaStart);
  const agendaEndMin = timeToMinutes(agendaEnd);
  const agendaTotalMin = Math.max(agendaEndMin - agendaStartMin, 60);
  const agendaHeightRem = agendaTotalMin * MINUTE_HEIGHT_REM;
  const minToTopRem = (min: number): number => (min - agendaStartMin) * MINUTE_HEIGHT_REM;

  // Expand the filtered appointments into one card per service, each carrying
  // its own derived start/end time and its performing employee's color.
  const serviceCards = useMemo(() => {
    const base =
      selectedEmployees.length === 0
        ? appointments
        : appointments.filter((a) =>
            selectedEmployees.some((name) => appointmentHasEmployee(a, name))
          );
    const withStatus =
      filterStatus === 'all' ? base : base.filter((a) => a.status === filterStatus);
    return withStatus.flatMap((apt) => expandAppointmentToServiceCards(apt, employeesData));
  }, [appointments, selectedEmployees, filterStatus, employeesData]);

  // Get week days - normalized
  const getWeekDays = () => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      date.setHours(0, 0, 0, 0);
      return date;
    });
  };

  // Week view: lay out each day's cards once and size that day's column from
  // its OWN peak concurrent-lane count × the minimum readable card width — a
  // day with 4 genuinely concurrent bookings gets a 4-lane-wide column, a
  // quiet day stays narrow, and the whole week scrolls horizontally while the
  // time gutter stays pinned on the left.
  const weekDayLayouts = useMemo(() => {
    return getWeekDays().map((date) => {
      const laid = layoutConcurrentCards(
        serviceCards.filter((c) => isSameDay(c.apt.date, date))
      );
      return { date, laid, widthPx: dayColumnWidthPx(laid) };
    });
    // getWeekDays is recreated each render; currentDate is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceCards, currentDate]);

  // Day view: the single day's laid-out cards, computed once and shared by
  // both the column's min-width floor and the render below.
  const dayViewLaid = useMemo(
    () =>
      layoutConcurrentCards(
        serviceCards.filter((c) => isSameDay(c.apt.date, currentDate))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serviceCards, currentDate]
  );
  // The column still grows (flex-1) to fill available space; the floor only
  // guarantees cards are never compressed below the readable minimum.
  const dayViewMinWidthPx = dayColumnWidthPx(dayViewLaid);

  // Get month days - normalized
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    
    const days = [];
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      date.setHours(0, 0, 0, 0);
      days.push(date);
    }
    return days;
  };

  const navigateDate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    newDate.setHours(0, 0, 0, 0);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCurrentDate(today);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, appointment: Appointment) => {
    setDraggedEvent(appointment);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newTime: string, newDate: Date) => {
    e.preventDefault();
    if (!draggedEvent) return;
    
    const normalizedDate = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      newDate.getDate()
    );
    normalizedDate.setHours(0, 0, 0, 0);
    
    const moveTimeData = transformToApiAppointment(draggedEvent, normalizedDate, newTime);

    // A drag-drop move only changes the start time — services and employee
    // assignments are carried over as-is. Sending only identity + time fields
    // keeps the backend from re-validating employee-service compatibility
    // (which would wrongly fail for multi-service appointments that have
    // per-service employees: one employee can't serve all the services).
    const updateData = {
      clientId: moveTimeData.clientId,
      startTime: moveTimeData.startTime,
      status: moveTimeData.status,
      ...(moveTimeData.notes !== undefined ? { notes: moveTimeData.notes } : {}),
      ...(moveTimeData.tenantId ? { tenantId: moveTimeData.tenantId } : {}),
    };

    // Phase 1: dry-run validation — nothing is persisted here. The backend
    // checks client double-bookings, per-employee windows and business hours,
    // returning ALL conflicts. The move is only applied when the user confirms.
    try {
      const result = await api.validateMove(draggedEvent.id, {
        startTime: updateData.startTime,
        ...(updateData.tenantId ? { tenantId: updateData.tenantId } : {}),
      });
      setMoveConfirm({
        id: draggedEvent.id,
        data: updateData,
        conflicts: result?.conflicts ?? [],
      });
      setDraggedEvent(null);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Erreur lors de la vérification du déplacement'));
      setDraggedEvent(null);
    }
  };

  const confirmMove = async () => {
    if (!moveConfirm) return;
    try {
      await api.updateAppointment(moveConfirm.id, { ...moveConfirm.data, source: 'ADMIN' });
      setMoveConfirm(null);
      setDraggedEvent(null);
      await fetchAppointments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erreur lors de la mise à jour du rendez-vous'));
      setMoveConfirm(null);
      setDraggedEvent(null);
    }
  };

  const cancelMove = () => {
    setMoveConfirm(null);
    setDraggedEvent(null);
  };

  // Compute the agenda time under a drop's Y coordinate, snapped to the same
  // 30-minute grid the old slot rows offered, so cards can be dropped anywhere.
  const computeDropTime = (e: React.DragEvent<HTMLDivElement>): string | null => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return null;
    const y = e.clientY - rect.top;
    const ratio = Math.min(Math.max(y / rect.height, 0), 1);
    const minutes = agendaStartMin + ratio * agendaTotalMin;
    const snapped = Math.floor(minutes / 30) * 30;
    const clamped = Math.min(Math.max(snapped, agendaStartMin), Math.max(agendaStartMin, agendaEndMin - 30));
    return minutesToTime(clamped);
  };

  const handleGridDrop = (e: React.DragEvent<HTMLDivElement>, date: Date) => {
    const time = computeDropTime(e);
    if (time) handleDrop(e, time, date);
  };
  
  const handleCreateAppointment = async (appointment: Appointment) => {
    const createData = transformToApiAppointment(appointment, appointment.date, appointment.time);
    await api.createAppointment(createData);
    
    await fetchAppointments();
    setShowNewRDV(false);
  };
  
  const handleUpdateAppointmentStatus = async (
    appointmentOrId: Appointment | string,
    newStatus: string
  ) => {
    const appointment =
      typeof appointmentOrId === 'string'
        ? appointments.find((a) => a.id === appointmentOrId) || null
        : appointmentOrId;
    const appointmentId = typeof appointmentOrId === 'string' ? appointmentOrId : appointmentOrId.id;

    // Terminé → ask caisse first
    if (newStatus === 'completed' && appointment) {
      setFinalizeModal({
        appointment,
        paymentMethod: 'CASH',
        loading: false,
      });
      // Group appointments: check asynchronously whether any participant was
      // already individually invoiced — then "Facturer le groupe" is disabled
      // and only individual encaissement remains (everyone blue).
      if (appointment.bookingGroupId) {
        api
          .getGroupDetails(appointment.bookingGroupId)
          .then((res: any) => {
            const g = res?.group;
            if (!g) return;
            setFinalizeModal((prev) =>
              prev && prev.appointment.id === appointment.id
                ? {
                    ...prev,
                    groupAlreadyInvoiced: !!(g.alreadyInvoiced || g.hasInvoicedAppointment),
                  }
                : prev,
            );
          })
          .catch(() => {
            /* non-blocking: backend still rejects if really invoiced */
          });
      }
      return;
    }

    try {
      const statusMap: Record<string, string> = {
        'pending': 'PENDING',
        'confirmed': 'CONFIRMED',
        'in_progress': 'IN_PROGRESS',
        'completed': 'COMPLETED',
        'cancelled': 'CANCELLED',
        'no_show': 'NO_SHOW'
      };
      
      const statusLabels: Record<string, string> = {
        'pending': 'En attente',
        'confirmed': 'Confirmé',
        'in_progress': 'En cours',
        'completed': 'Terminé',
        'cancelled': 'Annulé',
        'no_show': 'Absent'
      };
      
      await api.updateAppointment(appointmentId, {
        status: statusMap[newStatus] || 'CONFIRMED'
      });
      
      await fetchAppointments();
      toast.success(`Rendez-vous ${statusLabels[newStatus] || 'confirmé'} avec succès`);
    } catch (err) {
      console.error('Error updating appointment status:', err);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const closeFinalizeModal = () => {
    if (finalizeModal?.loading) return;
    setFinalizeModal(null);
  };

  const markAppointmentCompleted = async (appointmentId: string) => {
    await api.updateAppointment(appointmentId, { status: 'COMPLETED' });
    await fetchAppointments();
  };

  const handleFinalizeWithCaisse = async () => {
    if (!finalizeModal) return;
    const apt = finalizeModal.appointment;

    if (!apt.clientId) {
      toast.error('Client manquant — marquage terminé sans caisse');
      setFinalizeModal({ ...finalizeModal, loading: true });
      try {
        await markAppointmentCompleted(apt.id);
        toast.success('Rendez-vous terminé (sans caisse)');
        setFinalizeModal(null);
        setShowDetailsModal(false);
        setSelectedAppointment(null);
      } catch (err) {
        console.error(err);
        toast.error('Erreur lors de la mise à jour du statut');
        setFinalizeModal((prev) => (prev ? { ...prev, loading: false } : null));
      }
      return;
    }

    const servicesForSale = (apt.services && apt.services.length > 0 ? apt.services : []);
    if (servicesForSale.length === 0) {
      toast.error('Service manquant — impossible d’ajouter à la caisse');
      return;
    }

    const items = servicesForSale
      .map((service) => ({
        serviceId: service.serviceId || '',
        price: service.price > 0 ? service.price : undefined,
        quantity: 1,
      }))
      .filter((item) => item.serviceId && item.price !== undefined);

    if (items.length === 0) {
      toast.error('Prix du service manquant. Mettez à jour le catalogue ou encaissez depuis la Caisse.');
      return;
    }

    setFinalizeModal({ ...finalizeModal, loading: true });
    try {
      await api.createSale({
        clientId: apt.clientId,
        items,
        paymentMethod: finalizeModal.paymentMethod,
        notes: servicesForSale.map((service) => service.name).join(', '),
        appointmentId: apt.id,
        ...(apt.tenantId ? { tenantId: apt.tenantId } : {}),
      });
      await markAppointmentCompleted(apt.id);
      toast.success('Rendez-vous terminé et ajouté à la caisse');
      setFinalizeModal(null);
      setShowDetailsModal(false);
      setSelectedAppointment(null);
    } catch (err: any) {
      console.error('Error finalize with caisse:', err);
      toast.error(getApiErrorMessage(err, 'Erreur lors de l’encaissement'));
      setFinalizeModal((prev) => (prev ? { ...prev, loading: false } : null));
    }
  };

  const handleFinalizeWithoutCaisse = async () => {
    if (!finalizeModal) return;
    setFinalizeModal({ ...finalizeModal, loading: true });
    try {
      await markAppointmentCompleted(finalizeModal.appointment.id);
      toast.success('Rendez-vous terminé');
      setFinalizeModal(null);
      setShowDetailsModal(false);
      setSelectedAppointment(null);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la mise à jour du statut');
      setFinalizeModal((prev) => (prev ? { ...prev, loading: false } : null));
    }
  };

  const handleFinalizeGroupSale = async () => {
    if (!finalizeModal) return;
    const apt = finalizeModal.appointment;
    if (!apt.bookingGroupId) return;

    setFinalizeModal({ ...finalizeModal, loading: true });
    try {
      const res = await api.getGroupDetails(apt.bookingGroupId);
      const g = res.group;
      if (!g || !g.participants || g.participants.length === 0) {
        toast.error('Aucun participant trouvé pour ce groupe');
        setFinalizeModal((prev) => (prev ? { ...prev, loading: false } : null));
        return;
      }
      setFinalizeModal(null);
      setGroupReviewModal({
        bookingGroupId: g.groupId,
        bookerClientId: g.bookerClientId,
        participants: g.participants,
        total: g.total,
        paymentMethod: finalizeModal.paymentMethod,
        selectedPayerParticipantId:
          g.participants.find((p) => p.isBooker)?.participantId || g.participants[0]?.participantId || '',
        loading: false,
        loadingMode: null,
        hasInvoicedAppointment: !!g.hasInvoicedAppointment,
      });
    } catch (err: any) {
      console.error('Error loading group details:', err);
      toast.error(getApiErrorMessage(err, 'Erreur lors du chargement du groupe'));
      setFinalizeModal((prev) => (prev ? { ...prev, loading: false } : null));
    }
  };

  const handleGroupReviewConfirmCombined = async () => {
    if (!groupReviewModal) return;
    setGroupReviewModal({ ...groupReviewModal, loading: true, loadingMode: 'combined' });
    try {
      const payerParticipant = groupReviewModal.participants.find(
        (p) => p.participantId === groupReviewModal.selectedPayerParticipantId
      );
      await api.createGroupSale({
        bookingGroupId: groupReviewModal.bookingGroupId,
        payerParticipantId: groupReviewModal.selectedPayerParticipantId,
        payerClientId: payerParticipant?.clientId || undefined,
        paymentMethod: groupReviewModal.paymentMethod,
      });
      toast.success('Groupe facturé et ajouté à la caisse');
      setGroupReviewModal(null);
      setShowDetailsModal(false);
      setSelectedAppointment(null);
      // The group billing marks every participant appointment COMPLETED on the
      // backend — refresh the agenda so no card keeps showing "Terminé". A
      // refresh failure must not surface as a false encaissement error.
      try {
        await fetchAppointments();
      } catch (refreshErr: any) {
        console.error('Agenda refresh after combined group sale:', refreshErr);
      }
    } catch (err: any) {
      console.error('Error group combined sale:', err);
      toast.error(getApiErrorMessage(err, "Erreur lors de l'encaissement du groupe"));
      setGroupReviewModal((prev) => (prev ? { ...prev, loading: false, loadingMode: null } : null));
    }
  };

  const handleGroupReviewSeparate = async () => {
    if (!groupReviewModal) return;
    setGroupReviewModal({ ...groupReviewModal, loading: true, loadingMode: 'separate' });
    try {
      await api.separateGroupSale({
        bookingGroupId: groupReviewModal.bookingGroupId,
        paymentMethod: groupReviewModal.paymentMethod,
      });
      toast.success('Chaque participant a été facturé séparément');
      setGroupReviewModal(null);
      setShowDetailsModal(false);
      setSelectedAppointment(null);
      // Separate billing also marks every participant appointment COMPLETED —
      // refresh the agenda so the cards show the updated status immediately. A
      // refresh failure must not surface as a false billing error.
      try {
        await fetchAppointments();
      } catch (refreshErr: any) {
        console.error('Agenda refresh after separate group sale:', refreshErr);
      }
    } catch (err: any) {
      console.error('Error group separate sale:', err);
      toast.error(getApiErrorMessage(err, "Erreur lors de la facturation séparée"));
      setGroupReviewModal((prev) => (prev ? { ...prev, loading: false, loadingMode: null } : null));
    }
  };

  const handleShowDetails = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };


  if (!mounted) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 via-white to-gray-50 p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-12 rounded-xl w-1/3"></div>
          <div className="bg-gray-200 h-96 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Render agenda cards grouped by booking: single-service bookings render
  // directly; multi-service bookings are wrapped in an auto-sizing frame that
  // hugs the cards tightly instead of stretching to the full lane width.
  const renderAgendaCards = (dayCards: LaidOutServiceCard[], isCompact: boolean, columnWidthPx: number) => {
    const groups = new Map<string, LaidOutServiceCard[]>();
    for (const card of dayCards) {
      const arr = groups.get(card.apt.id);
      if (arr) arr.push(card);
      else groups.set(card.apt.id, [card]);
    }
    const minH = isCompact ? 4 : 5;
    return [...groups.entries()].map(([aptId, grp]) => {
      const sorted = [...grp].sort((a, b) => a.startMin - b.startMin);
      const lane = sorted[0].lane;
      const laneCount = sorted[0].laneCount;
      const startMin = sorted[0].startMin;
      const cardProps = (c: LaidOutServiceCard) => ({
        apt: c.apt,
        serviceCard: c,
        isCompact,
        onDragStart: handleDragStart,
        onStatusUpdate: handleUpdateAppointmentStatus,
        onShowDetails: handleShowDetails,
        employeeColor: c.color,
        showColorInRDV: displaySettings.showColorInRDV,
        displayFields: displaySettings.fields,
        hoveredBookingId,
        onBookingHover: setHoveredBookingId,
      });

      // Pixel-based sizing: lone cards stay at default width, overlapping
      // cards split the column width proportionally.
      const cardWidth = laneCount <= 1 ? MIN_LANE_WIDTH_PX : columnWidthPx / laneCount;
      const cardLeft = laneCount <= 1 ? 0 : lane * (columnWidthPx / laneCount);

      if (sorted.length === 1) {
        const c = sorted[0];
        return (
          <div key={c.key} className="absolute z-10" style={{
            left: `${cardLeft}px`,
            width: `${cardWidth}px`,
            top: `${minToTopRem(c.startMin)}rem`,
            height: `${Math.max(c.duration * MINUTE_HEIGHT_REM, minH)}rem`,
          }}>
            <AppointmentCard {...cardProps(c)} />
          </div>
        );
      }
      // Multi-card: frame wrapper auto-sized around the cards
      return (
        <div key={`grp-${aptId}`} className="absolute z-[8] rounded-lg border border-gray-400/60 bg-gray-400/5 pointer-events-none" style={{
          left: `${cardLeft - 2}px`,
          width: `${cardWidth + 4}px`,
          top: `${minToTopRem(startMin)}rem`,
          padding: '2px',
        }}>
          {sorted.map(c => (
            <div key={c.key} className="pointer-events-auto" style={{ marginBottom: '2px' }}>
              <div style={{ height: `${Math.max(c.duration * MINUTE_HEIGHT_REM, minH)}rem` }}>
                <AppointmentCard {...cardProps(c)} />
              </div>
            </div>
          ))}
        </div>
      );
    });
  };

  return (
    <div suppressHydrationWarning className="min-h-screen p-0 md:p-0">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
      `}</style>	      {/* Header - Ultra Minimalist Premium */}
	      <div className="mb-8 animate-slideDown relative">
        
        <div className="flex items-center justify-between relative z-10">
          {/* Left: Date & Time */}
          <div className="flex items-center gap-8">
            {/* Date Block */}
            <div className="flex items-baseline gap-3">
              <h1 className="text-5xl font-light text-gray-900 tracking-tight">
                {currentDate.getDate().toString().padStart(2, '0')}
              </h1>
              <div className="flex flex-col justify-center">
                <span className="text-sm font-medium text-gray-900">
                  {currentDate.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()}
                </span>
                <span className="text-xs text-gray-400">
                  {currentDate.getFullYear()}
                </span>
              </div>
              <div className="h-12 w-px bg-gray-200 mx-2"></div>
              <div className="flex flex-col justify-center">
                <span className="text-sm font-medium text-gray-900 capitalize">
                  {currentDate.toLocaleDateString('fr-FR', { weekday: 'long' })}
                </span>
                <span className="text-xs text-gray-400">
                  Semaine {Math.ceil((currentDate.getDate() + new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()) / 7)}
                </span>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={goToToday}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Aujourd&apos;hui
              </button>
              <button
                onClick={() => navigateDate(-1)}
                className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => navigateDate(1)}
                className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-6">
            {/* Selected Employee Indicator */}
            {selectedEmployees.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: getSelectedEmployeeColor() || '#3B82F6' }}
                  ></div>
                  <span className="text-xs font-medium text-gray-700">
                    {selectedEmployees.length === 1
                      ? selectedEmployees[0]
                      : `${selectedEmployees.length} employés`}
                  </span>
                </div>
                <div className="h-8 w-px bg-gray-200"></div>
              </>
            )}
            
            {/* Live Time */}
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-light text-gray-900 tabular-nums tracking-tight">
                {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs text-gray-400 tabular-nums">
                :{currentTime.toLocaleTimeString('fr-FR', { second: '2-digit' })}
              </span>
            </div>

            <div className="h-8 w-px bg-gray-200"></div>

            {/* View Toggle */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setView('day')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'day'
                    ? 'text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Jour
              </button>
              <span className="text-gray-300">/</span>
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'week'
                    ? 'text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Semaine
              </button>
              <span className="text-gray-300">/</span>
              <button
                onClick={() => setView('month')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'month'
                    ? 'text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Mois
              </button>
            </div>

            <div className="h-8 w-px bg-gray-200"></div>

            {/* CTA */}
            <button
              onClick={() => {
                setNewRdvInitialDate(new Date());
                setNewRdvInitialTime('');
                setShowNewRDV(true);
              }}
              className="px-5 py-2 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              Nouveau
              <Plus size={16} className="inline-block ml-2 -mt-0.5" />
            </button>
	          </div>
	        </div>
	      </div>

	      {/* Calendar Views */}
      <div key={refreshKey} className="overflow-hidden animate-fadeIn">
        {view === 'week' && (
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-100 shadow-sm">
            <div style={{ minWidth: `${56 + weekDayLayouts.reduce((sum, d) => sum + d.widthPx, 0)}px` }}>
              {/* Header */}
              <div className="flex border-b border-gray-100">
                <div className="sticky left-0 z-30 w-14 shrink-0 border-r border-gray-100 bg-white"></div>
                {weekDayLayouts.map(({ date, widthPx }, i) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={i}
                      className="border-r border-gray-100 last:border-r-0 p-4 text-center"
                      style={{ flexGrow: 1, flexShrink: 0, flexBasis: `${widthPx}px` }}
                    >
                      <div className={`text-xs font-medium uppercase tracking-wider mb-2 ${isToday ? 'text-gray-900' : 'text-gray-400'}`}>
                        {date.toLocaleDateString('fr-FR', { weekday: 'short' })}
                      </div>
                      <div className={`text-xl font-light ${
                        isToday 
                          ? 'w-8 h-8 mx-auto rounded-full bg-[#002366] text-white flex items-center justify-center' 
                          : 'text-gray-900'
                      }`}>
                        {date.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Body: time gutter + day columns */}
              <div className="flex">
                {/* Time gutter (sticky while the day columns scroll horizontally) */}
                <div
                  className="sticky left-0 z-30 w-14 shrink-0 relative border-r border-gray-100 bg-white"
                  style={{ height: `${agendaHeightRem}rem` }}
                >
                  {timeSlots.map((time) => (
                    <div
                      key={time}
                      className="absolute right-2 text-[10px] font-light text-gray-400 tabular-nums"
                      style={{ top: `${minToTopRem(timeToMinutes(time))}rem` }}
                    >
                      {time}
                    </div>
                  ))}
                </div>

                {weekDayLayouts.map(({ date, laid: dayCards, widthPx }, i) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  const nowMin = isToday ? getMoroccoNowMin() : null;
                  const cellStyle = getCalendarCellStyle();
                  return (
                    <div
                      key={i}
                      className="relative border-r border-gray-100 last:border-r-0 overflow-hidden"
                      style={{
                        flexGrow: 1,
                        flexShrink: 0,
                        width: `${widthPx}px`,
                        height: `${agendaHeightRem}rem`,
                      }}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleGridDrop(e, date)}
                    >
                      {/* 30-min strips: availability shading + quick create */}
                      {timeSlots.map((time) => {
                        const isNoEmployee = hasNoEmployeeAvailable(date, time);
                        return (
                          <div
                            key={time}
                            className={`absolute left-0 right-0 group/strip ${
                              isNoEmployee ? 'bg-gray-50/60' : ''
                            }`}
                            style={{
                              top: `${minToTopRem(timeToMinutes(time))}rem`,
                              height: '5rem',
                              ...(selectedEmployees.length === 1 && cellStyle.backgroundColor && !isNoEmployee
                                ? { backgroundColor: cellStyle.backgroundColor }
                                : {}),
                            }}
                          >
                            <button
                              onClick={() => {
                                setNewRdvInitialDate(date);
                                setNewRdvInitialTime(time);
                                setShowNewRDV(true);
                              }}
                              className={`absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-gray-100 text-gray-400 transition-all hover:bg-gray-200 hover:text-gray-600 ${hoveredBookingId ? 'pointer-events-none opacity-0' : 'opacity-0 group-hover/strip:opacity-100'}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        );
                      })}

                      {/* 30-min grid lines */}
                      {timeSlots.map((time) => (
                        <div
                          key={`line-${time}`}
                          className="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
                          style={{ top: `${minToTopRem(timeToMinutes(time))}rem` }}
                        />
                      ))}

                      {renderAgendaCards(dayCards, true, widthPx)}

                      {/* Now line */}
                      {nowMin != null && nowMin >= agendaStartMin && nowMin <= agendaEndMin && (
                        <div
                          className="absolute left-0 right-0 z-20 pointer-events-none"
                          style={{ top: `${minToTopRem(nowMin)}rem` }}
                        >
                          <div className="relative border-t-2 border-red-400">
                            <div className="absolute -left-0.5 -top-[5px] w-2 h-2 rounded-full bg-red-400"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'day' && (
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-100 shadow-sm">
            <div className="flex">
              {/* Time gutter (sticky while the day column scrolls horizontally) */}
              <div
                className="sticky left-0 z-30 w-14 shrink-0 relative border-r border-gray-100 bg-white"
                style={{ height: `${agendaHeightRem}rem` }}
              >
                {timeSlots.map((time) => (
                  <div
                    key={time}
                    className="absolute right-2 text-[10px] font-light text-gray-400 tabular-nums -translate-y-1/2"
                    style={{ top: `${minToTopRem(timeToMinutes(time))}rem` }}
                  >
                    {time}
                  </div>
                ))}
              </div>

              {/* Day column */}
              <div
                className="relative overflow-hidden shrink-0"
                style={{ height: `${agendaHeightRem}rem`, width: `${dayViewMinWidthPx}px` }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleGridDrop(e, currentDate)}
              >
                {/* 30-min strips: availability shading + quick create */}
                {timeSlots.map((time) => {
                  const isNoEmployee = hasNoEmployeeAvailable(currentDate, time);
                  const cellStyle = getCalendarCellStyle();
                  return (
                    <div
                      key={time}
                      className={`absolute left-0 right-0 group/strip ${
                        isNoEmployee ? 'bg-gray-50/50' : ''
                      }`}
                      style={{
                        top: `${minToTopRem(timeToMinutes(time))}rem`,
                        height: '5rem',
                        ...(selectedEmployees.length === 1 && cellStyle.backgroundColor && !isNoEmployee
                          ? { backgroundColor: cellStyle.backgroundColor }
                          : {}),
                      }}
                    >
                      <button
                        onClick={() => {
                          setNewRdvInitialDate(currentDate);
                          setNewRdvInitialTime(time);
                          setShowNewRDV(true);
                        }}
                        className={`absolute right-2 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-400 transition-all hover:bg-gray-200 hover:text-gray-600 ${hoveredBookingId ? 'pointer-events-none opacity-0' : 'opacity-0 group-hover/strip:opacity-100'}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  );
                })}

                {/* 30-min grid lines */}
                {timeSlots.map((time) => (
                  <div
                    key={`line-${time}`}
                    className="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
                    style={{ top: `${minToTopRem(timeToMinutes(time))}rem` }}
                  />
                ))}

{renderAgendaCards(dayViewLaid, false, dayViewMinWidthPx)}

                {/* Now line (only on today) */}
                {isSameDay(currentDate, new Date()) &&
                  (() => {
                    const nowMin = getMoroccoNowMin();
                    return nowMin >= agendaStartMin && nowMin <= agendaEndMin ? (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none"
                        style={{ top: `${minToTopRem(nowMin)}rem` }}
                      >
                        <div className="relative border-t-2 border-red-400">
                          <div className="absolute -left-0.5 -top-[5px] w-2 h-2 rounded-full bg-red-400"></div>
                        </div>
                      </div>
                    ) : null;
                  })()}
              </div>
            </div>
          </div>
        )}

        {view === 'month' && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            {/* Month Header */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider py-4 border-r border-gray-100 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {getMonthDays().map((date, i) => {
                if (!date) return (
                  <div 
                    key={i} 
                    className="min-h-[140px] bg-gray-50/30 border-r border-b border-gray-100"
                  ></div>
                );
                const isToday = date.toDateString() === new Date().toDateString();
                const dayCards = serviceCards.filter((c) => isSameDay(c.apt.date, date));
                const confirmedCount = dayCards.filter(c => c.apt.status === 'confirmed').length;
                const pendingCount = dayCards.filter(c => c.apt.status === 'pending').length;
                const cancelledCount = dayCards.filter(c => c.apt.status === 'cancelled').length;
                const cellStyle = getCalendarCellStyle();
                // Blend employee color with today's background if applicable
                const finalStyle = isToday && cellStyle.backgroundColor 
                  ? { 
                      ...cellStyle, 
                      backgroundColor: cellStyle.backgroundColor.replace('0.05', '0.08') // Slightly more opaque for today
                    }
                  : cellStyle;
                return (
                  <div
                    key={i}
                    className={`min-h-[140px] border-r border-b border-gray-100 p-2 hover:bg-gray-50/50 transition-all group/date relative ${
                      isToday && !cellStyle.backgroundColor ? 'bg-gray-50/50' : ''
                    }`}
                    style={finalStyle}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, dayCards.length > 0 ? dayCards[0].startLabel : '09:00', date)}
                  >
                    <button
                      onClick={() => {
                        setNewRdvInitialDate(date);
                        setNewRdvInitialTime('');
                        setShowNewRDV(true);
                      }}
                      className="absolute bottom-2 right-2 w-5 h-5 rounded-md bg-white border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 hover:border-gray-300 flex items-center justify-center opacity-0 group-hover/date:opacity-100 transition-all z-20 shadow-sm"
                    >
                      <Plus size={12} />
                    </button>
                    {/* Date Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-sm font-light ${
                        isToday 
                          ? 'w-6 h-6 rounded-full bg-[#002366] text-white flex items-center justify-center text-xs font-medium' 
                          : 'text-gray-600'
                      }`}>
                        {date.getDate()}
                      </div>
                      {dayCards.length > 0 && (
                        <div className="flex items-center gap-0.5">
                          <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                          <span className="text-[10px] font-medium text-gray-400">
                            {dayCards.length}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Appointments - one compact card per service, grouped per booking */}
                    <div className="space-y-1">
                      {(() => {
                        // Group consecutive cards belonging to the same original booking
                        const groups: { aptId: string; cards: ServiceCardData[] }[] = [];
                        for (const card of dayCards) {
                          const last = groups[groups.length - 1];
                          if (last && last.aptId === card.apt.id) last.cards.push(card);
                          else groups.push({ aptId: card.apt.id, cards: [card] });
                        }
                        // Keep whole bookings intact but cap density: always show the
                        // first group, then add groups while the card count stays <= 3.
                        const visible: { aptId: string; cards: ServiceCardData[] }[] = [];
                        let visibleCount = 0;
                        for (const g of groups) {
                          if (visible.length > 0 && visibleCount >= 3) break;
                          visible.push(g);
                          visibleCount += g.cards.length;
                        }
                        const hiddenCount = dayCards.length - visibleCount;
                        const renderCard = (card: ServiceCardData) => (
                          <AppointmentCard
                            key={card.key}
                            apt={card.apt}
                            serviceCard={card}
                            isCompact
                            onDragStart={handleDragStart}
                            onStatusUpdate={handleUpdateAppointmentStatus}
                            onShowDetails={handleShowDetails}
                            employeeColor={card.color}
                            showColorInRDV={displaySettings.showColorInRDV}
                            displayFields={displaySettings.fields}
                            hoveredBookingId={hoveredBookingId}
                            onBookingHover={setHoveredBookingId}
                          />
                        );
                        return (
                          <>
                            {visible.map((g) =>
                              g.cards.length > 1 ? (
                                <div
                                  key={g.aptId}
                                  className="rounded-md border border-gray-300 bg-gray-50/60 p-1 space-y-1"
                                >
                                  {g.cards.map(renderCard)}
                                </div>
                              ) : (
                                <React.Fragment key={g.aptId}>{g.cards.map(renderCard)}</React.Fragment>
                              )
                            )}
                            {/* More indicator */}
                            {hiddenCount > 0 && (
                              <div className="text-[10px] text-gray-500 font-medium px-1.5 py-1 hover:text-gray-900 transition-colors">
                                +{hiddenCount} autre{hiddenCount > 1 ? 's' : ''}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Status Summary (on hover) */}
                    {dayCards.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2 text-[9px] font-medium">
                          {confirmedCount > 0 && (
                            <div className="flex items-center gap-1 text-emerald-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                              <span>{confirmedCount}</span>
                            </div>
                          )}
                          {pendingCount > 0 && (
                            <div className="flex items-center gap-1 text-amber-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                              <span>{pendingCount}</span>
                            </div>
                          )}
                          {cancelledCount > 0 && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                              <span>{cancelledCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showNewRDV && (
        <NewAppointmentModal 
          onClose={() => setShowNewRDV(false)} 
          onCreateAppointment={handleCreateAppointment}
          employeesData={employeesData}
          servicesData={services}
          initialDate={newRdvInitialDate}
          initialTime={newRdvInitialTime}
          agendaStart={agendaStart}
          agendaEnd={agendaEnd}
        />
      )}

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 z-40 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Détails du rendez-vous</h2>
              <button 
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedAppointment(null);
                }} 
                className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-6 space-y-6">
              {/* Client Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Client</h3>
                <div className="space-y-2">
                  <p className="text-base font-medium text-gray-900">{selectedAppointment.clientName}</p>
                  {selectedAppointment.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone size={16} />
                      <a href={`tel:${selectedAppointment.phone}`} className="hover:text-gray-900">{selectedAppointment.phone}</a>
                    </div>
                  )}
                  {selectedAppointment.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail size={16} />
                      <a href={`mailto:${selectedAppointment.email}`} className="hover:text-gray-900">{selectedAppointment.email}</a>
                    </div>
                  )}
                </div>
              </div>

              {/* Appointment Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Rendez-vous</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar size={16} />
                    <span>{format(selectedAppointment.date, "EEEE d MMMM yyyy", { locale: fr })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock size={16} />
                    <span>{selectedAppointment.time} → {selectedAppointment.endTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User size={16} />
                    <span>{getAppointmentEmployeeLabel(selectedAppointment)}</span>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Services</h3>
                <div className="space-y-2">
                  {(selectedAppointment.services && selectedAppointment.services.length > 0 ? selectedAppointment.services : [{ name: selectedAppointment.service, duration: selectedAppointment.duration, price: selectedAppointment.totalPrice ?? selectedAppointment.servicePrice ?? 0, sortOrder: 0 }]).map((service, index) => {
                    const empName = service.employee ? `${service.employee.firstName} ${service.employee.lastName}` : null;
                    return (
                    <div key={`${service.name}-${index}`} className="flex items-start justify-between rounded-lg border border-gray-100 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{service.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{service.duration} min</span>
                          {empName && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1"><User size={11} />{empName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{service.price} MAD</p>
                    </div>
                    );
                  })}
                </div>
                {(selectedAppointment.totalDuration || selectedAppointment.totalPrice) && (
                  <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <div className="flex items-center justify-between">
                      <span>Durée totale</span>
                      <span>{selectedAppointment.totalDuration ?? selectedAppointment.duration} min</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span>Prix total</span>
                      <span>{selectedAppointment.totalPrice ?? selectedAppointment.servicePrice ?? 0} MAD</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Statut</h3>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  selectedAppointment.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' :
                  selectedAppointment.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                  selectedAppointment.status === 'cancelled' ? 'bg-gray-50 text-gray-500' :
                  selectedAppointment.status === 'completed' ? 'bg-blue-50 text-blue-700' :
                  'bg-gray-50 text-gray-900'
                }`}>
                  {selectedAppointment.status === 'confirmed' ? 'Confirmé' :
                   selectedAppointment.status === 'pending' ? 'En attente' :
                   selectedAppointment.status === 'cancelled' ? 'Annulé' :
                   selectedAppointment.status === 'completed' ? 'Terminé' :
                   selectedAppointment.status === 'in_progress' ? 'En cours' :
                   selectedAppointment.status === 'no_show' ? 'Absent' :
                   selectedAppointment.status}
                </span>
              </div>

              {/* Notes */}
              {selectedAppointment.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Notes</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex flex-wrap gap-3">
              <button 
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedAppointment(null);
                }} 
                className="flex-1 min-w-[100px] px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-full border border-gray-200 hover:border-gray-300"
              >
                Fermer
              </button>
              {canConfirmStatus(selectedAppointment.status) && (
                <button 
                  onClick={async () => {
                    await handleUpdateAppointmentStatus(selectedAppointment, 'confirmed');
                    setShowDetailsModal(false);
                    setSelectedAppointment(null);
                  }} 
                  className="flex-1 min-w-[100px] px-6 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-full hover:bg-emerald-700 transition-colors"
                >
                  Confirmer
                </button>
              )}
              {canMarkAbsentOrDone(selectedAppointment.status) && (
                <>
                  <button
                    onClick={() => {
                      handleUpdateAppointmentStatus(selectedAppointment, 'completed');
                    }}
                    className="flex-1 min-w-[100px] px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors"
                  >
                    Terminé
                  </button>
                  <button
                    onClick={async () => {
                      await handleUpdateAppointmentStatus(selectedAppointment, 'no_show');
                      setShowDetailsModal(false);
                      setSelectedAppointment(null);
                    }}
                    className="flex-1 min-w-[100px] px-6 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-full hover:bg-orange-600 transition-colors"
                  >
                    Absent
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finaliser RDV → Caisse */}
      {finalizeModal && (
        <div
          className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
          onClick={closeFinalizeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Finaliser le rendez-vous</h2>
              <p className="text-sm text-gray-600 mt-1">
                Voulez-vous ajouter cette prestation à la caisse ?
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {finalizeModal.appointment.clientName} · {finalizeModal.appointment.services && finalizeModal.appointment.services.length > 1
                  ? `${finalizeModal.appointment.services.length} services • ${finalizeModal.appointment.duration} min`
                  : finalizeModal.appointment.service}
                {finalizeModal.appointment.totalPrice
                  ? ` · ${finalizeModal.appointment.totalPrice} MAD`
                  : ''}
              </p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Mode de paiement
              </label>
              <Select
                value={finalizeModal.paymentMethod}
                disabled={finalizeModal.loading}
                onValueChange={(v) =>
                  setFinalizeModal((prev) =>
                    prev ? { ...prev, paymentMethod: v as FinalizePaymentMethod } : null
                  )
                }
              >
                <SelectTrigger className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
                  <SelectValue placeholder="Mode de paiement" />
                </SelectTrigger>
                <SelectContent>
                  {getPaymentMethodOptions(acceptedPaymentMethods).map(({ method, value }) => (
                    <SelectItem key={value} value={value}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-2">
              {finalizeModal.appointment.bookingGroupId && (finalizeModal.appointment.bookingGroupParticipantCount ?? 0) > 1 && (
                <button
                  type="button"
                  disabled={finalizeModal.loading || finalizeModal.groupAlreadyInvoiced}
                  onClick={handleFinalizeGroupSale}
                  className="w-full px-4 py-2.5 rounded-full text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {finalizeModal.loading
                    ? 'Traitement…'
                    : finalizeModal.groupAlreadyInvoiced
                      ? 'Facturer le groupe indisponible — encaissement individuel'
                      : 'Facturer le groupe'}
                </button>
              )}
              <button
                type="button"
                disabled={finalizeModal.loading}
                onClick={handleFinalizeWithCaisse}
                className="w-full px-4 py-2.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {finalizeModal.loading ? 'Traitement…' : 'Ajouter à la caisse'}
              </button>
              <button
                type="button"
                disabled={finalizeModal.loading}
                onClick={handleFinalizeWithoutCaisse}
                className="w-full px-4 py-2.5 rounded-full text-sm font-medium text-gray-800 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Terminé sans caisse
              </button>
              <button
                type="button"
                disabled={finalizeModal.loading}
                onClick={closeFinalizeModal}
                className="w-full px-4 py-2.5 rounded-full text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Review Modal */}
      {groupReviewModal && (
        <div
          className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
          onClick={() => { if (!groupReviewModal.loading) setGroupReviewModal(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Facturer le groupe</h2>
              <p className="text-sm text-gray-600 mt-1">
                Vérifiez les prestations de chaque participant avant de facturer.
              </p>
            </div>

            <div className="px-6 py-4 overflow-y-auto flex-1">
              {groupReviewModal.participants.map((p, idx) => (
                <div key={p.participantId} className={`${idx > 0 ? 'mt-4 pt-4 border-t border-gray-100' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{p.displayName}</span>
                      {p.isBooker && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">Organisateur</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{p.subtotal.toFixed(2)} MAD</span>
                  </div>
                  {p.services.map((svc, sIdx) => (
                    <div key={sIdx} className="flex items-center justify-between text-xs text-gray-600 pl-8 py-0.5">
                      <span>{svc.serviceName}{svc.employee ? ` — ${svc.employee.firstName} ${svc.employee.lastName}` : ''}</span>
                      <span>{svc.price.toFixed(2)} MAD</span>
                    </div>
                  ))}
                </div>
              ))}

              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="text-base font-bold text-gray-900">{groupReviewModal.total.toFixed(2)} MAD</span>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Qui paie la facture ?
                </label>
                <div className="space-y-2">
                  {groupReviewModal.participants.map((p) => (
                    <label
                      key={p.participantId}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        groupReviewModal.selectedPayerParticipantId === p.participantId
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="group-payer"
                        checked={groupReviewModal.selectedPayerParticipantId === p.participantId}
                        disabled={groupReviewModal.loading}
                        onChange={() => setGroupReviewModal((prev) => prev ? { ...prev, selectedPayerParticipantId: p.participantId } : null)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm text-gray-900">{p.displayName}</span>
                      {p.isBooker && <span className="text-[10px] text-gray-400">(organisateur)</span>}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Mode de paiement
                </label>
                <Select
                  value={groupReviewModal.paymentMethod}
                  disabled={groupReviewModal.loading}
                  onValueChange={(v) =>
                    setGroupReviewModal((prev) => prev ? { ...prev, paymentMethod: v as FinalizePaymentMethod } : null)
                  }
                >
                  <SelectTrigger className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
                    <SelectValue placeholder="Mode de paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    {getPaymentMethodOptions(acceptedPaymentMethods).map(({ method, value }) => (
                      <SelectItem key={value} value={value}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="px-6 pb-6 flex flex-col gap-2 flex-shrink-0">
              {groupReviewModal.hasInvoicedAppointment && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Un participant a déjà été encaissé individuellement : la facturation
                  du groupe n'est plus possible, encaissez chaque participant un par un.
                </p>
              )}
              <button
                type="button"
                disabled={groupReviewModal.loading || !groupReviewModal.selectedPayerParticipantId || groupReviewModal.hasInvoicedAppointment}
                onClick={handleGroupReviewConfirmCombined}
                className="w-full px-4 py-2.5 rounded-full text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {groupReviewModal.loadingMode === 'combined' ? 'Traitement…' : 'Confirmer — facturer au participant sélectionné'}
              </button>
              <button
                type="button"
                disabled={groupReviewModal.loading || groupReviewModal.hasInvoicedAppointment}
                onClick={handleGroupReviewSeparate}
                className="w-full px-4 py-2.5 rounded-full text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {groupReviewModal.loadingMode === 'separate' ? 'Traitement…' : 'Facturer séparément (chaque participant)'}
              </button>
              <button
                type="button"
                disabled={groupReviewModal.loading}
                onClick={() => setGroupReviewModal(null)}
                className="w-full px-4 py-2.5 rounded-full text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move confirmation dialog */}
      {moveConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 space-y-4">
            {moveConfirm.conflicts.length === 0 ? (
              <>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  <h3 className="text-base font-semibold text-gray-900">Pas de conflit</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Ce créneau est disponible. Confirmer la mise à jour du rendez-vous&nbsp;?
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={cancelMove}
                    className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmMove}
                    className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
                  >
                    Confirmer la mise à jour
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                  <h3 className="text-base font-semibold text-gray-900">Conflit détecté</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Déplacer ce rendez-vous vers ce créneau créera un conflit&nbsp;:
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {moveConfirm.conflicts.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm text-gray-500">
                  Êtes-vous sûr de vouloir continuer&nbsp;?
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={cancelMove}
                    className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Non, annuler
                  </button>
                  <button
                    onClick={confirmMove}
                    className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors"
                  >
                    Oui, déplacer quand même
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RendezVousPage;