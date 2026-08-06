'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  CreditCard,
  Building,
  Loader2,
  Check,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Hourglass,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

interface AccountRow {
  id: string;
  isActive: boolean;
  createdAt: string;
  owner: { id: string; email: string; firstName: string; lastName: string; isActive: boolean } | null;
  salonCount: number;
  salons: { id: string; name: string; city: string | null; isActive: boolean; subscriptionActive: boolean }[];
  subscription: {
    id: string;
    status: string;
    salonsPaid: number;
    subscribedAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
}

interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reference: string | null;
  rejectedReason: string | null;
  details: any;
  createdAt: string;
  approvedAt: string | null;
  declaredBy: { firstName: string; lastName: string; email: string } | null;
  account: {
    id: string;
    owner: { firstName: string; lastName: string; email: string } | null;
    salons: { id: string; name: string }[];
    subscription: { status: string; salonsPaid: number } | null;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Actif', className: 'bg-green-100 text-green-700' },
  NONE: { label: 'Aucun', className: 'bg-gray-100 text-gray-600' },
  PAST_DUE: { label: 'Impayé', className: 'bg-amber-100 text-amber-700' },
  CANCELED: { label: 'Annulé', className: 'bg-red-100 text-red-700' },
};

const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'En attente', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approuvé', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Refusé', className: 'bg-red-100 text-red-700' },
};

const PAGE_SIZE = 10;

