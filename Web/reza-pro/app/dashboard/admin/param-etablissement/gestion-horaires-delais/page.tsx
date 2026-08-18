'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Trash2,
  Loader2,
  Check,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TimePicker } from '@/components/ui/time-picker';
import { DatePicker } from '@/components/ui/date-picker';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import SalonScopeNotice from '@/components/SalonScopeNotice';
import toast from 'react-hot-toast';

type DaySchedule = {
  day: string;
  dayShort: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breaks: Array<{ start: string; end: string }>;
};



// ── Shared delay-setting UI components ──────────────────────────

function DelayNumberSelect({ value, onChange, unit, onUnitChange, units, saving }: {
  value: string; onChange: (v: string) => void;
  unit: string; onUnitChange: (v: string) => void;
  units: { value: string; label: string }[];
  saving: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-20 rounded-full" min="1" disabled={saving} />
      <Select value={unit} onValueChange={onUnitChange} disabled={saving}>
        <SelectTrigger className="w-32 rounded-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {units.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="text-sm text-gray-700">avant le rendez-vous</span>
    </div>
  );
}

function DelayRadio({ id, name, checked, onChange, saving, children }: {
  id: string; name: string; checked: boolean; onChange: () => void; saving: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="radio" id={id} name={name} checked={checked} onChange={onChange}
          disabled={saving} className="w-4 h-4 accent-[#002366] disabled:opacity-50" />
        <Label htmlFor={id} className="text-sm text-gray-700 cursor-pointer">{children}</Label>
      </label>
    </div>
  );
}

