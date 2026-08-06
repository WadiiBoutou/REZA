'use client';

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Users, Calendar, Clock, BarChart3, Download, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function IndicateursPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  // True once the first fetch has completed: after that, period changes refetch
  // in the background WITHOUT blanking the whole page — each graph keeps its
  // previous data until the new data arrives (no reload of other graphs).
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year'>('month');
  const [chartViews, setChartViews] = useState<{[key: string]: 'graphe' | 'tableau'}>({});
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  // Statistics data state
  const [statsData, setStatsData] = useState({
    totalRDV: 0,
    activeCollaborateurs: 0,
    totalServices: 0,
    avgDuration: 0,
    rdvPrisData: [] as any[],
    prestationsSalonData: [] as any[],
    prestationsLigneData: [] as any[],
    totalPrestationsData: [] as any[],
    rdvSalonParPrestationData: [] as any[],
    rdvLigneParPrestationData: [] as any[],
    totalRdvParPrestationData: [] as any[],
    performanceData: [] as any[]
  });

  useEffect(() => {
    setMounted(true);
    fetchStats();
  }, [timeFilter, selectedMonth, selectedYear]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getAutresStats({
        period: timeFilter,
        month: selectedMonth,
        year: selectedYear
      });
      
      setStatsData({
        totalRDV: data.totalRDV || 0,
        activeCollaborateurs: data.activeCollaborateurs || 0,
        totalServices: data.totalServices || 0,
        avgDuration: data.avgDuration || 0,
        rdvPrisData: data.rdvPrisData || [],
        prestationsSalonData: data.prestationsSalonData || [],
        prestationsLigneData: data.prestationsLigneData || [],
        totalPrestationsData: data.totalPrestationsData || [],
        rdvSalonParPrestationData: data.rdvSalonParPrestationData || [],
        rdvLigneParPrestationData: data.rdvLigneParPrestationData || [],
        totalRdvParPrestationData: data.totalRdvParPrestationData || [],
        performanceData: data.performanceData || []
      });
    } catch (err: any) {
      console.error('Error fetching autres stats:', err);
      toast.error(err.message || 'Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  };

  const toggleView = (chartId: string) => {
    setChartViews(prev => ({
      ...prev,
      [chartId]: prev[chartId] === 'tableau' ? 'graphe' : 'tableau'
    }));
  };

  const getView = (chartId: string) => {
    return chartViews[chartId] || 'graphe';
  };


  const DonutChart = ({ data, title, subtitle, chartId }: { data: any[], title: string, subtitle?: string, chartId: string }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const currentView = getView(chartId);
    
    return (
      <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        
        {currentView === 'graphe' ? (
          <>
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    startAngle={90}
                    endAngle={450}
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-100">
                            <p className="text-xs font-medium text-gray-900">{payload[0].name}</p>
                            <p className="text-xs text-gray-500">{payload[0].value}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Center text */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <p className="text-3xl font-light text-gray-900">{total.toFixed(0)}%</p>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 space-y-2">
              {data.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-gray-600 truncate">{item.name}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-900 ml-2">{item.value}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valeur
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-medium">
                  <td className="px-3 py-3">
                    <span className="text-xs text-gray-900">Total</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-sm font-medium text-gray-900">{total.toFixed(1)}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* View Toggle */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-6">
          <button 
            onClick={() => toggleView(chartId)}
            className={`text-xs font-medium transition-colors ${
              currentView === 'graphe' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Graphe
          </button>
          <span className="text-gray-300">|</span>
          <button 
            onClick={() => toggleView(chartId)}
            className={`text-xs font-medium transition-colors ${
              currentView === 'tableau' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Tableau
          </button>
        </div>
      </div>
    );
  };

  if (!mounted || (loading && !initialLoaded)) {
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
    <div className="min-h-screen p-0">
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
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">Indicateurs</h1>
            <p className="text-sm text-gray-400">Analyse détaillée des performances par employé</p>
          </div>
          <div className="flex items-center gap-6">
            {/* Date Navigation - same design as vue-ensemble */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedMonth(prev => (prev === 0 ? 11 : prev - 1))}
                className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-lg font-light text-gray-900 min-w-[180px] text-center">
                {monthNames[selectedMonth]} {selectedYear}
              </span>
              <button
                onClick={() => setSelectedMonth(prev => (prev === 11 ? 0 : prev + 1))}
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
            <button className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
              <Download size={14} />
              Exporter
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8 animate-fadeIn">
        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <Calendar size={18} className="text-gray-400" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Total RDV</p>
            <p className="text-3xl font-light text-gray-900">{statsData.totalRDV}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <Users size={18} className="text-gray-400" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Employés actifs</p>
            <p className="text-3xl font-light text-gray-900">{statsData.activeCollaborateurs}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <BarChart3 size={18} className="text-gray-400" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Prestations</p>
            <p className="text-3xl font-light text-gray-900">{statsData.totalServices}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <Clock size={18} className="text-gray-400" />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Durée moyenne</p>
            <p className="text-3xl font-light text-gray-900">{statsData.avgDuration}min</p>
          </div>
        </div>
      </div>

      {/* First Row - 3 Charts */}
      <div className="grid grid-cols-3 gap-6 mb-6 animate-fadeIn">
        <DonutChart 
          data={statsData.rdvPrisData.length > 0 ? statsData.rdvPrisData : []}
          title="RDV pris"
          subtitle="Répartition par canal"
          chartId="rdv-pris"
        />
        <DonutChart 
          data={statsData.prestationsSalonData.length > 0 ? statsData.prestationsSalonData : []}
          title="Nombre de prestations en salon par employé"
          subtitle="Distribution par praticien"
          chartId="prestations-salon"
        />
        <DonutChart 
          data={statsData.prestationsLigneData.length > 0 ? statsData.prestationsLigneData : []}
          title="Nombre de prestations en ligne par employé"
          subtitle="Réservations en ligne"
          chartId="prestations-ligne"
        />
      </div>

      {/* Second Row - 2 Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6 animate-fadeIn">
        <DonutChart 
          data={statsData.rdvSalonParPrestationData.length > 0 ? statsData.rdvSalonParPrestationData : []}
          title="Nombre de RDV pris en salon par prestation"
          subtitle="Services en salon"
          chartId="rdv-salon-prestation"
        />
        <DonutChart 
          data={statsData.rdvLigneParPrestationData.length > 0 ? statsData.rdvLigneParPrestationData : []}
          title="Nombre de RDV pris en ligne par prestation"
          subtitle="Services en ligne"
          chartId="rdv-ligne-prestation"
        />
      </div>

      {/* Performance Summary */}
      <div className="animate-fadeIn mb-6">
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Performance par employé</h3>
            <p className="text-xs text-gray-400">Classement du mois</p>
          </div>

          <div className="space-y-4">
            {statsData.performanceData.length > 0 ? (
              statsData.performanceData.map((collab, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {collab.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={collab.avatar}
                        alt={collab.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-gray-700">{collab.initials || collab.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}</span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{collab.name}</p>
                      <p className="text-xs text-gray-400">{collab.prestations} prestations</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">RDV</p>
                      <p className="text-lg font-medium text-gray-900">{collab.rdv}</p>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Taux en ligne</p>
                      <p className="text-lg font-medium text-emerald-600">{collab.taux}%</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              [
                { name: 'Aucun employé', rdv: 0, prestations: 0, taux: 0, initials: 'N/A' },
              ].map((collab, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-gray-700">{collab.initials}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{collab.name}</p>
                      <p className="text-xs text-gray-400">{collab.prestations} prestations</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">RDV</p>
                      <p className="text-lg font-medium text-gray-900">{collab.rdv}</p>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Taux en ligne</p>
                      <p className="text-lg font-medium text-emerald-600">{collab.taux}%</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}