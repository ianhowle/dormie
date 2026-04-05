import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuth } from '../../src/lib/auth';
import { GEO } from '../../src/theme/fonts';
import { Avatar } from '../../src/components/Avatar';
import { roundsService } from '../../src/services/rounds.service';
import type { RoundWithCourse } from '../../src/lib/database.types';
import { scoreColor, formatToPar as formatToParUtil, toParColor as toParColorUtil } from '../../src/lib/scoring-utils';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../../src/theme/colors';
import GoldDivider from '../../src/components/GoldDivider';
import { haptics } from '../../src/lib/haptics';
import { isSoundEnabled, setSoundEnabled } from '../../src/lib/sounds';
import { useToast } from '../../src/components/Toast';
import { DataFreshness } from '../../src/components/DataFreshness';
import { ProfileStatsEmpty, HandicapGraphEmpty } from '../../src/components/EmptyStates';
import { CourseImage } from '../../src/components/CourseImage';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

type RecentRound = {
  id: string;
  course: string;
  score: number;
  par: number;
  date: string;
  source: 'manual' | 'ghin' | 'app';
};

// Handicap trend is now computed from real rounds below

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
    <Text style={[s.sectionLabel, { color: theme.colors.gold }]}>{title}</Text>
  );
}

// ─── Handicap Chart ──────────────────────────────────────────────────
function HandicapChart({ data }: { data: number[] }) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (data.length === 0) return null;

  const W = 320;
  const H = 120;
  const PAD_X = 30;
  const PAD_Y = 16;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  const minVal = data.length > 0 ? Math.floor(Math.min(...data) - 0.5) : 0;
  const maxVal = data.length > 0 ? Math.ceil(Math.max(...data) + 0.5) : 1;
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
  const isDark = theme.isDark;
  const c = theme.colors;
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [showIntegrity, setShowIntegrity] = useState(false);
  const [showDemoData, setShowDemoData] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [favoriteCourse, setFavoriteCourse] = useState<string | null>(
    user?.user_metadata?.home_course_name ?? user?.user_metadata?.home_course ?? null
  );

  const FAVORITE_COURSE_STATS = { bestScore: 71, avgScore: 75.2, roundsPlayed: 12 };

  const cardShadow = isDark ? cardShadowDark : cardShadowLight;

  const profileUser = useMemo(() => {
    return {
      id: user?.id ?? '',
      name: user?.user_metadata?.name ?? 'Golfer',
      email: user?.email ?? '',
      handicap: user?.user_metadata?.handicap_index ?? 0,
      city: user?.user_metadata?.city ?? '',
      state: user?.user_metadata?.state ?? '',
      memberSince: user ? new Date(user.created_at).getFullYear().toString() : '',
    };
  }, [user]);

  const [realRounds, setRealRounds] = useState<RoundWithCourse[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);

  const fetchRounds = useCallback(() => {
    if (!user) return Promise.resolve();
    setLoadingRounds(true);
    return roundsService.getByUser(user.id, 20)
      .then((rounds) => {
        setRealRounds(rounds);
        setLastUpdated(new Date());
      })
      .catch(() => {})
      .finally(() => setLoadingRounds(false));
  }, [user]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRounds();
    setRefreshing(false);
    showToast({ message: 'Profile updated', type: 'success' });
  }, [fetchRounds, showToast]);

  // Compute real stats from rounds
  const realStats = useMemo(() => {
    if (realRounds.length === 0) return null;
    const totalRounds = realRounds.length;
    const courseSet = new Set(realRounds.map(r => r.course_id));
    const coursesPlayed = courseSet.size;
    const scores = realRounds.map(r => r.gross_score);
    if (scores.length === 0) return null;
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

  const displayStats = realStats ?? EMPTY_STATS;

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
    return [];
  }, [realRounds]);

  // Build handicap trend from real rounds using proper differential calculation
  const displayHandicapTrend = useMemo(() => {
    if (realRounds.length < 3) return [];
    // Reverse to chronological order (oldest first) for running calculation
    const chronological = [...realRounds].reverse();
    const trend: number[] = [];
    for (let i = 2; i < chronological.length; i++) {
      // Use rounds 0..i to compute running handicap at point i
      const window = chronological.slice(Math.max(0, i - 19), i + 1);
      const diffs = window.map(r => {
        const rating = (r.course as any)?.rating ?? (r.course?.par ?? 72);
        const slope = (r.course as any)?.slope ?? 113;
        return ((r.gross_score - rating) * 113) / slope;
      }).sort((a, b) => a - b);
      const best = diffs.slice(0, Math.min(8, Math.ceil(diffs.length * 0.4)));
      const avg = best.reduce((a, b) => a + b, 0) / best.length;
      trend.push(Math.round(avg * 0.96 * 10) / 10);
    }
    return trend;
  }, [realRounds]);

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

  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const profileHeaderHeight = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [200, 70],
    extrapolate: 'clamp',
  });
  const profileHeroOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      <Animated.ScrollView
        bounces={true}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.teal}
            colors={[c.teal]}
          />
        }
      >
        {/* ─── GREEN GRADIENT HEADER (parallax) ──────────────────── */}
        <Animated.View style={{ minHeight: profileHeaderHeight, overflow: 'hidden' }}>
          <LinearGradient
            colors={greenHeaderGradient as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.header, { paddingTop: insets.top + 4 }]}
          >
            <Pinstripes />

            <View style={s.brandRow}>
              <Text style={[s.brand, { color: c.gold, fontFamily: GEO }]}>DORMIE</Text>
              <Pressable
                onPress={() => router.push('/settings')}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
              >
                <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>

            <Animated.View style={[s.profileRow, { opacity: profileHeroOpacity }]}>
              <View style={{ position: 'relative' }}>
                <Avatar id={profileUser.id} size={80} name={profileUser.name} accessibilityLabel={`${profileUser.name} profile photo`} />
                <Pressable
                  style={s.avatarEditBtn}
                  onPress={() => {
                    haptics.light();
                    router.push('/avatar-picker');
                  }}
                >
                  <Ionicons name="create-outline" size={12} color="#fff" />
                </Pressable>
              </View>
              <View style={s.profileInfo}>
                <Text style={[s.profileName, { color: '#fff', fontFamily: GEO }]}>
                  {profileUser.name}
                </Text>
                <View style={s.handicapRow}>
                  <Text style={[s.handicapLabel, { color: 'rgba(255,255,255,0.5)' }]}>HCP</Text>
                  <Text style={[s.handicapValue, { color: c.teal, fontFamily: GEO }]}>
                    {profileUser.handicap.toFixed(1)}
                  </Text>
                  <Text style={[s.handicapLabel, { color: 'rgba(255,255,255,0.5)', marginLeft: 10 }]}>NET</Text>
                  <Text style={[s.handicapValue, {
                    color: typeof displayStats.scoringAvg === 'number'
                      ? ((displayStats.scoringAvg - (displayStats.bestRound.par ?? 72) - profileUser.handicap) < 0 ? c.teal : (displayStats.scoringAvg - (displayStats.bestRound.par ?? 72) - profileUser.handicap) > 0 ? c.urgent : '#E8E4DE')
                      : 'rgba(255,255,255,0.5)',
                    fontFamily: GEO,
                  }]}>
                    {typeof displayStats.scoringAvg === 'number'
                      ? ((val: number) => val === 0 ? 'E' : val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1))(displayStats.scoringAvg - 72 - profileUser.handicap)
                      : '--'}
                  </Text>
                </View>
                <Text style={[s.location, { color: 'rgba(255,255,255,0.5)' }]}>
                  {profileUser.city}, {profileUser.state}
                </Text>
              </View>
            </Animated.View>

            <Pressable
              onPress={() => { haptics.light(); router.push('/edit-profile'); }}
              style={({ pressed }) => [s.editBtn, { borderColor: 'rgba(201,162,39,0.4)', opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <Ionicons name="pencil-outline" size={14} color={c.gold} />
              <Text style={[s.editBtnText, { color: c.gold }]}>Edit Profile</Text>
            </Pressable>

            <GoldDivider style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
          </LinearGradient>
        </Animated.View>

        {/* Home course photo banner */}
        {favoriteCourse && (
          <CourseImage
            courseName={favoriteCourse}
            height={120}
            style={{ width: '100%' }}
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 10, paddingTop: 24 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', fontFamily: GEO }}>{favoriteCourse}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>Home Course</Text>
            </LinearGradient>
          </CourseImage>
        )}

        <View style={s.body}>
          {/* ─── STATS GRID ──────────────────────────────────────── */}
          <SectionLabel title="STATS" />
          <DataFreshness updatedAt={lastUpdated} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {[
              { value: displayStats.totalRounds, label: 'RNDS', color: c.teal },
              { value: displayStats.coursesPlayed, label: 'COURSES', color: c.teal },
              { value: displayStats.bestRound.score, label: 'BEST', color: c.gold },
              { value: typeof displayStats.scoringAvg === 'number' ? displayStats.scoringAvg.toFixed(1) : displayStats.scoringAvg, label: 'AVG', color: c.teal },
              { value: profileUser.handicap.toFixed(1), label: 'HCP', color: c.teal },
              { value: displayStats.courseRecords, label: 'RECORDS', color: c.gold },
            ].map((stat) => (
              <Pressable
                key={stat.label}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 4,
                    backgroundColor: c.cardBg,
                    borderWidth: 1,
                    borderColor: c.border,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    ...(isDark ? cardShadowDark : cardShadowLight),
                  },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                ]}
                accessibilityLabel={`${stat.label}: ${stat.value}`}
              >
                <Text style={{ color: stat.color, fontSize: 18, fontWeight: '700', fontFamily: GEO, letterSpacing: -0.5 }}>
                  {stat.value}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>
                  {stat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Profile stats empty state with shimmer */}
          {!realStats && !showDemoData && (
            <View style={{ marginTop: 16 }}>
              <ProfileStatsEmpty />
            </View>
          )}

          {/* Demo data toggle for new users */}
          {!realStats && !showDemoData && (
            <Pressable
              onPress={() => setShowDemoData(true)}
              style={({ pressed }) => [s.demoToggleWrap, { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <Text style={[s.demoToggle, { color: c.teal }]}>Show demo data</Text>
            </Pressable>
          )}

          <GoldDivider style={{ marginTop: 24 }} />

          {/* ─── HANDICAP TREND (empty state when < 3 rounds) ─── */}
          {displayHandicapTrend.length === 0 && (
            <>
              <SectionLabel title="HANDICAP TREND" />
              <HandicapGraphEmpty />
              <GoldDivider style={{ marginTop: 12 }} />
            </>
          )}

          {/* ─── HANDICAP TREND ───────────────────────────────────── */}
          {displayHandicapTrend.length > 0 && (
            <>
              <SectionLabel title="HANDICAP TREND" />
              <View style={[s.chartCard, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, ...cardShadow }]}>
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
                    <Text style={[s.chartTrendText, { color: c.teal, fontFamily: GEO }]}>
                      {((displayHandicapTrend[0] ?? 0) - (displayHandicapTrend[displayHandicapTrend.length - 1] ?? 0)).toFixed(1)} improvement
                    </Text>
                  </View>
                </View>
                <View style={s.chartWrap}>
                  <HandicapChart data={displayHandicapTrend} />
                </View>
              </View>
              <GoldDivider style={{ marginTop: 24 }} />
            </>
          )}

          {/* ─── RECENT ROUNDS ────────────────────────────────────── */}
          {displayRounds.length > 0 && <SectionLabel title="RECENT ROUNDS" />}
          {displayRounds.length === 0 && !loadingRounds && (
            <View style={[s.emptyState, { borderColor: c.border }]}>
              <Text style={s.emptyEmoji}>⛳</Text>
              <Text style={[s.emptyTitle, { color: c.text, fontFamily: GEO }]}>Your scorecard awaits</Text>
              <Text style={[s.emptyDesc, { color: c.textMuted }]}>Every great golfer started with Round 1</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/score')}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
              >
                <Text style={[s.emptyCta, { color: c.teal }]}>Score a Round</Text>
              </Pressable>
            </View>
          )}
          {displayRounds.map((round) => {
            const badge = sourceBadge(round.source);
            return (
              <Pressable
                key={round.id}
                onPress={() => router.push({
                  pathname: '/round-detail',
                  params: { roundId: round.id, course: round.course, score: String(round.score), par: String(round.par), date: round.date, source: round.source },
                })}
                style={({ pressed }) => [s.roundRow, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, ...cardShadow, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                accessibilityLabel={`${round.course}, score ${round.score}, ${round.date}`}
                accessibilityHint="Swipe right to share"
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

          {displayRounds.length > 0 && <GoldDivider style={{ marginTop: 18 }} />}

          {/* ─── HANDICAP INTEGRITY MONITOR ─────────────────────── */}
          <Pressable
            onPress={() => setShowIntegrity(!showIntegrity)}
            style={({ pressed }) => [s.integrityHeader, { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <LinearGradient
              colors={greenHeaderGradient as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.integrityHeaderGradient}
            >
              <Pinstripes />
              <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
              <Text style={s.integrityHeaderText}>Handicap Integrity Monitor</Text>
              <Ionicons name={showIntegrity ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </Pressable>
          <GoldDivider />

          {showIntegrity && (
            <View style={[s.integrityBody, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, borderTopWidth: 0, ...cardShadow }]}>
              {/* Fair Play Score */}
              <View style={s.integrityScoreRow}>
                <Text style={[s.integrityScoreLabel, { color: c.textMuted }]}>Fair Play Score</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={[s.integrityScoreValue, { color: c.teal, fontFamily: GEO }]}>92</Text>
                  <View style={[s.integrityBadge, { backgroundColor: '#00674722' }]}>
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
              <View style={[s.favCourseCard, { ...cardShadow }]}>
                <LinearGradient
                  colors={greenHeaderGradient as unknown as string[]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.favCourseGradient}
                >
                  <Pinstripes />
                  <Ionicons name="golf" size={20} color="#C9A227" />
                  <Text style={s.favCourseName}>{favoriteCourse}</Text>
                  <View style={s.favCourseStats}>
                    <View style={s.favCourseStat}>
                      <Text style={s.favCourseStatValue}>{FAVORITE_COURSE_STATS.bestScore}</Text>
                      <Text style={s.favCourseStatLabel}>Course Record</Text>
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
              <GoldDivider style={{ marginTop: 24 }} />
            </>
          )}

          {/* ─── SETTINGS ─────────────────────────────────────────── */}
          <SectionLabel title="SETTINGS" />

          {/* Dark / Light toggle */}
          <Pressable
            onPress={() => { haptics.light(); toggleTheme(); }}
            style={({ pressed }) => [s.settingRow, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, ...cardShadow, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            accessibilityLabel={isDark ? 'Dark Mode' : 'Light Mode'}
            accessibilityRole="switch"
            accessibilityState={{ checked: isDark }}
          >
            <Ionicons
              name={isDark ? 'moon' : 'sunny'}
              size={20}
              color={isDark ? c.gold : c.teal}
            />
            <Text style={[s.settingText, { color: c.text }]}>
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </Text>
            <View
              style={[
                s.toggleTrack,
                {
                  backgroundColor: isDark ? '#1E4D2B' : c.elevated,
                  borderColor: isDark ? '#1E4D2B' : c.border,
                },
              ]}
            >
              <View style={[s.toggleKnob, isDark && s.toggleKnobOn]} />
            </View>
          </Pressable>

          {/* Notifications toggle */}
          <Pressable
            onPress={() => { haptics.light(); setNotifications(!notifications); }}
            style={({ pressed }) => [s.settingRow, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, ...cardShadow, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            accessibilityLabel="Notifications"
            accessibilityRole="switch"
            accessibilityState={{ checked: notifications }}
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
                  backgroundColor: notifications ? '#1E4D2B' : c.elevated,
                  borderColor: notifications ? '#1E4D2B' : c.border,
                },
              ]}
            >
              <View style={[s.toggleKnob, notifications && s.toggleKnobOn]} />
            </View>
          </Pressable>

          {/* Sound Effects toggle */}
          <Pressable
            onPress={() => {
              haptics.light();
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
            }}
            style={({ pressed }) => [s.settingRow, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, ...cardShadow, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            accessibilityLabel="Sound Effects"
            accessibilityRole="switch"
            accessibilityState={{ checked: soundOn }}
          >
            <Ionicons name={soundOn ? 'volume-high' : 'volume-mute'} size={20} color={soundOn ? c.teal : c.textMuted} />
            <Text style={[s.settingText, { color: c.text }]}>Sound Effects</Text>
            <View style={[s.toggleTrack, { backgroundColor: soundOn ? '#1E4D2B' : c.elevated, borderColor: soundOn ? '#1E4D2B' : c.border }]}>
              <View style={[s.toggleKnob, soundOn && s.toggleKnobOn]} />
            </View>
          </Pressable>

          {/* Favorite Course */}
          <Pressable
            onPress={() => { haptics.light(); router.push('/course-search'); }}
            style={({ pressed }) => [s.settingRow, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, ...cardShadow, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            accessibilityLabel={`Favorite Course${favoriteCourse ? `: ${favoriteCourse}` : ''}`}
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
            onPress={() => { haptics.light(); Alert.alert('Account', `Email: ${profileUser.email}\nMember since ${profileUser.memberSince}`); }}
            style={({ pressed }) => [s.settingRow, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border, ...cardShadow, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            accessibilityLabel={`Account: ${profileUser.email}`}
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
            onPress={() => {
              haptics.medium();
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
              ]);
            }}
            style={({ pressed }) => [s.signOutBtn, { borderColor: c.urgent, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Ionicons name="log-out-outline" size={18} color={c.urgent} />
            <Text style={[s.signOutText, { color: c.urgent }]}>Sign Out</Text>
          </Pressable>

          <View style={{ height: 40 + insets.bottom }} />
        </View>
      </Animated.ScrollView>

      {/* Course picker now uses the /course-search screen */}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
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
    backgroundColor: '#006747',
    borderRadius: 12,
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
  handicapLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  handicapValue: { fontSize: 28, fontWeight: '700', letterSpacing: -1 },
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
  body: { paddingHorizontal: 20 },

  /* Section label */
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
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
  },
  statValue: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 4, textAlign: 'center' },
  statSub: { fontSize: 10, marginTop: 2, textAlign: 'center' },

  /* Handicap chart */
  chartCard: {
    padding: 16,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  chartCurrentLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  chartCurrentValue: { fontSize: 28, fontWeight: '700', marginTop: 2, letterSpacing: -1 },
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  roundScoreWrap: { alignItems: 'center', width: 44 },
  roundScore: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  roundToPar: { fontSize: 11, fontWeight: '700', marginTop: -2 },
  roundCourse: { fontSize: 13, fontWeight: '600' },
  roundMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  roundDate: { fontSize: 10 },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2 },
  sourceBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  roundPar: { fontSize: 11, fontWeight: '600' },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  emptyEmoji: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  emptyDesc: { fontSize: 12, textAlign: 'center', marginBottom: 12 },
  emptyCta: { fontSize: 13, fontWeight: '700' },

  /* Settings */
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  settingText: { fontSize: 13, fontWeight: '600', flex: 1 },
  settingSub: { fontSize: 10, marginTop: 2 },
  toggleTrack: {
    width: 44,
    height: 24,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: 18,
    height: 18,
    backgroundColor: '#fff',
    borderRadius: 8,
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
  integrityHeader: { marginTop: 24, marginBottom: 0 },
  integrityHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  integrityHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  integrityBody: {
    padding: 16,
    gap: 12,
  },
  integrityScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  integrityScoreLabel: { fontSize: 13, fontWeight: '600' },
  integrityScoreValue: { fontSize: 28, fontWeight: '700', letterSpacing: -1 },
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
  integrityNote: { fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },

  /* Favorite Course hero card */
  favCourseCard: { overflow: 'hidden' },
  favCourseGradient: { paddingVertical: 20, paddingHorizontal: 20, gap: 8, overflow: 'hidden' },
  favCourseName: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: GEO,
  },
  favCourseStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  favCourseStat: { alignItems: 'center' },
  favCourseStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#C9A227',
    fontFamily: GEO,
    letterSpacing: -0.5,
  },
  favCourseStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    marginTop: 2,
    textTransform: 'uppercase',
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
    paddingHorizontal: 20,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  modalRowText: { flex: 1, fontSize: 13, fontWeight: '500' },
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
    fontSize: 13,
    fontWeight: '700',
  },
});
