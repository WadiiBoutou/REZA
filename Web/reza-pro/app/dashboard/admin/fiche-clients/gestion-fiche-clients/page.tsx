'use client';

import React, { useState, useEffect } from 'react';
import { 
  Save,
  Loader2,
  Check
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

type FieldConfig = {
  name: string;
  label: string;
  display: boolean;
  required: boolean;
  askYearOnly?: boolean;
  askPostalCodeOnly?: boolean;
};

const GestionFicheClients = () => {
  const { isAuthenticated, salonFilter, effectiveSalonIds } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const defaultFields: FieldConfig[] = [
    {
      name: 'genre',
      label: 'Genre',
      display: true,
      required: false
    },
    {
      name: 'birthDate',
      label: 'Date de naissance',
      display: true,
      required: false,
      askYearOnly: false
    },
    {
      name: 'address',
      label: 'Adresse postale',
      display: true,
      required: false,
      askPostalCodeOnly: false
    }
  ];

  const [fields, setFields] = useState<FieldConfig[]>(defaultFields);

  useEffect(() => {
    if (!isAuthenticated) return;
    setMounted(true);
    fetchFieldSettings();
  }, [isAuthenticated, salonFilterKey]);

  const fetchFieldSettings = async () => {
    try {
      setLoading(true);
      const response = await api.getClientFieldSettings();
      if (response.fields && response.fields.length > 0) {
        setFields(response.fields);
      }
    } catch (err: any) {
      console.error('Error fetching client field settings:', err);
      toast.error(err.message || 'Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const loadingToast = toast.loading('Enregistrement des paramètres...');
      
      await api.updateClientFieldSettings(fields);
      
      toast.dismiss(loadingToast);
      toast.success('Paramètres enregistrés avec succès');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err: any) {
      console.error('Error saving client field settings:', err);
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const toggleYearOnly = (index: number) => {
    const newFields = [...fields];
    if (newFields[index].askYearOnly !== undefined) {
      newFields[index].askYearOnly = !newFields[index].askYearOnly;
    }
    setFields(newFields);
  };

  const togglePostalCodeOnly = (index: number) => {
    const newFields = [...fields];
    if (newFields[index].askPostalCodeOnly !== undefined) {
      newFields[index].askPostalCodeOnly = !newFields[index].askPostalCodeOnly;
    }
    setFields(newFields);
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-12 rounded-xl w-1/3"></div>
          <div className="bg-gray-200 h-96 rounded-2xl"></div>
        </div>
      </div>
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

      {/* Header */}
      <div className="mb-8 animate-slideDown">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-5xl font-light text-gray-900 tracking-tight">
                Gestion fiche clients
              </h1>
              <p className="text-sm text-gray-600">
          Vous pouvez afficher des champs supplémentaires et déterminer si le champ est obligatoire ou non.
        </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={handleSave}
              disabled={saving}
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
      </div>

      {/* Info Banner */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-100 mb-8">
        
        <p className="text-sm text-gray-600 font-medium mt-0">
          Note : Si les champs ont été rendus obligatoires par l'administrateur, vous ne pourrez pas modifier cette option.
        </p>
      </div>

      {/* Field Configuration */}
      <div className="space-y-8 animate-fadeIn">
        
        {/* Genre Field */}
        <div className="p-0">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Genre</h2>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium text-gray-700 w-24">Afficher :</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="genre-display"
                    checked={fields[0]?.display}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[0]) newFields[0].display = true;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Oui</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="genre-display"
                    checked={!fields[0]?.display}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[0]) newFields[0].display = false;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Non</span>
                </label>
              </div>

              <div className="flex items-center gap-4 ml-12 pl-8 border-l border-gray-200">
                <Label className="text-sm font-medium text-gray-700 w-32">Saisie obligatoire :</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="genre-required"
                    checked={fields[0]?.required}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[0]) newFields[0].required = true;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Oui</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="genre-required"
                    checked={!fields[0]?.required}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[0]) newFields[0].required = false;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Non</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Date de naissance Field */}
        <div className="pt-4">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Date de naissance</h2>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {/* Afficher + Saisie obligatoire aligned */}
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium text-gray-700 w-24">Afficher :</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="birth-display"
                    checked={fields[1]?.display}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[1]) newFields[1].display = true;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Oui</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="birth-display"
                    checked={!fields[1]?.display}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[1]) newFields[1].display = false;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Non</span>
                </label>
                
              </div>
              <div className="flex items-center gap-4 ml-12 pl-8 border-l border-gray-200">
                <Label className="text-sm font-medium text-gray-700 w-32">Saisie obligatoire :</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="birth-required"
                    checked={fields[1]?.required}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[1]) newFields[1].required = true;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Oui</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="birth-required"
                    checked={!fields[1]?.required}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[1]) newFields[1].required = false;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Non</span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-0">
                  <Checkbox
                    checked={fields[1]?.askYearOnly || false}
                    onCheckedChange={() => toggleYearOnly(1)}
                    disabled={saving}
                    className="size-4 rounded-full accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Ne pas demander l&apos;année</span>
                </div>
          </div>
        </div>

        {/* Adresse postale Field */}
        <div className="pt-4">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Adresse postale</h2>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {/* Afficher + Saisie obligatoire aligned */}
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium text-gray-700 w-24">Afficher :</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="address-display"
                    checked={fields[2]?.display}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[2]) newFields[2].display = true;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Oui</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="address-display"
                    checked={!fields[2]?.display}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[2]) newFields[2].display = false;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Non</span>
                </label>
                
              </div>
              <div className="flex items-center gap-4 ml-12 pl-8 border-l border-gray-200">
                <Label className="text-sm font-medium text-gray-700 w-32">Saisie obligatoire :</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="address-required"
                    checked={fields[2]?.required}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[2]) newFields[2].required = true;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Oui</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="address-required"
                    checked={!fields[2]?.required}
                    onChange={() => {
                      const newFields = [...fields];
                      if (newFields[2]) newFields[2].required = false;
                      setFields(newFields);
                    }}
                    disabled={saving}
                    className="w-4 h-4 accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Non</span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-0">
                  <Checkbox
                    checked={fields[2]?.askPostalCodeOnly || false}
                    onCheckedChange={() => togglePostalCodeOnly(2)}
                    disabled={saving}
                    className="size-4 rounded-full accent-[#002366] disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Demander le code postal uniquement</span>
                </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GestionFicheClients;