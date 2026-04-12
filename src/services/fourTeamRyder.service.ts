export type FourTeamMatchFormat = 'four_ball' | 'foursomes' | 'singles' | 'shamble';
export type FourTeamMatchStatus = 'pending' | 'in_progress' | 'complete';
export type FourTeamMatchWinner = 'team1' | 'team2' | 'halved' | null;

export type FourTeamRyderTeam = {
  id: string;
  name: string;
  color: string;
  captainId?: string;
  playerIds: string[];
};

export type FourTeamRyderMatchup = {
  matchId: string;
  team1Id: string;
  team2Id: string;
  format: FourTeamMatchFormat;
};

export type FourTeamRyderRound = {
  roundIdx: number;
  label: string;
  matches: FourTeamRyderMatchup[];
};

export type FourTeamRyderHoleResult = {
  winner: 'team1' | 'team2' | 'halved';
};

export type FourTeamRyderMatchResult = {
  team1Points: number;
  team2Points: number;
  holeResults: Record<number, FourTeamRyderHoleResult>;
  status: FourTeamMatchStatus;
  matchWinner: FourTeamMatchWinner;
};

export type FourTeamRyderStanding = {
  teamId: string;
  totalPoints: number;
  matchesWon: number;
  matchesLost: number;
  matchesHalved: number;
};

export type FourTeamRyderScheduleMode = 'three_round' | 'single_round';

export type FourTeamRyderConfig = {
  teams: FourTeamRyderTeam[];
  scheduleMode: FourTeamRyderScheduleMode;
  schedule: FourTeamRyderRound[];
  results: Record<string, FourTeamRyderMatchResult>;
  pointsToWin: number; // clinch threshold
};

export const FORMAT_LABEL: Record<FourTeamMatchFormat, string> = {
  four_ball: 'Four-Ball',
  foursomes: 'Foursomes',
  singles: 'Singles',
  shamble: 'Shamble',
};

// Round-robin pairings across teams A/B/C/D
const PAIRINGS: [number, number][][] = [
  [[0, 1], [2, 3]], // Round 1: A-B, C-D
  [[0, 2], [1, 3]], // Round 2: A-C, B-D
  [[0, 3], [1, 2]], // Round 3: A-D, B-C
];

export function buildSchedule(
  teams: FourTeamRyderTeam[],
  mode: FourTeamRyderScheduleMode,
  formats: FourTeamMatchFormat[] = ['four_ball', 'foursomes', 'singles'],
): FourTeamRyderRound[] {
  if (teams.length !== 4) return [];
  const rounds: FourTeamRyderRound[] = [];
  PAIRINGS.forEach((pair, rIdx) => {
    const label =
      mode === 'three_round'
        ? `Round ${rIdx + 1}`
        : `Holes ${rIdx * 6 + 1}–${rIdx * 6 + 6}`;
    const matches: FourTeamRyderMatchup[] = pair.map(([i, j], k) => ({
      matchId: `r${rIdx + 1}-m${k + 1}`,
      team1Id: teams[i].id,
      team2Id: teams[j].id,
      format: formats[rIdx % formats.length],
    }));
    rounds.push({ roundIdx: rIdx, label, matches });
  });
  return rounds;
}

export function createInitialConfig(
  teams: FourTeamRyderTeam[],
  mode: FourTeamRyderScheduleMode = 'three_round',
): FourTeamRyderConfig {
  const schedule = buildSchedule(teams, mode);
  const results: Record<string, FourTeamRyderMatchResult> = {};
  schedule.forEach((r) => r.matches.forEach((m) => {
    results[m.matchId] = {
      team1Points: 0, team2Points: 0, holeResults: {}, status: 'pending', matchWinner: null,
    };
  }));
  return { teams, scheduleMode: mode, schedule, results, pointsToWin: 3.5 };
}

