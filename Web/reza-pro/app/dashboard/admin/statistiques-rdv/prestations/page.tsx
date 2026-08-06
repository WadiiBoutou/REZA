'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Loader2,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  TrendingUp,
  Users,
  Globe,
  Store,
} from 'lucide-react';

type ServiceStat = {
  name: string;
  total: number;
  salon: number;
  ligne: number;
  taux: number;
  revenue: number;
};

type CategoryStat = {
  category: string;
  items: ServiceStat[];
};

export default function StatistiquesRdvPrestationsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Multi-column sorting on the per-service table (asc → desc → remove per column).
  const [sorts, setSorts] = useState<{ key: string; dir: 'asc' | 'desc' }[]>([]);

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, selectedMonth, selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await api.getPrestationsStats({
        period: timeFilter,
        month: selectedMonth,
        year: selectedYear
      });
      setData(result);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(prev => prev - 1);
      } else {
        setSelectedMonth(prev => prev - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(prev => prev + 1);
      } else {
        setSelectedMonth(prev => prev + 1);
      }
    }
  };

  const categories: CategoryStat[] = useMemo(() => {
    if (!data?.prestationsData) return [];
    return data.prestationsData as CategoryStat[];
  }, [data]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({ ...cat, items: cat.items.filter((s) => s.name.toLowerCase().includes(q)) }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, search]);

  const toggleCategory = (category: string) => {
    setCollapsed(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // ── Multi-column sorting ────────────────────────────────────────────────
  const toggleSort = (key: string) => {
    setSorts(prev => {
      const idx = prev.findIndex(s => s.key === key);
      if (idx === -1) return [...prev, { key, dir: 'asc' as const }];
      if (prev[idx].dir === 'asc') {
        return prev.map((s, i) => (i === idx ? { ...s, dir: 'desc' as const } : s));
      }
      return prev.filter(s => s.key !== key);
    });
  };

  const clearSorts = () => setSorts([]);

  const sortItems = (items: ServiceStat[]): ServiceStat[] => {
    if (sorts.length === 0) return items;
    return [...items].sort((a, b) => {
      for (const s of sorts) {
        let cmp = 0;
        if (s.key === 'name') {
          cmp = String(a.name).localeCompare(String(b.name), 'fr');
        } else {
          const av = Number(a[s.key as keyof ServiceStat] ?? 0);
          const bv = Number(b[s.key as keyof ServiceStat] ?? 0);
          cmp = av - bv;
        }
        if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  };

  const SortableTh = ({ label, sortKey, align = 'center' }: { label: string; sortKey: string; align?: 'left' | 'center' | 'right' }) => {
    const active = sorts.find(s => s.key === sortKey);
    const order = sorts.findIndex(s => s.key === sortKey) + 1;
    return (
      <th className={`px-6 py-3 ${align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'} text-xs font-medium text-gray-500 uppercase tracking-wider`}>
        <button
          onClick={() => toggleSort(sortKey)}
          className={`inline-flex items-center gap-1.5 transition-colors hover:text-gray-900 ${active ? 'text-[#002366]' : ''}`}
          title="Trier (asc → desc → retirer)"
        >
          {label}
          <span className="text-[10px] leading-none">
            {active ? (active.dir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">▲▼</span>}
            {active && sorts.length > 1 ? <span className="ml-0.5">{order}</span> : null}
          </span>
        </button>
      </th>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-[#002366] w-8 h-8" />
      </div>
    );
  }

  const totals = data
    ? { total: data.totalPrestations || 0, salon: data.prisEnSalon || 0, ligne: data.prisEnLigne || 0, taux: data.tauxEnLigne || 0 }
    : { total: 0, salon: 0, ligne: 0, taux: 0 };

  return (
    <div className="min-h-screen p-8">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Statistiques par prestations</h1>
            <p className="text-sm text-gray-400 mt-1">Détail par service et par canal de réservation</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-lg font-light text-gray-900 min-w-[180px] text-center">
                {monthNames[selectedMonth]} {selectedYear}
              </span>
              <button
                onClick={() => navigateMonth('next')}
                className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => {
                  setSelectedMonth(new Date().getMonth());
                  setSelectedYear(new Date().getFullYear());
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Aujourd&apos;hui
              </button>
            </div>
            <div className="flex items-center gap-2">
              {(['week', 'month', 'year'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setTimeFilter(period)}
                  className={`px-4 py-2 text-xs font-medium transition-all ${
                    timeFilter === period ? 'text-[#002366]' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {period === 'week' ? '7j' : period === 'month' ? '30j' : '1an'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8 animate-fadeIn">
        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-6">
            <Calendar size={20} className="text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mb-1 font-medium">Total prestations</p>
          <p className="text-3xl font-light text-gray-900">{totals.total}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-6">
            <Store size={20} className="text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mb-1 font-medium">Pris en salon</p>
          <p className="text-3xl font-light text-gray-900">{totals.salon}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-6">
            <Globe size={20} className="text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mb-1 font-medium">Pris en ligne</p>
          <p className="text-3xl font-light text-gray-900">{totals.ligne}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-6">
            <TrendingUp size={20} className="text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mb-1 font-medium">Taux en ligne</p>
          <p className="text-3xl font-light text-emerald-600">{totals.taux.toFixed(1)}%</p>
        </div>
      </div>

      {/* Search + sort hint */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une prestation..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]"
          />
        </div>
        {sorts.length > 0 && (
          <button onClick={clearSorts} className="text-xs font-medium text-[#002366] hover:underline whitespace-nowrap">
            Effacer les tris
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
        {filteredCategories.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredCategories.map((cat) => {
              const isCollapsed = !!collapsed[cat.category];
              return (
                <div key={cat.category}>
                  <button
                    onClick={() => toggleCategory(cat.category)}
                    className="w-full flex items-center justify-between px-6 py-4 bg-gray-50/60 hover:bg-gray-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRightIcon size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                      <span className="text-sm font-semibold text-gray-900">{cat.category}</span>
                      <span className="text-xs text-gray-400">({cat.items.length} prestation{cat.items.length > 1 ? 's' : ''})</span>
                    </div>
                    <span className="text-xs font-medium text-gray-500">
                      {cat.items.reduce((sum, s) => sum + s.total, 0)} RDV
                    </span>
                  </button>
                  {!isCollapsed && (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <SortableTh label="Prestation" sortKey="name" align="left" />
                          <SortableTh label="Total" sortKey="total" />
                          <SortableTh label="En salon" sortKey="salon" />
                          <SortableTh label="En ligne" sortKey="ligne" />
                          <SortableTh label="Taux en ligne" sortKey="taux" />
                          <SortableTh label="CA (MAD)" sortKey="revenue" align="right" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortItems(cat.items).map((service) => (
                          <tr key={service.name} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-700">{service.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-medium text-gray-900">{service.total}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm text-gray-600">{service.salon}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-medium text-emerald-600">{service.ligne}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-3">
                                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                                    style={{ width: `${service.taux}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-900 min-w-[45px]">{service.taux.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-medium text-gray-900">{service.revenue.toLocaleString('fr-FR')} MAD</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-sm text-gray-500">
              {search ? 'Aucune prestation ne correspond à votre recherche' : 'Aucune donnée disponible pour cette période'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
