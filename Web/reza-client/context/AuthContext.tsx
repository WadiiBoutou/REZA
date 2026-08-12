'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../lib/api';

interface User {
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  /** Sign the user in right after clicking the email confirmation link. */
  connectAfterVerification: (client: { email: string; firstName?: string | null; lastName?: string | null; phone?: string | null }) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load session after mount — avoids SSR/client localStorage mismatch.
  // Persistent sessions live in localStorage ("Rester connecté" checked),
  // short-lived ones in sessionStorage (cleared when the tab closes).
  React.useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      }
    } catch {
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
    }
  }, []);

  const login = useCallback(async (email: string, password?: string, rememberMe: boolean = true): Promise<{ success: boolean; error?: string }> => {
    // Prevent multiple simultaneous login attempts
    if (loading) {
      return { success: false, error: 'Une connexion est déjà en cours.' };
    }

    if (!password?.trim()) {
      return { success: false, error: 'Email ou mot de passe incorrect.' };
    }

    setLoading(true);
    try {
      const response = await api.clientLogin(email.trim(), password.trim());
      
      if (response.client) {
        const userData: User = {
          email: response.client.email || email.trim(),
          name: `${response.client.firstName || ''} ${response.client.lastName || ''}`.trim() || email.trim().split('@')[0],
          firstName: response.client.firstName,
          lastName: response.client.lastName,
          phone: response.client.phone
        };
        
        // "Rester connecté": persist across browser restarts (localStorage),
        // otherwise keep the session only for this tab (sessionStorage).
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('user', JSON.stringify(userData));
        if (rememberMe) {
          sessionStorage.removeItem('user');
        } else {
          localStorage.removeItem('user');
        }
        setUser(userData);
        setIsAuthenticated(true);
        setLoading(false);
        return { success: true };
      } else {
        setLoading(false);
        return { success: false, error: 'Aucun compte trouvé avec cet email.' };
      }
    } catch (error: any) {
      setLoading(false);
      // Surface the backend message (e.g. "confirm your email — check your inbox"
      // for unverified accounts) instead of always showing the generic error.
      return { success: false, error: error.message || 'Email ou mot de passe incorrect.' };
    }
  }, [loading]);

  // Called by the /verify-email page after the confirmation link is clicked.
  // The link proves email ownership, so the user is signed in immediately.
  const connectAfterVerification = useCallback((client: { email: string; firstName?: string | null; lastName?: string | null; phone?: string | null }) => {
    const email = client.email || '';
    const userData: User = {
      email,
      name: `${client.firstName || ''} ${client.lastName || ''}`.trim() || email.split('@')[0] || 'Client',
      firstName: client.firstName || undefined,
      lastName: client.lastName || undefined,
      phone: client.phone || undefined,
    };
    localStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.removeItem('user');
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const logout = () => {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, loading, connectAfterVerification }}>
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