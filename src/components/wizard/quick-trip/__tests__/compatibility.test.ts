/**
 * Compatibility helper — stress test
 *
 * Covers checkFormatCompatibility() against:
 *   - All three PlayerRequirement.type values (min / exact / recommended)
 *   - Edge cases: 0 players, very high counts, missing playerRequirement
 *   - Every entry in SCORING_FORMATS (15) at representative player counts
 *   - Every entry in SIDE_GAMES (17) at representative player counts
 *
 * Run with:
 *   npx ts-node --skip-project --compiler-options \
 *     '{"module":"commonjs","target":"es2020","esModuleInterop":true,"moduleResolution":"node","jsx":"react-jsx"}' \
 *     src/components/wizard/quick-trip/__tests__/compatibility.test.ts
 */

import {
  checkFormatCompatibility,
  type CompatibilityResult,
} from '../compatibility';
import {
  SCORING_FORMATS,
  SIDE_GAMES,
} from '../../../../data/scoring';

import {
  describe,
  expect,
  exitWithStatus,
  it,
  summary,
} from '../../../../__tests__/test-runner';

// =============================================================
// Type 'min' — minimum N players, no upper bound
// =============================================================

describe('checkFormatCompatibility — min type', () => {
  const minOne = { playerRequirement: { type: 'min' as const, count: 1 } };
  const minTwo = { playerRequirement: { type: 'min' as const, count: 2 } };
  const minThree = { playerRequirement: { type: 'min' as const, count: 3 } };

  it('exact match → compatible', () => {
    const r = checkFormatCompatibility(minOne, 1);
    expect(r.state).toBe('compatible');
    expect(r.message).toBeUndefined();
  });

  it('above the minimum → compatible', () => {
    expect(checkFormatCompatibility(minTwo, 4).state).toBe('compatible');
    expect(checkFormatCompatibility(minThree, 12).state).toBe('compatible');
  });

  it('below the minimum → locked-too-few', () => {
    const r = checkFormatCompatibility(minTwo, 1);
    expect(r.state).toBe('locked-too-few');
    expect(r.message).toBe('REQUIRES 2+ PLAYERS · YOU HAVE 1');
  });

  it('zero players → locked when min is 1+', () => {
    const r = checkFormatCompatibility(minOne, 0);
    expect(r.state).toBe('locked-too-few');
    expect(r.message).toBe('REQUIRES 1+ PLAYER · YOU HAVE 0');
  });

  it('singular pluralization at count 1', () => {
    const r = checkFormatCompatibility(minOne, 0);
    expect(r.message).toContain('1+ PLAYER ·');
    expect((r.message ?? '').includes('PLAYERS')).toBeFalsy();
  });

  it('plural pluralization at count > 1', () => {
    const r = checkFormatCompatibility(minThree, 2);
    expect(r.message).toContain('3+ PLAYERS ·');
  });
});

// =============================================================
// Type 'exact' — exactly N players
// =============================================================

describe('checkFormatCompatibility — exact type', () => {
  const exact4 = { playerRequirement: { type: 'exact' as const, count: 4 } };
  const exact2 = { playerRequirement: { type: 'exact' as const, count: 2 } };

  it('exact match → compatible', () => {
    expect(checkFormatCompatibility(exact4, 4).state).toBe('compatible');
    expect(checkFormatCompatibility(exact2, 2).state).toBe('compatible');
  });

  it('off by one (low) → locked', () => {
    const r = checkFormatCompatibility(exact4, 3);
    expect(r.state).toBe('locked-too-few');
    expect(r.message).toBe('REQUIRES 4 PLAYERS · YOU HAVE 3');
  });

  it('off by one (high) → locked', () => {
    const r = checkFormatCompatibility(exact4, 5);
    expect(r.state).toBe('locked-too-few');
    expect(r.message).toBe('REQUIRES 4 PLAYERS · YOU HAVE 5');
  });

  it('off by many (low) → locked', () => {
    const r = checkFormatCompatibility(exact4, 1);
    expect(r.state).toBe('locked-too-few');
    expect(r.message).toBe('REQUIRES 4 PLAYERS · YOU HAVE 1');
  });

  it('off by many (high) → locked', () => {
    const r = checkFormatCompatibility(exact4, 12);
    expect(r.state).toBe('locked-too-few');
    expect(r.message).toBe('REQUIRES 4 PLAYERS · YOU HAVE 12');
  });
});

// =============================================================
// Type 'recommended' — N is canonical, mismatch is advisory
// =============================================================