export default function SuperAdminPage() {
  const [tab, setTab] = useState<'accounts' | 'billing' | 'payments'>('accounts');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountsTotal, setAccountsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');

  // Billing config
  const [billingConfig, setBillingConfig] = useState<{
    pricePerSalon: number;
    freeEmployeeThreshold: number;
    pricePerEmployee: number;
    employeeTiers: { min: number; max: number | null; price: number }[];
    currency: string;
  } | null>(null);
  const [billingSaving, setBillingSaving] = useState(false);

  // Payments
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PaymentRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const totalPages = Math.max(1, Math.ceil(accountsTotal / PAGE_SIZE));
  const pendingCount = useMemo(() => payments.filter((p) => p.status === 'PENDING').length, [payments]);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced]);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await api.superAdminGetAccounts({ page, limit: PAGE_SIZE, q: qDebounced || undefined });
      setAccounts(res.accounts);
      setAccountsTotal(res.total);
    } finally {
      setAccountsLoading(false);
    }
  }, [page, qDebounced]);

  const loadBilling = useCallback(async () => {
    const res = await api.superAdminGetBillingConfig();
    setBillingConfig({
      ...res.config,
      employeeTiers: Array.isArray(res.config.employeeTiers) ? res.config.employeeTiers : [],
    });
  }, []);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await api.superAdminGetPayments();
      setPayments(res.payments);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadAccounts(), loadBilling(), loadPayments()]);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [loadAccounts, loadBilling, loadPayments]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    setError(null);
    loadAccounts().catch((e: any) => setError(e.message || 'Erreur de chargement'));
  }, [loadAccounts, loading]);

  const toggleAccountActive = async (account: AccountRow) => {
    setBusyId(account.id);
    try {
      await api.superAdminUpdateAccount(account.id, { isActive: !account.isActive });
      await loadAccounts();
      await loadPayments();
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  const saveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingConfig) return;
    setBillingSaving(true);
    setError(null);
    try {
      const res = await api.superAdminUpdateBillingConfig({
        pricePerSalon: billingConfig.pricePerSalon,
        freeEmployeeThreshold: billingConfig.freeEmployeeThreshold,
        pricePerEmployee: billingConfig.pricePerEmployee,
        employeeTiers: billingConfig.employeeTiers,
        currency: billingConfig.currency,
      });
      setBillingConfig({
        ...res.config,
        employeeTiers: Array.isArray(res.config.employeeTiers) ? res.config.employeeTiers : [],
      });
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setBillingSaving(false);
    }
  };

  const approvePayment = async (p: PaymentRow) => {
    setBusyId(p.id);
    setError(null);
    try {
      await api.superAdminApprovePayment(p.id);
      await Promise.all([loadPayments(), loadAccounts()]);
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    setError(null);
    try {
      await api.superAdminRejectPayment(rejectTarget.id, rejectReason.trim() || undefined);
      setRejectTarget(null);
      setRejectReason('');
      await loadPayments();
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-[#002366]" size={28} />
      </div>
    );
  }

  const filteredPayments =
    paymentFilter === 'ALL' ? payments : payments.filter((p) => p.status === paymentFilter);

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-8 flex-wrap">
        <button
          onClick={() => setTab('accounts')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
            tab === 'accounts' ? 'bg-[#002366] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Users size={16} />
          Comptes ({accountsTotal})
        </button>
        <button
          onClick={() => setTab('billing')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
            tab === 'billing' ? 'bg-[#002366] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CreditCard size={16} />
          Tarification
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
            tab === 'payments' ? 'bg-[#002366] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Landmark size={16} />
          Paiements
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-6 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Comptes */}
      {tab === 'accounts' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-full border border-gray-200 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
                placeholder="Rechercher propriétaire, email ou salon…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {accountsLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-[#002366]" size={22} />
            </div>
          )}

          {!accountsLoading &&
            accounts.map((account) => {
              const status = account.subscription?.status ?? 'NONE';
              const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.NONE;
              return (
                <div key={account.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                        {account.owner
                          ? `${account.owner.firstName} ${account.owner.lastName}`.trim() ||
                            account.owner.email
                          : 'Compte sans propriétaire'}
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.className}`}>
                          Abonnement : {statusInfo.label}
                        </span>
                        {!account.isActive && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Compte désactivé
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {account.owner?.email}
                        {account.subscription &&
                          ` — ${account.subscription.salonsPaid}/${account.salonCount} salons couverts`}
                        {account.subscription?.currentPeriodEnd &&
                          ` — période jusqu'au ${new Date(account.subscription.currentPeriodEnd).toLocaleDateString('fr-FR')}`}
                      </p>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {account.salons.map((salon) => (
                          <span
                            key={salon.id}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                              salon.subscriptionActive
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`}
                            title={salon.subscriptionActive ? 'Visible clients' : 'Non visible clients'}
                          >
                            <Building size={11} />
                            {salon.name}
                          </span>
                        ))}
                        {account.salonCount === 0 && (
                          <span className="text-[11px] text-gray-400">Aucun salon</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleAccountActive(account)}
                        disabled={busyId === account.id}
                        className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
                          account.isActive
                            ? 'border-red-300 text-red-600 hover:bg-red-50'
                            : 'border-green-300 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {busyId === account.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : account.isActive ? (
                          'Désactiver compte'
                        ) : (
                          'Réactiver compte'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

          {!accountsLoading && accounts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
              Aucun compte.
            </div>
          )}

          {accountsTotal > 0 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-gray-500">
                {accountsTotal} compte{accountsTotal > 1 ? 's' : ''} — page {page}/{totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || accountsLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all"
                >
                  <ChevronLeft size={14} />
                  Préc.
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || accountsLoading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all"
                >
                  Suiv.
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tarification */}
      {tab === 'billing' && billingConfig && (
        <form onSubmit={saveBilling} className="max-w-xl rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Tarification de la plateforme</h2>
          <p className="text-xs text-gray-500 mb-6">
            Ces prix s&apos;appliquent à tous les salons. Frais unique par salon + frais par employé au-delà du seuil gratuit, par période.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Prix par salon ({billingConfig.currency}) — frais unique
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-full border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
                value={billingConfig.pricePerSalon}
                onChange={(e) =>
                  setBillingConfig({ ...billingConfig, pricePerSalon: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Employés gratuits par salon
              </label>
              <input
                type="number"
                min="0"
                step="1"
                className="w-full rounded-full border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
                value={billingConfig.freeEmployeeThreshold}
                onChange={(e) =>
                  setBillingConfig({
                    ...billingConfig,
                    freeEmployeeThreshold: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Prix par employé par défaut ({billingConfig.currency}) — utilisé quand aucune tranche n'est définie
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-full border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
                value={billingConfig.pricePerEmployee}
                onChange={(e) =>
                  setBillingConfig({ ...billingConfig, pricePerEmployee: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            {/* Per-employee price tiers (progressive: chaque employé facturable est facturé au tarif de sa tranche) */}
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Tranches de prix par employé ({billingConfig.currency}) — tarification progressive
              </label>
              <p className="text-[11px] text-gray-400 mb-3">
                Ex. « 1-5 employés à 100 » puis « 6+ à 80 » : un salon avec 7 employés facturables paie 5×100 + 2×80 = 660.
                Laissez vide « jusqu'à » pour une tranche sans limite. Le seuil gratuit s'applique avant les tranches.
              </p>
              {billingConfig.employeeTiers.length > 0 ? (
                <div className="space-y-2">
                  {billingConfig.employeeTiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">De</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="w-16 rounded-lg border border-gray-200 px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
                        value={tier.min}
                        onChange={(e) => {
                          const tiers = [...billingConfig.employeeTiers];
                          tiers[i] = { ...tiers[i], min: parseInt(e.target.value, 10) || 1 };
                          setBillingConfig({ ...billingConfig, employeeTiers: tiers });
                        }}
                      />
                      <span className="text-xs text-gray-500">à</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="∞"
                        className="w-16 rounded-lg border border-gray-200 px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
                        value={tier.max ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const tiers = [...billingConfig.employeeTiers];
                          tiers[i] = { ...tiers[i], max: val === '' ? null : parseInt(val, 10) || null };
                          setBillingConfig({ ...billingConfig, employeeTiers: tiers });
                        }}
                      />
                      <span className="text-xs text-gray-500">employés :</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-24 rounded-lg border border-gray-200 px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
                        value={tier.price}
                        onChange={(e) => {
                          const tiers = [...billingConfig.employeeTiers];
                          tiers[i] = { ...tiers[i], price: parseFloat(e.target.value) || 0 };
                          setBillingConfig({ ...billingConfig, employeeTiers: tiers });
                        }}
                      />
                      <span className="text-xs text-gray-500">{billingConfig.currency}/employé</span>
                      <button
                        type="button"
                        onClick={() =>
                          setBillingConfig({
                            ...billingConfig,
                            employeeTiers: billingConfig.employeeTiers.filter((_, idx) => idx !== i),
                          })
                        }
                        className="ml-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Supprimer la tranche"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Aucune tranche définie — le tarif par défaut s'applique à tous les employés facturables.</p>
              )}
              <button
                type="button"
                onClick={() => {
                  const tiers = [...billingConfig.employeeTiers];
                  const last = tiers[tiers.length - 1];
                  const nextMin = last ? (last.max === null ? last.min + 1 : last.max + 1) : 1;
                  tiers.push({ min: nextMin, max: null, price: billingConfig.pricePerEmployee });
                  setBillingConfig({ ...billingConfig, employeeTiers: tiers });
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all"
              >
                + Ajouter une tranche
              </button>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              type="submit"
              disabled={billingSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#002366] text-white text-sm font-semibold hover:bg-[#001a4d] transition-all disabled:opacity-50"
            >
              {billingSaving && <Loader2 size={16} className="animate-spin" />}
              Enregistrer la tarification
            </button>
          </div>
        </form>
      )}

      {/* Paiements */}
      {tab === 'payments' && (
        <div>
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setPaymentFilter(s)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  paymentFilter === s
                    ? 'bg-[#002366] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s === 'PENDING' ? 'En attente' : s === 'APPROVED' ? 'Approuvés' : s === 'REJECTED' ? 'Refusés' : 'Tous'}
              </button>
            ))}
          </div>

          {paymentsLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-[#002366]" size={22} />
            </div>
          )}

          {!paymentsLoading &&
            filteredPayments.map((p) => {
              const st = PAYMENT_STATUS[p.status] ?? { label: p.status, className: 'bg-gray-100 text-gray-600' };
              return (
                <div key={p.id} className="rounded-2xl border border-gray-200 bg-white p-5 mb-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                        {p.amount.toLocaleString('fr-FR')} {p.currency}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.className}`}>
                          {p.status === 'PENDING' && <Hourglass size={11} />}
                          {p.status === 'APPROVED' && <CheckCircle2 size={11} />}
                          {p.status === 'REJECTED' && <XCircle size={11} />}
                          {st.label}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {p.account?.owner
                          ? `${p.account.owner.firstName} ${p.account.owner.lastName}`.trim() || p.account.owner.email
                          : p.account?.id}
                        {' — '}
                        {p.account?.salons.map((s) => s.name).join(', ') || 'aucun salon'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Déclaré le {new Date(p.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {p.declaredBy && ` par ${p.declaredBy.firstName} ${p.declaredBy.lastName}`}
                        {p.reference && ` — réf. ${p.reference}`}
                        {p.approvedAt && ` — validé le ${new Date(p.approvedAt).toLocaleDateString('fr-FR')}`}
                      </p>
                      {p.status === 'REJECTED' && p.rejectedReason && (
                        <p className="text-[11px] text-red-600 mt-1">Raison : {p.rejectedReason}</p>
                      )}
                    </div>

                    {p.status === 'PENDING' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => approvePayment(p)}
                          disabled={busyId === p.id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                          {busyId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Approuver
                        </button>
                        <button
                          onClick={() => {
                            setRejectTarget(p);
                            setRejectReason('');
                          }}
                          disabled={busyId === p.id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                        >
                          <X size={12} />
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {!paymentsLoading && filteredPayments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
              Aucun paiement {paymentFilter === 'PENDING' ? 'en attente' : paymentFilter === 'APPROVED' ? 'approuvé' : paymentFilter === 'REJECTED' ? 'refusé' : ''}.
            </div>
          )}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Refuser le paiement</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {rejectTarget.amount.toLocaleString('fr-FR')} {rejectTarget.currency} —{' '}
                  {rejectTarget.account?.owner?.email ?? rejectTarget.account?.id}
                </p>
              </div>
              <button type="button" onClick={() => setRejectTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Raison du refus (optionnel)
            </label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex. montant incorrect, virement non reçu…"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30"
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busyId === rejectTarget.id}
                onClick={confirmReject}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {busyId === rejectTarget.id && <Loader2 size={16} className="animate-spin" />}
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
