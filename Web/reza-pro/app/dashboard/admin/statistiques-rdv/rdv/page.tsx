'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { TrendingUp, TrendingDown, Users, Calendar, Globe, XCircle, UserX, MousePointerClick, Download, ChevronLeft, ChevronRight, Loader2, Ban, CalendarX } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

function DailyStatisticsPageContent() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // Multi-column sorting: each entry is { key, dir }. Click to sort asc, click
  // again to flip to desc, click a third time to remove. Multiple columns can
  // be active at once (applied in order).
  const [sorts, setSorts] = useState<{ key: string; dir: 'asc' | 'desc' }[]>([]);

  // Statistics data state
  const [statsData, setStatsData] = useState({
    dailyData: [] as any[],
    totals: {
      totalPrestations: 0,
      inSalon: 0,
      online: 0,
      totalOnlineRate: '0%',
      absents: 0,
      totalTauxAbsence: '0%',
      annules: 0,
      totalTauxAnnulation: '0%'
    },
    // Real period-over-period deltas (null = no previous-period data → badge hidden)
    deltas: {} as Record<string, number | null>
  });

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  useEffect(() => {
    setMounted(true);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, selectedMonth, selectedYear]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getRdvStats({
        period: timeFilter,
        month: selectedMonth,
        year: selectedYear
      });

      setStatsData({
        dailyData: data.dailyData || [],
        totals: data.totals || {
          totalPrestations: 0,
          inSalon: 0,
          online: 0,
          totalOnlineRate: '0%',
          absents: 0,
          totalTauxAbsence: '0%',
          annules: 0,
          totalTauxAnnulation: '0%'
        },
        deltas: data.deltas || {}
      });
    } catch (err: any) {
      console.error('Error fetching RDV stats:', err);
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

  const SortableTh = ({ label, sortKey, align = 'center' }: { label: string; sortKey: string; align?: 'left' | 'center' | 'right' }) => {
    const active = sorts.find(s => s.key === sortKey);
    const order = sorts.findIndex(s => s.key === sortKey) + 1;
    return (
      <th className={`px-6 py-4 ${align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'} text-xs font-medium text-gray-500 uppercase tracking-wider`}>
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

  const sortedDaily = useMemo(() => {
    const rows = [...statsData.dailyData];
    if (sorts.length === 0) return rows;
    return rows.sort((a, b) => {
      for (const s of sorts) {
        let cmp = 0;
        if (s.key === 'date') {
          const [aD, aM] = a.date.split('/').map(Number);
          const [bD, bM] = b.date.split('/').map(Number);
          cmp = (aM - bM) || (aD - bD);
        } else {
          const av = parseFloat(String(a[s.key] ?? '0').replace('%', ''));
          const bv = parseFloat(String(b[s.key] ?? '0').replace('%', ''));
          cmp = (isNaN(av) ? 0 : av) - (isNaN(bv) ? 0 : bv);
        }
        if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }, [statsData.dailyData, sorts]);

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

  const dailyData = sortedDaily;
  const totals = statsData.totals;

  // Real period-over-period delta badge (value null → hidden: no previous-period data).
  // inverted=true: lower is better (Absents, Taux d'absence) — decrease shown green, increase shown red.
  const DeltaBadge = ({ value, suffix = '%', inverted = false }: { value: number | null | undefined; suffix?: string; inverted?: boolean }) => {
    if (value === null || value === undefined || isNaN(value)) return null;
    const isIncrease = value >= 0;
    const isGood = inverted ? !isIncrease : isIncrease;
    const Icon = isIncrease ? TrendingUp : TrendingDown;
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isGood ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
        <Icon size={12} />
        <span className="text-[10px] font-medium">{value > 0 ? '+' : ''}{value}{suffix}</span>
      </div>
    );
  };

  const exportCSV = () => {
    const header = ['Date', 'Total', 'En Salon', 'En Ligne', 'Taux en Ligne (%)', 'Annulé', "Taux d'annulé (%)", 'Absents', "Taux d'absence (%)"];
    const rows = statsData.dailyData.map((day) => [
      day.date, day.totalPrestations, day.inSalon, day.online, String(day.onlineRate).replace('%', ''),
      day.annules, String(day.tauxAnnulation).replace('%', ''),
      day.absents, String(day.tauxAbsence).replace('%', '')
    ]);
    rows.push(['Total', totals.totalPrestations, totals.inSalon, totals.online, String(totals.totalOnlineRate).replace('%', ''), totals.annules, String(totals.totalTauxAnnulation).replace('%', ''), totals.absents, String(totals.totalTauxAbsence).replace('%', '')]);
    const csv = '\uFEFF' + [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statistiques-rdv-${selectedMonth + 1}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">RDV</h1>
            <p className="text-sm text-gray-400">Vue détaillée par date — dont le taux d'absence</p>
          </div>
          <div className="flex items-center gap-6">
            {/* Date Navigation - same design as vue-ensemble */}
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
            <DeltaBadge value={statsData.deltas.totalPrestations} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Total Prestations</p>
            <p className="text-3xl font-light text-gray-900">{totals.totalPrestations}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <Users size={20} className="text-gray-400" />
            </div>
            <DeltaBadge value={statsData.deltas.inSalon} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">En Salon</p>
            <p className="text-3xl font-light text-gray-900">{totals.inSalon}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <MousePointerClick size={20} className="text-gray-400" />
            </div>
            <DeltaBadge value={statsData.deltas.online} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">En Ligne</p>
            <p className="text-3xl font-light text-gray-900">{totals.online}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <Globe size={20} className="text-gray-400" />
            </div>
            <DeltaBadge value={statsData.deltas.totalOnlineRate} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Taux en Ligne</p>
            <p className="text-3xl font-light text-gray-900">{totals.totalOnlineRate}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center transition-colors">
              <CalendarX size={20} className="text-red-400" />
            </div>
            <DeltaBadge value={statsData.deltas.annules} inverted />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Annulé</p>
            <p className="text-3xl font-light text-red-600">{totals.annules}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center transition-colors">
              <Ban size={20} className="text-red-400" />
            </div>
            <DeltaBadge value={statsData.deltas.totalTauxAnnulation} inverted />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Taux d&apos;annulé</p>
            <p className="text-3xl font-light text-red-600">{totals.totalTauxAnnulation}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center transition-colors">
              <XCircle size={20} className="text-amber-500" />
            </div>
            <DeltaBadge value={statsData.deltas.absents} inverted />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Absents</p>
            <p className="text-3xl font-light text-amber-600">{totals.absents}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center transition-colors">
              <UserX size={20} className="text-amber-500" />
            </div>
            <DeltaBadge value={statsData.deltas.totalTauxAbsence} inverted />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Taux d'absence</p>
            <p className="text-3xl font-light text-amber-600">{totals.totalTauxAbsence}</p>
          </div>
        </div>
      </div>

      {/* Daily Statistics Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-fadeIn">
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-end gap-4">
          {sorts.length > 0 && (
            <button
              onClick={clearSorts}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#002366] bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-full px-3 py-1.5 transition-colors"
            >
              <XCircle size={12} />
              Effacer les tris
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <SortableTh label="Date" sortKey="date" align="left" />
                <SortableTh label="Total" sortKey="totalPrestations" />
                <SortableTh label="En Salon" sortKey="inSalon" />
                <SortableTh label="En Ligne" sortKey="online" />
                <SortableTh label="Taux en ligne" sortKey="onlineRate" />
                <SortableTh label="Annulé" sortKey="annules" />
                <SortableTh label="Taux annulé" sortKey="tauxAnnulation" />
                <SortableTh label="Abs" sortKey="absents" />
                <SortableTh label="Taux abs" sortKey="tauxAbsence" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dailyData.length > 0 ? (
                dailyData.map((day, index) => (
                  <tr
                    key={index}
                    className={`hover:bg-gray-50 transition-colors ${
                      day.totalPrestations === 0 ? 'bg-gray-50/50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">{day.date}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-gray-900">{day.totalPrestations}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-gray-900">{day.inSalon}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-medium ${day.online > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                        {day.online}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {day.totalPrestations > 0 ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                              style={{ width: day.onlineRate }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 min-w-[50px]">
                            {day.onlineRate}
                          </span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-sm font-medium text-gray-400">0%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-medium ${day.annules > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {day.annules}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {day.totalPrestations > 0 ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-500"
                              style={{ width: day.tauxAnnulation }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 min-w-[50px]">
                            {day.tauxAnnulation}
                          </span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-sm font-medium text-gray-400">0%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-medium ${day.absents > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                        {day.absents}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {day.totalPrestations > 0 ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                              style={{ width: day.tauxAbsence }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 min-w-[50px]">
                            {day.tauxAbsence}
                          </span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-sm font-medium text-gray-400">0%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-sm text-gray-500">
                    Aucune donnée disponible pour cette période
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DailyStatisticsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DailyStatisticsPageContent />
    </Suspense>
  );
}
