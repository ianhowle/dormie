import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { GEO, SANS } from '../theme/fonts';
import { haptics } from '../lib/haptics';

const DEMO_BANNER_DISMISSED_KEY = '@dormie/demo_banner_dismissed';

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
export function DemoBanner({
  onDismiss,
  hasRealRounds,
}: {
  onDismiss?: () => void;
  hasRealRounds?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme.isDark;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEMO_BANNER_DISMISSED_KEY).then((val) => {
      if (val === 'true') setDismissed(true);
    });
  }, []);

  // Auto-hide when user has real rounds
  useEffect(() => {
    if (hasRealRounds) {
      setDismissed(true);
      AsyncStorage.setItem(DEMO_BANNER_DISMISSED_KEY, 'true');
      onDismiss?.();
    }
  }, [hasRealRounds]);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DEMO_BANNER_DISMISSED_KEY, 'true');
    onDismiss?.();
  };

  return (
    <View style={[
      styles.banner,
      !isDark && {
        backgroundColor: '#FDF6E3',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(201,162,39,0.2)',
      },
    ]}>
      <Ionicons name="information-circle" size={14} color={isDark ? '#141210' : '#C9A227'} />
      <Text style={[styles.bannerText, { fontFamily: SANS, flex: 1 }, !isDark && { color: '#8B7422' }]}>
        Sample data — log rounds to see your real stats.
      </Text>
      <Pressable onPress={handleDismiss} hitSlop={10} style={styles.bannerClose}>
        <Ionicons name="close" size={14} color={isDark ? 'rgba(20,18,16,0.6)' : 'rgba(139,116,34,0.6)'} />
      </Pressable>
    </View>
  );
}

// ─── Sample data sets — My Group (~8 players) ──────────────────────
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

// ─── Sample data sets — The Field (~22 players) ────────────────────
export const DEMO_FIELD_LEADERBOARD = [
  { id: 'f1', name: 'Nakamura', handicap: 4.1, courses: 18, rounds: 58, avgScore: 74.2, bestRound: 66, toPar: -4.8, movement: 'up' as const },
  { id: 'f2', name: 'Rodriguez', handicap: 5.3, courses: 16, rounds: 52, avgScore: 75.1, bestRound: 67, toPar: -3.9, movement: 'same' as const },
  { id: 'd5', name: 'Davis', handicap: 6.8, courses: 15, rounds: 42, avgScore: 75.9, bestRound: 69, toPar: -2.8, movement: 'up' as const },
  { id: 'f3', name: 'Johansson', handicap: 7.0, courses: 14, rounds: 46, avgScore: 76.4, bestRound: 69, toPar: -2.1, movement: 'down' as const },
  { id: 'f4', name: 'Chen', handicap: 7.5, courses: 11, rounds: 38, avgScore: 76.8, bestRound: 70, toPar: -1.7, movement: 'same' as const },
  { id: 'd1', name: 'McGowan', handicap: 8.2, courses: 12, rounds: 34, avgScore: 77.1, bestRound: 71, toPar: -1.2, movement: 'same' as const },
  { id: 'f5', name: 'Petrov', handicap: 8.8, courses: 10, rounds: 32, avgScore: 77.6, bestRound: 71, toPar: -0.8, movement: 'up' as const },
  { id: 'd8', name: 'Harris', handicap: 9.5, courses: 10, rounds: 26, avgScore: 78.4, bestRound: 72, toPar: -0.3, movement: 'same' as const },
  { id: 'f6', name: 'Anderson', handicap: 9.8, courses: 9, rounds: 30, avgScore: 78.9, bestRound: 72, toPar: 0.1, movement: 'down' as const },
  { id: 'd2', name: 'Fletcher', handicap: 10.4, courses: 8, rounds: 28, avgScore: 79.8, bestRound: 73, toPar: 0.4, movement: 'up' as const },
  { id: 'f7', name: 'Kowalski', handicap: 10.6, courses: 7, rounds: 24, avgScore: 79.9, bestRound: 73, toPar: 0.6, movement: 'same' as const },
  { id: 'd7', name: 'Sullivan', handicap: 11.0, courses: 9, rounds: 30, avgScore: 80.2, bestRound: 73, toPar: 1.0, movement: 'up' as const },
  { id: 'f8', name: 'Yamamoto', handicap: 11.4, courses: 8, rounds: 26, avgScore: 80.6, bestRound: 74, toPar: 1.3, movement: 'down' as const },
  { id: 'f9', name: 'Singh', handicap: 11.9, courses: 7, rounds: 22, avgScore: 81.0, bestRound: 74, toPar: 1.7, movement: 'same' as const },
  { id: 'd3', name: 'Patterson', handicap: 12.1, courses: 6, rounds: 22, avgScore: 81.2, bestRound: 74, toPar: 1.8, movement: 'down' as const },
  { id: 'f10', name: 'Hoffman', handicap: 12.8, courses: 6, rounds: 20, avgScore: 81.9, bestRound: 75, toPar: 2.4, movement: 'up' as const },
  { id: 'f11', name: 'Fitzgerald', handicap: 13.2, courses: 5, rounds: 18, avgScore: 82.4, bestRound: 75, toPar: 2.8, movement: 'same' as const },
  { id: 'd4', name: 'Collins', handicap: 14.5, courses: 5, rounds: 18, avgScore: 83.5, bestRound: 76, toPar: 3.1, movement: 'same' as const },
  { id: 'f12', name: 'Morales', handicap: 14.8, courses: 5, rounds: 16, avgScore: 83.8, bestRound: 76, toPar: 3.5, movement: 'down' as const },
  { id: 'f13', name: 'Blackwood', handicap: 15.4, courses: 4, rounds: 14, avgScore: 84.5, bestRound: 77, toPar: 4.0, movement: 'up' as const },
  { id: 'd6', name: 'Brooks', handicap: 16.2, courses: 4, rounds: 14, avgScore: 85.1, bestRound: 78, toPar: 4.5, movement: 'down' as const },
  { id: 'f14', name: 'Thornton', handicap: 17.0, courses: 3, rounds: 12, avgScore: 86.2, bestRound: 79, toPar: 5.2, movement: 'same' as const },
];

