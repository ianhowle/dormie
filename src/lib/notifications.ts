/**
 * Push notification templates — golf buddy voice, not robot copy.
 * These templates are ready for when push notifications are wired.
 * Uses expo-notifications when available for app icon badges.
 */

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch {
  // expo-notifications not installed
}

// ─── Notification templates ──────────────────────────────────────────
export type NotificationTemplate = {
  title: string;
  body: string;
  category: 'score' | 'handicap' | 'trip' | 'match' | 'social' | 'streak';
};

/** Friend posted a score */
export function scorePostedNotification(friendName: string, score: number, course: string): NotificationTemplate {
  return {
    title: `${friendName} just posted`,
    body: `Shot ${score} at ${course}. You going to let that stand?`,
    category: 'score',
  };
}

/** Your handicap changed */
export function handicapChangeNotification(newHcp: number, direction: 'up' | 'down', period: string): NotificationTemplate {
  if (direction === 'down') {
    return {
      title: 'Handicap dropped',
      body: `You're down to ${newHcp.toFixed(1)} — lowest in ${period} 📉`,
      category: 'handicap',
    };
  }
  return {
    title: 'Handicap update',
    body: `Moved to ${newHcp.toFixed(1)}. Time to hit the range.`,
    category: 'handicap',
  };
}

/** Trip countdown */
export function tripCountdownNotification(tripName: string, daysAway: number, location: string): NotificationTemplate {
  if (daysAway <= 3) {
    return {
      title: `${tripName} is almost here`,
      body: `${daysAway} day${daysAway !== 1 ? 's' : ''} out. Bags packed?`,
      category: 'trip',
    };
  }
  return {
    title: tripName,
    body: `${daysAway} days until ${location}. Time to start stretching 🏌️`,
    category: 'trip',
  };
}

/** Dormie match status */
export function dormieNotification(opponentName: string): NotificationTemplate {
  return {
    title: 'You\'re dormie',
    body: `Against ${opponentName}. Don't choke.`,
    category: 'match',
  };
}

/** H2H result */
export function h2hResultNotification(result: 'win' | 'loss', opponentName: string, score: string): NotificationTemplate {
  if (result === 'win') {
    return {
      title: 'W',
      body: `${score} against ${opponentName}. That's how it's done.`,
      category: 'match',
    };
  }
  return {
    title: 'L',
    body: `${opponentName} got you ${score}. Rematch?`,
    category: 'match',
  };
}

/** Friend request */
export function friendRequestNotification(name: string): NotificationTemplate {
  return {
    title: 'New crew member',
    body: `${name} wants to join your crew. Accept?`,
    category: 'social',
  };
}

/** Streak update */
export function streakNotification(streakType: string, count: number): NotificationTemplate {
  return {
    title: `🔥 ${count}-round streak`,
    body: `${streakType}. Don't break the chain.`,
    category: 'streak',
  };
}

/** Leaderboard position change */
export function positionChangeNotification(direction: 'up' | 'down', spots: number): NotificationTemplate {
  if (direction === 'up') {
    return {
      title: 'Moving up',
      body: `You climbed ${spots} spot${spots > 1 ? 's' : ''} on the leaderboard. Keep it going.`,
      category: 'social',
    };
  }
  return {
    title: 'Slipping',
    body: `Dropped ${spots} spot${spots > 1 ? 's' : ''} on the leaderboard. Time to rally.`,
    category: 'social',
  };
}

// ─── App icon badge ──────────────────────────────────────────────────
export async function setAppBadgeCount(count: number) {
  try {
    await Notifications?.setBadgeCountAsync?.(count);
  } catch {
    // Silently fail
  }
}

export async function clearAppBadge() {
  await setAppBadgeCount(0);
}
