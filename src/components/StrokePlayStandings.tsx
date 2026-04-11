import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { haptics } from '../lib/haptics';
import { Avatar } from './Avatar';
import GoldDivider from './GoldDivider';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────────────────────────
export type StrokePlayRound = {
  roundNumber: number;
  date: string;
  courseName: string;
  grossScore: number;
  netScore: number | null;
  par: number;
  isDropped: boolean;
};

export type StrokePlayPlayer = {
  playerId: string;
  name: string;
  handicap: number;
  avatarColor: string;
  rounds: StrokePlayRound[];
  totalStrokes: number;
  totalPar: number;
  isComplete: boolean;
};

export type StrokePlayConfig = {
  totalRounds: number;
  scoringType: 'net' | 'gross' | 'both';
  dropWorst: boolean;
  dropCount: number;
  isSeasonComplete: boolean;
};

type Props = {
  players: StrokePlayPlayer[];
  config: StrokePlayConfig;
  onChampionMoment?: (winner: StrokePlayPlayer) => void;
};

// ─── Progress Bar ────────────────────────────────────────────────────
function ProgressBar({ current, total, colors: c }: { current: number; total: number; colors: any }) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: c.gold, fontFamily: GEO }]}>
          Round {current} of {total}
        </Text>
        <Text style={[styles.progressPct, { color: c.textMuted }]}>
          {Math.round(pct)}%
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: c.elevated }]}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: c.gold }]} />
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────
function formatToPar(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function toParColor(diff: number, c: any): string {
  if (diff < 0) return c.scoreUnder ?? '#1D9E75';
  if (diff > 0) return c.scoreOver ?? '#E24B4A';
  return c.textMuted;
}

function rankLabel(idx: number, players: StrokePlayPlayer[]): string {
  if (idx === 0) return '1';
  const prev = players[idx - 1];
  const curr = players[idx];
  if (prev.totalStrokes === curr.totalStrokes) {
    // Check if tied with previous player
    // Walk backward to find first in the tie group
    let tieStart = idx;
    while (tieStart > 0 && players[tieStart - 1].totalStrokes === curr.totalStrokes) {
      tieStart--;
    }
    return `T${tieStart + 1}`;
  }
  return `${idx + 1}`;
}

// ─── Expanded Round Detail ───────────────────────────────────────────
function RoundDetail({ round, scoringType, colors: c }: { round: StrokePlayRound; scoringType: string; colors: any }) {
  const diff = round.grossScore - round.par;
  const isDropped = round.isDropped;

  return (
    <View style={[styles.roundRow, { borderBottomColor: c.border, opacity: isDropped ? 0.45 : 1 }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.roundNum, { color: c.textMuted }]}>RD {round.roundNumber}</Text>
          {isDropped && (
            <View style={[styles.droppedBadge, { backgroundColor: c.urgent + '22' }]}>
              <Text style={[styles.droppedText, { color: c.urgent }]}>DROPPED</Text>
            </View>
          )}
        </View>
        <Text style={[styles.roundCourse, { color: c.text }]}>{round.courseName}</Text>
        <Text style={[styles.roundDate, { color: c.textMuted }]}>{round.date}</Text>
      </View>
      <View style={styles.roundScores}>
        <Text style={[
          styles.roundGross,
          { color: isDropped ? c.textMuted : c.text, fontFamily: GEO, textDecorationLine: isDropped ? 'line-through' : 'none' },
        ]}>
          {round.grossScore}
        </Text>
        {scoringType === 'net' && round.netScore !== null && (
          <Text style={[styles.roundNet, { color: c.textMuted }]}>
            Net {round.netScore}
          </Text>
        )}
        <Text style={[styles.roundToPar, { color: isDropped ? c.textMuted : toParColor(diff, c) }]}>
          {formatToPar(round.grossScore, round.par)}
        </Text>
      </View>
    </View>
  );
}

// ─── Player Row ──────────────────────────────────────────────────────
function PlayerRow({
  player,
  rank,
  leaderStrokes,
  config,
  colors: c,
  isExpanded,
  onToggle,
}: {
  player: StrokePlayPlayer;
  rank: string;
  leaderStrokes: number;
  config: StrokePlayConfig;
  colors: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isLeader = player.totalStrokes === leaderStrokes && player.isComplete;
  const behind = player.totalStrokes - leaderStrokes;
  const roundsCompleted = player.rounds.length;
  const toPar = player.totalStrokes - player.totalPar;
  const isIncomplete = roundsCompleted < config.totalRounds && !config.isSeasonComplete;
  const leaderRoundsCompleted = config.totalRounds; // leader always maxed in sorted context

  return (
    <View>
      <Pressable
        onPress={() => { haptics.light(); onToggle(); }}
        style={({ pressed }) => [
          styles.playerRow,
          { borderBottomColor: c.border, opacity: pressed ? 0.7 : 1 },
          config.isSeasonComplete && isLeader && { backgroundColor: c.gold + '0A' },
        ]}
      >
        {/* Rank */}
        <View style={styles.rankCol}>
          {config.isSeasonComplete && isLeader ? (
            <Ionicons name="trophy" size={16} color={c.gold} />
          ) : (
            <Text style={[styles.rankText, { color: isLeader ? c.gold : c.text, fontFamily: GEO }]}>
              {rank}
            </Text>
          )}
          {!config.isSeasonComplete && behind === 0 && player.isComplete && (
            <Ionicons name="ribbon" size={12} color={c.gold} style={{ marginTop: 1 }} />
          )}
        </View>

        {/* Player */}
        <View style={styles.playerCol}>
          <Avatar id={player.playerId} name={player.name} size={28} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.playerName, { color: c.text }]} numberOfLines={1}>
              {player.name}
            </Text>
            {isIncomplete && (
              <Text style={[styles.incompleteBadge, { color: c.textMuted }]}>incomplete</Text>
            )}
          </View>
        </View>

        {/* Rounds fraction */}
        <View style={styles.roundsCol}>
          <Text style={[styles.roundsFraction, { color: roundsCompleted === config.totalRounds ? c.text : c.textMuted, fontFamily: GEO }]}>
            {roundsCompleted}/{config.totalRounds}
          </Text>
        </View>

        {/* Total strokes */}
        <View style={styles.strokesCol}>
          <Text style={[styles.strokesVal, { color: c.text, fontFamily: GEO }]}>
            {player.totalStrokes}
          </Text>
        </View>

        {/* vs Par */}
        <View style={styles.parCol}>
          <Text style={[styles.parVal, { color: toParColor(toPar, c), fontFamily: GEO }]}>
            {formatToPar(player.totalStrokes, player.totalPar)}
          </Text>
        </View>

        {/* Behind */}
        <View style={styles.behindCol}>
          <Text style={[styles.behindVal, { color: behind === 0 ? c.gold : c.textMuted, fontFamily: GEO }]}>
            {behind === 0 ? '\u2014' : `+${behind}`}
          </Text>
        </View>

        {/* Expand chevron */}
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={c.textMuted} />
      </Pressable>

      {/* Expanded round detail */}
      {isExpanded && (
        <View style={[styles.expandedSection, { backgroundColor: c.elevated }]}>
          {player.rounds.length === 0 ? (
            <Text style={[styles.noRounds, { color: c.textMuted }]}>No rounds submitted yet</Text>
          ) : (
            player.rounds.map((r) => (
              <RoundDetail key={r.roundNumber} round={r} scoringType={config.scoringType} colors={c} />
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export function StrokePlayStandings({ players, config, onChampionMoment }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort: lowest total strokes first; for incomplete players, sort by avg strokes/round
  const sorted = useMemo(() => {
    return [...players].sort((a, b) => {
      // Complete players first
      if (a.isComplete && !b.isComplete) return -1;
      if (!a.isComplete && b.isComplete) return 1;

      // Both complete: lowest strokes wins
      if (a.isComplete && b.isComplete) {
        return a.totalStrokes - b.totalStrokes;
      }

      // Both incomplete: sort by avg strokes per round
      const avgA = a.rounds.length > 0 ? a.totalStrokes / a.rounds.length : Infinity;
      const avgB = b.rounds.length > 0 ? b.totalStrokes / b.rounds.length : Infinity;
      return avgA - avgB;
    });
  }, [players]);

  const leaderStrokes = sorted.length > 0 ? sorted[0].totalStrokes : 0;

  // Calculate max rounds completed among all players for progress
  const maxRoundsCompleted = useMemo(() => {
    return Math.max(0, ...players.map(p => p.rounds.length));
  }, [players]);

  const handleToggle = useCallback((playerId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === playerId ? null : playerId);
  }, [expandedId]);

  // Trigger champion moment when season completes
  const championFired = useRef(false);
  useEffect(() => {
    if (config.isSeasonComplete && sorted.length > 0 && onChampionMoment && !championFired.current) {
      championFired.current = true;
      onChampionMoment(sorted[0]);
    }
  }, [config.isSeasonComplete, sorted, onChampionMoment]);

  return (
    <View>
      {/* Progress bar */}
      <ProgressBar current={maxRoundsCompleted} total={config.totalRounds} colors={c} />

      {/* Column headers */}
      <View style={[styles.headerRow, { borderBottomColor: c.border, backgroundColor: c.greenDark + '18' }]}>
        <View style={styles.rankCol}>
          <Text style={[styles.headerText, { color: c.textMuted }]}>#</Text>
        </View>
        <View style={styles.playerCol}>
          <Text style={[styles.headerText, { color: c.textMuted }]}>Player</Text>
        </View>
        <View style={styles.roundsCol}>
          <Text style={[styles.headerText, { color: c.textMuted }]}>Rds</Text>
        </View>
        <View style={styles.strokesCol}>
          <Text style={[styles.headerText, { color: c.textMuted }]}>Total</Text>
        </View>
        <View style={styles.parCol}>
          <Text style={[styles.headerText, { color: c.textMuted }]}>Par</Text>
        </View>
        <View style={styles.behindCol}>
          <Text style={[styles.headerText, { color: c.textMuted }]}>+/-</Text>
        </View>
        <View style={{ width: 14 }} />
      </View>

      {/* Player rows */}
      {sorted.map((player, idx) => (
        <PlayerRow
          key={player.playerId}
          player={player}
          rank={rankLabel(idx, sorted)}
          leaderStrokes={leaderStrokes}
          config={config}
          colors={c}
          isExpanded={expandedId === player.playerId}
          onToggle={() => handleToggle(player.playerId)}
        />
      ))}

      {/* Season complete banner */}
      {config.isSeasonComplete && sorted.length > 0 && (
        <View style={[styles.completeBanner, { backgroundColor: c.gold + '12', borderColor: c.gold + '33' }]}>
          <Ionicons name="trophy" size={18} color={c.gold} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.completeTitle, { color: c.gold, fontFamily: GEO }]}>SEASON COMPLETE</Text>
            <Text style={[styles.completeSubtitle, { color: c.textMuted }]}>
              Final standings are locked
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.light();
              // Expand all rounds for the champion
              setExpandedId(sorted[0].playerId);
            }}
            style={[styles.viewResultsBtn, { borderColor: c.gold + '44' }]}
          >
            <Text style={[styles.viewResultsText, { color: c.gold }]}>View Full Results</Text>
          </Pressable>
        </View>
      )}

      {/* Drop worst info */}
      {config.dropWorst && (
        <View style={[styles.dropInfo, { backgroundColor: c.elevated }]}>
          <Ionicons name="information-circle-outline" size={16} color={c.textMuted} />
          <Text style={[styles.dropInfoText, { color: c.textMuted }]}>
            Worst {config.dropCount} round{config.dropCount > 1 ? 's' : ''} dropped per player (shown with strikethrough)
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Demo Data ───────────────────────────────────────────────────────
export function buildDemoStrokePlayData(totalRounds: number, dropWorst: boolean, dropCount: number, scoringType: 'net' | 'gross' | 'both' = 'gross'): { players: StrokePlayPlayer[]; config: StrokePlayConfig } {
  const courseNames = ['Pebble Beach', 'TPC Sawgrass', 'Pinehurst No. 2', 'Torrey Pines', 'Bethpage Black', 'Kiawah Ocean', 'Whistling Straits', 'Harbour Town'];
  const completedRounds = Math.min(6, totalRounds);

  const rawPlayers: { name: string; handicap: number; scores: number[] }[] = [
    { name: 'McGowan', handicap: 8, scores: [74, 78, 72, 76, 75, 73] },
    { name: 'Fletcher', handicap: 12, scores: [76, 75, 79, 74, 77, 76] },
    { name: 'Patterson', handicap: 6, scores: [75, 80, 74, 78, 76, 77] },
    { name: 'Sullivan', handicap: 15, scores: [79, 77, 81, 80, 78, 82] },
    { name: 'Rodriguez', handicap: 10, scores: [78, 82, 77, 79, 83, 78] },
    { name: 'Chen', handicap: 18, scores: [82, 84, 80, 85, 81, 83] },
    { name: 'Taylor', handicap: 14, scores: [80, 79, 85, 82, 80, 84] },
    { name: 'Brooks', handicap: 20, scores: [85, 88, 83, 86, 87, 84] },
  ];

  const players: StrokePlayPlayer[] = rawPlayers.map((rp, idx) => {
    const rounds: StrokePlayRound[] = rp.scores.slice(0, completedRounds).map((score, rIdx) => ({
      roundNumber: rIdx + 1,
      date: `Mar ${(rIdx + 1) * 4 + 2}, 2026`,
      courseName: courseNames[rIdx % courseNames.length],
      grossScore: score,
      netScore: score - Math.floor(rp.handicap * 0.8),
      par: 72,
      isDropped: false,
    }));

    // Mark worst round(s) as dropped — use net scores when scoring type is net
    if (dropWorst && rounds.length > 0) {
      const sorted = [...rounds].sort((a, b) => {
        const scoreA = scoringType === 'net' && a.netScore !== null ? a.netScore : a.grossScore;
        const scoreB = scoringType === 'net' && b.netScore !== null ? b.netScore : b.grossScore;
        return scoreB - scoreA;
      });
      for (let i = 0; i < Math.min(dropCount, sorted.length); i++) {
        const worstRound = rounds.find(r => r.roundNumber === sorted[i].roundNumber);
        if (worstRound) worstRound.isDropped = true;
      }
    }

    const countingRounds = rounds.filter(r => !r.isDropped);
    const totalStrokes = scoringType === 'net'
      ? countingRounds.reduce((s, r) => s + (r.netScore ?? r.grossScore), 0)
      : countingRounds.reduce((s, r) => s + r.grossScore, 0);
    const totalPar = countingRounds.reduce((s, r) => s + r.par, 0);

    return {
      playerId: `sp_${idx + 1}`,
      name: rp.name,
      handicap: rp.handicap,
      avatarColor: '#006747',
      rounds,
      totalStrokes,
      totalPar,
      isComplete: completedRounds >= totalRounds,
    };
  });

  return {
    players,
    config: {
      totalRounds,
      scoringType: scoringType === 'both' ? 'both' : scoringType,
      dropWorst,
      dropCount,
      isSeasonComplete: completedRounds >= totalRounds,
    },
  };
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  progressContainer: {
    padding: 16,
    paddingBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  progressPct: {
    fontSize: 11,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rankCol: { width: 32, alignItems: 'center' },
  playerCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 100 },
  roundsCol: { width: 38, alignItems: 'center' },
  strokesCol: { width: 44, alignItems: 'center' },
  parCol: { width: 38, alignItems: 'center' },
  behindCol: { width: 34, alignItems: 'center' },

  rankText: {
    fontSize: 16,
    fontWeight: '700',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 90,
  },
  incompleteBadge: {
    fontSize: 9,
    fontStyle: 'italic',
  },
  roundsFraction: {
    fontSize: 12,
    fontWeight: '600',
  },
  strokesVal: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  parVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  behindVal: {
    fontSize: 12,
    fontWeight: '600',
  },

  expandedSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  roundNum: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  roundCourse: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  roundDate: {
    fontSize: 10,
    marginTop: 1,
  },
  roundScores: {
    alignItems: 'flex-end',
    gap: 2,
  },
  roundGross: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  roundNet: {
    fontSize: 11,
  },
  roundToPar: {
    fontSize: 11,
    fontWeight: '600',
  },
  droppedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  droppedText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  noRounds: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },

  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 16,
    padding: 14,
    borderWidth: 1,
  },
  completeTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  completeSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  viewResultsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  viewResultsText: {
    fontSize: 11,
    fontWeight: '600',
  },

  dropInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
  },
  dropInfoText: {
    fontSize: 11,
    flex: 1,
  },
});
