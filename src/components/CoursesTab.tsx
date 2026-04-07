import { useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../theme/colors';
import { CourseImage } from './CourseImage';
import {
  PLAYED_SORTED,
  SEED_COMMUNITY_COURSES,
  type PlayedCourse,
  type CommunityCourse,
} from '../data/courses';
import { DEMO_FIELD_COURSES } from './DemoPeek';
import type { LeaderboardScope } from '../data/leaderboard';

// ─── Search input ────────────────────────────────────────────────────
function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[s.searchWrap, { backgroundColor: c.elevated, borderColor: c.border }]}>
      <Ionicons name="search" size={16} color={c.textMuted} />
      <TextInput
        style={[s.searchInput, { color: c.text }]}
        placeholder="Search any course..."
        placeholderTextColor={c.textMuted}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={c.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Played course card ──────────────────────────────────────────────
function PlayedCourseCard({ course }: { course: PlayedCourse }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/course-detail?courseId=${course.id}`)}
      style={({ pressed }) => [s.card, { backgroundColor: c.cardBg, borderColor: c.border, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, theme.isDark ? cardShadowDark : cardShadowLight]}
    >
      {/* Course image header (falls back to gradient) */}
      <CourseImage
        courseName={course.name}
        location={`${course.city} ${course.state}`}
        gradient={course.gradient}
        style={s.cardHeader}
      >
        <View style={s.cardImageOverlay} />
        <View style={s.cardHeaderContent}>
          <View style={s.cardHeaderText}>
            <Text style={s.cardName} numberOfLines={1}>
              {course.name}
            </Text>
            <Text style={s.cardLocation}>
              {course.city}, {course.state}
            </Text>
          </View>
          {course.recordScore !== null && (
            <View style={s.recordBadge}>
              <Text style={[s.recordScore, { fontFamily: GEO }]}>
                {course.recordScore}
              </Text>
              <Text style={s.recordLabel}>REC</Text>
            </View>
          )}
        </View>
      </CourseImage>

      {/* Stats row */}
      <View style={s.cardBody}>
        <View style={s.statsRow}>
          <StatPill label="Par" value={String(course.par)} c={c} />
          <StatPill label="Slope" value={String(course.slope)} c={c} />
          <StatPill label="Rounds" value={String(course.totalRounds)} c={c} />
          <StatPill label="Players" value={String(course.playerCount)} c={c} />
        </View>
        {course.myBest !== null && (
          <View style={s.myBestWrap}>
            <Text style={[s.myBestLabel, { color: c.textMuted }]}>You:</Text>
            <Text style={[s.myBestScore, { color: c.teal, fontFamily: GEO }]}>
              {course.myBest}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function StatPill({
  label,
  value,
  c,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof useTheme>['theme']['colors'];
}) {
  return (
    <View style={s.statPill}>
      <Text style={[s.statValue, { color: c.text, fontFamily: GEO }]}>{value}</Text>
      <Text style={[s.statLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Community course row ────────────────────────────────────────────
function CommunityRow({ course }: { course: CommunityCourse }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/course-detail?courseId=${course.id}`)}
      style={({ pressed }) => [s.communityRow, { backgroundColor: c.cardBg, borderColor: c.border, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <View style={s.communityInfo}>
        <Text style={[s.communityName, { color: c.text }]} numberOfLines={1}>
          {course.name}
        </Text>
        <Text style={[s.communityLocation, { color: c.textMuted }]}>
          {course.city}, {course.state}
        </Text>
        <Text style={[s.communityStats, { color: c.teal }]}>
          {course.communityRounds} rounds · Avg: {course.communityAvg.toFixed(0)}
        </Text>
      </View>
      <View style={s.viewBtn}>
        <Text style={[s.viewBtnText, { color: c.teal }]}>View →</Text>
      </View>
    </Pressable>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────
function EmptyState() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={s.empty}>
      <Ionicons name="search" size={40} color={c.border} />
      <Text style={[s.emptyText, { color: c.textMuted }]}>
        No courses match
      </Text>
    </View>
  );
}

// ─── Section header ──────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Text style={[s.sectionHeader, { color: c.gold, fontFamily: GEO }]}>
      {title}
    </Text>
  );
}

// ─── Main component ──────────────────────────────────────────────────
export function CoursesTab({
  search,
  onSearchChange,
  scope = 'group',
}: {
  search: string;
  onSearchChange: (v: string) => void;
  scope?: LeaderboardScope;
}) {
  const q = search.trim().toLowerCase();

  const courseSource = scope === 'field' ? DEMO_FIELD_COURSES as PlayedCourse[] : PLAYED_SORTED;

  const playedFiltered = useMemo(
    () =>
      q.length === 0
        ? courseSource
        : courseSource.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.city.toLowerCase().includes(q) ||
              c.state.toLowerCase().includes(q),
          ),
    [q, courseSource],
  );

  const communityFiltered = useMemo(
    () =>
      q.length === 0
        ? [] // only show community when searching
        : SEED_COMMUNITY_COURSES.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.city.toLowerCase().includes(q) ||
              c.state.toLowerCase().includes(q),
          ),
    [q],
  );

  const noResults = playedFiltered.length === 0 && communityFiltered.length === 0;

  return (
    <View style={s.container}>
      <SearchBar value={search} onChange={onSearchChange} />

      {noResults ? (
        <EmptyState />
      ) : (
        <>
          {/* Tier 1: Played */}
          {playedFiltered.length > 0 && (
            <>
              <SectionHeader
                title={scope === 'field' ? `ALL COURSES (${playedFiltered.length})` : `PLAYED (${playedFiltered.length})`}
              />
              {playedFiltered.map((course) => (
                <PlayedCourseCard key={course.id} course={course} />
              ))}
            </>
          )}

          {/* Tier 2: Community (search only) */}
          {communityFiltered.length > 0 && (
            <>
              <SectionHeader title="🌎 DORMIE COMMUNITY" />
              {communityFiltered.map((course) => (
                <CommunityRow key={course.id} course={course} />
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },

  /* Section */
  sectionHeader: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
    textTransform: 'uppercase',
  },

  /* Played course card */
  card: {
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    height: 80,
  },
  cardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  cardHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  cardName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cardLocation: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 1,
  },
  recordBadge: {
    alignItems: 'center',
  },
  recordScore: {
    color: '#C9A227',
    fontSize: 18,
    fontWeight: '700',
  },
  recordLabel: {
    color: 'rgba(201,162,39,0.7)',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* Card body */
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  statPill: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* My best */
  myBestWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  myBestLabel: {
    fontSize: 11,
  },
  myBestScore: {
    fontSize: 20,
    fontWeight: '700',
  },

  /* Community row */
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 13,
    fontWeight: '600',
  },
  communityLocation: {
    fontSize: 10,
    marginTop: 1,
  },
  communityStats: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  viewBtn: {
    paddingLeft: 12,
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Empty */
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});
