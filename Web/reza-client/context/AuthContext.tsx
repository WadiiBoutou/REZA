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
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load session after mount — avoids SSR/client localStorage mismatch
  React.useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      }
    } catch {
      localStorage.removeItem('user');
    }
  }, []);

  const login = useCallback(async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
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
        
        localStorage.setItem('user', JSON.stringify(userData));
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
      return { success: false, error: 'Email ou mot de passe incorrect.' };
    }
  }, [loading]);

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, loading }}>
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