describe('checkFormatCompatibility — recommended type', () => {
  const rec4 = { playerRequirement: { type: 'recommended' as const, count: 4 } };
  const rec4WithRange = {
    playerRequirement: { type: 'recommended' as const, count: 4, range: '2-4' },
  };

  it('exact match → compatible (no advisory tag)', () => {
    const r = checkFormatCompatibility(rec4, 4);
    expect(r.state).toBe('compatible');
    expect(r.message).toBeUndefined();
  });

  it('mismatch without range → recommended-mismatch with short tag', () => {
    const r = checkFormatCompatibility(rec4, 6);
    expect(r.state).toBe('recommended-mismatch');
    expect(r.message).toBe('BEST WITH 4 PLAYERS');
  });

  it('mismatch with range → tag includes WORKS WITH range', () => {
    const r = checkFormatCompatibility(rec4WithRange, 2);
    expect(r.state).toBe('recommended-mismatch');
    expect(r.message).toBe('BEST WITH 4 PLAYERS · WORKS WITH 2-4');
  });

  it('range presented uppercase regardless of source casing', () => {
    const lower = {
      playerRequirement: {
        type: 'recommended' as const,
        count: 4,
        range: 'two to four',
      },
    };
    const r = checkFormatCompatibility(lower, 2);
    expect(r.message).toBe('BEST WITH 4 PLAYERS · WORKS WITH TWO TO FOUR');
  });

  it('mismatch fires for both below and above count', () => {
    expect(checkFormatCompatibility(rec4, 2).state).toBe('recommended-mismatch');
    expect(checkFormatCompatibility(rec4, 8).state).toBe('recommended-mismatch');
  });
});

// =============================================================
// Defensive cases
// =============================================================

describe('checkFormatCompatibility — defensive', () => {
  it('missing playerRequirement → compatible', () => {
    const r = checkFormatCompatibility({}, 4);
    expect(r.state).toBe('compatible');
  });

  it('very high player count vs min → still compatible', () => {
    const r = checkFormatCompatibility(
      { playerRequirement: { type: 'min', count: 1 } },
      1000,
    );
    expect(r.state).toBe('compatible');
  });
});

// =============================================================
// Catalog matrix — every format at representative counts
// =============================================================

describe('SCORING_FORMATS at representative player counts', () => {
  // For each format, verify the result transitions sensibly across
  // the 1–12 player range. This is a regression net: a future change
  // to a playerRequirement value will jump out of the table here.

  const counts = [1, 2, 3, 4, 6, 8, 12];

  it('every format produces a defined state at counts 1, 2, 3, 4, 6, 8, 12', () => {
    for (const fmt of SCORING_FORMATS) {
      for (const n of counts) {
        const r = checkFormatCompatibility(fmt, n);
        // Result is always one of three valid states
        expect(
          r.state === 'compatible' ||
            r.state === 'recommended-mismatch' ||
            r.state === 'locked-too-few',
        ).toBeTruthy();
      }
    }
  });

  it('stroke_play is compatible at every count ≥ 1', () => {
    const fmt = SCORING_FORMATS.find((f) => f.key === 'stroke_play')!;
    for (const n of [1, 2, 3, 4, 6, 8, 12]) {
      expect(checkFormatCompatibility(fmt, n).state).toBe('compatible');
    }
  });

  it('match_play requires 2+ players (locked at 1)', () => {
    const fmt = SCORING_FORMATS.find((f) => f.key === 'match_play')!;
    expect(checkFormatCompatibility(fmt, 1).state).toBe('locked-too-few');
    expect(checkFormatCompatibility(fmt, 2).state).toBe('compatible');
    expect(checkFormatCompatibility(fmt, 4).state).toBe('compatible');
  });

  it('wolf locks at anything other than exactly 4', () => {
    const fmt = SCORING_FORMATS.find((f) => f.key === 'wolf')!;
    expect(checkFormatCompatibility(fmt, 1).state).toBe('locked-too-few');
    expect(checkFormatCompatibility(fmt, 3).state).toBe('locked-too-few');
    expect(checkFormatCompatibility(fmt, 4).state).toBe('compatible');
    expect(checkFormatCompatibility(fmt, 5).state).toBe('locked-too-few');
  });

  it('alternate_shot / chapman / greensomes / pinehurst / sixsixsix / low_high all lock unless exactly 4', () => {
    const exactly4Keys = [
      'alternate_shot',
      'chapman',
      'greensomes',
      'pinehurst',
      'sixsixsix',
      'low_high',
    ] as const;
    for (const key of exactly4Keys) {
      const fmt = SCORING_FORMATS.find((f) => f.key === key)!;
      expect(checkFormatCompatibility(fmt, 4).state).toBe('compatible');
      expect(checkFormatCompatibility(fmt, 3).state).toBe('locked-too-few');
      expect(checkFormatCompatibility(fmt, 5).state).toBe('locked-too-few');
    }
  });

  it('fourball / best_ball / shamble are recommended-4 (advisory at other counts)', () => {
    const recommendedKeys = ['fourball', 'best_ball', 'shamble'] as const;
    for (const key of recommendedKeys) {
      const fmt = SCORING_FORMATS.find((f) => f.key === key)!;
      expect(checkFormatCompatibility(fmt, 4).state).toBe('compatible');
      expect(checkFormatCompatibility(fmt, 2).state).toBe('recommended-mismatch');
      expect(checkFormatCompatibility(fmt, 8).state).toBe('recommended-mismatch');
    }
  });

  it('scramble is recommended-4 with range 2-4 advisory', () => {
    const fmt = SCORING_FORMATS.find((f) => f.key === 'scramble')!;
    expect(checkFormatCompatibility(fmt, 4).state).toBe('compatible');
    const r = checkFormatCompatibility(fmt, 2);
    expect(r.state).toBe('recommended-mismatch');
    expect(r.message).toContain('WORKS WITH 2-4');
  });
});

