'use client';

import React, { useState, useEffect } from 'react';
import { Plus, X, Trash2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import SalonScopeNotice from '@/components/SalonScopeNotice';
import ConfirmDialog from '@/components/ConfirmDialog';
import toast from 'react-hot-toast';

type PaymentMethod = {
  id: string;
  type: 'moroccan_transfer' | 'card';
  last4: string;
  name: string;
  createdDate: string;
  isDefault: boolean;
};

type DeleteTarget =
  | { kind: 'payment'; id: string; label: string }
  | { kind: 'accepted'; name: string }
  | null;

export default function PaymentMethodsPage() {
  const { isSalonFilterMulti } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  // Accepted payment methods (for dropdowns)
  const [acceptedMethods, setAcceptedMethods] = useState<string[]>([]);
  const [newAcceptedMethod, setNewAcceptedMethod] = useState('');
  const [addingAccepted, setAddingAccepted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchPaymentMethods();
    fetchAcceptedMethods();
  }, []);

  const fetchAcceptedMethods = async () => {
    try {
      const res = await api.getAcceptedPaymentMethods();
      setAcceptedMethods(res.methods || []);
    } catch { /* ignore */ }
  };

  const handleAddAcceptedMethod = async () => {
    const name = newAcceptedMethod.trim();
    if (!name) return;
    setAddingAccepted(true);
    try {
      const res = await api.addAcceptedPaymentMethod(name);
      setAcceptedMethods(res.methods || []);
      setNewAcceptedMethod('');
      toast.success('Méthode de paiement ajoutée');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setAddingAccepted(false);
    }
  };

  const confirmDeleteAcceptedMethod = async () => {
    if (!deleteTarget || deleteTarget.kind !== 'accepted') return;
    try {
      setDeleting(true);
      const res = await api.deleteAcceptedPaymentMethod(deleteTarget.name);
      setAcceptedMethods(res.methods || []);
      toast.success('Méthode de paiement supprimée');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await api.getPaymentMethods();
      const methods = (response.paymentMethods || []).map((method: any) => ({
        id: method.id,
        type: method.type,
        last4: method.last4,
        name: method.name,
        createdDate: new Date(method.createdDate).toLocaleDateString('fr-FR'),
        isDefault: method.isDefault || false
      }));
      setPaymentMethods(methods);
    } catch (err: any) {
      console.error('Error fetching payment methods:', err);
      toast.error(err.message || 'Erreur lors du chargement des moyens de paiement');
      setPaymentMethods([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.updatePaymentMethod(id, { isDefault: true });
      toast.success('Moyen de paiement défini par défaut');
      fetchPaymentMethods();
    } catch (err: any) {
      console.error('Error setting default payment method:', err);
      toast.error(err.message || 'Erreur lors de la mise à jour');
    }
  };

  const confirmDeletePaymentMethod = async () => {
    if (!deleteTarget || deleteTarget.kind !== 'payment') return;
    try {
      setDeleting(true);
      await api.deletePaymentMethod(deleteTarget.id);
      toast.success('Moyen de paiement supprimé avec succès');
      fetchPaymentMethods();
    } catch (err: any) {
      console.error('Error deleting payment method:', err);
      toast.error(err.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen p-0 md:p-0">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#002366] w-8 h-8 mb-4" />
          <span className="text-gray-600">Chargement des moyens de paiement...</span>
        </div>
      </div>
    );
  }

  // Payment methods are salon-scoped: require a single salon selection.
  if (isSalonFilterMulti) {
    return <SalonScopeNotice title="Moyen de paiement" subtitle="Moyens de paiement acceptés de la part de vos clients" />;
  }

  return (
    <div className="min-h-screen p-0 md:p-0">
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
        <div>
          <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">
            Moyens de paiement
          </h1>
          <p className="text-sm text-gray-400">
            Gérez vos informations bancaires pour vos prélèvements
          </p>
        </div>
      </div>

      {/* Accepted Payment Methods Section (for dropdowns) */}
      <div className="mb-8 bg-white rounded-xl border border-gray-100 p-6 animate-slideUp">
        <h2 className="text-lg font-medium text-gray-900 mb-1">Méthodes de paiement acceptées</h2>
        <p className="text-xs text-gray-400 mb-4">
          Ces méthodes apparaîtront dans les listes déroulantes de &quot;Finaliser le rendez-vous&quot; et &quot;Encaisser une vente&quot;.
        </p>

        {/* Current methods */}
        <div className="flex flex-wrap gap-2 mb-3">
          {acceptedMethods.map((method) => (
            <span
              key={method}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-700"
            >
              {method}
              <button
                onClick={() => setDeleteTarget({ kind: 'accepted', name: method })}
                disabled={acceptedMethods.length <= 1}
                className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                title={acceptedMethods.length <= 1 ? 'Impossible de supprimer la dernière méthode' : undefined}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>

        {/* Add new */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newAcceptedMethod}
            onChange={(e) => setNewAcceptedMethod(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddAcceptedMethod(); }}
            placeholder="Nom de la méthode (ex: Carte bancaire)"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent"
          />
          <button
            onClick={handleAddAcceptedMethod}
            disabled={addingAccepted || !newAcceptedMethod.trim()}
            className="px-4 py-2 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {addingAccepted ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />}
            Ajouter
          </button>
        </div>
      </div>

      {/* Payment Methods List */}
      {paymentMethods.length > 0 && (
        <div className="space-y-3 mb-6">
          {paymentMethods.map((method) => (
            <div key={method.id} className="rounded-xl border border-gray-100 p-6 hover:shadow-sm transition-all animate-fadeIn group">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-lg flex items-center justify-center">
                    {method.type === 'moroccan_transfer' ? (
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                        <span className="text-black text-xs font-bold">Virement</span>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                        <span className="text-black text-xs font-bold">Card</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-medium text-gray-900">{method.name}</span>
                      {method.isDefault && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-full">
                          Par défaut
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      WLB • Créé le {method.createdDate}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!method.isDefault && (
                    <button
                      onClick={() => handleSetDefault(method.id)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                    >
                      Définir par défaut
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget({ kind: 'payment', id: method.id, label: method.name })}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'accepted' ? `Supprimer "${deleteTarget.name}" ?` : 'Supprimer ce moyen de paiement ?'}
        description={
          deleteTarget?.kind === 'payment'
            ? `Le moyen de paiement « ${deleteTarget.label} » sera définitivement supprimé.`
            : 'Cette méthode de paiement sera retirée des listes déroulantes.'
        }
        confirmText="Supprimer"
        cancelText="Annuler"
        variant="destructive"
        loading={deleting}
        onConfirm={deleteTarget?.kind === 'accepted' ? confirmDeleteAcceptedMethod : confirmDeletePaymentMethod}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
