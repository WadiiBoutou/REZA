'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, X, Copy, Building, Camera, Loader2 } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sketch } from '@uiw/react-color';
import { Checkbox } from '@/components/ui/checkbox';
import { TimePicker } from '@/components/ui/time-picker';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

type WorkingHours = {
  day: string;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breaks: { start: string; end: string }[];
};

type EmployeeAgenda = {
  id: string;
  name: string;
  email: string;
  color: string;
  role: string;
  workingHours: WorkingHours[];
  allowOnlineBooking: boolean;
  services: string[];	  status: 'active' | 'inactive' | 'vacation';
	  avatar?: string;
	  tenantId?: string;
};

// Avatar upload rules — validated on the client before sending
const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5 Mo
const AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const defaultWorkingHours: WorkingHours[] = [
  { day: 'Lundi', isWorking: true, startTime: '09:00', endTime: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  { day: 'Mardi', isWorking: true, startTime: '09:00', endTime: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  { day: 'Mercredi', isWorking: true, startTime: '09:00', endTime: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  { day: 'Jeudi', isWorking: true, startTime: '09:00', endTime: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  { day: 'Vendredi', isWorking: true, startTime: '09:00', endTime: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
  { day: 'Samedi', isWorking: false, startTime: '09:00', endTime: '18:00', breaks: [] },
  { day: 'Dimanche', isWorking: false, startTime: '09:00', endTime: '18:00', breaks: [] },
];

// Transform API employee to frontend agenda format
const transformEmployeeToAgenda = (employee: any): EmployeeAgenda => {
  const agendaSettings = employee.agendaSettings || {};
  const workingHours = employee.workingHours || defaultWorkingHours;
  
  // Get service names from employeeServices
  const services = employee.employeeServices?.map((es: any) => es.service?.name).filter(Boolean) || [];
  
  // Determine status from isActive and agendaSettings
  let status: 'active' | 'inactive' | 'vacation' = employee.isActive ? 'active' : 'inactive';
  if (agendaSettings.status) {
    status = agendaSettings.status;
  }
  
  return {
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
    email: employee.email || '',
    color: agendaSettings.color || '#3B82F6',
    role: agendaSettings.role || '',
    workingHours: Array.isArray(workingHours) ? workingHours : defaultWorkingHours,
    allowOnlineBooking: agendaSettings.allowOnlineBooking !== false,
    services,
    status,	    avatar: employee.avatar || undefined,
	    tenantId: employee.tenantId || undefined
	  };
};

// Transform frontend agenda to API employee format
const transformAgendaToEmployee = (agenda: EmployeeAgenda, existingEmployee?: any) => {
  const [firstName, ...lastNameParts] = agenda.name.split(' ');
  const lastName = lastNameParts.join(' ') || firstName;
  
  const agendaSettings = {
    color: agenda.color,
    role: agenda.role,
    allowOnlineBooking: agenda.allowOnlineBooking,
    status: agenda.status
  };
  
  return {
    firstName: existingEmployee?.firstName || firstName,
    lastName: existingEmployee?.lastName || lastName,
    email: agenda.email || undefined,
    // avatar: undefined means it was removed in the form → send null to clear it.
    // Otherwise keep the current value (uploaded or pre-existing).
    avatar: agenda.avatar !== undefined ? agenda.avatar : (existingEmployee?.avatar ?? null),
    workingHours: agenda.workingHours,
    agendaSettings,
    isActive: true
  };
};

const GestionDesAgendas = () => {
  const { isAuthenticated, salons, effectiveSalonIds, isSalonFilterMulti, salonFilter } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [mounted, setMounted] = useState(false);
  const [agendas, setAgendas] = useState<EmployeeAgenda[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<EmployeeAgenda | null>(null);
  const [createTenantId, setCreateTenantId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agendaToDelete, setAgendaToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Client-side pagination: show the first N cards, then "Afficher plus".
  const PAGE_SIZE = 6;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);	  // Reset pagination whenever the search/status filters change
	  useEffect(() => {
		setVisibleCount(PAGE_SIZE);
	  }, [searchQuery, filterStatus]);

	  // Salon name lookup (useful when listing employees across all salons)
	  const salonNameById = React.useMemo(() => new Map(salons.map((s) => [s.id, s.name])), [salons]);

  // Fetch employees and services (re-runs when the salon filter changes)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch employees (tenant-isolated automatically via API)
        const employeesResponse = await api.getEmployees();
        const employees = employeesResponse.employees || [];
        
        // Fetch services for the service selection
        const servicesResponse = await api.getServices();
        const allServices = servicesResponse.services || [];
        setServices(allServices);
        
        // Transform employees to agendas
        const transformedAgendas = employees.map(transformEmployeeToAgenda);
        setAgendas(transformedAgendas);
      } catch (err: any) {
        console.error('Error fetching agendas:', err);
        setError(err.message || 'Erreur lors du chargement des agendas');
      } finally {
        setLoading(false);
        setMounted(true);
      }
    };

    fetchData();
  }, [isAuthenticated, salonFilterKey]);

  const handleDeleteAgenda = (id: string) => {
    const agenda = agendas.find(a => a.id === id);
    if (agenda) {
      setAgendaToDelete({
        id: agenda.id,
        name: agenda.name
      });
      setShowDeleteModal(true);
    }
  };

  const confirmDeleteAgenda = async () => {
    if (!agendaToDelete) return;

    try {
      setDeleting(true);
      const loadingToast = toast.loading('Suppression de l\'agenda...');
      await api.deleteEmployee(agendaToDelete.id);
      setAgendas(agendas.filter(a => a.id !== agendaToDelete.id));
      toast.dismiss(loadingToast);
      toast.success('Agenda supprimé avec succès');
      setShowDeleteModal(false);
      setAgendaToDelete(null);
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || 'Erreur lors de la suppression de l\'agenda');
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicateAgenda = async (agenda: EmployeeAgenda) => {
    try {
      // Get the original employee to get service IDs
      const employeeResponse = await api.getEmployee(agenda.id);
      const originalEmployee = employeeResponse.employee;
      
      // Create new employee with same data
      const [firstName, ...lastNameParts] = agenda.name.split(' ');
      const lastName = lastNameParts.join(' ') || firstName;
      
      const newEmployeeData: any = {
        firstName: `${firstName} (Copie)`,
        lastName,
        avatar: originalEmployee.avatar || undefined,
        workingHours: agenda.workingHours,
        agendaSettings: {
          color: agenda.color,
          role: agenda.role,
          allowOnlineBooking: agenda.allowOnlineBooking,
          status: agenda.status
        },
        serviceIds: originalEmployee.employeeServices?.map((es: any) => es.serviceId) || [],
        ...(originalEmployee.tenantId ? { tenantId: originalEmployee.tenantId } : {}),
      };
      
      // Only include email if it's a valid non-empty email
      // Don't include empty string as it fails validation
      if (agenda.email && agenda.email.trim()) {
        newEmployeeData.email = agenda.email;
      }
      
      const loadingToast = toast.loading('Duplication de l\'agenda...');
      const response = await api.createEmployee(newEmployeeData);
      const newAgenda = transformEmployeeToAgenda(response.employee);
      setAgendas([...agendas, newAgenda]);
      toast.dismiss(loadingToast);
      toast.success('Agenda dupliqué avec succès');
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || 'Erreur lors de la duplication de l\'agenda');
    }
  };

  const handleSaveAgenda = async (agenda: EmployeeAgenda) => {
    try {
      if (!editingAgenda && isSalonFilterMulti && !createTenantId) {
        toast.error('Veuillez sélectionner un salon');
        return;
      }
      const loadingToast = toast.loading(editingAgenda ? 'Modification de l\'agenda...' : 'Création de l\'agenda...');
      
      if (editingAgenda) {
        // Update existing employee
        const employeeResponse = await api.getEmployee(agenda.id);
        const existingEmployee = employeeResponse.employee;
        
        const employeeData = transformAgendaToEmployee(agenda, existingEmployee);
        
        // Get service IDs from service names
        const serviceIds = services
          .filter(s => agenda.services.includes(s.name))
          .map(s => s.id);
        
        await api.updateEmployee(agenda.id, {
          ...employeeData,
          serviceIds
        });
        
        // Refresh the list
        const employeesResponse = await api.getEmployees();
        const transformedAgendas = employeesResponse.employees.map(transformEmployeeToAgenda);
        setAgendas(transformedAgendas);
      } else {
        // Create new employee — services must belong to target salon when multi
        const employeeData = transformAgendaToEmployee(agenda);
        const scopedServices =
          createTenantId
            ? services.filter((s) => !s.tenantId || s.tenantId === createTenantId)
            : services;
        const serviceIds = scopedServices
          .filter(s => agenda.services.includes(s.name))
          .map(s => s.id);
        
        const response = await api.createEmployee({
          ...employeeData,
          serviceIds,
          ...(createTenantId ? { tenantId: createTenantId } : {}),
        });
        
        const newAgenda = transformEmployeeToAgenda(response.employee);
        setAgendas([...agendas, newAgenda]);
      }
      
      toast.dismiss(loadingToast);
      toast.success(editingAgenda ? 'Agenda modifié avec succès' : 'Agenda créé avec succès');
      setShowModal(false);
      setEditingAgenda(null);
      setCreateTenantId('');
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || 'Erreur lors de l\'enregistrement de l\'agenda');
    }
  };

  const filteredAgendas = agendas.filter(agenda => {	const matchesSearch = searchQuery === '' ||
					   agenda.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					   agenda.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
					   agenda.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
					   (agenda.tenantId ? (salonNameById.get(agenda.tenantId) || '').toLowerCase().includes(searchQuery.toLowerCase()) : false);
    const matchesStatus = filterStatus === 'all' || agenda.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (!mounted) {
    return (
      <div className="min-h-screen p-0">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-12 rounded-xl w-1/3"></div>
          <div className="bg-gray-200 h-96 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen p-0">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-12 rounded-xl w-1/3"></div>
          <div className="bg-gray-200 h-96 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-0">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-0 md:p-0 lg:p-0">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>

      {/* Header */}
      <div className="mb-8 animate-slideUp">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>			<h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight mb-2">
			  Gestion des employés
			</h1>
			<p className="text-sm text-gray-500">
			  Gérez les horaires, disponibilités et paramètres des employés
			</p>
          </div>
          
          <button
            onClick={() => {
              setEditingAgenda(null);
              setCreateTenantId('');
              setShowModal(true);
            }}
            className="px-5 py-2 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors shadow-sm"
          >
            <Plus size={16} className="inline-block mr-2 -mt-0.5" />
            Nouvel employé
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un employé..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white pl-12 pr-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
            />
          </div>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm bg-white w-[220px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
              <SelectItem value="vacation">En vacances</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Agendas List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
        {filteredAgendas.slice(0, visibleCount).map(agenda => (		  <AgendaCard
			key={agenda.id}
			agenda={agenda}
			salonName={isSalonFilterMulti && agenda.tenantId ? salonNameById.get(agenda.tenantId) : undefined}
			onEdit={() => {
              setEditingAgenda(agenda);
              setShowModal(true);
            }}
            onDelete={() => handleDeleteAgenda(agenda.id)}
            onDuplicate={() => handleDuplicateAgenda(agenda)}
          />
        ))}
      </div>

      {/* Load more (client-side pagination) */}
      {filteredAgendas.length > visibleCount && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
            className="px-6 py-2.5 bg-white border border-gray-200 text-sm font-medium text-gray-700 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
          >
            Afficher plus ({filteredAgendas.length - visibleCount} restant{filteredAgendas.length - visibleCount > 1 ? 's' : ''})
          </button>
        </div>
      )}

      {filteredAgendas.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 mb-4">Aucun agenda trouvé</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterStatus('all');
            }}
            className="text-sm text-[#002366] hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AgendaModal
          agenda={editingAgenda}
          services={
            !editingAgenda && createTenantId
              ? services.filter((s) => !s.tenantId || s.tenantId === createTenantId)
              : services
          }
          onClose={() => {
            setShowModal(false);
            setEditingAgenda(null);
            setCreateTenantId('');
          }}
          onSave={handleSaveAgenda}
          createTenantId={createTenantId}
          onCreateTenantIdChange={setCreateTenantId}
          showSalonPicker={!editingAgenda && isSalonFilterMulti}
          salonOptions={salons.filter((s) => effectiveSalonIds.includes(s.id))}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && agendaToDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Supprimer l'agenda</h3>
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  setAgendaToDelete(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
                disabled={deleting}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">
                Êtes-vous sûr de vouloir supprimer l'agenda <span className="font-semibold">"{agendaToDelete.name}"</span> ?
              </p>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Attention :</strong> Cette action est irréversible. Toutes les données associées à cet agenda seront supprimées.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAgendaToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  disabled={deleting}
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDeleteAgenda}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Agenda Card Component
const AgendaCard = ({ agenda, onEdit, onDelete, onDuplicate, salonName }: {
  agenda: EmployeeAgenda;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  salonName?: string;
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const workingDays = agenda.workingHours.filter(h => h.isWorking);
  const totalHoursPerWeek = workingDays.reduce((sum, day) => {
    const start = parseInt(day.startTime.split(':')[0]);
    const end = parseInt(day.endTime.split(':')[0]);
    const breakTime = day.breaks.reduce((breakSum, b) => {
      const bStart = parseInt(b.start.split(':')[0]);
      const bEnd = parseInt(b.end.split(':')[0]);
      return breakSum + (bEnd - bStart);
    }, 0);
    return sum + (end - start - breakTime);
  }, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'inactive': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'vacation': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'inactive': return 'Inactif';
      case 'vacation': return 'En vacances';
      default: return status;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {agenda.avatar && !avatarFailed ? (
            <img
              src={agenda.avatar}
              alt={agenda.name}
              className="w-12 h-12 rounded-full object-cover shrink-0"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: agenda.color }}
            >
              <span className="text-white font-semibold text-lg">
                {agenda.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}		  <div>
			<h3 className="font-semibold text-gray-900">{agenda.name}</h3>
			<p className="text-sm text-gray-500">{agenda.role}</p>
			{salonName && (
			  <span className="mt-1 inline-flex items-center gap-1 text-xs text-[#002366] bg-[#002366]/5 border border-[#002366]/10 rounded-full px-2 py-0.5">
				<Building size={12} />
				{salonName}
			  </span>
			)}
		  </div>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onDuplicate}
            className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
            title="Dupliquer"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            title="Modifier"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(agenda.status)}`}>
          {getStatusText(agenda.status)}
        </span>
        {agenda.allowOnlineBooking && (
          <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
            Réservation en ligne
          </span>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Jours travaillés</p>
          <p className="text-sm font-medium text-gray-900">{workingDays.length} jours/semaine</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Heures/semaine</p>
          <p className="text-sm font-medium text-gray-900">{totalHoursPerWeek}h</p>
        </div>

      </div>

      {/* Working Days */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Jours de travail</p>
        <div className="flex flex-wrap gap-2">
          {agenda.workingHours.map((day, idx) => (
            <div
              key={idx}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                day.isWorking
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-gray-50 text-gray-400 border border-gray-200'
              }`}
            >
              {day.day.substring(0, 3)}
            </div>
          ))}
        </div>
      </div>

      {/* Services */}
      {agenda.services.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">{agenda.services.length} prestations</p>
          <div className="flex flex-wrap gap-1">
            {agenda.services.slice(0, 3).map((service, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-50 text-gray-600 rounded text-xs"
              >
                {service}
              </span>
            ))}
            {agenda.services.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                +{agenda.services.length - 3}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Agenda Modal Component
const AgendaModal = ({
  agenda,
  services,
  onClose,
  onSave,
  createTenantId = '',
  onCreateTenantIdChange,
  showSalonPicker = false,
  salonOptions = [],
}: {
  agenda: EmployeeAgenda | null;
  services: any[];
  onClose: () => void;
  onSave: (agenda: EmployeeAgenda) => void;
  createTenantId?: string;
  onCreateTenantIdChange?: (id: string) => void;
  showSalonPicker?: boolean;
  salonOptions?: Array<{ id: string; name: string }>;
}) => {
  const [formData, setFormData] = useState<EmployeeAgenda>(
    agenda ? { ...agenda } : {
      id: '',
      name: '',
      email: '',
      color: '#3B82F6',
      role: '',
      workingHours: defaultWorkingHours,
      allowOnlineBooking: true,
      services: [],
      status: 'active'
    }
  );

  const [activeTab, setActiveTab] = useState<'info' | 'hours'>('info');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFile = async (file?: File) => {
    if (!file) return;

    // Extension must be an image (jpg, jpeg, png, webp, gif)
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!AVATAR_EXTENSIONS.includes(ext) || !AVATAR_MIME_TYPES.includes(file.type)) {
      toast.error("Format d'image invalide. Utilisez JPG, PNG, WEBP ou GIF.");
      return;
    }

    // Size limit
    if (file.size > AVATAR_MAX_SIZE) {
      toast.error('Image trop volumineuse (max 5 Mo).');
      return;
    }

    setUploadingAvatar(true);
    try {
      const { avatar } = await api.uploadEmployeeAvatar(file);
      setFormData((prev) => ({ ...prev, avatar }));
      toast.success('Photo de profil mise à jour');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload de la photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = () => {
    if (showSalonPicker && !createTenantId) {
      toast.error('Veuillez sélectionner un salon');
      return;
    }
    if (!formData.name) {
      toast.error('Veuillez remplir le nom');
      return;
    }
    onSave(formData);
  };

  const updateWorkingHours = (dayIndex: number, updates: Partial<WorkingHours>) => {
    const newHours = [...formData.workingHours];
    newHours[dayIndex] = { ...newHours[dayIndex], ...updates };
    setFormData({ ...formData, workingHours: newHours });
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <style>{`
        input[type=number].no-arrows {
          appearance: textfield;
        }
        input[type=number].no-arrows::-webkit-inner-spin-button,
        input[type=number].no-arrows::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number].no-arrows {
          -moz-appearance: textfield;
        }
      `}</style>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-light text-gray-900">
              {agenda ? 'Modifier l\'agenda' : 'Nouvel employé'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors border ${
                activeTab === 'info'
                  ? 'bg-[#002366] text-white border-[#002366] shadow'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              Informations
            </button>
            <button
              onClick={() => setActiveTab('hours')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors border ${
                activeTab === 'hours'
                  ? 'bg-[#002366] text-white border-[#002366] shadow'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              Horaires
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="relative group">
                  <div
                    className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center border-2 border-gray-200 shadow-sm transition-shadow group-hover:shadow-md"
                    style={formData.avatar ? undefined : { backgroundColor: formData.color }}
                  >
                    {formData.avatar ? (
                      <img
                        src={formData.avatar}
                        alt="Photo de profil"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold text-4xl">
                        {formData.name.charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                    {!formData.avatar && !uploadingAvatar && (
                      <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Camera
                          size={20}
                          className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    )}
                  </div>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                      <Loader2 size={20} className="text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-4 py-2 text-sm font-medium text-[#002366] bg-[#002366]/5 border border-[#002366]/15 rounded-full hover:bg-[#002366]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera size={14} className="inline-block mr-1.5 -mt-0.5" />
                    {formData.avatar ? 'Changer la photo' : 'Ajouter une photo'}
                  </button>
                  {formData.avatar && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, avatar: undefined }))}
                      disabled={uploadingAvatar}
                      className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-full hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Supprimer
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-400">
                  JPG, PNG, WEBP ou GIF — 5 Mo maximum
                </p>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    handleAvatarFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>

              {showSalonPicker && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salon <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createTenantId}
                    onChange={(e) => {
                      onCreateTenantIdChange?.(e.target.value);
                      setFormData((prev) => ({ ...prev, services: [] }));
                    }}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="">Choisir un salon</option>
                    {salonOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Ex: Marie Dupont"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="marie.dupont@reza.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rôle
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Ex: Coiffeur Senior"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Couleur
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className="flex items-center gap-3 px-3 py-2.5 border border-gray-200 rounded-full hover:border-gray-300 transition-colors"
                    >
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-gray-200 shadow-sm" 
                        style={{ backgroundColor: formData.color }}
                      />
                      <span className="text-sm text-gray-700 font-mono">{formData.color}</span>
                    </button>
                    {showColorPicker && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowColorPicker(false)}
                        />
                        <div className="absolute top-full mt-2 z-20 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
                          <Sketch
                            color={formData.color}
                            onChange={(color) => {
                              setFormData({ ...formData, color: color.hex });
                            }}
                            style={{ boxShadow: 'none' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Statut
                  </label>
                  <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v as 'active' | 'inactive' | 'vacation' })}>
                    <SelectTrigger className="w-full px-4 py-2.5 rounded-full bg-white border border-gray-200 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                      <SelectItem value="vacation">En vacances</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prestations
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = services.every((s: any) => formData.services.includes(s.name));
                        setFormData({
                          ...formData,
                          services: allSelected ? [] : services.map((s: any) => s.name)
                        });
                      }}
                      className="text-xs text-[#002366] hover:underline font-medium"
                    >
                      {services.every((s: any) => formData.services.includes(s.name))
                        ? 'Désélectionner tout'
                        : 'Sélectionner tous'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {services.map((service: any) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          const hasService = formData.services.includes(service.name);
                          setFormData({
                            ...formData,
                            services: hasService
                              ? formData.services.filter(s => s !== service.name)
                              : [...formData.services, service.name]
                          });
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          formData.services.includes(service.name)
                            ? 'bg-[#002366] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {service.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hours Tab */}
          {activeTab === 'hours' && (
            <div className="space-y-4">
              {formData.workingHours.map((day, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`isWorking-${idx}`}
                        checked={day.isWorking}
                        onCheckedChange={(checked) => updateWorkingHours(idx, { isWorking: !!checked })}
                        className="w-4 h-4 rounded-full text-[#002366] border-gray-300 focus:ring-gray-900"
                      />
                      <span className="font-medium text-gray-900">{day.day}</span>
                    </div>
                  </div>

                  {day.isWorking && (
                    <div className="grid grid-cols-2 gap-3 ml-7">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Début</label>
                        <TimePicker
                          value={day.startTime}
                          onChange={(val: string) => updateWorkingHours(idx, { startTime: val })}
                          id={`startTime-${idx}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fin</label>
                        <TimePicker
                          value={day.endTime}
                          onChange={(val: string) => updateWorkingHours(idx, { endTime: val })}
                          id={`endTime-${idx}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-8 py-4 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
          >
            {agenda ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GestionDesAgendas;
