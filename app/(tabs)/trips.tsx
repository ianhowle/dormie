import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO, SANS } from '../../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../../src/theme/colors';
import { todayYMD, fromYMD } from '../../src/components/wizard/quick-trip/dateHelpers';
import { Avatar } from '../../src/components/Avatar';
import { DestinationImage } from '../../src/components/CourseImage';
import GoldDivider from '../../src/components/GoldDivider';
import { TripCountdownRing } from '../../src/components/TripCountdownRing';
import { Skeleton } from '../../src/components/Skeleton';
import { useAuth } from '../../src/lib/auth';
import { tripsService } from '../../src/services/trips.service';
import { tripInvitesService } from '../../src/services/tripInvites.service';
import { destinationsService, type Destination, type DreamBoardEntry, type DestinationStatus } from '../../src/services/destinations.service';
import { statsService, type TripStatsOverview } from '../../src/services/stats.service';
import { haptics } from '../../src/lib/haptics';
import { logWarn } from '../../src/lib/logger';
import { useToast } from '../../src/components/Toast';
import { DataFreshness } from '../../src/components/DataFreshness';
import { getDreamImage } from '../../src/services/courseImages.service';
import type { TripWithMembers } from '../../src/lib/database.types';
import { TripsEmpty } from '../../src/components/EmptyStates';
import { DemoPeekToggle, DemoBanner } from '../../src/components/DemoPeek';
import { useDemoMode } from '../../src/contexts/DemoModeContext';
import {
  MOCK_TRIP_STATS,
  MOCK_UPCOMING_TRIPS,
  MOCK_COMPLETED_TRIPS,
  MOCK_EXPLORE_DESTINATIONS,
  getDaysUntilTrip,
  type Trip,
  type TripStatus,
  type TripCardMember,
  type ExploreDestination,
} from '../../src/data/trips';

// Dormie-on-brand gradient palettes for real trip cards. All dark, paired well
// with Georgia serif overlay text. Selected deterministically by trip name.
const TRIP_GRADIENT_PALETTES: [string, string][] = [
  ['#0a3d2e', '#1a5d3f'], // Augusta
  ['#2a3d2a', '#1a2d1a'], // Pinehurst
  ['#1a3d3d', '#0a2d2d'], // Cypress
  ['#3d2a1a', '#5d3a2a'], // Sunset
  ['#1a1a3d', '#2a2a5d'], // Twilight
  ['#3d1a3d', '#5d2a5d'], // Royal
];

function deriveGradientColors(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return TRIP_GRADIENT_PALETTES[Math.abs(hash) % TRIP_GRADIENT_PALETTES.length];
}

