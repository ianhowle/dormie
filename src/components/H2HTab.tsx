import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../theme/colors';
import { Avatar } from './Avatar';
import { MOCK_H2H, type H2HMatchup } from '../data/h2h';

// ─── Matchup card ────────────────────────────────────────────────────
function MatchupCard({ matchup }: { matchup: H2HMatchup }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  const winPct =
    matchup.totalMatches > 0
      ? matchup.myWins / matchup.totalMatches
      : 0;
  const lossPct =
    matchup.totalMatches > 0
      ? matchup.theirWins / matchup.totalMatches
      : 0;

  return (
    <Pressable
      style={({ pressed }) => [s.card, { backgroundColor: c.cardBg, borderColor: c.border, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, theme.isDark ? cardShadowDark : cardShadowLight]}
      onPress={() =>
        router.push({
          pathname: '/h2h-detail',
          params: { opponentId: matchup.opponentId },
        })
      }
    >
      {/* Top row: avatar + name + record */}
      <View style={s.cardTop}>
        <Avatar id={matchup.opponentId} size={36} name={matchup.opponentName} />
        <View style={s.cardInfo}>
          <Text style={[s.cardName, { color: c.text }]} numberOfLines={1}>
            {matchup.opponentName}
          </Text>
          <Text style={[s.cardSub, { color: c.textMuted }]}>
            {matchup.opponentHandicap} HCP · {matchup.totalMatches} matches
          </Text>
        </View>
        <View style={s.record}>
          <Text style={[s.recordWins, { color: c.teal, fontFamily: GEO }]}>
            {matchup.myWins}
          </Text>
          <Text style={[s.recordDash, { color: c.textMuted }]}>–</Text>
          <Text style={[s.recordLosses, { color: c.urgent, fontFamily: GEO }]}>
            {matchup.theirWins}
          </Text>
          {matchup.ties > 0 && (
            <Text style={[s.recordTies, { color: c.textMuted }]}>
              {'  '}{matchup.ties}T
            </Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={[s.barTrack, { backgroundColor: c.elevated }]}>
        {winPct > 0 && (
          <View
            style={[s.barFill, { width: `${winPct * 100}%`, backgroundColor: c.teal }]}
          />
        )}
        {lossPct > 0 && (
          <View
            style={[
              s.barFill,
              {
                width: `${lossPct * 100}%`,
                backgroundColor: c.urgent,
                position: 'absolute',
                right: 0,
              },
            ]}
          />
        )}
      </View>
    </Pressable>
  );
}

// ─── Main component ──────────────────────────────────────────────────
export function H2HTab() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={s.container}>
      <Text style={[s.header, { color: c.gold, fontFamily: GEO }]}>
        HEAD TO HEAD
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        Your record against Group members
      </Text>

      {MOCK_H2H.map((m) => (
        <MatchupCard key={m.opponentId} matchup={m} />
      ))}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 10,
    marginTop: 2,
    marginBottom: 14,
  },

  /* Card */
  card: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 10,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardSub: {
    fontSize: 11,
    marginTop: 1,
  },

  /* Record numbers */
  record: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  recordWins: {
    fontSize: 22,
    fontWeight: '700',
  },
  recordDash: {
    fontSize: 16,
    marginHorizontal: 4,
  },
  recordLosses: {
    fontSize: 22,
    fontWeight: '700',
  },
  recordTies: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Progress bar */
  barTrack: {
    height: 4,
    marginTop: 10,
    flexDirection: 'row',
  },
  barFill: {
    height: 4,
  },
});
