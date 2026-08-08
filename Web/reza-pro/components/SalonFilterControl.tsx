'use client';

import { useState } from 'react';
import { Building, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth, type Salon } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

function filterLabel(
  salonFilter: 'all' | string[],
  salons: Salon[],
  effectiveSalonIds: string[]
): string {
  if (salonFilter === 'all' || effectiveSalonIds.length !== 1) {
    // Single-salon mode: while a stale 'all' filter is being migrated (or if
    // nothing is selected yet), fall back to the first salon.
    return salons[0]?.name || 'Choisir un salon';
  }
  return salons.find((s) => s.id === effectiveSalonIds[0])?.name || 'Choisir un salon';
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
  } = useAuth();
  const [open, setOpen] = useState(false);

  if (salons.length <= 1) return null;

  const selectSalon = (id: string) => {
    // Radio semantics: choosing one salon replaces any other selection.
    setSalonFilter([id]);
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
        <div className="max-h-56 overflow-y-auto">
          {salons.map((salon) => {
            const checked =
              salonFilter !== 'all' && effectiveSalonIds[0] === salon.id;
            return (
              <button
                key={salon.id}
                type="button"
                onClick={() => selectSalon(salon.id)}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-gray-50 text-left"
              >
                <span
                  className={cn(
                    'size-4 shrink-0 rounded-full border grid place-content-center',
                    checked ? 'border-[#002366]' : 'border-gray-300'
                  )}
                >
                  {checked && <span className="size-2 rounded-full bg-[#002366]" />}
                </span>
                <span className="truncate">{salon.name}</span>
                {salon.city && (
                  <span className="ml-auto text-[11px] text-gray-400 shrink-0">{salon.city}</span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
