import { Sentry } from './sentry';

/**
 * Log to console only. Use for expected/graceful failures
 * (best-effort cleanup, optional features, fallback paths).
 */
export function logWarn(context: string, error?: unknown): void {
  console.warn(`[Dormie] ${context}`, error ?? '');
}

/**
 * Log to console AND capture via Sentry. Use for real failures
 * that should be surfaced in crash reporting (user-facing operations,
 * data writes, auth flows).
 */
export function logError(context: string, error?: unknown): void {
  console.error(`[Dormie] ${context}`, error ?? '');
  if (error instanceof Error) {
    Sentry.captureException(error);
  } else if (error !== undefined) {
    Sentry.captureException(new Error(`${context}: ${String(error)}`));
  } else {
    Sentry.captureException(new Error(context));
  }
}
