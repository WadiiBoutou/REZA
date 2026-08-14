'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User, Menu, X, ChevronDown, LogOut, Bell, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '../lib/api';
import { formatMoroccoDateTime } from '../lib/utils';

const LoadingOverlay = dynamic(() => import('@/components/UI/LoadingOverlay'), { ssr: false });

const RezaNavbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  
  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch notifications when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.email) {
      fetchNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(() => {
        fetchNotifications();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user?.email]);

  const fetchNotifications = async () => {
    if (!user?.email) return;
    try {
      setLoadingNotifications(true);
      const notificationsRes = await api.getClientNotifications(user.email, { limit: 10 });
      setNotifications(notificationsRes.notifications || []);
      setUnreadNotificationsCount(notificationsRes.unreadCount || 0);
    } catch (error: any) {
      // Backend down / network blip — keep UI quiet (Next overlays console.error TypeError)
      const isNetwork =
        error?.name === 'TypeError' ||
        /failed to fetch|networkerror|load failed/i.test(String(error?.message || error));
      if (!isNetwork) {
        console.error('Error fetching notifications:', error);
      }
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleMarkNotificationAsRead = async (notificationId: string) => {
    try {
      await api.markClientNotificationAsRead(notificationId);
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
      ));
      setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotificationsDropdown(false);
      }
    };

    if (showUserDropdown || showNotificationsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown, showNotificationsDropdown]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
    setShowUserDropdown(false);
  };

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    router.push('/');
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const navItems = [
    { name: 'Coiffeur', path: '/coiffeur' },
    { name: 'Barbier', path: '/barbier' },
    { name: 'Manucure', path: '/manucure' },
    { name: 'Institut de beauté', path: '/institut-de-beaute' },
  ];

  return (
    <>
      {/* Main Navigation */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100'
            : 'bg-transparent'
        }`}
        style={{ top: isScrolled ? 0 : 0 }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Logo */}
            <a 
              href="/" 
              className="flex-shrink-0 transition-transform duration-200 hover:scale-105 cursor-pointer"
            >
              <div className="flex items-center">
                <span className={`font-bold text-[30px] tracking-[0.1em] uppercase transition-colors duration-300 ${
                  isScrolled ? 'text-[#101928]' : 'text-[#101928]'
                }`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  REZA
                </span>
              </div>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-2">
              {navItems.map((item) => (
                <a
                  key={item.name}
                  href={item.path}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                    isScrolled
                      ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                      : 'text-gray-800 hover:text-gray-900 hover:bg-black/5'
                  }`}
                >
                  {item.name}
                </a>
              ))}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
              {/* Global Pill Container - Desktop */}
              <div className={`hidden lg:flex items-center gap-3 px-3 py-2 rounded-full transition-all duration-200 ${
                isScrolled 
                  ? 'bg-transparent' 
                  : 'bg-transparent'
              }`}>
                {/* Professional Pill */}
                <a
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    setNavLoading(true);
                    setTimeout(() => {
                      window.location.href = "/pro-info";
                    }, 2200);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                    isScrolled
                      ? 'hover:bg-gray-100 text-gray-900'
                      : 'hover:bg-black/5 text-gray-900'
                  }`}
                >
                  <span className="text-sm font-medium">
                    Je suis un professionnel de beauté
                  </span>
                </a>

                {/* Notifications Bell - Show if authenticated */}
                {mounted && isAuthenticated && user && (
                  <div className="relative" ref={notificationsRef}>
                    <button
                      onClick={() => {
                        setShowNotificationsDropdown(!showNotificationsDropdown);
                        setShowUserDropdown(false);
                        if (!showNotificationsDropdown) {
                          fetchNotifications();
                        }
                      }}
                      className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isScrolled
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          : 'bg-white/50 hover:bg-white/80 text-gray-800'
                      }`}
                    >
                      <Bell size={18} strokeWidth={2} />
                      {unreadNotificationsCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-[#8b7260] text-white text-[10px] font-semibold rounded-full flex items-center justify-center border-2 border-[#f5f7f3]">
                          {unreadNotificationsCount > 99 ? '+99' : unreadNotificationsCount}
                        </span>
                      )}
                    </button>

                    {/* Notifications Dropdown */}
                    {showNotificationsDropdown && (
                      <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                          {unreadNotificationsCount > 0 && (
                            <span className="text-xs text-gray-500">{unreadNotificationsCount} non lue{unreadNotificationsCount > 1 ? 's' : ''}</span>
                          )}
                        </div>

                        {/* Notifications List */}
                        <div className="overflow-y-auto max-h-[400px]">
                          {loadingNotifications ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-500">
                              Chargement...
                            </div>
                          ) : notifications.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                              {notifications.map((notification: any) => (
                                <div
                                  key={notification.id}
                                  className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                                    !notification.isRead ? 'bg-[#faf8f6]' : ''
                                  }`}
                                  onClick={() => {
                                    if (!notification.isRead) {
                                      handleMarkNotificationAsRead(notification.id);
                                    }
                                    if (notification.link) {
                                      router.push(notification.link);
                                    } else {
                                      router.push('/account');
                                    }
                                    setShowNotificationsDropdown(false);
                                  }}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      !notification.isRead ? 'bg-[#8b7260]' : 'bg-gray-200'
                                    }`}>
                                      <Bell className={`w-4 h-4 ${!notification.isRead ? 'text-white' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <p className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                                            {notification.title}
                                          </p>
                                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                            {notification.message}
                                          </p>
                                          <p className="text-xs text-gray-400 mt-1">
                                            {formatMoroccoDateTime(notification.createdAt, {
                                              day: 'numeric',
                                              month: 'short',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </p>
                                        </div>
                                        {!notification.isRead && (
                                          <div className="w-2 h-2 bg-[#8b7260] rounded-full flex-shrink-0 mt-1"></div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="px-4 py-8 text-center">
                              <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                              <p className="text-sm text-gray-500">Aucune notification</p>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                          <div className="px-4 py-3 border-t border-gray-200">
                            <a
                              href="/account"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowNotificationsDropdown(false);
                                router.push('/account');
                              }}
                              className="text-sm text-[#8b7260] hover:text-[#6b5847] font-medium text-center block"
                            >
                              Voir toutes les notifications
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Account Pill - Show dropdown if authenticated, otherwise login link */}
                {mounted && isAuthenticated && user ? (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowUserDropdown(!showUserDropdown)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                        isScrolled
                          ? 'bg-[#101928] hover:bg-black text-white'
                          : 'bg-white/80 hover:bg-white text-gray-900 shadow-sm border border-gray-200'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isScrolled ? 'bg-white/20' : 'bg-gray-100'}`}>
                        <User size={14} strokeWidth={2} />
                      </div>
                      <span className="text-sm font-medium">
                        {user.firstName || user.name || user.email?.split('@')[0] || 'Profil'}
                      </span>
                      <ChevronDown size={14} className={`transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {showUserDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        <a
                          href="/account?tab=profile"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowUserDropdown(false);
                            router.push('/account?tab=profile');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <User size={16} />
                          <span>Mon profil</span>
                        </a>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut size={16} />
                          <span>Se déconnecter</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <a
                    href="#"
                    onClick={e => {
                      e.preventDefault();
                      setNavLoading(true);
                      setTimeout(() => {
                        window.location.href = "/login";
                      }, 2200);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                      isScrolled
                        ? 'bg-[#101928] hover:bg-black text-white shadow-sm'
                        : 'bg-white/90 hover:bg-white text-gray-900 shadow-sm border border-gray-200'
                    }`}
                  >
                    <User size={16} strokeWidth={2} className={isScrolled ? 'text-white' : 'text-gray-700'} />
                    <span className="text-sm font-medium">
                      Mon Compte
                    </span>
                  </a>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`lg:hidden w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isScrolled 
                    ? 'bg-gray-100 hover:bg-gray-200' 
                    : 'bg-white/50 hover:bg-white/80'
                }`}
              >
                {isMobileMenuOpen ? (
                  <X className={`h-5 w-5 ${isScrolled ? 'text-gray-900' : 'text-black'}`} />
                ) : (
                  <Menu className={`h-5 w-5 ${isScrolled ? 'text-gray-900' : 'text-black'}`} />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Menu Panel */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white"
            style={{
              animation: 'slideInRight 0.3s ease-out'
            }}
          >
            <div className="flex flex-col h-full p-8 pt-24">
              {/* Navigation Items */}
              <div className="flex-1 space-y-2">
                {navItems.map((item, idx) => (
                  <a
                    key={idx}
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-lg font-medium text-gray-900 hover:text-gray-600 transition-colors py-3 px-4 rounded-full hover:bg-gray-50"
                  >
                    {item.name}
                  </a>
                ))}

                {/* Pro Link */}
                <a
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    setNavLoading(true);
                    setTimeout(() => {
                      window.location.href = "/pro-info";
                    }, 2200);
                  }}
                  className="block text-lg font-medium py-3 px-4 transition-colors mt-4"
                >
                  <span className="text-[#000] underline">Espace Professionnel</span>
                </a>
              </div>

              {/* Notifications - Mobile */}
              {mounted && isAuthenticated && user && (
                <a
                  href="/account"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    router.push('/account');
                  }}
                  className="flex items-center justify-between py-4 px-4 rounded-full bg-gray-50 hover:bg-gray-100 transition-all mb-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Bell size={18} className="text-gray-700" strokeWidth={2} />
                      {unreadNotificationsCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#8b7260] text-white text-[9px] font-semibold rounded-full flex items-center justify-center">
                          {unreadNotificationsCount > 99 ? '+99' : unreadNotificationsCount}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      Notifications
                      {unreadNotificationsCount > 0 && (
                        <span className="ml-2 text-xs text-gray-500">({unreadNotificationsCount} nouvelle{unreadNotificationsCount > 1 ? 's' : ''})</span>
                      )}
                    </span>
                  </div>
                </a>
              )}

              {/* Account CTA - Show dropdown if authenticated, otherwise login link */}
              {mounted && isAuthenticated && user ? (
                <div className="space-y-2">
                  <a
                    href="/account"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsMobileMenuOpen(false);
                      router.push('/account');
                    }}
                    className="flex items-center justify-center gap-3 py-4 rounded-full bg-[#101928] hover:bg-black transition-all group"
                  >
                    <User size={18} className="text-white" strokeWidth={2} />
                    <span className="text-sm font-semibold text-white">
                      {user.firstName || user.name || user.email?.split('@')[0] || 'Mon profil'}
                    </span>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="transition-transform group-hover:translate-x-1 text-white"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </a>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-full bg-red-50 hover:bg-red-100 text-red-600 transition-all"
                  >
                    <LogOut size={18} />
                    <span className="text-sm font-semibold">Se déconnecter</span>
                  </button>
                </div>
              ) : (
                <a
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    setNavLoading(true);
                    setTimeout(() => {
                      window.location.href = "/login";
                    }, 2200);
                  }}
                  className="flex items-center justify-center gap-3 py-4 rounded-full bg-[#101928] hover:bg-black transition-all group"
                >
                  <User size={18} className="text-white" strokeWidth={2} />
                  <span className="text-sm font-semibold text-white">
                    Mon Compte
                  </span>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="14" 
                    height="14" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="transition-transform group-hover:translate-x-1 text-white"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {navLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f5f7f3]">
          <LoadingOverlay />
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div 
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={cancelLogout}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirmer la déconnexion
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Êtes-vous sûr de vouloir vous déconnecter ? Vous devrez vous reconnecter pour accéder à votre compte.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <LogOut size={16} />
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
};

export default RezaNavbar;