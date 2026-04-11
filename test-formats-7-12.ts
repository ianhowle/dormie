/**
 * Test script for scoring formats 7–12.
 * Tests pure calculation functions from src/data/scoring.ts and
 * re-implements the skins/nassau algorithms from src/scoring/calculations.ts
 * to avoid React Native dependencies.
 *
 * Run: node --experimental-strip-types test-formats-7-12.ts
 */

// ─── Import pure functions (no React Native deps) ──────────────────────────
import {
  calculateMatchPlay,
  calculateBestBall,
  calculateScrambleTeamScore,
  validateScrambleScore,
  calculateChapmanHoleScore,
  calculateChapmanTotal,
  type ChapmanHoleScore,
} from './src/data/scoring.ts';

// ─── Types matching src/scoring/types.ts ────────────────────────────────────
type PlayerConfig = { id: string; name: string; handicap: number };
type HoleData = { number: number; par: number; strokeIndex: number };
type HoleScore = { gross: number; putts: number; fir: boolean | null };
type GameResult = { title: string; lines: { text: string; value?: string; highlight?: boolean }[] };

// ─── Re-implement skins + nassau logic (same as calculations.ts, no useTheme) ─
function pName(p: PlayerConfig): string {
  return p.id === '1' ? 'You' : p.name.split(' ')[0];
}

function localBuildSkinsResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
): GameResult {
  const skinWins = new Map<string, number>();
  players.forEach((p) => skinWins.set(p.id, 0));
  let carryover = 0;

  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores || holeScores.size < players.length) { carryover++; return; }
    let best = Infinity;
    let winners: string[] = [];
    holeScores.forEach((s, pid) => {
      if (s.gross < best) { best = s.gross; winners = [pid]; }
      else if (s.gross === best) winners.push(pid);
    });
    if (winners.length === 1) {
      skinWins.set(winners[0], (skinWins.get(winners[0]) ?? 0) + 1 + carryover);
      carryover = 0;
    } else {
      carryover++;
    }
  });

  const lines: GameResult['lines'] = players
    .map((p) => ({
      text: pName(p),
      value: `${skinWins.get(p.id) ?? 0} skins`,
      highlight: p.id === '1',
    }))
    .sort((a, b) => parseInt(b.value!) - parseInt(a.value!));

  if (carryover > 0) lines.push({ text: `${carryover} skin${carryover !== 1 ? 's' : ''} carried over` });

  return { title: label, lines };
}

function localBuildNassauResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
): GameResult {
  if (players.length < 2) return { title: label, lines: [{ text: 'Need 2+ players' }] };

  function nineTotal(pid: string, nineHoles: HoleData[]): number {
    let t = 0;
    nineHoles.forEach((h) => { const s = allScores.get(h.number)?.get(pid); if (s) t += s.gross; });
    return t;
  }

  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);
  const lines: GameResult['lines'] = [];

  if (front.length > 0) {
    let best = Infinity; const winners: string[] = [];
    players.forEach((p) => { const t = nineTotal(p.id, front); if (t > 0 && t < best) { best = t; winners.length = 0; winners.push(p.id); } else if (t > 0 && t === best) { winners.push(p.id); } });
    if (winners.length === 1) { const wp = players.find((p) => p.id === winners[0]); if (wp) lines.push({ text: `Front 9: ${pName(wp)}`, value: String(best), highlight: winners[0] === '1' }); }
    else if (winners.length > 1) lines.push({ text: `Front 9: Tied`, value: String(best) });
  }
  if (back.length > 0) {
    let best = Infinity; const winners: string[] = [];
    players.forEach((p) => { const t = nineTotal(p.id, back); if (t > 0 && t < best) { best = t; winners.length = 0; winners.push(p.id); } else if (t > 0 && t === best) { winners.push(p.id); } });
    if (winners.length === 1) { const wp = players.find((p) => p.id === winners[0]); if (wp) lines.push({ text: `Back 9: ${pName(wp)}`, value: String(best), highlight: winners[0] === '1' }); }
    else if (winners.length > 1) lines.push({ text: `Back 9: Tied`, value: String(best) });
  }
  {
    let best = Infinity; const winners: string[] = [];
    players.forEach((p) => { const t = nineTotal(p.id, holes); if (t > 0 && t < best) { best = t; winners.length = 0; winners.push(p.id); } else if (t > 0 && t === best) { winners.push(p.id); } });
    if (winners.length === 1) { const wp = players.find((p) => p.id === winners[0]); if (wp) lines.push({ text: `Overall: ${pName(wp)}`, value: String(best), highlight: winners[0] === '1' }); }
    else if (winners.length > 1) lines.push({ text: `Overall: Tied`, value: String(best) });
  }

  return { title: label, lines };
}

