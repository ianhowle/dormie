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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { Avatar } from '../src/components/Avatar';

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
};

type HoleData = {
  number: number;
  par: number;
  strokeIndex: number; // difficulty rank 1-18 for handicap allocation
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
function scoreName(score: number, par: number): string {
  const diff = score - par;
  if (diff <= -3) return 'Albatross';
  if (diff === -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double';
  if (diff === 3) return 'Triple';
  return `+${diff}`;
}

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

function formatToPar(total: number, par: number): string {
  const diff = total - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : String(diff);
}

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

// ─── Header ───────────────────────────────────────────────────────────
function ScoringHeader({
  courseName,
  holeNumber,
  holePar,
  format,
  totalHoles,
  holesScored,
}: {
  courseName: string;
  holeNumber: number;
  holePar: number;
  format: string;
  totalHoles: number;
  holesScored: number;
}) {
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#1E4D2B', '#2D6A3F']}
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
          {courseName}
        </Text>
        <Text style={st.headerThrough}>
          {holesScored}/{totalHoles}
        </Text>
      </View>

      {/* Hole info */}
      <View style={st.headerHoleRow}>
        <Text style={[st.headerHoleLabel]}>HOLE</Text>
        <Text style={[st.headerHoleNum, { fontFamily: GEO }]}>{holeNumber}</Text>
        <View style={st.headerParBadge}>
          <Text style={st.headerParLabel}>PAR</Text>
          <Text style={[st.headerParValue, { fontFamily: GEO }]}>{holePar}</Text>
        </View>
      </View>

      {/* Format */}
      <Text style={st.headerFormat}>{format}</Text>
    </LinearGradient>
  );
}

// ─── Hole navigation strip ────────────────────────────────────────────
function HoleStrip({
  holes,
  currentIdx,
  scores,
  onSelect,
}: {
  holes: HoleData[];
  currentIdx: number;
  scores: Map<number, Map<string, HoleScore>>; // holeNumber -> playerId -> score
  onSelect: (idx: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const flatListRef = useRef<FlatList>(null);

  const renderItem = useCallback(
    ({ item, index }: { item: HoleData; index: number }) => {
      const isCurrent = index === currentIdx;
      const hasScores = scores.has(item.number);

      return (
        <Pressable
          onPress={() => onSelect(index)}
          style={[
            st.holeChip,
            {
              backgroundColor: isCurrent
                ? '#D4AF37'
                : hasScores
                  ? `${c.teal}25`
                  : c.elevated,
              borderColor: isCurrent ? '#D4AF37' : hasScores ? c.teal : c.border,
            },
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
        </Pressable>
      );
    },
    [currentIdx, scores, c],
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
}: {
  player: PlayerConfig;
  holePar: number;
  score: HoleScore;
  runningTotal: number;
  runningPar: number;
  netStrokes: number;
  scoreMode: string;
  onChange: (s: HoleScore) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isMe = player.id === '1';
  const showFIR = holePar >= 4;
  const gir = isGIR(score.gross, score.putts, holePar);
  const netScore = score.gross - netStrokes;

  const adjustGross = (delta: number) => {
    const next = Math.max(1, Math.min(15, score.gross + delta));
    onChange({ ...score, gross: next });
  };

  const adjustPutts = (delta: number) => {
    const next = Math.max(0, Math.min(score.gross, score.putts + delta));
    onChange({ ...score, putts: next });
  };

  const toggleFIR = () => {
    onChange({ ...score, fir: score.fir === true ? false : true });
  };

  return (
    <View
      style={[
        st.playerCard,
        {
          backgroundColor: c.cardBg,
          borderColor: isMe ? c.teal : c.border,
        },
        isMe && { borderLeftWidth: 3, borderLeftColor: c.teal },
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

      {/* Main score input */}
      <View style={st.scoreInputRow}>
        <Pressable
          onPress={() => adjustGross(-1)}
          style={[st.scoreBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
        >
          <Ionicons name="remove" size={22} color={c.text} />
        </Pressable>

        <View style={st.scoreCenterWrap}>
          <Text
            style={[
              st.scoreNumber,
              { color: scoreNameColor(score.gross, holePar, c), fontFamily: GEO },
            ]}
          >
            {score.gross}
          </Text>
          {scoreMode === 'net' && netStrokes > 0 && (
            <Text style={[st.netScore, { color: c.gold, fontFamily: GEO }]}>
              ({netScore})
            </Text>
          )}
          <Text
            style={[
              st.scoreLabelText,
              { color: scoreNameColor(score.gross, holePar, c) },
            ]}
          >
            {scoreName(score.gross, holePar)}
          </Text>
        </View>

        <Pressable
          onPress={() => adjustGross(1)}
          style={[st.scoreBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
        >
          <Ionicons name="add" size={22} color={c.text} />
        </Pressable>
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
        : `${players.find((p) => p.id === winners[0])?.name.split(' ')[0]} wins`);

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
        style={[
          st.navBtn,
          { backgroundColor: c.elevated, borderColor: c.border, opacity: canPrev ? 1 : 0.3 },
        ]}
      >
        <Ionicons name="chevron-back" size={18} color={c.text} />
        <Text style={[st.navBtnText, { color: c.text }]}>Prev Hole</Text>
      </Pressable>

      {isLast ? (
        <Pressable
          onPress={onFinish}
          style={[st.navBtn, st.navFinish, { backgroundColor: '#1E4D2B' }]}
        >
          <Text style={[st.navBtnText, { color: '#D4AF37', fontFamily: GEO }]}>
            Finish Round
          </Text>
          <Ionicons name="checkmark-circle" size={18} color="#D4AF37" />
        </Pressable>
      ) : (
        <Pressable
          onPress={onNext}
          style={[
            st.navBtn,
            { backgroundColor: c.teal },
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
          <View key={row.player.id} style={[ps.statPlayerCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
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
        <View key={i} style={[ps.gameCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
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
        colors={['#1E4D2B', '#2D6A3F']}
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

      <Pressable onPress={onShare} style={[ps.shareBtn, { backgroundColor: c.elevated, borderColor: c.border }]}>
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
        <LinearGradient colors={['#1E4D2B', '#2D6A3F']} style={ps.header}>
          <View style={st.headerOverlay} />
          <Text style={[ps.headerTitle, { fontFamily: GEO }]}>Round Complete</Text>
          <Text style={ps.headerSub}>{courseName} · {holes.length} holes · Par {totalPar}</Text>
          <Text style={ps.headerFormat}>{formatLabel}</Text>
        </LinearGradient>

        {/* Final standings (always visible) */}
        <View style={ps.body}>
          <Text style={[ps.sectionTitle, { color: c.gold, fontFamily: GEO }]}>FINAL STANDINGS</Text>
          <View style={[ps.standingsTable, { borderColor: c.border }]}>
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

          {/* Share card */}
          <ShareCard
            courseName={courseName}
            players={players}
            playerTotals={playerTotals}
            totalPar={totalPar}
            onShare={() => Alert.alert('Share', 'Sharing will generate an image in production.')}
          />

          {/* Save button */}
          <Pressable onPress={onDone} style={[ps.saveBtn, { backgroundColor: '#1E4D2B' }]}>
            <Text style={[ps.saveBtnText, { color: '#D4AF37', fontFamily: GEO }]}>Save Round</Text>
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

// ─── Main screen ──────────────────────────────────────────────────────
export default function ScoringScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{
    courseName: string;
    coursePar: string;
    courseSlope: string;
    courseRating: string;
    players: string;
    format: string;
    holeRange: string;
    scoreMode: string;
    sideGames: string;
  }>();

  const courseName = params.courseName ?? 'Course';
  const coursePar = Number(params.coursePar) || 72;
  const courseSlope = Number(params.courseSlope) || 113;
  const courseRating = Number(params.courseRating) || 72;
  const holeRange = params.holeRange ?? 'full18';
  const scoreMode = params.scoreMode ?? 'gross';
  const formatLabel = params.format ?? 'Total Strokes';
  const sideGameKeys: string[] = useMemo(() => {
    try { return JSON.parse(params.sideGames ?? '[]'); } catch { return []; }
  }, [params.sideGames]);

  const players: PlayerConfig[] = useMemo(() => {
    try {
      return JSON.parse(params.players ?? '[]');
    } catch {
      return [{ id: '1', name: 'Ian McGowan', handicap: 8 }];
    }
  }, [params.players]);

  const holes = useMemo(() => buildHoles(coursePar, holeRange), [coursePar, holeRange]);

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

  const handleNext = () => {
    // Auto-save current hole scores if not yet saved
    players.forEach((p) => {
      if (!currentHoleScores.has(p.id)) {
        updatePlayerScore(p.id, getPlayerScore(p.id));
      }
    });
    if (currentHoleIdx < holes.length - 1) {
      setCurrentHoleIdx(currentHoleIdx + 1);
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
    setShowSummary(true);
  };

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
        onDone={() => router.dismissAll()}
      />
    );
  }

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <ScoringHeader
        courseName={courseName}
        holeNumber={currentHole.number}
        holePar={currentHole.par}
        format={formatLabel}
        totalHoles={holes.length}
        holesScored={holesScored}
      />

      <HoleStrip
        holes={holes}
        currentIdx={currentHoleIdx}
        scores={allScores}
        onSelect={setCurrentHoleIdx}
      />

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scoringBody}
      >
        {/* Player score inputs */}
        {players.map((p) => {
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
            />
          );
        })}

        {/* Hole result */}
        {players.length > 1 && (
          <HoleResultBanner
            players={players}
            holeScores={currentHoleScores}
            holePar={currentHole.par}
          />
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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 12,
    paddingHorizontal: 16,
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
  },
  headerHoleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
  },
  headerHoleLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  headerHoleNum: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '700',
  },
  headerParBadge: {
    alignItems: 'center',
  },
  headerParLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerParValue: {
    color: '#D4AF37',
    fontSize: 20,
    fontWeight: '700',
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
    paddingHorizontal: 10,
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
  },
  holeChipPar: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: -1,
  },

  /* Scoring body */
  scoringBody: {
    padding: 16,
  },

  /* Player card */
  playerCard: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
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
    fontSize: 14,
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
    fontSize: 18,
    fontWeight: '700',
  },
  runningLabel: {
    fontSize: 9,
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
    fontSize: 44,
    fontWeight: '700',
  },
  netScore: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: -4,
  },
  scoreLabelText: {
    fontSize: 12,
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
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
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
    fontSize: 14,
    fontWeight: '700',
  },

  /* Section title (shared) */
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
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
    fontSize: 16,
    fontWeight: '700',
  },
  miniStatLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 3,
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
    letterSpacing: 1,
    marginTop: 4,
  },

  /* Body */
  body: { paddingHorizontal: 16 },

  /* Section title */
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 20,
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
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  stColPos: { width: 32, textAlign: 'center' },
  stColName: { flex: 1, paddingRight: 4 },
  stColNum: { width: 48, textAlign: 'right', fontSize: 14 },

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
    fontWeight: '500',
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
  },
  scCellTotal: {
    width: 72,
    alignItems: 'center',
    paddingRight: 8,
  },
  scHeaderText: {
    color: '#E8E4DE',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  scParText: {
    fontSize: 10,
    textAlign: 'center',
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
    padding: 14,
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
    fontSize: 16,
    fontWeight: '700',
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
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  statItemValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statItemSub: {
    fontSize: 9,
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
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  parAvgValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  /* ─── Games tab ──────────────────────────────────────── */
  gameCard: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    marginTop: 8,
  },
  gameTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
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
    fontSize: 18,
    fontWeight: '700',
    width: 40,
    textAlign: 'right',
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
});
