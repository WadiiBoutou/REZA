'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Building,
  Users,
  CheckCircle2,
  Hourglass,
  Landmark,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DatePicker } from '@/components/ui/date-picker';

interface Overview {
  subscription: {
    status: string;
    subscribedAt: string | null;
    currentPeriodEnd: string | null;
    salonsPaid: number;
  };
  bill: {
    config: {
      pricePerSalon: number;
      freeEmployeeThreshold: number;
      pricePerEmployee: number;
      employeeTiers: { min: number; max: number | null; price: number }[] | null;
      currency: string;
    };
    salonCount: number;
    salonsPaid: number;
    salonsDue: number;
    salonFee: number;
    employeeCount: number;
    employeesDue: number;
    employeeFee: number;
    total: number;
    periodActive: boolean;
    status: string;
    subscribedAt: string | null;
    currentPeriodEnd: string | null;
  };
  salons: SalonBill[];
  payments: any[];
}

interface SalonBill {
  id: string;
  name: string;
  subscriptionActive: boolean;
  salonCovered: boolean;
  employeeCount: number;
  employeesPaid: number;
  billableEmployees: number;
  salonFee: number;
  employeeFee: number;
  total: number;
}

const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'En attente', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approuvé', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Refusé', className: 'bg-red-100 text-red-700' },
};

