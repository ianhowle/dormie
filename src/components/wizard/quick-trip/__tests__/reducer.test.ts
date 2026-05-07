/**
 * Wizard reducer + computeCanAdvance — stress test
 *
 * Run with:
 *   npx ts-node --skip-project --compiler-options \
 *     '{"module":"commonjs","target":"es2020","esModuleInterop":true,"moduleResolution":"node"}' \
 *     src/components/wizard/quick-trip/__tests__/reducer.test.ts
 */

import {
  INITIAL_WIZARD_STATE,
  TOTAL_WIZARD_STEPS,
  computeCanAdvance,
  wizardReducer,
  type WizardAction,
  type WizardState,
} from '../WizardContext';

import {
  describe,
  expect,
  exitWithStatus,
  it,
  summary,
} from '../../../../__tests__/test-runner';

const r = wizardReducer;
const init: WizardState = INITIAL_WIZARD_STATE;

// =============================================================
// Initial state
// =============================================================

describe('initialState', () => {
  it('starts at step 0', () => {
    expect(init.step).toBe(0);
  });
  it('persona null', () => {
    expect(init.persona).toBeNull();
  });
  it('course null', () => {
    expect(init.course).toBeNull();
  });
  it('empty dates', () => {
    expect(init.startDate).toBe('');
    expect(init.endDate).toBe('');
  });
  it('empty players', () => {
    expect(init.players.length).toBe(0);
  });
  it('format null, empty side games + perGameStakes', () => {
    expect(init.format).toBeNull();
    expect(init.sideGames.length).toBe(0);
    expect(Object.keys(init.perGameStakes).length).toBe(0);
  });
  it('trip name unset', () => {
    expect(init.tripName).toBe('');
    expect(init.tripNameOverridden).toBeFalsy();
  });
});

// =============================================================
// Navigation actions
// =============================================================

describe('NEXT_STEP / PREV_STEP / GOTO_STEP', () => {
  it('NEXT_STEP increments cursor', () => {
    const s1 = r(init, { type: 'NEXT_STEP' });
    expect(s1.step).toBe(1);
  });

  it('NEXT_STEP clamps at last step', () => {
    let s: WizardState = { ...init, step: TOTAL_WIZARD_STEPS - 1 };
    s = r(s, { type: 'NEXT_STEP' });
    expect(s.step).toBe(TOTAL_WIZARD_STEPS - 1);
  });

  it('PREV_STEP decrements cursor', () => {
    let s: WizardState = { ...init, step: 3 };
    s = r(s, { type: 'PREV_STEP' });
    expect(s.step).toBe(2);
  });

  it('PREV_STEP clamps at step 0', () => {
    const s = r(init, { type: 'PREV_STEP' });
    expect(s.step).toBe(0);
  });

  it('GOTO_STEP jumps to target', () => {
    const s = r(init, { type: 'GOTO_STEP', step: 5 });
    expect(s.step).toBe(5);
  });

  it('GOTO_STEP clamps below 0', () => {
    const s = r(init, { type: 'GOTO_STEP', step: -3 });
    expect(s.step).toBe(0);
  });

  it('GOTO_STEP clamps above last', () => {
    const s = r(init, { type: 'GOTO_STEP', step: 99 });
    expect(s.step).toBe(TOTAL_WIZARD_STEPS - 1);
  });
});

// =============================================================
// SELECT_PERSONA
// =============================================================

describe('SELECT_PERSONA', () => {
  it('sets quick', () => {
    const s = r(init, { type: 'SELECT_PERSONA', persona: 'quick' });
    expect(s.persona).toBe('quick');
  });
  it('sets plan', () => {
    const s = r(init, { type: 'SELECT_PERSONA', persona: 'plan' });
    expect(s.persona).toBe('plan');
  });
  it('sets ryder', () => {
    const s = r(init, { type: 'SELECT_PERSONA', persona: 'ryder' });
    expect(s.persona).toBe('ryder');
  });
  it('clears via null', () => {
    const seeded: WizardState = { ...init, persona: 'quick' };
    const s = r(seeded, { type: 'SELECT_PERSONA', persona: null });
    expect(s.persona).toBeNull();
  });
});

// =============================================================
// SET_COURSE
// =============================================================

