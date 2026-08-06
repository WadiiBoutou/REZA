'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TopClient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  visits: number;
  revenue: number;
  lastVisit: string | null;
};

export default function MeilleursClientsPage() {
  const { salonFilter, effectiveSalonIds } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'all' | 'year' | 'month'>('all');
  const [clients, setClients] = useState<TopClient[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.getTopClients({ limit: 100, period });
        setClients(data.clients || []);
      } catch (err: any) {
        toast.error(err.message || 'Erreur lors du chargement');
        setClients([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period, salonFilterKey]);

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">100 meilleurs clients</h1>
          <p className="text-sm text-gray-500 mt-1">Classés par chiffre d&apos;affaires puis nombre de visites</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-40 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout le temps</SelectItem>
            <SelectItem value="year">Cette année</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Chargement...
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
          <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Aucun client avec rendez-vous sur cette période.</p>
          <p className="text-xs text-gray-400 mt-2">Les stats apparaissent après des RDV facturés ou confirmés.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Visites</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">MAD</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, index) => (
                <tr key={client.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {client.firstName} {client.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {client.email || client.phone || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{client.visits}</td>
                  <td className="px-4 py-3 text-right font-medium">{client.revenue.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
