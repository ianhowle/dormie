import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, StatusBar, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/lib/auth';
import { GEO, SANS } from '../../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient, tickerShadowDark, tickerShadowLight } from '../../src/theme/colors';
import GoldDivider from '../../src/components/GoldDivider';
import { Avatar } from '../../src/components/Avatar';
import { SkeletonFeed, SkeletonStats } from '../../src/components/Skeleton';
import { DataFreshness } from '../../src/components/DataFreshness';
import { useToast } from '../../src/components/Toast';
import { haptics } from '../../src/lib/haptics';
import { roundsService } from '../../src/services/rounds.service';
import { friendsService } from '../../src/services/friends.service';
import { tripsService } from '../../src/services/trips.service';
import { getGreeting, getGreetingSubtitle, isMastersTheme, getEventAccentColor, isPlayoffsTheme } from '../../src/lib/greeting';
import { fetchWeather, type WeatherData } from '../../src/lib/weather';
import { computeStreaks, type Streak } from '../../src/lib/streaks';
import { formatWeeklyDigest, computeWeeklyDigest } from '../../src/lib/streaks';
import { leaderboardRowLabel, statLabel } from '../../src/lib/accessibility';
import { shouldShowMonthlyDigest, getPreviousMonthName, GRADE_COPY, computeMonthGrade, type MonthGrade } from '../../src/data/monthly-stats';
import type { RoundWithCourse, FriendshipWithUser } from '../../src/lib/database.types';

/** Toggle to show mock/demo data for screenshots and demos */
const DEV_DEMO_MODE = false;
import {
  MOCK_QUICK_STATS,
  MOCK_FEED,
  MOCK_UPCOMING,
  type FeedItem,
  type QuickStats,
  type UpcomingItem,
} from '../../src/data/homeFeed';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Mock data ──────────────────────────────────────────────────────
const MOCK_GROUPS = [
  { id: 'g1', name: 'The Dormie Boys', color: '#006747', memberCount: 8 },
  { id: 'g2', name: 'Nashville Golf Club', color: '#C9A227', memberCount: 12 },
  { id: 'g3', name: 'Work League', color: '#C41E3A', memberCount: 6 },
];

// Season format types for adaptive standings display
type SeasonFormat = 'fedex_cup' | 'ryder_cup' | 'match_play' | 'stroke_avg' | 'stableford';

type SeasonStandingEntry = {
  rank: number;
  name: string;
  points?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  avg?: number;
  rounds?: number;
  team?: 'red' | 'blue';
};

const MOCK_ACTIVE_SEASON = {
  id: 's1',
  name: '2026 Spring Championship',
  format: 'fedex_cup' as SeasonFormat,
  currentRound: 4,
  totalRounds: 12,
  groupName: 'The Dormie Boys',
};

const MOCK_SEASON_STANDINGS: SeasonStandingEntry[] = [
  { rank: 1, name: 'McGowan', points: 72 },
  { rank: 2, name: 'Patterson', points: 65 },
  { rank: 3, name: 'Sullivan', points: 55 },
  { rank: 4, name: 'Fleetwood', points: 48 },
  { rank: 5, name: 'Chen', points: 42 },
];

const MOCK_FAVORITE_COURSE = {
  name: 'Hermitage Golf Course',
  location: 'Old Hickory, TN',
  timesPlayed: 34,
  bestGross: 74,
  bestNet: 68,
  avgScore: 78.3,
};

const MOCK_ROUND_RESULT = {
  round: 4,
  userScore: { gross: 78, net: 72 },
  opponentName: 'Patterson',
  opponentId: '2',
  opponentScore: { gross: 82, net: 75 },
  result: 'WIN' as const,
  margin: '3 strokes',
};

const MOCK_NEXT_MATCHUP = {
  round: 5,
  opponentName: 'Sullivan',
  opponentId: '3',
  opponentPosition: 3,
  opponentPoints: 55,
  userPosition: 1,
  userPoints: 72,
  date: 'Mar 22, 2026',
};

// ─── (greeting now imported from src/lib/greeting) ──────────────────

// ─── Time ago ─────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const mins = Math.floor((now - then) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Feed icon ────────────────────────────────────────────────────────
function feedIcon(type: FeedItem['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'round_posted': return 'golf-outline';
    case 'trip_created': return 'airplane-outline';
    case 'season_update': return 'trophy-outline';
    case 'achievement': return 'star-outline';
  }
}

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

