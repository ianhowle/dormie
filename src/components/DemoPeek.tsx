import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GEO, SANS } from '../theme/fonts';
import { haptics } from '../lib/haptics';

// ─── Demo Peek Toggle ───────────────────────────────────────────────
// Small toggle at the top of empty screens: "Preview with sample data"
export function DemoPeekToggle({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.toggleWrap}>
      <Pressable
        onPress={() => { haptics.light(); onToggle(); }}
        style={({ pressed }) => [
          styles.toggle,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Ionicons
          name={isActive ? 'eye' : 'eye-outline'}
          size={14}
          color={isActive ? c.gold : c.textMuted}
        />
        <Text style={[styles.toggleText, { color: c.textMuted, fontFamily: SANS }]}>
          {isActive ? 'Viewing sample data' : 'Preview with sample data'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Demo Banner ────────────────────────────────────────────────────
// Persistent gold banner shown when demo data is active
export function DemoBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons name="information-circle" size={14} color="#141210" />
      <Text style={[styles.bannerText, { fontFamily: SANS }]}>
        Sample data — log rounds to see your real stats.
      </Text>
    </View>
  );
}

// ─── Sample data sets ───────────────────────────────────────────────
export const DEMO_LEADERBOARD = [
  { id: 'd1', name: 'McGowan', handicap: 8.2, courses: 12, rounds: 34, avgScore: 77.1, bestRound: 71, toPar: -1.2, movement: 'same' as const },
  { id: 'd2', name: 'Fletcher', handicap: 10.4, courses: 8, rounds: 28, avgScore: 79.8, bestRound: 73, toPar: 0.4, movement: 'up' as const },
  { id: 'd3', name: 'Patterson', handicap: 12.1, courses: 6, rounds: 22, avgScore: 81.2, bestRound: 74, toPar: 1.8, movement: 'down' as const },
  { id: 'd4', name: 'Collins', handicap: 14.5, courses: 5, rounds: 18, avgScore: 83.5, bestRound: 76, toPar: 3.1, movement: 'same' as const },
  { id: 'd5', name: 'Davis', handicap: 6.8, courses: 15, rounds: 42, avgScore: 75.9, bestRound: 69, toPar: -2.8, movement: 'up' as const },
  { id: 'd6', name: 'Brooks', handicap: 16.2, courses: 4, rounds: 14, avgScore: 85.1, bestRound: 78, toPar: 4.5, movement: 'down' as const },
  { id: 'd7', name: 'Sullivan', handicap: 11.0, courses: 9, rounds: 30, avgScore: 80.2, bestRound: 73, toPar: 1.0, movement: 'up' as const },
  { id: 'd8', name: 'Harris', handicap: 9.5, courses: 10, rounds: 26, avgScore: 78.4, bestRound: 72, toPar: -0.3, movement: 'same' as const },
];

export const DEMO_SEASON = {
  id: 'demo-season',
  name: 'Spring Championship',
  totalWeeks: 12,
  currentWeek: 7,
  yourPosition: 3,
  totalPlayers: 8,
  format: 'fedex_cup' as const,
  standings: [
    { rank: 1, name: 'Davis', points: 142 },
    { rank: 2, name: 'McGowan', points: 128 },
    { rank: 3, name: 'Fletcher', points: 115 },
    { rank: 4, name: 'Sullivan', points: 98 },
    { rank: 5, name: 'Patterson', points: 87 },
  ],
};

export const DEMO_TRIP = {
  id: 'demo-trip',
  name: 'Scottsdale Classic',
  city: 'Scottsdale',
  state: 'AZ',
  startDate: '2026-04-15',
  endDate: '2026-04-19',
  status: 'upcoming' as const,
  roundsPlanned: 4,
  isRyderCup: false,
  competitionStarted: false,
  playerIds: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'],
  gradient: ['#4A2006', '#1A0A02'] as [string, string],
};

const styles = StyleSheet.create({
  toggleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  banner: {
    backgroundColor: '#C9A227',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  bannerText: {
    color: '#141210',
    fontSize: 11,
    fontWeight: '600',
  },
});
