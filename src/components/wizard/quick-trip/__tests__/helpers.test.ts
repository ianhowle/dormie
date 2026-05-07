/**
 * Quick Trip wizard pure helpers — stress test
 *
 * Covers date helpers (Step 2), phone helpers (Step 3), and Step 7
 * helpers (deriveTripName / formatDateRange / summarizeStakesForCinematic
 * / fireFloorReasonCopy).
 *
 * Run with:
 *   npx ts-node --skip-project --compiler-options \
 *     '{"module":"commonjs","target":"es2020","esModuleInterop":true,"moduleResolution":"node","jsx":"react-jsx"}' \
 *     src/components/wizard/quick-trip/__tests__/helpers.test.ts
 */

import {
  toYMD,
  fromYMD,
  todayYMD,
  addDaysYMD,
  tomorrowYMD,
  nextSaturdayYMD,
  formatLongDate,
  daysBetweenYMD,
  countdownLabel,
} from '../dateHelpers';

import { formatUSPhone, digitsOnly } from '../phoneHelpers';

import {
  deriveTripName,
  formatDateRange,
  fireFloorReasonCopy,
  summarizeStakesForCinematic,
} from '../step7Helpers';

import {
  describe,
  expect,
  exitWithStatus,
  it,
  summary,
} from '../../../../__tests__/test-runner';

// =============================================================
// dateHelpers
// =============================================================

