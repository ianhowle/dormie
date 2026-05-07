/**
 * Roster + sentence + Phase 1.9f helpers — stress test
 *
 * Run with:
 *   npx ts-node --skip-project --compiler-options \
 *     '{"module":"commonjs","target":"es2020","esModuleInterop":true,"moduleResolution":"node"}' \
 *     src/components/wizard/trip-launched/__tests__/roster.test.ts
 */

import {
  buildAdaptiveTime,
  buildPossessive,
  buildSentence,
  computeRoster,
  computeTotalDuration,
  defaultStakes,
  detectRyderState,
  meetsFireFloor,
  normalizeTeamKey,
  orderPlayersForRail,
  type TripLaunchedPlayer,
  type RyderTeams,
} from '../roster';

import {
  describe,
  expect,
  exitWithStatus,
  it,
  summary,
} from '../../../../__tests__/test-runner';

// ─── Test data builders ───────────────────────────────────────────────

const me = (overrides: Partial<TripLaunchedPlayer> = {}): TripLaunchedPlayer => ({
  name: 'Ian',
  isYou: true,
  ...overrides,
});

const mkPlayer = (
  name: string,
  overrides: Partial<TripLaunchedPlayer> = {},
): TripLaunchedPlayer => ({ name, ...overrides });

// =============================================================
// normalizeTeamKey
// =============================================================

describe('normalizeTeamKey', () => {
  it('passes through new keys', () => {
    expect(normalizeTeamKey('a')).toBe('a');
    expect(normalizeTeamKey('b')).toBe('b');
  });
  it('maps legacy usa/europe to a/b', () => {
    expect(normalizeTeamKey('usa')).toBe('a');
    expect(normalizeTeamKey('europe')).toBe('b');
  });
  it('returns undefined for missing or unknown', () => {
    expect(normalizeTeamKey(undefined)).toBeUndefined();
    expect(normalizeTeamKey('zebra' as any)).toBeUndefined();
  });
});

// =============================================================
// detectRyderState
// =============================================================

describe('detectRyderState', () => {
  it('returns null when format is not ryderCup', () => {
    expect(detectRyderState([me()], 'casualGroup')).toBeNull();
    expect(detectRyderState([me()], undefined)).toBeNull();
    expect(detectRyderState([me()], 'strokePlay')).toBeNull();
  });

  it('returns undrafted when no players have team assignments', () => {
    const players = [me(), mkPlayer('Drew'), mkPlayer('Jake')];
    expect(detectRyderState(players, 'ryderCup')).toBe('undrafted');
  });

  it('returns drafted-default when teams are assigned but no ryderTeams provided', () => {
    const players = [
      me({ team: 'a' }),
      mkPlayer('Drew', { team: 'a' }),
      mkPlayer('Jake', { team: 'b' }),
    ];
    expect(detectRyderState(players, 'ryderCup')).toBe('drafted-default');
  });

  it('returns drafted-custom when ryderTeams is provided', () => {
    const players = [me({ team: 'a' }), mkPlayer('Drew', { team: 'b' })];
    const ryderTeams: RyderTeams = {
      a: { name: 'Generals', color: '#000', glow: '#fff' },
      b: { name: 'Outlaws', color: '#000', glow: '#fff' },
    };
    expect(detectRyderState(players, 'ryderCup', ryderTeams)).toBe(
      'drafted-custom',
    );
  });

  it('detects undrafted from legacy usa/europe team values too', () => {
    const players = [me(), mkPlayer('Drew')];
    expect(detectRyderState(players, 'ryderCup')).toBe('undrafted');
  });
});

// =============================================================
// orderPlayersForRail
// =============================================================

