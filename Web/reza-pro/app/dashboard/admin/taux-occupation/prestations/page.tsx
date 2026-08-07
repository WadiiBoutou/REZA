'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Download, Printer, ChevronLeft, ChevronRight, Users, TrendingUp, BarChart3, Filter, Clock, DollarSign, Percent, Search, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

type ServiceData = {
  category: string;
  services: {
    name: string;
    occupancyRate: number;
    hoursWorked: string;
    totalRevenue: number;
  }[];
};

const StatistiquesPage = () => {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('services'); // services, heatmap
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [compareMode, setCompareMode] = useState(false);
  const [search, setSearch] = useState('');
  // Collapsible per-category sections so a large catalog (~200 services) stays navigable
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Statistics data state
  const [statsData, setStatsData] = useState({
    servicesData: [] as ServiceData[],
    stats: {
      totalRevenue: 0,
      totalHours: 0,
      avgOccupancy: 0
    }
  });

  // Employees data state
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    setMounted(true);
    fetchEmployees();
    fetchStats();
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchStats();
    }
  }, [currentDate, selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      const response = await api.getEmployees({ active: true });
      const employeesData = response.employees || [];
      setEmployees(
        employeesData.map((emp: any) => ({
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`
        }))
      );
    } catch (err: any) {
      console.error('Error fetching employees:', err);
      // Continue without employees list if fetch fails
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getOccupationPrestations({
        month: currentDate.getMonth(),
        year: currentDate.getFullYear(),
        employeeId: selectedEmployee === 'all' ? undefined : selectedEmployee
      });
      
      setStatsData({
        servicesData: data.servicesData || [],
        stats: data.stats || {
          totalRevenue: 0,
          totalHours: 0,
          avgOccupancy: 0
        }
      });
    } catch (err: any) {
      console.error('Error fetching occupation prestations stats:', err);
      toast.error(err.message || 'Erreur lors du chargement des statistiques');
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
  const servicesData = statsData.servicesData;

  const filteredServicesData = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return servicesData;
    return servicesData
      .map((cat) => ({
        ...cat,
        services: cat.services.filter((s) => s.name.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.services.length > 0);
  }, [servicesData, search]);

  // Bar widths are relative to the highest occupancy rate currently displayed
  // (the top service shows a full bar), so a "20%" rate no longer looks like a
  // full bar — the label always shows the real percentage.
  const maxOccupancy = React.useMemo(() => {
    let max = 0;
    for (const cat of filteredServicesData) {
      for (const s of cat.services) {
        if (s.occupancyRate > max) max = s.occupancyRate;
      }
    }
    return max;
  }, [filteredServicesData]);

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const exportData = () => {
    if (viewMode === 'services') {
      const csvContent = [
        ['Prestation', 'Taux d\'occupation', 'Heures travaillées', 'Total des RDV'].join(','),
        ...servicesData.flatMap(category => 
          category.services.map(service => 
            [service.name, `${service.occupancyRate}%`, service.hoursWorked, `${service.totalRevenue} MAD`].join(',')
          )
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prestations-${currentDate.toISOString().split('T')[0]}.csv`;
      a.click();
    }
  };

  const printReport = () => {
    window.print();
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
        
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="mb-8 animate-slideDown">
        <div className="flex items-center justify-between mb-6">
          {/* Left: Title & Date */}
          <div className="flex items-center gap-8">
            <div className="flex items-baseline gap-3">
              <h1 className="text-5xl font-light text-gray-900 tracking-tight">
                Performance des services
              </h1>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-4 no-print">
            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Download size={16} />
              Exporter
            </button>
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Printer size={16} />
              Imprimer
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between">
          {/* Date Navigation */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-lg font-light text-gray-900 min-w-[180px] text-center">
              {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              Aujourd'hui
            </button>
          </div>

          {/* Filters only (removed view toggle and compare mode) */}
          <div className="flex items-center gap-6 no-print">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une prestation..."
                className="w-56 pl-9 pr-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[200px] rounded-full border-gray-200 text-sm">
                <SelectValue placeholder="Tous les employés" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les employés</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fadeIn">
        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <Percent size={20} className="text-gray-400" />
            </div>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              <TrendingUp size={12} />
              <span className="text-[10px] font-medium">Moyenne</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Taux moyen d'occupation</p>
            <p className="text-3xl font-light text-gray-900">{stats.avgOccupancy.toFixed(2)}%</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <Clock size={20} className="text-gray-400" />
            </div>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              <TrendingUp size={12} />
              <span className="text-[10px] font-medium">Total</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Total heures travaillées</p>
            <p className="text-3xl font-light text-gray-900">{stats.totalHours}h</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
          <div className="flex items-start justify-between mb-6">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-colors">
              <DollarSign size={20} className="text-gray-400" />
            </div>
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              <TrendingUp size={12} />
              <span className="text-[10px] font-medium">Total</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Total des rendez-vous</p>
            <p className="text-3xl font-light text-gray-900">{stats.totalRevenue.toFixed(2)} MAD</p>
          </div>
        </div>
      </div>

      {/* Only Services Table view remains */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden animate-slideUp">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header */}
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prestation
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taux d'occupation*
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Heures travaillées*
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total des RDV*
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-gray-100">
              {filteredServicesData.length > 0 ? (
                filteredServicesData.map((category, catIndex) => (
                  <React.Fragment key={catIndex}>
                    {/* Category Header (click to collapse/expand) */}
                    <tr
                      className="bg-gray-50/50 cursor-pointer hover:bg-gray-100/70 transition-colors"
                      onClick={() => toggleCategory(category.category)}
                    >
                      <td colSpan={4} className="px-6 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{category.category}</span>
                          <span className="text-xs text-gray-500">
                            {category.services.length} prestation{category.services.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Services */}
                    {!collapsedCategories[category.category] &&
                      category.services.map((service, serviceIndex) => (
                        <tr key={serviceIndex} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-700">{service.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-900">{service.occupancyRate.toFixed(2)} %</span>
                              <div className="flex-1 max-w-[120px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500 rounded-full transition-all"
                                  style={{ width: maxOccupancy > 0 ? `${Math.min(100, (service.occupancyRate / maxOccupancy) * 100)}%` : '0%' }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600">{service.hoursWorked}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-gray-900">{service.totalRevenue.toFixed(2)} MAD</span>
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                    Aucune donnée disponible pour cette période
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 leading-relaxed">
            * <span className="font-medium">Taux d'occupation</span>: Pourcentage du temps réservé sur le temps total disponible
          </p>
        </div>
      </div>
    </div>
  );
};

export default StatistiquesPage;