/**
 * Offline resilience layer.
 * Caches screen data for offline access.
 * Queues actions for sync when back online.
 */

import { Platform } from 'react-native';

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
export function useNetworkStatus() {
  // In production, use @react-native-community/netinfo
  // For now, provide a simple check
  return {
    isConnected: true, // Assume connected; override with netinfo later
    isInternetReachable: true,
  };
}
