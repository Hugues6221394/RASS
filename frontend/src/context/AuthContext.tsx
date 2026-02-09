import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { LoginRequest, LoginResponse, Role } from '../types';

type AuthState = {
  token: string | null;
  user: { fullName: string; roles: Role[] } | null;
  isAuthenticated: boolean;
  login: (request: LoginRequest) => Promise<void>;
  logout: () => void;
  hasRole: (roles: Role | Role[]) => boolean;
};

const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  isAuthenticated: false,
  login: async () => {
    throw new Error('AuthProvider missing');
  },
  logout: () => {
    throw new Error('AuthProvider missing');
  },
  hasRole: () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('rass_token'));
  const [user, setUser] = useState<AuthState['user']>(() => {
    const raw = localStorage.getItem('rass_user');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (!token) {
      setUser(null);
    }
  }, [token]);

  const login = async (request: LoginRequest) => {
    const response = await api.post<LoginResponse>('/api/auth/login', request);
    const payload = response.data;
    setToken(payload.token);
    setUser({ fullName: payload.fullName, roles: payload.roles });
    localStorage.setItem('rass_token', payload.token);
    localStorage.setItem('rass_user', JSON.stringify({ fullName: payload.fullName, roles: payload.roles }));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('rass_token');
    localStorage.removeItem('rass_user');
  };

  const hasRole = (roles: Role | Role[]) => {
    if (!user) return false;
    const requested = Array.isArray(roles) ? roles : [roles];
    return requested.some((r) => user.roles.includes(r));
  };

  return <AuthContext.Provider value={{ token, user, isAuthenticated: !!token, login, logout, hasRole }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

