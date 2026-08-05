'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import SalonScopeNotice from '@/components/SalonScopeNotice';
import toast from 'react-hot-toast';

const GestionListeAttentePage = () => {
  const { isSalonFilterMulti } = useAuth();
  const [activation, setActivation] = useState<'oui' | 'non'>('non');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.getWaitingListSettings();
      setActivation(response.activated ? 'oui' : 'non');
    } catch (err: any) {
      console.error('Error fetching waiting list settings:', err);
      toast.error(err.message || 'Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const loadingToast = toast.loading('Enregistrement...');
      
      await api.updateWaitingListSettings(activation === 'oui');
      
      toast.dismiss(loadingToast);
      toast.success('Paramètres enregistrés avec succès');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err: any) {
      console.error('Error saving waiting list settings:', err);
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (isSalonFilterMulti) {
    return <SalonScopeNotice title="Activation de la liste d'attente" subtitle="Souhaitez-vous activer la liste d'attente ?" />;
  }

  return (
    <div className="min-h-screen p-0 md:p-0">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight mb-2">
              Activation de la liste d'attente
            </h1>
            <p className="text-sm text-gray-500">
              Souhaitez-vous activer la liste d'attente ?
            </p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-3 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin w-4 h-4" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </button>
        </div>
      </div>

      {/* Activation Options */}
      <div className="mb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#002366] w-8 h-8" />
            <span className="ml-3 text-gray-600">Chargement...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-gray-700 text-sm cursor-pointer">
              <input
                type="radio"
                name="activation"
                value="oui"
                checked={activation === 'oui'}
                onChange={() => setActivation('oui')}
                disabled={saving}
                className="h-4 w-4 accent-[#002366] disabled:opacity-50"
              />
              Oui
            </label>
            <label className="flex items-center gap-2 text-gray-700 text-sm cursor-pointer">
              <input
                type="radio"
                name="activation"
                value="non"
                checked={activation === 'non'}
                onChange={() => setActivation('non')}
                disabled={saving}
                className="h-4 w-4 accent-[#002366] disabled:opacity-50"
              />
              Non
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default GestionListeAttentePage;
