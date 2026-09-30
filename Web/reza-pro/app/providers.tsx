'use client';

import React, { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import DemoBanner from '@/components/DemoBanner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [demoRevision, setDemoRevision] = useState(0);

  useEffect(() => {
    const handleDemoUpdate = (event: Event) => {
      if ((event as CustomEvent<{ app?: string }>).detail?.app === 'pro') {
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
      <Toaster position="top-right" />
    </AuthProvider>
  );
}



