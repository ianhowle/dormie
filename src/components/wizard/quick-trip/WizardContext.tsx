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
import type { SelectedCourse } from '../../trip/CourseLocationPicker';
import type { ScoringFormat, SideGame } from '../../../data/scoring';
import type { PerGameStakeConfig } from '../PerGameStakeInput';

// ─── Types ────────────────────────────────────────────────────────────

export type WizardPersona = 'booker' | 'planner' | 'duplicate' | null;

export interface WizardPlayer {
  /** Stable id — Dormie user id when present, otherwise a synthetic
   *  guest/invitee key. */
  id: string;
  name: string;
  user_id?: string;       // Dormie account
  guest_name?: string;    // guest player (no account)
  phone?: string;         // SMS invitee
  email?: string;         // email invitee
  handicap?: number;
  isOrganizer?: boolean;  // true for the wizard owner (always at index 0)
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
  /** Course picked from the catalog (preferred). */
  course: SelectedCourse | null;
  /** Free-text location fallback when no catalog match. */
  freeTextLocation: string;

  // ─── Step 2 — When ─────────────────────────────────────
  /** YYYY-MM-DD; empty until the user sets a date. */
  startDate: string;
  /** Quick Trip mirrors startDate (single-day). Plan Ahead extends to
   *  range — reserved for Phase 3. */
  endDate: string;

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

const initialState: WizardState = {
  step: 0,
  persona: null,
  course: null,
  freeTextLocation: '',
  startDate: '',
  endDate: '',
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
  | { type: 'SET_PERSONA'; persona: WizardPersona }
  | { type: 'SET_COURSE'; course: SelectedCourse | null }
  | { type: 'SET_FREE_TEXT_LOCATION'; text: string }
  | { type: 'SET_DATES'; startDate: string; endDate: string }
  | { type: 'SET_PLAYERS'; players: WizardPlayer[] }
  | { type: 'SET_FORMAT'; format: ScoringFormat | null }
  | { type: 'SET_SIDE_GAMES'; sideGames: SideGame[] }
  | { type: 'SET_PER_GAME_STAKE'; key: string; stake: WizardPerGameStake }
  | { type: 'CLEAR_PER_GAME_STAKE'; key: string }
  | { type: 'SET_TRIP_NAME'; name: string };

/** Total step count — Step 0 (persona fork) through Step 7 (confirm). */
export const TOTAL_WIZARD_STEPS = 8;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function reducer(state: WizardState, action: WizardAction): WizardState {
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
    case 'SET_PERSONA':
      return { ...state, persona: action.persona };
    case 'SET_COURSE':
      return { ...state, course: action.course };
    case 'SET_FREE_TEXT_LOCATION':
      return { ...state, freeTextLocation: action.text };
    case 'SET_DATES':
      return { ...state, startDate: action.startDate, endDate: action.endDate };
    case 'SET_PLAYERS':
      return { ...state, players: action.players };
    case 'SET_FORMAT':
      return { ...state, format: action.format };
    case 'SET_SIDE_GAMES':
      return { ...state, sideGames: action.sideGames };
    case 'SET_PER_GAME_STAKE': {
      const next = { ...state.perGameStakes, [action.key]: action.stake };
      return { ...state, perGameStakes: next };
    }
    case 'CLEAR_PER_GAME_STAKE': {
      const next = { ...state.perGameStakes };
      delete next[action.key];
      return { ...state, perGameStakes: next };
    }
    case 'SET_TRIP_NAME':
      return { ...state, tripName: action.name, tripNameOverridden: true };
    default:
      return state;
  }
}

// ─── Validation (per-step gates for Next button) ──────────────────────

/** Whether the current step's data is sufficient to advance.
 *
 *  Phase 2.0: returns true for all steps so the placeholder skeleton
 *  can be navigated end-to-end. Real per-step gates land in 2.1–2.8 as
 *  each step's content + required fields are wired. The shape of the
 *  function (one signature, returns boolean) is stable from 2.0 onward
 *  — only the body grows over the build phases.
 */
export function computeCanAdvance(_state: WizardState): boolean {
  return true;
}

// ─── Context ──────────────────────────────────────────────────────────

interface WizardContextValue {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  canAdvance: boolean;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
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
