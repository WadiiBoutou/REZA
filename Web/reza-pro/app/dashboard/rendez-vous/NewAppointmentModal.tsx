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
import { Appointment, Client, PlanAlert, PlanResult } from './types';

// Plan request debounce + error auto-dismiss (ms).
const PLAN_DEBOUNCE_MS = 300;
const ERROR_AUTO_DISMISS_MS = 3000;
const CREATE_ERROR_AUTO_DISMISS_MS = 8000;

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === 'object') {
    const e = err as any;
    if (e.details?.message) return e.details.message;
    if (e.message) return e.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

interface NewAppointmentModalProps {
  onClose: () => void;
  onCreateAppointment: (appointment: Appointment) => Promise<void>;
  employeesData?: Array<{
    id: string;
    name: string;
    color: string;
    workingHours: any;
    agendaSettings: any;
    tenantId?: string;
  }>;
  /** Services from the agenda's single mount fetch (id, name, duration, tenantId). */
  servicesData?: Array<{
    id: string;
    name: string;
    duration?: number;
    color?: string;
    tenantId?: string;
  }>;
  initialDate?: Date;
  initialTime?: string;
  /** Agenda display range (from Horaires → agenda) — restricts the heure de début picker. */
  agendaStart?: string;
  agendaEnd?: string;
}

const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({ onClose, onCreateAppointment, employeesData = [], servicesData = [], initialDate, initialTime, agendaStart, agendaEnd }) => {
  const { isAuthenticated, salons, isSalonFilterMulti, effectiveSalonIds } = useAuth();
  const [createTenantId, setCreateTenantId] = useState(() =>
    !isSalonFilterMulti && effectiveSalonIds.length === 1 ? effectiveSalonIds[0] : ''
  );
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const [time, setTime] = useState(initialTime || '');
  const [selectedServices, setSelectedServices] = useState<Array<{id: string, name: string, duration: number}>>([]);
  const serviceIds = selectedServices.map((s) => s.id);
  const [notes, setNotes] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Services + employees come from the agenda's single mount fetch (props) —
  // filtered to the selected salon for multi-salon owners instead of re-fetching.
  const services = useMemo(() => {
    const base = servicesData ?? [];
    const toModalShape = (list: typeof base) =>
      list.map((s) => ({ id: s.id, name: s.name, duration: s.duration ?? 0 }));
    if (!isSalonFilterMulti) return toModalShape(base);
    if (!createTenantId) return [];
    return toModalShape(base.filter((s) => !s.tenantId || s.tenantId === createTenantId));
  }, [servicesData, isSalonFilterMulti, createTenantId]);

  const employees = useMemo(() => {
    const base = employeesData ?? [];
    if (!isSalonFilterMulti) {
      return base.map((e) => ({ id: e.id, name: e.name }));
    }
    if (!createTenantId) return [];
    return base
      .filter((e) => !e.tenantId || e.tenantId === createTenantId)
      .map((e) => ({ id: e.id, name: e.name }));
  }, [employeesData, isSalonFilterMulti, createTenantId]);


  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Client alerts (populated by diagnostics endpoint on date/time change)
  const [clientAlerts, setClientAlerts] = useState<Record<string, PlanAlert[]>>({});

  // Plan state
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const planRequestId = useRef(0);
  // Manually overridden assignments: serviceId -> employeeId
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Total duration computed from selected services (in order)
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.duration || 0), 0);

  // Fetch clients from API (scoped to create salon when multi). Services and
  // employees come from the agenda's single mount fetch via props — no duplicate
  // fetch on mount.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isSalonFilterMulti && !createTenantId) {
      setClients([]);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const scope = createTenantId ? { salonIds: createTenantId } : undefined;
        const clientsRes = await api.getClients({ limit: 1000 }, scope);
        
        const clientsData = (clientsRes.clients || []).map((c: any) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          phone: c.phone,
          status: c.status,
          avatar: c.avatar
        }));
        setClients(clientsData);
      } catch (err) {
        console.error('Error fetching clients:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, createTenantId, isSalonFilterMulti]);

  // Fetch client diagnostics when only date/time change (no services needed yet)
  useEffect(() => {
    if (!date || !time) { setClientAlerts({}); return; }
    if (serviceIds.length > 0) return;

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    let normalizedTime = time;
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(time)) normalizedTime = time.slice(0, 5);
    else if (/^\d{1,2}$/.test(time)) normalizedTime = time.padStart(2, '0') + ':00';

    const timer = setTimeout(async () => {
      try {
        const result = await api.clientDiagnostics({ date: dateStr, startTime: normalizedTime, tenantId: createTenantId || undefined });
        setClientAlerts(result.clientAlerts as Record<string, PlanAlert[]>);
      } catch (err) {
        console.error('Error fetching client diagnostics:', err);
      }
    }, PLAN_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [date, time, serviceIds.length > 0]);

  // Fetch plan when services, date, time, client, or overrides change (debounced)
  useEffect(() => {
    if (!date || !time || serviceIds.length === 0) {
      setPlan(null);
      // Only reset overrides if non-empty to avoid infinite loop:
      // Object.is({}, {}) === false, so setOverrides({}) always triggers a re-render.
      if (Object.keys(overrides).length > 0) setOverrides({});
      return;
    }

    const currentId = ++planRequestId.current;
    const timer = setTimeout(async () => {
      setPlanLoading(true);
      try {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        let normalizedTime = time;
        if (/^\d{1,2}:\d{2}:\d{2}$/.test(time)) normalizedTime = time.slice(0, 5);
        else if (/^\d{1,2}$/.test(time)) normalizedTime = time.padStart(2, '0') + ':00';

        const hasOverrides = Object.keys(overrides).length > 0;
        let assignments: { serviceId: string; employeeId: string | null }[] | undefined;
        if (hasOverrides && plan) {
          assignments = selectedServices.map((s) => ({
            serviceId: s.id,
            employeeId: overrides[s.id] || plan.recommendedAssignment.find((a) => a.serviceId === s.id)?.employeeId || null,
          }));
        }

        const result = await api.planAppointment({
          serviceIds,
          date: dateStr,
          startTime: normalizedTime,
          clientId: selectedClient?.id,
          tenantId: createTenantId || undefined,
          assignments,
        });
        if (currentId !== planRequestId.current) return;
        setPlan(result);
        setClientAlerts(result.clientAlerts || {});
      } catch (err) {
        if (currentId !== planRequestId.current) return;
        console.error('Error fetching plan:', err);
        setPlan(null);
      } finally {
        if (currentId === planRequestId.current) setPlanLoading(false);
      }
    }, PLAN_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  // Dependency uses join(',') not serviceIds array ref to avoid infinite re-fetch:
  // .map() creates a new array reference every render, which would make the effect
  // see a "change" every time setPlan() causes a re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time, serviceIds.join(','), selectedClient?.id, JSON.stringify(overrides)]);

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
  };

  const handleCreate = async () => {
    if (isSalonFilterMulti && !createTenantId) {
      setCreateError('Veuillez sélectionner un salon');
      setTimeout(() => setCreateError(null), ERROR_AUTO_DISMISS_MS);
      return;
    }
    if (!date || !time || serviceIds.length === 0 || !selectedClient) {
      setCreateError('Veuillez remplir tous les champs obligatoires');
      setTimeout(() => setCreateError(null), ERROR_AUTO_DISMISS_MS);
      return;
    }
    setCreateError(null);

    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    normalizedDate.setHours(0, 0, 0, 0);

    let normalizedTime = time;
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(time)) normalizedTime = time.slice(0, 5);
    else if (/^\d{1,2}$/.test(time)) normalizedTime = time.padStart(2, '0') + ':00';

    const serviceName = selectedServices.map((s) => s.name).join(', ');

    // Build services array with per-service employee assignments (respects order)
    const servicesPayload = selectedServices.map((s) => ({
      serviceId: s.id,
      employeeId: overrides[s.id] || plan?.recommendedAssignment.find((a) => a.serviceId === s.id)?.employeeId || null,
    }));

    const firstEmployeeId = servicesPayload[0]?.employeeId || null;
    const firstEmployeeName = firstEmployeeId
      ? employees.find((e) => e.id === firstEmployeeId)?.name || 'Non assigné'
      : 'Non assigné';

    // Compute end time from normalizedTime + totalDuration
    const [ntH, ntM] = normalizedTime.split(':').map(Number);
    const endTotalMin = ntH * 60 + ntM + totalDuration;
    const computedEndTime = `${String(Math.floor(endTotalMin / 60) % 24).padStart(2, '0')}:${String(endTotalMin % 60).padStart(2, '0')}`;

    const newAppointment: Appointment = {
      id: '',
      clientName: selectedClient.name,
      service: serviceName,
      time: normalizedTime,
      endTime: computedEndTime,
      duration: totalDuration,
      status: 'pending',
      employee: firstEmployeeName,
      phone: selectedClient.phone || undefined,
      email: selectedClient.email || undefined,
      date: normalizedDate,
      notes,
      clientId: selectedClient.id,
      serviceId: serviceIds[0] || '',
      serviceIds,
      employeeId: firstEmployeeId,
      servicesPayload,
      tenantId: createTenantId || undefined,
    };

    try {
      await onCreateAppointment(newAppointment);
    } catch (err: any) {
      const msg = getApiErrorMessage(err, '');
      setCreateError(msg || 'Erreur lors de la création du rendez-vous');
      setTimeout(() => setCreateError(null), CREATE_ERROR_AUTO_DISMISS_MS);
      toast.custom(
        (t) => (
          <div className={`bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 max-w-md ${t.visible ? 'animate-in slide-in-from-top-2' : ''}`}>
            <p className="font-semibold text-red-800 text-sm">Impossible de créer le rendez-vous</p>
            <p className="text-sm text-red-600 mt-1">{msg || 'Ce créneau n\'est plus disponible. Veuillez en choisir un autre.'}</p>
          </div>
        ),
        { duration: 5000 }
      );
    }
  };

  return (
  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
    <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-6 z-40">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-light text-gray-900">Nouveau rendez-vous</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      <div className="px-8 py-6 space-y-8">
        {/* Error Message */}
        {createError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            {createError}
          </div>
        )}

        {isSalonFilterMulti && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Salon</h3>
            <Select
              value={createTenantId || undefined}
              onValueChange={(id) => {
                setCreateTenantId(id);
                setSelectedClient(null);
                setSelectedServices([]);
              }}
            >
              <SelectTrigger className="rounded-full px-4 py-2">
                <SelectValue placeholder="Choisir un salon *" />
              </SelectTrigger>
              <SelectContent>
                {salons
                  .filter((s) => effectiveSalonIds.includes(s.id))
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Client */}
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Client</h3>
          
          <div className="space-y-2">
            <Label>Rechercher un client</Label>
            <ReactSelect
              instanceId="client-select"
              isLoading={loading}
              isDisabled={loading}
              placeholder="Taper le nom, email ou téléphone..."
              noOptionsMessage={() =>"Aucun client trouvé"}
              options={clients.map(c => ({ value: c.id, label: `${c.name} ${c.email ? `- ${c.email}` : ''} ${c.phone ? `- ${c.phone}` : ''}`, client: c }))}
              onChange={(option: any) => {
                if (option) {
                  handleClientSelect(option.client);
                } else {
                  setSelectedClient(null);
                }
              }}
              value={selectedClient ? { value: selectedClient.id, label: `${selectedClient.name} ${selectedClient.email ? `- ${selectedClient.email}` : ''} ${selectedClient.phone ? `- ${selectedClient.phone}` : ''}`, client: selectedClient } : null}
              formatOptionLabel={(option: any) => {
                const alerts = clientAlerts[option.client?.id];
                const msg = alerts?.length > 0 ? alerts[0].message : undefined;
                return (
                  <div className="flex items-center gap-2">
                    <span>{option.label}</span>
                    {msg && (
                      <span title={msg}>
                        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      </span>
                    )}
                  </div>
                );
              }}
              className="mt-2 text-sm"
              styles={{
                control: (base) => ({
                  ...base,
                  borderRadius: '9999px',
                  padding: '2px 8px',
                  borderColor: '#e5e7eb',
                  boxShadow: 'none',
                  '&:hover': {
                    borderColor: '#d1d5db'
                  }
                })
              }}
              isClearable
            />
          </div>

          {selectedClient ? (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {selectedClient.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImageUrl(selectedClient.avatar)}
                      alt={selectedClient.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center">
                      <span className="text-white font-medium text-lg">
                        {selectedClient.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <h4 className="font-medium text-gray-900">{selectedClient.name}</h4>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${
                      selectedClient.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {selectedClient.status}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                    onClick={() => {
                      setSelectedClient(null);
                    }}
                  className="p-1 text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail size={14} className="text-gray-400" />
                  <span>{selectedClient.email}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={14} className="text-gray-400" />
                  <span>{selectedClient.phone}</span>
                </div>
                {selectedClient.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin size={14} className="text-gray-400" />
                    <span>{selectedClient.address}</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Services */}
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Services</h3>
          <div className="space-y-2">
            <Label>Sélectionner les prestations</Label>
            <button
              type="button"
              disabled={loading || services.length === 0}
              onClick={() => {
                const overlay = document.createElement('div');
                overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fadeIn';
                overlay.onclick = (e: MouseEvent) => { if (e.target === overlay) closePicker(); };

                const panel = document.createElement('div');
                panel.className = 'bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col animate-slideUp overflow-hidden';

                const closePicker = () => { document.body.removeChild(overlay); };

                // Header
                const header = document.createElement('div');
                header.className = 'flex items-center justify-between px-6 py-4 border-b border-gray-100';
                header.innerHTML = '<h2 class="text-lg font-semibold text-gray-900">Sélectionner les prestations</h2>';

                const closeBtn = document.createElement('button');
                closeBtn.className = 'p-1 text-gray-400 hover:text-gray-900 transition-colors';
                closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
                closeBtn.onclick = closePicker;
                header.appendChild(closeBtn);
                panel.appendChild(header);

                // Body - flex row
                const body = document.createElement('div');
                body.className = 'flex flex-1 overflow-hidden';

                // LEFT: available services with checkboxes
                const leftCol = document.createElement('div');
                leftCol.className = 'flex-1 overflow-y-auto border-r border-gray-100 p-4 space-y-1';

                const leftTitle = document.createElement('div');
                leftTitle.className = 'text-xs font-medium text-gray-400 uppercase tracking-wider mb-3';
                leftTitle.textContent = 'Prestations disponibles';
                leftCol.appendChild(leftTitle);

                const state: {
                  selected: Array<{id: string; name: string; duration: number}>;
                  selectedIds: Set<string>;
                  dragIndex: number;
                } = {
                  selected: selectedServices.map((s) => ({ ...s })),
                  selectedIds: new Set(selectedServices.map((s) => s.id)),
                  dragIndex: -1,
                };

                // RIGHT: selected services reorderable list
                const rightCol = document.createElement('div');
                rightCol.className = 'w-72 overflow-y-auto p-4 space-y-1';

                const rightTitle = document.createElement('div');
                rightTitle.className = 'text-xs font-medium text-gray-400 uppercase tracking-wider mb-3';
                rightTitle.textContent = "Ordre d'exécution";
                rightCol.appendChild(rightTitle);

                const rightCount = document.createElement('div');
                rightCount.className = 'text-xs text-gray-500 mb-2 selected-count';
                rightCol.appendChild(rightCount);

                const rightEmpty = document.createElement('div');
                rightEmpty.className = 'text-sm text-gray-400 text-center py-8 selected-empty';
                rightEmpty.textContent = 'Aucune prestation sélectionnée';
                rightCol.appendChild(rightEmpty);

                const rightList = document.createElement('div');
                rightList.className = 'space-y-2 selected-list';
                rightList.style.display = state.selected.length > 0 ? 'block' : 'none';
                rightCol.appendChild(rightList);

                const updateRightPanel = () => {
                  const totalDur = state.selected.reduce((sum, s) => sum + s.duration, 0);
                  rightCount.textContent = state.selected.length > 0
                    ? `${state.selected.length} prestation${state.selected.length > 1 ? 's' : ''} · ${totalDur} min`
                    : '';
                  rightEmpty.style.display = state.selected.length === 0 ? 'block' : 'none';
                  rightList.style.display = state.selected.length > 0 ? 'block' : 'none';
                  rightList.innerHTML = '';

                  state.selected.forEach((svc, idx) => {
                    const item = document.createElement('div');
                    item.className = 'flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing';
                    item.draggable = true;
                    item.dataset.index = String(idx);

                    const handle = document.createElement('span');
                    handle.className = 'text-gray-400 shrink-0';
                    handle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z"/></svg>';

                    const info = document.createElement('div');
                    info.className = 'flex-1 min-w-0';
                    const nameSpan = document.createElement('div');
                    nameSpan.className = 'text-sm font-medium text-gray-800 truncate';
                    nameSpan.textContent = svc.name;
                    const durSpan = document.createElement('div');
                    durSpan.className = 'text-xs text-gray-500';
                    durSpan.textContent = `${svc.duration} min`;
                    info.appendChild(nameSpan);
                    info.appendChild(durSpan);

                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'p-1 text-red-400 hover:text-red-600 transition-colors shrink-0';
                    removeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
                    removeBtn.onclick = () => {
                      state.selected.splice(idx, 1);
                      state.selectedIds.delete(svc.id);
                      updateCheckboxes();
                      updateRightPanel();
                    };

                    item.appendChild(handle);
                    item.appendChild(info);
                    item.appendChild(removeBtn);

                    item.ondragstart = () => {
                      state.dragIndex = idx;
                      item.classList.add('opacity-50');
                    };
                    item.ondragend = () => {
                      item.classList.remove('opacity-50');
                      state.dragIndex = -1;
                    };
                    item.ondragover = (e: DragEvent) => {
                      e.preventDefault();
                      const overIdx = Number((e.currentTarget as HTMLElement).dataset.index);
                      if (overIdx === state.dragIndex || state.dragIndex < 0) return;
                      const [moved] = state.selected.splice(state.dragIndex, 1);
                      state.selected.splice(overIdx, 0, moved);
                      state.dragIndex = overIdx;
                      updateRightPanel();
                      updateCheckboxes();
                    };

                    rightList.appendChild(item);
                  });
                };

                const updateCheckboxes = () => {
                  const checkboxes = leftCol.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
                  checkboxes.forEach((cb) => {
                    cb.checked = state.selectedIds.has(cb.dataset.serviceId || '');
                  });
                  const leftDuration = leftCol.querySelector('.left-duration');
                  if (leftDuration) {
                    const totalDur = state.selected.reduce((sum, s) => sum + s.duration, 0);
                    leftDuration.textContent = state.selected.length > 0
                      ? `${state.selected.length} sélectionnée${state.selected.length > 1 ? 's' : ''} · ${totalDur} min`
                      : '';
                  }
                };

                services.forEach((svc) => {
                  const label = document.createElement('label');
                  label.className = 'flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors';

                  const cb = document.createElement('input');
                  cb.type = 'checkbox';
                  cb.dataset.serviceId = svc.id;
                  cb.className = 'w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500';
                  cb.checked = state.selectedIds.has(svc.id);

                  const info = document.createElement('div');
                  info.className = 'flex-1 min-w-0';
                  const nameSpan = document.createElement('div');
                  nameSpan.className = 'text-sm font-medium text-gray-800';
                  nameSpan.textContent = svc.name;
                  const durSpan = document.createElement('div');
                  durSpan.className = 'text-xs text-gray-500';
                  durSpan.textContent = `${svc.duration} min`;
                  info.appendChild(nameSpan);
                  info.appendChild(durSpan);

                  cb.onchange = () => {
                    if (cb.checked) {
                      if (!state.selectedIds.has(svc.id)) {
                        state.selected.push({ ...svc });
                        state.selectedIds.add(svc.id);
                      }
                    } else {
                      const idx = state.selected.findIndex((s) => s.id === svc.id);
                      if (idx >= 0) {
                        state.selected.splice(idx, 1);
                        state.selectedIds.delete(svc.id);
                      }
                    }
                    updateRightPanel();
                  };

                  label.appendChild(cb);
                  label.appendChild(info);
                  leftCol.appendChild(label);
                });

                // Duration summary under left column
                const leftFooter = document.createElement('div');
                leftFooter.className = 'px-4 py-2 border-t border-gray-100 text-xs text-gray-500 left-duration';
                if (selectedServices.length > 0) {
                  leftFooter.textContent = `${selectedServices.length} sélectionnée${selectedServices.length > 1 ? 's' : ''} · ${totalDuration} min`;
                }
                leftCol.appendChild(leftFooter);
                body.appendChild(leftCol);
                body.appendChild(rightCol);
                panel.appendChild(body);

                // Footer
                const footer = document.createElement('div');
                footer.className = 'flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100';

                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100';
                cancelBtn.textContent = 'Annuler';
                cancelBtn.onclick = closePicker;

                const confirmBtn = document.createElement('button');
                confirmBtn.type = 'button';
                confirmBtn.className = 'px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors rounded-full';
                confirmBtn.textContent = 'Terminé';
                confirmBtn.onclick = () => {
                  setSelectedServices(state.selected);
                  closePicker();
                };

                footer.appendChild(cancelBtn);
                footer.appendChild(confirmBtn);
                panel.appendChild(footer);

                overlay.appendChild(panel);
                document.body.appendChild(overlay);
                updateRightPanel();
                updateCheckboxes();
              }}
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm border border-gray-200 rounded-xl bg-white hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <span className={selectedServices.length === 0 ? 'text-gray-400' : 'text-gray-800 font-medium'}>
                {selectedServices.length === 0
                  ? 'Sélectionner des prestations'
                  : `${selectedServices.length} prestation${selectedServices.length > 1 ? 's' : ''} · ${totalDuration} min`}
              </span>
              <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5l7 7-7 7"/>
              </svg>
            </button>
            {selectedServices.length > 0 && (
              <div className="space-y-2">
                {selectedServices.map((svc, idx) => {
                  // Determine available employees + recommended from plan (if loaded)
                  const planSvc = plan?.services.find((ps) => ps.serviceId === svc.id);
                  const effectiveEmpId = overrides[svc.id] ||
                    planSvc?.employees.find((e) => e.recommended)?.employeeId ||
                    undefined;

                  return (
                    <div key={svc.id} className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                      {/* Service header row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-200 w-5 h-5 rounded-full flex items-center justify-center shrink-0">{idx + 1}</span>
                        <span className="flex-1 text-sm font-medium text-gray-800">{svc.name}</span>
                        <span className="text-xs text-gray-400">{svc.duration} min</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedServices((prev) => prev.filter((s) => s.id !== svc.id));
                            setOverrides((prev) => { const n = { ...prev }; delete n[svc.id]; return n; });
                          }}
                          className="ml-1 p-0.5 text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                      {/* Employee dropdown row */}
                      <div className="px-4 pb-3 border-t border-gray-100">
                        {planLoading ? (
                          <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                            <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                            Calcul de l’affectation...
                          </div>
                        ) : (
                          <Select
                            value={effectiveEmpId}
                            onValueChange={(value) => setOverrides((prev) => ({ ...prev, [svc.id]: value }))}
                          >
                            <SelectTrigger className="w-full mt-2 rounded-full px-3 py-1.5 text-xs border-gray-200 text-gray-600">
                              <SelectValue placeholder="Employé (optionnel)" />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Full list when no plan; plan-filtered list when available */}
                              {planSvc ? (
                                planSvc.employees.map((emp) => (
                                  <SelectItem key={emp.employeeId} value={emp.employeeId}>
                                    <div className="flex items-center gap-2">
                                      <span>{emp.employeeName}</span>
                                      {emp.recommended && (
                                        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Recommandé</span>
                                      )}
                                      {!emp.available && (
                                        <span className="text-[10px] text-amber-500">Indisponible</span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))
                              ) : (
                                employees.map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {totalDuration > 0 && (
            <div className="text-sm text-gray-500">
              Durée totale estimée : <span className="font-medium text-gray-800">{totalDuration} min</span>
              {plan?.estimatedEndTime && time && (
                <span className="ml-2">
                  (fin estimée : <span className="font-medium text-gray-800">{plan.estimatedEndTime}</span>)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Date & heure</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal rounded-full px-4 py-2 mt-2 h-auto",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: fr }) : <span>Choisir une date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="time" className="mb-2">Heure de début</Label>
              <div className='mt-2'>
                <TimePicker
                  value={time}
                  onChange={setTime}
                  id="rdv-time-picker"
                  startTime={agendaStart}
                  endTime={agendaEnd}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Planning Status */}
        {(() => {
          // Use plan.alerts as authoritative when available (already includes client overlaps).
          // Fall back to clientAlerts when no full plan yet (no services selected).
          const allAlerts = plan ? plan.alerts : (selectedClient ? (clientAlerts[selectedClient.id] || []) : []);
          if (allAlerts.length === 0) return null;
          const warnings = allAlerts.filter((a) => a.severity === 'warning');
          const conflicts = allAlerts.filter((a) => a.severity === 'conflict');
          if (warnings.length === 0 && conflicts.length === 0) return null;
          return (
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">État du planning</h3>
              {warnings.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-700 text-sm font-medium">
                    <AlertTriangle size={16} />
                    <span>Avertissements</span>
                  </div>
                  {warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-amber-800 ml-1">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{w.message}</span>
                    </div>
                  ))}
                </div>
              )}
              {conflicts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-red-700 text-sm font-medium">
                    <XCircle size={16} />
                    <span>Conflits</span>
                  </div>
                  {conflicts.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-800 ml-1">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>{c.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Notes */}
        <div className="space-y-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</h3>
          <Textarea 
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ajouter des notes..."
            className="rounded-lg px-4 py-2 border-gray-200 focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-8 py-4 flex gap-3">
        <button 
          onClick={onClose}
          className="flex-1 px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          Annuler
        </button>
        <button 
          onClick={handleCreate}
          className="flex-1 px-6 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
        >
          Créer
        </button>
      </div>
    </div>
  </div>
);
}

export { NewAppointmentModal };
