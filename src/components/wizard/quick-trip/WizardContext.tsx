// =============================================================
// Quick Trip wizard — Context + reducer + state types
// =============================================================
// Single source of truth for the 8-step wizard state (Step 0 persona
// fork + Steps 1–7 trip data). Session-only — no Supabase persistence
// mid-flow per the spec recommendation. State unmounts with the route.
//
// Phase 2.0 wires NEXT_STEP / PREV_STEP / GOTO_STEP. Other actions are
// declared here so the type is stable from the start; subsequent
// phases (2.1–2.8) wire their respective field setters as each step's
// real content lands.
//
// Reference: docs/trips-wizard-redesign-spec-2026-05-05.md (Phase 2)
// =============================================================

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { ScoringFormat, SideGame } from '../../../data/scoring';
import type { PerGameStakeConfig } from '../PerGameStakeInput';

/** Unified location shape covering both catalog matches and free-text
 *  fallback. A picker selection has `id` set (with optional city/state
 *  metadata); a "couldn't find your course?" free-text entry has only
 *  `name`. Step 1 stores either through SET_COURSE; canAdvance gates on
 *  presence of `id` OR a `name` of at least 3 characters. */
export interface WizardLocationSelection {
  /** Catalog id when the selection came from the picker; absent for
   *  free-text fallback. */
  id?: string;
  name: string;
  city?: string;
  state?: string;
  source?: 'local' | 'golfapi' | 'google' | 'free-text';
}

// ─── Types ────────────────────────────────────────────────────────────

/** Trip-type / persona selected at Step 0. The three values map to
 *  the strategic personas (Booker / Planner / Annual Repeater) but are
 *  named by their trip-type entry point so the action surface reads
 *  cleanly across the wizard. Annual Repeater (duplicate) routes
 *  outside the wizard via the duplicate flow — it doesn't get its own
 *  persona key here. */
export type WizardPersona = 'quick' | 'plan' | 'ryder' | null;

export interface WizardPlayer {
  /** Stable id — Dormie user id when 'self'/'dormie', otherwise a
   *  synthetic key (e.g., 'guest-<timestamp>', 'sms-<timestamp>'). */
  id: string;
  name: string;
  /** How the trip launch will reach this player:
   *    'self'   — the wizard owner (always at state.players[0])
   *    'dormie' — existing Dormie user invited via push
   *    'sms'    — non-user, invited via SMS link copy on launch
   *    'guest'  — name-only player, no invitation fires (offline-only)
   */
  deliveryMethod: 'self' | 'dormie' | 'sms' | 'guest';
  avatarUrl?: string;
  /** Phone number (SMS invite) or email (email invite). Surfaced in
   *  Step 7's InvitePreview alongside the delivery method. */
  phoneOrEmail?: string;
  /** Dormie account id. Present for 'self' + 'dormie' rows. Used by
   *  Step 7's tripsService.addMembers call. */
  user_id?: string;
  /** Stored for handicap-aware scoring at scoring time. Captured here
   *  at trip-creation time but not displayed in the wizard. */
  handicap?: number;
}

export interface WizardPerGameStake {
  amount: number;
  config: PerGameStakeConfig;
}

export interface WizardState {
  /** Current step cursor — 0 (persona fork) through 7 (confirm + launch). */
  step: number;
  /** Persona selected at Step 0 — drives smart defaults across later
   *  steps. null until Step 0 resolves. */
  persona: WizardPersona;

  // ─── Step 1 — Where ────────────────────────────────────
  /** Resolved location — catalog match (id present) or free-text
   *  fallback (id absent, name only). null until the user makes a
   *  selection. */
  course: WizardLocationSelection | null;

  // ─── Step 2 — When ─────────────────────────────────────
  /** YYYY-MM-DD; empty until the user sets a date. */
  startDate: string;
  /** Quick Trip mirrors startDate (single-day). Plan Ahead extends to
   *  range — reserved for Phase 3. */
  endDate: string;
  /** Optional tee time in "HH:MM" 24-hour format. null when the user
   *  hasn't picked one (the cinematic + hero render "TEE TIME TBD"
   *  / fall through to date-only adaptive logic). Independent from
   *  startDate so changing the date doesn't clear the time. */
  teeTime: string | null;

