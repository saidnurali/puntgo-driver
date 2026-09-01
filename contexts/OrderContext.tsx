import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { Platform, AppState, AppStateStatus, Alert } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { startAlarm, stopAlarm } from '../lib/audioEngine';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { startBackgroundLocation, stopBackgroundLocation } from '../services/LocationService';
import { OfflineQueue } from '../services/OfflineQueue';
import { useLocationBroadcast } from '../hooks/useLocationBroadcast';

export type DriverStatus = 'online' | 'offline';
export type OrderStatus = 'Pending' | 'Preparing' | 'Out for Delivery' | 'Delivered';

export interface Order {
  id: string;
  restaurant_name?: string;
  restaurant?: string;
  delivery_address?: string;
  address?: string;
  items: any[];
  total_price: number;
  status: OrderStatus;
  created_at: string;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  customer_name?: string;
  customer_phone?: string;
  payment_method?: string;
  delivery_fee?: number;
}

export interface DriverProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  status: DriverStatus;
  rating: number;
  total_rides: number;
  total_earnings: number;
  vehicle_model?: string;
  vehicle_plate?: string;
  profile_photo?: string;
}

interface OrderContextType {
  driverStatus: DriverStatus;
  setDriverStatus: (status: DriverStatus) => Promise<void>;
  driverProfile: DriverProfile | null;
  currentOrder: Order | null;
  pendingOrder: Order | null;
  activeOrders: Order[];
  todayEarnings: number;
  todayDeliveries: number;
  // Global modal state — driven by realtime INSERT
  incomingOrder: Order | null;
  showGlobalModal: boolean;
  setShowGlobalModal: (show: boolean) => void;
  // Realtime connection health
  realtimeConnected: boolean;
  // Actions
  acceptOrder: (orderId: string) => Promise<void>;
  declineOrder: (orderId: string) => Promise<void>;
  pickupOrder: (orderId: string) => Promise<{ error: string | null }>;
  completeOrder: (orderId: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  fetchActiveOrders: () => Promise<void>;
}

const OrderContext = createContext<OrderContextType>({
  driverStatus: 'offline',
  setDriverStatus: async () => {},
  driverProfile: null,
  currentOrder: null,
  pendingOrder: null,
  activeOrders: [],
  todayEarnings: 0,
  todayDeliveries: 0,
  incomingOrder: null,
  showGlobalModal: false,
  setShowGlobalModal: () => {},
  realtimeConnected: false,
  acceptOrder: async () => {},
  declineOrder: async () => {},
  pickupOrder: async () => ({ error: null }),
  completeOrder: async () => ({ error: null }),
  refreshProfile: async () => {},
  fetchActiveOrders: async () => {},
});

export function OrderProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [driverStatus, setDriverStatusState] = useState<DriverStatus>('offline');
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);

  // UI States
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayDeliveries, setTodayDeliveries] = useState(0);

  // Global modal state — set directly from Realtime INSERT payload
  const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
  const [showGlobalModal, setShowGlobalModal] = useState(false);

  // Realtime health indicator
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const subscriptionRef = useRef<any>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs to avoid stale closure issues in Realtime callbacks
  const driverStatusRef = useRef<DriverStatus>('offline');
  useEffect(() => { driverStatusRef.current = driverStatus; }, [driverStatus]);

  const driverProfileRef = useRef<DriverProfile | null>(null);
  useEffect(() => { driverProfileRef.current = driverProfile; }, [driverProfile]);

  // Keep a ref to incomingOrder so acceptOrder always sees the latest value
  const incomingOrderRef = useRef<Order | null>(null);
  useEffect(() => { incomingOrderRef.current = incomingOrder; }, [incomingOrder]);

  // ─── fetchProfile ───────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        logger.error('[OrderContext] fetchProfile error:', error.message);
        return;
      }

      if (data) {
        setDriverProfile(data);
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const storedStatus = await AsyncStorage.getItem('driver_is_online');
          if (storedStatus !== null) {
            setDriverStatusState(storedStatus === 'true' ? 'online' : 'offline');
          } else {
            setDriverStatusState(data.status ?? 'offline');
          }
        } catch (e) {
          logger.warn('[OrderContext] AsyncStorage read error:', e);
          setDriverStatusState(data.status ?? 'offline');
        }
      }
    } catch (e) {
      logger.error('[OrderContext] fetchProfile unexpected error:', e);
    }
  }, [user]);

  // ─── registerForPushNotifications ────────────────────────────────
  const registerForPushNotifications = useCallback(async (driverId: string) => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('order-alerts', {
          name: 'Order Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#00875A',
          sound: 'default',
          enableVibrate: true,
          bypassDnd: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        logger.warn('[PushToken] Notification permission denied by user');
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId ??
        'c6ab582d-556c-4d1b-9811-bd2862535b3d';

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      const pushToken = tokenData.data;
      logger.info('[PushToken] Expo Push Token obtained');

      const { error } = await supabase
        .from('drivers')
        .update({ expo_push_token: pushToken, is_online: true })
        .eq('id', driverId);

      if (error) {
        logger.warn('[PushToken] Failed to save push token to DB:', error.message);
      } else {
        logger.info('[PushToken] Token saved to drivers table for driver:', driverId);
      }
      
      return pushToken;
    } catch (e) {
      logger.warn('[PushToken] Push notification registration skipped or failed:', e);
      return null;
    }
  }, []);

  // ─── fetchTodayStats ─────────────────────────────────────────────
  const fetchTodayStats = useCallback(async () => {
    const profile = driverProfileRef.current;
    if (!user || !profile) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Include both 'Delivered' and 'Delivered (Reviewed)' — the exact status
      // strings used by the Customer app (confirmed from DB in Step 0).
      const { data, error } = await supabase
        .from('orders')
        .select('total_price, status, delivery_fee, payment_method')
        .or(`driver_id.eq.${profile.id},driver_name.ilike.%${profile.full_name ?? ''}%,driver_phone.eq.${profile.phone ?? ''}`)
        .in('status', ['Delivered', 'Delivered (Reviewed)'])
        .gte('created_at', today.toISOString());

      if (error) {
        logger.warn('[OrderContext] fetchTodayStats error:', error.message);
        return;
      }

      if (data) {
        setTodayDeliveries(data.length);
        const fees = data.reduce((sum, order) => {
          // Driver earns the delivery fee (+ any tip if the column exists in future)
          const deliveryFee = Number(order.delivery_fee ?? 0.60);
          return sum + deliveryFee;
        }, 0);
        setTodayEarnings(fees);
      }
    } catch (e) {
      logger.error('[OrderContext] fetchTodayStats unexpected error:', e);
    }
  }, [user]);

  // ─── Deduplication Helper ──────────────────────────────────────────
  const upsertOrder = useCallback((incomingOrder: Order) => {
    setActiveOrders((prevOrders) => {
      const existingIndex = prevOrders.findIndex((o) => String(o.id) === String(incomingOrder.id));
      if (existingIndex > -1) {
        const updated = [...prevOrders];
        updated[existingIndex] = incomingOrder;
        return updated;
      }
      return [incomingOrder, ...prevOrders];
    });
  }, []);

  // Update pendingOrder and currentOrder safely whenever activeOrders changes
  useEffect(() => {
    const pending = activeOrders.find(o =>
      o.status?.toLowerCase() === 'pending' ||
      o.status?.toLowerCase() === 'accepted'
    );
    setPendingOrder(pending ?? null);

    const profile = driverProfileRef.current;
    if (profile) {
      const myActive = activeOrders.find(o =>
        (o.driver_id === profile.id || o.driver_name === profile.full_name) &&
        ['preparing', 'out for delivery'].includes(o.status?.toLowerCase() ?? '')
      );
      setCurrentOrder(myActive ?? null);
    }
  }, [activeOrders]);

  // ─── fetchActiveOrders ───────────────────────────────────────────
  const fetchActiveOrders = useCallback(async () => {
    const profile = driverProfileRef.current;
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`status.ilike.pending,driver_id.eq.${profile.id}`)
        .neq('status', 'Delivered')
        .neq('status', 'Completed')
        .neq('status', 'Cancelled')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('[OrderContext] fetchActiveOrders error:', error.message);
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      logger.debug('[OrderContext] Fetched active orders count:', rows.length);
      setActiveOrders(rows);
    } catch (e) {
      logger.error('[OrderContext] fetchActiveOrders unexpected error:', e);
    }
  }, []);

  // ─── Initial load ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchProfile().then(() => {
      fetchTodayStats();
      registerForPushNotifications(user.id);
    });
  }, [user]);

  // ─── Notification Response Listener ───────────────────────────────
  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.orderId || data?.id) {
        // If data contains full order object or we just set it manually
        logger.info('[Notification] Driver tapped notification, triggering modal');
        setIncomingOrder(data as unknown as Order);
        setShowGlobalModal(true);
      }
    });

    return () => {
      responseListener.remove();
    };
  }, []);

  // ─── Auto-reconnect + refresh when app comes to foreground ──────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && driverStatusRef.current === 'online') {
        logger.info('[AppState] App foregrounded - refreshing data & checking realtime');
        fetchActiveOrders().catch(() => {});
        fetchTodayStats().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // ─── Realtime channel setup with auto-reconnect ────────────────────
  const setupRealtimeChannel = useCallback(async () => {
    // Tear down any existing channel first
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    logger.info('[Realtime] Setting up driver-alerts channel...');

    // 1. Fetch any pending alerts currently in the queue
    try {
      const { data, error } = await supabase
        .from('order_alerts')
        .select('*')
        .eq('status', 'Pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        if (driverStatusRef.current === 'online') {
          logger.info('[Realtime] Found pending alert in queue:', data[0].id);
          setIncomingOrder(data[0] as Order);
          setShowGlobalModal(true);
          await startAlarm();
        }
      }
    } catch (err) {
      logger.warn('[Realtime] Failed to fetch pending alerts:', err);
    }

    // 2. Realtime listener for incoming orders
    subscriptionRef.current = supabase
      .channel('driver-realtime-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_alerts' },
        async (payload) => {
          logger.info('[Realtime] New Order Alert Received:', payload.new);
          const newOrderAlert = payload.new as Order;

          // Only pop the modal when driver is online
          if (driverStatusRef.current === 'online') {
            logger.info('[Realtime] Triggering global modal for order alert:', newOrderAlert.id);
            setIncomingOrder(newOrderAlert);
            setShowGlobalModal(true);
            await startAlarm();

            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: '🛵 New Order!',
                  body: `New order from ${newOrderAlert.restaurant_name ?? newOrderAlert.restaurant ?? 'Restaurant'}. Tap to accept!`,
                  sound: 'order_alert.wav',
                  data: (newOrderAlert as unknown as Record<string, unknown>),
                  badge: 1,
                  ...(Platform.OS === 'android' ? { channelId: 'order-alerts' } : {}),
                },
                trigger: null,
              });
              logger.info('[Realtime] Local heads-up notification scheduled for order alert:', newOrderAlert.id);
            } catch (notifErr) {
              logger.warn('[Realtime] Failed to schedule local notification:', notifErr);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        async (payload) => {
          logger.info('[Realtime] New Order Received directly in orders table:', payload.new);
          const newOrder = payload.new as Order;
          
          if (driverStatusRef.current === 'online' && newOrder.status?.toLowerCase() === 'pending') {
            logger.info('[Realtime] Triggering global modal for new order:', newOrder.id);
            setIncomingOrder(newOrder);
            setShowGlobalModal(true);
            await startAlarm();

            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: '🛵 New Order!',
                  body: `New order from ${newOrder.restaurant_name ?? newOrder.restaurant ?? 'Restaurant'}. Tap to accept!`,
                  sound: 'order_alert.wav',
                  data: (newOrder as unknown as Record<string, unknown>),
                  badge: 1,
                  ...(Platform.OS === 'android' ? { channelId: 'order-alerts' } : {}),
                },
                trigger: null,
              });
              logger.info('[Realtime] Local heads-up notification scheduled for order:', newOrder.id);
            } catch (notifErr) {
              logger.warn('[Realtime] Failed to schedule local notification:', notifErr);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        async (payload) => {
          logger.debug('[Realtime] Order UPDATE detected, status:', payload.new?.status);
          const updatedOrder = payload.new as Order;
          const status = updatedOrder.status?.toLowerCase();
          
          // Prevent adding another driver's assigned order into our local state
          const isMine = updatedOrder.driver_id === driverProfileRef.current?.id;
          
          if (status !== 'pending' && !isMine) {
            // Another driver took it, or it belongs to someone else
            setActiveOrders((prev) => prev.filter(o => String(o.id) !== String(updatedOrder.id)));
          } else if (['pending', 'preparing', 'out for delivery', 'accepted'].includes(status)) {
            upsertOrder(updatedOrder);
          } else {
            // Remove from active orders if completed/cancelled
            setActiveOrders((prev) => prev.filter(o => String(o.id) !== String(updatedOrder.id)));
          }

          // If the order currently showing in the modal was accepted by another driver (status changed from pending),
          // dismiss the modal automatically so two drivers don't see it simultaneously.
          if (
            incomingOrderRef.current &&
            String(incomingOrderRef.current.id) === String(updatedOrder.id) &&
            status !== 'pending'
          ) {
            logger.info(`[Realtime] Order ${updatedOrder.id} was taken/changed. Auto-dismissing modal.`);
            setShowGlobalModal(false);
            setIncomingOrder(null);
            stopAlarm();
          }
          
          await fetchTodayStats();
        }
      )
      .subscribe((status, err) => {
        logger.info('[Realtime] Channel status:', status);

        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
          logger.info('[Realtime] ✅ Connected and listening for orders');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeConnected(false);
          logger.warn('[Realtime] ⚠️ Channel error/timeout, scheduling reconnect in 4s...', err ?? '');
          // Clear any pending reconnect timer
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (driverStatusRef.current === 'online') {
              logger.info('[Realtime] 🔁 Attempting to reconnect...');
              setupRealtimeChannel();
            }
          }, 4000);
        } else if (status === 'CLOSED') {
          setRealtimeConnected(false);
        }
      });
  }, [fetchActiveOrders, fetchTodayStats]);

  // ─── Global Realtime Subscription ────────────────────────────────
  useEffect(() => {
    if (driverStatus !== 'online' || !driverProfile) {
      // Clean up subscription if driver goes offline
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
        setRealtimeConnected(false);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }

    // Initial fetch when going online
    fetchActiveOrders();
    setupRealtimeChannel();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
        setRealtimeConnected(false);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [driverStatus, driverProfile]);

  // ─── requestLocationPermissions ───────────────────────────────────
  // Must be called BEFORE going online — shows a human-readable Alert explaining
  // why background location is needed, then requests both permission tiers.
  // Returns true if both foreground + background are granted.
  const requestLocationPermissions = useCallback(async (): Promise<boolean> => {
    // Check if already granted (skip the Alert in that case)
    const { status: existingFg } = await Location.getForegroundPermissionsAsync();
    const { status: existingBg } = await Location.getBackgroundPermissionsAsync();
    if (existingFg === 'granted' && existingBg === 'granted') return true;

    // Show explanation first (per Step 3 spec — do not request silently)
    await new Promise<void>((resolve) =>
      Alert.alert(
        '📍 Location Access Required',
        'PuntEats Driver needs access to your location while you are on a delivery so customers can track their order in real time.\n\n' +
          'This includes background location, which stays active while you have an active order — even if the app is minimised.\n\n' +
          'Location tracking stops automatically when you go offline or complete a delivery.',
        [{ text: 'Continue', onPress: () => resolve() }],
        { cancelable: false }
      )
    );

    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      logger.warn('[LocationPermission] Foreground location permission denied');
      return false;
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      logger.warn('[LocationPermission] Background location permission denied');
      // Foreground is granted — GPS watcher will still work in foreground
      return false;
    }

    logger.info('[LocationPermission] Both foreground and background location permissions granted');
    return true;
  }, []);

  // ─── setDriverStatus ──────────────────────────────────────────────
  const setDriverStatus = async (status: DriverStatus) => {
    // Request location permissions before going online (with explanation)
    if (status === 'online') {
      await requestLocationPermissions();
    }

    setDriverStatusState(status);
    setDriverProfile((prev) => prev ? { ...prev, status } : null);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('driver_is_online', JSON.stringify(status === 'online'));

      if (user) {
        const { error } = await supabase
          .from('drivers')
          .update({ status, is_online: status === 'online' })
          .eq('id', user.id);

        if (error) {
          logger.error('[OrderContext] setDriverStatus DB sync error:', error.message);
        } else {
          // Toggle background location tracking (general driver presence via TaskManager)
          if (status === 'online') {
            await startBackgroundLocation();
          } else {
            await stopBackgroundLocation();
          }
        }
      }
    } catch (e) {
      logger.error('[OrderContext] setDriverStatus error:', e);
    }
  };

  // ─── acceptOrder ─────────────────────────────────────────────────
  const acceptOrder = async (orderId: string) => {
    if (!driverProfile) return;

    await stopAlarm();
    setShowGlobalModal(false);
    setIncomingOrder(null);

    const profile = driverProfileRef.current;
    const currentIncoming = incomingOrderRef.current;

    // Optimistic local state update
    if (currentIncoming && String(currentIncoming.id) === String(orderId)) {
      const accepted: Order = {
        ...currentIncoming,
        status: 'Preparing',
        driver_name: profile?.full_name ?? '',
        driver_phone: profile?.phone ?? '',
      };
      setCurrentOrder(accepted);
      setPendingOrder(null);
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .update({
          status: 'Preparing',
          driver_id: profile?.id ?? '', // Lock it with ID
          driver_name: profile?.full_name ?? '',
          driver_phone: profile?.phone ?? '',
        })
        .eq('id', orderId)
        .eq('status', 'Pending') // Strict lock: ensure no one else took it
        .select();

      if (error || !data || data.length === 0) {
        logger.warn('[acceptOrder] Failed to acquire lock (race condition).');
        Alert.alert('Too late!', 'Another driver has already accepted this order.');
        
        // Revert optimistic update
        setCurrentOrder(null);
        await fetchActiveOrders();
        return; // Don't navigate
      }
    } catch (e) {
      logger.error('[acceptOrder] Unexpected error:', e);
    }

    try {
      router.push({
        pathname: '/(tabs)/active-order',
        params: { orderId: String(orderId) },
      });
    } catch (navErr) {
      logger.warn('[acceptOrder] Navigation error:', navErr);
    }
  };

  // ─── declineOrder ────────────────────────────────────────────────
  const declineOrder = async (orderId: string) => {
    await stopAlarm();
    setShowGlobalModal(false);
    setIncomingOrder(null);
    setPendingOrder(null);
  };

  // ─── pickupOrder ─────────────────────────────────────────────────
  const pickupOrder = async (orderId: string): Promise<{ error: string | null }> => {
    if (!user || !driverProfile) return { error: 'Driver not authenticated' };

    // Optimistic update
    setCurrentOrder((prev) =>
      prev && String(prev.id) === String(orderId)
        ? { ...prev, status: 'Out for Delivery' }
        : prev
    );

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'Out for Delivery' })
        .eq('id', orderId);

      if (error) {
        logger.error('[pickupOrder] Supabase error:', error.message);
        if (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network')) {
          await OfflineQueue.push({
            orderId,
            action: 'UPDATE_STATUS',
            payload: { status: 'Out for Delivery' }
          });
          return { error: null }; // Consider it a success locally
        }
        // Revert optimistic update on failure
        await fetchActiveOrders();
        return { error: error.message };
      }
      return { error: null };
    } catch (e: any) {
      logger.error('[pickupOrder] Unexpected error:', e);
      await fetchActiveOrders();
      return { error: e?.message ?? 'Unknown error' };
    }
  };

  // ─── completeOrder ────────────────────────────────────────────────
  const completeOrder = async (orderId: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'Delivered' })
        .eq('id', orderId);

      if (error) {
        logger.error('[completeOrder] Supabase error:', error.message);
        if (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('network')) {
          await OfflineQueue.push({
            orderId,
            action: 'COMPLETE_ORDER',
            payload: { status: 'Delivered' }
          });
          setCurrentOrder(null);
          return { error: null };
        }
        return { error: error.message };
      }

      setCurrentOrder(null);
      await fetchProfile();
      await fetchTodayStats();
      return { error: null };
    } catch (e: any) {
      logger.error('[completeOrder] Unexpected error:', e);
      return { error: e?.message ?? 'Unknown error' };
    }
  };

  // ─── refreshProfile ───────────────────────────────────────────────
  const refreshProfile = async () => {
    await fetchProfile();
    await fetchTodayStats();
    if (driverStatus === 'online') {
      await fetchActiveOrders();
    }
  };

  // ─── GPS Location Broadcasting ────────────────────────────────────
  // Watches driver position while online with an active order and writes
  // lat/lng/heading to orders.driver_latitude/longitude/heading — the exact
  // columns the Customer App's OrderTracking screen subscribes to via
  // postgres_changes on the orders table, enabling end-to-end live tracking.
  // The hook automatically stops when driverStatus goes offline or
  // currentOrder becomes null (delivery completed / no active order).
  useLocationBroadcast({
    driverStatus,
    currentOrderId: currentOrder?.id ?? null,
    userId: user?.id ?? null,
  });

  return (
    <OrderContext.Provider
      value={{
        driverStatus,
        setDriverStatus,
        driverProfile,
        currentOrder,
        pendingOrder,
        activeOrders,
        todayEarnings,
        todayDeliveries,
        incomingOrder,
        showGlobalModal,
        setShowGlobalModal,
        realtimeConnected,
        acceptOrder,
        declineOrder,
        pickupOrder,
        completeOrder,
        refreshProfile,
        fetchActiveOrders,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export const useOrder = () => useContext(OrderContext);
