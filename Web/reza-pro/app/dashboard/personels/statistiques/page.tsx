'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Users, Calendar, DollarSign, Search, Download, ChevronLeft, ChevronRight, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

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

export default function CollaborateurStats() {
  const { isAuthenticated, salonFilter, effectiveSalonIds } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year'>('month');

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  // Statistics data state
  const [statsData, setStatsData] = useState({
    collaborators: [] as any[],
    totals: {
      totalServices: 0,
      inSalon: 0,
      online: 0,
      revenue: 0,
      onlineRate: 0
    }
  });

  // Previous-period totals for real delta badges (vs the equivalent previous period)
  const [prevTotals, setPrevTotals] = useState({
    totalServices: 0,
    inSalon: 0,
    online: 0,
    revenue: 0,
    onlineRate: 0
  });

  // Sorting
  type SortKey = 'name' | 'totalServices' | 'inSalon' | 'online' | 'onlineRate' | 'revenue';
  const [sortKey, setSortKey] = useState<SortKey>('totalServices');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Search
  const [employeeSearch, setEmployeeSearch] = useState('');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortButton = ({ label, k, align = 'center' }: { label: string; k: SortKey; align?: 'left' | 'center' | 'right' }) => {
    const active = sortKey === k;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors ${active ? 'text-[#002366]' : 'text-gray-500 hover:text-gray-900'} ${align === 'right' ? 'ml-auto' : align === 'center' ? 'mx-auto' : ''}`}
      >
        {label}
        <Icon size={12} />
      </button>
    );
  };

  const collaborators = useMemo(() => {
    const raw = [...(statsData.collaborators || [])];
    raw.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return raw;
  }, [statsData.collaborators, sortKey, sortDir]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setMounted(true);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, timeFilter, selectedMonth, selectedYear, salonFilterKey]);

  const exportCSV = () => {
    const header = ['Employé', 'Total Prestations', 'Pris en Salon', 'Pris en Ligne', 'Taux en Ligne (%)', "Chiffre d'affaires (MAD)"];
    const rows = collaborators.map((c: { name: string; totalServices: number; inSalon: number; online: number; onlineRate: number; revenue: number }) => [
      c.name, c.totalServices, c.inSalon, c.online, c.onlineRate, c.revenue
    ]);
    rows.push(['Total', totals.totalServices, totals.inSalon, totals.online, totals.onlineRate, totals.revenue]);
    const csv = '\uFEFF' + [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statistiques-employes-${timeFilter}-${selectedMonth + 1}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const window = buildWindow(timeFilter, selectedMonth, selectedYear);
      const prevWindow = prevWindowFor(timeFilter, selectedMonth, selectedYear);

      const [data, prevData] = await Promise.all([
        api.getCollaborateursStats({
          period: timeFilter,
          startDate: window.start.toISOString(),
          endDate: window.end.toISOString()
        }),
        api.getCollaborateursStats({
          period: timeFilter,
          startDate: prevWindow.start.toISOString(),
          endDate: prevWindow.end.toISOString()
        })
      ]);

      setStatsData({
        collaborators: data.collaborators || [],
        totals: data.totals || {
          totalServices: 0,
          inSalon: 0,
          online: 0,
          revenue: 0,
          onlineRate: 0
        }
      });
      setPrevTotals(prevData.totals || {
        totalServices: 0,
        inSalon: 0,
        online: 0,
        revenue: 0,
        onlineRate: 0
      });
    } catch (err: any) {
      console.error('Error fetching collaborateurs stats:', err);
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

  const totals = statsData.totals;

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
      <div className="mb-12 animate-slideUp">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">Statistiques</h1>
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8 animate-fadeIn">
        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <Calendar size={20} className="text-gray-400" />
            </div>
            <DeltaBadge current={totals.totalServices} previous={prevTotals.totalServices} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Total Prestations</p>
            <p className="text-3xl font-light text-gray-900">{totals.totalServices}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <Users size={20} className="text-gray-400" />
            </div>
            <DeltaBadge current={totals.online} previous={prevTotals.online} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Pris en Ligne</p>
            <p className="text-3xl font-light text-gray-900">{totals.online}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <TrendingUp size={20} className="text-gray-400" />
            </div>
            <DeltaBadge current={totals.onlineRate} previous={prevTotals.onlineRate} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Taux en Ligne</p>
            <p className="text-3xl font-light text-gray-900">{totals.onlineRate}%</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <DollarSign size={20} className="text-gray-400" />
            </div>
            <DeltaBadge current={totals.revenue} previous={prevTotals.revenue} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Chiffre d&apos;affaires</p>
            <p className="text-3xl font-light text-gray-900">{totals.revenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</p>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={employeeSearch}
          onChange={(e) => setEmployeeSearch(e.target.value)}
          placeholder="Rechercher un employé…"
          className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/30 bg-white"
        />
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
                  <SortButton label="Total Prestations" k="totalServices" />
                </th>
                <th className="px-6 py-4 text-center">
                  <SortButton label="Pris en Salon" k="inSalon" />
                </th>
                <th className="px-6 py-4 text-center">
                  <SortButton label="Pris en Ligne" k="online" />
                </th>
                <th className="px-6 py-4 text-center">
                  <SortButton label="Taux en Ligne" k="onlineRate" />
                </th>
                <th className="px-6 py-4 text-right">
                  <SortButton label="Chiffre d'affaires" k="revenue" align="right" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {collaborators.filter((c: any) => {
                const q = employeeSearch.trim().toLowerCase();
                return !q || c.name.toLowerCase().includes(q);
              }).length > 0 ? (
                collaborators.filter((c: any) => {
                  const q = employeeSearch.trim().toLowerCase();
                  return !q || c.name.toLowerCase().includes(q);
                }).map((collab: any, index: number) => (
                  <tr key={collab.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: collab.color }}>
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
                      <span className="text-sm font-medium text-gray-900">{collab.totalServices}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-gray-900">{collab.inSalon}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-emerald-600">{collab.online}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                            style={{ width: `${collab.onlineRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 min-w-[45px]">
                          {collab.onlineRate.toFixed(1)} %
                        </span>
                      </div>
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
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    Aucun employé actif avec des prestations pour cette période
                  </td>
                </tr>
              )}

              {/* Total Row */}
              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-900 uppercase tracking-wide">Total</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm text-gray-900">{totals.totalServices}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm text-gray-900">{totals.inSalon}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm text-emerald-600">{totals.online}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm text-gray-900">{totals.onlineRate} %</span>
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
