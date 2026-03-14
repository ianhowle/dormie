import { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { cardShadowDark, cardShadowLight } from '../src/theme/colors';
import { haptics } from '../src/lib/haptics';
import { Avatar } from '../src/components/Avatar';
import GoldDivider from '../src/components/GoldDivider';
import { MY_ID } from '../src/data/leaderboard';
import {
  getPlayerDetail,
  type PlayerDetailData,
  type BestRound,
} from '../src/data/playerDetail';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Helpers ──────────────────────────────────────────────────────────
function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : String(toPar);
}

function toParColor(
  toPar: number,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): string {
  if (toPar < 0) return c.teal;
  if (toPar === 0) return c.gold;
  return c.urgent;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Profile header ───────────────────────────────────────────────────
function ProfileHeader({ player }: { player: PlayerDetailData }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const isMe = player.id === MY_ID;

  return (
    <View style={[st.profileSection, { backgroundColor: c.surface }]}>
      {/* Back button */}
      <Pressable
        onPress={() => { haptics.light(); router.back(); }}
        style={st.backBtn}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={24} color={c.text} />
      </Pressable>

      {/* Avatar */}
      <View style={st.avatarWrap}>
        <Avatar id={player.id} size={64} name={player.name} />
      </View>

      {/* Name */}
      <Text style={[st.playerName, { color: c.text, fontFamily: GEO }]}>
        {player.name}
      </Text>

      {/* Subtitle */}
      <Text style={[st.playerSub, { color: c.textMuted }]}>
        {player.handicap} HCP · {player.city}, {player.state}
      </Text>

      {/* Add to group button (only for non-group players) */}
      {!player.isInGroup && !isMe && (
        <Pressable onPress={() => { haptics.light(); }} style={[st.addBtn, { borderColor: c.teal }]}>
          <Ionicons name="add" size={16} color={c.teal} />
          <Text style={[st.addBtnText, { color: c.teal }]}>Add to Group</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────
function StatsRow({ player }: { player: PlayerDetailData }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={st.statsRow}>
      <StatCard label="BEST" value={String(player.stats.best)} c={c} isDark={theme.isDark} />
      <StatCard label="AVG" value={player.stats.avg.toFixed(1)} c={c} isDark={theme.isDark} />
      <StatCard label="COURSES" value={String(player.stats.courses)} c={c} isDark={theme.isDark} />
      <StatCard label="ROUNDS" value={String(player.stats.rounds)} c={c} isDark={theme.isDark} />
    </View>
  );
}

function StatCard({
  label,
  value,
  c,
  isDark,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof useTheme>['theme']['colors'];
  isDark: boolean;
}) {
  return (
    <View style={[st.statCard, { backgroundColor: c.cardBg, borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}>
      <Text style={[st.statValue, { color: c.gold, fontFamily: GEO }]}>{value}</Text>
      <Text style={[st.statLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Source badges ────────────────────────────────────────────────────
function SourceBadges({ player }: { player: PlayerDetailData }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { trips, seasons } = player.sourceCounts;

  if (trips === 0 && seasons === 0) return null;

  return (
    <View style={st.badgeRow}>
      {trips > 0 && (
        <View style={[st.badge, { backgroundColor: `${c.teal}18` }]}>
          <Text style={[st.badgeText, { color: c.teal }]}>
            {trips} from trips
          </Text>
        </View>
      )}
      {seasons > 0 && (
        <View style={[st.badge, { backgroundColor: `${c.gold}18` }]}>
          <Text style={[st.badgeText, { color: c.gold }]}>
            {seasons} from seasons
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Best rounds table ────────────────────────────────────────────────
function BestRoundsTable({ rounds }: { rounds: BestRound[] }) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (rounds.length === 0) return null;

  return (
    <View style={st.tableSection}>
      <Text style={[st.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
        BEST ROUNDS
      </Text>
      <View style={[st.table, { borderColor: c.border }]}>
        {/* Header */}
        <View style={[st.tableRow, { backgroundColor: '#1E4D2B' }]}>
          <Text style={[st.colPos, st.colHeader]}>POS</Text>
          <Text style={[st.colCourse, st.colHeader]}>COURSE</Text>
          <Text style={[st.colToPar, st.colHeader]}>TO PAR</Text>
          <Text style={[st.colScore, st.colHeader]}>SCORE</Text>
        </View>

        {/* Rows */}
        {rounds.map((round, i) => {
          const pos = i + 1;
          const medal =
            pos === 1 ? '\u{1F947}' : pos === 2 ? '\u{1F948}' : pos === 3 ? '\u{1F949}' : '';
          const bgColor = i % 2 === 0 ? c.cardBg : c.elevated;

          return (
            <View
              key={round.id}
              style={[st.tableRow, { backgroundColor: bgColor }]}
            >
              {/* Position */}
              <Text style={[st.colPos, st.posText, { color: c.textMuted }]}>
                {medal || pos}
              </Text>

              {/* Course */}
              <View style={st.colCourse}>
                <Text
                  style={[st.courseName, { color: c.text }]}
                  numberOfLines={1}
                >
                  {round.courseName}
                </Text>
                <Text style={[st.courseDate, { color: c.textMuted }]}>
                  {formatDate(round.date)}
                </Text>
              </View>

              {/* To Par */}
              <Text
                style={[
                  st.colToPar,
                  st.toParText,
                  { color: toParColor(round.toPar, c), fontFamily: GEO },
                ]}
              >
                {formatToPar(round.toPar)}
              </Text>

              {/* Score */}
              <Text
                style={[
                  st.colScore,
                  st.scoreText,
                  { color: c.text, fontFamily: GEO },
                ]}
              >
                {round.score}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────
export default function PlayerDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { playerId } = useLocalSearchParams<{ playerId: string }>();
  const router = useRouter();

  const player = useMemo(() => getPlayerDetail(playerId ?? ''), [playerId]);

  if (!player) {
    return (
      <View style={[st.notFound, { backgroundColor: c.bg }]}>
        <Pressable onPress={() => { haptics.light(); router.back(); }} style={st.notFoundBack}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
          <Text style={[st.notFoundText, { color: c.text }]}>Player not found</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <ProfileHeader player={player} />

        <View style={st.body}>
          <StatsRow player={player} />
          <SourceBadges player={player} />
          <GoldDivider style={{ marginTop: 20, marginBottom: 4 }} />
          <BestRoundsTable rounds={player.bestRounds} />
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: {
    flex: 1,
  },

  /* Profile header */
  profileSection: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: STATUS_BAR_H,
    left: 12,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  avatarWrap: {
    marginTop: 12,
    marginBottom: 12,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
  },
  playerSub: {
    fontSize: 13,
    marginTop: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 14,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Body */
  body: {
    paddingHorizontal: 20,
  },

  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  /* Source badges */
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Table section */
  tableSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },

  /* Table */
  table: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
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
  },
  colCourse: {
    flex: 1,
    paddingRight: 4,
  },
  colToPar: {
    width: 52,
    textAlign: 'right',
  },
  colScore: {
    width: 42,
    textAlign: 'right',
  },

  /* Row cells */
  posText: {
    fontSize: 13,
    fontWeight: '600',
  },
  courseName: {
    fontSize: 12,
    fontWeight: '600',
  },
  courseDate: {
    fontSize: 9,
    marginTop: 1,
  },
  toParText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* Not found */
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notFoundText: {
    fontSize: 16,
  },
});
