import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO, SANS } from '../../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../../src/theme/colors';
import { Avatar } from '../../src/components/Avatar';
import GoldDivider from '../../src/components/GoldDivider';
import { useAuth } from '../../src/lib/auth';
import { haptics } from '../../src/lib/haptics';

// ─── Mock data ──────────────────────────────────────────────────────

type MockSeason = {
  id: string;
  name: string;
  type: 'fedex' | 'ryder' | 'custom';
  status: 'active' | 'completed' | 'draft';
  currentWeek: number;
  totalWeeks: number;
  playerCount: number;
  leader?: { name: string; points: number };
  champion?: string;
  yourPosition?: number;
  format: string;
};

const MOCK_ACTIVE_SEASONS: MockSeason[] = [
  {
    id: 's1',
    name: '2026 Spring Championship',
    type: 'fedex',
    status: 'active',
    currentWeek: 4,
    totalWeeks: 12,
    playerCount: 8,
    leader: { name: 'McGowan', points: 72 },
    yourPosition: 1,
    format: 'FedEx Cup Points',
  },
];

const MOCK_PAST_SEASONS: MockSeason[] = [
  {
    id: 's2',
    name: '2025 Fall Classic',
    type: 'fedex',
    status: 'completed',
    currentWeek: 10,
    totalWeeks: 10,
    playerCount: 6,
    champion: 'Patterson',
    format: 'FedEx Cup Points',
  },
  {
    id: 's3',
    name: '2025 Ryder Cup',
    type: 'ryder',
    status: 'completed',
    currentWeek: 6,
    totalWeeks: 6,
    playerCount: 12,
    champion: 'Team Red',
    format: 'Ryder Cup',
  },
  {
    id: 's4',
    name: '2025 Summer Series',
    type: 'fedex',
    status: 'completed',
    currentWeek: 8,
    totalWeeks: 8,
    playerCount: 5,
    champion: 'Sullivan',
    format: 'Stableford',
  },
];

