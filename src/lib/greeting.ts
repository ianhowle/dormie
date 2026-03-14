/**
 * Time-based and contextual greetings.
 * Uses the PGA Tour calendar to make the app feel alive.
 */

import { getActiveEvent, type ActiveEvent } from '../data/golf-calendar';

function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

function getDayName(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** Cached active event for the current render cycle */
let _cachedEvent: ActiveEvent | null | undefined;
let _cachedEventTime = 0;

function getCachedActiveEvent(): ActiveEvent | null {
  const now = Date.now();
  // Cache for 60 seconds to avoid re-computing on every call
  if (_cachedEvent !== undefined && now - _cachedEventTime < 60_000) {
    return _cachedEvent;
  }
  _cachedEvent = getActiveEvent();
  _cachedEventTime = now;
  return _cachedEvent;
}

export function getGreeting(firstName?: string): string {
  const name = firstName ?? 'golfer';
  const event = getCachedActiveEvent();

  // Special: PGA Tour event week
  if (event) {
    if (event.event.name === 'The Masters') {
      return `It's Masters week, ${name}`;
    }
    // Other events — just use time-based greeting, subtitle shows event
  }

  // Special: Weekend
  if (isWeekend()) {
    const day = getDayName();
    return `Happy ${day}, ${name} — perfect day for a round`;
  }

  // Standard time-based
  const time = getTimeOfDay();
  return `Good ${time}, ${name}`;
}

export function getGreetingSubtitle(): string | null {
  const event = getCachedActiveEvent();
  if (!event) return null;
  return event.label;
}

/** Whether the header should have gold tint (Masters week or Playoffs) */
export function isMastersTheme(): boolean {
  const event = getCachedActiveEvent();
  return event?.isGoldHeader ?? false;
}

/** Get accent color for the current event, or null */
export function getEventAccentColor(): string | null {
  const event = getCachedActiveEvent();
  return event?.accentColor ?? null;
}

/** Whether we're in FedEx Cup Playoffs */
export function isPlayoffsTheme(): boolean {
  const event = getCachedActiveEvent();
  return event?.isPlayoffs ?? false;
}
