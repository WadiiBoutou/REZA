'use client';

import React, { useState, useEffect } from 'react';
import { Download, Printer, FileText, CreditCard, Building, Users, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────────────

type PaymentDetail = {
  salonsDue?: number;
  employeesDue?: number;
  employeesBySalon?: Record<string, number>;
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reference: string | null;
  payerName: string | null;
  details: PaymentDetail | null;
  createdAt: string;
  approvedAt: string | null;
};

// What the facture breakdown looks like
type FactureRow = {
  payment: Payment;
  hasSalonFee: boolean;
  salonCount: number;
  salonFee: number;
  hasEmployeeFee: boolean;
  employeeCount: number;
  employeeFee: number;
  isFirst: boolean; // first approval = initial setup (salon + employees)
};

// ── Hardcoded pricing (must stay in sync with backend getConfig) ──────────────
const PRICE_PER_SALON = 1000;
const TIERS = [
  { min: 1, max: 1, label: '1 employé', price: 100 },
  { min: 2, max: 5, label: '2–5 employés', price: 90 },
  { min: 6, max: null, label: '6+ employés', price: 80 },
];
const CURRENCY = 'MAD';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFactureRows(payments: Payment[]): FactureRow[] {
  // Work through approved payments chronologically to know which is "first"
  const approved = payments.filter(p => p.status === 'APPROVED').sort(
    (a, b) => new Date(a.approvedAt ?? a.createdAt).getTime() - new Date(b.approvedAt ?? b.createdAt).getTime()
  );

  return approved.map((p, i) => {
    const d = p.details ?? {};
    const salonCount = d.salonsDue ?? 0;
    const salonFee = salonCount * PRICE_PER_SALON;
    const employeeCount = d.employeesDue ?? 0;
    const employeeFee = Math.max(0, p.amount - salonFee);

    return {
      payment: p,
      hasSalonFee: salonCount > 0,
      salonCount,
      salonFee,
      hasEmployeeFee: employeeCount > 0,
      employeeCount,
      employeeFee,
      isFirst: i === 0,
    };
  });
}

function tierLabel(count: number): string {
  for (const t of TIERS) {
    if (t.max === null || count <= t.max) return `${count} × ${t.price} ${CURRENCY}/mois`;
  }
  return `${count} employés`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MesFacturesPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      // Use the billing overview which includes full payment history
      const res = await api.getBillingOverview();
      setPayments((res.payments ?? []) as Payment[]);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const rows = buildFactureRows(payments);

  const totalPaid = rows.reduce((s, r) => s + r.payment.amount, 0);
  const totalSalonFees = rows.reduce((s, r) => s + r.salonFee, 0);
  const totalEmployeeFees = rows.reduce((s, r) => s + r.employeeFee, 0);

  const exportCsv = () => {
    const header = ['Référence', 'Date approbation', 'Salons (frais unique)', 'Montant salons', 'Employés (mensuel)', 'Montant employés', 'Total', 'Devise'];
    const csvRows = rows.map(r => [
      r.payment.reference ?? r.payment.id,
      new Date(r.payment.approvedAt ?? r.payment.createdAt).toLocaleDateString('fr-FR'),
      r.salonCount,
      r.salonFee.toFixed(2),
      r.employeeCount,
      r.employeeFee.toFixed(2),
      r.payment.amount.toFixed(2),
      r.payment.currency,
    ]);
    csvRows.push(['', 'TOTAL', '', totalSalonFees.toFixed(2), '', totalEmployeeFees.toFixed(2), totalPaid.toFixed(2), CURRENCY]);
    const csv = '\uFEFF' + [header, ...csvRows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `factures-abonnement-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#002366] w-8 h-8 mb-4" />
        <span className="text-gray-600">Chargement des factures...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-0">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">Factures d&apos;abonnement</h1>
            <p className="text-sm text-gray-400">Historique de vos paiements validés par la plateforme</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <Download size={16} /> Exporter CSV
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <Printer size={16} /> Imprimer
            </button>
          </div>
        </div>
      </div>

      {/* Tarification reminder */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Grille tarifaire</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-[#002366]/5 border border-[#002366]/10 p-4">
            <div className="flex items-center gap-2 text-[#002366] mb-2">
              <Building size={15} />
              <span className="text-xs font-semibold uppercase tracking-wide">Salon</span>
            </div>
            <p className="text-xl font-bold text-gray-900">1 000 {CURRENCY}</p>
            <p className="text-xs text-gray-500 mt-1">Frais unique par salon — payé une seule fois</p>
          </div>
          <div className="rounded-xl bg-[#002366]/5 border border-[#002366]/10 p-4">
            <div className="flex items-center gap-2 text-[#002366] mb-2">
              <Users size={15} />
              <span className="text-xs font-semibold uppercase tracking-wide">Employés — mensuel</span>
            </div>
            <div className="space-y-1">
              {TIERS.map((t, i) => (
                <p key={i} className="text-xs text-gray-700">
                  <span className="font-semibold">{t.label}</span> : {t.price} {CURRENCY}/employé/mois
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <FileText size={18} className="text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 font-medium">Paiements approuvés</p>
          <p className="text-3xl font-light text-gray-900 mt-1">{rows.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <Building size={18} className="text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 font-medium">Total frais salons</p>
          <p className="text-3xl font-light text-gray-900 mt-1">{totalSalonFees.toLocaleString('fr-FR')} {CURRENCY}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <CreditCard size={18} className="text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 font-medium">Total frais employés</p>
          <p className="text-3xl font-light text-gray-900 mt-1">{totalEmployeeFees.toLocaleString('fr-FR')} {CURRENCY}</p>
        </div>
      </div>

      {/* Factures list */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Aucune facture disponible.</p>
          <p className="text-xs text-gray-400 mt-1">Vos factures apparaissent ici une fois vos paiements approuvés.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const isOpen = expanded === row.payment.id;
            const date = new Date(row.payment.approvedAt ?? row.payment.createdAt);
            const monthLabel = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            return (
              <div key={row.payment.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                {/* Row header — click to expand */}
                <button
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors text-left"
                  onClick={() => setExpanded(isOpen ? null : row.payment.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {row.isFirst ? 'Ouverture du compte' : `Renouvellement mensuel`}
                        <span className="ml-2 text-[11px] font-normal text-gray-400 capitalize">{monthLabel}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {row.hasSalonFee && `${row.salonCount} salon${row.salonCount > 1 ? 's' : ''} (frais unique)`}
                        {row.hasSalonFee && row.hasEmployeeFee && ' · '}
                        {row.hasEmployeeFee && `${row.employeeCount} employé${row.employeeCount > 1 ? 's' : ''} (mensuel)`}
                        {row.payment.reference && ` · réf. ${row.payment.reference}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-lg font-bold text-gray-900">{row.payment.amount.toLocaleString('fr-FR')} {row.payment.currency}</p>
                    <p className="text-[11px] text-gray-400">
                      {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </button>

                {/* Expanded breakdown */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50 space-y-2">
                    {row.hasSalonFee && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Building size={14} className="text-gray-400" />
                          <span>{row.salonCount} salon{row.salonCount > 1 ? 's' : ''} — frais unique (non renouvelable)</span>
                        </div>
                        <span className="font-semibold text-gray-900">{row.salonFee.toLocaleString('fr-FR')} {CURRENCY}</span>
                      </div>
                    )}
                    {row.hasEmployeeFee && (
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users size={14} className="text-gray-400" />
                          <span>{tierLabel(row.employeeCount)} — mensuel</span>
                        </div>
                        <span className="font-semibold text-gray-900">{row.employeeFee.toLocaleString('fr-FR')} {CURRENCY}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-sm font-semibold">
                      <span className="text-gray-900">Total</span>
                      <span className="text-[#002366]">{row.payment.amount.toLocaleString('fr-FR')} {row.payment.currency}</span>
                    </div>
                    {row.payment.payerName && (
                      <p className="text-[11px] text-gray-400 pt-1">Payeur : {row.payment.payerName}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Total footer */}
      {rows.length > 0 && (
        <div className="mt-6 flex items-center justify-between bg-white rounded-xl border border-gray-100 px-6 py-4">
          <p className="text-sm text-gray-500">{rows.length} paiement{rows.length > 1 ? 's' : ''} approuvé{rows.length > 1 ? 's' : ''}</p>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total versé</p>
            <p className="text-2xl font-light text-gray-900">{totalPaid.toLocaleString('fr-FR')} {CURRENCY}</p>
          </div>
        </div>
      )}
    </div>
  );
}
