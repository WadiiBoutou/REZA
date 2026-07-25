import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  id?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = ['00', '30'];

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, id }) => {
  const [open, setOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(() => {
    const parts = (value || '').split(':');
    return parts[0] || '08';
  });
  const [selectedMinute, setSelectedMinute] = useState(() => {
    const parts = (value || '').split(':');
    const m = parts[1] || '00';
    return MINUTES.includes(m) ? m : '00';
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);

  // Sync internal state when value prop changes externally
  useEffect(() => {
    const parts = (value || '').split(':');
    const h = parts[0] || '08';
    const m = parts[1] || '00';
    setSelectedHour(h);
    setSelectedMinute(MINUTES.includes(m) ? m : '00');
  }, [value]);

  // Auto-scroll hour list to selected hour when opened
  useEffect(() => {
    if (open && hourListRef.current) {
      const idx = HOURS.indexOf(selectedHour);
      if (idx >= 0) {
        const item = hourListRef.current.children[idx] as HTMLElement;
        if (item) item.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }
  }, [open, selectedHour]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleSelect = (h: string, m: string) => {
    const newVal = `${h}:${m}`;
    setSelectedHour(h);
    setSelectedMinute(m);
    setOpen(false);
    onChange && onChange(newVal);
  };

  const displayValue = value || '08:00';
  const displayMinutes = MINUTES.includes(displayValue.split(':')[1] || '') ? displayValue.split(':')[1] : '00';
  const displayHours = displayValue.split(':')[0] || '08';

  return (
    <div ref={containerRef} className="relative w-full" id={id}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-full text-sm bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
      >
        <Clock size={16} className="text-gray-400 shrink-0" />
        <span className="text-gray-900 font-medium tabular-nums">
          {displayHours}:{displayMinutes}
        </span>
        <span className="ml-auto text-gray-400 text-xs">▼</span>
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 mt-1 w-56 bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden"
          >
            <div className="flex">
              {/* Hours */}
              <div className="flex-1 border-r border-gray-100">
                <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50 text-center border-b border-gray-100">
                  Heure
                </div>
                <div
                  ref={hourListRef}
                  className="h-48 overflow-y-auto scroll-smooth"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleSelect(h, selectedMinute)}
                      className={`w-full px-3 py-1.5 text-sm text-center transition-colors ${
                        h === selectedHour
                          ? 'bg-gray-900 text-white font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes */}
              <div className="flex-1">
                <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50 text-center border-b border-gray-100">
                  Min
                </div>
                <div className="h-48 flex flex-col items-center justify-center gap-3">
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelect(selectedHour, m)}
                      className={`w-16 px-3 py-2 text-sm font-medium text-center rounded-lg transition-colors ${
                        m === selectedMinute
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-3 py-2 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400 tabular-nums">
                {selectedHour}:{selectedMinute}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                OK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { TimePicker };
export default TimePicker;
