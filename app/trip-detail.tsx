import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
  Easing,
  Alert,
  Clipboard,
  Modal,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import { CourseImage } from '../src/components/CourseImage';
import GoldDivider from '../src/components/GoldDivider';
import { TripCountdownRing } from '../src/components/TripCountdownRing';
import { PulsingDot } from '../src/components/PulsingDot';
const RyderCupHub = lazy(() => import('../src/components/RyderCupHub').then(m => ({ default: m.RyderCupHub })));
import { getDaysUntilTrip, MOCK_UPCOMING_TRIPS, type Trip, type TripStatus } from '../src/data/trips';
import { useAuth } from '../src/lib/auth';
import { haptics } from '../src/lib/haptics';
import { sounds } from '../src/lib/sounds';
import { useToast } from '../src/components/Toast';
import { messagesService } from '../src/services/messages.service';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { tripsService } from '../src/services/trips.service';
import { momentsService } from '../src/services/moments.service';
import type { TripMessageWithUser, TripMomentWithUser } from '../src/lib/database.types';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Mock data for trip detail ─────────────────────────────────────────
type TripPlayer = {
  id: string;
  name: string;
  handicap: number;
  rsvp: 'confirmed' | 'pending' | 'declined';
  roundsPlayed?: number;
  tripAvg?: number;
};

const MOCK_PLAYERS: TripPlayer[] = [
  { id: '1', name: 'Ian McGowan', handicap: 8, rsvp: 'confirmed', roundsPlayed: 6, tripAvg: 76.2 },
  { id: '2', name: 'Drew Patterson', handicap: 12, rsvp: 'confirmed', roundsPlayed: 5, tripAvg: 81.4 },
  { id: '4', name: 'Jake Sullivan', handicap: 15, rsvp: 'confirmed', roundsPlayed: 4, tripAvg: 84.7 },
  { id: '6', name: 'Tommy Fleetwood', handicap: 3, rsvp: 'pending', roundsPlayed: 7, tripAvg: 71.3 },
];

type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  time: string;
  reactions: { emoji: string; count: number; reacted: boolean }[];
};

const MOCK_CHAT: ChatMessage[] = [
  {
    id: 'm1',
    userId: '2',
    userName: 'Drew Patterson',
    text: "Who's booking the tee times? I can do it if needed.",
    time: '2:30 PM',
    reactions: [{ emoji: '👍', count: 2, reacted: true }],
  },
  {
    id: 'm2',
    userId: '1',
    userName: 'Ian McGowan',
    text: "I already booked TPC Scottsdale for Thursday morning. 8:24 AM shotgun start.",
    time: '2:45 PM',
    reactions: [{ emoji: '🔥', count: 3, reacted: false }],
  },
  {
    id: 'm3',
    userId: '4',
    userName: 'Jake Sullivan',
    text: "Perfect. Should we do a practice round Wednesday afternoon?",
    time: '3:01 PM',
    reactions: [],
  },
  {
    id: 'm4',
    userId: '6',
    userName: 'Tommy Fleetwood',
    text: "I'm in for the practice round. Let me know the course.",
    time: '3:15 PM',
    reactions: [{ emoji: '⛳', count: 1, reacted: false }],
  },
  {
    id: 'm5',
    userId: '1',
    userName: 'Ian McGowan',
    text: "Let's play We-Ko-Pa Saguaro on Wednesday. I've heard it's incredible.",
    time: '3:22 PM',
    reactions: [
      { emoji: '🔥', count: 2, reacted: true },
      { emoji: '⛳', count: 1, reacted: false },
    ],
  },
  {
    id: 'm6',
    userId: '2',
    userName: 'Drew Patterson',
    text: "Sounds like a plan. Everyone bring sunscreen — it's supposed to be 95° 😅",
    time: '4:10 PM',
    reactions: [{ emoji: '😂', count: 3, reacted: true }],
  },
];

type TripCourse = {
  id: string;
  name: string;
  day: number;
  teeTime: string;
  rating: number;
  slope: number;
  par: number;
  yards: number;
  gradient: [string, string];
  votes: number;
  voted: boolean;
};

const MOCK_COURSES: TripCourse[] = [
  {
    id: 'tc1',
    name: 'TPC Scottsdale — Stadium',
    day: 1,
    teeTime: '8:24 AM',
    rating: 73.8,
    slope: 139,
    par: 71,
    yards: 7261,
    gradient: ['#8B6B3A', '#C4994A'],
    votes: 4,
    voted: true,
  },
  {
    id: 'tc2',
    name: 'We-Ko-Pa Saguaro',
    day: 2,
    teeTime: '7:48 AM',
    rating: 74.1,
    slope: 143,
    par: 72,
    yards: 7225,
    gradient: ['#5A3D2A', '#8B6B4A'],
    votes: 3,
    voted: true,
  },
  {
    id: 'tc3',
    name: 'Grayhawk Raptor',
    day: 3,
    teeTime: '8:00 AM',
    rating: 72.5,
    slope: 135,
    par: 72,
    yards: 7108,
    gradient: ['#3A5A3A', '#6B8F6B'],
    votes: 2,
    voted: false,
  },
];

type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

const MOCK_CHECKLIST: ChecklistItem[] = [
  { id: 'cl1', text: 'Book flights', done: true },
  { id: 'cl2', text: 'Reserve hotel rooms', done: true },
  { id: 'cl3', text: 'Book tee times', done: true },
  { id: 'cl4', text: 'Rent clubs or ship bags', done: false },
  { id: 'cl5', text: 'Set up scoring formats', done: false },
  { id: 'cl6', text: 'Confirm dinner reservations', done: false },
  { id: 'cl7', text: 'Buy prizes / trophies', done: false },
  { id: 'cl8', text: 'Share invite code with group', done: true },
];

type H2HRecord = {
  opponentId: string;
  opponentName: string;
  wins: number;
  losses: number;
  ties: number;
};

const MOCK_H2H: H2HRecord[] = [
  { opponentId: '2', opponentName: 'Drew Patterson', wins: 4, losses: 2, ties: 1 },
  { opponentId: '4', opponentName: 'Jake Sullivan', wins: 5, losses: 1, ties: 0 },
  { opponentId: '6', opponentName: 'Tommy Fleetwood', wins: 1, losses: 5, ties: 1 },
];

type TripMoment = {
  id: string;
  text: string;
  author: string;
  time: string;
};

const MOCK_MOMENTS: TripMoment[] = [
  { id: 'tm1', text: 'Jake hit a hole-in-one on #16! 🎉', author: 'Ian McGowan', time: '2 days ago' },
  { id: 'tm2', text: "Drew's bunker shot went backwards into the water", author: 'Jake Sullivan', time: '3 days ago' },
  { id: 'tm3', text: 'Tommy shot 68 and bought the whole bar dinner', author: 'Drew Patterson', time: '5 days ago' },
];

type TripTool = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

const TRIP_TOOLS: TripTool[] = [
  { id: 'tt1', label: 'Budget', icon: 'cash-outline', color: '#006747' },
  { id: 'tt2', label: 'Packing List', icon: 'bag-outline', color: '#C9A227' },
  { id: 'tt3', label: 'Tee Groups', icon: 'people-outline', color: '#5B7FA5' },
  { id: 'tt4', label: 'RSVP Preview', icon: 'mail-outline', color: '#8B6DAF' },
  { id: 'tt5', label: 'Trip Awards', icon: 'trophy-outline', color: '#C47B3B' },
  { id: 'tt6', label: 'Weather', icon: 'partly-sunny-outline', color: '#4A9B8E' },
];

const SIDE_GAME_PILLS = ['Skins', 'Nassau', 'Dots', 'Snake'];

const TABS = ['Clubhouse', 'Courses', 'Players', 'Checklist', '19th Hole'] as const;
type Tab = (typeof TABS)[number];

const EMOJI_OPTIONS = ['👍', '🔥', '⛳', '😂', '💪', '🏆'];

