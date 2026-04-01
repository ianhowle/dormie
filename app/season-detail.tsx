import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  Platform,
  StatusBar,
  Animated,
  Modal,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import GoldDivider from '../src/components/GoldDivider';
import { useAuth } from '../src/lib/auth';
import { seasonsService } from '../src/services/seasons.service';
import { haptics } from '../src/lib/haptics';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;
const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────
type Standing = {
  playerId: string;
  name: string;
  handicap: number;
  avatarColor: string;
  points: number;
  weekResults: (number | null)[];
  wins: number;
  topFives: number;
  eventsPlayed: number;
  bestFinish: number;
  worstDrop: number | null;
  isCut: boolean;
};

type Week = {
  number: number;
  format: string;
  isPlayoff: boolean;
  isChampionship: boolean;
  isMajor: boolean;
  majorName: string | null;
  multiplier: number;
  completed: boolean;
  allScoresSubmitted: boolean;
};

type BonusChallenge = {
  id: string;
  label: string;
  description: string;
  leader: string;
  value: string;
};

// ─── Mock data ────────────────────────────────────────────────────────
const MOCK_WEEKS: Week[] = Array.from({ length: 10 }, (_, i) => ({
  number: i + 1,
  format: ['stableford', 'modified_stableford', 'stroke_net', 'quota', 'best9'][i % 5],
  isPlayoff: i >= 8,
  isChampionship: i === 9,
  isMajor: i === 3 || i === 7,
  majorName: i === 3 ? 'The Dormie Invitational' : i === 7 ? 'The Dormie Championship' : null,
  multiplier: i === 9 ? 3 : i >= 8 ? 2 : i === 3 || i === 7 ? 2 : 1,
  completed: i < 6,
  allScoresSubmitted: i < 6,
}));

const POINTS_TABLE = [15, 12, 10, 8, 6, 5, 4, 3, 2, 1];

const MOCK_STANDINGS: Standing[] = [
  { playerId: '1', name: 'Ian McGowan', handicap: 8, avatarColor: '#2A9D8F', points: 72, weekResults: [15, 10, 12, 15, 8, 12, null, null, null, null], wins: 2, topFives: 5, eventsPlayed: 6, bestFinish: 1, worstDrop: 8, isCut: false },
  { playerId: '2', name: 'Drew Patterson', handicap: 12, avatarColor: '#D4AF37', points: 65, weekResults: [12, 15, 8, 10, 12, 8, null, null, null, null], wins: 1, topFives: 4, eventsPlayed: 6, bestFinish: 1, worstDrop: 8, isCut: false },
  { playerId: '3', name: 'Jake Sullivan', handicap: 15, avatarColor: '#C44B4F', points: 55, weekResults: [10, 8, 15, 6, 10, 6, null, null, null, null], wins: 1, topFives: 3, eventsPlayed: 6, bestFinish: 1, worstDrop: 6, isCut: false },
  { playerId: '4', name: 'Tommy Fleetwood', handicap: 3, avatarColor: '#6B8E23', points: 48, weekResults: [8, 12, 6, 12, 6, 4, null, null, null, null], wins: 0, topFives: 2, eventsPlayed: 6, bestFinish: 2, worstDrop: 4, isCut: false },
  { playerId: '5', name: 'Mike Chen', handicap: 18, avatarColor: '#8B4513', points: 42, weekResults: [6, 6, 10, 8, 4, 8, null, null, null, null], wins: 0, topFives: 1, eventsPlayed: 6, bestFinish: 3, worstDrop: 4, isCut: false },
  { playerId: '6', name: 'Sam Rodriguez', handicap: 22, avatarColor: '#4682B4', points: 32, weekResults: [5, 4, 4, 5, 5, 10, null, null, null, null], wins: 0, topFives: 0, eventsPlayed: 6, bestFinish: 3, worstDrop: null, isCut: true },
  { playerId: '7', name: 'Will Harrison', handicap: 25, avatarColor: '#9370DB', points: 24, weekResults: [4, 5, 3, 4, 3, 5, null, null, null, null], wins: 0, topFives: 0, eventsPlayed: 6, bestFinish: 4, worstDrop: null, isCut: true },
  { playerId: '8', name: 'Chris Lee', handicap: 28, avatarColor: '#20B2AA', points: 18, weekResults: [3, 3, 5, 3, 2, 2, null, null, null, null], wins: 0, topFives: 0, eventsPlayed: 6, bestFinish: 5, worstDrop: null, isCut: true },
];

const MOCK_CHALLENGES: BonusChallenge[] = [
  { id: 'b1', label: 'Low Round', description: 'Lowest single-round gross score', leader: 'Ian McGowan', value: '74' },
  { id: 'b2', label: 'Most Birdies', description: 'Total birdies across all rounds', leader: 'Tommy Fleetwood', value: '18' },
  { id: 'b3', label: 'Iron Man', description: 'Most consecutive weeks played', leader: 'Drew Patterson', value: '6' },
  { id: 'b4', label: 'Comeback Kid', description: 'Biggest position gain in a single week', leader: 'Sam Rodriguez', value: '+4' },
];

