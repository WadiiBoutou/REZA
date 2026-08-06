'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Users, Calendar, DollarSign, Download, ChevronLeft, ChevronRight, Loader2, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

type SortKey = 'name' | 'occupationRate' | 'workedHours' | 'revenue';

const deltaPct = (current: number, previous: number) => {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100);
  return current > 0 ? 100 : 0;
};

const DeltaBadge = ({ current, previous }: { current: number; previous: number }) => {
  const delta = deltaPct(current, previous);
  if (delta === 0) {
    return (
      <div className="flex items-center gap-1 text-gray-500 bg-gray-50 px-2 py-1 rounded-lg">
        <span className="text-[10px] font-medium">0%</span>
      </div>
    );
  }
  const positive = delta > 0;
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${positive ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span className="text-[10px] font-medium">{positive ? '+' : ''}{delta}%</span>
    </div>
  );
};

// Date windows matching the backend's parseDateRange semantics (stats.service.ts)
const buildWindow = (period: 'week' | 'month' | 'year', month: number, year: number) => {
  const now = new Date();
  let start: Date;
  let end: Date;
  if (period === 'month') {
    start = new Date(year, month, 1);
    end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  } else if (period === 'week') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }
  return { start, end };
};

// Equivalent previous period: previous calendar month for 'month', same-length window immediately before otherwise
const prevWindowFor = (period: 'week' | 'month' | 'year', month: number, year: number) => {
  if (period === 'month') {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    return {
      start: new Date(prevYear, prevMonth, 1),
      end: new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999),
    };
  }
  const w = buildWindow(period, month, year);
  const len = w.end.getTime() - w.start.getTime();
  return {
    start: new Date(w.start.getTime() - len),
    end: new Date(w.start.getTime() - 1),
  };
};