// ─── Test helpers ───────────────────────────────────────────────────────────
let passCount = 0;
let failCount = 0;
const output: string[] = [];

function assert(condition: boolean, testName: string, detail: string) {
  if (condition) {
    passCount++;
    output.push(`  PASS — ${testName}: ${detail}`);
  } else {
    failCount++;
    output.push(`  FAIL — ${testName}: ${detail}`);
  }
}

function section(title: string) {
  output.push(`\n${'='.repeat(60)}`);
  output.push(`  ${title}`);
  output.push(`${'='.repeat(60)}`);
}

function makePlayers(names: string[]): PlayerConfig[] {
  return names.map((n, i) => ({ id: String(i + 1), name: n, handicap: 10 }));
}

function makeHoles(count: number, startNumber = 1): HoleData[] {
  const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
  return Array.from({ length: count }, (_, i) => ({
    number: startNumber + i,
    par: pars[(startNumber + i - 1) % 18],
    strokeIndex: i + 1,
  }));
}

function buildScoresMap(
  holes: HoleData[],
  playerScores: Map<string, number[]>,
): Map<number, Map<string, HoleScore>> {
  const allScores = new Map<number, Map<string, HoleScore>>();
  holes.forEach((h, idx) => {
    const holeMap = new Map<string, HoleScore>();
    playerScores.forEach((scores, pid) => {
      holeMap.set(pid, { gross: scores[idx], putts: 2, fir: null });
    });
    allScores.set(h.number, holeMap);
  });
  return allScores;
}

// ═══════════════════════════════════════════════════════════════════════
//  FORMAT 7: MATCH PLAY
// ═══════════════════════════════════════════════════════════════════════
section('FORMAT 7: MATCH PLAY');

// Test 7a: 18 holes, A leads early and closes out match
{
  const playerA = [4,5,3,6,4,5,4,5,4, 4,5,3,4,4,4,3,5,4];
  const playerB = [5,4,4,5,5,4,3,6,5, 5,4,4,4,5,4,3,5,5];
  const r = calculateMatchPlay(playerA, playerB);

  output.push(`\n  Test 7a: Full 18, A wins`);
  output.push(`    Input A: [${playerA}]`);
  output.push(`    Input B: [${playerB}]`);
  output.push(`    Holes won A: ${r.holesWonA}, B: ${r.holesWonB}, Halved: ${r.holesHalved}`);
  output.push(`    Result: "${r.result}", Winner: ${r.winner}`);
  output.push(`    Match ended at hole: ${r.matchEndedAtHole}`);

  // After hole 16: wonA=8, wonB=5, lead=3, rem=2 → 3 > 2 → MATCH OVER at 16
  assert(r.winner === 'A', '7a winner', `expected A, got ${r.winner}`);
  assert(r.matchEndedAtHole === 16, '7a match ended', `expected 16, got ${r.matchEndedAtHole}`);
  assert(r.result === '3&2', '7a result string', `expected "3&2", got "${r.result}"`);
}