  // ─── Step 3 — Who ──────────────────────────────────────
  /** Roster including self at index 0 (isOrganizer:true). Solo trips
   *  are valid (length 1). */
  players: WizardPlayer[];

  // ─── Step 4 — How ──────────────────────────────────────
  format: ScoringFormat | null;

  // ─── Step 5 — Side games ───────────────────────────────
  sideGames: SideGame[];

  // ─── Step 6 — Stakes ───────────────────────────────────
  /** Keyed by ScoringFormat | SideGame string. Empty record = stakes
   *  skipped. */
  perGameStakes: Record<string, WizardPerGameStake>;

  // ─── Trip name (auto-derived; user-overridable) ────────
  /** Title-case auto-derivation: "Pinehurst Oct 2026". Rendering
   *  surfaces apply textTransform if uppercase is needed (the
   *  cinematic kicker, the Trips list card). */
  tripName: string;
  /** When true, the user has manually edited the name and auto-derive
   *  should not overwrite it. */
  tripNameOverridden: boolean;
}

/** Initial wizard state. Exported for stress-test harness use; runtime
 *  code reaches it via the Provider's useReducer initialization. */
export const INITIAL_WIZARD_STATE: WizardState = {
  step: 0,
  persona: null,
  course: null,
  startDate: '',
  endDate: '',
  teeTime: null,
  players: [],
  format: null,
  sideGames: [],
  perGameStakes: {},
  tripName: '',
  tripNameOverridden: false,
};

// ─── Actions ──────────────────────────────────────────────────────────

export type WizardAction =
  | { type: 'GOTO_STEP'; step: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'RESET_WIZARD' }
  | { type: 'SELECT_PERSONA'; persona: WizardPersona }
  | { type: 'SET_COURSE'; course: WizardLocationSelection | null }
  | { type: 'SET_DATES'; startDate: string; endDate: string }
  | { type: 'SET_TEE_TIME'; teeTime: string | null }
  | { type: 'SET_PLAYERS'; players: WizardPlayer[] }
  | { type: 'ADD_PLAYER'; player: WizardPlayer }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'SET_FORMAT'; format: ScoringFormat | null }
  | { type: 'SET_SIDE_GAMES'; sideGames: SideGame[] }
  | { type: 'TOGGLE_SIDE_GAME'; sideGame: SideGame }
  | { type: 'ADD_SIDE_GAME'; sideGame: SideGame }
  | { type: 'CLEAR_SIDE_GAMES' }
  | { type: 'SET_PER_GAME_STAKE'; key: string; stake: WizardPerGameStake }
  | { type: 'CLEAR_PER_GAME_STAKE'; key: string }
  | { type: 'CLEAR_STAKES' }
  | { type: 'SET_TRIP_NAME'; name: string };

/** Total step count — Step 0 (persona fork) through Step 7 (confirm). */
export const TOTAL_WIZARD_STEPS = 8;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Pure reducer — exported for stress-test harness use. Runtime
 *  code reaches it via WizardProvider's useReducer hook. */
