'use client';

import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import SalonScopeNotice from '@/components/SalonScopeNotice';
import toast from 'react-hot-toast';

const GestionMessages = () => {
  const { isSalonFilterMulti } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.getMessageSettings();
      setEnabled(response.enabled);
      setContent(response.content);
    } catch (err: any) {
      console.error('Error fetching message settings:', err);
      toast.error(err.message || 'Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const loadingToast = toast.loading('Enregistrement du message...');
      
      await api.updateMessageSettings(enabled, content);
      
      toast.dismiss(loadingToast);
      toast.success('Message enregistré avec succès');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err: any) {
      console.error('Error saving message settings:', err);
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (isSalonFilterMulti) {
    return <SalonScopeNotice title="Gestion Message" subtitle="Affichez un message personnalisé à vos clients lors de la réservation en ligne" />;
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
              Gestion Message
            </h1>
            <p className="text-sm text-gray-500">
              Vous pouvez afficher un message personnalisé à vos clients qui prennent rendez-vous en ligne. Ce message apparait juste après le choix de l&apos;horaire du rendez-vous.
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
              <>
                <Save size={16} />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#002366] w-8 h-8" />
          <span className="ml-3 text-gray-600">Chargement...</span>
        </div>
      ) : (
        <>
          {/* Visibility Checkbox */}
          <div className="mb-8">
            <div className="flex items-center gap-6 mb-4">
              <span className="font-bold text-gray-700">VISIBILITÉ</span>
            </div>
            <label className="flex items-center gap-2 text-gray-700 text-sm cursor-pointer">
              <Checkbox 
                checked={enabled}
                onCheckedChange={(checked) => setEnabled(checked === true)}
                disabled={saving}
                className="h-4 w-4"
              />
              Le message est activé sur ma page Reza
            </label>
          </div>

          {/* Message Content */}
          {enabled && (
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contenu du message
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={saving}
                rows={6}
                className="w-full max-w-3xl px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] text-sm text-gray-700 resize-none bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Saisissez votre message personnalisé..."
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GestionMessages;