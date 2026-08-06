'use client';

import { Plus, Trash2, Users } from 'lucide-react';
import Link from 'next/link';

export type GuestParticipant = {
  id: string;
  name: string;
  /** Phone — used as the reliable duplicate signal for one-time guests. */
  phone?: string;
  /** Family member id when picked from Mes proches (UI only; API gets name). */
  familyMemberId?: string;
  sameServicesAsBooker: boolean;
  serviceIds: string[];
  employeeId?: string | null;
  /** Per-service employee selections (keyed by serviceId or serviceName) */
  perServiceEmployees?: Record<string, string>;
  /** Custom time when participant has independent schedule (HH:MM) */
  customTime?: string;
  /** Custom date when participant has independent schedule (YYYY-MM-DD) */
  customDate?: string;
};

export type FamilyMemberOption = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  relationship?: string;
  /** Phone — used as the reliable duplicate signal when a proche matches a
   *  guest created on the fly during this booking session. */
  phone?: string;
};

type FlatService = {
  id?: string;
  name: string;
  price?: number;
  duration: string;
};

type Props = {
  participants: GuestParticipant[];
  onChange: (participants: GuestParticipant[]) => void;
  includeBooker: boolean;
  onIncludeBookerChange: (include: boolean) => void;
  bookerTotal: number;
  allServices: FlatService[];
  getServicesTotal: (serviceIds: string[]) => number;
  familyMembers?: FamilyMemberOption[];
  familyLoading?: boolean;
  isAuthenticated?: boolean;
};

