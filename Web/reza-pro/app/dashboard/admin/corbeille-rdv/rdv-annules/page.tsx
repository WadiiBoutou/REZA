'use client';

import React, { useState, useEffect } from 'react';
import { Trash2, Download, Printer, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function CancelledAppointments() {
  const { isAuthenticated, salonFilter, effectiveSalonIds } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setMounted(true);
    fetchCancelledAppointments();
  }, [isAuthenticated, salonFilterKey]);

  const fetchCancelledAppointments = async () => {
    try {
      setLoading(true);
      // Get appointments cancelled in the last 30 days (filtered by cancelledAt,
      // not startTime — a just-cancelled future RDV has its startTime in the future).
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const response = await api.getAppointments({
        status: 'CANCELLED',
        cancelledStartDate: startDate.toISOString(),
        cancelledEndDate: endDate.toISOString(),
        limit: 100
      });

      const apts = (response.appointments || []).map((apt: any) => {
        const startTime = new Date(apt.startTime);
        const createdAt = new Date(apt.createdAt);
        const cancelledAt = apt.cancelledAt ? new Date(apt.cancelledAt) : createdAt;
        const client = apt.client ? `${apt.client.firstName} ${apt.client.lastName}` : '-';
        const collaborator = apt.employee ? `${apt.employee.firstName} ${apt.employee.lastName}` : '-';
        
        // Backend computes takenOnline from appointment.source === 'ONLINE' (public bookings only)
        const takenOnline = !!apt.takenOnline;

        return {
          id: apt.id,
          collaborator,
          date: startTime.toLocaleDateString('fr-FR') + ' ' + startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          client,
          takenOnline,
          creationDate: createdAt.toLocaleDateString('fr-FR'),
          creationTime: createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          cancellationDate: cancelledAt.toLocaleDateString('fr-FR'),
          cancellationTime: cancelledAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          // Check if cancelled by client: when client cancels via public endpoint, cancelledBy is set to clientId
          // When tenant/staff cancels, cancelledBy is set to userId
          cancelledByClient: apt.cancelledBy === apt.clientId,
          appointment: apt
        };
      });

      setAppointments(apts);
    } catch (err: any) {
      console.error('Error fetching cancelled appointments:', err);
      toast.error(err.message || 'Erreur lors du chargement des rendez-vous annulés');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (aptId: string) => {
    try {
      await api.updateAppointment(aptId, {
        status: 'CONFIRMED'
      });
      toast.success('Rendez-vous restauré avec succès');
      fetchCancelledAppointments(); // Refresh the list
    } catch (err: any) {
      console.error('Error restoring appointment:', err);
      toast.error(err.message || 'Erreur lors de la restauration');
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('Êtes-vous sûr de vouloir vider la corbeille ? Cette action est irréversible.')) {
      return;
    }

    try {
      // Delete all cancelled appointments
      const promises = appointments.map(apt => api.deleteAppointment(apt.id));
      await Promise.all(promises);
      toast.success('Corbeille vidée avec succès');
      setAppointments([]);
    } catch (err: any) {
      console.error('Error emptying trash:', err);
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  // Helper to format date range
  const getDateRange = () => {
    if (appointments.length === 0) return 'Aucune donnée';
    const dates = appointments.map(apt => new Date(apt.appointment?.startTime || apt.appointment?.createdAt));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    return `${minDate.toLocaleDateString('fr-FR')} au ${maxDate.toLocaleDateString('fr-FR')}`;
  };

  const exportData = () => {
    // BOM + full quoting so accented characters survive Excel and commas in names don't break columns
    const csvCell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvContent = '\uFEFF' + [
      ['Date du RDV', 'Client(e)', 'Pris par Internet', 'Création', 'Annulation', 'Annulé par le client'].map(csvCell).join(','),
      ...appointments.map(apt => 
        [
          apt.date, 
          apt.client, 
          apt.takenOnline ? 'Oui' : 'Non',
          `${apt.creationDate} ${apt.creationTime}`,
          `${apt.cancellationDate} ${apt.cancellationTime}`,
          apt.cancelledByClient ? 'Oui' : 'Non'
        ].map(csvCell).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rdv-annules-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const printReport = () => {
    window.print();
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen p-0 md:p-0">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#002366] w-8 h-8 mb-4" />
          <span className="text-gray-600">Chargement des rendez-vous annulés...</span>
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
          {/* Left: Title */}
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-5xl font-light text-gray-900 tracking-tight">
                RDV annulés
              </h1>
              <p className="text-base text-gray-400 mt-2">Rendez-vous annulés du {getDateRange()}</p>
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
            <button 
              onClick={handleEmptyTrash}
              disabled={appointments.length === 0}
              className="flex items-center px-4 gap-2 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} />
              Vider la corbeille
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden animate-slideUp">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date du RDV
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client(e)
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pris par Internet
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Création
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Annulation
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Annulé par le client
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.length > 0 ? (
                appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-400">
                        {apt.date}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{apt.client || '-'}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {apt.takenOnline && (
                        <Check size={18} className="text-gray-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div>{apt.creationDate}</div>
                        <div className="text-xs text-gray-500">{apt.creationTime}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div>{apt.cancellationDate}</div>
                        <div className="text-xs text-gray-500">{apt.cancellationTime}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {apt.cancelledByClient && (
                        <Check size={18} className="text-gray-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleRestore(apt.id)}
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors underline"
                      >
                        Restaurer
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    Aucun rendez-vous annulé trouvé
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