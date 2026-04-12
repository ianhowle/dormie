import { supabase } from '../lib/supabase';

export type DigestStandingRow = {
  seasonId: string;
  seasonName: string;
  position: number | null;
  points: number | null;
  leaderName: string | null;
  leaderPoints: number | null;
  weekNumber: number | null;
};

export type DigestStatRow = { label: string; value: string };

export type DigestDeadline = {
  seasonId: string;
  seasonName: string;
  weekNumber: number;
  dueDate: string | null;
  format: string | null;
};

export type DigestHighlight = {
  kind: 'birdie' | 'eagle' | 'ace' | 'low_round' | 'friend_joined';
  headline: string;
  detail?: string;
  at: string;
};

export type DigestPayload = {
  userId: string;
  generatedAt: string;
  weekStart: string;
  weekEnd: string;
  standings: DigestStandingRow[];
  stats: DigestStatRow[];
  deadlines: DigestDeadline[];
  highlights: DigestHighlight[];
};

function weekWindow(now = new Date()): { start: Date; end: Date } {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

async function buildStandings(userId: string): Promise<DigestStandingRow[]> {
  const { data: memberships } = await supabase
    .from('season_members')
    .select('season:seasons(id,name)')
    .eq('user_id', userId);
  const seasons = ((memberships ?? []) as any[]).map((m) => m.season).filter(Boolean);
  const results: DigestStandingRow[] = [];
  for (const s of seasons) {
    try {
      const { data: standings } = await supabase.rpc('get_season_standings', { p_season_id: s.id });
      const arr = (standings ?? []) as any[];
      const myIdx = arr.findIndex((row) => row.user_id === userId || row.userId === userId);
      const leader = arr[0];
      results.push({
        seasonId: s.id,
        seasonName: s.name,
        position: myIdx >= 0 ? myIdx + 1 : null,
        points: myIdx >= 0 ? Number(arr[myIdx].points ?? arr[myIdx].total_points ?? 0) : null,
        leaderName: leader?.name ?? leader?.user_name ?? null,
        leaderPoints: leader ? Number(leader.points ?? leader.total_points ?? 0) : null,
        weekNumber: null,
      });
    } catch {
      // RPC may not exist yet; skip
    }
  }
  return results;
}

async function buildStats(userId: string): Promise<DigestStatRow[]> {
  const { start } = weekWindow();
  const { data: rounds } = await supabase
    .from('rounds')
    .select('gross_score, hole_scores, played_at')
    .eq('user_id', userId)
    .gte('played_at', start.toISOString())
    .order('played_at', { ascending: false });

  const arr = (rounds ?? []) as any[];
  if (arr.length === 0) {
    return [{ label: 'Rounds played', value: '0' }];
  }

  const lowScore = Math.min(...arr.map((r) => r.gross_score ?? Infinity));
  const avgScore = arr.reduce((s, r) => s + (r.gross_score ?? 0), 0) / arr.length;
  let birdies = 0, eagles = 0;
  arr.forEach((r) => {
    const scores = (r.hole_scores ?? []) as { gross: number; par?: number }[];
    scores.forEach((h) => {
      if (!h?.par) return;
      const diff = h.gross - h.par;
      if (diff === -1) birdies++;
      if (diff <= -2) eagles++;
    });
  });

  return [
    { label: 'Rounds played', value: String(arr.length) },
    { label: 'Low round', value: Number.isFinite(lowScore) ? String(lowScore) : '—' },
    { label: 'Avg score', value: avgScore ? avgScore.toFixed(1) : '—' },
    { label: 'Birdies', value: String(birdies) },
    ...(eagles > 0 ? [{ label: 'Eagles', value: String(eagles) }] : []),
  ];
}

async function buildDeadlines(userId: string): Promise<DigestDeadline[]> {
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const { data: memberships } = await supabase
    .from('season_members')
    .select('season_id')
    .eq('user_id', userId);
  const seasonIds = ((memberships ?? []) as any[]).map((m) => m.season_id);
  if (seasonIds.length === 0) return [];

  const { data: weeks } = await supabase
    .from('season_weeks')
    .select('season_id, week_number, due_date, format, season:seasons(name)')
    .in('season_id', seasonIds)
    .gte('due_date', now.toISOString())
    .lte('due_date', nextWeek.toISOString())
    .order('due_date', { ascending: true });

  return ((weeks ?? []) as any[]).map((w) => ({
    seasonId: w.season_id,
    seasonName: w.season?.name ?? 'Season',
    weekNumber: w.week_number,
    dueDate: w.due_date,
    format: w.format,
  }));
}

async function buildHighlights(userId: string): Promise<DigestHighlight[]> {
  const { start } = weekWindow();
  const highlights: DigestHighlight[] = [];

  // Friend-joined highlights — check for new users among friends in the last week
  try {
    const { data: friends } = await supabase
      .from('friendships')
      .select('friend:users!friend_id(id,name,created_at)')
      .eq('user_id', userId)
      .gte('created_at', start.toISOString());
    ((friends ?? []) as any[]).forEach((f) => {
      if (f.friend?.name) {
        highlights.push({
          kind: 'friend_joined',
          headline: `${f.friend.name} joined`,
          detail: 'Say hi and schedule a round.',
          at: f.friend.created_at ?? new Date().toISOString(),
        });
      }
    });
  } catch {}

  // Birdies / eagles / aces from rounds this week
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, hole_scores, gross_score, played_at, course:courses(name)')
    .eq('user_id', userId)
    .gte('played_at', start.toISOString());

  ((rounds ?? []) as any[]).forEach((r) => {
    const scores = (r.hole_scores ?? []) as { hole: number; gross: number; par?: number }[];
    scores.forEach((h) => {
      if (!h?.par) return;
      const diff = h.gross - h.par;
      if (h.gross === 1) {
        highlights.push({ kind: 'ace', headline: `Hole in one — Hole ${h.hole}`, detail: r.course?.name ?? 'Course', at: r.played_at });
      } else if (diff <= -2) {
        highlights.push({ kind: 'eagle', headline: `Eagle on Hole ${h.hole}`, detail: r.course?.name ?? 'Course', at: r.played_at });
      } else if (diff === -1) {
        highlights.push({ kind: 'birdie', headline: `Birdie on Hole ${h.hole}`, detail: r.course?.name ?? 'Course', at: r.played_at });
      }
    });
  });

  highlights.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return highlights.slice(0, 10);
}

export const digestService = {
  async generateDigest(userId: string): Promise<DigestPayload> {
    const { start, end } = weekWindow();
    const [standings, stats, deadlines, highlights] = await Promise.all([
      buildStandings(userId),
      buildStats(userId),
      buildDeadlines(userId),
      buildHighlights(userId),
    ]);
    return {
      userId,
      generatedAt: new Date().toISOString(),
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      standings,
      stats,
      deadlines,
      highlights,
    };
  },
};
