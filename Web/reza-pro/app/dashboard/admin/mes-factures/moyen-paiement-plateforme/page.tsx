'use client';

import React, { useState } from 'react';
import { Landmark, Copy, Check, Building2, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * PLATFORM-LEVEL bank details (not per-salon): where salons must send their
 * subscription payments to the platform owner.
 *
 * NOTE (v1): these are configured via env vars with placeholder fallbacks.
 * There is no superadmin settings UI for them yet — the constants below are
 * the single source of truth until a platform-config area exists.
 */
const PLATFORM_BANK = {
  bankName: process.env.NEXT_PUBLIC_PLATFORM_BANK_NAME || 'Banque Populaire',
  accountHolder: process.env.NEXT_PUBLIC_PLATFORM_BANK_HOLDER || 'Reza Platform',
  iban:
    process.env.NEXT_PUBLIC_PLATFORM_BANK_IBAN ||
    'MA76 0000 0000 0000 0000 0000 000',
};

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ''));
      setCopied(true);
      toast.success(`${label} copié`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Impossible de copier — sélectionnez le texte manuellement");
    }
  };
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className={`text-sm font-medium text-gray-900 break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:border-[#002366] hover:text-[#002366] transition-colors"
      >
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  );
}

export default function BillingPaymentMethodPage() {
  return (
    <div className="min-h-screen p-0 md:p-0">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">
              Moyen de paiement plateforme
            </h1>
            <p className="text-sm text-gray-400">
              Comment payer votre abonnement Reza Pro
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Bank details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-full bg-[#002366]/5 flex items-center justify-center">
              <Landmark size={20} className="text-[#002366]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Coordonnées bancaires Reza</h2>
              <p className="text-sm text-gray-500">
                Veuillez effectuer votre virement vers les coordonnées bancaires suivantes :
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-5 py-4">
              <Building2 size={18} className="text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">Banque</p>
                <p className="text-sm font-medium text-gray-900">{PLATFORM_BANK.bankName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-5 py-4">
              <UserRound size={18} className="text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">Bénéficiaire</p>
                <p className="text-sm font-medium text-gray-900">{PLATFORM_BANK.accountHolder}</p>
              </div>
            </div>

            <CopyField label="RIB / IBAN" value={PLATFORM_BANK.iban} />
          </div>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          En cas de doute sur la validité de ces coordonnées, contactez le support Reza avant
          d&apos;effectuer tout virement.
        </p>
      </div>
    </div>
  );
}
