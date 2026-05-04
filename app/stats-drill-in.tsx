import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { greenHeaderGradient } from '../src/theme/colors';
import { useAuth } from '../src/lib/auth';
import { haptics } from '../src/lib/haptics';
import { useDemoMode } from '../src/contexts/DemoModeContext';
import { Skeleton } from '../src/components/Skeleton';
import GoldDivider from '../src/components/GoldDivider';
import {
  statsService,
  type TripStatsOverview,
  type TripPerformance,
  type CourseStats,
  type YearStats,
  type StatCallouts,
} from '../src/services/stats.service';
import { MOCK_TRIP_STATS, MOCK_COMPLETED_TRIPS } from '../src/data/trips';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Demo fixtures ────────────────────────────────────────────────────
// Used only when the user has no real stats AND demo mode is on, so the
// drill-in still reads as a complete data story.
const DEMO_OVERVIEW: TripStatsOverview = {
  totalTrips: MOCK_TRIP_STATS.totalTrips,
  totalWins: MOCK_TRIP_STATS.wins,
  tripAvg: MOCK_TRIP_STATS.tripAvg,
  regularAvg: MOCK_TRIP_STATS.regularAvg,
  diffStrokes: MOCK_TRIP_STATS.tripAvg - MOCK_TRIP_STATS.regularAvg,
  totalRounds: 22,
  earliestTripDate: '2024-04-12',
  hasData: true,
};

const DEMO_TRIPS: TripPerformance[] = MOCK_COMPLETED_TRIPS.map((t, idx) => ({
  tripId: t.id,
  tripName: t.name,
  startDate: t.startDate,
  endDate: t.endDate,
  courseName: t.destination,
  avgScore: 76 + idx * 2.4,
  isWinner: idx === 0,
  rounds: t.roundsPlanned,
}));

const DEMO_COURSES: CourseStats[] = [
  { courseId: 'tpc-myrtle', courseName: 'TPC Myrtle Beach', timesPlayed: 4, avgScore: 76.2, bestScore: 71, bestScoreDate: '2024-10-12' },
  { courseId: 'gaylord', courseName: 'Gaylord Springs Golf Links', timesPlayed: 3, avgScore: 78.5, bestScore: 73, bestScoreDate: '2025-06-14' },
  { courseId: 'tpc-scottsdale', courseName: 'TPC Scottsdale — Stadium', timesPlayed: 2, avgScore: 79.0, bestScore: 75, bestScoreDate: '2026-03-27' },
];

const DEMO_YEARS: YearStats[] = [
  { year: 2026, trips: 1, avgScore: 77.0 },
  { year: 2025, trips: 3, avgScore: 76.5 },
  { year: 2024, trips: 3, avgScore: 78.2 },
];

const DEMO_CALLOUTS: StatCallouts = {
  mostPlayedCourse: { name: 'TPC Myrtle Beach', times: 4 },
  longestGap: { months: 7, from: '2024-10-13', to: '2025-06-13' },
  highestRound: { score: 88, date: '2024-04-13', course: 'Gaylord Springs Golf Links' },
  lowestRound: { score: 71, date: '2024-10-12', course: 'TPC Myrtle Beach' },
};