// ─── Field H2H demo data ───────────────────────────────────────────
export const DEMO_FIELD_H2H = [
  {
    opponentId: 'f1', opponentName: 'Nakamura', opponentHandicap: 4.1,
    myWins: 1, theirWins: 5, ties: 0, totalMatches: 6,
    courseBreakdown: [
      { courseId: 'c1', courseName: 'Hermitage Golf Course', myBest: 74, theirBest: 68 },
    ],
  },
  {
    opponentId: 'f2', opponentName: 'Rodriguez', opponentHandicap: 5.3,
    myWins: 3, theirWins: 4, ties: 1, totalMatches: 8,
    courseBreakdown: [
      { courseId: 'c2', courseName: 'Gaylord Springs', myBest: 76, theirBest: 72 },
      { courseId: 'c4', courseName: 'TPC Sawgrass', myBest: 82, theirBest: 78 },
    ],
  },
  {
    opponentId: 'f3', opponentName: 'Johansson', opponentHandicap: 7.0,
    myWins: 4, theirWins: 3, ties: 2, totalMatches: 9,
    courseBreakdown: [
      { courseId: 'c3', courseName: 'Nashville Golf & Athletic', myBest: 73, theirBest: 74 },
    ],
  },
  {
    opponentId: 'f4', opponentName: 'Chen', opponentHandicap: 7.5,
    myWins: 5, theirWins: 2, ties: 0, totalMatches: 7,
    courseBreakdown: [
      { courseId: 'c1', courseName: 'Hermitage Golf Course', myBest: 74, theirBest: 78 },
      { courseId: 'c8', courseName: 'The Governors Club', myBest: 78, theirBest: 80 },
    ],
  },
  {
    opponentId: 'f6', opponentName: 'Anderson', opponentHandicap: 9.8,
    myWins: 3, theirWins: 3, ties: 1, totalMatches: 7,
    courseBreakdown: [
      { courseId: 'c2', courseName: 'Gaylord Springs', myBest: 76, theirBest: 77 },
    ],
  },
  {
    opponentId: 'f10', opponentName: 'Hoffman', opponentHandicap: 12.8,
    myWins: 4, theirWins: 1, ties: 0, totalMatches: 5,
    courseBreakdown: [
      { courseId: 'c7', courseName: 'Greystone Golf Club', myBest: 75, theirBest: 82 },
    ],
  },
];

// ─── Field courses demo data ───────────────────────────────────────
export const DEMO_FIELD_COURSES = [
  { id: 'c1', name: 'Hermitage Golf Course - Presidents Reserve', city: 'Old Hickory', state: 'TN', par: 72, slope: 134, totalRounds: 86, playerCount: 18, myBest: 74, recordScore: 66, recordHolder: 'Nakamura', gradient: ['#1E4D2B', '#2D6A3F'] as [string, string] },
  { id: 'c2', name: 'Gaylord Springs Golf Links', city: 'Nashville', state: 'TN', par: 72, slope: 135, totalRounds: 64, playerCount: 14, myBest: 76, recordScore: 69, recordHolder: 'Rodriguez', gradient: ['#2A4A6B', '#5B7FA5'] as [string, string] },
  { id: 'c3', name: 'Nashville Golf & Athletic', city: 'Nashville', state: 'TN', par: 72, slope: 128, totalRounds: 52, playerCount: 12, myBest: 73, recordScore: 68, recordHolder: 'Johansson', gradient: ['#5A3D7A', '#8B6DAF'] as [string, string] },
  { id: 'c4', name: 'TPC Sawgrass', city: 'Ponte Vedra Beach', state: 'FL', par: 72, slope: 148, totalRounds: 38, playerCount: 10, myBest: 82, recordScore: 70, recordHolder: 'Nakamura', gradient: ['#1A3A5C', '#2E6B8A'] as [string, string] },
  { id: 'c5', name: 'Pebble Beach Golf Links', city: 'Pebble Beach', state: 'CA', par: 72, slope: 145, totalRounds: 28, playerCount: 8, myBest: 84, recordScore: 72, recordHolder: 'Rodriguez', gradient: ['#3A5A3A', '#6B8F6B'] as [string, string] },
  { id: 'c6', name: 'TPC Scottsdale', city: 'Scottsdale', state: 'AZ', par: 71, slope: 139, totalRounds: 22, playerCount: 7, myBest: null, recordScore: 69, recordHolder: 'Chen', gradient: ['#8B6B3A', '#C4994A'] as [string, string] },
  { id: 'c9', name: 'Torrey Pines South', city: 'La Jolla', state: 'CA', par: 72, slope: 143, totalRounds: 18, playerCount: 6, myBest: null, recordScore: 71, recordHolder: 'Petrov', gradient: ['#2D4A6B', '#4A7AAA'] as [string, string] },
  { id: 'c10', name: 'Bethpage Black', city: 'Farmingdale', state: 'NY', par: 71, slope: 152, totalRounds: 14, playerCount: 5, myBest: null, recordScore: 73, recordHolder: 'Nakamura', gradient: ['#1A2A1A', '#3A5A3A'] as [string, string] },
  { id: 'c11', name: 'Pinehurst No. 2', city: 'Pinehurst', state: 'NC', par: 72, slope: 144, totalRounds: 20, playerCount: 6, myBest: null, recordScore: 72, recordHolder: 'Anderson', gradient: ['#5A4A3A', '#8B7A6A'] as [string, string] },
];