describe('SET_COURSE', () => {
  it('sets a catalog course', () => {
    const s = r(init, {
      type: 'SET_COURSE',
      course: { id: 'c1', name: 'Pinehurst', city: 'Pinehurst', state: 'NC' },
    });
    expect(s.course?.id).toBe('c1');
    expect(s.course?.name).toBe('Pinehurst');
  });

  it('sets a free-text course (no id)', () => {
    const s = r(init, {
      type: 'SET_COURSE',
      course: { name: 'My Local Muni', source: 'free-text' },
    });
    expect(s.course?.id).toBeUndefined();
    expect(s.course?.name).toBe('My Local Muni');
  });

  it('clears via null', () => {
    const seeded: WizardState = {
      ...init,
      course: { id: 'c1', name: 'Pinehurst' },
    };
    const s = r(seeded, { type: 'SET_COURSE', course: null });
    expect(s.course).toBeNull();
  });
});

// =============================================================
// SET_DATES
// =============================================================

describe('SET_DATES', () => {
  it('sets start + end', () => {
    const s = r(init, {
      type: 'SET_DATES',
      startDate: '2026-10-15',
      endDate: '2026-10-15',
    });
    expect(s.startDate).toBe('2026-10-15');
    expect(s.endDate).toBe('2026-10-15');
  });

  it('Quick Trip mirrors end = start', () => {
    const s = r(init, {
      type: 'SET_DATES',
      startDate: '2026-10-15',
      endDate: '2026-10-15',
    });
    expect(s.startDate).toBe(s.endDate);
  });
});

// =============================================================
// Player actions
// =============================================================

describe('SET_PLAYERS / ADD_PLAYER / REMOVE_PLAYER', () => {
  const self = {
    id: 'u-self',
    name: 'Ian',
    deliveryMethod: 'self' as const,
    user_id: 'u-self',
  };
  const drew = {
    id: 'u-drew',
    name: 'Drew',
    deliveryMethod: 'dormie' as const,
    user_id: 'u-drew',
  };

  it('SET_PLAYERS replaces the array', () => {
    const s = r(init, { type: 'SET_PLAYERS', players: [self, drew] });
    expect(s.players.length).toBe(2);
  });

  it('ADD_PLAYER appends', () => {
    let s = r(init, { type: 'ADD_PLAYER', player: self });
    s = r(s, { type: 'ADD_PLAYER', player: drew });
    expect(s.players.length).toBe(2);
    expect(s.players[0].name).toBe('Ian');
    expect(s.players[1].name).toBe('Drew');
  });

  it('ADD_PLAYER de-dupes on id', () => {
    let s = r(init, { type: 'ADD_PLAYER', player: self });
    s = r(s, { type: 'ADD_PLAYER', player: self }); // re-add same id
    expect(s.players.length).toBe(1);
  });

  it('REMOVE_PLAYER drops a non-self player', () => {
    let s = r(init, { type: 'ADD_PLAYER', player: self });
    s = r(s, { type: 'ADD_PLAYER', player: drew });
    s = r(s, { type: 'REMOVE_PLAYER', playerId: 'u-drew' });
    expect(s.players.length).toBe(1);
    expect(s.players[0].name).toBe('Ian');
  });

  it('REMOVE_PLAYER refuses to remove self (defensive)', () => {
    let s = r(init, { type: 'ADD_PLAYER', player: self });
    s = r(s, { type: 'REMOVE_PLAYER', playerId: 'u-self' });
    expect(s.players.length).toBe(1);
    expect(s.players[0].deliveryMethod).toBe('self');
  });

  it('REMOVE_PLAYER no-op for unknown id', () => {
    let s = r(init, { type: 'ADD_PLAYER', player: self });
    s = r(s, { type: 'REMOVE_PLAYER', playerId: 'nope' });
    expect(s.players.length).toBe(1);
  });
});

// =============================================================
// SET_FORMAT
// =============================================================

describe('SET_FORMAT', () => {
  it('sets format', () => {
    const s = r(init, { type: 'SET_FORMAT', format: 'stableford' });
    expect(s.format).toBe('stableford');
  });
  it('replaces on subsequent set', () => {
    let s = r(init, { type: 'SET_FORMAT', format: 'stroke_play' });
    s = r(s, { type: 'SET_FORMAT', format: 'match_play' });
    expect(s.format).toBe('match_play');
  });
});

// =============================================================
// Side game actions
// =============================================================

