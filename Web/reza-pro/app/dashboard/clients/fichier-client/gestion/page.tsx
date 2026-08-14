'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, X, Phone, Mail, User as UserIcon, MapPin, Calendar, Loader2, Camera, Venus, Mars } from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { getMoroccanPhoneError, normalizeMoroccanPhone } from '@/lib/utils';

const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5 Mo
const AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];


// Backend client structure
interface BackendClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  address: string | null;
  avatar: string | null;
  gender: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  appointments?: any[];
  _count?: {
    appointments: number;
  };
}

// Frontend display structure
interface Client {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  avatar?: string;
  lastVisit?: Date;
  lastVisitTime?: string;
  nextAppointment?: Date;
  nextAppointmentTime?: string;
  totalVisits?: number;
  status: 'Active' | 'Inactive';
  notes?: string;
}

// Helper function to convert backend client to frontend display format
const mapBackendToFrontend = (backendClient: BackendClient, appointments?: any[]): Client => {
  const name = `${backendClient.firstName} ${backendClient.lastName}`.trim();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let nextAppointment: Date | undefined;
  let nextAppointmentTime: string | undefined;
  let lastVisit: Date | undefined;
  let lastVisitTime: string | undefined;

  if (appointments && appointments.length > 0) {
    // Find next upcoming appointment
    const upcoming = appointments
      .filter(apt => new Date(apt.startTime) >= now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

    // Find last visit
    const past = appointments
      .filter(apt => new Date(apt.startTime) < now)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];

    if (upcoming) {
      nextAppointment = new Date(upcoming.startTime);
      nextAppointmentTime = format(new Date(upcoming.startTime), 'HH:mm');
    }

    if (past) {
      lastVisit = new Date(past.startTime);
      lastVisitTime = format(new Date(past.startTime), 'HH:mm');
    }
  }

  return {
    id: backendClient.id,
    name,
    firstName: backendClient.firstName,
    lastName: backendClient.lastName,
    email: backendClient.email || '',
    phone: backendClient.phone,
    address: backendClient.address || undefined,
    avatar: backendClient.avatar || undefined,
    status: backendClient.status === 'ACTIVE' ? 'Active' : 'Inactive',
    notes: backendClient.notes || undefined,
    nextAppointment,
    nextAppointmentTime,
    lastVisit,
    lastVisitTime,
    totalVisits: backendClient._count?.appointments || appointments?.length || 0
  };
};