export default function OccupancyCollaborateurs() {
  const { isAuthenticated, salonFilter, effectiveSalonIds } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year'>('month');

  // Prestation filters
  const [services, setServices] = useState<Array<{ id: string; name: string; category: string }>>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('all');
  const [serviceId, setServiceId] = useState('all');

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('occupationRate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Statistics data state
  const [statsData, setStatsData] = useState({
    collaborators: [] as any[],
    totals: {
      occupationRate: 0,
      workedHours: 0,
      revenue: 0,
      appointmentCount: 0
    }
  });

  // Previous-period data for real delta badges (vs the equivalent previous period)
  const [prevStatsData, setPrevStatsData] = useState({
    collaborators: [] as any[],
    totals: {
      occupationRate: 0,
      workedHours: 0,
      revenue: 0,
      appointmentCount: 0
    }
  });

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  // Load the service catalog for the category/prestation filters
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCatalog = async () => {
      try {
        const res = await api.getServices();
        const svcs = (res.services || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          category: s.category || 'AUTRE'
        }));
        setServices(svcs);
        setCategories(Array.from(new Set(svcs.map((s) => s.category))));
      } catch {
        // keep filters empty on failure
      }
    };
    fetchCatalog();
  }, [isAuthenticated, salonFilterKey]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const window = buildWindow(timeFilter, selectedMonth, selectedYear);
      const prevWindow = prevWindowFor(timeFilter, selectedMonth, selectedYear);

      const [data, prevData] = await Promise.all([
        api.getOccupationCollaborateurs({
          period: timeFilter,
          startDate: window.start.toISOString(),
          endDate: window.end.toISOString(),
          categoryId,
          serviceId
        }),
        api.getOccupationCollaborateurs({
          period: timeFilter,
          startDate: prevWindow.start.toISOString(),
          endDate: prevWindow.end.toISOString(),
          categoryId,
          serviceId
        })
      ]);

      setStatsData({
        collaborators: data.collaborators || [],
        totals: data.totals || {
          occupationRate: 0,
          workedHours: 0,
          revenue: 0,
          appointmentCount: 0
        }
      });
      setPrevStatsData({
        collaborators: prevData.collaborators || [],
        totals: prevData.totals || {
          occupationRate: 0,
          workedHours: 0,
          revenue: 0,
          appointmentCount: 0
        }
      });
    } catch (err: any) {
      console.error('Error fetching occupation collaborateurs stats:', err);
      toast.error(err.message || 'Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, selectedMonth, selectedYear, categoryId, serviceId, salonFilterKey]);

  const exportCSV = () => {
    const header = ['Employé', "Taux d'occupation (%)", 'Heures travaillées', "Chiffre d'affaires (MAD)"];
    const rows = collaborators.map((c: any) => [
      c.name, c.occupationRate, c.workedHours, c.revenue
    ]);
    rows.push(['Total', totals.occupationRate, totals.workedHours, totals.revenue]);
    const csv = '\uFEFF' + [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taux-occupation-employes-${timeFilter}-${selectedMonth + 1}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const filteredServices = categoryId === 'all'
    ? services
    : services.filter((s) => s.category === categoryId);

  const collaborators = useMemo(() => {
    const arr = [...statsData.collaborators];
    arr.sort((a: any, b: any) => {
      let cmp: number;
      if (sortKey === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '');
      } else {
        cmp = (a[sortKey] ?? 0) - (b[sortKey] ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [statsData.collaborators, sortKey, sortDir]);

  const totals = statsData.totals;

  // Only employees with at least one appointment in the period count as active
  const activeCount = collaborators.filter((c: { appointmentCount: number }) => c.appointmentCount > 0).length;
  const prevActiveCount = prevStatsData.collaborators.filter((c: { appointmentCount: number }) => c.appointmentCount > 0).length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const hasActiveState =
    categoryId !== 'all' || serviceId !== 'all' || sortKey !== 'occupationRate' || sortDir !== 'desc';

  const clearFilters = () => {
    setCategoryId('all');
    setServiceId('all');
    setSortKey('occupationRate');
    setSortDir('desc');
  };

  const SortButton = ({ label, k, align = 'center' }: { label: string; k: SortKey; align?: 'left' | 'center' | 'right' }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
        sortKey === k ? 'text-[#002366]' : 'text-gray-500 hover:text-gray-800'
      } ${align === 'right' ? 'justify-end' : align === 'left' ? 'justify-start' : 'justify-center'}`}
    >
      {label}
      {sortKey === k ? (
        sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
      ) : (
        <ArrowUpDown size={12} className="opacity-40" />
      )}
    </button>
  );

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-6">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#002366] w-8 h-8 mb-4" />
          <span className="text-gray-600">Chargement des statistiques...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s ease-out; }
        .accent-color { color: #002366; }
      `}</style>

      {/* Header */}
      <div className="mb-8 animate-slideUp">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">Taux d'occupation</h1>
            <p className="text-sm text-gray-400">Analyse détaillée des performances par employé</p>
          </div>
          <div className="flex items-center gap-6">
            {/* Date Navigation */}
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
                Aujourd'hui
              </button>
            </div>
            {/* Time Filter */}
            <div className="flex items-center gap-2">
              {(['week', 'month', 'year'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setTimeFilter(period)}
                  className={`px-4 py-2 text-xs font-medium transition-all ${
                    timeFilter === period
                      ? 'accent-color'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {period === 'week' ? '7j' : period === 'month' ? '30j' : '1an'}
                </button>
              ))}
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            {/* Export Button */}
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
              <Download size={14} />
              Exporter
            </button>
          </div>
        </div>

        {/* Filters row */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setServiceId('all'); }}>
            <SelectTrigger className="px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] text-sm bg-white min-w-[180px]">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger className="px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#002366] text-sm bg-white min-w-[180px]">
              <SelectValue placeholder="Toutes les prestations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les prestations</SelectItem>
              {filteredServices.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveState && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <RotateCcw size={14} />
              Effacer filtres et tri
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8 animate-fadeIn">
        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <Calendar size={20} className="text-gray-400" />
            </div>
            <DeltaBadge current={totals.occupationRate} previous={prevStatsData.totals.occupationRate} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Taux d'occupation moyen</p>
            <p className="text-3xl font-light text-gray-900">{totals.occupationRate.toFixed(1)}%</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <Users size={20} className="text-gray-400" />
            </div>
            <DeltaBadge current={totals.workedHours} previous={prevStatsData.totals.workedHours} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Total heures travaillées</p>
            <p className="text-3xl font-light text-gray-900">{totals.workedHours} h</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <TrendingUp size={20} className="text-gray-400" />
            </div>
            <DeltaBadge current={totals.revenue} previous={prevStatsData.totals.revenue} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Chiffre d&apos;affaires</p>
            <p className="text-3xl font-light text-gray-900">{totals.revenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <DollarSign size={20} className="text-gray-400" />
            </div>
            <DeltaBadge current={activeCount} previous={prevActiveCount} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Employés actifs</p>
            <p className="text-3xl font-light text-gray-900">{activeCount}</p>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-fadeIn">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left">
                  <SortButton label="Employé" k="name" align="left" />
                </th>
                <th className="px-6 py-4 text-center">
                  <SortButton label="Taux d'occupation" k="occupationRate" />
                </th>
                <th className="px-6 py-4 text-center">
                  <SortButton label="Heures travaillées" k="workedHours" />
                </th>
                <th className="px-6 py-4 text-right">
                  <SortButton label="Chiffre d'affaires" k="revenue" align="right" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {collaborators.length > 0 ? (
                collaborators.map((collab) => (
                  <tr key={collab.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: collab.color }}>
                          {collab.avatar ? (
                            <img src={collab.avatar} alt={collab.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-medium text-white">
                              {collab.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-900 font-medium">{collab.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-gray-900">{collab.occupationRate.toFixed(1)} %</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-gray-900">{collab.workedHours} h</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {collab.revenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                    Aucun employé actif avec des données pour cette période
                  </td>
                </tr>
              )}

              {/* Total Row */}
              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-900 uppercase tracking-wide">Total</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm text-gray-900">{totals.occupationRate.toFixed(1)} %</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm text-gray-900">{totals.workedHours} h</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm text-gray-900">
                    {totals.revenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
