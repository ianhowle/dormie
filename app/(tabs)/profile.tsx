import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/lib/auth';
import { GEO } from '../../src/theme/fonts';
import { Avatar } from '../../src/components/Avatar';
import { roundsService } from '../../src/services/rounds.service';
import type { RoundWithCourse } from '../../src/lib/database.types';
import { scoreColor, formatToPar as formatToParUtil, toParColor as toParColorUtil } from '../../src/lib/scoring-utils';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Mock data (fallback when no real data) ──────────────────────────
const MOCK_USER = {
  id: '1',
  name: 'Ian McGowan',
  handicap: 8.2,
  city: 'Nashville',
  state: 'TN',
  email: 'ian@dormie.golf',
  memberSince: '2024',
};

const MOCK_STATS = {
  totalRounds: 142,
  coursesPlayed: 38,
  bestRound: { score: 68, course: 'TPC Sawgrass', par: 72 },
  scoringAvg: 76.8,
  courseRecords: 3,
  tripsPlayed: 7,
};

type RecentRound = {
  id: string;
  course: string;
  score: number;
  par: number;
  date: string;
  source: 'manual' | 'ghin' | 'app';
};

const MOCK_RECENT_ROUNDS: RecentRound[] = [
  { id: 'r1', course: 'Hermitage Golf Course', score: 74, par: 72, date: 'Mar 8, 2026', source: 'app' },
  { id: 'r2', course: 'Gaylord Springs', score: 79, par: 72, date: 'Mar 1, 2026', source: 'app' },
  { id: 'r3', course: 'TPC Scottsdale', score: 76, par: 71, date: 'Feb 22, 2026', source: 'app' },
  { id: 'r4', course: 'We-Ko-Pa Saguaro', score: 82, par: 72, date: 'Feb 21, 2026', source: 'manual' },
  { id: 'r5', course: 'Grayhawk Raptor', score: 78, par: 72, date: 'Feb 20, 2026', source: 'ghin' },
];

// Last 20 rounds handicap trend
const HANDICAP_TREND = [
  12.1, 11.8, 11.4, 10.9, 10.6, 10.2, 10.0, 9.8, 9.5, 9.3,
  9.6, 9.2, 8.9, 8.7, 8.4, 8.6, 8.3, 8.1, 8.4, 8.2,
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

// ─── Section label ───────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[s.sectionLabel, { color: theme.colors.gold, fontFamily: GEO }]}>{title}</Text>
  );
}

