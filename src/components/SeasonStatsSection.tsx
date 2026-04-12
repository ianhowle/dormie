import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { haptics } from '../lib/haptics';
import { Avatar } from './Avatar';
import GoldDivider from './GoldDivider';
import { DonutChart, NestedDonutChart, MiniProgressCircle, DonutLegend } from './DonutChart';
import type { DonutSegment } from './DonutChart';
import { STAT_COLORS } from '../data/playerStats';
import {
  getSeasonScoringBreakdown,
  getSeasonFieldAverages,
  getSeasonWeeklyProgression,
  getUserSeasonComparison,
  getRyderCupTeamStats,
  getRyderCupPlayerContributions,
  getTaleOfTheTape,
  getStrokePlayProgression,
  getLeagueWeeklyPerformance,
  getMatchupScoutReport,
} from '../services/seasonStats.service';
import type {
  PlayerContribution,
  TeamStats,
} from '../services/seasonStats.service';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Season Type Definitions ────────────────────────────────────────
type SeasonStatsType = 'fedex' | 'ryder_cup' | 'stroke_play' | 'league' | 'match_play';

type Props = {
  seasonId: string;
  userId: string;
  seasonType: SeasonStatsType;
  ryderCupConfig?: {
    teamRedName?: string;
    teamBlueName?: string;
    sessionResults?: { id: string; status: string; redScore: number; blueScore: number }[];
    matchResults?: { sessionId: string; redPlayers: string[]; bluePlayers: string[]; winner: 'red' | 'blue' | 'halved' }[];
    finalScore?: { red: number; blue: number };
  };
};

// ─── Main Component ─────────────────────────────────────────────────
export function SeasonStatsSection({ seasonId, userId, seasonType, ryderCupConfig }: Props) {
  switch (seasonType) {
    case 'fedex':
      return <FedExStats seasonId={seasonId} userId={userId} />;
    case 'ryder_cup':
      return <RyderCupStats config={ryderCupConfig} />;
    case 'stroke_play':
      return <StrokePlayStats seasonId={seasonId} userId={userId} />;
    case 'league':
      return <LeagueStats seasonId={seasonId} userId={userId} />;
    case 'match_play':
      return <MatchPlayStats />;
    default:
      return null;
  }
}

