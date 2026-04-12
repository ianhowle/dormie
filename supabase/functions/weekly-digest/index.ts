// Supabase Edge Function: weekly-digest
// Runs every Sunday. Generates a digest payload per user and sends an Expo push
// notification. Deploy with `supabase functions deploy weekly-digest` and schedule
// via the Supabase Dashboard (pg_cron) or an external cron hitting this URL with
// the service-role key.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
};

type NotificationPrefs = {
  digest_weekly?: boolean;
  quiet_hours?: { enabled?: boolean; start?: string; end?: string };
};

function withinQuietHours(prefs: NotificationPrefs, now = new Date()): boolean {
  const q = prefs?.quiet_hours;
  if (!q?.enabled || !q.start || !q.end) return false;
  const [sh, sm] = q.start.split(':').map(Number);
  const [eh, em] = q.end.split(':').map(Number);
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;
  if (startM === endM) return false;
  if (startM < endM) return cur >= startM && cur < endM;
  return cur >= startM || cur < endM;
}

async function sendPush(messages: PushMessage[]) {
  if (messages.length === 0) return;
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));
  for (const chunk of chunks) {
    try {
      await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      console.error('expo push send failed', err);
    }
  }
}

serve(async (req) => {
  // Accept only POSTs authenticated with the service role or a shared secret
  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  const secret = Deno.env.get('WEEKLY_DIGEST_SECRET');
  if (secret && authHeader !== `Bearer ${secret}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const dryRun = url.searchParams.get('dry') === '1';

  // Fetch all users with push tokens and digest opt-in
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, push_token, notification_preferences')
    .not('push_token', 'is', null);
  if (error) {
    console.error('fetch users failed', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  const now = new Date();
  const messages: PushMessage[] = [];
  let skipped = 0;

  for (const u of users ?? []) {
    const prefs = (u.notification_preferences ?? {}) as NotificationPrefs;
    if (prefs.digest_weekly === false) { skipped++; continue; }
    if (withinQuietHours(prefs, now)) { skipped++; continue; }

    // Lightweight summary: count rounds this week + pending deadlines
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: roundCount }, { data: deadlines }] = await Promise.all([
      supabase.from('rounds').select('id', { count: 'exact', head: true })
        .eq('user_id', u.id).gte('played_at', weekAgo),
      supabase.from('season_weeks').select('season_id, week_number, due_date')
        .gte('due_date', now.toISOString())
        .lte('due_date', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(5),
    ]);

    const dueCount = (deadlines ?? []).length;
    const title = 'Your Dormie week in review';
    const roundBit = `${roundCount ?? 0} round${roundCount === 1 ? '' : 's'} this week`;
    const dueBit = dueCount > 0 ? ` · ${dueCount} deadline${dueCount === 1 ? '' : 's'} ahead` : '';
    const body = `${roundBit}${dueBit}. Tap for the full recap.`;

    messages.push({
      to: u.push_token as string,
      title,
      body,
      data: { type: 'weekly_digest', userId: u.id },
      sound: 'default',
    });
  }

  if (!dryRun) await sendPush(messages);

  return new Response(
    JSON.stringify({ ok: true, sent: dryRun ? 0 : messages.length, queued: messages.length, skipped, dryRun }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