// ─── Header bar: Logo button | DORMIE | Badge + Dark mode toggle + Avatar ────
function HeaderBar({
  onLogoPress,
  showMenu,
  pendingCount,
}: {
  onLogoPress: () => void;
  showMenu: boolean;
  pendingCount: number;
}) {
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();
  const { user } = useAuth();
  const name = user?.user_metadata?.name ?? 'Golfer';

  return (
    <View style={[st.headerBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      {/* Logo button — flagstick on green square */}
      <Pressable onPress={() => { haptics.light(); onLogoPress(); }} style={({ pressed }) => [st.logoBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
        <View style={st.logoBg}>
          <Ionicons name="flag" size={16} color="#C9A227" />
        </View>
      </Pressable>

      {/* Centered DORMIE */}
      <Text style={[st.headerDormie, { color: c.text, fontFamily: GEO }]}>DORMIE</Text>

      {/* Right side: friend badge + dark mode toggle + profile avatar */}
      <View style={st.headerRight}>
        {pendingCount > 0 && (
          <View style={st.badgeWrap}>
            <Ionicons name="people" size={20} color={c.textMuted} />
            <View style={st.badge}>
              <Text style={st.badgeText}>{pendingCount}</Text>
            </View>
          </View>
        )}
        <Pressable onPress={toggleTheme} hitSlop={12} style={({ pressed }) => [st.themeToggle, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
          <Ionicons name={theme.isDark ? 'sunny' : 'moon'} size={20} color={c.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => { haptics.light(); router.push('/(tabs)/profile'); }}
          hitSlop={8}
          style={({ pressed }) => [{ marginLeft: 4 }, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
        >
          <Avatar id={user?.id ?? '1'} size={32} name={name} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Logo menu dropdown ──────────────────────────────────────────────
function LogoMenu({
  visible,
  onClose,
  activeGroupId,
  onGroupSelect,
}: {
  visible: boolean;
  onClose: () => void;
  activeGroupId: string;
  onGroupSelect: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();

  if (!visible) return null;

  const items = [
    { label: 'Profile', icon: 'person-outline' as const, onPress: () => router.push('/(tabs)/profile') },
    { label: 'Seasons', icon: 'trophy-outline' as const, onPress: () => router.push('/seasons') },
    { label: 'Create New Group', icon: 'add-circle-outline' as const, onPress: () => {} },
    { label: 'Invite Player', icon: 'person-add-outline' as const, onPress: () => {} },
    { label: 'Play a Round', icon: 'golf-outline' as const, onPress: () => router.push('/(tabs)/score') },
    { label: 'Settings', icon: 'settings-outline' as const, onPress: () => {} },
  ];

  return (
    <>
      <Pressable style={st.menuOverlay} onPress={onClose} />
      <View style={[st.menuDropdown, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
        {items.map((item, i) => (
          <Pressable
            key={item.label}
            onPress={() => { haptics.light(); item.onPress(); onClose(); }}
            style={({ pressed }) => [st.menuItem, i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
          >
            <Ionicons name={item.icon} size={16} color={c.textMuted} />
            <Text style={[st.menuItemText, { color: c.text, fontFamily: SANS }]}>{item.label}</Text>
          </Pressable>
        ))}
        {/* MY GROUPS section — tappable to switch active group */}
        <View style={[st.menuGroupHeader, { borderTopWidth: 1, borderTopColor: c.border }]}>
          <Text style={[st.menuGroupLabel, { color: c.gold, fontFamily: GEO }]}>MY GROUPS</Text>
        </View>
        {MOCK_GROUPS.map((group) => {
          const isActive = group.id === activeGroupId;
          return (
            <Pressable
              key={group.id}
              onPress={() => { haptics.light(); onGroupSelect(group.id); onClose(); }}
              style={({ pressed }) => [
                st.menuItem,
                isActive && { borderLeftWidth: 3, borderLeftColor: '#006747', backgroundColor: 'rgba(0,103,71,0.15)' },
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={[st.menuGroupDot, { backgroundColor: group.color }]} />
              <Text style={[st.menuItemText, { color: isActive ? '#006747' : c.text, flex: 1, fontFamily: SANS }]}>
                {group.name}
              </Text>
              {isActive && <Ionicons name="checkmark" size={14} color="#006747" />}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

// ─── Greeting section — Masters green gradient + pinstripes ──────────
function GreetingSection({ name, groupName, weather }: { name: string; groupName: string; weather: WeatherData | null }) {
  const mastersGradient: [string, string] = ['#2A2318', '#1A1510'];
  const gradientColors = isMastersTheme() ? mastersGradient : (greenHeaderGradient as unknown as string[]);
  const subtitle = getGreetingSubtitle();
  const eventAccent = getEventAccentColor();
  const playoffs = isPlayoffsTheme();

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={st.greetingSection}
    >
      <Pinstripes />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[st.greetingText, isMastersTheme() && { color: '#C9A227' }]}>{getGreeting(name)}</Text>
        {weather && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 12 }}>{weather.emoji}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', fontFamily: 'Georgia' }}>{weather.temp}{'\u00B0'}</Text>
          </View>
        )}
      </View>
      {subtitle && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {playoffs && (
            <View style={{ backgroundColor: '#C9A227', paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: '#141210', fontSize: 9, fontWeight: '800', letterSpacing: 1, fontFamily: 'Georgia' }}>PLAYOFFS</Text>
            </View>
          )}
          <Text style={{ color: eventAccent ?? '#C9A227', fontSize: 12, fontStyle: 'italic', fontFamily: 'Georgia' }}>{subtitle}</Text>
        </View>
      )}
      <Text style={st.greetingGroup}>{groupName}</Text>
      <Text style={st.goLowText}>GO LOW</Text>
    </LinearGradient>
  );
}

// ─── ESPN Ticker — Masters green bar with player pills ───────────────
type StandingPill = {
  rank: number;
  name: string;
  toPar: string;
  movement: 'up' | 'down' | 'same';
  isMe: boolean;
};

function ESPNTicker({ standings }: { standings: StandingPill[] }) {
  if (standings.length === 0) return null;

  return (
    <View style={[st.tickerBar, tickerShadowDark]}>
      {/* STANDINGS label */}
      <View style={st.tickerLabelWrap}>
        <Text style={st.tickerLabel}>STANDINGS</Text>
      </View>
      <View style={st.tickerDivider} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.tickerScroll}
      >
        {standings.map((p, i) => {
          const arrowChar = p.movement === 'up' ? '\u25B2' : p.movement === 'down' ? '\u25BC' : '\u2013';
          const arrowColor = p.movement === 'up' ? '#006747' : p.movement === 'down' ? '#C41E3A' : '#6B6560';
          return (
            <View
              key={i}
              style={[st.tickerPill, p.isMe && st.tickerPillMe]}
            >
              <Text style={st.tickerRank}>{p.rank}</Text>
              <Text style={[st.tickerArrow, { color: arrowColor }]}>{arrowChar}</Text>
              <Text style={[st.tickerName, p.isMe && st.tickerNameMe]}>{p.name}</Text>
              <Text style={st.tickerScore}>{p.toPar}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── User Profile Section ────────────────────────────────────────────
function UserProfileSection({ stats }: { stats: QuickStats }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const { user } = useAuth();
  const name = user?.user_metadata?.name ?? 'Golfer';

  return (
    <View style={st.profileSection}>
      <View style={st.profileRow}>
        <View style={{ position: 'relative' }}>
          <Avatar id={user?.id ?? '1'} size={56} name={name} />
          <Pressable
            onPress={() => { haptics.light(); }}
            style={st.profileEditBtn}
          >
            <Ionicons name="camera" size={10} color="#fff" />
          </Pressable>
        </View>
        <View style={st.profileInfo}>
          <Text style={[st.profileName, { color: c.text, fontFamily: GEO }]}>{name}</Text>
          <Text style={[st.profileLocation, { color: c.textMuted, fontFamily: SANS }]}>Mount Juliet, TN</Text>
          <View style={st.profileStatsRow}>
            <View style={st.profileStatItem}>
              <Text style={[st.profileStatValue, { color: c.gold, fontFamily: GEO }]}>
                {stats.handicap ? stats.handicap.toFixed(1) : '--'}
              </Text>
              <Text style={[st.profileStatLabel, { color: c.textMuted }]}>HCP</Text>
            </View>
            <View style={[st.profileStatDivider, { backgroundColor: c.border }]} />
            <View style={st.profileStatItem}>
              <Text style={[st.profileStatValue, { color: c.gold, fontFamily: GEO }]}>
                {stats.bestRecent > 0 ? String(stats.bestRecent) : '--'}
              </Text>
              <Text style={[st.profileStatLabel, { color: c.textMuted }]}>BEST</Text>
            </View>
            <View style={[st.profileStatDivider, { backgroundColor: c.border }]} />
            <View style={st.profileStatItem}>
              <Text style={[st.profileStatValue, { color: c.gold, fontFamily: GEO }]}>
                {stats.monthRounds > 0 ? String(stats.monthRounds) : '--'}
              </Text>
              <Text style={[st.profileStatLabel, { color: c.textMuted }]}>LAST</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Season Standings Section (format-adaptive) ─────────────────────
function SeasonStandingsSection({ groupName }: { groupName: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();
  const season = MOCK_ACTIVE_SEASON;

  const renderColumnHeaders = () => {
    switch (season.format) {
      case 'ryder_cup':
        return (
          <View style={[st.seasonRow, { borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 6 }]}>
            <Text style={[st.seasonHeaderCol, { color: '#C41E3A', fontFamily: GEO }]}>TEAM RED</Text>
            <Text style={[st.seasonHeaderCol, { color: c.textMuted, fontFamily: GEO, textAlign: 'center' }]}>SCORE</Text>
            <Text style={[st.seasonHeaderCol, { color: '#1B2A4A', fontFamily: GEO, textAlign: 'right' }]}>TEAM BLUE</Text>
          </View>
        );
      case 'match_play':
        return (
          <View style={[st.seasonRow, { borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 6 }]}>
            <Text style={[{ width: 24, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO }]}>#</Text>
            <Text style={[{ flex: 1, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO }]}>PLAYER</Text>
            <Text style={[{ width: 50, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO, textAlign: 'center' }]}>W-L-T</Text>
            <Text style={[{ width: 40, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO, textAlign: 'right' }]}>PTS</Text>
          </View>
        );
      case 'stroke_avg':
        return (
          <View style={[st.seasonRow, { borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 6 }]}>
            <Text style={[{ width: 24, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO }]}>#</Text>
            <Text style={[{ flex: 1, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO }]}>PLAYER</Text>
            <Text style={[{ width: 40, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO, textAlign: 'center' }]}>AVG</Text>
            <Text style={[{ width: 40, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO, textAlign: 'right' }]}>RNDS</Text>
          </View>
        );
      default: // fedex_cup, stableford
        return (
          <View style={[st.seasonRow, { borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 6 }]}>
            <Text style={[{ width: 24, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO }]}>#</Text>
            <Text style={[{ flex: 1, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO }]}>PLAYER</Text>
            <Text style={[{ width: 40, fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: c.textMuted, fontFamily: GEO, textAlign: 'right' }]}>PTS</Text>
          </View>
        );
    }
  };

  const renderRow = (s: SeasonStandingEntry, i: number) => {
    const isFirst = s.rank === 1;

    switch (season.format) {
      case 'match_play':
        return (
          <Pressable
            key={s.rank}
            onPress={() => { haptics.light(); router.push({ pathname: '/season-detail', params: { id: season.id } }); }}
            style={({ pressed }) => [
              st.seasonRow,
              i < MOCK_SEASON_STANDINGS.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
              isFirst && { backgroundColor: 'rgba(42, 157, 143, 0.08)' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[st.seasonRank, { color: isFirst ? '#006747' : c.textMuted, fontFamily: GEO }]}>{s.rank}</Text>
            <Text style={[st.seasonName, { color: isFirst ? '#006747' : c.text, fontFamily: SANS }]}>{s.name}</Text>
            <Text style={[{ width: 50, fontSize: 12, fontWeight: '600', textAlign: 'center', color: c.text, fontFamily: GEO }]}>
              {s.wins ?? 0}-{s.losses ?? 0}-{s.ties ?? 0}
            </Text>
            <Text style={[st.seasonPoints, { color: c.gold, fontFamily: GEO }]}>{s.points}</Text>
          </Pressable>
        );
      case 'stroke_avg':
        return (
          <Pressable
            key={s.rank}
            onPress={() => { haptics.light(); router.push({ pathname: '/season-detail', params: { id: season.id } }); }}
            style={({ pressed }) => [
              st.seasonRow,
              i < MOCK_SEASON_STANDINGS.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
              isFirst && { backgroundColor: 'rgba(42, 157, 143, 0.08)' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[st.seasonRank, { color: isFirst ? '#006747' : c.textMuted, fontFamily: GEO }]}>{s.rank}</Text>
            <Text style={[st.seasonName, { color: isFirst ? '#006747' : c.text, fontFamily: SANS }]}>{s.name}</Text>
            <Text style={[{ width: 40, fontSize: 14, fontWeight: '700', textAlign: 'center', color: c.gold, fontFamily: GEO }]}>
              {s.avg?.toFixed(1) ?? '--'}
            </Text>
            <Text style={[{ width: 40, fontSize: 12, fontWeight: '600', textAlign: 'right', color: c.textMuted, fontFamily: GEO }]}>
              {s.rounds ?? 0}
            </Text>
          </Pressable>
        );
      default: // fedex_cup, stableford
        return (
          <Pressable
            key={s.rank}
            onPress={() => { haptics.light(); router.push({ pathname: '/season-detail', params: { id: season.id } }); }}
            style={({ pressed }) => [
              st.seasonRow,
              i < MOCK_SEASON_STANDINGS.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
              isFirst && { backgroundColor: 'rgba(42, 157, 143, 0.08)' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[st.seasonRank, { color: isFirst ? '#006747' : c.textMuted, fontFamily: GEO }]}>{s.rank}</Text>
            <Text style={[st.seasonName, { color: isFirst ? '#006747' : c.text, fontFamily: SANS }]}>{s.name}</Text>
            <Text style={[st.seasonPoints, { color: c.gold, fontFamily: GEO }]}>{s.points}</Text>
          </Pressable>
        );
    }
  };

  return (
    <View style={st.seasonSection}>
      {/* Tappable season name header → navigates to seasons.tsx */}
      <Pressable
        onPress={() => { haptics.light(); router.push({ pathname: '/season-detail', params: { id: season.id } }); }}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pressed && { opacity: 0.7 }]}
      >
        <Text style={[st.seasonLabel, { color: c.gold, fontFamily: GEO, marginBottom: 0 }]}>{season.name.toUpperCase()}</Text>
        <Ionicons name="chevron-forward" size={14} color={c.gold} />
      </Pressable>
      <GoldDivider style={{ marginBottom: 12, marginTop: 12 }} />
      <View style={st.seasonSubRow}>
        <Text style={[st.seasonSubText, { color: c.textMuted, fontFamily: SANS }]}>
          Round {season.currentRound} of {season.totalRounds}
        </Text>
        <Pressable
          onPress={() => { haptics.light(); router.push('/seasons'); }}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Text style={[st.seasonSubText, { color: c.teal, fontFamily: SANS, fontWeight: '700' }]}>View All Seasons</Text>
        </Pressable>
      </View>
      <View style={[st.seasonList, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
        {renderColumnHeaders()}
        {MOCK_SEASON_STANDINGS.map((s, i) => renderRow(s, i))}
      </View>
    </View>
  );
}

// ─── Round Result Card ──────────────────────────────────────────────
function RoundResultCard() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const r = MOCK_ROUND_RESULT;
  const isWin = r.result === 'WIN';

  return (
    <View style={st.resultSection}>
      <Text style={[st.seasonLabel, { color: c.gold, fontFamily: GEO }]}>
        ROUND {r.round} RESULT
      </Text>
      <GoldDivider style={{ marginBottom: 12 }} />
      <View style={[st.resultCard, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
        {/* User side */}
        <View style={st.resultSide}>
          <Avatar id="1" size={44} name="McGowan" />
          <Text style={[st.resultPlayerName, { color: c.text, fontFamily: SANS }]}>McGowan</Text>
          <View style={st.resultScores}>
            <Text style={[st.resultScoreLabel, { color: c.textMuted }]}>GROSS</Text>
            <Text style={[st.resultScoreValue, { color: c.text, fontFamily: GEO }]}>
              {r.userScore.gross}
            </Text>
          </View>
          <View style={st.resultScores}>
            <Text style={[st.resultScoreLabel, { color: c.textMuted }]}>NET</Text>
            <Text style={[st.resultScoreValue, { color: c.text, fontFamily: GEO }]}>
              {r.userScore.net}
            </Text>
          </View>
        </View>

        {/* Center badge */}
        <View style={st.resultCenter}>
          <View style={[st.resultBadge, { backgroundColor: isWin ? '#006747' : '#C41E3A' }]}>
            <Text style={st.resultBadgeText}>{r.result}</Text>
          </View>
          <Text style={[st.resultMargin, { color: c.textMuted, fontFamily: SANS }]}>{r.margin}</Text>
        </View>

        {/* Opponent side */}
        <View style={st.resultSide}>
          <Avatar id={r.opponentId} size={44} name={r.opponentName} />
          <Text style={[st.resultPlayerName, { color: c.text, fontFamily: SANS }]}>{r.opponentName}</Text>
          <View style={st.resultScores}>
            <Text style={[st.resultScoreLabel, { color: c.textMuted }]}>GROSS</Text>
            <Text style={[st.resultScoreValue, { color: c.text, fontFamily: GEO }]}>
              {r.opponentScore.gross}
            </Text>
          </View>
          <View style={st.resultScores}>
            <Text style={[st.resultScoreLabel, { color: c.textMuted }]}>NET</Text>
            <Text style={[st.resultScoreValue, { color: c.text, fontFamily: GEO }]}>
              {r.opponentScore.net}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Next Matchup Card ──────────────────────────────────────────────
function NextMatchupCard() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const m = MOCK_NEXT_MATCHUP;

  return (
    <View style={st.matchupSection}>
      <Text style={[st.seasonLabel, { color: c.gold, fontFamily: GEO }]}>
        NEXT MATCHUP {'\u2022'} ROUND {m.round}
      </Text>
      <GoldDivider style={{ marginBottom: 12 }} />
      <View style={[st.matchupCard, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
        {/* User side */}
        <View style={st.matchupSide}>
          <Avatar id="1" size={40} name="McGowan" />
          <Text style={[st.matchupName, { color: c.text, fontFamily: SANS }]}>McGowan</Text>
          <Text style={[st.matchupPos, { color: c.textMuted, fontFamily: GEO }]}>#{m.userPosition}</Text>
          <Text style={[st.matchupPts, { color: '#006747', fontFamily: GEO }]}>{m.userPoints} pts</Text>
        </View>

        {/* VS */}
        <View style={st.matchupCenter}>
          <Text style={[st.matchupVs, { color: c.textMuted, fontFamily: GEO }]}>VS</Text>
          <Text style={[st.matchupDate, { color: c.textMuted, fontFamily: SANS }]}>{m.date}</Text>
        </View>

        {/* Opponent side */}
        <View style={st.matchupSide}>
          <Avatar id={m.opponentId} size={40} name={m.opponentName} />
          <Text style={[st.matchupName, { color: c.text, fontFamily: SANS }]}>{m.opponentName}</Text>
          <Text style={[st.matchupPos, { color: c.textMuted, fontFamily: GEO }]}>#{m.opponentPosition}</Text>
          <Text style={[st.matchupPts, { color: '#006747', fontFamily: GEO }]}>{m.opponentPoints} pts</Text>
        </View>
      </View>
    </View>
  );
}

// ─── My Groups Section ──────────────────────────────────────────────
function MyGroupsSection({
  activeGroupId,
  onGroupSelect,
}: {
  activeGroupId: string;
  onGroupSelect: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  return (
    <View style={st.groupsSection}>
      <Text style={[st.seasonLabel, { color: c.gold, fontFamily: GEO }]}>MY GROUPS</Text>
      <GoldDivider style={{ marginBottom: 12 }} />
      {MOCK_GROUPS.map((group) => {
        const isActive = group.id === activeGroupId;
        const initial = group.name.charAt(0).toUpperCase();
        return (
          <Pressable
            key={group.id}
            onPress={() => { haptics.light(); onGroupSelect(group.id); }}
            style={({ pressed }) => [
              st.groupCard,
              {
                backgroundColor: c.cardBg,
                borderColor: c.border,
                borderLeftWidth: isActive ? 3 : 1,
                borderLeftColor: isActive ? '#006747' : c.border,
              },
              isDark ? cardShadowDark : cardShadowLight,
              isActive && { backgroundColor: 'rgba(0,103,71,0.15)' },
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={[st.groupInitialBox, { backgroundColor: group.color }]}>
              <Text style={st.groupInitial}>{initial}</Text>
            </View>
            <View style={st.groupInfo}>
              <Text style={[st.groupName, { color: c.text, fontFamily: SANS }]}>{group.name}</Text>
              <Text style={[st.groupMembers, { color: c.textMuted, fontFamily: SANS }]}>
                {group.memberCount} members
              </Text>
            </View>
            {isActive && <Ionicons name="checkmark-circle" size={20} color="#006747" />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Quick stats row ─────────────────────────────────────────────────
function QuickStatsRow({ stats }: { stats: QuickStats }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  const items = [
    { label: 'HANDICAP', value: stats.handicap ? stats.handicap.toFixed(1) : '--', color: c.gold, isHandicap: true },
    { label: 'THIS MONTH', value: stats.monthRounds > 0 ? String(stats.monthRounds) : '--', color: c.gold, isHandicap: false },
    { label: 'BEST RECENT', value: stats.bestRecent > 0 ? String(stats.bestRecent) : '--', color: c.gold, isHandicap: false },
    { label: 'STREAK', value: stats.streak || '--', color: c.gold, isHandicap: false },
  ];

  return (
    <View style={st.statsRow}>
      {items.map((item) => (
        <View key={item.label} accessibilityLabel={statLabel(item.value, item.label)} style={[st.statBox, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
          <Text style={[st.statValue, { color: item.color, fontFamily: GEO, fontSize: item.isHandicap ? 28 : 18, letterSpacing: item.isHandicap ? -1 : 0 }]}>
            {item.value}
          </Text>
          <Text style={[st.statLabel, { color: c.textMuted }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Quick actions row ───────────────────────────────────────────────
function QuickActions() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  return (
    <View style={st.actionsRow}>
      <Pressable
        accessibilityLabel="Switch to Log Round"
        onPress={() => { haptics.light(); router.push('/(tabs)/score'); }}
        style={({ pressed }) => [st.actionBtn, { backgroundColor: c.greenDark }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons name="add-circle-outline" size={18} color="#fff" />
        <Text style={[st.actionPrimaryText, { fontFamily: SANS }]}>Log Round</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Switch to New Trip"
        onPress={() => { haptics.light(); router.push('/(tabs)/trips'); }}
        style={({ pressed }) => [st.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.gold }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons name="airplane-outline" size={18} color={c.gold} />
        <Text style={[st.actionSecText, { color: c.gold, fontFamily: SANS }]}>New Trip</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Switch to Leaderboard"
        onPress={() => { haptics.light(); router.push('/(tabs)/leaderboard'); }}
        style={({ pressed }) => [st.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons name="trophy-outline" size={18} color={c.teal} />
        <Text style={[st.actionSecText, { color: c.teal, fontFamily: SANS }]}>Leaderboard</Text>
      </Pressable>
    </View>
  );
}

// ─── Favorite Course Section ─────────────────────────────────────────
function FavoriteCourseSection() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const fav = MOCK_FAVORITE_COURSE;

  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[st.seasonLabel, { color: c.gold, fontFamily: GEO }]}>FAVORITE COURSE</Text>
        <Pressable onPress={() => { haptics.light(); }} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <Text style={{ color: c.teal, fontSize: 11, fontWeight: '600', fontFamily: SANS }}>Change</Text>
        </Pressable>
      </View>
      <GoldDivider style={{ marginBottom: 12 }} />
      <View style={[{ backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }, isDark ? cardShadowDark : cardShadowLight]}>
        {/* Dark gradient overlay simulating a course photo background */}
        <LinearGradient
          colors={['#1E4D2B', '#0D2818']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 16 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', fontFamily: GEO }}>{fav.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: SANS, marginTop: 2 }}>{fav.location}</Text>
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 }}>PLAYED</Text>
              <Text style={{ color: '#C9A227', fontSize: 18, fontWeight: '700', fontFamily: GEO }}>{fav.timesPlayed}</Text>
            </View>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 }}>BEST</Text>
              <Text style={{ color: '#C9A227', fontSize: 18, fontWeight: '700', fontFamily: GEO }}>{fav.bestGross}</Text>
            </View>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 }}>NET</Text>
              <Text style={{ color: '#C9A227', fontSize: 18, fontWeight: '700', fontFamily: GEO }}>{fav.bestNet}</Text>
            </View>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 }}>AVG</Text>
              <Text style={{ color: '#C9A227', fontSize: 18, fontWeight: '700', fontFamily: GEO }}>{fav.avgScore.toFixed(1)}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

// ─── Section header ──────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Text style={[st.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
      {title}
    </Text>
  );
}

// ─── Feed card ───────────────────────────────────────────────────────
function FeedCard({ item }: { item: FeedItem }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const isMe = item.playerId === '1';

  return (
    <Pressable accessibilityLabel={`${isMe ? 'You' : item.playerName}: ${item.description}`} style={({ pressed }) => [st.feedCard, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
      <View style={st.feedLeft}>
        <Avatar id={item.playerId} size={36} name={item.playerName} />
      </View>
      <View style={st.feedContent}>
        <View style={st.feedTopRow}>
          <Text style={[st.feedName, { color: c.text, fontFamily: SANS }]} numberOfLines={1}>
            {isMe ? 'You' : item.playerName}
          </Text>
          <Text style={[st.feedTime, { color: c.textMuted, fontFamily: SANS }]}>
            {timeAgo(item.timestamp)}
          </Text>
        </View>
        <Text style={[st.feedDesc, { color: c.textMuted, fontFamily: SANS }]} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <Ionicons
        name={feedIcon(item.type)}
        size={16}
        color={c.textMuted}
        style={st.feedIcon}
      />
    </Pressable>
  );
}

// ─── Upcoming card ───────────────────────────────────────────────────
function UpcomingCard({ item }: { item: UpcomingItem }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const isTrip = item.type === 'trip';

  return (
    <Pressable
      style={({ pressed }) => [
        st.upcomingCard,
        {
          backgroundColor: c.cardBg,
          borderColor: isTrip ? c.teal : c.gold,
          borderLeftWidth: 3,
        },
        isDark ? cardShadowDark : cardShadowLight,
        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={st.upcomingInfo}>
        <View style={st.upcomingTopRow}>
          <Ionicons
            name={isTrip ? 'airplane-outline' : 'trophy-outline'}
            size={14}
            color={isTrip ? c.teal : c.gold}
          />
          <Text style={[st.upcomingTitle, { color: c.text, fontFamily: SANS }]} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <Text style={[st.upcomingSub, { color: c.textMuted, fontFamily: SANS }]}>
          {item.subtitle}
        </Text>
      </View>
      <View style={[st.countdownBadge, { backgroundColor: isTrip ? `${c.teal}18` : `${c.gold}18` }]}>
        <Text style={[st.countdownNum, { color: isTrip ? c.teal : c.gold, fontFamily: GEO }]}>
          {item.daysAway}
        </Text>
        <Text style={[st.countdownLabel, { color: isTrip ? c.teal : c.gold }]}>
          days
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────
export default function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();
  const firstName = user?.user_metadata?.name?.split(' ')[0];
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [realRounds, setRealRounds] = useState<RoundWithCourse[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendshipWithUser[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showDemoData, setShowDemoData] = useState(DEV_DEMO_MODE);
  const [activeGroup, setActiveGroup] = useState(MOCK_GROUPS[0]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [monthlyDismissed, setMonthlyDismissed] = useState(false);
  const [weeklyDismissed, setWeeklyDismissed] = useState(false);

  const handleGroupSelect = useCallback((id: string) => {
    const group = MOCK_GROUPS.find((g) => g.id === id);
    if (group) setActiveGroup(group);
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [rounds, requests] = await Promise.all([
        roundsService.getByUser(user.id, 10).catch(() => [] as RoundWithCourse[]),
        friendsService.getPendingRequests(user.id).catch(() => [] as FriendshipWithUser[]),
      ]);
      setRealRounds(rounds);
      setPendingRequests(requests);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    showToast({ message: 'Feed updated', type: 'success' });
  }, [fetchData, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchWeather().then(setWeather).catch(() => {});
  }, []);

  const activeStreaks = useMemo(() => {
    if (realRounds.length > 0) {
      return computeStreaks({
        recentScores: realRounds.map(r => r.gross_score),
        handicapTrend: [], // Would need handicap history from profile
        h2hResults: [],
        roundDates: realRounds.map(r => new Date(r.played_at)),
      });
    }
    if (!showDemoData) return [];
    return computeStreaks({
      recentScores: [78, 76, 79, 74, 77, 76, 75],
      handicapTrend: [9.2, 8.9, 8.7, 8.4, 8.2],
      h2hResults: [{ opponent: 'Tyler', wins: 4, losses: 1 }],
      roundDates: [new Date(), new Date(Date.now() - 7 * 86400000), new Date(Date.now() - 14 * 86400000), new Date(Date.now() - 21 * 86400000)],
    });
  }, [realRounds, showDemoData]);

  // Build real quick stats
  const quickStats = useMemo(() => {
    if (realRounds.length === 0 && showDemoData) return MOCK_QUICK_STATS;
    const now = new Date();
    const thisMonth = realRounds.filter(r => {
      const d = new Date(r.played_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const scores = realRounds.map(r => r.gross_score);
    return {
      handicap: user?.user_metadata?.handicap_index ?? 0,
      monthRounds: thisMonth.length,
      bestRecent: scores.length > 0 ? Math.min(...scores) : 0,
      streak: realRounds.length >= 3 ? `${realRounds.length}` : '-',
    };
  }, [realRounds, user, showDemoData]);

  // Build feed from real rounds
  const feedItems: FeedItem[] = useMemo(() => {
    if (realRounds.length === 0 && showDemoData) return MOCK_FEED;
    if (realRounds.length === 0) return [];
    return realRounds.slice(0, 6).map((r) => ({
      id: r.id,
      type: 'round_posted' as const,
      playerId: r.user_id,
      playerName: user?.user_metadata?.name ?? 'You',
      description: `posted ${r.gross_score} at ${r.course?.name ?? 'Unknown'}`,
      timestamp: r.played_at,
    }));
  }, [realRounds, user, showDemoData]);

  // ESPN ticker standings — always show (mock data for new users)
  const standings: StandingPill[] = useMemo(() => {
    return [
      { rank: 1, name: 'McGowan', toPar: '-2.1', movement: 'same' as const, isMe: true },
      { rank: 2, name: 'Fletcher', toPar: '+0.4', movement: 'up' as const, isMe: false },
      { rank: 3, name: 'Patterson', toPar: '+1.2', movement: 'down' as const, isMe: false },
      { rank: 4, name: 'Collins', toPar: '+2.8', movement: 'same' as const, isMe: false },
      { rank: 5, name: 'Davis', toPar: '+3.1', movement: 'up' as const, isMe: false },
      { rank: 6, name: 'Brooks', toPar: '+4.5', movement: 'down' as const, isMe: false },
    ];
  }, []);

  // Compute monthly digest from real rounds
  const monthlyDigest = useMemo(() => {
    if (realRounds.length === 0) return null;
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const lastMonthRounds = realRounds.filter(r => {
      const d = new Date(r.played_at);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });
    if (lastMonthRounds.length === 0) return null;
    const scores = lastMonthRounds.map(r => r.gross_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const best = lastMonthRounds.reduce((b, r) => r.gross_score < b.gross_score ? r : b);
    const hcpStart = user?.user_metadata?.handicap_index ?? null;
    const hcpEnd = hcpStart; // Would need historical handicap tracking
    const grade = computeMonthGrade(lastMonthRounds.length, hcpStart, hcpEnd);
    const uniqueCourses = new Set(lastMonthRounds.map(r => r.course?.name ?? 'Unknown'));
    return { roundsLogged: lastMonthRounds.length, avg, bestScore: best.gross_score, bestCourse: best.course?.name ?? 'Unknown', hcpStart, hcpEnd, grade, newCourses: uniqueCourses.size };
  }, [realRounds, user]);

  // Compute weekly digest from real rounds
  const weeklyDigestData = useMemo(() => {
    if (realRounds.length === 0) return null;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const thisWeekRounds = realRounds.filter(r => new Date(r.played_at) >= weekAgo);
    return computeWeeklyDigest(
      thisWeekRounds.map(r => ({ score: r.gross_score })),
      user?.user_metadata?.handicap_index ?? null,
      user?.user_metadata?.handicap_index ?? null,
      null, null,
    );
  }, [realRounds, user]);

  const hasRealData = realRounds.length > 0;
  const showContent = hasRealData || showDemoData;

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      {/* Fixed header bar with friend request badge (Item 6) */}
      <HeaderBar
        onLogoPress={() => setShowMenu(!showMenu)}
        showMenu={showMenu}
        pendingCount={pendingRequests.length}
      />
      <LogoMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        activeGroupId={activeGroup.id}
        onGroupSelect={handleGroupSelect}
      />

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.teal}
            colors={['#006747']}
          />
        }
      >
        {/* Masters green greeting with active group name (Item 1) */}
        <GreetingSection
          name={firstName ?? 'Golfer'}
          groupName={activeGroup.name}
          weather={weather}
        />

        {/* Gold divider below green header */}
        <GoldDivider />

        {/* Data freshness indicator */}
        <View style={st.freshnessWrap}>
          <DataFreshness updatedAt={lastUpdated} />
        </View>

        {/* ESPN Ticker — first thing below greeting, prominent green card */}
        <ESPNTicker standings={standings} />

        {/* User Profile Section — replaces quick stats cards */}
        <View style={st.body}>
          <UserProfileSection stats={quickStats} />
        </View>

        {/* Action buttons — right after profile */}
        <QuickActions />

        {/* Monthly digest card — 1st-3rd of month, real data */}
        {shouldShowMonthlyDigest() && !monthlyDismissed && monthlyDigest && (
          <View style={{ margin: 16, marginBottom: 0, backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.gold, padding: 16, ...(isDark ? cardShadowDark : cardShadowLight) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ backgroundColor: '#C9A227', paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#141210', fontSize: 10, fontWeight: '800', letterSpacing: 2, fontFamily: GEO }}>{getPreviousMonthName()} RECAP</Text>
              </View>
              <Pressable onPress={() => setMonthlyDismissed(true)} hitSlop={12}>
                <Ionicons name="close" size={18} color={c.textMuted} />
              </Pressable>
            </View>
            <View style={{ marginTop: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: SANS }}>Rounds logged</Text>
                <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', fontFamily: GEO }}>{monthlyDigest.roundsLogged}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: SANS }}>Scoring average</Text>
                <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', fontFamily: GEO }}>{monthlyDigest.avg.toFixed(1)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: SANS }}>Best round</Text>
                <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', fontFamily: GEO }}>{monthlyDigest.bestScore} at {monthlyDigest.bestCourse}</Text>
              </View>
              {monthlyDigest.hcpStart != null && monthlyDigest.hcpEnd != null && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: SANS }}>Handicap</Text>
                  <Text style={{ color: '#006747', fontSize: 12, fontWeight: '700', fontFamily: GEO }}>{monthlyDigest.hcpStart.toFixed(1)} {'\u2192'} {monthlyDigest.hcpEnd.toFixed(1)}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: SANS }}>Courses played</Text>
                <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', fontFamily: GEO }}>{monthlyDigest.newCourses}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: c.gold, fontSize: 24, fontWeight: '800', fontFamily: GEO }}>{monthlyDigest.grade}</Text>
                <Text style={{ color: c.textMuted, fontSize: 11, fontFamily: SANS }}>{GRADE_COPY[monthlyDigest.grade]}</Text>
              </View>
              <Pressable onPress={() => { haptics.light(); }} style={({ pressed }) => [{ backgroundColor: c.gold, paddingHorizontal: 14, paddingVertical: 8 }, pressed && { opacity: 0.7 }]}>
                <Text style={{ color: '#141210', fontSize: 11, fontWeight: '700', fontFamily: SANS }}>Share Recap</Text>
              </Pressable>
            </View>
          </View>
        )}
        {/* Monthly digest empty state — 1st-3rd, no rounds last month */}
        {shouldShowMonthlyDigest() && !monthlyDismissed && !monthlyDigest && hasRealData && (
          <View style={{ margin: 16, marginBottom: 0, backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, padding: 16, ...(isDark ? cardShadowDark : cardShadowLight) }}>
            <Text style={{ color: c.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2, fontFamily: GEO }}>{getPreviousMonthName()} RECAP</Text>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '600', marginTop: 8, fontFamily: SANS }}>No rounds logged last month</Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4, fontFamily: SANS }}>Get out there this month — your handicap is waiting.</Text>
          </View>
        )}

        {loading ? (
          <View style={st.body}>
            <SkeletonStats />
            <SkeletonFeed />
          </View>
        ) : (
        <View style={st.body}>
          {/* Season Standings — always visible */}
          <SeasonStandingsSection groupName={activeGroup.name} />

          {/* Round Result — show with data or demo, otherwise subtle empty state */}
          {showContent ? (
            <RoundResultCard />
          ) : (
            <View style={[st.emptyHint, { borderColor: c.border }]}>
              <Ionicons name="golf-outline" size={16} color={c.textMuted} />
              <Text style={[st.emptyHintText, { color: c.textMuted, fontFamily: SANS }]}>Play your first round to see results here.</Text>
            </View>
          )}

          {/* Next Matchup — show with data or demo, otherwise subtle empty state */}
          {showContent ? (
            <NextMatchupCard />
          ) : (
            <View style={[st.emptyHint, { borderColor: c.border }]}>
              <Ionicons name="people-outline" size={16} color={c.textMuted} />
              <Text style={[st.emptyHintText, { color: c.textMuted, fontFamily: SANS }]}>Join a season to see your next matchup.</Text>
            </View>
          )}

          {/* Strokes behind leader callout — always visible */}
          <View style={{ backgroundColor: `${c.teal}10`, borderWidth: 1, borderColor: c.teal, padding: 12, marginTop: 12 }}>
            <Text style={{ color: c.teal, fontSize: 13, fontWeight: '600', fontFamily: SANS }}>
              You're 2.8 strokes behind Drew's average. Close the gap.
            </Text>
          </View>

          {/* Active streaks */}
          {activeStreaks.length > 0 && (
            <>
              <GoldDivider style={{ marginTop: 16 }} />
              <Text style={[st.sectionTitle, { color: c.gold, marginTop: 8 }]}>ACTIVE STREAKS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {activeStreaks.map((streak) => (
                  <View key={streak.id} style={{ backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 10, ...(isDark ? cardShadowDark : cardShadowLight) }}>
                    <Text style={{ fontSize: 20 }}>{streak.emoji}</Text>
                    <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', marginTop: 4, fontFamily: SANS }}>{streak.label}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {/* Favorite Course — always visible */}
          <FavoriteCourseSection />

          {/* My Groups */}
          <MyGroupsSection
            activeGroupId={activeGroup.id}
            onGroupSelect={handleGroupSelect}
          />

          {/* Empty state for new users — no rounds: show demo toggle prominently */}
          {realRounds.length === 0 && !showDemoData && (
            <View style={[st.emptyState, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={st.emptyEmoji}>{'\u26F3'}</Text>
              <Text style={[st.emptyTitle, { color: c.text }]}>Your scorecard awaits</Text>
              <Text style={[st.emptyDesc, { color: c.textMuted, fontFamily: SANS }]}>Every great golfer started with Round 1</Text>
              <Pressable onPress={() => { haptics.light(); router.push('/(tabs)/score'); }} style={({ pressed }) => [st.emptyBtn, { backgroundColor: c.teal }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
                <Text style={[st.emptyBtnText, { fontFamily: SANS }]}>Log Round</Text>
              </Pressable>
              <Pressable onPress={() => setShowDemoData(true)} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                <Text style={[st.demoToggle, { color: c.textMuted, fontFamily: SANS }]}>Show demo data</Text>
              </Pressable>
            </View>
          )}

          {/* Friend requests */}
          {pendingRequests.length > 0 && (
            <>
              <SectionHeader title="YOUR CREW" />
              <GoldDivider style={{ marginBottom: 12 }} />
              <Pressable
                onPress={() => { haptics.light(); router.push('/(tabs)/leaderboard'); }}
                style={({ pressed }) => [st.feedCard, { backgroundColor: c.cardBg, borderColor: c.urgent, borderLeftWidth: 3 }, isDark ? cardShadowDark : cardShadowLight, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
              >
                <Ionicons name="people" size={20} color={c.urgent} style={{ marginRight: 10 }} />
                <Text style={[st.feedName, { color: c.text, fontFamily: SANS }]}>
                  {pendingRequests.length} pending friend request{pendingRequests.length > 1 ? 's' : ''}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
            </>
          )}

          {/* Activity feed */}
          {(realRounds.length > 0 || showDemoData) && (
            <>
              <SectionHeader title="LATEST" />
              <GoldDivider style={{ marginBottom: 12 }} />
              {/* Weekly digest card — show every Monday, wired to real data */}
              {new Date().getDay() === 1 && !weeklyDismissed && weeklyDigestData && weeklyDigestData.roundsLogged > 0 && (
                <View style={{ backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.gold, padding: 16, marginBottom: 16, ...(isDark ? cardShadowDark : cardShadowLight) }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#C9A227', paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: '#141210', fontSize: 10, fontWeight: '800', letterSpacing: 2, fontFamily: GEO }}>THIS WEEK IN DORMIE</Text>
                    </View>
                    <Pressable onPress={() => setWeeklyDismissed(true)} hitSlop={12}>
                      <Ionicons name="close" size={18} color={c.textMuted} />
                    </Pressable>
                  </View>
                  <View style={{ marginTop: 10, gap: 5 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: SANS }}>Rounds</Text>
                      <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', fontFamily: GEO }}>{weeklyDigestData.roundsLogged} logged</Text>
                    </View>
                    {weeklyDigestData.avgScore != null && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: SANS }}>Avg score</Text>
                        <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', fontFamily: GEO }}>{weeklyDigestData.avgScore.toFixed(1)}</Text>
                      </View>
                    )}
                    {weeklyDigestData.handicapChange != null && weeklyDigestData.handicapChange !== 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: SANS }}>Handicap</Text>
                        <Text style={{ color: weeklyDigestData.handicapChange < 0 ? '#006747' : '#C41E3A', fontSize: 12, fontWeight: '700', fontFamily: GEO }}>
                          {weeklyDigestData.handicapChange < 0 ? '\u2193' : '\u2191'}{Math.abs(weeklyDigestData.handicapChange).toFixed(1)}
                        </Text>
                      </View>
                    )}
                    {activeStreaks.length > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: SANS }}>Streak</Text>
                        <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', fontFamily: GEO }}>{activeStreaks[0].emoji} {activeStreaks[0].label}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: c.textMuted, fontSize: 12, fontFamily: SANS }}>Upcoming</Text>
                      <Text style={{ color: c.gold, fontSize: 12, fontWeight: '700', fontFamily: GEO }}>
                        {MOCK_UPCOMING.length > 0 ? `${MOCK_UPCOMING[0].title} in ${MOCK_UPCOMING[0].daysAway}d` : 'No events \u2014 create one?'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              {/* Weekly empty state — Monday, no rounds last week */}
              {new Date().getDay() === 1 && !weeklyDismissed && (!weeklyDigestData || weeklyDigestData.roundsLogged === 0) && hasRealData && (
                <View style={{ backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 16, ...(isDark ? cardShadowDark : cardShadowLight) }}>
                  <Text style={{ color: c.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2, fontFamily: GEO }}>THIS WEEK IN DORMIE</Text>
                  <Text style={{ color: c.text, fontSize: 13, fontWeight: '600', marginTop: 8, fontFamily: SANS }}>No rounds last week</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4, fontFamily: SANS }}>The course is calling. Make this week count.</Text>
                </View>
              )}
              {feedItems.map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </>
          )}

          {/* Upcoming */}
          {(realRounds.length > 0 || showDemoData) && MOCK_UPCOMING.length > 0 && (
            <>
              <SectionHeader title="UPCOMING" />
              <GoldDivider style={{ marginBottom: 12 }} />
              {MOCK_UPCOMING.map((item) => (
                <UpcomingCard key={item.id} item={item} />
              ))}
            </>
          )}
        </View>
        )}

        <View style={{ height: 32 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: {
    flex: 1,
  },

  /* Header bar */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: STATUS_BAR_H + 4,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  logoBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBg: {
    width: 32,
    height: 32,
    backgroundColor: '#1E4D2B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDormie: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  themeToggle: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Friend request badge (Item 6) */
  badgeWrap: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    backgroundColor: '#C41E3A',
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'Georgia',
  },

  /* Logo menu */
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
  menuDropdown: {
    position: 'absolute',
    top: STATUS_BAR_H + 50,
    left: 20,
    width: 220,
    borderWidth: 1,
    zIndex: 100,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuGroupHeader: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  menuGroupLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  menuGroupDot: {
    width: 8,
    height: 8,
  },

  /* Greeting section */
  greetingSection: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  greetingText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Georgia',
  },
  greetingGroup: {
    color: '#C9A227',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Georgia',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  goLowText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3,
    fontFamily: 'Georgia',
    marginTop: 8,
  },

  /* ESPN Ticker — prominent floating Masters green card */
  tickerBar: {
    backgroundColor: '#1E4D2B',
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  tickerLabelWrap: {
    paddingHorizontal: 12,
  },
  tickerLabel: {
    color: '#C9A227',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontFamily: 'Georgia',
  },
  tickerDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(232, 228, 222, 0.2)',
  },
  tickerScroll: {
    paddingHorizontal: 8,
    gap: 4,
    alignItems: 'center',
  },
  tickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tickerPillMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tickerRank: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Georgia',
  },
  tickerArrow: {
    fontSize: 7,
  },
  tickerName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Georgia',
  },
  tickerNameMe: {
    color: '#FFFFFF',
  },
  tickerScore: {
    color: '#C9A227',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Georgia',
    marginLeft: 2,
  },

  /* Data freshness */
  freshnessWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },

  /* Body */
  body: {
    paddingHorizontal: 20,
  },

  /* Season Standings (Item 2) */
  seasonSection: {
    marginTop: 24,
  },
  seasonLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  seasonSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  seasonSubText: {
    fontSize: 10,
  },
  seasonList: {
    borderWidth: 1,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  seasonRank: {
    width: 24,
    fontSize: 14,
    fontWeight: '700',
  },
  seasonName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  seasonPoints: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* Round Result Card (Item 3) */
  resultSection: {
    marginTop: 24,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 16,
  },
  resultSide: {
    flex: 1,
    alignItems: 'center',
  },
  resultPlayerName: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  resultScores: {
    alignItems: 'center',
    marginTop: 6,
  },
  resultScoreLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1,
  },
  resultScoreValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -1,
  },
  resultCenter: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  resultBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Georgia',
    letterSpacing: 1,
  },
  resultMargin: {
    fontSize: 10,
    marginTop: 4,
  },

  /* Next Matchup Card (Item 4) */
  matchupSection: {
    marginTop: 24,
  },
  matchupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 16,
  },
  matchupSide: {
    flex: 1,
    alignItems: 'center',
  },
  matchupName: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  matchupPos: {
    fontSize: 10,
    marginTop: 2,
  },
  matchupPts: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  matchupCenter: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  matchupVs: {
    fontSize: 16,
    fontWeight: '800',
  },
  matchupDate: {
    fontSize: 10,
    marginTop: 4,
  },

  /* My Groups Section (Item 5) */
  groupsSection: {
    marginTop: 24,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  groupInitialBox: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Georgia',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '700',
  },
  groupMembers: {
    fontSize: 10,
    marginTop: 2,
  },

  /* User Profile Section */
  profileSection: {
    marginTop: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileEditBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    backgroundColor: '#006747',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileLocation: {
    fontSize: 11,
    marginTop: 1,
  },
  profileStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  profileStatItem: {
    alignItems: 'center',
  },
  profileStatValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  profileStatLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  profileStatDivider: {
    width: 1,
    height: 24,
  },

  /* Season header column */
  seasonHeaderCol: {
    flex: 1,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* Quick stats (kept for backward compat) */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  /* Quick actions */
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
  },
  actionPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionSecText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Section */
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },

  /* Feed card */
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  feedLeft: {
    marginRight: 10,
  },
  feedContent: {
    flex: 1,
  },
  feedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  feedTime: {
    fontSize: 10,
  },
  feedDesc: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 16,
  },
  feedIcon: {
    marginLeft: 8,
  },

  /* Upcoming */
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upcomingTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  upcomingSub: {
    fontSize: 10,
    marginTop: 3,
  },
  countdownBadge: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 10,
  },
  countdownNum: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
  },
  countdownLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  /* Empty hint — subtle prompt for new users */
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 14,
    marginTop: 16,
  },
  emptyHintText: {
    fontSize: 12,
    flex: 1,
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 32,
    marginTop: 24,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Georgia',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  demoToggle: {
    fontSize: 12,
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});