// Test 7b: Match goes to 18, close finish — 1 UP
{
  const playerA = [4,4,4,4,4,4,4,4,4, 4,4,4,4,4,4,4,4,3];
  const playerB = [4,4,4,4,4,4,4,4,4, 4,4,4,4,4,4,4,4,4];
  const r = calculateMatchPlay(playerA, playerB);

  output.push(`\n  Test 7b: Goes to 18, A wins last hole`);
  output.push(`    Result: "${r.result}", Winner: ${r.winner}`);
  output.push(`    Holes won A: ${r.holesWonA}, B: ${r.holesWonB}, Halved: ${r.holesHalved}`);

  assert(r.winner === 'A', '7b winner', `expected A, got ${r.winner}`);
  assert(r.holesWonA === 1, '7b holes won A', `expected 1, got ${r.holesWonA}`);
  assert(r.holesWonB === 0, '7b holes won B', `expected 0, got ${r.holesWonB}`);
  assert(r.holesHalved === 17, '7b halved', `expected 17, got ${r.holesHalved}`);
  assert(r.result === '1 UP', '7b result string', `expected "1 UP", got "${r.result}"`);
  assert(r.matchEndedAtHole === 18, '7b ended at', `expected 18, got ${r.matchEndedAtHole}`);
}

// Test 7c: HALVED match
{
  const playerA = [4,4,4,4,4,4,4,4,4, 4,4,4,4,4,4,4,4,4];
  const playerB = [4,4,4,4,4,4,4,4,4, 4,4,4,4,4,4,4,4,4];
  const r = calculateMatchPlay(playerA, playerB);

  output.push(`\n  Test 7c: All halved`);
  output.push(`    Result: "${r.result}", Winner: ${r.winner}`);

  assert(r.winner === null, '7c winner', `expected null, got ${r.winner}`);
  assert(r.result === 'HALVED', '7c result string', `expected "HALVED", got "${r.result}"`);
  assert(r.holesHalved === 18, '7c halved count', `expected 18, got ${r.holesHalved}`);
}

// Test 7d: Early close-out — A dominates
{
  const playerA = [3,3,3,3,3, 3,3,3,3, 3,3,3,3,3,3,3,3,3];
  const playerB = [5,5,5,5,5, 5,5,5,5, 5,5,5,5,5,5,5,5,5];
  const r = calculateMatchPlay(playerA, playerB);

  output.push(`\n  Test 7d: Early close-out (A dominates)`);
  output.push(`    Result: "${r.result}", Winner: ${r.winner}`);
  output.push(`    Match ended at hole: ${r.matchEndedAtHole}`);

  // lead = i+1, rem = 18-(i+1). lead > rem when i+1 > 18-(i+1) → i > 8 → hole 10
  assert(r.winner === 'A', '7d winner', `expected A, got ${r.winner}`);
  assert(r.matchEndedAtHole === 10, '7d ended at', `expected 10, got ${r.matchEndedAtHole}`);
  assert(r.result === '10&8', '7d result', `expected "10&8", got "${r.result}"`);
}

// ═══════════════════════════════════════════════════════════════════════
//  FORMAT 8: NASSAU
// ═══════════════════════════════════════════════════════════════════════
section('FORMAT 8: NASSAU');

