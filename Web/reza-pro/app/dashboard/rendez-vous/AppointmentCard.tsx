'use client';

import React, { useState } from 'react';
import { Calendar, Clock, User, Phone, Mail, X, ChevronLeft, ChevronRight, MoreVertical, Plus, CalendarIcon, MapPin, Check, UserX, Flag, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn, getImageUrl } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Appointment, Client, ServiceCardData } from './types';

const canConfirmStatus = (status: string) => status === 'pending';
const canMarkAbsentOrDone = (status: string) =>
  status === 'pending' || status === 'confirmed' || status === 'in_progress';

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
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

interface AppointmentCardProps {
  apt: Appointment;
  isCompact?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, appointment: Appointment) => void;
  onStatusUpdate?: (appointment: Appointment, newStatus: string) => void;
  onShowDetails?: (appointment: Appointment) => void;
  employeeColor?: string;
  serviceColor?: string;
  showColorInRDV?: boolean;
  displayFields?: Array<{ id: string; label: string; visible: boolean; order: number }>;
  /** Per-service card data (one card per service of a multi-service booking). */
  serviceCard?: ServiceCardData;
  /** Id of the booking currently hovered in the agenda → highlight all its cards. */
  hoveredBookingId?: string | null;
  onBookingHover?: (id: string | null) => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ 
  apt, 
  isCompact = false, 
  onDragStart,
  onStatusUpdate,
  onShowDetails,
  employeeColor,
  serviceColor,
  showColorInRDV = true,
  displayFields = [
    { id: 'hours', label: 'Horaires', visible: true, order: 1 },
    { id: 'clientName', label: 'Nom du client', visible: true, order: 2 },
    { id: 'services', label: 'Prestation(s)', visible: true, order: 3 },
    { id: 'notes', label: 'Titre ou note', visible: true, order: 4 },
  ],
  serviceCard,
  hoveredBookingId,
  onBookingHover,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusBg = (status: string) => {
    // If showColorInRDV is false, use status colors
    if (!showColorInRDV) {
      switch (status) {
        case 'confirmed': return 'bg-emerald-50 border-emerald-200 text-emerald-900';
        case 'pending': return 'bg-amber-50 border-amber-200 text-amber-900';
        case 'cancelled': return 'bg-gray-50 border-gray-200 text-gray-500';
        default: return 'bg-gray-50 border-gray-200 text-gray-900';
      }
    }
    return '';
  };

  // Per-service card, or a legacy fallback derived from the appointment itself.
  const card: ServiceCardData = serviceCard ?? {
    key: apt.id,
    apt,
    serviceIndex: 0,
    serviceCount: 1,
    serviceName: apt.service,
    duration: apt.duration,
    startMin: timeToMinutes(apt.time),
    endMin: timeToMinutes(apt.time) + (apt.duration || 0),
    startLabel: apt.time,
    endLabel: apt.endTime,
    employeeName: getAppointmentEmployeeLabel(apt),
    employeeId: apt.employeeId ?? null,
    color: employeeColor || serviceColor || '#3B82F6',
  };

  const color = card.color;
  // Hover identity: all cards of the same booking group (group appointment) or
  // the same appointment (multi-service) highlight together. Group participants
  // each carry their own appointment id, so the group id is the shared key.
  const hoverKey = apt.bookingGroupId || apt.id;
  const isSiblingHovered = hoveredBookingId != null && hoveredBookingId === hoverKey;

  // Generate lighter background and border colors from the main color.
  // The background is OPAQUE (solid pastel blended toward white) so the agenda
  // grid lines / strip shading behind the card never show through it — the
  // old rgba(…, 0.1) was translucent and let the grid lines render inside the card.
  const getLightColorStyle = (color: string) => {
    if (!showColorInRDV) return {};
    
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    
    const blend = (c: number, w: number) => Math.round(c * (1 - w) + 255 * w);
    return {
      backgroundColor: `rgb(${blend(r, 0.88)}, ${blend(g, 0.88)}, ${blend(b, 0.88)})`,
      borderColor: `rgb(${blend(r, 0.72)}, ${blend(g, 0.72)}, ${blend(b, 0.72)})`,
    };
  };

  // Get visible fields sorted by order
  const visibleFields = displayFields
    .filter(f => f.visible)
    .sort((a, b) => a.order - b.order);
  const hoursVisible = visibleFields.some(f => f.id === 'hours');
  const clientVisible = visibleFields.some(f => f.id === 'clientName');
  const serviceVisible = visibleFields.some(f => f.id === 'services');
  const notesVisible = visibleFields.some(f => f.id === 'notes');
  const multiService = card.serviceCount > 1;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, apt)}
      onMouseEnter={() => onBookingHover?.(hoverKey)}
      onMouseLeave={() => onBookingHover?.(null)}
      className={cn(
        'relative rounded-lg cursor-move border transition-all overflow-hidden w-fit h-full',
        getStatusBg(apt.status),
        isCompact ? 'text-xs' : 'text-sm',
        isSiblingHovered ? 'shadow-md ring-2 ring-gray-900/15' : 'hover:shadow-md',
      )}
      style={showColorInRDV ? getLightColorStyle(color) : {}}
    >
      {/* Left accent bar in the employee's color */}
      {showColorInRDV && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: color }} />
      )}

      <div className={cn('flex flex-col min-w-0', isCompact ? 'pl-2 pr-1 py-1' : 'pl-2.5 pr-1.5 py-1.5')}>
        {/* Top row: per-service time range + actions */}
        <div className="flex items-start justify-between gap-1">
          {hoursVisible && (
            <div className="flex items-center gap-1 text-[11px] leading-tight text-gray-500 min-w-0">
              <Clock size={12} className="shrink-0" />
              <span className="tabular-nums whitespace-nowrap">{card.startLabel} → {card.endLabel}</span>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {!isCompact && canConfirmStatus(apt.status) && onStatusUpdate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusUpdate(apt, 'confirmed');
                }}
                className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
                title="Confirmer le rendez-vous"
              >
                Confirmer
              </button>
            )}
            <Popover open={showMenu} onOpenChange={setShowMenu}>
              <PopoverTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(true);
                  }}
                  className="p-1 opacity-40 hover:opacity-100 transition-opacity"
                >
                  <MoreVertical size={isCompact ? 12 : 14} />
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-48 p-1" 
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                {canConfirmStatus(apt.status) && onStatusUpdate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusUpdate(apt, 'confirmed');
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 rounded transition-colors flex items-center gap-2"
                  >
                    <Check size={14} />
                    Confirmer
                  </button>
                )}
                {canMarkAbsentOrDone(apt.status) && onStatusUpdate && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusUpdate(apt, 'completed');
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded transition-colors flex items-center gap-2"
                    >
                      <Flag size={14} />
                      Terminé
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusUpdate(apt, 'no_show');
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-orange-700 hover:bg-orange-50 rounded transition-colors flex items-center gap-2"
                    >
                      <UserX size={14} />
                      Absent
                    </button>
                  </>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    if (onShowDetails) {
                      onShowDetails(apt);
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
                >
                  Détails
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Client name — bold */}
        {clientVisible && (
          <p className="font-semibold text-gray-900 truncate leading-tight mt-0.5">{apt.clientName}</p>
        )}

        {/* Service name (+ booking chip in compact mode) */}
        {serviceVisible && (
          <p className="text-xs text-gray-600 truncate leading-snug flex items-center gap-1">
            <span className="truncate">{card.serviceName}</span>
            {multiService && isCompact && (
              <span
                className="shrink-0 px-1 py-px rounded-full bg-gray-900/[0.04] border border-gray-200 text-[9px] font-semibold text-gray-500"
                title={`Prestation ${card.serviceIndex + 1} sur ${card.serviceCount} du rendez-vous`}
              >
                {card.serviceIndex + 1}/{card.serviceCount}
              </span>
            )}
          </p>
        )}

        {notesVisible && apt.notes && !isCompact && (
          <p className="text-[11px] text-gray-400 truncate leading-snug mt-0.5">{apt.notes}</p>
        )}

        {apt.status === 'cancelled' && apt.cancelledByClient && (
          <div className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1.5">
            <X size={12} />
            <span>Annulé par le client</span>
          </div>
        )}

        {/* Employee + booking position chip */}
        {!isCompact && (
          <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-500 leading-tight">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: showColorInRDV ? color : '#9CA3AF' }}
            />
            <span className="truncate">{card.employeeName}</span>
            {multiService && (
              <span
                className="ml-auto shrink-0 px-1 py-px rounded-full bg-gray-900/[0.04] border border-gray-200 text-[9px] font-semibold text-gray-500"
                title={`Prestation ${card.serviceIndex + 1} sur ${card.serviceCount} du rendez-vous`}
              >
                {card.serviceIndex + 1}/{card.serviceCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { AppointmentCard };
