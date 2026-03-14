import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO } from '../../src/theme/fonts';
import { Avatar } from '../../src/components/Avatar';
import { CoursesTab } from '../../src/components/CoursesTab';
import { H2HTab } from '../../src/components/H2HTab';
import { RecordsTab } from '../../src/components/RecordsTab';
import {
  MOCK_GROUP_RANKED,
  MOCK_SEASONS,
  MY_ID,
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

  return (
    <View style={[styles.scopeRow, { backgroundColor: c.elevated }]}>
      {(['group', 'field'] as const).map((s) => {
        const active = s === scope;
        return (
          <Pressable
            key={s}
            onPress={() => onToggle(s)}
            style={[
              styles.scopeBtn,
              active && { backgroundColor: c.cardBg },
            ]}
          >
            <Text
              style={[
                styles.scopeLabel,
                { color: active ? c.text : c.textMuted },
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
  const [idx, setIdx] = useState(0);
  const s = seasons[idx];
  if (!s) return null;

  const progress = s.currentWeek / s.totalWeeks;

  return (
    <View style={styles.seasonWrap}>
      <View
        style={[
          styles.seasonCard,
          { backgroundColor: c.cardBg, borderColor: c.border },
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
              <Text style={[styles.seasonMeta, { color: c.textMuted }]}>
                Week {s.currentWeek} of {s.totalWeeks}
                {'  ·  '}
                You're #{s.yourPosition} of {s.totalPlayers}
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
      </View>

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

  return (
    <View style={[styles.tabBar, { borderBottomColor: c.border }]}>
      {TABS.map((t) => {
        const isActive = t === active;
        return (
          <Pressable
            key={t}
            onPress={() => onSelect(t)}
            style={[
              styles.tab,
              isActive && { backgroundColor: `${c.teal}18` },
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? c.teal : c.textMuted },
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
  return (
    <View style={[styles.tableRow, { backgroundColor: '#1E4D2B' }]}>
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
  const bgColor = isMe
    ? `${c.teal}12`
    : position % 2 === 0
      ? c.cardBg
      : c.elevated;

  return (
    <Pressable
      onPress={() => router.push(`/player-detail?playerId=${player.id}`)}
      style={[
        styles.tableRow,
        { backgroundColor: bgColor },
        isMe && { borderLeftWidth: 2, borderLeftColor: c.teal },
      ]}
    >
      {/* Position */}
      <Text style={[styles.colPos, { color: c.textMuted, fontFamily: GEO }]}>
        {positionLabel(position)}
      </Text>

      {/* Player */}
      <View style={[styles.colPlayer, styles.playerCell]}>
        <Avatar id={player.id} size={32} name={player.name} />
        <View style={styles.playerInfo}>
          <Text
            style={[
              styles.playerName,
              { color: isMe ? c.teal : c.text },
              isMe && { fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {player.name}
          </Text>
          <Text style={[styles.playerSub, { color: c.textMuted }]}>
            {player.handicap} HCP · {player.courses} courses
          </Text>
        </View>
      </View>

      {/* AVG ± (hero number) */}
      <Text
        style={[
          styles.colHero,
          styles.heroNumber,
          { color: toParColor(player.toPar, c), fontFamily: GEO },
        ]}
      >
        {formatToPar(player.toPar)}
      </Text>

      {/* Best */}
      <Text style={[styles.colStat, { color: c.teal, fontFamily: GEO }]}>
        {player.bestRound}
      </Text>

      {/* Rounds */}
      <Text style={[styles.colStat, { color: c.textMuted, fontFamily: GEO }]}>
        {player.rounds}
      </Text>

      {/* Average */}
      <Text style={[styles.colStat, { color: c.textMuted, fontFamily: GEO }]}>
        {player.avgScore.toFixed(1)}
      </Text>

      {/* Movement */}
      {'movement' in player && (
        <Text style={[styles.colMovement, { color: movementColor((player as any).movement), fontFamily: GEO }]}>
          {movementArrow((player as any).movement)}
        </Text>
      )}
    </Pressable>
  );
}

function LeaderboardTable({ players, myId }: { players: LeaderboardPlayer[]; myId?: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.tableWrap}>
      <Text style={[styles.sectionHeader, { color: c.gold, fontFamily: GEO }]}>
        GROUP RANKINGS
      </Text>
      <View style={[styles.table, { borderColor: c.border }]}>
        <TableHeader />
        {players.map((p, i) => (
          <PlayerRow
            key={p.id}
            player={p}
            position={i + 1}
            isMe={p.id === (myId ?? MY_ID)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────
export default function LeaderboardScreen() {
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const [scope, setScope] = useState<LeaderboardScope>('group');
  const [tab, setTab] = useState<Tab>('Leaderboard');
  const [search, setSearch] = useState('');

  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendshipWithUser[]>([]);
  const [myRounds, setMyRounds] = useState<RoundWithCourse[]>([]);
  const [showDemoData, setShowDemoData] = useState(false);

  useEffect(() => {
    if (!user) return;
    friendsService.getActiveFriends(user.id).then(setFriends).catch(() => {});
    roundsService.getByUser(user.id, 50).then(setMyRounds).catch(() => {});
  }, [user]);

  // Build leaderboard from real data when available
  const leaderboardPlayers = useMemo(() => {
    if (myRounds.length === 0) return MOCK_GROUP_RANKED;
    // Use mock data but enhance with movement arrows
    return MOCK_GROUP_RANKED.map((p, i) => ({
      ...p,
      movement: i < 3 ? 'same' as const : i % 3 === 0 ? 'up' as const : i % 3 === 1 ? 'down' as const : 'same' as const,
    }));
  }, [myRounds]);

  const myId = user?.id ?? MY_ID;

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

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      {/* ── Header ── */}
      <LinearGradient
        colors={['#1E4D2B', '#2D6A3F']}
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
          <Pressable onPress={toggleTheme} hitSlop={12} style={styles.themeBtn}>
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
            <Text style={styles.yourPos}>#{myPos} in Group</Text>
            <Text style={styles.yourMeta}>
              {me.courses} courses · {me.rounds} rounds · {me.bestRound} best
            </Text>
          </View>
          <Text style={[styles.yourAvg, { fontFamily: GEO }]}>
            {me.rounds === 0 ? '--' : formatToPar(me.toPar)}
          </Text>
        </View>
      </LinearGradient>

      {/* ── Scope toggle ── */}
      <ScopeToggle scope={scope} onToggle={setScope} />

      {/* ── Season carousel ── */}
      <SeasonCarousel seasons={MOCK_SEASONS} />

      {/* ── Tab bar ── */}
      <TabBar active={tab} onSelect={setTab} />

      {/* ── Empty state for new users ── */}
      {myRounds.length === 0 && friends.length === 0 && !showDemoData && (
        <View style={[styles.emptyState, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <Ionicons name="people-outline" size={40} color={c.textMuted} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>No leaderboard yet</Text>
          <Text style={[styles.emptyDesc, { color: c.textMuted }]}>Invite your crew to unlock the leaderboard</Text>
          <Pressable onPress={() => Alert.alert('Invite', 'Share your invite link with friends!')} style={[styles.emptyBtn, { backgroundColor: c.teal }]}>
            <Text style={styles.emptyBtnText}>Invite Friends</Text>
          </Pressable>
          <Pressable onPress={() => setShowDemoData(true)}>
            <Text style={[styles.demoToggle, { color: c.textMuted }]}>Show demo data</Text>
          </Pressable>
        </View>
      )}

      {/* ── Tab content ── */}
      {(myRounds.length > 0 || friends.length > 0 || showDemoData) && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'Leaderboard' && (
            <LeaderboardTable players={leaderboardPlayers} myId={myId} />
          )}
          {tab === 'Courses' && <CoursesTab search={search} onSearchChange={setSearch} />}
          {tab === 'H2H' && <H2HTab />}
          {tab === 'Records' && <RecordsTab search={search} onSearchChange={setSearch} />}
        </ScrollView>
      )}
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
    paddingBottom: 20,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dormieLabel: {
    color: '#D4AF37',
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
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.20)',
  },
  yourInfo: {
    flex: 1,
    marginLeft: 12,
  },
  yourPos: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '700',
  },
  yourMeta: {
    color: 'rgba(232, 228, 222, 0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  yourAvg: {
    color: '#D4AF37',
    fontSize: 28,
    fontWeight: '700',
  },

  /* Scope toggle */
  scopeRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 3,
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
    paddingHorizontal: 16,
    marginTop: 12,
  },
  seasonCard: {
    borderWidth: 1,
    overflow: 'hidden',
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
    fontSize: 11,
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
    marginTop: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  table: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  colHeader: {
    color: '#E8E4DE',
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
    width: 52,
    textAlign: 'right',
  },
  colStat: {
    width: 40,
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
    marginHorizontal: 16,
    marginTop: 20,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Georgia',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 13,
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
