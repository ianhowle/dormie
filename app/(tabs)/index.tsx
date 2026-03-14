import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, StatusBar, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/lib/auth';
import { GEO, SANS } from '../../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../../src/theme/colors';
import GoldDivider from '../../src/components/GoldDivider';
import { Avatar } from '../../src/components/Avatar';
import { SkeletonFeed, SkeletonStats } from '../../src/components/Skeleton';
import { DataFreshness } from '../../src/components/DataFreshness';
import { useToast } from '../../src/components/Toast';
import { haptics } from '../../src/lib/haptics';
import { roundsService } from '../../src/services/rounds.service';
import { friendsService } from '../../src/services/friends.service';
import { tripsService } from '../../src/services/trips.service';
import { getGreeting, getGreetingSubtitle, isMastersTheme } from '../../src/lib/greeting';
import { fetchWeather, type WeatherData } from '../../src/lib/weather';
import { computeStreaks, type Streak } from '../../src/lib/streaks';
import { formatWeeklyDigest, computeWeeklyDigest } from '../../src/lib/streaks';
import { leaderboardRowLabel, statLabel } from '../../src/lib/accessibility';
import type { RoundWithCourse, FriendshipWithUser } from '../../src/lib/database.types';
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
  { id: 'g1', name: 'The Dormie Boys', color: '#2A9D8F', memberCount: 8 },
  { id: 'g2', name: 'Nashville Golf Club', color: '#D4AF37', memberCount: 12 },
  { id: 'g3', name: 'Work League', color: '#C44B4F', memberCount: 6 },
];

const MOCK_SEASON_STANDINGS = [
  { rank: 1, name: 'McGowan', points: 72 },
  { rank: 2, name: 'Patterson', points: 65 },
  { rank: 3, name: 'Sullivan', points: 55 },
  { rank: 4, name: 'Fleetwood', points: 48 },
  { rank: 5, name: 'Chen', points: 42 },
];

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