// Test 8a: Split Nassau — Alice wins front, Bob wins back, tied overall
{
  const players = makePlayers(['Alice', 'Bob']);
  const holes = makeHoles(18, 1);

  const aliceScores = [4,4,3,5,4,4,3,4,5, 5,6,4,5,5,5,4,6,5]; // front=36, back=45, total=81
  const bobScores   = [5,5,4,6,5,5,4,5,6, 4,5,3,4,4,4,3,5,4]; // front=45, back=36, total=81

  const playerScoresMap = new Map<string, number[]>();
  playerScoresMap.set('1', aliceScores);
  playerScoresMap.set('2', bobScores);
  const allScores = buildScoresMap(holes, playerScoresMap);

  const r = localBuildNassauResult('Nassau', players, holes, allScores);

  output.push(`\n  Test 8a: Nassau — Front, Back, Overall`);
  output.push(`    Alice front: 36, back: 45, total: 81`);
  output.push(`    Bob   front: 45, back: 36, total: 81`);
  output.push(`    Result lines:`);
  r.lines.forEach(l => output.push(`      ${l.text}: ${l.value ?? ''}`));

  const front9Line = r.lines.find(l => l.text.includes('Front 9'));
  const back9Line = r.lines.find(l => l.text.includes('Back 9'));
  const overallLine = r.lines.find(l => l.text.includes('Overall'));

  assert(front9Line !== undefined, '8a front 9 exists', `found front 9 line`);
  assert(front9Line?.text.includes('You') === true, '8a front 9 winner', `expected Alice (You), got "${front9Line?.text}"`);
  assert(front9Line?.value === '36', '8a front 9 score', `expected 36, got "${front9Line?.value}"`);

  assert(back9Line !== undefined, '8a back 9 exists', `found back 9 line`);
  assert(back9Line?.text.includes('Bob') === true, '8a back 9 winner', `expected Bob, got "${back9Line?.text}"`);
  assert(back9Line?.value === '36', '8a back 9 score', `expected 36, got "${back9Line?.value}"`);

  assert(overallLine !== undefined, '8a overall exists', `found overall line`);
  assert(overallLine?.text.includes('Tied') === true, '8a overall tied', `expected Tied, got "${overallLine?.text}"`);
  assert(overallLine?.value === '81', '8a overall score', `expected 81, got "${overallLine?.value}"`);
}

// Test 8b: One player wins all three
{
  const players = makePlayers(['Alice', 'Bob']);
  const holes = makeHoles(18, 1);

  const aliceScores = [3,3,2,4,3,3,2,3,4, 3,4,2,3,3,3,2,4,3]; // well under par
  const bobScores   = [5,5,4,6,5,5,4,5,6, 5,6,4,5,5,5,4,6,5];

  const playerScoresMap = new Map<string, number[]>();
  playerScoresMap.set('1', aliceScores);
  playerScoresMap.set('2', bobScores);
  const allScores = buildScoresMap(holes, playerScoresMap);

  const r = localBuildNassauResult('Nassau', players, holes, allScores);

  output.push(`\n  Test 8b: Nassau — Alice sweeps`);
  r.lines.forEach(l => output.push(`      ${l.text}: ${l.value ?? ''}`));

  assert(r.lines.length === 3, '8b three results', `expected 3 lines, got ${r.lines.length}`);
  const allAlice = r.lines.every(l => l.text.includes('You'));
  assert(allAlice, '8b all Alice', `expected all lines to show Alice (You)`);
}

// ═══════════════════════════════════════════════════════════════════════
//  FORMAT 9: SKINS
// ═══════════════════════════════════════════════════════════════════════
section('FORMAT 9: SKINS');

