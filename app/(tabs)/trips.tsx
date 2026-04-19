import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO, SANS } from '../../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../../src/theme/colors';
import { Avatar } from '../../src/components/Avatar';
import { DestinationImage } from '../../src/components/CourseImage';
import GoldDivider from '../../src/components/GoldDivider';
import { TripCountdownRing } from '../../src/components/TripCountdownRing';
import { useAuth } from '../../src/lib/auth';
import { tripsService } from '../../src/services/trips.service';
import { bucketListService } from '../../src/services/bucketList.service';
import { haptics } from '../../src/lib/haptics';
import { useToast } from '../../src/components/Toast';
import { DataFreshness } from '../../src/components/DataFreshness';
import { getDreamImage } from '../../src/services/courseImages.service';
import type { TripWithMembers, BucketListItemWithCourse } from '../../src/lib/database.types';
import { TripsEmpty } from '../../src/components/EmptyStates';
import { DemoPeekToggle, DemoBanner } from '../../src/components/DemoPeek';
import { useDemoMode } from '../../src/contexts/DemoModeContext';
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
  const isDark = theme.isDark;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={greenHeaderGradient}
      style={[s.header, { paddingTop: insets.top + 8 }]}
    >
      <View>
        <Text style={[s.dormieLabel, { color: 'rgba(255,255,255,0.6)', fontFamily: GEO }]}>DORMIE</Text>
        <Text style={[s.headerTitle, { color: 'rgba(255,255,255,0.8)', fontFamily: GEO }]}>Trips</Text>
      </View>
      <View style={s.headerActions}>
        <Pressable
          onPress={() => router.push('/discover')}
          style={({ pressed }) => [
            s.headerBtn,
            { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons name="compass-outline" size={15} color="rgba(255,255,255,0.8)" />
          <Text style={[s.headerBtnText, { color: 'rgba(255,255,255,0.8)' }]}>Discover</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/create-trip')}
          style={({ pressed }) => [
            s.headerBtn,
            { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons name="add" size={15} color="#1E4D2B" />
          <Text style={[s.headerBtnText, { color: '#1E4D2B' }]}>New Trip</Text>
        </Pressable>
      </View>
      <GoldDivider style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
    </LinearGradient>
  );
}

// ─── Trip stats banner ────────────────────────────────────────────────
function TripStatsBanner() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const stats = MOCK_TRIP_STATS;
  const diff = stats.regularAvg - stats.tripAvg;
  const playsSmarter = diff > 0;

  return (
    <View style={[s.statsBanner, { backgroundColor: `${c.teal}10`, borderColor: c.teal, borderWidth: 1 }, ...(isDark ? [cardShadowDark] : [cardShadowLight])]}>
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
  const isDark = theme.isDark;

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
          <Pressable
            key={d.id}
            onPress={() => haptics.light()}
            style={({ pressed }) => [
              s.dreamCard,
              { borderWidth: 1, borderColor: c.border },
              ...(isDark ? [cardShadowDark] : [cardShadowLight]),
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <DestinationImage
              name={d.name}
              imageUrl={getDreamImage(d.name)}
              gradient={d.gradient}
              style={s.dreamGradient}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.7)']}
                locations={[0, 0.4, 1]}
                style={s.dreamOverlay}
              />
              <View style={s.dreamTextWrap}>
                <Text style={[s.dreamName, { fontFamily: GEO }]}>{d.name}</Text>
                <Text style={s.dreamLocation}>{d.city}, {d.state}</Text>
              </View>
            </DestinationImage>
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
  const { theme } = useTheme();
  const c = theme.colors;
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
          <Text style={[s.avatarExtraText, { color: c.textMuted }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Trip card ────────────────────────────────────────────────────────
function TripCard({ trip, showDays }: { trip: Trip; showDays?: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();
  const daysAway = showDays ? getDaysUntilTrip(trip.startDate) : 0;

  // Item 12: Two-tone color palette — planning vs competition mode
  const isCompetition = trip.competitionStarted === true;
  const MASTERS_GREEN = '#1E4D2B';
  const cardBg = isCompetition
    ? c.cardBg
    : theme.isDark
      ? '#2A2318' // warm dark tint for planning
      : '#FAF3E0'; // champagne cream for planning (light)
  const borderLeftColor = isCompetition
    ? MASTERS_GREEN
    : trip.isRyderCup
      ? c.urgent
      : c.teal;
  const borderColor = isCompetition ? MASTERS_GREEN : c.border;

  const tripImage = getDreamImage(trip.city);

  return (
    <Pressable
      onPress={() => { haptics.light(); router.push(`/trip-detail?tripId=${trip.id}`); }}
      style={({ pressed }) => [
        s.tripCard,
        {
          backgroundColor: cardBg,
          borderColor,
          borderWidth: 1,
          borderLeftWidth: 3,
          borderLeftColor,
        },
        ...(isDark ? [cardShadowDark] : [cardShadowLight]),
        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
      ]}
    >
      {tripImage && (
        <DestinationImage
          name={trip.city}
          imageUrl={tripImage}
          gradient={trip.gradient}
          style={s.tripImageBg}
        >
          <View style={s.tripImageOverlay} />
        </DestinationImage>
      )}
      <View style={[s.tripCardBody, tripImage && { zIndex: 1 }]}>
        <View style={s.tripCardTop}>
          <View style={s.tripCardTitleRow}>
            <Text style={[s.tripName, { color: tripImage ? '#fff' : c.text }]} numberOfLines={1}>
              {trip.name}
            </Text>
            {isCompetition && (
              <View style={[s.rcBadge, { backgroundColor: `${MASTERS_GREEN}20` }]}>
                <Text style={[s.rcBadgeText, { color: MASTERS_GREEN }]}>LIVE</Text>
              </View>
            )}
            {!isCompetition && trip.isRyderCup && (
              <View style={[s.rcBadge, { backgroundColor: `${c.urgent}20` }]}>
                <Text style={[s.rcBadgeText, { color: c.urgent }]}>RC</Text>
              </View>
            )}
          </View>
          <Text style={[s.tripLocation, { color: tripImage ? 'rgba(255,255,255,0.7)' : c.textMuted }]}>
            {trip.city}, {trip.state} · {trip.roundsPlanned} round{trip.roundsPlanned !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={s.tripCardBottom}>
          <AvatarStack playerIds={trip.playerIds} />
          {/* Item 15: Replace plain days badge with TripCountdownRing */}
          {showDays && (
            <TripCountdownRing
              daysUntil={daysAway}
              totalDays={60}
              size={50}
              strokeWidth={3}
              accentColor={trip.isRyderCup ? c.urgent : isCompetition ? MASTERS_GREEN : c.teal}
              textColor={tripImage ? '#FFFFFF' : undefined}
            />
          )}
        </View>
      </View>

      {/* Champion / Ryder Cup winner for completed */}
      {trip.isRyderCup && trip.ryderCupConfig?.winner ? (
        <View style={[s.championRow, { borderColor: c.border }]}>
          <Ionicons name="trophy" size={14} color={c.gold} />
          <Text style={[s.championText, { color: c.gold, fontFamily: GEO }]}>
            {trip.ryderCupConfig.winner === 'tied'
              ? 'Tied'
              : `${trip.ryderCupConfig.winner === 'red'
                  ? trip.ryderCupConfig.teamRedName
                  : trip.ryderCupConfig.teamBlueName
                } Wins`}
          </Text>
        </View>
      ) : trip.champion ? (
        <View style={[s.championRow, { borderColor: c.border }]}>
          <Ionicons name="trophy" size={14} color={c.gold} />
          <Text style={[s.championText, { color: c.gold, fontFamily: GEO }]}>
            {trip.champion}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Bucket list ──────────────────────────────────────────────────────
function BucketList({ courses, realItems }: { courses: BucketCourse[]; realItems: BucketListItemWithCourse[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  // Merge real data with mock fallback
  const hasRealData = realItems.length > 0;
  const displayCourses = hasRealData
    ? realItems.map((item) => {
        const parts = item.course.location?.split(',') ?? ['', ''];
        return {
          id: item.id,
          name: item.course.name,
          city: parts[0]?.trim() ?? '',
          state: parts[1]?.trim() ?? '',
        };
      })
    : courses;

  if (displayCourses.length === 0) return null;

  return (
    <View>
      <SectionLabel title="BUCKET LIST" />
      {displayCourses.map((course) => (
        <View
          key={course.id}
          style={[
            s.bucketRow,
            {
              backgroundColor: c.cardBg,
              borderColor: c.gold,
              borderWidth: 1,
            },
            ...(isDark ? [cardShadowDark] : [cardShadowLight]),
          ]}
        >
          <Ionicons name="checkmark-circle" size={14} color={c.gold} />
          <View style={s.bucketInfo}>
            <Text style={[s.bucketName, { color: c.text, fontFamily: SANS }]}>{course.name}</Text>
            <Text style={[s.bucketLocation, { color: c.textMuted }]}>
              {course.city}{course.state ? `, ${course.state}` : ''}
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
  const isDark = theme.isDark;
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
            style={({ pressed }) => [
              s.exploreCard,
              { borderWidth: 1, borderColor: c.border },
              ...(isDark ? [cardShadowDark] : [cardShadowLight]),
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <DestinationImage
              name={d.name}
              imageUrl={getDreamImage(d.name)}
              gradient={d.gradient}
              style={s.exploreGradient}
            >
              <View style={s.dreamOverlay} />
              <View style={s.dreamTextWrap}>
                <Text style={[s.exploreName, { fontFamily: GEO }]}>{d.name}</Text>
                <Text style={s.exploreTagline}>{d.tagline}</Text>
              </View>
            </DestinationImage>
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
  const isDark = theme.isDark;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [realTrips, setRealTrips] = useState<TripWithMembers[]>([]);
  const [bucketItems, setBucketItems] = useState<BucketListItemWithCourse[]>([]);
  const { isDemoMode: showDemoData, setDemoMode: setShowDemoData } = useDemoMode();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const { showToast } = useToast();

  useEffect(() => {
    if (!user) return;
    tripsService.getByUser(user.id).then(setRealTrips).catch(() => {});
    bucketListService.getByUser(user.id).then(setBucketItems).catch(() => {});
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user) {
        const [trips, bucket] = await Promise.all([
          tripsService.getByUser(user.id),
          bucketListService.getByUser(user.id),
        ]);
        setRealTrips(trips);
        setBucketItems(bucket);
      }
      setLastRefreshed(new Date());
      showToast({ message: 'Trips updated', type: 'success' });
    } catch {}
    setRefreshing(false);
  }, [user, showToast]);

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.teal} />
        }
      >
        <Header />

        <View style={s.body}>
          {/* Demo peek toggle — for empty state */}
          {realTrips.length === 0 && (
            <DemoPeekToggle
              isActive={showDemoData}
              onToggle={() => setShowDemoData(!showDemoData)}
            />
          )}
          {showDemoData && realTrips.length === 0 && <DemoBanner />}

          {/* Smart empty state for new users — with destinations still visible */}
          {realTrips.length === 0 && !showDemoData && (
            <TripsEmpty />
          )}

          {/* Trip stats */}
          {(realTrips.length > 0 || showDemoData) && <TripStatsBanner />}

          {/* Gold divider after stats */}
          {(realTrips.length > 0 || showDemoData) && <GoldDivider style={{ marginTop: 24 }} />}

          {/* Dream board — always visible (destination data is not user-specific) */}
          <DreamBoard destinations={MOCK_DREAM_DESTINATIONS} />

          {/* Upcoming */}
          {(realTrips.length > 0 || showDemoData) && MOCK_UPCOMING_TRIPS.length > 0 && (
            <>
              <GoldDivider style={{ marginTop: 24 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <SectionLabel title="UPCOMING" />
                <DataFreshness updatedAt={lastRefreshed} />
              </View>
              {MOCK_UPCOMING_TRIPS.map((trip) => (
                <TripCard key={trip.id} trip={trip} showDays />
              ))}
            </>
          )}

          {/* Completed */}
          {(realTrips.length > 0 || showDemoData) && MOCK_COMPLETED_TRIPS.length > 0 && (
            <>
              <GoldDivider style={{ marginTop: 24 }} />
              <SectionLabel title="COMPLETED" />
              {MOCK_COMPLETED_TRIPS.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </>
          )}

          {/* Bucket list */}
          {(realTrips.length > 0 || showDemoData) && (
            <>
              <GoldDivider style={{ marginTop: 24 }} />
              <BucketList courses={MOCK_BUCKET_COURSES} realItems={bucketItems} />
            </>
          )}

          {/* Explore */}
          {(realTrips.length > 0 || showDemoData) && (
            <>
              <GoldDivider style={{ marginTop: 24 }} />
              <ExploreRow destinations={MOCK_EXPLORE_DESTINATIONS} />
            </>
          )}
        </View>

        <View style={{ height: 32 + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },

  /* Header — green gradient */
  header: {
    paddingBottom: 20,
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
    borderRadius: 0,
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Body */
  body: { paddingHorizontal: 20 },

  /* Section label */
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },

  /* Stats banner */
  statsBanner: {
    padding: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bannerStat: {
    alignItems: 'center',
  },
  bannerStatValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
  },
  bannerStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  callout: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
    fontFamily: SANS,
  },

  /* Dream board */
  dreamScroll: {
    gap: 10,
    paddingRight: 20,
  },
  dreamCard: {
    width: 160,
    overflow: 'hidden',
    borderRadius: 12,
  },
  dreamGradient: {
    height: 110,
  },
  dreamOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dreamTextWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
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
    paddingHorizontal: 14,
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
    fontSize: 9,
    fontWeight: '700',
  },

  /* Trip card */
  tripCard: {
    marginBottom: 10,
    overflow: 'hidden',
    borderRadius: 12,
  },
  tripImageBg: {
    ...StyleSheet.absoluteFillObject,
  },
  tripImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    borderRadius: 0,
  },
  rcBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tripLocation: {
    fontSize: 10,
    marginTop: 3,
    fontFamily: SANS,
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
    borderRadius: 0,
  },
  daysNum: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
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
    padding: 14,
    marginBottom: 8,
    borderRadius: 12,
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

  /* Explore */
  exploreScroll: {
    gap: 10,
    paddingRight: 20,
  },
  exploreCard: {
    width: 140,
    overflow: 'hidden',
    borderRadius: 12,
  },
  exploreGradient: {
    height: 100,
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

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    padding: 32,
    marginTop: 12,
    gap: 10,
    borderRadius: 12,
    opacity: 0.7,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 0,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  demoToggle: {
    fontSize: 12,
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});