// ─── Header bar: Logo button | DORMIE | Badge + Dark mode toggle ────
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

  return (
    <View style={[st.headerBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      {/* Logo button — flagstick on green square */}
      <Pressable onPress={() => { haptics.light(); onLogoPress(); }} style={({ pressed }) => [st.logoBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
        <View style={st.logoBg}>
          <Ionicons name="flag" size={16} color="#D4AF37" />
        </View>
      </Pressable>

      {/* Centered DORMIE */}
      <Text style={[st.headerDormie, { color: c.text, fontFamily: GEO }]}>DORMIE</Text>

      {/* Right side: friend badge + dark mode toggle */}
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
                isActive && { borderLeftWidth: 3, borderLeftColor: '#2A9D8F', backgroundColor: 'rgba(42,157,143,0.15)' },
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={[st.menuGroupDot, { backgroundColor: group.color }]} />
              <Text style={[st.menuItemText, { color: isActive ? '#2A9D8F' : c.text, flex: 1, fontFamily: SANS }]}>
                {group.name}
              </Text>
              {isActive && <Ionicons name="checkmark" size={14} color="#2A9D8F" />}
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

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={st.greetingSection}
    >
      <Pinstripes />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={st.greetingText}>{getGreeting(name)}</Text>
        {weather && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4 }}>
            <Ionicons name={weather.icon as any} size={14} color="rgba(255,255,255,0.8)" />
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' }}>{weather.temp}{'\u00B0'} {weather.condition}</Text>
          </View>
        )}
      </View>
      {subtitle && (
        <Text style={{ color: '#D4AF37', fontSize: 12, fontStyle: 'italic', fontFamily: 'Georgia', marginTop: 4 }}>{subtitle}</Text>
      )}
      <Text style={st.greetingGroup}>{groupName}</Text>
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
    <View style={st.tickerBar}>
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
          const arrowColor = p.movement === 'up' ? '#2A9D8F' : p.movement === 'down' ? '#C44B4F' : '#6B6560';
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

// ─── Season Standings Section ────────────────────────────────────────
function SeasonStandingsSection({ groupName }: { groupName: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  return (
    <View style={st.seasonSection}>
      <Text style={[st.seasonLabel, { color: c.gold, fontFamily: GEO }]}>SEASON STANDINGS</Text>
      <GoldDivider style={{ marginBottom: 12 }} />
      <View style={st.seasonSubRow}>
        <Text style={[st.seasonSubText, { color: c.textMuted, fontFamily: SANS }]}>Round 4 of 12</Text>
        <Text style={[st.seasonSubText, { color: c.textMuted, fontFamily: SANS }]}>{groupName}</Text>
      </View>
      <View style={[st.seasonList, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
        {MOCK_SEASON_STANDINGS.map((s, i) => (
          <View
            key={s.rank}
            style={[
              st.seasonRow,
              i < MOCK_SEASON_STANDINGS.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
              s.rank === 1 && { backgroundColor: 'rgba(42, 157, 143, 0.08)' },
            ]}
          >
            <Text style={[st.seasonRank, { color: s.rank === 1 ? '#2A9D8F' : c.textMuted, fontFamily: GEO }]}>
              {s.rank}
            </Text>
            <Text style={[st.seasonName, { color: s.rank === 1 ? '#2A9D8F' : c.text, fontFamily: SANS }]}>
              {s.name}
            </Text>
            <Text style={[st.seasonPoints, { color: c.gold, fontFamily: GEO }]}>
              {s.points}
            </Text>
          </View>
        ))}
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
          <View style={[st.resultBadge, { backgroundColor: isWin ? '#2A9D8F' : '#C44B4F' }]}>
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
          <Text style={[st.matchupPts, { color: '#2A9D8F', fontFamily: GEO }]}>{m.userPoints} pts</Text>
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
          <Text style={[st.matchupPts, { color: '#2A9D8F', fontFamily: GEO }]}>{m.opponentPoints} pts</Text>
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
                borderLeftColor: isActive ? '#2A9D8F' : c.border,
              },
              isDark ? cardShadowDark : cardShadowLight,
              isActive && { backgroundColor: 'rgba(42,157,143,0.15)' },
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
            {isActive && <Ionicons name="checkmark-circle" size={20} color="#2A9D8F" />}
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
    { label: 'HANDICAP', value: stats.handicap.toFixed(1), color: c.gold, isHandicap: true },
    { label: 'THIS MONTH', value: String(stats.monthRounds), color: c.gold, isHandicap: false },
    { label: 'BEST RECENT', value: String(stats.bestRecent), color: c.gold, isHandicap: false },
    { label: 'STREAK', value: stats.streak, color: c.gold, isHandicap: false },
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
        onPress={() => { haptics.light(); router.push('/(tabs)/score'); }}
        style={({ pressed }) => [st.actionBtn, { backgroundColor: c.greenDark }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons name="add-circle-outline" size={18} color="#fff" />
        <Text style={[st.actionPrimaryText, { fontFamily: SANS }]}>Log Round</Text>
      </Pressable>
      <Pressable
        onPress={() => { haptics.light(); router.push('/(tabs)/trips'); }}
        style={({ pressed }) => [st.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.gold }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons name="airplane-outline" size={18} color={c.gold} />
        <Text style={[st.actionSecText, { color: c.gold, fontFamily: SANS }]}>New Trip</Text>
      </Pressable>
      <Pressable
        onPress={() => { haptics.light(); router.push('/(tabs)/leaderboard'); }}
        style={({ pressed }) => [st.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons name="trophy-outline" size={18} color={c.teal} />
        <Text style={[st.actionSecText, { color: c.teal, fontFamily: SANS }]}>Leaderboard</Text>
      </Pressable>
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
  const { user } = useAuth();
  const { showToast } = useToast();
  const firstName = user?.user_metadata?.name?.split(' ')[0];
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [realRounds, setRealRounds] = useState<RoundWithCourse[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendshipWithUser[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showDemoData, setShowDemoData] = useState(false);
  const [activeGroup, setActiveGroup] = useState(MOCK_GROUPS[0]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

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

  const activeStreaks = useMemo(() => computeStreaks({
    recentScores: [78, 76, 79, 74, 77, 76, 75],
    handicapTrend: [9.2, 8.9, 8.7, 8.4, 8.2],
    h2hResults: [{ opponent: 'Tyler', wins: 4, losses: 1 }],
    roundDates: [new Date(), new Date(Date.now() - 7 * 86400000), new Date(Date.now() - 14 * 86400000), new Date(Date.now() - 21 * 86400000)],
  }), []);

  // Build real quick stats
  const quickStats = useMemo(() => {
    if (realRounds.length === 0) return MOCK_QUICK_STATS;
    const now = new Date();
    const thisMonth = realRounds.filter(r => {
      const d = new Date(r.played_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const scores = realRounds.map(r => r.gross_score);
    return {
      handicap: user?.user_metadata?.handicap_index ?? MOCK_QUICK_STATS.handicap,
      monthRounds: thisMonth.length || MOCK_QUICK_STATS.monthRounds,
      bestRecent: scores.length > 0 ? Math.min(...scores) : MOCK_QUICK_STATS.bestRecent,
      streak: MOCK_QUICK_STATS.streak,
    };
  }, [realRounds, user]);

  // Build feed from real rounds
  const feedItems: FeedItem[] = useMemo(() => {
    if (realRounds.length === 0) return MOCK_FEED;
    return realRounds.slice(0, 6).map((r) => ({
      id: r.id,
      type: 'round_posted' as const,
      playerId: r.user_id,
      playerName: user?.user_metadata?.name ?? 'You',
      description: `posted ${r.gross_score} at ${r.course?.name ?? 'Unknown'}`,
      timestamp: r.played_at,
    }));
  }, [realRounds, user]);

  // ESPN ticker standings
  const standings: StandingPill[] = useMemo(() => [
    { rank: 1, name: 'McGowan', toPar: '-2.1', movement: 'same' as const, isMe: true },
    { rank: 2, name: 'Fletcher', toPar: '+0.4', movement: 'up' as const, isMe: false },
    { rank: 3, name: 'Patterson', toPar: '+1.2', movement: 'down' as const, isMe: false },
    { rank: 4, name: 'Collins', toPar: '+2.8', movement: 'same' as const, isMe: false },
    { rank: 5, name: 'Davis', toPar: '+3.1', movement: 'up' as const, isMe: false },
    { rank: 6, name: 'Brooks', toPar: '+4.5', movement: 'down' as const, isMe: false },
  ], []);

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
            colors={['#2A9D8F']}
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

        {/* ESPN ticker */}
        <ESPNTicker standings={standings} />

        {loading ? (
          <View style={st.body}>
            <SkeletonStats />
            <SkeletonFeed />
          </View>
        ) : (
        <View style={st.body}>
          {/* Season Standings (Item 2) */}
          <SeasonStandingsSection groupName={activeGroup.name} />

          {/* Round Result (Item 3) */}
          <RoundResultCard />

          {/* Next Matchup (Item 4) */}
          <NextMatchupCard />

          {/* Quick stats */}
          <QuickStatsRow stats={quickStats} />

          {/* Strokes behind leader callout */}
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

          {/* Quick actions */}
          <QuickActions />

          {/* Motivational micro-copy */}
          <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 2, textAlign: 'center', marginTop: 8, fontFamily: GEO }}>GO LOW</Text>

          {/* My Groups (Item 5) */}
          <MyGroupsSection
            activeGroupId={activeGroup.id}
            onGroupSelect={handleGroupSelect}
          />

          {/* Empty state for new users — no rounds */}
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

          {/* Empty state — no friends */}
          {pendingRequests.length === 0 && realRounds.length === 0 && !showDemoData && (
            <View style={[st.emptyState, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={st.emptyEmoji}>{'\uD83D\uDC65'}</Text>
              <Text style={[st.emptyTitle, { color: c.text }]}>Golf is better with your crew</Text>
              <Text style={[st.emptyDesc, { color: c.textMuted, fontFamily: SANS }]}>Share your invite link to get started</Text>
            </View>
          )}

          {/* Empty state — no trips */}
          {realRounds.length === 0 && !showDemoData && MOCK_UPCOMING.length === 0 && (
            <View style={[st.emptyState, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={st.emptyEmoji}>{'\u2708\uFE0F'}</Text>
              <Text style={[st.emptyTitle, { color: c.text }]}>Where to next?</Text>
              <Text style={[st.emptyDesc, { color: c.textMuted, fontFamily: SANS }]}>Plan your first golf trip</Text>
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
              {/* Weekly digest card */}
              <View style={{ backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.gold, padding: 16, marginBottom: 16, ...(isDark ? cardShadowDark : cardShadowLight) }}>
                <Text style={{ color: c.gold, fontSize: 10, fontWeight: '600', letterSpacing: 2, fontFamily: GEO }}>LAST WEEK</Text>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '600', marginTop: 6, fontFamily: SANS }}>
                  2 rounds logged, avg 77.5, handicap {'\u2193'}0.3, moved up 1 spot
                </Text>
              </View>
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

        <View style={{ height: 32 }} />
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
    backgroundColor: '#C44B4F',
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
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Georgia',
    marginTop: 4,
    letterSpacing: 0.5,
  },

  /* ESPN Ticker */
  tickerBar: {
    backgroundColor: '#1E4D2B',
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  tickerLabelWrap: {
    paddingHorizontal: 10,
  },
  tickerLabel: {
    color: '#D4AF37',
    fontSize: 8,
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
    color: '#D4AF37',
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

  /* Quick stats */
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
