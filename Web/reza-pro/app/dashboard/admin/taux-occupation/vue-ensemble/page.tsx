'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Download, Printer, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, BarChart2, Zap, BarChart3, Filter, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

type OccupancyData = {
  [key: string]: { [key: string]: number };
};

const StatistiquesPage = () => {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [draggedCell, setDraggedCell] = useState<{day: string, time: string} | null>(null);

  const [statsData, setStatsData] = useState({
    occupancyData: {} as OccupancyData,
    stats: { average: 0, peak: 0, peakDay: '', peakTime: '' }
  });
  const [prevStats, setPrevStats] = useState<{ average: number; peak: number } | null>(null);

  const daysOfWeek = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  const timeSlots = [
    '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00', '13:00 - 14:00',
    '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00'
  ];

  useEffect(() => {
    setMounted(true);
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, selectedEmployee]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const month = currentDate.getMonth();
      const year = currentDate.getFullYear();

      const prevDate = new Date(year, month - 1, 1);
      const [data, prevData] = await Promise.all([
        api.getOccupationVueEnsemble({
          month,
          year,
          employeeId: selectedEmployee === 'all' ? undefined : selectedEmployee
        }),
        api.getOccupationVueEnsemble({
          month: prevDate.getMonth(),
          year: prevDate.getFullYear(),
          employeeId: selectedEmployee === 'all' ? undefined : selectedEmployee
        }),
      ]);

      const initializedData: OccupancyData = {};
      daysOfWeek.forEach(day => {
        initializedData[day] = {};
        timeSlots.forEach(time => {
          initializedData[day][time] = data.occupancyData[day]?.[time] || 0;
        });
      });

      setStatsData({
        occupancyData: initializedData,
        stats: data.stats || { average: 0, peak: 0, peakDay: '', peakTime: '' }
      });
      setPrevStats(prevData.stats ? { average: prevData.stats.average, peak: prevData.stats.peak } : null);
    } catch (err: any) {
      console.error('Error fetching occupation stats:', err);
      toast.error(err.message || 'Erreur lors du chargement des statistiques');

      const emptyData: OccupancyData = {};
      daysOfWeek.forEach(day => {
        emptyData[day] = {};
        timeSlots.forEach(time => { emptyData[day][time] = 0; });
      });
      setStatsData({ occupancyData: emptyData, stats: { average: 0, peak: 0, peakDay: '', peakTime: '' } });
      setPrevStats(null);
    } finally {
      setLoading(false);
    }
  };

  const getColorClass = (value: number) => {
    if (value === 0) return 'bg-gray-100 text-gray-400';
    if (value <= 25) return 'bg-emerald-100 text-emerald-700';
    if (value <= 50) return 'bg-emerald-200 text-emerald-800';
    if (value <= 75) return 'bg-emerald-400 text-emerald-900';
    return 'bg-emerald-600 text-white';
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const stats = statsData.stats;
  const occupancyData = statsData.occupancyData;

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = () => { setDraggedCell(null); };

  const exportData = () => {
    const csvContent = [
      ['Horaire', ...daysOfWeek].join(','),
      ...timeSlots.map(time =>
        [time, ...daysOfWeek.map(day => occupancyData[day]?.[time] + '%')].join(',')
      )
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taux-occupation-${currentDate.toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const printReport = () => { window.print(); };

  // Delta badge: correct icon direction + color based on actual change
  const DeltaBadge = ({ current, prev }: { current: number; prev: number }) => {
    const delta = current - prev;
    const isUp = delta >= 0;
    const Icon = isUp ? TrendingUp : TrendingDown;
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium ${isUp ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
        <Icon size={12} />
        {delta > 0 ? '+' : ''}{delta}% vs mois dernier
      </div>
    );
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 md:p-6">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#002366] w-8 h-8 mb-4" />
          <span className="text-gray-600">Chargement des statistiques...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-0 md:p-0">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {/* Header */}
      <div className="mb-8 animate-slideDown">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-8">
            <h1 className="text-5xl font-light text-gray-900 tracking-tight">Vue d&apos;ensemble</h1>
          </div>
          <div className="flex items-center gap-4 no-print">
            <button onClick={exportData} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <Download size={16} />
              Exporter
            </button>
            <button onClick={printReport} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <Printer size={16} />
              Imprimer
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigateMonth(-1)} className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-lg font-light text-gray-900 min-w-[180px] text-center">
              {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => navigateMonth(1)} className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">
              Aujourd&apos;hui
            </button>
          </div>

          <div className="flex items-center gap-4 no-print">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-gray-400" />
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-[200px] rounded-full border-gray-200 text-sm">
                  <SelectValue placeholder="Tous les employ&eacute;s" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les employ&eacute;s</SelectItem>
                  <SelectItem value="yassine">Yassine El Fassi</SelectItem>
                  <SelectItem value="samira">Samira Bouzid</SelectItem>
                  <SelectItem value="khalid">Khalid Ait Lahcen</SelectItem>
                  <SelectItem value="nadia">Nadia El Khatib</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[160px] rounded-full border-gray-200 text-sm">
                <SelectValue placeholder="Toutes les heures" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les heures</SelectItem>
                <SelectItem value="morning">Matin (9h-14h)</SelectItem>
                <SelectItem value="afternoon">Apr&egrave;s-midi (14h-18h)</SelectItem>
                <SelectItem value="evening">Soir (18h-20h)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8 animate-fadeIn">
        {/* Taux moyen */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
              <BarChart2 size={20} className="text-gray-400" />
            </div>
            {prevStats !== null && <DeltaBadge current={stats.average} prev={prevStats.average} />}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Taux d&apos;occupation moyen</p>
            <p className="text-3xl font-light text-gray-900">{stats.average}%</p>
          </div>
        </div>

        {/* Taux maximum */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
              <Zap size={20} className="text-gray-400" />
            </div>
            {prevStats !== null && <DeltaBadge current={stats.peak} prev={prevStats.peak} />}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Taux maximum atteint</p>
            <p className="text-3xl font-light text-gray-900">{stats.peak}%</p>
          </div>
        </div>

        {/* Jour pic */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
              <Calendar size={20} className="text-gray-400" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Jour le plus charg&eacute;</p>
            <p className="text-3xl font-light text-gray-900">{stats.peakDay}</p>
          </div>
        </div>

        {/* Créneau pic */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
              <BarChart3 size={20} className="text-gray-400" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Cr&eacute;neau le plus demand&eacute;</p>
            <p className="text-3xl font-light text-gray-900">{stats.peakTime}</p>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden animate-slideUp">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-900">
            Moyenne des taux d&apos;occupation par jour de la semaine et par tranche horaire
          </h3>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1000px] p-6">
            <div className="grid grid-cols-8 gap-2 mb-2">
              <div />
              {daysOfWeek.map(day => (
                <div key={day} className="text-center">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{day}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {timeSlots.map(time => (
                <div key={time} className="grid grid-cols-8 gap-2">
                  <div className="flex items-center">
                    <span className="text-xs font-light text-gray-500">{time}</span>
                  </div>
                  {daysOfWeek.map(day => {
                    const value = occupancyData[day]?.[time] ?? 0;
                    return (
                      <div
                        key={`${day}-${time}`}
                        className={`${getColorClass(value)} rounded-lg p-4 text-center font-medium text-sm hover:scale-105 hover:shadow-md transition-all duration-200 flex items-center justify-center min-h-[56px]`}
                      >
                        {value}%
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500 no-print animate-fadeIn">
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-gray-100" /><span>0%</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-100" /><span>1-25%</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-200" /><span>26-50%</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-400" /><span>51-75%</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-emerald-600" /><span>76-100%</span></div>
      </div>
    </div>
  );
};

export default StatistiquesPage;
