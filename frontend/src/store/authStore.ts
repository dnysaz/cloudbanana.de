import { create } from 'zustand';
import type { User } from '../types';
import { api, setToken, getToken } from '../api';

interface AuthState {
  token: string | null;
  user: User | null;
  initialized: boolean;
  checkAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getToken(),
  user: null,
  initialized: false,

  checkAuth: async () => {
    const existingToken = getToken();
    if (!existingToken) {
      set({ token: null, user: null, initialized: true });
      return;
    }
    try {
      const me = await api.get<any>('/auth/me');
      set({ token: existingToken, user: me, initialized: true });
    } catch {
      // Don't overwrite if login() already set the user (race condition guard)
      if (!useAuthStore.getState().user) {
        setToken(null);
        set({ token: null, user: null, initialized: true });
      } else {
        set({ initialized: true });
      }
    }
  },

  login: async (username: string, password: string) => {
    const data = await api.post<{ access_token: string; token_type: string }>('/auth/login', { username, password });
    setToken(data.access_token);
    const me = await api.get<User>('/auth/me');
    set({ token: data.access_token, user: me });
  },

  register: async (username: string, email: string, password: string) => {
    await api.post('/auth/register', { username, email, password });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout endpoint might fail, but we still clear local state
    }
    setToken(null);
    set({ token: null, user: null, initialized: true });
  },
}));
