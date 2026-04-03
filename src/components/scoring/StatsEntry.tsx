// StatsEntry — Putts, FIR, GIR, penalties
// These are rendered inline within ScoreGrid.tsx's PlayerScoreInput component.
// The secondary inputs (putts buttons, FIR toggle, GIR display, and penalty tracking)
// are tightly coupled to the score state, so they remain within ScoreGrid.tsx.
// This file re-exports from ScoreGrid for backwards compatibility.
export { PlayerScoreInput } from './ScoreGrid';
