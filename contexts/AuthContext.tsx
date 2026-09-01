import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

// Custom User object representing a driver
export interface CustomUser {
  id: string;
  phone: string;
  full_name: string;
}

interface AuthContextType {
  session: boolean;
  user: CustomUser | null;
  loading: boolean;
  signIn: (phone: string, pin: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: false,
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

const SESSION_KEY = '@puntgo_driver_session';

// ─── Sync push token on login / session restore ───────────────────────────────
async function syncPushToken(driverId: string) {
  try {
    if (Platform.OS === 'web') return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        logger.warn('[AuthContext] Notification permission not granted');
        return;
      }
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'c6ab582d-556c-4d1b-9811-bd2862535b3d',
    });
    const pushToken = tokenData?.data;
    if (!pushToken) {
      logger.warn('[AuthContext] Empty push token returned');
      return;
    }

    logger.info('[AuthContext] Push token synced on login/restore');

    const { error } = await supabase
      .from('drivers')
      .update({ expo_push_token: pushToken, is_online: true })
      .eq('id', driverId);

    if (error) {
      logger.warn('[AuthContext] Failed to sync push token to DB:', error.message);
    }
  } catch (e) {
    logger.warn('[AuthContext] syncPushToken error:', e);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedId = await AsyncStorage.getItem(SESSION_KEY);
        if (storedId) {
          const { data, error } = await supabase
            .from('drivers')
            .select('id, phone, full_name')
            .eq('id', storedId)
            .single();

          if (error) {
            logger.warn('[AuthContext] Session restore DB error:', error.message);
            await AsyncStorage.removeItem(SESSION_KEY);
          } else if (data) {
            setUser({
              id: data.id,
              phone: data.phone ?? '',
              full_name: data.full_name ?? '',
            });
            // Re-sync push token every time app starts with saved session
            syncPushToken(data.id);
          } else {
            await AsyncStorage.removeItem(SESSION_KEY);
          }
        }
      } catch (err) {
        logger.error('[AuthContext] Error loading session:', err);
        // Don't remove stored session on unexpected errors — avoid locking user out
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  const signIn = async (phone: string, pin: string): Promise<{ error: Error | null }> => {
    try {
      const { data: driver, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('phone', phone.trim())
        .eq('pin_code', pin.trim())
        .single();

      if (error || !driver) {
        logger.warn('[AuthContext] Login failed — invalid credentials for phone:', phone.trim());
        return { error: new Error('Invalid credentials. Please contact Admin.') };
      }

      await AsyncStorage.setItem(SESSION_KEY, driver.id);
      setUser({
        id: driver.id,
        phone: driver.phone ?? '',
        full_name: driver.full_name ?? '',
      });
      syncPushToken(driver.id);

      logger.info('[AuthContext] Driver signed in:', driver.id);
      return { error: null };
    } catch (err: any) {
      logger.error('[AuthContext] signIn unexpected error:', err);
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (e) {
      logger.warn('[AuthContext] signOut AsyncStorage error:', e);
    }
    setUser(null);
    logger.info('[AuthContext] Driver signed out');
  };

  return (
    <AuthContext.Provider value={{ session: !!user, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
