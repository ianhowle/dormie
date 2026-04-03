import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
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
import { CourseImage } from '../src/components/CourseImage';
import GoldDivider from '../src/components/GoldDivider';
import {
  getCourseDetail,
  type CourseDetailData,
  type ScoreEntry,
  type LeaderboardRow,
} from '../src/data/courseDetail';
import { coursesService } from '../src/services/courses.service';
import { roundsService } from '../src/services/rounds.service';
import { useAuth } from '../src/lib/auth';

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

function scoreToPar(score: number, par: number): number {
  return score - par;
}

const SOURCE_CONFIG: Record<ScoreEntry['source'], { label: string; colorKey: 'teal' | 'gold' | 'textMuted' }> = {
  trip: { label: 'TRIP', colorKey: 'teal' },
  season: { label: 'SEASON', colorKey: 'gold' },
  casual: { label: 'CASUAL', colorKey: 'textMuted' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Scope toggle ─────────────────────────────────────────────────────
type Scope = 'group' | 'field';

function ScopeToggle({
  scope,
  onToggle,
}: {
  scope: Scope;
  onToggle: (s: Scope) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[st.toggleRow, { borderColor: c.border }]}>
      {(['group', 'field'] as Scope[]).map((s) => {
        const active = scope === s;
        return (
          <Pressable
            key={s}
            onPress={() => { haptics.light(); onToggle(s); }}
            style={[
              st.toggleBtn,
              active && { backgroundColor: `${c.teal}20` },
            ]}
          >
            <Text
              style={[
                st.toggleLabel,
                { color: active ? c.teal : c.textMuted },
                active && { fontWeight: '700' },
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

// ─── Gross / Net toggle ───────────────────────────────────────────────
type ScoreMode = 'gross' | 'net';

function ScoreModeToggle({
  mode,
  onToggle,
}: {
  mode: ScoreMode;
  onToggle: (m: ScoreMode) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[st.miniToggleRow, { borderColor: c.border }]}>
      {(['gross', 'net'] as ScoreMode[]).map((m) => {
        const active = mode === m;
        return (
          <Pressable
            key={m}
            onPress={() => { haptics.light(); onToggle(m); }}
            style={[
              st.miniToggleBtn,
              active && { backgroundColor: `${c.teal}20` },
            ]}
          >
            <Text
              style={[
                st.miniToggleLabel,
                { color: active ? c.teal : c.textMuted },
                active && { fontWeight: '700' },
              ]}
            >
              {m === 'gross' ? 'Gross' : 'Net'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Header ───────────────────────────────────────────────────────────
function Header({ course }: { course: CourseDetailData }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  return (
    <CourseImage
      courseName={course.name}
      location={`${course.city} ${course.state}`}
      gradient={course.gradient}
      style={st.header}
    >
      {/* Dark overlay for text readability */}
      <View style={st.headerOverlay} />

      {/* Back button */}
      <Pressable
        onPress={() => { haptics.light(); router.back(); }}
        style={st.backBtn}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </Pressable>

      {/* Course info */}
      <View style={st.headerInfo}>
        <Text style={[st.headerName, { fontFamily: GEO }]}>
          {course.name}
        </Text>
        <Text style={st.headerLocation}>
          {'\u{1F4CD}'} {course.city}, {course.state}
        </Text>
      </View>

      {/* Stats row */}
      <View style={st.headerStats}>
        <HeaderStat label="PAR" value={String(course.par)} />
        <HeaderStat label="SLOPE" value={String(course.slope)} />
        <HeaderStat label="RATING" value={course.rating.toFixed(1)} />
        <HeaderStat label="ROUNDS" value={String(course.totalRounds)} />
      </View>
    </CourseImage>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.headerStatItem}>
      <Text style={[st.headerStatValue, { fontFamily: GEO }]}>{value}</Text>
      <Text style={st.headerStatLabel}>{label}</Text>
    </View>
  );
}

// ─── Your History card ────────────────────────────────────────────────
function YourHistoryCard({ course }: { course: CourseDetailData }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const h = course.myHistory ?? { best: 0, avg: 0, worst: 0, rounds: 0, scores: [] };

  return (
    <View style={st.sectionWrap}>
      <Text style={[st.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
        YOUR HISTORY
      </Text>
      <View
        style={[
          st.historyCard,
          { backgroundColor: c.cardBg, borderColor: c.teal, borderWidth: 1 },
          isDark ? cardShadowDark : cardShadowLight,
        ]}
      >
        <View style={st.historyRow}>
          <HistoryStat label="BEST" value={String(h.best)} color={c.teal} />
          <HistoryStat label="AVG" value={h.avg.toFixed(1)} color={c.text} />
          <HistoryStat label="WORST" value={String(h.worst)} color={c.urgent} />
          <HistoryStat label="RNDS" value={String(h.rounds)} color={c.text} />
        </View>
      </View>
    </View>
  );
}

function HistoryStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={st.historyStat}>
      <Text style={[st.historyValue, { color, fontFamily: GEO }]}>{value}</Text>
      <Text style={[st.historyLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Scores list ──────────────────────────────────────────────────────
function ScoresList({ course }: { course: CourseDetailData }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const scores = course.myHistory?.scores ?? [];

  return (
    <View style={st.sectionWrap}>
      <Text style={[st.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
        YOUR SCORES
      </Text>
      {scores.map((entry) => {
        const tp = scoreToPar(entry.score, course.par);
        const cfg = SOURCE_CONFIG[entry.source];

        return (
          <View
            key={entry.id}
            style={[st.scoreRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <View style={st.scoreLeft}>
              <View style={st.scoreTopRow}>
                <Text style={[st.scoreValue, { color: c.text, fontFamily: GEO }]}>
                  {entry.score}
                </Text>
                <Text
                  style={[
                    st.scoreToParInline,
                    { color: toParColor(tp, c), fontFamily: GEO },
                  ]}
                >
                  {formatToPar(tp)}
                </Text>
                <View style={[st.sourceBadge, { backgroundColor: `${c[cfg.colorKey]}20` }]}>
                  <Text style={[st.sourceBadgeText, { color: c[cfg.colorKey] }]}>
                    {cfg.label}
                  </Text>
                </View>
              </View>
              <Text style={[st.scoreLabel, { color: c.textMuted }]}>
                {entry.label}
              </Text>
            </View>
            <Text style={[st.scoreDate, { color: c.textMuted }]}>
              {formatDate(entry.date)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Leaderboard table ────────────────────────────────────────────────
const LB_ROW_HEIGHT = 52;

function LeaderboardTable({
  rows,
  par,
}: {
  rows: LeaderboardRow[];
  par: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const renderRow = useCallback(({ item: row, index: i }: { item: LeaderboardRow; index: number }) => {
    const pos = i + 1;
    const medal = pos === 1 ? '\u{1F947}' : pos === 2 ? '\u{1F948}' : pos === 3 ? '\u{1F949}' : '';
    const bgColor = row.isMe
      ? `${c.teal}12`
      : i % 2 === 0
        ? c.cardBg
        : c.elevated;

    return (
      <View
        style={[
          st.lbRow,
          { backgroundColor: bgColor },
          row.isMe && { borderLeftWidth: 2, borderLeftColor: c.teal },
        ]}
      >
        <Text style={[st.lbColPos, st.lbPosText, { color: c.textMuted }]}>
          {medal || pos}
        </Text>
        <View style={[st.lbColPlayer, st.lbPlayerCell]}>
          <Avatar id={row.playerId} size={22} name={row.playerName} />
          <View>
            <Text
              style={[
                st.lbPlayerName,
                { color: row.isMe ? c.teal : c.text },
                row.isMe && { fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {row.isMe ? 'You' : row.playerName}
            </Text>
            <Text style={[st.lbPlayerHcp, { color: c.textMuted }]}>
              HCP {row.handicap}
            </Text>
          </View>
        </View>
        <Text
          style={[
            st.lbColToPar,
            st.lbToParText,
            { color: toParColor(row.toPar, c), fontFamily: GEO },
          ]}
        >
          {formatToPar(row.toPar)}
        </Text>
        <Text
          style={[
            st.lbColScore,
            st.lbScoreText,
            { color: c.text, fontFamily: GEO },
          ]}
        >
          {row.bestScore}
        </Text>
      </View>
    );
  }, [c]);

  const keyExtractor = useCallback((item: LeaderboardRow) => item.playerId, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: LB_ROW_HEIGHT,
    offset: LB_ROW_HEIGHT * index,
    index,
  }), []);

  if (rows.length === 0) return null;

  return (
    <View style={st.sectionWrap}>
      <Text style={[st.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
        LEADERBOARD
      </Text>
      <View style={[st.lbTable, { borderColor: c.border }]}>
        <View style={[st.lbRow, { backgroundColor: '#1E4D2B' }]}>
          <Text style={[st.lbColPos, st.lbHeaderText]}>POS</Text>
          <Text style={[st.lbColPlayer, st.lbHeaderText]}>PLAYER</Text>
          <Text style={[st.lbColToPar, st.lbHeaderText]}>TO PAR</Text>
          <Text style={[st.lbColScore, st.lbHeaderText]}>SCORE</Text>
        </View>
        <FlatList
          data={rows}
          renderItem={renderRow}
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

// ─── Not-played state ─────────────────────────────────────────────────
function NotPlayedState({ course }: { course: CourseDetailData }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={st.sectionWrap}>
      {/* Community data */}
      {course.communityRounds !== null && (
        <>
          <Text style={[st.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
            DORMIE COMMUNITY
          </Text>
          <View style={[st.communityCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={st.communityRow}>
              <View style={st.communityStat}>
                <Text style={[st.communityValue, { color: c.teal, fontFamily: GEO }]}>
                  {course.communityRounds}
                </Text>
                <Text style={[st.communityLabel, { color: c.textMuted }]}>ROUNDS</Text>
              </View>
              <View style={st.communityStat}>
                <Text style={[st.communityValue, { color: c.text, fontFamily: GEO }]}>
                  {(course.communityAvg ?? 0).toFixed(1)}
                </Text>
                <Text style={[st.communityLabel, { color: c.textMuted }]}>AVG SCORE</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Prompt */}
      <View style={[st.promptCard, { backgroundColor: c.elevated, borderColor: c.border, borderStyle: 'dashed' }]}>
        <Text style={{ fontSize: 32 }}>{'\u{26F3}'}</Text>
        <Text style={[st.promptTitle, { color: c.text, fontFamily: GEO }]}>
          Haven't played here yet
        </Text>
        <Text style={[st.promptSub, { color: c.textMuted }]}>
          Log a round at {course.name} to see your stats and join the leaderboard.
        </Text>
        <Pressable onPress={() => { haptics.light(); }} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <Text style={{ color: c.teal, fontSize: 13, fontWeight: '700', marginTop: 4 }}>Log a Round</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────
export default function CourseDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const router = useRouter();

  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>('group');
  const [scoreMode, setScoreMode] = useState<ScoreMode>('gross');
  const [realLeaderboard, setRealLeaderboard] = useState<LeaderboardRow[] | null>(null);
  const [realHistory, setRealHistory] = useState<{ best: number; avg: number; worst: number; rounds: number; scores: ScoreEntry[] } | null>(undefined as any);

  // Fetch real course leaderboard
  useEffect(() => {
    if (!courseId) return;
    coursesService.getLeaderboard(courseId).then((entries) => {
      setRealLeaderboard(entries.map((e: any) => ({
        playerId: e.user_id,
        playerName: e.user_name,
        handicap: 0,
        bestScore: e.best_score,
        toPar: e.best_to_par,
        datePlayed: '',
        isMe: e.user_id === user?.id,
      })));
    }).catch(() => {});

    // Fetch personal history at this course
    if (user) {
      roundsService.fetchByCourse(courseId, user.id).then((rounds) => {
        if (rounds.length === 0) { setRealHistory(null); return; }
        const scores = rounds.map(r => r.gross_score);
        setRealHistory({
          best: Math.min(...scores),
          avg: scores.reduce((a, b) => a + b, 0) / scores.length,
          worst: Math.max(...scores),
          rounds: rounds.length,
          scores: rounds.slice(0, 10).map(r => ({
            id: r.id,
            score: r.gross_score,
            date: r.played_at,
            source: (r.trip_id ? 'trip' : r.season_week_id ? 'season' : 'casual') as 'trip' | 'season' | 'casual',
            label: r.course?.name ?? 'Round',
          })),
        });
      }).catch(() => {});
    }
  }, [courseId, user]);

  // Use static mock for course metadata, but override leaderboard and history with real data
  const baseCourse = useMemo(() => getCourseDetail(courseId ?? ''), [courseId]);
  const course = useMemo(() => {
    if (!baseCourse) return null;
    return {
      ...baseCourse,
      leaderboard: realLeaderboard ?? baseCourse.leaderboard,
      myHistory: realHistory !== undefined ? realHistory : baseCourse.myHistory,
    } as CourseDetailData;
  }, [baseCourse, realLeaderboard, realHistory]);

  if (!course) {
    return (
      <View style={[st.notFound, { backgroundColor: c.bg }]}>
        <Pressable onPress={() => { haptics.light(); router.back(); }} style={st.notFoundBack}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
          <Text style={[st.notFoundText, { color: c.text }]}>Course not found</Text>
        </Pressable>
      </View>
    );
  }

  const hasPlayed = course.myHistory !== null;

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <Header course={course} />
        <GoldDivider />

        <View style={st.body}>
          {/* Toggles */}
          <View style={st.togglesWrap}>
            <ScopeToggle scope={scope} onToggle={setScope} />
            <ScoreModeToggle mode={scoreMode} onToggle={setScoreMode} />
          </View>

          {hasPlayed ? (
            <>
              <YourHistoryCard course={course} />
              <ScoresList course={course} />
              <LeaderboardTable rows={course.leaderboard} par={course.par} />
            </>
          ) : (
            <NotPlayedState course={course} />
          )}
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

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerInfo: {
    marginBottom: 16,
  },
  headerName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerLocation: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 24,
  },
  headerStatItem: {
    alignItems: 'center',
  },
  headerStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  headerStatLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 2,
    textTransform: 'uppercase',
  },

  /* Body */
  body: {
    paddingHorizontal: 20,
  },

  /* Toggles */
  togglesWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    borderWidth: 1,
    flex: 1,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  miniToggleRow: {
    flexDirection: 'row',
    borderWidth: 1,
  },
  miniToggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  miniToggleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Section */
  sectionWrap: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },

  /* Your History */
  historyCard: {
    padding: 14,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  historyStat: {
    alignItems: 'center',
  },
  historyValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  historyLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },

  /* Scores */
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  scoreLeft: {
    flex: 1,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  scoreToParInline: {
    fontSize: 14,
    fontWeight: '700',
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scoreLabel: {
    fontSize: 10,
    marginTop: 3,
  },
  scoreDate: {
    fontSize: 11,
    paddingLeft: 8,
  },

  /* Leaderboard */
  lbTable: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  lbHeaderText: {
    color: '#E8E4DE',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  lbColPos: {
    width: 36,
  },
  lbColPlayer: {
    flex: 1,
    paddingRight: 4,
  },
  lbColToPar: {
    width: 52,
    textAlign: 'right',
  },
  lbColScore: {
    width: 42,
    textAlign: 'right',
  },
  lbPosText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  lbPlayerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lbPlayerName: {
    fontSize: 12,
    fontWeight: '500',
  },
  lbPlayerHcp: {
    fontSize: 9,
    marginTop: 1,
  },
  lbToParText: {
    fontSize: 16,
    fontWeight: '700',
  },
  lbScoreText: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* Community / Not played */
  communityCard: {
    padding: 16,
    borderWidth: 1,
  },
  communityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  communityStat: {
    alignItems: 'center',
  },
  communityValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  communityLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  promptCard: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    marginTop: 16,
    gap: 8,
  },
  promptTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  promptSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
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
