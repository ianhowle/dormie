/**
 * Offline resilience layer.
 * Caches screen data for offline access.
 * Queues actions for sync when back online.
 */

import { Platform } from 'react-native';
import { useState, useEffect } from 'react';

// ─── NetInfo: optional dependency ───────────────────────────────────
let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  console.warn(
    '[offline] @react-native-community/netinfo is not installed. ' +
      'Network detection will assume online. Run: npx expo install @react-native-community/netinfo',
  );
}

let AsyncStorage: any = null;
try {
  // Try expo async storage first
  AsyncStorage = require('@react-native-async-storage/async-storage')?.default;
} catch {
  try {
    // Fallback to expo-secure-store for small data
    AsyncStorage = null;
  } catch {
    // No storage available
  }
}

const CACHE_PREFIX = '@dormie_cache:';
const PENDING_PREFIX = '@dormie_pending:';

// ─── Simple key-value cache using JSON in memory fallback ───────────
const memoryCache: Record<string, string> = {};

async function getItem(key: string): Promise<string | null> {
  if (AsyncStorage) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return memoryCache[key] ?? null;
    }
  }
  return memoryCache[key] ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  memoryCache[key] = value;
  if (AsyncStorage) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Memory cache only
    }
  }
}

// ─── Screen data cache ──────────────────────────────────────────────
export type CacheKey =
  | 'home_feed'
  | 'leaderboard'
  | 'profile_stats'
  | 'trips'
  | 'seasons'
  | 'friends';

export async function cacheScreenData<T>(key: CacheKey, data: T): Promise<void> {
  const payload = JSON.stringify({
    data,
    timestamp: Date.now(),
  });
  await setItem(`${CACHE_PREFIX}${key}`, payload);
}

export async function getCachedScreenData<T>(key: CacheKey): Promise<{ data: T; timestamp: number } | null> {
  const raw = await getItem(`${CACHE_PREFIX}${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Check if cached data is stale (> maxAge ms, default 1 hour) */
export function isStale(timestamp: number, maxAge: number = 60 * 60 * 1000): boolean {
  return Date.now() - timestamp > maxAge;
}

// ─── Offline action queue ───────────────────────────────────────────
type PendingAction = {
  id: string;
  type: 'save_round' | 'send_message' | 'create_trip';
  payload: any;
  createdAt: number;
};

export async function queueOfflineAction(action: Omit<PendingAction, 'id' | 'createdAt'>): Promise<void> {
  const pending = await getPendingActions();
  pending.push({
    ...action,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  });
  await setItem(PENDING_PREFIX + 'actions', JSON.stringify(pending));
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const raw = await getItem(PENDING_PREFIX + 'actions');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function clearPendingAction(id: string): Promise<void> {
  const pending = await getPendingActions();
  const filtered = pending.filter((a) => a.id !== id);
  await setItem(PENDING_PREFIX + 'actions', JSON.stringify(filtered));
}

export async function clearAllPending(): Promise<void> {
  await setItem(PENDING_PREFIX + 'actions', '[]');
}

// ─── Network status helper ──────────────────────────────────────────
/**
 * Returns live network state.
 * When NetInfo is available, subscribes to connection changes and
 * automatically triggers syncOfflineQueue() on reconnect.
 * Falls back to "always online" if NetInfo is not installed.
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean>(true);

  useEffect(() => {
    if (!NetInfo) {
      // NetInfo not installed — optimistically assume online
      return;
    }

    let previouslyOffline = false;

    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const connected = state.isConnected ?? true;
      const reachable = state.isInternetReachable ?? true;

      setIsConnected(connected);
      setIsInternetReachable(reachable);

      const nowOnline = connected && reachable;

      if (previouslyOffline && nowOnline) {
        // Transitioned from offline → online: flush queued actions
        syncOfflineQueue().catch(() => {
          // Sync errors are handled inside syncOfflineQueue
        });
      }

      previouslyOffline = !nowOnline;
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isConnected, isInternetReachable };
}

/**
 * Attempt to replay all pending offline actions.
 * Callers (services) should listen for this and re-submit each action.
 * Clears successfully replayed items from the queue.
 */
export async function syncOfflineQueue(): Promise<void> {
  const pending = await getPendingActions();
  if (pending.length === 0) return;

  for (const action of pending) {
    try {
      // Emit a custom event that service layers can listen for.
      // The actual re-submission is delegated to registered handlers
      // (see registerSyncHandler) rather than being hard-coded here.
      const handler = syncHandlers[action.type];
      if (handler) {
        await handler(action.payload);
        await clearPendingAction(action.id);
      }
    } catch {
      // Leave failed actions in queue to retry on next reconnect
    }
  }
}

type ActionType = 'save_round' | 'send_message' | 'create_trip';
const syncHandlers: Partial<Record<ActionType, (payload: any) => Promise<void>>> = {};

/** Register a handler to process a queued action type on reconnect. */
export function registerSyncHandler(
  type: ActionType,
  handler: (payload: any) => Promise<void>,
): void {
  syncHandlers[type] = handler;
}
