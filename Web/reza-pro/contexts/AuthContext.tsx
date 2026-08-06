'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string | null;
  emailVerified?: boolean;
  tenant?: {
    id: string;
    name: string;
  } | null;
}

export interface Salon {
  id: string;
  name: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  city: string | null;
  category?: string | null;
  shortDescription?: string | null;
  coverImage?: string | null;
  subscriptionActive: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface SubscriptionInfo {
  status: string;
  currentPeriodEnd: string | null;
  plan: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
    interval: string;
    maxSalons: number;
  } | null;
}

export type SalonFilter = 'all' | string[];

const SALON_FILTER_KEY = 'activeSalonIds';

function loadSalonFilter(): SalonFilter {
  if (typeof window === 'undefined') return 'all';
  try {
    const raw = localStorage.getItem(SALON_FILTER_KEY);
    if (!raw) return 'all';
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 1 && parsed[0] === 'all') return 'all';
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed.length === 0 ? 'all' : (parsed as string[]);
    }
  } catch {
    // ignore
  }
  return 'all';
}

function persistSalonFilter(filter: SalonFilter) {
  if (typeof window === 'undefined') return;
  const value = filter === 'all' ? ['all'] : filter;
  localStorage.setItem(SALON_FILTER_KEY, JSON.stringify(value));
  api.setSalonFilter(filter);
} 