export default function MonAbonnementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [declareAmount, setDeclareAmount] = useState('');
  const [declareDate, setDeclareDate] = useState<Date | undefined>(undefined);
  const [declarePayerName, setDeclarePayerName] = useState('');
  const [showDeclareForm, setShowDeclareForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Explicit salon selection: only the selected salons contribute to the bill.
  const [selectedSalonIds, setSelectedSalonIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBillingOverview();
      setOverview(data as Overview);
      // Default selection: salons with anything due. A ?salonId= query param
      // (from mes-salons "Couvrir") pre-selects only that salon.
      const prefocus =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('salonId')
          : null;
      const due = (data?.bill?.salons ?? []).filter((s: SalonBill) => s.total > 0);
      const ids = prefocus
        ? due.filter((s: SalonBill) => s.id === prefocus).map((s: SalonBill) => s.id)
        : due.map((s: SalonBill) => s.id);
      setSelectedSalonIds(ids);
      setDeclareAmount(String(ids.reduce((sum, id) => sum + ((data?.bill?.salons ?? []).find((s: SalonBill) => s.id === id)?.total ?? 0), 0)));
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const declare = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(declareAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Montant invalide');
      return;
    }
    if (!declarePayerName.trim()) {
      setError('Veuillez indiquer qui a effectué le virement');
      return;
    }
    setDeclaring(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api.declarePayment({
        amount,
        reference: declareDate ? declareDate.toLocaleDateString('fr-FR') : undefined,
        payerName: declarePayerName.trim(),
        salonIds: selectedSalonIds.length > 0 ? selectedSalonIds : undefined,
      });
      setSuccessMsg('Virement déclaré — en attente de validation par la plateforme dans 24h maximum.');
      setShowDeclareForm(false);
      setDeclareDate(undefined);
      setDeclarePayerName('');
      await load();
    } catch (e: any) {
      setError(e.message || "Impossible de déclarer le paiement");
    } finally {
      setDeclaring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-[#002366]" size={28} />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 text-sm">
        {error || 'Impossible de charger votre abonnement.'}
      </div>
    );
  }

  const { bill, payments, salons } = overview;
  const currency = bill.config.currency;
  const hasPending = payments.some((p) => p.status === 'PENDING');
  const selected = new Set(selectedSalonIds);
  const selectedBills = salons.filter((s) => selected.has(s.id));
  const due = Math.round(selectedBills.reduce((sum, s) => sum + s.total, 0) * 100) / 100;
  const allSelectable = salons.filter((s) => s.total > 0);
  const allSelected = allSelectable.length > 0 && allSelectable.every((s) => selected.has(s.id));

  const toggleSalon = (id: string) => {
    setSelectedSalonIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setDeclareAmount(
        String(
          Math.round(
            salons
              .filter((s) => next.includes(s.id))
              .reduce((sum, s) => sum + s.total, 0) * 100
          ) / 100
        )
      );
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedSalonIds((prev) => {
      const current = new Set(prev);
      const all = allSelectable.every((s) => current.has(s.id));
      const next = all ? [] : allSelectable.map((s) => s.id);
      setDeclareAmount(
        String(
          Math.round(
            salons
              .filter((s) => next.includes(s.id))
              .reduce((sum, s) => sum + s.total, 0) * 100
          ) / 100
        )
      );
      return next;
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mon abonnement</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez votre facturation Reza Pro — paiement par virement bancaire.</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all"
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 mb-6 flex items-center gap-2">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {hasPending && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 mb-6 flex items-center gap-2">
          <Hourglass size={16} className="shrink-0" />
          Une déclaration de virement est en attente de validation par la plateforme — délai maximal de 24h.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tarification */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Tarification</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-[#002366]/5 border border-[#002366]/10 p-4">
                <div className="flex items-center gap-2 text-[#002366] mb-2">
                  <Building size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Salon</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">1 000 {currency}</p>
                <p className="text-xs text-gray-500 mt-1">Frais unique par salon — payé une seule fois</p>
              </div>
              <div className="rounded-xl bg-[#002366]/5 border border-[#002366]/10 p-4">
                <div className="flex items-center gap-2 text-[#002366] mb-2">
                  <Users size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Employés — mensuel</span>
                </div>
                <div className="space-y-1">
                  {bill.config.employeeTiers && bill.config.employeeTiers.length > 0 ? (
                    bill.config.employeeTiers.map((t, i) => {
                      const range =
                        t.max === null || t.max === undefined
                          ? `${t.min}+ employés`
                          : t.min === t.max
                            ? `${t.min} employé${t.min > 1 ? 's' : ''}`
                            : `${t.min}–${t.max} employés`;
                      return (
                        <p key={i} className="text-xs text-gray-700">
                          <span className="font-semibold text-gray-900">{range}</span>
                          {' : '}{t.price} {currency}/employé/mois
                        </p>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-700">
                      <span className="font-semibold text-gray-900">Employé</span> : {bill.config.pricePerEmployee} {currency}/mois
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Votre facture */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Votre facture</h2>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  due > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {due > 0 ? 'Montant dû' : 'Entièrement réglée'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Choisissez les salons que vous souhaitez couvrir — la facture correspond à la sélection.
            </p>
            {allSelectable.length > 1 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-semibold text-[#002366] hover:underline mb-3"
              >
                {allSelected ? 'Tout désélectionner' : 'Sélectionner tous les salons'}
              </button>
            )}
            <div className="space-y-2">
              {salons.map((s) => {
                const isSelected = selected.has(s.id);
                const selectable = s.total > 0;
                const parts: string[] = [];
                if (s.salonFee > 0) parts.push(`${s.salonFee.toLocaleString('fr-FR')} ${currency} unique`);
                if (s.employeeFee > 0)
                  parts.push(`${s.billableEmployees} employé${s.billableEmployees > 1 ? 's' : ''} — ${s.employeeFee.toLocaleString('fr-FR')} ${currency}/mois`);
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all cursor-pointer ${
                      isSelected ? 'border-[#002366]/40 bg-[#002366]/5' : 'border-gray-200 bg-white hover:border-gray-300'
                    } ${!selectable ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!selectable}
                      onChange={() => toggleSalon(s.id)}
                      className="w-4 h-4 accent-[#002366]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{s.name}</span>
                        {s.salonCovered && (
                          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Couvert
                          </span>
                        )}
                        {!s.subscriptionActive && (
                          <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            Non visible aux clients
                          </span>
                        )}
                      </div>
                      {parts.length > 0 ? (
                        <p className="text-[11px] text-gray-500 mt-0.5">{parts.join(' + ')}</p>
                      ) : (
                        <p className="text-[11px] text-gray-400 mt-0.5">Entièrement réglé — rien à payer</p>
                      )}
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${s.total > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                      {s.total > 0 ? `${s.total.toLocaleString('fr-FR')} ${currency}` : '0 ' + currency}
                    </span>
                  </label>
                );
              })}
              {salons.length === 0 && (
                <p className="text-sm text-gray-400">Aucun salon actif</p>
              )}
            </div>
            <div className="h-px bg-gray-100" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                Total{selectedBills.length > 0 ? ` (${selectedBills.length} salon${selectedBills.length > 1 ? 's' : ''} sélectionné${selectedBills.length > 1 ? 's' : ''})` : ''}
              </span>
              <span className="text-2xl font-bold text-[#002366]">
                {due.toLocaleString('fr-FR')} {currency}
              </span>
            </div>
            {!bill.periodActive && bill.salonsPaid > 0 && (
              <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Votre période payée est terminée — les employés au-delà du seuil sont masqués jusqu'au règlement de la nouvelle période.
              </p>
            )}

            {!hasPending && due > 0 && (
              <div className="mt-5">
                <button
                  onClick={() => setShowDeclareForm((v) => !v)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#002366] text-white text-sm font-semibold hover:bg-[#001a4d] transition-all"
                >
                  <Landmark size={16} />
                  Déclarer un virement
                </button>
              </div>
            )}

            {showDeclareForm && (
              <form onSubmit={declare} className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-xs text-gray-600">
                  Effectuez votre virement vers les coordonnées bancaires de la plateforme, puis déclarez-le ci-dessous avec vos informations. Un administrateur validera votre paiement dans 24h.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      Nom du payeur *
                    </label>
                    <input
                      type="text"
                      value={declarePayerName}
                      onChange={(e) => setDeclarePayerName(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      Montant ({currency}) *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={declareAmount}
                      onChange={(e) => setDeclareAmount(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    Date de virement
                  </label>
                  <DatePicker
                    value={declareDate}
                    onChange={setDeclareDate}
                    placeholder="Choisir la date du virement"
                    disabled={(d) => d > new Date()}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={declaring}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#002366] text-white text-sm font-semibold hover:bg-[#001a4d] transition-all disabled:opacity-50"
                  >
                    {declaring && <Loader2 size={14} className="animate-spin" />}
                    Confirmer la déclaration
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeclareForm(false)}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}

            <Link
              href="/dashboard/admin/mes-factures/moyen-paiement-plateforme"
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#002366] hover:underline"
            >
              Voir les coordonnées bancaires de la plateforme
              <ArrowRight size={13} />
            </Link>
          </div>

        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Statut */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Statut</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Abonnement</span>
                <span className="font-semibold text-gray-900">
                  {bill.status === 'ACTIVE' ? 'Actif' : bill.status === 'NONE' ? 'Aucun' : bill.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Début</span>
                <span className="font-medium text-gray-700">
                  {bill.subscribedAt ? new Date(bill.subscribedAt).toLocaleDateString('fr-FR') : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Fin de période</span>
                <span className="font-medium text-gray-700">
                  {bill.currentPeriodEnd ? new Date(bill.currentPeriodEnd).toLocaleDateString('fr-FR') : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