// ─── Field records demo data ───────────────────────────────────────
export const DEMO_FIELD_RECORDS = [
  { id: 'c1', name: 'Hermitage Golf Course', city: 'Old Hickory', state: 'TN', par: 72, slope: 134, totalRounds: 86, playerCount: 18, myBest: 74, recordScore: 66, recordHolder: 'Nakamura', gradient: ['#1E4D2B', '#2D6A3F'] as [string, string] },
  { id: 'c2', name: 'Gaylord Springs Golf Links', city: 'Nashville', state: 'TN', par: 72, slope: 135, totalRounds: 64, playerCount: 14, myBest: 76, recordScore: 69, recordHolder: 'Rodriguez', gradient: ['#2A4A6B', '#5B7FA5'] as [string, string] },
  { id: 'c3', name: 'Nashville Golf & Athletic', city: 'Nashville', state: 'TN', par: 72, slope: 128, totalRounds: 52, playerCount: 12, myBest: 73, recordScore: 68, recordHolder: 'Johansson', gradient: ['#5A3D7A', '#8B6DAF'] as [string, string] },
  { id: 'c4', name: 'TPC Sawgrass', city: 'Ponte Vedra Beach', state: 'FL', par: 72, slope: 148, totalRounds: 38, playerCount: 10, myBest: 82, recordScore: 70, recordHolder: 'Nakamura', gradient: ['#1A3A5C', '#2E6B8A'] as [string, string] },
  { id: 'c5', name: 'Pebble Beach Golf Links', city: 'Pebble Beach', state: 'CA', par: 72, slope: 145, totalRounds: 28, playerCount: 8, myBest: 84, recordScore: 72, recordHolder: 'Rodriguez', gradient: ['#3A5A3A', '#6B8F6B'] as [string, string] },
  { id: 'c8', name: 'The Governors Club', city: 'Brentwood', state: 'TN', par: 72, slope: 140, totalRounds: 24, playerCount: 6, myBest: 78, recordScore: 67, recordHolder: 'Petrov', gradient: ['#2D3A2D', '#4A5C4A'] as [string, string] },
  { id: 'c9', name: 'Torrey Pines South', city: 'La Jolla', state: 'CA', par: 72, slope: 143, totalRounds: 18, playerCount: 6, myBest: null, recordScore: 71, recordHolder: 'Petrov', gradient: ['#2D4A6B', '#4A7AAA'] as [string, string] },
  { id: 'c10', name: 'Bethpage Black', city: 'Farmingdale', state: 'NY', par: 71, slope: 152, totalRounds: 14, playerCount: 5, myBest: null, recordScore: 73, recordHolder: 'Nakamura', gradient: ['#1A2A1A', '#3A5A3A'] as [string, string] },
];

export const DEMO_FIELD_BUCKET_LIST = [
  { id: 'fbl1', name: 'Augusta National', city: 'Augusta', state: 'GA', communityRounds: 8, communityAvg: 82.4 },
  { id: 'fbl2', name: 'Cypress Point Club', city: 'Pebble Beach', state: 'CA', communityRounds: 5, communityAvg: 79.1 },
  { id: 'fbl3', name: 'Pine Valley', city: 'Pine Valley', state: 'NJ', communityRounds: 3, communityAvg: 85.6 },
  { id: 'fbl4', name: 'Royal Melbourne West', city: 'Melbourne', state: 'Australia', communityRounds: null, communityAvg: null },
  { id: 'fbl5', name: 'Shinnecock Hills', city: 'Southampton', state: 'NY', communityRounds: 12, communityAvg: 88.3 },
  { id: 'fbl6', name: 'Royal County Down', city: 'Newcastle', state: 'N. Ireland', communityRounds: null, communityAvg: null },
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
  bannerClose: {
    padding: 2,
  },
});
