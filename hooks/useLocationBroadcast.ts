/**
 * useLocationBroadcast
 *
 * Starts a high-accuracy GPS watcher when a driver has an active order and
 * is online. Writes live position to orders.driver_latitude/longitude/heading —
 * the exact columns the Customer App (PuntEats) reads in its OrderTracking
 * screen via a postgres_changes UPDATE subscription on the `orders` table.
 *
 * WHY orders, not driver_locations:
 *   The customer app's OrderTracking.tsx selects driver_latitude/longitude/heading
 *   directly from the orders row and updates the map marker via a realtime UPDATE
 *   subscription on that same row. Writing to a separate driver_locations table
 *   (which the customer app never reads) would mean live tracking silently fails
 *   end-to-end despite both sides individually functioning.
 *
 * Rules:
 *  • Starts only when driverStatus === 'online' AND currentOrderId is not null.
 *  • Updates at most every 10 seconds AND only if the driver moved ≥ 20 meters
 *    (whichever is less frequent), conserving battery & Realtime message volume.
 *  • Stops (and removes the watcher) when either condition becomes false.
 *  • Does NOT silently request permissions — caller must have already requested
 *    them via requestLocationPermissions() before going online.
 *
 * Exact query sent on each GPS update:
 *   supabase.from('orders')
 *     .update({ driver_latitude: lat, driver_longitude: lng, driver_heading: heading })
 *     .eq('id', currentOrderId)
 *     .eq('driver_id', userId)
 *
 * The .eq('driver_id', userId) guard ensures a driver can only write location
 * to an order actually assigned to them — matching the RLS pattern used
 * in the rest of this app and enforced server-side by the orders RLS policy.
 */

import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { DriverStatus } from '../contexts/OrderContext';

interface UseLocationBroadcastOptions {
  driverStatus: DriverStatus;
  currentOrderId: string | null;
  userId: string | null;
}

export function useLocationBroadcast({
  driverStatus,
  currentOrderId,
  userId,
}: UseLocationBroadcastOptions) {
  // Keep the watcher subscription in a ref so we can call .remove() later.
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    // Only broadcast when online AND actively working an order
    const shouldBroadcast = driverStatus === 'online' && !!currentOrderId && !!userId;

    if (!shouldBroadcast) {
      // Stop any running watcher
      if (watcherRef.current) {
        logger.info('[LocationBroadcast] Stopping GPS watcher (no active order or went offline)');
        watcherRef.current.remove();
        watcherRef.current = null;
      }
      return;
    }

    // Re-run when currentOrderId changes — tear down the old watcher first
    if (watcherRef.current) {
      watcherRef.current.remove();
      watcherRef.current = null;
    }

    let cancelled = false;

    async function startWatcher() {
      // Check permissions before starting — do NOT request here;
      // permissions must be requested via requestLocationPermissions() before
      // the driver goes online (see OrderContext.tsx).
      const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        logger.warn('[LocationBroadcast] Foreground location permission not granted — skipping GPS watcher');
        return;
      }

      logger.info(`[LocationBroadcast] Starting GPS watcher for order ${currentOrderId}`);

      try {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            // Update every 10 s AND only if moved ≥ 20 m (whichever is less frequent)
            timeInterval: 10_000,
            distanceInterval: 20,
          },
          async (location) => {
            if (cancelled) return;
            const { latitude, longitude, heading } = location.coords;

            logger.debug(
              `[LocationBroadcast] GPS update → orders row: lat=${latitude.toFixed(5)}, lng=${longitude.toFixed(5)}, heading=${heading ?? 'N/A'}`
            );

            // Write to orders.driver_latitude/longitude/heading — the columns the
            // Customer App's OrderTracking screen subscribes to via postgres_changes.
            // .eq('driver_id', userId) prevents writing to an order not assigned to this driver.
            const { error } = await supabase
              .from('orders')
              .update({
                driver_latitude: latitude,
                driver_longitude: longitude,
                driver_heading: heading ?? null,
              })
              .eq('id', currentOrderId)
              .eq('driver_id', userId);

            if (error) {
              logger.warn('[LocationBroadcast] Failed to update driver location on orders row:', error.message);
            }
          }
        );

        if (!cancelled) {
          watcherRef.current = subscription;
        } else {
          // Effect cleaned up before the watcher even started
          subscription.remove();
        }
      } catch (err) {
        logger.error('[LocationBroadcast] watchPositionAsync failed:', err);
      }
    }

    startWatcher();

    return () => {
      cancelled = true;
      if (watcherRef.current) {
        logger.info('[LocationBroadcast] Cleanup — removing GPS watcher');
        watcherRef.current.remove();
        watcherRef.current = null;
      }
    };
    // Re-run whenever the key inputs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverStatus, currentOrderId, userId]);
}