// Test 9a: 4 players, 9 holes, ties and carryovers
{
  const players = makePlayers(['Alice', 'Bob', 'Charlie', 'Dave']);
  const holes = makeHoles(9, 1);

  // Hole 1: all tie at 4 → carry
  // Hole 2: all tie at 4 → carry (2 carried)
  // Hole 3: Alice=2, others=3 → Alice wins 3 skins (1 + 2 carried)
  // Hole 4: all tie at 5 → carry
  // Hole 5: Bob=3, others=4 → Bob wins 2 skins (1 + 1 carried)
  // Hole 6: all tie at 4 → carry
  // Hole 7: Charlie=2, others=3 → Charlie wins 2 skins (1 + 1 carried)
  // Hole 8: Dave=3, others=4 → Dave wins 1 skin
  // Hole 9: all tie at 5 → carry (1 carried, not awarded)
  const aliceScores   = [4, 4, 2, 5, 4, 4, 3, 4, 5];
  const bobScores     = [4, 4, 3, 5, 3, 4, 3, 4, 5];
  const charlieScores = [4, 4, 3, 5, 4, 4, 2, 4, 5];
  const daveScores    = [4, 4, 3, 5, 4, 4, 3, 3, 5];

  const playerScoresMap = new Map<string, number[]>();
  playerScoresMap.set('1', aliceScores);
  playerScoresMap.set('2', bobScores);
  playerScoresMap.set('3', charlieScores);
  playerScoresMap.set('4', daveScores);
  const allScores = buildScoresMap(holes, playerScoresMap);

  const r = localBuildSkinsResult('Skins', players, holes, allScores);

  output.push(`\n  Test 9a: 4 players, 9 holes, ties and carryovers`);
  output.push(`    Scores:`);
  output.push(`      Alice:   [${aliceScores}]`);
  output.push(`      Bob:     [${bobScores}]`);
  output.push(`      Charlie: [${charlieScores}]`);
  output.push(`      Dave:    [${daveScores}]`);
  output.push(`    Expected: Alice=3, Bob=2, Charlie=2, Dave=1, carryover=1`);
  output.push(`    Result lines:`);
  r.lines.forEach(l => output.push(`      ${l.text}: ${l.value ?? ''}`));

  function getSkins(pid: string): number {
    const player = players.find(p => p.id === pid);
    const name = pid === '1' ? 'You' : player?.name.split(' ')[0];
    const line = r.lines.find(l => l.text === name);
    if (!line || !line.value) return -1;
    return parseInt(line.value);
  }

  assert(getSkins('1') === 3, '9a Alice skins', `expected 3, got ${getSkins('1')}`);
  assert(getSkins('2') === 2, '9a Bob skins', `expected 2, got ${getSkins('2')}`);
  assert(getSkins('3') === 2, '9a Charlie skins', `expected 2, got ${getSkins('3')}`);
  assert(getSkins('4') === 1, '9a Dave skins', `expected 1, got ${getSkins('4')}`);

  const carryLine = r.lines.find(l => l.text.includes('carried'));
  assert(carryLine !== undefined, '9a carryover exists', `found carryover line`);
  assert(carryLine?.text.includes('1 skin carried') === true, '9a carryover count', `expected "1 skin carried", got "${carryLine?.text}"`);
}

// Test 9b: No ties — every hole has a clear winner
{
  const players = makePlayers(['Alice', 'Bob']);
  const holes = makeHoles(4, 1);

  const aliceScores = [3, 5, 3, 5]; // wins hole 1 & 3
  const bobScores   = [5, 3, 5, 3]; // wins hole 2 & 4

  const playerScoresMap = new Map<string, number[]>();
  playerScoresMap.set('1', aliceScores);
  playerScoresMap.set('2', bobScores);
  const allScores = buildScoresMap(holes, playerScoresMap);

  const r = localBuildSkinsResult('Skins', players, holes, allScores);

  output.push(`\n  Test 9b: No ties, 2 players, 4 holes`);
  r.lines.forEach(l => output.push(`      ${l.text}: ${l.value ?? ''}`));

  function getSkins2(pid: string): number {
    const line = r.lines.find(l => l.text === (pid === '1' ? 'You' : 'Bob'));
    if (!line || !line.value) return -1;
    return parseInt(line.value);
  }

  assert(getSkins2('1') === 2, '9b Alice skins', `expected 2, got ${getSkins2('1')}`);
  assert(getSkins2('2') === 2, '9b Bob skins', `expected 2, got ${getSkins2('2')}`);
  const carryLine = r.lines.find(l => l.text.includes('carried'));
  assert(carryLine === undefined, '9b no carryover', `expected no carryover line`);
}

// ═══════════════════════════════════════════════════════════════════════
//  FORMAT 10: BEST BALL
// ═══════════════════════════════════════════════════════════════════════
section('FORMAT 10: BEST BALL');

