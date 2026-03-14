/**
 * Accessibility utilities for Dormie.
 * Dynamic type, VoiceOver labels, high contrast support.
 */

import { PixelRatio, AccessibilityInfo, Platform } from 'react-native';

// ─── Dynamic Type ───────────────────────────────────────────────────
/**
 * Scale a font size based on the user's preferred text size.
 * Respects iOS Dynamic Type and Android font scale.
 * Clamps between min and max to prevent layout breakage.
 */
export function scaledFontSize(base: number, min?: number, max?: number): number {
  const scale = PixelRatio.getFontScale();
  const scaled = Math.round(base * scale);
  const lo = min ?? Math.round(base * 0.8);
  const hi = max ?? Math.round(base * 1.5);
  return Math.max(lo, Math.min(hi, scaled));
}

// ─── VoiceOver labels ───────────────────────────────────────────────
/** Generate accessibility label for a leaderboard row */
export function leaderboardRowLabel(
  position: number,
  name: string,
  toPar: number,
  rounds: number,
  bestRound: string | number,
): string {
  const toParStr =
    toPar === 0
      ? 'even par'
      : toPar > 0
        ? `plus ${toPar.toFixed(1)}`
        : `minus ${Math.abs(toPar).toFixed(1)}`;
  return `Position ${position}, ${name}, ${toParStr} average, ${rounds} rounds, best ${bestRound}`;
}

/** Generate accessibility label for a score cell */
export function scoreCellLabel(
  hole: number,
  par: number,
  score: number | null,
): string {
  if (score == null) return `Hole ${hole}, par ${par}, no score entered`;
  const diff = score - par;
  let desc = '';
  if (diff === -2) desc = 'eagle';
  else if (diff === -1) desc = 'birdie';
  else if (diff === 0) desc = 'par';
  else if (diff === 1) desc = 'bogey';
  else if (diff === 2) desc = 'double bogey';
  else if (diff > 2) desc = `${diff} over par`;
  else desc = `${Math.abs(diff)} under par`;
  return `Hole ${hole}, par ${par}, scored ${score}, ${desc}`;
}

/** Generate accessibility label for a tab */
export function tabLabel(name: string, isActive: boolean, badge?: number): string {
  let label = `${name} tab`;
  if (isActive) label += ', selected';
  if (badge && badge > 0) label += `, ${badge} notification${badge > 1 ? 's' : ''}`;
  return label;
}

/** Generate accessibility label for an avatar */
export function avatarLabel(name: string, role?: string): string {
  return role ? `${name}, ${role}` : name;
}

/** Generate accessibility label for a stat */
export function statLabel(value: string | number, label: string): string {
  return `${label}: ${value}`;
}

// ─── High Contrast ──────────────────────────────────────────────────
/**
 * Get border width respecting high contrast mode.
 * iOS: uses accessibilityInfo; Android: uses accessibility settings.
 */
export function getContrastBorderWidth(base: number = 1): number {
  // In a real implementation, this would listen to AccessibilityInfo.isReduceMotionEnabled
  // and the system high contrast setting. For now, return base.
  // When high contrast is detected, return base * 2.
  return base;
}

/** Ensure a color pair meets WCAG AA contrast ratio (4.5:1 for normal text) */
export function meetsContrastRatio(
  foreground: string,
  background: string,
  minRatio: number = 4.5,
): boolean {
  const fgLum = relativeLuminance(hexToRgb(foreground));
  const bgLum = relativeLuminance(hexToRgb(background));
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return ratio >= minRatio;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
