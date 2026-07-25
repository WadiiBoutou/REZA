'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Plus, X, Check, Trash2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

type PaymentMethod = {
  id: string;
  type: 'moroccan_transfer' | 'card';
  last4: string;
  name: string;
  createdDate: string;
  isDefault: boolean;
};

export default function PaymentMethodsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  // Accepted payment methods (for dropdowns)
  const [acceptedMethods, setAcceptedMethods] = useState<string[]>([]);
  const [newAcceptedMethod, setNewAcceptedMethod] = useState('');
  const [addingAccepted, setAddingAccepted] = useState(false);
  
  const [newPaymentType, setNewPaymentType] = useState<'moroccan_transfer' | 'card'>('moroccan_transfer');
  const [iban, setIban] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCardBack, setShowCardBack] = useState(false);

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

  const handleDeleteAcceptedMethod = async (name: string) => {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    try {
      const res = await api.deleteAcceptedPaymentMethod(name);
      setAcceptedMethods(res.methods || []);
      toast.success('Méthode de paiement supprimée');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
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

  const formatIBAN = (value: string) => {
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted;
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted;
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleAddPaymentMethod = async () => {
    setError('');
    setSaving(true);

    // Validation
    if (newPaymentType === 'moroccan_transfer') {
      if (!iban || iban.replace(/\s/g, '').length < 15) {
        setError('Veuillez entrer un IBAN marocain valide');
        setSaving(false);
        return;
      }
    } else {
      if (!cardNumber || cardNumber.replace(/\s/g, '').length !== 16) {
        setError('Veuillez entrer un numéro de carte valide');
        setSaving(false);
        return;
      }
      if (!cardName) {
        setError('Veuillez entrer le nom du titulaire');
        setSaving(false);
        return;
      }
      if (!cardExpiry || cardExpiry.length !== 5) {
        setError('Veuillez entrer une date d\'expiration valide');
        setSaving(false);
        return;
      }
      if (!cardCvc || cardCvc.length < 3) {
        setError('Veuillez entrer un CVV valide');
        setSaving(false);
        return;
      }
    }

    try {
      const last4 = newPaymentType === 'moroccan_transfer' 
        ? iban.replace(/\s/g, '').slice(-2)
        : cardNumber.replace(/\s/g, '').slice(-4);

      await api.addPaymentMethod({
        type: newPaymentType,
        iban: newPaymentType === 'moroccan_transfer' ? iban.replace(/\s/g, '') : undefined,
        cardNumber: newPaymentType === 'card' ? cardNumber.replace(/\s/g, '') : undefined,
        cardName: newPaymentType === 'card' ? cardName : undefined,
        cardExpiry: newPaymentType === 'card' ? cardExpiry : undefined,
        cardCvc: newPaymentType === 'card' ? cardCvc : undefined,
        last4
      });

      toast.success('Moyen de paiement ajouté avec succès');
      setShowAddForm(false);
      setIban('');
      setCardNumber('');
      setCardName('');
      setCardExpiry('');
      setCardCvc('');
      setNewPaymentType('moroccan_transfer');
      fetchPaymentMethods();
    } catch (err: any) {
      console.error('Error adding payment method:', err);
      setError(err.message || 'Erreur lors de l\'ajout du moyen de paiement');
    } finally {
      setSaving(false);
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

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce moyen de paiement ?')) {
      return;
    }

    try {
      await api.deletePaymentMethod(id);
      toast.success('Moyen de paiement supprimé avec succès');
      fetchPaymentMethods();
    } catch (err: any) {
      console.error('Error deleting payment method:', err);
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setIban('');
    setCardNumber('');
    setCardName('');
    setCardExpiry('');
    setCardCvc('');
    setNewPaymentType('moroccan_transfer');
    setError('');
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
        @keyframes flipToBack {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(180deg); }
        }
        @keyframes flipToFront {
          from { transform: rotateY(180deg); }
          to { transform: rotateY(0deg); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .card-flip-enter { animation: flipToBack 0.6s ease-in-out; }
        .card-flip-exit { animation: flipToFront 0.6s ease-in-out; }
        .card-3d {
          perspective: 1000px;
        }
        .card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.6s;
          transform-style: preserve-3d;
        }
        .card-inner.flipped {
          transform: rotateY(180deg);
        }
        .card-face {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .card-back {
          transform: rotateY(180deg);
        }
      `}</style>

      {/* Header - Ultra Minimalist Premium */}
      <div className="mb-8 animate-slideUp">
        <div className="flex items-center justify-between">
          {/* Left: Title */}
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">
              Moyens de paiement
            </h1>
            <p className="text-sm text-gray-400">
              Gérez vos informations bancaires pour vos prélèvements
            </p>
          </div>

          {/* Right: Add Button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-5 py-2 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              Ajouter
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Warning Banner */}
      {!showAddForm && (
        <div className="mb-6 bg-amber-50 border border-amber-200/50 rounded-xl p-4 flex gap-3 animate-fadeIn">
          <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
          <p className="text-xs text-amber-800 leading-relaxed">
            Les nouveaux moyens de paiement seront utilisés pour les prochains prélèvements. Les prélèvements planifiés seront effectués sur l&apos;ancien moyen, sauf en cas d&apos;échec.
          </p>
        </div>
      )}

      {/* Accepted Payment Methods Section (for dropdowns) */}
      <div className="mb-8 bg-white rounded-xl border border-gray-100 p-6 animate-slideUp">
        <h2 className="text-lg font-medium text-gray-900 mb-1">Méthodes de paiement acceptées</h2>
        <p className="text-xs text-gray-400 mb-4">
          Ces méthodes apparaîtront dans les listes déroulantes de "Finaliser le rendez-vous" et "Encaisser une vente".
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
                onClick={() => handleDeleteAcceptedMethod(method)}
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

      {/* Add Payment Form - Inline */}
      {showAddForm ? (
        <div className="animate-fadeIn space-y-8 mb-8">
          {/* Header with Close Button */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-6">
            <h2 className="text-2xl font-light text-gray-900">Nouveau moyen de paiement</h2>
            <button
              onClick={handleCancelAdd}
              className="p-2 text-gray-400 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setNewPaymentType('moroccan_transfer')}
                className={`px-6 py-3 text-sm font-medium transition-all relative ${
                  newPaymentType === 'moroccan_transfer'
                    ? 'text-[#002366]'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Virement Marocain
                {newPaymentType === 'moroccan_transfer' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#002366]"></div>
                )}
              </button>
              <button
                onClick={() => setNewPaymentType('card')}
                className={`px-6 py-3 text-sm font-medium transition-all relative ${
                  newPaymentType === 'card'
                    ? 'text-[#002366]'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Carte bancaire
                {newPaymentType === 'card' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#002366]"></div>
                )}
              </button>
            </div>
          </div>

          {/* Moroccan Transfer Form */}
          {newPaymentType === 'moroccan_transfer' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-100">
                <p className="text-sm text-gray-600">
                  Prélèvement bancaire marocain via IBAN
                </p>
              </div>
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
                  Coordonnées bancaires marocaines
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IBAN Marocain
                  </label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(formatIBAN(e.target.value))}
                    placeholder="MA76 XXXX XXXX XXXX XXXX XXXX XXX"
                    maxLength={34}
                    className="w-full px-6 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent transition-all"
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Votre IBAN commence généralement par MA pour le Maroc
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card Form - Side by Side Layout */}
          {newPaymentType === 'card' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <img src="/Images/card/card.png" alt="Visa" className="h-4 w-auto" />
                                    <span>Paiement par carte bancaire</span>

                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: Form Fields */}
                <div className="order-2 lg:order-1">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
                    Informations de la carte
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Numéro de carte
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value.replace(/\D/g, '')))}
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                        className="w-full px-6 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nom du titulaire
                      </label>
                      <input
                        type="text"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value.toUpperCase())}
                        placeholder="FATIMA ZAHRA EL AMRANI"
                        className="w-full px-6 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date d&apos;expiration
                        </label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                          placeholder="MM/AA"
                          maxLength={5}
                          className="w-full px-6 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Code CVV
                        </label>
                        <input
                          type="text"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                          onFocus={() => setShowCardBack(true)}
                          onBlur={() => setShowCardBack(false)}
                          placeholder="123"
                          maxLength={4}
                          className="w-full px-6 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 flex items-start gap-2">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      Vos informations sont sécurisées et cryptées
                    </p>
                  </div>
                </div>

                {/* Right: Interactive Card Preview */}
                <div className="order-1 lg:order-2">
                  <div className="card-3d w-full aspect-[1.586/1] max-w-md mx-auto lg:sticky lg:top-8">
                    <div className={`card-inner ${showCardBack ? 'flipped' : ''}`}>
                      {/* Front of Card */}
                      <div className="card-face rounded-2xl shadow-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl"></div>
                          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-300 rounded-full blur-3xl"></div>
                        </div>
                        
                        {/* Card Content */}
                        <div className="relative h-full p-6 flex flex-col justify-between">
                          {/* Top: Chip and Logo */}
                          <div className="flex items-start justify-between">
                            {/* EMV Chip */}
                         <img src="/Images/card/chip.png" alt="Visa" className="h-6 w-auto object-contain" />

                            {/* Contactless Icon */}
                            <div className="text-white/40">
                         <img src="/Images/logos/logo-transparent.png" alt="Visa" className="h-6 w-auto object-contain" />

                            </div>
                          </div>

                          {/* Middle: Card Number */}
                          <div className="my-4">
                            <div className="text-white text-xl md:text-2xl font-mono tracking-wider drop-shadow-lg">
                              {cardNumber || '•••• •••• •••• ••••'}
                            </div>
                          </div>

                          {/* Bottom: Name and Expiry */}
                          <div className="flex items-end justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="text-white/50 text-[9px] mb-1 uppercase tracking-widest font-medium">
                                Card Holder
                              </div>
                              <div className="text-white text-sm font-medium tracking-wider uppercase truncate drop-shadow">
                                {cardName || 'YOUR NAME'}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <div className="text-white/50 text-[9px] mb-1 uppercase tracking-widest font-medium text-right">
                                Expires
                              </div>
                              <div className="text-white text-sm font-medium tracking-wider tabular-nums drop-shadow">
                                {cardExpiry || 'MM/YY'}
                              </div>
                            </div>
                            {/* Visa Logo */}
                            <div className="flex-shrink-0">
                              <img src="/Images/card/card.png" alt="Visa" className="h-6 w-auto object-contain" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Back of Card */}
                      <div className="card-face card-back rounded-2xl shadow-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
                        {/* Magnetic Stripe */}
                        <div className="w-full h-12 bg-black mt-6"></div>
                        
                        {/* Card Content */}
                        <div className="p-6 pt-8">
                          {/* Signature Strip and CVV */}
                          <div className="bg-white/90 rounded-lg p-4 mb-6">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 border-b border-gray-300 h-8"></div>
                              <div className="ml-4 bg-white border-2 border-dashed border-gray-300 px-3 py-1 rounded">
                                <div className="text-gray-800 font-mono text-sm tracking-wider">
                                  {cardCvc || 'CVV'}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Info Text */}
                          <div className="text-white/60 text-[9px] leading-relaxed space-y-1">
                            <p>This card is property of the issuing bank. If found, please return to the nearest branch.</p>
                          </div>
                          
                          {/* Bottom Logos */}
                          <div className="flex items-center justify-between mt-8">
                            <div className="text-white/40 text-xs"> <img src="/Images/logos/logo-transparent.png" alt="Visa" className="h-6 w-auto object-contain" />
</div>
                            <div className="text-white/40 text-xs">Verified by VISA / MASTERCARD</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200/50 rounded-xl">
              <p className="text-sm text-red-800 flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleCancelAdd}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50 rounded-lg"
              style={{ minWidth: '120px' }}
            >
              Annuler
            </button>
            <button
              onClick={handleAddPaymentMethod}
              disabled={saving}
              className="px-6 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ minWidth: '120px' }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ajout en cours...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Ajouter
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Payment Methods List */
        <div className="space-y-3 mb-6">
          {paymentMethods.length > 0 ? (
            paymentMethods.map((method) => (
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
                    onClick={() => handleDelete(method.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
            ))
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-gray-500 mb-4">Aucun moyen de paiement configuré</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="px-5 py-2 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors flex items-center gap-2 mx-auto"
              >
                Ajouter
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