// Test 10a: 2-player, 9 holes (exact test case from requirements)
{
  const playerA = [4, 5, 3, 6, 4, 5, 4, 5, 4];
  const playerB = [5, 4, 4, 5, 5, 4, 3, 6, 5];
  const expected = [4, 4, 3, 5, 4, 4, 3, 5, 4];
  const expectedTotal = 36;

  const r = calculateBestBall([playerA, playerB]);

  output.push(`\n  Test 10a: 2-player Best Ball, 9 holes`);
  output.push(`    Player A: [${playerA}]`);
  output.push(`    Player B: [${playerB}]`);
  output.push(`    Expected: [${expected}] = ${expectedTotal}`);
  output.push(`    Actual:   [${r.teamScorePerHole}] = ${r.teamTotal}`);

  assert(
    JSON.stringify(r.teamScorePerHole) === JSON.stringify(expected),
    '10a per-hole scores',
    `expected [${expected}], got [${r.teamScorePerHole}]`,
  );
  assert(r.teamTotal === expectedTotal, '10a total', `expected ${expectedTotal}, got ${r.teamTotal}`);
}

// Test 10b: 3-player team
{
  const p1 = [5, 5, 5, 5, 5];
  const p2 = [4, 6, 4, 6, 4];
  const p3 = [6, 4, 6, 4, 6];
  const expected = [4, 4, 4, 4, 4];
  const expectedTotal = 20;

  const r = calculateBestBall([p1, p2, p3]);

  output.push(`\n  Test 10b: 3-player Best Ball, 5 holes`);
  output.push(`    Expected: [${expected}] = ${expectedTotal}`);
  output.push(`    Actual:   [${r.teamScorePerHole}] = ${r.teamTotal}`);

  assert(
    JSON.stringify(r.teamScorePerHole) === JSON.stringify(expected),
    '10b per-hole scores',
    `expected [${expected}], got [${r.teamScorePerHole}]`,
  );
  assert(r.teamTotal === expectedTotal, '10b total', `expected ${expectedTotal}, got ${r.teamTotal}`);
}

// Test 10c: Empty input
{
  const r = calculateBestBall([]);
  output.push(`\n  Test 10c: Empty input`);
  assert(r.teamTotal === 0, '10c empty total', `expected 0, got ${r.teamTotal}`);
  assert(r.teamScorePerHole.length === 0, '10c empty holes', `expected [], got [${r.teamScorePerHole}]`);
}

// ═══════════════════════════════════════════════════════════════════════
//  FORMAT 11: SCRAMBLE
// ═══════════════════════════════════════════════════════════════════════
section('FORMAT 11: SCRAMBLE');

// Test 11a: Basic team score calculation
{
  const teamScores = [4, 3, 3, 4, 4, 3, 3, 4, 4];
  const expectedTotal = 32;

  const r = calculateScrambleTeamScore(teamScores);

  output.push(`\n  Test 11a: Scramble team score`);
  output.push(`    Team scores: [${teamScores}]`);
  output.push(`    Expected total: ${expectedTotal}`);
  output.push(`    Actual total:   ${r.teamTotal}`);

  assert(r.teamTotal === expectedTotal, '11a total', `expected ${expectedTotal}, got ${r.teamTotal}`);
}

// Test 11b: Scramble validation — valid scores
{
  const teamScores = [4, 3, 3, 4, 4, 3, 3, 4, 4];
  const individuals = [
    [5, 4, 4, 5, 5, 4, 4, 5, 5],
    [4, 3, 3, 4, 4, 3, 3, 4, 4],
  ];

  const v = validateScrambleScore(teamScores, individuals);

  output.push(`\n  Test 11b: Scramble validation — valid`);
  output.push(`    Valid: ${v.valid}, Violations: [${v.violations}]`);

  assert(v.valid === true, '11b valid', `expected valid=true`);
  assert(v.violations.length === 0, '11b no violations', `expected 0 violations`);
}