// ─── Pinstripe overlay ───────────────────────────────────────────────
function Pinstripes() {
  const lines = Array.from({ length: 40 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: -200,
            left: i * 18 - 100,
            width: 1,
            height: 800,
            backgroundColor: '#fff',
            opacity: 0.03,
            transform: [{ rotate: '35deg' }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Active Season Card ──────────────────────────────────────────────
function ActiveSeasonCard({ season }: { season: MockSeason }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();
  const progress = season.currentWeek / season.totalWeeks;

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        router.push({ pathname: '/season-detail', params: { id: season.id } });
      }}
      style={({ pressed }) => [
        st.activeCard,
        { backgroundColor: c.cardBg, borderColor: c.border },
        isDark ? cardShadowDark : cardShadowLight,
        pressed && { opacity: 0.85 },
      ]}
    >
      {/* Gold accent bar */}
      <View style={[st.cardAccent, { backgroundColor: c.gold }]} />

      <View style={st.cardBody}>
        {/* Status badge */}
        <View style={st.cardTopRow}>
          <View style={[st.statusBadge, { backgroundColor: '#006747' }]}>
            <Text style={st.statusText}>ACTIVE</Text>
          </View>
          <Text style={[st.formatLabel, { color: c.textMuted, fontFamily: SANS }]}>{season.format}</Text>
        </View>

        {/* Season name */}
        <Text style={[st.cardName, { color: c.text, fontFamily: GEO }]}>{season.name}</Text>

        {/* Progress */}
        <View style={st.progressRow}>
          <Text style={[st.progressText, { color: c.textMuted, fontFamily: SANS }]}>
            Week {season.currentWeek} of {season.totalWeeks}
          </Text>
          <Text style={[st.progressText, { color: c.textMuted, fontFamily: SANS }]}>
            {season.playerCount} players
          </Text>
        </View>
        <View style={[st.progressTrack, { backgroundColor: c.elevated }]}>
          <View style={[st.progressFill, { width: `${progress * 100}%`, backgroundColor: c.gold }]} />
        </View>

        {/* Leader / your position */}
        {season.leader && (
          <View style={[st.leaderRow, { borderTopColor: c.border }]}>
            <View style={st.leaderInfo}>
              <Ionicons name="trophy" size={14} color={c.gold} />
              <Text style={[st.leaderLabel, { color: c.textMuted, fontFamily: SANS }]}>Leader:</Text>
              <Text style={[st.leaderName, { color: c.text, fontFamily: GEO }]}>{season.leader.name}</Text>
              <Text style={[st.leaderPts, { color: c.gold, fontFamily: GEO }]}>{season.leader.points} pts</Text>
            </View>
            {season.yourPosition != null && (
              <Text style={[st.yourPos, { color: c.teal, fontFamily: GEO }]}>
                You: #{season.yourPosition}
              </Text>
            )}
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color={c.textMuted} style={st.cardChevron} />
    </Pressable>
  );
}

// ─── Past Season Card ────────────────────────────────────────────────
function PastSeasonCard({ season }: { season: MockSeason }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        router.push({ pathname: '/season-detail', params: { id: season.id } });
      }}
      style={({ pressed }) => [
        st.pastCard,
        { backgroundColor: c.cardBg, borderColor: c.border },
        isDark ? cardShadowDark : cardShadowLight,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={st.pastLeft}>
        <Text style={[st.pastName, { color: c.text, fontFamily: GEO }]}>{season.name}</Text>
        <Text style={[st.pastMeta, { color: c.textMuted, fontFamily: SANS }]}>
          {season.format} · {season.playerCount} players · {season.totalWeeks} weeks
        </Text>
      </View>
      <View style={st.pastRight}>
        {season.champion && (
          <View style={st.championRow}>
            <Ionicons name="trophy" size={12} color={c.gold} />
            <Text style={[st.championName, { color: c.gold, fontFamily: GEO }]}>{season.champion}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
      </View>
    </Pressable>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────
export default function SeasonsTab() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Would fetch real seasons from Supabase
    await new Promise((r) => setTimeout(r, 500));
    setRefreshing(false);
  }, []);

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.teal} />
        }
      >
        {/* Masters green header */}
        <LinearGradient
          colors={greenHeaderGradient}
          style={[st.header, { paddingTop: insets.top + 8 }]}
        >
          <Pinstripes />
          <Text style={[st.dormieLabel, { fontFamily: GEO }]}>DORMIE</Text>
          <View style={st.headerRow}>
            <Text style={[st.headerTitle, { fontFamily: GEO }]}>Seasons</Text>
            <Pressable
              onPress={() => { haptics.light(); router.push('/seasons'); }}
              style={({ pressed }) => [
                st.createBtn,
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons name="add" size={16} color="#1E4D2B" />
              <Text style={st.createBtnText}>New Season</Text>
            </Pressable>
          </View>
        </LinearGradient>
        <GoldDivider />

        <View style={st.body}>
          {/* Active Seasons */}
          {MOCK_ACTIVE_SEASONS.length > 0 && (
            <>
              <Text style={[st.sectionLabel, { color: c.gold, fontFamily: GEO }]}>ACTIVE</Text>
              <GoldDivider style={{ marginBottom: 12 }} />
              {MOCK_ACTIVE_SEASONS.map((s) => (
                <ActiveSeasonCard key={s.id} season={s} />
              ))}
            </>
          )}

          {/* Past Seasons */}
          {MOCK_PAST_SEASONS.length > 0 && (
            <>
              <Text style={[st.sectionLabel, { color: c.gold, fontFamily: GEO, marginTop: 24 }]}>
                COMPLETED
              </Text>
              <GoldDivider style={{ marginBottom: 12 }} />
              {MOCK_PAST_SEASONS.map((s) => (
                <PastSeasonCard key={s.id} season={s} />
              ))}
            </>
          )}

          {/* Empty state */}
          {MOCK_ACTIVE_SEASONS.length === 0 && MOCK_PAST_SEASONS.length === 0 && (
            <View style={[st.emptyState, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Ionicons name="trophy-outline" size={40} color={c.gold} />
              <Text style={[st.emptyTitle, { color: c.text, fontFamily: GEO }]}>No seasons yet</Text>
              <Text style={[st.emptyDesc, { color: c.textMuted, fontFamily: SANS }]}>
                Create your first season to track competitions with your crew
              </Text>
              <Pressable
                onPress={() => { haptics.light(); router.push('/seasons'); }}
                style={({ pressed }) => [
                  st.emptyBtn,
                  { backgroundColor: c.gold },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={st.emptyBtnText}>Create Season</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ height: 32 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  dormieLabel: {
    fontSize: 9,
    fontWeight: '700',
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createBtnText: {
    color: '#1E4D2B',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Georgia',
  },

  /* Body */
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  /* Section label */
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 12,
  },

  /* Active season card */
  activeCard: {
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  formatLabel: {
    fontSize: 10,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 10,
  },
  progressTrack: {
    height: 4,
    width: '100%',
  },
  progressFill: {
    height: 4,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  leaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaderLabel: {
    fontSize: 11,
  },
  leaderName: {
    fontSize: 13,
    fontWeight: '700',
  },
  leaderPts: {
    fontSize: 13,
    fontWeight: '700',
  },
  yourPos: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardChevron: {
    alignSelf: 'center',
    marginRight: 12,
  },

  /* Past season card */
  pastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  pastLeft: {
    flex: 1,
  },
  pastName: {
    fontSize: 14,
    fontWeight: '700',
  },
  pastMeta: {
    fontSize: 10,
    marginTop: 3,
  },
  pastRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  championRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  championName: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 32,
    marginTop: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 4,
  },
  emptyBtnText: {
    color: '#141210',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Georgia',
  },
});
