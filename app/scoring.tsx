import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { cardShadowDark, cardShadowLight, tickerShadowDark, tickerShadowLight, greenHeaderGradient } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import GoldDivider from '../src/components/GoldDivider';
import { DormieMoment } from '../src/components/DormieMoment';
import { SideGameToast, detectSideGameEvents } from '../src/components/SideGameToast';
import { HoleTransitionBanner } from '../src/components/HoleTransitionBanner';
import { Confetti } from '../src/components/Confetti';
import { PersonalBestBanner } from '../src/components/PersonalBestBanner';
import type { SideGameEvent } from '../src/components/SideGameToast';
import type { PlayerHoleResult } from '../src/components/HoleTransitionBanner';
import type { MomentType } from '../src/components/DormieMoment';
import { useAuth } from '../src/lib/auth';
import { haptics } from '../src/lib/haptics';
import { sounds } from '../src/lib/sounds';
import { queueOfflineAction } from '../src/lib/offline';
import { scoreCellLabel } from '../src/lib/accessibility';
import { useToast } from '../src/components/Toast';
import { roundsService } from '../src/services/rounds.service';
import { coursesService } from '../src/services/courses.service';
import { scoreColor, formatToPar as fmtToPar, toParColor as toParColorUtil, scoreName as scoreNameUtil } from '../src/lib/scoring-utils';
import { MOCK_GROUP_PLAYERS } from '../src/data/leaderboard';
import { MOCK_UPCOMING_TRIPS } from '../src/data/trips';

// ─── Linked competition types ────────────────────────────────────────
type LinkedSeason = {
  seasonId: string;
  seasonName: string;
  weekNumber: number;
  format: string;
  multiplier: number;
};

type CompetitionTab = {
  key: string;
  label: string;
  type: 'round' | 'season' | 'trip' | 'matchup';
  data?: LinkedSeason;
};

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Types ────────────────────────────────────────────────────────────
type PlayerConfig = {
  id: string;
  name: string;
  handicap: number;
};

type HoleScore = {
  gross: number;
  putts: number;
  fir: boolean | null; // null for par 3s
  penalties?: { water: number; ob: number; lost: number };
  tags?: string[]; // Item 9: hole tags (Sand, Trees, Water, Penalty, Up & Down)
};

// ─── Hammer state type ───────────────────────────────────────────────
type HammerState = {
  active: boolean;
  thrower: string;
  target: string;
  multiplier: number; // 2, 4, 8
  pending: boolean;
};

type HammerResult = {
  thrower: string;
  target: string;
  multiplier: number;
  accepted: boolean;
};

// ─── Scoring event for live feed ─────────────────────────────────────
type ScoringEvent = {
  text: string;
  time: Date;
};

type HoleData = {
  number: number;
  par: number;
  strokeIndex: number; // difficulty rank 1-18 for handicap allocation
  yards?: number; // yardage for selected tee
};

// ─── Default hole pars (standard layout) ──────────────────────────────
function buildHoles(coursePar: number, holeRange: string): HoleData[] {
  // Standard par distribution for 18 holes
  const standardPars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
  // Standard stroke index (difficulty ranking)
  const standardSI = [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 2, 16, 6, 4, 12, 18, 10, 14];

  // Adjust pars to match total course par
  const pars = [...standardPars];
  const totalStd = pars.reduce((a, b) => a + b, 0);
  let diff = coursePar - totalStd;
  let idx = 0;
  while (diff > 0) {
    if (pars[idx] === 4) { pars[idx] = 5; diff--; }
    idx++;
    if (idx >= 18) break;
  }
  while (diff < 0) {
    if (pars[17 - idx] === 4) { pars[17 - idx] = 3; diff++; }
    idx++;
    if (idx >= 18) break;
  }

  let holes: HoleData[] = pars.map((p, i) => ({
    number: i + 1,
    par: p,
    strokeIndex: standardSI[i],
  }));

  if (holeRange === 'front9') holes = holes.slice(0, 9);
  else if (holeRange === 'back9') holes = holes.slice(9, 18);

  return holes;
}

// ─── Helpers ──────────────────────────────────────────────────────────
const scoreName = scoreNameUtil;

function scoreNameColor(
  score: number,
  par: number,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): string {
  const diff = score - par;
  if (diff <= -2) return c.gold;
  if (diff === -1) return c.teal;
  if (diff === 0) return c.text;
  if (diff === 1) return c.urgent;
  return '#C44B4F';
}

const formatToPar = fmtToPar;

function toParColor(
  diff: number,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): string {
  if (diff < 0) return c.teal;
  if (diff === 0) return c.gold;
  return c.urgent;
}

function calcCourseHandicap(
  hcpIndex: number,
  slope: number,
  rating: number,
  par: number,
): number {
  return Math.round(hcpIndex * (slope / 113) + (rating - par));
}

function isGIR(gross: number, putts: number, par: number): boolean {
  return (gross - putts) <= (par - 2);
}

// ─── Abbreviate long course names for header display ─────────────────
// "Hermitage Golf Course - Presidents Reserve" → "Hermitage - Presidents Reserve"
// "TPC Sawgrass - Stadium Course" → "TPC Sawgrass - Stadium"
function abbreviateCourseName(name: string): string {
  if (name.length <= 30) return name;
  // If name has a dash separator (facility - course), keep both parts but shorten
  const dashIdx = name.indexOf(' - ');
  if (dashIdx > 0) {
    const facility = name.slice(0, dashIdx);
    const course = name.slice(dashIdx + 3);
    // Strip "Golf Course", "Golf Club", "Golf Links" from facility
    const shortFacility = facility
      .replace(/\s+Golf\s+(Course|Club|Links|Resort)$/i, '')
      .trim();
    // Strip "Course" from course name
    const shortCourse = course.replace(/\s+Course$/i, '').trim();
    return `${shortFacility} - ${shortCourse}`;
  }
  // Strip common suffixes
  return name
    .replace(/\s+Golf\s+(Course|Club|Links|Resort)$/i, '')
    .trim();
}