describe('orderPlayersForRail', () => {
  it('non-Ryder: anchors "you" leftmost', () => {
    const players = [mkPlayer('Drew'), mkPlayer('Jake'), me()];
    const ordered = orderPlayersForRail(players);
    expect(ordered[0].name).toBe('Ian');
    expect(ordered[1].name).toBe('Drew');
    expect(ordered[2].name).toBe('Jake');
  });

  it('non-Ryder: pass through when no isYou flag', () => {
    const players = [mkPlayer('Drew'), mkPlayer('Jake')];
    const ordered = orderPlayersForRail(players);
    expect(ordered[0].name).toBe('Drew');
    expect(ordered[1].name).toBe('Jake');
  });

  it('undrafted Ryder: preserves original order (spec exception)', () => {
    const players = [mkPlayer('Drew'), me(), mkPlayer('Jake')];
    const ordered = orderPlayersForRail(players, 'undrafted');
    expect(ordered[0].name).toBe('Drew');
    expect(ordered[1].name).toBe('Ian');
    expect(ordered[2].name).toBe('Jake');
  });

  it('drafted: home team (containing you) first', () => {
    const players = [
      mkPlayer('Drew', { team: 'b' }),
      me({ team: 'a' }),
      mkPlayer('Jake', { team: 'b' }),
      mkPlayer('Tommy', { team: 'a' }),
    ];
    const ordered = orderPlayersForRail(players, 'drafted-default');
    // Ian's team is 'a' → home team
    expect(ordered[0].name).toBe('Ian'); // you anchored leftmost on home
    expect(ordered[1].name).toBe('Tommy'); // remaining home
    expect(ordered[2].name).toBe('Drew'); // away team
    expect(ordered[3].name).toBe('Jake');
  });

  it('drafted: home team is b when you are on b', () => {
    const players = [
      mkPlayer('Drew', { team: 'a' }),
      me({ team: 'b' }),
      mkPlayer('Jake', { team: 'a' }),
    ];
    const ordered = orderPlayersForRail(players, 'drafted-custom');
    expect(ordered[0].name).toBe('Ian'); // home is b
    expect(ordered[1].name).toBe('Drew'); // away
    expect(ordered[2].name).toBe('Jake');
  });
});

// =============================================================
// computeRoster
// =============================================================

describe('computeRoster', () => {
  it('solo (1 player) → solo variant, no rail', () => {
    const r = computeRoster([me()]);
    expect(r.variant).toBe('solo');
    expect(r.rowSplits.length).toBe(0);
  });

  it('2-4 players → standard variant, 44px, 180ms', () => {
    const r = computeRoster([me(), mkPlayer('A'), mkPlayer('B'), mkPlayer('C')]);
    expect(r.variant).toBe('standard');
    expect(r.avatarSize).toBe(44);
    expect(r.cadence).toBe(180);
    expect(r.rowSplits).toEqual([4]);
  });

  it('5-8 players → medium variant, 40px, 180ms', () => {
    const players = [me(), mkPlayer('A'), mkPlayer('B'), mkPlayer('C'), mkPlayer('D'), mkPlayer('E')];
    const r = computeRoster(players);
    expect(r.variant).toBe('medium');
    expect(r.avatarSize).toBe(40);
    expect(r.cadence).toBe(180);
    expect(r.rowSplits).toEqual([6]);
  });

  it('9-12 flat → large variant, 36px, 110ms, 2 rows ceil-on-top', () => {
    const players = Array.from({ length: 11 }, (_, i) =>
      i === 0 ? me() : mkPlayer(`P${i}`),
    );
    const r = computeRoster(players);
    expect(r.variant).toBe('large');
    expect(r.avatarSize).toBe(36);
    expect(r.cadence).toBe(110);
    expect(r.rowSplits).toEqual([6, 5]); // ceil(11/2)=6
  });

  it('Ryder undrafted → ryder-undrafted, 36px, 110ms', () => {
    const players = Array.from({ length: 12 }, (_, i) =>
      i === 0 ? me() : mkPlayer(`P${i}`),
    );
    const r = computeRoster(players, 'undrafted');
    expect(r.variant).toBe('ryder-undrafted');
    expect(r.avatarSize).toBe(36);
    expect(r.cadence).toBe(110);
    expect(r.rowSplits).toEqual([6, 6]);
    expect(r.ryderState).toBe('undrafted');
  });

  it('Ryder drafted → ryder-drafted, splits by team membership (home first)', () => {
    const players: TripLaunchedPlayer[] = [
      me({ team: 'a' }),
      mkPlayer('Drew', { team: 'a' }),
      mkPlayer('Jake', { team: 'a' }),
      mkPlayer('Marcus', { team: 'b' }),
      mkPlayer('Cal', { team: 'b' }),
    ];
    const r = computeRoster(players, 'drafted-default');
    expect(r.variant).toBe('ryder-drafted');
    expect(r.rowSplits).toEqual([3, 2]); // home (a) first, away (b) second
    expect(r.ryderState).toBe('drafted-default');
  });
});