// ─── Handicap Chart ──────────────────────────────────────────────────
function HandicapChart({ data }: { data: number[] }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const W = 320;
  const H = 120;
  const PAD_X = 30;
  const PAD_Y = 16;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  const minVal = Math.floor(Math.min(...data) - 0.5);
  const maxVal = Math.ceil(Math.max(...data) + 0.5);
  const range = maxVal - minVal || 1;

  const points = data.map((val, i) => {
    const x = PAD_X + (i / (data.length - 1)) * chartW;
    const y = PAD_Y + (1 - (val - minVal) / range) * chartH;
    return { x, y, val };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  // Y-axis labels
  const yLabels = [maxVal, (maxVal + minVal) / 2, minVal];

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Grid lines */}
      {yLabels.map((val) => {
        const y = PAD_Y + (1 - (val - minVal) / range) * chartH;
        return (
          <Line
            key={val}
            x1={PAD_X}
            y1={y}
            x2={W - PAD_X}
            y2={y}
            stroke={c.border}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        );
      })}

      {/* Y-axis labels */}
      {yLabels.map((val) => {
        const y = PAD_Y + (1 - (val - minVal) / range) * chartH;
        return (
          <SvgText
            key={`l${val}`}
            x={PAD_X - 6}
            y={y + 3}
            fontSize={9}
            fill={c.textMuted}
            textAnchor="end"
            fontFamily="Georgia"
          >
            {val.toFixed(1)}
          </SvgText>
        );
      })}

      {/* Trend line */}
      <Path d={pathD} stroke={c.teal} strokeWidth={2} fill="none" />

      {/* Current point */}
      <Circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={4}
        fill={c.teal}
      />

      {/* Start point */}
      <Circle
        cx={points[0].x}
        cy={points[0].y}
        r={3}
        fill={c.textMuted}
      />

      {/* X-axis labels */}
      <SvgText x={PAD_X} y={H - 2} fontSize={8} fill={c.textMuted}>
        20 rounds ago
      </SvgText>
      <SvgText x={W - PAD_X} y={H - 2} fontSize={8} fill={c.textMuted} textAnchor="end">
        Now
      </SvgText>
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════
export default function ProfileScreen() {
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState(true);
  const [showIntegrity, setShowIntegrity] = useState(false);
  const [showDemoData, setShowDemoData] = useState(false);
  const [favoriteCourse, setFavoriteCourse] = useState<string | null>(null);
  const [showCoursePicker, setShowCoursePicker] = useState(false);

  const COURSE_OPTIONS = ['Hermitage Golf Course', 'Gaylord Springs', 'TPC Scottsdale', 'We-Ko-Pa Saguaro', 'Grayhawk Raptor'];
  const FAVORITE_COURSE_STATS = { bestScore: 71, avgScore: 75.2, roundsPlayed: 12 };

  // Use real auth data when available, fall back to mock
  const profileUser = useMemo(() => {
    if (user) {
      return {
        ...MOCK_USER,
        id: user.id,
        name: user.user_metadata?.name ?? MOCK_USER.name,
        email: user.email ?? MOCK_USER.email,
        handicap: user.user_metadata?.handicap_index ?? MOCK_USER.handicap,
        memberSince: new Date(user.created_at).getFullYear().toString(),
      };
    }
    return MOCK_USER;
  }, [user]);

  const [realRounds, setRealRounds] = useState<RoundWithCourse[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingRounds(true);
    roundsService.getByUser(user.id, 20)
      .then(setRealRounds)
      .catch(() => {})
      .finally(() => setLoadingRounds(false));
  }, [user]);

  // Compute real stats from rounds
  const realStats = useMemo(() => {
    if (realRounds.length === 0) return null;
    const totalRounds = realRounds.length;
    const courseSet = new Set(realRounds.map(r => r.course_id));
    const coursesPlayed = courseSet.size;
    const scores = realRounds.map(r => r.gross_score);
    const bestScore = Math.min(...scores);
    const bestRound = realRounds.find(r => r.gross_score === bestScore);
    const scoringAvg = scores.reduce((a, b) => a + b, 0) / totalRounds;
    return {
      totalRounds,
      coursesPlayed,
      bestRound: { score: bestScore, course: bestRound?.course?.name ?? 'Unknown', par: bestRound?.course?.par ?? 72 },
      scoringAvg,
      courseRecords: 0,
      tripsPlayed: new Set(realRounds.filter(r => r.trip_id).map(r => r.trip_id)).size,
    };
  }, [realRounds]);

  const EMPTY_STATS = {
    totalRounds: '--' as any,
    coursesPlayed: '--' as any,
    bestRound: { score: '--' as any, course: '--', par: 72 },
    scoringAvg: '--' as any,
    courseRecords: '--' as any,
    tripsPlayed: '--' as any,
  };

  const displayStats = realStats ?? (showDemoData ? MOCK_STATS : EMPTY_STATS);

  // Build recent rounds from real data
  const displayRounds: RecentRound[] = useMemo(() => {
    if (realRounds.length > 0) {
      return realRounds.slice(0, 5).map(r => ({
        id: r.id,
        course: r.course?.name ?? 'Unknown',
        score: r.gross_score,
        par: r.course?.par ?? 72,
        date: new Date(r.played_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        source: r.source as 'manual' | 'ghin' | 'app',
      }));
    }
    if (showDemoData) return MOCK_RECENT_ROUNDS;
    return [];
  }, [realRounds, showDemoData]);

  // Build handicap trend from real rounds
  const displayHandicapTrend = useMemo(() => {
    if (realRounds.length >= 3) {
      // Approximate trend from scoring differentials
      return realRounds.slice(0, 20).reverse().map(r => {
        const diff = r.gross_score - (r.course?.par ?? 72);
        return Math.max(0, diff * 0.96); // rough handicap approximation
      });
    }
    if (showDemoData) return HANDICAP_TREND;
    return [];
  }, [realRounds, showDemoData]);

  const toPar = (score: number, par: number) => {
    const diff = score - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const toParColor = (score: number, par: number) => {
    const diff = score - par;
    if (diff < 0) return c.teal;
    if (diff > 0) return c.urgent;
    return c.text;
  };

  const sourceBadge = (source: RecentRound['source']) => {
    if (source === 'app') return { label: 'DORMIE', color: c.teal };
    if (source === 'ghin') return { label: 'GHIN', color: c.gold };
    return { label: 'MANUAL', color: c.textMuted };
  };

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* ─── HEADER ──────────────────────────────────────────────── */}
        <View style={[s.header, { backgroundColor: c.surface }]}>
          <View style={s.brandRow}>
            <Text style={[s.brand, { color: c.gold, fontFamily: GEO }]}>DORMIE</Text>
            <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
              <Ionicons name="settings-outline" size={20} color={c.textMuted} />
            </Pressable>
          </View>

          <View style={s.profileRow}>
            <View style={{ position: 'relative' }}>
              <Avatar id={profileUser.id} size={80} name={profileUser.name} />
              <Pressable
                style={s.avatarEditBtn}
                onPress={() =>
                  Alert.alert('Change Avatar', 'Choose an avatar style', [
                    { text: 'Initials' },
                    { text: 'Course Theme' },
                    { text: 'Upload Photo' },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                }
              >
                <Ionicons name="create-outline" size={12} color="#fff" />
              </Pressable>
            </View>
            <View style={s.profileInfo}>
              <Text style={[s.profileName, { color: c.text, fontFamily: GEO }]}>
                {profileUser.name}
              </Text>
              <View style={s.handicapRow}>
                <Text style={[s.handicapLabel, { color: c.textMuted }]}>HCP</Text>
                <Text style={[s.handicapValue, { color: c.teal, fontFamily: GEO }]}>
                  {profileUser.handicap.toFixed(1)}
                </Text>
                <Text style={[s.handicapLabel, { color: c.textMuted, marginLeft: 10 }]}>NET</Text>
                <Text style={[s.handicapValue, {
                  color: typeof displayStats.scoringAvg === 'number'
                    ? ((displayStats.scoringAvg - (displayStats.bestRound.par ?? 72) - profileUser.handicap) < 0 ? c.teal : (displayStats.scoringAvg - (displayStats.bestRound.par ?? 72) - profileUser.handicap) > 0 ? c.urgent : c.text)
                    : c.textMuted,
                  fontFamily: GEO,
                }]}>
                  {typeof displayStats.scoringAvg === 'number'
                    ? ((val: number) => val === 0 ? 'E' : val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1))(displayStats.scoringAvg - 72 - profileUser.handicap)
                    : '--'}
                </Text>
              </View>
              <Text style={[s.location, { color: c.textMuted }]}>
                {profileUser.city}, {profileUser.state}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => Alert.alert('Edit Profile', 'Profile editing would open here.')}
            style={[s.editBtn, { borderColor: c.border }]}
          >
            <Ionicons name="pencil-outline" size={14} color={c.teal} />
            <Text style={[s.editBtnText, { color: c.teal }]}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={s.body}>
          {/* ─── STATS GRID ──────────────────────────────────────── */}
          <SectionLabel title="STATS" />
          <View style={s.statsGrid}>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.teal, fontFamily: GEO }]}>
                {displayStats.totalRounds}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Total Rounds</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.teal, fontFamily: GEO }]}>
                {displayStats.coursesPlayed}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Courses Played</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.gold, fontFamily: GEO }]}>
                {displayStats.bestRound.score}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Best Round</Text>
              <Text style={[s.statSub, { color: c.textMuted }]} numberOfLines={1}>
                {displayStats.bestRound.course}
              </Text>
            </View>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.teal, fontFamily: GEO }]}>
                {typeof displayStats.scoringAvg === 'number' ? displayStats.scoringAvg.toFixed(1) : displayStats.scoringAvg}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Scoring Average</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.gold, fontFamily: GEO }]}>
                {displayStats.courseRecords}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Course Records</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.teal, fontFamily: GEO }]}>
                {displayStats.tripsPlayed}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Trips Played</Text>
            </View>
          </View>

          {/* Demo data toggle for new users */}
          {!realStats && !showDemoData && (
            <Pressable onPress={() => setShowDemoData(true)} style={s.demoToggleWrap}>
              <Text style={[s.demoToggle, { color: c.textMuted }]}>Show demo data</Text>
            </Pressable>
          )}

          {/* ─── HANDICAP TREND ───────────────────────────────────── */}
          {displayHandicapTrend.length > 0 && (
            <>
              <SectionLabel title="HANDICAP TREND" />
              <View style={[s.chartCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                <View style={s.chartHeader}>
                  <View>
                    <Text style={[s.chartCurrentLabel, { color: c.textMuted }]}>Current</Text>
                    <Text style={[s.chartCurrentValue, { color: c.teal, fontFamily: GEO }]}>
                      {(displayHandicapTrend[displayHandicapTrend.length - 1] ?? 0).toFixed(1)}
                    </Text>
                  </View>
                  <View style={s.chartTrendBadge}>
                    <Ionicons
                      name="trending-down"
                      size={14}
                      color={c.teal}
                    />
                    <Text style={[s.chartTrendText, { color: c.teal }]}>
                      {((displayHandicapTrend[0] ?? 0) - (displayHandicapTrend[displayHandicapTrend.length - 1] ?? 0)).toFixed(1)} improvement
                    </Text>
                  </View>
                </View>
                <View style={s.chartWrap}>
                  <HandicapChart data={displayHandicapTrend} />
                </View>
              </View>
            </>
          )}

          {/* ─── RECENT ROUNDS ────────────────────────────────────── */}
          {displayRounds.length > 0 && <SectionLabel title="RECENT ROUNDS" />}
          {displayRounds.map((round) => {
            const badge = sourceBadge(round.source);
            return (
              <Pressable
                key={round.id}
                onPress={() => router.push({
                  pathname: '/round-detail',
                  params: { roundId: round.id, course: round.course, score: String(round.score), par: String(round.par), date: round.date, source: round.source },
                })}
                style={[s.roundRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
              >
                <View style={s.roundScoreWrap}>
                  <Text style={[s.roundScore, { color: c.text, fontFamily: GEO }]}>
                    {round.score}
                  </Text>
                  <Text style={[s.roundToPar, { color: toParColor(round.score, round.par), fontFamily: GEO }]}>
                    {toPar(round.score, round.par)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.roundCourse, { color: c.text }]} numberOfLines={1}>
                    {round.course}
                  </Text>
                  <View style={s.roundMetaRow}>
                    <Text style={[s.roundDate, { color: c.textMuted }]}>{round.date}</Text>
                    <View style={[s.sourceBadge, { backgroundColor: `${badge.color}15` }]}>
                      <Text style={[s.sourceBadgeText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </Pressable>
            );
          })}

          {/* ─── HANDICAP INTEGRITY MONITOR ─────────────────────── */}
          <Pressable
            onPress={() => setShowIntegrity(!showIntegrity)}
            style={s.integrityHeader}
          >
            <LinearGradient
              colors={['#1E4D2B', '#2D6A3F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.integrityHeaderGradient}
            >
              <Pinstripes />
              <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
              <Text style={s.integrityHeaderText}>Handicap Integrity Monitor</Text>
              <Ionicons name={showIntegrity ? 'chevron-up' : 'chevron-down'} size={18} color="#FFFFFF88" />
            </LinearGradient>
          </Pressable>

          {showIntegrity && (
            <View style={[s.integrityBody, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              {/* Fair Play Score */}
              <View style={s.integrityScoreRow}>
                <Text style={[s.integrityScoreLabel, { color: c.textMuted }]}>Fair Play Score</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={[s.integrityScoreValue, { color: c.teal, fontFamily: GEO }]}>92</Text>
                  <View style={[s.integrityBadge, { backgroundColor: '#2A9D8F22' }]}>
                    <Text style={[s.integrityBadgeText, { color: c.teal }]}>CLEAN</Text>
                  </View>
                </View>
              </View>

              {/* Score bar */}
              <View style={[s.integrityBar, { backgroundColor: c.elevated }]}>
                <View style={[s.integrityBarFill, { backgroundColor: c.teal, width: '92%' }]} />
              </View>

              {/* Factor breakdown */}
              <View style={s.integrityFactors}>
                <View style={s.integrityFactorRow}>
                  <Text style={[s.integrityFactorLabel, { color: c.textMuted }]}>Score Variance</Text>
                  <Text style={[s.integrityFactorValue, { color: c.teal }]}>Low</Text>
                </View>
                <View style={s.integrityFactorRow}>
                  <Text style={[s.integrityFactorLabel, { color: c.textMuted }]}>Handicap Trend</Text>
                  <Text style={[s.integrityFactorValue, { color: c.teal }]}>Consistent</Text>
                </View>
                <View style={s.integrityFactorRow}>
                  <Text style={[s.integrityFactorLabel, { color: c.textMuted }]}>Round Completion</Text>
                  <Text style={[s.integrityFactorValue, { color: c.teal, fontFamily: GEO }]}>98%</Text>
                </View>
              </View>

              <Text style={[s.integrityNote, { color: c.textMuted }]}>Minimum 3 rounds required</Text>
            </View>
          )}

          {/* ─── FAVORITE COURSE ───────────────────────────────────── */}
          {favoriteCourse && (
            <>
              <SectionLabel title="FAVORITE COURSE" />
              <View style={s.favCourseCard}>
                <LinearGradient
                  colors={['#1E4D2B', '#2D6A3F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.favCourseGradient}
                >
                  <Pinstripes />
                  <Ionicons name="golf" size={20} color="#D4AF37" />
                  <Text style={s.favCourseName}>{favoriteCourse}</Text>
                  <View style={s.favCourseStats}>
                    <View style={s.favCourseStat}>
                      <Text style={s.favCourseStatValue}>{FAVORITE_COURSE_STATS.bestScore}</Text>
                      <Text style={s.favCourseStatLabel}>Best Score</Text>
                    </View>
                    <View style={s.favCourseStat}>
                      <Text style={s.favCourseStatValue}>{FAVORITE_COURSE_STATS.avgScore.toFixed(1)}</Text>
                      <Text style={s.favCourseStatLabel}>Avg Score</Text>
                    </View>
                    <View style={s.favCourseStat}>
                      <Text style={s.favCourseStatValue}>{FAVORITE_COURSE_STATS.roundsPlayed}</Text>
                      <Text style={s.favCourseStatLabel}>Rounds</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </>
          )}

          {/* ─── SETTINGS ─────────────────────────────────────────── */}
          <SectionLabel title="SETTINGS" />

          {/* Dark / Light toggle */}
          <Pressable
            onPress={toggleTheme}
            style={[s.settingRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Ionicons
              name={theme.isDark ? 'moon' : 'sunny'}
              size={20}
              color={theme.isDark ? c.gold : c.teal}
            />
            <Text style={[s.settingText, { color: c.text }]}>
              {theme.isDark ? 'Dark Mode' : 'Light Mode'}
            </Text>
            <View
              style={[
                s.toggleTrack,
                {
                  backgroundColor: theme.isDark ? c.teal : c.elevated,
                  borderColor: theme.isDark ? c.teal : c.border,
                },
              ]}
            >
              <View style={[s.toggleKnob, theme.isDark && s.toggleKnobOn]} />
            </View>
          </Pressable>

          {/* Notifications toggle */}
          <Pressable
            onPress={() => setNotifications(!notifications)}
            style={[s.settingRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Ionicons
              name={notifications ? 'notifications' : 'notifications-off'}
              size={20}
              color={notifications ? c.teal : c.textMuted}
            />
            <Text style={[s.settingText, { color: c.text }]}>Notifications</Text>
            <View
              style={[
                s.toggleTrack,
                {
                  backgroundColor: notifications ? c.teal : c.elevated,
                  borderColor: notifications ? c.teal : c.border,
                },
              ]}
            >
              <View style={[s.toggleKnob, notifications && s.toggleKnobOn]} />
            </View>
          </Pressable>

          {/* Favorite Course */}
          <Pressable
            onPress={() => setShowCoursePicker(true)}
            style={[s.settingRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Ionicons name="golf" size={20} color={c.teal} />
            <View style={{ flex: 1 }}>
              <Text style={[s.settingText, { color: c.text }]}>Favorite Course</Text>
              {favoriteCourse && (
                <Text style={[s.settingSub, { color: c.textMuted }]}>{favoriteCourse}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </Pressable>

          {/* Account info */}
          <Pressable
            onPress={() => Alert.alert('Account', `Email: ${profileUser.email}\nMember since ${profileUser.memberSince}`)}
            style={[s.settingRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Ionicons name="person-outline" size={20} color={c.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[s.settingText, { color: c.text }]}>Account</Text>
              <Text style={[s.settingSub, { color: c.textMuted }]}>{profileUser.email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </Pressable>

          {/* Sign out */}
          <Pressable
            onPress={() => Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
            ])}
            style={[s.signOutBtn, { borderColor: c.urgent }]}
          >
            <Ionicons name="log-out-outline" size={18} color={c.urgent} />
            <Text style={[s.signOutText, { color: c.urgent }]}>Sign Out</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* ─── COURSE PICKER MODAL ──────────────────────────────── */}
      <Modal visible={showCoursePicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: c.cardBg }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: c.text, fontFamily: GEO }]}>Select Favorite Course</Text>
              <Pressable onPress={() => setShowCoursePicker(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </Pressable>
            </View>
            {COURSE_OPTIONS.map((course) => (
              <Pressable
                key={course}
                onPress={() => { setFavoriteCourse(course); setShowCoursePicker(false); }}
                style={[s.modalRow, { borderColor: c.border, backgroundColor: favoriteCourse === course ? c.teal + '12' : 'transparent' }]}
              >
                <Ionicons name="golf" size={18} color={favoriteCourse === course ? c.teal : c.textMuted} />
                <Text style={[s.modalRowText, { color: favoriteCourse === course ? c.teal : c.text }]}>{course}</Text>
                {favoriteCourse === course && <Ionicons name="checkmark" size={18} color={c.teal} />}
              </Pressable>
            ))}
            {favoriteCourse && (
              <Pressable
                onPress={() => { setFavoriteCourse(null); setShowCoursePicker(false); }}
                style={[s.modalClearBtn, { borderColor: c.urgent }]}
              >
                <Text style={[s.modalClearText, { color: c.urgent }]}>Clear Favorite</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H + 4,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brand: {
    fontSize: 9,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 3,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    backgroundColor: '#2A9D8F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: '700' },
  handicapRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  handicapLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  handicapValue: { fontSize: 24, fontWeight: '800' },
  location: { fontSize: 13, marginTop: 4 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 10,
    marginTop: 16,
  },
  editBtnText: { fontSize: 13, fontWeight: '600' },

  /* Body */
  body: { paddingHorizontal: 16 },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },

  /* Stats grid */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 4, textAlign: 'center' },
  statSub: { fontSize: 8, marginTop: 2, textAlign: 'center' },

  /* Handicap chart */
  chartCard: {
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  chartCurrentLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  chartCurrentValue: { fontSize: 28, fontWeight: '800', marginTop: 2 },
  chartTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chartTrendText: { fontSize: 11, fontWeight: '600' },
  chartWrap: { alignItems: 'center' },

  /* Recent rounds */
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  roundScoreWrap: { alignItems: 'center', width: 44 },
  roundScore: { fontSize: 22, fontWeight: '700' },
  roundToPar: { fontSize: 11, fontWeight: '700', marginTop: -2 },
  roundCourse: { fontSize: 13, fontWeight: '600' },
  roundMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  roundDate: { fontSize: 11 },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2 },
  sourceBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  roundPar: { fontSize: 11, fontWeight: '600' },

  /* Settings */
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  settingText: { fontSize: 14, fontWeight: '600', flex: 1 },
  settingSub: { fontSize: 11, marginTop: 2 },
  toggleTrack: {
    width: 44,
    height: 24,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: 18,
    height: 18,
    backgroundColor: '#fff',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 12,
  },
  signOutText: { fontSize: 14, fontWeight: '700' },

  /* Integrity Monitor */
  integrityHeader: { marginTop: 20, marginBottom: 0 },
  integrityHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    overflow: 'hidden',
  },
  integrityHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  integrityBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    padding: 14,
    gap: 12,
  },
  integrityScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  integrityScoreLabel: { fontSize: 13, fontWeight: '600' },
  integrityScoreValue: { fontSize: 28, fontWeight: '800' },
  integrityBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  integrityBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  integrityBar: { height: 8, overflow: 'hidden' },
  integrityBarFill: { height: '100%' },
  integrityFactors: { gap: 8 },
  integrityFactorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  integrityFactorLabel: { fontSize: 13 },
  integrityFactorValue: { fontSize: 13, fontWeight: '700' },
  integrityNote: { fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },

  /* Favorite Course hero card */
  favCourseCard: { overflow: 'hidden' },
  favCourseGradient: { padding: 16, gap: 8, overflow: 'hidden' },
  favCourseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: GEO,
  },
  favCourseStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  favCourseStat: { alignItems: 'center' },
  favCourseStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#D4AF37',
    fontFamily: GEO,
  },
  favCourseStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF88',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  /* Course picker modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
  },
  modalRowText: { flex: 1, fontSize: 15, fontWeight: '500' },
  modalClearBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
  },
  modalClearText: { fontSize: 14, fontWeight: '700' },

  /* Demo toggle */
  demoToggleWrap: {
    alignItems: 'center',
    marginTop: 16,
  },
  demoToggle: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
