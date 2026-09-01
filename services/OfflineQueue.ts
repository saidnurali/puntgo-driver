import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export interface QueuedAction {
  id: string;
  orderId: string;
  action: 'UPDATE_STATUS' | 'COMPLETE_ORDER';
  payload: Record<string, any>;
  timestamp: number;
}

const QUEUE_KEY = '@offline_action_queue';

export class OfflineQueue {
  static async push(action: Omit<QueuedAction, 'id' | 'timestamp'>) {
    try {
      const queue = await this.getQueue();
      const newAction: QueuedAction = {
        ...action,
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
      };
      
      queue.push(newAction);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      logger.info(`[OfflineQueue] Added action to queue: ${action.action} for order ${action.orderId}`);
    } catch (e) {
      logger.error('[OfflineQueue] Error pushing to queue:', e);
    }
  }

  static async getQueue(): Promise<QueuedAction[]> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      logger.error('[OfflineQueue] Error reading queue:', e);
      return [];
    }
  }

  static async sync() {
    const queue = await this.getQueue();
    if (queue.length === 0) return;

    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      logger.debug('[OfflineQueue] Network still offline, skipping sync.');
      return;
    }

    logger.info(`[OfflineQueue] Syncing ${queue.length} offline actions...`);
    const failedQueue: QueuedAction[] = [];

    for (const action of queue) {
      try {
        let error = null;
        if (action.action === 'UPDATE_STATUS' || action.action === 'COMPLETE_ORDER') {
          const { error: dbError } = await supabase
            .from('orders')
            .update(action.payload)
            .eq('id', action.orderId);
          error = dbError;
        }

        if (error) {
          logger.warn(`[OfflineQueue] Failed to sync action ${action.id}:`, error.message);
          failedQueue.push(action);
        } else {
          logger.info(`[OfflineQueue] Successfully synced action ${action.id}`);
        }
      } catch (e) {
        logger.error(`[OfflineQueue] Unexpected error syncing action ${action.id}:`, e);
        failedQueue.push(action);
      }
    }

    // Keep failed actions in the queue to retry later
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failedQueue));
  }
}

// Start a listener that attempts to sync whenever network state comes back online
NetInfo.addEventListener(state => {
  if (state.isConnected && state.isInternetReachable !== false) {
    OfflineQueue.sync();
  }
});
