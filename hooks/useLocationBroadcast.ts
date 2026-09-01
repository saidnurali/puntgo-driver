/**
 * useLocationBroadcast
 *
 * Starts a high-accuracy GPS watcher when a driver has an active order and
 * is online. Upserts driver_locations in Supabase on each significant move.
 *
 * Rules (per task spec):
 *  • Starts only when driverStatus === 'online' AND currentOrderId is not null.
 *  • Updates at most every 10 seconds AND only if the driver moved ≥ 20 meters
 *    (whichever is less frequent), conserving battery & Realtime message volume.
 *  • Stops (and removes the watcher) when either condition becomes false.
 *  • Does NOT silently request permissions — caller must have requested them
 *    before this hook will start (it checks the current permission status
 *    and returns early if not granted).
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

    // Already watching — nothing to do (the effect re-runs when currentOrderId changes,
    // so we stop the old one and start a new one automatically)
    if (watcherRef.current) {
      watcherRef.current.remove();
      watcherRef.current = null;
    }

    let cancelled = false;

    async function startWatcher() {
      // Check permissions before starting — do NOT request here;
      // permissions must be requested via the explicit permission flow
      // (requestLocationPermissions) before the driver goes online.
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
              `[LocationBroadcast] GPS update: lat=${latitude.toFixed(5)}, lng=${longitude.toFixed(5)}, heading=${heading ?? 'N/A'}`
            );

            const { error } = await supabase.from('driver_locations').upsert(
              {
                driver_id: userId,
                order_id: currentOrderId,
                latitude,
                longitude,
                heading: heading ?? null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'driver_id' }
            );

            if (error) {
              logger.warn('[LocationBroadcast] Upsert to driver_locations failed:', error.message);
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
