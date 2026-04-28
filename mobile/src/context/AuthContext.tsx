import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, saveToken, clearToken } from '../lib/api';

interface User { id: string; email: string; name: string; role: string; }
interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, totp?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/auth/me').then(r => setUser(r.data)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string, totp?: string) {
    const body: Record<string, string> = { email, password };
    if (totp) body.totp = totp;
    const endpoint = totp ? '/api/auth/mfa-login' : '/api/auth/login';
    await api.post(endpoint, body);
    const { data } = await api.get<{ token: string }>('/api/auth/token');
    await saveToken(data.token);
    const me = await api.get('/api/auth/me');
    setUser(me.data);
  }

  async function logout() {
    await api.post('/api/auth/logout').catch(() => {});
    await clearToken();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