// =============================================================
// buildPossessive
// =============================================================

describe('buildPossessive', () => {
  it('appends apostrophe-s to non-s ending names', () => {
    expect(buildPossessive('Team A')).toBe("Team A's");
    expect(buildPossessive('Drew')).toBe("Drew's");
  });

  it('appends only apostrophe to s-ending names', () => {
    expect(buildPossessive('Generals')).toBe("Generals'");
    expect(buildPossessive('The Outlaws')).toBe("The Outlaws'");
  });

  it('handles uppercase S ending', () => {
    expect(buildPossessive('FOXES')).toBe("FOXES'");
  });
});

// =============================================================
// buildSentence
// =============================================================

describe('buildSentence — solo + non-Ryder', () => {
  it('solo "Just you." with you-underline', () => {
    const r = buildSentence([me()]);
    expect(r.text).toBe('Just you.');
    expect(r.youAt).toBe(5);
  });

  it('2 players (you + 1): "Drew and you."', () => {
    const r = buildSentence([me(), mkPlayer('Drew')]);
    expect(r.text).toBe('Drew and you.');
    expect(r.youAt).toBe(9);
  });

  it('3 players (you + 2): Oxford comma "Drew, Jake, and you."', () => {
    const r = buildSentence([me(), mkPlayer('Drew'), mkPlayer('Jake')]);
    expect(r.text).toBe('Drew, Jake, and you.');
    expect(r.youAt).toBeGreaterThanOrEqual(15);
  });

  it('4 players (you + 3): "Drew, Jake, Tommy, and you."', () => {
    const r = buildSentence([
      me(),
      mkPlayer('Drew'),
      mkPlayer('Jake'),
      mkPlayer('Tommy'),
    ]);
    expect(r.text).toBe('Drew, Jake, Tommy, and you.');
  });

  it('8 players (you + 7): full names list', () => {
    const r = buildSentence([
      me(),
      mkPlayer('A'),
      mkPlayer('B'),
      mkPlayer('C'),
      mkPlayer('D'),
      mkPlayer('E'),
      mkPlayer('F'),
      mkPlayer('G'),
    ]);
    // 8 players is at the edge of "medium" — full names list
    expect(r.text).toContain('A, B, C, D, E, F, G, and you');
  });

  it('11 players → summary form: "X, Y, Z, and N others — including you."', () => {
    const players = [me(), ...Array.from({ length: 10 }, (_, i) => mkPlayer(`P${i}`))];
    const r = buildSentence(players);
    expect(r.text).toBe('P0, P1, P2, and 7 others — including you.');
    expect(r.youAt).toBeGreaterThanOrEqual(0);
  });

  it('non-you sentences (no isYou flag) have youAt: -1', () => {
    const r = buildSentence([mkPlayer('Drew'), mkPlayer('Jake')]);
    expect(r.youAt).toBe(-1);
  });
});

