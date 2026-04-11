import { useState, useMemo, useCallback } from 'react';
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
export type LeagueMatchupResult = {
  week: number;
  opponentId: string;
  opponentName: string;
  playerScore: number;
  opponentScore: number;
  won: boolean;
  tied: boolean;
  isDivisionGame: boolean;
  isPlayoff: boolean;
};

export type LeaguePlayer = {
  playerId: string;
  name: string;
  handicap: number;
  avatarColor: string;
  division: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streakType: 'W' | 'L';
  streakCount: number;
  clinched: boolean;
  eliminated: boolean;
  isDivisionLeader: boolean;
  isWildCard: boolean;
  results: LeagueMatchupResult[];
};

export type LeagueConfig = {
  divisionsEnabled: boolean;
  divisionNames: string[];
  playoffTeams: number;
  totalWeeks: number;
  currentWeek: number;
  scoringFormat: string;
  isSeasonComplete: boolean;
  isPlayoffs: boolean;
};

type Props = {
  players: LeaguePlayer[];
  config: LeagueConfig;
  onChampionMoment?: (winner: LeaguePlayer) => void;
  onMatchupTap?: (player: LeaguePlayer, result: LeagueMatchupResult) => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────
function formatPct(wins: number, losses: number, ties: number): string {
  const total = wins + losses + ties;
  if (total === 0) return '.000';
  const pct = (wins + ties * 0.5) / total;
  return pct.toFixed(3).replace(/^0/, '');
}

function formatStreak(type: 'W' | 'L', count: number): string {
  if (count === 0) return '—';
  return `${type}${count}`;
}

// ─── Division Tab Bar ────────────────────────────────────────────────
function DivisionTabs({
  tabs,
  selected,
  onSelect,
}: {
  tabs: string[];
  selected: string;
  onSelect: (t: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.divTabBar}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}
    >
      {tabs.map((t) => {
        const active = t === selected;
        return (
          <Pressable
            key={t}
            onPress={() => { haptics.light(); onSelect(t); }}
            style={[
              styles.divTab,
              {
                backgroundColor: active ? c.gold + '22' : c.elevated,
                borderColor: active ? c.gold : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.divTabText,
                { color: active ? c.gold : c.textMuted, fontFamily: active ? GEO : undefined },
              ]}
            >
              {t}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Player Row ──────────────────────────────────────────────────────
function PlayerRow({
  player,
  rank,
  expanded,
  onToggle,
  onMatchupTap,
}: {
  player: LeaguePlayer;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  onMatchupTap?: (player: LeaguePlayer, result: LeagueMatchupResult) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const diff = player.pointsFor - player.pointsAgainst;

  return (
    <View>
      <Pressable
        onPress={() => { haptics.light(); onToggle(); }}
        style={[
          styles.playerRow,
          {
            borderBottomColor: c.border,
            opacity: player.eliminated ? 0.5 : 1,
          },
        ]}
      >
        {/* Rank */}
        <Text
          style={[
            styles.colRank,
            {
              color: rank <= 3 ? c.gold : c.textMuted,
              fontFamily: GEO,
            },
          ]}
        >
          {rank}
        </Text>

        {/* Player */}
        <View style={styles.colPlayer}>
          <Avatar id={player.playerId} name={player.name} size={26} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {player.isDivisionLeader && (
                <Ionicons name="ribbon" size={12} color={c.gold} />
              )}
              <Text
                style={[styles.playerName, { color: player.eliminated ? c.textMuted : c.text }]}
                numberOfLines={1}
              >
                {player.name}
              </Text>
              {player.clinched && (
                <View style={[styles.badge, { backgroundColor: c.teal + '22' }]}>
                  <Ionicons name="checkmark" size={10} color={c.teal} />
                </View>
              )}
              {player.isWildCard && !player.clinched && (
                <View style={[styles.badge, { backgroundColor: c.gold + '22' }]}>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: c.gold }}>WC</Text>
                </View>
              )}
              {player.eliminated && (
                <View style={[styles.badge, { backgroundColor: c.urgent + '22' }]}>
                  <Ionicons name="close" size={10} color={c.urgent} />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* W */}
        <Text style={[styles.colStat, { color: c.text, fontFamily: GEO }]}>
          {player.ties > 0 ? (player.wins + player.ties * 0.5).toFixed(1) : String(player.wins)}
        </Text>

        {/* L */}
        <Text style={[styles.colStat, { color: c.textMuted, fontFamily: GEO }]}>
          {player.ties > 0 ? (player.losses + player.ties * 0.5).toFixed(1) : String(player.losses)}
        </Text>

        {/* Pct */}
        <Text style={[styles.colPct, { color: c.text, fontFamily: GEO }]}>
          {formatPct(player.wins, player.losses, player.ties)}
        </Text>

        {/* Strk */}
        <Text
          style={[
            styles.colStrk,
            {
              color: player.streakType === 'W' ? c.teal : c.urgent,
              fontFamily: GEO,
            },
          ]}
        >
          {formatStreak(player.streakType, player.streakCount)}
        </Text>

        {/* Chevron */}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={c.textMuted}
          style={{ width: 16 }}
        />
      </Pressable>

      {/* Expanded detail */}
      {expanded && (
        <View style={[styles.expandedSection, { backgroundColor: c.elevated }]}>
          {/* PF / PA row */}
          <View style={styles.expandedStats}>
            <View style={styles.expandedStatItem}>
              <Text style={[styles.expandedStatVal, { color: c.text, fontFamily: GEO }]}>
                {player.pointsFor}
              </Text>
              <Text style={[styles.expandedStatLabel, { color: c.textMuted }]}>PF</Text>
            </View>
            <View style={styles.expandedStatItem}>
              <Text style={[styles.expandedStatVal, { color: c.textMuted, fontFamily: GEO }]}>
                {player.pointsAgainst}
              </Text>
              <Text style={[styles.expandedStatLabel, { color: c.textMuted }]}>PA</Text>
            </View>
            <View style={styles.expandedStatItem}>
              <Text
                style={[
                  styles.expandedStatVal,
                  { color: diff > 0 ? c.teal : diff < 0 ? c.urgent : c.textMuted, fontFamily: GEO },
                ]}
              >
                {diff > 0 ? `+${diff}` : String(diff)}
              </Text>
              <Text style={[styles.expandedStatLabel, { color: c.textMuted }]}>Diff</Text>
            </View>
          </View>

          <GoldDivider style={{ marginVertical: 8 }} />

          {/* Week-by-week results */}
          <Text style={[styles.expandedTitle, { color: c.gold }]}>RESULTS</Text>
          {player.results.map((r) => {
            const won = r.won;
            const tied = r.tied;
            return (
              <Pressable
                key={r.week}
                onPress={() => onMatchupTap?.(player, r)}
                style={[styles.resultRow, { borderBottomColor: c.border }]}
              >
                <Text style={[styles.resultWeek, { color: c.textMuted }]}>Wk {r.week}</Text>
                <Text
                  style={[
                    styles.resultOutcome,
                    { color: tied ? c.textMuted : won ? c.teal : c.urgent },
                  ]}
                >
                  {tied ? 'T' : won ? 'W' : 'L'}
                </Text>
                <Text style={[styles.resultDetail, { color: c.text }]} numberOfLines={1}>
                  vs {r.opponentName}
                </Text>
                <Text style={[styles.resultScore, { color: c.text, fontFamily: GEO }]}>
                  {r.playerScore}-{r.opponentScore}
                </Text>
                {r.isDivisionGame && (
                  <View style={[styles.divGameDot, { backgroundColor: c.gold }]} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export function LeagueStandings({ players, config, onChampionMoment, onMatchupTap }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const divTabs = config.divisionsEnabled
    ? ['All', ...config.divisionNames]
    : [];
  const [selectedDiv, setSelectedDiv] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter and sort players
  const sortedPlayers = useMemo(() => {
    let filtered = players;
    if (selectedDiv !== 'All' && config.divisionsEnabled) {
      filtered = players.filter((p) => p.division === selectedDiv);
    }
    return [...filtered].sort((a, b) => {
      // Sort by win pct desc
      const totalA = a.wins + a.losses + a.ties;
      const totalB = b.wins + b.losses + b.ties;
      const pctA = totalA > 0 ? (a.wins + a.ties * 0.5) / totalA : 0;
      const pctB = totalB > 0 ? (b.wins + b.ties * 0.5) / totalB : 0;
      if (pctB !== pctA) return pctB - pctA;
      // Then by point differential
      const diffA = a.pointsFor - a.pointsAgainst;
      const diffB = b.pointsFor - b.pointsAgainst;
      return diffB - diffA;
    });
  }, [players, selectedDiv, config.divisionsEnabled]);

  const handleToggle = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Champion trigger when season is complete
  const champion = config.isSeasonComplete && sortedPlayers.length > 0 ? sortedPlayers[0] : null;

  return (
    <View style={styles.container}>
      {/* Division tabs */}
      {divTabs.length > 0 && (
        <DivisionTabs tabs={divTabs} selected={selectedDiv} onSelect={setSelectedDiv} />
      )}

      {/* Progress */}
      {!config.isSeasonComplete && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: c.gold, fontFamily: GEO }]}>
              {config.isPlayoffs ? 'PLAYOFFS' : `Week ${config.currentWeek} of ${config.totalWeeks}`}
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: c.elevated }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min((config.currentWeek / config.totalWeeks) * 100, 100)}%`,
                  backgroundColor: config.isPlayoffs ? c.urgent : c.gold,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Column headers */}
      <View style={[styles.headerRow, { borderBottomColor: c.border }]}>
        <Text style={[styles.colRank, styles.headerText, { color: c.textMuted }]}>#</Text>
        <Text style={[styles.colPlayer, styles.headerText, { color: c.textMuted }]}>Player</Text>
        <Text style={[styles.colStat, styles.headerText, { color: c.textMuted }]}>W</Text>
        <Text style={[styles.colStat, styles.headerText, { color: c.textMuted }]}>L</Text>
        <Text style={[styles.colPct, styles.headerText, { color: c.textMuted }]}>Pct</Text>
        <Text style={[styles.colStrk, styles.headerText, { color: c.textMuted }]}>Strk</Text>
        <View style={{ width: 16 }} />
      </View>

      {/* Player rows */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {sortedPlayers.map((p, i) => (
          <PlayerRow
            key={p.playerId}
            player={p}
            rank={i + 1}
            expanded={expandedId === p.playerId}
            onToggle={() => handleToggle(p.playerId)}
            onMatchupTap={onMatchupTap}
          />
        ))}
      </ScrollView>

      {/* Season complete banner */}
      {config.isSeasonComplete && champion && (
        <View style={[styles.completeBanner, { backgroundColor: c.gold + '12', borderColor: c.gold + '33' }]}>
          <Ionicons name="trophy" size={20} color={c.gold} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.gold, fontFamily: GEO }}>
              LEAGUE CHAMPION
            </Text>
            <Text style={{ fontSize: 13, color: c.text, marginTop: 2 }}>
              {champion.name} — {champion.wins}-{champion.losses}
              {champion.ties > 0 ? `-${champion.ties}` : ''} ({formatPct(champion.wins, champion.losses, champion.ties)})
            </Text>
          </View>
          <Pressable
            onPress={() => { haptics.heavy(); onChampionMoment?.(champion); }}
            style={[styles.viewResultsBtn, { borderColor: c.gold }]}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: c.gold }}>VIEW</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Demo Data ───────────────────────────────────────────────────────
// ─── Build from Config ──────────────────────────────────────────────
const AVATAR_COLORS = ['#006747', '#C9A227', '#1E4D2B', '#C41E3A', '#006747', '#C9A227', '#1E4D2B', '#C41E3A'];

export function buildLeagueDataFromConfig(leagueConfig: any): { players: LeaguePlayer[]; config: LeagueConfig } {
  const players: { id: string; name: string; handicap: number }[] = leagueConfig.players ?? [];
  const divAssignments: Record<string, { id: string; name: string }[]> | null = leagueConfig.division_assignments ?? null;
  const divNames: string[] = leagueConfig.division_names ?? [];
  const totalWeeks = leagueConfig.regular_season_weeks ?? 10;

  // Determine which division each player belongs to
  const playerDivision: Record<string, string> = {};
  if (divAssignments) {
    for (const [divName, divPlayers] of Object.entries(divAssignments)) {
      for (const p of divPlayers) {
        playerDivision[p.id] = divName;
      }
    }
  }

  // Players start with 0-0 record since no rounds have been logged yet
  const leaguePlayers: LeaguePlayer[] = players.map((p, i) => ({
    playerId: p.id,
    name: p.name,
    handicap: p.handicap,
    avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
    division: playerDivision[p.id] ?? null,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    streakType: 'W' as const,
    streakCount: 0,
    clinched: false,
    eliminated: false,
    isDivisionLeader: false,
    isWildCard: false,
    results: [],
  }));

  return {
    players: leaguePlayers,
    config: {
      divisionsEnabled: leagueConfig.divisions_enabled ?? false,
      divisionNames: divNames,
      playoffTeams: leagueConfig.playoff_teams ?? 4,
      totalWeeks,
      currentWeek: 1,
      scoringFormat: leagueConfig.scoring_format ?? 'stableford',
      isSeasonComplete: false,
      isPlayoffs: false,
    },
  };
}

const DEMO_NAMES = ['McGowan', 'Fletcher', 'Patterson', 'Sullivan', 'Rodriguez', 'Chen', 'Taylor', 'Brooks'];
const DEMO_COLORS = ['#006747', '#C9A227', '#1E4D2B', '#C41E3A', '#006747', '#C9A227', '#1E4D2B', '#C41E3A'];
const DEMO_HCPS = [8, 12, 6, 15, 10, 18, 14, 20];

export function buildDemoLeagueData(): { players: LeaguePlayer[]; config: LeagueConfig } {
  const divisions = ['East', 'West'];
  const completedWeeks = 6;

  // Assign players to divisions
  const playerDivisions = DEMO_NAMES.map((_, i) => divisions[i % 2]);

  // Pre-set realistic win records
  const records: { w: number; l: number; t: number }[] = [
    { w: 5, l: 1, t: 0 }, // McGowan (East)
    { w: 4, l: 1, t: 1 }, // Fletcher (West)
    { w: 3, l: 2, t: 1 }, // Patterson (East)
    { w: 3, l: 3, t: 0 }, // Sullivan (West)
    { w: 2, l: 3, t: 1 }, // Rodriguez (East)
    { w: 2, l: 4, t: 0 }, // Chen (West)
    { w: 1, l: 4, t: 1 }, // Taylor (East)
    { w: 1, l: 5, t: 0 }, // Brooks (West)
  ];

  // Generate matchup results
  const generateResults = (playerIdx: number): LeagueMatchupResult[] => {
    const results: LeagueMatchupResult[] = [];
    const rec = records[playerIdx];
    let winsLeft = rec.w;
    let tiesLeft = rec.t;
    // Create opponents list (cycle through non-self players)
    const opponents = DEMO_NAMES.map((n, i) => i).filter((i) => i !== playerIdx);

    for (let wk = 1; wk <= completedWeeks; wk++) {
      const oppIdx = opponents[(wk - 1) % opponents.length];
      const isDivGame = playerDivisions[playerIdx] === playerDivisions[oppIdx];
      let won = false;
      let tied = false;

      if (winsLeft > 0 && (wk <= rec.w || Math.random() > 0.4)) {
        won = true;
        winsLeft--;
      } else if (tiesLeft > 0 && wk === completedWeeks) {
        tied = true;
        tiesLeft--;
      }

      const baseScore = 30 + Math.floor(Math.random() * 12);
      const margin = Math.floor(Math.random() * 8) + 1;

      results.push({
        week: wk,
        opponentId: String(oppIdx + 1),
        opponentName: DEMO_NAMES[oppIdx],
        playerScore: won ? baseScore + margin : tied ? baseScore : baseScore - margin,
        opponentScore: won ? baseScore : tied ? baseScore : baseScore + margin,
        won,
        tied,
        isDivisionGame: isDivGame,
        isPlayoff: false,
      });
    }
    return results;
  };

  const players: LeaguePlayer[] = DEMO_NAMES.map((name, i) => {
    const results = generateResults(i);
    const pf = results.reduce((s, r) => s + r.playerScore, 0);
    const pa = results.reduce((s, r) => s + r.opponentScore, 0);
    const rec = records[i];

    // Determine streaks from results
    let streakType: 'W' | 'L' = 'W';
    let streakCount = 0;
    for (let j = results.length - 1; j >= 0; j--) {
      const r = results[j];
      const type = r.tied ? null : r.won ? 'W' : 'L';
      if (type === null) break;
      if (streakCount === 0) {
        streakType = type;
        streakCount = 1;
      } else if (type === streakType) {
        streakCount++;
      } else {
        break;
      }
    }

    return {
      playerId: String(i + 1),
      name,
      handicap: DEMO_HCPS[i],
      avatarColor: DEMO_COLORS[i],
      division: playerDivisions[i],
      wins: rec.w,
      losses: rec.l,
      ties: rec.t,
      pointsFor: pf,
      pointsAgainst: pa,
      streakType,
      streakCount,
      clinched: rec.w >= 4,
      eliminated: rec.l >= 5,
      isDivisionLeader: i === 0 || i === 1, // Best in each division
      isWildCard: i === 2 || i === 3, // Next best
      results,
    };
  });

  return {
    players,
    config: {
      divisionsEnabled: true,
      divisionNames: divisions,
      playoffTeams: 4,
      totalWeeks: 10,
      currentWeek: 7,
      scoringFormat: 'stableford',
      isSeasonComplete: false,
      isPlayoffs: false,
    },
  };
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Division tabs
  divTabBar: {
    paddingVertical: 10,
  },
  divTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  divTabText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Progress
  progressContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  progressTrack: {
    height: 4,
  },
  progressFill: {
    height: 4,
  },

  // Header
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
    textTransform: 'uppercase' as const,
  },

  // Columns
  colRank: {
    width: 24,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  colPlayer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 100,
  },
  colStat: {
    width: 32,
    fontSize: 13,
    textAlign: 'center',
  },
  colPct: {
    width: 42,
    fontSize: 12,
    textAlign: 'center',
  },
  colStrk: {
    width: 30,
    fontSize: 12,
    textAlign: 'center',
  },

  // Player row
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
  badge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Expanded
  expandedSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  expandedStats: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
  },
  expandedStatItem: {
    alignItems: 'center',
    gap: 2,
  },
  expandedStatVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  expandedStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  expandedTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  resultWeek: {
    fontSize: 11,
    width: 36,
  },
  resultOutcome: {
    fontSize: 12,
    fontWeight: '700',
    width: 16,
  },
  resultDetail: {
    flex: 1,
    fontSize: 12,
  },
  resultScore: {
    fontSize: 13,
    fontWeight: '700',
  },
  divGameDot: {
    width: 5,
    height: 5,
  },

  // Complete banner
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    margin: 12,
    borderWidth: 1,
  },
  viewResultsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
});
