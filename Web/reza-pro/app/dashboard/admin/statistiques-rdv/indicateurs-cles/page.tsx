'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Users, Clock, ArrowDownRight, ChevronLeft, ChevronRight, Star, BarChart3, Download, Globe, Store, Loader2 } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SMEDashboard() {
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year'>('month');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  // Add month picker state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [employeePage, setEmployeePage] = useState(1);

  // Dashboard data state
  const [dashboardData, setDashboardData] = useState({
    onlineAppointments: 0,
    totalAppointments: 0,
    onlineRate: 0,
    newOnlineClients: 0,
    newSalonClients: 0,
    appointmentsTrend: [] as any[],
    revenueData: [] as any[],
    totalRevenue: 0,
    avgRevenue: 0,
    peakDay: 'N/A',
    serviceData: [] as any[],
    employeeData: [] as any[],
    timeSlotData: [] as any[],
    // Key Metrics
    attendanceRate: 0,
    avgDuration: 0,
    avgSatisfaction: 0,
    loyaltyRate: 0,
    // Additional Insights
    cancellationRate: 0,
    advanceBookingRate: 0,
    avgBasket: 0,
    loyalClientsCount: 0,
    // Peak Hours
    peakHours: [] as any[],
    // Booking Channels
    bookingChannels: [] as any[],
    // Demographics
    ageDistribution: [] as any[],
    visitFrequency: [] as any[],
    timePreferences: [] as any[],
    // Real period-over-period deltas (null = no previous-period data)
    deltas: {} as Record<string, number | null>
  });

  useEffect(() => {
    setMounted(true);
    fetchDashboardData();
  }, [timeFilter, selectedMonth, selectedYear]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats({
        period: timeFilter,
        month: selectedMonth,
        year: selectedYear
      });
      
      setDashboardData({
        onlineAppointments: data.onlineAppointments || 0,
        totalAppointments: data.totalAppointments || 0,
        onlineRate: data.onlineRate || 0,
        newOnlineClients: data.newOnlineClients || 0,
        newSalonClients: data.newSalonClients || 0,
        appointmentsTrend: data.appointmentsTrend || [],
        revenueData: data.revenueData || [],
        totalRevenue: data.totalRevenue || 0,
        avgRevenue: data.avgRevenue || 0,
        peakDay: data.peakDay || 'N/A',
        serviceData: data.serviceData || [],
        employeeData: data.employeeData || [],
        timeSlotData: data.timeSlotData || [],
        attendanceRate: data.attendanceRate || 0,
        avgDuration: data.avgDuration || 0,
        avgSatisfaction: data.avgSatisfaction || 0,
        loyaltyRate: data.loyaltyRate || 0,
        cancellationRate: data.cancellationRate || 0,
        advanceBookingRate: data.advanceBookingRate || 0,
        avgBasket: data.avgBasket || 0,
        loyalClientsCount: data.loyalClientsCount || 0,
        peakHours: data.peakHours || [],
        bookingChannels: data.bookingChannels || [],
        ageDistribution: data.ageDistribution || [],
        visitFrequency: data.visitFrequency || [],
        timePreferences: data.timePreferences || [],
        deltas: data.deltas || {}
      });
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      toast.error(err.message || 'Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  // Helper for month names
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  // Use real data from API only - no static fallbacks
  const currentData = {
    onlineAppointments: dashboardData.onlineAppointments || 0,
    totalAppointments: dashboardData.totalAppointments || 0,
    onlineRate: dashboardData.onlineRate || 0,
    newOnlineClients: dashboardData.newOnlineClients || 0,
    newSalonClients: dashboardData.newSalonClients || 0,
    appointmentsTrend: dashboardData.appointmentsTrend || [],
    revenueData: dashboardData.revenueData || [],
    totalRevenue: dashboardData.totalRevenue || 0,
    avgRevenue: dashboardData.avgRevenue || 0,
    peakDay: dashboardData.peakDay || 'N/A'
  };

  // Service distribution data - use real data only
  const serviceData = dashboardData.serviceData.map((s, i) => ({
    ...s,
    color: ['#002366', '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'][i] || '#002366'
  }));

  // Employee performance data - use real data only
  const employeeData = dashboardData.employeeData || [];

  // Time slot popularity - use real data only
  const timeSlotData = dashboardData.timeSlotData || [];

  // Real period-over-period delta badge (value null → hidden: no previous-period data).
  const DeltaBadge = ({ value, suffix = '%' }: { value: number | null | undefined; suffix?: string }) => {
    if (value === null || value === undefined || isNaN(value)) return null;
    const positive = value >= 0;
    const Icon = positive ? TrendingUp : ArrowDownRight;
    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${positive ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
        <Icon size={12} />
        <span className="text-[10px] font-medium">{positive ? '+' : ''}{value}{suffix}</span>
      </div>
    );
  };

  // Shows the exact value(s) at the hovered point — the x label plus EVERY
  // series at that point (each with its own color), not just the first/peak one.
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-100">
          {label !== undefined && label !== '' && (
            <p className="text-xs font-medium text-gray-400 mb-1">{label}</p>
          )}
          {payload.map((entry: any, i: number) => (
            <p key={i} className="text-sm font-medium" style={{ color: entry.color || entry.stroke || '#111827' }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString('fr-FR') : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
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
            <h1 className="text-5xl font-light text-gray-900 tracking-tight mb-2">Tableau de Bord</h1>
            <p className="text-sm text-gray-400">Vue d'ensemble des performances</p>
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
            {/* Export Buttons */}
            <button className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
              <Download size={14} />
              Exporter
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-8 animate-fadeIn">
        {/* Online Appointments */}
        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <Calendar size={18} className="text-gray-400" />
            </div>
            <DeltaBadge value={dashboardData.deltas.onlineAppointments} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Nombre de RDV en ligne</p>
            <p className="text-3xl font-light text-gray-900">{currentData.onlineAppointments}</p>
          </div>
        </div>

        {/* Total Appointments */}
        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <Users size={18} className="text-gray-400" />
            </div>
            <DeltaBadge value={dashboardData.deltas.totalAppointments} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Nombre de RDV</p>
            <p className="text-3xl font-light text-gray-900">{currentData.totalAppointments}</p>
          </div>
        </div>

        {/* Online Rate */}
        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <BarChart3 size={18} className="text-gray-400" />
            </div>
            <DeltaBadge value={dashboardData.deltas.onlineRate} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Taux en ligne</p>
            <p className="text-3xl font-light text-emerald-600">{currentData.onlineRate}%</p>
          </div>
        </div>

        {/* New Online Clients */}
        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <Download size={18} className="text-gray-400" />
            </div>
            <DeltaBadge value={dashboardData.deltas.newOnlineClients} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Nouveaux clients en ligne</p>
            <p className="text-3xl font-light text-gray-900">{currentData.newOnlineClients}</p>
          </div>
        </div>

        {/* New Salon Clients */}
        <div className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <Clock size={18} className="text-gray-400" />
            </div>
            <DeltaBadge value={dashboardData.deltas.newSalonClients} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Nouveaux clients en salon</p>
            <p className="text-3xl font-light text-gray-900">{currentData.newSalonClients}</p>
          </div>
        </div>
      </div>

      {/* Main Chart - Appointments Taken */}
      <div className="bg-white rounded-lg border border-gray-100 p-6 mb-8 animate-fadeIn">
        <div className="mb-6">
          <h2 className="text-xl font-light text-gray-900 mb-1">Rendez-vous pris</h2>
          <p className="text-xs text-gray-400">Évolution quotidienne</p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={currentData.appointmentsTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis 
              dataKey="day" 
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: '#f0f0f0' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="salon" 
              stroke="#1f2937" 
              strokeWidth={2}
              dot={{ fill: '#1f2937', strokeWidth: 0, r: 3 }}
              name="Pris en salon"
            />
            <Line 
              type="monotone" 
              dataKey="online" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
              name="Pris en ligne"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-8 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-900"></div>
            <span className="text-xs text-gray-600">Pris en salon</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-gray-600">Pris en ligne</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-3 gap-6 mb-8 animate-fadeIn">
        {/* Revenue Trend */}
        <div className="col-span-2 bg-white rounded-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Chiffre d'affaires</h3>
            <p className="text-xs text-gray-400">Performance financière</p>
          </div>
          {currentData.revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={currentData.revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#002366" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#002366" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={{ stroke: '#f0f0f0' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#002366" 
                  strokeWidth={2}
                  fill="url(#colorRevenue)" 
                  name="CA (MAD)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">
              Aucune donnée disponible
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400 mb-1">Total</p>
              <p className="text-lg font-medium text-gray-900">{currentData.totalRevenue.toLocaleString()} MAD</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Moyenne</p>
              <p className="text-lg font-medium text-gray-900">{currentData.avgRevenue.toLocaleString()} MAD</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Pic</p>
              <p className="text-lg font-medium text-gray-900">{currentData.peakDay}</p>
            </div>
          </div>
        </div>

        {/* Service Distribution */}
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Services populaires</h3>
            <p className="text-xs text-gray-400">Répartition par type</p>
          </div>
          <div className="space-y-4">
            {serviceData.length > 0 ? (
              serviceData.map((service, index) => {
                const total = serviceData.reduce((sum, s) => sum + (s.value || 0), 0);
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">{service.name}</span>
                      <span className="text-sm font-medium text-gray-900">{service.value || 0}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: total > 0 ? `${((service.value || 0) / total) * 100}%` : '0%',
                          backgroundColor: service.color
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Aucune donnée disponible
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Time Slot Popularity & Employee Performance */}
      <div className="grid grid-cols-2 gap-6 mb-8 animate-fadeIn">
        {/* Time Slots */}
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Créneaux populaires</h3>
            <p className="text-xs text-gray-400">Fréquentation par heure</p>
          </div>
          {timeSlotData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={timeSlotData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis 
                  dataKey="slot" 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={{ stroke: '#f0f0f0' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="RDV" radius={[4, 4, 0, 0]}>
                  {timeSlotData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.count > 24 ? '#002366' : entry.count > 20 ? '#3B82F6' : '#93C5FD'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">
              Aucune donnée disponible
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Métriques clés</h3>
            <p className="text-xs text-gray-400">Indicateurs de performance</p>
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                  <TrendingUp size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Taux de présence</p>
                  <p className="text-lg font-medium text-gray-900">{dashboardData.attendanceRate.toFixed(1)}%</p>
                </div>
              </div>
              <DeltaBadge value={dashboardData.deltas.attendanceRate} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                  <Clock size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Durée moyenne</p>
                  <p className="text-lg font-medium text-gray-900">{dashboardData.avgDuration} min</p>
                </div>
              </div>
              <DeltaBadge value={dashboardData.deltas.avgDuration} suffix=" min" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                  <Star size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Satisfaction client</p>
                  <p className="text-lg font-medium text-gray-900">{dashboardData.avgSatisfaction.toFixed(1)}/5</p>
                </div>
              </div>
              <DeltaBadge value={dashboardData.deltas.avgSatisfaction} suffix="" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                  <Users size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Taux de fidélisation</p>
                  <p className="text-lg font-medium text-gray-900">{dashboardData.loyaltyRate.toFixed(0)}%</p>
                </div>
              </div>
              <DeltaBadge value={dashboardData.deltas.loyaltyRate} />
            </div>
          </div>
        </div>
      </div>

      {/* Employee Performance */}
      <div className="animate-fadeIn">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-light text-gray-900 mb-1">Performance des employés</h2>
            <p className="text-xs text-gray-400">Statistiques individuelles du mois</p>
          </div>
          {employeeData.length > 8 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEmployeePage(p => Math.max(1, p - 1))}
                disabled={employeePage === 1}
                className="p-2 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-medium text-gray-700 min-w-[60px] text-center">
                {employeePage} / {Math.ceil(employeeData.length / 8)}
              </span>
              <button
                onClick={() => setEmployeePage(p => Math.min(Math.ceil(employeeData.length / 8), p + 1))}
                disabled={employeePage === Math.ceil(employeeData.length / 8)}
                className="p-2 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {employeeData.slice((employeePage - 1) * 8, employeePage * 8).map((employee, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-100 p-6 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                {/* Employee Info */}
                <div className="flex items-center gap-4">
                  {employee.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={employee.avatar}
                      alt={employee.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">
                        {employee.name.split(' ').map((n: string) => n[0]).join('')}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{employee.name}</h3>
                    <p className="text-xs text-gray-400">Praticien</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-12">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Rendez-vous</p>
                    <p className="text-lg font-medium text-gray-900">{employee.appointments}</p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Chiffre d'affaires</p>
                    <p className="text-lg font-medium text-gray-900">{employee.revenue.toLocaleString()} MAD</p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">Satisfaction</p>
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-[#002366] fill-[#002366]" />
                      <p className="text-lg font-medium text-gray-900">{employee.rating}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 min-w-[80px]">Performance</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(employee.rating / 5) * 100}%`, background: '#002366' }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-900 min-w-[40px] text-right">
                    {((employee.rating / 5) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-4 gap-4 mt-8 animate-fadeIn">
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">Taux d'annulation</p>
            <DeltaBadge value={dashboardData.deltas.cancellationRate} />
          </div>
          <p className="text-2xl font-light text-gray-900 mb-1">{dashboardData.cancellationRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500">En baisse ce mois</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">Réservations anticipées</p>
            <DeltaBadge value={dashboardData.deltas.advanceBookingRate} />
          </div>
          <p className="text-2xl font-light text-gray-900 mb-1">{dashboardData.advanceBookingRate.toFixed(0)}%</p>
          <p className="text-xs text-gray-500">Plus de 2 jours</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">Panier moyen</p>
            <DeltaBadge value={dashboardData.deltas.avgBasket} />
          </div>
          <p className="text-2xl font-light text-gray-900 mb-1">{dashboardData.avgBasket.toLocaleString()} MAD</p>
          <p className="text-xs text-gray-500">Par rendez-vous</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">Clients fidèles</p>
            <DeltaBadge value={dashboardData.deltas.loyalClientsCount} />
          </div>
          <p className="text-2xl font-light text-gray-900 mb-1">{dashboardData.loyalClientsCount}</p>
          <p className="text-xs text-gray-500">3+ visites</p>
        </div>
      </div>

      {/* Peak Hours Analysis */}
      <div className="grid grid-cols-2 gap-6 mt-8 animate-fadeIn">
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Heures de pointe</h3>
            <p className="text-xs text-gray-400">Taux d'occupation moyen</p>
          </div>
          <div className="space-y-3">
            {dashboardData.peakHours.length > 0 ? (
              dashboardData.peakHours.map((slot: any, index: number) => {
                const colors = ['#93C5FD', '#60A5FA', '#3B82F6', '#002366', '#60A5FA'];
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">{slot.time}</span>
                      <span className="text-sm font-medium text-gray-900">{slot.rate}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${slot.rate}%`, backgroundColor: colors[index] || '#002366' }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Aucune donnée disponible
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Canaux de réservation</h3>
            <p className="text-xs text-gray-400">Origine des rendez-vous</p>
          </div>
          <div className="space-y-4">
            {dashboardData.bookingChannels.length > 0 ? (
              dashboardData.bookingChannels.map((channel: any, index: number) => {
                const total = dashboardData.bookingChannels.reduce((sum: number, c: any) => sum + c.count, 0);
                const percentage = total > 0 ? Math.round((channel.count / total) * 100) : 0;
                // Only two booking origins are tracked in the data model: online (Site web)
                // and staff-created (En salon). Instagram/WhatsApp/phone are not recorded.
                const icons: { [key: string]: React.ReactElement } = {
                  globe: <Globe size={18} className="text-[#002366]" />,
                  store: <Store size={18} className="text-[#002366]" />
                };
                return (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl">{icons[channel.icon] || <Globe size={18} className="text-[#002366]" />}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">{channel.channel}</span>
                          <span className="text-xs font-medium text-gray-900">{channel.count}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#002366] rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 ml-3">{percentage}%</span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Aucune donnée disponible
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Client Demographics */}
      <div className="mt-8 animate-fadeIn">
        <div className="mb-6">
          <h2 className="text-2xl font-light text-gray-900 mb-1">Analyse clientèle</h2>
          <p className="text-xs text-gray-400">Démographie et comportement</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-100 p-6">
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-1">Répartition par âge</h3>
              <p className="text-xs text-gray-400">Distribution des clients</p>
            </div>
            <div className="space-y-3">
              {dashboardData.ageDistribution.length > 0 ? (
                dashboardData.ageDistribution.map((segment: any, index: number) => {
                  const total = dashboardData.ageDistribution.reduce((sum: number, s: any) => sum + s.count, 0);
                  const percentage = total > 0 ? Math.round((segment.count / total) * 100) : 0;
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600">{segment.age}</span>
                        <span className="text-sm font-medium text-gray-900">{segment.count}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#002366] rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 p-6">
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-1">Répartition (période sélectionnée)</h3>
              <p className="text-xs text-gray-400">Fréquence des visites sur la période</p>
            </div>
            <div className="space-y-4">
              {dashboardData.visitFrequency.length > 0 ? (
                dashboardData.visitFrequency.map((segment: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{segment.type}</p>
                        <p className="text-xs text-gray-400">{segment.desc}</p>
                      </div>
                    </div>
                    <span className="text-lg font-light text-gray-900">{segment.count}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 p-6">
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-1">Préférences horaires</h3>
              <p className="text-xs text-gray-400">Moments favoris</p>
            </div>
            <div className="space-y-4">
              {dashboardData.timePreferences.length > 0 ? (
                <>
                  {dashboardData.timePreferences.map((day: any, index: number) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-600 w-20">{day.day}</span>
                        <div className="flex-1 flex gap-1">
                          {/* Distinct hues per time-of-day: amber = matin, bleu nuit = après-midi, violet = soir */}
                          <div 
                            className="h-6 bg-amber-300 rounded transition-all duration-500 flex items-center justify-center"
                            style={{ width: `${day.morning}%` }}
                          >
                            {day.morning > 25 && <span className="text-[9px] text-amber-900 font-medium">{day.morning}%</span>}
                          </div>
                          <div 
                            className="h-6 bg-[#002366] rounded transition-all duration-500 flex items-center justify-center"
                            style={{ width: `${day.afternoon}%` }}
                          >
                            {day.afternoon > 25 && <span className="text-[9px] text-white font-medium">{day.afternoon}%</span>}
                          </div>
                          <div 
                            className="h-6 bg-violet-300 rounded transition-all duration-500 flex items-center justify-center"
                            style={{ width: `${day.evening}%` }}
                          >
                            {day.evening > 25 && <span className="text-[9px] text-violet-900 font-medium">{day.evening}%</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-center gap-4 pt-3 border-t border-gray-100 mt-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-300"></div>
                      <span className="text-[10px] text-gray-500">Matin</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-[#002366]"></div>
                      <span className="text-[10px] text-gray-500">Après-midi</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-violet-300"></div>
                      <span className="text-[10px] text-gray-500">Soir</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
