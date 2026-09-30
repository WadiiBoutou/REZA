'use client';

import { useSyncExternalStore } from 'react';
import { isDemoMode } from '../lib/demo-mode';

const BANNER_HEIGHT = '1.5rem';

function subscribe(onStoreChange: () => void) {
  window.addEventListener('reza-demo-mode-change', onStoreChange);
  window.addEventListener('reza-demo-update', onStoreChange);
  return () => {
    window.removeEventListener('reza-demo-mode-change', onStoreChange);
    window.removeEventListener('reza-demo-update', onStoreChange);
  };
}

function getServerSnapshot() {
  return false;
}

export default function DemoBanner() {
  const active = useSyncExternalStore(subscribe, isDemoMode, getServerSnapshot);

  if (!active) return null;

  return (
    <>
      <style>{`
        .fixed.top-0 { top: ${BANNER_HEIGHT}; }
        .fixed.top-0.h-screen { height: calc(100vh - ${BANNER_HEIGHT}); }
      `}</style>
      <div
        role="note"
        aria-label="Mode démonstration"
        style={{ top: 0 }}
        className="fixed inset-x-0 z-[99999] flex h-6 items-center justify-center bg-[#bd9a52] text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#201c10] shadow-[0_1px_6px_rgba(0,0,0,0.3)]"
      >
        This is a demo / Ceci est une démo
      </div>
    </>
  );
}
