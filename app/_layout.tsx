import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { AuthProvider } from '../contexts/AuthContext';
import { OrderProvider } from '../contexts/OrderContext';
import { Colors } from '../constants/theme';
import NewOrderModal from '../components/NewOrderModal';
import { setupAudioMode } from '../lib/audioEngine';
import { GlobalErrorProvider } from '../lib/GlobalErrorProvider';
import '../services/LocationService';
import * as Application from 'expo-application';
import { supabase } from '../lib/supabase';
import { useState } from 'react';
import ForceUpdateScreen from '../components/ForceUpdateScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';

// ═══════════════════════════════════════════════════════════════════════════════
// SENTRY INITIALIZATION — Disabled until a real DSN is configured.
// Replace the dsn value and re-enable when ready for production crash reporting.
// ═══════════════════════════════════════════════════════════════════════════════
// Sentry.init({
//   dsn: 'YOUR_REAL_SENTRY_DSN',
//   tracesSampleRate: 0.2,
// });

// ═══════════════════════════════════════════════════════════════════════════════
// FOREGROUND NOTIFICATION HANDLER
// Must be at module top-level — runs even when app is killed/background
// ═══════════════════════════════════════════════════════════════════════════════
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND / KILLED-APP TASK
// Must be defined at MODULE LEVEL (outside any component/function)
// so Expo can boot this task even when the app process is completely dead.
// ═══════════════════════════════════════════════════════════════════════════════

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('order-alerts', {
    name: 'Order Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10B981',
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'order_alarm.mp3',
  });
}

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-ORDER-TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }: any) => {
  try {
    if (error) {
      console.error('[BG Task] ❌ Background task error:', error);
      return;
    }

    if (data) {
      console.log('[BG Task] ⚡ Background order payload received:', JSON.stringify(data));

      // Fire a local MAX-priority notification immediately.
      // channelId MUST match the channel we create on startup (order_alerts).
      // Without channelId, Android ignores importance/sound settings entirely.
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🛵 New Order Arrived!',
          body: 'A new delivery order is waiting for you. Open app to accept.',
          sound: 'order_alarm.mp3',          // .wav bundled via expo-notifications plugin
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: (data as any),
          badge: 1,
          // channelId ties this to the MAX-importance Android channel
          ...(Platform.OS === 'android' ? { channelId: 'order-alerts' } : {}),
        },
        trigger: null, // fire immediately — no delay
      });

      console.log('[BG Task] ✅ Fallback local notification scheduled');
    }
  } catch (e) {
    // Never let this crash — a crash here kills the background worker entirely
    console.error('[BG Task] ❌ Unhandled error in background task:', e);
  }
});

// Register background task — safe to call multiple times (idempotent)
Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((e) => {
  // "already registered" is not a real error
  console.log('[BG Task] registerTaskAsync result (may already be registered):', e?.message ?? e);
});



// ═══════════════════════════════════════════════════════════════════════════════
// ROOT LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════
function RootLayout() {
  const [isOutdated, setIsOutdated] = useState(false);

  useEffect(() => {
    // ════════════════════════════════════════════════════════════════════════════
    // PHASE 4: APP VERSION ENFORCEMENT
    // ════════════════════════════════════════════════════════════════════════════
    const checkAppVersion = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('minimum_driver_app_version')
          .single();

        if (!error && data?.minimum_driver_app_version) {
          const minVersion = data.minimum_driver_app_version;
          const currentVersion = Application.nativeApplicationVersion || '1.0.0';
          // Simple string comparison for versions (e.g. "1.0.1" > "1.0.0")
          if (currentVersion.localeCompare(minVersion, undefined, { numeric: true, sensitivity: 'base' }) < 0) {
            setIsOutdated(true);
          }
        }
      } catch (e) {
        console.warn('[VersionCheck] Error checking version:', e);
      }
    };
    checkAppVersion();

    // 1. Configure audio session — overrides iOS silent/mute switch
    setupAudioMode().catch((e) =>
      console.warn('[Layout] setupAudioMode error:', e)
    );

    // 2. Note: Android notification channel is now created in OrderContext.tsx


    // 4. Listen for notifications received WHILE app is foregrounded
    const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      console.log('[Notification] 📥 Foreground notification received:', title, '|', body);
    });

    return () => {
      foregroundSubscription.remove();
    };
  }, []);

  if (isOutdated) {
    return (
      <SafeAreaProvider>
        <ForceUpdateScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary
      fallbackTitle="App Error"
      fallbackMessage="Something went wrong. Please tap Try Again to reload the app."
    >
      <SafeAreaProvider>
        <GlobalErrorProvider>
          <AuthProvider>
            <OrderProvider>
              <StatusBar style="light" backgroundColor={Colors.background} />
              <Stack screenOptions={{ headerShown: false }} />
              <NewOrderModal />
            </OrderProvider>
          </AuthProvider>
        </GlobalErrorProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default RootLayout;
