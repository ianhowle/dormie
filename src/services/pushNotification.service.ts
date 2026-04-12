import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export type NotificationPrefs = {
  lead_changes: boolean;
  position_changes: boolean;
  match_updates: boolean;
  birdies_eagles_aces: boolean;
  friend_joined: boolean;
  season_reminders: boolean;
  digest_weekly: boolean;
  quiet_hours: { enabled: boolean; start: string; end: string };
};

export const DEFAULT_PREFS: NotificationPrefs = {
  lead_changes: true,
  position_changes: true,
  match_updates: true,
  birdies_eagles_aces: true,
  friend_joined: true,
  season_reminders: true,
  digest_weekly: true,
  quiet_hours: { enabled: false, start: '22:00', end: '07:00' },
};

/**
 * Register for push notifications via expo-notifications and return the Expo push token.
 * Gracefully no-ops if expo-notifications isn't installed or on web.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const Notifications = await import('expo-notifications').catch(() => null as any);
    const Device = await import('expo-device').catch(() => null as any);
    if (!Notifications) return null;

    if (Device?.isDevice === false) return null;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance?.DEFAULT ?? 3,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#C9A227',
      });
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync();
    return tokenRes?.data ?? null;
  } catch {
    return null;
  }
}

export async function savePushToken(userId: string, token: string): Promise<void> {
  await supabase.from('users').update({ push_token: token }).eq('id', userId);
}

export async function clearPushToken(userId: string): Promise<void> {
  await supabase.from('users').update({ push_token: null }).eq('id', userId);
}

export async function getPreferences(userId: string): Promise<NotificationPrefs> {
  const { data } = await supabase
    .from('users')
    .select('notification_preferences')
    .eq('id', userId)
    .single();
  const prefs = (data as any)?.notification_preferences;
  return { ...DEFAULT_PREFS, ...(prefs ?? {}) };
}

export async function updatePreferences(userId: string, prefs: Partial<NotificationPrefs>): Promise<void> {
  const current = await getPreferences(userId);
  const next = { ...current, ...prefs };
  await supabase.from('users').update({ notification_preferences: next }).eq('id', userId);
}

/** Convenience bootstrap: request permission, get token, persist to user row. */
export async function initPushForUser(userId: string): Promise<string | null> {
  const token = await registerForPushNotifications();
  if (token) await savePushToken(userId, token);
  return token;
}