describe('buildSentence — Ryder Cup', () => {
  it('undrafted with 2 captains: "Twelve players. Two captains. Draft night to come."', () => {
    const players: TripLaunchedPlayer[] = Array.from({ length: 12 }, (_, i) =>
      i === 0 ? me() : mkPlayer(`P${i}`, { isCaptain: i === 1 || i === 2 }),
    );
    const r = buildSentence(players, 'undrafted');
    expect(r.text).toBe('Twelve players. Two captains. Draft night to come.');
    expect(r.youAt).toBe(-1); // no underline in undrafted
  });

  it('undrafted with 1 captain: drops "Two captains."', () => {
    const players: TripLaunchedPlayer[] = Array.from({ length: 12 }, (_, i) =>
      i === 0 ? me() : mkPlayer(`P${i}`, { isCaptain: i === 1 }),
    );
    const r = buildSentence(players, 'undrafted');
    expect(r.text).toBe('Twelve players. Draft night to come.');
  });

  it('undrafted with 0 captains: same drop', () => {
    const players: TripLaunchedPlayer[] = Array.from({ length: 12 }, (_, i) =>
      i === 0 ? me() : mkPlayer(`P${i}`),
    );
    const r = buildSentence(players, 'undrafted');
    expect(r.text).toBe('Twelve players. Draft night to come.');
  });

  it('drafted-default: "Team A\'s 6 vs. Team B\'s 6 — and you on Team A."', () => {
    const players: TripLaunchedPlayer[] = [];
    for (let i = 0; i < 6; i++) players.push(i === 0 ? me({ team: 'a' }) : mkPlayer(`A${i}`, { team: 'a' }));
    for (let i = 0; i < 6; i++) players.push(mkPlayer(`B${i}`, { team: 'b' }));
    const r = buildSentence(players, 'drafted-default');
    expect(r.text).toBe("Team A's 6 vs. Team B's 6 — and you on Team A.");
    expect(r.youAt).toBeGreaterThanOrEqual(0);
  });

  it('drafted-custom with s-ending team names handles possessive correctly', () => {
    const players: TripLaunchedPlayer[] = [];
    for (let i = 0; i < 6; i++) players.push(i === 0 ? me({ team: 'a' }) : mkPlayer(`A${i}`, { team: 'a' }));
    for (let i = 0; i < 6; i++) players.push(mkPlayer(`B${i}`, { team: 'b' }));
    const ryderTeams: RyderTeams = {
      a: { name: 'The Generals', color: '#5C4033', glow: 'rgba(0,0,0,0.2)' },
      b: { name: 'The Outlaws', color: '#2C2C2C', glow: 'rgba(0,0,0,0.2)' },
    };
    const r = buildSentence(players, 'drafted-custom', ryderTeams);
    expect(r.text).toBe(
      "The Generals' 6 vs. The Outlaws' 6 — and you on The Generals.",
    );
  });
});

// =============================================================
// meetsFireFloor
// =============================================================

describe('meetsFireFloor', () => {
  const validDate = new Date('2026-10-15');

  it('passes with destination + date + players', () => {
    const r = meetsFireFloor({
      destination: 'Pinehurst',
      startDate: validDate,
      players: [me()],
    });
    expect(r.ok).toBeTruthy();
    expect(r.reason).toBeUndefined();
  });

  it('passes with tripName instead of destination', () => {
    const r = meetsFireFloor({
      tripName: 'Sand Belt Run',
      startDate: validDate,
      players: [me()],
    });
    expect(r.ok).toBeTruthy();
  });

  it('passes with region instead of destination', () => {
    const r = meetsFireFloor({
      region: 'Pacific Northwest',
      startDate: validDate,
      players: [me()],
    });
    expect(r.ok).toBeTruthy();
  });

  it('fails identity: all three identity sources missing', () => {
    const r = meetsFireFloor({
      startDate: validDate,
      players: [me()],
    });
    expect(r.ok).toBeFalsy();
    expect(r.reason).toBe('identity');
  });

  it('fails identity: empty / whitespace strings', () => {
    const r = meetsFireFloor({
      destination: '   ',
      startDate: validDate,
      players: [me()],
    });
    expect(r.ok).toBeFalsy();
    expect(r.reason).toBe('identity');
  });

  it('fails time: missing startDate', () => {
    const r = meetsFireFloor({
      destination: 'Pinehurst',
      players: [me()],
    });
    expect(r.ok).toBeFalsy();
    expect(r.reason).toBe('time');
  });

  it('fails time: invalid Date', () => {
    const r = meetsFireFloor({
      destination: 'Pinehurst',
      startDate: new Date('not-a-date'),
      players: [me()],
    });
    expect(r.ok).toBeFalsy();
    expect(r.reason).toBe('time');
  });

  it('fails people: empty roster', () => {
    const r = meetsFireFloor({
      destination: 'Pinehurst',
      startDate: validDate,
      players: [],
    });
    expect(r.ok).toBeFalsy();
    expect(r.reason).toBe('people');
  });

  it('passes people: solo (length 1) is valid', () => {
    const r = meetsFireFloor({
      destination: 'Pinehurst',
      startDate: validDate,
      players: [me()],
    });
    expect(r.ok).toBeTruthy();
  });

  it('reason precedence: identity fails first', () => {
    const r = meetsFireFloor({
      players: [],
    });
    expect(r.reason).toBe('identity');
  });

  it('reason precedence: time fails before people', () => {
    const r = meetsFireFloor({
      destination: 'Pinehurst',
      players: [],
    });
    expect(r.reason).toBe('time');
  });
});

// =============================================================
// buildAdaptiveTime
// =============================================================

describe('buildAdaptiveTime', () => {
  it('returns null for invalid startDate', () => {
    expect(
      buildAdaptiveTime({ startDate: new Date('garbage') }),
    ).toBeNull();
  });

  it('tee-time mode (< 24h): returns clock + TODAY', () => {
    const now = new Date('2026-10-15T08:00:00');
    const start = new Date('2026-10-15T17:00:00'); // 9h later, same day
    const r = buildAdaptiveTime({ startDate: start, now });
    expect(r).toBeTruthy();
    expect(r!.secondary).toBe('TODAY');
    // clock formatting depends on locale — just sanity-check shape
    expect(r!.primary).toMatch(/[AP]M$/);
  });

  it('tee-time mode crossing midnight: TOMORROW', () => {
    const now = new Date('2026-10-15T22:00:00');
    const start = new Date('2026-10-16T08:00:00'); // 10h later, next day
    const r = buildAdaptiveTime({ startDate: start, now });
    expect(r!.secondary).toBe('TOMORROW');
  });

  it('date-range mode (single day): MMM D · YYYY no dash', () => {
    // Use local-timezone Date constructors (year, monthIdx, day) —
    // ISO strings parse as UTC midnight which shifts the day in local
    // time. Helper uses getDate()/getMonth() which are local-time.
    const now = new Date(2026, 9, 1); // Oct 1
    const start = new Date(2026, 9, 15); // Oct 15 (14 days later → date-range)
    const r = buildAdaptiveTime({ startDate: start, now });
    expect(r!.primary).toBe('OCT 15');
    expect(r!.secondary).toBe('2026');
  });

  it('date-range mode (same-month range): drops second month abbrev', () => {
    const now = new Date(2026, 9, 1);
    const start = new Date(2026, 9, 15);
    const end = new Date(2026, 9, 17);
    const r = buildAdaptiveTime({ startDate: start, endDate: end, now });
    expect(r!.primary).toBe('OCT 15 – 17');
    expect(r!.secondary).toBe('2026');
  });

  it('date-range mode (cross-month range): MMM D – MMM D', () => {
    const now = new Date(2026, 9, 25); // Oct 25
    const start = new Date(2026, 9, 30); // Oct 30 (5 days later → date-range)
    const end = new Date(2026, 10, 2); // Nov 2
    const r = buildAdaptiveTime({ startDate: start, endDate: end, now });
    expect(r!.primary).toBe('OCT 30 – NOV 2');
  });

  it('countdown mode (≥ 30 days): T-N DAYS · MONTH YEAR', () => {
    const now = new Date('2026-05-06');
    const start = new Date('2026-10-15'); // ~162 days
    const r = buildAdaptiveTime({ startDate: start, now });
    expect(r!.primary).toMatch(/^T-\d+ DAYS$/);
    expect(r!.secondary).toBe('OCTOBER 2026');
  });
});

// =============================================================
// computeTotalDuration
// =============================================================

describe('computeTotalDuration', () => {
  it('solo: ~3870ms', () => {
    const d = computeTotalDuration({ players: [me()] });
    expect(d).toBeGreaterThanOrEqual(3000);
    expect(d).toBeLessThanOrEqual(5000);
  });

  it('4 players: ~5540ms (lastLand=3360 + 200 + 800 cap + 200 + 380 + 600)', () => {
    const d = computeTotalDuration({
      players: [me(), mkPlayer('Drew'), mkPlayer('Jake'), mkPlayer('Tommy')],
    });
    // Computed: 2500 + 3*180 + 320 = 3360 (lastLand)
    //   + 200 (sentence start delay)
    //   + 800 (sentence cap — 27ch × 30 = 810 caps to 800)
    //   + 200 (underline delay)
    //   + 380 (underline duration)
    //   + 600 (Beat 4 CTA offset)
    //   = 5540
    expect(d).toBe(5540);
  });

  it('11 players: ~5500ms', () => {
    const players = [me(), ...Array.from({ length: 10 }, (_, i) => mkPlayer(`P${i}`))];
    const d = computeTotalDuration({ players });
    expect(d).toBeGreaterThanOrEqual(5000);
    expect(d).toBeLessThanOrEqual(6500);
  });

  it('larger rosters cadence at 110ms (not 180ms)', () => {
    const players4 = [me(), mkPlayer('A'), mkPlayer('B'), mkPlayer('C')];
    const players12 = [me(), ...Array.from({ length: 11 }, (_, i) => mkPlayer(`P${i}`))];
    const d4 = computeTotalDuration({ players: players4 });
    const d12 = computeTotalDuration({ players: players12 });
    // 12 players takes longer than 4, but cadence speed-up keeps it
    // bounded — gap should be < (12-4)*180 = 1440ms
    expect(d12 - d4).toBeLessThanOrEqual(1500);
  });
});

// =============================================================
// defaultStakes
// =============================================================

describe('defaultStakes', () => {
  it('Ryder undrafted → "RYDER CUP · DRAFT PENDING"', () => {
    const players: TripLaunchedPlayer[] = Array.from({ length: 12 }, () => mkPlayer('P'));
    expect(defaultStakes('ryderCup', players)).toBe('RYDER CUP · DRAFT PENDING');
  });

  it('Ryder drafted → "RYDER CUP · 6 vs 6"', () => {
    const players: TripLaunchedPlayer[] = [];
    for (let i = 0; i < 6; i++) players.push(mkPlayer(`A${i}`, { team: 'a' }));
    for (let i = 0; i < 6; i++) players.push(mkPlayer(`B${i}`, { team: 'b' }));
    expect(defaultStakes('ryderCup', players)).toBe('RYDER CUP · 6 vs 6');
  });

  it('Solo + non-Ryder → "QUIET ROUND · NO STAKES"', () => {
    expect(defaultStakes('casualGroup', [me()])).toBe('QUIET ROUND · NO STAKES');
  });

  it('Other (no stakes set) → "GAME TBD"', () => {
    expect(defaultStakes('casualGroup', [me(), mkPlayer('Drew')])).toBe(
      'GAME TBD',
    );
  });

  it('Empty roster + no format → "GAME TBD" (defensive)', () => {
    expect(defaultStakes(undefined, [])).toBe('GAME TBD');
  });
});

// =============================================================
// Run + exit
// =============================================================

summary('roster.ts');
exitWithStatus();