export default function ClientsGestionPage() {
  const { user, salonFilter, effectiveSalonIds, isSalonFilterMulti, salons } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [editingAppointment, setEditingAppointment] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createTenantId, setCreateTenantId] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    gender: '',
    avatar: undefined as string | undefined,
    status: 'Active' as 'Active' | 'Inactive',
    notes: '',
    autoConfirmOverride: 'default' as 'default' | 'auto' | 'manual'
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Fetch clients from API
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getClients({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? (statusFilter === 'Active' ? 'ACTIVE' : 'INACTIVE') : undefined,
        limit: 100
      });

      // Fetch all appointments for these clients at once (more efficient)
      const clientIds = response.clients.map((c: BackendClient) => c.id);
      let allAppointments: any[] = [];

      if (clientIds.length > 0) {
        try {
          // Fetch appointments for all clients in batches or use a date range
          // For now, fetch recent and upcoming appointments
          const now = new Date();
          const pastDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
          const futureDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead

          const appointmentsResponse = await api.getAppointments({
            startDate: pastDate.toISOString(),
            endDate: futureDate.toISOString(),
            limit: 1000 // Get enough appointments
          });

          allAppointments = appointmentsResponse.appointments || [];
        } catch (err) {
          console.error('Error fetching appointments:', err);
          // Continue without appointments if fetch fails
        }
      }

      // Group appointments by clientId
      const appointmentsMap = new Map<string, any[]>();
      allAppointments.forEach((apt: any) => {
        if (apt.clientId && clientIds.includes(apt.clientId)) {
          if (!appointmentsMap.has(apt.clientId)) {
            appointmentsMap.set(apt.clientId, []);
          }
          appointmentsMap.get(apt.clientId)!.push(apt);
        }
      });

      // Map backend clients to frontend format with appointments
      const mappedClients = response.clients.map((client: BackendClient) => {
        const clientAppointments = appointmentsMap.get(client.id) || [];
        const frontendClient = mapBackendToFrontend(client, clientAppointments);
        return frontendClient;
      });

      setClients(mappedClients);
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      const errorMessage = err.message || 'Erreur lors du chargement des clients';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fetch clients and auto-confirm default on mount
  useEffect(() => {
    if (user) {
      fetchClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, salonFilterKey]);

  // Handle search and filter changes with debouncing
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        fetchClients();
      }, 300);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, salonFilterKey]);

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
      const { avatar } = await api.uploadClientAvatar(file);
      setFormData((prev) => ({ ...prev, avatar }));
      toast.success('Photo de profil mise à jour');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload de la photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAddClient = () => {
    setEditingClient(null);
    setCreateTenantId(
      !isSalonFilterMulti && effectiveSalonIds.length === 1 ? effectiveSalonIds[0] : ''
    );
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      gender: '',
      avatar: undefined,
      status: 'Active',
      notes: '',
      autoConfirmOverride: 'default'
    });
    setShowModal(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    const notes = client.notes || '';
    const acoMatch = notes.match(/__ACO:(AUTO|MANUAL)/);
    const autoConfirmOverride = acoMatch ? (acoMatch[1] === 'AUTO' ? 'auto' : 'manual') : 'default';
    setFormData({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      address: client.address || '',
      gender: (client as any).gender || '',
      avatar: client.avatar || undefined,
      status: client.status,
      notes,
      autoConfirmOverride
    });
    setShowModal(true);
  };

  const handleDeleteClick = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!clientToDelete) return;

    setDeleting(true);
    try {
      await api.deleteClient(clientToDelete.id);
      toast.success(`Client "${clientToDelete.name}" supprimé avec succès`);
      await fetchClients(); // Refresh list
      setClientToDelete(null);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression du client');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Split name into first and last name if user entered full name in firstName field
    let firstName = formData.firstName.trim();
    let lastName = formData.lastName.trim();

    if (!lastName && firstName.includes(' ')) {
      const parts = firstName.split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }

    if (!firstName || !lastName) {
      toast.error('Veuillez remplir le prénom et le nom');
      return;
    }

    if (!formData.phone.trim()) {
      toast.error('Le téléphone est requis');
      return;
    }
    const phoneErr = getMoroccanPhoneError(formData.phone.trim());
    if (phoneErr) {
      toast.error(phoneErr);
      return;
    }

    setSaving(true);
    try {
      if (editingClient) {
        // Update client
        await api.updateClient(editingClient.id, {
          firstName,
          lastName,
          email: formData.email || undefined,
          phone: normalizeMoroccanPhone(formData.phone.trim()),
          address: formData.address || undefined,
          gender: formData.gender || undefined,
          avatar: formData.avatar !== undefined ? formData.avatar : null,
          status: formData.status === 'Active' ? 'ACTIVE' : 'INACTIVE',
          notes: (formData.notes?.replace(/__ACO:(AUTO|MANUAL)/g, '').trim() || '') + (formData.autoConfirmOverride !== 'default' ? `\n__ACO:${formData.autoConfirmOverride === 'auto' ? 'AUTO' : 'MANUAL'}` : '') || undefined
        });
        toast.success(`Client "${firstName} ${lastName}" modifié avec succès`);
      } else {
        if (isSalonFilterMulti && !createTenantId) {
          toast.error('Veuillez sélectionner un salon');
          setSaving(false);
          return;
        }
        // Create client
        await api.createClient({
          firstName,
          lastName,
          email: formData.email || undefined,
          phone: normalizeMoroccanPhone(formData.phone.trim()),
          address: formData.address || undefined,
          gender: formData.gender || undefined,
          avatar: formData.avatar || undefined,
          status: formData.status === 'Active' ? 'ACTIVE' : 'INACTIVE',
          notes: (formData.notes?.replace(/__ACO:(AUTO|MANUAL)/g, '').trim() || '') + (formData.autoConfirmOverride !== 'default' ? `\n__ACO:${formData.autoConfirmOverride === 'auto' ? 'AUTO' : 'MANUAL'}` : '') || undefined,
          ...(createTenantId ? { tenantId: createTenantId } : {}),
        });
        toast.success(`Client "${firstName} ${lastName}" créé avec succès`);
      }

      setShowModal(false);
      await fetchClients(); // Refresh list
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde du client');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAppointment = async (clientId: string, newDate: string) => {
    try {
      if (!newDate) {
        // If date is cleared, we could cancel upcoming appointments, but for now just update local state
        const updatedClients = clients.map(c =>
          c.id === clientId ? { ...c, nextAppointment: undefined, nextAppointmentTime: undefined } : c
        );
        setClients(updatedClients);
        setEditingAppointment(null);
        return;
      }

      // Get the client to find their existing appointments
      const client = clients.find(c => c.id === clientId);
      if (!client) return;

      // Check if there's already an upcoming appointment for this client
      const upcomingAppointments = await api.getAppointments({
        clientId,
        startDate: new Date().toISOString(),
        status: 'CONFIRMED',
        limit: 1
      });

      // Get first available service for creating appointment
      const servicesResponse = await api.getServices().catch(() => ({ services: [] }));

      const services = servicesResponse.services || [];

      if (services.length === 0) {
        toast.error('Aucun service disponible. Veuillez créer un service d\'abord.');
        setEditingAppointment(null);
        return;
      }

      const selectedService = services[0];

      // Parse the date string and create a proper Date object in local time
      // newDate format: "YYYY-MM-DDTHH:mm" (local time)
      // Parse manually to avoid timezone conversion issues
      const [datePart, timePart] = newDate.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart ? timePart.split(':').map(Number) : [9, 0];

      // Create date in local timezone
      const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

      // Format as ISO string for the API
      // This will correctly represent the local date/time in ISO format
      const isoString = localDate.toISOString();

      // If there's already an upcoming appointment, update it instead of creating a new one
      if (upcomingAppointments.appointments && upcomingAppointments.appointments.length > 0) {
        const existingAppointment = upcomingAppointments.appointments[0];

        await api.updateAppointment(existingAppointment.id, {
          startTime: isoString,
          duration: selectedService.duration || 30,
          serviceId: selectedService.id,
        });

        toast.success('Rendez-vous mis à jour avec succès');
      } else {
        // Create new appointment
        await api.createAppointment({
          clientId,
          serviceId: selectedService.id,
          startTime: isoString,
          duration: selectedService.duration || 30,
          status: 'CONFIRMED',
          notes: 'Créé depuis la gestion des clients'
        });

        toast.success('Rendez-vous créé avec succès');
      }

      // Refresh clients to get updated appointment data
      await fetchClients();
      setEditingAppointment(null);
    } catch (err: any) {
      console.error('Error updating appointment:', err);
      toast.error(err.message || 'Erreur lors de la mise à jour du rendez-vous');
      setEditingAppointment(null);
    }
  };


  const filteredClients = clients.filter(client => {
    const matchesSearch =
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading && clients.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Chargement des clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>

      {/* Header */}
      <div className="mb-8 animate-slideUp">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="text-5xl font-light text-gray-900 tracking-tight">Gestion des Clients</h1>
            <span className="text-sm text-gray-400 mt-4">
              {loading ? '...' : `${filteredClients.length} ${filteredClients.length === 1 ? 'client' : 'clients'}`}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'grid' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Grille
              </button>
              <span className="text-gray-300">/</span>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'list' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Liste
              </button>
            </div>

            <div className="h-8 w-px bg-gray-200"></div>

            {/* New Client Button */}
            <button
              onClick={handleAddClient}
              className="px-5 py-2 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              Nouveau
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 animate-fadeIn">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full bg-white border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
            />
            {loading && searchTerm && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${statusFilter === 'all' ? 'bg-[#002366] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
            >
              Tous
            </button>
            <button
              onClick={() => setStatusFilter('Active')}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${statusFilter === 'Active' ? 'bg-[#002366] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
            >
              Actifs
            </button>
            <button
              onClick={() => setStatusFilter('Inactive')}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${statusFilter === 'Inactive' ? 'bg-[#002366] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
            >
              Inactifs
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-lg hover:border-gray-200 transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {client.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={client.avatar}
                      alt={client.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#002366] flex items-center justify-center">
                      <span className="text-white font-medium text-lg">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-gray-900">{client.name}</h3>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${client.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                      {client.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEditClient(client)}
                    className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(client)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2.5 mb-4">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={14} className="text-gray-400" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} className="text-gray-400" />
                  <span>{client.phone}</span>
                </div>
                {client.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin size={14} className="text-gray-400" />
                    <span className="truncate">{client.address}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-end text-xs mb-1">
                  <span className="text-gray-400">{client.totalVisits || 0} visites</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Client</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Contact</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden xl:table-cell">Adresse</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Visites</th>
                  <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Statut</th>
                  <th className="px-4 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3 min-w-[160px]">
                        {client.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={client.avatar}
                            alt={client.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#002366] flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-medium text-sm">
                              {client.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="font-medium text-gray-900 truncate">{client.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1 min-w-[180px]">
                        {client.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail size={12} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate">{client.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone size={12} className="text-gray-400 flex-shrink-0" />
                          <span className="whitespace-nowrap">{client.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 hidden xl:table-cell">
                      {client.address ? (
                        <div className="flex items-center gap-2 max-w-[200px]">
                          <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                          <span className="truncate">{client.address}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap hidden md:table-cell">
                      {client.totalVisits || 0}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${client.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditClient(client)}
                          className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(client)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredClients.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-100 p-12 text-center animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <UserIcon size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun client trouvé</h3>
          <p className="text-gray-500 text-sm mb-6">
            {searchTerm ? 'Essayez de modifier votre recherche' : 'Commencez par ajouter votre premier client'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleAddClient}
              className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
            >
              <Plus size={16} />
              Ajouter un client
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-light text-gray-900">
                  {editingClient ? 'Modifier le client' : 'Nouveau client'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="p-2 text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 py-6">
              <div className="space-y-6">
                {!editingClient && isSalonFilterMulti && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Salon *</label>
                    <SearchableSelect
                      value={createTenantId}
                      onValueChange={setCreateTenantId}
                      options={salons
                        .filter((s) => effectiveSalonIds.includes(s.id))
                        .map((s) => ({ value: s.id, label: s.name }))}
                      placeholder="Choisir un salon"
                      searchPlaceholder="Rechercher un salon…"
                      emptyLabel="Aucun salon trouvé"
                      className="w-full"
                    />
                  </div>
                )}
                {/* Avatar */}
                <div className="flex flex-col items-center gap-3 pt-1">
                  <div className="relative group">
                    <div className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center border-2 border-gray-200 shadow-sm transition-shadow group-hover:shadow-md bg-[#002366]">
                      {formData.avatar ? (
                        <img
                          src={formData.avatar}
                          alt="Photo de profil"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-semibold text-4xl">
                          {((formData.firstName || formData.lastName || '').charAt(0) || '?').toUpperCase()}
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

                {/* Personal Info */}
                <div className="space-y-4">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Informations personnelles</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                        Prénom *
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                        placeholder="Sophie"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                        Nom *
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                        placeholder="Martin"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                        Téléphone *
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                        placeholder="+33 6 12 34 56 78"
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                        placeholder="sophie.martin@email.com"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                        Adresse
                      </label>
                      <input
                        id="address"
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                        placeholder="15 Rue de la Paix, Paris"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Genre <span className="text-gray-400 font-normal">(optionnel)</span>
                      </label>
                      <div className="flex gap-3">
                        {[
                          { value: 'female', label: 'Femme', Icon: Venus },
                          { value: 'male', label: 'Homme', Icon: Mars },
                        ].map(({ value, label, Icon }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setFormData({ ...formData, gender: formData.gender === value ? '' : value })}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                              formData.gender === value
                                ? 'bg-gray-900 text-white border-2 border-gray-900'
                                : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <Icon size={16} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-4">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Statut</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    « Actif » autorise ce client à prendre rendez-vous en ligne dans ce salon. « Inactif » le bloque
                    uniquement ici — son compte reste accessible et vous pouvez toujours créer des rendez-vous pour lui manuellement.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'Active' })}
                      className={`flex-1 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${formData.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300'
                          : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      Actif
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'Inactive' })}
                      className={`flex-1 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${formData.status === 'Inactive'
                          ? 'bg-gray-100 text-gray-700 border-2 border-gray-300'
                          : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      Inactif
                    </button>
                  </div>
                </div>

                {/* Auto-confirm override */}
                <div className="space-y-4">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Confirmation automatique</h3>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, autoConfirmOverride: 'default' })}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${formData.autoConfirmOverride === 'default' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'}`}
                    >
                      Par défaut
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, autoConfirmOverride: 'auto' })}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${formData.autoConfirmOverride === 'auto' ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'}`}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, autoConfirmOverride: 'manual' })}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${formData.autoConfirmOverride === 'manual' ? 'bg-amber-600 text-white' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'}`}
                    >
                      Manuel
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-4">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Notes</h3>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    placeholder="Ajouter des notes sur ce client..."
                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="sticky bottom-0 bg-white border-t border-gray-100 -mx-8 px-8 py-4 mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="flex-1 px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    editingClient ? 'Mettre à jour' : 'Créer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le client"
        description={
          clientToDelete
            ? `Êtes-vous sûr de vouloir supprimer le client "${clientToDelete.name}" ? Cette action est irréversible.`
            : 'Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.'
        }
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="destructive"
        loading={deleting}
      />
    </div>
  );
}
