/**
 * Network status tracking using @react-native-community/netinfo.
 * Provides a React hook and imperative API for online/offline detection.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  // NetInfo not installed — will assume online
}

type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean;
};

// Global listeners for connectivity changes
type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();
let lastKnownState: NetworkState = { isConnected: true, isInternetReachable: true };

// Start global listener once
let globalUnsubscribe: (() => void) | null = null;

function ensureGlobalListener() {
  if (globalUnsubscribe || !NetInfo) return;
  globalUnsubscribe = NetInfo.addEventListener((state: any) => {
    const connected = state.isConnected ?? true;
    const reachable = state.isInternetReachable ?? true;
    const wasOnline = lastKnownState.isConnected && lastKnownState.isInternetReachable;
    const nowOnline = connected && reachable;

    lastKnownState = { isConnected: connected, isInternetReachable: reachable };

    if (wasOnline !== nowOnline) {
      listeners.forEach((fn) => fn(nowOnline));
    }
  });
}

/** Subscribe to online/offline transitions. Returns unsubscribe function. */
export function onConnectivityChange(fn: Listener): () => void {
  ensureGlobalListener();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Check if currently online (best-effort, synchronous). */
export function isOnline(): boolean {
  return lastKnownState.isConnected && lastKnownState.isInternetReachable;
}

/**
 * React hook for network status.
 * Returns { isConnected, isInternetReachable } and updates on changes.
 */
export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>(lastKnownState);

  useEffect(() => {
    ensureGlobalListener();

    // Sync initial state
    if (NetInfo) {
      NetInfo.fetch().then((s: any) => {
        const connected = s.isConnected ?? true;
        const reachable = s.isInternetReachable ?? true;
        lastKnownState = { isConnected: connected, isInternetReachable: reachable };
        setState(lastKnownState);
      }).catch(() => {});
    }

    const unsub = onConnectivityChange(() => {
      setState({ ...lastKnownState });
    });

    return unsub;
  }, []);

  return state;
}
