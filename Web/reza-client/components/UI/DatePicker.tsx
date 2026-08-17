'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from './Calendar';

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  fromYear?: number;
  toYear?: number;
  /** Disable all dates after this (e.g. today for a birth date). */
  maxDate?: Date;
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Popover date picker — same rounded visual language as the form inputs. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Choisir une date',
  className,
  fromYear,
  toYear,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-full border border-gray-200 bg-transparent px-6 py-3 text-left text-base font-medium outline-none transition-all focus:ring-1 focus:ring-[#082259]',
          value ? 'text-gray-900' : 'text-gray-400'
        )}
      >
        <CalendarIcon size={18} className="shrink-0 text-gray-400" />
        <span className="flex-1 truncate">
          {value ? format(value, 'PPP', { locale: fr }) : placeholder}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="p-1 text-gray-400 hover:text-gray-700"
            aria-label="Effacer la date"
          >
            <X size={16} />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-auto min-w-[280px] overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-xl">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
            locale={fr}
            captionLayout="dropdown"
            startMonth={fromYear ? new Date(fromYear, 0, 1) : undefined}
            endMonth={toYear ? new Date(toYear, 11, 31) : undefined}
            disabled={maxDate ? (d) => d > maxDate : undefined}
            defaultMonth={value || (maxDate ?? undefined)}
          />
        </div>
      )}
    </div>
  );
}