describe('toYMD / fromYMD round-trip', () => {
  it('toYMD pads month + day', () => {
    expect(toYMD(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toYMD(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('fromYMD parses local date', () => {
    const d = fromYMD('2026-10-15');
    expect(d).toBeTruthy();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(9); // October (0-indexed)
    expect(d!.getDate()).toBe(15);
  });

  it('fromYMD returns null for invalid input', () => {
    expect(fromYMD('')).toBeNull();
    expect(fromYMD('garbage')).toBeNull();
    expect(fromYMD('2026-13-01')).toBeTruthy(); // permissive — JS Date wraps month 13 → Feb 2027 (caller's problem if they pass garbage)
  });

  it('round trip preserves date', () => {
    const original = '2026-10-15';
    const back = toYMD(fromYMD(original)!);
    expect(back).toBe(original);
  });
});

describe('addDaysYMD', () => {
  it('adds days', () => {
    expect(addDaysYMD('2026-10-15', 1)).toBe('2026-10-16');
    expect(addDaysYMD('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysYMD('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('subtracts via negative', () => {
    expect(addDaysYMD('2026-10-15', -1)).toBe('2026-10-14');
  });

  it('returns input on invalid date', () => {
    expect(addDaysYMD('', 1)).toBe('');
    expect(addDaysYMD('garbage', 1)).toBe('garbage');
  });
});

describe('tomorrowYMD', () => {
  it('is exactly 1 day after today', () => {
    expect(daysBetweenYMD(todayYMD(), tomorrowYMD())).toBe(1);
  });
});

describe('nextSaturdayYMD', () => {
  it('returns a Saturday', () => {
    const d = fromYMD(nextSaturdayYMD());
    expect(d!.getDay()).toBe(6); // Saturday
  });

  it('is in the future (≥ 1 day ahead per spec — skips today if Saturday)', () => {
    const days = daysBetweenYMD(todayYMD(), nextSaturdayYMD());
    expect(days).toBeGreaterThanOrEqual(1);
    expect(days).toBeLessThanOrEqual(7);
  });
});

describe('daysBetweenYMD', () => {
  it('zero for same date', () => {
    expect(daysBetweenYMD('2026-10-15', '2026-10-15')).toBe(0);
  });
  it('positive for future', () => {
    expect(daysBetweenYMD('2026-10-15', '2026-10-20')).toBe(5);
  });
  it('negative for past', () => {
    expect(daysBetweenYMD('2026-10-15', '2026-10-10')).toBe(-5);
  });
  it('zero on invalid input', () => {
    expect(daysBetweenYMD('', '2026-10-15')).toBe(0);
  });
});

describe('countdownLabel', () => {
  it('TODAY for today', () => {
    expect(countdownLabel(todayYMD())).toBe('TODAY');
  });
  it('TOMORROW for tomorrow', () => {
    expect(countdownLabel(tomorrowYMD())).toBe('TOMORROW');
  });
  it('T-N DAYS for future > 1', () => {
    const future = addDaysYMD(todayYMD(), 10);
    expect(countdownLabel(future)).toMatch(/^T−\d+ DAYS$/);
  });
  it('N DAYS AGO for past', () => {
    const past = addDaysYMD(todayYMD(), -5);
    expect(countdownLabel(past)).toMatch(/DAYS AGO$/);
  });
});

describe('formatLongDate', () => {
  it('formats with weekday + month + day + year', () => {
    const out = formatLongDate('2026-10-15');
    expect(out).toContain('October');
    expect(out).toContain('15');
    expect(out).toContain('2026');
  });
  it('returns empty on invalid', () => {
    expect(formatLongDate('')).toBe('');
  });
});

// =============================================================
// phoneHelpers
// =============================================================

describe('formatUSPhone', () => {
  it('empty input → empty', () => {
    expect(formatUSPhone('')).toBe('');
  });
  it('1 digit → "(N"', () => {
    expect(formatUSPhone('5')).toBe('(5');
  });
  it('3 digits → "(NNN"', () => {
    expect(formatUSPhone('555')).toBe('(555');
  });
  it('6 digits → "(NNN) NNN"', () => {
    expect(formatUSPhone('555123')).toBe('(555) 123');
  });
  it('10 digits → "(NNN) NNN-NNNN"', () => {
    expect(formatUSPhone('5551234567')).toBe('(555) 123-4567');
  });
  it('strips non-digits', () => {
    expect(formatUSPhone('555.123.4567')).toBe('(555) 123-4567');
    expect(formatUSPhone('(555) 123-4567')).toBe('(555) 123-4567'); // idempotent
  });
  it('truncates to 10 digits', () => {
    expect(formatUSPhone('55512345678901')).toBe('(555) 123-4567');
  });
});

describe('digitsOnly', () => {
  it('strips non-digits', () => {
    expect(digitsOnly('(555) 123-4567')).toBe('5551234567');
    expect(digitsOnly('abc 555 def')).toBe('555');
    expect(digitsOnly('')).toBe('');
  });
});

// =============================================================
// step7Helpers
// =============================================================

describe('deriveTripName', () => {
  it('combines course + month + year', () => {
    expect(deriveTripName('Pinehurst', '2026-10-15')).toBe('Pinehurst Oct 2026');
  });
  it('handles long course names', () => {
    expect(deriveTripName('Pinehurst Resort', '2026-10-15')).toBe(
      'Pinehurst Resort Oct 2026',
    );
  });
  it('returns empty when courseName empty', () => {
    expect(deriveTripName('', '2026-10-15')).toBe('');
  });
  it('returns just course when date invalid', () => {
    expect(deriveTripName('Pinehurst', '')).toBe('Pinehurst');
  });
});

describe('formatDateRange', () => {
  it('formats single-day Quick Trip date', () => {
    const out = formatDateRange('2026-10-15');
    expect(out).toContain('Oct');
    expect(out).toContain('15');
    expect(out).toContain('2026');
  });
  it('returns empty on invalid', () => {
    expect(formatDateRange('')).toBe('');
  });
});

describe('summarizeStakesForCinematic', () => {
  it('null format → undefined (cinematic falls back to defaultStakes)', () => {
    expect(summarizeStakesForCinematic(null, [], {})).toBeUndefined();
  });

  it('format only, no stake → format label uppercase', () => {
    expect(summarizeStakesForCinematic('stroke_play', [], {})).toBe('STROKE PLAY');
  });

  it('format + amount → "FORMAT · $N"', () => {
    expect(
      summarizeStakesForCinematic(
        'stroke_play',
        [],
        {
          stroke_play: { amount: 20, config: { kind: 'none' } },
        },
      ),
    ).toBe('STROKE PLAY · $20');
  });

  it('amount of 0 → no $ suffix', () => {
    expect(
      summarizeStakesForCinematic(
        'stroke_play',
        [],
        {
          stroke_play: { amount: 0, config: { kind: 'none' } },
        },
      ),
    ).toBe('STROKE PLAY');
  });

  it('1 side game → "FORMAT + GAME"', () => {
    expect(
      summarizeStakesForCinematic('stroke_play', ['skins'], {}),
    ).toBe('STROKE PLAY + SKINS');
  });

  it('2 side games → "FORMAT + GAME1 + GAME2"', () => {
    expect(
      summarizeStakesForCinematic('stroke_play', ['skins', 'snake'], {}),
    ).toBe('STROKE PLAY + SKINS + SNAKE');
  });

  it('3+ side games → "FORMAT + N GAMES" summary', () => {
    expect(
      summarizeStakesForCinematic(
        'stroke_play',
        ['skins', 'snake', 'wolf', 'dots'],
        {},
      ),
    ).toBe('STROKE PLAY + 4 GAMES');
  });

  it('full combo: amount + 2 side games', () => {
    expect(
      summarizeStakesForCinematic(
        'stroke_play',
        ['skins', 'nassau'],
        {
          stroke_play: { amount: 20, config: { kind: 'none' } },
        },
      ),
    ).toBe('STROKE PLAY · $20 + SKINS + NASSAU');
  });

  it('returns single-line string fit for cinematic stakes prop', () => {
    const out = summarizeStakesForCinematic(
      'stroke_play',
      ['skins'],
      { stroke_play: { amount: 20, config: { kind: 'none' } } },
    );
    expect(out).toBeTruthy();
    expect((out ?? '').includes('\n')).toBeFalsy();
  });
});

describe('fireFloorReasonCopy', () => {
  it('identity → "Add a destination to launch"', () => {
    expect(fireFloorReasonCopy('identity')).toBe('Add a destination to launch');
  });
  it('time → "Add a date to launch"', () => {
    expect(fireFloorReasonCopy('time')).toBe('Add a date to launch');
  });
  it('people → "Add at least yourself to launch"', () => {
    expect(fireFloorReasonCopy('people')).toBe(
      'Add at least yourself to launch',
    );
  });
});

// =============================================================

summary('quick-trip pure helpers');
exitWithStatus();
