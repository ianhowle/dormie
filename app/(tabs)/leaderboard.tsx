import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO, SANS } from '../../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../../src/theme/colors';
import { Avatar } from '../../src/components/Avatar';
import GoldDivider from '../../src/components/GoldDivider';
import { CoursesTab } from '../../src/components/CoursesTab';
import { H2HTab } from '../../src/components/H2HTab';
import { RecordsTab } from '../../src/components/RecordsTab';
import { SkeletonLeaderboard } from '../../src/components/Skeleton';
import { DataFreshness } from '../../src/components/DataFreshness';
import { useToast } from '../../src/components/Toast';
import { haptics } from '../../src/lib/haptics';
import { leaderboardRowLabel } from '../../src/lib/accessibility';
import {
  type LeaderboardPlayer,
  type Season,
  type LeaderboardScope,
} from '../../src/data/leaderboard';
import { useAuth } from '../../src/lib/auth';
import { friendsService } from '../../src/services/friends.service';
import { roundsService } from '../../src/services/rounds.service';
import { seasonsService } from '../../src/services/seasons.service';
import { movementArrow, movementColor, formatToPar as fmtToPar } from '../../src/lib/scoring-utils';
import type { RoundWithCourse, FriendshipWithUser } from '../../src/lib/database.types';
import { LeaderboardGhostEmpty } from '../../src/components/EmptyStates';
import { DemoPeekToggle, DemoBanner, DEMO_LEADERBOARD, DEMO_FIELD_LEADERBOARD } from '../../src/components/DemoPeek';