describe('SET_SIDE_GAMES / TOGGLE_SIDE_GAME / ADD_SIDE_GAME / CLEAR_SIDE_GAMES', () => {
  it('SET_SIDE_GAMES replaces', () => {
    const s = r(init, { type: 'SET_SIDE_GAMES', sideGames: ['skins', 'snake'] });
    expect(s.sideGames).toEqual(['skins', 'snake']);
  });

  it('TOGGLE_SIDE_GAME adds when missing', () => {
    const s = r(init, { type: 'TOGGLE_SIDE_GAME', sideGame: 'skins' });
    expect(s.sideGames).toEqual(['skins']);
  });

  it('TOGGLE_SIDE_GAME removes when present', () => {
    let s = r(init, { type: 'TOGGLE_SIDE_GAME', sideGame: 'skins' });
    s = r(s, { type: 'TOGGLE_SIDE_GAME', sideGame: 'skins' });
    expect(s.sideGames).toEqual([]);
  });

  it('TOGGLE preserves other selections', () => {
    let s = r(init, { type: 'TOGGLE_SIDE_GAME', sideGame: 'skins' });
    s = r(s, { type: 'TOGGLE_SIDE_GAME', sideGame: 'snake' });
    s = r(s, { type: 'TOGGLE_SIDE_GAME', sideGame: 'skins' }); // remove skins
    expect(s.sideGames).toEqual(['snake']);
  });

  it('ADD_SIDE_GAME is additive (no remove)', () => {
    let s = r(init, { type: 'ADD_SIDE_GAME', sideGame: 'skins' });
    s = r(s, { type: 'ADD_SIDE_GAME', sideGame: 'skins' });
    expect(s.sideGames).toEqual(['skins']); // de-dupes
  });

  it('ADD_SIDE_GAME preserves existing', () => {
    let s = r(init, { type: 'ADD_SIDE_GAME', sideGame: 'snake' });
    s = r(s, { type: 'ADD_SIDE_GAME', sideGame: 'skins' });
    expect(s.sideGames).toEqual(['snake', 'skins']);
  });

  it('CLEAR_SIDE_GAMES wipes', () => {
    let s = r(init, { type: 'SET_SIDE_GAMES', sideGames: ['skins', 'snake'] });
    s = r(s, { type: 'CLEAR_SIDE_GAMES' });
    expect(s.sideGames).toEqual([]);
  });
});

// =============================================================
// Per-game stake actions
// =============================================================

describe('SET_PER_GAME_STAKE / CLEAR_PER_GAME_STAKE / CLEAR_STAKES', () => {
  it('SET_PER_GAME_STAKE adds an entry', () => {
    const s = r(init, {
      type: 'SET_PER_GAME_STAKE',
      key: 'stroke_play',
      stake: { amount: 20, config: { kind: 'none' } },
    });
    expect(s.perGameStakes.stroke_play.amount).toBe(20);
  });

  it('SET_PER_GAME_STAKE replaces existing entry', () => {
    let s = r(init, {
      type: 'SET_PER_GAME_STAKE',
      key: 'stroke_play',
      stake: { amount: 20, config: { kind: 'none' } },
    });
    s = r(s, {
      type: 'SET_PER_GAME_STAKE',
      key: 'stroke_play',
      stake: { amount: 50, config: { kind: 'none' } },
    });
    expect(s.perGameStakes.stroke_play.amount).toBe(50);
  });

  it('SET_PER_GAME_STAKE preserves other entries', () => {
    let s = r(init, {
      type: 'SET_PER_GAME_STAKE',
      key: 'stroke_play',
      stake: { amount: 20, config: { kind: 'none' } },
    });
    s = r(s, {
      type: 'SET_PER_GAME_STAKE',
      key: 'skins',
      stake: { amount: 1, config: { kind: 'skinsCarryOver', skins: { carryOver: true } } },
    });
    expect(Object.keys(s.perGameStakes).length).toBe(2);
  });

  it('CLEAR_PER_GAME_STAKE removes one entry', () => {
    let s = r(init, {
      type: 'SET_PER_GAME_STAKE',
      key: 'stroke_play',
      stake: { amount: 20, config: { kind: 'none' } },
    });
    s = r(s, {
      type: 'SET_PER_GAME_STAKE',
      key: 'skins',
      stake: { amount: 1, config: { kind: 'skinsCarryOver', skins: { carryOver: true } } },
    });
    s = r(s, { type: 'CLEAR_PER_GAME_STAKE', key: 'stroke_play' });
    expect(s.perGameStakes.stroke_play).toBeUndefined();
    expect(s.perGameStakes.skins).toBeTruthy();
  });

  it('CLEAR_STAKES wipes all', () => {
    let s = r(init, {
      type: 'SET_PER_GAME_STAKE',
      key: 'stroke_play',
      stake: { amount: 20, config: { kind: 'none' } },
    });
    s = r(s, {
      type: 'SET_PER_GAME_STAKE',
      key: 'skins',
      stake: { amount: 1, config: { kind: 'skinsCarryOver', skins: { carryOver: true } } },
    });
    s = r(s, { type: 'CLEAR_STAKES' });
    expect(Object.keys(s.perGameStakes).length).toBe(0);
  });
});

