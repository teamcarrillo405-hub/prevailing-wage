import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
}

export type LoginResult =
  | { status: 'ok'; user: User }
  | { status: 'mfa_required'; userId: string };

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeMfaLogin: (userId: string, token: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, restore session from cookie
  useEffect(() => {
    api
      .get<{ data: { user: User } }>('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<LoginResult> {
    type LoginResponse = {
      data: { user?: User; requiresMfa?: boolean; userId?: string };
    };
    const res = await api.post<LoginResponse>('/auth/login', { email, password });
    if (res.data.requiresMfa && res.data.userId) {
      // Don't set user yet — second factor required.
      return { status: 'mfa_required', userId: res.data.userId };
    }
    if (res.data.user) {
      setUser(res.data.user);
      return { status: 'ok', user: res.data.user };
    }
    throw new Error('Unexpected login response');
  }

  async function completeMfaLogin(userId: string, token: string): Promise<User> {
    const res = await api.post<{ data: { user: User } }>('/auth/mfa-login', {
      userId,
      token,
    });
    setUser(res.data.user);
    return res.data.user;
  }

  async function logout() {
    await api.post('/auth/logout', {});
    setUser(null);
  }

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    completeMfaLogin,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
