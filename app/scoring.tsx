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
function PostRoundSummary({
  players,
  holes,
  allScores,
  scoreMode,
  handicapStrokes,
  onDone,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
  scoreMode: string;
  handicapStrokes: Map<string, Map<number, number>>;
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const totalPar = holes.reduce((a, h) => a + h.par, 0);

  // Calculate totals per player
  const playerTotals = players.map((p) => {
    let gross = 0;
    let net = 0;
    let putts = 0;
    let firHit = 0;
    let firTotal = 0;
    let girCount = 0;
    let holesPlayed = 0;

    holes.forEach((h) => {
      const s = allScores.get(h.number)?.get(p.id);
      if (!s) return;
      holesPlayed++;
      gross += s.gross;
      const strokes = handicapStrokes.get(p.id)?.get(h.number) ?? 0;
      net += s.gross - strokes;
      putts += s.putts;
      if (h.par >= 4) {
        firTotal++;
        if (s.fir === true) firHit++;
      }
      if (isGIR(s.gross, s.putts, h.par)) girCount++;
    });

    return { player: p, gross, net, putts, firHit, firTotal, girCount, holesPlayed };
  });

  // Sort by gross score
  const sorted = [...playerTotals].sort((a, b) => a.gross - b.gross);

  return (
    <View style={[st.summaryScreen, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1E4D2B', '#2D6A3F']}
          style={st.summaryHeader}
        >
          <View style={st.headerOverlay} />
          <Text style={[st.summaryTitle, { fontFamily: GEO }]}>Round Complete</Text>
          <Text style={st.summarySubtitle}>
            {holes.length} holes · Par {totalPar}
          </Text>
        </LinearGradient>

        <View style={st.summaryBody}>
          {/* Results table */}
          <Text style={[st.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
            FINAL STANDINGS
          </Text>
          <View style={[st.summaryTable, { borderColor: c.border }]}>
            {/* Header */}
            <View style={[st.summaryTableRow, { backgroundColor: '#1E4D2B' }]}>
              <Text style={[st.summaryColPos, st.summaryColHeader]}>POS</Text>
              <Text style={[st.summaryColName, st.summaryColHeader]}>PLAYER</Text>
              <Text style={[st.summaryColNum, st.summaryColHeader]}>GROSS</Text>
              {scoreMode === 'net' && (
                <Text style={[st.summaryColNum, st.summaryColHeader]}>NET</Text>
              )}
              <Text style={[st.summaryColNum, st.summaryColHeader]}>TO PAR</Text>
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
                    st.summaryTableRow,
                    {
                      backgroundColor: isMe ? `${c.teal}12` : i % 2 === 0 ? c.cardBg : c.elevated,
                    },
                    isMe && { borderLeftWidth: 2, borderLeftColor: c.teal },
                  ]}
                >
                  <Text style={[st.summaryColPos, st.summaryPosText, { color: c.textMuted }]}>
                    {medal || pos}
                  </Text>
                  <View style={[st.summaryColName, st.summaryPlayerCell]}>
                    <Avatar id={row.player.id} size={22} name={row.player.name} />
                    <Text
                      style={[
                        st.summaryPlayerName,
                        { color: isMe ? c.teal : c.text },
                        isMe && { fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {isMe ? 'You' : row.player.name}
                    </Text>
                  </View>
                  <Text style={[st.summaryColNum, { color: c.text, fontFamily: GEO, fontWeight: '700' }]}>
                    {row.gross}
                  </Text>
                  {scoreMode === 'net' && (
                    <Text style={[st.summaryColNum, { color: c.gold, fontFamily: GEO, fontWeight: '700' }]}>
                      {row.net}
                    </Text>
                  )}
                  <Text
                    style={[
                      st.summaryColNum,
                      { color: toParColor(diff, c), fontFamily: GEO, fontWeight: '700' },
                    ]}
                  >
                    {formatToPar(row.gross, totalPar)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Player stat cards */}
          <Text style={[st.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
            ROUND STATS
          </Text>
          {sorted.map((row) => {
            const isMe = row.player.id === '1';
            return (
              <View
                key={row.player.id}
                style={[st.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}
              >
                <View style={st.statCardHeader}>
                  <Avatar id={row.player.id} size={24} name={row.player.name} />
                  <Text style={[st.statCardName, { color: isMe ? c.teal : c.text }]}>
                    {isMe ? 'You' : row.player.name}
                  </Text>
                </View>
                <View style={st.statCardRow}>
                  <MiniStat label="PUTTS" value={String(row.putts)} color={c.text} c={c} />
                  <MiniStat
                    label="FIR"
                    value={row.firTotal > 0 ? `${Math.round((row.firHit / row.firTotal) * 100)}%` : '-'}
                    color={c.text}
                    c={c}
                  />
                  <MiniStat
                    label="GIR"
                    value={row.holesPlayed > 0 ? `${Math.round((row.girCount / row.holesPlayed) * 100)}%` : '-'}
                    color={c.text}
                    c={c}
                  />
                  <MiniStat
                    label="AVG PUTTS"
                    value={row.holesPlayed > 0 ? (row.putts / row.holesPlayed).toFixed(1) : '-'}
                    color={c.text}
                    c={c}
                  />
                </View>
              </View>
            );
          })}

          {/* Done button */}
          <Pressable onPress={onDone} style={[st.doneBtn, { backgroundColor: '#1E4D2B' }]}>
            <Text style={[st.doneBtnText, { color: '#D4AF37', fontFamily: GEO }]}>
              Save & Exit
            </Text>
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
  }>();

  const courseName = params.courseName ?? 'Course';
  const coursePar = Number(params.coursePar) || 72;
  const courseSlope = Number(params.courseSlope) || 113;
  const courseRating = Number(params.courseRating) || 72;
  const holeRange = params.holeRange ?? 'full18';
  const scoreMode = params.scoreMode ?? 'gross';
  const formatLabel = params.format ?? 'Total Strokes';

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
