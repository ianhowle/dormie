// Green-in-Regulation rule. Lives in its own file with zero React/JSX
// dependencies so both src/scoring/calculations.ts (which transitively
// touches ThemeContext) and src/data/scoring.ts (compiled by the
// ts-node test runner, which cannot tolerate JSX imports) can share a
// single implementation. Previously duplicated; consolidated 2026-05-21.
export function isGIR(gross: number, putts: number, par: number): boolean {
  return (gross - putts) <= (par - 2);
}