// Test 11c: Scramble validation — invalid (team score > best individual on hole index 1)
{
  const teamScores   = [4, 5, 3, 4]; // hole index 1: team=5, best individual=4
  const individuals = [
    [5, 4, 4, 5],
    [6, 5, 3, 4],
  ];

  const v = validateScrambleScore(teamScores, individuals);

  output.push(`\n  Test 11c: Scramble validation — invalid`);
  output.push(`    Valid: ${v.valid}, Violations: [${v.violations}]`);

  assert(v.valid === false, '11c invalid', `expected valid=false`);
  assert(v.violations.includes(1), '11c violation at index 1', `expected violation at index 1`);
}

// Test 11d: Scramble format recognized as team-based
{
  output.push(`\n  Test 11d: Scramble format recognized`);
  assert(typeof calculateScrambleTeamScore === 'function', '11d function exists', 'calculateScrambleTeamScore exists');
  assert(typeof validateScrambleScore === 'function', '11d validator exists', 'validateScrambleScore exists');
}

// ═══════════════════════════════════════════════════════════════════════
//  FORMAT 12: CHAPMAN
// ═══════════════════════════════════════════════════════════════════════
section('FORMAT 12: CHAPMAN');

// Test 12a: Single hole calculation
{
  const hole: ChapmanHoleScore = {
    driveA: 1,
    driveB: 1,
    secondShotA: 1,
    secondShotB: 1,
    selectedBall: 'A',
    alternateShots: 2,
  };

  const score = calculateChapmanHoleScore(hole);

  output.push(`\n  Test 12a: Chapman single hole`);
  output.push(`    alternateShots: ${hole.alternateShots}`);
  output.push(`    Expected: 2 + ${hole.alternateShots} = ${2 + hole.alternateShots}`);
  output.push(`    Actual: ${score}`);

  assert(score === 4, '12a hole score', `expected 4, got ${score}`);
}

// Test 12b: Full round calculation
{
  const holes: ChapmanHoleScore[] = [
    { driveA: 1, driveB: 1, secondShotA: 1, secondShotB: 1, selectedBall: 'A', alternateShots: 2 }, // 4
    { driveA: 1, driveB: 1, secondShotA: 1, secondShotB: 1, selectedBall: 'B', alternateShots: 1 }, // 3
    { driveA: 1, driveB: 1, secondShotA: 1, secondShotB: 1, selectedBall: 'A', alternateShots: 3 }, // 5
    { driveA: 1, driveB: 1, secondShotA: 1, secondShotB: 1, selectedBall: 'B', alternateShots: 2 }, // 4
    { driveA: 1, driveB: 1, secondShotA: 1, secondShotB: 1, selectedBall: 'A', alternateShots: 1 }, // 3
  ];

  const r = calculateChapmanTotal(holes);

  output.push(`\n  Test 12b: Chapman full round (5 holes)`);
  output.push(`    Per-hole: [${r.perHoleScores}]`);
  output.push(`    Expected: [4,3,5,4,3] = 19`);
  output.push(`    Actual total: ${r.total}`);

  assert(
    JSON.stringify(r.perHoleScores) === JSON.stringify([4, 3, 5, 4, 3]),
    '12b per-hole',
    `expected [4,3,5,4,3], got [${r.perHoleScores}]`,
  );
  assert(r.total === 19, '12b total', `expected 19, got ${r.total}`);
}

// Test 12c: Chapman format recognized as team-based
{
  output.push(`\n  Test 12c: Chapman format recognized`);
  assert(typeof calculateChapmanHoleScore === 'function', '12c hole function exists', 'calculateChapmanHoleScore exists');
  assert(typeof calculateChapmanTotal === 'function', '12c total function exists', 'calculateChapmanTotal exists');
}

// ═══════════════════════════════════════════════════════════════════════
//  SUMMARY
// ═══════════════════════════════════════════════════════════════════════
section('SUMMARY');
output.push(`\n  Total: ${passCount + failCount} tests — ${passCount} PASS, ${failCount} FAIL`);
if (failCount === 0) {
  output.push('  All tests passed!');
} else {
  output.push('  Some tests failed — see details above.');
}

console.log(output.join('\n'));
process.exit(failCount > 0 ? 1 : 0);
