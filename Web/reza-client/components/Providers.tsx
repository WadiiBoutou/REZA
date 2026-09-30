'use client';

import { useEffect, useState } from 'react';
import { AuthProvider } from '../context/AuthContext';
import DemoBanner from './DemoBanner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [demoRevision, setDemoRevision] = useState(0);

  useEffect(() => {
    const handleDemoUpdate = (event: Event) => {
      if ((event as CustomEvent<{ app?: string }>).detail?.app === 'client') {
        setDemoRevision((revision) => revision + 1);
      }
    };
    window.addEventListener('reza-demo-update', handleDemoUpdate);
    return () => window.removeEventListener('reza-demo-update', handleDemoUpdate);
  }, []);

  return (
    <AuthProvider>
      <div key={demoRevision}>{children}</div>
      <DemoBanner />
    </AuthProvider>
  );
}