// ─── Match play evaluation ──────────────────────────────────────────
export function evaluateMatch(
  holeResults: Record<number, FourTeamRyderHoleResult>,
  totalHoles: number = 18,
): { team1Holes: number; team2Holes: number; holesPlayed: number; matchWinner: FourTeamMatchWinner; status: FourTeamMatchStatus; margin: string } {
  let t1 = 0, t2 = 0, played = 0;
  const sortedHoles = Object.keys(holeResults).map(Number).sort((a, b) => a - b);
  sortedHoles.forEach((h) => {
    const r = holeResults[h];
    played++;
    if (r.winner === 'team1') t1++;
    else if (r.winner === 'team2') t2++;
  });

  const holesRemaining = totalHoles - played;
  const lead = Math.abs(t1 - t2);

  // Match closed early if lead > holes remaining
  if (lead > holesRemaining && holesRemaining >= 0 && played > 0) {
    const winner: FourTeamMatchWinner = t1 > t2 ? 'team1' : 'team2';
    return {
      team1Holes: t1, team2Holes: t2, holesPlayed: played,
      matchWinner: winner, status: 'complete',
      margin: `${lead}&${holesRemaining}`,
    };
  }

  if (played === 0) {
    return { team1Holes: 0, team2Holes: 0, holesPlayed: 0, matchWinner: null, status: 'pending', margin: '' };
  }

  if (played >= totalHoles) {
    const winner: FourTeamMatchWinner = t1 > t2 ? 'team1' : t2 > t1 ? 'team2' : 'halved';
    return {
      team1Holes: t1, team2Holes: t2, holesPlayed: played,
      matchWinner: winner, status: 'complete',
      margin: winner === 'halved' ? 'AS' : `${lead} UP`,
    };
  }

  return {
    team1Holes: t1, team2Holes: t2, holesPlayed: played,
    matchWinner: null, status: 'in_progress',
    margin: t1 === t2 ? 'AS' : `${lead} UP`,
  };
}

export function pointsForMatch(winner: FourTeamMatchWinner): { team1: number; team2: number } {
  if (winner === 'team1') return { team1: 1, team2: 0 };
  if (winner === 'team2') return { team1: 0, team2: 1 };
  if (winner === 'halved') return { team1: 0.5, team2: 0.5 };
  return { team1: 0, team2: 0 };
}

export function computeStandings(config: FourTeamRyderConfig): FourTeamRyderStanding[] {
  const standings: Record<string, FourTeamRyderStanding> = {};
  config.teams.forEach((t) => {
    standings[t.id] = {
      teamId: t.id, totalPoints: 0, matchesWon: 0, matchesLost: 0, matchesHalved: 0,
    };
  });

  config.schedule.forEach((round) => {
    round.matches.forEach((match) => {
      const res = config.results[match.matchId];
      if (!res || res.status !== 'complete' || !res.matchWinner) return;
      const pts = pointsForMatch(res.matchWinner);
      const t1 = standings[match.team1Id];
      const t2 = standings[match.team2Id];
      if (t1) t1.totalPoints += pts.team1;
      if (t2) t2.totalPoints += pts.team2;
      if (res.matchWinner === 'team1') { t1.matchesWon++; t2.matchesLost++; }
      else if (res.matchWinner === 'team2') { t2.matchesWon++; t1.matchesLost++; }
      else if (res.matchWinner === 'halved') { t1.matchesHalved++; t2.matchesHalved++; }
    });
  });

  return Object.values(standings).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    return a.matchesLost - b.matchesLost;
  });
}

export function checkCupClinched(config: FourTeamRyderConfig): FourTeamRyderTeam | null {
  const standings = computeStandings(config);
  if (standings.length === 0) return null;
  const leader = standings[0];
  const totalPossible = config.schedule.reduce((sum, r) => sum + r.matches.length, 0);
  const matchesComplete = Object.values(config.results).filter((r) => r.status === 'complete').length;
  const pointsLeft = totalPossible - matchesComplete;
  const second = standings[1];
  if (!second) return null;
  if (leader.totalPoints > second.totalPoints + pointsLeft) {
    return config.teams.find((t) => t.id === leader.teamId) ?? null;
  }
  if (matchesComplete === totalPossible && leader.totalPoints > second.totalPoints) {
    return config.teams.find((t) => t.id === leader.teamId) ?? null;
  }
  return null;
}

export const DEFAULT_TEAM_COLORS = ['#006747', '#C9A227', '#C41E3A', '#1E3A8A'];

export function createDefaultTeams(): FourTeamRyderTeam[] {
  return [0, 1, 2, 3].map((i) => ({
    id: `team-${i + 1}`,
    name: ['Augusta', 'Pinehurst', 'Pebble', 'St Andrews'][i],
    color: DEFAULT_TEAM_COLORS[i],
    playerIds: [],
  }));
}
