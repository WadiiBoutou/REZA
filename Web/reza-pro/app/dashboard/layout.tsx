'use client';

import { Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import ProtectedRoute from '@/components/ProtectedRoute';
import PaywallModal from '@/components/PaywallModal';
import { useAuth } from '@/contexts/AuthContext';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { salonFilterVersion } = useAuth();
  // Root-level salon-scoping key: when the global salon filter changes, remount
  // the page subtree so every page re-fetches its salon-scoped data (agenda,
  // caisse, clients, personnels, admin settings, stats...). The version counter
  // only bumps on user-initiated filter changes — not during the initial
  // localStorage hydration — so a hard page load never causes a spurious remount.

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-zinc-50">
        <Suspense fallback={<div className="w-64 bg-white border-r border-gray-200" />}>
          <Sidebar />
        </Suspense>
        <style>{`
          @media print {
            .sidebar { display: none !important; }
          }
        `}</style>
        {/* pt-28 = fixed Sidebar topbar (h-20) + former p-8 top spacing */}
        <main key={salonFilterVersion} className="flex-1 px-8 pb-8 pt-28">
          {children}
        </main>
        <PaywallModal />
      </div>
    </ProtectedRoute>
  );
}