// ─── Format helpers ───────────────────────────────────────────────────
function fmtDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const sStr = s.toLocaleDateString('en-US', opts);
  const eStr = e.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${sStr} – ${eStr}`;
}

function fmtMonthYear(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ─── Section primitives ───────────────────────────────────────────────
function SectionHeader({ title, demo }: { title: string; demo?: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={st.sectionHeaderRow}>
      <Text style={[st.sectionHeader, { color: c.gold, fontFamily: GEO }]}>{title}</Text>
      {demo && (
        <View style={st.demoChip}>
          <Text style={st.demoChipText}>DEMO</Text>
        </View>
      )}
    </View>
  );
}

// ─── Section: Headline ────────────────────────────────────────────────
function HeadlineSection({ overview, demo }: { overview: TripStatsOverview; demo: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const playsSmarter = overview.diffStrokes < 0;
  const playsWorse = overview.diffStrokes > 0;
  const diffMag = Math.abs(overview.diffStrokes);
  const since = overview.earliestTripDate ? fmtMonthYear(overview.earliestTripDate) : '—';

  let title = 'No trip data yet';
  let subtitle = 'Your stats will populate after your first completed trip.';
  if (overview.totalTrips > 0 && diffMag >= 0.1) {
    if (playsSmarter) {
      title = `${diffMag.toFixed(1)} strokes better on trips`;
      subtitle = `Across ${overview.totalTrips} trip${overview.totalTrips === 1 ? '' : 's'} and ${overview.totalRounds} round${overview.totalRounds === 1 ? '' : 's'} since ${since}.`;
    } else if (playsWorse) {
      title = `${diffMag.toFixed(1)} strokes worse on trips`;
      subtitle = `Pre-trip jitters? ${overview.totalTrips} trip${overview.totalTrips === 1 ? '' : 's'} and ${overview.totalRounds} round${overview.totalRounds === 1 ? '' : 's'} since ${since}.`;
    }
  } else if (overview.totalTrips > 0) {
    title = "Trip and regular play are evenly matched";
    subtitle = `Across ${overview.totalTrips} trip${overview.totalTrips === 1 ? '' : 's'} and ${overview.totalRounds} round${overview.totalRounds === 1 ? '' : 's'} since ${since}.`;
  }

  return (
    <View style={st.section}>
      <SectionHeader title="HEADLINE" demo={demo} />
      <View style={[st.headlineCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <Text style={[st.headlineTitle, { color: c.text, fontFamily: GEO }]}>
          {title}
        </Text>
        <Text style={[st.headlineSubtitle, { color: c.textMuted }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

// ─── Section: Trip avg vs Regular avg ─────────────────────────────────
function ComparisonSection({ overview, demo }: { overview: TripStatsOverview; demo: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (overview.tripAvg === 0 || overview.regularAvg === 0) return null;

  const max = Math.max(overview.tripAvg, overview.regularAvg);
  const tripPct = (overview.tripAvg / max) * 100;
  const regPct = (overview.regularAvg / max) * 100;
  const tripBetter = overview.diffStrokes < 0;

  return (
    <View style={st.section}>
      <SectionHeader title="TRIP AVG vs REGULAR AVG" demo={demo} />
      <View style={[st.compareCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <View style={st.compareRow}>
          <Text style={[st.compareLabel, { color: c.textMuted }]}>Trip Avg</Text>
          <View style={st.compareBarTrack}>
            <View style={[st.compareBarFill, { width: `${tripPct}%`, backgroundColor: tripBetter ? '#006747' : c.gold }]} />
          </View>
          <Text style={[st.compareValue, { color: c.text, fontFamily: GEO }]}>
            {overview.tripAvg.toFixed(1)}
          </Text>
        </View>
        <View style={st.compareRow}>
          <Text style={[st.compareLabel, { color: c.textMuted }]}>Regular Avg</Text>
          <View style={st.compareBarTrack}>
            <View style={[st.compareBarFill, { width: `${regPct}%`, backgroundColor: tripBetter ? c.gold : '#006747' }]} />
          </View>
          <Text style={[st.compareValue, { color: c.text, fontFamily: GEO }]}>
            {overview.regularAvg.toFixed(1)}
          </Text>
        </View>
        <Text style={[st.compareCaption, { color: c.textMuted }]}>
          {tripBetter
            ? 'Why might this be? Better focus, better company, better courses.'
            : 'Higher stakes can rattle anyone. The pattern is real.'}
        </Text>
      </View>
    </View>
  );
}

// ─── Section: Trip-by-trip ────────────────────────────────────────────
function TripBreakdownSection({ trips, demo }: { trips: TripPerformance[]; demo: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  if (trips.length === 0) return null;

  return (
    <View style={st.section}>
      <SectionHeader title="TRIP BY TRIP" demo={demo} />
      {trips.map((t) => (
        <Pressable
          key={t.tripId}
          onPress={() => {
            haptics.light();
            router.push({ pathname: '/trip-detail', params: { tripId: t.tripId } });
          }}
          style={({ pressed }) => [
            st.tripRow,
            { backgroundColor: c.cardBg, borderColor: c.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <View style={st.tripRowTitleLine}>
              <Text style={[st.tripRowName, { color: c.text }]} numberOfLines={1}>
                {t.tripName}
              </Text>
              {t.isWinner && <Ionicons name="trophy" size={14} color={c.gold} />}
            </View>
            <Text style={[st.tripRowMeta, { color: c.textMuted }]}>
              {fmtDateRange(t.startDate, t.endDate)} · {t.courseName}
            </Text>
          </View>
          <View style={st.tripRowRight}>
            <Text style={[st.tripRowAvg, { color: c.text, fontFamily: GEO }]}>
              {t.avgScore > 0 ? t.avgScore.toFixed(1) : '—'}
            </Text>
            <Text style={[st.tripRowAvgLabel, { color: c.textMuted }]}>
              {t.rounds > 0 ? `${t.rounds} round${t.rounds === 1 ? '' : 's'}` : 'no rounds'}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Section: Course-by-course ────────────────────────────────────────
function CourseBreakdownSection({ courses, demo }: { courses: CourseStats[]; demo: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (courses.length < 2) return null;
  return (
    <View style={st.section}>
      <SectionHeader title="COURSES PLAYED MULTIPLE TIMES" demo={demo} />
      {courses.map((co) => (
        <View key={co.courseId} style={[st.courseRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[st.courseRowName, { color: c.text }]}>{co.courseName}</Text>
            <Text style={[st.courseRowMeta, { color: c.textMuted }]}>
              {co.timesPlayed} times · best {co.bestScore} on {fmtMonthYear(co.bestScoreDate)}
            </Text>
          </View>
          <Text style={[st.courseRowAvg, { color: c.teal, fontFamily: GEO }]}>
            {co.avgScore.toFixed(1)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Section: Year-over-year ──────────────────────────────────────────
function YearOverYearSection({ years, demo }: { years: YearStats[]; demo: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (years.length < 2) return null;
  const max = Math.max(...years.map((y) => y.trips));
  return (
    <View style={st.section}>
      <SectionHeader title="YEAR OVER YEAR" demo={demo} />
      <View style={[st.yearCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        {years.map((y) => {
          const pct = max > 0 ? (y.trips / max) * 100 : 0;
          return (
            <View key={y.year} style={st.yearRow}>
              <Text style={[st.yearLabel, { color: c.text, fontFamily: GEO }]}>{y.year}</Text>
              <View style={st.yearBarTrack}>
                <View style={[st.yearBarFill, { width: `${pct}%`, backgroundColor: c.teal }]} />
              </View>
              <Text style={[st.yearValue, { color: c.textMuted }]}>
                {y.trips} trip{y.trips === 1 ? '' : 's'} · {y.avgScore > 0 ? y.avgScore.toFixed(1) : '—'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Section: Callouts ────────────────────────────────────────────────
function CalloutsSection({ callouts, demo }: { callouts: StatCallouts; demo: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const items: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; value: string; sub: string }[] = [];
  if (callouts.mostPlayedCourse) {
    items.push({
      icon: 'golf-outline',
      color: c.teal,
      label: 'Most Played',
      value: callouts.mostPlayedCourse.name,
      sub: `${callouts.mostPlayedCourse.times} rounds`,
    });
  }
  if (callouts.longestGap) {
    items.push({
      icon: 'hourglass-outline',
      color: c.gold,
      label: 'Longest Gap',
      value: `${callouts.longestGap.months} mo`,
      sub: `${fmtMonthYear(callouts.longestGap.from)} → ${fmtMonthYear(callouts.longestGap.to)}`,
    });
  }
  if (callouts.lowestRound) {
    items.push({
      icon: 'trophy-outline',
      color: c.gold,
      label: 'Best Round',
      value: String(callouts.lowestRound.score),
      sub: `${callouts.lowestRound.course} · ${fmtMonthYear(callouts.lowestRound.date)}`,
    });
  }
  if (callouts.highestRound) {
    items.push({
      icon: 'flame-outline',
      color: c.urgent,
      label: 'Highest Round',
      value: String(callouts.highestRound.score),
      sub: `${callouts.highestRound.course} · ${fmtMonthYear(callouts.highestRound.date)}`,
    });
  }
  if (items.length === 0) return null;
  return (
    <View style={st.section}>
      <SectionHeader title="CALLOUTS" demo={demo} />
      <View style={st.calloutGrid}>
        {items.map((it, idx) => (
          <View key={idx} style={[st.calloutCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <Ionicons name={it.icon} size={18} color={it.color} />
            <Text style={[st.calloutLabel, { color: c.textMuted }]}>{it.label}</Text>
            <Text style={[st.calloutValue, { color: c.text, fontFamily: GEO }]} numberOfLines={1}>
              {it.value}
            </Text>
            <Text style={[st.calloutSub, { color: c.textMuted }]} numberOfLines={2}>
              {it.sub}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────
function DrillSkeleton() {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
      <Skeleton width="50%" height={14} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={90} style={{ marginBottom: 24 }} />
      <Skeleton width="50%" height={14} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={140} style={{ marginBottom: 24 }} />
      <Skeleton width="50%" height={14} style={{ marginBottom: 12 }} />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} width="100%" height={64} style={{ marginBottom: 8 }} />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════
export default function StatsDrillInScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDemoMode } = useDemoMode();

  const [overview, setOverview] = useState<TripStatsOverview | null>(null);
  const [trips, setTrips] = useState<TripPerformance[]>([]);
  const [courses, setCourses] = useState<CourseStats[]>([]);
  const [years, setYears] = useState<YearStats[]>([]);
  const [callouts, setCallouts] = useState<StatCallouts | null>(null);
  const [loading, setLoading] = useState(true);

  // Pin to a stable userId primitive — the Supabase user object reference
  // re-emits on token refresh / focus events, which previously cancelled the
  // in-flight fetch on every emission and left the screen stuck in loading.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [o, t, co, y, cl] = await Promise.all([
          statsService.getOverview(userId),
          statsService.getTripPerformanceList(userId),
          statsService.getCourseBreakdown(userId),
          statsService.getYearOverYear(userId),
          statsService.getCallouts(userId),
        ]);
        if (cancelled) return;
        setOverview(o);
        setTrips(t);
        setCourses(co);
        setYears(y);
        setCallouts(cl);
      } catch {
        // Soft-fail; the screen will fall back to empty/demo state below
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const useDemo = useMemo(() => {
    if (loading) return false;
    return (!overview || !overview.hasData) && isDemoMode;
  }, [loading, overview, isDemoMode]);

  const view = useMemo(() => {
    if (useDemo) {
      return {
        overview: DEMO_OVERVIEW,
        trips: DEMO_TRIPS,
        courses: DEMO_COURSES,
        years: DEMO_YEARS,
        callouts: DEMO_CALLOUTS,
      };
    }
    return {
      overview: overview ?? null,
      trips,
      courses,
      years,
      callouts,
    };
  }, [useDemo, overview, trips, courses, years, callouts]);

  const showEmpty =
    !loading && !useDemo && (!overview || !overview.hasData);

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={greenHeaderGradient}
        style={[st.header, { paddingTop: STATUS_BAR_H }]}
      >
        <View style={st.headerRow}>
          <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#E8E4DE" />
          </Pressable>
          <Text style={[st.headerTitle, { color: c.gold, fontFamily: GEO }]}>YOUR TRIP STORY</Text>
          <View style={{ width: 24 }} />
        </View>
        <GoldDivider style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {loading && <DrillSkeleton />}

        {!loading && showEmpty && (
          <View style={st.emptyWrap}>
            <Ionicons name="stats-chart-outline" size={40} color={c.textMuted} />
            <Text style={[st.emptyTitle, { color: c.text, fontFamily: GEO }]}>
              No trip data yet
            </Text>
            <Text style={[st.emptyBody, { color: c.textMuted }]}>
              Your story will populate after your first completed trip.
            </Text>
          </View>
        )}

        {!loading && !showEmpty && view.overview && (
          <>
            <HeadlineSection overview={view.overview} demo={useDemo} />
            <ComparisonSection overview={view.overview} demo={useDemo} />
            <TripBreakdownSection trips={view.trips} demo={useDemo} />
            <CourseBreakdownSection courses={view.courses} demo={useDemo} />
            <YearOverYearSection years={view.years} demo={useDemo} />
            {view.callouts && <CalloutsSection callouts={view.callouts} demo={useDemo} />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },

  /* Sections */
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  demoChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: '#C9A227',
  },
  demoChipText: {
    color: '#C9A227',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },

  /* Headline */
  headlineCard: {
    padding: 20,
    borderWidth: 1,
  },
  headlineTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headlineSubtitle: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },

  /* Comparison */
  compareCard: {
    padding: 16,
    borderWidth: 1,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  compareLabel: {
    width: 88,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  compareBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  compareBarFill: {
    height: '100%',
  },
  compareValue: {
    width: 56,
    textAlign: 'right',
    fontSize: 18,
    fontWeight: '700',
  },
  compareCaption: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },

  /* Trip rows */
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  tripRowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripRowName: {
    fontSize: 14,
    fontWeight: '700',
  },
  tripRowMeta: {
    fontSize: 11,
    marginTop: 3,
  },
  tripRowRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  tripRowAvg: {
    fontSize: 18,
    fontWeight: '700',
  },
  tripRowAvgLabel: {
    fontSize: 10,
    marginTop: 2,
  },

  /* Course rows */
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  courseRowName: {
    fontSize: 14,
    fontWeight: '700',
  },
  courseRowMeta: {
    fontSize: 11,
    marginTop: 3,
  },
  courseRowAvg: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },

  /* Year-over-year */
  yearCard: {
    padding: 16,
    borderWidth: 1,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  yearLabel: {
    width: 48,
    fontSize: 14,
    fontWeight: '700',
  },
  yearBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  yearBarFill: {
    height: '100%',
  },
  yearValue: {
    minWidth: 110,
    textAlign: 'right',
    fontSize: 11,
  },

  /* Callouts */
  calloutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  calloutCard: {
    width: '48%',
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
  calloutLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  calloutValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  calloutSub: {
    fontSize: 10,
  },

  /* Empty */
  emptyWrap: {
    paddingHorizontal: 24,
    paddingTop: 64,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
  },
});
