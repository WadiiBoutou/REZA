'use client';

import { useEffect, useState } from 'react';
import { X, CreditCard, Loader2, Building, Users, ArrowRight, Hourglass } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const DISMISS_KEY = 'paywall_dismissed';

interface Overview {
  bill: {
    total: number;
    salonFee: number;
    employeeFee: number;
    salonsDue: number;
    employeesDue: number;
    currency: string;
    periodActive: boolean;
  };
  payments: { id: string; amount: number; status: string; createdAt: string }[];
}

/**
 * Post-login paywall: shown when the account's live bill is not fully settled
 * (unpaid salons and/or employees). Dismissal lasts for the browser session.
 * The CTA routes to the "Mon abonnement" page where the admin declares the
 * virement payment.
 */
export default function PaywallModal() {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadingBill, setLoadingBill] = useState(false);

  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;
    if (user.role !== 'ADMIN') return;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;

    let cancelled = false;
    setLoadingBill(true);
    api
      .getBillingOverview()
      .then((data) => {
        if (cancelled) return;
        setOverview(data as Overview);
        const due = data?.bill?.total ?? 0;
        if (due > 0) setOpen(true);
      })
      .catch(() => {
        /* ignore — the mon-abonnement page surfaces errors */
      })
      .finally(() => {
        if (!cancelled) setLoadingBill(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated, user?.id]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  if (!open) return null;

  const bill = overview?.bill;
  const hasPending = (overview?.payments ?? []).some((p) => p.status === 'PENDING');
  const due = bill?.total ?? 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={dismiss} />

      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
          aria-label="Fermer"
        >
          <X size={20} />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-[#002366]/10 flex items-center justify-center mb-5">
          {hasPending ? (
            <Hourglass className="text-amber-600" size={26} />
          ) : (
            <CreditCard className="text-[#002366]" size={26} />
          )}
        </div>

        <h2 className="text-xl font-bold text-gray-900">
          {hasPending ? 'Paiement en attente de validation' : 'Votre facture n’est pas entièrement réglée'}
        </h2>

        {hasPending ? (
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Votre déclaration de virement est en cours de vérification par la plateforme.
            Vos salons et employés non couverts restent masqués pour les clients jusqu’à
            l’approbation.
          </p>
        ) : (
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Pour que vos salons et employés soient visibles par les clients, réglez le
            montant dû par virement bancaire. Votre facture est calculée automatiquement.
          </p>
        )}

        {loadingBill ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-[#002366]" size={22} />
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 p-5 mt-6 space-y-3">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-gray-900">Montant dû</p>
              <p className="text-2xl font-bold text-[#002366]">
                {due.toLocaleString('fr-FR')} {bill?.currency ?? 'MAD'}
              </p>
            </div>
            <ul className="space-y-2">
              {!!bill?.salonsDue && (
                <li className="flex items-center gap-2 text-xs text-gray-600">
                  <Building size={14} className="text-[#002366] shrink-0" />
                  {bill.salonsDue} salon{bill.salonsDue > 1 ? 's' : ''} à couvrir —{' '}
                  {bill.salonFee.toLocaleString('fr-FR')} {bill?.currency ?? 'MAD'}
                </li>
              )}
              {!!bill?.employeesDue && (
                <li className="flex items-center gap-2 text-xs text-gray-600">
                  <Users size={14} className="text-[#002366] shrink-0" />
                  {bill.employeesDue} employé{bill.employeesDue > 1 ? 's' : ''} au-delà du seuil —{' '}
                  {bill.employeeFee.toLocaleString('fr-FR')} {bill?.currency ?? 'MAD'}
                </li>
              )}
              {!bill?.salonsDue && !bill?.employeesDue && (
                <li className="text-xs text-gray-500">Facture en cours de calcul…</li>
              )}
            </ul>
          </div>
        )}

        <button
          onClick={() => {
            setOpen(false);
            router.push('/dashboard/admin/mon-abonnement');
          }}
          className="w-full mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#002366] text-white text-sm font-semibold hover:bg-[#001a4d] transition-all"
        >
          {hasPending ? 'Suivre mon paiement' : 'Voir ma facture'}
          <ArrowRight size={16} />
        </button>

        <button
          onClick={dismiss}
          className="w-full mt-3 text-xs font-medium text-gray-400 hover:text-gray-600 transition-all"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
