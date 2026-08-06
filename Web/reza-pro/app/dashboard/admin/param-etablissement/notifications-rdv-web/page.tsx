'use client';

import React, { useState, useEffect } from 'react';
import { Check, Mail, Trash2, Plus, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import SalonScopeNotice from '@/components/SalonScopeNotice';
import toast from 'react-hot-toast';

const NotificationRDVPage = () => {
  const { isSalonFilterMulti } = useAuth();
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const response = await api.getAppointmentNotificationEmails();
      setEmails(response.emails || []);
    } catch (err: any) {
      console.error('Error fetching notification emails:', err);
      toast.error(err.message || 'Erreur lors du chargement des emails');
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const saveEmails = async (updatedEmails: string[]) => {
    try {
      setSaving(true);
      await api.updateAppointmentNotificationEmails(updatedEmails);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err: any) {
      console.error('Error saving emails:', err);
      toast.error(err.message || 'Erreur lors de l\'enregistrement des emails');
      throw err; // Re-throw to allow caller to handle
    } finally {
      setSaving(false);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('Veuillez saisir une adresse email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast.error('Format d\'email invalide');
      return;
    }

    if (emails.includes(newEmail.trim())) {
      toast.error('Cet email est déjà ajouté');
      return;
    }

    const updatedEmails = [...emails, newEmail.trim()];
    setEmails(updatedEmails);
    setNewEmail('');
    
    try {
      await saveEmails(updatedEmails);
      toast.success('Email ajouté avec succès');
    } catch (err) {
      // Revert on error
      setEmails(emails);
      setNewEmail(newEmail.trim());
    }
  };

  const handleDeleteEmail = async (email: string) => {
    const updatedEmails = emails.filter(e => e !== email);
    setEmails(updatedEmails);
    
    try {
      await saveEmails(updatedEmails);
      toast.success('Email supprimé avec succès');
    } catch (err) {
      // Revert on error
      setEmails(emails);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddEmail();
    }
  };

  if (isSalonFilterMulti) {
    return <SalonScopeNotice title="Notifications RDV" subtitle="Recevez un email dès qu'un rendez-vous est pris ou annulé en ligne" />;
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
              Notifications RDV
            </h1>
            <p className="text-sm text-gray-500">
              Recevez un email dès qu'un rendez-vous est pris ou annulé en ligne
            </p>
          </div>
        </div>
      </div>

      {/* Card Section */}
      <div className="max-w-6xl mx-auto animate-fadeIn p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#002366] w-8 h-8" />
            <span className="ml-3 text-gray-600">Chargement des emails...</span>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Ajouter une adresse email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={saving}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] text-sm text-gray-700 bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="exemple@email.com"
                />
                <button
                  type="button"
                  onClick={handleAddEmail}
                  disabled={saving}
                  className="px-5 py-3 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="animate-spin w-4 h-4" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Ajouter
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {emails.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Aucun email configuré. Ajoutez une adresse email pour recevoir les notifications de rendez-vous.
                </div>
              ) : (
                emails.map(email => (
                  <div key={email} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-full px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-900 font-medium">{email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteEmail(email)}
                      disabled={saving}
                      className="px-3 py-1 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors flex items-center gap-1"
                    >
                      <Trash2 size={16} />
                      Supprimer
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationRDVPage;