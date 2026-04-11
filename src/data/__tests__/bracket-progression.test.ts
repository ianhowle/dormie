/**
 * Bracket Match Progression Tests
 *
 * Tests the complete bracket progression pipeline:
 * - Score recording
 * - Match resolution (Net Stableford, Stroke Play, Match Play)
 * - Winner advancement to next round
 * - Champion detection
 * - Status display labels
 *
 * Simulates a 4-player bracket (Semifinals → Final):
 *   Seed 1 (TestUser1) vs Seed 4 (TestUser4)
 *   Seed 2 (TestUser2) vs Seed 3 (TestUser3)
 *
 * Run with: npx ts-node src/data/__tests__/bracket-progression.test.ts
 */

import {
  generateBracketMatches,
  getBracketRounds,
  getBracketRoundLabel,
  recordBracketScore,
  isBracketMatchReady,
  resolveBracketMatch,
  advanceBracketWinner,
  processBracketRound,
  getBracketMatchStatus,
  findPlayerCurrentMatch,
  isBracketComplete,
  getBracketChampion,
} from '../seasons-detail';
import type { BracketMatch, BracketSize, BracketScoringMethod } from '../seasons-detail';

// ─── Test Runner ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function describe(name: string, fn: () => void) {
  console.log(`\n  ${name}`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`    ✓ ${name}`);
  } catch (e: any) {
    failed++;
    const msg = `    ✗ ${name}: ${e.message}`;
    console.log(msg);
    failures.push(msg);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(expected: number) {
      if ((actual as number) <= expected) throw new Error(`Expected > ${expected}, got ${actual}`);
    },
  };
}

// ─── Test Data ────────────────────────────────────────────────────────

const PLAYERS = [
  { id: 'user1', name: 'TestUser1', seed: 1 },
  { id: 'user2', name: 'TestUser2', seed: 2 },
  { id: 'user3', name: 'TestUser3', seed: 3 },
  { id: 'user4', name: 'TestUser4', seed: 4 },
];

const BRACKET_SIZE: BracketSize = 4;

// ─── Tests ────────────────────────────────────────────────────────────

console.log('\n========================================');
console.log('  Bracket Match Progression Tests');
console.log('========================================');

describe('Bracket Setup (4-player)', () => {
  const matches = generateBracketMatches(4, PLAYERS);

  it('generates correct number of matches (2 semis + 1 final = 3)', () => {
    expect(matches.length).toBe(3);
  });

  it('has 2 rounds', () => {
    expect(getBracketRounds(4)).toBe(2);
  });

  it('round 1 is Semifinals', () => {
    expect(getBracketRoundLabel(1, 2)).toBe('Semifinals');
  });

  it('round 2 is Final', () => {
    expect(getBracketRoundLabel(2, 2)).toBe('Final');
  });

  it('semifinal 1: Seed 1 vs Seed 4', () => {
    const sf1 = matches.find((m) => m.round === 1 && m.position === 1)!;
    expect(sf1.player1_seed).toBe(1);
    expect(sf1.player2_seed).toBe(4);
    expect(sf1.player1_name).toBe('TestUser1');
    expect(sf1.player2_name).toBe('TestUser4');
  });

  it('semifinal 2: Seed 2 vs Seed 3', () => {
    const sf2 = matches.find((m) => m.round === 1 && m.position === 2)!;
    expect(sf2.player1_seed).toBe(2);
    expect(sf2.player2_seed).toBe(3);
    expect(sf2.player1_name).toBe('TestUser2');
    expect(sf2.player2_name).toBe('TestUser3');
  });

  it('final match starts empty', () => {
    const final = matches.find((m) => m.round === 2)!;
    expect(final.player1_id).toBeNull();
    expect(final.player2_id).toBeNull();
    expect(final.status).toBe('pending');
  });
});

describe('Semifinal Round 1 — Match Status Display', () => {
  const matches = generateBracketMatches(4, PLAYERS);

  it('Step 1: Two semifinal matches displayed', () => {
    const semis = matches.filter((m) => m.round === 1);
    expect(semis.length).toBe(2);
  });

  it('Step 2: Match status shows "Awaiting Scores"', () => {
    const sf1 = matches.find((m) => m.id === 'r1_m1')!;
    expect(getBracketMatchStatus(sf1)).toBe('Awaiting Scores');
  });
});

describe('Semifinal 1 — Score Recording & Resolution (Net Stableford)', () => {
  let matches = generateBracketMatches(4, PLAYERS);
  const scoringMethod: BracketScoringMethod = 'stableford';

  it('Step 3: Log score for Seed 1 (TestUser1, score 36 stableford pts from gross 75)', () => {
    matches = recordBracketScore(matches, 'r1_m1', 'user1', 36);
    const sf1 = matches.find((m) => m.id === 'r1_m1')!;
    expect(sf1.player1_score).toBe(36);
    expect(sf1.status).toBe('in_progress');
  });

  it('Step 4: Match shows "Waiting for Opponent"', () => {
    const sf1 = matches.find((m) => m.id === 'r1_m1')!;
    expect(getBracketMatchStatus(sf1)).toBe('Waiting for Opponent');
  });

  it('Step 5: Log score for Seed 4 (TestUser4, score 28 stableford pts from gross 82)', () => {
    matches = recordBracketScore(matches, 'r1_m1', 'user4', 28);
    const sf1 = matches.find((m) => m.id === 'r1_m1')!;
    expect(sf1.player2_score).toBe(28);
    expect(isBracketMatchReady(sf1)).toBeTruthy();
  });

  it('Step 6: Net Stableford comparison determines winner (TestUser1 wins with 36 > 28)', () => {
    const sf1 = matches.find((m) => m.id === 'r1_m1')!;
    const resolved = resolveBracketMatch(sf1, scoringMethod);
    expect(resolved.winner_id).toBe('user1');
    expect(resolved.status).toBe('completed');
  });

  it('Step 7: Winner advances to Final via processBracketRound', () => {
    // Re-run full pipeline from initial state
    let fresh = generateBracketMatches(4, PLAYERS);
    const r1 = processBracketRound(fresh, 'r1_m1', 'user1', 36, scoringMethod, 4);
    fresh = r1.matches;
    expect(r1.resolvedMatch).toBeNull(); // Not yet resolved (only 1 score)

    const r2 = processBracketRound(fresh, 'r1_m1', 'user4', 28, scoringMethod, 4);
    fresh = r2.matches;
    expect(r2.resolvedMatch).toBeTruthy();
    expect(r2.resolvedMatch!.winner_id).toBe('user1');
    expect(r2.isChampion).toBeFalsy();

    // Check final match has TestUser1 in player1 slot
    const final = fresh.find((m) => m.round === 2 && m.position === 1)!;
    expect(final.player1_id).toBe('user1');
    expect(final.player1_name).toBe('TestUser1');
    expect(final.player1_seed).toBe(1);

    matches = fresh;
  });

  it('Step 8: Log rounds for Seed 2 (TestUser2, 32pts) and Seed 3 (TestUser3, 30pts)', () => {
    const r3 = processBracketRound(matches, 'r1_m2', 'user2', 32, scoringMethod, 4);
    matches = r3.matches;
    const r4 = processBracketRound(matches, 'r1_m2', 'user3', 30, scoringMethod, 4);
    matches = r4.matches;
    expect(r4.resolvedMatch).toBeTruthy();
    expect(r4.resolvedMatch!.winner_id).toBe('user2');
  });

  it('Step 9: Second semifinal resolves correctly (TestUser2 wins)', () => {
    const sf2 = matches.find((m) => m.id === 'r1_m2')!;
    expect(sf2.status).toBe('completed');
    expect(sf2.winner_id).toBe('user2');
  });

  it('Step 10: Bracket visualization updates — both winners in Final', () => {
    const final = matches.find((m) => m.round === 2 && m.position === 1)!;
    expect(final.player1_id).toBe('user1');
    expect(final.player1_name).toBe('TestUser1');
    expect(final.player2_id).toBe('user2');
    expect(final.player2_name).toBe('TestUser2');
    expect(final.status).toBe('pending');
  });
});

describe('Final (Round 2)', () => {
  let matches = generateBracketMatches(4, PLAYERS);
  const scoringMethod: BracketScoringMethod = 'stableford';

  // Fast-forward semis
  let r = processBracketRound(matches, 'r1_m1', 'user1', 36, scoringMethod, 4);
  matches = r.matches;
  r = processBracketRound(matches, 'r1_m1', 'user4', 28, scoringMethod, 4);
  matches = r.matches;
  r = processBracketRound(matches, 'r1_m2', 'user2', 32, scoringMethod, 4);
  matches = r.matches;
  r = processBracketRound(matches, 'r1_m2', 'user3', 30, scoringMethod, 4);
  matches = r.matches;

  it('Step 11: Final match created with correct players', () => {
    const final = matches.find((m) => m.round === 2 && m.position === 1)!;
    expect(final.player1_id).toBe('user1');
    expect(final.player2_id).toBe('user2');
    expect(final.player1_name).toBe('TestUser1');
    expect(final.player2_name).toBe('TestUser2');
  });

  it('Step 12: Final match is the championship round (round == totalRounds)', () => {
    const final = matches.find((m) => m.round === 2)!;
    const totalRounds = getBracketRounds(4);
    expect(final.round).toBe(totalRounds);
    expect(getBracketRoundLabel(final.round, totalRounds)).toBe('Final');
  });

  it('Step 13: Log round for first finalist (TestUser1, 38pts)', () => {
    r = processBracketRound(matches, 'r2_m1', 'user1', 38, scoringMethod, 4);
    matches = r.matches;
    const final = matches.find((m) => m.id === 'r2_m1')!;
    expect(final.player1_score).toBe(38);
    expect(getBracketMatchStatus(final)).toBe('Waiting for Opponent');
    expect(r.isChampion).toBeFalsy(); // Not resolved yet
  });

  it('Step 14: Log round for second finalist (TestUser2, 34pts)', () => {
    r = processBracketRound(matches, 'r2_m1', 'user2', 34, scoringMethod, 4);
    matches = r.matches;
    expect(r.resolvedMatch).toBeTruthy();
  });

  it('Step 15: Champion determined by Net Stableford (TestUser1 wins 38 > 34)', () => {
    expect(r.resolvedMatch!.winner_id).toBe('user1');
    expect(r.resolvedMatch!.status).toBe('completed');
  });

  it('Step 16: isChampion flag is true for final match resolution', () => {
    expect(r.isChampion).toBeTruthy();
  });

  it('Step 17: Bracket shows complete path — all matches filled', () => {
    const allCompleted = matches
      .filter((m) => m.round <= 2)
      .every((m) => m.status === 'completed' || m.status === 'bye');
    expect(allCompleted).toBeTruthy();
  });

  it('Step 18: isBracketComplete returns true', () => {
    expect(isBracketComplete(matches, 4)).toBeTruthy();
  });

  it('Step 19: Champion recorded correctly', () => {
    const champion = getBracketChampion(matches, 4);
    expect(champion).toBeTruthy();
    expect(champion!.id).toBe('user1');
    expect(champion!.name).toBe('TestUser1');
    expect(champion!.seed).toBe(1);
  });
});

describe('Stroke Play Scoring (lower wins)', () => {
  let matches = generateBracketMatches(4, PLAYERS);
  const scoringMethod: BracketScoringMethod = 'stroke_play';

  it('lower score wins in stroke play', () => {
    const r1 = processBracketRound(matches, 'r1_m1', 'user1', 75, scoringMethod, 4);
    matches = r1.matches;
    const r2 = processBracketRound(matches, 'r1_m1', 'user4', 82, scoringMethod, 4);
    matches = r2.matches;
    expect(r2.resolvedMatch!.winner_id).toBe('user1'); // 75 < 82
  });
});

describe('Match Play Scoring (higher wins)', () => {
  let matches = generateBracketMatches(4, PLAYERS);
  const scoringMethod: BracketScoringMethod = 'match_play';

  it('higher holes-won count wins in match play', () => {
    const r1 = processBracketRound(matches, 'r1_m1', 'user1', 10, scoringMethod, 4);
    matches = r1.matches;
    const r2 = processBracketRound(matches, 'r1_m1', 'user4', 8, scoringMethod, 4);
    matches = r2.matches;
    expect(r2.resolvedMatch!.winner_id).toBe('user1'); // 10 > 8
  });
});

describe('Utility Functions', () => {
  const matches = generateBracketMatches(4, PLAYERS);

  it('findPlayerCurrentMatch finds pending match for user1', () => {
    const match = findPlayerCurrentMatch(matches, 'user1');
    expect(match).toBeTruthy();
    expect(match!.id).toBe('r1_m1');
  });

  it('isBracketComplete returns false for fresh bracket', () => {
    expect(isBracketComplete(matches, 4)).toBeFalsy();
  });

  it('getBracketChampion returns null for incomplete bracket', () => {
    expect(getBracketChampion(matches, 4)).toBeNull();
  });

  it('getBracketMatchStatus for pending match with players', () => {
    const sf1 = matches.find((m) => m.id === 'r1_m1')!;
    expect(getBracketMatchStatus(sf1)).toBe('Awaiting Scores');
  });

  it('getBracketMatchStatus for final without players yet', () => {
    const final = matches.find((m) => m.round === 2)!;
    expect(getBracketMatchStatus(final)).toBe('Awaiting Players');
  });
});

// ─── Summary ──────────────────────────────────────────────────────────

console.log('\n========================================');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('========================================');

if (failures.length > 0) {
  console.log('\n  Failures:');
  failures.forEach((f) => console.log(f));
}

process.exit(failed > 0 ? 1 : 0);
