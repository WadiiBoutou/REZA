'use client';

import React, { useState, useEffect } from 'react';
import { GripVertical, Save, Check } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

type DisplayField = {
  id: string;
  label: string;
  visible: boolean;
  order: number;
};

// Default fields structure (used as fallback only)
const defaultFields: DisplayField[] = [
  { id: 'hours', label: 'Horaires', visible: true, order: 1 },
  { id: 'clientName', label: 'Nom du client', visible: true, order: 2 },
  { id: 'services', label: 'Prestation(s)', visible: true, order: 3 },
  { id: 'notes', label: 'Titre ou note', visible: true, order: 4 },
];

const GestionAffichageRDV = () => {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showColorInRDV, setShowColorInRDV] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [fields, setFields] = useState<DisplayField[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getAppointmentDisplaySettings();
      const settings = response.settings || {};
      
      // Set showColorInRDV from API or default to true
      if (settings.showColorInRDV !== undefined) {
        setShowColorInRDV(settings.showColorInRDV);
      } else {
        setShowColorInRDV(true);
      }

      // Fetch auto-confirm settings
      try {
        const acRes = await api.getAutoConfirmSettings();
        setAutoConfirm(acRes.enabled);
      } catch { /* use default */ }
      
      // Set fields from API or use defaults
      if (settings.fields && Array.isArray(settings.fields) && settings.fields.length > 0) {
        // Ensure fields have all required properties and are sorted by order
        const validatedFields = settings.fields
          .map((field: any) => ({
            id: field.id || '',
            label: field.label || '',
            visible: field.visible !== undefined ? field.visible : true,
            order: field.order || 0
          }))
          .filter((field: DisplayField) => field.id && field.label)
          .sort((a: DisplayField, b: DisplayField) => a.order - b.order);
        
        // Update order numbers to be sequential
        const orderedFields = validatedFields.map((field: DisplayField, index: number) => ({
          ...field,
          order: index + 1
        }));
        
        setFields(orderedFields.length > 0 ? orderedFields : defaultFields);
      } else {
        // Use defaults if no fields in API response
        setFields(defaultFields);
      }
    } catch (err: any) {
      console.error('Error fetching display settings:', err);
      const errorMessage = err.message || 'Erreur lors du chargement des paramètres';
      setError(errorMessage);
      toast.error(errorMessage);
      // Set defaults on error
      setShowColorInRDV(true);
      setFields(defaultFields);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const loadingToast = toast.loading('Enregistrement des paramètres...');
      
      // Ensure fields are properly ordered before saving
      const orderedFields = fields.map((field, index) => ({
        ...field,
        order: index + 1
      }));
      
      await api.updateAppointmentDisplaySettings({
        showColorInRDV,
        fields: orderedFields
      });
      await api.updateAutoConfirmSettings(autoConfirm);
      
      toast.dismiss(loadingToast);
      toast.success('Paramètres enregistrés avec succès');
      
      // Refresh data from API to ensure consistency
      await fetchSettings();
    } catch (err: any) {
      console.error('Error saving display settings:', err);
      toast.dismiss();
      toast.error(err.message || 'Erreur lors de l\'enregistrement des paramètres');
    } finally {
      setSaving(false);
    }
  };

  const toggleFieldVisibility = (fieldId: string) => {
    setFields(fields.map(f => 
      f.id === fieldId ? { ...f, visible: !f.visible } : f
    ));
  };

  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    const newFields = [...fields];
    const draggedField = newFields[draggedItem];
    newFields.splice(draggedItem, 1);
    newFields.splice(index, 0, draggedField);
    
    newFields.forEach((field, idx) => {
      field.order = idx + 1;
    });
    
    setFields(newFields);
    setDraggedItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

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

  if (error && fields.length === 0) {
    return (
      <div className="min-h-screen p-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchSettings();
            }}
            className="px-4 py-2 bg-[#002366] text-white rounded-full hover:bg-gray-800"
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
          <div>
            <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight mb-2">
              Affichage des rendez-vous
            </h1>
            <p className="text-sm text-gray-500">
              Personnalisez l'ordre et la visibilité des informations dans les rendez-vous
            </p>
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2 shadow-sm ${
              saving
                ? 'bg-gray-400 text-white cursor-not-allowed' 
                : 'bg-[#002366] text-white hover:bg-gray-800'
            }`}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 animate-fadeIn">
          
          {/* Left - Configuration */}
          <div className="space-y-6">
            
            {/* Color Setting */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-900">Couleur dans le RDV</h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Afficher la couleur de l'agenda en arrière-plan du rendez-vous
                </p>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-gray-700 text-sm">
                    <input
                      type="radio"
                      name="colorInRDV"
                      value="oui"
                      checked={showColorInRDV}
                      onChange={() => setShowColorInRDV(true)}
                      className="h-4 w-4 accent-[#002366]"
                    />
                    Oui
                  </label>
                  <label className="flex items-center gap-2 text-gray-700 text-sm">
                    <input
                      type="radio"
                      name="colorInRDV"
                      value="non"
                      checked={!showColorInRDV}
                      onChange={() => setShowColorInRDV(false)}
                      className="h-4 w-4 accent-[#002366]"
                    />
                    Non
                  </label>
                </div>
              </div>
            </div>

            {/* Auto-confirm Setting */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-900">Confirmation automatique</h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Confirmer automatiquement les rendez-vous pris en ligne sans intervention manuelle
                </p>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-gray-700 text-sm">
                    <input
                      type="radio"
                      name="autoConfirm"
                      value="oui"
                      checked={autoConfirm}
                      onChange={() => setAutoConfirm(true)}
                      className="h-4 w-4 accent-[#002366]"
                    />
                    Oui
                  </label>
                  <label className="flex items-center gap-2 text-gray-700 text-sm">
                    <input
                      type="radio"
                      name="autoConfirm"
                      value="non"
                      checked={!autoConfirm}
                      onChange={() => setAutoConfirm(false)}
                      className="h-4 w-4 accent-[#002366]"
                    />
                    Non
                  </label>
                </div>
              </div>
            </div>

            {/* Fields Configuration */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  Ordre et visibilité des informations
                </h3>
                <p className="text-xs text-gray-500">
                  Glissez pour réorganiser, activez ou désactivez les champs
                </p>
              </div>
              
              <div className="divide-y divide-gray-100">
                {fields
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((field, sortedIndex) => {
                    const originalIndex = fields.findIndex(f => f.id === field.id);
                    return (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => handleDragStart(originalIndex)}
                    onDragOver={(e) => handleDragOver(e, originalIndex)}
                    onDragEnd={handleDragEnd}
                    className={`px-6 py-4 flex items-center justify-between group hover:bg-gray-50 transition-colors cursor-move ${draggedItem === originalIndex ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-gray-400 group-hover:text-gray-900 transition-colors">
                        <GripVertical size={18} />
                      </div>
                      <span className="text-sm text-gray-900 font-medium">{field.label}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-xs text-gray-500">Afficher</span>
                      <label className="flex items-center gap-2 text-gray-700 text-sm">
                        <input
                          type="radio"
                          name={`${field.id}-visibility`}
                          value="oui"
                          checked={field.visible}
                          onChange={() => toggleFieldVisibility(field.id)}
                          className="h-4 w-4 accent-[#002366]"
                        />
                        Oui
                      </label>
                      <label className="flex items-center gap-2 text-gray-700 text-sm">
                        <input
                          type="radio"
                          name={`${field.id}-visibility`}
                          value="non"
                          checked={!field.visible}
                          onChange={() => toggleFieldVisibility(field.id)}
                          className="h-4 w-4 accent-[#002366]"
                        />
                        Non
                      </label>
                    </div>
                  </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Right - Preview */}
          <div>
            <div className="sticky top-8">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                  <h3 className="text-sm font-medium text-gray-900">Aperçu</h3>
                </div>
                
                <div className="p-6">
                  {/* AppointmentCard Preview - matches agenda style */}
                  <div
                    className={`rounded-lg p-3 border transition-all ${showColorInRDV ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                    style={{ boxShadow: showColorInRDV ? '0 2px 8px rgba(59,130,246,0.08)' : undefined }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        {fields.filter(f => f.visible).sort((a, b) => a.order - b.order).map(field => {
                          switch (field.id) {
                            case 'clientName':
                              return <p key={field.id} className="font-medium truncate break-words w-full">Nom du client</p>;
                            case 'services':
                              return <p key={field.id} className="text-xs opacity-60 truncate break-words w-full mt-0.5">Prestation(s)</p>;
                            case 'notes':
                              return <p key={field.id} className="text-xs opacity-60 truncate break-words w-full mt-0.5">Titre ou note</p>;
                            case 'hours':
                              return (
                                <div key={field.id} className="flex items-center gap-1.5 text-xs opacity-60 mb-1">
                                  {/* Clock icon placeholder */}
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  <span>10:00 · 30min</span>
                                </div>
                              );
                            default:
                              return null;
                          }
                        })}
                      </div>
                      <button className="p-1 opacity-40 hover:opacity-100 transition-opacity">
                        {/* MoreVertical icon placeholder */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                      </button>
                    </div>
                    {/* Show Praticien if any field is visible */}
                    <div className="mt-2 pt-2 border-t border-current/10 text-xs opacity-60">
                      <div className="flex items-center gap-1">
                        {/* User icon placeholder */}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 3-3.87"/><circle cx="12" cy="7" r="4"/></svg>
                        <span className="truncate break-words w-full">Praticien</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Champs visibles</span>
                      <span className="text-gray-900 font-medium">
                        {fields.filter(f => f.visible).length} / {fields.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-3">
                      <span className="text-gray-500">Couleur d&apos;arrière-plan</span>
                      <span className="text-gray-900 font-medium">
                        {showColorInRDV ? 'Activée' : 'Désactivée'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default GestionAffichageRDV;