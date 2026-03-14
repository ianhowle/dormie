/**
 * Smart notification copy — professional, encouraging, golf-insider tone.
 * No trash talk. Used as templates when push notifications are wired.
 *
 * Placeholders: {name}, {score}, {course}, {handicap}, {prevHandicap},
 *   {tripName}, {daysOut}, {position}, {points}, {format}, {count}, {courseCount}
 */

export type NotificationCategory =
  | 'round_posted'
  | 'handicap_update'
  | 'trip_reminder'
  | 'season_update'
  | 'competition'
  | 'milestone';

export type NotificationTemplate = {
  category: NotificationCategory;
  body: string;
};

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  // Round posted by friend
  { category: 'round_posted', body: '{name} just posted {score} at {course}. Great round. \uD83D\uDC4F' },
  { category: 'round_posted', body: '{name} logged a {score} — new personal best at {course}.' },
  { category: 'round_posted', body: 'Your crew has been active. {count} rounds posted this week.' },

  // Handicap update
  { category: 'handicap_update', body: 'Your handicap moved to {handicap} — your lowest in 6 months. Keep going. \uD83D\uDCC9' },
  { category: 'handicap_update', body: 'Handicap update: {prevHandicap} \u2192 {handicap}. The work is paying off.' },

  // Trip reminders
  { category: 'trip_reminder', body: '{tripName} is {daysOut} days out. Can\'t wait. \u2708\uFE0F' },
  { category: 'trip_reminder', body: '{tripName} is {daysOut} weeks away. Time to dial in that wedge game.' },

  // Season updates
  { category: 'season_update', body: 'You moved up to #{position} in the {tripName}. {daysOut} weeks left.' },
  { category: 'season_update', body: 'Week {count} scores are in. You gained {points} points this week.' },

  // Competition
  { category: 'competition', body: 'You\'re {score} strokes ahead of the group. Stay sharp. \uD83C\uDFC6' },
  { category: 'competition', body: 'New season week starts tomorrow. {format} format this week.' },

  // Milestones
  { category: 'milestone', body: 'Congrats on round #{count} with Dormie. Here\'s to {count} more. \u26F3' },
  { category: 'milestone', body: 'You\'ve played {courseCount} different courses now. Explorer status unlocked.' },
];

/**
 * Pick a random template for a given category and fill placeholders.
 */
export function renderNotification(
  category: NotificationCategory,
  vars: Record<string, string | number>,
): string {
  const pool = NOTIFICATION_TEMPLATES.filter((t) => t.category === category);
  if (pool.length === 0) return '';
  const template = pool[Math.floor(Math.random() * pool.length)];
  return template.body.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}