const MOCK_CAREER_STATS: Record<string, { seasonsPlayed: number; championships: number; playoffApps: number; bestFinish: number; avgRank: number; careerPoints: number }> = {
  '1': { seasonsPlayed: 4, championships: 1, playoffApps: 3, bestFinish: 1, avgRank: 2.1, careerPoints: 312 },
  '2': { seasonsPlayed: 4, championships: 1, playoffApps: 3, bestFinish: 1, avgRank: 2.8, careerPoints: 285 },
  '3': { seasonsPlayed: 3, championships: 0, playoffApps: 2, bestFinish: 1, avgRank: 3.5, careerPoints: 198 },
  '4': { seasonsPlayed: 4, championships: 0, playoffApps: 1, bestFinish: 2, avgRank: 4.2, careerPoints: 176 },
  '5': { seasonsPlayed: 2, championships: 0, playoffApps: 0, bestFinish: 3, avgRank: 5.0, careerPoints: 84 },
};

const CUT_PERCENTAGE = 0.67;
const FORMAT_LABELS: Record<string, string> = {
  stableford: 'Stableford',
  modified_stableford: 'Mod. Stableford',
  stroke_net: 'Stroke (Net)',
  quota: 'Quota',
  best9: 'Best 9',
};

// ─── Helpers ──────────────────────────────────────────────────────────
function getWeekBadge(w: Week) {
  if (w.isChampionship) return { label: 'CHAMPIONSHIP', color: '#D4AF37' };
  if (w.isPlayoff) return { label: 'PLAYOFF', color: '#C44B4F' };
  if (w.isMajor) return { label: 'MAJOR', color: '#D4AF37' };
  return null;
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────
type Tab = 'standings' | 'schedule' | 'challenges';

function TabBar({ tab, onSelect, colors: c }: { tab: Tab; onSelect: (t: Tab) => void; colors: any }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'standings', label: 'Standings' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'challenges', label: 'Bonus' },
  ];
  return (
    <View style={[styles.tabBar, { borderBottomColor: c.border }]}>
      {tabs.map((t) => {
        const active = t.key === tab;
        return (
          <Pressable key={t.key} onPress={() => { haptics.light(); onSelect(t.key); }} style={styles.tabItem}>
            <Text style={[styles.tabLabel, { color: active ? c.gold : c.textMuted, fontFamily: GEO }]}>
              {t.label}
            </Text>
            {active && <View style={[styles.tabIndicator, { backgroundColor: c.gold }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Champion Ceremony Overlay ────────────────────────────────────────
function ChampionCeremony({
  visible,
  champion,
  topThree,
  onDismiss,
}: {
  visible: boolean;
  champion: Standing | null;
  topThree: Standing[];
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const show = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  if (!visible || !champion) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onShow={show}>
      <View style={styles.ceremonyOverlay}>
        <Animated.View style={[styles.ceremonyContent, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.cornerTL, { borderColor: '#D4AF37' }]} />
          <View style={[styles.cornerTR, { borderColor: '#D4AF37' }]} />
          <View style={[styles.cornerBL, { borderColor: '#D4AF37' }]} />
          <View style={[styles.cornerBR, { borderColor: '#D4AF37' }]} />

          <Text style={styles.ceremonyTrophy}>🏆</Text>
          <Text style={[styles.ceremonyLabel, { color: '#D4AF37' }]}>CHAMPION</Text>
          <GoldDivider style={{ marginVertical: 12 }} />
          <Text style={[styles.ceremonyName, { color: '#FFFFFF' }]}>{champion.name}</Text>
          <Text style={[styles.ceremonyPoints, { color: '#D4AF37' }]}>{champion.points} points</Text>
          <View style={styles.ceremonyStats}>
            <View style={styles.ceremonyStat}>
              <Text style={[styles.ceremonyStatVal, { color: '#FFFFFF' }]}>{champion.wins}</Text>
              <Text style={[styles.ceremonyStatLabel, { color: c.textMuted }]}>Wins</Text>
            </View>
            <View style={[styles.ceremonyStatDivider, { backgroundColor: '#D4AF37' }]} />
            <View style={styles.ceremonyStat}>
              <Text style={[styles.ceremonyStatVal, { color: '#FFFFFF' }]}>{champion.topFives}</Text>
              <Text style={[styles.ceremonyStatLabel, { color: c.textMuted }]}>Top 5s</Text>
            </View>
            <View style={[styles.ceremonyStatDivider, { backgroundColor: '#D4AF37' }]} />
            <View style={styles.ceremonyStat}>
              <Text style={[styles.ceremonyStatVal, { color: '#FFFFFF' }]}>{champion.eventsPlayed}</Text>
              <Text style={[styles.ceremonyStatLabel, { color: c.textMuted }]}>Played</Text>
            </View>
          </View>

          {/* Top 3 Final Standings */}
          <GoldDivider style={{ marginTop: 24, marginBottom: 8 }} />
          <View style={styles.ceremonyStandings}>
            <Text style={[styles.ceremonyStandingsTitle, { color: '#D4AF37' }]}>FINAL STANDINGS</Text>
            {topThree.map((p, i) => (
              <View key={p.playerId} style={styles.ceremonyStandingRow}>
                <Text style={[styles.ceremonyStandingRank, { color: i === 0 ? '#D4AF37' : '#FFFFFF', fontFamily: GEO }]}>
                  {ordinal(i + 1)}
                </Text>
                <Text style={[styles.ceremonyStandingName, { color: i === 0 ? '#D4AF37' : '#FFFFFF' }]}>
                  {p.name}
                </Text>
                <Text style={[styles.ceremonyStandingPts, { color: i === 0 ? '#D4AF37' : '#FFFFFF99', fontFamily: GEO }]}>
                  {p.points}
                </Text>
              </View>
            ))}
          </View>

          <Pressable onPress={() => { haptics.light(); onDismiss(); }} style={styles.ceremonyDismissBtn}>
            <Text style={[styles.ceremonyDismissText, { color: c.textMuted }]}>Dismiss</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Player Stats Modal ───────────────────────────────────────────────
function PlayerStatsModal({
  visible,
  player,
  weeks,
  onClose,
}: {
  visible: boolean;
  player: Standing | null;
  weeks: Week[];
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (!player) return null;

  const completedWeeks = weeks.filter((w) => w.completed);

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: c.cardBg }]}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar id={player.playerId} name={player.name} size={40} />
              <View>
                <Text style={[styles.modalPlayerName, { color: c.text }]}>{player.name}</Text>
                <Text style={[styles.modalPlayerHcp, { color: c.textMuted }]}>
                  Handicap {player.handicap}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => { haptics.light(); onClose(); }} hitSlop={12}>
              <Ionicons name="close" size={24} color={c.textMuted} />
            </Pressable>
          </View>

          <View style={[styles.statsHero, { backgroundColor: c.elevated }]}>
            <View style={styles.statsHeroItem}>
              <Text style={[styles.statsHeroVal, { color: c.gold, fontFamily: GEO }]}>{player.points}</Text>
              <Text style={[styles.statsHeroLabel, { color: c.textMuted }]}>Total Pts</Text>
            </View>
            <View style={styles.statsHeroItem}>
              <Text style={[styles.statsHeroVal, { color: c.text, fontFamily: GEO }]}>{player.wins}</Text>
              <Text style={[styles.statsHeroLabel, { color: c.textMuted }]}>Wins</Text>
            </View>
            <View style={styles.statsHeroItem}>
              <Text style={[styles.statsHeroVal, { color: c.text, fontFamily: GEO }]}>{player.topFives}</Text>
              <Text style={[styles.statsHeroLabel, { color: c.textMuted }]}>Top 5s</Text>
            </View>
            <View style={styles.statsHeroItem}>
              <Text style={[styles.statsHeroVal, { color: c.text, fontFamily: GEO }]}>{player.bestFinish}</Text>
              <Text style={[styles.statsHeroLabel, { color: c.textMuted }]}>Best</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: c.text, marginTop: 16 }]}>Week-by-Week</Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {completedWeeks.map((w, i) => {
              const pts = player.weekResults[i];
              const pos = pts !== null ? POINTS_TABLE.indexOf(pts) + 1 : null;
              const badge = getWeekBadge(w);
              return (
                <View key={w.number} style={[styles.weekRow, { borderBottomColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.weekNum, { color: c.textMuted }]}>Wk {w.number}</Text>
                      {badge && (
                        <View style={[styles.weekBadge, { backgroundColor: badge.color + '22' }]}>
                          <Text style={[styles.weekBadgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.weekFormat, { color: c.textMuted }]}>
                      {FORMAT_LABELS[w.format] ?? w.format}
                    </Text>
                  </View>
                  {pts !== null ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.weekPts, { color: c.gold, fontFamily: GEO }]}>
                        {pts}{w.multiplier > 1 ? ` (×${w.multiplier})` : ''}
                      </Text>
                      <Text style={[styles.weekPos, { color: c.textMuted }]}>
                        {pos ? ordinal(pos) : '—'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.weekDns, { color: c.textMuted }]}>DNS</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {player.worstDrop !== null && (
            <View style={[styles.dropInfo, { backgroundColor: c.elevated }]}>
              <Ionicons name="arrow-down" size={14} color={c.urgent} />
              <Text style={[styles.dropText, { color: c.textMuted }]}>
                Dropped worst week: {player.worstDrop} pts
              </Text>
            </View>
          )}

          {/* Career Stats */}
          {MOCK_CAREER_STATS[player.playerId] && (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Career Stats</Text>
              <View style={[styles.careerStatsGrid, { backgroundColor: c.elevated }]}>
                <View style={styles.careerStatItem}>
                  <Text style={[styles.careerStatVal, { color: c.text, fontFamily: GEO }]}>
                    {MOCK_CAREER_STATS[player.playerId].seasonsPlayed}
                  </Text>
                  <Text style={[styles.careerStatLabel, { color: c.textMuted }]}>Seasons Played</Text>
                </View>
                <View style={styles.careerStatItem}>
                  <Text style={[styles.careerStatVal, { color: '#D4AF37', fontFamily: GEO }]}>
                    {MOCK_CAREER_STATS[player.playerId].championships}
                  </Text>
                  <Text style={[styles.careerStatLabel, { color: c.textMuted }]}>Championships</Text>
                </View>
                <View style={styles.careerStatItem}>
                  <Text style={[styles.careerStatVal, { color: c.text, fontFamily: GEO }]}>
                    {MOCK_CAREER_STATS[player.playerId].playoffApps}
                  </Text>
                  <Text style={[styles.careerStatLabel, { color: c.textMuted }]}>Playoff Apps</Text>
                </View>
                <View style={styles.careerStatItem}>
                  <Text style={[styles.careerStatVal, { color: '#2A9D8F', fontFamily: GEO }]}>
                    {ordinal(MOCK_CAREER_STATS[player.playerId].bestFinish)}
                  </Text>
                  <Text style={[styles.careerStatLabel, { color: c.textMuted }]}>Best Finish</Text>
                </View>
                <View style={styles.careerStatItem}>
                  <Text style={[styles.careerStatVal, { color: c.text, fontFamily: GEO }]}>
                    {MOCK_CAREER_STATS[player.playerId].avgRank.toFixed(1)}
                  </Text>
                  <Text style={[styles.careerStatLabel, { color: c.textMuted }]}>Avg Rank</Text>
                </View>
                <View style={styles.careerStatItem}>
                  <Text style={[styles.careerStatVal, { color: '#D4AF37', fontFamily: GEO }]}>
                    {MOCK_CAREER_STATS[player.playerId].careerPoints}
                  </Text>
                  <Text style={[styles.careerStatLabel, { color: c.textMuted }]}>Career Points</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Standings Table ──────────────────────────────────────────────────
function StandingsTab({
  standings,
  weeks,
  cutLineIndex,
  onPlayerTap,
}: {
  standings: Standing[];
  weeks: Week[];
  cutLineIndex: number;
  onPlayerTap: (p: Standing) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const completedWeeks = weeks.filter((w) => w.completed);

  return (
    <ScrollView style={styles.standingsContainer} showsVerticalScrollIndicator={false}>
      <View style={[styles.standingsHeader, { borderBottomColor: c.border }]}>
        <Text style={[styles.shRank, { color: c.textMuted }]}>#</Text>
        <Text style={[styles.shPlayer, { color: c.textMuted }]}>Player</Text>
        {completedWeeks.map((w) => {
          const badge = getWeekBadge(w);
          return (
            <View key={w.number} style={styles.shWeek}>
              <Text style={[styles.shWeekText, { color: badge ? badge.color : c.textMuted }]}>
                {w.number}
              </Text>
            </View>
          );
        })}
        <Text style={[styles.shTotal, { color: c.gold, fontFamily: GEO }]}>PTS</Text>
      </View>

      {standings.map((p, i) => {
        const isCut = i >= cutLineIndex;
        const isAboveCut = i === cutLineIndex;

        return (
          <View key={p.playerId}>
            {isAboveCut && (
              <View style={styles.cutLine}>
                <View style={[styles.cutLineDash, { backgroundColor: c.urgent }]} />
                <Text style={[styles.cutLineText, { color: c.urgent }]}>PROJECTED CUT</Text>
                <View style={[styles.cutLineDash, { backgroundColor: c.urgent }]} />
              </View>
            )}

            <Pressable
              onPress={() => { haptics.light(); onPlayerTap(p); }}
              style={[
                styles.standingsRow,
                { borderBottomColor: c.border, opacity: isCut ? 0.45 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.srRank,
                  { color: i === 0 ? c.gold : i < 3 ? c.teal : c.textMuted, fontFamily: GEO },
                ]}
              >
                {i + 1}
              </Text>

              <View style={styles.srPlayer}>
                <Avatar id={p.playerId} name={p.name} size={28} />
                <View>
                  <Text style={[styles.srName, { color: isCut ? c.textMuted : c.text }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={[styles.srHcp, { color: c.textMuted }]}>{p.handicap} hcp</Text>
                </View>
              </View>

              {completedWeeks.map((w, wi) => {
                const pts = p.weekResults[wi];
                const isMajorWeek = w.isMajor || w.isChampionship;
                return (
                  <View key={w.number} style={[styles.srWeekCell, isMajorWeek && { backgroundColor: c.gold + '0D' }]}>
                    <Text
                      style={[
                        styles.srWeekVal,
                        { color: pts === null ? c.textMuted : pts === 15 ? c.gold : c.text, fontFamily: GEO },
                      ]}
                    >
                      {pts ?? '—'}
                    </Text>
                  </View>
                );
              })}

              <Text style={[styles.srTotal, { color: c.gold, fontFamily: GEO }]}>{p.points}</Text>
            </Pressable>
          </View>
        );
      })}

      {/* Playoff bracket */}
      {weeks.some((w) => w.isPlayoff) && (
        <PlayoffBracket standings={standings} cutLineIndex={cutLineIndex} />
      )}
    </ScrollView>
  );
}

// ─── Playoff Bracket ──────────────────────────────────────────────────
function PlayoffBracket({ standings, cutLineIndex }: { standings: Standing[]; cutLineIndex: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const qualifiers = standings.slice(0, Math.min(cutLineIndex, 4));
  const eliminated = standings.slice(cutLineIndex);

  // Derive bracket matchups from top 4 (1v4, 2v3 seeding)
  const semi1A = qualifiers[0] ?? null; // #1 seed
  const semi1B = qualifiers[3] ?? null; // #4 seed
  const semi2A = qualifiers[1] ?? null; // #2 seed
  const semi2B = qualifiers[2] ?? null; // #3 seed

  // Determine winners based on points (higher seed advances if tied)
  const semi1Winner = semi1A && semi1B ? (semi1A.points >= semi1B.points ? semi1A : semi1B) : semi1A;
  const semi2Winner = semi2A && semi2B ? (semi2A.points >= semi2B.points ? semi2A : semi2B) : semi2A;
  const champion = semi1Winner && semi2Winner ? (semi1Winner.points >= semi2Winner.points ? semi1Winner : semi2Winner) : semi1Winner;

  return (
    <View style={styles.bracketContainer}>
      <Text style={[styles.bracketTitle, { color: '#D4AF37', fontFamily: GEO }]}>PLAYOFF BRACKET</Text>

      {/* Bracket visualization */}
      <View style={styles.bracketVisual}>
        {/* Semi-Finals Column */}
        <View style={styles.bracketColumn}>
          <Text style={[styles.bracketRoundLabel, { color: c.textMuted }]}>SEMI-FINALS</Text>

          {/* Semi-Final 1: #1 vs #4 */}
          <View style={[styles.bracketMatchup, { backgroundColor: c.elevated }]}>
            {semi1A && (
              <View style={[styles.bracketMatchupRow, { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.bracketSeed, { color: '#D4AF37', fontFamily: GEO }]}>1</Text>
                <Avatar id={semi1A.playerId} name={semi1A.name} size={20} />
                <Text style={[styles.bracketName, { color: semi1Winner === semi1A ? c.text : c.textMuted }]} numberOfLines={1}>
                  {semi1A.name}
                </Text>
                <Text style={[styles.bracketPts, { color: '#D4AF37', fontFamily: GEO }]}>{semi1A.points}</Text>
              </View>
            )}
            {semi1B && (
              <View style={styles.bracketMatchupRow}>
                <Text style={[styles.bracketSeed, { color: '#D4AF37', fontFamily: GEO }]}>4</Text>
                <Avatar id={semi1B.playerId} name={semi1B.name} size={20} />
                <Text style={[styles.bracketName, { color: semi1Winner === semi1B ? c.text : c.textMuted }]} numberOfLines={1}>
                  {semi1B.name}
                </Text>
                <Text style={[styles.bracketPts, { color: '#D4AF37', fontFamily: GEO }]}>{semi1B.points}</Text>
              </View>
            )}
          </View>

          {/* Semi-Final 2: #2 vs #3 */}
          <View style={[styles.bracketMatchup, { backgroundColor: c.elevated, marginTop: 12 }]}>
            {semi2A && (
              <View style={[styles.bracketMatchupRow, { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[styles.bracketSeed, { color: '#D4AF37', fontFamily: GEO }]}>2</Text>
                <Avatar id={semi2A.playerId} name={semi2A.name} size={20} />
                <Text style={[styles.bracketName, { color: semi2Winner === semi2A ? c.text : c.textMuted }]} numberOfLines={1}>
                  {semi2A.name}
                </Text>
                <Text style={[styles.bracketPts, { color: '#D4AF37', fontFamily: GEO }]}>{semi2A.points}</Text>
              </View>
            )}
            {semi2B && (
              <View style={styles.bracketMatchupRow}>
                <Text style={[styles.bracketSeed, { color: '#D4AF37', fontFamily: GEO }]}>3</Text>
                <Avatar id={semi2B.playerId} name={semi2B.name} size={20} />
                <Text style={[styles.bracketName, { color: semi2Winner === semi2B ? c.text : c.textMuted }]} numberOfLines={1}>
                  {semi2B.name}
                </Text>
                <Text style={[styles.bracketPts, { color: '#D4AF37', fontFamily: GEO }]}>{semi2B.points}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bracket connector lines */}
        <View style={styles.bracketConnectors}>
          <View style={[styles.bracketLineTop, { borderColor: '#D4AF37' }]} />
          <View style={[styles.bracketLineBottom, { borderColor: '#D4AF37' }]} />
          <View style={[styles.bracketLineCenter, { backgroundColor: '#D4AF37' }]} />
        </View>

        {/* Finals Column */}
        <View style={styles.bracketColumn}>
          <Text style={[styles.bracketRoundLabel, { color: c.textMuted }]}>FINAL</Text>

          <View style={[styles.bracketMatchup, { backgroundColor: c.elevated }]}>
            {semi1Winner && (
              <View style={[styles.bracketMatchupRow, { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <Avatar id={semi1Winner.playerId} name={semi1Winner.name} size={20} />
                <Text style={[styles.bracketName, { color: champion === semi1Winner ? '#D4AF37' : c.textMuted }]} numberOfLines={1}>
                  {semi1Winner.name}
                </Text>
                <Text style={[styles.bracketPts, { color: '#D4AF37', fontFamily: GEO }]}>{semi1Winner.points}</Text>
              </View>
            )}
            {semi2Winner && (
              <View style={styles.bracketMatchupRow}>
                <Avatar id={semi2Winner.playerId} name={semi2Winner.name} size={20} />
                <Text style={[styles.bracketName, { color: champion === semi2Winner ? '#D4AF37' : c.textMuted }]} numberOfLines={1}>
                  {semi2Winner.name}
                </Text>
                <Text style={[styles.bracketPts, { color: '#D4AF37', fontFamily: GEO }]}>{semi2Winner.points}</Text>
              </View>
            )}
          </View>

          {/* Champion display */}
          {champion && (
            <View style={[styles.bracketChampion, { borderColor: '#D4AF37' }]}>
              <Ionicons name="trophy" size={16} color="#D4AF37" />
              <Text style={[styles.bracketChampionName, { color: '#D4AF37', fontFamily: GEO }]}>{champion.name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Eliminated section */}
      <View style={[styles.bracketSection, { backgroundColor: c.elevated, marginTop: 16, opacity: 0.5 }]}>
        <Text style={[styles.bracketSectionLabel, { color: '#C44B4F' }]}>ELIMINATED</Text>
        {eliminated.map((p) => (
          <View key={p.playerId} style={[styles.bracketRow, { borderBottomColor: c.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="close-circle" size={16} color="#C44B4F" />
              <Text style={[styles.bracketName, { color: c.textMuted }]}>{p.name}</Text>
            </View>
            <Text style={[styles.bracketPts, { color: c.textMuted, fontFamily: GEO }]}>{p.points}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────
function ScheduleTab({ weeks, currentWeek }: { weeks: Week[]; currentWeek: number }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <ScrollView style={styles.scheduleContainer} showsVerticalScrollIndicator={false}>
      {weeks.map((w) => {
        const badge = getWeekBadge(w);
        const isCurrent = w.number === currentWeek;
        return (
          <View
            key={w.number}
            style={[
              styles.scheduleCard,
              { backgroundColor: c.cardBg, borderColor: isCurrent ? c.teal : c.border },
            ]}
          >
            <View style={styles.scheduleCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.scheduleWeekNum, { color: c.text, fontFamily: GEO }]}>
                  Week {w.number}
                </Text>
                {badge && (
                  <View style={[styles.weekBadge, { backgroundColor: badge.color + '22' }]}>
                    <Text style={[styles.weekBadgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                )}
                {isCurrent && (
                  <View style={[styles.weekBadge, { backgroundColor: c.teal + '22' }]}>
                    <Text style={[styles.weekBadgeText, { color: c.teal }]}>CURRENT</Text>
                  </View>
                )}
              </View>
              {w.completed && <Ionicons name="checkmark-circle" size={20} color={c.teal} />}
            </View>

            <View style={styles.scheduleCardBody}>
              <View style={styles.scheduleInfoRow}>
                <Ionicons name="golf" size={14} color={c.textMuted} />
                <Text style={[styles.scheduleInfoText, { color: c.textMuted }]}>
                  {FORMAT_LABELS[w.format] ?? w.format}
                </Text>
              </View>
              {w.multiplier > 1 && (
                <View style={styles.scheduleInfoRow}>
                  <Ionicons name="star" size={14} color={c.gold} />
                  <Text style={[styles.scheduleInfoText, { color: c.gold }]}>
                    {w.multiplier}× Points
                  </Text>
                </View>
              )}
            </View>

            {w.isMajor && w.majorName && (
              <LinearGradient
                colors={['#D4AF3710', '#D4AF3700']}
                style={styles.majorGlow}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="trophy" size={14} color={c.gold} />
                <Text style={[styles.majorNameText, { color: c.gold, fontFamily: GEO }]}>
                  {w.majorName}
                </Text>
              </LinearGradient>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Challenges Tab ───────────────────────────────────────────────────
function ChallengesTab({ challenges }: { challenges: BonusChallenge[] }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <ScrollView style={styles.challengesContainer} showsVerticalScrollIndicator={false}>
      {challenges.map((ch) => (
        <View key={ch.id} style={[styles.challengeCard, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border }, theme.isDark ? cardShadowDark : cardShadowLight]}>
          <View style={styles.challengeHeader}>
            <Ionicons name="ribbon" size={20} color={c.gold} />
            <Text style={[styles.challengeLabel, { color: c.text }]}>{ch.label}</Text>
          </View>
          <Text style={[styles.challengeDesc, { color: c.textMuted }]}>{ch.description}</Text>
          <View style={styles.challengeFooter}>
            <Text style={[styles.challengeLeader, { color: c.teal }]}>{ch.leader}</Text>
            <Text style={[styles.challengeVal, { color: c.gold, fontFamily: GEO }]}>{ch.value}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────
export default function SeasonDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const seasonId = params.id;

  useEffect(() => {
    if (!seasonId) return;
    seasonsService.getStandings(seasonId).then(data => {
      // Use real data when available
    }).catch(() => {});
  }, [seasonId]);

  const [tab, setTab] = useState<Tab>('standings');
  const [selectedPlayer, setSelectedPlayer] = useState<Standing | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showChampionCeremony, setShowChampionCeremony] = useState(false);

  const standings = MOCK_STANDINGS;
  const weeks = MOCK_WEEKS;
  const currentWeek = weeks.find((w) => !w.completed)?.number ?? weeks.length;
  const cutLineIndex = Math.ceil(standings.length * CUT_PERCENTAGE);
  const isSeasonComplete = weeks.every((w) => w.completed);
  const currentWeekData = weeks.find((w) => w.number === currentWeek);
  const canAdvance = currentWeekData?.allScoresSubmitted && !isSeasonComplete;

  // Auto-show champion ceremony when season is complete
  useEffect(() => {
    if (isSeasonComplete && standings.length > 0) {
      setShowChampionCeremony(true);
    }
  }, [isSeasonComplete, standings.length]);

  const handlePlayerTap = useCallback((p: Standing) => {
    setSelectedPlayer(p);
    setShowPlayerModal(true);
  }, []);

  const handleAdvanceWeek = useCallback(() => {
    if (isSeasonComplete) {
      setShowChampionCeremony(true);
    }
  }, [isSeasonComplete]);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      {/* Header */}
      <LinearGradient colors={greenHeaderGradient as unknown as string[]} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: GEO }]}>FedEx Cup</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
          {weeks.map((w) => {
            const badge = getWeekBadge(w);
            return (
              <View
                key={w.number}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: w.completed ? c.gold : w.number === currentWeek ? c.teal : '#FFFFFF33',
                    width: badge ? 10 : 6,
                    height: badge ? 10 : 6,
                  },
                ]}
              />
            );
          })}
        </View>
        <Text style={[styles.progressLabel, { color: '#FFFFFFAA' }]}>
          Week {currentWeek} of {weeks.length}
          {currentWeekData?.isMajor ? ` — ${currentWeekData.majorName}` : ''}
        </Text>

        {/* Leader card */}
        {standings[0] && (
          <View style={[styles.leaderCard, { backgroundColor: '#FFFFFF12' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar id={standings[0].playerId} name={standings[0].name} size={36} />
              <View>
                <Text style={[styles.leaderName, { color: '#FFFFFF' }]}>{standings[0].name}</Text>
                <Text style={[styles.leaderSub, { color: '#FFFFFF99' }]}>Season Leader</Text>
              </View>
            </View>
            <Text style={[styles.leaderPts, { color: c.gold, fontFamily: GEO }]}>
              {standings[0].points} pts
            </Text>
          </View>
        )}
      </LinearGradient>
      <GoldDivider />

      <TabBar tab={tab} onSelect={setTab} colors={c} />

      {tab === 'standings' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: SCREEN_W }}>
            <StandingsTab
              standings={standings}
              weeks={weeks}
              cutLineIndex={cutLineIndex}
              onPlayerTap={handlePlayerTap}
            />
          </View>
        </ScrollView>
      )}

      {tab === 'schedule' && <ScheduleTab weeks={weeks} currentWeek={currentWeek} />}
      {tab === 'challenges' && <ChallengesTab challenges={MOCK_CHALLENGES} />}

      {/* Advance week */}
      {canAdvance && (
        <View style={styles.advanceContainer}>
          <Pressable onPress={() => { haptics.light(); handleAdvanceWeek(); }} style={[styles.advanceBtn, { backgroundColor: c.gold }]}>
            <Text style={[styles.advanceBtnText, { fontFamily: GEO }]}>
              {currentWeek === weeks.length ? 'Complete Season' : `Advance to Week ${currentWeek + 1}`}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#000000" />
          </Pressable>
        </View>
      )}

      <PlayerStatsModal
        visible={showPlayerModal}
        player={selectedPlayer}
        weeks={weeks}
        onClose={() => setShowPlayerModal(false)}
      />

      <ChampionCeremony
        visible={showChampionCeremony}
        champion={standings[0]}
        topThree={standings.slice(0, 3)}
        onDismiss={() => setShowChampionCeremony(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: STATUS_BAR_H + 8, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 16, justifyContent: 'center' },
  progressDot: { borderRadius: 0 },
  progressLabel: { textAlign: 'center', fontSize: 12, marginTop: 6 },
  leaderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, marginTop: 12 },
  leaderName: { fontSize: 16, fontWeight: '600' },
  leaderSub: { fontSize: 12, marginTop: 1 },
  leaderPts: { fontSize: 24, letterSpacing: -1 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 16 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  tabIndicator: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2 },

  standingsContainer: { flex: 1, paddingHorizontal: 8 },
  standingsHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, paddingHorizontal: 4 },
  shRank: { width: 28, fontSize: 11, fontWeight: '600' },
  shPlayer: { flex: 1, fontSize: 11, fontWeight: '600', minWidth: 120 },
  shWeek: { width: 32, alignItems: 'center' },
  shWeekText: { fontSize: 10, fontWeight: '700' },
  shTotal: { width: 42, textAlign: 'right', fontSize: 11, fontWeight: '700' },

  standingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4 },
  srRank: { width: 28, fontSize: 16, fontWeight: '700' },
  srPlayer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 120 },
  srName: { fontSize: 13, fontWeight: '600', maxWidth: 100 },
  srHcp: { fontSize: 10, marginTop: 1 },
  srWeekCell: { width: 32, alignItems: 'center', paddingVertical: 2 },
  srWeekVal: { fontSize: 12 },
  srTotal: { width: 42, textAlign: 'right', fontSize: 16, fontWeight: '700' },

  cutLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  cutLineDash: { flex: 1, height: 1, opacity: 0.5 },
  cutLineText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  weekBadge: { paddingHorizontal: 6, paddingVertical: 2 },
  weekBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  scheduleContainer: { flex: 1, padding: 20 },
  scheduleCard: { padding: 14, marginBottom: 10, borderWidth: 1 },
  scheduleCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scheduleWeekNum: { fontSize: 16, fontWeight: '700' },
  scheduleCardBody: { marginTop: 8, gap: 4 },
  scheduleInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scheduleInfoText: { fontSize: 13 },
  majorGlow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, marginTop: 8 },
  majorNameText: { fontSize: 13, fontWeight: '600' },

  challengesContainer: { flex: 1, padding: 20 },
  challengeCard: { padding: 14, marginBottom: 10 },
  challengeCardBorder: { borderWidth: 1 },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  challengeLabel: { fontSize: 16, fontWeight: '600' },
  challengeDesc: { fontSize: 13, marginTop: 4 },
  challengeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  challengeLeader: { fontSize: 14, fontWeight: '600' },
  challengeVal: { fontSize: 20, fontWeight: '700' },

  bracketContainer: { padding: 16 },
  bracketTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginBottom: 12 },
  bracketSection: { padding: 12 },
  bracketSectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  bracketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  bracketSeed: { fontSize: 14, width: 20 },
  bracketName: { fontSize: 14, fontWeight: '500' },
  bracketPts: { fontSize: 14 },

  advanceContainer: { padding: 16 },
  advanceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  advanceBtnText: { fontSize: 16, fontWeight: '700', color: '#000000' },

  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalPlayerName: { fontSize: 18, fontWeight: '700' },
  modalPlayerHcp: { fontSize: 13, marginTop: 2 },
  statsHero: { flexDirection: 'row', padding: 14, marginTop: 16, justifyContent: 'space-around' },
  statsHeroItem: { alignItems: 'center' },
  statsHeroVal: { fontSize: 24, fontWeight: '700', letterSpacing: -1 },
  statsHeroLabel: { fontSize: 10, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  weekNum: { fontSize: 13, fontWeight: '600' },
  weekFormat: { fontSize: 11, marginTop: 2 },
  weekPts: { fontSize: 16, fontWeight: '700' },
  weekPos: { fontSize: 11, marginTop: 1 },
  weekDns: { fontSize: 13, fontStyle: 'italic' },
  dropInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, marginTop: 8 },
  dropText: { fontSize: 12 },

  ceremonyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  ceremonyContent: { alignItems: 'center', padding: 40, width: SCREEN_W * 0.85, position: 'relative' },
  ceremonyTrophy: { fontSize: 64, textAlign: 'center' },
  ceremonyLabel: { fontSize: 28, fontWeight: '800', letterSpacing: 3, marginTop: 16, fontFamily: GEO },
  ceremonyName: { fontSize: 28, fontWeight: '700', fontFamily: GEO, textAlign: 'center', letterSpacing: -1 },
  ceremonyPoints: { fontSize: 48, fontWeight: '700', fontFamily: GEO, letterSpacing: -1 },
  ceremonyStats: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 16 },
  ceremonyStat: { alignItems: 'center' },
  ceremonyStatVal: { fontSize: 20, fontWeight: '700', fontFamily: GEO },
  ceremonyStatLabel: { fontSize: 11, marginTop: 2 },
  ceremonyStatDivider: { width: 1, height: 24 },
  ceremonyTap: { fontSize: 11, letterSpacing: 2, marginTop: 32 },

  cornerTL: { position: 'absolute', top: 0, left: 0, width: 24, height: 24, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 24, height: 24, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderBottomWidth: 2, borderRightWidth: 2 },

  // Champion ceremony standings
  ceremonyStandings: { marginTop: 24, width: '100%' },
  ceremonyStandingsTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center', marginBottom: 8 },
  ceremonyStandingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8 },
  ceremonyStandingRank: { width: 36, fontSize: 14, fontWeight: '700' },
  ceremonyStandingName: { flex: 1, fontSize: 14, fontWeight: '500' },
  ceremonyStandingPts: { fontSize: 14, fontWeight: '700' },
  ceremonyDismissBtn: { marginTop: 28, paddingVertical: 12, paddingHorizontal: 32, borderWidth: 1, borderColor: '#FFFFFF33' },
  ceremonyDismissText: { fontSize: 14, fontWeight: '600', letterSpacing: 1 },

  // Career stats grid
  careerStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, marginTop: 8 },
  careerStatItem: { width: '33.33%', alignItems: 'center', paddingVertical: 10 },
  careerStatVal: { fontSize: 20, fontWeight: '700' },
  careerStatLabel: { fontSize: 10, marginTop: 2, textAlign: 'center' },

  // Bracket visualization
  bracketVisual: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  bracketColumn: { flex: 1 },
  bracketRoundLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textAlign: 'center', marginBottom: 8 },
  bracketMatchup: { padding: 0 },
  bracketMatchupRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8 },
  bracketConnectors: { width: 24, alignItems: 'center', justifyContent: 'center', position: 'relative', height: 160 },
  bracketLineTop: { position: 'absolute', top: 30, right: 0, width: 12, height: 50, borderRightWidth: 1, borderTopWidth: 1, borderBottomWidth: 1 },
  bracketLineBottom: { position: 'absolute', bottom: 30, right: 0, width: 12, height: 50, borderRightWidth: 1, borderTopWidth: 1, borderBottomWidth: 1 },
  bracketLineCenter: { position: 'absolute', right: 0, width: 12, height: 1 },
  bracketChampion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 8, borderWidth: 1 },
  bracketChampionName: { fontSize: 13, fontWeight: '700' },
});
