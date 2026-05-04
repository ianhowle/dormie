import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { cardShadowDark, cardShadowLight } from '../src/theme/colors';
import { haptics } from '../src/lib/haptics';
import { Avatar } from '../src/components/Avatar';
import GoldDivider from '../src/components/GoldDivider';
import { useAuth } from '../src/lib/auth';
import { roundsService } from '../src/services/rounds.service';
import type { CourseH2H, H2HMatchup } from '../src/data/h2h';

// ─── Course row ──────────────────────────────────────────────────────
function CourseRow({ course }: { course: CourseH2H }) {
  const { theme } = useTheme();
  const c = theme.colors;

  const iWon = course.myBest < course.theirBest;
  const theyWon = course.theirBest < course.myBest;
  const tied = course.myBest === course.theirBest;

  const isDark = theme.isDark;

  return (
    <Pressable
      onPress={() => { haptics.light(); }}
      style={({ pressed }) => [
        s.courseRow,
        { backgroundColor: c.cardBg, borderColor: c.border },
        ...(isDark ? [cardShadowDark] : [cardShadowLight]),
        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={[s.courseName, { color: c.text }]} numberOfLines={1}>
        {course.courseName}
      </Text>
      <View style={s.courseScores}>
        <Text
          style={[
            s.courseScore,
            {
              color: iWon ? c.teal : tied ? c.textMuted : c.text,
              fontFamily: GEO,
            },
            iWon && s.courseScoreWin,
          ]}
        >
          {course.myBest}
        </Text>
        <Text style={[s.courseVs, { color: c.textMuted }]}>vs</Text>
        <Text
          style={[
            s.courseScore,
            {
              color: theyWon ? c.urgent : tied ? c.textMuted : c.text,
              fontFamily: GEO,
            },
            theyWon && s.courseScoreWin,
          ]}
        >
          {course.theirBest}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────
export default function H2HDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { opponentId, opponentName: paramName } = useLocalSearchParams<{ opponentId: string; opponentName?: string }>();
  const { user } = useAuth();

  const [matchup, setMatchup] = useState<H2HMatchup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !opponentId) { setLoading(false); return; }
    Promise.all([
      roundsService.getByUser(user.id, 100),
      roundsService.getByUser(opponentId, 100),
    ]).then(([myRounds, theirRounds]) => {
      // Find shared courses
      const myCourses = new Map<string, { score: number; name: string }[]>();
      for (const r of myRounds) {
        const list = myCourses.get(r.course_id) ?? [];
        list.push({ score: r.gross_score, name: r.course?.name ?? 'Unknown' });
        myCourses.set(r.course_id, list);
      }
      const theirCourses = new Map<string, { score: number; name: string }[]>();
      for (const r of theirRounds) {
        const list = theirCourses.get(r.course_id) ?? [];
        list.push({ score: r.gross_score, name: r.course?.name ?? 'Unknown' });
        theirCourses.set(r.course_id, list);
      }

      let myWins = 0, theirWins = 0, ties = 0;
      const courseBreakdown: CourseH2H[] = [];

      for (const [courseId, myScores] of myCourses) {
        const theirScores = theirCourses.get(courseId);
        if (!theirScores) continue;
        const myBest = Math.min(...myScores.map(s => s.score));
        const theirBest = Math.min(...theirScores.map(s => s.score));
        if (myBest < theirBest) myWins++;
        else if (theirBest < myBest) theirWins++;
        else ties++;
        courseBreakdown.push({
          courseId,
          courseName: myScores[0].name,
          myBest,
          theirBest,
        });
      }

      setMatchup({
        opponentId,
        opponentName: paramName ?? 'Opponent',
        opponentHandicap: 0,
        myWins,
        theirWins,
        ties,
        totalMatches: myWins + theirWins + ties,
        courseBreakdown,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user?.id, opponentId, paramName]);

  const MY_NAME = user?.user_metadata?.name ?? 'You';
  const MY_ID = user?.id ?? '';

  if (loading || !matchup) {
    return (
      <View style={[s.screen, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <Pressable onPress={() => { haptics.light(); router.back(); }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <View style={s.notFound}>
          <Text style={[s.notFoundText, { color: c.textMuted }]}>
            {loading ? 'Loading...' : 'No shared rounds yet'}
          </Text>
        </View>
      </View>
    );
  }

  const totalDecided = matchup.myWins + matchup.theirWins;
  const myPct = totalDecided > 0 ? matchup.myWins / totalDecided : 0.5;

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style={theme.isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Pressable onPress={() => { haptics.light(); router.back(); }} style={s.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
          <Text style={[s.backLabel, { color: c.text }]}>Leaderboard</Text>
        </Pressable>

        {/* Face-off section */}
        <View style={s.faceoff}>
          {/* My side */}
          <View style={s.faceoffSide}>
            <Avatar id={MY_ID} size={64} name={MY_NAME} />
            <Text style={[s.faceoffName, { color: c.text }]} numberOfLines={1}>
              You
            </Text>
          </View>

          {/* Center record */}
          <View style={s.faceoffCenter}>
            <Text style={[s.allTimeLabel, { color: c.textMuted }]}>ALL-TIME</Text>
            <View style={s.faceoffRecord}>
              <Text style={[s.faceoffWins, { color: c.teal, fontFamily: GEO }]}>
                {matchup.myWins}
              </Text>
              <Text style={[s.faceoffDash, { color: c.textMuted, fontFamily: GEO }]}>
                –
              </Text>
              <Text style={[s.faceoffLosses, { color: c.urgent, fontFamily: GEO }]}>
                {matchup.theirWins}
              </Text>
            </View>
            {matchup.ties > 0 && (
              <Text style={[s.halved, { color: c.textMuted }]}>
                {matchup.ties} halved
              </Text>
            )}
            <Text style={[s.matchCount, { color: c.textMuted }]}>
              {matchup.totalMatches} matches
            </Text>
          </View>

          {/* Opponent side */}
          <View style={s.faceoffSide}>
            <Avatar
              id={matchup.opponentId}
              size={64}
              name={matchup.opponentName}
            />
            <Text style={[s.faceoffName, { color: c.text }]} numberOfLines={1}>
              {matchup.opponentName.split(' ')[0]}
            </Text>
          </View>
        </View>

        {/* Win bar */}
        <View style={[s.winBar, { backgroundColor: c.elevated }]}>
          <View
            style={[s.winBarFill, { width: `${myPct * 100}%`, backgroundColor: c.teal }]}
          />
          {totalDecided > 0 && (
            <View
              style={[
                s.winBarFill,
                {
                  width: `${(1 - myPct) * 100}%`,
                  backgroundColor: c.urgent,
                  position: 'absolute',
                  right: 0,
                },
              ]}
            />
          )}
        </View>

        <GoldDivider style={{ marginBottom: 24 }} />

        {/* Course by course */}
        <Text style={[s.sectionHeader, { color: c.gold, fontFamily: GEO }]}>
          COURSE BY COURSE
        </Text>

        {/* Column labels */}
        <View style={s.colLabels}>
          <Text style={[s.colLabel, { color: c.textMuted }]}>You</Text>
          <Text style={[s.colLabel, { color: c.textMuted }]}>
            {matchup.opponentName.split(' ')[0]}
          </Text>
        </View>

        {matchup.courseBreakdown.map((course) => (
          <CourseRow key={course.courseId} course={course} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Back */
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  backLabel: {
    fontSize: 16,
  },

  /* Not found */
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 16,
  },

  /* Face-off */
  faceoff: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  faceoffSide: {
    alignItems: 'center',
    width: 80,
  },
  faceoffName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  faceoffCenter: {
    alignItems: 'center',
    flex: 1,
  },
  allTimeLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 4,
  },
  faceoffRecord: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  faceoffWins: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1,
  },
  faceoffDash: {
    fontSize: 28,
    marginHorizontal: 8,
  },
  faceoffLosses: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1,
  },
  halved: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  matchCount: {
    fontSize: 11,
    marginTop: 2,
  },

  /* Win bar */
  winBar: {
    height: 6,
    marginHorizontal: 20,
    marginBottom: 20,
    flexDirection: 'row',
  },
  winBarFill: {
    height: 6,
  },

  /* Section */
  sectionHeader: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginHorizontal: 20,
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  /* Column labels */
  colLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  /* Course row */
  courseRow: {
    marginHorizontal: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  courseName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  courseScores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  courseScore: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
  },
  courseScoreWin: {
    fontSize: 28,
    letterSpacing: -1,
  },
  courseVs: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
