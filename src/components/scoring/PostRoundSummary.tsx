import { useState, useMemo, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../../theme/colors';
import { Avatar } from '../Avatar';
import GoldDivider from '../GoldDivider';
import { formatToPar as fmtToPar } from '../../lib/scoring-utils';
import type {
  PlayerConfig, HoleData, HoleScore,
  PlayerTotals, WolfHoleState, BBBHolePoints,
  SummaryTab, LinkedSeason, SeasonImpact, RyderCupImpact, HandicapImpact,
} from '../../scoring/types';
import { CompetitionImpactSection } from './CompetitionImpact';
import { computeSeasonImpact, computeHandicapImpact } from '../../data/competitionImpact';
import { competitionStyles as ci } from './styles';
import {
  computePlayerTotals, isGIR, pName,
  buildSkinsResult, buildSnakeResult, buildGreeniesResult,
  buildNassauResult, buildDotsResult, buildGenericResult,
  buildWolfResult, buildBBBResult,
  SIDE_GAME_DISPLAY,
} from '../../scoring/calculations';
import { scoringStyles as st, postRoundStyles as ps } from './styles';

const formatToPar = fmtToPar;

function toParColor(
  diff: number,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): string {
  if (diff < 0) return c.teal;
  if (diff === 0) return c.gold;
  return c.urgent;
}

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
    return '#C41E3A';
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

function GamesTab({
  sideGameKeys,
  players,
  holes,
  allScores,
  wolfHoleDecisions,
  bbbHolePoints,
}: {
  sideGameKeys: string[];
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
  wolfHoleDecisions?: Map<number, WolfHoleState>;
  bbbHolePoints?: Map<number, BBBHolePoints>;
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

  // Generate results for each side game
  const results = sideGameKeys.map((key) => {
    const label = SIDE_GAME_DISPLAY[key] ?? key;

    if (key === 'skins') return buildSkinsResult(label, players, holes, allScores, c);
    if (key === 'snake') return buildSnakeResult(label, players, holes, allScores);
    if (key === 'greenies') return buildGreeniesResult(label, players, holes, allScores);
    if (key === 'nassau') return buildNassauResult(label, players, holes, allScores);
    if (key === 'dots') return buildDotsResult(label, players, holes, allScores);
    if (key === 'wolf' && wolfHoleDecisions) return buildWolfResult(label, players, holes, allScores, wolfHoleDecisions);
    if (key === 'bingo_bango_bongo' && bbbHolePoints) return buildBBBResult(label, players, bbbHolePoints);
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

function SettlementSection({
  sideGameKeys,
  players,
  holes,
  allScores,
  wolfHoleDecisions,
  bbbHolePoints,
}: {
  sideGameKeys: string[];
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
  wolfHoleDecisions?: Map<number, WolfHoleState>;
  bbbHolePoints?: Map<number, BBBHolePoints>;
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

    if (key === 'wolf' && wolfHoleDecisions) {
      // $1 per point, net differences
      const wolfPts = new Map<string, number>();
      players.forEach((p) => wolfPts.set(p.id, 0));
      holes.forEach((h) => {
        const holeScores = allScores.get(h.number);
        const decision = wolfHoleDecisions.get(h.number);
        if (!holeScores || !decision || holeScores.size < players.length) return;
        const wolfId = decision.wolfPlayerId;
        if (decision.decision === 'lone' || decision.decision === 'blind') {
          const wolfScore = holeScores.get(wolfId);
          if (!wolfScore) return;
          const others: number[] = [];
          players.forEach((p) => { if (p.id !== wolfId) { const s = holeScores.get(p.id); if (s) others.push(s.gross); } });
          const wolfWins = wolfScore.gross < Math.min(...others);
          const isBlind = decision.decision === 'blind';
          if (wolfWins) {
            wolfPts.set(wolfId, (wolfPts.get(wolfId) ?? 0) + (isBlind ? 4 : 3));
          } else {
            players.forEach((p) => { if (p.id !== wolfId) wolfPts.set(p.id, (wolfPts.get(p.id) ?? 0) + (isBlind ? 2 : 1)); });
          }
        } else if (decision.decision === 'partner' && decision.partnerId) {
          const teamIds = [wolfId, decision.partnerId];
          const oppIds = players.filter((p) => !teamIds.includes(p.id)).map((p) => p.id);
          let teamBest = Infinity, oppBest = Infinity;
          teamIds.forEach((id) => { const s = holeScores.get(id); if (s && s.gross < teamBest) teamBest = s.gross; });
          oppIds.forEach((id) => { const s = holeScores.get(id); if (s && s.gross < oppBest) oppBest = s.gross; });
          if (teamBest < oppBest) teamIds.forEach((id) => wolfPts.set(id, (wolfPts.get(id) ?? 0) + 1));
          else if (oppBest < teamBest) oppIds.forEach((id) => wolfPts.set(id, (wolfPts.get(id) ?? 0) + 1));
        }
      });
      // Pairwise settlement at $1 per point diff
      for (let ii = 0; ii < players.length; ii++) {
        for (let jj = ii + 1; jj < players.length; jj++) {
          const diff = (wolfPts.get(players[ii].id) ?? 0) - (wolfPts.get(players[jj].id) ?? 0);
          payouts.set(players[ii].id, (payouts.get(players[ii].id) ?? 0) + diff);
          payouts.set(players[jj].id, (payouts.get(players[jj].id) ?? 0) - diff);
        }
      }
    }

    if (key === 'bingo_bango_bongo' && bbbHolePoints) {
      // $1 per point, net differences
      const bbbPts = new Map<string, number>();
      players.forEach((p) => bbbPts.set(p.id, 0));
      bbbHolePoints.forEach((hp) => {
        if (hp.bingo) bbbPts.set(hp.bingo, (bbbPts.get(hp.bingo) ?? 0) + 1);
        if (hp.bango) bbbPts.set(hp.bango, (bbbPts.get(hp.bango) ?? 0) + 1);
        if (hp.bongo) bbbPts.set(hp.bongo, (bbbPts.get(hp.bongo) ?? 0) + 1);
      });
      for (let ii = 0; ii < players.length; ii++) {
        for (let jj = ii + 1; jj < players.length; jj++) {
          const diff = (bbbPts.get(players[ii].id) ?? 0) - (bbbPts.get(players[jj].id) ?? 0);
          payouts.set(players[ii].id, (payouts.get(players[ii].id) ?? 0) + diff);
          payouts.set(players[jj].id, (payouts.get(players[jj].id) ?? 0) - diff);
        }
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

function ShareCard({
  courseName,
  players,
  playerTotals,
  totalPar,
  seasonImpact,
  ryderCupImpact,
  onShare,
}: {
  courseName: string;
  players: PlayerConfig[];
  playerTotals: PlayerTotals[];
  totalPar: number;
  seasonImpact: SeasonImpact | null;
  ryderCupImpact: RyderCupImpact | null;
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
                    { color: diff < 0 ? '#006747' : diff === 0 ? '#C9A227' : '#C41E3A', fontFamily: GEO },
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

        {/* Competition impact lines on share card */}
        {seasonImpact && (
          <View style={ci.shareImpactRow}>
            <Ionicons name="trophy" size={10} color="#C9A227" />
            <Text style={ci.shareImpactText}>
              {seasonImpact.seasonName}: +{seasonImpact.pointsEarned} pts → {ordinal(seasonImpact.currentRank)} place
            </Text>
          </View>
        )}
        {ryderCupImpact && (
          <View style={ci.shareImpactRow}>
            <Ionicons name="people" size={10} color="rgba(255,255,255,0.7)" />
            <Text style={ci.shareImpactText}>
              Ryder Cup: {ryderCupImpact.matchResult === 'win' ? `Beat ${ryderCupImpact.opponentName}` : ryderCupImpact.matchResult === 'halved' ? `Halved with ${ryderCupImpact.opponentName}` : `Lost to ${ryderCupImpact.opponentName}`}, {ryderCupImpact.teamName} {ryderCupImpact.teamScore > ryderCupImpact.opponentTeamScore ? 'leads' : 'trails'}
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

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const PostRoundSummary = memo(function PostRoundSummary({
  players,
  holes,
  allScores,
  scoreMode,
  handicapStrokes,
  courseName,
  formatLabel,
  sideGameKeys,
  wolfHoleDecisions,
  bbbHolePoints,
  linkedSeasons,
  courseSlope,
  courseRating,
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
  wolfHoleDecisions?: Map<number, WolfHoleState>;
  bbbHolePoints?: Map<number, BBBHolePoints>;
  linkedSeasons?: LinkedSeason[];
  courseSlope?: number;
  courseRating?: number;
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

  // ─── Competition Impact computation ───────────────────────────────
  const userId = '1'; // Current user ID convention
  const userTotals = playerTotals.find((r) => r.player.id === userId);

  const seasonImpact = useMemo<SeasonImpact | null>(() => {
    if (!linkedSeasons || linkedSeasons.length === 0) return null;
    return computeSeasonImpact(linkedSeasons[0], playerTotals, userId);
  }, [linkedSeasons, playerTotals]);

  const handicapImpact = useMemo<HandicapImpact>(() => {
    const player = players.find((p) => p.id === userId) ?? players[0];
    const gross = userTotals?.gross ?? 0;
    return computeHandicapImpact(
      player,
      gross,
      totalPar,
      courseSlope ?? 113,
      courseRating ?? totalPar,
    );
  }, [players, userTotals, totalPar, courseSlope, courseRating]);

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

          {/* Competition Impact */}
          <GoldDivider style={{ marginTop: 20 }} />
          <CompetitionImpactSection
            seasonImpact={seasonImpact}
            ryderCupImpact={null}
            handicapImpact={handicapImpact}
          />

          {/* Tab bar */}
          <GoldDivider style={{ marginTop: 10 }} />
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
              wolfHoleDecisions={wolfHoleDecisions}
              bbbHolePoints={bbbHolePoints}
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
              wolfHoleDecisions={wolfHoleDecisions}
              bbbHolePoints={bbbHolePoints}
            />
          )}

          {/* Share card */}
          <ShareCard
            courseName={courseName}
            players={players}
            playerTotals={playerTotals}
            totalPar={totalPar}
            seasonImpact={seasonImpact}
            ryderCupImpact={null}
            onShare={() => Alert.alert('Share', 'Sharing will generate an image in production.')}
          />

          {/* Save button */}
          <Pressable onPress={onDone} style={({ pressed }) => [ps.saveBtn, { backgroundColor: '#1E4D2B' }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
            <Text style={[ps.saveBtnText, { color: '#C9A227', fontFamily: GEO }]}>Post Score</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
});

export default PostRoundSummary;
export { PostRoundSummary };
