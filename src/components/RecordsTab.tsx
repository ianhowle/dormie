import { useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../theme/colors';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import {
  PLAYED_SORTED,
  MOCK_BUCKET_LIST,
  MOCK_GLOBAL_COURSES,
  type PlayedCourse,
  type BucketListCourse,
  type CommunityCourse,
} from '../data/courses';

// ─── Search bar (same visual as CoursesTab) ──────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────
function formatToPar(score: number, par: number): string {
  const diff = score - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : String(diff);
}

function toParColor(
  score: number,
  par: number,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): string {
  const diff = score - par;
  if (diff < 0) return c.teal;
  if (diff === 0) return c.gold;
  return c.urgent;
}

// ─── Section 1: Course records table ─────────────────────────────────
function RecordsTable({
  courses,
  myName,
}: {
  courses: PlayedCourse[];
  myName: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  const withRecords = courses.filter(
    (cr) => cr.recordScore !== null && cr.recordHolder !== null,
  );

  if (withRecords.length === 0) return null;

  return (
    <View style={s.tableWrap}>
      <SectionHeader title="GROUP COURSE RECORDS" />
      <View style={[s.table, { borderColor: c.border }]}>
        {/* Header row */}
        <View style={[s.tableRow, { backgroundColor: '#1E4D2B', paddingVertical: 12 }]}>
          <Text style={[s.colCourse, s.colHeader]}>COURSE</Text>
          <Text style={[s.colHolder, s.colHeader]}>HOLDER</Text>
          <Text style={[s.colToPar, s.colHeader]}>TO PAR</Text>
          <Text style={[s.colScore, s.colHeader]}>SCORE</Text>
        </View>

        {/* Data rows */}
        {withRecords.map((cr, i) => {
          const isMe = cr.recordHolder === myName;
          const bgColor = isMe
            ? `${c.teal}12`
            : i % 2 === 0
              ? c.cardBg
              : c.elevated;

          return (
            <Pressable
              key={cr.id}
              onPress={() => router.push(`/course-detail?courseId=${cr.id}`)}
              style={({ pressed }) => [
                s.tableRow,
                { backgroundColor: bgColor, opacity: pressed ? 0.7 : 1 },
                isMe && { borderLeftWidth: 2, borderLeftColor: c.teal },
              ]}
            >
              {/* Course */}
              <View style={s.colCourse}>
                <Text
                  style={[s.courseName, { color: c.text }]}
                  numberOfLines={1}
                >
                  {cr.name}
                </Text>
                <Text style={[s.courseMeta, { color: c.textMuted }]}>
                  Par {cr.par} · {cr.playerCount} players
                </Text>
              </View>

              {/* Holder */}
              <View style={[s.colHolder, s.holderCell]}>
                <Avatar
                  id={cr.recordHolder === myName ? '1' : cr.id}
                  size={22}
                  name={cr.recordHolder ?? '?'}
                />
                <Text
                  style={[
                    s.holderName,
                    { color: isMe ? c.teal : c.text },
                    isMe && { fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {isMe ? 'You' : (cr.recordHolder ?? '?').split(' ')[0]}
                </Text>
              </View>

              {/* To Par */}
              <Text
                style={[
                  s.colToPar,
                  s.toParNum,
                  {
                    color: toParColor(cr.recordScore ?? cr.par, cr.par, c),
                    fontFamily: GEO,
                  },
                ]}
              >
                {formatToPar(cr.recordScore ?? cr.par, cr.par)}
              </Text>

              {/* Score */}
              <Text
                style={[
                  s.colScore,
                  s.scoreNum,
                  { color: c.text, fontFamily: GEO },
                ]}
              >
                {cr.recordScore}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Section 2: Bucket list ──────────────────────────────────────────
function BucketListCard({ course }: { course: BucketListCourse }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const hasCommunity = course.communityRounds !== null;

  return (
    <Pressable
      onPress={() => router.push(`/course-detail?courseId=${course.id}`)}
      style={[
        s.bucketCard,
        {
          backgroundColor: c.cardBg,
          borderColor: c.gold,
        },
      ]}
    >
      <View style={s.bucketInfo}>
        <Text style={[s.bucketName, { color: c.text }]} numberOfLines={1}>
          {course.name}
        </Text>
        <Text style={[s.bucketLocation, { color: c.textMuted }]}>
          {course.city}, {course.state}
        </Text>
        {hasCommunity ? (
          <Text style={[s.bucketStats, { color: c.teal }]}>
            {course.communityRounds} Dormie rounds · Avg:{' '}
            {(course.communityAvg ?? 0).toFixed(0)}
          </Text>
        ) : (
          <Text style={[s.bucketNoData, { color: c.textMuted }]}>
            No Dormie data yet
          </Text>
        )}
      </View>
      {hasCommunity && (
        <Text style={[s.viewBtn, { color: c.teal }]}>View →</Text>
      )}
    </Pressable>
  );
}

// ─── Section 3: Global discover row ─────────────────────────────────
function DiscoverRow({ course }: { course: CommunityCourse }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/course-detail?courseId=${course.id}`)}
      style={[s.discoverRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
    >
      <View style={s.discoverInfo}>
        <Text style={[s.discoverName, { color: c.text }]} numberOfLines={1}>
          {course.name}
        </Text>
        <Text style={[s.discoverLocation, { color: c.textMuted }]}>
          {course.city}, {course.state}
        </Text>
        <Text style={[s.discoverStats, { color: c.teal }]}>
          {course.communityRounds} rounds · Avg: {course.communityAvg.toFixed(0)}
        </Text>
      </View>
      <Text style={[s.viewBtn, { color: c.teal }]}>View →</Text>
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

// ─── Main component ──────────────────────────────────────────────────
export function RecordsTab({
  search,
  onSearchChange,
  courseRecords,
  bucketList,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  courseRecords?: PlayedCourse[] | null;
  bucketList?: BucketListCourse[] | null;
}) {
  const { user } = useAuth();
  const myName: string =
    (user?.user_metadata?.name as string | undefined) ?? 'Ian McGowan';

  const playedSource = courseRecords && courseRecords.length > 0
    ? courseRecords
    : PLAYED_SORTED;
  const bucketSource = bucketList && bucketList.length > 0
    ? bucketList
    : MOCK_BUCKET_LIST;

  const q = search.trim().toLowerCase();

  const matchesQuery = (name: string, city: string, state: string) =>
    q.length === 0 ||
    name.toLowerCase().includes(q) ||
    city.toLowerCase().includes(q) ||
    state.toLowerCase().includes(q);

  const recordsFiltered = useMemo(
    () =>
      playedSource.filter(
        (cr) =>
          cr.recordScore !== null &&
          cr.recordHolder !== null &&
          matchesQuery(cr.name, cr.city, cr.state),
      ),
    [q, playedSource],
  );

  const bucketFiltered = useMemo(
    () =>
      bucketSource.filter((bl) =>
        matchesQuery(bl.name, bl.city, bl.state),
      ),
    [q, bucketSource],
  );

  const playedIds = new Set(playedSource.map((c) => c.name.toLowerCase()));
  const bucketIds = new Set(bucketSource.map((c) => c.name.toLowerCase()));

  const discoverFiltered = useMemo(
    () =>
      q.length === 0
        ? [] // only show when searching
        : MOCK_GLOBAL_COURSES.filter(
            (gc) =>
              matchesQuery(gc.name, gc.city, gc.state) &&
              !playedIds.has(gc.name.toLowerCase()) &&
              !bucketIds.has(gc.name.toLowerCase()),
          ),
    [q],
  );

  const noResults =
    recordsFiltered.length === 0 &&
    bucketFiltered.length === 0 &&
    discoverFiltered.length === 0;

  return (
    <View style={s.container}>
      <SearchBar value={search} onChange={onSearchChange} />

      {noResults ? (
        <EmptyState />
      ) : (
        <>
          {/* Section 1: Course records */}
          {recordsFiltered.length > 0 && (
            <RecordsTable courses={recordsFiltered} myName={myName} />
          )}

          {/* Section 2: Bucket list */}
          {bucketFiltered.length > 0 && (
            <>
              <SectionHeader title="⭐ BUCKET LIST" />
              {bucketFiltered.map((bl) => (
                <BucketListCard key={bl.id} course={bl} />
              ))}
            </>
          )}

          {/* Section 3: Discover (search only) */}
          {discoverFiltered.length > 0 && (
            <>
              <SectionHeader title="🌎 DISCOVER ON DORMIE" />
              {discoverFiltered.map((gc) => (
                <DiscoverRow key={gc.id} course={gc} />
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
    marginTop: 16,
    textTransform: 'uppercase',
  },

  /* Table */
  tableWrap: {
    marginBottom: 4,
  },
  table: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  colHeader: {
    color: '#E8E4DE',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  colCourse: {
    flex: 1,
    paddingRight: 4,
  },
  colHolder: {
    width: 72,
  },
  colToPar: {
    width: 48,
    textAlign: 'right',
  },
  colScore: {
    width: 42,
    textAlign: 'right',
  },

  /* Course cell */
  courseName: {
    fontSize: 13,
    fontWeight: '600',
  },
  courseMeta: {
    fontSize: 10,
    marginTop: 1,
  },

  /* Holder cell */
  holderCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  holderName: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },

  /* Numbers */
  toParNum: {
    fontSize: 16,
    fontWeight: '700',
  },
  scoreNum: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* Bucket list */
  bucketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  bucketInfo: {
    flex: 1,
  },
  bucketName: {
    fontSize: 13,
    fontWeight: '600',
  },
  bucketLocation: {
    fontSize: 10,
    marginTop: 1,
  },
  bucketStats: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  bucketNoData: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },

  /* Discover row */
  discoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  discoverInfo: {
    flex: 1,
  },
  discoverName: {
    fontSize: 13,
    fontWeight: '600',
  },
  discoverLocation: {
    fontSize: 10,
    marginTop: 1,
  },
  discoverStats: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },

  /* View button */
  viewBtn: {
    fontSize: 13,
    fontWeight: '700',
    paddingLeft: 12,
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