export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'GOTO_STEP':
      return { ...state, step: clamp(action.step, 0, TOTAL_WIZARD_STEPS - 1) };
    case 'NEXT_STEP':
      return {
        ...state,
        step: Math.min(state.step + 1, TOTAL_WIZARD_STEPS - 1),
      };
    case 'PREV_STEP':
      return { ...state, step: Math.max(state.step - 1, 0) };
    case 'RESET_WIZARD':
      // Wipe all wizard state and return to the persona fork.
      // Used by the Step 1 multi-course off-ramp link to bounce the
      // user back to Step 0 with a clean slate before they pivot to
      // the Plan Ahead flow.
      return INITIAL_WIZARD_STATE;
    case 'SELECT_PERSONA':
      return { ...state, persona: action.persona };
    case 'SET_COURSE':
      return { ...state, course: action.course };
    case 'SET_DATES':
      return { ...state, startDate: action.startDate, endDate: action.endDate };
    case 'SET_TEE_TIME':
      return { ...state, teeTime: action.teeTime };
    case 'SET_PLAYERS':
      return { ...state, players: action.players };
    case 'ADD_PLAYER': {
      // De-dupe on id — re-adding an already-present player is a no-op.
      if (state.players.some((p) => p.id === action.player.id)) return state;
      return { ...state, players: [...state.players, action.player] };
    }
    case 'REMOVE_PLAYER':
      return {
        ...state,
        // Self ('deliveryMethod === self') can't be removed — defensively
        // ignore the action if a caller tries.
        players: state.players.filter(
          (p) => p.id !== action.playerId || p.deliveryMethod === 'self',
        ),
      };
    case 'SET_FORMAT':
      return { ...state, format: action.format };
    case 'SET_SIDE_GAMES':
      return { ...state, sideGames: action.sideGames };
    case 'TOGGLE_SIDE_GAME': {
      const present = state.sideGames.includes(action.sideGame);
      return {
        ...state,
        sideGames: present
          ? state.sideGames.filter((g) => g !== action.sideGame)
          : [...state.sideGames, action.sideGame],
      };
    }
    case 'ADD_SIDE_GAME':
      if (state.sideGames.includes(action.sideGame)) return state;
      return { ...state, sideGames: [...state.sideGames, action.sideGame] };
    case 'CLEAR_SIDE_GAMES':
      return { ...state, sideGames: [] };
    case 'SET_PER_GAME_STAKE': {
      const next = { ...state.perGameStakes, [action.key]: action.stake };
      return { ...state, perGameStakes: next };
    }
    case 'CLEAR_PER_GAME_STAKE': {
      const next = { ...state.perGameStakes };
      delete next[action.key];
      return { ...state, perGameStakes: next };
    }
    case 'CLEAR_STAKES':
      return { ...state, perGameStakes: {} };
    case 'SET_TRIP_NAME':
      return { ...state, tripName: action.name, tripNameOverridden: true };
    default:
      return state;
  }
}

// ─── Validation (per-step gates for Next button) ──────────────────────

/** Whether the current step's data is sufficient to advance.
 *
 *  Each step's gate lands as that step's real content lands (2.1–2.8).
 *  Steps without their content yet return true so the chassis can be
 *  navigated end-to-end during build.
 */
export function computeCanAdvance(state: WizardState): boolean {
  switch (state.step) {
    case 0:
      // Step 0 advances via persona-card tap (which dispatches NEXT_STEP
      // along with SELECT_PERSONA). The footer Next button is hidden on
      // Step 0 by WizardLayout, but defensively gate on persona being set
      // to 'quick' — Plan Ahead/Ryder Cup don't continue this wizard.
      return state.persona === 'quick';
    case 1:
      // Need either a catalog match (course.id) or a free-text name
      // ≥ 3 characters.
      if (!state.course) return false;
      if (state.course.id) return true;
      return state.course.name.trim().length >= 3;
    case 2:
      // Need a non-empty startDate. The Step 2 picker constrains
      // selection to today-or-later, so any non-empty value is valid.
      return state.startDate.trim().length > 0;
    case 3:
      // Solo is valid — Step 3's self-seed guarantees state.players
      // contains at least the organizer once auth resolves. Any
      // non-empty roster passes.
      return state.players.length >= 1;
    case 4:
      // Need exactly one format selected.
      return state.format !== null;
    case 5:
      // Side games are optional — zero selections is valid. The Skip
      // link in the step body advances directly without lifting state.
      return true;
    case 6:
      // Stakes are optional — zero stakes is valid (settled offline).
      // PerGameStakeInput clamps amounts to non-negative; the Skip link
      // is a one-shot CLEAR_STAKES + advance shortcut.
      return true;
    default:
      // Step 7 still placeholder-validation; lands as the real
      // content does (2.8).
      return true;
  }
}

// ─── Context ──────────────────────────────────────────────────────────

interface WizardContextValue {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  canAdvance: boolean;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);
  const canAdvance = computeCanAdvance(state);
  return (
    <WizardContext.Provider value={{ state, dispatch, canAdvance }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error('useWizard must be used inside <WizardProvider>');
  }
  return ctx;
}
