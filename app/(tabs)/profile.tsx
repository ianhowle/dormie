import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO } from '../../src/theme/fonts';
import { Avatar } from '../../src/components/Avatar';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Mock data ───────────────────────────────────────────────────────
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

  const [notifications, setNotifications] = useState(true);

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
          <Text style={[s.brand, { color: c.gold, fontFamily: GEO }]}>DORMIE</Text>

          <View style={s.profileRow}>
            <Avatar id={MOCK_USER.id} size={80} name={MOCK_USER.name} />
            <View style={s.profileInfo}>
              <Text style={[s.profileName, { color: c.text, fontFamily: GEO }]}>
                {MOCK_USER.name}
              </Text>
              <View style={s.handicapRow}>
                <Text style={[s.handicapLabel, { color: c.textMuted }]}>HCP INDEX</Text>
                <Text style={[s.handicapValue, { color: c.teal, fontFamily: GEO }]}>
                  {MOCK_USER.handicap.toFixed(1)}
                </Text>
              </View>
              <Text style={[s.location, { color: c.textMuted }]}>
                {MOCK_USER.city}, {MOCK_USER.state}
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
                {MOCK_STATS.totalRounds}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Total Rounds</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.teal, fontFamily: GEO }]}>
                {MOCK_STATS.coursesPlayed}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Courses Played</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.gold, fontFamily: GEO }]}>
                {MOCK_STATS.bestRound.score}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Best Round</Text>
              <Text style={[s.statSub, { color: c.textMuted }]} numberOfLines={1}>
                {MOCK_STATS.bestRound.course}
              </Text>
            </View>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.teal, fontFamily: GEO }]}>
                {MOCK_STATS.scoringAvg.toFixed(1)}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Scoring Average</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.gold, fontFamily: GEO }]}>
                {MOCK_STATS.courseRecords}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Course Records</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Text style={[s.statValue, { color: c.teal, fontFamily: GEO }]}>
                {MOCK_STATS.tripsPlayed}
              </Text>
              <Text style={[s.statLabel, { color: c.textMuted }]}>Trips Played</Text>
            </View>
          </View>

          {/* ─── HANDICAP TREND ───────────────────────────────────── */}
          <SectionLabel title="HANDICAP TREND" />
          <View style={[s.chartCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={s.chartHeader}>
              <View>
                <Text style={[s.chartCurrentLabel, { color: c.textMuted }]}>Current</Text>
                <Text style={[s.chartCurrentValue, { color: c.teal, fontFamily: GEO }]}>
                  {HANDICAP_TREND[HANDICAP_TREND.length - 1].toFixed(1)}
                </Text>
              </View>
              <View style={s.chartTrendBadge}>
                <Ionicons
                  name="trending-down"
                  size={14}
                  color={c.teal}
                />
                <Text style={[s.chartTrendText, { color: c.teal }]}>
                  {(HANDICAP_TREND[0] - HANDICAP_TREND[HANDICAP_TREND.length - 1]).toFixed(1)} improvement
                </Text>
              </View>
            </View>
            <View style={s.chartWrap}>
              <HandicapChart data={HANDICAP_TREND} />
            </View>
          </View>

          {/* ─── RECENT ROUNDS ────────────────────────────────────── */}
          <SectionLabel title="RECENT ROUNDS" />
          {MOCK_RECENT_ROUNDS.map((round) => {
            const badge = sourceBadge(round.source);
            return (
              <View
                key={round.id}
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
                <Text style={[s.roundPar, { color: c.textMuted }]}>Par {round.par}</Text>
              </View>
            );
          })}

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

          {/* Account info */}
          <Pressable
            onPress={() => Alert.alert('Account', `Email: ${MOCK_USER.email}\nMember since ${MOCK_USER.memberSince}`)}
            style={[s.settingRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Ionicons name="person-outline" size={20} color={c.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[s.settingText, { color: c.text }]}>Account</Text>
              <Text style={[s.settingSub, { color: c.textMuted }]}>{MOCK_USER.email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </Pressable>

          {/* Sign out */}
          <Pressable
            onPress={() => Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive' },
            ])}
            style={[s.signOutBtn, { borderColor: c.urgent }]}
          >
            <Ionicons name="log-out-outline" size={18} color={c.urgent} />
            <Text style={[s.signOutText, { color: c.urgent }]}>Sign Out</Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H + 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  brand: {
    fontSize: 9,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 3,
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
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
});