function startOfLocalDay(d: Date | string): Date {
  // YMD strings ('2026-05-17') must be parsed via fromYMD so they land
  // on the local day. new Date(s) treats date-only ISO strings as UTC
  // midnight, which becomes the previous local day in CDT/CST (any
  // negative-offset zone) — wrong day for isTripLive / currentDay math.
  const dt =
    typeof d === 'string'
      ? fromYMD(d) ?? new Date(d)
      : new Date(d.getTime());
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function isTripLive(t: { start_date: string; end_date: string | null; status: string | null }): boolean {
  if (t.status === 'completed') return false;
  if (!t.start_date) return false;
  const today = startOfLocalDay(new Date());
  const start = startOfLocalDay(t.start_date);
  const end = startOfLocalDay(t.end_date || t.start_date);
  return start.getTime() <= today.getTime() && today.getTime() <= end.getTime();
}

const LIVE_COLOR = '#E07857';

function adaptSupabaseTrip(t: TripWithMembers): Trip {
  const rawMembers = t.trip_members ?? [];
  const playerIds = rawMembers
    .map((m) => m.user_id)
    .filter((id): id is string => !!id);
  const cardMembers: TripCardMember[] = rawMembers.map((m: any) => {
    const isGuest = !m.user_id;
    return {
      id: m.user_id ?? `guest-${m.id}`,
      name: isGuest ? (m.guest_name ?? 'Guest') : (m.user?.name ?? 'Player'),
      photoUrl: m.user?.profile_photo_url ?? null,
      isGuest,
    };
  });
  const city = t.city ?? t.location?.split(',')[0]?.trim() ?? '';
  const state = t.state ?? t.location?.split(',')[1]?.trim() ?? '';
  const gradient: [string, string] =
    Array.isArray(t.gradient) && t.gradient.length >= 2
      ? [t.gradient[0], t.gradient[1]]
      : deriveGradientColors(t.name || t.id);
  return {
    id: t.id,
    name: t.name,
    destination: t.location,
    city,
    state,
    startDate: t.start_date,
    endDate: t.end_date,
    status: (t.status ?? 'upcoming') as TripStatus,
    inviteCode: t.invite_code ?? '',
    isRyderCup: t.trip_type === 'ryder',
    createdBy: t.organizer_id,
    playerIds,
    members: cardMembers,
    roundsPlanned: 1,
    gradient,
    format: t.format ?? undefined,
    sideGames: Array.isArray(t.side_games) ? (t.side_games as string[]) : [],
    stakes: t.stakes,
    competitionStarted: t.status === 'active',
    isLive: isTripLive(t),
  };
}

function isCompletedTrip(t: TripWithMembers): boolean {
  if (t.status === 'completed') return true;
  // Local-timezone YMD comparison — toISOString would shift the day
  // boundary into UTC and bucket today's trips as "completed" after
  // ~7pm local in CDT/CST, causing newly-created trips to disappear
  // from the upcoming section into the Completed grouping.
  return t.end_date < todayYMD();
}

// ─── Search matchers (real vs mock have different shapes) ─────────────
function matchesSearchRaw(t: TripWithMembers, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if ((t.name ?? '').toLowerCase().includes(needle)) return true;
  if ((t.location ?? '').toLowerCase().includes(needle)) return true;
  const members = t.trip_members ?? [];
  return members.some((m: any) => {
    const userName = m.user?.name ?? '';
    const guestName = m.guest_name ?? '';
    return (
      userName.toLowerCase().includes(needle) ||
      guestName.toLowerCase().includes(needle)
    );
  });
}

function matchesSearchLocal(t: Trip, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (t.name.toLowerCase().includes(needle)) return true;
  if (t.destination?.toLowerCase().includes(needle)) return true;
  if (`${t.city}, ${t.state}`.toLowerCase().includes(needle)) return true;
  return (t.members ?? []).some((m) => m.name.toLowerCase().includes(needle));
}

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
function Header({ onPressJoin }: { onPressJoin: () => void }) {
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
          onPress={() => { haptics.light(); onPressJoin(); }}
          style={({ pressed }) => [
            s.headerBtn,
            { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons name="enter-outline" size={15} color="rgba(255,255,255,0.8)" />
          <Text style={[s.headerBtnText, { color: 'rgba(255,255,255,0.8)' }]}>Join</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/create-trip-quick')}
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
type StatsBannerView =
  | { kind: 'real'; totalTrips: number; totalWins: number; tripAvg: number; regularAvg: number; diffStrokes: number }
  | { kind: 'demo'; totalTrips: number; totalWins: number; tripAvg: number; regularAvg: number; diffStrokes: number }
  | { kind: 'empty' }
  | { kind: 'loading' };

function TripStatsBanner({
  view,
  onPress,
}: {
  view: StatsBannerView;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const tappable = !!onPress && (view.kind === 'real' || view.kind === 'demo');

  const cardStyle = [
    s.statsBanner,
    { backgroundColor: `${c.teal}10`, borderColor: c.teal, borderWidth: 1 },
    ...(isDark ? [cardShadowDark] : [cardShadowLight]),
  ];

  const renderInner = () => {
    if (view.kind === 'loading') {
      return (
        <View style={s.statsRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={s.bannerStat}>
              <Skeleton width={42} height={22} />
              <Skeleton width={48} height={9} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      );
    }
    if (view.kind === 'empty') {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <Text style={[s.bannerStatLabel, { color: c.textMuted, fontSize: 12, textAlign: 'center' }]}>
            Play your first trip to see your stats.
          </Text>
        </View>
      );
    }
    const playsSmarter = view.diffStrokes < 0;
    const playsWorse = view.diffStrokes > 0;
    const diffMag = Math.abs(view.diffStrokes);
    return (
      <>
        <View style={s.statsRow}>
          <BannerStat label="TRIPS" value={String(view.totalTrips)} c={c} />
          <BannerStat label="WINS" value={String(view.totalWins)} c={c} />
          <BannerStat label="TRIP AVG" value={view.tripAvg > 0 ? view.tripAvg.toFixed(1) : '—'} c={c} />
          <BannerStat label="REG AVG" value={view.regularAvg > 0 ? view.regularAvg.toFixed(1) : '—'} c={c} />
        </View>
        {playsSmarter && diffMag >= 0.1 && (
          <Text style={[s.callout, { color: c.teal }]}>
            You play {diffMag.toFixed(1)} strokes better on trips
          </Text>
        )}
        {playsWorse && diffMag >= 0.1 && (
          <Text style={[s.callout, { color: c.gold }]}>
            You play {diffMag.toFixed(1)} strokes worse on trips. Pre-trip jitters?
          </Text>
        )}
      </>
    );
  };

  const content = (
    <View style={cardStyle}>
      {view.kind === 'demo' && (
        <View style={s.demoBadge}>
          <Text style={s.demoBadgeText}>DEMO</Text>
        </View>
      )}
      {renderInner()}
      {tappable && (
        <View style={s.statsCardChevron}>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </View>
      )}
    </View>
  );

  if (!tappable) return content;
  return (
    <Pressable
      onPress={() => { haptics.light(); onPress!(); }}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      {content}
    </Pressable>
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

// ─── Status badge config ──────────────────────────────────────────────
const STATUS_BADGE: Record<DestinationStatus, { label: string; color: string }> = {
  saved: { label: 'SAVED', color: '#C9A227' },        // gold
  planning: { label: 'PLANNING', color: '#3FA897' },  // teal
  booked: { label: 'BOOKED', color: '#006747' },      // Augusta green
  played: { label: 'PLAYED', color: '#8A857F' },      // muted
};

const STATUS_OPTIONS: { status: DestinationStatus; subtitle: string }[] = [
  { status: 'saved', subtitle: 'Just dreaming' },
  { status: 'planning', subtitle: "Working on it" },
  { status: 'booked', subtitle: "It's happening" },
  { status: 'played', subtitle: 'Memory in the books' },
];

// ─── Dream board (horizontal, interactive) ────────────────────────────
function DreamBoard({
  entries,
  onLongPress,
  onAddPress,
  onPlanTrip,
}: {
  entries: DreamBoardEntry[];
  onLongPress: (entry: DreamBoardEntry) => void;
  onAddPress: () => void;
  onPlanTrip: (region: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  // Empty state — invite first add
  if (entries.length === 0) {
    return (
      <View>
        <SectionLabel title="DREAM BOARD" />
        <Pressable
          onPress={() => { haptics.light(); onAddPress(); }}
          style={({ pressed }) => [
            s.dreamEmptyCard,
            { backgroundColor: c.cardBg, borderColor: c.gold },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="star-outline" size={28} color={c.gold} />
          <Text style={[s.dreamEmptyTitle, { color: c.text, fontFamily: GEO }]}>
            Your Dream Board is empty
          </Text>
          <Text style={[s.dreamEmptyBody, { color: c.textMuted }]}>
            Save up to 3 destinations you want to play.
          </Text>
          <View style={[s.dreamEmptyCta, { backgroundColor: '#006747' }]}>
            <Ionicons name="add" size={14} color="#C9A227" />
            <Text style={[s.dreamEmptyCtaText, { color: '#C9A227', fontFamily: GEO }]}>
              Add Destination
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  const canAddMore = entries.length < 3;

  return (
    <View>
      <SectionLabel title="DREAM BOARD" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.dreamScroll}
      >
        {entries.map((entry) => {
          const d = entry.destination;
          const badge = STATUS_BADGE[entry.status];
          const isPlayed = entry.status === 'played';
          return (
            <Pressable
              key={entry.id}
              onPress={() => { haptics.light(); onPlanTrip(d.region); }}
              onLongPress={() => { haptics.medium(); onLongPress(entry); }}
              delayLongPress={350}
              style={({ pressed }) => [
                s.dreamCard,
                { borderWidth: 1, borderColor: c.border },
                ...(isDark ? [cardShadowDark] : [cardShadowLight]),
                isPlayed && { opacity: 0.75 },
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <DestinationImage
                name={d.name}
                imageUrl={d.hero_image_url ?? getDreamImage(d.name)}
                gradient={deriveGradientColors(d.name)}
                style={s.dreamGradient}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.7)']}
                  locations={[0, 0.4, 1]}
                  style={s.dreamOverlay}
                />
                <View style={[s.dreamStatusBadge, { borderColor: badge.color }]}>
                  <Text style={[s.dreamStatusBadgeText, { color: badge.color }]}>
                    {badge.label}
                  </Text>
                </View>
                <View style={s.dreamTextWrap}>
                  <Text style={[s.dreamName, { fontFamily: GEO }]}>{d.name}</Text>
                  <Text style={s.dreamLocation}>{d.region}</Text>
                </View>
              </DestinationImage>
              <View style={[s.dreamFooter, { backgroundColor: c.cardBg }]}>
                <Text style={[s.dreamAction, { color: c.teal }]}>Plan Trip →</Text>
              </View>
            </Pressable>
          );
        })}

        {canAddMore && (
          <Pressable
            onPress={() => { haptics.light(); onAddPress(); }}
            style={({ pressed }) => [
              s.dreamAddTile,
              { backgroundColor: c.cardBg, borderColor: c.gold },
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Ionicons name="add" size={28} color={c.gold} />
            <Text style={[s.dreamAddTileText, { color: c.gold, fontFamily: GEO }]}>
              Add Destination
            </Text>
            <Text style={[s.dreamAddTileSubtle, { color: c.textMuted }]}>
              {3 - entries.length} of 3 spots open
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Live trip banner ─────────────────────────────────────────────────
function LiveTripBanner({ trip, onPress }: { trip: TripWithMembers; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Pressable
      onPress={() => { haptics.light(); onPress(); }}
      style={({ pressed }) => [
        s.liveTripBanner,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Animated.View style={[s.livePulseDot, { opacity: pulse, backgroundColor: LIVE_COLOR }]} />
      <Text style={[s.liveTripBannerText, { fontFamily: GEO }]} numberOfLines={1}>
        {trip.name} is happening now
      </Text>
      <Text style={[s.liveTripBannerCta, { fontFamily: GEO }]}>Open →</Text>
    </Pressable>
  );
}

// ─── Add Destination modal ────────────────────────────────────────────
function AddDestinationModal({
  visible,
  catalog,
  takenIds,
  onAdd,
  onClose,
}: {
  visible: boolean;
  catalog: Destination[];
  takenIds: Set<string>;
  onAdd: (destinationId: string) => Promise<void>;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setBusyId(null);
  }, [visible]);

  const available = catalog.filter((d) => !takenIds.has(d.id));
  const spotsOpen = Math.max(0, 3 - takenIds.size);

  const handleAdd = async (destinationId: string) => {
    if (busyId) return;
    haptics.light();
    setBusyId(destinationId);
    try {
      await onAdd(destinationId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[s.addDestRoot, { backgroundColor: c.bg }]}>
        <View style={s.addDestHeader}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
          <Text style={[s.addDestTitle, { color: c.text, fontFamily: GEO }]}>
            Add to Dream Board
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={[s.addDestSubtitle, { color: c.textMuted }]}>
          {spotsOpen} of 3 spots open
        </Text>
        <ScrollView contentContainerStyle={s.addDestList}>
          {catalog.length === 0 ? (
            <View style={[s.addDestEmpty, { borderColor: c.border }]}>
              <Text style={[s.addDestEmptyText, { color: c.textMuted }]}>
                No destinations available yet. Check back soon.
              </Text>
            </View>
          ) : available.length === 0 ? (
            <View style={[s.addDestEmpty, { borderColor: c.border }]}>
              <Text style={[s.addDestEmptyText, { color: c.textMuted }]}>
                You've added every destination. More coming soon.
              </Text>
            </View>
          ) : (
            available.map((d) => {
              const isBusy = busyId === d.id;
              const tier = '$'.repeat(d.price_tier ?? 1);
              return (
                <Pressable
                  key={d.id}
                  onPress={() => handleAdd(d.id)}
                  disabled={!!busyId}
                  style={({ pressed }) => [
                    s.addDestRow,
                    { backgroundColor: c.cardBg, borderColor: c.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={s.addDestThumb}>
                    <DestinationImage
                      name={d.name}
                      imageUrl={d.hero_image_url ?? getDreamImage(d.name)}
                      gradient={deriveGradientColors(d.name)}
                      style={s.addDestThumbImg}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.addDestRowName, { color: c.text, fontFamily: GEO }]}>
                      {d.name}
                    </Text>
                    <Text style={[s.addDestRowMeta, { color: c.textMuted }]}>
                      {d.region} · {d.course_count} course{d.course_count === 1 ? '' : 's'} · {tier || '$'}
                    </Text>
                  </View>
                  {isBusy ? (
                    <ActivityIndicator size="small" color={c.gold} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={22} color={c.gold} />
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Avatar stack ─────────────────────────────────────────────────────
const AVATAR_STACK_SIZE = 26;
const AVATAR_STACK_OVERLAP = 9; // ~35% overlap
const AVATAR_RING_WIDTH = 2;

function AvatarStack({
  members,
  ringColor,
  max,
}: {
  members: TripCardMember[];
  ringColor: string;
  max?: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const limit = max ?? 4;
  const show = members.slice(0, limit);
  const extra = members.length - show.length;
  const wrapSize = AVATAR_STACK_SIZE + AVATAR_RING_WIDTH * 2;

  return (
    <View style={s.avatarStack}>
      {show.map((m, i) => (
        <View
          key={m.id}
          style={[
            s.avatarStackItem,
            {
              width: wrapSize,
              height: wrapSize,
              marginLeft: i > 0 ? -AVATAR_STACK_OVERLAP : 0,
              zIndex: show.length - i,
              borderWidth: AVATAR_RING_WIDTH,
              borderColor: ringColor,
              borderRadius: wrapSize / 2,
              backgroundColor: ringColor,
            },
          ]}
        >
          <Avatar id={m.id} name={m.name} photoUrl={m.photoUrl ?? undefined} size={AVATAR_STACK_SIZE} />
        </View>
      ))}
      {extra > 0 && (
        <View
          style={[
            s.avatarExtra,
            {
              width: wrapSize,
              height: wrapSize,
              marginLeft: -AVATAR_STACK_OVERLAP,
              borderRadius: wrapSize / 2,
              borderWidth: AVATAR_RING_WIDTH,
              borderColor: ringColor,
              backgroundColor: c.elevated,
            },
          ]}
        >
          <Text style={[s.avatarExtraText, { color: c.textMuted, fontFamily: GEO }]}>
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Trip card ────────────────────────────────────────────────────────
function TripCard({
  trip,
  showDays,
  isDemo,
  onLongPress,
}: {
  trip: Trip;
  showDays?: boolean;
  isDemo?: boolean;
  onLongPress?: (trip: Trip) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();
  const daysAway = showDays ? getDaysUntilTrip(trip.startDate) : 0;
  const live = trip.isLive === true;

  // Pulsing dot for live trips
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!live) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [live, pulse]);

  // "Day X of Y" label for multi-day live trips, "LIVE" for single-day
  const liveLabel = useMemo(() => {
    if (!live) return null;
    const start = startOfLocalDay(trip.startDate);
    const end = startOfLocalDay(trip.endDate || trip.startDate);
    const today = startOfLocalDay(new Date());
    const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (totalDays <= 1) return 'LIVE';
    const currentDay = Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `Day ${currentDay} of ${totalDays}`;
  }, [live, trip.startDate, trip.endDate]);

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
      onLongPress={onLongPress ? () => { haptics.medium(); onLongPress(trip); } : undefined}
      delayLongPress={400}
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
      {isDemo && (
        <View style={s.demoBadge}>
          <Text style={s.demoBadgeText}>DEMO</Text>
        </View>
      )}
      <View style={[s.tripCardBody, tripImage && { zIndex: 1 }]}>
        <View style={s.tripCardTop}>
          <View style={s.tripCardTitleRow}>
            <Text style={[s.tripName, { color: tripImage ? '#fff' : c.text }]} numberOfLines={1}>
              {trip.name}
            </Text>
            {!live && isCompetition && (
              <View style={[s.rcBadge, { backgroundColor: `${MASTERS_GREEN}20` }]}>
                <Text style={[s.rcBadgeText, { color: MASTERS_GREEN }]}>LIVE</Text>
              </View>
            )}
            {!live && !isCompetition && trip.isRyderCup && (
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
          <AvatarStack
            members={trip.members ?? trip.playerIds.map((id) => ({ id, name: '' }))}
            ringColor={cardBg}
          />
          {/* Live trips: replace the countdown ring with a Day X of Y / LIVE pill */}
          {live ? (
            <View
              style={[
                s.liveDayPill,
                {
                  backgroundColor: tripImage ? 'rgba(0,0,0,0.55)' : c.elevated,
                  borderColor: LIVE_COLOR,
                },
              ]}
            >
              <Animated.View
                style={[s.livePulseDot, { opacity: pulse, backgroundColor: LIVE_COLOR }]}
              />
              <Text style={[s.liveDayPillText, { color: LIVE_COLOR, fontFamily: GEO }]}>
                {liveLabel}
              </Text>
            </View>
          ) : showDays ? (
            <TripCountdownRing
              daysUntil={daysAway}
              totalDays={60}
              size={50}
              strokeWidth={3}
              accentColor={trip.isRyderCup ? c.urgent : isCompetition ? MASTERS_GREEN : c.teal}
              textColor={tripImage ? '#FFFFFF' : undefined}
            />
          ) : null}
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

// ─── Explore CTA (intent-capture form entry point) ────────────────────
function ExploreCta({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={() => { haptics.light(); onPress(); }}
      style={({ pressed }) => [
        s.exploreCta,
        { backgroundColor: c.cardBg, borderColor: c.gold },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.exploreCtaTitle, { color: c.text, fontFamily: GEO }]}>
          Explore your next dream trip
        </Text>
        <Text style={[s.exploreCtaBody, { color: c.textMuted }]}>
          Tell us about your dream trip. We're building a trip planner that produces what matters most to golfers.
        </Text>
      </View>
      <View style={s.exploreCtaBtn}>
        <Text style={[s.exploreCtaBtnText, { color: '#C9A227', fontFamily: GEO }]}>Start</Text>
        <Ionicons name="arrow-forward" size={14} color="#C9A227" />
      </View>
    </Pressable>
  );
}

// ─── Explore row (horizontal) ─────────────────────────────────────────
function ExploreRow({
  destinations,
  title,
  onCardPress,
}: {
  destinations: ExploreDestination[];
  title?: string;
  onCardPress: (destination: ExploreDestination) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  return (
    <View>
      <SectionLabel title={title ?? 'EXPLORE'} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.exploreScroll}
      >
        {destinations.map((d) => (
          <Pressable
            key={d.id}
            onPress={() => { haptics.light(); onCardPress(d); }}
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
  const [dreamEntries, setDreamEntries] = useState<DreamBoardEntry[]>([]);
  const [destinationCatalog, setDestinationCatalog] = useState<Destination[]>([]);
  const { isDemoMode: showDemoData, setDemoMode: setShowDemoData, checkAndDisable } = useDemoMode();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const { showToast } = useToast();
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [addDestVisible, setAddDestVisible] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [statsOverview, setStatsOverview] = useState<TripStatsOverview | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Debounce text input → search query so filter logic doesn't re-run on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const upcomingRealTrips = useMemo(() => {
    const filtered = realTrips.filter((t) => !isCompletedTrip(t));
    // Sort live trips to the top, then ascending by start_date
    return filtered.sort((a, b) => {
      const aLive = isTripLive(a);
      const bLive = isTripLive(b);
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
    });
  }, [realTrips]);
  const completedRealTrips = useMemo(
    () => realTrips.filter((t) => isCompletedTrip(t)),
    [realTrips],
  );
  // Trips currently in progress, most recently started first.
  const liveTrips = useMemo(
    () =>
      realTrips
        .filter(isTripLive)
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()),
    [realTrips],
  );

  // Filtered views — chip filter can collapse a section to empty; search query
  // matches across name/location/member names case-insensitively.
  const filteredUpcomingReal = useMemo(() => {
    if (activeFilter === 'completed') return [];
    let arr = upcomingRealTrips;
    if (activeFilter === 'live') arr = arr.filter(isTripLive);
    else if (activeFilter === 'upcoming') arr = arr.filter((t) => !isTripLive(t));
    return arr.filter((t) => matchesSearchRaw(t, searchQuery));
  }, [upcomingRealTrips, activeFilter, searchQuery]);
  const filteredCompletedReal = useMemo(() => {
    if (activeFilter === 'live' || activeFilter === 'upcoming') return [];
    return completedRealTrips.filter((t) => matchesSearchRaw(t, searchQuery));
  }, [completedRealTrips, activeFilter, searchQuery]);
  const filteredUpcomingMock = useMemo(() => {
    if (!showDemoData) return [];
    if (activeFilter === 'completed') return [];
    let arr = MOCK_UPCOMING_TRIPS;
    if (activeFilter === 'live') arr = arr.filter((t) => t.isLive === true);
    // No additional split for 'upcoming' on mocks — none of them are live by date.
    return arr.filter((t) => matchesSearchLocal(t, searchQuery));
  }, [showDemoData, activeFilter, searchQuery]);
  const filteredCompletedMock = useMemo(() => {
    if (!showDemoData) return [];
    if (activeFilter === 'live' || activeFilter === 'upcoming') return [];
    return MOCK_COMPLETED_TRIPS.filter((t) => matchesSearchLocal(t, searchQuery));
  }, [showDemoData, activeFilter, searchQuery]);

  const filterIsActive = activeFilter !== 'all' || searchQuery.trim().length > 0;
  const totalFilteredCount =
    filteredUpcomingReal.length +
    filteredCompletedReal.length +
    filteredUpcomingMock.length +
    filteredCompletedMock.length;
  const noFilteredResults = filterIsActive && totalFilteredCount === 0;

  // Stash checkAndDisable in a ref so the fetch effect doesn't re-fire when
  // its identity changes (which it does whenever the auth user ref or the
  // autoDisabledOnce flag changes — Supabase re-emits user objects on token
  // refresh / focus events, which used to cascade into a runaway fetch loop).
  const checkAndDisableRef = useRef(checkAndDisable);
  useEffect(() => {
    checkAndDisableRef.current = checkAndDisable;
  }, [checkAndDisable]);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setTripsLoading(false);
      setStatsLoading(false);
      return;
    }
    setTripsLoading(true);
    setStatsLoading(true);
    tripsService.getByUser(userId)
      .then((trips) => {
        setRealTrips(trips);
        if (trips.length > 0) checkAndDisableRef.current();
      })
      .catch((err) => console.warn('[Dormie] trips fetch failed:', err))
      .finally(() => setTripsLoading(false));
    destinationsService.getDreamBoard(userId)
      .then(setDreamEntries)
      .catch((err) => console.warn('[Dormie] DreamBoard fetch failed:', err));
    destinationsService.listAll()
      .then(setDestinationCatalog)
      .catch((err) => console.warn('[Dormie] destinations catalog fetch failed:', err));
    statsService.getOverview(userId)
      .then(setStatsOverview)
      .catch(() => setStatsOverview(null))
      .finally(() => setStatsLoading(false));
  }, [userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (userId) {
        const [trips, dream, catalog, overview] = await Promise.all([
          tripsService.getByUser(userId),
          destinationsService.getDreamBoard(userId),
          destinationsService.listAll(),
          statsService.getOverview(userId).catch((e) => { logWarn('Trips: stats overview fetch failed', e); return null; }),
        ]);
        setRealTrips(trips);
        setDreamEntries(dream);
        setDestinationCatalog(catalog);
        setStatsOverview(overview);
        if (trips.length > 0) checkAndDisableRef.current();
      }
      setLastRefreshed(new Date());
      showToast({ message: 'Trips updated', type: 'success' });
    } catch (e) {
      logWarn('Trips: refresh failed', e);
      showToast({ message: "Couldn't refresh trips", type: 'error' });
    }
    setRefreshing(false);
  }, [userId, showToast]);

  const refreshDreamBoard = useCallback(async () => {
    if (!user) return;
    try {
      const dream = await destinationsService.getDreamBoard(user.id);
      setDreamEntries(dream);
    } catch (e) {
      logWarn('Trips: dream board refresh failed', e);
    }
  }, [user]);

  const handleAddDestination = useCallback(async (destinationId: string) => {
    if (!user) return;
    try {
      await destinationsService.addToDreamBoard(user.id, destinationId);
      await refreshDreamBoard();
      setAddDestVisible(false);
      haptics.success();
      showToast({ message: 'Added to Dream Board', type: 'success' });
    } catch (err: any) {
      haptics.error();
      const raw = (err?.message ?? '').toString();
      const msg = /limit reached|cap/i.test(raw)
        ? 'Dream Board is full. Remove one to add another.'
        : raw || "Couldn't add destination";
      showToast({ message: msg, type: 'error' });
    }
  }, [user, showToast, refreshDreamBoard]);

  const promptStatus = useCallback((entry: DreamBoardEntry) => {
    Alert.alert(
      'Update status',
      entry.destination.name,
      [
        ...STATUS_OPTIONS.map((opt) => ({
          text: `${STATUS_BADGE[opt.status].label} — ${opt.subtitle}`,
          onPress: async () => {
            if (entry.status === opt.status) return;
            try {
              await destinationsService.updateStatus(entry.id, opt.status);
              haptics.success();
              showToast({ message: 'Status updated', type: 'success' });
              await refreshDreamBoard();
            } catch (err: any) {
              haptics.error();
              showToast({ message: err?.message ?? "Couldn't update status", type: 'error' });
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }, [refreshDreamBoard, showToast]);

  const handleLongPressEntry = useCallback((entry: DreamBoardEntry) => {
    Alert.alert(
      entry.destination.name,
      entry.destination.region,
      [
        { text: 'Update Status', onPress: () => promptStatus(entry) },
        {
          text: 'Remove from Dream Board',
          style: 'destructive',
          onPress: async () => {
            try {
              await destinationsService.removeFromDreamBoard(entry.id);
              haptics.success();
              showToast({ message: 'Removed from Dream Board', type: 'success' });
              await refreshDreamBoard();
            } catch (err: any) {
              haptics.error();
              showToast({ message: err?.message ?? "Couldn't remove", type: 'error' });
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [promptStatus, refreshDreamBoard, showToast]);

  const handlePlanTrip = useCallback((region: string) => {
    haptics.light();
    router.push({ pathname: '/create-trip-quick', params: { location: region } });
  }, [router]);

  const handleExploreTilePress = useCallback((dest: ExploreDestination) => {
    // Option A: tap-to-add-to-Dream-Board. Resolve the mock tile name to a
    // catalog destination by case-insensitive name match. If found, add it
    // directly. If not (or if catalog hasn't loaded yet), fall back to the
    // generic Add Destination picker.
    const match = destinationCatalog.find(
      (d) => d.name.toLowerCase() === dest.name.toLowerCase(),
    );
    if (match) {
      handleAddDestination(match.id);
    } else {
      setAddDestVisible(true);
    }
  }, [destinationCatalog, handleAddDestination]);

  const handleExploreCtaPress = useCallback(() => {
    router.push('/explore-dream-trip');
  }, [router]);

  const handleDuplicateTrip = useCallback((trip: Trip) => {
    haptics.light();
    router.push({
      pathname: '/create-trip',
      params: {
        duplicateFromName: `${trip.name} (Copy)`,
        duplicateFromFormat: trip.format ?? '',
        duplicateFromSideGames: JSON.stringify(trip.sideGames ?? []),
        duplicateFromStakes: trip.stakes ?? '',
      },
    });
  }, [router]);

  const handleDeleteTrip = useCallback((trip: Trip) => {
    Alert.alert(
      'Delete this trip?',
      "This can't be undone. The trip and all its members will be removed.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await tripsService.delete(trip.id);
              haptics.success();
              showToast({ message: 'Trip deleted', type: 'success' });
              if (user) {
                const updated = await tripsService.getByUser(user.id);
                setRealTrips(updated);
              }
            } catch (err: any) {
              haptics.error();
              showToast({ message: err?.message || "Couldn't delete trip", type: 'error' });
            }
          },
        },
      ],
    );
  }, [showToast, user]);

  const handleShareInvite = useCallback((trip: Trip) => {
    if (!trip.inviteCode) {
      showToast({ message: "This trip has no invite code yet", type: 'error' });
      return;
    }
    haptics.light();
    Clipboard.setString(trip.inviteCode);
    showToast({
      message: `Invite code copied: ${trip.inviteCode}`,
      type: 'success',
      icon: 'copy-outline',
    });
  }, [showToast]);

  const handleTripLongPress = useCallback((trip: Trip) => {
    const isOrganizer = !!user?.id && user.id === trip.createdBy;
    const buttons: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [
      {
        text: 'Open Trip',
        onPress: () => router.push({ pathname: '/trip-detail', params: { tripId: trip.id } }),
      },
      {
        text: 'Share Invite',
        onPress: () => handleShareInvite(trip),
      },
    ];
    if (isOrganizer) {
      buttons.push({ text: 'Duplicate Trip', onPress: () => handleDuplicateTrip(trip) });
      buttons.push({ text: 'Delete Trip', style: 'destructive', onPress: () => handleDeleteTrip(trip) });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(trip.name, undefined, buttons);
  }, [user, router, handleShareInvite, handleDuplicateTrip, handleDeleteTrip]);

  const handleDemoLongPress = useCallback(() => {
    showToast({ message: "Demo trips can't be modified", type: 'info' });
  }, [showToast]);

  const dreamTakenIds = useMemo(
    () => new Set(dreamEntries.map((e) => e.destination_id)),
    [dreamEntries],
  );

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
        <Header onPressJoin={() => setJoinModalVisible(true)} />

        {liveTrips.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            <LiveTripBanner
              trip={liveTrips[0]}
              onPress={() => router.push({ pathname: '/trip-detail', params: { tripId: liveTrips[0].id } })}
            />
          </View>
        )}

        <View style={s.body}>
          {/* First-mount skeleton placeholder — until we know if user has trips */}
          {tripsLoading && realTrips.length === 0 ? (
            <View style={{ marginTop: 16 }}>
              <SectionLabel title="UPCOMING" />
              {[0, 1].map((i) => (
                <View key={i} style={[s.tripCard, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1, borderLeftWidth: 3, borderLeftColor: c.teal, padding: 16 }]}>
                  <Skeleton width="60%" height={18} />
                  <Skeleton width="45%" height={12} style={{ marginTop: 8 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                    <Skeleton width={120} height={32} />
                    <Skeleton width={50} height={50} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* Demo peek toggle — for empty state */}
          {!tripsLoading && realTrips.length === 0 && (
            <DemoPeekToggle
              isActive={showDemoData}
              onToggle={() => setShowDemoData(!showDemoData)}
            />
          )}
          {!tripsLoading && showDemoData && realTrips.length === 0 && <DemoBanner />}

          {/* Smart empty state for new users — with destinations still visible */}
          {!tripsLoading && realTrips.length === 0 && !showDemoData && (
            <TripsEmpty />
          )}

          {/* Trip stats — real when available, demo with badge when only demo,
              empty-copy when neither. Tappable in real/demo modes. */}
          {(() => {
            if (tripsLoading || statsLoading) {
              return <TripStatsBanner view={{ kind: 'loading' }} />;
            }
            const hasReal = !!statsOverview && statsOverview.hasData;
            if (hasReal && statsOverview) {
              const view: StatsBannerView = {
                kind: 'real',
                totalTrips: statsOverview.totalTrips,
                totalWins: statsOverview.totalWins,
                tripAvg: statsOverview.tripAvg,
                regularAvg: statsOverview.regularAvg,
                diffStrokes: statsOverview.diffStrokes,
              };
              return (
                <TripStatsBanner
                  view={view}
                  onPress={() => router.push('/stats-drill-in')}
                />
              );
            }
            if (showDemoData) {
              const view: StatsBannerView = {
                kind: 'demo',
                totalTrips: MOCK_TRIP_STATS.totalTrips,
                totalWins: MOCK_TRIP_STATS.wins,
                tripAvg: MOCK_TRIP_STATS.tripAvg,
                regularAvg: MOCK_TRIP_STATS.regularAvg,
                diffStrokes: MOCK_TRIP_STATS.tripAvg - MOCK_TRIP_STATS.regularAvg,
              };
              return (
                <TripStatsBanner
                  view={view}
                  onPress={() => router.push('/stats-drill-in')}
                />
              );
            }
            // No real data, demo off — show empty-state copy on the card itself.
            // Only render when the user has at least some trips on the books;
            // otherwise the section is hidden entirely (TripsEmpty covers it).
            if (realTrips.length > 0) {
              return <TripStatsBanner view={{ kind: 'empty' }} />;
            }
            return null;
          })()}

          {/* Gold divider after stats */}
          {(realTrips.length > 0 || showDemoData) && <GoldDivider style={{ marginTop: 24 }} />}

          {/* Dream board — user's saved destinations from Supabase, capped at 3 */}
          <DreamBoard
            entries={dreamEntries}
            onLongPress={handleLongPressEntry}
            onAddPress={() => setAddDestVisible(true)}
            onPlanTrip={handlePlanTrip}
          />

          {/* Search + filter chips. Always interactive so empty-state users can still explore. */}
          <GoldDivider style={{ marginTop: 24 }} />
          <View style={[s.searchBar, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <Ionicons name="search-outline" size={16} color={c.textMuted} />
            <TextInput
              style={[s.searchInput, { color: c.text }]}
              placeholder="Search trips by name, location, or member"
              placeholderTextColor={c.textMuted}
              value={searchInput}
              onChangeText={setSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchInput.length > 0 && (
              <Pressable onPress={() => setSearchInput('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={c.textMuted} />
              </Pressable>
            )}
          </View>
          <View style={s.filterRow}>
            {(['all', 'live', 'upcoming', 'completed'] as const).map((f) => {
              const active = activeFilter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => {
                    haptics.light();
                    setActiveFilter(f);
                  }}
                  style={({ pressed }) => [
                    s.filterChip,
                    {
                      backgroundColor: active ? '#006747' : c.cardBg,
                      borderColor: active ? '#006747' : c.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.filterChipText,
                      {
                        color: active ? '#C9A227' : c.textMuted,
                        fontFamily: GEO,
                      },
                    ]}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Empty state — search/filter combo yields nothing */}
          {noFilteredResults && (
            <View style={[s.searchEmpty, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Ionicons name="search" size={32} color={c.textMuted} />
              <Text style={[s.searchEmptyTitle, { color: c.text, fontFamily: GEO }]}>
                No trips match your search
              </Text>
              <Text style={[s.searchEmptyBody, { color: c.textMuted }]}>
                Try different terms or clear the filter.
              </Text>
              <Pressable
                onPress={() => { haptics.light(); setSearchInput(''); setActiveFilter('all'); }}
                style={({ pressed }) => [
                  s.searchEmptyCta,
                  { backgroundColor: '#006747', opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[s.searchEmptyCtaText, { color: '#C9A227', fontFamily: GEO }]}>
                  Clear filters
                </Text>
              </Pressable>
            </View>
          )}

          {/* Upcoming — real trips first, then demo mocks below (with DEMO badge) when demo mode is on */}
          {(filteredUpcomingReal.length > 0 || filteredUpcomingMock.length > 0) && (
            <>
              <GoldDivider style={{ marginTop: 24 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <SectionLabel title="UPCOMING" />
                <DataFreshness updatedAt={lastRefreshed} />
              </View>
              {filteredUpcomingReal.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={adaptSupabaseTrip(trip)}
                  showDays
                  onLongPress={handleTripLongPress}
                />
              ))}
              {filteredUpcomingMock.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  showDays
                  isDemo
                  onLongPress={handleDemoLongPress}
                />
              ))}
            </>
          )}

          {/* Completed — real trips first, then demo mocks below (with DEMO badge) when demo mode is on */}
          {(filteredCompletedReal.length > 0 || filteredCompletedMock.length > 0) && (
            <>
              <GoldDivider style={{ marginTop: 24 }} />
              <SectionLabel title="COMPLETED" />
              {filteredCompletedReal.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={adaptSupabaseTrip(trip)}
                  onLongPress={handleTripLongPress}
                />
              ))}
              {filteredCompletedMock.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  isDemo
                  onLongPress={handleDemoLongPress}
                />
              ))}
            </>
          )}

          {/* Explore — intent-capture CTA on top, popular tiles below */}
          {(realTrips.length > 0 || showDemoData) && (
            <>
              <GoldDivider style={{ marginTop: 24 }} />
              <SectionLabel title="EXPLORE" />
              <ExploreCta onPress={handleExploreCtaPress} />
              <ExploreRow
                destinations={MOCK_EXPLORE_DESTINATIONS}
                title="POPULAR WITH DORMIE GOLFERS"
                onCardPress={handleExploreTilePress}
              />
            </>
          )}
        </View>

        <View style={{ height: 32 + insets.bottom }} />
      </ScrollView>

      <AddDestinationModal
        visible={addDestVisible}
        catalog={destinationCatalog}
        takenIds={dreamTakenIds}
        onAdd={handleAddDestination}
        onClose={() => setAddDestVisible(false)}
      />

      <JoinTripModal
        visible={joinModalVisible}
        onClose={() => setJoinModalVisible(false)}
        onJoined={(tripId) => {
          setJoinModalVisible(false);
          if (user) checkAndDisable();
          router.push({ pathname: '/trip-detail', params: { tripId } });
        }}
      />
    </View>
  );
}

// ─── Join Trip modal ──────────────────────────────────────────────────
function JoinTripModal({
  visible,
  onClose,
  onJoined,
}: {
  visible: boolean;
  onClose: () => void;
  onJoined: (tripId: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCode('');
      setIsJoining(false);
    }
  }, [visible]);

  // Format input as user types: uppercase, alphanumeric only, auto-hyphen after pos 4.
  // Caps at 8 alphanumeric chars (9 visible with hyphen) — covers the permanent
  // XXXX-XXXX format. 6-char expiring codes display as "ABCD-EF" but normalize
  // back to 6 chars on submit.
  const formatCodeInput = (text: string): string => {
    const valid = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    if (valid.length <= 4) return valid;
    return `${valid.slice(0, 4)}-${valid.slice(4, 8)}`;
  };

  // Strip the formatting to get just the alphanumeric code for routing.
  const stripped = code.replace(/-/g, '').toUpperCase();
  const canSubmit = (stripped.length === 6 || stripped.length === 8) && !isJoining;

  const handleJoin = async () => {
    if (!canSubmit) return;
    haptics.light();
    setIsJoining(true);
    try {
      let tripId: string;
      if (stripped.length === 8) {
        // Permanent invite code from trips.invite_code (XXXX-XXXX)
        const formatted = `${stripped.slice(0, 4)}-${stripped.slice(4, 8)}`;
        tripId = await tripsService.joinByCode(formatted);
      } else {
        // 6-char expiring share link from trip_invites.code
        tripId = await tripInvitesService.joinByInvite(stripped);
      }
      haptics.success();
      showToast({ message: 'Joined trip', type: 'success' });
      onJoined(tripId);
    } catch (err: any) {
      haptics.error();
      const raw = (err?.message ?? '').toString();
      const msg = /not found|invalid|no trip|expired/i.test(raw)
        ? 'Invalid or expired code'
        : raw || 'Could not join trip';
      showToast({ message: msg, type: 'error' });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[s.joinModalRoot, { backgroundColor: c.bg }]}
      >
        <View style={s.joinModalHeader}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
          <Text style={[s.joinModalTitle, { color: c.text, fontFamily: GEO }]}>Join a Trip</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={s.joinModalBody}>
          <Text style={[s.joinModalSubtitle, { color: c.textMuted }]}>
            Enter the trip code (e.g. ABCD-1234)
          </Text>

          <TextInput
            value={code}
            onChangeText={(text) => setCode(formatCodeInput(text))}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={9}
            placeholder="XXXX-XXXX"
            placeholderTextColor={c.textMuted}
            style={[
              s.joinCodeInput,
              {
                color: c.gold,
                backgroundColor: c.cardBg,
                borderColor: c.border,
                fontFamily: GEO,
              },
            ]}
          />

          <Pressable
            onPress={handleJoin}
            disabled={!canSubmit}
            style={({ pressed }) => [
              s.joinSubmitBtn,
              {
                backgroundColor: canSubmit ? '#006747' : c.elevated,
                opacity: pressed && canSubmit ? 0.85 : 1,
              },
            ]}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={18} color={canSubmit ? '#fff' : c.textMuted} />
                <Text style={[s.joinSubmitText, { color: canSubmit ? '#fff' : c.textMuted, fontFamily: GEO }]}>
                  Join Trip
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    gap: 6,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 0,
  },

  /* Join Trip modal */
  joinModalRoot: {
    flex: 1,
  },
  joinModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  joinModalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  joinModalBody: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  joinModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  joinCodeInput: {
    fontSize: 28,
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  joinSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  joinSubmitText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
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
  statsCardChevron: {
    position: 'absolute',
    bottom: 12,
    right: 12,
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
  dreamStatusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    zIndex: 2,
  },
  dreamStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  dreamAddTile: {
    width: 160,
    height: 142,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  dreamAddTileText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dreamAddTileSubtle: {
    fontSize: 10,
    textAlign: 'center',
  },
  dreamEmptyCard: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dreamEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  dreamEmptyBody: {
    fontSize: 12,
    textAlign: 'center',
  },
  dreamEmptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  dreamEmptyCtaText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* Add Destination modal */
  addDestRoot: {
    flex: 1,
  },
  addDestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  addDestTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  addDestSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  addDestList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  addDestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  addDestThumb: {
    width: 56,
    height: 56,
    overflow: 'hidden',
  },
  addDestThumbImg: {
    width: 56,
    height: 56,
  },
  addDestRowName: {
    fontSize: 14,
    fontWeight: '700',
  },
  addDestRowMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  addDestEmpty: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  addDestEmptyText: {
    fontSize: 13,
    textAlign: 'center',
  },

  /* Search bar + filter chips */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    marginTop: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  searchEmpty: {
    marginTop: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  searchEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  searchEmptyBody: {
    fontSize: 13,
    textAlign: 'center',
  },
  searchEmptyCta: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchEmptyCtaText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* Live state — trip card pill + pulse dot */
  liveDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveDayPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  /* Live trip banner — sits between Header and body */
  liveTripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#1A1816',
    borderWidth: 1,
    borderColor: '#E07857',
  },
  liveTripBannerText: {
    flex: 1,
    color: '#E8E4DE',
    fontSize: 13,
    fontWeight: '700',
  },
  liveTripBannerCta: {
    color: '#E07857',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* Avatar stack */
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStackItem: {
    overflow: 'hidden',
  },
  avatarExtra: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarExtraText: {
    fontSize: 10,
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
  demoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: '#C9A227',
    zIndex: 2,
  },
  demoBadgeText: {
    color: '#C9A227',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
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
  /* Explore intent-capture CTA */
  exploreCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  exploreCtaTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  exploreCtaBody: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  exploreCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#006747',
  },
  exploreCtaBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

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
