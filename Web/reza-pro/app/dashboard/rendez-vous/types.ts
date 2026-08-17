// Shared types for the rendez-vous (agenda) module — used by page.tsx,
// NewAppointmentModal.tsx and AppointmentCard.tsx.

// API Appointment type
export type ApiAppointment = {
  id: string;
  tenantId: string;
  clientId: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string | null;
  cancelledBy?: string | null;
  services?: Array<{
    id?: string;
    serviceId?: string | null;
    name: string;
    serviceName: string;
    duration: number;
    price: number;
    sortOrder: number;
    employee?: { id: string; firstName: string; lastName: string } | null;
  }>;
  totalDuration?: number;
  totalPrice?: number;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  bookingParticipant?: {
    displayName: string;
    clientId?: string | null;
  } | null;
  bookingGroup?: {
    id: string;
    _count?: { participants: number };
  } | null;
};

// Frontend Appointment type
export type Appointment = {
  id: string;
  clientName: string;
  service: string;
  services?: Array<{
    id?: string;
    serviceId?: string | null;
    name: string;
    duration: number;
    price: number;
    sortOrder: number;
    employee?: { id: string; firstName: string; lastName: string } | null;
  }>;
  time: string;
  endTime: string;
  duration: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'in_progress' | 'completed' | 'no_show' | string;
  employee: string;
  phone?: string;
  email?: string;
  date: Date;
  notes?: string;
  cancelledByClient?: boolean;
  // API IDs for updates
  clientId?: string;
  serviceId?: string;
  serviceIds?: string[];
  employeeId?: string | null;
  /** Required on create when multi-salon filter is active */
  tenantId?: string;
  /** Catalog price snapshot for caisse */
  servicePrice?: number | null;
  totalDuration?: number;
  totalPrice?: number;
  /** Per-service employee assignments for creation */
  servicesPayload?: Array<{ serviceId: string; employeeId: string | null }>;
  /** Booking group ID for group bookings */
  bookingGroupId?: string;
  /** Number of participants in the booking group (from _count.participants) */
  bookingGroupParticipantCount?: number;
};

export type FinalizePaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHECK';

export type FinalizeModalState = {
  appointment: Appointment;
  paymentMethod: FinalizePaymentMethod;
  loading: boolean;
  /** Group billing is off the table once any participant was invoiced individually. */
  groupAlreadyInvoiced?: boolean;
};

export type GroupReviewParticipant = {
  participantId: string;
  clientId: string | null;
  displayName: string;
  isBooker: boolean;
  services: Array<{
    serviceId: string | null;
    serviceName: string;
    price: number;
    duration: number | null;
    employee: { id: string; firstName: string; lastName: string } | null;
  }>;
  subtotal: number;
};

export type GroupReviewModalState = {
  bookingGroupId: string;
  bookerClientId: string;
  participants: GroupReviewParticipant[];
  total: number;
  paymentMethod: FinalizePaymentMethod;
  /** Unique participant id of the payer — NOT clientId, since two participants
   *  can share a client record (guest merged onto booker's client via phone). */
  selectedPayerParticipantId: string;
  loading: boolean;
  loadingMode: 'combined' | 'separate' | null;
  /** Any participant appointment already individually invoiced → group billing blocked. */
  hasInvoicedAppointment?: boolean;
};

export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status?: string;
  address?: string;
  avatar?: string | null;
};

export type ServiceCardData = {
  key: string;
  apt: Appointment;
  serviceIndex: number; // 0-based position within the booking
  serviceCount: number; // total services in the booking
  serviceName: string;
  duration: number;
  startMin: number; // minutes since midnight (Morocco wall time)
  endMin: number;
  startLabel: string;
  endLabel: string;
  employeeName: string;
  employeeId: string | null;
  color: string; // resolved employee color
};

// Plan types matching backend scheduling.service.ts
export type PlanEmployeeAvailability = {
  employeeId: string;
  employeeName: string;
  available: boolean;
  recommended: boolean;
  reason?: string;
};

export type PlanServiceAssignment = {
  serviceId: string;
  serviceName: string;
  duration: number;
  employeeId: string | null;
  employeeName: string;
};

export type PlanAlert = {
  severity: 'warning' | 'conflict';
  type: string;
  message: string;
};

export type PlanResult = {
  estimatedEndTime: string;
  recommendedAssignment: PlanServiceAssignment[];
  services: Array<{
    serviceId: string;
    serviceName: string;
    duration: number;
    employees: PlanEmployeeAvailability[];
  }>;
  alerts: PlanAlert[];
  clientAlerts: Record<string, PlanAlert[]>;
};