// =============================================================
// SET_TRIP_NAME
// =============================================================

describe('SET_TRIP_NAME', () => {
  it('sets name', () => {
    const s = r(init, { type: 'SET_TRIP_NAME', name: 'Big Dawgs 2026' });
    expect(s.tripName).toBe('Big Dawgs 2026');
  });

  it('flips overridden flag', () => {
    const s = r(init, { type: 'SET_TRIP_NAME', name: 'Custom' });
    expect(s.tripNameOverridden).toBeTruthy();
  });
});

// =============================================================
// State persistence across navigation (no action should clobber data)
// =============================================================

describe('state persistence across step transitions', () => {
  it('NEXT_STEP / PREV_STEP do not clobber data', () => {
    let s = r(init, {
      type: 'SET_COURSE',
      course: { id: 'c1', name: 'Pinehurst' },
    });
    s = r(s, { type: 'SET_DATES', startDate: '2026-10-15', endDate: '2026-10-15' });
    s = r(s, { type: 'SET_FORMAT', format: 'stroke_play' });
    s = r(s, { type: 'NEXT_STEP' });
    s = r(s, { type: 'NEXT_STEP' });
    s = r(s, { type: 'PREV_STEP' });
    expect(s.course?.name).toBe('Pinehurst');
    expect(s.startDate).toBe('2026-10-15');
    expect(s.format).toBe('stroke_play');
  });
});

// =============================================================
// computeCanAdvance — per-step gates
// =============================================================

describe('computeCanAdvance', () => {
  it('Step 0: only true when persona === quick', () => {
    expect(computeCanAdvance({ ...init, step: 0, persona: null })).toBeFalsy();
    expect(computeCanAdvance({ ...init, step: 0, persona: 'plan' })).toBeFalsy();
    expect(computeCanAdvance({ ...init, step: 0, persona: 'ryder' })).toBeFalsy();
    expect(computeCanAdvance({ ...init, step: 0, persona: 'quick' })).toBeTruthy();
  });

  it('Step 1: catalog match (course.id) → true', () => {
    expect(
      computeCanAdvance({
        ...init,
        step: 1,
        course: { id: 'c1', name: 'P' },
      }),
    ).toBeTruthy();
  });

  it('Step 1: free-text ≥3 chars → true', () => {
    expect(
      computeCanAdvance({
        ...init,
        step: 1,
        course: { name: 'Abc' },
      }),
    ).toBeTruthy();
  });

  it('Step 1: free-text <3 chars → false', () => {
    expect(
      computeCanAdvance({
        ...init,
        step: 1,
        course: { name: 'Ab' },
      }),
    ).toBeFalsy();
  });

  it('Step 1: null course → false', () => {
    expect(computeCanAdvance({ ...init, step: 1, course: null })).toBeFalsy();
  });

  it('Step 2: non-empty startDate → true', () => {
    expect(
      computeCanAdvance({ ...init, step: 2, startDate: '2026-10-15' }),
    ).toBeTruthy();
  });

  it('Step 2: empty startDate → false', () => {
    expect(computeCanAdvance({ ...init, step: 2, startDate: '' })).toBeFalsy();
  });

  it('Step 3: solo (length 1) → true', () => {
    expect(
      computeCanAdvance({
        ...init,
        step: 3,
        players: [
          {
            id: 'u',
            name: 'Ian',
            deliveryMethod: 'self',
          },
        ],
      }),
    ).toBeTruthy();
  });

  it('Step 3: empty players → false', () => {
    expect(computeCanAdvance({ ...init, step: 3, players: [] })).toBeFalsy();
  });

  it('Step 4: format set → true', () => {
    expect(
      computeCanAdvance({ ...init, step: 4, format: 'stroke_play' }),
    ).toBeTruthy();
  });

  it('Step 4: null format → false', () => {
    expect(computeCanAdvance({ ...init, step: 4, format: null })).toBeFalsy();
  });

  it('Step 5: optional → always true', () => {
    expect(computeCanAdvance({ ...init, step: 5 })).toBeTruthy();
    expect(
      computeCanAdvance({ ...init, step: 5, sideGames: ['skins'] }),
    ).toBeTruthy();
  });

  it('Step 6: optional → always true', () => {
    expect(computeCanAdvance({ ...init, step: 6 })).toBeTruthy();
  });

  it('Step 7: always true (Step 7 has its own fire-floor gate on the buttons)', () => {
    expect(computeCanAdvance({ ...init, step: 7 })).toBeTruthy();
  });
});

// =============================================================

summary('reducer + computeCanAdvance');
exitWithStatus();
