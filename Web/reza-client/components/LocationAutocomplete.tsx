'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { MOROCCAN_CITIES } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (city: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

const CITY_LIST = MOROCCAN_CITIES.filter((c) => c !== 'Autre');

export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  onEnter,
  placeholder = 'Où',
  className = '',
  inputClassName = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q
      ? CITY_LIST.filter((c) => c.toLowerCase().includes(q))
      : CITY_LIST;
    // Priority cities first when empty query
    if (!q) {
      const priority = ['Casablanca', 'Marrakech', 'Rabat', 'Tanger', 'Fès', 'Agadir'] as const;
      const top = priority.filter((p) => CITY_LIST.includes(p));
      const rest = CITY_LIST.filter(
        (c) => !priority.some((p) => p.toLowerCase() === c.toLowerCase())
      );
      return [...top, ...rest].slice(0, 8);
    }
    return list.slice(0, 8);
  }, [value]);

  useEffect(() => {
    setHighlight(0);
  }, [suggestions]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (city: string) => {
    onChange(city);
    onSelect?.(city);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, Math.max(suggestions.length - 1, 0)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            if (open && suggestions[highlight]) {
              e.preventDefault();
              pick(suggestions[highlight]);
            } else {
              onEnter?.();
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={
          inputClassName ||
          'w-full pl-12 pr-6 py-3 rounded-full border border-gray-300 focus:outline-none focus:border-black text-gray-900 bg-white'
        }
      />

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-50 max-h-64 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg py-1"
        >
          {suggestions.map((city, idx) => (
            <li key={city} role="option" aria-selected={idx === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(city)}
                onMouseEnter={() => setHighlight(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  idx === highlight ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{city}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && value.trim() && suggestions.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-gray-200 bg-white shadow-lg px-4 py-3 text-sm text-gray-500">
          Aucune ville trouvée
        </div>
      )}
    </div>
  );
}