// ─── Header ───────────────────────────────────────────────────────────
function ScoringHeader({
  courseName,
  holeNumber,
  holePar,
  format,
  totalHoles,
  holesScored,
  onLeaderboard,
  onFeed,
  unreadFeedCount,
  viewMode,
  onToggleViewMode,
  holeYardage,
  holeHcp,
  onPrevHole,
  onNextHole,
  canPrevHole,
  canNextHole,
  roundType,
}: {
  courseName: string;
  holeNumber: number;
  holePar: number;
  format: string;
  totalHoles: number;
  holesScored: number;
  onLeaderboard?: () => void;
  onFeed?: () => void;
  unreadFeedCount?: number;
  viewMode?: 'solo' | 'all';
  onToggleViewMode?: () => void;
  holeYardage?: number;
  holeHcp?: number;
  onPrevHole?: () => void;
  onNextHole?: () => void;
  canPrevHole?: boolean;
  canNextHole?: boolean;
  competitionCount?: number;
  roundType?: string;
}) {
  const router = useRouter();

  return (
    <LinearGradient
      colors={[...greenHeaderGradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={st.header}
    >
      <View style={st.headerOverlay} />

      {/* Top bar */}
      <View style={st.headerTop}>
        <Pressable
          onPress={() => {
            Alert.alert(
              'Leave Round?',
              'Your scores will be lost if you leave.',
              [
                { text: 'Stay', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: () => router.back() },
              ],
            );
          }}
          hitSlop={12}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={[st.headerCourseName, { fontFamily: GEO }]} numberOfLines={1}>
          {abbreviateCourseName(courseName)}
        </Text>
        <View style={st.headerActions}>
          {/* View mode toggle (Feature 14) */}
          {onToggleViewMode && (
            <Pressable onPress={onToggleViewMode} hitSlop={8}>
              <Ionicons
                name={viewMode === 'solo' ? 'person-outline' : 'people-outline'}
                size={18}
                color="#fff"
              />
            </Pressable>
          )}
          {/* Live feed toggle (Feature 12) */}
          {onFeed && (
            <Pressable onPress={onFeed} hitSlop={8} style={st.headerActionBtn}>
              <Ionicons name="newspaper-outline" size={18} color="#fff" />
              {(unreadFeedCount ?? 0) > 0 && (
                <View style={st.feedBadge}>
                  <Text style={st.feedBadgeText}>{unreadFeedCount}</Text>
                </View>
              )}
            </Pressable>
          )}
          {/* Leaderboard toggle (Feature 11) */}
          {onLeaderboard && (
            <Pressable onPress={onLeaderboard} hitSlop={8} style={{ position: 'relative' }}>
              <Ionicons name="trophy-outline" size={18} color="#D4AF37" />
              {competitionCount != null && competitionCount > 1 && (
                <View style={st.compBadge}>
                  <Text style={st.compBadgeText}>{competitionCount}</Text>
                </View>
              )}
            </Pressable>
          )}
          <Text style={st.headerThrough}>
            {holesScored}/{totalHoles}
          </Text>
        </View>
      </View>

      {/* Hole info */}
      <View style={st.headerHoleRow}>
        <Pressable
          onPress={onPrevHole}
          disabled={!canPrevHole}
          hitSlop={12}
          style={{ opacity: canPrevHole ? 1 : 0.3 }}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={[st.headerHoleLabel]}>HOLE</Text>
          <Text style={[st.headerHoleNum, { fontFamily: GEO }]}>{holeNumber}</Text>
          <Text style={st.headerHoleDetail}>
            Par {holePar}{holeYardage ? ` \u2022 ${holeYardage} yds` : ''} {'\u2022'} HCP {holeHcp ?? '-'}
          </Text>
        </View>
        <Pressable
          onPress={onNextHole}
          disabled={!canNextHole}
          hitSlop={12}
          style={{ opacity: canNextHole ? 1 : 0.3 }}
        >
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Round context badges + Format name */}
      <View style={st.headerFormatRow}>
        {roundType && roundType.length > 0 && (
          <View style={[
            st.roundTypeBadge,
            {
              backgroundColor: roundType.includes('\u00B7') ? '#D4AF37' :
                roundType === 'Competitive' ? '#D4AF37' :
                roundType === 'Matchup' ? '#2A9D8F' :
                roundType.toLowerCase() === 'casual' ? 'rgba(255,255,255,0.25)' : '#D4AF37',
            },
          ]}>
            <Text style={[st.roundTypeBadgeText, {
              color: roundType.toLowerCase() === 'casual' ? 'rgba(255,255,255,0.8)' : '#1E4D2B',
            }]}>
              {roundType.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={st.headerFormat}>{format}</Text>
      </View>
    </LinearGradient>
  );
}

// ─── Hole navigation strip ────────────────────────────────────────────
function HoleStrip({
  holes,
  currentIdx,
  scores,
  onSelect,
  holeNotes,
}: {
  holes: HoleData[];
  currentIdx: number;
  scores: Map<number, Map<string, HoleScore>>; // holeNumber -> playerId -> score
  onSelect: (idx: number) => void;
  holeNotes?: Map<number, string>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const flatListRef = useRef<FlatList>(null);

  const renderItem = useCallback(
    ({ item, index }: { item: HoleData; index: number }) => {
      const isCurrent = index === currentIdx;
      const hasScores = scores.has(item.number);
      // Feature 2: Check if any player has penalties on this hole
      const holeScores = scores.get(item.number);
      let hasPenalties = false;
      if (holeScores) {
        holeScores.forEach((s) => {
          if (s.penalties && (s.penalties.water > 0 || s.penalties.ob > 0 || s.penalties.lost > 0)) {
            hasPenalties = true;
          }
        });
      }
      // Feature 6: Check if hole has notes
      const hasNote = holeNotes?.has(item.number) && (holeNotes.get(item.number) ?? '').length > 0;

      return (
        <Pressable
          onPress={() => onSelect(index)}
          style={({ pressed }) => [
            st.holeChip,
            {
              backgroundColor: isCurrent
                ? '#D4AF37'
                : hasScores
                  ? `${c.teal}25`
                  : c.elevated,
              borderColor: isCurrent ? '#D4AF37' : hasScores ? c.teal : c.border,
            },
            isCurrent && { borderLeftWidth: 3, borderLeftColor: '#1E4D2B' },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text
            style={[
              st.holeChipNum,
              {
                color: isCurrent ? '#1E4D2B' : hasScores ? c.teal : c.textMuted,
                fontFamily: GEO,
              },
              isCurrent && { fontWeight: '800' },
            ]}
          >
            {item.number}
          </Text>
          <Text
            style={[
              st.holeChipPar,
              { color: isCurrent ? '#1E4D2B' : c.textMuted },
            ]}
          >
            {item.par}
          </Text>
          {/* Penalty indicator (Feature 2) */}
          {hasPenalties && (
            <View style={st.holeChipPenaltyDot} />
          )}
          {/* Note indicator (Feature 6) */}
          {hasNote && (
            <View style={[st.holeChipNoteDot, { backgroundColor: c.gold }]} />
          )}
        </Pressable>
      );
    },
    [currentIdx, scores, c, holeNotes],
  );

  return (
    <FlatList
      ref={flatListRef}
      data={holes}
      renderItem={renderItem}
      keyExtractor={(h) => String(h.number)}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.holeStripContent}
      style={[st.holeStrip, { backgroundColor: c.surface, borderColor: c.border }]}
    />
  );
}

// ─── Score input for a single player ──────────────────────────────────
function PlayerScoreInput({
  player,
  holePar,
  score,
  runningTotal,
  runningPar,
  netStrokes,
  scoreMode,
  onChange,
  compact,
}: {
  player: PlayerConfig;
  holePar: number;
  score: HoleScore;
  runningTotal: number;
  runningPar: number;
  netStrokes: number;
  scoreMode: string;
  onChange: (s: HoleScore) => void;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isMe = player.id === '1';
  const showFIR = holePar >= 4;
  const gir = isGIR(score.gross, score.putts, holePar);
  const netScore = score.gross - netStrokes;
  const [showHighGrid, setShowHighGrid] = useState(false);
  const penalties = score.penalties ?? { water: 0, ob: 0, lost: 0 };

  const setGross = (val: number) => {
    onChange({ ...score, gross: val });
  };

  const adjustGross = (delta: number) => {
    const next = Math.max(1, Math.min(15, score.gross + delta));
    haptics.light();
    onChange({ ...score, gross: next });
  };

  const adjustPutts = (delta: number) => {
    const next = Math.max(0, Math.min(score.gross, score.putts + delta));
    haptics.light();
    onChange({ ...score, putts: next });
  };

  const toggleFIR = () => {
    onChange({ ...score, fir: score.fir === true ? false : true });
  };

  // Feature 2: Penalty adjustment — each penalty auto-adds 1 to gross
  const adjustPenalty = (type: 'water' | 'ob' | 'lost', delta: number) => {
    const current = penalties[type];
    const next = Math.max(0, current + delta);
    const diff = next - current; // +1 or -1
    const newPenalties = { ...penalties, [type]: next };
    onChange({
      ...score,
      gross: Math.max(1, score.gross + diff),
      penalties: newPenalties,
    });
  };

  // Feature 7: Score entry grid
  const gridNumbers = [1, 2, 3, 4, 5, 6, 7];

  if (compact) {
    // Feature 14: Compact view for 'all' mode
    return (
      <View
        style={[
          st.playerCardCompact,
          {
            backgroundColor: c.cardBg,
            borderColor: isMe ? c.teal : c.border,
          },
          isMe && { borderLeftWidth: 3, borderLeftColor: c.teal },
          theme.isDark ? cardShadowDark : cardShadowLight,
        ]}
      >
        <View style={st.compactHeader}>
          <Avatar id={player.id} size={22} name={player.name} />
          <Text
            style={[
              st.compactName,
              { color: isMe ? c.teal : c.text },
              isMe && { fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {isMe ? 'You' : player.name.split(' ')[0]}
          </Text>
          <Text
            style={[
              st.compactRunning,
              { color: toParColor(runningTotal - runningPar, c), fontFamily: GEO },
            ]}
          >
            {runningTotal > 0 ? formatToPar(runningTotal, runningPar) : '-'}
          </Text>
        </View>
        {/* Compact grid */}
        <View style={st.compactGrid}>
          {gridNumbers.map((n) => (
            <Pressable
              key={n}
              onPress={() => setGross(n)}
              accessibilityLabel={scoreCellLabel(n, holePar, n)}
              style={({ pressed }) => [
                st.compactGridCell,
                {
                  backgroundColor: score.gross === n ? c.teal : c.elevated,
                  borderColor: score.gross === n ? c.teal : c.border,
                },
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text
                style={[
                  st.compactGridText,
                  {
                    color: score.gross === n ? '#fff' : c.text,
                    fontFamily: GEO,
                  },
                ]}
              >
                {n}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => { if (score.gross < 8) setGross(8); else adjustGross(1); }}
            onLongPress={() => adjustGross(-1)}
            style={({ pressed }) => [
              st.compactGridCell,
              {
                backgroundColor: score.gross >= 8 ? c.teal : c.elevated,
                borderColor: score.gross >= 8 ? c.teal : c.border,
              },
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text
              style={[
                st.compactGridText,
                {
                  color: score.gross >= 8 ? '#fff' : c.text,
                  fontFamily: GEO,
                },
              ]}
            >
              {score.gross >= 8 ? score.gross : '8+'}
            </Text>
          </Pressable>
        </View>
        {/* Compact putts */}
        <View style={st.compactPuttsRow}>
          <Text style={[st.compactPuttsLabel, { color: c.textMuted }]}>P:</Text>
          <Pressable onPress={() => adjustPutts(-1)} hitSlop={6}>
            <Ionicons name="remove-circle-outline" size={16} color={c.textMuted} />
          </Pressable>
          <Text style={[st.compactPuttsValue, { color: c.text, fontFamily: GEO }]}>{score.putts}</Text>
          <Pressable onPress={() => adjustPutts(1)} hitSlop={6}>
            <Ionicons name="add-circle-outline" size={16} color={c.textMuted} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        st.playerCard,
        {
          backgroundColor: c.cardBg,
          borderColor: isMe ? c.teal : c.border,
        },
        isMe && { borderLeftWidth: 3, borderLeftColor: c.teal },
        theme.isDark ? cardShadowDark : cardShadowLight,
      ]}
    >
      {/* Player header */}
      <View style={st.playerHeader}>
        <Avatar id={player.id} size={28} name={player.name} />
        <View style={st.playerNameWrap}>
          <Text
            style={[
              st.playerNameText,
              { color: isMe ? c.teal : c.text },
              isMe && { fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {isMe ? 'You' : player.name}
          </Text>
          {netStrokes > 0 && scoreMode === 'net' && (
            <View style={[st.strokeDot, { backgroundColor: c.gold }]}>
              <Text style={st.strokeDotText}>{netStrokes}</Text>
            </View>
          )}
        </View>
        <View style={st.runningWrap}>
          <Text
            style={[
              st.runningTotal,
              { color: toParColor(runningTotal - runningPar, c), fontFamily: GEO },
            ]}
          >
            {runningTotal > 0 ? formatToPar(runningTotal, runningPar) : '-'}
          </Text>
          <Text style={[st.runningLabel, { color: c.textMuted }]}>
            thru {runningPar > 0 ? Math.round(runningPar / (runningTotal / runningTotal || 1)) : 0}
          </Text>
        </View>
      </View>

      {/* Feature 7: Score entry grid */}
      <View style={st.scoreGridRow}>
        {gridNumbers.map((n) => (
          <Pressable
            key={n}
            onPress={() => setGross(n)}
            accessibilityLabel={scoreCellLabel(n, holePar, n)}
            style={({ pressed }) => [
              st.scoreGridCell,
              {
                backgroundColor: score.gross === n ? c.teal : c.elevated,
                borderColor: score.gross === n ? c.teal : c.border,
              },
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text
              style={[
                st.scoreGridText,
                {
                  color: score.gross === n ? '#fff' : c.text,
                  fontFamily: GEO,
                  fontWeight: score.gross === n ? '700' : '500',
                },
              ]}
            >
              {n}
            </Text>
          </Pressable>
        ))}
        {/* 8+ cell */}
        {!showHighGrid ? (
          <Pressable
            onPress={() => { setGross(8); setShowHighGrid(true); }}
            style={({ pressed }) => [
              st.scoreGridCell,
              {
                backgroundColor: score.gross >= 8 ? c.teal : c.elevated,
                borderColor: score.gross >= 8 ? c.teal : c.border,
              },
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text
              style={[
                st.scoreGridText,
                {
                  color: score.gross >= 8 ? '#fff' : c.text,
                  fontFamily: GEO,
                  fontWeight: score.gross >= 8 ? '700' : '500',
                },
              ]}
            >
              {score.gross >= 8 ? score.gross : '8+'}
            </Text>
          </Pressable>
        ) : (
          <View style={st.highScoreStepper}>
            <Pressable
              onPress={() => { const n = Math.max(1, score.gross - 1); setGross(n); if (n < 8) setShowHighGrid(false); }}
              style={[st.miniBtn, { borderColor: c.border }]}
            >
              <Ionicons name="remove" size={14} color={c.textMuted} />
            </Pressable>
            <Text style={[st.scoreGridText, { color: c.teal, fontFamily: GEO, fontWeight: '700', minWidth: 24, textAlign: 'center' }]}>
              {score.gross}
            </Text>
            <Pressable
              onPress={() => adjustGross(1)}
              style={[st.miniBtn, { borderColor: c.border }]}
            >
              <Ionicons name="add" size={14} color={c.textMuted} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Score label */}
      <View style={st.scoreLabelRow}>
        <Text
          style={[
            st.scoreLabelText,
            { color: scoreNameColor(score.gross, holePar, c) },
          ]}
        >
          {scoreName(score.gross, holePar)}
        </Text>
        {scoreMode === 'net' && netStrokes > 0 && (
          <Text style={[st.netScore, { color: c.gold, fontFamily: GEO }]}>
            Net: {netScore}
          </Text>
        )}
      </View>

      {/* Secondary inputs: Putts, FIR, GIR */}
      <View style={st.secondaryRow}>
        {/* Putts */}
        <View style={st.secondaryGroup}>
          <Text style={[st.secondaryLabel, { color: c.textMuted }]}>PUTTS</Text>
          <View style={st.secondaryControls}>
            <Pressable
              onPress={() => adjustPutts(-1)}
              style={[st.miniBtn, { borderColor: c.border }]}
            >
              <Ionicons name="remove" size={14} color={c.textMuted} />
            </Pressable>
            <Text style={[st.miniValue, { color: c.text, fontFamily: GEO }]}>
              {score.putts}
            </Text>
            <Pressable
              onPress={() => adjustPutts(1)}
              style={[st.miniBtn, { borderColor: c.border }]}
            >
              <Ionicons name="add" size={14} color={c.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* FIR */}
        {showFIR && (
          <View style={st.secondaryGroup}>
            <Text style={[st.secondaryLabel, { color: c.textMuted }]}>FIR</Text>
            <Pressable
              onPress={toggleFIR}
              style={[
                st.toggleChip,
                {
                  backgroundColor: score.fir === true ? `${c.teal}20` : c.elevated,
                  borderColor: score.fir === true ? c.teal : c.border,
                },
              ]}
            >
              <Ionicons
                name={score.fir === true ? 'checkmark' : 'close'}
                size={14}
                color={score.fir === true ? c.teal : c.textMuted}
              />
            </Pressable>
          </View>
        )}

        {/* GIR */}
        <View style={st.secondaryGroup}>
          <Text style={[st.secondaryLabel, { color: c.textMuted }]}>GIR</Text>
          <View
            style={[
              st.toggleChip,
              {
                backgroundColor: gir ? `${c.teal}20` : c.elevated,
                borderColor: gir ? c.teal : c.border,
              },
            ]}
          >
            <Ionicons
              name={gir ? 'checkmark' : 'close'}
              size={14}
              color={gir ? c.teal : c.textMuted}
            />
          </View>
        </View>
      </View>

      {/* Feature 2: Penalty tracking */}
      <View style={st.penaltyRow}>
        {/* Water */}
        <View style={st.penaltyGroup}>
          <Ionicons name="water-outline" size={14} color={penalties.water > 0 ? c.urgent : c.textMuted} />
          <Text style={[st.penaltyLabel, { color: c.textMuted }]}>Water</Text>
          <View style={st.penaltyControls}>
            <Pressable onPress={() => adjustPenalty('water', -1)} hitSlop={6}>
              <Ionicons name="remove-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
            <Text style={[st.penaltyValue, { color: penalties.water > 0 ? c.urgent : c.textMuted, fontFamily: GEO }]}>
              {penalties.water}
            </Text>
            <Pressable onPress={() => adjustPenalty('water', 1)} hitSlop={6}>
              <Ionicons name="add-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* OB */}
        <View style={st.penaltyGroup}>
          <Ionicons name="alert-circle-outline" size={14} color={penalties.ob > 0 ? c.urgent : c.textMuted} />
          <Text style={[st.penaltyLabel, { color: c.textMuted }]}>OB</Text>
          <View style={st.penaltyControls}>
            <Pressable onPress={() => adjustPenalty('ob', -1)} hitSlop={6}>
              <Ionicons name="remove-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
            <Text style={[st.penaltyValue, { color: penalties.ob > 0 ? c.urgent : c.textMuted, fontFamily: GEO }]}>
              {penalties.ob}
            </Text>
            <Pressable onPress={() => adjustPenalty('ob', 1)} hitSlop={6}>
              <Ionicons name="add-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Lost Ball */}
        <View style={st.penaltyGroup}>
          <Ionicons name="help-circle-outline" size={14} color={penalties.lost > 0 ? c.urgent : c.textMuted} />
          <Text style={[st.penaltyLabel, { color: c.textMuted }]}>Lost</Text>
          <View style={st.penaltyControls}>
            <Pressable onPress={() => adjustPenalty('lost', -1)} hitSlop={6}>
              <Ionicons name="remove-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
            <Text style={[st.penaltyValue, { color: penalties.lost > 0 ? c.urgent : c.textMuted, fontFamily: GEO }]}>
              {penalties.lost}
            </Text>
            <Pressable onPress={() => adjustPenalty('lost', 1)} hitSlop={6}>
              <Ionicons name="add-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Hole result banner ───────────────────────────────────────────────
function HoleResultBanner({
  players,
  holeScores,
  holePar,
}: {
  players: PlayerConfig[];
  holeScores: Map<string, HoleScore>;
  holePar: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (holeScores.size < players.length) return null;

  // Find winner (lowest gross)
  let bestScore = Infinity;
  let winners: string[] = [];
  holeScores.forEach((s, pid) => {
    if (s.gross < bestScore) {
      bestScore = s.gross;
      winners = [pid];
    } else if (s.gross === bestScore) {
      winners.push(pid);
    }
  });

  const isTie = winners.length > 1;
  const winnerName = isTie
    ? 'Halved'
    : (players.find((p) => p.id === winners[0])?.id === '1'
        ? 'You won'
        : `${players.find((p) => p.id === winners[0])?.name?.split(' ')[0] ?? 'Player'} wins`);

  const diff = bestScore - holePar;
  const scoreLabel = isTie ? '' : ` with ${scoreName(bestScore, holePar).toLowerCase()}`;

  return (
    <View style={[st.resultBanner, { backgroundColor: `${c.teal}12`, borderColor: c.teal }]}>
      <Ionicons
        name={isTie ? 'swap-horizontal' : 'trophy'}
        size={16}
        color={c.teal}
      />
      <Text style={[st.resultText, { color: c.teal }]}>
        {winnerName}{scoreLabel}
      </Text>
    </View>
  );
}

// ─── Navigation buttons ───────────────────────────────────────────────
function NavButtons({
  canPrev,
  canNext,
  isLast,
  onPrev,
  onNext,
  onFinish,
}: {
  canPrev: boolean;
  canNext: boolean;
  isLast: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={st.navRow}>
      <Pressable
        onPress={onPrev}
        disabled={!canPrev}
        accessibilityLabel="Previous hole"
        style={({ pressed }) => [
          st.navBtn,
          { backgroundColor: c.elevated, borderColor: c.border, opacity: canPrev ? 1 : 0.3 },
          pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
        ]}
      >
        <Ionicons name="chevron-back" size={18} color={c.text} />
        <Text style={[st.navBtnText, { color: c.text }]}>Prev Hole</Text>
      </Pressable>

      {isLast ? (
        <Pressable
          onPress={onFinish}
          style={({ pressed }) => [
            st.navBtn, st.navFinish, { backgroundColor: '#1E4D2B' },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={[st.navBtnText, { color: '#D4AF37', fontFamily: GEO }]}>
            Finish Round
          </Text>
          <Ionicons name="checkmark-circle" size={18} color="#D4AF37" />
        </Pressable>
      ) : (
        <Pressable
          onPress={onNext}
          accessibilityLabel="Next hole"
          style={({ pressed }) => [
            st.navBtn,
            { backgroundColor: c.teal },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={[st.navBtnText, { color: '#fff' }]}>Next Hole</Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

// ─── Post-round summary ──────────────────────────────────────────────
// ─── Side game labels lookup ──────────────────────────────────────────
const SIDE_GAME_DISPLAY: Record<string, string> = {
  dots: 'Dots', snake: 'Snake', greenies: 'Greenies', skins: 'Skins',
  hammer: 'Hammer', nassau: 'Nassau', wolf: 'Wolf', sandies: 'Sandies',
  bark: 'Barkies', arnies: 'Arnies', close_shave: 'KP',
};

// ─── Compute helpers for summary ──────────────────────────────────────
type PlayerTotals = {
  player: PlayerConfig;
  gross: number;
  net: number;
  putts: number;
  firHit: number;
  firTotal: number;
  girCount: number;
  holesPlayed: number;
  scores: { hole: HoleData; score: HoleScore }[];
  par3Avg: number;
  par4Avg: number;
  par5Avg: number;
  upDownAttempts: number;
  upDownMade: number;
};

function computePlayerTotals(
  players: PlayerConfig[],
  holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
  handicapStrokes: Map<string, Map<number, number>>,
): PlayerTotals[] {
  return players.map((p) => {
    let gross = 0, net = 0, putts = 0, firHit = 0, firTotal = 0;
    let girCount = 0, holesPlayed = 0;
    let par3Total = 0, par3Count = 0, par4Total = 0, par4Count = 0;
    let par5Total = 0, par5Count = 0;
    let upDownAttempts = 0, upDownMade = 0;
    const scores: { hole: HoleData; score: HoleScore }[] = [];

    holes.forEach((h) => {
      const s = allScores.get(h.number)?.get(p.id);
      if (!s) return;
      holesPlayed++;
      gross += s.gross;
      const strokes = handicapStrokes.get(p.id)?.get(h.number) ?? 0;
      net += s.gross - strokes;
      putts += s.putts;
      scores.push({ hole: h, score: s });

      if (h.par >= 4) { firTotal++; if (s.fir === true) firHit++; }
      const gir = isGIR(s.gross, s.putts, h.par);
      if (gir) girCount++;
      // Up & down: missed GIR but still made par or better
      if (!gir) {
        upDownAttempts++;
        if (s.gross <= h.par) upDownMade++;
      }
      if (h.par === 3) { par3Total += s.gross; par3Count++; }
      if (h.par === 4) { par4Total += s.gross; par4Count++; }
      if (h.par === 5) { par5Total += s.gross; par5Count++; }
    });

    return {
      player: p, gross, net, putts, firHit, firTotal, girCount, holesPlayed, scores,
      par3Avg: par3Count > 0 ? par3Total / par3Count : 0,
      par4Avg: par4Count > 0 ? par4Total / par4Count : 0,
      par5Avg: par5Count > 0 ? par5Total / par5Count : 0,
      upDownAttempts, upDownMade,
    };
  });
}

// ─── Summary tab bar ──────────────────────────────────────────────────
type SummaryTab = 'scorecard' | 'stats' | 'games';

function SummaryTabBar({
  tab,
  onSelect,
  hasGames,
}: {
  tab: SummaryTab;
  onSelect: (t: SummaryTab) => void;
  hasGames: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const tabs: { key: SummaryTab; label: string }[] = [
    { key: 'scorecard', label: 'Scorecard' },
    { key: 'stats', label: 'Stats' },
  ];
  if (hasGames) tabs.push({ key: 'games', label: 'Games' });

  return (
    <View style={[ps.tabBar, { borderColor: c.border }]}>
      {tabs.map((t) => {
        const active = t.key === tab;
        return (
          <Pressable
            key={t.key}
            onPress={() => onSelect(t.key)}
            style={[ps.tabBtn, active && { borderBottomWidth: 2, borderBottomColor: c.teal }]}
          >
            <Text style={[ps.tabLabel, { color: active ? c.teal : c.textMuted }, active && { fontWeight: '700' }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Scorecard tab ────────────────────────────────────────────────────
function ScorecardTab({
  players,
  holes,
  allScores,
  scoreMode,
  handicapStrokes,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
  scoreMode: string;
  handicapStrokes: Map<string, Map<number, number>>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);
  const hasFront = front.length > 0;
  const hasBack = back.length > 0;

  function cellColor(gross: number, par: number): string {
    const diff = gross - par;
    if (diff <= -2) return c.gold;
    if (diff === -1) return c.teal;
    if (diff === 0) return c.text;
    if (diff === 1) return c.urgent;
    return '#C44B4F';
  }

  function cellWeight(gross: number, par: number): '400' | '700' | '800' {
    const diff = gross - par;
    if (diff <= -2) return '800';
    if (diff <= 0) return '700';
    return '400';
  }

  function renderNine(nineHoles: HoleData[], label: string) {
    const ninePar = nineHoles.reduce((a, h) => a + h.par, 0);
    return (
      <View key={label}>
        {/* Header row */}
        <View style={[ps.scRow, { backgroundColor: '#1E4D2B' }]}>
          <Text style={[ps.scCellHole, ps.scHeaderText]}>HOLE</Text>
          {nineHoles.map((h) => (
            <Text key={h.number} style={[ps.scCell, ps.scHeaderText]}>{h.number}</Text>
          ))}
          <Text style={[ps.scCellTotal, ps.scHeaderText]}>{label}</Text>
        </View>
        {/* Par row */}
        <View style={[ps.scRow, { backgroundColor: c.elevated }]}>
          <Text style={[ps.scCellHole, ps.scParText, { color: c.textMuted }]}>Par</Text>
          {nineHoles.map((h) => (
            <Text key={h.number} style={[ps.scCell, ps.scParText, { color: c.textMuted }]}>{h.par}</Text>
          ))}
          <Text style={[ps.scCellTotal, ps.scParText, { color: c.textMuted }]}>{ninePar}</Text>
        </View>
        {/* Player rows */}
        {players.map((p, pi) => {
          const isMe = p.id === '1';
          let nineGross = 0;
          let nineNet = 0;
          return (
            <View
              key={p.id}
              style={[
                ps.scRow,
                { backgroundColor: isMe ? `${c.teal}08` : pi % 2 === 0 ? c.cardBg : c.surface },
              ]}
            >
              <Text
                style={[ps.scCellHole, ps.scPlayerLabel, { color: isMe ? c.teal : c.text }]}
                numberOfLines={1}
              >
                {isMe ? 'You' : p.name.split(' ')[0]}
              </Text>
              {nineHoles.map((h) => {
                const s = allScores.get(h.number)?.get(p.id);
                if (!s) return <Text key={h.number} style={[ps.scCell, { color: c.textMuted }]}>-</Text>;
                nineGross += s.gross;
                const strokes = handicapStrokes.get(p.id)?.get(h.number) ?? 0;
                nineNet += s.gross - strokes;
                return (
                  <Text
                    key={h.number}
                    style={[
                      ps.scCell,
                      {
                        color: cellColor(s.gross, h.par),
                        fontWeight: cellWeight(s.gross, h.par),
                        fontFamily: GEO,
                      },
                    ]}
                  >
                    {s.gross}
                  </Text>
                );
              })}
              <View style={ps.scCellTotal}>
                <Text style={[ps.scTotalText, { color: c.text, fontFamily: GEO }]}>{nineGross || '-'}</Text>
                {scoreMode === 'net' && nineNet !== nineGross && (
                  <Text style={[ps.scNetText, { color: c.gold, fontFamily: GEO }]}>{nineNet}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  // Grand totals
  const totalPar = holes.reduce((a, h) => a + h.par, 0);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
      <View>
        {hasFront && renderNine(front, 'OUT')}
        {hasBack && renderNine(back, 'IN')}

        {/* Total row */}
        <View style={[ps.scRow, { backgroundColor: '#1E4D2B' }]}>
          <Text style={[ps.scCellHole, ps.scHeaderText]}>TOTAL</Text>
          <View style={{ width: (hasFront ? front.length : back.length) * 32 }} />
          <Text style={[ps.scCellTotal, ps.scHeaderText]}>{totalPar}</Text>
        </View>
        {players.map((p, pi) => {
          const isMe = p.id === '1';
          let totalGross = 0;
          let totalNet = 0;
          holes.forEach((h) => {
            const s = allScores.get(h.number)?.get(p.id);
            if (s) {
              totalGross += s.gross;
              totalNet += s.gross - (handicapStrokes.get(p.id)?.get(h.number) ?? 0);
            }
          });
          const diff = totalGross - totalPar;
          return (
            <View
              key={p.id}
              style={[
                ps.scRow,
                { backgroundColor: isMe ? `${c.teal}08` : pi % 2 === 0 ? c.cardBg : c.surface },
              ]}
            >
              <Text
                style={[ps.scCellHole, ps.scPlayerLabel, { color: isMe ? c.teal : c.text }]}
                numberOfLines={1}
              >
                {isMe ? 'You' : p.name.split(' ')[0]}
              </Text>
              <View style={{ width: (hasFront ? front.length : back.length) * 32 }} />
              <View style={ps.scCellTotal}>
                <Text style={[ps.scTotalText, { color: toParColor(diff, c), fontFamily: GEO, fontWeight: '700' }]}>
                  {totalGross} ({formatToPar(totalGross, totalPar)})
                </Text>
                {scoreMode === 'net' && (
                  <Text style={[ps.scNetText, { color: c.gold, fontFamily: GEO }]}>Net: {totalNet}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── Stats tab ────────────────────────────────────────────────────────
function StatsTab({
  playerTotals,
  holes,
}: {
  playerTotals: PlayerTotals[];
  holes: HoleData[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const totalPar = holes.reduce((a, h) => a + h.par, 0);

  return (
    <View>
      {playerTotals.map((row) => {
        const isMe = row.player.id === '1';
        const scoringAvg = row.holesPlayed > 0 ? (row.gross / row.holesPlayed).toFixed(1) : '-';
        const upDownPct = row.upDownAttempts > 0
          ? `${Math.round((row.upDownMade / row.upDownAttempts) * 100)}%`
          : '-';

        return (
          <View key={row.player.id} style={[ps.statPlayerCard, { backgroundColor: c.cardBg, borderColor: c.border }, theme.isDark ? cardShadowDark : cardShadowLight]}>
            <View style={ps.statPlayerHeader}>
              <Avatar id={row.player.id} size={28} name={row.player.name} />
              <Text style={[ps.statPlayerName, { color: isMe ? c.teal : c.text }]}>
                {isMe ? 'You' : row.player.name}
              </Text>
              <Text style={[ps.statPlayerScore, { color: toParColor(row.gross - totalPar, c), fontFamily: GEO }]}>
                {row.gross} ({formatToPar(row.gross, totalPar)})
              </Text>
            </View>

            {/* Primary stats */}
            <View style={ps.statGrid}>
              <StatItem label="Fairways" value={`${row.firHit}/${row.firTotal}`} sub={row.firTotal > 0 ? `${Math.round((row.firHit / row.firTotal) * 100)}%` : ''} c={c} />
              <StatItem label="Greens (GIR)" value={`${row.girCount}/${row.holesPlayed}`} sub={row.holesPlayed > 0 ? `${Math.round((row.girCount / row.holesPlayed) * 100)}%` : ''} c={c} />
              <StatItem label="Total Putts" value={String(row.putts)} sub={row.holesPlayed > 0 ? `${(row.putts / row.holesPlayed).toFixed(1)}/hole` : ''} c={c} />
              <StatItem label="Scoring Avg" value={scoringAvg} sub="per hole" c={c} />
              <StatItem label="Up & Down" value={upDownPct} sub={`${row.upDownMade}/${row.upDownAttempts}`} c={c} />
            </View>

            {/* Par averages */}
            <View style={[ps.parAvgRow, { borderColor: c.border }]}>
              <ParAvgItem label="Par 3s" avg={row.par3Avg} par={3} c={c} />
              <ParAvgItem label="Par 4s" avg={row.par4Avg} par={4} c={c} />
              <ParAvgItem label="Par 5s" avg={row.par5Avg} par={5} c={c} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StatItem({
  label,
  value,
  sub,
  c,
}: {
  label: string;
  value: string;
  sub: string;
  c: ReturnType<typeof useTheme>['theme']['colors'];
}) {
  return (
    <View style={ps.statItem}>
      <Text style={[ps.statItemLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[ps.statItemValue, { color: c.text, fontFamily: GEO }]}>{value}</Text>
      {sub.length > 0 && <Text style={[ps.statItemSub, { color: c.textMuted }]}>{sub}</Text>}
    </View>
  );
}

function ParAvgItem({
  label,
  avg,
  par,
  c,
}: {
  label: string;
  avg: number;
  par: number;
  c: ReturnType<typeof useTheme>['theme']['colors'];
}) {
  const diff = avg > 0 ? avg - par : 0;
  return (
    <View style={ps.parAvgItem}>
      <Text style={[ps.parAvgLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[ps.parAvgValue, { color: avg > 0 ? toParColor(diff, c) : c.textMuted, fontFamily: GEO }]}>
        {avg > 0 ? avg.toFixed(1) : '-'}
      </Text>
    </View>
  );
}

// ─── Games tab ────────────────────────────────────────────────────────
function GamesTab({
  sideGameKeys,
  players,
  holes,
  allScores,
}: {
  sideGameKeys: string[];
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (sideGameKeys.length === 0) {
    return (
      <View style={ps.gamesEmpty}>
        <Ionicons name="game-controller-outline" size={36} color={c.border} />
        <Text style={[ps.gamesEmptyText, { color: c.textMuted }]}>No side games this round</Text>
      </View>
    );
  }

  // Generate mock results for each side game
  const results = sideGameKeys.map((key) => {
    const label = SIDE_GAME_DISPLAY[key] ?? key;

    if (key === 'skins') return buildSkinsResult(label, players, holes, allScores, c);
    if (key === 'snake') return buildSnakeResult(label, players, holes, allScores);
    if (key === 'greenies') return buildGreeniesResult(label, players, holes, allScores);
    if (key === 'nassau') return buildNassauResult(label, players, holes, allScores);
    if (key === 'dots') return buildDotsResult(label, players, holes, allScores);
    // Generic for others
    return buildGenericResult(label, players);
  });

  return (
    <View>
      {results.map((r, i) => (
        <View key={i} style={[ps.gameCard, { backgroundColor: c.cardBg, borderColor: c.border }, theme.isDark ? cardShadowDark : cardShadowLight]}>
          <Text style={[ps.gameTitle, { color: c.gold, fontFamily: GEO }]}>{r.title}</Text>
          {r.lines.map((line, li) => (
            <View key={li} style={ps.gameLine}>
              <Text style={[ps.gameLineText, { color: line.highlight ? c.teal : c.text }]}>
                {line.text}
              </Text>
              {line.value !== undefined && (
                <Text style={[ps.gameLineValue, { color: line.highlight ? c.teal : c.gold, fontFamily: GEO }]}>
                  {line.value}
                </Text>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

type GameResult = {
  title: string;
  lines: { text: string; value?: string; highlight?: boolean }[];
};

function pName(p: PlayerConfig): string {
  return p.id === '1' ? 'You' : p.name.split(' ')[0];
}

function buildSkinsResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): GameResult {
  const skinWins = new Map<string, number>();
  players.forEach((p) => skinWins.set(p.id, 0));
  let carryover = 0;

  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores || holeScores.size < players.length) { carryover++; return; }
    let best = Infinity;
    let winners: string[] = [];
    holeScores.forEach((s, pid) => {
      if (s.gross < best) { best = s.gross; winners = [pid]; }
      else if (s.gross === best) winners.push(pid);
    });
    if (winners.length === 1) {
      skinWins.set(winners[0], (skinWins.get(winners[0]) ?? 0) + 1 + carryover);
      carryover = 0;
    } else {
      carryover++;
    }
  });

  const lines: GameResult['lines'] = players
    .map((p) => ({
      text: pName(p),
      value: `${skinWins.get(p.id) ?? 0} skins`,
      highlight: p.id === '1',
    }))
    .sort((a, b) => parseInt(b.value!) - parseInt(a.value!));

  if (carryover > 0) lines.push({ text: `${carryover} skin${carryover !== 1 ? 's' : ''} carried over` });

  return { title: label, lines };
}

function buildSnakeResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
): GameResult {
  // Snake: last person to 3-putt holds it
  let holder: string | null = null;
  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    holeScores.forEach((s, pid) => {
      if (s.putts >= 3) holder = pid;
    });
  });

  const holderPlayer = holder ? players.find((p) => p.id === holder) : null;
  return {
    title: label,
    lines: [
      {
        text: holderPlayer ? `${pName(holderPlayer)} holds the snake` : 'No 3-putts!',
        highlight: holder === '1',
      },
    ],
  };
}

function buildGreeniesResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
): GameResult {
  const par3s = holes.filter((h) => h.par === 3);
  const wins = new Map<string, number>();
  players.forEach((p) => wins.set(p.id, 0));

  par3s.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    // Closest to pin approximation: lowest score wins
    let best = Infinity;
    let winner: string | null = null;
    holeScores.forEach((s, pid) => {
      if (s.gross < best) { best = s.gross; winner = pid; }
    });
    if (winner) wins.set(winner, (wins.get(winner) ?? 0) + 1);
  });

  return {
    title: label,
    lines: players
      .filter((p) => (wins.get(p.id) ?? 0) > 0)
      .map((p) => ({ text: pName(p), value: `${wins.get(p.id)} greenie${(wins.get(p.id) ?? 0) !== 1 ? 's' : ''}`, highlight: p.id === '1' })),
  };
}

function buildNassauResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
): GameResult {
  if (players.length < 2) return { title: label, lines: [{ text: 'Need 2+ players' }] };

  function nineTotal(pid: string, nineHoles: HoleData[]): number {
    let t = 0;
    nineHoles.forEach((h) => { const s = allScores.get(h.number)?.get(pid); if (s) t += s.gross; });
    return t;
  }

  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);
  const lines: GameResult['lines'] = [];

  // Front 9 winner
  if (front.length > 0) {
    let best = Infinity; let winner = '';
    players.forEach((p) => { const t = nineTotal(p.id, front); if (t > 0 && t < best) { best = t; winner = p.id; } });
    const wp = players.find((p) => p.id === winner);
    if (wp) lines.push({ text: `Front 9: ${pName(wp)}`, value: String(best), highlight: winner === '1' });
  }
  if (back.length > 0) {
    let best = Infinity; let winner = '';
    players.forEach((p) => { const t = nineTotal(p.id, back); if (t > 0 && t < best) { best = t; winner = p.id; } });
    const wp = players.find((p) => p.id === winner);
    if (wp) lines.push({ text: `Back 9: ${pName(wp)}`, value: String(best), highlight: winner === '1' });
  }
  // Overall
  {
    let best = Infinity; let winner = '';
    players.forEach((p) => { const t = nineTotal(p.id, holes); if (t > 0 && t < best) { best = t; winner = p.id; } });
    const wp = players.find((p) => p.id === winner);
    if (wp) lines.push({ text: `Overall: ${pName(wp)}`, value: String(best), highlight: winner === '1' });
  }

  return { title: label, lines };
}

function buildDotsResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
): GameResult {
  // Dots: +1 for birdie, +2 for eagle, -1 for double+
  const dots = new Map<string, number>();
  players.forEach((p) => dots.set(p.id, 0));

  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    holeScores.forEach((s, pid) => {
      const diff = s.gross - h.par;
      let pts = 0;
      if (diff <= -2) pts = 2;
      else if (diff === -1) pts = 1;
      else if (diff >= 2) pts = -1;
      dots.set(pid, (dots.get(pid) ?? 0) + pts);
    });
  });

  return {
    title: label,
    lines: players
      .map((p) => ({
        text: pName(p),
        value: `${(dots.get(p.id) ?? 0) >= 0 ? '+' : ''}${dots.get(p.id) ?? 0} pts`,
        highlight: p.id === '1',
      }))
      .sort((a, b) => parseInt(b.value!) - parseInt(a.value!)),
  };
}

function buildGenericResult(label: string, players: PlayerConfig[]): GameResult {
  return {
    title: label,
    lines: [{ text: 'Results tracked — detailed scoring coming soon' }],
  };
}

// ─── Feature 5: Settlement Section ────────────────────────────────────
function SettlementSection({
  sideGameKeys,
  players,
  holes,
  allScores,
}: {
  sideGameKeys: string[];
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  // Calculate payouts per side game
  const payouts = new Map<string, number>(); // playerId -> net amount
  players.forEach((p) => payouts.set(p.id, 0));

  sideGameKeys.forEach((key) => {
    if (key === 'nassau') {
      // $5 per bet: front, back, overall
      const front = holes.filter((h) => h.number <= 9);
      const back = holes.filter((h) => h.number > 9);
      const segments = [front, back, holes];
      segments.forEach((seg) => {
        if (seg.length === 0) return;
        let best = Infinity;
        let winner = '';
        players.forEach((p) => {
          let total = 0;
          seg.forEach((h) => {
            const s = allScores.get(h.number)?.get(p.id);
            if (s) total += s.gross;
          });
          if (total > 0 && total < best) { best = total; winner = p.id; }
        });
        if (winner) {
          players.forEach((p) => {
            if (p.id !== winner) {
              payouts.set(p.id, (payouts.get(p.id) ?? 0) - 5);
              payouts.set(winner, (payouts.get(winner) ?? 0) + 5);
            }
          });
        }
      });
    }

    if (key === 'skins') {
      // $2 per skin
      const skinWins = new Map<string, number>();
      players.forEach((p) => skinWins.set(p.id, 0));
      let carryover = 0;
      holes.forEach((h) => {
        const holeScores = allScores.get(h.number);
        if (!holeScores || holeScores.size < players.length) { carryover++; return; }
        let best = Infinity;
        let winners: string[] = [];
        holeScores.forEach((s, pid) => {
          if (s.gross < best) { best = s.gross; winners = [pid]; }
          else if (s.gross === best) winners.push(pid);
        });
        if (winners.length === 1) {
          skinWins.set(winners[0], (skinWins.get(winners[0]) ?? 0) + 1 + carryover);
          carryover = 0;
        } else { carryover++; }
      });
      skinWins.forEach((count, pid) => {
        const winnings = count * 2;
        payouts.set(pid, (payouts.get(pid) ?? 0) + winnings);
        // Distribute losses equally among others
        const perLoser = winnings / (players.length - 1);
        players.forEach((p) => {
          if (p.id !== pid) payouts.set(p.id, (payouts.get(p.id) ?? 0) - perLoser);
        });
      });
    }

    if (key === 'dots') {
      // $1 per dot difference
      const dots = new Map<string, number>();
      players.forEach((p) => dots.set(p.id, 0));
      holes.forEach((h) => {
        const holeScores = allScores.get(h.number);
        if (!holeScores) return;
        holeScores.forEach((s, pid) => {
          const diff = s.gross - h.par;
          let pts = 0;
          if (diff <= -2) pts = 2;
          else if (diff === -1) pts = 1;
          else if (diff >= 2) pts = -1;
          dots.set(pid, (dots.get(pid) ?? 0) + pts);
        });
      });
      // Each pair settles dot difference at $1
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const diff = (dots.get(players[i].id) ?? 0) - (dots.get(players[j].id) ?? 0);
          payouts.set(players[i].id, (payouts.get(players[i].id) ?? 0) + diff);
          payouts.set(players[j].id, (payouts.get(players[j].id) ?? 0) - diff);
        }
      }
    }

    if (key === 'snake') {
      // $5 penalty for last holder
      let holder: string | null = null;
      holes.forEach((h) => {
        const holeScores = allScores.get(h.number);
        if (!holeScores) return;
        holeScores.forEach((s, pid) => {
          if (s.putts >= 3) holder = pid;
        });
      });
      if (holder) {
        payouts.set(holder, (payouts.get(holder) ?? 0) - 5 * (players.length - 1));
        players.forEach((p) => {
          if (p.id !== holder) payouts.set(p.id, (payouts.get(p.id) ?? 0) + 5);
        });
      }
    }
  });

  // Build "who owes whom" pairs
  const settlements: { from: string; to: string; amount: number }[] = [];
  const balances = new Map(payouts);
  const sortedPlayers = [...players].sort((a, b) => (balances.get(a.id) ?? 0) - (balances.get(b.id) ?? 0));

  let i = 0;
  let j = sortedPlayers.length - 1;
  while (i < j) {
    const debtor = sortedPlayers[i];
    const creditor = sortedPlayers[j];
    const debtorBal = balances.get(debtor.id) ?? 0;
    const creditorBal = balances.get(creditor.id) ?? 0;
    if (debtorBal >= 0 || creditorBal <= 0) break;
    const amount = Math.min(-debtorBal, creditorBal);
    if (amount > 0.01) {
      settlements.push({ from: debtor.id, to: creditor.id, amount: Math.round(amount * 100) / 100 });
    }
    balances.set(debtor.id, debtorBal + amount);
    balances.set(creditor.id, creditorBal - amount);
    if (Math.abs(balances.get(debtor.id) ?? 0) < 0.01) i++;
    if (Math.abs(balances.get(creditor.id) ?? 0) < 0.01) j--;
  }

  return (
    <View style={ps.settlementSection}>
      <Text style={[ps.sectionTitle, { color: c.gold, fontFamily: GEO }]}>SETTLEMENT</Text>
      <View style={[ps.settlementCard, { backgroundColor: c.cardBg, borderColor: c.border }, theme.isDark ? cardShadowDark : cardShadowLight]}>
        {settlements.length === 0 ? (
          <Text style={[ps.settlementEmpty, { color: c.textMuted }]}>No payouts to settle</Text>
        ) : (
          <>
            <Text style={[ps.settlementSubtitle, { color: c.textMuted }]}>WHO OWES WHOM</Text>
            {settlements.map((s, idx) => {
              const fromP = players.find((p) => p.id === s.from);
              const toP = players.find((p) => p.id === s.to);
              return (
                <View key={idx} style={[ps.settlementRow, { borderColor: c.border }]}>
                  <Text style={[ps.settlementName, { color: c.urgent }]}>
                    {pName(fromP!)}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={c.textMuted} />
                  <Text style={[ps.settlementName, { color: c.teal }]}>
                    {pName(toP!)}
                  </Text>
                  <Text style={[ps.settlementAmount, { color: c.gold, fontFamily: GEO }]}>
                    ${s.amount.toFixed(0)}
                  </Text>
                </View>
              );
            })}
          </>
        )}
        <Pressable
          onPress={() => Alert.alert('Settle Up', 'Venmo / Cash settlement will be tracked here in production.')}
          style={({ pressed }) => [ps.settleUpBtn, { backgroundColor: c.teal }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={ps.settleUpBtnText}>Settle Up</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Share card ───────────────────────────────────────────────────────
function ShareCard({
  courseName,
  players,
  playerTotals,
  totalPar,
  onShare,
}: {
  courseName: string;
  players: PlayerConfig[];
  playerTotals: PlayerTotals[];
  totalPar: number;
  onShare: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const sorted = [...playerTotals].sort((a, b) => a.gross - b.gross);
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <View style={ps.shareSection}>
      {/* Preview card */}
      <LinearGradient
        colors={[...greenHeaderGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ps.sharePreview}
      >
        <Text style={[ps.shareDormie, { fontFamily: GEO }]}>DORMIE</Text>
        <Text style={[ps.shareCourse, { fontFamily: GEO }]}>{courseName}</Text>
        <Text style={ps.shareDate}>{today}</Text>

        <View style={ps.shareScores}>
          {sorted.map((row) => {
            const diff = row.gross - totalPar;
            return (
              <View key={row.player.id} style={ps.shareScoreRow}>
                <Text style={ps.sharePlayerName}>{pName(row.player)}</Text>
                <Text style={[ps.sharePlayerScore, { fontFamily: GEO }]}>{row.gross}</Text>
                <Text
                  style={[
                    ps.sharePlayerToPar,
                    { color: diff < 0 ? '#2A9D8F' : diff === 0 ? '#D4AF37' : '#C44B4F', fontFamily: GEO },
                  ]}
                >
                  {formatToPar(row.gross, totalPar)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Key stats for first player */}
        {sorted.length > 0 && (
          <View style={ps.shareStatsRow}>
            <Text style={ps.shareStat}>{sorted[0].putts} putts</Text>
            <Text style={ps.shareStat}>
              {sorted[0].firTotal > 0 ? Math.round((sorted[0].firHit / sorted[0].firTotal) * 100) : 0}% FIR
            </Text>
            <Text style={ps.shareStat}>
              {sorted[0].holesPlayed > 0 ? Math.round((sorted[0].girCount / sorted[0].holesPlayed) * 100) : 0}% GIR
            </Text>
          </View>
        )}
      </LinearGradient>

      <Pressable onPress={onShare} style={({ pressed }) => [ps.shareBtn, { backgroundColor: c.elevated, borderColor: c.border }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
        <Ionicons name="share-outline" size={18} color={c.teal} />
        <Text style={[ps.shareBtnText, { color: c.teal }]}>Share Round</Text>
      </Pressable>
    </View>
  );
}

// ─── PostRoundSummary (3-tab) ─────────────────────────────────────────
function PostRoundSummary({
  players,
  holes,
  allScores,
  scoreMode,
  handicapStrokes,
  courseName,
  formatLabel,
  sideGameKeys,
  onDone,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
  scoreMode: string;
  handicapStrokes: Map<string, Map<number, number>>;
  courseName: string;
  formatLabel: string;
  sideGameKeys: string[];
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [tab, setTab] = useState<SummaryTab>('scorecard');

  const totalPar = holes.reduce((a, h) => a + h.par, 0);
  const playerTotals = useMemo(
    () => computePlayerTotals(players, holes, allScores, handicapStrokes),
    [players, holes, allScores, handicapStrokes],
  );
  const sorted = useMemo(() => [...playerTotals].sort((a, b) => a.gross - b.gross), [playerTotals]);

  return (
    <View style={[ps.screen, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={[...greenHeaderGradient]} style={ps.header}>
          <View style={st.headerOverlay} />
          <Text style={[ps.headerTitle, { fontFamily: GEO }]}>Round Complete</Text>
          <Text style={ps.headerSub}>{courseName} · {holes.length} holes · Par {totalPar}</Text>
          <Text style={ps.headerFormat}>{formatLabel}</Text>
        </LinearGradient>

        {/* Final standings (always visible) */}
        <View style={ps.body}>
          <Text style={[ps.sectionTitle, { color: c.gold, fontFamily: GEO }]}>FINAL STANDINGS</Text>
          <View style={[ps.standingsTable, { borderColor: c.border }, theme.isDark ? cardShadowDark : cardShadowLight]}>
            <View style={[ps.standingsRow, { backgroundColor: '#1E4D2B' }]}>
              <Text style={[ps.stColPos, ps.stHeader]}>POS</Text>
              <Text style={[ps.stColName, ps.stHeader]}>PLAYER</Text>
              <Text style={[ps.stColNum, ps.stHeader]}>GROSS</Text>
              {scoreMode === 'net' && <Text style={[ps.stColNum, ps.stHeader]}>NET</Text>}
              <Text style={[ps.stColNum, ps.stHeader]}>TO PAR</Text>
            </View>
            {sorted.map((row, i) => {
              const pos = i + 1;
              const medal = pos === 1 ? '\u{1F947}' : pos === 2 ? '\u{1F948}' : pos === 3 ? '\u{1F949}' : '';
              const isMe = row.player.id === '1';
              const diff = row.gross - totalPar;
              return (
                <View
                  key={row.player.id}
                  style={[
                    ps.standingsRow,
                    { backgroundColor: isMe ? `${c.teal}12` : i % 2 === 0 ? c.cardBg : c.elevated },
                    isMe && { borderLeftWidth: 2, borderLeftColor: c.teal },
                  ]}
                >
                  <Text style={[ps.stColPos, { color: c.textMuted, fontSize: 13, fontWeight: '600' as const }]}>{medal || pos}</Text>
                  <View style={[ps.stColName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <Avatar id={row.player.id} size={22} name={row.player.name} />
                    <Text style={[{ fontSize: 12, color: isMe ? c.teal : c.text }, isMe && { fontWeight: '700' as const }]} numberOfLines={1}>
                      {isMe ? 'You' : row.player.name}
                    </Text>
                  </View>
                  <Text style={[ps.stColNum, { color: c.text, fontFamily: GEO, fontWeight: '700' as const }]}>{row.gross}</Text>
                  {scoreMode === 'net' && <Text style={[ps.stColNum, { color: c.gold, fontFamily: GEO, fontWeight: '700' as const }]}>{row.net}</Text>}
                  <Text style={[ps.stColNum, { color: toParColor(diff, c), fontFamily: GEO, fontWeight: '700' as const }]}>{formatToPar(row.gross, totalPar)}</Text>
                </View>
              );
            })}
          </View>

          {/* Tab bar */}
          <GoldDivider style={{ marginTop: 20 }} />
          <SummaryTabBar tab={tab} onSelect={setTab} hasGames={sideGameKeys.length > 0} />

          {/* Tab content */}
          {tab === 'scorecard' && (
            <ScorecardTab
              players={players}
              holes={holes}
              allScores={allScores}
              scoreMode={scoreMode}
              handicapStrokes={handicapStrokes}
            />
          )}
          {tab === 'stats' && <StatsTab playerTotals={playerTotals} holes={holes} />}
          {tab === 'games' && (
            <GamesTab
              sideGameKeys={sideGameKeys}
              players={players}
              holes={holes}
              allScores={allScores}
            />
          )}

          {/* Feature 5: Settlement / Payout Calculator */}
          {sideGameKeys.length > 0 && <GoldDivider style={{ marginTop: 20 }} />}
          {sideGameKeys.length > 0 && (
            <SettlementSection
              sideGameKeys={sideGameKeys}
              players={players}
              holes={holes}
              allScores={allScores}
            />
          )}

          {/* Share card */}
          <ShareCard
            courseName={courseName}
            players={players}
            playerTotals={playerTotals}
            totalPar={totalPar}
            onShare={() => Alert.alert('Share', 'Sharing will generate an image in production.')}
          />

          {/* Save button */}
          <Pressable onPress={onDone} style={({ pressed }) => [ps.saveBtn, { backgroundColor: '#1E4D2B' }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
            <Text style={[ps.saveBtnText, { color: '#D4AF37', fontFamily: GEO }]}>Post Score</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function MiniStat({
  label,
  value,
  color,
  c,
}: {
  label: string;
  value: string;
  color: string;
  c: ReturnType<typeof useTheme>['theme']['colors'];
}) {
  return (
    <View style={st.miniStat}>
      <Text style={[st.miniStatValue, { color, fontFamily: GEO }]}>{value}</Text>
      <Text style={[st.miniStatLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Feature 13: Running Side Game Panels ─────────────────────────────
function RunningSkinsPanel({
  players, holes, allScores, currentHoleNumber,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
  currentHoleNumber: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const skinWins = new Map<string, number>();
  players.forEach((p) => skinWins.set(p.id, 0));
  let carryover = 0;

  holes.forEach((h) => {
    if (h.number > currentHoleNumber) return;
    const holeScores = allScores.get(h.number);
    if (!holeScores || holeScores.size < players.length) { carryover++; return; }
    let best = Infinity;
    let winners: string[] = [];
    holeScores.forEach((s, pid) => {
      if (s.gross < best) { best = s.gross; winners = [pid]; }
      else if (s.gross === best) winners.push(pid);
    });
    if (winners.length === 1) {
      skinWins.set(winners[0], (skinWins.get(winners[0]) ?? 0) + 1 + carryover);
      carryover = 0;
    } else { carryover++; }
  });

  return (
    <View style={st.runningGameSection}>
      <Text style={[st.runningGameTitle, { color: c.gold, fontFamily: GEO }]}>SKINS</Text>
      {players.map((p) => (
        <View key={p.id} style={st.runningGameRow}>
          <Text style={[st.runningGameName, { color: p.id === '1' ? c.teal : c.text }]}>
            {p.id === '1' ? 'You' : p.name.split(' ')[0]}
          </Text>
          <Text style={[st.runningGameValue, { color: c.text, fontFamily: GEO }]}>
            {skinWins.get(p.id) ?? 0} skins
          </Text>
        </View>
      ))}
      {carryover > 0 && (
        <Text style={[st.runningGameNote, { color: c.textMuted }]}>
          {carryover} carried over
        </Text>
      )}
    </View>
  );
}

function RunningDotsPanel({
  players, holes, allScores,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const dots = new Map<string, number>();
  players.forEach((p) => dots.set(p.id, 0));

  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    holeScores.forEach((s, pid) => {
      const diff = s.gross - h.par;
      let pts = 0;
      if (diff <= -2) pts = 2;
      else if (diff === -1) pts = 1;
      else if (diff >= 2) pts = -1;
      dots.set(pid, (dots.get(pid) ?? 0) + pts);
    });
  });

  return (
    <View style={st.runningGameSection}>
      <Text style={[st.runningGameTitle, { color: c.gold, fontFamily: GEO }]}>DOTS</Text>
      {players.map((p) => {
        const val = dots.get(p.id) ?? 0;
        return (
          <View key={p.id} style={st.runningGameRow}>
            <Text style={[st.runningGameName, { color: p.id === '1' ? c.teal : c.text }]}>
              {p.id === '1' ? 'You' : p.name.split(' ')[0]}
            </Text>
            <Text style={[st.runningGameValue, { color: val >= 0 ? c.teal : c.urgent, fontFamily: GEO }]}>
              {val >= 0 ? '+' : ''}{val}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function RunningNassauPanel({
  players, holes, allScores,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  function segmentLeader(segHoles: HoleData[]): string {
    let best = Infinity;
    let leader = '';
    players.forEach((p) => {
      let total = 0;
      segHoles.forEach((h) => {
        const s = allScores.get(h.number)?.get(p.id);
        if (s) total += s.gross;
      });
      if (total > 0 && total < best) { best = total; leader = p.id; }
    });
    const lp = players.find((p) => p.id === leader);
    return lp ? pName(lp) : 'Tied';
  }

  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);

  return (
    <View style={st.runningGameSection}>
      <Text style={[st.runningGameTitle, { color: c.gold, fontFamily: GEO }]}>NASSAU</Text>
      {front.length > 0 && (
        <View style={st.runningGameRow}>
          <Text style={[st.runningGameName, { color: c.textMuted }]}>Front 9</Text>
          <Text style={[st.runningGameValue, { color: c.text }]}>{segmentLeader(front)}</Text>
        </View>
      )}
      {back.length > 0 && (
        <View style={st.runningGameRow}>
          <Text style={[st.runningGameName, { color: c.textMuted }]}>Back 9</Text>
          <Text style={[st.runningGameValue, { color: c.text }]}>{segmentLeader(back)}</Text>
        </View>
      )}
      <View style={st.runningGameRow}>
        <Text style={[st.runningGameName, { color: c.textMuted }]}>Overall</Text>
        <Text style={[st.runningGameValue, { color: c.text }]}>{segmentLeader(holes)}</Text>
      </View>
    </View>
  );
}

function RunningSnakePanel({
  players, holes, allScores,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  let holder: string | null = null;
  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    holeScores.forEach((s, pid) => {
      if (s.putts >= 3) holder = pid;
    });
  });
  const holderPlayer = holder ? players.find((p) => p.id === holder) : null;

  return (
    <View style={st.runningGameSection}>
      <Text style={[st.runningGameTitle, { color: c.gold, fontFamily: GEO }]}>SNAKE</Text>
      <View style={st.runningGameRow}>
        <Text style={[st.runningGameName, { color: c.textMuted }]}>Current holder</Text>
        <Text style={[st.runningGameValue, { color: holder ? c.urgent : c.teal }]}>
          {holderPlayer ? pName(holderPlayer) : 'Nobody'}
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────
export default function ScoringScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    courseName: string;
    coursePar: string;
    courseSlope: string;
    courseRating: string;
    courseTee: string;
    players: string;
    format: string;
    holeRange: string;
    scoreMode: string;
    sideGames: string;
    courseId: string;
    roundType: string;
    holeData: string;
    // Feature 24: Season params
    seasonName: string;
    seasonWeek: string;
    seasonFormat: string;
    seasonMultiplier: string;
    // Multi-competition params
    linkedSeasons: string;
    tripId: string;
    matchupOpponent: string;
  }>();

  const courseName = params.courseName ?? 'Course';
  const coursePar = Number(params.coursePar) || 72;
  const courseSlope = Number(params.courseSlope) || 113;
  const courseRating = Number(params.courseRating) || 72;
  const courseTee = params.courseTee ?? '';
  const courseId = params.courseId ?? '';
  const holeRange = params.holeRange ?? 'full18';
  const scoreMode = params.scoreMode ?? 'gross';
  const formatLabel = params.format ?? 'Total Strokes';
  const sideGameKeys: string[] = useMemo(() => {
    try { return JSON.parse(params.sideGames ?? '[]'); } catch { return []; }
  }, [params.sideGames]);

  // Parse per-hole data from score setup screen
  const passedHoleData: HoleData[] | null = useMemo(() => {
    if (!params.holeData) return null;
    try {
      const parsed = JSON.parse(params.holeData);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    return null;
  }, [params.holeData]);

  // Item 35: Round type
  const roundType = params.roundType ?? 'Casual';

  // Feature 24 / Item 36: Season params (with mock data fallback)
  const seasonName = params.seasonName || 'Spring Championship';
  const seasonWeek = params.seasonWeek || '7';
  const seasonFormat = params.seasonFormat || 'Stableford';
  const seasonMultiplier = Number(params.seasonMultiplier) || 2;

  // Parse multi-competition params
  const linkedSeasons: LinkedSeason[] = useMemo(() => {
    if (!params.linkedSeasons) return [];
    try { return JSON.parse(params.linkedSeasons); } catch { return []; }
  }, [params.linkedSeasons]);

  const tripId = params.tripId ?? null;
  const matchupOpponent = params.matchupOpponent ?? null;
  const linkedTrip = tripId ? MOCK_UPCOMING_TRIPS.find((t) => t.id === tripId) : null;

  // Build competition tabs for scoreboard overlay
  const competitionTabs: CompetitionTab[] = useMemo(() => {
    const tabs: CompetitionTab[] = [];
    linkedSeasons.forEach((s) => {
      tabs.push({ key: `season-${s.seasonId}`, label: s.seasonName.length > 16 ? s.seasonName.slice(0, 14) + '…' : s.seasonName, type: 'season', data: s });
    });
    if (linkedTrip) tabs.push({ key: 'trip', label: linkedTrip.name, type: 'trip' });
    if (matchupOpponent) tabs.push({ key: 'matchup', label: 'Matchup', type: 'matchup' });
    tabs.push({ key: 'round', label: 'Round', type: 'round' });
    return tabs;
  }, [linkedSeasons, linkedTrip, matchupOpponent]);

  const players: PlayerConfig[] = useMemo(() => {
    try {
      return JSON.parse(params.players ?? '[]');
    } catch {
      return [{ id: '1', name: 'Ian McGowan', handicap: 8 }];
    }
  }, [params.players]);

  const holes = useMemo(() => {
    // Use per-hole data from score setup if available (has real pars, yardages, stroke indices)
    if (passedHoleData && passedHoleData.length > 0) {
      let hd = passedHoleData.map((h, i) => ({
        number: h.number ?? i + 1,
        par: h.par ?? 4,
        strokeIndex: h.strokeIndex ?? i + 1,
        yards: h.yards,
      }));
      if (holeRange === 'front9') hd = hd.filter((h) => h.number <= 9);
      else if (holeRange === 'back9') hd = hd.filter((h) => h.number > 9);
      return hd;
    }
    return buildHoles(coursePar, holeRange);
  }, [passedHoleData, coursePar, holeRange]);

  // Handicap strokes per player per hole
  const handicapStrokes = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    players.forEach((p) => {
      const courseHcp = calcCourseHandicap(p.handicap, courseSlope, courseRating, coursePar);
      const holeMap = new Map<number, number>();
      holes.forEach((h) => {
        // Allocate strokes: if courseHcp >= strokeIndex, get 1 stroke
        // If courseHcp >= 18 + strokeIndex, get 2 strokes
        let strokes = 0;
        if (courseHcp >= h.strokeIndex) strokes++;
        if (courseHcp >= 18 + h.strokeIndex) strokes++;
        holeMap.set(h.number, strokes);
      });
      map.set(p.id, holeMap);
    });
    return map;
  }, [players, holes, courseSlope, courseRating, coursePar]);

  // State
  const [currentHoleIdx, setCurrentHoleIdx] = useState(0);
  const [allScores, setAllScores] = useState<Map<number, Map<string, HoleScore>>>(new Map());
  const [showSummary, setShowSummary] = useState(false);

  // Feature 1: Hammer game
  const [hammerState, setHammerState] = useState<HammerState>({
    active: false, thrower: '', target: '', multiplier: 2, pending: false,
  });
  const [showHammerModal, setShowHammerModal] = useState(false);
  const [hammerResults, setHammerResults] = useState<Map<number, HammerResult>>(new Map());

  // Feature 3: Putt distance prompt
  const [puttDistPrompt, setPuttDistPrompt] = useState<{ show: boolean; playerIdx: number; holeNumber: number }>({ show: false, playerIdx: 0, holeNumber: 1 });
  const [puttDist, setPuttDist] = useState<Map<number, Map<string, string>>>(new Map());

  // Feature 4: Best Ball 2v2
  const isBestBall = formatLabel.toLowerCase().includes('best ball') && players.length === 4;
  const [bestBallTeams, setBestBallTeams] = useState<{ team1: string[]; team2: string[] }>({
    team1: players.length >= 4 ? [players[0].id, players[1].id] : [],
    team2: players.length >= 4 ? [players[2].id, players[3].id] : [],
  });
  const [showBestBallSetup, setShowBestBallSetup] = useState(isBestBall);

  // Feature 6: Hole notes
  const [holeNotes, setHoleNotes] = useState<Map<number, string>>(new Map());
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Feature 10: Scorecard confirmation
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Feature 11: Pinned floating scoreboard
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [activeCompTab, setActiveCompTab] = useState('round');

  // Feature 12: Live feed
  const [scoringEvents, setScoringEvents] = useState<ScoringEvent[]>([]);
  const [showFeed, setShowFeed] = useState(false);
  const [lastReadEventCount, setLastReadEventCount] = useState(0);

  // Feature 13: Side game running panel
  const [showRunningPanel, setShowRunningPanel] = useState(false);

  // Feature 14: Scoring view mode toggle
  const [viewMode, setViewMode] = useState<'solo' | 'all'>('all');
  const [soloPlayerIdx, setSoloPlayerIdx] = useState(0);

  // Item 8: Side game ticker collapsed state
  const [sideGameTickerExpanded, setSideGameTickerExpanded] = useState(false);

  // Item 31: Dormie Moment state
  const [dormieMoment, setDormieMoment] = useState<{
    visible: boolean;
    type: MomentType;
    playerName: string;
    detail: string;
  }>({ visible: false, type: 'DORMIE', playerName: '', detail: '' });

  // Elite polish: confetti, personal best, toast
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPersonalBest, setShowPersonalBest] = useState(false);
  const [prevBest, setPrevBest] = useState<number | null>(null);
  const { showToast } = useToast();

  // Item 32: Side game toast events
  const [sideGameToastEvents, setSideGameToastEvents] = useState<SideGameEvent[]>([]);

  // Item 33: Hole transition banner
  const [transitionBanner, setTransitionBanner] = useState<{
    visible: boolean;
    holeNumber: number;
    par: number;
    results: PlayerHoleResult[];
  }>({ visible: false, holeNumber: 1, par: 4, results: [] });

  const currentHole = holes[currentHoleIdx];

  // Get or create scores for current hole
  const currentHoleScores = useMemo(() => {
    return allScores.get(currentHole.number) ?? new Map<string, HoleScore>();
  }, [allScores, currentHole.number]);

  const getPlayerScore = useCallback(
    (playerId: string): HoleScore => {
      return (
        currentHoleScores.get(playerId) ?? {
          gross: currentHole.par,
          putts: 2,
          fir: currentHole.par >= 4 ? null : null,
        }
      );
    },
    [currentHoleScores, currentHole.par],
  );

  const updatePlayerScore = useCallback(
    (playerId: string, score: HoleScore) => {
      setAllScores((prev) => {
        const next = new Map(prev);
        const holeMap = new Map(next.get(currentHole.number) ?? new Map());
        holeMap.set(playerId, score);
        next.set(currentHole.number, holeMap);
        return next;
      });
    },
    [currentHole.number],
  );

  // Running totals
  const getRunningTotal = useCallback(
    (playerId: string) => {
      let total = 0;
      let par = 0;
      let count = 0;
      holes.forEach((h) => {
        const s = allScores.get(h.number)?.get(playerId);
        if (s) {
          total += s.gross;
          par += h.par;
          count++;
        }
      });
      return { total, par, count };
    },
    [allScores, holes],
  );

  // Count scored holes
  const holesScored = useMemo(() => {
    let count = 0;
    holes.forEach((h) => {
      const holeMap = allScores.get(h.number);
      if (holeMap && holeMap.size >= players.length) count++;
    });
    return count;
  }, [allScores, holes, players.length]);

  const isLastHole = currentHoleIdx === holes.length - 1;

  // Feature 12: Generate scoring events when scores are entered
  const generateEvents = useCallback((holeNumber: number) => {
    const newEvents: ScoringEvent[] = [];
    const holeData = holes.find((h) => h.number === holeNumber);
    if (!holeData) return;
    const holeScores = allScores.get(holeNumber);
    if (!holeScores) return;

    holeScores.forEach((s, pid) => {
      const player = players.find((p) => p.id === pid);
      if (!player) return;
      const name = player.id === '1' ? 'You' : player.name.split(' ')[0];
      const diff = s.gross - holeData.par;

      if (diff <= -2) newEvents.push({ text: `${name} eagled Hole ${holeNumber}!`, time: new Date() });
      else if (diff === -1) newEvents.push({ text: `${name} birdied Hole ${holeNumber}`, time: new Date() });
      else if (diff >= 2) newEvents.push({ text: `${name} made ${scoreName(s.gross, holeData.par)} on Hole ${holeNumber}`, time: new Date() });
      if (s.putts >= 3) newEvents.push({ text: `${name} 3-putted Hole ${holeNumber}`, time: new Date() });
      if (s.putts === 0) newEvents.push({ text: `${name} chipped in on Hole ${holeNumber}!`, time: new Date() });
    });

    if (newEvents.length > 0) {
      setScoringEvents((prev) => [...newEvents, ...prev]);
    }
  }, [allScores, holes, players]);

  // Item 31: Check dormie moment conditions
  const checkDormieMoments = useCallback((holeNumber: number) => {
    const holeScores = allScores.get(holeNumber);
    if (!holeScores || players.length < 2) return;

    const holesRemaining = holes.length - holes.findIndex((h) => h.number === holeNumber) - 1;
    if (holesRemaining <= 0) return;

    // Match play dormie: player leads by exactly as many holes as remain
    // Simplified: compare running totals
    const totals = players.map((p) => {
      let total = 0;
      holes.forEach((h) => {
        if (h.number > holeNumber) return;
        const s = allScores.get(h.number)?.get(p.id);
        if (s) total += s.gross;
      });
      return { player: p, total };
    }).sort((a, b) => a.total - b.total);

    if (totals.length >= 2 && totals[0].total > 0 && totals[1].total > 0) {
      // Count holes won (simplified: lower gross wins the hole)
      let holesWon = 0;
      holes.forEach((h) => {
        if (h.number > holeNumber) return;
        const s1 = allScores.get(h.number)?.get(totals[0].player.id);
        const s2 = allScores.get(h.number)?.get(totals[1].player.id);
        if (s1 && s2) {
          if (s1.gross < s2.gross) holesWon++;
          else if (s1.gross > s2.gross) holesWon--;
        }
      });

      const lead = Math.abs(holesWon);
      const leaderName = holesWon > 0 ? (totals[0].player.id === '1' ? 'You' : totals[0].player.name) :
        holesWon < 0 ? (totals[1].player.id === '1' ? 'You' : totals[1].player.name) : '';

      if (lead > 0 && lead === holesRemaining) {
        haptics.heavy();
        sounds.chime();
        setDormieMoment({
          visible: true,
          type: 'DORMIE',
          playerName: leaderName,
          detail: `${lead} up with ${holesRemaining} to play`,
        });
        return;
      }
      if (lead > holesRemaining) {
        haptics.heavy();
        sounds.chime();
        setDormieMoment({
          visible: true,
          type: 'MATCH_CLOSED',
          playerName: leaderName,
          detail: `${lead} & ${holesRemaining} — match closed`,
        });
        return;
      }
    }

    // Skins jackpot: check if a skin carries over 3+ holes
    if (sideGameKeys.includes('skins')) {
      let carryover = 0;
      holes.forEach((h) => {
        if (h.number > holeNumber) return;
        const hs = allScores.get(h.number);
        if (!hs || hs.size < players.length) { carryover++; return; }
        let best = Infinity;
        let winners: string[] = [];
        hs.forEach((s, pid) => {
          if (s.gross < best) { best = s.gross; winners = [pid]; }
          else if (s.gross === best) winners.push(pid);
        });
        if (winners.length === 1) {
          if (carryover >= 3) {
            haptics.heavy();
            sounds.chime();
            const wp = players.find((p) => p.id === winners[0]);
            setDormieMoment({
              visible: true,
              type: 'SKINS_JACKPOT',
              playerName: wp ? (wp.id === '1' ? 'You' : wp.name) : 'Player',
              detail: `${carryover + 1} skins won on Hole ${h.number}!`,
            });
          }
          carryover = 0;
        } else {
          carryover++;
        }
      });
    }
  }, [allScores, holes, players, sideGameKeys]);

  // Item 32: Detect side game toast events
  const detectToastEvents = useCallback((holeNumber: number) => {
    const holeData = holes.find((h) => h.number === holeNumber);
    if (!holeData) return;
    const holeScores = allScores.get(holeNumber);
    if (!holeScores) return;

    const newEvents: SideGameEvent[] = [];
    holeScores.forEach((s, pid) => {
      const player = players.find((p) => p.id === pid);
      if (!player) return;
      const name = player.id === '1' ? 'You' : player.name.split(' ')[0];
      const gir = isGIR(s.gross, s.putts, holeData.par);
      const isSave = !gir && s.gross <= holeData.par;
      const tags = s.tags ?? [];

      sideGameKeys.forEach((gameKey) => {
        const events = detectSideGameEvents(
          gameKey,
          holeNumber,
          holeData.par,
          s.gross,
          s.putts,
          name,
          s.fir,
          gir,
          isSave,
        );
        // For semi-auto events, also check tags
        if (gameKey === 'sandies' && tags.includes('Sand')) {
          // Already detected by detectSideGameEvents if isSave
        }
        if (gameKey === 'bark' && tags.includes('Trees')) {
          // Already detected by detectSideGameEvents if isSave && !fir
        }
        newEvents.push(...events);
      });
    });

    if (newEvents.length > 0) {
      setSideGameToastEvents((prev) => [...prev, ...newEvents]);
    }
  }, [allScores, holes, players, sideGameKeys]);

  // Item 33: Build transition banner data
  const showTransitionBanner = useCallback((holeNumber: number) => {
    const holeData = holes.find((h) => h.number === holeNumber);
    if (!holeData) return;
    const holeScores = allScores.get(holeNumber);
    if (!holeScores) return;

    const results: PlayerHoleResult[] = [];
    players.forEach((p) => {
      const s = holeScores.get(p.id);
      if (!s) return;
      results.push({
        name: p.id === '1' ? 'You' : p.name.split(' ')[0],
        avatarColor: p.id === '1' ? '#2A9D8F' : '#D4AF37',
        gross: s.gross,
        putts: s.putts,
        fir: s.fir,
        gir: isGIR(s.gross, s.putts, holeData.par),
      });
    });

    setTransitionBanner({
      visible: true,
      holeNumber: holeData.number,
      par: holeData.par,
      results,
    });
  }, [allScores, holes, players]);

  const handleNext = () => {
    // Auto-save current hole scores if not yet saved
    players.forEach((p) => {
      if (!currentHoleScores.has(p.id)) {
        updatePlayerScore(p.id, getPlayerScore(p.id));
      }
    });

    // Haptic feedback on hole score submission
    haptics.medium();
    sounds.click();
    showToast({ message: 'Score submitted', type: 'success' });

    // Feature 12: Generate events
    generateEvents(currentHole.number);

    // Item 31: Check dormie moments
    checkDormieMoments(currentHole.number);

    // Item 32: Detect side game toasts
    detectToastEvents(currentHole.number);

    // Item 33: Show hole transition banner
    showTransitionBanner(currentHole.number);

    // Feature 3: Check if putt distance prompt needed
    const playersWithPutts = players.filter((p) => {
      const s = getPlayerScore(p.id);
      return s.putts > 0;
    });

    if (playersWithPutts.length > 0 && currentHoleIdx < holes.length - 1) {
      setPuttDistPrompt({ show: true, playerIdx: 0, holeNumber: currentHole.number });
    } else if (currentHoleIdx < holes.length - 1) {
      setCurrentHoleIdx(currentHoleIdx + 1);
    }
  };

  const handlePuttDistSelect = (bucket: string) => {
    const playersWithPutts = players.filter((p) => {
      const s = getPlayerScore(p.id);
      return s.putts > 0;
    });
    const currentPlayer = playersWithPutts[puttDistPrompt.playerIdx];
    if (currentPlayer) {
      setPuttDist((prev) => {
        const next = new Map(prev);
        const holeMap = new Map(next.get(puttDistPrompt.holeNumber) ?? new Map());
        holeMap.set(currentPlayer.id, bucket);
        next.set(puttDistPrompt.holeNumber, holeMap);
        return next;
      });
    }
    // Move to next player or close
    if (puttDistPrompt.playerIdx < playersWithPutts.length - 1) {
      setPuttDistPrompt((prev) => ({ ...prev, playerIdx: prev.playerIdx + 1 }));
    } else {
      setPuttDistPrompt({ show: false, playerIdx: 0, holeNumber: 1 });
      if (currentHoleIdx < holes.length - 1) {
        setCurrentHoleIdx(currentHoleIdx + 1);
      }
    }
  };

  const handlePrev = () => {
    if (currentHoleIdx > 0) {
      setCurrentHoleIdx(currentHoleIdx - 1);
    }
  };

  const handleFinish = () => {
    // Save current hole
    players.forEach((p) => {
      if (!currentHoleScores.has(p.id)) {
        updatePlayerScore(p.id, getPlayerScore(p.id));
      }
    });
    generateEvents(currentHole.number);
    // Feature 10: Show confirmation first
    setShowConfirmation(true);
  };

  // Feature 4: Best Ball team scores
  const bestBallTeamScores = useMemo(() => {
    if (!isBestBall) return { team1: 0, team2: 0, team1Par: 0, team2Par: 0 };
    let t1 = 0, t2 = 0, par1 = 0, par2 = 0;
    holes.forEach((h) => {
      const holeScores = allScores.get(h.number);
      if (!holeScores) return;
      let best1 = Infinity, best2 = Infinity;
      bestBallTeams.team1.forEach((pid) => {
        const s = holeScores.get(pid);
        if (s && s.gross < best1) best1 = s.gross;
      });
      bestBallTeams.team2.forEach((pid) => {
        const s = holeScores.get(pid);
        if (s && s.gross < best2) best2 = s.gross;
      });
      if (best1 < Infinity) { t1 += best1; par1 += h.par; }
      if (best2 < Infinity) { t2 += best2; par2 += h.par; }
    });
    return { team1: t1, team2: t2, team1Par: par1, team2Par: par2 };
  }, [allScores, holes, bestBallTeams, isBestBall]);

  // Feature 11: Leaderboard data
  const leaderboardData = useMemo(() => {
    return players.map((p) => {
      const running = getRunningTotal(p.id);
      return { player: p, total: running.total, par: running.par, count: running.count };
    }).sort((a, b) => {
      if (a.total === 0 && b.total === 0) return 0;
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return (a.total - a.par) - (b.total - b.par);
    });
  }, [players, getRunningTotal]);

  // Feature 10: Scorecard Confirmation
  if (showConfirmation) {
    const totalPar = holes.reduce((a, h) => a + h.par, 0);
    const front = holes.filter((h) => h.number <= 9);
    const back = holes.filter((h) => h.number > 9);

    return (
      <View style={[st.screen, { backgroundColor: c.bg }]}>
        <LinearGradient colors={[...greenHeaderGradient]} style={st.confirmHeader}>
          <View style={st.headerOverlay} />
          <Text style={[st.confirmTitle, { fontFamily: GEO }]}>CONFIRM SCORECARD</Text>
          <Text style={st.confirmSub}>Review all scores before saving</Text>
        </LinearGradient>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              {/* Header row */}
              <View style={[ps.scRow, { backgroundColor: '#1E4D2B' }]}>
                <Text style={[ps.scCellHole, ps.scHeaderText]}>HOLE</Text>
                {holes.map((h) => (
                  <Text key={h.number} style={[ps.scCell, ps.scHeaderText]}>{h.number}</Text>
                ))}
                <Text style={[ps.scCellTotal, ps.scHeaderText]}>TOT</Text>
              </View>
              {/* Par row */}
              <View style={[ps.scRow, { backgroundColor: c.elevated }]}>
                <Text style={[ps.scCellHole, ps.scParText, { color: c.textMuted }]}>Par</Text>
                {holes.map((h) => (
                  <Text key={h.number} style={[ps.scCell, ps.scParText, { color: c.textMuted }]}>{h.par}</Text>
                ))}
                <Text style={[ps.scCellTotal, ps.scParText, { color: c.textMuted }]}>{totalPar}</Text>
              </View>
              {/* Player rows */}
              {players.map((p, pi) => {
                const isMe = p.id === '1';
                let totalGross = 0;
                return (
                  <View key={p.id} style={[ps.scRow, { backgroundColor: isMe ? `${c.teal}08` : pi % 2 === 0 ? c.cardBg : c.surface }]}>
                    <Text style={[ps.scCellHole, ps.scPlayerLabel, { color: isMe ? c.teal : c.text }]} numberOfLines={1}>
                      {isMe ? 'You' : p.name.split(' ')[0]}
                    </Text>
                    {holes.map((h) => {
                      const s = allScores.get(h.number)?.get(p.id);
                      if (!s) return <Text key={h.number} style={[ps.scCell, { color: c.textMuted }]}>-</Text>;
                      totalGross += s.gross;
                      return (
                        <Pressable
                          key={h.number}
                          onPress={() => {
                            setShowConfirmation(false);
                            setCurrentHoleIdx(holes.findIndex((hole) => hole.number === h.number));
                          }}
                        >
                          <Text style={[
                            ps.scCell,
                            { color: scoreNameColor(s.gross, h.par, c), fontFamily: GEO },
                          ]}>
                            {s.gross}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Text style={[ps.scCellTotal, ps.scTotalText, { color: c.text, fontFamily: GEO }]}>
                      {totalGross || '-'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Front/Back totals */}
          {front.length > 0 && back.length > 0 && (
            <View style={[st.confirmTotalsRow, { borderColor: c.border }]}>
              {players.map((p) => {
                const isMe = p.id === '1';
                let frontTotal = 0, backTotal = 0, grandTotal = 0;
                front.forEach((h) => { const s = allScores.get(h.number)?.get(p.id); if (s) frontTotal += s.gross; });
                back.forEach((h) => { const s = allScores.get(h.number)?.get(p.id); if (s) backTotal += s.gross; });
                grandTotal = frontTotal + backTotal;
                return (
                  <View key={p.id} style={[st.confirmPlayerTotals, { borderColor: c.border }]}>
                    <Text style={[st.confirmPlayerName, { color: isMe ? c.teal : c.text }]}>
                      {isMe ? 'You' : p.name.split(' ')[0]}
                    </Text>
                    <View style={st.confirmNineTotals}>
                      <View style={st.confirmNineItem}>
                        <Text style={[st.confirmNineLabel, { color: c.textMuted }]}>OUT</Text>
                        <Text style={[st.confirmNineValue, { color: c.text, fontFamily: GEO }]}>{frontTotal || '-'}</Text>
                      </View>
                      <View style={st.confirmNineItem}>
                        <Text style={[st.confirmNineLabel, { color: c.textMuted }]}>IN</Text>
                        <Text style={[st.confirmNineValue, { color: c.text, fontFamily: GEO }]}>{backTotal || '-'}</Text>
                      </View>
                      <View style={st.confirmNineItem}>
                        <Text style={[st.confirmNineLabel, { color: c.gold }]}>TOT</Text>
                        <Text style={[st.confirmNineValue, { color: toParColor(grandTotal - totalPar, c), fontFamily: GEO, fontWeight: '700' }]}>
                          {grandTotal || '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <Pressable
              onPress={() => setShowConfirmation(false)}
              style={[st.navBtn, { backgroundColor: c.elevated, borderColor: c.border, flex: 1 }]}
            >
              <Ionicons name="chevron-back" size={18} color={c.text} />
              <Text style={[st.navBtnText, { color: c.text }]}>Edit Scores</Text>
            </Pressable>
            <Pressable
              onPress={() => { setShowConfirmation(false); setShowSummary(true); }}
              style={[st.navBtn, st.navFinish, { backgroundColor: '#1E4D2B', flex: 1 }]}
            >
              <Text style={[st.navBtnText, { color: '#D4AF37', fontFamily: GEO }]}>Post Score</Text>
              <Ionicons name="checkmark-circle" size={18} color="#D4AF37" />
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (showSummary) {
    return (
      <PostRoundSummary
        players={players}
        holes={holes}
        allScores={allScores}
        scoreMode={scoreMode}
        handicapStrokes={handicapStrokes}
        courseName={courseName}
        formatLabel={formatLabel}
        sideGameKeys={sideGameKeys}
        onDone={async () => {
          if (!user) { router.dismissAll(); return; }
          try {
            // Build hole scores for the current user
            const holeScores: { hole: number; gross: number; putts?: number; fir?: boolean }[] = [];
            holes.forEach((h) => {
              const s = allScores.get(h.number)?.get(user.id);
              if (s) {
                holeScores.push({ hole: h.number, gross: s.gross, putts: s.putts, ...(s.fir !== null ? { fir: s.fir } : {}) });
              }
            });
            const grossTotal = holeScores.reduce((sum, h) => sum + h.gross, 0);
            const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
            // Compute net if applicable
            let netTotal: number | null = null;
            if (scoreMode === 'net') {
              const playerStrokes = handicapStrokes.get(user.id);
              if (playerStrokes) {
                netTotal = grossTotal - Array.from(playerStrokes.values()).reduce((a, b) => a + b, 0);
              }
            }
            // Ensure course exists
            let finalCourseId = courseId;
            if (!finalCourseId) {
              const course = await coursesService.ensureCourse({ name: courseName, location: courseName });
              finalCourseId = course.id;
            }
            await roundsService.create({
              user_id: user.id,
              course_id: finalCourseId,
              gross_score: grossTotal,
              net_score: netTotal,
              hole_scores: holeScores,
              source: 'app',
              played_at: new Date().toISOString(),
            });

            // Elite polish: haptic, toast, confetti on round save
            haptics.success();
            sounds.chime();
            showToast({ message: 'Round saved', type: 'success', icon: 'checkmark-circle' });
            setShowConfetti(true);

            // Personal best detection: check previous rounds at this course
            try {
              const previousRounds = await roundsService.fetchByCourse(finalCourseId, user.id);
              // Exclude the round we just saved (most recent one) by skipping the first match
              const sorted = [...previousRounds].sort((a, b) =>
                new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
              );
              const previousBest = sorted.slice(1) // skip the most recent (just saved)
                .reduce((best, r) => Math.min(best, r.gross_score), Infinity);
              if (previousBest !== Infinity && grossTotal < previousBest) {
                setPrevBest(previousBest);
                setShowPersonalBest(true);
              }
            } catch {
              // Personal best check is non-critical
            }

            Alert.alert('Score Posted', `Your ${grossTotal} (${grossTotal - totalPar >= 0 ? '+' : ''}${grossTotal - totalPar}) is on the board.`);
            router.dismissAll();
          } catch (err) {
            const roundData = {
              user_id: user.id,
              course_id: courseId,
              course_name: courseName,
              gross_score: holeScores.reduce((sum, h) => sum + h.gross, 0),
              hole_scores: holeScores,
              source: 'app' as const,
              played_at: new Date().toISOString(),
            };
            await queueOfflineAction({ type: 'save_round', payload: roundData });
            showToast({ message: 'Saved offline — will sync when connected', type: 'info' });
          }
        }}
      />
    );
  }

  // Feature 12: Unread feed count
  const unreadFeedCount = scoringEvents.length - lastReadEventCount;

  // Feature 14: Players to show based on view mode
  const visiblePlayers = viewMode === 'solo' ? [players[soloPlayerIdx]] : players;

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      <ScoringHeader
        courseName={courseName}
        holeNumber={currentHole.number}
        holePar={currentHole.par}
        format={formatLabel}
        totalHoles={holes.length}
        holesScored={holesScored}
        onLeaderboard={() => setShowLeaderboard(true)}
        onFeed={() => { setShowFeed(!showFeed); setLastReadEventCount(scoringEvents.length); }}
        unreadFeedCount={unreadFeedCount > 0 ? unreadFeedCount : 0}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode(viewMode === 'solo' ? 'all' : 'solo')}
        holeYardage={currentHole.yards}
        holeHcp={currentHole.strokeIndex}
        onPrevHole={() => { if (currentHoleIdx > 0) setCurrentHoleIdx(currentHoleIdx - 1); }}
        onNextHole={() => { if (currentHoleIdx < holes.length - 1) setCurrentHoleIdx(currentHoleIdx + 1); }}
        canPrevHole={currentHoleIdx > 0}
        canNextHole={currentHoleIdx < holes.length - 1}
        competitionCount={competitionTabs.length}
        roundType={roundType}
      />

      <HoleStrip
        holes={holes}
        currentIdx={currentHoleIdx}
        scores={allScores}
        onSelect={setCurrentHoleIdx}
        holeNotes={holeNotes}
      />

      {/* Item 36: Season Round Link Banner */}
      {seasonName.length > 0 && (
        <View style={st.seasonBanner}>
          <View style={st.seasonBannerContent}>
            <Text style={[st.seasonBannerName, { fontFamily: GEO }]}>
              {seasonName} {'\u00B7'} Week {seasonWeek} {'\u00B7'} {seasonFormat} {'\u00B7'} {seasonMultiplier}x
            </Text>
          </View>
        </View>
      )}

      {/* Item 8: Collapsible Side Game Ticker */}
      {sideGameKeys.length > 0 && (
        <>
        <GoldDivider />
        <Pressable
          onPress={() => setSideGameTickerExpanded(!sideGameTickerExpanded)}
          style={[st.sideGameTicker, theme.isDark ? tickerShadowDark : tickerShadowLight]}
        >
          {!sideGameTickerExpanded ? (
            <View style={st.sideGameTickerCollapsed}>
              <Text style={st.sideGameTickerText}>
                {sideGameKeys.includes('dots') ? `Dots: ${(() => {
                  let d = 0;
                  holes.forEach((h) => {
                    const s = allScores.get(h.number)?.get('1');
                    if (s) {
                      const diff = s.gross - h.par;
                      if (diff <= -2) d += 2;
                      else if (diff === -1) d += 1;
                      else if (diff >= 2) d -= 1;
                    }
                  });
                  return d >= 0 ? `+${d}` : `${d}`;
                })()}` : ''}
                {sideGameKeys.includes('dots') && sideGameKeys.includes('skins') ? ' | ' : ''}
                {sideGameKeys.includes('skins') ? `Skins: ${(() => {
                  let wins = 0;
                  let carry = 0;
                  holes.forEach((h) => {
                    const hs = allScores.get(h.number);
                    if (!hs || hs.size < players.length) { carry++; return; }
                    let best = Infinity;
                    let w: string[] = [];
                    hs.forEach((s, pid) => { if (s.gross < best) { best = s.gross; w = [pid]; } else if (s.gross === best) w.push(pid); });
                    if (w.length === 1 && w[0] === '1') { wins += 1 + carry; carry = 0; }
                    else if (w.length === 1) carry = 0;
                    else carry++;
                  });
                  return wins;
                })()}` : ''}
                {(sideGameKeys.includes('dots') || sideGameKeys.includes('skins')) && sideGameKeys.includes('snake') ? ' | ' : ''}
                {sideGameKeys.includes('snake') ? `Snake: ${(() => {
                  let holder: string | null = null;
                  holes.forEach((h) => {
                    const hs = allScores.get(h.number);
                    if (!hs) return;
                    hs.forEach((s, pid) => { if (s.putts >= 3) holder = pid; });
                  });
                  if (!holder) return 'None';
                  const hp = players.find((p) => p.id === holder);
                  return hp ? (hp.id === '1' ? 'You' : hp.name.split(' ')[0]) : 'None';
                })()}` : ''}
                {sideGameKeys.length > 0 && !sideGameKeys.includes('dots') && !sideGameKeys.includes('skins') && !sideGameKeys.includes('snake')
                  ? sideGameKeys.map((k) => SIDE_GAME_DISPLAY[k] ?? k).join(' | ')
                  : ''}
              </Text>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
            </View>
          ) : (
            <View style={st.sideGameTickerExpanded}>
              <View style={st.sideGameTickerExpandedHeader}>
                <Text style={[st.sideGameTickerTitle, { fontFamily: GEO }]}>SIDE GAMES</Text>
                <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.6)" />
              </View>
              {sideGameKeys.map((key) => (
                <Text key={key} style={st.sideGameTickerLine}>
                  {SIDE_GAME_DISPLAY[key] ?? key}: Active
                </Text>
              ))}
            </View>
          )}
        </Pressable>
        <GoldDivider />
        </>
      )}

      {/* Feature 4: Best Ball Team Banner */}
      {isBestBall && !showBestBallSetup && (
        <View style={[st.bestBallBanner, { backgroundColor: c.elevated, borderColor: c.border }]}>
          <View style={st.bestBallTeam}>
            <Text style={[st.bestBallTeamLabel, { color: c.teal }]}>Team 1</Text>
            <Text style={[st.bestBallTeamScore, { color: toParColor(bestBallTeamScores.team1 - bestBallTeamScores.team1Par, c), fontFamily: GEO }]}>
              {bestBallTeamScores.team1 > 0 ? formatToPar(bestBallTeamScores.team1, bestBallTeamScores.team1Par) : '-'}
            </Text>
          </View>
          <Text style={[st.bestBallVs, { color: c.textMuted }]}>vs</Text>
          <View style={st.bestBallTeam}>
            <Text style={[st.bestBallTeamLabel, { color: c.gold }]}>Team 2</Text>
            <Text style={[st.bestBallTeamScore, { color: toParColor(bestBallTeamScores.team2 - bestBallTeamScores.team2Par, c), fontFamily: GEO }]}>
              {bestBallTeamScores.team2 > 0 ? formatToPar(bestBallTeamScores.team2, bestBallTeamScores.team2Par) : '-'}
            </Text>
          </View>
        </View>
      )}

      {/* Feature 12: Live Feed */}
      {showFeed ? (
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.feedContainer}
        >
          <Text style={[st.feedTitle, { color: c.gold, fontFamily: GEO }]}>LIVE FEED</Text>
          {scoringEvents.length === 0 ? (
            <Text style={[st.feedEmpty, { color: c.textMuted }]}>No events yet — start scoring!</Text>
          ) : (
            scoringEvents.slice(0, 10).map((ev, i) => (
              <View key={i} style={[st.feedItem, { borderColor: c.border }]}>
                <Ionicons name="golf-outline" size={14} color={c.teal} />
                <Text style={[st.feedItemText, { color: c.text }]}>{ev.text}</Text>
                <Text style={[st.feedItemTime, { color: c.textMuted }]}>
                  {ev.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={st.scoringBody}
          accessibilityHint="Swipe left or right to change holes"
        >
          {/* Feature 6: Hole notes button */}
          <View style={st.holeToolsRow}>
            <Pressable
              onPress={() => {
                setNoteText(holeNotes.get(currentHole.number) ?? '');
                setShowNoteModal(true);
              }}
              style={[st.holeToolBtn, { borderColor: c.border }]}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={holeNotes.has(currentHole.number) && (holeNotes.get(currentHole.number) ?? '').length > 0 ? c.gold : c.textMuted}
              />
              <Text style={[st.holeToolLabel, { color: c.textMuted }]}>Notes</Text>
            </Pressable>
          </View>

          {/* Feature 14: Solo mode player navigation */}
          {viewMode === 'solo' && players.length > 1 && (
            <View style={st.soloNavRow}>
              <Pressable
                onPress={() => setSoloPlayerIdx(Math.max(0, soloPlayerIdx - 1))}
                disabled={soloPlayerIdx === 0}
                style={{ opacity: soloPlayerIdx === 0 ? 0.3 : 1 }}
                hitSlop={12}
              >
                <Ionicons name="chevron-back" size={20} color={c.text} />
              </Pressable>
              <Text style={[st.soloNavText, { color: c.text }]}>
                {players[soloPlayerIdx].id === '1' ? 'You' : players[soloPlayerIdx].name} ({soloPlayerIdx + 1}/{players.length})
              </Text>
              <Pressable
                onPress={() => setSoloPlayerIdx(Math.min(players.length - 1, soloPlayerIdx + 1))}
                disabled={soloPlayerIdx === players.length - 1}
                style={{ opacity: soloPlayerIdx === players.length - 1 ? 0.3 : 1 }}
                hitSlop={12}
              >
                <Ionicons name="chevron-forward" size={20} color={c.text} />
              </Pressable>
            </View>
          )}

          {/* Player score inputs */}
          {visiblePlayers.map((p) => {
            const running = getRunningTotal(p.id);
            const netStrokes = handicapStrokes.get(p.id)?.get(currentHole.number) ?? 0;
            return (
              <PlayerScoreInput
                key={p.id}
                player={p}
                holePar={currentHole.par}
                score={getPlayerScore(p.id)}
                runningTotal={running.total}
                runningPar={running.par}
                netStrokes={netStrokes}
                scoreMode={scoreMode}
                onChange={(s) => updatePlayerScore(p.id, s)}
                compact={viewMode === 'all' && players.length > 2}
              />
            );
          })}

          {/* Item 9: Tag Logging Section */}
          <View style={st.tagSection}>
            <Text style={[st.tagSectionTitle, { fontFamily: GEO }]}>LOG THIS HOLE</Text>
            <View style={st.tagRow}>
              {(['Sand', 'Trees', 'Water', 'Penalty', 'Up & Down'] as const).map((tag) => {
                const myScore = getPlayerScore('1');
                const tags = myScore.tags ?? [];
                const isSelected = tags.includes(tag);
                // Side game indicator
                let indicator = '';
                if (tag === 'Sand' && sideGameKeys.includes('dots') && isSelected) indicator = '-1 dot';
                if (tag === 'Trees' && sideGameKeys.includes('bark') && isSelected) indicator = 'Barkie?';

                return (
                  <Pressable
                    key={tag}
                    onPress={() => {
                      const currentScore = getPlayerScore('1');
                      const currentTags = currentScore.tags ?? [];
                      const newTags = currentTags.includes(tag)
                        ? currentTags.filter((t) => t !== tag)
                        : [...currentTags, tag];
                      updatePlayerScore('1', { ...currentScore, tags: newTags });
                    }}
                    style={({ pressed }) => [
                      st.tagPill,
                      {
                        backgroundColor: isSelected ? `${c.teal}20` : c.elevated,
                        borderColor: isSelected ? c.teal : c.border,
                      },
                      pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Text style={[st.tagPillText, { color: isSelected ? c.teal : c.textMuted }]}>
                      {tag}
                    </Text>
                    {indicator.length > 0 && (
                      <Text style={[st.tagIndicator, { color: c.gold, fontFamily: GEO }]}>
                        {indicator}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Hole result */}
          {players.length > 1 && (
            <HoleResultBanner
              players={players}
              holeScores={currentHoleScores}
              holePar={currentHole.par}
            />
          )}

          {/* Feature 1: Hammer button */}
          {sideGameKeys.includes('hammer') && (
            <Pressable
              onPress={() => {
                if (players.length >= 2) {
                  setHammerState((prev) => ({
                    ...prev,
                    active: true,
                    thrower: players[0].id,
                    target: players[1].id,
                    pending: true,
                  }));
                  setShowHammerModal(true);
                }
              }}
              style={({ pressed }) => [st.hammerBtn, { backgroundColor: c.gold }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
            >
              <Ionicons name="hammer-outline" size={18} color="#1E4D2B" />
              <Text style={[st.hammerBtnText, { fontFamily: GEO }]}>Throw Hammer</Text>
              {hammerState.active && hammerState.multiplier > 2 && (
                <View style={st.hammerMultiplierBadge}>
                  <Text style={[st.hammerMultiplierText, { fontFamily: GEO }]}>{hammerState.multiplier}x</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Feature 13: Side Game Running Panel */}
          {sideGameKeys.length > 0 && (
            <View style={[st.runningPanelWrap, { borderColor: c.border }]}>
              <Pressable
                onPress={() => setShowRunningPanel(!showRunningPanel)}
                style={[st.runningPanelToggle, { backgroundColor: c.elevated }]}
              >
                <Text style={[st.runningPanelToggleText, { color: c.text }]}>
                  Side Games {showRunningPanel ? '\u25B2' : '\u25BC'}
                </Text>
              </Pressable>
              {showRunningPanel && (
                <View style={[st.runningPanelContent, { backgroundColor: c.cardBg }]}>
                  {sideGameKeys.includes('skins') && (
                    <RunningSkinsPanel players={players} holes={holes} allScores={allScores} currentHoleNumber={currentHole.number} />
                  )}
                  {sideGameKeys.includes('dots') && (
                    <RunningDotsPanel players={players} holes={holes} allScores={allScores} />
                  )}
                  {sideGameKeys.includes('nassau') && (
                    <RunningNassauPanel players={players} holes={holes} allScores={allScores} />
                  )}
                  {sideGameKeys.includes('snake') && (
                    <RunningSnakePanel players={players} holes={holes} allScores={allScores} />
                  )}
                </View>
              )}
            </View>
          )}

          {/* Nav buttons */}
          <NavButtons
            canPrev={currentHoleIdx > 0}
            canNext={currentHoleIdx < holes.length - 1}
            isLast={isLastHole}
            onPrev={handlePrev}
            onNext={handleNext}
            onFinish={handleFinish}
          />

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Feature 1: Hammer Modal */}
      <Modal visible={showHammerModal} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.gold }]}>
            <Text style={[st.modalTitle, { color: c.gold, fontFamily: GEO }]}>HAMMER THROWN!</Text>
            <Text style={[st.modalText, { color: c.text }]}>
              {players.find((p) => p.id === hammerState.thrower)?.name ?? 'Player'} doubles the bet
            </Text>
            <Text style={[st.hammerMultiplierDisplay, { color: c.gold, fontFamily: GEO }]}>
              Current: {hammerState.multiplier}x
            </Text>
            <View style={st.modalBtnRow}>
              <Pressable
                onPress={() => {
                  // Accept: multiplier doubles, hammer can be re-thrown
                  setHammerState((prev) => ({
                    ...prev,
                    multiplier: Math.min(8, prev.multiplier * 2),
                    pending: false,
                  }));
                  setShowHammerModal(false);
                }}
                style={({ pressed }) => [st.modalBtn, { backgroundColor: c.teal }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
              >
                <Text style={st.modalBtnText}>Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  // Fold: concede hole
                  setHammerResults((prev) => {
                    const next = new Map(prev);
                    next.set(currentHole.number, {
                      thrower: hammerState.thrower,
                      target: hammerState.target,
                      multiplier: hammerState.multiplier,
                      accepted: false,
                    });
                    return next;
                  });
                  setHammerState((prev) => ({ ...prev, pending: false }));
                  setShowHammerModal(false);
                }}
                style={({ pressed }) => [st.modalBtn, { backgroundColor: c.urgent }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
              >
                <Text style={st.modalBtnText}>Fold</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feature 3: Putt Distance Prompt */}
      <Modal visible={puttDistPrompt.show} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            {(() => {
              const playersWithPutts = players.filter((p) => {
                const s = getPlayerScore(p.id);
                return s.putts > 0;
              });
              const currentPlayer = playersWithPutts[puttDistPrompt.playerIdx];
              return (
                <>
                  <Text style={[st.modalTitle, { color: c.teal, fontFamily: GEO }]}>FIRST PUTT DISTANCE</Text>
                  <Text style={[st.modalText, { color: c.text }]}>
                    {currentPlayer ? (currentPlayer.id === '1' ? 'Your' : `${currentPlayer.name.split(' ')[0]}'s`) : ''} first putt on Hole {puttDistPrompt.holeNumber}
                  </Text>
                  <View style={st.puttDistGrid}>
                    {['Inside 5ft', '5-15ft', '15-30ft', 'Outside 30ft'].map((bucket) => (
                      <Pressable
                        key={bucket}
                        onPress={() => handlePuttDistSelect(bucket)}
                        style={[st.puttDistBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
                      >
                        <Text style={[st.puttDistBtnText, { color: c.text }]}>{bucket}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Feature 4: Best Ball Team Setup Modal */}
      <Modal visible={showBestBallSetup && isBestBall} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.teal, width: '90%' }]}>
            <Text style={[st.modalTitle, { color: c.teal, fontFamily: GEO }]}>BEST BALL TEAMS</Text>
            <Text style={[st.modalText, { color: c.textMuted }]}>Tap a player to move between teams</Text>
            <View style={st.bestBallSetupRow}>
              <View style={st.bestBallColumn}>
                <Text style={[st.bestBallColumnTitle, { color: c.teal }]}>Team 1</Text>
                {bestBallTeams.team1.map((pid) => {
                  const p = players.find((pl) => pl.id === pid);
                  if (!p) return null;
                  return (
                    <Pressable
                      key={pid}
                      onPress={() => {
                        if (bestBallTeams.team1.length <= 1) return;
                        setBestBallTeams((prev) => ({
                          team1: prev.team1.filter((id) => id !== pid),
                          team2: [...prev.team2, pid],
                        }));
                      }}
                      style={[st.bestBallPlayerChip, { backgroundColor: `${c.teal}20`, borderColor: c.teal }]}
                    >
                      <Avatar id={p.id} size={22} name={p.name} />
                      <Text style={[st.bestBallPlayerName, { color: c.text }]}>{p.id === '1' ? 'You' : p.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={st.bestBallColumn}>
                <Text style={[st.bestBallColumnTitle, { color: c.gold }]}>Team 2</Text>
                {bestBallTeams.team2.map((pid) => {
                  const p = players.find((pl) => pl.id === pid);
                  if (!p) return null;
                  return (
                    <Pressable
                      key={pid}
                      onPress={() => {
                        if (bestBallTeams.team2.length <= 1) return;
                        setBestBallTeams((prev) => ({
                          team1: [...prev.team1, pid],
                          team2: prev.team2.filter((id) => id !== pid),
                        }));
                      }}
                      style={[st.bestBallPlayerChip, { backgroundColor: `${c.gold}20`, borderColor: c.gold }]}
                    >
                      <Avatar id={p.id} size={22} name={p.name} />
                      <Text style={[st.bestBallPlayerName, { color: c.text }]}>{p.id === '1' ? 'You' : p.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Pressable
              onPress={() => setShowBestBallSetup(false)}
              style={[st.modalBtn, { backgroundColor: c.teal, marginTop: 16, alignSelf: 'center' }]}
            >
              <Text style={st.modalBtnText}>Start Round</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Feature 6: Hole Notes Modal */}
      <Modal visible={showNoteModal} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <Text style={[st.modalTitle, { color: c.gold, fontFamily: GEO }]}>HOLE {currentHole.number} NOTES</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Hit 3-wood off tee, pin was back-left..."
              placeholderTextColor={c.textMuted}
              multiline
              style={[st.noteInput, { color: c.text, backgroundColor: c.elevated, borderColor: c.border }]}
            />
            <View style={st.modalBtnRow}>
              <Pressable
                onPress={() => setShowNoteModal(false)}
                style={[st.modalBtn, { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border }]}
              >
                <Text style={[st.modalBtnText, { color: c.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setHoleNotes((prev) => {
                    const next = new Map(prev);
                    if (noteText.trim().length > 0) {
                      next.set(currentHole.number, noteText.trim());
                    } else {
                      next.delete(currentHole.number);
                    }
                    return next;
                  });
                  setShowNoteModal(false);
                }}
                style={[st.modalBtn, { backgroundColor: c.teal }]}
              >
                <Text style={st.modalBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feature 11 / Item 10: Multi-Competition Scoreboard Modal */}
      <Modal visible={showLeaderboard} transparent animationType="fade">
        <View style={[st.leaderboardScreen, { backgroundColor: '#1E4D2B' }]}>
          <View style={st.leaderboardHeader}>
            <Pressable onPress={() => setShowLeaderboard(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[st.leaderboardTitle, { color: '#D4AF37', fontFamily: GEO }]}>LIVE LEADERBOARD</Text>
              <Text style={st.leaderboardCourse}>{courseName}</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          {/* Competition tab pills */}
          {competitionTabs.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.compTabRow}>
              {competitionTabs.map((tab) => {
                const active = activeCompTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setActiveCompTab(tab.key)}
                    style={[st.compTabPill, { backgroundColor: active ? '#D4AF37' : 'rgba(255,255,255,0.08)', borderColor: active ? '#D4AF37' : 'rgba(255,255,255,0.15)', borderWidth: 1 }]}
                  >
                    <Text style={[st.compTabPillText, { color: active ? '#1E4D2B' : 'rgba(255,255,255,0.5)', fontFamily: GEO }]}>
                      {tab.label.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <GoldDivider />

          {/* ── ROUND VIEW (default) ── */}
          {(activeCompTab === 'round' || !competitionTabs.find((t) => t.key === activeCompTab)) && (
            <>
              <View style={st.broadcastHeaderRow}>
                <Text style={st.broadcastColPos}>POS</Text>
                <Text style={st.broadcastColName}>PLAYER</Text>
                <Text style={st.broadcastColThru}>THRU</Text>
                <Text style={st.broadcastColTotal}>TOTAL</Text>
                <Text style={st.broadcastColPar}>TO PAR</Text>
              </View>
              <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: 0 }}>
                {leaderboardData.map((row, i) => {
                  const isMe = row.player.id === '1';
                  const diff = row.total - row.par;
                  return (
                    <View key={row.player.id} style={[st.lbRow, { backgroundColor: isMe ? 'rgba(42,157,143,0.15)' : i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }]}>
                      <Text style={[st.lbPos, { fontFamily: GEO }]}>{i + 1}</Text>
                      <Avatar id={row.player.id} size={28} name={row.player.name} />
                      <View style={st.lbNameWrap}>
                        <Text style={[st.lbName, isMe && { color: '#2A9D8F', fontWeight: '700' }]}>
                          {isMe ? 'You' : row.player.name}
                        </Text>
                      </View>
                      <Text style={[st.lbThru, { width: 36, textAlign: 'center' }]}>{row.count}</Text>
                      <Text style={[st.lbTotal, { fontFamily: GEO }]}>{row.total || '-'}</Text>
                      <Text style={[st.lbToPar, { color: diff < 0 ? '#2A9D8F' : diff === 0 ? '#D4AF37' : '#C44B4F', fontFamily: GEO }]}>
                        {row.total > 0 ? formatToPar(row.total, row.par) : '-'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* ── SEASON VIEW ── */}
          {competitionTabs.find((t) => t.key === activeCompTab && t.type === 'season') && (() => {
            const tab = competitionTabs.find((t) => t.key === activeCompTab)!;
            const season = tab.data!;
            const myRunning = getRunningTotal('1');
            const myGross = myRunning.total;
            const myPar = myRunning.par;
            const totalPar = holes.reduce((a, h) => a + h.par, 0);

            // Calculate projected points based on format
            let projectedPoints = 0;
            if (season.format === 'Stableford') {
              // Stableford: 0=double+, 1=bogey, 2=par, 3=birdie, 4=eagle, 5=albatross
              let stablefordTotal = 0;
              holes.forEach((h) => {
                const score = allScores.get(h.number)?.get('1');
                if (score) {
                  const diff = score.gross - h.par;
                  if (diff <= -3) stablefordTotal += 5;
                  else if (diff === -2) stablefordTotal += 4;
                  else if (diff === -1) stablefordTotal += 3;
                  else if (diff === 0) stablefordTotal += 2;
                  else if (diff === 1) stablefordTotal += 1;
                }
              });
              projectedPoints = stablefordTotal * (season.multiplier || 1);
            } else {
              // Stroke Play: points based on score vs par
              const diff = myGross - myPar;
              projectedPoints = Math.max(0, 36 - diff) * (season.multiplier || 1);
            }

            // Mock season standings with projected movement
            const standingsPlayers = MOCK_GROUP_PLAYERS.slice(0, 6).map((p, i) => ({
              id: p.id,
              name: p.name,
              points: [185, 172, 168, 155, 142, 130][i] ?? 100,
              position: i + 1,
            }));
            // Add projected points to "You" and re-sort
            const projected = standingsPlayers.map((p) => ({
              ...p,
              projPoints: p.id === '1' ? p.points + projectedPoints : p.points + Math.floor(Math.random() * 20 + 10),
            })).sort((a, b) => b.projPoints - a.projPoints).map((p, i) => ({ ...p, projPosition: i + 1 }));

            return (
              <ScrollView bounces={false} contentContainerStyle={{ padding: 16 }}>
                {/* Season header info */}
                <View style={st.seasonViewHeader}>
                  <Text style={[st.seasonViewTitle, { fontFamily: GEO }]}>{season.seasonName}</Text>
                  <Text style={st.seasonViewMeta}>
                    Week {season.weekNumber} · {season.format} · {season.multiplier}x
                  </Text>
                </View>

                {/* Your projected points */}
                <View style={st.seasonProjectedCard}>
                  <Text style={st.seasonProjectedLabel}>YOUR PROJECTED POINTS</Text>
                  <Text style={[st.seasonProjectedValue, { fontFamily: GEO }]}>
                    +{projectedPoints}
                  </Text>
                  {season.format === 'Stableford' && (
                    <Text style={st.seasonProjectedSub}>
                      Running Stableford: {(() => {
                        let total = 0;
                        holes.forEach((h) => {
                          const score = allScores.get(h.number)?.get('1');
                          if (score) {
                            const d = score.gross - h.par;
                            if (d <= -3) total += 5;
                            else if (d === -2) total += 4;
                            else if (d === -1) total += 3;
                            else if (d === 0) total += 2;
                            else if (d === 1) total += 1;
                          }
                        });
                        return total;
                      })()} pts thru {holesScored}
                    </Text>
                  )}
                  {season.format === 'Stroke Play' && myGross > 0 && (
                    <Text style={st.seasonProjectedSub}>
                      {myGross} ({myGross - myPar >= 0 ? '+' : ''}{myGross - myPar}) thru {holesScored}
                    </Text>
                  )}
                </View>

                {/* Season standings with projected movement */}
                <Text style={st.seasonStandingsTitle}>SEASON STANDINGS</Text>
                <View style={st.broadcastHeaderRow}>
                  <Text style={st.broadcastColPos}>POS</Text>
                  <Text style={st.broadcastColName}>PLAYER</Text>
                  <Text style={[st.broadcastColThru, { width: 50 }]}>PTS</Text>
                  <Text style={[st.broadcastColTotal, { width: 50 }]}>PROJ</Text>
                  <Text style={[st.broadcastColPar, { width: 36 }]}>{' '}</Text>
                </View>
                {projected.map((p) => {
                  const isMe = p.id === '1';
                  const moved = p.position - p.projPosition;
                  return (
                    <View key={p.id} style={[st.lbRow, { backgroundColor: isMe ? 'rgba(42,157,143,0.15)' : 'transparent' }]}>
                      <Text style={[st.lbPos, { fontFamily: GEO }]}>{p.position}</Text>
                      <Avatar id={p.id} size={28} name={p.name} />
                      <View style={st.lbNameWrap}>
                        <Text style={[st.lbName, isMe && { color: '#2A9D8F', fontWeight: '700' }]}>
                          {isMe ? 'You' : p.name.split(' ')[0]}
                        </Text>
                      </View>
                      <Text style={[st.lbTotal, { fontFamily: GEO, width: 50 }]}>{p.points}</Text>
                      <Text style={[st.lbTotal, { fontFamily: GEO, width: 50, color: '#D4AF37' }]}>{p.projPoints}</Text>
                      <View style={{ width: 36, alignItems: 'center' }}>
                        {moved > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="arrow-up" size={12} color="#2A9D8F" />
                            <Text style={{ color: '#2A9D8F', fontSize: 11, fontFamily: GEO, fontWeight: '700' }}>{moved}</Text>
                          </View>
                        )}
                        {moved < 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="arrow-down" size={12} color="#C44B4F" />
                            <Text style={{ color: '#C44B4F', fontSize: 11, fontFamily: GEO, fontWeight: '700' }}>{Math.abs(moved)}</Text>
                          </View>
                        )}
                        {moved === 0 && (
                          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>—</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            );
          })()}

          {/* ── MATCHUP VIEW ── */}
          {activeCompTab === 'matchup' && matchupOpponent && (() => {
            const opponentPlayer = players.find((p) => p.id === matchupOpponent) ?? players.find((p) => p.id !== '1');
            const opponentName = opponentPlayer?.name ?? 'Opponent';
            const opponentId = opponentPlayer?.id ?? '2';

            // Calculate match status
            let myUp = 0;
            let holesPlayed = 0;
            const holeResults: { hole: number; myScore: number | null; oppScore: number | null; result: 'win' | 'loss' | 'halve' | 'pending' }[] = [];

            holes.forEach((h) => {
              const myScore = allScores.get(h.number)?.get('1');
              const oppScore = allScores.get(h.number)?.get(opponentId);
              if (myScore && oppScore) {
                holesPlayed++;
                const diff = myScore.gross - oppScore.gross;
                if (diff < 0) myUp++;
                else if (diff > 0) myUp--;
                holeResults.push({ hole: h.number, myScore: myScore.gross, oppScore: oppScore.gross, result: diff < 0 ? 'win' : diff > 0 ? 'loss' : 'halve' });
              } else {
                holeResults.push({ hole: h.number, myScore: myScore?.gross ?? null, oppScore: oppScore?.gross ?? null, result: 'pending' });
              }
            });

            const matchStatus = myUp === 0
              ? `ALL SQUARE thru ${holesPlayed}`
              : myUp > 0
                ? `${myUp} UP thru ${holesPlayed}`
                : `${Math.abs(myUp)} DOWN thru ${holesPlayed}`;

            return (
              <ScrollView bounces={false} contentContainerStyle={{ padding: 16 }}>
                {/* Matchup header */}
                <View style={st.matchupHeader}>
                  <View style={st.matchupPlayerCol}>
                    <Avatar id="1" size={40} name="Ian McGowan" />
                    <Text style={[st.matchupPlayerName, { fontFamily: GEO }]}>YOU</Text>
                  </View>
                  <View style={st.matchupVs}>
                    <Text style={[st.matchupVsText, { fontFamily: GEO }]}>VS</Text>
                  </View>
                  <View style={st.matchupPlayerCol}>
                    <Avatar id={opponentId} size={40} name={opponentName} />
                    <Text style={[st.matchupPlayerName, { fontFamily: GEO }]}>{opponentName.split(' ')[0].toUpperCase()}</Text>
                  </View>
                </View>

                {/* Match status */}
                <View style={[st.matchStatusBanner, { backgroundColor: myUp > 0 ? 'rgba(42,157,143,0.15)' : myUp < 0 ? 'rgba(196,75,79,0.15)' : 'rgba(212,175,55,0.15)' }]}>
                  <Text style={[st.matchStatusText, { color: myUp > 0 ? '#2A9D8F' : myUp < 0 ? '#C44B4F' : '#D4AF37', fontFamily: GEO }]}>
                    {matchStatus}
                  </Text>
                </View>

                {/* Hole-by-hole comparison */}
                <View style={st.matchupGrid}>
                  <View style={st.matchupGridHeader}>
                    <Text style={[st.matchupGridCell, st.matchupGridHole]}>HOLE</Text>
                    <Text style={[st.matchupGridCell, st.matchupGridScore]}>YOU</Text>
                    <Text style={[st.matchupGridCell, st.matchupGridScore]}>{opponentName.split(' ')[0].toUpperCase()}</Text>
                    <Text style={[st.matchupGridCell, st.matchupGridResult]}>{' '}</Text>
                  </View>
                  {holeResults.map((hr) => (
                    <View key={hr.hole} style={[st.matchupGridRow, hr.result === 'win' && { backgroundColor: 'rgba(42,157,143,0.08)' }, hr.result === 'loss' && { backgroundColor: 'rgba(196,75,79,0.08)' }]}>
                      <Text style={[st.matchupGridCell, st.matchupGridHole, { fontFamily: GEO }]}>{hr.hole}</Text>
                      <Text style={[st.matchupGridCell, st.matchupGridScore, { fontFamily: GEO, color: hr.myScore ? '#E8E4DE' : 'rgba(255,255,255,0.3)' }]}>
                        {hr.myScore ?? '-'}
                      </Text>
                      <Text style={[st.matchupGridCell, st.matchupGridScore, { fontFamily: GEO, color: hr.oppScore ? '#E8E4DE' : 'rgba(255,255,255,0.3)' }]}>
                        {hr.oppScore ?? '-'}
                      </Text>
                      <View style={[st.matchupGridCell, st.matchupGridResult]}>
                        {hr.result === 'win' && <Ionicons name="checkmark-circle" size={14} color="#2A9D8F" />}
                        {hr.result === 'loss' && <Ionicons name="close-circle" size={14} color="#C44B4F" />}
                        {hr.result === 'halve' && <Text style={{ color: '#D4AF37', fontSize: 10, fontFamily: GEO }}>AS</Text>}
                      </View>
                    </View>
                  ))}
                </View>

                {/* Live status */}
                {!opponentPlayer && (
                  <View style={st.matchupWaiting}>
                    <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.4)" />
                    <Text style={st.matchupWaitingText}>Waiting for {opponentName} to post scores</Text>
                  </View>
                )}
              </ScrollView>
            );
          })()}

          {/* ── TRIP VIEW ── */}
          {activeCompTab === 'trip' && linkedTrip && (() => {
            // Mock trip leaderboard with running totals
            const tripPlayers = MOCK_GROUP_PLAYERS.filter((p) =>
              linkedTrip.playerIds.includes(p.id)
            ).map((p, i) => {
              const isMe = p.id === '1';
              const myRunning = isMe ? getRunningTotal('1') : null;
              const prevTotal = [232, 238, 241, 245, 250, 255][i] ?? 250;
              const todayScore = isMe && myRunning ? myRunning.total : (72 + Math.floor(Math.random() * 8));
              return {
                id: p.id,
                name: p.name,
                tripTotal: prevTotal + todayScore,
                todayScore,
                isMe,
              };
            }).sort((a, b) => a.tripTotal - b.tripTotal);

            const leaderTotal = tripPlayers[0]?.tripTotal ?? 0;
            const today = new Date();
            const start = new Date(linkedTrip.startDate);
            const dayNum = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

            return (
              <ScrollView bounces={false} contentContainerStyle={{ padding: 16 }}>
                {/* Trip header */}
                <View style={st.seasonViewHeader}>
                  <Text style={[st.seasonViewTitle, { fontFamily: GEO }]}>{linkedTrip.name}</Text>
                  <Text style={st.seasonViewMeta}>
                    Day {dayNum} · {linkedTrip.destination}
                  </Text>
                </View>

                {/* Trip leaderboard */}
                <View style={st.broadcastHeaderRow}>
                  <Text style={st.broadcastColPos}>POS</Text>
                  <Text style={st.broadcastColName}>PLAYER</Text>
                  <Text style={st.broadcastColThru}>TODAY</Text>
                  <Text style={st.broadcastColTotal}>TOTAL</Text>
                  <Text style={st.broadcastColPar}>BACK</Text>
                </View>
                {tripPlayers.map((p, i) => {
                  const back = p.tripTotal - leaderTotal;
                  return (
                    <View key={p.id} style={[st.lbRow, { backgroundColor: p.isMe ? 'rgba(42,157,143,0.15)' : i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }]}>
                      <Text style={[st.lbPos, { fontFamily: GEO }]}>{i + 1}</Text>
                      <Avatar id={p.id} size={28} name={p.name} />
                      <View style={st.lbNameWrap}>
                        <Text style={[st.lbName, p.isMe && { color: '#2A9D8F', fontWeight: '700' }]}>
                          {p.isMe ? 'You' : p.name.split(' ')[0]}
                        </Text>
                      </View>
                      <Text style={[st.lbThru, { width: 36, textAlign: 'center', fontFamily: GEO }]}>{p.todayScore}</Text>
                      <Text style={[st.lbTotal, { fontFamily: GEO }]}>{p.tripTotal}</Text>
                      <Text style={[st.lbToPar, { color: back === 0 ? '#D4AF37' : '#C44B4F', fontFamily: GEO }]}>
                        {back === 0 ? 'LEAD' : `+${back}`}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

      {/* Item 31: Dormie Moment overlay */}
      <DormieMoment
        visible={dormieMoment.visible}
        type={dormieMoment.type}
        playerName={dormieMoment.playerName}
        detail={dormieMoment.detail}
        onDismiss={() => setDormieMoment((prev) => ({ ...prev, visible: false }))}
      />

      {/* Item 32: Side Game Toast */}
      {sideGameToastEvents.length > 0 && (
        <SideGameToast
          events={sideGameToastEvents}
          onConfirm={(eventId, value) => {
            setSideGameToastEvents((prev) => prev.filter((e) => e.id !== eventId));
          }}
          onDismiss={(eventId) => {
            setSideGameToastEvents((prev) => prev.filter((e) => e.id !== eventId));
          }}
        />
      )}

      {/* Item 33: Hole Transition Banner */}
      <HoleTransitionBanner
        visible={transitionBanner.visible}
        holeNumber={transitionBanner.holeNumber}
        par={transitionBanner.par}
        results={transitionBanner.results}
        onDismiss={() => setTransitionBanner((prev) => ({ ...prev, visible: false }))}
      />

      {/* Elite polish: Confetti on round completion */}
      <Confetti visible={showConfetti} onDone={() => setShowConfetti(false)} />

      {/* Elite polish: Personal Best Banner */}
      <PersonalBestBanner
        visible={showPersonalBest}
        courseName={courseName}
        previousBest={prevBest}
        onDone={() => setShowPersonalBest(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerCourseName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerThrough: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: GEO,
  },
  headerHoleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
  },
  headerHoleLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerHoleNum: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
    fontFamily: GEO,
  },
  headerParBadge: {
    alignItems: 'center',
  },
  headerParLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerParValue: {
    color: '#D4AF37',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: GEO,
  },
  headerFormat: {
    color: 'rgba(212,175,55,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 4,
  },

  /* Hole strip */
  holeStrip: {
    borderBottomWidth: 1,
    maxHeight: 58,
  },
  holeStripContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 6,
  },
  holeChip: {
    width: 40,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  holeChipNum: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: GEO,
  },
  holeChipPar: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: -1,
    fontFamily: GEO,
  },

  /* Scoring body */
  scoringBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  /* Player card */
  playerCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6,
  },
  playerNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  strokeDot: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strokeDotText: {
    color: '#1E4D2B',
    fontSize: 10,
    fontWeight: '800',
  },
  runningWrap: {
    alignItems: 'flex-end',
  },
  runningTotal: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: GEO,
  },
  runningLabel: {
    fontSize: 10,
    marginTop: 1,
  },

  /* Score input */
  scoreInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 14,
  },
  scoreBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scoreCenterWrap: {
    alignItems: 'center',
    minWidth: 80,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '700',
    fontFamily: GEO,
    letterSpacing: -1,
  },
  netScore: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: -4,
  },
  scoreLabelText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },

  /* Secondary inputs */
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  secondaryGroup: {
    alignItems: 'center',
    gap: 4,
  },
  secondaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  miniValue: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  toggleChip: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  /* Result banner */
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  resultText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Nav buttons */
  navRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navFinish: {
    borderWidth: 0,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Section title (shared) */
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },

  /* Post-round summary */
  summaryScreen: {
    flex: 1,
  },
  summaryHeader: {
    paddingTop: STATUS_BAR_H + 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  summarySubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
  },
  summaryBody: {
    paddingHorizontal: 16,
  },

  /* Summary table */
  summaryTable: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  summaryTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  summaryColHeader: {
    color: '#E8E4DE',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  summaryColPos: {
    width: 32,
    textAlign: 'center',
  },
  summaryColName: {
    flex: 1,
    paddingRight: 4,
  },
  summaryColNum: {
    width: 48,
    textAlign: 'right',
    fontSize: 14,
  },
  summaryPosText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryPlayerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryPlayerName: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Stat cards */
  statCard: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statCardName: {
    fontSize: 13,
    fontWeight: '600',
  },
  statCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  miniStat: {
    alignItems: 'center',
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: GEO,
  },
  miniStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 3,
    textTransform: 'uppercase',
  },

  /* Done button */
  doneBtn: {
    marginTop: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* Header actions (Features 11, 12, 14) */
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionBtn: {
    position: 'relative',
  },
  feedBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#C44B4F',
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },

  /* Feature 2: Penalty row */
  penaltyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
  },
  penaltyGroup: {
    alignItems: 'center',
    gap: 3,
  },
  penaltyLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  penaltyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  penaltyValue: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
    fontFamily: GEO,
  },

  /* Feature 2: Hole chip indicators */
  holeChipPenaltyDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 5,
    height: 5,
    backgroundColor: '#C44B4F',
  },
  holeChipNoteDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 5,
    height: 5,
  },

  /* Feature 7: Score entry grid */
  scoreGridRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 8,
  },
  scoreGridCell: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scoreGridText: {
    fontSize: 18,
    fontFamily: GEO,
    fontWeight: '700',
  },
  highScoreStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreLabelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },

  /* Feature 6: Hole tools */
  holeToolsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  holeToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  holeToolLabel: {
    fontSize: 10,
    fontWeight: '600',
  },

  /* Feature 6: Note input */
  noteInput: {
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 12,
  },

  /* Feature 1: Hammer */
  hammerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 12,
  },
  hammerBtnText: {
    color: '#1E4D2B',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  hammerMultiplierBadge: {
    backgroundColor: '#1E4D2B',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hammerMultiplierText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
  },
  hammerMultiplierDisplay: {
    fontSize: 20,
    fontWeight: '700',
    marginVertical: 8,
    textAlign: 'center',
  },

  /* Modals (shared) */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: GEO,
    textTransform: 'uppercase',
  },
  modalText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 100,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Feature 3: Putt distance */
  puttDistGrid: {
    gap: 8,
  },
  puttDistBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  puttDistBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Feature 4: Best Ball */
  bestBallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 16,
  },
  bestBallTeam: {
    alignItems: 'center',
    flex: 1,
  },
  bestBallTeamLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  bestBallTeamScore: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: GEO,
  },
  bestBallVs: {
    fontSize: 11,
    fontWeight: '600',
  },
  bestBallSetupRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  bestBallColumn: {
    flex: 1,
    gap: 8,
  },
  bestBallColumnTitle: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  bestBallPlayerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
  },
  bestBallPlayerName: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Feature 10: Confirmation */
  confirmHeader: {
    paddingTop: STATUS_BAR_H + 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  confirmTitle: {
    color: '#D4AF37',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  confirmSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  confirmTotalsRow: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  confirmPlayerTotals: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  confirmPlayerName: {
    fontSize: 13,
    fontWeight: '600',
    width: 60,
  },
  confirmNineTotals: {
    flexDirection: 'row',
    gap: 16,
  },
  confirmNineItem: {
    alignItems: 'center',
  },
  confirmNineLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  confirmNineValue: {
    fontSize: 18,
    fontWeight: '600',
  },

  /* Feature 11: Leaderboard */
  leaderboardScreen: {
    flex: 1,
    paddingTop: STATUS_BAR_H,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  leaderboardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: GEO,
  },
  leaderboardCourse: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  lbPos: {
    color: '#D4AF37',
    fontSize: 18,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
    fontFamily: GEO,
  },
  lbNameWrap: {
    flex: 1,
  },
  lbName: {
    color: '#E8E4DE',
    fontSize: 14,
    fontWeight: '500',
  },
  lbThru: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 1,
  },
  lbTotal: {
    color: '#E8E4DE',
    fontSize: 20,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
    fontFamily: GEO,
  },
  lbToPar: {
    fontSize: 14,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
    fontFamily: GEO,
  },

  /* Competition tab pills */
  compTabRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  compTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  compTabPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  compBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#D4AF37',
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compBadgeText: {
    color: '#1E4D2B',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: GEO,
  },

  /* Season view */
  seasonViewHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  seasonViewTitle: {
    color: '#D4AF37',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  seasonViewMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 4,
  },
  seasonProjectedCard: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  seasonProjectedLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  seasonProjectedValue: {
    color: '#D4AF37',
    fontSize: 32,
    fontWeight: '700',
  },
  seasonProjectedSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 4,
  },
  seasonStandingsTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  /* Matchup view */
  matchupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  matchupPlayerCol: {
    alignItems: 'center',
    gap: 6,
  },
  matchupPlayerName: {
    color: '#E8E4DE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  matchupVs: {
    paddingHorizontal: 12,
  },
  matchupVsText: {
    color: '#D4AF37',
    fontSize: 18,
    fontWeight: '700',
  },
  matchStatusBanner: {
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  matchStatusText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  matchupGrid: {
    marginBottom: 16,
  },
  matchupGridHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  matchupGridRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  matchupGridCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchupGridHole: {
    width: 40,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  matchupGridScore: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  matchupGridResult: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchupWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  matchupWaitingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontStyle: 'italic',
  },

  /* Feature 12: Live feed */
  feedContainer: {
    padding: 20,
  },
  feedTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  feedEmpty: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 40,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  feedItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  feedItemTime: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: GEO,
  },

  /* Feature 13: Running panel */
  runningPanelWrap: {
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  runningPanelToggle: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  runningPanelToggleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  runningPanelContent: {
    padding: 12,
  },
  runningGameSection: {
    marginBottom: 10,
  },
  runningGameTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  runningGameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  runningGameName: {
    fontSize: 12,
    fontWeight: '500',
  },
  runningGameValue: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: GEO,
  },
  runningGameNote: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },

  /* Feature 14: Solo mode nav */
  soloNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 10,
  },
  soloNavText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Feature 14: Compact player card */
  playerCardCompact: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  compactName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  compactRunning: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactGrid: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 4,
  },
  compactGridCell: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  compactGridText: {
    fontSize: 14,
    fontFamily: GEO,
    fontWeight: '700',
  },
  compactPuttsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  compactPuttsLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  compactPuttsValue: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
    fontFamily: GEO,
  },

  /* Feature 24: Season banner */
  seasonBanner: {
    backgroundColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 10,
  },
  seasonBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seasonBannerName: {
    color: '#1E4D2B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  seasonBannerWeek: {
    color: '#1E4D2B',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.8,
  },
  seasonBannerFormat: {
    color: '#1E4D2B',
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.7,
  },
  seasonMultiplierBadge: {
    backgroundColor: '#1E4D2B',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  seasonMultiplierText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Item 11: Header hole detail */
  headerHoleDetail: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  /* Item 35: Round type badge + format row */
  headerFormatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  roundTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roundTypeBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },

  /* Item 8: Side game ticker */
  sideGameTicker: {
    backgroundColor: '#1E4D2B',
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  sideGameTickerCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideGameTickerText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  sideGameTickerExpanded: {
    gap: 4,
  },
  sideGameTickerExpandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideGameTickerTitle: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sideGameTickerLine: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    paddingVertical: 2,
  },

  /* Item 9: Tag logging */
  tagSection: {
    marginBottom: 12,
    paddingTop: 8,
  },
  tagSectionTitle: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagIndicator: {
    fontSize: 9,
    fontWeight: '700',
  },

  /* Item 10: Broadcast leaderboard header */
  broadcastHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    gap: 10,
  },
  broadcastColPos: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    width: 28,
    textAlign: 'center',
  },
  broadcastColName: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  broadcastColThru: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    width: 36,
    textAlign: 'center',
  },
  broadcastColTotal: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    width: 36,
    textAlign: 'right',
  },
  broadcastColPar: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    width: 40,
    textAlign: 'right',
  },
});

// ─── Post-round summary styles ────────────────────────────────────────
const ps = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H + 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: GEO,
    letterSpacing: -1,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
  },
  headerFormat: {
    color: 'rgba(212,175,55,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  /* Body */
  body: { paddingHorizontal: 20 },

  /* Section title */
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },

  /* Standings table */
  standingsTable: { borderWidth: 1, overflow: 'hidden' },
  standingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  stHeader: {
    color: '#E8E4DE',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  stColPos: { width: 32, textAlign: 'center', fontFamily: GEO },
  stColName: { flex: 1, paddingRight: 4 },
  stColNum: { width: 48, textAlign: 'right', fontSize: 14, fontFamily: GEO },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginTop: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* ─── Scorecard tab ──────────────────────────────────── */
  scRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
  },
  scCellHole: {
    width: 52,
    paddingLeft: 8,
    fontSize: 10,
    fontWeight: '600',
  },
  scCell: {
    width: 32,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 6,
    fontFamily: GEO,
  },
  scCellTotal: {
    width: 72,
    alignItems: 'center',
    paddingRight: 8,
  },
  scHeaderText: {
    color: '#E8E4DE',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    fontFamily: GEO,
  },
  scParText: {
    fontSize: 10,
    textAlign: 'center',
    fontFamily: GEO,
  },
  scPlayerLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  scTotalText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scNetText: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },

  /* ─── Stats tab ──────────────────────────────────────── */
  statPlayerCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  statPlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  statPlayerName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  statPlayerScore: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: GEO,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  statItem: {
    width: '28%' as unknown as number,
    minWidth: 80,
  },
  statItemLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  statItemValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: GEO,
  },
  statItemSub: {
    fontSize: 10,
    marginTop: 1,
  },
  parAvgRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  parAvgItem: {
    alignItems: 'center',
  },
  parAvgLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  parAvgValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: GEO,
  },

  /* ─── Games tab ──────────────────────────────────────── */
  gameCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  gameTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  gameLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  gameLineText: {
    fontSize: 13,
    fontWeight: '500',
  },
  gameLineValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: GEO,
  },
  gamesEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  gamesEmptyText: {
    fontSize: 14,
  },

  /* ─── Share card ─────────────────────────────────────── */
  shareSection: {
    marginTop: 24,
  },
  sharePreview: {
    padding: 24,
    alignItems: 'center',
  },
  shareDormie: {
    color: '#D4AF37',
    fontSize: 9,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 3,
  },
  shareCourse: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  shareDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  shareScores: {
    marginTop: 16,
    width: '100%',
  },
  shareScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sharePlayerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  sharePlayerScore: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
    fontFamily: GEO,
  },
  sharePlayerToPar: {
    fontSize: 14,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
  },
  shareStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
  },
  shareStat: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* ─── Save button ────────────────────────────────────── */
  saveBtn: {
    marginTop: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* ─── Feature 5: Settlement ──────────────────────────── */
  settlementSection: {
    marginTop: 20,
  },
  settlementCard: {
    borderWidth: 1,
    padding: 16,
  },
  settlementSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  settlementEmpty: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  settlementName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  settlementAmount: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: GEO,
  },
  settleUpBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  settleUpBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