function DelayExample({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500 mt-4 pl-7">{children}</p>;
}

// ── Main component ──────────────────────────────────────────────

const GestionHoraires = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { salons, effectiveSalonIds } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'establishment' | 'agenda' | 'delays'>('establishment');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [onlineBooking, setOnlineBooking] = useState<'open' | 'closed'>('open');

  const querySalonId = searchParams.get('salonId') || searchParams.get('tenantId');
  const scopedSalonId = useMemo(() => {
    if (querySalonId) {
      // Trust query while salons list still loading; reject only after load
      if (salons.length === 0) return querySalonId;
      return salons.some((s) => s.id === querySalonId) ? querySalonId : null;
    }
    if (effectiveSalonIds.length === 1) return effectiveSalonIds[0];
    if (salons.length === 1) return salons[0].id;
    return null;
  }, [querySalonId, salons, effectiveSalonIds]);

  const scopedSalon = useMemo(
    () => (scopedSalonId ? salons.find((s) => s.id === scopedSalonId) : undefined),
    [salons, scopedSalonId]
  );
  const salonScope = useMemo(
    () => (scopedSalonId ? { salonIds: scopedSalonId } : undefined),
    [scopedSalonId]
  );
  
  // Default schedules structure
  const defaultSchedules: DaySchedule[] = [
    { day: 'Lundi', dayShort: 'Lu', isOpen: false, openTime: '10:00', closeTime: '20:00', breaks: [] },
    { day: 'Mardi', dayShort: 'Ma', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
    { day: 'Mercredi', dayShort: 'Me', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
    { day: 'Jeudi', dayShort: 'Je', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
    { day: 'Vendredi', dayShort: 'Ve', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
    { day: 'Samedi', dayShort: 'Sa', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] },
    { day: 'Dimanche', dayShort: 'Di', isOpen: true, openTime: '10:00', closeTime: '20:00', breaks: [{ start: '12:00', end: '13:00' }] }
  ];

  // Establishment hours state
  const [schedules, setSchedules] = useState<DaySchedule[]>(defaultSchedules);

  // Agenda display times
  const [agendaStart, setAgendaStart] = useState('08:00');
  const [agendaEnd, setAgendaEnd] = useState('23:55');

  // Booking delays
  const [bookingDelay, setBookingDelay] = useState({ value: '1', unit: 'jours', allowLastMoment: false });
  const [advanceBooking, setAdvanceBooking] = useState({ value: '1', unit: 'mois' });

  // Bulk pause (applied to every open day at once)
  const [bulkBreakStart, setBulkBreakStart] = useState('12:00');
  const [bulkBreakEnd, setBulkBreakEnd] = useState('14:00');

  // Blocked dates
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');

  const fetchBusinessHours = useCallback(async () => {
    if (!scopedSalonId || !salonScope) return;
    try {
      setLoading(true);
      const data = await api.getBusinessHours(salonScope);
      
      // Merge saved schedules with default structure (API may omit breaks)
      if (data.schedules && data.schedules.length > 0) {
        const mergedSchedules = defaultSchedules.map(defSchedule => {
          const saved = data.schedules.find((s: any) => s.day === defSchedule.day);
          if (!saved) return defSchedule;
          return {
            ...defSchedule,
            ...saved,
            breaks: Array.isArray(saved.breaks) ? saved.breaks : [],
          };
        });
        setSchedules(mergedSchedules);
      }
      
      setOnlineBooking(data.onlineBooking || 'open');

      // ── Migrate legacy exceptionalSchedules into blockedDates ──────────────
      const legacyExceptions: Array<{ date: string }> = (data.exceptionalSchedules || []) as Array<{ date: string }>;
      const rawBlocked: string[] = (data.blockedDates || []) as string[];
      if (legacyExceptions.length > 0) {
        const merged = new Set(rawBlocked);
        for (const ex of legacyExceptions) {
          if (ex.date) merged.add(ex.date);
        }
        setBlockedDates([...merged]);
      } else {
        setBlockedDates(rawBlocked);
      }
      // ─────────────────────────────────────────────────────────────────────────

      setAgendaStart(data.agendaStart || '08:00');
      setAgendaEnd(data.agendaEnd || '23:55');
      setBookingDelay(data.bookingDelay || { value: '1', unit: 'jours', allowLastMoment: false });
      setAdvanceBooking(data.advanceBooking || { value: '1', unit: 'mois' });
    } catch (err: any) {
      console.error('Error fetching business hours:', err);
      toast.error(err.message || 'Erreur lors du chargement des horaires');
    } finally {
      setLoading(false);
    }
  // defaultSchedules is stable literal shape; omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedSalonId, salonScope]);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Require a single known salon — no multi-filter gate
  useEffect(() => {
    if (!mounted) return;
    // Wait for account salons to load before deciding redirect
    if (salons.length === 0) return;
    if (!scopedSalonId) {
      router.replace('/dashboard/admin/salons/mes-salons');
      return;
    }
    // Keep the URL clean: when exactly one salon is active, the global salon
    // filter already scopes this page, so strip a stale ?salonId= param instead
    // of re-adding it to the URL. An explicit ?salonId= for multi-salon scoping
    // (query ≠ single active salon) is still honored and left untouched.
    if (querySalonId && querySalonId === scopedSalonId && effectiveSalonIds.length === 1) {
      router.replace('/dashboard/admin/param-etablissement/gestion-horaires-delais');
    }
  }, [mounted, scopedSalonId, querySalonId, router, salons.length, effectiveSalonIds.length]);

  useEffect(() => {
    if (mounted && scopedSalonId) {
      fetchBusinessHours();
    }
  }, [mounted, scopedSalonId, pathname, fetchBusinessHours]);

  // Refetch data when page becomes visible (user navigates back to tab)
  useEffect(() => {
    if (!scopedSalonId) return;
    const handleVisibilityChange = () => {
      if (!document.hidden && mounted) {
        fetchBusinessHours();
      }
    };

    const handleFocus = () => {
      if (mounted) {
        fetchBusinessHours();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [mounted, scopedSalonId, fetchBusinessHours]);

  const saveBusinessHours = async () => {
    if (!salonScope) return;
    try {
      setSaving(true);
      const loadingToast = toast.loading('Enregistrement des horaires...');
      
      // Send empty exceptionalSchedules to clear legacy data from the backend
      await api.updateBusinessHours({
        onlineBooking,
        schedules,
        exceptionalSchedules: [],
        agendaStart,
        agendaEnd,
        bookingDelay,
        advanceBooking,
        blockedDates
      }, salonScope);
      
      toast.dismiss(loadingToast);
      toast.success('Horaires enregistrés avec succès');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err: any) {
      console.error('Error saving business hours:', err);
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (index: number) => {
    const newSchedules = [...schedules];
    newSchedules[index].isOpen = !newSchedules[index].isOpen;
    setSchedules(newSchedules);
  };

  const updateSchedule = (index: number, field: 'openTime' | 'closeTime', value: string) => {
    const newSchedules = [...schedules];
    newSchedules[index][field] = value;
    setSchedules(newSchedules);
  };

  const addBreak = (index: number) => {
    const newSchedules = [...schedules];
    const breaks = newSchedules[index].breaks ?? [];
    newSchedules[index] = {
      ...newSchedules[index],
      breaks: [...breaks, { start: '12:00', end: '14:00' }],
    };
    setSchedules(newSchedules);
  };

  const removeBreak = (scheduleIndex: number, breakIndex: number) => {
    const newSchedules = [...schedules];
    const breaks = newSchedules[scheduleIndex].breaks ?? [];
    newSchedules[scheduleIndex] = {
      ...newSchedules[scheduleIndex],
      breaks: breaks.filter((_, i) => i !== breakIndex),
    };
    setSchedules(newSchedules);
  };

  // Add one pause to every open day, but only where it fits inside that day's
  // opening hours (a pause outside the hours would be meaningless) and skip
  // days that already have that exact pause. Multiple pauses per day are safe:
  // the slot engine rejects any slot overlapping ANY pause.
  const addBreakToAllDays = () => {
    const start = bulkBreakStart;
    const end = bulkBreakEnd;
    if (start >= end) {
      toast.error('L\'heure de début doit être avant l\'heure de fin');
      return;
    }
    let addedCount = 0;
    const newSchedules = schedules.map((s) => {
      if (!s.isOpen) return s;
      // Only apply when the pause sits within this day's open/close window
      if (start < s.openTime || end > s.closeTime) return s;
      const exists = (s.breaks ?? []).some((b) => b.start === start && b.end === end);
      if (exists) return s;
      addedCount += 1;
      return { ...s, breaks: [...(s.breaks ?? []), { start, end }] };
    });
    if (addedCount > 0) {
      setSchedules(newSchedules);
      toast.success(addedCount === 1 ? 'Pause ajoutée à 1 jour' : `Pause ajoutée à ${addedCount} jours`);
    } else {
      toast.error('Aucun jour ouvert ne peut recevoir cette pause (elle doit être comprise dans les horaires d\'ouverture)');
    }
  };


  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-12 rounded-xl w-1/3"></div>
          <div className="bg-gray-200 h-96 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Hours/delays are salon-specific — require one salon to be scoped (query param or single selection).
  if (!scopedSalonId) {
    return (
      <SalonScopeNotice
        title="Horaires & délais"
        subtitle="Configurez les horaires d'ouverture et les délais de réservation par salon"
      />
    );
  }

  return (
    <div suppressHydrationWarning className="min-h-screen p-0 md:p-0">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
      `}</style>

      {/* Success Notification */}
      {showSuccess && (
        <div className="fixed top-6 right-6 bg-green-400 text-white px-6 py-3 rounded shadow-lg z-50 flex items-center gap-3 animate-fadeIn">
          <Check size={20} />
          <span className="font-medium">Modifications enregistrées avec succès</span>
        </div>
      )}

      {/* Header - Ultra Minimalist Premium */}
      <div className="mb-8 animate-slideDown">
        <div className="flex items-center justify-between">
          {/* Left: Title */}
          <div className="flex items-center gap-8">
            <div className="flex flex-col gap-2">
              <Link
                href="/dashboard/admin/salons/mes-salons"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#002366] transition-colors w-fit"
              >
                <ChevronLeft size={16} />
                Mes salons
              </Link>
              <h1 className="text-5xl font-light text-gray-900 tracking-tight">
                Horaires
              </h1>
              {scopedSalon && (
                <p className="text-sm font-medium text-[#002366]">
                  {scopedSalon.name}
                </p>
              )}
              {/* Time below title */}
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-light text-gray-900 tabular-nums tracking-tight">
                  {currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs text-gray-400 tabular-nums">
                  :{currentTime.toLocaleTimeString('fr-FR', { second: '2-digit' })}
                </span>
              </div>
              {/* Month and year below time */}
              <div className="text-sm text-gray-500 mt-1">
                {currentTime.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
          {/* Right: Save Button */}
          <div className="flex items-center gap-6">
            {activeTab === 'establishment' && (
              <button 
                onClick={saveBusinessHours}
                disabled={saving || loading}
                className="px-6 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Enregistrer
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 border-b border-gray-200">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('establishment')}
            className={`px-6 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'establishment'
                ? 'text-[#002366]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Horaires de l&apos;établissement
            {activeTab === 'establishment' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#002366]"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('agenda')}
            className={`px-6 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'agenda'
                ? 'text-[#002366]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Horaires affichés dans l&apos;agenda
            {activeTab === 'agenda' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#002366]"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('delays')}
            className={`px-6 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'delays'
                ? 'text-[#002366]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Délais RDV en ligne
            {activeTab === 'delays' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#002366]"></div>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-fadeIn">
        {/* Establishment Hours Tab */}
        {activeTab === 'establishment' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-100">
              <p className="text-sm text-gray-600">
                Gérez ici les horaires d&apos;ouverture de votre établissement et la prise de RDV en ligne
              </p>
            </div>

            {/* Online Booking Status */}
            <div className="p-0">
              <div className="flex items-center gap-6 mb-12 pt-4">
                <Label className="text-base font-medium text-gray-900">Prise de RDV en ligne</Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="online-booking"
                      checked={onlineBooking === 'open'}
                      onChange={() => setOnlineBooking('open')}
                      className="w-4 h-4 accent-[#002366]"
                    />
                    <span className="text-sm font-medium text-gray-900">Ouverte</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="online-booking"
                      checked={onlineBooking === 'closed'}
                      onChange={() => setOnlineBooking('closed')}
                      className="w-4 h-4 accent-gray-900"
                    />
                    <span className="text-sm font-medium text-gray-900">Fermée</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Day Selection */}
            <div className="">
              <Label className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4 block">
                Merci de sélectionner les jours d&apos;ouverture
              </Label>
              
              <div className="flex items-center gap-2 mb-8">
                {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map((label, index) => (
                  <button
                    key={label}
                    onClick={() => toggleDay(index)}
                    className={`w-24 h-10 rounded-full text-sm font-medium transition-all ${
                      schedules[index].isOpen
                        ? 'bg-[#002366] text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Schedule Details */}
              <div className="space-y-4">
                {schedules.filter(s => s.isOpen).map((schedule, index) => {
                  const originalIndex = schedules.findIndex(s => s.day === schedule.day);
                  return (
                    <div key={schedule.day} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-24 text-sm font-medium text-gray-900">
                        {schedule.day}
                      </div>
                      <div className="flex items-center gap-2">
                        <TimePicker
                          value={schedule.openTime}
                          onChange={(value) => updateSchedule(originalIndex, 'openTime', value)}
                        />
                        <span className="text-gray-400">-</span>
                        <TimePicker
                          value={schedule.closeTime}
                          onChange={(value) => updateSchedule(originalIndex, 'closeTime', value)}
                        />
                      </div>
                      <button
                        onClick={() => addBreak(originalIndex)}
                        className="text-sm text-gray-500 hover:text-gray-900 underline ml-4"
                      >
                        Ajouter une pause
                      </button>
                      
                      {/* Breaks */}
                      {(schedule.breaks ?? []).map((breakTime, breakIndex) => (
                        <div key={breakIndex} className="flex items-center gap-2 ml-4">
                          <TimePicker
                            value={breakTime.start}
                            onChange={value => {
                              const newSchedules = [...schedules];
                              const breaks = [...(newSchedules[originalIndex].breaks ?? [])];
                              breaks[breakIndex] = { ...breaks[breakIndex], start: value };
                              newSchedules[originalIndex] = { ...newSchedules[originalIndex], breaks };
                              setSchedules(newSchedules);
                            }}
                          />
                          <span className="text-gray-400">-</span>
                          <TimePicker
                            value={breakTime.end}
                            onChange={value => {
                              const newSchedules = [...schedules];
                              const breaks = [...(newSchedules[originalIndex].breaks ?? [])];
                              breaks[breakIndex] = { ...breaks[breakIndex], end: value };
                              newSchedules[originalIndex] = { ...newSchedules[originalIndex], breaks };
                              setSchedules(newSchedules);
                            }}
                          />
                          <button
                            onClick={() => removeBreak(originalIndex, breakIndex)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bulk pause — add the same pause to every open day at once */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-[#002366]/[0.04] border border-dashed border-[#002366]/25 rounded-xl">
              <Clock size={16} className="text-[#002366] shrink-0" />
              <span className="text-sm font-medium text-gray-800">Ajouter une pause à tous les jours ouverts :</span>
              <TimePicker
                value={bulkBreakStart}
                onChange={(value) => setBulkBreakStart(value)}
              />
              <span className="text-gray-400">-</span>
              <TimePicker
                value={bulkBreakEnd}
                onChange={(value) => setBulkBreakEnd(value)}
              />
              <button
                onClick={addBreakToAllDays}
                className="text-sm font-medium text-[#002366] hover:text-gray-800 underline ml-auto"
              >
                Appliquer à tous
              </button>
            </div>

          </div>
        )}

        {/* Agenda Display Tab */}
        {activeTab === 'agenda' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-100">
              <p className="text-sm text-gray-600">
                Définissez ici les horaires d&apos;affichage de votre agenda Pro. Ces horaires n&apos;apparaissent pas sur le portail et n&apos;ont pas d&apos;incidence sur la prise de RDV en ligne. Par défaut, ils vont du plus tôt au plus tard des horaires de l&apos;établissement.
              </p>
            </div>
            {/* Time Selection */}
            <div className="bg-white rounded-lg border border-gray-100 p-8">
              <div className="flex items-center gap-6">
                <Label className="text-base font-medium text-gray-900">Afficher l&apos;agenda de</Label>
                <div className="flex items-center gap-3">
                  <TimePicker
                    value={agendaStart}
                    onChange={(value) => setAgendaStart(value)}
                  />
                  <span className="text-gray-400">à</span>
                  <TimePicker
                    value={agendaEnd}
                    onChange={(value) => setAgendaEnd(value)}
                  />
                </div>
              </div>
            </div>
            {/* Save Button */}
            <div className="flex justify-end">
              <button 
                onClick={saveBusinessHours}
                disabled={saving || loading}
                className="px-6 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Booking Delays Tab */}
        {activeTab === 'delays' && (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-100">
              <p className="text-sm text-gray-600 font-medium mb-2">
                Délais de prise de RDV en ligne
              </p>
            </div>

            {/* 1. Booking Delay (minimum lead time) */}
            <div className="bg-white rounded-lg border border-gray-100 p-6">
              <Label className="text-base font-medium text-gray-900 mb-4 block">
                Un client peut prendre RDV en ligne:
              </Label>
              <div className="space-y-4">
                <DelayRadio id="last-moment" name="booking-delay"
                  checked={bookingDelay.allowLastMoment}
                  onChange={() => setBookingDelay({ ...bookingDelay, allowLastMoment: true })}
                  saving={saving}>
                  Jusqu&apos;au dernier moment avant son RDV
                </DelayRadio>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" id="before-delay" name="booking-delay"
                      checked={!bookingDelay.allowLastMoment}
                      onChange={() => setBookingDelay({ ...bookingDelay, allowLastMoment: false })}
                      disabled={saving}
                      className="w-4 h-4 accent-[#002366] disabled:opacity-50" />
                    <Label htmlFor="before-delay" className="text-sm text-gray-700 cursor-pointer">Jusqu&apos;à</Label>
                  </label>
                  <DelayNumberSelect value={bookingDelay.value}
                    onChange={(v) => setBookingDelay({ ...bookingDelay, value: v })}
                    unit={bookingDelay.unit}
                    onUnitChange={(v) => setBookingDelay({ ...bookingDelay, unit: v })}
                    units={[{ value: 'jours', label: 'jours' }, { value: 'heures', label: 'heures' }, { value: 'semaines', label: 'semaines' }]}
                    saving={saving} />
                </div>
              </div>
              <DelayExample>Exemple: un client peut prendre RDV pour le 09 janvier jusqu&apos;au 08 janvier à 20:00</DelayExample>
            </div>

            {/* 2. Advance Booking (maximum advance window) */}
            <div className="bg-white rounded-lg border border-gray-100 p-6">
              <Label className="text-base font-medium text-gray-900 mb-4 block">
                Les clients peuvent prendre RDV jusqu&apos;à l&apos;avance:
              </Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" id="advance-booking" name="advance-booking" checked={true}
                    onChange={() => {}} className="w-4 h-4 accent-[#002366]" />
                  <Label htmlFor="advance-booking" className="text-sm text-gray-700 cursor-pointer">À partir de</Label>
                </label>
                <DelayNumberSelect value={advanceBooking.value}
                  onChange={(v) => setAdvanceBooking({ ...advanceBooking, value: v })}
                  unit={advanceBooking.unit}
                  onUnitChange={(v) => setAdvanceBooking({ ...advanceBooking, unit: v })}
                  units={[{ value: 'mois', label: 'mois' }, { value: 'semaines', label: 'semaines' }, { value: 'jours', label: 'jours' }]}
                  saving={saving} />
              </div>
              <DelayExample>Exemple: un client peut prendre RDV pour le 09 janvier à partir du 10 décembre à 20:00</DelayExample>
            </div>

            {/* 3. Blocked Dates */}
            <div className="bg-white rounded-lg border border-gray-100 p-6">
              <Label className="text-base font-medium text-gray-900 mb-4 block">
                Jours bloqués (fermeture exceptionnelle)
              </Label>
              <p className="text-xs text-gray-500 mb-4">
                Les clients ne pourront pas réserver en ligne ces jours-là. Les administrateurs peuvent toujours créer des rendez-vous.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {blockedDates.map((date: string) => (
                  <span key={date}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm text-red-700"
                  >
                    {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    <button type="button" onClick={() => setBlockedDates(blockedDates.filter((d: string) => d !== date))}
                      disabled={saving} className="text-red-400 hover:text-red-600 disabled:opacity-50">
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <DatePicker
                  value={newBlockedDate ? new Date(newBlockedDate + 'T12:00:00') : undefined}
                  onChange={(d) => { if (d) { const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0'); setNewBlockedDate(`${y}-${m}-${day}`); } }}
                />
                <button type="button"
                  onClick={() => { if (newBlockedDate && !blockedDates.includes(newBlockedDate)) { setBlockedDates([...blockedDates, newBlockedDate]); setNewBlockedDate(''); } }}
                  disabled={saving || !newBlockedDate}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-full hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  <Plus size={16} /> Bloquer
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button 
                onClick={saveBusinessHours}
                disabled={saving || loading}
                className="px-6 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GestionHoraires;