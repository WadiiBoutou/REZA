'use client';

import React, { useState, useEffect } from 'react';
import { Download, Printer, FileText, CreditCard, Calendar, TrendingUp, Filter, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';

export default function SubscriptionInvoicesPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.getSubscriptionInvoices();
      const data = (res.invoices || []).map((inv: any) => ({
        id: inv.invoiceNumber,
        date: new Date(inv.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        periodStart: inv.periodStart ? new Date(inv.periodStart).toLocaleDateString('fr-FR') : '—',
        periodEnd: inv.periodEnd ? new Date(inv.periodEnd).toLocaleDateString('fr-FR') : '—',
        plan: inv.notes || 'Abonnement',
        amount: inv.amount || 0,
        tax: inv.tax || 0,
        total: inv.total || 0,
        status: inv.status,
        invoice: inv,
      }));
      setInvoices(data);
    } catch (err: any) {
      console.error('Error fetching subscription invoices:', err);
      toast.error(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = filterStatus === 'all'
    ? invoices
    : invoices.filter(inv => inv.status === filterStatus);

  const exportData = () => {
    const headers = ['Numéro', 'Date', 'Période début', 'Période fin', 'Formule', 'Montant', 'TVA', 'Total', 'Statut'];
    const csvContent = [
      headers.join(','),
      ...filteredInvoices.map((inv: any) =>
        [inv.id, inv.date, inv.periodStart, inv.periodEnd, inv.plan, inv.amount.toFixed(2), inv.tax.toFixed(2), inv.total.toFixed(2), inv.status].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factures-abonnement-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const sanitizePdfText = (s: string) =>
    s.replace(/\u2014|\u2013/g, '-').replace(/\u2192/g, '-').replace(/\u2019/g, "'");

  const downloadPdf = (inv: any) => {
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = 210;
      let y = 25;

      const setFont = (size: number, style?: string) => {
        pdf.setFont('helvetica', style || 'normal');
        pdf.setFontSize(size);
      };

      // Header
      setFont(24, 'bold');
      pdf.text('REZA PRO', pageW / 2, y, { align: 'center' });
      y += 12;

      setFont(16, 'bold');
      pdf.text("FACTURE D'ABONNEMENT", pageW / 2, y, { align: 'center' });
      y += 10;

      // Separator
      pdf.setDrawColor(200);
      pdf.setLineWidth(0.5);
      pdf.line(20, y, pageW - 20, y);
      y += 10;

      const row = (label: string, value: string) => {
        setFont(10, 'bold');
        pdf.text(label, 25, y);
        setFont(10, 'normal');
        pdf.text(sanitizePdfText(value), 85, y);
        y += 7;
      };

      row('Num\u00e9ro de facture :', inv.id);
      row('Date d\u2019\u00e9mission :', inv.date);
      row('P\u00e9riode couverte :', `du ${inv.periodStart} au ${inv.periodEnd}`);
      row('Formule :', inv.plan);
      y += 5;

      // Table header
      const colX = [25, 125, 155, 180];
      const headers = ['Description', 'Montant HT', 'TVA', 'Total TTC'];

      pdf.setFillColor(245, 247, 250);
      pdf.rect(20, y, pageW - 40, 8, 'F');
      setFont(9, 'bold');
      headers.forEach((h, i) => pdf.text(h, colX[i], y + 5.5));
      y += 11;

      // Table row with cell borders
      const rowH = 8;
      pdf.setFillColor(255, 255, 255);
      pdf.rect(20, y - 3, pageW - 40, rowH, 'F');
      pdf.setDrawColor(220);
      pdf.rect(20, y - 3, pageW - 40, rowH, 'S');
      setFont(9, 'normal');
      pdf.text(sanitizePdfText(inv.plan), colX[0], y + 2.5);
      pdf.text(`${inv.amount.toFixed(2)} MAD`, colX[1], y + 2.5);
      pdf.text(`${inv.tax.toFixed(2)} MAD`, colX[2], y + 2.5);
      pdf.text(`${inv.total.toFixed(2)} MAD`, colX[3], y + 2.5);
      y += 14;

      // Total line
      pdf.setDrawColor(200);
      pdf.line(20, y, pageW - 20, y);
      y += 6;
      pdf.setFillColor(245, 247, 250);
      pdf.rect(20, y - 3, pageW - 40, 8, 'F');
      setFont(10, 'bold');
      pdf.text('Total TTC', 25, y + 2.5);
      pdf.text(`${inv.total.toFixed(2)} MAD`, 180, y + 2.5, { align: 'right' });
      y += 12;

      // Status + Payment
      setFont(10, 'bold');
      pdf.text('Statut :', 25, y);
      setFont(10, 'normal');
      pdf.text(statusLabel(inv.status), 85, y);
      y += 7;
      setFont(10, 'bold');
      pdf.text('Mode de paiement :', 25, y);
      setFont(10, 'normal');
      pdf.text(inv.invoice?.paymentMethod || 'N/A', 85, y);

      // Footer
      y = 270;
      pdf.setDrawColor(200);
      pdf.setLineWidth(0.3);
      pdf.line(20, y, pageW - 20, y);
      y += 6;
      setFont(8, 'normal');
      pdf.setTextColor(150);
      pdf.text('REZA PRO - Solution de gestion pour salons et spas', pageW / 2, y, { align: 'center' });
      y += 4;
      pdf.text(`G\u00e9n\u00e9r\u00e9e le ${new Date().toLocaleDateString('fr-FR')}`, pageW / 2, y, { align: 'center' });

      pdf.save(`facture-${inv.id}.pdf`);
      toast.success('Facture t\u00e9l\u00e9charg\u00e9e');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du t\u00e9l\u00e9chargement');
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'PAID': return 'Payée';
      case 'PENDING': return 'En attente';
      case 'OVERDUE': return 'En retard';
      case 'CANCELLED': return 'Annulée';
      case 'REFUNDED': return 'Remboursée';
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'PAID': return 'bg-emerald-100 text-emerald-700';
      case 'PENDING': return 'bg-orange-100 text-orange-700';
      case 'OVERDUE': return 'bg-red-100 text-red-700';
      case 'CANCELLED': return 'bg-gray-100 text-gray-500';
      case 'REFUNDED': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen p-0 md:p-0">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#002366] w-8 h-8 mb-4" />
          <span className="text-gray-600">Chargement des factures...</span>
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
          <div>
            <h1 className="text-5xl font-light text-gray-900 tracking-tight">Factures d&apos;abonnement</h1>
            <p className="text-base text-gray-400 mt-2">Consultez vos factures d&apos;abonnement Reza Pro</p>
          </div>

          <div className="flex items-center gap-4 no-print">
            <button onClick={exportData} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <Download size={16} /> Exporter
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <Printer size={16} /> Imprimer
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8 animate-fadeIn">
          <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center"><FileText size={20} className="text-gray-400" /></div>
            </div>
            <div><p className="text-xs text-gray-500 mb-1 font-medium">Factures d&apos;abonnement</p><p className="text-3xl font-light text-gray-900">{invoices.length}</p></div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center"><CreditCard size={20} className="text-gray-400" /></div>
            </div>
            <div><p className="text-xs text-gray-500 mb-1 font-medium">Total facturé</p><p className="text-3xl font-light text-gray-900">{invoices.reduce((s, i) => s + i.total, 0).toFixed(2)} MAD</p></div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center"><Calendar size={20} className="text-gray-400" /></div>
            </div>
            <div><p className="text-xs text-gray-500 mb-1 font-medium">Payées</p><p className="text-3xl font-light text-gray-900">{invoices.filter(i => i.status === 'PAID').length}/{invoices.length}</p></div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4 mb-6 no-print justify-end">
          <div className="flex items-center gap-2 text-sm text-gray-600"><Filter size={16} /><span>Filtrer par statut:</span></div>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'Toutes' },
              { key: 'PAID', label: 'Payées' },
              { key: 'PENDING', label: 'En attente' },
              { key: 'OVERDUE', label: 'En retard' },
            ].map((s) => (
              <button key={s.key} onClick={() => setFilterStatus(s.key)}
                className={`px-4 py-2 text-sm rounded-full transition-all ${
                  filterStatus === s.key
                    ? s.key === 'PAID' ? 'bg-emerald-500 text-white'
                      : s.key === 'PENDING' ? 'bg-orange-400 text-white'
                      : s.key === 'OVERDUE' ? 'bg-red-500 text-white'
                      : 'bg-[#002366] text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subscription Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden animate-slideUp">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Numéro</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Période</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formule</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant HT</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TVA</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total TTC</th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paiement</th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInvoices.map((inv: any, i: number) => (
                <tr key={inv.id} className="hover:bg-gray-50/30 transition-colors" style={{ animationDelay: `${i * 0.05}s` }}>
                  <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{inv.id}</span></td>
                  <td className="px-6 py-4"><div className="text-sm text-gray-700">{inv.date}</div></td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-700">
                      {inv.periodStart} → {inv.periodEnd}
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-900">{inv.plan}</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-900">{inv.amount.toFixed(2)} MAD</span></td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-500">{inv.tax.toFixed(2)} MAD</span></td>
                  <td className="px-6 py-4"><span className="text-sm font-semibold text-gray-900">{inv.total.toFixed(2)} MAD</span></td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColor(inv.status)}`}>
                      {statusLabel(inv.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4"><span className="text-sm text-gray-600">{inv.invoice?.paymentMethod || 'N/A'}</span></td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => downloadPdf(inv)} className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
                      <Download size={14} />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredInvoices.length === 0 && (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Aucune facture d&apos;abonnement trouvée</p>
            <p className="text-xs text-gray-400 mt-2">Les factures d&apos;abonnement sont générées automatiquement.</p>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      <div className="mt-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200 no-print">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Affichage de <span className="font-semibold text-gray-900">{filteredInvoices.length}</span> facture(s)
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Total affiché</div>
            <div className="text-2xl font-semibold text-gray-900">
              {filteredInvoices.reduce((sum: number, inv: any) => sum + inv.total, 0).toFixed(2)} MAD
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
