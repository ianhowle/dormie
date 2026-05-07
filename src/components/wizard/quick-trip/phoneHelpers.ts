// =============================================================
// Pure phone formatters for the Quick Trip wizard
// =============================================================
// Extracted from Step 3 (Who) so they're testable from ts-node
// without pulling in react-native imports.
// =============================================================

/** US-style display formatter: digits → "(xxx) xxx-xxxx". International
 *  numbers don't get formatting (no dial-code logic — out of scope for
 *  v1; SMS link copy works regardless of format). */
export function formatUSPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6)
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}
