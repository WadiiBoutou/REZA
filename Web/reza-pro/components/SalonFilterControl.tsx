'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Building, ChevronDown, Check, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth, type Salon } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

function filterLabel(
  salonFilter: 'all' | string[],
  salons: Salon[],
  effectiveSalonIds: string[]
): string {
  if (salonFilter === 'all' || effectiveSalonIds.length === salons.length) {
    return 'Tous les salons';
  }
  if (effectiveSalonIds.length === 1) {
    return salons.find((s) => s.id === effectiveSalonIds[0])?.name || '1 salon';
  }
  return `${effectiveSalonIds.length} salons`;
}

export function SalonFilterControl({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const {
    salons,
    salonFilter,
    setSalonFilter,
    effectiveSalonIds,
    isSalonFilterMulti,
  } = useAuth();
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(effectiveSalonIds), [effectiveSalonIds]);

  if (salons.length <= 1) return null;

  const allSelected =
    salonFilter === 'all' || effectiveSalonIds.length === salons.length;

  const toggleAll = () => {
    setSalonFilter('all');
  };

  const toggleSalon = (id: string) => {
    if (allSelected) {
      // Deselect all except this one? Or remove this from all?
      const next = salons.map((s) => s.id).filter((sid) => sid !== id);
      setSalonFilter(next.length === 0 ? [id] : next);
      return;
    }

    const next = new Set(effectiveSalonIds);
    if (next.has(id)) {
      next.delete(id);
      if (next.size === 0) {
        // Keep at least one
        setSalonFilter([id]);
        return;
      }
      const arr = Array.from(next);
      setSalonFilter(arr.length === salons.length ? 'all' : arr);
    } else {
      next.add(id);
      const arr = Array.from(next);
      setSalonFilter(arr.length === salons.length ? 'all' : arr);
    }
  };

  const label = filterLabel(salonFilter, salons, effectiveSalonIds);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors',
            compact ? 'px-3 py-1.5' : 'px-4 py-2',
            isSalonFilterMulti && 'border-[#002366]/40',
            className
          )}
        >
          <Building size={16} className="text-[#002366] shrink-0" />
          <span className="truncate max-w-[160px]">{label}</span>
          <ChevronDown size={14} className="text-gray-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Filtrer les salons
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className={cn(
            'w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-gray-50',
            allSelected && 'bg-[#002366]/5 text-[#002366] font-medium'
          )}
        >
          <span
            className={cn(
              'size-3 shrink-0 rounded-full border grid place-content-center',
              allSelected ? 'bg-black border-0 text-white' : 'border-gray-300'
            )}
          >
            {allSelected && <Check size={8} className="text-white" />}
          </span>
          <span>Tous les salons</span>
          {allSelected && <Check size={14} className="ml-auto text-[#002366]" />}
        </button>
        <div className="my-1 h-px bg-gray-100" />
        <div className="max-h-56 overflow-y-auto">
          {salons.map((salon) => {
            const checked = allSelected || selectedSet.has(salon.id);
            return (
              <button
                key={salon.id}
                type="button"
                onClick={() => toggleSalon(salon.id)}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-gray-50 text-left"
              >
                <span
                  className={cn(
                    'size-3 shrink-0 rounded-full border grid place-content-center',
                    checked ? 'bg-black border-0 text-white' : 'border-gray-300'
                  )}
                >
                  {checked && <Check size={8} className="text-white" />}
                </span>
                <span className="truncate">{salon.name}</span>
                {salon.city && (
                  <span className="ml-auto text-[11px] text-gray-400 shrink-0">{salon.city}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="my-1 h-px bg-gray-100" />
        <Link
          href="/dashboard/mes-salons"
          onClick={() => setOpen(false)}
          className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#002366] hover:bg-[#002366]/5 font-medium"
        >
          <ExternalLink size={14} />
          <span>Modifier</span>
        </Link>
        <p className="px-2 pt-2 pb-1 text-[11px] text-gray-400 leading-snug">
          Filtre Agenda, Clients et Caisse. Création → un salon précis requis si plusieurs sélectionnés.
        </p>
      </PopoverContent>
    </Popover>
  );
}