// ─── Section Header ─────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Text style={[styles.sectionTitle, { color: c.gold }]}>{title}</Text>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// FEDEX CUP STATS
// ═══════════════════════════════════════════════════════════════════════
function FedExStats({ seasonId, userId }: { seasonId: string; userId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const scoring = useMemo(() => getSeasonScoringBreakdown(seasonId, userId), [seasonId, userId]);
  const comparison = useMemo(() => getUserSeasonComparison(seasonId, userId), [seasonId, userId]);
  const progression = useMemo(() => getSeasonWeeklyProgression(seasonId, userId), [seasonId, userId]);

  const segments: DonutSegment[] = useMemo(() => [
    { label: 'Eagles', value: scoring.eagles, color: STAT_COLORS.eagle },
    { label: 'Birdies', value: scoring.birdies, color: STAT_COLORS.birdie },
    { label: 'Pars', value: scoring.pars, color: STAT_COLORS.par },
    { label: 'Bogeys', value: scoring.bogeys, color: STAT_COLORS.bogey },
    { label: 'Double+', value: scoring.doubles, color: STAT_COLORS.double },
  ], [scoring]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Season Scoring */}
      <View style={styles.section}>
        <SectionHeader title="SEASON SCORING" />
        <View style={[styles.card, { backgroundColor: c.cardBg }]}>
          <DonutChart
            segments={segments}
            size={150}
            strokeWidth={18}
            centerValue={String(scoring.totalHoles)}
            centerLabel="holes"
          />
          <DonutLegend segments={segments} />
          <Text style={[styles.helperText, { color: c.textMuted }]}>
            Based on {scoring.totalRounds} rounds this season
          </Text>
        </View>
      </View>

      {/* You vs The Field */}
      <View style={styles.section}>
        <SectionHeader title="YOU VS THE FIELD" />
        <View style={[styles.card, { backgroundColor: c.cardBg }]}>
          <View style={styles.nestedRow}>
            <View style={styles.nestedItem}>
              <NestedDonutChart
                playerPct={comparison.girPct}
                groupPct={comparison.fieldGirPct}
                size={120}
                playerColor={STAT_COLORS.player}
                groupColor={STAT_COLORS.group}
                label="field avg"
              />
              <Text style={[styles.nestedLabel, { color: c.text }]}>GIR</Text>
              <Text style={[styles.trendText, {
                color: comparison.girTrend >= 0 ? '#006747' : '#C41E3A',
              }]}>
                {comparison.girTrend >= 0 ? '↑' : '↓'} {Math.abs(comparison.girTrend)}% {comparison.girTrend >= 0 ? 'above' : 'below'} field
              </Text>
            </View>
            <View style={styles.nestedItem}>
              <NestedDonutChart
                playerPct={comparison.firPct}
                groupPct={comparison.fieldFirPct}
                size={120}
                playerColor={STAT_COLORS.player}
                groupColor={STAT_COLORS.group}
                label="field avg"
              />
              <Text style={[styles.nestedLabel, { color: c.text }]}>FIR</Text>
              <Text style={[styles.trendText, {
                color: comparison.firTrend >= 0 ? '#006747' : '#C41E3A',
              }]}>
                {comparison.firTrend >= 0 ? '↑' : '↓'} {Math.abs(comparison.firTrend)}% {comparison.firTrend >= 0 ? 'above' : 'below'} field
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Weekly Progression */}
      <View style={styles.section}>
        <SectionHeader title="WEEKLY PROGRESSION" />
        <View style={[styles.card, { backgroundColor: c.cardBg }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressionRow}>
            {progression.map((w) => (
              <MiniProgressCircle
                key={w.week}
                percentage={w.girPct}
                label={w.label}
                size={44}
                color={STAT_COLORS.player}
              />
            ))}
          </ScrollView>
          <Text style={[styles.helperText, { color: c.textMuted }]}>
            GIR% by week
          </Text>
        </View>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RYDER CUP STATS
// ═══════════════════════════════════════════════════════════════════════
function RyderCupStats({ config }: { config?: Props['ryderCupConfig'] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerContribution | null>(null);

  const teamStats = useMemo(() => getRyderCupTeamStats(config), [config]);
  const contributions = useMemo(() => getRyderCupPlayerContributions(config?.matchResults), [config]);

  const redSegments: DonutSegment[] = useMemo(() => buildTeamSegments(teamStats.red), [teamStats]);
  const blueSegments: DonutSegment[] = useMemo(() => buildTeamSegments(teamStats.blue), [teamStats]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Team Comparison — Scoring */}
      <View style={styles.section}>
        <SectionHeader title="TEAM COMPARISON" />
        <View style={[styles.card, { backgroundColor: c.cardBg }]}>
          <View style={styles.teamDonutRow}>
            <View style={styles.teamDonutItem}>
              <DonutChart
                segments={redSegments}
                size={120}
                strokeWidth={14}
                centerValue={String(teamStats.red.points)}
                centerLabel="pts"
                centerValueColor="#C41E3A"
              />
              <Text style={[styles.teamLabel, { color: '#C41E3A' }]}>{teamStats.red.teamName}</Text>
            </View>
            <View style={styles.teamDonutItem}>
              <DonutChart
                segments={blueSegments}
                size={120}
                strokeWidth={14}
                centerValue={String(teamStats.blue.points)}
                centerLabel="pts"
                centerValueColor="#1A2744"
              />
              <Text style={[styles.teamLabel, { color: '#1A2744' }]}>{teamStats.blue.teamName}</Text>
            </View>
          </View>
          <DonutLegend segments={redSegments} />
        </View>
      </View>

      {/* Team GIR Comparison */}
      <View style={styles.section}>
        <SectionHeader title="GREENS IN REGULATION" />
        <View style={[styles.card, { backgroundColor: c.cardBg }]}>
          <NestedDonutChart
            playerPct={teamStats.red.girPct}
            groupPct={teamStats.blue.girPct}
            size={140}
            playerColor="#C41E3A"
            groupColor="#1A2744"
            label={teamStats.blue.teamName}
          />
          <View style={styles.teamGirLegend}>
            <View style={styles.teamGirItem}>
              <View style={[styles.legendDot, { backgroundColor: '#C41E3A' }]} />
              <Text style={[styles.legendText, { color: c.textMuted }]}>
                {teamStats.red.teamName}: {teamStats.red.girPct}%
              </Text>
            </View>
            <View style={styles.teamGirItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1A2744' }]} />
              <Text style={[styles.legendText, { color: c.textMuted }]}>
                {teamStats.blue.teamName}: {teamStats.blue.girPct}%
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Individual Contributions */}
      <View style={styles.section}>
        <SectionHeader title="INDIVIDUAL CONTRIBUTIONS" />
        {contributions.length === 0 && (
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            Match results will appear as sessions complete
          </Text>
        )}
        {contributions.map((p) => (
          <Pressable
            key={p.playerId}
            onPress={() => { haptics.light(); setSelectedPlayer(p); }}
            style={[styles.contributionRow, { backgroundColor: c.cardBg, borderBottomColor: c.border }]}
          >
            <Avatar id={p.playerId} name={p.name} size={32} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.contributionName, { color: c.text }]}>{p.name}</Text>
              <Text style={[styles.contributionRecord, { color: c.textMuted }]}>
                {p.wins}W-{p.losses}L-{p.halves}H
              </Text>
            </View>
            <Text style={[styles.contributionPts, { color: c.gold, fontFamily: GEO }]}>
              {p.pointsEarned}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </Pressable>
        ))}
      </View>

      {/* Player Stats Modal */}
      {selectedPlayer && (
        <PlayerContributionModal
          player={selectedPlayer}
          visible={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function buildTeamSegments(team: TeamStats): DonutSegment[] {
  return [
    { label: 'Eagles', value: team.scoring.eagles, color: STAT_COLORS.eagle },
    { label: 'Birdies', value: team.scoring.birdies, color: STAT_COLORS.birdie },
    { label: 'Pars', value: team.scoring.pars, color: STAT_COLORS.par },
    { label: 'Bogeys', value: team.scoring.bogeys, color: STAT_COLORS.bogey },
    { label: 'Double+', value: team.scoring.doubles, color: STAT_COLORS.double },
  ];
}

function PlayerContributionModal({
  player,
  visible,
  onClose,
}: {
  player: PlayerContribution;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: c.cardBg }]}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar id={player.playerId} name={player.name} size={40} />
              <View>
                <Text style={[styles.modalPlayerName, { color: c.text }]}>{player.name}</Text>
                <Text style={{ fontSize: 12, color: c.textMuted }}>
                  {player.wins}W-{player.losses}L-{player.halves}H · {player.pointsEarned} pts
                </Text>
              </View>
            </View>
            <Pressable onPress={() => { haptics.light(); onClose(); }} hitSlop={12}>
              <Ionicons name="close" size={24} color={c.textMuted} />
            </Pressable>
          </View>

          <View style={[styles.playerStatsGrid, { backgroundColor: c.elevated }]}>
            <View style={styles.playerStatItem}>
              <Text style={[styles.playerStatVal, { color: c.gold, fontFamily: GEO }]}>{player.girPct}%</Text>
              <Text style={[styles.playerStatLabel, { color: c.textMuted }]}>GIR</Text>
            </View>
            <View style={styles.playerStatItem}>
              <Text style={[styles.playerStatVal, { color: c.text, fontFamily: GEO }]}>{player.firPct}%</Text>
              <Text style={[styles.playerStatLabel, { color: c.textMuted }]}>FIR</Text>
            </View>
            <View style={styles.playerStatItem}>
              <Text style={[styles.playerStatVal, { color: c.text, fontFamily: GEO }]}>{player.avgScore}</Text>
              <Text style={[styles.playerStatLabel, { color: c.textMuted }]}>Avg Score</Text>
            </View>
            <View style={styles.playerStatItem}>
              <Text style={[styles.playerStatVal, { color: c.gold, fontFamily: GEO }]}>{player.pointsEarned}</Text>
              <Text style={[styles.playerStatLabel, { color: c.textMuted }]}>Points</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MATCH PLAY STATS — Tale of the Tape
// ═══════════════════════════════════════════════════════════════════════
export function MatchPlayTaleOfTheTape({
  playerId,
  opponentId,
}: {
  playerId: string;
  opponentId: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const tape = useMemo(() => getTaleOfTheTape(playerId, opponentId), [playerId, opponentId]);

  return (
    <View style={[styles.tapeCard, { backgroundColor: c.cardBg }]}>
      <Text style={[styles.tapeTitle, { color: c.gold }]}>TALE OF THE TAPE</Text>
      <GoldDivider style={{ marginBottom: 12 }} />

      <View style={styles.tapeRow}>
        {/* Player side */}
        <View style={styles.tapeSide}>
          <Avatar id={tape.player.playerId} name={tape.player.name} size={40} />
          <Text style={[styles.tapeName, { color: c.text }]}>{tape.player.name}</Text>
        </View>

        {/* VS */}
        <Text style={[styles.tapeVs, { color: c.textMuted }]}>vs</Text>

        {/* Opponent side */}
        <View style={styles.tapeSide}>
          <Avatar id={tape.opponent.playerId} name={tape.opponent.name} size={40} />
          <Text style={[styles.tapeName, { color: c.text }]}>{tape.opponent.name}</Text>
        </View>
      </View>

      {/* Stat comparison rows */}
      <TapeStatRow label="GIR" left={`${tape.player.girPct}%`} right={`${tape.opponent.girPct}%`} leftBetter={tape.player.girPct > tape.opponent.girPct} colors={c} />
      <TapeStatRow label="FIR" left={`${tape.player.firPct}%`} right={`${tape.opponent.firPct}%`} leftBetter={tape.player.firPct > tape.opponent.firPct} colors={c} />
      <TapeStatRow label="Avg Score" left={tape.player.avgScore.toFixed(1)} right={tape.opponent.avgScore.toFixed(1)} leftBetter={tape.player.avgScore < tape.opponent.avgScore} colors={c} />

      {/* H2H record */}
      {(tape.player.h2hRecord.wins > 0 || tape.player.h2hRecord.losses > 0) && (
        <View style={[styles.tapeH2h, { borderTopColor: c.border }]}>
          <Text style={[styles.tapeH2hLabel, { color: c.textMuted }]}>HEAD-TO-HEAD</Text>
          <Text style={[styles.tapeH2hVal, { color: c.gold, fontFamily: GEO }]}>
            {tape.player.h2hRecord.wins}-{tape.player.h2hRecord.losses}
          </Text>
        </View>
      )}
    </View>
  );
}

function TapeStatRow({
  label,
  left,
  right,
  leftBetter,
  colors: c,
}: {
  label: string;
  left: string;
  right: string;
  leftBetter: boolean;
  colors: any;
}) {
  return (
    <View style={[styles.tapeStatRow, { borderBottomColor: c.border }]}>
      <Text style={[styles.tapeStatVal, { color: leftBetter ? '#006747' : c.text, fontFamily: GEO }]}>
        {left}
      </Text>
      <Text style={[styles.tapeStatLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.tapeStatVal, { color: !leftBetter ? '#006747' : c.text, fontFamily: GEO }]}>
        {right}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STROKE PLAY INLINE STATS
// ═══════════════════════════════════════════════════════════════════════
function StrokePlayStats({ seasonId, userId }: { seasonId: string; userId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const progression = useMemo(() => getStrokePlayProgression(seasonId, userId), [seasonId, userId]);
  const scoring = useMemo(() => getSeasonScoringBreakdown(seasonId, userId), [seasonId, userId]);

  const segments: DonutSegment[] = useMemo(() => [
    { label: 'Eagles', value: scoring.eagles, color: STAT_COLORS.eagle },
    { label: 'Birdies', value: scoring.birdies, color: STAT_COLORS.birdie },
    { label: 'Pars', value: scoring.pars, color: STAT_COLORS.par },
    { label: 'Bogeys', value: scoring.bogeys, color: STAT_COLORS.bogey },
    { label: 'Double+', value: scoring.doubles, color: STAT_COLORS.double },
  ], [scoring]);

  const avgScore = progression.length > 0
    ? (progression.reduce((sum, r) => sum + r.score, 0) / progression.length).toFixed(1)
    : '—';
  const firstHalf = progression.slice(0, Math.ceil(progression.length / 2));
  const secondHalf = progression.slice(Math.ceil(progression.length / 2));
  const earlyAvg = firstHalf.length > 0 ? firstHalf.reduce((s, r) => s + r.score, 0) / firstHalf.length : 0;
  const lateAvg = secondHalf.length > 0 ? secondHalf.reduce((s, r) => s + r.score, 0) / secondHalf.length : 0;
  const improving = lateAvg < earlyAvg;

  return (
    <View style={styles.inlineSection}>
      {/* Cumulative Performance */}
      <SectionHeader title="CUMULATIVE PERFORMANCE" />
      <View style={[styles.card, { backgroundColor: c.cardBg }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressionRow}>
          {progression.map((r) => (
            <MiniProgressCircle
              key={r.round}
              percentage={r.vsPar <= 0 ? 100 : Math.max(10, 100 - r.vsPar * 10)}
              label={r.label}
              size={44}
              color={r.vsPar <= 0 ? '#006747' : r.vsPar <= 4 ? STAT_COLORS.par : '#C41E3A'}
            />
          ))}
        </ScrollView>
        <Text style={[styles.helperText, { color: c.textMuted }]}>
          Performance vs par by round
        </Text>
      </View>

      {/* Scoring Trend */}
      <View style={{ marginTop: 12 }}>
        <SectionHeader title="SCORING TREND" />
        <View style={[styles.trendCard, { backgroundColor: c.cardBg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons
              name={improving ? 'trending-down' : 'trending-up'}
              size={20}
              color={improving ? '#006747' : '#C41E3A'}
            />
            <Text style={[styles.trendValue, { color: c.text, fontFamily: GEO }]}>{avgScore}</Text>
            <Text style={[styles.trendLabel, { color: c.textMuted }]}>avg strokes</Text>
          </View>
          <Text style={[styles.trendDetail, { color: improving ? '#006747' : '#C41E3A' }]}>
            {improving
              ? `Improving from ${earlyAvg.toFixed(1)} to ${lateAvg.toFixed(1)}`
              : `Trending from ${earlyAvg.toFixed(1)} to ${lateAvg.toFixed(1)}`
            }
          </Text>
        </View>
      </View>

      {/* Season Scoring Donut */}
      <View style={{ marginTop: 12 }}>
        <SectionHeader title="SCORING BREAKDOWN" />
        <View style={[styles.card, { backgroundColor: c.cardBg }]}>
          <DonutChart
            segments={segments}
            size={130}
            strokeWidth={16}
            centerValue={String(scoring.totalHoles)}
            centerLabel="holes"
          />
          <DonutLegend segments={segments} />
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LEAGUE INLINE STATS
// ═══════════════════════════════════════════════════════════════════════
function LeagueStats({ seasonId, userId }: { seasonId: string; userId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const performance = useMemo(() => getLeagueWeeklyPerformance(seasonId, userId), [seasonId, userId]);

  return (
    <View style={styles.inlineSection}>
      <SectionHeader title="WEEKLY PERFORMANCE" />
      <View style={[styles.card, { backgroundColor: c.cardBg }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressionRow}>
          {performance.map((w) => (
            <View key={w.week} style={{ alignItems: 'center', gap: 2 }}>
              <MiniProgressCircle
                percentage={(w.points / 50) * 100}
                label={w.label}
                size={44}
                color={w.won ? '#006747' : '#C41E3A'}
              />
              <View style={[styles.wlDot, { backgroundColor: w.won ? '#006747' : '#C41E3A' }]} />
            </View>
          ))}
        </ScrollView>
        <View style={styles.wlLegend}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.wlDot, { backgroundColor: '#006747' }]} />
            <Text style={[styles.wlLegendText, { color: c.textMuted }]}>Win</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.wlDot, { backgroundColor: '#C41E3A' }]} />
            <Text style={[styles.wlLegendText, { color: c.textMuted }]}>Loss</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LEAGUE MATCHUP SCOUTING
// ═══════════════════════════════════════════════════════════════════════
export function MatchupScoutingSection({ opponentId }: { opponentId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const report = useMemo(() => getMatchupScoutReport(opponentId), [opponentId]);

  return (
    <View style={styles.scoutSection}>
      <Text style={[styles.sectionTitle, { color: c.gold }]}>MATCHUP SCOUTING</Text>

      <View style={[styles.scoutCard, { backgroundColor: c.elevated }]}>
        <Text style={[styles.scoutLabel, { color: c.textMuted }]}>
          {report.opponentName}'s Last 3 Rounds
        </Text>
        <View style={styles.scoutScoresRow}>
          {report.lastThreeScores.map((s, i) => (
            <View key={i} style={[styles.scoutScoreBadge, { backgroundColor: c.cardBg }]}>
              <Text style={[styles.scoutScoreVal, { color: c.text, fontFamily: GEO }]}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.scoutStatsRow, { backgroundColor: c.elevated, marginTop: 4 }]}>
        <View style={styles.scoutStatItem}>
          <Text style={[styles.scoutStatVal, { color: c.text, fontFamily: GEO }]}>{report.girPct}%</Text>
          <Text style={[styles.scoutStatLabel, { color: c.textMuted }]}>GIR</Text>
        </View>
        <View style={[styles.scoutStatDivider, { backgroundColor: c.border }]} />
        <View style={styles.scoutStatItem}>
          <Text style={[styles.scoutStatVal, { color: c.text, fontFamily: GEO }]}>{report.firPct}%</Text>
          <Text style={[styles.scoutStatLabel, { color: c.textMuted }]}>FIR</Text>
        </View>
        <View style={[styles.scoutStatDivider, { backgroundColor: c.border }]} />
        <View style={styles.scoutStatItem}>
          <Text style={[styles.scoutStatVal, { color: c.text, fontFamily: GEO }]}>{report.avgPoints}</Text>
          <Text style={[styles.scoutStatLabel, { color: c.textMuted }]}>Avg Pts</Text>
        </View>
      </View>

      {(report.h2hRecord.wins > 0 || report.h2hRecord.losses > 0) && (
        <View style={[styles.scoutH2h, { backgroundColor: c.elevated, marginTop: 4 }]}>
          <Text style={[styles.scoutH2hLabel, { color: c.textMuted }]}>Your Record vs {report.opponentName}</Text>
          <Text style={[styles.scoutH2hVal, { color: c.gold, fontFamily: GEO }]}>
            {report.h2hRecord.wins}-{report.h2hRecord.losses}
          </Text>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MATCH PLAY STATS WRAPPER
// ═══════════════════════════════════════════════════════════════════════
function MatchPlayStats() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <MatchPlayTaleOfTheTape playerId="self" opponentId="1" />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { paddingHorizontal: 12, marginTop: 16 },
  inlineSection: { paddingHorizontal: 12, paddingTop: 12 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    padding: 16,
    alignItems: 'center',
  },
  helperText: {
    fontSize: 11,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Nested donut row
  nestedRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  nestedItem: {
    alignItems: 'center',
    gap: 6,
  },
  nestedLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: GEO,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Weekly progression
  progressionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },

  // Team comparison
  teamDonutRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 12,
  },
  teamDonutItem: {
    alignItems: 'center',
    gap: 6,
  },
  teamLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  teamGirLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  teamGirItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
  },
  legendText: {
    fontSize: 11,
  },

  // Contributions
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contributionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  contributionRecord: {
    fontSize: 11,
    marginTop: 1,
  },
  contributionPts: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -1,
  },

  // Player modal
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalContent: { padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalPlayerName: { fontSize: 18, fontWeight: '700' },
  playerStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    marginTop: 16,
  },
  playerStatItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  playerStatVal: {
    fontSize: 20,
    fontWeight: '700',
  },
  playerStatLabel: {
    fontSize: 10,
    marginTop: 2,
  },

  // Tale of the Tape
  tapeCard: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 16,
  },
  tapeTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  tapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  tapeSide: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  tapeName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  tapeVs: {
    fontSize: 14,
    fontWeight: '700',
  },
  tapeStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tapeStatVal: {
    fontSize: 16,
    fontWeight: '700',
    width: 60,
    textAlign: 'center',
  },
  tapeStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  tapeH2h: {
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tapeH2hLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tapeH2hVal: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
  },

  // Trend card
  trendCard: {
    padding: 14,
  },
  trendValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -1,
  },
  trendLabel: {
    fontSize: 12,
  },
  trendDetail: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },

  // W/L dots (league)
  wlDot: {
    width: 6,
    height: 6,
  },
  wlLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  wlLegendText: {
    fontSize: 10,
    fontWeight: '500',
  },

  // Scouting
  scoutSection: {
    paddingHorizontal: 12,
    marginTop: 16,
  },
  scoutCard: {
    padding: 14,
  },
  scoutLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  scoutScoresRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scoutScoreBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scoutScoreVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  scoutStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  scoutStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  scoutStatVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  scoutStatLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  scoutStatDivider: {
    width: 1,
    height: 28,
  },
  scoutH2h: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  scoutH2hLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  scoutH2hVal: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -1,
  },
});
