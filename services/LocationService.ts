/**
 * LocationService.ts
 *
 * Background TaskManager task that writes driver general presence
 * (current_lat / current_lng) to the `drivers` table.
 *
 * ─── IMPORTANT DISTINCTION ───────────────────────────────────────────
 * This service is for GENERAL DRIVER PRESENCE — intended for a future
 * "nearby drivers" dispatch/matching feature (e.g. "show the closest
 * available driver" on an admin dashboard or auto-assignment logic).
 *
 * It is NOT the same as order-scoped live tracking. Order-specific GPS
 * updates (the ones the Customer App's OrderTracking screen reads) are
 * written by hooks/useLocationBroadcast.ts directly to:
 *   orders.driver_latitude
 *   orders.driver_longitude
 *   orders.driver_heading
 * ─────────────────────────────────────────────────────────────────────
 *
 * STATUS (2026-09-01):
 *   drivers.current_lat and drivers.current_lng are NOT read by
 *   anything in either the Driver App or the Customer App as of this
 *   date (confirmed by searching both repos). The background task is
 *   therefore DISABLED to avoid unnecessary battery drain.
 *
 *   To re-enable: uncomment the TaskManager.defineTask block and the
 *   Location.startLocationUpdatesAsync call inside startBackgroundLocation.
 *   This would be useful when implementing driver-to-order proximity
 *   matching or an admin dispatch map.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { logger } from '../utils/logger';

const LOCATION_TASK_NAME = 'background-location-task';

// ─── DISABLED: Background presence task (drivers.current_lat/lng) ─────────
// Reason: drivers.current_lat/current_lng is not read by any part of either
// app as of 2026-09-01. Re-enable when implementing dispatch/nearby-driver
// matching. Order-specific GPS tracking is handled by useLocationBroadcast.ts
// which writes to orders.driver_latitude/longitude/heading instead.
//
// TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
//   if (error) {
//     logger.error('[LocationTask] Error:', error.message);
//     return;
//   }
//   if (data) {
//     const { locations } = data as { locations: Location.LocationObject[] };
//     if (locations && locations.length > 0) {
//       const { coords } = locations[0];
//       try {
//         const AsyncStorage = require('@react-native-async-storage/async-storage').default;
//         const driverId = await AsyncStorage.getItem('@puntgo_driver_session');
//         const isOnline = await AsyncStorage.getItem('driver_is_online');
//
//         if (driverId && isOnline === 'true') {
//           const { createClient } = require('@supabase/supabase-js');
//           // NOTE: import supabase from '../lib/supabase' if re-enabling
//           const { error: dbError } = await supabase
//             .from('drivers')
//             .update({
//               current_lat: coords.latitude,
//               current_lng: coords.longitude,
//             })
//             .eq('id', driverId);
//
//           if (dbError) {
//             logger.warn('[LocationTask] Supabase update failed:', dbError.message);
//           } else {
//             logger.info(`[LocationTask] Synced presence: ${coords.latitude}, ${coords.longitude}`);
//           }
//         }
//       } catch (e) {
//         logger.error('[LocationTask] Sync error:', e);
//       }
//     }
//   }
// });
// ─── END DISABLED BLOCK ───────────────────────────────────────────────────

// TaskManager still requires a definition to exist for the task name if it
// was previously registered. Register a no-op so the OS doesn't get confused
// if an old build had this task running.
TaskManager.defineTask(LOCATION_TASK_NAME, async () => {
  // No-op placeholder — task is disabled, see comments above.
});

export const startBackgroundLocation = async () => {
  // Background presence task is disabled — see file-level comment.
  // Order-specific GPS updates are handled by useLocationBroadcast.ts.
  logger.info('[LocationService] startBackgroundLocation called (presence task disabled — no-op)');

  // ── DISABLED: uncomment below to re-enable driver presence tracking ──
  // try {
  //   const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  //   if (fgStatus !== 'granted') {
  //     logger.warn('[LocationService] Foreground location permission denied');
  //     return;
  //   }
  //
  //   const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  //   if (bgStatus !== 'granted') {
  //     logger.warn('[LocationService] Background location permission denied');
  //     return;
  //   }
  //
  //   await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
  //     accuracy: Location.Accuracy.High,
  //     timeInterval: 10000,
  //     distanceInterval: 20,
  //     showsBackgroundLocationIndicator: true,
  //     foregroundService: {
  //       notificationTitle: 'PuntGo Driver',
  //       notificationBody: 'Location tracking is active',
  //       notificationColor: '#10B981',
  //     },
  //   });
  //   logger.info('[LocationService] Background location tracking started');
  // } catch (error) {
  //   logger.error('[LocationService] Error starting location:', error);
  // }
};

export const stopBackgroundLocation = async () => {
  try {
    const hasTask = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (hasTask) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      logger.info('[LocationService] Background location tracking stopped');
    }
  } catch (error) {
    logger.error('[LocationService] Error stopping location:', error);
  }
};