const WELCOME_BANNER_KEY = '@dormie/welcome_banner_dismissed';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Pinstripe overlay ───────────────────────────────────────────────
function Pinstripes() {
  // Subtle diagonal lines rendered as thin repeating Views
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

// ─── Scope toggle ────────────────────────────────────────────────────
function ScopeToggle({
  scope,
  onToggle,
}: {
  scope: LeaderboardScope;
  onToggle: (s: LeaderboardScope) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  return (
    <View style={[styles.scopeRow, { backgroundColor: isDark ? c.elevated : '#F2F0ED', borderWidth: 1, borderColor: isDark ? c.border : 'rgba(0,0,0,0.08)' }, ...[isDark ? cardShadowDark : cardShadowLight]]}>
      {(['group', 'field'] as const).map((s) => {
        const active = s === scope;
        return (
          <Pressable
            key={s}
            onPress={() => { haptics.light(); onToggle(s); }}
            accessibilityLabel={`${s === 'group' ? 'My Group' : 'The Field'}${active ? ', selected' : ''}`}
            style={[
              styles.scopeBtn,
              active && { backgroundColor: isDark ? c.cardBg : '#FFFFFF' },
              active && !isDark && cardShadowLight,
            ]}
          >
            <Text
              style={[
                styles.scopeLabel,
                { color: active ? (isDark ? c.text : '#1A1A1A') : (isDark ? c.textMuted : '#6B6966'), fontFamily: SANS },
              ]}
            >
              {s === 'group' ? 'My Group' : 'The Field'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Season carousel ─────────────────────────────────────────────────
function SeasonCarousel({ seasons }: { seasons: Season[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const s = seasons[idx];
  if (!s) return null;

  const progress = s.currentWeek / s.totalWeeks;

  return (
    <View style={styles.seasonWrap}>
      <Pressable
        onPress={() => { router.push({ pathname: '/season-detail', params: { id: s.id ?? 's1' } }); }}
        style={({ pressed }) => [
          styles.seasonCard,
          { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 },
          isDark ? cardShadowDark : cardShadowLight,
          pressed && { opacity: 0.85 },
        ]}
      >
        {/* Gold accent bar */}
        <View style={[styles.seasonGoldBar, { backgroundColor: c.gold }]} />

        <View style={styles.seasonContent}>
          <View style={styles.seasonTop}>
            {seasons.length > 1 && (
              <Pressable
                onPress={() => setIdx((i) => Math.max(0, i - 1))}
                hitSlop={12}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={idx === 0 ? c.border : c.textMuted}
                />
              </Pressable>
            )}
            <View style={styles.seasonInfo}>
              <Text style={[styles.seasonName, { color: c.gold, fontFamily: GEO }]}>
                {s.name}
              </Text>
              <Text style={[styles.seasonMeta, { color: c.textMuted, fontFamily: SANS }]}>
                Week {s.currentWeek} of {s.totalWeeks}
                {'  ·  '}
                You're <Text style={{ fontFamily: GEO, fontWeight: '700' }}>#{s.yourPosition}</Text> of {s.totalPlayers}
              </Text>
            </View>
            {seasons.length > 1 && (
              <Pressable
                onPress={() =>
                  setIdx((i) => Math.min(seasons.length - 1, i + 1))
                }
                hitSlop={12}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={idx === seasons.length - 1 ? c.border : c.textMuted}
                />
              </Pressable>
            )}
          </View>

          {/* Progress bar */}
          <View style={[styles.progressTrack, { backgroundColor: c.elevated }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%`, backgroundColor: c.gold },
              ]}
            />
          </View>
        </View>
      </Pressable>

      {/* Dot indicators */}
      {seasons.length > 1 && (
        <View style={styles.dots}>
          {seasons.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === idx ? c.gold : c.border },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────
const TABS = ['Leaderboard', 'Courses', 'H2H', 'Records'] as const;
type Tab = (typeof TABS)[number];

function TabBar({
  active,
  onSelect,
}: {
  active: Tab;
  onSelect: (t: Tab) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  return (
    <View style={[styles.tabBar, { borderBottomColor: c.border }]}>
      {TABS.map((t) => {
        const isActive = t === active;
        return (
          <Pressable
            key={t}
            onPress={() => { haptics.light(); onSelect(t); }}
            accessibilityLabel={`${t} tab${isActive ? ', selected' : ''}`}
            style={({ pressed }) => [
              styles.tab,
              isActive && isDark && { backgroundColor: 'rgba(0,103,71,0.15)' },
              isActive && !isDark && { borderBottomWidth: 2, borderBottomColor: '#006747' },
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? c.teal : (isDark ? c.textMuted : '#6B6966'), fontFamily: SANS },
              ]}
            >
              {t}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Leaderboard table ───────────────────────────────────────────────
function formatToPar(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
}

function toParColor(n: number, c: ReturnType<typeof useTheme>['theme']['colors']): string {
  if (n < 0) return c.teal;
  if (n === 0) return c.gold;
  return c.urgent;
}

function positionLabel(pos: number): string {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return String(pos);
}

function TableHeader() {
  const { theme } = useTheme();
  const isDark = theme.isDark;
  return (
    <View style={[styles.tableRow, { backgroundColor: isDark ? '#1E4D2B' : '#006747' }]}>
      <Text style={[styles.colPos, styles.colHeader]}>POS</Text>
      <Text style={[styles.colPlayer, styles.colHeader]}>PLAYER</Text>
      <Text style={[styles.colHero, styles.colHeader]}>AVG ±</Text>
      <Text style={[styles.colStat, styles.colHeader]}>BEST</Text>
      <Text style={[styles.colStat, styles.colHeader]}>RNDS</Text>
      <Text style={[styles.colStat, styles.colHeader]}>AVG</Text>
      <Text style={[styles.colMovement, styles.colHeader]}>▲▼</Text>
    </View>
  );
}

function PlayerRow({
  player,
  position,
  isMe,
}: {
  player: LeaderboardPlayer;
  position: number;
  isMe: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const isDark = theme.isDark;
  const bgColor = isMe
    ? `${c.teal}12`
    : position % 2 === 0
      ? (isDark ? c.cardBg : '#FFFFFF')
      : (isDark ? c.elevated : '#F8F7F5');

  // Position change flash animation
  const flashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if ('movement' in player) {
      const movement = (player as any).movement;
      if (movement === 'up' || movement === 'down') {
        flashOpacity.setValue(1);
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }).start();
      }
    }
  }, []);

  const flashColor =
    'movement' in player && (player as any).movement === 'up'
      ? 'rgba(0,103,71,0.2)'
      : 'movement' in player && (player as any).movement === 'down'
        ? 'rgba(196,30,58,0.2)'
        : 'transparent';

  const animatedBg = flashOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', flashColor],
  });

  return (
    <View style={{ position: 'relative' }}>
      {('movement' in player && ((player as any).movement === 'up' || (player as any).movement === 'down')) && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: animatedBg },
          ]}
          pointerEvents="none"
        />
      )}
    <Pressable
      onPress={() => router.push(`/player-detail?playerId=${player.id}`)}
      onLongPress={() => {
        haptics.medium();
        Alert.alert(
          player.name,
          `HCP: ${player.handicap}\nAvg: ${player.avgScore.toFixed(1)}\nBest: ${player.bestRound}\nRounds: ${player.rounds}\nTo Par: ${formatToPar(player.toPar)}`,
        );
      }}
      accessibilityLabel={leaderboardRowLabel(position, player.name, player.toPar, player.rounds, player.bestRound)}
      style={({ pressed }) => [
        styles.tableRow,
        { backgroundColor: bgColor },
        !isDark && { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
        isMe && { borderLeftWidth: 2, borderLeftColor: c.greenDark, backgroundColor: `${c.greenDark}0D` },
        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
      ]}
    >
      {/* Position */}
      <Text style={[styles.colPos, { color: c.textMuted, fontFamily: GEO, fontWeight: '700' }]}>
        {positionLabel(position)}
      </Text>

      {/* Player */}
      <View style={[styles.colPlayer, styles.playerCell]}>
        <Avatar id={player.id} size={32} name={player.name} />
        <View style={styles.playerInfo}>
          <Text
            style={[
              styles.playerName,
              { color: isMe ? c.teal : c.text, fontFamily: SANS },
              isMe && { fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {player.name}
          </Text>
          <Text style={[styles.playerSub, { color: c.textMuted, fontFamily: SANS }]}>
            {player.handicap} HCP · {player.rounds} rds
          </Text>
        </View>
      </View>

      {/* AVG ± (hero number) */}
      <Text
        style={[
          styles.colHero,
          styles.heroNumber,
          { color: toParColor(player.toPar, c), fontFamily: GEO, fontWeight: '700', letterSpacing: -1 },
        ]}
      >
        {formatToPar(player.toPar)}
      </Text>

      {/* Best */}
      <Text style={[styles.colStat, { color: c.teal, fontFamily: GEO, fontWeight: '700' }]}>
        {player.bestRound}
      </Text>

      {/* Rounds */}
      <Text style={[styles.colStat, { color: c.textMuted, fontFamily: GEO, fontWeight: '700' }]}>
        {player.rounds}
      </Text>

      {/* Average */}
      <Text style={[styles.colStat, { color: c.textMuted, fontFamily: GEO, fontWeight: '700' }]}>
        {player.avgScore.toFixed(1)}
      </Text>

      {/* Movement */}
      {'movement' in player && (
        <Text style={[styles.colMovement, { color: movementColor((player as any).movement), fontFamily: GEO, fontWeight: '700' }]}>
          {movementArrow((player as any).movement)}
        </Text>
      )}
    </Pressable>
    </View>
  );
}

const PLAYER_ROW_HEIGHT = 56;

function LeaderboardTable({ players, myId, scope }: { players: LeaderboardPlayer[]; myId?: string; scope: LeaderboardScope }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  const renderPlayer = useCallback(({ item, index }: { item: LeaderboardPlayer; index: number }) => (
    <PlayerRow
      key={item.id}
      player={item}
      position={index + 1}
      isMe={item.id === myId}
    />
  ), [myId]);

  const keyExtractor = useCallback((item: LeaderboardPlayer) => item.id, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: PLAYER_ROW_HEIGHT,
    offset: PLAYER_ROW_HEIGHT * index,
    index,
  }), []);

  return (
    <View style={styles.tableWrap}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeader, { color: c.gold }]}>
          {scope === 'field' ? 'THE FIELD' : 'GROUP RANKINGS'}
        </Text>
        <DataFreshness updatedAt={new Date()} isLive={false} />
      </View>
      <View style={[styles.table, { borderColor: c.border, borderWidth: 1, backgroundColor: c.cardBg }, isDark ? cardShadowDark : cardShadowLight]}>
        <TableHeader />
        <GoldDivider />
        <FlatList
          data={players}
          renderItem={renderPlayer}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          windowSize={5}
          removeClippedSubviews={true}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────
export default function LeaderboardScreen() {
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<LeaderboardScope>('group');
  const [tab, setTab] = useState<Tab>('Leaderboard');
  const [search, setSearch] = useState('');

  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendshipWithUser[]>([]);
  const [myRounds, setMyRounds] = useState<RoundWithCourse[]>([]);
  const [realSeasons, setRealSeasons] = useState<Season[]>([]);
  const [showDemoData, setShowDemoData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(true); // default hidden until loaded
  const { showToast } = useToast();

  // Welcome banner dismiss state
  useEffect(() => {
    AsyncStorage.getItem(WELCOME_BANNER_KEY).then((val) => {
      setWelcomeDismissed(val === 'true');
    });
  }, []);

  const dismissWelcome = useCallback(() => {
    setWelcomeDismissed(true);
    AsyncStorage.setItem(WELCOME_BANNER_KEY, 'true');
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [f, r, s] = await Promise.all([
        friendsService.getActiveFriends(user.id),
        roundsService.getByUser(user.id, 50),
        seasonsService.getByUser(user.id),
      ]);
      setFriends(f);
      setMyRounds(r);
      // Map real seasons to the Season display type
      setRealSeasons(s.map(season => ({
        id: season.id,
        name: season.name,
        totalWeeks: (season as any).total_weeks ?? 12,
        currentWeek: (season as any).current_week ?? 1,
        yourPosition: 0,
        totalPlayers: (season as any).member_count ?? 0,
        format: (season as any).format,
      })));
    } catch {}
    setDataLoaded(true);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    showToast({ message: 'Leaderboard updated', type: 'success' });
  }, [loadData, showToast]);

  // Auto-dismiss welcome banner when: onboarding complete + 1 friend + 1 round
  const hasAcceptedFriend = friends.length > 0;
  const hasLoggedRound = myRounds.length > 0;
  const onboardingComplete = user?.user_metadata?.onboarding_complete === true;

  useEffect(() => {
    if (onboardingComplete && hasAcceptedFriend && hasLoggedRound && !welcomeDismissed) {
      dismissWelcome();
    }
  }, [onboardingComplete, hasAcceptedFriend, hasLoggedRound, welcomeDismissed, dismissWelcome]);

  // Build leaderboard from real data: aggregate rounds for user + friends
  // Group scope = friends only; Field scope = all available users
  const leaderboardPlayers = useMemo((): LeaderboardPlayer[] => {
    if (!user) return [];
    // Collect all friend user IDs + self
    const friendUsers = friends.map(f => {
      const friend = f.friend as any;
      return friend ? { id: friend.id, name: friend.name, handicap: friend.handicap_index ?? 0 } : null;
    }).filter(Boolean) as { id: string; name: string; handicap: number }[];

    // Group = self + friends; Field = all available users (in real data, same as group for now)
    const allUsers = scope === 'group'
      ? [
          { id: user.id, name: user.user_metadata?.name ?? 'You', handicap: user.user_metadata?.handicap_index ?? 0 },
          ...friendUsers,
        ]
      : [
          { id: user.id, name: user.user_metadata?.name ?? 'You', handicap: user.user_metadata?.handicap_index ?? 0 },
          ...friendUsers,
          // Field would include all Dormie users — for now we include friends as baseline
        ];

    if (myRounds.length === 0 && friends.length === 0) return [];

    // For now we only have myRounds (own rounds). Build entries for self.
    // For friends, we'd need their rounds too — query them.
    const playerMap = new Map<string, { scores: number[]; courses: Set<string>; bestRound: number }>();
    // Add own rounds
    for (const r of myRounds) {
      const entry = playerMap.get(r.user_id) ?? { scores: [], courses: new Set(), bestRound: Infinity };
      entry.scores.push(r.gross_score);
      entry.courses.add(r.course_id);
      entry.bestRound = Math.min(entry.bestRound, r.gross_score);
      playerMap.set(r.user_id, entry);
    }

    return allUsers.map(u => {
      const data = playerMap.get(u.id);
      if (!data || data.scores.length === 0) {
        return {
          id: u.id,
          name: u.name,
          handicap: u.handicap,
          courses: 0,
          rounds: 0,
          avgScore: 0,
          bestRound: 0,
          toPar: 0,
        };
      }
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      return {
        id: u.id,
        name: u.name,
        handicap: u.handicap,
        courses: data.courses.size,
        rounds: data.scores.length,
        avgScore: avg,
        bestRound: data.bestRound,
        toPar: avg - 72,
      };
    }).filter(p => p.rounds > 0).sort((a, b) => a.toPar - b.toPar);
  }, [user, friends, myRounds, scope]);

  const myId = user?.id;

  const me = leaderboardPlayers.find((p) => p.id === myId) ?? {
    id: myId,
    name: user?.user_metadata?.name ?? 'You',
    courses: 0,
    rounds: 0,
    bestRound: '--',
    toPar: 0,
    movement: 'same' as const,
  };
  const myPos =
    leaderboardPlayers.findIndex((p) => p.id === myId) + 1 || leaderboardPlayers.length + 1;

  // The tab bar is child index 3 within the ScrollView:
  // 0 = header gradient, 1 = gold divider, 2 = scope + season wrapper, 3 = tab bar
  const STICKY_TAB_INDEX = 3;

  const isMockData = false;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[STICKY_TAB_INDEX]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.teal}
            colors={[c.teal]}
          />
        }
      >
        {/* ── Child 0: Header ── */}
        <LinearGradient
          colors={greenHeaderGradient as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 8 }]}
        >
          <Pinstripes />

          <View style={styles.headerTop}>
            <View>
              <Text style={styles.dormieLabel}>DORMIE</Text>
              <Text style={styles.headerTitle}>Leaderboard</Text>
            </View>
            <Pressable
              onPress={toggleTheme}
              hitSlop={12}
              style={({ pressed }) => [styles.themeBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons
                name={theme.isDark ? 'sunny' : 'moon'}
                size={20}
                color="#E8E4DE"
              />
            </Pressable>
          </View>

          {/* Your position card */}
          <View style={styles.yourCard}>
            <Avatar id={me.id} size={40} name={me.name} />
            <View style={styles.yourInfo}>
              {me.rounds === 0 && leaderboardPlayers.length <= 1 && !welcomeDismissed ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.yourPos}>Welcome to Dormie</Text>
                    <Text style={styles.yourMeta}>Play rounds and add friends to see standings</Text>
                  </View>
                  <Pressable onPress={dismissWelcome} hitSlop={10} style={{ padding: 2 }}>
                    <Ionicons name="close" size={14} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                </View>
              ) : me.rounds === 0 && leaderboardPlayers.length <= 1 ? (
                <>
                  <Text style={styles.yourPos}>--</Text>
                  <Text style={styles.yourMeta}>Log rounds to see standings</Text>
                </>
              ) : (
                <>
                  <Text style={styles.yourPos}>
                    <Text style={{ fontFamily: GEO, fontWeight: '700', letterSpacing: -1 }}>#{myPos}</Text> in Group
                  </Text>
                  <Text style={styles.yourMeta}>
                    {me.courses} courses · {me.rounds} rounds · {me.bestRound} best
                  </Text>
                </>
              )}
            </View>
            <Text style={[styles.yourAvg, { fontFamily: GEO, fontWeight: '700', letterSpacing: -1 }]}>
              {me.rounds === 0 ? '--' : formatToPar(me.toPar)}
            </Text>
          </View>
        </LinearGradient>

        {/* ── Child 1: Gold divider ── */}
        <GoldDivider />

        {/* ── Child 2: Scope toggle + Season carousel ── */}
        <View>
          <ScopeToggle scope={scope} onToggle={setScope} />
          {realSeasons.length > 0 && <SeasonCarousel seasons={realSeasons} />}
        </View>

        {/* ── Child 3: Tab bar (STICKY) ── */}
        <View style={{ backgroundColor: c.bg }}>
          <TabBar active={tab} onSelect={setTab} />
        </View>

        {/* Demo peek toggle — show when empty */}
        {dataLoaded && leaderboardPlayers.length === 0 && (
          <DemoPeekToggle
            isActive={showDemoData}
            onToggle={() => setShowDemoData(!showDemoData)}
          />
        )}

        {/* Demo banner — persistent when demo mode active */}
        {showDemoData && leaderboardPlayers.length === 0 && (
          <DemoBanner hasRealRounds={myRounds.length > 0} />
        )}

        {/* ── Tab content ── */}
        {!dataLoaded ? (
          <SkeletonLeaderboard />
        ) : leaderboardPlayers.length === 0 && !showDemoData ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <LeaderboardGhostEmpty />
          </View>
        ) : (
          <View>
            {tab === 'Leaderboard' && (
              <LeaderboardTable
                players={
                  showDemoData && leaderboardPlayers.length === 0
                    ? (scope === 'field' ? DEMO_FIELD_LEADERBOARD : DEMO_LEADERBOARD)
                    : leaderboardPlayers
                }
                myId={myId}
                scope={scope}
              />
            )}
            {tab === 'Courses' && <CoursesTab search={search} onSearchChange={setSearch} scope={scope} />}
            {tab === 'H2H' && <H2HTab scope={scope} />}
            {tab === 'Records' && <RecordsTab search={search} onSearchChange={setSearch} scope={scope} />}
          </View>
        )}
        <View style={{ height: 32 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dormieLabel: {
    color: '#C9A227',
    fontSize: 7,
    letterSpacing: 3,
    fontStyle: 'italic',
    fontWeight: '600',
    marginBottom: 2,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Georgia',
    fontWeight: '700',
  },
  themeBtn: {
    padding: 8,
  },

  /* Your position card */
  yourCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.30)',
    borderRadius: 12,
  },
  yourInfo: {
    flex: 1,
    marginLeft: 12,
  },
  yourPos: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Georgia',
  },
  yourMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 2,
  },
  yourAvg: {
    color: '#C9A227',
    fontSize: 28,
    fontWeight: '700',
  },

  /* Scope toggle */
  scopeRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 3,
    borderRadius: 12,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  scopeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Season carousel */
  seasonWrap: {
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 24,
  },
  seasonCard: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  seasonGoldBar: {
    height: 3,
  },
  seasonContent: {
    padding: 14,
  },
  seasonTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seasonInfo: {
    flex: 1,
    marginHorizontal: 8,
  },
  seasonName: {
    fontSize: 14,
    fontWeight: '700',
  },
  seasonMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    marginTop: 10,
  },
  progressFill: {
    height: 4,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    // sharp edges — no borderRadius
  },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Content */
  content: {
    flex: 1,
  },
  contentInner: {
    paddingBottom: 32,
  },

  /* Table */
  tableWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'Georgia',
  },
  table: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  colHeader: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  colPos: {
    width: 36,
    textAlign: 'center',
    fontSize: 13,
  },
  colPlayer: {
    flex: 1,
  },
  colHero: {
    width: 48,
    textAlign: 'right',
  },
  colStat: {
    width: 36,
    textAlign: 'right',
    fontSize: 12,
  },
  colMovement: {
    width: 24,
    textAlign: 'center',
    fontSize: 12,
  },

  /* Player cell */
  playerCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerInfo: {
    marginLeft: 8,
    flex: 1,
  },
  playerName: {
    fontSize: 12,
    fontWeight: '500',
  },
  playerSub: {
    fontSize: 10,
    marginTop: 1,
  },

  /* Hero number */
  heroNumber: {
    fontSize: 18,
    fontWeight: '700',
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    padding: 32,
    marginHorizontal: 20,
    marginTop: 20,
    gap: 10,
    borderRadius: 12,
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