export default function GroupParticipantsSection({
  participants,
  onChange,
  includeBooker,
  onIncludeBookerChange,
  bookerTotal,
  allServices,
  getServicesTotal,
  familyMembers = [],
  familyLoading = false,
  isAuthenticated = false,
}: Props) {
  const selectedFamilyIds = new Set(
    participants.map((p) => p.familyMemberId).filter(Boolean) as string[]
  );

  const addGuest = () => {
    onChange([
      ...participants,
      {
        id: `guest-${Date.now()}`,
        name: '',
        sameServicesAsBooker: true,
        serviceIds: [],
      },
    ]);
  };

  const toggleFamilyMember = (member: FamilyMemberOption) => {
    if (selectedFamilyIds.has(member.id)) {
      onChange(participants.filter((p) => p.familyMemberId !== member.id));
      return;
    }
    const displayName =
      member.name.trim() ||
      [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
    onChange([
      ...participants,
      {
        id: `family-${member.id}`,
        familyMemberId: member.id,
        name: displayName,
        sameServicesAsBooker: true,
        serviceIds: [],
      },
    ]);
  };

  const updateParticipant = (id: string, patch: Partial<GuestParticipant>) => {
    onChange(participants.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const removeParticipant = (id: string) => {
    onChange(participants.filter((p) => p.id !== id));
  };

  const guestsTotal = participants.reduce((sum, p) => {
    const ids = p.sameServicesAsBooker ? [] : p.serviceIds;
    return sum + (p.sameServicesAsBooker ? bookerTotal : getServicesTotal(ids));
  }, 0);
  const grandTotal = (includeBooker ? bookerTotal : 0) + guestsTotal;
  const hasAnyone = includeBooker || participants.length > 0;

  const chipClass = (selected: boolean) =>
    `px-3 py-1.5 rounded-full text-xs border transition-colors ${
      selected
        ? 'bg-[#101828] text-white border-[#101828]'
        : 'bg-white border-gray-300 text-gray-900 hover:border-[#101828]'
    }`;

  return (
    <div className="mt-6 mb-2 rounded-2xl border-2 border-[#101828]/20 bg-[#fafaf8] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#101828]" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Pour qui réservez-vous ?
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Cochez Moi et/ou vos proches — vous pouvez réserver sans y être
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addGuest}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-[#101828] text-white hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => onIncludeBookerChange(!includeBooker)}
            className={chipClass(includeBooker)}
          >
            Moi
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-medium text-gray-900">Mes proches</h4>
        </div>

        {!isAuthenticated && (
          <p className="text-sm text-gray-500">
            <Link href="/login" className="text-[#101828] hover:underline">
              Connectez-vous
            </Link>{' '}
            pour sélectionner vos proches, ou ajoutez un invité manuellement.
          </p>
        )}

        {isAuthenticated && familyLoading && (
          <p className="text-sm text-gray-400">Chargement des proches…</p>
        )}

        {isAuthenticated && !familyLoading && familyMembers.length === 0 && (
          <p className="text-sm text-gray-500">
            Aucun proche enregistré.{' '}
            <Link
              href="/account"
              onClick={() => {
                try {
                  localStorage.setItem('accountActiveTab', 'family');
                } catch {
                  /* ignore */
                }
              }}
              className="text-[#101828] hover:underline"
            >
              Ajouter dans Mon compte
            </Link>
            , ou utilisez « Ajouter » ci-dessus.
          </p>
        )}

        {isAuthenticated && !familyLoading && familyMembers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {familyMembers.map((member) => {
              const selected = selectedFamilyIds.has(member.id);
              const label =
                member.name.trim() ||
                [member.firstName, member.lastName].filter(Boolean).join(' ');
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleFamilyMember(member)}
                  className={chipClass(selected)}
                >
                  {label}
                  {member.relationship ? (
                    <span className={selected ? 'opacity-80' : 'text-gray-500'}>
                      {' '}
                      · {member.relationship}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!hasAnyone && (
        <p className="text-sm text-amber-700 mb-3">
          Sélectionnez au moins <strong>Moi</strong> ou un proche / invité.
        </p>
      )}

      {participants.length === 0 && includeBooker && (
        <p className="text-sm text-gray-500 mb-3">
          Réservation pour vous. Ajoutez des proches si besoin.
        </p>
      )}

      <div className="space-y-4">
        {participants.map((participant) => {
          const subtotal = participant.sameServicesAsBooker
            ? bookerTotal
            : getServicesTotal(participant.serviceIds);
          const fromFamily = Boolean(participant.familyMemberId);

          return (
            <div key={participant.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                  {fromFamily ? (
                    <p className="py-2 text-sm text-gray-900 border-b border-gray-100">
                      {participant.name}
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-[#101828]">
                        Proche
                      </span>
                    </p>
                  ) : (
                    <input
                      type="text"
                      value={participant.name}
                      onChange={(e) =>
                        updateParticipant(participant.id, { name: e.target.value })
                      }
                      placeholder="Prénom ou nom"
                      className="w-full border-b border-gray-200 bg-transparent py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#101828]"
                    />
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={participant.sameServicesAsBooker}
                      onChange={(e) =>
                        updateParticipant(participant.id, {
                          sameServicesAsBooker: e.target.checked,
                          serviceIds: e.target.checked ? [] : participant.serviceIds,
                        })
                      }
                    />
                    Mêmes prestations
                  </label>
                  {!participant.sameServicesAsBooker && (
                    <div className="flex flex-wrap gap-2">
                      {allServices.map((service) => {
                        const sid = service.id || service.name;
                        const selected = participant.serviceIds.includes(sid);
                        return (
                          <button
                            key={sid}
                            type="button"
                            onClick={() => {
                              const next = selected
                                ? participant.serviceIds.filter((id) => id !== sid)
                                : [...participant.serviceIds, sid];
                              updateParticipant(participant.id, { serviceIds: next });
                            }}
                            className={`px-3 py-1 rounded-full text-xs border ${
                              selected
                                ? 'bg-[#101828] text-white border-[#101828]'
                                : 'border-gray-300 text-gray-900'
                            }`}
                          >
                            {service.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">Sous-total : {subtotal} MAD</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeParticipant(participant.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {hasAnyone && (
        <div className="mt-6 pt-4 border-t border-gray-100 space-y-2 text-sm">
          {includeBooker && (
            <div className="flex justify-between text-gray-600">
              <span>Moi</span>
              <span>{bookerTotal} MAD</span>
            </div>
          )}
          {participants.map((p) => (
            <div key={p.id} className="flex justify-between text-gray-600">
              <span>{p.name || 'Invité'}</span>
              <span>
                {p.sameServicesAsBooker
                  ? bookerTotal
                  : getServicesTotal(p.serviceIds)}{' '}
                MAD
              </span>
            </div>
          ))}
          <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total groupe</span>
            <span>{grandTotal} MAD</span>
          </div>
          <p className="text-xs text-gray-400">Paiement sur place à l&apos;établissement.</p>
        </div>
      )}
    </div>
  );
}
