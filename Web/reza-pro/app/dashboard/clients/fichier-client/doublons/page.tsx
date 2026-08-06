'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Merge, Users, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

type ClientRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  address?: string | null;
  dateOfBirth?: string | null;
  notes?: string | null;
  status?: string;
  reason?: string;
};

type DuplicateGroup = ClientRow & {
  duplicates: ClientRow[];
};

const MERGE_FIELDS: { key: keyof ClientRow; label: string }[] = [
  { key: 'firstName', label: 'Prénom' },
  { key: 'lastName', label: 'Nom' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'address', label: 'Adresse' },
  { key: 'dateOfBirth', label: 'Date de naissance' },
  { key: 'status', label: 'Statut' },
  { key: 'notes', label: 'Notes' },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  BLOCKED: 'Bloqué',
};

const formatFieldValue = (key: keyof ClientRow, value: any) => {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'dateOfBirth') {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('fr-FR');
  }
  if (key === 'status') return STATUS_LABELS[String(value)] || String(value);
  return String(value);
};

const normalizeForCompare = (value: any) =>
  value === null || value === undefined ? '' : String(value).toLowerCase().trim();

export default function DoublonsPage() {
  const { salonFilter, effectiveSalonIds } = useAuth();
  const salonFilterKey = salonFilter === 'all' ? 'all' : effectiveSalonIds.join(',');
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [selections, setSelections] = useState<Partial<Record<keyof ClientRow, string>>>({});

  const fetchDuplicates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDuplicateClients();
      setGroups(data.duplicates || []);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la détection');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates, salonFilterKey]);

  const openMergeModal = (group: DuplicateGroup) => {
    const all = [group, ...group.duplicates];
    const initial: Partial<Record<keyof ClientRow, string>> = {};
    for (const field of MERGE_FIELDS) {
      initial[field.key] = group.id; // default: keep the primary record's value
    }
    setSelections(initial);
    setMergeGroup(group);
  };

  const closeMergeModal = () => {
    if (merging) return;
    setMergeGroup(null);
    setSelections({});
  };

  const confirmMerge = async () => {
    if (!mergeGroup) return;
    const duplicateIds = mergeGroup.duplicates.map((d) => d.id);
    if (duplicateIds.length === 0) return;

    // Build the field map from the admin's per-field selections.
    const fields: Record<string, any> = {};
    for (const field of MERGE_FIELDS) {
      const chosenClientId = selections[field.key];
      const chosen = [mergeGroup, ...mergeGroup.duplicates].find((c) => c.id === chosenClientId);
      if (chosen) fields[field.key] = (chosen as any)[field.key];
    }

    try {
      setMerging(true);
      await api.mergeClients(mergeGroup.id, duplicateIds, fields);
      toast.success('Doublons fusionnés');
      // Reset modal state directly (closeMergeModal is guarded while merging).
      setMergeGroup(null);
      setSelections({});
      await fetchDuplicates();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la fusion');
    } finally {
      setMerging(false);
    }
  };

  const renderClient = (client: ClientRow, reason?: string) => (
    <div key={client.id} className="text-sm">
      <p className="font-medium text-gray-900">
        {client.firstName} {client.lastName}
      </p>
      <p className="text-gray-500">{client.email || '—'} · {client.phone || '—'}</p>
      {reason && <p className="text-xs text-amber-600 mt-1">{reason}</p>}
    </div>
  );

  // ---- Merge selection modal ----
  const renderMergeModal = () => {
    if (!mergeGroup) return null;
    const all = [mergeGroup, ...mergeGroup.duplicates];

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeMergeModal();
        }}
      >
        <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Fusionner les doublons</h2>
              <p className="text-sm text-gray-500 mt-1">
                Pour chaque champ différent, choisissez la valeur à conserver. Les champs
                identiques sont conservés automatiquement.
              </p>
            </div>
            <button
              onClick={closeMergeModal}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2.5 text-left font-medium text-gray-600 border-b border-gray-200 min-w-[140px]">
                    Champ
                  </th>
                  {all.map((client, idx) => (
                    <th
                      key={client.id}
                      className="px-3 py-2.5 text-left font-medium text-gray-900 border-b border-gray-200 min-w-[160px]"
                    >
                      {idx === 0 ? (
                        <span className="inline-flex items-center gap-1">
                          {client.firstName} {client.lastName}
                          <span className="text-[10px] font-normal text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
                            Principal
                          </span>
                        </span>
                      ) : (
                        `${client.firstName} ${client.lastName}`
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MERGE_FIELDS.map((field) => {
                  const values = all.map((c) => (c as any)[field.key]);
                  const normalized = values.map(normalizeForCompare);
                  const allIdentical =
                    normalized.every((v) => v === normalized[0]);
                  const onlyEmpty = normalized.every((v) => v === '');

                  if (onlyEmpty) {
                    // Nothing to compare for this field — skip the row entirely.
                    return null;
                  }

                  return (
                    <tr key={field.key} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-3 font-medium text-gray-700 align-top">
                        {field.label}
                      </td>
                      {allIdentical ? (
                        <td colSpan={all.length} className="px-3 py-3 text-gray-900">
                          <span className="inline-flex items-center gap-2">
                            {formatFieldValue(field.key, values[0])}
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">
                              Identique
                            </span>
                          </span>
                        </td>
                      ) : (
                        all.map((client) => {
                          const value = (client as any)[field.key];
                          const isSelected = selections[field.key] === client.id;
                          return (
                            <td key={client.id} className="px-3 py-3 align-top">
                              <label
                                className={`flex items-start gap-2 cursor-pointer rounded-lg p-2 -m-2 transition-colors ${
                                  isSelected ? 'bg-[#002366]/5' : 'hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`merge-${field.key}`}
                                  checked={isSelected}
                                  onChange={() =>
                                    setSelections((prev) => ({
                                      ...prev,
                                      [field.key]: client.id,
                                    }))
                                  }
                                  className="mt-0.5 accent-[#002366]"
                                />
                                <span
                                  className={`${
                                    isSelected
                                      ? 'text-gray-900 font-medium'
                                      : 'text-gray-600'
                                  }`}
                                >
                                  {formatFieldValue(field.key, value)}
                                </span>
                              </label>
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={closeMergeModal}
              disabled={merging}
              className="px-4 py-2 rounded-full text-sm text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={confirmMerge}
              disabled={merging}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#002366] text-white text-sm hover:bg-[#001a4d] disabled:opacity-50 transition-colors"
            >
              {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Merge className="w-4 h-4" />}
              Fusionner
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Gestion des doublons</h1>
        <p className="text-sm text-gray-500 mt-1">
          Détection par email, téléphone ou nom similaire
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Analyse en cours...
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Aucun doublon détecté.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-4 flex-1">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Client principal</p>
                    {renderClient(group)}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                      Doublons ({group.duplicates.length})
                    </p>
                    <div className="space-y-3 pl-3 border-l-2 border-amber-200">
                      {group.duplicates.map((dup) => renderClient(dup, dup.reason))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openMergeModal(group)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#002366] text-white text-sm hover:bg-[#001a4d] transition-colors"
                >
                  <Merge className="w-4 h-4" />
                  Fusionner
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {renderMergeModal()}
    </div>
  );
}
