'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Copy, Eye, EyeOff, ChevronDown, X, Check, Clock, Palette, List, Settings, ArrowUpDown, Filter } from 'lucide-react';
import { Sketch } from '@uiw/react-color';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from "@/components/ui/checkbox";
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import SalonScopeNotice from '@/components/SalonScopeNotice';
import toast from 'react-hot-toast';

// Canonical salon service categories — hardcoded (well-known), shared with the
// mobile client so each category maps to an icon there. Admins pick from this
// list instead of typing free text.
const SALON_CATEGORIES = [
  'Coiffeur',
  'Couleur',
  'Barbier',
  'Manucure',
  'Pédicure',
  'Épilation',
  'Esthétique',
  'Maquillage',
  'Massage',
  'Spa',
  'Hammam',
  'Soin',
];

// API Service type (from backend)
type ApiService = {
  id: string;
  name: string;
  abbreviation?: string | null;
  description?: string | null;
  color: string;
  price?: number | null;
  priceType: 'FIXED' | 'FROM' | 'RANGE';
  priceFrom?: number | null;
  priceTo?: number | null;
  onQuote: boolean;
  duration: number;
  category?: string | null;
  visibility: 'BOOKABLE' | 'VISIBLE' | 'HIDDEN';
  competences: string[];
  multipleProviders: boolean;
  employeeServices?: Array<{
    employee: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  _count?: {
    appointments: number;
  };
};

// Frontend Service type
type Service = {
  id: string;
  name: string;
  abbreviation: string;
  description: string;
  color: string;
  price: number;
  priceType: 'fixed' | 'from' | 'range';
  priceFrom?: number;
  priceTo?: number;
  onQuote: boolean;
  duration: number;
  category: string;
  visibility: 'bookable' | 'visible' | 'hidden';
  competences: string[];
  multipleProviders: boolean;
  employeeIds?: string[];
};

function validateServicePricing(service: Service): string | null {
  if (service.duration <= 0) {
    return 'La durée doit être supérieure à 0';
  }
  if (service.onQuote) {
    return null;
  }
  if (service.priceType === 'fixed') {
    if (!service.price || service.price <= 0) {
      return 'Le prix doit être supérieur à 0';
    }
  }
  if (service.priceType === 'from') {
    if (!service.priceFrom || service.priceFrom <= 0) {
      return 'Le prix minimum doit être supérieur à 0';
    }
  }
  if (service.priceType === 'range') {
    const min = service.priceFrom ?? 0;
    const max = service.priceTo ?? 0;
    if (min <= 0) {
      return 'Le prix minimum doit être supérieur à 0';
    }
    if (max <= 0) {
      return 'Le prix maximum doit être supérieur à 0';
    }
    if (min > max) {
      return 'Le prix minimum ne peut pas dépasser le prix maximum';
    }
  }
  return null;
}

const GestionPrestations = () => {
  const { isAuthenticated, salons, effectiveSalonIds, isSalonFilterMulti, salonFilter } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [mounted, setMounted] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [createTenantId, setCreateTenantId] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [draggedService, setDraggedService] = useState<Service | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<{ id: string; name: string; appointmentCount?: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Collapsed category sections (large catalogs), so the admin isn't scrolling everything at once.
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Transform API service to frontend service
  const transformApiService = (apiService: ApiService): Service => {
    return {
      id: apiService.id,
      name: apiService.name,
      abbreviation: apiService.abbreviation || '',
      description: apiService.description || '',
      color: apiService.color,
      price: apiService.price || 0,
      priceType: apiService.priceType.toLowerCase() as 'fixed' | 'from' | 'range',
      priceFrom: apiService.priceFrom || undefined,
      priceTo: apiService.priceTo || undefined,
      onQuote: apiService.onQuote,
      duration: apiService.duration,
      category: apiService.category || '',
      visibility: apiService.visibility.toLowerCase() as 'bookable' | 'visible' | 'hidden',
      competences: apiService.competences || [],
      multipleProviders: apiService.multipleProviders,
      employeeIds: apiService.employeeServices?.map(es => es.employee.id) || []
    };
  };

  // Transform frontend service to API service
  const transformToApiService = (service: Service): any => {
    return {
      name: service.name,
      abbreviation: service.abbreviation || undefined,
      description: service.description || undefined,
      color: service.color,
      price: service.price || undefined,
      priceType: service.priceType.toUpperCase() as 'FIXED' | 'FROM' | 'RANGE',
      priceFrom: service.priceFrom || undefined,
      priceTo: service.priceTo || undefined,
      onQuote: service.onQuote,
      duration: service.duration,
      category: service.category || undefined,
      visibility: service.visibility.toUpperCase() as 'BOOKABLE' | 'VISIBLE' | 'HIDDEN',
      competences: service.competences || [],
      multipleProviders: service.multipleProviders,
      employeeIds: service.employeeIds || []
    };
  };

  // Load data from API
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = async () => {
    // Check if search input is focused before fetching and store cursor position
    const wasSearchFocused = document.activeElement === searchInputRef.current;
    const cursorPosition = wasSearchFocused && searchInputRef.current 
      ? searchInputRef.current.selectionStart || searchQuery.length 
      : null;
    
    try {
      setLoading(true);
      setError(null);

      // Build query parameters for services
      const serviceParams: { category?: string; search?: string } = {};
      if (filterCategory && filterCategory !== 'all') {
        serviceParams.category = filterCategory;
      }
      if (searchQuery && searchQuery.trim()) {
        serviceParams.search = searchQuery.trim();
      }

      // Fetch services and categories from API
      const servicesResponse = await api.getServices(Object.keys(serviceParams).length > 0 ? serviceParams : undefined);
      const servicesData = servicesResponse.services || [];
      const categoriesData = servicesResponse.categories || [];

      // Transform API services to frontend format
      const transformedServices = servicesData.map((s: ApiService) => transformApiService(s));
      setServices(transformedServices);
      // categories stays backend-derived (categories actually in use) — it
      // drives section rendering. Dropdowns get a separate merged list below.
      setCategories(categoriesData);

      // Always fetch employees from API to ensure fresh data
      const employeesResponse = await api.getEmployees({ active: true });
      const employeesData = employeesResponse.employees || [];
      setEmployees(employeesData.map((e: any) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName
      })));
    } catch (err: any) {
      console.error('Error fetching services:', err);
      const errorMessage = err.message || 'Erreur lors du chargement des données';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      // Restore focus to search input if it was focused before
      if (wasSearchFocused && searchInputRef.current) {
        // Use requestAnimationFrame for better timing with DOM updates
        requestAnimationFrame(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            // Restore cursor position
            if (cursorPosition !== null) {
              searchInputRef.current.setSelectionRange(cursorPosition, cursorPosition);
            }
          }
        });
      }
    }
  };

  // Initial load
  useEffect(() => {
    if (mounted) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Refetch when filters change (debounced for search)
  useEffect(() => {
    if (mounted) {
      const timeoutId = setTimeout(() => {
        fetchData();
      }, searchQuery ? 300 : 0); // Debounce search
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, searchQuery, mounted, salonFilterKey]);

  // Maintain focus on search input after state updates
  useEffect(() => {
    // Only restore focus if the input was previously focused and is still mounted
    if (searchInputRef.current && document.activeElement === searchInputRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
          searchInputRef.current.focus();
          // Restore cursor position if possible
          const cursorPosition = searchInputRef.current.selectionStart || searchQuery.length;
          searchInputRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, categories, loading]);

  const handleAddCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      toast('Cette catégorie est déjà disponible');
      return;
    }
    const next = [...categories, trimmed];
    setCategories(next);
    // Persist the declared category list so it survives a refresh. The modal
    // stays open so the admin can pick multiple categories — it only closes
    // when the admin explicitly clicks X / Fermer.
    try {
      await api.updateCategories(next);
      toast.success(`Catégorie "${trimmed}" ajoutée`);
    } catch (err: any) {
      console.error('Error saving category:', err);
      toast.error(err.message || 'Erreur lors de l\'enregistrement de la catégorie');
      setCategories(categories); // roll back on failure
    }
  };

  const handleDeleteCategory = async (category: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${category}" ?\n\nToutes les prestations de cette catégorie seront également supprimées.`)) {
      try {
        const loadingToast = toast.loading('Suppression de la catégorie...');
        
        // Delete all services in this category
        const servicesToDelete = services.filter(s => s.category === category);
        await Promise.all(servicesToDelete.map(s => api.deleteService(s.id)));

        // Also remove the category from the persisted declared list, so it
        // doesn't come back as an empty category after a refresh.
        await api.updateCategories(categories.filter(c => c !== category));

        // Refresh data
        await fetchData();
        
        toast.dismiss(loadingToast);
        toast.success(`Catégorie "${category}" et ${servicesToDelete.length} prestation(s) supprimée(s) avec succès`);
      } catch (err: any) {
        console.error('Error deleting category:', err);
        toast.error(err.message || 'Erreur lors de la suppression de la catégorie');
      }
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      // Fetch service details to get appointment count
      const serviceResponse = await api.getService(serviceId);
      const service = serviceResponse.service;
      const serviceData = services.find(s => s.id === serviceId);
      
      setServiceToDelete({
        id: serviceId,
        name: serviceData?.name || service.name,
        appointmentCount: service._count?.appointments || 0
      });
      setShowDeleteModal(true);
    } catch (err: any) {
      console.error('Error fetching service:', err);
      toast.error('Erreur lors de la récupération des informations de la prestation');
    }
  };

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;

    try {
      setDeleting(true);
      const loadingToast = toast.loading('Suppression de la prestation...');
      const response = await api.deleteService(serviceToDelete.id);
      await fetchData();
      toast.dismiss(loadingToast);
      
      const deletedCount = (response as any)?.deletedAppointmentsCount || 0;
      if (deletedCount > 0) {
        toast.success(`Prestation supprimée avec succès. ${deletedCount} rendez-vous associé(s) ont également été supprimé(s).`);
      } else {
        toast.success('Prestation supprimée avec succès');
      }
      
      setShowDeleteModal(false);
      setServiceToDelete(null);
    } catch (err: any) {
      console.error('Error deleting service:', err);
      toast.dismiss();
      const errorMessage = err.message || 'Erreur lors de la suppression de la prestation';
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicateService = async (service: Service) => {
    try {
      const loadingToast = toast.loading('Duplication de la prestation...');
      const duplicateData = transformToApiService({
        ...service,
        id: '', // Will be generated by backend
        name: `${service.name} (Copie)`
      });
      await api.createService(duplicateData);
      await fetchData();
      toast.dismiss(loadingToast);
      toast.success('Prestation dupliquée avec succès');
    } catch (err: any) {
      console.error('Error duplicating service:', err);
      toast.error(err.message || 'Erreur lors de la duplication de la prestation');
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, service: Service) => {
    setDraggedService(service);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, category: string) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    setDragOverCategory(category);
  };

  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetCategory: string) => {
    e.preventDefault();
    setDragOverCategory(null);
    if (draggedService && draggedService.category !== targetCategory) {
      try {
        const loadingToast = toast.loading('Déplacement de la prestation...');
        const updateData = transformToApiService({
          ...draggedService,
          category: targetCategory
        });
        await api.updateService(draggedService.id, updateData);
        await fetchData();
        toast.dismiss(loadingToast);
        toast.success(`Prestation déplacée vers "${targetCategory}"`);
      } catch (err: any) {
        console.error('Error updating service category:', err);
        toast.error(err.message || 'Erreur lors du déplacement de la prestation');
      }
      setDraggedService(null);
    }
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || service.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedServices = categories.reduce((acc, category) => {
    acc[category] = filteredServices.filter(s => s.category === category);
    return acc;
  }, {} as Record<string, Service[]>);

  // Large-catalog default: collapse every category except the first non-empty one.
  // Search/filter overrides the collapse so results are visible.
  const largeCatalog = services.length > 24;
  const filterActive = searchQuery.trim() !== '' || filterCategory !== 'all';
  useEffect(() => {
    if (!mounted) return;
    if (filterActive) return; // keep manual collapse state while searching
    if (largeCatalog) {
      const nonEmpty = categories.filter((c) => (groupedServices[c] || []).length > 0);
      setCollapsedCategories(new Set(nonEmpty.slice(1))); // keep first open
    } else {
      setCollapsedCategories(new Set());
    }
  }, [mounted, largeCatalog, filterActive, categories]);

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const nonEmptyCategories = categories.filter((c) => (groupedServices[c] || []).length > 0);
  const allCollapsed = nonEmptyCategories.length > 0 && nonEmptyCategories.every((c) => collapsedCategories.has(c));
  const expandAll = () => setCollapsedCategories(new Set());
  const collapseAll = () => setCollapsedCategories(new Set(nonEmptyCategories));

  if (!mounted || loading) {
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
      <div className="min-h-screen p-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchData();
            }}
            className="px-4 py-2 bg-[#002366] text-white rounded-full hover:bg-gray-800"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Services are salon-scoped: require a single salon selection before showing the list.
  if (isSalonFilterMulti) {
    return <SalonScopeNotice title="Gestion des prestations" subtitle="Gérez vos services, catégories et tarifs" />;
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
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight mb-2">
              Gestion des Prestations
            </h1>
            <p className="text-sm text-gray-500">
              Gérez vos services, catégories et tarifs
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-4 py-2 text-sm font-medium bg-white text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full hover:border-gray-300 transition-colors"
            >
              <Plus size={16} className="inline-block mr-2 -mt-0.5" />
              Catégorie
            </button>
            <button
              onClick={() => {
                setEditingService(null);
                setCreateTenantId('');
                setShowModal(true);
              }}
              className="px-5 py-2 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors shadow-sm"
            >
              <Plus size={16} className="inline-block mr-2 -mt-0.5" />
              Nouvelle Prestation
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher une prestation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white pl-12 pr-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={allCollapsed ? expandAll : collapseAll}
                disabled={filterActive}
                className="px-4 py-2.5 text-sm font-medium bg-white text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full hover:border-gray-300 transition-colors disabled:opacity-50"
                title={filterActive ? 'Dépliez tout pour voir les résultats de recherche' : allCollapsed ? 'Déplier toutes les catégories' : 'Replier toutes les catégories'}
              >
                {allCollapsed ? 'Tout déplier' : 'Tout replier'}
              </button>
              <Select value={filterCategory} onValueChange={v => setFilterCategory(v)}>
                <SelectTrigger className="px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm bg-white w-[220px]">
                  <SelectValue placeholder="Toutes les catégories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Services by Category */}
      <div className="space-y-8 animate-fadeIn">
        {categories.map(category => {
          const categoryServices = groupedServices[category] || [];
          if (categoryServices.length === 0 && filterCategory !== 'all') return null;

          // Remove drop highlight completely
          const showDropHighlight = false;

          return (
            <div 
              key={category} 
              className={`space-y-4 transition-all ${filterActive || !collapsedCategories.has(category) ? '' : 'opacity-60'}`}
              onDragOver={(e) => handleDragOver(e, category)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, category)}
            >
              {/* Category Header (click to collapse/expand) */}
              <div
                className="flex items-center justify-between cursor-pointer select-none group"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center gap-3">
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform duration-200 ${
                      filterActive || !collapsedCategories.has(category) ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-[#002366] transition-colors">{category}</h2>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                    {categoryServices.length} {categoryServices.length === 1 ? 'prestation' : 'prestations'}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category); }}
                  className="text-sm text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Supprimer la catégorie
                </button>
              </div>

              {/* Services (hidden when collapsed, unless search/filter is active) */}
              {(filterActive || !collapsedCategories.has(category)) && viewMode === 'list' && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {categoryServices.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      Aucune prestation dans cette catégorie
                    </div>
                  ) : (
                    categoryServices.map((service, idx) => (
                      <ServiceRow
                        key={service.id}
                        service={service}
                        isLast={idx === categoryServices.length - 1}
                        onEdit={() => {
                          setEditingService(service);
                          setShowModal(true);
                        }}
                        onDelete={() => handleDeleteService(service.id)}
                        onDuplicate={() => handleDuplicateService(service)}
                        onDragStart={handleDragStart}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredServices.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <p className="text-gray-400 mb-4">Aucune prestation trouvée</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('all');
              }}
              className="text-sm text-[#002366] hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* Service Modal */}
      {showModal && (
        <ServiceModal
          service={editingService}
          categories={categories}
          employees={employees}
          onClose={() => {
            setShowModal(false);
            setEditingService(null);
            setCreateTenantId('');
          }}
          createTenantId={createTenantId}
          onCreateTenantIdChange={setCreateTenantId}
          showSalonPicker={!editingService && isSalonFilterMulti}
          salonOptions={salons.filter((s) => effectiveSalonIds.includes(s.id))}
          onSave={async (service) => {
            try {
              if (!editingService && isSalonFilterMulti && !createTenantId) {
                toast.error('Veuillez sélectionner un salon');
                return;
              }
              const loadingToast = toast.loading(editingService ? 'Modification de la prestation...' : 'Création de la prestation...');
              const apiData = {
                ...transformToApiService(service),
                ...(!editingService && createTenantId ? { tenantId: createTenantId } : {}),
              };
              if (editingService) {
                await api.updateService(editingService.id, apiData);
                toast.dismiss(loadingToast);
                toast.success('Prestation modifiée avec succès');
              } else {
                await api.createService(apiData);
                toast.dismiss(loadingToast);
                toast.success('Prestation créée avec succès');
              }
              await fetchData();
              setShowModal(false);
              setEditingService(null);
              setCreateTenantId('');
            } catch (err: any) {
              console.error('Error saving service:', err);
              toast.error(err.message || 'Erreur lors de l\'enregistrement de la prestation');
            }
          }}
        />
      )}

      {/* Category Modal — pick from the canonical category list (no free text) */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold text-gray-900">Choisir une catégorie</h3>
              <button 
                onClick={() => setShowCategoryModal(false)}
                className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Les catégories sont prédéfinies pour rester cohérentes avec l&apos;application client.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {SALON_CATEGORIES.map((cat) => {
                const existing = categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => handleAddCategory(cat)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      existing
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default'
                        : 'border-gray-200 text-gray-700 hover:border-[#002366] hover:text-[#002366] hover:bg-[#002366]/5'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${existing ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    />
                    {cat}
                    {existing && <Check size={14} className="ml-auto text-emerald-600" />}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && serviceToDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Supprimer la prestation</h3>
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  setServiceToDelete(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
                disabled={deleting}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">
                Êtes-vous sûr de vouloir supprimer la prestation <span className="font-semibold">"{serviceToDelete.name}"</span> ?
              </p>
              
              {serviceToDelete.appointmentCount && serviceToDelete.appointmentCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Attention :</strong> Cette prestation est associée à {serviceToDelete.appointmentCount} rendez-vous.
                    {' Ces rendez-vous seront également supprimés.'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setServiceToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  disabled={deleting}
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDeleteService}
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

// Service Row Component
const ServiceRow = ({ service, isLast, onEdit, onDelete, onDuplicate, onDragStart }: {
  service: Service;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, service: Service) => void;
}) => {
  const getVisibilityIcon = () => {
    if (service.visibility === 'bookable') return <Eye size={14} className="text-emerald-600" />;
    if (service.visibility === 'visible') return <EyeOff size={14} className="text-amber-600" />;
    return <EyeOff size={14} className="text-gray-400" />;
  };

  const getVisibilityText = () => {
    if (service.visibility === 'bookable') return 'Réservable';
    if (service.visibility === 'visible') return 'Visible';
    return 'Masqué';
  };

  return (
    <div 
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, service)}
      className={`p-4 hover:bg-gray-50 transition-colors group cursor-move ${!isLast ? 'border-b border-gray-100' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: service.color }}></div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-medium text-gray-900">{service.name}</h3>
            {service.abbreviation && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                {service.abbreviation}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {service.duration} min
            </span>
            <span className="flex items-center gap-1 font-medium text-gray-900">
              {service.priceType === 'fixed' && `${service.price} MAD`}
              {service.priceType === 'from' && `À partir de ${service.priceFrom} MAD`}
              {service.priceType === 'range' && `${service.priceFrom}-${service.priceTo} MAD`}
              {service.onQuote && ' (Sur devis)'}
            </span>
            <span className="flex items-center gap-1">
              {getVisibilityIcon()}
              {getVisibilityText()}
            </span>
            {service.competences && service.competences.length > 0 && (
              <span className="text-gray-400 truncate">
                {service.competences.join(', ')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
    </div>
  );
};

// Service Card Component
const ServiceCard = ({ service, onEdit, onDelete, onDuplicate }: {
  service: Service;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: service.color }}></div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onDuplicate}
            className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{service.name}</h3>
      <p className="text-xs text-gray-500 mb-4 line-clamp-2">{service.description}</p>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Durée</span>
          <span className="font-medium text-gray-900">{service.duration} min</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Prix</span>
          <span className="font-medium text-gray-900">
            {service.priceType === 'fixed' && `${service.price} MAD`}
            {service.priceType === 'from' && `À partir de ${service.priceFrom} MAD`}
            {service.priceType === 'range' && `${service.priceFrom}-${service.priceTo} MAD`}
            {service.onQuote && ' (Sur devis)'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Visibilité</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
            service.visibility === 'bookable' ? 'bg-emerald-50 text-emerald-700' :
            service.visibility === 'visible' ? 'bg-amber-50 text-amber-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {service.visibility === 'bookable' ? 'Réservable' : service.visibility === 'visible' ? 'Visible' : 'Masqué'}
          </span>
        </div>
      </div>
    </div>
  );
};

// Service Modal Component
const ServiceModal = ({
  service,
  categories,
  employees,
  onClose,
  onSave,
  createTenantId = '',
  onCreateTenantIdChange,
  showSalonPicker = false,
  salonOptions = [],
}: {
  service: Service | null;
  categories: string[];
  employees: Array<{ id: string; firstName: string; lastName: string }>;
  onClose: () => void;
  onSave: (service: Service) => void;
  createTenantId?: string;
  onCreateTenantIdChange?: (id: string) => void;
  showSalonPicker?: boolean;
  salonOptions?: Array<{ id: string; name: string }>;
}) => {
  const [formData, setFormData] = useState<Service>(
    service || {
      id: '',
      name: '',
      abbreviation: '',
      description: '',
      color: '#3B82F6',
      price: 0,
      priceType: 'fixed',
      onQuote: false,
      duration: 60,
      category: categories[0] || '',
      visibility: 'bookable',
      competences: [],
      multipleProviders: false,
      employeeIds: []
    }
  );

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Initialize formData when service changes
  useEffect(() => {
    if (service) {
      setFormData(service);
    } else {
      setFormData({
        id: '',
        name: '',
        abbreviation: '',
        description: '',
        color: '#3B82F6',
        price: 0,
        priceType: 'fixed',
        onQuote: false,
        duration: 60,
        category: categories[0] || '',
        visibility: 'bookable',
        competences: [],
        multipleProviders: false,
        employeeIds: []
      });
    }
  }, [service, categories]);

  const handleSubmit = () => {
    if (showSalonPicker && !createTenantId) {
      toast.error('Veuillez sélectionner un salon');
      return;
    }
    if (!formData.name || !formData.category) {
      toast.error('Veuillez remplir tous les champs obligatoires (Nom et Catégorie)');
      return;
    }
    // Pricing is fixed-price only — 'from'/'range' legacy services are converted on save.
    const fixedFormData = { ...formData, priceType: 'fixed' as const };
    const pricingError = validateServicePricing(fixedFormData);
    if (pricingError) {
      toast.error(pricingError);
      return;
    }
    onSave(fixedFormData);
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-light text-gray-900">
              {service ? 'Modifier une prestation' : 'Nouvelle prestation'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Informations de base
              </h3>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-[#002366] hover:underline flex items-center gap-1"
              >
                {showAdvanced ? 'Masquer' : 'Afficher plus d\'options'}
                <ChevronDown size={14} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="space-y-4">
              {showSalonPicker && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salon <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={createTenantId}
                    onChange={(e) => onCreateTenantIdChange?.(e.target.value)}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Ex: Vernis semi-permanent renforcé | Ongles courts"
                />
              </div>

              {showAdvanced && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Abréviation
                  </label>
                  <input
                    type="text"
                    value={formData.abbreviation}
                    onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Ex: VSP Court"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  placeholder="Décrivez la prestation..."
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
                    className="flex items-center gap-3 px-4 py-2.5 border border-gray-200 rounded-full hover:border-gray-300 transition-colors"
                  >
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-gray-200 shadow-sm" 
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
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Tarification
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Fixed price only — 'Type de prix' removed by design */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prix (MAD)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                      onClick={() => setFormData({ ...formData, price: Math.max(0, Number(formData.price) - 10) })}
                      aria-label="Diminuer le prix"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-center no-arrows"
                      required
                      placeholder="Prix en MAD"
                      min={0}
                    />
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                      onClick={() => setFormData({ ...formData, price: Number(formData.price) + 10 })}
                      aria-label="Augmenter le prix"
                    >
                      +
                    </button>
                  </div>
                </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durée (min)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                    onClick={() => setFormData({ ...formData, duration: Math.max(0, Number(formData.duration) - 5) })}
                    aria-label="Diminuer la durée"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-center no-arrows"
                    required
                    placeholder="Durée en minutes"
                    min={0}
                  />
                  <button
                    type="button"
                    className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                    onClick={() => setFormData({ ...formData, duration: Number(formData.duration) + 5 })}
                    aria-label="Augmenter la durée"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Category & Visibility */}
          <div className="space-y-4">
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Organisation
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie <span className="text-red-500">*</span>
                </label>
                {/* Use Select dropdown for category */}
                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                    <SelectValue placeholder="Sélectionner la catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visibilité
                </label>
                {/* Use Select dropdown for visibility */}
                <Select value={formData.visibility} onValueChange={v => setFormData({ ...formData, visibility: v as 'bookable' | 'visible' | 'hidden' })}>
                  <SelectTrigger className="w-full px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                    <SelectValue placeholder="Sélectionner la visibilité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bookable">Prestation réservable</SelectItem>
                    <SelectItem value="visible">Affichée mais non réservable</SelectItem>
                    <SelectItem value="hidden">Masquée sur le portail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Employés */}
          {showAdvanced && (
            <div className="space-y-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Employés
              </h3>
              <p className="text-xs text-gray-500">
                Sélectionnez les employés qui peuvent effectuer cette prestation
              </p>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {employees.map(employee => {
                    const employeeName = `${employee.firstName} ${employee.lastName}`;
                    const isSelected = formData.employeeIds?.includes(employee.id) || false;
                    return (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => {
                          const currentIds = formData.employeeIds || [];
                          setFormData({
                            ...formData,
                            employeeIds: isSelected
                              ? currentIds.filter(id => id !== employee.id)
                              : [...currentIds, employee.id],
                            competences: isSelected
                              ? formData.competences.filter(c => c !== employeeName)
                              : [...formData.competences, employeeName]
                          });
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-[#002366] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {employeeName}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="multipleProviders"
                    checked={formData.multipleProviders}
                    onCheckedChange={(checked) => setFormData({ ...formData, multipleProviders: !!checked })}
                    className="w-4 h-4 rounded-full text-[#002366] border-gray-300 focus:ring-gray-900"
                  />
                  <label htmlFor="multipleProviders" className="text-sm text-gray-700">
                    Plusieurs collaborateurs peuvent effectuer cette prestation simultanément
                  </label>
                </div>
              </div>
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
            {service ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GestionPrestations;