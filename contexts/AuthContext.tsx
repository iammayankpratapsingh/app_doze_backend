import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiUrl } from '@/services/api';
import { AppState } from 'react-native';

type AuthState = {
  isLoggedIn: boolean;
  isLoading: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    profile?: any; // server-provided profile blob
  };
};

type AuthContextType = {
  auth: AuthState;
  login: (token: string, user: any) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthState: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  saveLocalProfile: (profile: any) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    isLoggedIn: false,
    isLoading: true,
  });

  // Inactivity policy: 1 year (365 days)
  const INACTIVITY_LIMIT_MS = 365 * 24 * 60 * 60 * 1000;

  const saveLocalProfile = async (profile: any) => {
    try {
      await AsyncStorage.setItem('user_profile', JSON.stringify(profile));
      setAuth(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, profile } : prev.user,
      }));
    } catch (e) {
      console.warn('Failed to persist user_profile:', e);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = auth.token || (await AsyncStorage.getItem('auth_token')) || '';
      if (!token) return;
      const url = apiUrl('/api/users/me'); // Adjust if backend differs
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('Profile fetch failed:', res.status, json);
        return;
      }
      await saveLocalProfile(json);
    } catch (e) {
      console.warn('Profile fetch error:', e);
    }
  };

  const checkAuthState = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const userId = await AsyncStorage.getItem('user_id');
      const userEmail = await AsyncStorage.getItem('user_email');
      const userName = await AsyncStorage.getItem('user_name');
      const userProfileRaw = await AsyncStorage.getItem('user_profile');
      const userProfile = userProfileRaw ? JSON.parse(userProfileRaw) : undefined;
      const lastActiveRaw = await AsyncStorage.getItem('last_active_at');
      const lastActiveAt = lastActiveRaw ? Number(lastActiveRaw) : undefined;
      const now = Date.now();

      if (token && userId) {
        // If we have last_active_at and it exceeds inactivity window, force logout
        if (lastActiveAt && now - lastActiveAt > INACTIVITY_LIMIT_MS) {
          await logout();
          return;
        }

        // Within activity window; mark active now
        await AsyncStorage.setItem('last_active_at', String(now));

        setAuth({
          isLoggedIn: true,
          isLoading: false,
          token,
          user: {
            id: userId,
            email: userEmail || '',
            name: userName || '',
            profile: userProfile,
          },
        });
      } else {
        setAuth({
          isLoggedIn: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuth({
        isLoggedIn: false,
        isLoading: false,
      });
    }
  };

  const login = async (token: string, user: any) => {
    await AsyncStorage.multiSet([
      ['auth_token', token],
      ['user_id', String(user.id)],
      ['user_email', String(user.email)],
      ['user_name', String(user.name)],
      ['last_active_at', String(Date.now())],
    ]);

    setAuth({
      isLoggedIn: true,
      isLoading: false,
      token,
      user: {
        id: String(user.id),
        email: String(user.email),
        name: String(user.name),
      },
    });

    // Best-effort profile fetch after login
    fetchProfile();
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([
      'auth_token',
      'user_id',
      'user_email',
      'user_name',
      'remember_me',
      'user_profile',
      'last_active_at',
    ]);

    setAuth({
      isLoggedIn: false,
      isLoading: false,
    });
  };

  useEffect(() => {
    checkAuthState();
  }, []);

  // Update last_active_at when app comes to foreground while logged in
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        try {
          const token = await AsyncStorage.getItem('auth_token');
          const userId = await AsyncStorage.getItem('user_id');
          if (token && userId) {
            const lastActiveRaw = await AsyncStorage.getItem('last_active_at');
            const lastActiveAt = lastActiveRaw ? Number(lastActiveRaw) : undefined;
            const now = Date.now();
            if (lastActiveAt && now - lastActiveAt > INACTIVITY_LIMIT_MS) {
              await logout();
            } else {
              await AsyncStorage.setItem('last_active_at', String(now));
            }
          }
        } catch {}
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout, checkAuthState, fetchProfile, saveLocalProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}