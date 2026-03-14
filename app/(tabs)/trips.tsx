import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO } from '../../src/theme/fonts';
import { Avatar } from '../../src/components/Avatar';
import {
  MOCK_TRIP_STATS,
  MOCK_UPCOMING_TRIPS,
  MOCK_COMPLETED_TRIPS,
  MOCK_DREAM_DESTINATIONS,
  MOCK_BUCKET_COURSES,
  MOCK_EXPLORE_DESTINATIONS,
  getDaysUntilTrip,
  type Trip,
  type DreamDestination,
  type BucketCourse,
  type ExploreDestination,
} from '../../src/data/trips';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Section header ───────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>{title}</Text>
  );
}

// ─── Header ───────────────────────────────────────────────────────────
function Header() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  return (
    <View style={[s.header, { backgroundColor: c.surface }]}>
      <View>
        <Text style={[s.dormieLabel, { color: c.gold, fontFamily: GEO }]}>DORMIE</Text>
        <Text style={[s.headerTitle, { color: c.text, fontFamily: GEO }]}>Trips</Text>
      </View>
      <View style={s.headerActions}>
        <Pressable
          onPress={() => router.push('/discover')}
          style={[s.headerBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
        >
          <Ionicons name="compass-outline" size={15} color={c.textMuted} />
          <Text style={[s.headerBtnText, { color: c.textMuted }]}>Discover</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/create-trip')}
          style={[s.headerBtn, { backgroundColor: `${c.teal}18`, borderColor: c.teal }]}
        >
          <Ionicons name="add" size={15} color={c.teal} />
          <Text style={[s.headerBtnText, { color: c.teal }]}>New Trip</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Trip stats banner ────────────────────────────────────────────────
function TripStatsBanner() {
  const { theme } = useTheme();
  const c = theme.colors;
  const stats = MOCK_TRIP_STATS;
  const diff = stats.regularAvg - stats.tripAvg;
  const playsSmarter = diff > 0;

  return (
    <View style={[s.statsBanner, { backgroundColor: `${c.teal}10`, borderColor: c.teal }]}>
      <View style={s.statsRow}>
        <BannerStat label="TRIPS" value={String(stats.totalTrips)} c={c} />
        <BannerStat label="WINS" value={String(stats.wins)} c={c} />
        <BannerStat label="TRIP AVG" value={stats.tripAvg.toFixed(1)} c={c} />
        <BannerStat label="REG AVG" value={stats.regularAvg.toFixed(1)} c={c} />
      </View>
      {playsSmarter && (
        <Text style={[s.callout, { color: c.teal }]}>
          You play {diff.toFixed(1)} strokes better on trips
        </Text>
      )}
    </View>
  );
}

function BannerStat({
  label,
  value,
  c,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof useTheme>['theme']['colors'];
}) {
  return (
    <View style={s.bannerStat}>
      <Text style={[s.bannerStatValue, { color: c.teal, fontFamily: GEO }]}>{value}</Text>
      <Text style={[s.bannerStatLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Dream board (horizontal) ─────────────────────────────────────────
function DreamBoard({ destinations }: { destinations: DreamDestination[] }) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (destinations.length === 0) return null;

  return (
    <View>
      <SectionLabel title="DREAM BOARD" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.dreamScroll}
      >
        {destinations.map((d) => (
          <Pressable key={d.id} style={s.dreamCard}>
            <LinearGradient
              colors={d.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.dreamGradient}
            >
              <View style={s.dreamOverlay} />
              <Text style={[s.dreamName, { fontFamily: GEO }]}>{d.name}</Text>
              <Text style={s.dreamLocation}>{d.city}, {d.state}</Text>
            </LinearGradient>
            <View style={[s.dreamFooter, { backgroundColor: c.cardBg }]}>
              <Text style={[s.dreamAction, { color: c.teal }]}>Plan Trip →</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Avatar stack ─────────────────────────────────────────────────────
function AvatarStack({ playerIds, max }: { playerIds: string[]; max?: number }) {
  const show = playerIds.slice(0, max ?? 4);
  const extra = playerIds.length - show.length;

  return (
    <View style={s.avatarStack}>
      {show.map((id, i) => (
        <View key={id} style={[s.avatarStackItem, { marginLeft: i > 0 ? -8 : 0, zIndex: show.length - i }]}>
          <Avatar id={id} size={22} name="" />
        </View>
      ))}
      {extra > 0 && (
        <View style={[s.avatarExtra]}>
          <Text style={s.avatarExtraText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Trip card ────────────────────────────────────────────────────────
function TripCard({ trip, showDays }: { trip: Trip; showDays?: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const daysAway = showDays ? getDaysUntilTrip(trip.startDate) : 0;

  const borderLeftColor = trip.isRyderCup ? c.urgent : c.teal;

  return (
    <Pressable
      onPress={() => router.push(`/trip-detail?tripId=${trip.id}`)}
      style={[
        s.tripCard,
        { backgroundColor: c.cardBg, borderColor: c.border, borderLeftWidth: 3, borderLeftColor },
      ]}
    >
      <View style={s.tripCardBody}>
        <View style={s.tripCardTop}>
          <View style={s.tripCardTitleRow}>
            <Text style={[s.tripName, { color: c.text }]} numberOfLines={1}>
              {trip.name}
            </Text>
            {trip.isRyderCup && (
              <View style={[s.rcBadge, { backgroundColor: `${c.urgent}20` }]}>
                <Text style={[s.rcBadgeText, { color: c.urgent }]}>RC</Text>
              </View>
            )}
          </View>
          <Text style={[s.tripLocation, { color: c.textMuted }]}>
            {trip.city}, {trip.state} · {trip.roundsPlanned} round{trip.roundsPlanned !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={s.tripCardBottom}>
          <AvatarStack playerIds={trip.playerIds} />
          {showDays && (
            <View style={[s.daysBadge, { backgroundColor: trip.isRyderCup ? `${c.urgent}15` : `${c.teal}15` }]}>
              <Text style={[s.daysNum, { color: trip.isRyderCup ? c.urgent : c.teal, fontFamily: GEO }]}>
                {daysAway}
              </Text>
              <Text style={[s.daysLabel, { color: trip.isRyderCup ? c.urgent : c.teal }]}>days</Text>
            </View>
          )}
        </View>
      </View>

      {/* Champion for completed */}
      {trip.champion && (
        <View style={[s.championRow, { borderColor: c.border }]}>
          <Ionicons name="trophy" size={14} color={c.gold} />
          <Text style={[s.championText, { color: c.gold }]}>
            {trip.champion}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Bucket list ──────────────────────────────────────────────────────
function BucketList({ courses }: { courses: BucketCourse[] }) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (courses.length === 0) return null;

  return (
    <View>
      <SectionLabel title="BUCKET LIST" />
      {courses.map((course) => (
        <View
          key={course.id}
          style={[s.bucketRow, { backgroundColor: c.cardBg, borderColor: c.gold }]}
        >
          <Ionicons name="star" size={14} color={c.gold} />
          <View style={s.bucketInfo}>
            <Text style={[s.bucketName, { color: c.text }]}>{course.name}</Text>
            <Text style={[s.bucketLocation, { color: c.textMuted }]}>
              {course.city}, {course.state}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Explore row (horizontal) ─────────────────────────────────────────
function ExploreRow({ destinations }: { destinations: ExploreDestination[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  return (
    <View>
      <SectionLabel title="EXPLORE" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.exploreScroll}
      >
        {destinations.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => router.push('/discover')}
            style={s.exploreCard}
          >
            <LinearGradient
              colors={d.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.exploreGradient}
            >
              <View style={s.dreamOverlay} />
              <Text style={[s.exploreName, { fontFamily: GEO }]}>{d.name}</Text>
              <Text style={s.exploreTagline}>{d.tagline}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────
export default function TripsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <Header />

        <View style={s.body}>
          {/* Trip stats */}
          <TripStatsBanner />

          {/* Dream board */}
          <DreamBoard destinations={MOCK_DREAM_DESTINATIONS} />

          {/* Upcoming */}
          {MOCK_UPCOMING_TRIPS.length > 0 && (
            <>
              <SectionLabel title="UPCOMING" />
              {MOCK_UPCOMING_TRIPS.map((trip) => (
                <TripCard key={trip.id} trip={trip} showDays />
              ))}
            </>
          )}

          {/* Completed */}
          {MOCK_COMPLETED_TRIPS.length > 0 && (
            <>
              <SectionLabel title="COMPLETED" />
              {MOCK_COMPLETED_TRIPS.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </>
          )}

          {/* Bucket list */}
          <BucketList courses={MOCK_BUCKET_COURSES} />

          {/* Explore */}
          <ExploreRow destinations={MOCK_EXPLORE_DESTINATIONS} />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H + 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dormieLabel: {
    fontSize: 9,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Body */
  body: { paddingHorizontal: 16 },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },

  /* Stats banner */
  statsBanner: {
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bannerStat: {
    alignItems: 'center',
  },
  bannerStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  bannerStatLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  callout: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },

  /* Dream board */
  dreamScroll: {
    gap: 10,
    paddingRight: 16,
  },
  dreamCard: {
    width: 160,
    overflow: 'hidden',
  },
  dreamGradient: {
    height: 90,
    justifyContent: 'flex-end',
    padding: 10,
  },
  dreamOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dreamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  dreamLocation: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 1,
  },
  dreamFooter: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dreamAction: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Avatar stack */
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStackItem: {},
  avatarExtra: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  avatarExtraText: {
    color: '#6B6560',
    fontSize: 9,
    fontWeight: '700',
  },

  /* Trip card */
  tripCard: {
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  tripCardBody: {
    padding: 14,
  },
  tripCardTop: {
    marginBottom: 10,
  },
  tripCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  rcBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rcBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tripLocation: {
    fontSize: 11,
    marginTop: 3,
  },
  tripCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  daysBadge: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  daysNum: {
    fontSize: 18,
    fontWeight: '700',
  },
  daysLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: -1,
  },

  /* Champion */
  championRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  championText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Bucket list */
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 12,
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
    fontSize: 11,
    marginTop: 1,
  },

  /* Explore */
  exploreScroll: {
    gap: 10,
    paddingRight: 16,
  },
  exploreCard: {
    width: 140,
    overflow: 'hidden',
  },
  exploreGradient: {
    height: 80,
    justifyContent: 'flex-end',
    padding: 10,
  },
  exploreName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  exploreTagline: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 1,
  },
});
