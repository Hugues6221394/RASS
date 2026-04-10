import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { LoginRequest, LoginResponse, Role } from '../types';

type AuthState = {
  token: string | null;
  user: { id: string; fullName: string; roles: Role[] } | null;
  isAuthenticated: boolean;
  login: (request: LoginRequest) => Promise<LoginResponse>;
  logout: () => void;
  hasRole: (roles: Role | Role[]) => boolean;
  setToken: (token: string | null) => void;
  setUser: (user: { id: string; fullName: string; roles: Role[] } | null) => void;
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
  setToken: () => { },
  setUser: () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('rass_token'));
  const [user, setUser] = useState<AuthState['user']>(() => {
    try {
      const raw = localStorage.getItem('rass_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem('rass_user');
      return null;
    }
  });

  useEffect(() => {
    if (!token) {
      setUser(null);
    }
  }, [token]);

  const login = async (request: LoginRequest) => {
    const response = await api.post<LoginResponse>('/api/auth/login', {
      identifier: request.identifier,
      password: request.password,
      otp: request.otp,
    });
    const payload = response.data;
    if (payload.requiresTwoFactor) return payload;
    setToken(payload.token);
    setUser({ id: payload.id, fullName: payload.fullName, roles: payload.roles });
    localStorage.setItem('rass_token', payload.token);
    localStorage.setItem('rass_user', JSON.stringify({ id: payload.id, fullName: payload.fullName, roles: payload.roles }));
    return payload;
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

  return (
    <AuthContext.Provider value={{
      token,
      user,
      isAuthenticated: !!token,
      login,
      logout,
      hasRole,
      setToken,
      setUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

