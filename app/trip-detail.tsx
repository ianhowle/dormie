import { useState, useRef, useCallback } from 'react';
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
  Alert,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { Avatar } from '../src/components/Avatar';
import { TripCountdownRing } from '../src/components/TripCountdownRing';
import { RyderCupHub } from '../src/components/RyderCupHub';
import { getDaysUntilTrip, MOCK_UPCOMING_TRIPS } from '../src/data/trips';

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
  { id: 'tt1', label: 'Budget', icon: 'cash-outline', color: '#2A9D8F' },
  { id: 'tt2', label: 'Packing List', icon: 'bag-outline', color: '#D4AF37' },
  { id: 'tt3', label: 'Tee Groups', icon: 'people-outline', color: '#5B7FA5' },
  { id: 'tt4', label: 'RSVP Preview', icon: 'mail-outline', color: '#8B6DAF' },
  { id: 'tt5', label: 'Trip Awards', icon: 'trophy-outline', color: '#C47B3B' },
  { id: 'tt6', label: 'Weather', icon: 'partly-sunny-outline', color: '#4A9B8E' },
];

const SIDE_GAME_PILLS = ['Skins', 'Nassau', 'Dots', 'Snake'];

const TABS = ['Clubhouse', 'Courses', 'Players', 'Checklist', 'Chat'] as const;
type Tab = (typeof TABS)[number];

