'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, Plus, X, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function BillingPaymentMethodPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<'SEPA' | 'CARD'>('SEPA');
  const [iban, setIban] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [holderName, setHolderName] = useState('');
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchBillingMethod();
  }, []);

  const fetchBillingMethod = async () => {
    try {
      setLoading(true);
      const res = await api.getBillingPaymentMethod();
      const method = res.method;
      if (method) {
        setHasExisting(true);
        setType(method.type || 'SEPA');
        setIban(method.iban || '');
        setCardLast4(method.cardLast4 || '');
        setHolderName(method.holderName || '');
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (type === 'SEPA' && iban.replace(/\s/g, '').length < 15) {
      toast.error('Veuillez entrer un IBAN valide');
      return;
    }
    if (type === 'CARD' && (!cardLast4 || cardLast4.length < 4)) {
      toast.error('Veuillez entrer les 4 derniers chiffres de la carte');
      return;
    }
    setSaving(true);
    try {
      await api.setBillingPaymentMethod({
        type,
        iban: type === 'SEPA' ? iban.replace(/\s/g, '') : undefined,
        cardLast4: type === 'CARD' ? cardLast4 : undefined,
        holderName: holderName || undefined,
      });
      toast.success('Moyen de paiement enregistré');
      setHasExisting(true);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const formatIBAN = (value: string) => {
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen p-0 md:p-0">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#002366] w-8 h-8 mb-4" />
          <span className="text-gray-600">Chargement...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-0 md:p-0">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>

      <div className="mb-8 animate-slideUp">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">
              Moyen de paiement plateforme
            </h1>
            <p className="text-sm text-gray-400">
              Configurez comment vous payez votre abonnement Reza Pro
            </p>
          </div>
          {hasExisting && (
            <button
              onClick={() => { setHasExisting(false); setType('SEPA'); setIban(''); setCardLast4(''); setHolderName(''); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors underline"
            >
              Modifier
            </button>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-4 flex gap-3 mb-8 animate-fadeIn">
        <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
        <p className="text-xs text-amber-800 leading-relaxed">
          Ce moyen de paiement est utilisé pour les prélèvements de votre abonnement Reza Pro par la plateforme. 
          Il est distinct des moyens de paiement que vous acceptez de la part de vos clients 
          (configurés dans <strong>Paramètre Établissement &gt; Moyen de paiement</strong>).
        </p>
      </div>

      {hasExisting ? (
        <div className="bg-white rounded-xl border border-gray-100 p-6 animate-fadeIn">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
              Enregistré
            </span>
          </div>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-gray-500">Type : </span>
              <span className="font-medium">{type === 'SEPA' ? 'Virement (IBAN)' : 'Carte bancaire'}</span>
            </div>
            {type === 'SEPA' && iban && (
              <div className="text-sm">
                <span className="text-gray-500">IBAN : </span>
                <span className="font-medium font-mono">{formatIBAN(iban)}</span>
              </div>
            )}
            {type === 'CARD' && cardLast4 && (
              <div className="text-sm">
                <span className="text-gray-500">Carte se terminant par : </span>
                <span className="font-medium font-mono">•••• {cardLast4}</span>
              </div>
            )}
            {holderName && (
              <div className="text-sm">
                <span className="text-gray-500">Titulaire : </span>
                <span className="font-medium">{holderName}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fadeIn max-w-xl">
          {/* Type selection */}
          <div className="border-b border-gray-200">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setType('SEPA')}
                className={`px-6 py-3 text-sm font-medium transition-all relative ${
                  type === 'SEPA' ? 'text-[#002366]' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Virement (IBAN)
                {type === 'SEPA' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#002366]" />}
              </button>
              <button
                onClick={() => setType('CARD')}
                className={`px-6 py-3 text-sm font-medium transition-all relative ${
                  type === 'CARD' ? 'text-[#002366]' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Carte bancaire
                {type === 'CARD' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#002366]" />}
              </button>
            </div>
          </div>

          {/* IBAN form */}
          {type === 'SEPA' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Titulaire du compte</label>
                <input
                  type="text" value={holderName} onChange={e => setHolderName(e.target.value)}
                  placeholder="Nom du titulaire"
                  className="w-full px-6 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">IBAN</label>
                <input
                  type="text" value={iban} onChange={e => setIban(formatIBAN(e.target.value))}
                  placeholder="MA76 XXXX XXXX XXXX XXXX XXXX XXX" maxLength={34}
                  className="w-full px-6 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent"
                />
                <p className="mt-2 text-xs text-gray-400">IBAN marocain commençant par MA</p>
              </div>
            </div>
          )}

          {/* Card form */}
          {type === 'CARD' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Titulaire de la carte</label>
                <input
                  type="text" value={holderName} onChange={e => setHolderName(e.target.value.toUpperCase())}
                  placeholder="FATIMA ZAHRA EL AMRANI"
                  className="w-full px-6 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">4 derniers chiffres</label>
                <input
                  type="text" value={cardLast4} onChange={e => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234" maxLength={4}
                  className="w-full px-6 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-[#002366] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : <><Check size={16} /> Enregistrer</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
