'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import SalonScopeNotice from '@/components/SalonScopeNotice';
import toast from 'react-hot-toast';

const AProposPage = () => {
  const { isSalonFilterMulti } = useAuth();
  const [description, setDescription] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDescription();
  }, []);

  const fetchDescription = async () => {
    try {
      setLoading(true);
      const response = await api.getEstablishmentDescription();
      setDescription(response.description || '');
    } catch (err: any) {
      console.error('Error fetching description:', err);
      toast.error(err.message || 'Erreur lors du chargement de la description');
      // Set default description on error
      setDescription('');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    
    try {
      setSaving(true);
      const loadingToast = toast.loading('Enregistrement de la description...');
      
      await api.updateEstablishmentDescription(description);
      
      toast.dismiss(loadingToast);
      toast.success('Description enregistrée avec succès');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving description:', err);
      toast.error(err.message || 'Erreur lors de l\'enregistrement de la description');
    } finally {
      setSaving(false);
    }
  };

  const maxChars = 1000;
  const remainingChars = maxChars - description.length;

  if (isSalonFilterMulti) {
    return <SalonScopeNotice title="À-propos" subtitle="Modifier la section à-propos de ma page Reza" />;
  }

  return (
    <div className="min-h-screen p-0 md:p-0 max-w-[2000px] mx-auto">
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
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight mb-2">
              À-propos
            </h1>
            <p className="text-sm text-gray-500">
              Modifier la section à-propos de ma page Reza
            </p>
          </div>
          <a
            href="#"
            className="px-6 py-3 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-all flex items-center gap-2"
          >
            <Building2 size={18} />
            Voir ma page Reza
          </a>
        </div>
        <div className="text-gray-600 text-sm mb-6">
          Ce texte sera soumis à validation.
        </div>
      </div>

      {/* Card Section */}
      <div className="max-w-6xl mx-autop-0 animate-fadeIn">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#002366] w-8 h-8" />
            <span className="ml-3 text-gray-600">Chargement de la description...</span>
          </div>
        ) : (
          <>
            <textarea
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= maxChars) {
                  setDescription(e.target.value);
                }
              }}
              rows={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] text-sm text-gray-700 resize-none leading-relaxed bg-gray-50"
              placeholder="Décrivez votre établissement..."
              disabled={saving}
            />
            <div className="mt-2 text-right text-xs text-gray-500">
              {remainingChars} caractères restants
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full mt-6 bg-[#002366] hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 rounded-full transition-colors uppercase text-sm tracking-wide flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4" />
                  Enregistrement...
                </>
              ) : (
                'SAUVEGARDER'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AProposPage;