import { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Line, Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { GEO, SANS } from '../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../theme/colors';
import { Avatar } from './Avatar';
import { haptics } from '../lib/haptics';

// ─── Home Feed Empty State ──────────────────────────────────────────
export function HomeFeedEmpty() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();

  return (
    <View style={[es.card, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
      <Ionicons name="golf-outline" size={36} color={c.textMuted} />
      <Text style={[es.title, { color: c.text, fontFamily: GEO }]}>Your story starts here</Text>
      <Text style={[es.desc, { color: c.textMuted, fontFamily: SANS }]}>
        Log a round and your feed comes alive.
      </Text>
      <Pressable
        onPress={() => { haptics.light(); router.push('/(tabs)/score'); }}
        style={({ pressed }) => [es.btn, { backgroundColor: '#006747' }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
        <Text style={[es.btnText, { fontFamily: SANS }]}>Log a Round</Text>
      </Pressable>
    </View>
  );
}

// ─── Ghost Leaderboard ──────────────────────────────────────────────
function GhostRow({ index }: { index: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const shimmer = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.6, duration: 1200, delay: index * 100, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[ghost.row, { borderBottomColor: c.border, opacity: shimmer }]}>
      <Text style={[ghost.pos, { color: c.textMuted, fontFamily: GEO }]}>{index + 1}</Text>
      <View style={[ghost.avatar, { backgroundColor: c.elevated }]} />
      <View style={ghost.nameArea}>
        <View style={[ghost.nameLine, { backgroundColor: c.elevated, width: 60 + Math.random() * 40 }]} />
        <View style={[ghost.subLine, { backgroundColor: c.elevated }]} />
      </View>
      <Text style={[ghost.score, { color: c.textMuted, fontFamily: GEO }]}>---</Text>
    </Animated.View>
  );
}

export function LeaderboardGhostEmpty() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();

  return (
    <View style={es.wrapper}>
      {/* Ghost table */}
      <View style={[ghost.table, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
        {/* Header */}
        <View style={[ghost.header, { backgroundColor: '#1E4D2B' }]}>
          <Text style={ghost.headerText}>POS</Text>
          <Text style={[ghost.headerText, { flex: 1, marginLeft: 44 }]}>PLAYER</Text>
          <Text style={ghost.headerText}>AVG</Text>
        </View>
        {[0, 1, 2, 3, 4].map(i => <GhostRow key={i} index={i} />)}
      </View>

      {/* CTA below */}
      <View style={[es.card, { backgroundColor: c.cardBg, borderColor: c.border, marginTop: 16 }, isDark ? cardShadowDark : cardShadowLight]}>
        <Text style={[es.desc, { color: c.textMuted, fontFamily: SANS }]}>
          Add friends and log rounds to see who's on top.
        </Text>
        <Pressable
          onPress={() => { haptics.light(); router.push('/add-friends'); }}
          style={({ pressed }) => [es.btn, { backgroundColor: '#006747' }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
        >
          <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
          <Text style={[es.btnText, { fontFamily: SANS }]}>Add Friends</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Profile Stats Empty State ──────────────────────────────────────
export function ProfileStatsEmpty() {
  const { theme } = useTheme();
  const c = theme.colors;

  const statItems = [
    { label: 'ROUNDS', value: '--' },
    { label: 'COURSES', value: '--' },
    { label: 'BEST', value: '--' },
    { label: 'AVG', value: '--' },
    { label: 'RECORDS', value: '--' },
    { label: 'TRIPS', value: '--' },
  ];

  const shimmer = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View>
      <Animated.View style={[pse.grid, { opacity: shimmer }]}>
        {statItems.map(item => (
          <View key={item.label} style={[pse.stat, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <Text style={[pse.statValue, { color: c.gold, fontFamily: GEO }]}>{item.value}</Text>
            <Text style={[pse.statLabel, { color: c.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </Animated.View>
      <Text style={[es.footnote, { color: c.textMuted, fontFamily: SANS }]}>
        Your stats build with every round.
      </Text>
    </View>
  );
}

// ─── Handicap Graph Empty State ─────────────────────────────────────
export function HandicapGraphEmpty() {
  const { theme } = useTheme();
  const c = theme.colors;
  const W = 320;
  const H = 100;

  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Y axis */}
        <Line x1={30} y1={10} x2={30} y2={H - 15} stroke={c.border} strokeWidth={1} />
        {/* X axis */}
        <Line x1={30} y1={H - 15} x2={W - 10} y2={H - 15} stroke={c.border} strokeWidth={1} />
        {/* Grid lines */}
        {[30, 50, 70].map(y => (
          <Line key={y} x1={30} y1={y} x2={W - 10} y2={y} stroke={c.border} strokeWidth={0.5} strokeDasharray="4,4" />
        ))}
        {/* Single dot at 0 position */}
        <Circle cx={35} cy={H - 20} r={4} fill={c.textMuted} />
      </Svg>
      <Text style={[es.footnote, { color: c.textMuted, fontFamily: SANS, marginTop: 4 }]}>
        Log 3+ rounds to see your handicap trend.
      </Text>
    </View>
  );
}

// ─── Season Tab Empty State ─────────────────────────────────────────
export function SeasonEmpty() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();

  return (
    <View style={[es.card, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
      <Ionicons name="trophy-outline" size={36} color={c.gold} />
      <Text style={[es.title, { color: c.text, fontFamily: GEO }]}>Ready to compete?</Text>
      <Text style={[es.desc, { color: c.textMuted, fontFamily: SANS }]}>
        Create your first season and challenge your crew.
      </Text>

      {/* Mini preview mockup */}
      <View style={[season.preview, { backgroundColor: c.elevated, borderColor: c.border }]}>
        <View style={[season.previewHeader, { backgroundColor: '#1E4D2B' }]}>
          <Text style={season.previewTitle}>SPRING CHAMPIONSHIP</Text>
        </View>
        {['McGowan', 'Fletcher', 'Patterson'].map((name, i) => (
          <View key={name} style={[season.previewRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: c.border }]}>
            <Text style={[season.previewRank, { color: c.textMuted, fontFamily: GEO }]}>{i + 1}</Text>
            <Text style={[season.previewName, { color: c.text, fontFamily: SANS }]}>{name}</Text>
            <Text style={[season.previewPts, { color: c.gold, fontFamily: GEO }]}>{72 - i * 8} pts</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => { haptics.light(); router.push('/seasons'); }}
        style={({ pressed }) => [es.btn, { backgroundColor: c.gold }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons name="add-circle-outline" size={16} color="#141210" />
        <Text style={[es.btnText, { color: '#141210', fontFamily: SANS }]}>Create Season</Text>
      </Pressable>
    </View>
  );
}

// ─── Trips Tab Empty State ──────────────────────────────────────────
export function TripsEmpty() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();

  return (
    <View style={[es.card, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
      <Ionicons name="airplane-outline" size={36} color={c.teal} />
      <Text style={[es.title, { color: c.text, fontFamily: GEO }]}>Where to next?</Text>
      <Text style={[es.desc, { color: c.textMuted, fontFamily: SANS }]}>
        Plan your first golf trip.
      </Text>
      <Pressable
        onPress={() => { haptics.light(); router.push('/create-trip'); }}
        style={({ pressed }) => [es.btn, { backgroundColor: c.teal }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
        <Text style={[es.btnText, { fontFamily: SANS }]}>Plan a Trip</Text>
      </Pressable>
    </View>
  );
}

// ─── Shared styles ──────────────────────────────────────────────────
const es = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
  },
  card: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  desc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footnote: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
});

const ghost = StyleSheet.create({
  table: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  pos: {
    width: 24,
    fontSize: 14,
    fontWeight: '700',
  },
  avatar: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  nameArea: {
    flex: 1,
    gap: 4,
  },
  nameLine: {
    height: 10,
  },
  subLine: {
    height: 7,
    width: 40,
  },
  score: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

const pse = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    width: '31%',
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
});

const season = StyleSheet.create({
  preview: {
    width: '100%',
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 8,
  },
  previewHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  previewTitle: {
    color: '#C9A227',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: 'Georgia',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewRank: {
    width: 20,
    fontSize: 12,
    fontWeight: '700',
  },
  previewName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  previewPts: {
    fontSize: 12,
    fontWeight: '700',
  },
});