interface AuthContextType {
  user: User | null;
  salons: Salon[];
  activeTenantId: string | null;
  salonFilter: SalonFilter;
  setSalonFilter: (filter: SalonFilter) => void;
  /** Increments each time the salon filter is changed by the user (not on hydration). */
  salonFilterVersion: number;
  effectiveSalonIds: string[];
  isSalonFilterMulti: boolean;
  subscription: SubscriptionInfo | null;
  salonLimit: number;
  subscriptionActive: boolean;
  switchSalon: (tenantId: string) => Promise<{ success: boolean; error?: string }>;
  createSalon: (data: {
    name: string;
    email: string;
    phone: string;
    address?: string;
    city: string;
    category: string;
    shortDescription: string;
    coverImage: File;
    latitude: number;
    longitude: number;
  }) => Promise<{ success: boolean; error?: string }>;
  updateSalon: (
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      category?: string;
      shortDescription?: string;
      coverImage?: File;
      latitude?: number;
      longitude?: number;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  deleteSalon: (id: string) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    tenantId?: string;
    createTenant?: boolean;
    tenantName?: string;
    tenantEmail?: string;
    tenantCity?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salons, setSalons] = useState<Salon[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [salonLimit, setSalonLimit] = useState(3);
  const [salonFilter, setSalonFilterState] = useState<SalonFilter>('all');
  // Bumped on every user-initiated filter change so the dashboard layout can
  // remount pages exactly when the filter changes (not during localStorage hydration).
  const [salonFilterVersion, setSalonFilterVersion] = useState(0);

  const setSalonFilter = useCallback((filter: SalonFilter) => {
    setSalonFilterState(filter);
    setSalonFilterVersion((v) => v + 1);
    persistSalonFilter(filter);
  }, []);

  // Apply multi-salon fields from login/me/switch-salon responses
  const applyAccountContext = (data: any) => {
    if (Array.isArray(data?.salons)) setSalons(data.salons);
    if (data?.activeTenantId !== undefined) setActiveTenantId(data.activeTenantId);
    else if (data?.user?.tenantId !== undefined) setActiveTenantId(data.user.tenantId);
    if (data?.subscription !== undefined) setSubscription(data.subscription);
    if (typeof data?.salonLimit === 'number') setSalonLimit(data.salonLimit);
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const savedFilter = loadSalonFilter();
        setSalonFilterState(savedFilter);
        api.setSalonFilter(savedFilter);

        if (token) {
          api.setToken(token);
          // Add timeout to prevent hanging if API is unreachable
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          );
          const userDataPromise = api.getCurrentUser();
          const userData = await Promise.race([userDataPromise, timeoutPromise]) as any;
          setUser(userData.user);
          applyAccountContext(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        // Token invalid or expired, or API unreachable
        console.warn('[AuthContext] Failed to initialize auth:', error);
        api.setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Drop stale salon ids from filter when salon list changes
  useEffect(() => {
    if (salons.length === 0) return;
    if (salonFilter === 'all') {
      api.setSalonFilter('all');
      return;
    }
    const valid = salonFilter.filter((id) => salons.some((s) => s.id === id));
    if (valid.length === 0) {
      setSalonFilter('all');
    } else if (valid.length !== salonFilter.length) {
      setSalonFilter(valid.length === salons.length ? 'all' : valid);
    } else {
      api.setSalonFilter(salonFilter);
    }
  }, [salons, salonFilter, setSalonFilter]);

  const effectiveSalonIds = useMemo(() => {
    if (salons.length === 0) return activeTenantId ? [activeTenantId] : [];
    if (salonFilter === 'all') return salons.map((s) => s.id);
    return salonFilter.filter((id) => salons.some((s) => s.id === id));
  }, [salons, salonFilter, activeTenantId]);

  const isSalonFilterMulti = effectiveSalonIds.length > 1;

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[AuthContext] Login attempt for:', email);
      const response = await api.login(email, password);
      console.log('[AuthContext] Login successful, response:', { hasToken: !!response.token, hasUser: !!response.user });
      console.log('[AuthContext] Checking localStorage after login:', localStorage.getItem('token') ? 'Token exists' : 'Token missing');
      setUser(response.user);
      applyAccountContext(response);
      setIsAuthenticated(true);
      // Default filter stays "all" for owners; staff get single salon list
      api.setSalonFilter(loadSalonFilter());
      // Double-check token is saved
      const tokenCheck = localStorage.getItem('token');
      if (!tokenCheck) {
        console.error('[AuthContext] WARNING: Token not in localStorage after login!');
        // Try to save it again
        if (response.token) {
          api.setToken(response.token);
        }
      }
      return { success: true };
    } catch (error: any) {
      // Use console.warn to avoid triggering Next.js error overlay
      console.warn('[AuthContext] Login failed:', error.message);

      // Translate common English backend error messages to French
      const msgMap: Record<string, string> = {
        'email or password is incorrect': 'Email ou mot de passe incorrect',
        'invalid email or password': 'Email ou mot de passe incorrect',
        'invalid email': 'Adresse email invalide',
        'invalid password': 'Mot de passe invalide',
        'invalid credentials': 'Identifiants invalides',
        'user not found': 'Aucun compte trouvé avec cet email',
        'account is disabled': 'Votre compte a été désactivé',
        'account is inactive': 'Votre compte a été désactivé',
        'email not verified': 'Veuillez vérifier votre email avant de vous connecter',
        'too many login attempts': 'Trop de tentatives de connexion. Veuillez réessayer plus tard',
      };

      const rawMessage = (error.message || '').toLowerCase().trim();
      const frenchMessage =
        msgMap[rawMessage] ||
        // Partial match fallback
        Object.entries(msgMap).find(([key]) => rawMessage.includes(key))?.[1] ||
        'Email ou mot de passe invalide';

      return {
        success: false,
        error: frenchMessage,
      };
    }
  };

  const register = async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    tenantId?: string;
    createTenant?: boolean;
    tenantName?: string;
    tenantEmail?: string;
    tenantCity?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.register(userData);
      setUser(response.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erreur lors de la création du compte'
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.logout();
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout error:', error);
    } finally {
      api.setToken(null);
      api.setSalonFilter('all');
      setUser(null);
      setIsAuthenticated(false);
      setSalons([]);
      setActiveTenantId(null);
      setSubscription(null);
      setSalonFilterState('all');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        // Keep activeSalonIds so preference survives re-login on same browser
      }
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const userData = await api.getCurrentUser();
      setUser(userData.user);
      applyAccountContext(userData);
    } catch (error) {
      // If refresh fails, user is no longer authenticated
      await logout();
    }
  };

  const switchSalon = async (tenantId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.switchSalon(tenantId);
      setUser(response.user);
      applyAccountContext(response);
      // Shortcut: also set global filter to that salon only
      setSalonFilter([tenantId]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Impossible de changer de salon' };
    }
  };

  const createSalon = async (data: {
    name: string;
    email: string;
    phone: string;
    address?: string;
    city: string;
    category: string;
    shortDescription: string;
    coverImage: File;
    latitude: number;
    longitude: number;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.createSalon(data);
      // Refresh the salon list from the backend
      const result = await api.getSalons();
      setSalons(result.salons);
      setSalonLimit(result.salonLimit);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Impossible de créer le salon' };
    }
  };

  const updateSalon = async (
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      category?: string;
      shortDescription?: string;
      coverImage?: File;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.updateSalon(id, data);
      const result = await api.getSalons();
      setSalons(result.salons);
      setSalonLimit(result.salonLimit);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Impossible de mettre à jour le salon' };
    }
  };

  const deleteSalon = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await api.deleteSalon(id);
      if (result.token) {
        api.setToken(result.token);
      }
      if (Array.isArray(result.salons)) {
        setSalons(result.salons);
      } else {
        const refreshed = await api.getSalons();
        setSalons(refreshed.salons);
        setSalonLimit(refreshed.salonLimit);
      }
      if (typeof result.salonLimit === 'number') setSalonLimit(result.salonLimit);
      if (result.subscription !== undefined) setSubscription(result.subscription);
      if (result.activeTenantId) setActiveTenantId(result.activeTenantId);
      // Filter effect drops deleted id; force all if that was sole focus
      if (salonFilter !== 'all' && salonFilter.includes(id)) {
        const remaining = salonFilter.filter((sid) => sid !== id);
        setSalonFilter(remaining.length === 0 ? 'all' : remaining);
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Impossible de supprimer le salon' };
    }
  };

  const subscriptionActive = subscription?.status === 'ACTIVE';

  return (
    <AuthContext.Provider value={{ 
      user, 
      salons,
      activeTenantId,
      salonFilter,
      setSalonFilter,
      salonFilterVersion,
      effectiveSalonIds,
      isSalonFilterMulti,
      subscription,
      salonLimit,
      subscriptionActive,
      switchSalon,
      createSalon,
      updateSalon,
      deleteSalon,
      login, 
      register,
      logout, 
      isAuthenticated, 
      loading,
      refreshUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