const EMOJI_OPTIONS = ['👍', '🔥', '⛳', '😂', '💪', '🏆'];

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
}: {
  trip: typeof MOCK_UPCOMING_TRIPS[0];
  checklist: ChecklistItem[];
  onToggleCheck: (id: string) => void;
  onToolPress: (toolId: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
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
      <SectionLabel title="LATEST" />
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

      {/* Stats row */}
      <SectionLabel title="TRIP INFO" />
      <View style={s.statsRow}>
        {[
          { label: 'FORMAT', value: 'Stroke Play' },
          { label: 'ROUNDS', value: `${trip.roundsPlanned}` },
          { label: 'SIDE GAMES', value: `${SIDE_GAME_PILLS.length}` },
          { label: 'PLAYERS', value: `${MOCK_PLAYERS.length}` },
        ].map((st) => (
          <View key={st.label} style={[s.statCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <Text style={[s.statValue, { color: c.teal, fontFamily: GEO }]}>{st.value}</Text>
            <Text style={[s.statLabel, { color: c.textMuted }]}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* Invite code */}
      <SectionLabel title="INVITE CODE" />
      <Pressable
        onPress={() => {
          Clipboard.setString(trip.inviteCode);
          Alert.alert('Copied!', `Invite code ${trip.inviteCode} copied to clipboard.`);
        }}
        style={[s.inviteRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
      >
        <Text style={[s.inviteCode, { color: c.gold, fontFamily: GEO }]}>{trip.inviteCode}</Text>
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

      {/* Trip moments */}
      <SectionLabel title="TRIP MOMENTS" />
      {MOCK_MOMENTS.map((m) => (
        <View key={m.id} style={[s.momentRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <Text style={[s.momentText, { color: c.text }]}>{m.text}</Text>
          <View style={s.momentMeta}>
            <Text style={[s.momentAuthor, { color: c.textMuted }]}>{m.author}</Text>
            <Text style={[s.momentTime, { color: c.textMuted }]}>{m.time}</Text>
          </View>
        </View>
      ))}
      <Pressable style={[s.addMomentBtn, { borderColor: c.border }]}>
        <Ionicons name="add-circle-outline" size={16} color={c.teal} />
        <Text style={[s.addMomentText, { color: c.teal }]}>Add Moment</Text>
      </Pressable>

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
            {/* Gradient header */}
            <LinearGradient
              colors={course.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.courseGradient}
            >
              <View style={s.courseDayBadge}>
                <Text style={[s.courseDayText, { fontFamily: GEO }]}>DAY {course.day}</Text>
              </View>
              <Text style={[s.courseCardName, { fontFamily: GEO }]}>{course.name}</Text>
              <Text style={s.courseTeeTime}>{course.teeTime}</Text>
            </LinearGradient>

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
                    ? `${MOCK_COURSES.find((x) => x.id === course.id)!.votes} votes`
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
        <View key={p.id} style={[s.fullPlayerRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
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
function ChatTab() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [messages, setMessages] = useState(MOCK_CHAT);
  const [inputText, setInputText] = useState('');
  const [emojiPickerMsg, setEmojiPickerMsg] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        userId: '1',
        userName: 'Ian McGowan',
        text: inputText.trim(),
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        reactions: [],
      },
    ]);
    setInputText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.chatScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isMe = msg.userId === '1';
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
        <Ionicons name="cash-outline" size={20} color="#2A9D8F" />
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
        <Ionicons name="bag-outline" size={20} color="#D4AF37" />
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
          colors={[MASTERS_GREEN, '#2D6A3F']}
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
                <Ionicons name={day.icon as any} size={28} color={day.condition.includes('Sunny') || day.condition.includes('sunny') ? '#D4AF37' : c.textMuted} />
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
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════
export default function TripDetailScreen() {
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();

  const trip = MOCK_UPCOMING_TRIPS.find((t) => t.id === params.tripId) ?? MOCK_UPCOMING_TRIPS[0];

  // Ryder Cup trips get their own dedicated view
  if (trip.isRyderCup) {
    return <RyderCupHub trip={trip} />;
  }

  const daysUntil = getDaysUntilTrip(trip.startDate);

  const [activeTab, setActiveTab] = useState<Tab>('Clubhouse');
  const [checklist, setChecklist] = useState(MOCK_CHECKLIST);
  const [activeTool, setActiveTool] = useState<string | null>(null);

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

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      {/* ─── TOP BAR ────────────────────────────────────────────────── */}
      <View style={[s.topBar, { backgroundColor: c.surface }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[s.branding, { color: c.gold, fontFamily: GEO }]}>DORMIE</Text>
        <View style={s.topBarRight}>
          <Pressable onPress={toggleTheme} hitSlop={8}>
            <Ionicons
              name={theme.isDark ? 'sunny-outline' : 'moon-outline'}
              size={20}
              color={c.textMuted}
            />
          </Pressable>
          <Pressable hitSlop={8}>
            <Ionicons name="settings-outline" size={20} color={c.textMuted} />
          </Pressable>
          <Pressable hitSlop={8}>
            <Ionicons name="share-outline" size={20} color={c.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* ─── HERO ───────────────────────────────────────────────────── */}
      <View style={[s.hero, { backgroundColor: c.surface }]}>
        <View style={s.heroLeft}>
          <Text style={[s.heroName, { color: c.text, fontFamily: GEO }]}>{trip.name}</Text>
          <Text style={[s.heroLocation, { color: c.textMuted }]}>
            {trip.destination} · {trip.city}, {trip.state}
          </Text>
          <Text style={[s.heroDateRange, { color: c.textMuted }]}>
            {formatDateRange(trip.startDate, trip.endDate)}
          </Text>
        </View>
        <TripCountdownRing daysUntil={daysUntil} size={100} totalDays={60} />
      </View>

      {/* ─── PLAYER ROW ─────────────────────────────────────────────── */}
      <FlatList
        data={MOCK_PLAYERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.playerRowScroll}
        style={[s.playerRowContainer, { backgroundColor: c.bg }]}
        renderItem={({ item }) => {
          const rsvpCol =
            item.rsvp === 'confirmed' ? c.teal : item.rsvp === 'pending' ? c.gold : c.urgent;
          return (
            <View style={[s.playerCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <View style={s.playerCardAvatarWrap}>
                <Avatar id={item.id} size={40} name={item.name} />
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

      {/* ─── STICKY TAB BAR ─────────────────────────────────────────── */}
      <View style={[s.tabBar, { backgroundColor: c.surface, borderColor: c.border }]}>
        {TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
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
      </View>

      {/* ─── TAB CONTENT ─────────────────────────────────────────────── */}
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {activeTab === 'Clubhouse' && (
          <ClubhouseTab trip={trip} checklist={checklist} onToggleCheck={toggleCheck} onToolPress={setActiveTool} />
        )}
        {activeTab === 'Courses' && <CoursesTab />}
        {activeTab === 'Players' && <PlayersTab />}
        {activeTab === 'Checklist' && <ChecklistTab checklist={checklist} onToggle={toggleCheck} />}
        {activeTab === 'Chat' && <ChatTab />}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1 },

  /* Top bar */
  topBar: {
    paddingTop: STATUS_BAR_H,
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heroLeft: { flex: 1, marginRight: 16 },
  heroName: { fontSize: 26, fontWeight: '700', lineHeight: 30 },
  heroLocation: { fontSize: 13, marginTop: 4 },
  heroDateRange: { fontSize: 12, marginTop: 4 },

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
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  playerCardAvatarWrap: {
    position: 'relative',
  },
  rsvpIndicator: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#1A1816',
  },
  playerCardName: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  playerCardHcp: { fontSize: 13, fontWeight: '700', marginTop: 2 },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 8,
  },

  /* Tab content */
  tabContent: {
    paddingHorizontal: 16,
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
    paddingVertical: 10,
    borderWidth: 1,
  },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1, marginTop: 2 },

  /* Invite code */
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
  },
  inviteCode: { fontSize: 22, fontWeight: '700', letterSpacing: 4 },
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
  courseGradient: {
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
  courseStatLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
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
  rsvpDot: { width: 6, height: 6, borderRadius: 3 },
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
  checkProgressNum: { fontSize: 32, fontWeight: '700' },
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
