'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Home, Trash2, Users, Settings, File, BarChart3, LogOut, Settings2, ChevronRight, LayoutPanelLeft, Calendar, Filter, UserCheck, Building, TrendingUp, FileText, ChevronDown, Bell, Menu, CreditCard, LifeBuoy, X, Check, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { getRealtimeSocket, disconnectRealtime } from '@/lib/realtime';
import ConfirmDialog from '@/components/ConfirmDialog';
import ProfileModal from '@/components/ProfileModal';
import { SalonFilterControl } from '@/components/SalonFilterControl';

const CaisseSidebar = ({
  methodFilter,
  setMethodFilter,
  typeFilter,
  setTypeFilter,
  selectedPeriod,
  setSelectedPeriod
}: {
  methodFilter: string;
  setMethodFilter: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  selectedPeriod: string;
  setSelectedPeriod: (v: string) => void;
}) => {
  // Dynamic payment methods: only the methods the salon actually configured
  // (any language / spelling) appear in the filter — never a hardcoded list.
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    api
      .getAcceptedPaymentMethods()
      .then((res) => {
        if (!cancelled && res.methods && res.methods.length > 0) {
          setPaymentMethods(res.methods);
        }
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const methods = paymentMethods.length > 0 ? paymentMethods : ['Espèces', 'Carte', 'Virement', 'Chèque'];
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <CreditCard size={14} />
            Filtres Caisse
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-2">Méthode</label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-full px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                  <SelectValue placeholder="Sélectionner la méthode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {methods.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="Vente">Vente</SelectItem>
                  <SelectItem value="Remboursement">Remboursement</SelectItem>
                  <SelectItem value="Dépôt">Dépôt</SelectItem>
                  <SelectItem value="Retrait">Retrait</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Période</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-full px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm mt-2">
                  <SelectValue placeholder="Sélectionner la période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Aujourd'hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                  <SelectItem value="all">Tout</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { CaisseSidebar };
