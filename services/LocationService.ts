import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    logger.error('[LocationTask] Error:', error.message);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const { coords } = locations[0];
      try {
        const driverId = await AsyncStorage.getItem('@puntgo_driver_session');
        const isOnline = await AsyncStorage.getItem('driver_is_online');
        
        if (driverId && isOnline === 'true') {
          // Push location to Supabase
          const { error: dbError } = await supabase
            .from('drivers')
            .update({
              current_lat: coords.latitude,
              current_lng: coords.longitude,
            })
            .eq('id', driverId);

          if (dbError) {
            logger.warn('[LocationTask] Supabase update failed:', dbError.message);
          } else {
            logger.info(`[LocationTask] Synced location: ${coords.latitude}, ${coords.longitude}`);
          }
        }
      } catch (e) {
        logger.error('[LocationTask] Sync error:', e);
      }
    }
  }
});

export const startBackgroundLocation = async () => {
  try {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      logger.warn('Foreground location permission denied');
      return;
    }
    
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      logger.warn('Background location permission denied');
      return;
    }
    
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000, // Every 10 seconds
      distanceInterval: 20, // Or every 20 meters (conserves battery & Realtime volume)
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "PuntGo Driver",
        notificationBody: "Location tracking is active",
        notificationColor: "#10B981",
      },
    });
    logger.info('[LocationService] Background location tracking started');
  } catch (error) {
    logger.error('[LocationService] Error starting location:', error);
  }
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
