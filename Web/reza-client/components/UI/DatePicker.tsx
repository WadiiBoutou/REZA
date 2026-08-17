'use client';

import { useEffect, useRef, useState } from 'react';
import { format, isValid, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, CalendarDays, Keyboard, X } from 'lucide-react';
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

/** Parse "JJ/MM/AAAA" (also accepts `.` or `-` separators) → Date, or null when invalid. */
function parseManualDate(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (year < 1900 || year > 2100) return null;
  const date = new Date(year, month - 1, day);
  if (!isValid(date)) return null;
  // Reject rolled-over dates (e.g. 31/02 → Mar 3)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** Popover date picker — calendar mode + manual keyboard mode (JJ/MM/AAAA). */
export function DatePicker({
  value,
  onChange,
  placeholder = 'JJ/MM/AAAA',
  className,
  fromYear = 1900,
  toYear = new Date().getFullYear(),
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'calendar' | 'manual'>('calendar');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Seed the manual field with the current value when switching to manual mode
  const switchToManual = () => {
    setMode('manual');
    setText(value ? format(value, 'dd/MM/yyyy') : '');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const applyManual = () => {
    if (!text.trim()) {
      onChange(undefined);
      setError(null);
      setOpen(false);
      return;
    }
    const date = parseManualDate(text);
    if (!date) {
      setError('Date invalide — format attendu : JJ/MM/AAAA');
      return;
    }
    if (maxDate && date > maxDate) {
      setError('La date ne peut pas être dans le futur');
      return;
    }
    if (date.getFullYear() < fromYear || date.getFullYear() > toYear) {
      setError(`L'année doit être comprise entre ${fromYear} et ${toYear}`);
      return;
    }
    onChange(date);
    setError(null);
    setOpen(false);
  };

  const displayValue = value ? format(value, 'dd/MM/yyyy') : '';

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setMode('calendar');
          setError(null);
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-full border border-gray-200 bg-transparent px-6 py-3 text-left text-base font-medium outline-none transition-all focus:ring-1 focus:ring-[#082259]',
          value ? 'text-gray-900' : 'text-gray-400'
        )}
      >
        <CalendarIcon size={18} className="shrink-0 text-gray-400" />
        <span className="flex-1 truncate">
          {value ? displayValue : placeholder}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
              setText('');
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
          {/* Mode toggle */}
          <div className="flex gap-1 border-b border-gray-100 p-2">
            <button
              type="button"
              onClick={() => { setMode('calendar'); setError(null); }}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                mode === 'calendar'
                  ? 'bg-[#082259] text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <CalendarDays size={14} />
              Calendrier
            </button>
            <button
              type="button"
              onClick={switchToManual}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                mode === 'manual'
                  ? 'bg-[#082259] text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Keyboard size={14} />
              Saisie manuelle
            </button>
          </div>

          {mode === 'calendar' ? (
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => {
                onChange(date);
                setOpen(false);
              }}
              locale={fr}
              captionLayout="dropdown"
              startMonth={new Date(fromYear, 0, 1)}
              endMonth={new Date(toYear, 11, 31)}
              disabled={maxDate ? (d) => d > maxDate : undefined}
              defaultMonth={value || (maxDate ?? new Date())}
            />
          ) : (
            <div className="p-4">
              <p className="mb-2 text-xs text-gray-500">
                Saisissez la date au format <span className="font-semibold text-gray-700">JJ/MM/AAAA</span>
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyManual();
                    if (e.key === 'Escape') { setOpen(false); setError(null); }
                  }}
                  placeholder="JJ/MM/AAAA"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[#082259] focus:ring-1 focus:ring-[#082259]"
                />
                <button
                  type="button"
                  onClick={applyManual}
                  className="shrink-0 rounded-lg bg-[#082259] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#001a4d]"
                >
                  OK
                </button>
              </div>
              {error && (
                <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
              )}
              <p className="mt-3 text-xs text-gray-400">
                Exemple : 15/08/1990
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