function formatInviteCode(trip: typeof MOCK_UPCOMING_TRIPS[0]): string {
  const prefix = trip.city.slice(0, 3).toUpperCase();
  const year = trip.startDate.slice(0, 4);
  return `DORMIE-${prefix}-${year}`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Pinstripes texture ─────────────────────────────────────────────────
function Pinstripes() {
  const lines = Array.from({ length: 40 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: -200,
            left: i * 18 - 100,
            width: 1,
            height: 800,
            backgroundColor: '#fff',
            opacity: 0.03,
            transform: [{ rotate: '35deg' }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Section label ──────────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[s.sectionLabel, { color: theme.colors.gold, fontFamily: GEO }]}>
      {title}
    </Text>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CLUBHOUSE TAB
// ═══════════════════════════════════════════════════════════════════════
function ClubhouseTab({
  trip,
  checklist,
  onToggleCheck,
  onToolPress,
  realMoments,
  onAddMoment,
}: {
  trip: typeof MOCK_UPCOMING_TRIPS[0];
  checklist: ChecklistItem[];
  onToggleCheck: (id: string) => void;
  onToolPress: (toolId: string) => void;
  realMoments: TripMomentWithUser[];
  onAddMoment: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const checkDone = checklist.filter((cl) => cl.done).length;
  const checkTotal = checklist.length;
  const checkProgress = checkDone / checkTotal;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {/* LATEST — chat preview */}
      <View style={s.sectionWithFreshness}>
        <SectionLabel title="LATEST" />
        <View style={s.freshnessBar}>
          <PulsingDot color={c.teal} size={6} />
          <Text style={[s.freshnessText, { color: c.teal }]}>Live</Text>
        </View>
      </View>
      {MOCK_CHAT.slice(-3).map((msg) => (
        <View key={msg.id} style={[s.chatPreviewRow, { borderColor: c.border }]}>
          <Avatar id={msg.userId} size={28} name={msg.userName} />
          <View style={{ flex: 1 }}>
            <Text style={[s.chatPreviewName, { color: c.text }]}>{msg.userName}</Text>
            <Text style={[s.chatPreviewText, { color: c.textMuted }]} numberOfLines={1}>
              {msg.text}
            </Text>
          </View>
          <Text style={[s.chatPreviewTime, { color: c.textMuted }]}>{msg.time}</Text>
        </View>
      ))}

      <GoldDivider style={{ marginTop: 16 }} />

      {/* Stats row */}
      <SectionLabel title="TRIP INFO" />
      <View style={s.statsRow}>
        {[
          { label: 'FORMAT', value: 'SP' },
          { label: 'ROUNDS', value: `${trip.roundsPlanned}` },
          { label: 'GAMES', value: `${SIDE_GAME_PILLS.length}` },
          { label: 'PLAYERS', value: `${MOCK_PLAYERS.length}` },
        ].map((st) => (
          <View key={st.label} style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <Text style={[s.statValue, { color: c.teal, fontFamily: GEO }]}>{st.value}</Text>
            <Text style={[s.statLabel, { color: c.textMuted }]}>{st.label}</Text>
          </View>
        ))}
      </View>

      <GoldDivider style={{ marginTop: 16 }} />

      {/* Invite code */}
      <SectionLabel title="INVITE CODE" />
      <Pressable
        onPress={() => {
          Clipboard.setString(formatInviteCode(trip));
          haptics.medium();
          showToast({ message: 'Invite code copied', type: 'success', icon: 'copy-outline' });
        }}
        accessibilityLabel="Trip invite code"
        style={[s.inviteRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
      >
        <Text style={[s.inviteCode, { color: c.gold, fontFamily: GEO }]}>{formatInviteCode(trip)}</Text>
        <View style={s.inviteCopyWrap}>
          <Ionicons name="copy-outline" size={16} color={c.teal} />
          <Text style={[s.inviteCopyText, { color: c.teal }]}>Copy</Text>
        </View>
      </Pressable>

      {/* Checklist (collapsible) */}
      <Pressable
        onPress={() => setChecklistExpanded(!checklistExpanded)}
        style={[s.checklistHeader, { backgroundColor: c.cardBg, borderColor: c.border }]}
      >
        <View style={{ flex: 1 }}>
          <View style={s.checklistTitleRow}>
            <Text style={[s.checklistTitle, { color: c.text }]}>Checklist</Text>
            <Text style={[s.checklistCount, { color: c.textMuted }]}>
              {checkDone}/{checkTotal}
            </Text>
          </View>
          <View style={[s.progressTrack, { backgroundColor: c.elevated }]}>
            <View
              style={[
                s.progressFill,
                { width: `${checkProgress * 100}%`, backgroundColor: c.teal },
              ]}
            />
          </View>
        </View>
        <Ionicons
          name={checklistExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={c.textMuted}
        />
      </Pressable>
      {checklistExpanded &&
        checklist.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onToggleCheck(item.id)}
            style={[s.checkItem, { borderColor: c.border }]}
          >
            <View
              style={[
                s.checkBox,
                {
                  borderColor: item.done ? c.teal : c.textMuted,
                  backgroundColor: item.done ? c.teal : 'transparent',
                },
              ]}
            >
              {item.done && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Text
              style={[
                s.checkText,
                { color: item.done ? c.textMuted : c.text },
                item.done && s.checkTextDone,
              ]}
            >
              {item.text}
            </Text>
          </Pressable>
        ))}

      {/* Games on the line */}
      <SectionLabel title="GAMES ON THE LINE" />
      <View style={s.sideGamePillWrap}>
        {SIDE_GAME_PILLS.map((g) => (
          <View key={g} style={[s.sideGamePill, { backgroundColor: `${c.gold}15`, borderColor: c.gold }]}>
            <Text style={[s.sideGamePillText, { color: c.gold }]}>{g}</Text>
          </View>
        ))}
      </View>

      <GoldDivider style={{ marginTop: 16 }} />

      {/* Trip moments */}
      <SectionLabel title="TRIP MOMENTS" />
      {(realMoments.length > 0 ? realMoments : MOCK_MOMENTS).map((m: any) => {
        const authorName = m.user?.name ?? m.author ?? '';
        const timeStr = m.created_at
          ? formatTimeAgo(m.created_at)
          : m.time ?? '';
        return (
          <View key={m.id} style={[s.momentRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            {m.user && (
              <View style={s.momentHeader}>
                <Avatar id={m.user.id} size={24} name={authorName} />
                <Text style={[s.momentAuthorName, { color: c.text }]}>{authorName}</Text>
              </View>
            )}
            <Text style={[s.momentText, { color: c.text }]}>{m.text}</Text>
            {m.photo_url && (
              <Image source={{ uri: m.photo_url }} style={s.momentPhoto} resizeMode="cover" />
            )}
            <View style={s.momentMeta}>
              {!m.user && <Text style={[s.momentAuthor, { color: c.textMuted }]}>{authorName}</Text>}
              <Text style={[s.momentTime, { color: c.textMuted }]}>{timeStr}</Text>
            </View>
          </View>
        );
      })}
      <Pressable
        onPress={() => { haptics.light(); onAddMoment(); }}
        style={[s.addMomentBtn, { borderColor: c.border }]}
      >
        <Ionicons name="add-circle-outline" size={16} color={c.teal} />
        <Text style={[s.addMomentText, { color: c.teal }]}>Add Moment</Text>
      </Pressable>

      <GoldDivider style={{ marginTop: 16 }} />

      {/* Head to Head */}
      <SectionLabel title="HEAD TO HEAD" />
      {MOCK_H2H.map((h) => {
        const total = h.wins + h.losses + h.ties;
        const winPct = total > 0 ? ((h.wins / total) * 100).toFixed(0) : '0';
        return (
          <View key={h.opponentId} style={[s.h2hRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <Avatar id={h.opponentId} size={32} name={h.opponentName} />
            <View style={{ flex: 1 }}>
              <Text style={[s.h2hName, { color: c.text }]}>{h.opponentName}</Text>
              <Text style={[s.h2hRecord, { color: c.textMuted }]}>
                {h.wins}W - {h.losses}L - {h.ties}T
              </Text>
            </View>
            <Text
              style={[
                s.h2hPct,
                { color: h.wins > h.losses ? c.teal : h.wins < h.losses ? c.urgent : c.textMuted, fontFamily: GEO },
              ]}
            >
              {winPct}%
            </Text>
          </View>
        );
      })}

      <GoldDivider style={{ marginTop: 16 }} />

      {/* Trip tools */}
      <SectionLabel title="TRIP TOOLS" />
      <View style={s.toolsGrid}>
        {TRIP_TOOLS.map((tool) => (
          <Pressable
            key={tool.id}
            onPress={() => onToolPress(tool.id)}
            style={[s.toolCard, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Ionicons name={tool.icon as any} size={22} color={tool.color} />
            <Text style={[s.toolLabel, { color: c.text }]}>{tool.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COURSES TAB
// ═══════════════════════════════════════════════════════════════════════
function CoursesTab() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [votedCourses, setVotedCourses] = useState<Set<string>>(
    new Set(MOCK_COURSES.filter((cc) => cc.voted).map((cc) => cc.id)),
  );

  const toggleVote = (id: string) => {
    setVotedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {MOCK_COURSES.map((course) => {
        const voted = votedCourses.has(course.id);
        return (
          <View key={course.id} style={[s.courseCard, { borderColor: c.border }]}>
            {/* Course image header */}
            <CourseImage
              courseName={course.name}
              location={`${course.name.split('—')[0].trim()}`}
              gradient={course.gradient}
              style={s.courseGradient}
              height={120}
            >
              <View style={s.courseImageOverlay} />
              <View style={s.courseGradientContent}>
                <View style={s.courseDayBadge}>
                  <Text style={[s.courseDayText, { fontFamily: GEO }]}>DAY {course.day}</Text>
                </View>
                <Text style={[s.courseCardName, { fontFamily: GEO }]}>{course.name}</Text>
                <Text style={s.courseTeeTime}>{course.teeTime}</Text>
              </View>
            </CourseImage>

            {/* Stats row */}
            <View style={[s.courseStatsRow, { backgroundColor: c.cardBg }]}>
              {[
                { label: 'RATING', value: course.rating.toFixed(1) },
                { label: 'SLOPE', value: `${course.slope}` },
                { label: 'PAR', value: `${course.par}` },
                { label: 'YARDS', value: course.yards.toLocaleString() },
              ].map((stat) => (
                <View key={stat.label} style={s.courseStatItem}>
                  <Text style={[s.courseStatValue, { color: c.text, fontFamily: GEO }]}>
                    {stat.value}
                  </Text>
                  <Text style={[s.courseStatLabel, { color: c.textMuted }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Vote row */}
            <View style={[s.courseVoteRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Pressable
                onPress={() => toggleVote(course.id)}
                style={[
                  s.voteBtn,
                  {
                    backgroundColor: voted ? `${c.teal}15` : c.elevated,
                    borderColor: voted ? c.teal : c.border,
                  },
                ]}
              >
                <Ionicons
                  name={voted ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={14}
                  color={voted ? c.teal : c.textMuted}
                />
                <Text style={[s.voteText, { color: voted ? c.teal : c.textMuted }]}>
                  {voted
                    ? `${MOCK_COURSES.find((x) => x.id === course.id)?.votes ?? 0} votes`
                    : 'Vote'}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PLAYERS TAB
// ═══════════════════════════════════════════════════════════════════════
function PlayersTab() {
  const { theme } = useTheme();
  const c = theme.colors;

  const rsvpColor = (rsvp: TripPlayer['rsvp']) => {
    if (rsvp === 'confirmed') return c.teal;
    if (rsvp === 'pending') return c.gold;
    return c.urgent;
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {MOCK_PLAYERS.map((p) => (
        <View key={p.id} style={[s.fullPlayerRow, { backgroundColor: c.cardBg, borderColor: c.border }]} accessibilityLabel={`${p.name}, ${p.handicap} handicap, ${p.rsvp}`}>
          <Avatar id={p.id} size={44} name={p.name} />
          <View style={{ flex: 1 }}>
            <View style={s.playerNameRow}>
              <Text style={[s.fullPlayerName, { color: c.text }]}>{p.name}</Text>
              <View style={[s.rsvpBadge, { backgroundColor: `${rsvpColor(p.rsvp)}15` }]}>
                <View style={[s.rsvpDot, { backgroundColor: rsvpColor(p.rsvp) }]} />
                <Text style={[s.rsvpText, { color: rsvpColor(p.rsvp) }]}>
                  {p.rsvp.charAt(0).toUpperCase() + p.rsvp.slice(1)}
                </Text>
              </View>
            </View>
            <Text style={[s.fullPlayerHcp, { color: c.textMuted }]}>{p.handicap} HCP</Text>
            {p.roundsPlayed != null && (
              <View style={s.playerStatsRow}>
                <Text style={[s.playerStatText, { color: c.textMuted }]}>
                  {p.roundsPlayed} rounds
                </Text>
                <Text style={[s.playerStatText, { color: c.textMuted }]}>·</Text>
                <Text style={[s.playerStatText, { color: c.teal }]}>
                  {p.tripAvg?.toFixed(1)} avg
                </Text>
              </View>
            )}
          </View>
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CHECKLIST TAB
// ═══════════════════════════════════════════════════════════════════════
function ChecklistTab({
  checklist,
  onToggle,
}: {
  checklist: ChecklistItem[];
  onToggle: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const done = checklist.filter((cl) => cl.done).length;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Progress count */}
      <View style={[s.checkProgressBox, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <Text style={[s.checkProgressNum, { color: c.teal, fontFamily: GEO }]}>
          {done}
          <Text style={{ color: c.textMuted, fontSize: 16 }}> / {checklist.length}</Text>
        </Text>
        <Text style={[s.checkProgressLabel, { color: c.textMuted }]}>tasks completed</Text>
        <View style={[s.progressTrack, { backgroundColor: c.elevated, marginTop: 8 }]}>
          <View
            style={[
              s.progressFill,
              { width: `${(done / checklist.length) * 100}%`, backgroundColor: c.teal },
            ]}
          />
        </View>
      </View>

      {checklist.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onToggle(item.id)}
          style={[s.fullCheckRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
        >
          <View
            style={[
              s.checkBox,
              {
                borderColor: item.done ? c.teal : c.textMuted,
                backgroundColor: item.done ? c.teal : 'transparent',
              },
            ]}
          >
            {item.done && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text
            style={[
              s.fullCheckText,
              { color: item.done ? c.textMuted : c.text },
              item.done && s.checkTextDone,
            ]}
          >
            {item.text}
          </Text>
        </Pressable>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CHAT TAB
// ═══════════════════════════════════════════════════════════════════════
const TRASH_TALK_MESSAGES = [
  'Nice par... for a bogey golfer \u{1F60F}',
  'Your handicap is showing \u{1F923}',
  "I'd be nervous too \u{1F62C}",
  "That's going on the highlight reel \u{1F3AC}",
  'Dormie. Don\'t choke. \u{1F3CC}\u{FE0F}',
  'Pay up \u{1F4B0}',
];

function ChatTab({ tripId, userId }: { tripId: string; userId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT);
  const [inputText, setInputText] = useState('');
  const [emojiPickerMsg, setEmojiPickerMsg] = useState<string | null>(null);
  const [showTrashTalk, setShowTrashTalk] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Fetch existing messages and subscribe to real-time updates
  useEffect(() => {
    let cancelled = false;

    messagesService.fetch(tripId).then((fetched) => {
      if (cancelled) return;
      const mapped: ChatMessage[] = fetched.reverse().map((m) => ({
        id: m.id,
        userId: m.user_id,
        userName: m.user?.name ?? 'Unknown',
        text: m.message,
        time: new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        reactions: (m.reactions ?? []).map((r) => ({ emoji: r.emoji, count: r.count ?? 1, reacted: false })),
      }));
      if (mapped.length > 0) {
        setMessages(mapped);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200);
    }).catch(() => {
      // Keep mock data on error
    });

    const channel = messagesService.subscribe(tripId, (newMsg) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [
          ...prev,
          {
            id: newMsg.id,
            userId: newMsg.user_id,
            userName: '',
            text: newMsg.message,
            time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            reactions: [],
          },
        ];
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      cancelled = true;
      messagesService.unsubscribe(channel);
    };
  }, [tripId]);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    sounds.pop();

    // Optimistic local update
    const optimisticId = `m-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        userId: userId,
        userName: 'You',
        text,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        reactions: [],
      },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    messagesService.send(tripId, userId, text).catch(() => {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    });
  };

  const sendTrashTalk = (text: string) => {
    setShowTrashTalk(false);
    // Optimistic local update
    const optimisticId = `m-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        userId: userId,
        userName: 'You',
        text,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        reactions: [],
      },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    messagesService.send(tripId, userId, text).catch(() => {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    });
  };

  const toggleReaction = (msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId) return msg;
        const existing = msg.reactions.find((r) => r.emoji === emoji);
        if (existing) {
          if (existing.reacted) {
            return {
              ...msg,
              reactions: msg.reactions
                .map((r) =>
                  r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r,
                )
                .filter((r) => r.count > 0),
            };
          }
          return {
            ...msg,
            reactions: msg.reactions.map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r,
            ),
          };
        }
        return {
          ...msg,
          reactions: [...msg.reactions, { emoji, count: 1, reacted: true }],
        };
      }),
    );
    setEmojiPickerMsg(null);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Data freshness indicator */}
      <View style={s.freshnessBar}>
        <PulsingDot color={c.teal} size={6} />
        <Text style={[s.freshnessText, { color: c.teal }]}>Live</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.chatScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isMe = msg.userId === userId;
          return (
            <View key={msg.id} style={s.chatMsgWrap}>
              {!isMe && <Avatar id={msg.userId} size={28} name={msg.userName} />}
              <View style={[s.chatBubbleWrap, isMe && s.chatBubbleWrapMe]}>
                {!isMe && (
                  <Text style={[s.chatMsgAuthor, { color: c.teal }]}>{msg.userName}</Text>
                )}
                <Pressable
                  onLongPress={() => setEmojiPickerMsg(emojiPickerMsg === msg.id ? null : msg.id)}
                  style={[
                    s.chatBubble,
                    {
                      backgroundColor: isMe ? `${c.teal}20` : c.cardBg,
                      borderColor: isMe ? c.teal : c.border,
                    },
                  ]}
                >
                  <Text style={[s.chatMsgText, { color: c.text }]}>{msg.text}</Text>
                </Pressable>
                <View style={s.chatMsgBottom}>
                  <Text style={[s.chatMsgTime, { color: c.textMuted }]}>{msg.time}</Text>
                  {msg.reactions.length > 0 && (
                    <View style={s.reactionsRow}>
                      {msg.reactions.map((r) => (
                        <Pressable
                          key={r.emoji}
                          onPress={() => toggleReaction(msg.id, r.emoji)}
                          style={[
                            s.reactionPill,
                            {
                              backgroundColor: r.reacted ? `${c.teal}15` : c.elevated,
                              borderColor: r.reacted ? c.teal : c.border,
                            },
                          ]}
                        >
                          <Text style={s.reactionEmoji}>{r.emoji}</Text>
                          <Text style={[s.reactionCount, { color: r.reacted ? c.teal : c.textMuted }]}>
                            {r.count}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Emoji picker */}
                {emojiPickerMsg === msg.id && (
                  <View style={[s.emojiPicker, { backgroundColor: c.elevated, borderColor: c.border }]}>
                    {EMOJI_OPTIONS.map((em) => (
                      <Pressable
                        key={em}
                        onPress={() => toggleReaction(msg.id, em)}
                        style={s.emojiOption}
                      >
                        <Text style={s.emojiOptionText}>{em}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
              {isMe && <Avatar id={msg.userId} size={28} name={msg.userName} />}
            </View>
          );
        })}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Trash talk panel */}
      {showTrashTalk && (
        <View style={[s.trashTalkPanel, { backgroundColor: c.elevated, borderColor: c.border }]}>
          <View style={s.trashTalkHeader}>
            <Ionicons name="flame" size={14} color="#C9A227" />
            <Text style={[s.trashTalkTitle, { color: '#C9A227' }]}>TRASH TALK</Text>
            <Pressable onPress={() => setShowTrashTalk(false)} hitSlop={8}>
              <Ionicons name="close" size={16} color={c.textMuted} />
            </Pressable>
          </View>
          <View style={s.trashTalkGrid}>
            {TRASH_TALK_MESSAGES.map((msg, idx) => (
              <Pressable
                key={idx}
                onPress={() => sendTrashTalk(msg)}
                style={[s.trashTalkChip, { backgroundColor: c.cardBg, borderColor: '#C9A227' }]}
              >
                <Text style={[s.trashTalkChipText, { color: c.text }]}>{msg}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Message input */}
      <View style={[s.chatInputWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TextInput
          style={[s.chatInput, { color: c.text, backgroundColor: c.cardBg, borderColor: c.border }]}
          placeholder="Message the group..."
          placeholderTextColor={c.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={() => setShowTrashTalk(!showTrashTalk)}
          style={[s.trashTalkBtn, { backgroundColor: showTrashTalk ? `${'#C9A227'}20` : c.elevated }]}
        >
          <Ionicons
            name="flame-outline"
            size={18}
            color={showTrashTalk ? '#C9A227' : c.textMuted}
          />
        </Pressable>
        <Pressable
          onPress={sendMessage}
          style={[s.sendBtn, { backgroundColor: inputText.trim() ? c.teal : c.elevated }]}
        >
          <Ionicons
            name="send"
            size={18}
            color={inputText.trim() ? '#fff' : c.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TRIP TOOL: BUDGET CALCULATOR
// ═══════════════════════════════════════════════════════════════════════
function BudgetCalculator({
  trip,
  playerCount,
  onBack,
}: {
  trip: typeof MOCK_UPCOMING_TRIPS[0];
  playerCount: number;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [greensFees, setGreensFees] = useState('175');
  const [lodging, setLodging] = useState('220');
  const [travel, setTravel] = useState('450');
  const [food, setFood] = useState('80');
  const [other, setOther] = useState('50');

  const roundCount = trip.roundsPlanned ?? 3;
  const startD = new Date(trip.startDate);
  const endD = new Date(trip.endDate);
  const nights = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 86400000));

  const perGreen = (parseFloat(greensFees) || 0) * roundCount;
  const perLodge = (parseFloat(lodging) || 0) * nights;
  const perTravel = parseFloat(travel) || 0;
  const perFood = (parseFloat(food) || 0) * (nights + 1);
  const perOther = parseFloat(other) || 0;
  const perPerson = perGreen + perLodge + perTravel + perFood + perOther;
  const groupTotal = perPerson * playerCount;

  const budgetRows: { label: string; detail: string; amount: number; state: string; setter: (v: string) => void }[] = [
    { label: 'Greens Fees', detail: `$${greensFees} × ${roundCount} rounds`, amount: perGreen, state: greensFees, setter: setGreensFees },
    { label: 'Lodging', detail: `$${lodging} × ${nights} nights`, amount: perLodge, state: lodging, setter: setLodging },
    { label: 'Travel', detail: 'Total (flights, rental, etc.)', amount: perTravel, state: travel, setter: setTravel },
    { label: 'Food & Drink', detail: `$${food} × ${nights + 1} days`, amount: perFood, state: food, setter: setFood },
    { label: 'Other', detail: 'Tips, prizes, etc.', amount: perOther, state: other, setter: setOther },
  ];

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <View style={[tt.toolHeader, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[tt.toolTitle, { color: c.text, fontFamily: GEO }]}>Budget Calculator</Text>
        <Ionicons name="cash-outline" size={20} color="#006747" />
      </View>

      <ScrollView contentContainerStyle={tt.toolBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Summary cards */}
        <View style={tt.budgetSummaryRow}>
          <View style={[tt.budgetSummaryCard, { backgroundColor: `${c.teal}10`, borderColor: c.teal }]}>
            <Text style={[tt.budgetSummaryLabel, { color: c.textMuted }]}>Per Person</Text>
            <Text style={[tt.budgetSummaryVal, { color: c.teal, fontFamily: GEO }]}>
              ${perPerson.toLocaleString()}
            </Text>
          </View>
          <View style={[tt.budgetSummaryCard, { backgroundColor: `${c.gold}10`, borderColor: c.gold }]}>
            <Text style={[tt.budgetSummaryLabel, { color: c.textMuted }]}>Group Total</Text>
            <Text style={[tt.budgetSummaryVal, { color: c.gold, fontFamily: GEO }]}>
              ${groupTotal.toLocaleString()}
            </Text>
          </View>
        </View>
        <Text style={[tt.budgetMeta, { color: c.textMuted }]}>
          {playerCount} players · {roundCount} rounds · {nights} nights
        </Text>

        {/* Editable inputs */}
        {budgetRows.map((row) => (
          <View key={row.label} style={[tt.budgetRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[tt.budgetRowLabel, { color: c.text }]}>{row.label}</Text>
              <Text style={[tt.budgetRowDetail, { color: c.textMuted }]}>{row.detail}</Text>
            </View>
            <View style={tt.budgetInputWrap}>
              <Text style={[tt.budgetDollar, { color: c.textMuted }]}>$</Text>
              <TextInput
                value={row.state}
                onChangeText={row.setter}
                keyboardType="numeric"
                style={[tt.budgetInput, { color: c.text, borderColor: c.border }]}
              />
            </View>
            <Text style={[tt.budgetRowAmount, { color: c.teal, fontFamily: GEO }]}>
              ${row.amount.toLocaleString()}
            </Text>
          </View>
        ))}

        {/* Breakdown */}
        <View style={[tt.breakdownCard, { borderColor: c.border }]}>
          <Text style={[tt.breakdownTitle, { color: c.gold, fontFamily: GEO }]}>BREAKDOWN</Text>
          {budgetRows.map((row) => (
            <View key={row.label} style={[tt.breakdownRow, { borderColor: c.border }]}>
              <Text style={[tt.breakdownLabel, { color: c.textMuted }]}>{row.label}</Text>
              <Text style={[tt.breakdownVal, { color: c.text, fontFamily: GEO }]}>${row.amount.toLocaleString()}</Text>
            </View>
          ))}
          <View style={[tt.breakdownRow, { borderColor: c.teal }]}>
            <Text style={[tt.breakdownLabel, { color: c.teal, fontWeight: '700' }]}>Total Per Person</Text>
            <Text style={[tt.breakdownVal, { color: c.teal, fontFamily: GEO, fontSize: 18 }]}>${perPerson.toLocaleString()}</Text>
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TRIP TOOL: PACKING LIST
// ═══════════════════════════════════════════════════════════════════════
type PackingItem = { id: string; text: string; checked: boolean };
type PackingCategory = { title: string; icon: string; items: PackingItem[] };

const INITIAL_PACKING: PackingCategory[] = [
  {
    title: 'Golf',
    icon: 'golf-outline',
    items: [
      { id: 'pg1', text: 'Clubs', checked: false },
      { id: 'pg2', text: 'Golf shoes', checked: false },
      { id: 'pg3', text: 'Glove', checked: false },
      { id: 'pg4', text: 'Balls (1 doz+)', checked: false },
      { id: 'pg5', text: 'Tees', checked: false },
      { id: 'pg6', text: 'Rangefinder', checked: false },
      { id: 'pg7', text: 'Rain gear', checked: false },
      { id: 'pg8', text: 'Hat / visor', checked: false },
      { id: 'pg9', text: 'Towel', checked: false },
      { id: 'pg10', text: 'Divot tool', checked: false },
    ],
  },
  {
    title: 'Clothing',
    icon: 'shirt-outline',
    items: [
      { id: 'pc1', text: 'Polos (3-4)', checked: false },
      { id: 'pc2', text: 'Shorts / pants', checked: false },
      { id: 'pc3', text: 'Belt', checked: false },
      { id: 'pc4', text: 'Dinner outfit', checked: false },
      { id: 'pc5', text: 'Jacket / pullover', checked: false },
      { id: 'pc6', text: 'Sunglasses', checked: false },
    ],
  },
  {
    title: 'Essentials',
    icon: 'briefcase-outline',
    items: [
      { id: 'pe1', text: 'Phone charger', checked: false },
      { id: 'pe2', text: 'Sunscreen', checked: false },
      { id: 'pe3', text: 'Pain relievers', checked: false },
      { id: 'pe4', text: 'Snacks', checked: false },
      { id: 'pe5', text: 'Water bottle', checked: false },
      { id: 'pe6', text: 'Cash for bets', checked: false },
    ],
  },
];

function PackingList({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [categories, setCategories] = useState(INITIAL_PACKING);

  const toggleItem = (catIdx: number, itemId: string) => {
    setCategories((prev) =>
      prev.map((cat, ci) =>
        ci === catIdx
          ? { ...cat, items: cat.items.map((it) => (it.id === itemId ? { ...it, checked: !it.checked } : it)) }
          : cat,
      ),
    );
  };

  const allItems = categories.flatMap((cat) => cat.items);
  const checked = allItems.filter((it) => it.checked).length;
  const total = allItems.length;
  const pct = total > 0 ? checked / total : 0;

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <View style={[tt.toolHeader, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[tt.toolTitle, { color: c.text, fontFamily: GEO }]}>Packing List</Text>
        <Ionicons name="bag-outline" size={20} color="#C9A227" />
      </View>

      <ScrollView contentContainerStyle={tt.toolBody} showsVerticalScrollIndicator={false}>
        {/* Progress bar */}
        <View style={[tt.packProgress, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <View style={tt.packProgressHeader}>
            <Text style={[tt.packProgressText, { color: c.text, fontFamily: GEO }]}>
              {checked} / {total}
            </Text>
            <Text style={[tt.packProgressPct, { color: pct === 1 ? c.teal : c.gold, fontFamily: GEO }]}>
              {Math.round(pct * 100)}%
            </Text>
          </View>
          <View style={[tt.packTrack, { backgroundColor: c.elevated }]}>
            <View style={[tt.packFill, { width: `${pct * 100}%`, backgroundColor: pct === 1 ? c.teal : c.gold }]} />
          </View>
        </View>

        {categories.map((cat, catIdx) => {
          const catChecked = cat.items.filter((it) => it.checked).length;
          return (
            <View key={cat.title}>
              <View style={tt.packCatHeader}>
                <Ionicons name={cat.icon as any} size={16} color={c.gold} />
                <Text style={[tt.packCatTitle, { color: c.gold, fontFamily: GEO }]}>{cat.title.toUpperCase()}</Text>
                <Text style={[tt.packCatCount, { color: c.textMuted }]}>
                  {catChecked}/{cat.items.length}
                </Text>
              </View>
              {cat.items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => toggleItem(catIdx, item.id)}
                  style={[tt.packRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
                >
                  <View
                    style={[
                      tt.packCheck,
                      {
                        borderColor: item.checked ? c.teal : c.textMuted,
                        backgroundColor: item.checked ? c.teal : 'transparent',
                      },
                    ]}
                  >
                    {item.checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  <Text
                    style={[
                      tt.packItemText,
                      { color: item.checked ? c.textMuted : c.text },
                      item.checked && { textDecorationLine: 'line-through' },
                    ]}
                  >
                    {item.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TRIP TOOL: TEE TIME GROUPS
// ═══════════════════════════════════════════════════════════════════════
function TeeTimeGroups({
  players,
  courses,
  onBack,
}: {
  players: TripPlayer[];
  courses: TripCourse[];
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  // Auto-group into foursomes
  const buildGroups = (course: TripCourse) => {
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const groups: { time: string; players: TripPlayer[] }[] = [];
    const baseHour = parseInt(course.teeTime.split(':')[0], 10);
    const baseMin = parseInt(course.teeTime.split(':')[1], 10);

    for (let i = 0; i < shuffled.length; i += 4) {
      const groupPlayers = shuffled.slice(i, i + 4);
      const offset = (i / 4) * 10; // 10 min stagger
      const totalMin = baseHour * 60 + baseMin + offset;
      const hr = Math.floor(totalMin / 60);
      const mn = totalMin % 60;
      const hr12 = hr > 12 ? hr - 12 : hr;
      const ampm = hr >= 12 ? 'PM' : 'AM';
      groups.push({
        time: `${hr12}:${mn.toString().padStart(2, '0')} ${ampm}`,
        players: groupPlayers,
      });
    }
    return groups;
  };

  // Seed the groups once per course
  const [courseGroups] = useState(() =>
    courses.reduce(
      (acc, course) => {
        acc[course.id] = buildGroups(course);
        return acc;
      },
      {} as Record<string, { time: string; players: TripPlayer[] }[]>,
    ),
  );

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <View style={[tt.toolHeader, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[tt.toolTitle, { color: c.text, fontFamily: GEO }]}>Tee Time Groups</Text>
        <Ionicons name="people-outline" size={20} color="#5B7FA5" />
      </View>

      <ScrollView contentContainerStyle={tt.toolBody} showsVerticalScrollIndicator={false}>
        {courses.map((course) => (
          <View key={course.id}>
            <View style={tt.teeCourseBanner}>
              <LinearGradient
                colors={course.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={tt.teeDayBadge}>
                <Text style={[tt.teeDayText, { fontFamily: GEO }]}>DAY {course.day}</Text>
              </View>
              <Text style={[tt.teeCourseName, { fontFamily: GEO }]}>{course.name}</Text>
            </View>

            {(courseGroups[course.id] ?? []).map((group, gi) => (
              <View key={gi} style={[tt.teeGroupCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                <View style={tt.teeGroupHeader}>
                  <Text style={[tt.teeGroupNum, { color: c.gold, fontFamily: GEO }]}>GROUP {gi + 1}</Text>
                  <Text style={[tt.teeGroupTime, { color: c.teal, fontFamily: GEO }]}>{group.time}</Text>
                </View>
                {group.players.map((p) => (
                  <View key={p.id} style={[tt.teePlayerRow, { borderColor: c.border }]}>
                    <Avatar id={p.id} size={28} name={p.name} />
                    <Text style={[tt.teePlayerName, { color: c.text }]}>{p.name}</Text>
                    <Text style={[tt.teePlayerHcp, { color: c.textMuted, fontFamily: GEO }]}>{p.handicap}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TRIP TOOL: RSVP PREVIEW
// ═══════════════════════════════════════════════════════════════════════
function RSVPPreview({
  trip,
  players,
  courses,
  onBack,
}: {
  trip: typeof MOCK_UPCOMING_TRIPS[0];
  players: TripPlayer[];
  courses: TripCourse[];
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const MASTERS_GREEN = '#1E4D2B';

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <View style={[tt.toolHeader, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[tt.toolTitle, { color: c.text, fontFamily: GEO }]}>RSVP Preview</Text>
        <Ionicons name="mail-outline" size={20} color="#8B6DAF" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Masters green hero */}
        <LinearGradient
          colors={greenHeaderGradient as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={tt.rsvpHero}
        >
          <Text style={[tt.rsvpBrand, { fontFamily: GEO }]}>DORMIE</Text>
          <Text style={[tt.rsvpTripName, { fontFamily: GEO }]}>{trip.name}</Text>
          <Text style={tt.rsvpLocation}>{trip.destination}</Text>
          <Text style={tt.rsvpLocation}>{trip.city}, {trip.state}</Text>
          <View style={tt.rsvpDatesRow}>
            <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={tt.rsvpDates}>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</Text>
          </View>
        </LinearGradient>

        {/* Course list */}
        <View style={tt.rsvpSection}>
          <Text style={[tt.rsvpSectionTitle, { color: c.gold, fontFamily: GEO }]}>COURSES</Text>
          {courses.map((course) => (
            <View key={course.id} style={[tt.rsvpCourseRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <Ionicons name="golf-outline" size={16} color={c.teal} />
              <View style={{ flex: 1 }}>
                <Text style={[tt.rsvpCourseName, { color: c.text }]}>{course.name}</Text>
                <Text style={[tt.rsvpCourseTime, { color: c.textMuted }]}>Day {course.day} · {course.teeTime}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Who's going */}
        <View style={tt.rsvpSection}>
          <Text style={[tt.rsvpSectionTitle, { color: c.gold, fontFamily: GEO }]}>WHO'S GOING</Text>
          {players.map((p) => {
            const rsvpColor = p.rsvp === 'confirmed' ? c.teal : p.rsvp === 'pending' ? c.gold : c.urgent;
            const rsvpLabel = p.rsvp === 'confirmed' ? 'IN' : p.rsvp === 'pending' ? 'PENDING' : 'OUT';
            return (
              <View key={p.id} style={[tt.rsvpPlayerRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                <Avatar id={p.id} size={32} name={p.name} />
                <View style={{ flex: 1 }}>
                  <Text style={[tt.rsvpPlayerName, { color: c.text }]}>{p.name}</Text>
                  <Text style={[tt.rsvpPlayerHcp, { color: c.textMuted }]}>{p.handicap} HCP</Text>
                </View>
                <View style={[tt.rsvpBadge, { backgroundColor: `${rsvpColor}15`, borderColor: rsvpColor }]}>
                  <Text style={[tt.rsvpBadgeText, { color: rsvpColor }]}>{rsvpLabel}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* RSVP buttons */}
        <View style={tt.rsvpSection}>
          <Pressable style={[tt.rsvpBtn, { backgroundColor: MASTERS_GREEN }]}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={[tt.rsvpBtnText, { fontFamily: GEO }]}>I'm In</Text>
          </Pressable>
          <Pressable style={[tt.rsvpBtn, { backgroundColor: `${c.gold}20`, borderWidth: 1, borderColor: c.gold }]}>
            <Ionicons name="help-circle" size={18} color={c.gold} />
            <Text style={[tt.rsvpBtnText, { color: c.gold, fontFamily: GEO }]}>Maybe</Text>
          </Pressable>
          <Pressable style={[tt.rsvpBtn, { backgroundColor: `${c.urgent}15`, borderWidth: 1, borderColor: c.urgent }]}>
            <Ionicons name="close-circle" size={18} color={c.urgent} />
            <Text style={[tt.rsvpBtnText, { color: c.urgent, fontFamily: GEO }]}>Can't Make It</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TRIP TOOL: TRIP AWARDS
// ═══════════════════════════════════════════════════════════════════════
type TripAward = {
  id: string;
  title: string;
  icon: string;
  winner: string;
  detail: string;
  auto: boolean;
  isChampion?: boolean;
};

const MOCK_AWARDS: TripAward[] = [
  { id: 'ta1', title: 'Trip Champion', icon: 'trophy', winner: 'Tommy Fleetwood', detail: 'Lowest total score: 213 (71-71-71)', auto: true, isChampion: true },
  { id: 'ta2', title: 'Best Single Round', icon: 'ribbon', winner: 'Tommy Fleetwood', detail: '68 at TPC Scottsdale — Stadium', auto: true },
  { id: 'ta3', title: 'Most Improved', icon: 'trending-up', winner: 'Jake Sullivan', detail: 'Improved 8 strokes from R1 to R3', auto: false },
  { id: 'ta4', title: 'Side Game King', icon: 'cash', winner: 'Ian McGowan', detail: 'Won 4 of 6 side games', auto: false },
  { id: 'ta5', title: 'Clutch Player', icon: 'flash', winner: 'Drew Patterson', detail: 'Eagle on 18 to win Skins', auto: false },
  { id: 'ta6', title: 'Best Dressed', icon: 'shirt', winner: 'Ian McGowan', detail: 'Voted by the group', auto: false },
  { id: 'ta7', title: 'Worst Shot Award', icon: 'skull', winner: 'Jake Sullivan', detail: 'Topped driver into the lake on #7', auto: false },
];

function TripAwards({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <View style={[tt.toolHeader, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[tt.toolTitle, { color: c.text, fontFamily: GEO }]}>Trip Awards</Text>
        <Ionicons name="trophy-outline" size={20} color="#C47B3B" />
      </View>

      <ScrollView contentContainerStyle={tt.toolBody} showsVerticalScrollIndicator={false}>
        {MOCK_AWARDS.map((award) => (
          <View
            key={award.id}
            style={[
              tt.awardRow,
              {
                backgroundColor: award.isChampion ? `${c.gold}10` : c.cardBg,
                borderColor: award.isChampion ? c.gold : c.border,
              },
            ]}
          >
            <View style={[tt.awardIcon, { backgroundColor: award.isChampion ? `${c.gold}20` : c.elevated }]}>
              <Ionicons
                name={award.icon as any}
                size={22}
                color={award.isChampion ? c.gold : '#C47B3B'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[tt.awardTitle, { color: award.isChampion ? c.gold : c.text, fontFamily: GEO }]}>
                {award.title}
              </Text>
              <Text style={[tt.awardWinner, { color: c.teal }]}>{award.winner}</Text>
              <Text style={[tt.awardDetail, { color: c.textMuted }]}>{award.detail}</Text>
            </View>
            {award.auto && (
              <View style={[tt.autoBadge, { backgroundColor: `${c.teal}15` }]}>
                <Text style={[tt.autoBadgeText, { color: c.teal }]}>AUTO</Text>
              </View>
            )}
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TRIP TOOL: WEATHER
// ═══════════════════════════════════════════════════════════════════════
type WeatherDay = {
  day: number;
  date: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  wind: string;
  rainPct: number;
};

function generateMockWeather(startDate: string, nights: number): WeatherDay[] {
  const conditions: { cond: string; icon: string }[] = [
    { cond: 'Sunny', icon: 'sunny' },
    { cond: 'Partly Cloudy', icon: 'partly-sunny' },
    { cond: 'Mostly Sunny', icon: 'sunny-outline' },
    { cond: 'Cloudy', icon: 'cloud' },
    { cond: 'AM Showers', icon: 'rainy' },
  ];
  const days: WeatherDay[] = [];
  const base = new Date(startDate);
  for (let i = 0; i <= nights; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const ci = Math.floor(Math.random() * conditions.length);
    const high = 82 + Math.floor(Math.random() * 16);
    days.push({
      day: i + 1,
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      high,
      low: high - 15 - Math.floor(Math.random() * 8),
      condition: conditions[ci].cond,
      icon: conditions[ci].icon,
      wind: `${5 + Math.floor(Math.random() * 15)} mph ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)]}`,
      rainPct: ci >= 3 ? 30 + Math.floor(Math.random() * 40) : Math.floor(Math.random() * 15),
    });
  }
  return days;
}

function WeatherForecast({
  trip,
  onBack,
}: {
  trip: typeof MOCK_UPCOMING_TRIPS[0];
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const startD = new Date(trip.startDate);
  const endD = new Date(trip.endDate);
  const nights = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 86400000));
  const [weather] = useState(() => generateMockWeather(trip.startDate, nights));

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <View style={[tt.toolHeader, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[tt.toolTitle, { color: c.text, fontFamily: GEO }]}>Weather</Text>
        <Ionicons name="partly-sunny-outline" size={20} color="#4A9B8E" />
      </View>

      <ScrollView contentContainerStyle={tt.toolBody} showsVerticalScrollIndicator={false}>
        <Text style={[tt.weatherLocation, { color: c.textMuted }]}>
          {trip.city}, {trip.state}
        </Text>

        {weather.map((day) => (
          <View key={day.day} style={[tt.weatherCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={tt.weatherTop}>
              <View>
                <Text style={[tt.weatherDayLabel, { color: c.gold, fontFamily: GEO }]}>DAY {day.day}</Text>
                <Text style={[tt.weatherDate, { color: c.textMuted }]}>{day.date}</Text>
              </View>
              <View style={tt.weatherTempRow}>
                <Ionicons name={day.icon as any} size={28} color={day.condition.includes('Sunny') || day.condition.includes('sunny') ? '#C9A227' : c.textMuted} />
                <View style={tt.weatherTemps}>
                  <Text style={[tt.weatherHigh, { color: c.text, fontFamily: GEO }]}>{day.high}°</Text>
                  <Text style={[tt.weatherLow, { color: c.textMuted, fontFamily: GEO }]}>{day.low}°</Text>
                </View>
              </View>
            </View>
            <View style={[tt.weatherBottom, { borderColor: c.border }]}>
              <Text style={[tt.weatherCond, { color: c.text }]}>{day.condition}</Text>
              <View style={tt.weatherMetaRow}>
                <View style={tt.weatherMetaItem}>
                  <Ionicons name="flag-outline" size={12} color={c.textMuted} />
                  <Text style={[tt.weatherMetaText, { color: c.textMuted }]}>{day.wind}</Text>
                </View>
                <View style={tt.weatherMetaItem}>
                  <Ionicons name="water-outline" size={12} color={day.rainPct > 30 ? c.urgent : c.teal} />
                  <Text style={[tt.weatherMetaText, { color: day.rainPct > 30 ? c.urgent : c.teal }]}>
                    {day.rainPct}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPETITION MODE — CEREMONY ANIMATION
// ═══════════════════════════════════════════════════════════════════════
function CompetitionCeremony({
  trip,
  players,
  visible,
  onComplete,
}: {
  trip: typeof MOCK_UPCOMING_TRIPS[0];
  players: TripPlayer[];
  visible: boolean;
  onComplete: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(30)).current;
  const badgeFade = useRef(new Animated.Value(0)).current;
  const avatarsFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    // Reset values for re-entry
    fadeAnim.setValue(0);
    titleSlide.setValue(30);
    badgeFade.setValue(0);
    avatarsFade.setValue(0);

    // Phase 1: Masters green wash fills screen
    // Phase 2: Trip name + COMPETITION IS LIVE + avatars animate in
    // Phase 3: Auto-transition after 3 seconds
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(titleSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(badgeFade, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
      ]),
      Animated.timing(avatarsFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent={false}>
      <Pressable onPress={onComplete} style={cm.ceremonyScreen}>
        <LinearGradient
          colors={['#0A2A1A', '#1E4D2B', '#2D6A3F', '#1E4D2B', '#0A2A1A']}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={[cm.ceremonyContent, { opacity: fadeAnim }]}>
          <Text style={[cm.ceremonyBrand, { fontFamily: GEO }]}>DORMIE</Text>

          <Animated.View style={{ transform: [{ translateY: titleSlide }] }}>
            <Text style={[cm.ceremonyTripName, { fontFamily: GEO }]}>{trip.name}</Text>
          </Animated.View>

          <Animated.View style={[cm.ceremonyBadge, { opacity: badgeFade }]}>
            <View style={cm.liveIndicator} />
            <Text style={[cm.ceremonyLive, { fontFamily: GEO }]}>COMPETITION IS LIVE</Text>
          </Animated.View>

          <Animated.View style={[cm.ceremonyAvatarRow, { opacity: avatarsFade }]}>
            {players.filter((p) => p.rsvp === 'confirmed').map((p) => (
              <View key={p.id} style={cm.ceremonyAvatarWrap}>
                <Avatar id={p.id} size={44} name={p.name} />
                <Text style={cm.ceremonyAvatarName}>{p.name.split(' ')[0]}</Text>
              </View>
            ))}
          </Animated.View>

          <Text style={cm.ceremonyTap}>Tap to continue</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPETITION MODE — LEADERBOARD DATA
// ═══════════════════════════════════════════════════════════════════════
type CompPlayer = {
  id: string;
  name: string;
  handicap: number;
  rounds: (number | null)[];
  total: number | null;
};

// CompPlayer data is now fetched from tripsService.getLeaderboard()

type SideGameEntry = {
  id: string;
  name: string;
  icon: string;
  status: 'active' | 'settled';
  leader: string;
  amount: string;
  rules: string;
};

const MOCK_SIDE_GAMES: SideGameEntry[] = [
  { id: 'sg1', name: 'Skins', icon: 'cash', status: 'active', leader: 'Tommy F.', amount: '$20/hole', rules: 'Win a hole outright to collect the skin. Ties carry over to the next hole.' },
  { id: 'sg2', name: 'Nassau', icon: 'swap-horizontal', status: 'active', leader: 'Ian M.', amount: '$10 front/back/total', rules: 'Three bets in one: front 9, back 9, and overall match. Automatic press at 2 down.' },
  { id: 'sg3', name: 'Dots (Trash)', icon: 'ellipsis-horizontal', status: 'active', leader: 'Drew P.', amount: '$1/dot', rules: 'Points for greenies, sandies, barkies, poleys. Most dots at end wins.' },
  { id: 'sg4', name: 'Snake', icon: 'git-branch', status: 'active', leader: 'Jake S.', amount: '$5/snake', rules: 'First 3-putt gets the snake. Pass the snake on each subsequent 3-putt. Holder at end of round pays.' },
];

const MOCK_COMP_MOMENTS = [
  { id: 'cm1', text: 'Tommy just eagled the 5th! 🦅', author: 'Ian McGowan', time: '20 min ago' },
  { id: 'cm2', text: 'Drew chipped in from the bunker on 11', author: 'Jake Sullivan', time: '45 min ago' },
];

// ═══════════════════════════════════════════════════════════════════════
// COMPETITION VIEW
// ═══════════════════════════════════════════════════════════════════════
function CompetitionView({
  trip,
  courses,
  onScoreHole,
  onQuickEntry,
  onExit,
  onFinishTrip,
}: {
  trip: typeof MOCK_UPCOMING_TRIPS[0];
  courses: TripCourse[];
  onScoreHole: () => void;
  onQuickEntry: () => void;
  onExit: () => void;
  onFinishTrip: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const MASTERS = '#1E4D2B';

  const [scoreMode, setScoreMode] = useState<'gross' | 'net'>('gross');
  const [expandedSideGame, setExpandedSideGame] = useState<string | null>(null);
  const [moments, setMoments] = useState<any[]>(MOCK_COMP_MOMENTS);
  const [unreadChat] = useState(3);
  const [compPlayers, setCompPlayers] = useState<CompPlayer[]>([]);

  // Load real moments
  useEffect(() => {
    momentsService.getByTrip(trip.id).then((data) => {
      if (data.length > 0) setMoments(data);
    }).catch(() => {});
  }, [trip.id]);

  useEffect(() => {
    tripsService.getLeaderboard(trip.id).then((entries) => {
      setCompPlayers(entries.map((e: any) => ({
        id: e.user_id,
        name: e.user_name,
        handicap: e.handicap ?? 0,
        rounds: [],
        total: e.total_gross ?? null,
      })));
    }).catch(() => {});
  }, [trip.id]);

  const coursePar = 72;
  const currentDay = 2;
  const totalDays = trip.roundsPlanned ?? 3;

  // Sort players
  const sortedPlayers = [...compPlayers].sort((a, b) => {
    if (a.total === null && b.total === null) return 0;
    if (a.total === null) return 1;
    if (b.total === null) return -1;
    if (scoreMode === 'net') {
      const aNet = a.total - a.handicap * (a.rounds.filter((r) => r !== null).length);
      const bNet = b.total - b.handicap * (b.rounds.filter((r) => r !== null).length);
      return aNet - bNet;
    }
    return a.total - b.total;
  });

  const getPlayerTotal = (p: CompPlayer) => {
    if (p.total === null) return '-';
    if (scoreMode === 'net') {
      const roundsPlayed = p.rounds.filter((r) => r !== null).length;
      return p.total - p.handicap * roundsPlayed;
    }
    return p.total;
  };

  const getToPar = (p: CompPlayer) => {
    if (p.total === null) return '';
    const roundsPlayed = p.rounds.filter((r) => r !== null).length;
    let total = p.total;
    if (scoreMode === 'net') total = p.total - p.handicap * roundsPlayed;
    const par = coursePar * roundsPlayed;
    const diff = total - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  const toParColor = (p: CompPlayer) => {
    const tp = getToPar(p);
    if (tp === '' || tp === 'E') return c.text;
    return tp.startsWith('-') ? c.teal : c.urgent;
  };

  const todayCourse = courses.find((co) => co.day === currentDay) ?? courses[0];

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      {/* Masters green header */}
      <LinearGradient
        colors={greenHeaderGradient as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={cm.compHeader}
      >
        <View style={cm.compHeaderTop}>
          <Pressable onPress={onExit} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <View style={cm.compLiveBadge}>
            <View style={cm.compLiveDot} />
            <Text style={[cm.compLiveText, { fontFamily: GEO }]}>LIVE</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>
        <Text style={[cm.compTripName, { fontFamily: GEO }]}>{trip.name}</Text>

        {/* Day pills */}
        <View style={cm.dayPillRow}>
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
            const isActive = day === currentDay;
            const isComplete = day < currentDay;
            return (
              <View
                key={day}
                style={[
                  cm.dayPill,
                  isActive && cm.dayPillActive,
                  isComplete && cm.dayPillComplete,
                ]}
              >
                <Text style={[cm.dayPillText, { fontFamily: GEO }, isActive && cm.dayPillTextActive]}>
                  DAY {day}
                </Text>
              </View>
            );
          })}
        </View>
      </LinearGradient>

      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <View style={cm.compBody}>
          {/* LEADERBOARD */}
          <View style={cm.lbHeaderRow}>
            <Text style={[cm.lbTitle, { color: c.gold, fontFamily: GEO }]}>LEADERBOARD</Text>
            <View style={cm.toggleRow}>
              <Pressable
                onPress={() => setScoreMode('gross')}
                style={[cm.toggleBtn, scoreMode === 'gross' && { backgroundColor: `${c.teal}20` }]}
              >
                <Text style={[cm.toggleText, { color: scoreMode === 'gross' ? c.teal : c.textMuted }]}>Gross</Text>
              </Pressable>
              <Pressable
                onPress={() => setScoreMode('net')}
                style={[cm.toggleBtn, scoreMode === 'net' && { backgroundColor: `${c.teal}20` }]}
              >
                <Text style={[cm.toggleText, { color: scoreMode === 'net' ? c.teal : c.textMuted }]}>Net</Text>
              </Pressable>
            </View>
          </View>

          {/* Column headers */}
          <View style={[cm.lbColHeaders, { borderColor: c.border }]}>
            <Text style={[cm.lbColPos, { color: c.textMuted }]}>POS</Text>
            <Text style={[cm.lbColPlayer, { color: c.textMuted }]}>PLAYER</Text>
            {Array.from({ length: totalDays }, (_, i) => (
              <Text key={i} style={[cm.lbColRound, { color: c.textMuted }]}>R{i + 1}</Text>
            ))}
            <Text style={[cm.lbColTotal, { color: c.textMuted }]}>TOT</Text>
            <Text style={[cm.lbColPar, { color: c.textMuted }]}>PAR</Text>
          </View>

          {/* Player rows */}
          {sortedPlayers.map((p, i) => (
            <View
              key={p.id}
              style={[
                cm.lbRow,
                {
                  backgroundColor: i === 0 ? `${c.gold}08` : c.cardBg,
                  borderColor: i === 0 ? c.gold : c.border,
                },
              ]}
            >
              <Text style={[cm.lbPos, { color: i === 0 ? c.gold : c.textMuted, fontFamily: GEO }]}>
                {i + 1}
              </Text>
              <View style={cm.lbPlayerCell}>
                <Avatar id={p.id} size={24} name={p.name} />
                <Text style={[cm.lbPlayerName, { color: c.text }]} numberOfLines={1}>
                  {p.name.split(' ')[1] ?? p.name}
                </Text>
              </View>
              {p.rounds.map((r, ri) => (
                <Text key={ri} style={[cm.lbRoundScore, { color: r !== null ? c.text : c.textMuted, fontFamily: GEO }]}>
                  {r ?? '-'}
                </Text>
              ))}
              <Text style={[cm.lbTotal, { color: c.text, fontFamily: GEO }]}>
                {getPlayerTotal(p)}
              </Text>
              <Text style={[cm.lbPar, { color: toParColor(p), fontFamily: GEO }]}>
                {getToPar(p)}
              </Text>
            </View>
          ))}

          {/* TODAY'S COURSE */}
          <Text style={[cm.compSectionTitle, { color: c.gold, fontFamily: GEO }]}>TODAY'S COURSE</Text>
          {todayCourse && (
            <View style={[cm.courseCard, { borderColor: c.border }]}>
              <LinearGradient
                colors={todayCourse.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={cm.courseGradient}
              >
                <View style={cm.courseOverlay} />
                <View style={cm.courseDayBadge}>
                  <Text style={[cm.courseDayText, { fontFamily: GEO }]}>DAY {todayCourse.day}</Text>
                </View>
                <Text style={[cm.courseName, { fontFamily: GEO }]}>{todayCourse.name}</Text>
                <Text style={cm.courseTime}>{todayCourse.teeTime}</Text>
              </LinearGradient>
              <View style={[cm.courseStats, { backgroundColor: c.cardBg }]}>
                {[
                  { label: 'PAR', value: `${todayCourse.par}` },
                  { label: 'RATING', value: todayCourse.rating.toFixed(1) },
                  { label: 'SLOPE', value: `${todayCourse.slope}` },
                  { label: 'YARDS', value: todayCourse.yards.toLocaleString() },
                ].map((st) => (
                  <View key={st.label} style={cm.courseStat}>
                    <Text style={[cm.courseStatVal, { color: c.text, fontFamily: GEO }]}>{st.value}</Text>
                    <Text style={[cm.courseStatLabel, { color: c.textMuted }]}>{st.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ACTION BUTTONS */}
          <View style={cm.actionBtns}>
            <Pressable onPress={onScoreHole} style={cm.actionPrimary}>
              <LinearGradient colors={greenHeaderGradient as unknown as string[]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="golf" size={18} color="#C9A227" />
              <Text style={[cm.actionPrimaryText, { fontFamily: GEO }]}>Score Hole-by-Hole</Text>
            </Pressable>
            <Pressable onPress={onQuickEntry} style={[cm.actionSecondary, { borderColor: c.border, backgroundColor: c.cardBg }]}>
              <Ionicons name="keypad-outline" size={16} color={c.teal} />
              <Text style={[cm.actionSecondaryText, { color: c.teal }]}>Quick Total Entry</Text>
            </Pressable>
          </View>

          {/* SIDE GAMES */}
          <Text style={[cm.compSectionTitle, { color: c.gold, fontFamily: GEO }]}>SIDE GAMES</Text>
          {MOCK_SIDE_GAMES.map((sg) => {
            const isExpanded = expandedSideGame === sg.id;
            return (
              <Pressable
                key={sg.id}
                onPress={() => setExpandedSideGame(isExpanded ? null : sg.id)}
                style={[cm.sideGameCard, { backgroundColor: c.cardBg, borderColor: c.border }]}
              >
                <View style={cm.sideGameTop}>
                  <Ionicons name={sg.icon as any} size={18} color={c.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={[cm.sideGameName, { color: c.text }]}>{sg.name}</Text>
                    <Text style={[cm.sideGameMeta, { color: c.textMuted }]}>
                      {sg.amount} · Leader: {sg.leader}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={c.textMuted}
                  />
                </View>
                {isExpanded && (
                  <View style={[cm.sideGameRules, { borderColor: c.border }]}>
                    <Text style={[cm.sideGameRulesText, { color: c.textMuted }]}>{sg.rules}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}

          {/* ALL COURSES */}
          <Text style={[cm.compSectionTitle, { color: c.gold, fontFamily: GEO }]}>ALL COURSES</Text>
          {courses.map((co) => {
            const isComplete = co.day < currentDay;
            const isToday = co.day === currentDay;
            return (
              <View
                key={co.id}
                style={[cm.allCourseRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
              >
                <View style={[cm.allCourseDot, { backgroundColor: isComplete ? c.teal : isToday ? c.gold : c.textMuted }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[cm.allCourseName, { color: c.text }]}>{co.name}</Text>
                  <Text style={[cm.allCourseMeta, { color: c.textMuted }]}>Day {co.day} · {co.teeTime}</Text>
                </View>
                <View style={[cm.allCourseStatus, { backgroundColor: isComplete ? `${c.teal}15` : isToday ? `${c.gold}15` : c.elevated }]}>
                  <Text style={[cm.allCourseStatusText, { color: isComplete ? c.teal : isToday ? c.gold : c.textMuted }]}>
                    {isComplete ? 'COMPLETE' : isToday ? 'TODAY' : 'UPCOMING'}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* TRIP MOMENTS */}
          <Text style={[cm.compSectionTitle, { color: c.gold, fontFamily: GEO }]}>TRIP MOMENTS</Text>
          {moments.map((m: any) => {
            const authorName = m.user?.name ?? m.author ?? '';
            const timeStr = m.created_at ? formatTimeAgo(m.created_at) : m.time ?? '';
            return (
              <View key={m.id} style={[cm.momentRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                {m.user && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Avatar id={m.user.id} size={24} name={authorName} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: c.text }}>{authorName}</Text>
                  </View>
                )}
                <Text style={[cm.momentText, { color: c.text }]}>{m.text}</Text>
                {m.photo_url && (
                  <Image source={{ uri: m.photo_url }} style={{ width: '100%', height: 160, marginTop: 8 }} resizeMode="cover" />
                )}
                <View style={cm.momentMeta}>
                  {!m.user && <Text style={[cm.momentAuthor, { color: c.textMuted }]}>{authorName}</Text>}
                  <Text style={[cm.momentTime, { color: c.textMuted }]}>{timeStr}</Text>
                </View>
              </View>
            );
          })}
          <Pressable style={[cm.addMomentBtn, { borderColor: c.border }]}>
            <Ionicons name="add-circle-outline" size={16} color={c.teal} />
            <Text style={[cm.addMomentText, { color: c.teal }]}>Add Moment</Text>
          </Pressable>

          {/* FINISH TRIP */}
          <Pressable
            onPress={() => {
              haptics.light();
              onFinishTrip();
            }}
            style={[cm.actionPrimary, { marginTop: 24, backgroundColor: c.gold }]}
          >
            <Ionicons name="flag" size={18} color="#000000" />
            <Text style={[cm.actionPrimaryText, { fontFamily: GEO, color: '#000000' }]}>Finish Trip</Text>
          </Pressable>

          <View style={{ height: 80 }} />
        </View>
      </ScrollView>

      {/* Floating chat button */}
      <Pressable style={cm.chatFab}>
        <LinearGradient colors={greenHeaderGradient as unknown as string[]} style={StyleSheet.absoluteFill} />
        <Ionicons name="chatbubbles" size={22} color="#fff" />
        {unreadChat > 0 && (
          <View style={cm.chatBadge}>
            <Text style={cm.chatBadgeText}>{unreadChat}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════
function TripDetailScreenInner() {
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const { user } = useAuth();

  const mockTrip = MOCK_UPCOMING_TRIPS.find((t) => t.id === params.tripId);

  // Fetch real trip from Supabase for Ryder Cup trips (when tripId doesn't match mock data)
  const [dbTrip, setDbTrip] = useState<Trip | null>(null);
  const [dbLoading, setDbLoading] = useState(!mockTrip && !!params.tripId);

  useEffect(() => {
    if (!mockTrip && params.tripId) {
      tripsService.getById(params.tripId).then((data) => {
        if (data) {
          // Map DB Trip to local Trip shape
          setDbTrip({
            id: data.id,
            name: data.name,
            destination: data.location,
            city: (data.city || data.location?.split(',')[0]) ?? '',
            state: (data.state || data.location?.split(',')[1]?.trim()) ?? '',
            startDate: data.start_date,
            endDate: data.end_date,
            status: data.status as TripStatus,
            inviteCode: data.invite_code || '',
            isRyderCup: data.trip_type === 'ryder',
            createdBy: data.organizer_id,
            playerIds: (data.trip_members || []).map((m: any) => m.user_id),
            roundsPlanned: (data.ryder_cup_config as any)?.sessions?.length ?? 3,
            gradient: (data.gradient as [string, string]) ?? ['#1565C0', '#B71C1C'],
          });
        }
        setDbLoading(false);
      }).catch(() => setDbLoading(false));
    }
  }, [mockTrip, params.tripId]);

  const trip = mockTrip ?? dbTrip ?? MOCK_UPCOMING_TRIPS[0];

  if (dbLoading) {
    return (
      <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center' }, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.textMuted }}>Loading...</Text>
      </View>
    );
  }

  // Ryder Cup trips get their own dedicated view
  if (trip.isRyderCup) {
    return <Suspense fallback={<View style={{ flex: 1 }} />}><RyderCupHub trip={trip} /></Suspense>;
  }

  const daysUntil = getDaysUntilTrip(trip.startDate);
  const insets = useSafeAreaInsets();

  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('Clubhouse');
  const [checklist, setChecklist] = useState(MOCK_CHECKLIST);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [showCeremony, setShowCeremony] = useState(false);
  const [competitionMode, setCompetitionMode] = useState(false);
  const [chatLastActive, setChatLastActive] = useState<Date>(new Date());

  // Moments state
  const [realMoments, setRealMoments] = useState<TripMomentWithUser[]>([]);
  const [showAddMoment, setShowAddMoment] = useState(false);
  const [momentText, setMomentText] = useState('');
  const [momentPhoto, setMomentPhoto] = useState<string | null>(null);
  const [submittingMoment, setSubmittingMoment] = useState(false);

  // Load moments from Supabase
  useEffect(() => {
    momentsService.getByTrip(trip.id).then(setRealMoments).catch(() => {});
  }, [trip.id]);

  const handlePickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setMomentPhoto(result.assets[0].uri);
    }
  }, []);

  const handleSubmitMoment = useCallback(async () => {
    if (!user || !momentText.trim()) return;
    setSubmittingMoment(true);
    try {
      await momentsService.create(trip.id, user.id, momentText.trim(), momentPhoto ?? undefined);
      const updated = await momentsService.getByTrip(trip.id);
      setRealMoments(updated);
      setMomentText('');
      setMomentPhoto(null);
      setShowAddMoment(false);
      haptics.success();
      showToast({ message: 'Moment added', type: 'success' });
    } catch {
      Alert.alert('Error', 'Failed to add moment. Please try again.');
    }
    setSubmittingMoment(false);
  }, [user, trip.id, momentText, momentPhoto, showToast]);

  // Haptic-enhanced tab switching
  const handleTabSwitch = useCallback((tab: Tab) => {
    haptics.light();
    setActiveTab(tab);
    if (tab === '19th Hole') setChatLastActive(new Date());
  }, []);

  const toggleCheck = useCallback((id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );
  }, []);

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  };

  // Item 13: After ceremony completes, set competitionMode to true
  const handleCeremonyComplete = useCallback(() => {
    setShowCeremony(false);
    setCompetitionMode(true);
    haptics.heavy();
    showToast({ message: 'Trip created', type: 'success', icon: 'flag-outline' });
  }, [showToast]);

  const [tripCompleted, setTripCompleted] = useState(false);

  const handleFinishTrip = useCallback(async () => {
    Alert.alert(
      'Finish Trip',
      `End ${trip.name} and see the final results?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          style: 'destructive',
          onPress: async () => {
            try {
              await tripsService.update(trip.id, { status: 'completed' });

              // Fetch leaderboard for recap
              const leaderboard = await tripsService.getLeaderboard(trip.id);
              const winner = leaderboard[0];
              const coursesPlayed = MOCK_COURSES.length;
              const bestRound = leaderboard.reduce(
                (best: any, entry: any) => (!best || (entry.best_round && entry.best_round < best.score))
                  ? { player: entry.user_name, score: entry.best_round }
                  : best,
                null as { player: string; score: number } | null,
              );

              setTripCompleted(true);
              setCompetitionMode(false);
              haptics.success();

              Alert.alert(
                `${trip.name} Complete!`,
                [
                  winner ? `Winner: ${winner.user_name}` : '',
                  `Courses Played: ${coursesPlayed}`,
                  bestRound ? `Best Round: ${bestRound.score} by ${bestRound.player}` : '',
                ].filter(Boolean).join('\n'),
                [{ text: 'Celebrate', onPress: () => showToast({ message: `${winner?.user_name ?? 'Champion'} wins!`, type: 'success', icon: 'trophy-outline' }) }],
              );
            } catch {
              Alert.alert('Error', 'Failed to finish trip. Please try again.');
            }
          },
        },
      ],
    );
  }, [trip, showToast]);

  // Competition mode routing
  if (competitionMode) {
    return (
      <CompetitionView
        trip={trip}
        courses={MOCK_COURSES}
        onScoreHole={() => router.push({ pathname: '/scoring', params: { tripId: trip.id } })}
        onQuickEntry={() => Alert.alert('Quick Entry', 'Enter total score for the round.')}
        onExit={() => setCompetitionMode(false)}
        onFinishTrip={handleFinishTrip}
      />
    );
  }

  // Trip tool routing
  const closeTool = () => setActiveTool(null);

  if (activeTool === 'tt1') {
    return <BudgetCalculator trip={trip} playerCount={MOCK_PLAYERS.length} onBack={closeTool} />;
  }
  if (activeTool === 'tt2') {
    return <PackingList onBack={closeTool} />;
  }
  if (activeTool === 'tt3') {
    return <TeeTimeGroups players={MOCK_PLAYERS} courses={MOCK_COURSES} onBack={closeTool} />;
  }
  if (activeTool === 'tt4') {
    return <RSVPPreview trip={trip} players={MOCK_PLAYERS} courses={MOCK_COURSES} onBack={closeTool} />;
  }
  if (activeTool === 'tt5') {
    return <TripAwards onBack={closeTool} />;
  }
  if (activeTool === 'tt6') {
    return <WeatherForecast trip={trip} onBack={closeTool} />;
  }

  const MASTERS_GREEN = '#1E4D2B';
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [200, 60],
    extrapolate: 'clamp',
  });
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />

      {/* ─── SCROLLABLE CONTENT WITH STICKY TAB BAR ───────────────── */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        stickyHeaderIndices={[2]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        {/* Index 0: GREEN HEADER (parallax — compresses from ~200px to ~60px) */}
        <Animated.View style={{ minHeight: headerHeight, overflow: 'hidden' }}>
          <LinearGradient
            colors={['#1E4D2B', '#0D2818']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.greenHeader, { paddingTop: STATUS_BAR_H }]}
          >
            {/* Pinstripe texture */}
            <Pinstripes />

            {/* Top bar — always visible */}
            <View style={s.topBar}>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="chevron-back" size={24} color="#E8E4DE" />
              </Pressable>
              <Text style={[s.branding, { color: c.gold, fontFamily: GEO }]}>DORMIE</Text>
              <View style={s.topBarRight}>
                <Pressable onPress={toggleTheme} hitSlop={8}>
                  <Ionicons
                    name={theme.isDark ? 'sunny-outline' : 'moon-outline'}
                    size={20}
                    color="rgba(255,255,255,0.6)"
                  />
                </Pressable>
                <Pressable hitSlop={8}>
                  <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.6)" />
                </Pressable>
                <Pressable hitSlop={8}>
                  <Ionicons name="share-outline" size={20} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>
            </View>

            {/* Hero content — fades on scroll */}
            <Animated.View style={[s.hero, { opacity: heroOpacity }]}>
              <View style={s.heroLeft}>
                <Text style={[s.heroName, { color: '#fff', fontFamily: GEO }]}>{trip.name}</Text>
                <Text style={[s.heroLocation, { color: 'rgba(255,255,255,0.7)' }]}>
                  {trip.destination} · {trip.city}, {trip.state}
                </Text>
                <Text style={[s.heroDateRange, { color: 'rgba(255,255,255,0.6)' }]}>
                  {formatDateRange(trip.startDate, trip.endDate)}
                </Text>
              </View>
              <View style={s.heroRight}>
                <TripCountdownRing daysUntil={daysUntil} size={80} totalDays={60} textColor="#FFFFFF" />
                <Pressable
                  onPress={() => setShowCeremony(true)}
                  style={[s.startTripBtn, { backgroundColor: 'rgba(201,162,39,0.15)', borderColor: 'rgba(201,162,39,0.3)', borderWidth: 1 }]}
                >
                  <Ionicons name="play" size={12} color="#C9A227" />
                  <Text style={[s.startTripText, { fontFamily: GEO }]}>Start Trip</Text>
                </Pressable>
              </View>
            </Animated.View>

            <GoldDivider style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
          </LinearGradient>
        </Animated.View>

        {/* Index 1: PLAYER ROW */}
        <FlatList
          data={MOCK_PLAYERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          getItemLayout={(_data, index) => ({
            length: 80,
            offset: 80 * index,
            index,
          })}
          windowSize={5}
          removeClippedSubviews={true}
          contentContainerStyle={s.playerRowScroll}
          style={[s.playerRowContainer, { backgroundColor: c.bg }]}
          renderItem={({ item }) => {
            const rsvpCol =
              item.rsvp === 'confirmed' ? c.teal : item.rsvp === 'pending' ? c.gold : c.urgent;
            return (
              <View style={[s.playerCard, { backgroundColor: c.cardBg, borderColor: c.border }]} accessibilityLabel={`${item.name}, ${item.handicap} handicap, ${item.rsvp}`}>
                <View style={s.playerCardAvatarWrap}>
                  <View style={[s.avatarRing, item.rsvp === 'confirmed' && { borderColor: c.teal, borderWidth: 2 }]}>
                    <Avatar id={item.id} size={36} name={item.name} />
                  </View>
                  <View style={[s.rsvpIndicator, { backgroundColor: rsvpCol }]} />
                </View>
                <Text style={[s.playerCardName, { color: c.text }]} numberOfLines={1}>
                  {item.name.split(' ')[0]}
                </Text>
                <Text style={[s.playerCardHcp, { color: c.textMuted, fontFamily: GEO }]}>
                  {item.handicap}
                </Text>
              </View>
            );
          }}
        />

        {/* Index 2: STICKY TAB BAR (pinned via stickyHeaderIndices) */}
        <View style={[s.tabBarWrap, { backgroundColor: c.bg, borderColor: c.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tabBarScroll}
          >
            {TABS.map((tab) => {
              const active = tab === activeTab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => handleTabSwitch(tab)}
                  accessibilityLabel={`${tab} tab${active ? ', selected' : ''}`}
                  style={[s.tabItem, active && { borderBottomColor: c.teal, borderBottomWidth: 2 }]}
                >
                  <Text
                    style={[
                      s.tabText,
                      { color: active ? c.teal : c.textMuted },
                      active && { fontWeight: '700' },
                    ]}
                  >
                  {tab}
                </Text>
              </Pressable>
            );
          })}
          </ScrollView>
        </View>

        {/* Index 3: TAB CONTENT */}
        <View style={{ minHeight: 500, backgroundColor: c.bg }}>
          {activeTab === 'Clubhouse' && (
            <ClubhouseTab trip={trip} checklist={checklist} onToggleCheck={toggleCheck} onToolPress={setActiveTool} realMoments={realMoments} onAddMoment={() => setShowAddMoment(true)} />
          )}
          {activeTab === 'Courses' && <CoursesTab />}
          {activeTab === 'Players' && <PlayersTab />}
          {activeTab === 'Checklist' && <ChecklistTab checklist={checklist} onToggle={toggleCheck} />}
          {activeTab === '19th Hole' && <ChatTab tripId={trip.id} userId={user?.id ?? ''} />}
        </View>
      </Animated.ScrollView>

      {/* Item 14: Floating chat button with unread badge */}
      {activeTab !== '19th Hole' && (
        <Pressable
          onPress={() => setActiveTab('19th Hole')}
          style={[s.floatingChatBtn, { bottom: 24 + insets.bottom }]}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
          {/* Unread badge */}
          <View style={s.unreadBadge}>
            <Text style={s.unreadBadgeText}>3</Text>
          </View>
        </Pressable>
      )}

      {/* Item 13: Competition ceremony modal */}
      <CompetitionCeremony
        trip={trip}
        players={MOCK_PLAYERS}
        visible={showCeremony}
        onComplete={handleCeremonyComplete}
      />

      {/* Add Moment Modal */}
      <Modal visible={showAddMoment} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOverlay}
        >
          <View style={[s.momentModal, { backgroundColor: c.surface }]}>
            <View style={s.momentModalHeader}>
              <Text style={[s.momentModalTitle, { color: c.text, fontFamily: GEO }]}>Add Moment</Text>
              <Pressable onPress={() => { setShowAddMoment(false); setMomentText(''); setMomentPhoto(null); }} hitSlop={12}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </Pressable>
            </View>

            <TextInput
              style={[s.momentInput, { color: c.text, backgroundColor: c.cardBg, borderColor: c.border }]}
              placeholder="What happened on the course?"
              placeholderTextColor={c.textMuted}
              value={momentText}
              onChangeText={setMomentText}
              multiline
              maxLength={500}
            />

            {momentPhoto && (
              <View style={s.momentPhotoPreview}>
                <Image source={{ uri: momentPhoto }} style={s.momentPhotoImg} resizeMode="cover" />
                <Pressable onPress={() => setMomentPhoto(null)} style={s.momentPhotoRemove}>
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </Pressable>
              </View>
            )}

            <View style={s.momentModalActions}>
              <Pressable onPress={handlePickPhoto} style={[s.momentPhotoBtn, { borderColor: c.border }]}>
                <Ionicons name="camera-outline" size={20} color={c.teal} />
                <Text style={[s.momentPhotoBtnText, { color: c.teal }]}>Photo</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitMoment}
                disabled={!momentText.trim() || submittingMoment}
                style={[
                  s.momentSubmitBtn,
                  { backgroundColor: momentText.trim() ? c.teal : c.elevated },
                ]}
              >
                <Text style={s.momentSubmitText}>
                  {submittingMoment ? 'Posting...' : 'Post Moment'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },

  /* Green header */
  greenHeader: {
    paddingBottom: 4,
    overflow: 'hidden',
  },

  /* Top bar */
  topBar: {
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  branding: {
    fontSize: 9,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 3,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },

  /* Hero */
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  heroLeft: { flex: 1, marginRight: 16 },
  heroRight: { alignItems: 'center', gap: 8 },
  heroName: { fontSize: 26, fontWeight: '700', lineHeight: 30, letterSpacing: -1 },
  heroLocation: { fontSize: 13, marginTop: 4 },
  heroDateRange: { fontSize: 12, marginTop: 4 },
  startTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  startTripText: { color: '#C9A227', fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  /* Player row */
  playerRowContainer: {
    maxHeight: 110,
  },
  playerRowScroll: {
    paddingHorizontal: 12,
    gap: 8,
    paddingVertical: 8,
  },
  playerCard: {
    width: 88,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  playerCardAvatarWrap: {
    position: 'relative',
  },
  avatarRing: {
    padding: 2,
    borderColor: 'transparent',
    borderWidth: 2,
  },
  rsvpIndicator: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: '#1A1816',
  },
  playerCardName: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  playerCardHcp: { fontSize: 13, fontWeight: '700', marginTop: 2 },

  /* Tab bar */
  tabBarWrap: {
    borderBottomWidth: 1,
  },
  tabBarScroll: {
    paddingHorizontal: 16,
    gap: 0,
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },

  /* Section label */
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  /* Tab content */
  tabContent: {
    paddingHorizontal: 20,
  },

  /* Chat preview (Clubhouse) */
  chatPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  chatPreviewName: { fontSize: 12, fontWeight: '600' },
  chatPreviewText: { fontSize: 12, marginTop: 1 },
  chatPreviewTime: { fontSize: 10 },

  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    minHeight: 64,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 8, fontWeight: '600', letterSpacing: 1, marginTop: 4, textTransform: 'uppercase' as const },

  /* Invite code */
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
  },
  inviteCode: { fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  inviteCopyWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inviteCopyText: { fontSize: 12, fontWeight: '600' },

  /* Checklist (clubhouse collapsible) */
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    marginTop: 20,
  },
  checklistTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  checklistTitle: { fontSize: 14, fontWeight: '600' },
  checklistCount: { fontSize: 12 },
  progressTrack: { height: 4, width: '100%' },
  progressFill: { height: 4 },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { fontSize: 13, flex: 1 },
  checkTextDone: { textDecorationLine: 'line-through' },

  /* Side games */
  sideGamePillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sideGamePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  sideGamePillText: { fontSize: 12, fontWeight: '600' },

  /* Trip moments */
  momentRow: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  momentText: { fontSize: 13, lineHeight: 18 },
  momentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  momentAuthor: { fontSize: 11 },
  momentTime: { fontSize: 11 },
  addMomentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 10,
  },
  addMomentText: { fontSize: 12, fontWeight: '600' },
  momentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  momentAuthorName: { fontSize: 12, fontWeight: '600' },
  momentPhoto: {
    width: '100%',
    height: 160,
    marginTop: 8,
  },

  /* Add Moment Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  momentModal: {
    padding: 20,
    paddingBottom: 40,
  },
  momentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  momentModalTitle: { fontSize: 18, fontWeight: '700' },
  momentInput: {
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  momentPhotoPreview: {
    marginTop: 12,
    position: 'relative',
  },
  momentPhotoImg: {
    width: '100%',
    height: 160,
  },
  momentPhotoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  momentModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  momentPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  momentPhotoBtnText: { fontSize: 13, fontWeight: '600' },
  momentSubmitBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  momentSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  /* H2H */
  h2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  h2hName: { fontSize: 13, fontWeight: '600' },
  h2hRecord: { fontSize: 11, marginTop: 2 },
  h2hPct: { fontSize: 18, fontWeight: '700' },

  /* Trip tools */
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  toolLabel: { fontSize: 13, fontWeight: '600' },

  /* Courses tab */
  courseCard: {
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  courseGradient: {},
  courseImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  courseGradientContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  courseDayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  courseDayText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  courseCardName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  courseTeeTime: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  courseStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  courseStatItem: { alignItems: 'center' },
  courseStatValue: { fontSize: 15, fontWeight: '700' },
  courseStatLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 2, marginTop: 2, textTransform: 'uppercase' as const },
  courseVoteRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  voteText: { fontSize: 12, fontWeight: '600' },

  /* Players tab */
  fullPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullPlayerName: { fontSize: 14, fontWeight: '600' },
  rsvpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rsvpDot: { width: 6, height: 6, borderRadius: 0 },
  rsvpText: { fontSize: 10, fontWeight: '600' },
  fullPlayerHcp: { fontSize: 11, marginTop: 2 },
  playerStatsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  playerStatText: { fontSize: 11 },

  /* Checklist tab */
  checkProgressBox: {
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  checkProgressNum: { fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  checkProgressLabel: { fontSize: 12, marginTop: 2 },
  fullCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  fullCheckText: { fontSize: 14, flex: 1 },

  /* Chat tab */
  chatScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chatMsgWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  chatBubbleWrap: {
    flex: 1,
    maxWidth: '80%',
  },
  chatBubbleWrapMe: {
    alignItems: 'flex-end',
    marginLeft: 'auto',
  },
  chatMsgAuthor: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  chatBubble: {
    borderWidth: 1,
    padding: 10,
  },
  chatMsgText: { fontSize: 14, lineHeight: 19 },
  chatMsgBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  chatMsgTime: { fontSize: 10 },
  reactionsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 10, fontWeight: '600' },
  emojiPicker: {
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    marginTop: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  emojiOption: {
    padding: 4,
  },
  emojiOptionText: { fontSize: 18 },
  chatInputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Trash talk */
  trashTalkBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashTalkPanel: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  trashTalkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  trashTalkTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    flex: 1,
  },
  trashTalkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  trashTalkChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  trashTalkChipText: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Item 14: Floating chat button */
  floatingChatBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 50,
    height: 50,
    backgroundColor: '#1E4D2B',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    backgroundColor: '#C41E3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});

// ─── Trip Tool Styles ───────────────────────────────────────────────
const tt = StyleSheet.create({
  /* Shared tool header */
  toolHeader: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  toolTitle: { fontSize: 16, fontWeight: '700' },
  toolBody: { paddingHorizontal: 16, paddingTop: 12 },

  /* Budget */
  budgetSummaryRow: { flexDirection: 'row', gap: 8 },
  budgetSummaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
  },
  budgetSummaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  budgetSummaryVal: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  budgetMeta: { fontSize: 11, textAlign: 'center', marginTop: 8, marginBottom: 16 },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  budgetRowLabel: { fontSize: 14, fontWeight: '600' },
  budgetRowDetail: { fontSize: 10, marginTop: 2 },
  budgetInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  budgetDollar: { fontSize: 14 },
  budgetInput: {
    width: 60,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  budgetRowAmount: { fontSize: 14, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  breakdownCard: { borderWidth: 1, marginTop: 16, padding: 14 },
  breakdownTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  breakdownLabel: { fontSize: 12 },
  breakdownVal: { fontSize: 13, fontWeight: '700' },

  /* Packing list */
  packProgress: { padding: 14, borderWidth: 1, marginBottom: 16 },
  packProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  packProgressText: { fontSize: 16, fontWeight: '700' },
  packProgressPct: { fontSize: 16, fontWeight: '700' },
  packTrack: { height: 6, width: '100%' },
  packFill: { height: 6 },
  packCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 8,
  },
  packCatTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  packCatCount: { fontSize: 10, marginLeft: 'auto' },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  packCheck: {
    width: 20,
    height: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packItemText: { fontSize: 14, flex: 1 },

  /* Tee time groups */
  teeCourseBanner: {
    padding: 14,
    overflow: 'hidden',
    marginBottom: 8,
    marginTop: 8,
  },
  teeDayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  teeDayText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  teeCourseName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  teeGroupCard: { borderWidth: 1, padding: 12, marginBottom: 8 },
  teeGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  teeGroupNum: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  teeGroupTime: { fontSize: 14, fontWeight: '700' },
  teePlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  teePlayerName: { fontSize: 13, fontWeight: '600', flex: 1 },
  teePlayerHcp: { fontSize: 12, fontWeight: '700' },

  /* RSVP preview */
  rsvpHero: {
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  rsvpBrand: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 6,
    marginBottom: 12,
  },
  rsvpTripName: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  rsvpLocation: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  rsvpDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rsvpDates: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  rsvpSection: { paddingHorizontal: 16, marginTop: 16 },
  rsvpSectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  rsvpCourseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  rsvpCourseName: { fontSize: 13, fontWeight: '600' },
  rsvpCourseTime: { fontSize: 10, marginTop: 2 },
  rsvpPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  rsvpPlayerName: { fontSize: 13, fontWeight: '600' },
  rsvpPlayerHcp: { fontSize: 10, marginTop: 1 },
  rsvpBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
  },
  rsvpBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  rsvpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 8,
  },
  rsvpBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* Awards */
  awardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  awardIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  awardTitle: { fontSize: 13, fontWeight: '700' },
  awardWinner: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  awardDetail: { fontSize: 11, marginTop: 2 },
  autoBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  autoBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },

  /* Weather */
  weatherLocation: { fontSize: 12, marginBottom: 12 },
  weatherCard: { borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
  weatherTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  weatherDayLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  weatherDate: { fontSize: 12, marginTop: 2 },
  weatherTempRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weatherTemps: { alignItems: 'flex-end' },
  weatherHigh: { fontSize: 24, fontWeight: '700' },
  weatherLow: { fontSize: 14 },
  weatherBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  weatherCond: { fontSize: 13, fontWeight: '600' },
  weatherMetaRow: { flexDirection: 'row', gap: 12 },
  weatherMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weatherMetaText: { fontSize: 11, fontWeight: '600' },
});

// ─── Competition Mode Styles ────────────────────────────────────────
const cm = StyleSheet.create({
  /* Ceremony */
  ceremonyScreen: { flex: 1, backgroundColor: '#0A2A1A' },
  ceremonyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  ceremonyBrand: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 6,
    marginBottom: 16,
  },
  ceremonyTripName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 24,
  },
  ceremonyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 32,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 0,
    backgroundColor: '#006747',
  },
  ceremonyLive: {
    color: '#C9A227',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
  },
  ceremonyAvatarRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ceremonyAvatarWrap: { alignItems: 'center', gap: 4 },
  ceremonyAvatarName: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  ceremonyTap: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    marginTop: 48,
    letterSpacing: 1,
  },

  /* Competition view */
  compHeader: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  compHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  compLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  compLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 0,
    backgroundColor: '#006747',
  },
  compLiveText: {
    color: '#006747',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  compTripName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  dayPillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dayPillActive: { backgroundColor: 'rgba(201,162,39,0.2)', borderWidth: 1, borderColor: '#C9A227' },
  dayPillComplete: { backgroundColor: 'rgba(0,103,71,0.15)' },
  dayPillText: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  dayPillTextActive: { color: '#C9A227' },

  compBody: { paddingHorizontal: 16 },
  compSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },

  /* Leaderboard */
  lbHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  lbTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  toggleRow: { flexDirection: 'row', gap: 2 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  toggleText: { fontSize: 11, fontWeight: '600' },
  lbColHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  lbColPos: { width: 28, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  lbColPlayer: { flex: 1, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  lbColRound: { width: 32, fontSize: 8, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  lbColTotal: { width: 36, fontSize: 8, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  lbColPar: { width: 36, fontSize: 8, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  lbPos: { width: 28, fontSize: 14, fontWeight: '700' },
  lbPlayerCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  lbPlayerName: { fontSize: 12, fontWeight: '600' },
  lbRoundScore: { width: 32, fontSize: 13, textAlign: 'center' },
  lbTotal: { width: 36, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  lbPar: { width: 36, fontSize: 13, fontWeight: '700', textAlign: 'center' },

  /* Course card */
  courseCard: { borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  courseGradient: { padding: 14 },
  courseOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  courseDayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  courseDayText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  courseName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  courseTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 3 },
  courseStats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10 },
  courseStat: { alignItems: 'center' },
  courseStatVal: { fontSize: 14, fontWeight: '700' },
  courseStatLabel: { fontSize: 7, fontWeight: '700', letterSpacing: 1, marginTop: 2 },

  /* Action buttons */
  actionBtns: { gap: 8, marginTop: 16 },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  actionPrimaryText: { color: '#C9A227', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
  },
  actionSecondaryText: { fontSize: 13, fontWeight: '600' },

  /* Side games */
  sideGameCard: { borderWidth: 1, marginBottom: 6, overflow: 'hidden' },
  sideGameTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  sideGameName: { fontSize: 14, fontWeight: '600' },
  sideGameMeta: { fontSize: 11, marginTop: 2 },
  sideGameRules: { borderTopWidth: 1, padding: 12 },
  sideGameRulesText: { fontSize: 12, lineHeight: 17 },

  /* All courses */
  allCourseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  allCourseDot: { width: 8, height: 8, borderRadius: 0 },
  allCourseName: { fontSize: 13, fontWeight: '600' },
  allCourseMeta: { fontSize: 10, marginTop: 2 },
  allCourseStatus: { paddingHorizontal: 8, paddingVertical: 3 },
  allCourseStatusText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },

  /* Trip moments */
  momentRow: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  momentText: { fontSize: 13 },
  momentMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  momentAuthor: { fontSize: 10 },
  momentTime: { fontSize: 10 },
  addMomentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 10,
    marginBottom: 16,
  },
  addMomentText: { fontSize: 12, fontWeight: '600' },

  /* Chat FAB */
  chatFab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  chatBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 0,
    backgroundColor: '#C41E3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  /* Data freshness indicator */
  freshnessBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  freshnessDot: {
    width: 6,
    height: 6,
    backgroundColor: '#006747',
  },
  freshnessText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionWithFreshness: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

export default function TripDetailScreen() {
  return (
    <ErrorBoundary>
      <TripDetailScreenInner />
    </ErrorBoundary>
  );
}
