'use client';

import { useEffect, useState } from 'react';
import { Loader2, BarChart3, Users, X, ChevronRight } from 'lucide-react';
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

type BucketClient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  visits: number;
};

type FrequencyBucket = {
  type: string;
  desc: string;
  count: number;
  color: string;
  clients?: BucketClient[];
};

export default function FrequencesGlobalesPage() {
  const { salonFilter, effectiveSalonIds } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'year' | 'month' | 'all'>('year');
  const [buckets, setBuckets] = useState<FrequencyBucket[]>([]);
  const [stats, setStats] = useState({
    clientsWithVisits: 0,
    clientsWithoutVisits: 0,
    totalClients: 0,
    avgVisits: 0,
    totalVisits: 0,
  });
  const [openBucket, setOpenBucket] = useState<FrequencyBucket | null>(null);
  const [modalPage, setModalPage] = useState(1);
  // Bucket lists (especially "Sans visite") can grow unbounded — paginate inside the modal.
  const MODAL_PAGE_SIZE = 10;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.getClientFrequencyStats({ period });
        setBuckets(data.frequencyBuckets || []);
        setStats(prev => data.stats || prev);
      } catch (err: any) {
        toast.error(err.message || 'Erreur lors du chargement');
        setBuckets([]);
        setStats({
          clientsWithVisits: 0,
          clientsWithoutVisits: 0,
          totalClients: 0,
          avgVisits: 0,
          totalVisits: 0,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period, salonFilterKey]);

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Fréquences globales</h1>
          <p className="text-sm text-gray-500 mt-1">Répartition globale (historique complet)</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-40 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Ce mois</SelectItem>
            <SelectItem value="year">Cette année</SelectItem>
            <SelectItem value="all">Tout le temps</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Clients actifs', value: stats.clientsWithVisits },
          { label: 'Sans visite', value: stats.clientsWithoutVisits },
          { label: 'Visites totales', value: stats.totalVisits },
          { label: 'Moy. visites / client', value: stats.avgVisits },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
            <p className="text-3xl font-light text-gray-900 mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Chargement...
        </div>
      ) : buckets.every((b) => b.count === 0) ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Pas assez de données sur cette période.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          {buckets.map((bucket) => (
            <button
              key={bucket.type}
              onClick={() => { setOpenBucket(bucket); setModalPage(1); }}
              className="w-full text-left group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{bucket.type}</span>
                  <span className="text-sm text-gray-500 ml-1">{bucket.desc}</span>
                  {bucket.count > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-[#002366] bg-[#002366]/5 rounded-full px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      Voir la liste <ChevronRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-900">{bucket.count}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all group-hover:opacity-80"
                  style={{
                    width: `${(bucket.count / maxCount) * 100}%`,
                    backgroundColor: bucket.color,
                  }}
                />
              </div>
            </button>
          ))}
          <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            Cliquez sur une catégorie pour voir la liste des clients concernés.
          </p>
        </div>
      )}

      {/* Drill-down modal */}
      {openBucket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenBucket(null);
          }}
        >
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{openBucket.type}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {openBucket.desc} · {openBucket.count} client{openBucket.count > 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setOpenBucket(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(!openBucket.clients || openBucket.clients.length === 0) ? (
              <div className="py-10 text-center">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Aucun client dans cette catégorie.</p>
              </div>
            ) : (
              <>
                <div className="mt-4 divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
                  {openBucket.clients.slice((modalPage - 1) * MODAL_PAGE_SIZE, modalPage * MODAL_PAGE_SIZE).map((client) => (
                    <div key={client.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {client.firstName} {client.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {client.email || client.phone || '—'}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-50 rounded-full px-2.5 py-1">
                        <Users className="w-3 h-3 text-gray-400" />
                        {client.visits} visite{client.visits > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {openBucket.clients.length > MODAL_PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                    <button
                      onClick={() => setModalPage(p => Math.max(1, p - 1))}
                      disabled={modalPage === 1}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      Précédent
                    </button>
                    <span className="text-xs font-medium text-gray-500">
                      {modalPage} / {Math.ceil(openBucket.clients.length / MODAL_PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() => setModalPage(p => Math.min(Math.ceil(openBucket.clients.length / MODAL_PAGE_SIZE), p + 1))}
                      disabled={modalPage === Math.ceil(openBucket.clients.length / MODAL_PAGE_SIZE)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
