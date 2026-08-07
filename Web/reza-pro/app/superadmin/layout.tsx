'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, LogOut, Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface SuperAdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} j`;
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();

  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<SuperAdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    try {
      const res = await api.superAdminGetNotifications();
      setNotifications(res.notifications ?? []);
      setUnreadCount(res.unreadCount ?? 0);
    } catch {
      // Bell is non-critical — stay silent on failure
    }
  };

  useEffect(() => {
    if (loading || !isAuthenticated || user?.role !== 'SUPER_ADMIN') return;
    setNotifLoading(true);
    loadNotifications().finally(() => setNotifLoading(false));
    const t = setInterval(() => loadNotifications(), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated, user?.role]);

  useEffect(() => {
    if (!bellOpen) return;
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bellOpen]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openNotification = async (n: SuperAdminNotification) => {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await api.superAdminMarkNotificationRead(n.id);
      } catch {
        // ignore
      }
    }
    setBellOpen(false);
    // Full navigation so the page picks up the ?tab= query param reliably
    window.location.href = n.link || '/superadmin?tab=payments';
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnreadCount(0);
    try {
      await api.superAdminMarkAllNotificationsRead();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.push('/login?redirect=%2Fsuperadmin');
      return;
    }
    if (user && user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard/rendez-vous');
    }
  }, [loading, isAuthenticated, user, router]);

  if (loading || !isAuthenticated || user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40">
        <div className="h-full px-8 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#002366] flex items-center justify-center">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Reza Superadmin</p>
              <p className="text-xs text-gray-500 leading-tight">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={() => setBellOpen((o) => !o)}
                aria-label="Notifications"
                className="relative inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
              >
                <Bell size={19} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">Notifications</p>
                    {notifications.some((n) => !n.isRead) && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#002366] hover:underline"
                      >
                        <CheckCheck size={13} /> Tout marquer comme lu
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifLoading && notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-gray-400">Chargement…</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-gray-500">Aucune notification.</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => openNotification(n)}
                          className={`block w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                            n.isRead ? '' : 'bg-blue-50/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                          </div>
                          <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{n.message}</p>
                          {!n.isRead && <span className="inline-block mt-1.5 h-1.5 w-1.5 rounded-full bg-[#002366]" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut size={16} />
              Se déconnecter
            </button>
          </div>
        </div>
      </header>
      <main className="pt-24 pb-16 px-8 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
