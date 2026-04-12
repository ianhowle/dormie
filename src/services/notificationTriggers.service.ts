import { supabase } from '../lib/supabase';
import type { NotificationPrefs } from './pushNotification.service';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

type NotificationTrigger =
  | 'lead_changes'
  | 'position_changes'
  | 'match_updates'
  | 'birdies_eagles_aces'
  | 'friend_joined'
  | 'season_reminders';

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
};

function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function isWithinQuietHours(prefs: NotificationPrefs, now = new Date()): boolean {
  if (!prefs.quiet_hours?.enabled) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = parseHHMM(prefs.quiet_hours.start);
  const end = parseHHMM(prefs.quiet_hours.end);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // wraps midnight
}

async function sendPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch {
    // swallow — pushes are best-effort from the client
  }
}

async function resolveRecipients(
  userIds: string[],
  trigger: NotificationTrigger,
): Promise<{ token: string; prefs: NotificationPrefs }[]> {
  if (userIds.length === 0) return [];
  const { data } = await supabase
    .from('users')
    .select('id, push_token, notification_preferences')
    .in('id', userIds);
  return (data ?? [])
    .filter((u: any) => u.push_token)
    .map((u: any) => ({ token: u.push_token as string, prefs: u.notification_preferences as NotificationPrefs }))
    .filter(({ prefs }) => prefs?.[trigger] !== false)
    .filter(({ prefs }) => !isWithinQuietHours(prefs));
}

async function broadcast(trigger: NotificationTrigger, userIds: string[], title: string, body: string, data?: Record<string, unknown>) {
  const recipients = await resolveRecipients(userIds, trigger);
  const messages: PushMessage[] = recipients.map(({ token }) => ({
    to: token, title, body, data, sound: 'default',
  }));
  await sendPush(messages);
}

// ─── Trigger helpers ─────────────────────────────────────────────────

export const notificationTriggers = {
  async leadChange(userIds: string[], args: { seasonName: string; newLeader: string; prevLeader?: string }) {
    await broadcast('lead_changes', userIds, `New leader: ${args.newLeader}`,
      args.prevLeader ? `${args.newLeader} passes ${args.prevLeader} in ${args.seasonName}.`
                      : `${args.newLeader} takes the lead in ${args.seasonName}.`,
      { type: 'lead_change', ...args });
  },

  async positionChange(userIds: string[], args: { userName: string; oldPos: number; newPos: number; seasonName: string }) {
    const dir = args.newPos < args.oldPos ? 'up' : 'down';
    await broadcast('position_changes', userIds, `You moved ${dir}`,
      `${args.userName} is now #${args.newPos} in ${args.seasonName}.`,
      { type: 'position_change', ...args });
  },

  async matchUpdate(userIds: string[], args: { tripName: string; detail: string }) {
    await broadcast('match_updates', userIds, args.tripName, args.detail,
      { type: 'match_update', ...args });
  },

  async birdieOrBetter(userIds: string[], args: { playerName: string; kind: 'birdie' | 'eagle' | 'ace'; hole: number; courseName: string }) {
    const label = args.kind === 'ace' ? 'HOLE IN ONE' : args.kind.toUpperCase();
    await broadcast('birdies_eagles_aces', userIds, `${label} · ${args.playerName}`,
      `Hole ${args.hole} at ${args.courseName}.`,
      { type: 'birdie_eagle_ace', ...args });
  },

  async friendJoined(userIds: string[], args: { friendName: string }) {
    await broadcast('friend_joined', userIds, `${args.friendName} joined Dormie`,
      `Send a friend request to start competing.`,
      { type: 'friend_joined', ...args });
  },

  async seasonReminder(userIds: string[], args: { seasonName: string; weekNumber: number; dueDate?: string }) {
    const when = args.dueDate ? ` — due ${args.dueDate}` : '';
    await broadcast('season_reminders', userIds, `Week ${args.weekNumber} awaits`,
      `${args.seasonName}: post your score${when}.`,
      { type: 'season_reminder', ...args });
  },
};
