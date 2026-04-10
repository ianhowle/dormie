import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../../theme/colors';
import type { SeasonImpact, RyderCupImpact, HandicapImpact } from '../../scoring/types';
import { competitionStyles as ci } from './styles';

// ─── Season Impact Card ─────────────────────────────────────────────

function SeasonImpactCard({ data }: { data: SeasonImpact }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const rankArrow = data.rankChange > 0 ? '↑' : data.rankChange < 0 ? '↓' : '—';
  const rankColor = data.rankChange > 0 ? c.scoreUnder : data.rankChange < 0 ? c.scoreOver : c.textMuted;

  return (
    <View style={[ci.card, { backgroundColor: theme.isDark ? '#0D1F12' : '#EAF5EC', borderColor: c.border }, theme.isDark ? cardShadowDark : cardShadowLight]}>
      {/* Header */}
      <View style={ci.cardHeader}>
        <Ionicons name="trophy" size={16} color={c.gold} />
        <Text style={[ci.cardTitle, { color: c.gold, fontFamily: GEO }]}>SEASON IMPACT</Text>
        <Text style={[ci.cardSubtitle, { color: c.textMuted }]}>{data.seasonName}</Text>
      </View>

      {/* Playoff / Championship badge */}
      {data.isPlayoffWeek && (
        <View style={[ci.badge, { backgroundColor: `${c.gold}20` }]}>
          <Text style={[ci.badgeText, { color: c.gold, fontFamily: GEO }]}>
            PLAYOFF WEEK · {data.multiplier}× POINTS
          </Text>
        </View>
      )}
      {data.isChampionshipWeek && (
        <View style={[ci.badge, { backgroundColor: `${c.gold}20` }]}>
          <Text style={[ci.badgeText, { color: c.gold, fontFamily: GEO }]}>
            CHAMPIONSHIP · {data.multiplier}× POINTS
          </Text>
        </View>
      )}

      {/* Points earned */}
      <View style={ci.row}>
        <Text style={[ci.label, { color: c.textMuted }]}>Points earned</Text>
        <View style={ci.valueRow}>
          <Text style={[ci.valueMain, { color: c.scoreUnder, fontFamily: GEO }]}>
            +{data.pointsEarned} pts
          </Text>
          <Text style={[ci.valueSub, { color: c.textMuted }]}>
            ({data.weekLabel})
          </Text>
        </View>
      </View>

      {/* Rank movement */}
      <View style={[ci.row, { borderTopWidth: 1, borderTopColor: c.border }]}>
        <Text style={[ci.label, { color: c.textMuted }]}>Season rank</Text>
        <View style={ci.valueRow}>
          <Text style={[ci.rankArrow, { color: rankColor, fontFamily: GEO }]}>
            {rankArrow}{Math.abs(data.rankChange)} spot{Math.abs(data.rankChange) !== 1 ? 's' : ''}
          </Text>
          <Text style={[ci.valueSub, { color: c.text }]}>
            → Now {ordinal(data.currentRank)} overall
          </Text>
        </View>
      </View>

      {/* Points behind leader */}
      {data.pointsBehindLeader > 0 && (
        <View style={[ci.row, { borderTopWidth: 1, borderTopColor: c.border }]}>
          <Text style={[ci.label, { color: c.textMuted }]}>Gap to leader</Text>
          <Text style={[ci.valueSub, { color: c.text }]}>
            {data.pointsBehindLeader} pts behind {data.leaderName}
          </Text>
        </View>
      )}

      {/* Season high badge */}
      {data.isSeasonHigh && (
        <View style={[ci.achievementRow, { borderTopWidth: 1, borderTopColor: c.border }]}>
          <Ionicons name="star" size={14} color={c.gold} />
          <Text style={[ci.achievementText, { color: c.gold, fontFamily: GEO }]}>
            SEASON HIGH
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Ryder Cup Impact Card ──────────────────────────────────────────

const TEAM_TINTS = {
  red: { dark: '#1F0D0D', light: '#FCEAEA' },
  blue: { dark: '#0D0F1F', light: '#EAF0FC' },
} as const;

function RyderCupImpactCard({ data }: { data: RyderCupImpact }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const tint = TEAM_TINTS[data.teamColor][theme.isDark ? 'dark' : 'light'];
  const teamAccent = data.teamColor === 'red' ? c.scoreOver : '#4A90D9';

  let resultText: string;
  let resultColor: string;
  if (data.matchResult === 'win') {
    const margin = data.opponentScore - data.userScore;
    resultText = `You beat ${data.opponentName} by ${margin} stroke${margin !== 1 ? 's' : ''}`;
    resultColor = c.scoreUnder;
  } else if (data.matchResult === 'loss') {
    const margin = data.userScore - data.opponentScore;
    resultText = `${data.opponentName} won by ${margin} stroke${margin !== 1 ? 's' : ''}`;
    resultColor = c.scoreOver;
  } else {
    resultText = `Halved with ${data.opponentName}`;
    resultColor = c.textMuted;
  }

  const teamPointLabel = data.pointsForTeam === 1 ? '+1' : data.pointsForTeam === 0.5 ? '+0.5' : '+0';

  return (
    <View style={[ci.card, { backgroundColor: tint, borderColor: c.border }, theme.isDark ? cardShadowDark : cardShadowLight]}>
      {/* Header */}
      <View style={ci.cardHeader}>
        <Ionicons name="people" size={16} color={teamAccent} />
        <Text style={[ci.cardTitle, { color: teamAccent, fontFamily: GEO }]}>RYDER CUP</Text>
        <Text style={[ci.cardSubtitle, { color: c.textMuted }]}>{data.teamName}</Text>
      </View>

      {/* Match result */}
      <View style={ci.row}>
        <Text style={[ci.label, { color: c.textMuted }]}>Match result</Text>
        <View style={ci.valueRow}>
          <Text style={[ci.valueMain, { color: resultColor }]}>{resultText}</Text>
          <Text style={[ci.valueSub, { color: teamAccent, fontFamily: GEO }]}>
            {teamPointLabel} for {data.teamName}
          </Text>
        </View>
      </View>

      {/* Team standings */}
      <View style={[ci.row, { borderTopWidth: 1, borderTopColor: c.border }]}>
        <Text style={[ci.label, { color: c.textMuted }]}>Team standings</Text>
        <Text style={[ci.valueMain, { color: c.text, fontFamily: GEO }]}>
          {data.teamName} {data.teamScore > data.opponentTeamScore ? 'leads' : data.teamScore < data.opponentTeamScore ? 'trails' : 'tied'}{' '}
          {data.teamScore} - {data.opponentTeamScore}
        </Text>
      </View>
    </View>
  );
}

// ─── Handicap Impact Card ───────────────────────────────────────────

function HandicapImpactCard({ data }: { data: HandicapImpact }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const changed = data.change !== 0;
  const arrow = data.change < 0 ? '↓' : data.change > 0 ? '↑' : '—';
  const changeColor = data.change < 0 ? c.scoreUnder : data.change > 0 ? c.scoreOver : c.textMuted;

  return (
    <View style={[ci.card, { backgroundColor: theme.isDark ? c.elevated : c.surface, borderColor: c.border }, theme.isDark ? cardShadowDark : cardShadowLight]}>
      {/* Header */}
      <View style={ci.cardHeader}>
        <Ionicons name="trending-down" size={16} color={c.teal} />
        <Text style={[ci.cardTitle, { color: c.teal, fontFamily: GEO }]}>HANDICAP</Text>
      </View>

      {/* Index change */}
      <View style={ci.row}>
        <Text style={[ci.label, { color: c.textMuted }]}>Index</Text>
        {changed ? (
          <View style={ci.valueRow}>
            <Text style={[ci.handicapValue, { color: c.textMuted, fontFamily: GEO }]}>
              {data.previousIndex.toFixed(1)}
            </Text>
            <Ionicons name="arrow-forward" size={12} color={c.textMuted} style={{ marginHorizontal: 4 }} />
            <Text style={[ci.handicapValue, { color: c.text, fontFamily: GEO }]}>
              {data.newIndex.toFixed(1)}
            </Text>
            <Text style={[ci.handicapChange, { color: changeColor, fontFamily: GEO }]}>
              ({arrow}{Math.abs(data.change).toFixed(1)})
            </Text>
          </View>
        ) : (
          <Text style={[ci.valueSub, { color: c.text }]}>
            Unchanged at {data.previousIndex.toFixed(1)}
          </Text>
        )}
      </View>

      {/* Dropped round info */}
      {data.isCountingRound && data.droppedRoundScore !== null && (
        <View style={[ci.row, { borderTopWidth: 1, borderTopColor: c.border }]}>
          <Text style={[ci.label, { color: c.textMuted }]}>20-round window</Text>
          <Text style={[ci.valueSub, { color: c.textMuted }]}>
            Dropped round of {data.droppedRoundScore}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Combined Section ───────────────────────────────────────────────

export function CompetitionImpactSection({
  seasonImpact,
  ryderCupImpact,
  handicapImpact,
}: {
  seasonImpact: SeasonImpact | null;
  ryderCupImpact: RyderCupImpact | null;
  handicapImpact: HandicapImpact;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={ci.section}>
      <Text style={[ci.sectionTitle, { color: c.gold, fontFamily: GEO }]}>COMPETITION IMPACT</Text>
      {seasonImpact && <SeasonImpactCard data={seasonImpact} />}
      {ryderCupImpact && <RyderCupImpactCard data={ryderCupImpact} />}
      <HandicapImpactCard data={handicapImpact} />
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
