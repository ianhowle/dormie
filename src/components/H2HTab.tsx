import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../theme/colors';
import { Avatar } from './Avatar';
import { MOCK_H2H, type H2HMatchup } from '../data/h2h';
import { DEMO_FIELD_H2H } from './DemoPeek';
import type { RoundWithCourse } from '../lib/database.types';
import type { LeaderboardScope } from '../data/leaderboard';

// ─── Props ───────────────────────────────────────────────────────────
type Friend = { id: string; name: string; handicap: number };

type H2HTabProps = {
  userId?: string;
  friends?: Friend[];
  realRounds?: RoundWithCourse[] | null;
  scope?: LeaderboardScope;
};

// ─── Compute H2H records from real round data ────────────────────────
function computeH2H(
  userId: string,
  friends: Friend[],
  allRounds: RoundWithCourse[],
): H2HMatchup[] {
  // Index user's own rounds by course_id + date key
  const myRounds = allRounds.filter((r) => r.user_id === userId);

  return friends
    .map((friend) => {
      const theirRounds = allRounds.filter((r) => r.user_id === friend.id);

      // Build per-course breakdown: track best scores on each shared course
      const courseMap = new Map<
        string,
        { courseName: string; myBest: number; theirBest: number }
      >();

      // Collect all course_ids played by this friend
      const friendCourseIds = new Set(theirRounds.map((r) => r.course_id));

      for (const courseId of friendCourseIds) {
        const myAtCourse = myRounds.filter((r) => r.course_id === courseId);
        const theirAtCourse = theirRounds.filter((r) => r.course_id === courseId);
        if (myAtCourse.length === 0 || theirAtCourse.length === 0) continue;

        const myBest = Math.min(...myAtCourse.map((r) => r.gross_score));
        const theirBest = Math.min(...theirAtCourse.map((r) => r.gross_score));
        const courseName = myAtCourse[0].course.name;
        courseMap.set(courseId, { courseName, myBest, theirBest });
      }

      // Head-to-head: compare rounds played at the same course on the same date
      // A "match" = same course_id + same played_at date (YYYY-MM-DD)
      let myWins = 0;
      let theirWins = 0;
      let ties = 0;

      for (const myRound of myRounds) {
        const myDate = myRound.played_at.slice(0, 10);
        const opposing = theirRounds.find(
          (r) =>
            r.course_id === myRound.course_id &&
            r.played_at.slice(0, 10) === myDate,
        );
        if (!opposing) continue;
        if (myRound.gross_score < opposing.gross_score) myWins++;
        else if (myRound.gross_score > opposing.gross_score) theirWins++;
        else ties++;
      }

      const totalMatches = myWins + theirWins + ties;

      return {
        opponentId: friend.id,
        opponentName: friend.name,
        opponentHandicap: friend.handicap,
        myWins,
        theirWins,
        ties,
        totalMatches,
        courseBreakdown: Array.from(courseMap.entries()).map(
          ([courseId, v]) => ({
            courseId,
            courseName: v.courseName,
            myBest: v.myBest,
            theirBest: v.theirBest,
          }),
        ),
      } satisfies H2HMatchup;
    })
    .filter((m) => m.totalMatches > 0 || m.courseBreakdown.length > 0);
}

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
      style={({ pressed }) => [s.card, { backgroundColor: theme.isDark ? c.cardBg : '#FFFFFF', borderColor: theme.isDark ? c.border : 'rgba(0,0,0,0.06)', opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, theme.isDark ? cardShadowDark : cardShadowLight]}

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
          <Text style={[s.cardName, { color: theme.isDark ? c.text : '#1A1A1A', fontWeight: '700' }]} numberOfLines={1}>
            {matchup.opponentName}
          </Text>
          <Text style={[s.cardSub, { color: theme.isDark ? c.textMuted : '#6B6966' }]}>
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
export function H2HTab({ userId, friends, realRounds, scope = 'group' }: H2HTabProps = {}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const matchups = useMemo<H2HMatchup[]>(() => {
    if (
      userId &&
      friends &&
      friends.length > 0 &&
      realRounds &&
      realRounds.length > 0
    ) {
      return computeH2H(userId, friends, realRounds);
    }
    // Demo data: different sets for group vs field
    return scope === 'field' ? DEMO_FIELD_H2H : MOCK_H2H;
  }, [userId, friends, realRounds, scope]);

  return (
    <View style={s.container}>
      <Text style={[s.header, { color: c.gold, fontFamily: GEO }]}>
        HEAD TO HEAD
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        {scope === 'field' ? 'Your record against all Dormie players' : 'Your record against Group members'}
      </Text>

      {matchups.map((m) => (
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
    fontSize: 13,
    fontWeight: '600',
  },
  cardSub: {
    fontSize: 10,
    marginTop: 1,
  },

  /* Record numbers */
  record: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  recordWins: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
  },
  recordDash: {
    fontSize: 16,
    marginHorizontal: 4,
  },
  recordLosses: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
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