describe('SIDE_GAMES at representative player counts', () => {
  it('every side game produces a defined state at counts 1, 2, 3, 4', () => {
    for (const sg of SIDE_GAMES) {
      for (const n of [1, 2, 3, 4]) {
        const r = checkFormatCompatibility(sg, n);
        expect(
          r.state === 'compatible' ||
            r.state === 'recommended-mismatch' ||
            r.state === 'locked-too-few',
        ).toBeTruthy();
      }
    }
  });

  it('solo-achievement side games (sandies / bark / arnies / hogans / murphys / poleys) are compatible at 1+', () => {
    const soloKeys = ['sandies', 'bark', 'arnies', 'hogans', 'murphys', 'poleys'] as const;
    for (const key of soloKeys) {
      const sg = SIDE_GAMES.find((g) => g.key === key)!;
      expect(checkFormatCompatibility(sg, 1).state).toBe('compatible');
      expect(checkFormatCompatibility(sg, 4).state).toBe('compatible');
    }
  });

  it('skins / nassau / hammer / snake / greenies / KP / 3-putt poker / trash / dots require 2+', () => {
    const minTwoKeys = [
      'skins',
      'nassau',
      'hammer',
      'snake',
      'greenies',
      'close_shave',
      'three_putt_poker',
      'trash',
      'dots',
    ] as const;
    for (const key of minTwoKeys) {
      const sg = SIDE_GAMES.find((g) => g.key === key)!;
      expect(checkFormatCompatibility(sg, 1).state).toBe('locked-too-few');
      expect(checkFormatCompatibility(sg, 2).state).toBe('compatible');
    }
  });

  it('bingo_bango_bongo requires 3+', () => {
    const sg = SIDE_GAMES.find((g) => g.key === 'bingo_bango_bongo')!;
    expect(checkFormatCompatibility(sg, 1).state).toBe('locked-too-few');
    expect(checkFormatCompatibility(sg, 2).state).toBe('locked-too-few');
    expect(checkFormatCompatibility(sg, 3).state).toBe('compatible');
    expect(checkFormatCompatibility(sg, 4).state).toBe('compatible');
  });

  it('wolf side game requires exactly 4 (matches format-row contract)', () => {
    const sg = SIDE_GAMES.find((g) => g.key === 'wolf')!;
    expect(checkFormatCompatibility(sg, 3).state).toBe('locked-too-few');
    expect(checkFormatCompatibility(sg, 4).state).toBe('compatible');
    expect(checkFormatCompatibility(sg, 5).state).toBe('locked-too-few');
  });
});

// =============================================================
// Result shape contract
// =============================================================

describe('CompatibilityResult shape', () => {
  it('compatible result has no message', () => {
    const r: CompatibilityResult = checkFormatCompatibility(
      { playerRequirement: { type: 'min', count: 1 } },
      1,
    );
    expect(r.message).toBeUndefined();
  });

  it('non-compatible results always have a message', () => {
    const lockedTooFew = checkFormatCompatibility(
      { playerRequirement: { type: 'exact', count: 4 } },
      2,
    );
    expect(lockedTooFew.message).toBeTruthy();

    const recMismatch = checkFormatCompatibility(
      { playerRequirement: { type: 'recommended', count: 4 } },
      2,
    );
    expect(recMismatch.message).toBeTruthy();
  });
});

// =============================================================

summary('compatibility helper');
exitWithStatus();
