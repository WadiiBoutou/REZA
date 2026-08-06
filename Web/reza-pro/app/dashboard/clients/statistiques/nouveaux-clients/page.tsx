'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, UserPlus, Search, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type NewClient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  createdAt: string;
  appointmentCount: number;
};

type SortKey = 'name' | 'email' | 'createdAt' | 'appointmentCount';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

export default function NouveauxClientsPage() {
  const { salonFilter, effectiveSalonIds } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'year' | 'week' | 'all'>('year');
  const [clients, setClients] = useState<NewClient[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.getNewClientsStats({ period });
        setClients(data.clients || []);
        setTotal(data.total || 0);
      } catch (err: any) {
        toast.error(err.message || 'Erreur lors du chargement');
        setClients([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period, salonFilterKey]);

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortableHeader = ({ label, k, className = '' }: { label: string; k: SortKey; className?: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1.5 font-medium text-gray-600 hover:text-gray-900 transition-colors ${className}`}
    >
      {label}
      <span className="flex flex-col -space-y-1">
        <ArrowUp
          className={`w-3 h-3 ${sortKey === k && sortDir === 'asc' ? 'text-[#002366]' : 'text-gray-300'}`}
        />
        <ArrowDown
          className={`w-3 h-3 ${sortKey === k && sortDir === 'desc' ? 'text-[#002366]' : 'text-gray-300'}`}
        />
      </span>
    </button>
  );

  const filtered = useMemo(() => {
    let rows = clients;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (c) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
      );
    }
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'fr');
          break;
        case 'email':
          cmp = (a.email || '').localeCompare(b.email || '', 'fr');
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'appointmentCount':
          cmp = a.appointmentCount - b.appointmentCount;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [clients, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Nouveaux clients</h1>
          <p className="text-sm text-gray-500 mt-1">Clients créés sur la période sélectionnée</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-40 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">7 derniers jours</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
            <SelectItem value="year">Cette année</SelectItem>
            <SelectItem value="all">Tout le temps</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total nouveaux</p>
          <p className="text-3xl font-light text-gray-900 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avec RDV</p>
          <p className="text-3xl font-light text-gray-900 mt-1">
            {clients.filter((c) => c.appointmentCount > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sans RDV</p>
          <p className="text-3xl font-light text-gray-900 mt-1">
            {clients.filter((c) => c.appointmentCount === 0).length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="w-full pl-9 pr-4 py-2 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366]"
          />
        </div>
        <span className="text-xs text-gray-400">{filtered.length} client{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Chargement...
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
          <UserPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Aucun nouveau client sur cette période.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
          <p className="text-gray-600">Aucun client ne correspond à « {search} ».</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3">
                    <SortableHeader label="Client" k="name" />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortableHeader label="Contact" k="email" />
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortableHeader label="Inscrit le" k="createdAt" />
                  </th>
                  <th className="text-right px-4 py-3">
                    <SortableHeader label="RDV" k="appointmentCount" className="justify-end" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((client) => (
                  <tr key={client.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {client.firstName} {client.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {client.email || client.phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {format(new Date(client.createdAt), 'd MMM yyyy', { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-right">{client.appointmentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-500">
                Page {safePage} sur {totalPages} · {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-2 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-medium text-gray-700 min-w-[40px] text-center">
                  {safePage}/{totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-2 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
