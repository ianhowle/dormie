import { useState, useRef } from 'react';
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
  Alert,
  Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { Avatar } from './Avatar';
import type { Trip } from '../data/trips';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Types ──────────────────────────────────────────────────────────────
type SessionStatus = 'not_started' | 'live' | 'complete';
type RCFormat = 'foursomes' | 'fourball' | 'singles' | 'shamble' | 'scramble' | 'greensomes';

type RCSession = {
  id: string;
  day: number;
  format: RCFormat;
  formatLabel: string;
  formatIcon: string;
  status: SessionStatus;
  matchCount: number;
  holeCount: number;
  courseName: string;
  redScore?: number;
  blueScore?: number;
};

type RCPlayer = {
  id: string;
  name: string;
  handicap: number;
  team: 'red' | 'blue' | null;
};

type RCCheckItem = {
  id: string;
  text: string;
  done: boolean;
};

type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  time: string;
  reactions: { emoji: string; count: number; reacted: boolean }[];
};

// ─── Mock data ──────────────────────────────────────────────────────────
const MOCK_RC_SESSIONS: RCSession[] = [
  {
    id: 'rs1',
    day: 1,
    format: 'foursomes',
    formatLabel: 'Foursomes',
    formatIcon: 'swap-horizontal',
    status: 'complete',
    matchCount: 4,
    holeCount: 18,
    courseName: 'Hermitage Golf Course',
    redScore: 2.5,
    blueScore: 1.5,
  },
  {
    id: 'rs2',
    day: 2,
    format: 'fourball',
    formatLabel: 'Four-Ball',
    formatIcon: 'people',
    status: 'live',
    matchCount: 4,
    holeCount: 18,
    courseName: 'Hermitage Golf Course',
    redScore: 1,
    blueScore: 2,
  },
  {
    id: 'rs3',
    day: 3,
    format: 'singles',
    formatLabel: 'Singles',
    formatIcon: 'person',
    status: 'not_started',
    matchCount: 4,
    holeCount: 18,
    courseName: 'Gaylord Springs',
  },
  {
    id: 'rs4',
    day: 3,
    format: 'singles',
    formatLabel: 'Singles',
    formatIcon: 'person',
    status: 'not_started',
    matchCount: 4,
    holeCount: 18,
    courseName: 'Gaylord Springs',
  },
];

const MOCK_RC_PLAYERS: RCPlayer[] = [
  { id: '1', name: 'Ian McGowan', handicap: 8, team: 'red' },
  { id: '3', name: 'Mike Chen', handicap: 10, team: 'red' },
  { id: '5', name: 'Chris Burke', handicap: 14, team: 'red' },
  { id: '7', name: 'Alex Rivera', handicap: 6, team: 'red' },
  { id: '2', name: 'Drew Patterson', handicap: 12, team: 'blue' },
  { id: '4', name: 'Jake Sullivan', handicap: 15, team: 'blue' },
  { id: '6', name: 'Tommy Fleetwood', handicap: 3, team: 'blue' },
  { id: '8', name: 'Ryan O\'Brien', handicap: 9, team: 'blue' },
];

const MOCK_RC_CHECKLIST: RCCheckItem[] = [
  { id: 'rc1', text: 'Confirm all player handicaps', done: true },
  { id: 'rc2', text: 'Draft teams', done: true },
  { id: 'rc3', text: 'Set session pairings', done: false },
  { id: 'rc4', text: 'Book tee times for Day 1', done: true },
  { id: 'rc5', text: 'Book tee times for Day 2', done: true },
  { id: 'rc6', text: 'Book tee times for Day 3', done: false },
  { id: 'rc7', text: 'Order team shirts', done: false },
  { id: 'rc8', text: 'Buy trophy / cup', done: false },
  { id: 'rc9', text: 'Set stakes and side bets', done: true },
  { id: 'rc10', text: 'Plan closing ceremony dinner', done: false },
];

const MOCK_RC_CHAT: ChatMessage[] = [
  {
    id: 'rcm1',
    userId: '1',
    userName: 'Ian McGowan',
    text: 'Team Red is looking strong. We got this 💪',
    time: '9:15 AM',
    reactions: [{ emoji: '🔥', count: 3, reacted: false }],
  },
  {
    id: 'rcm2',
    userId: '6',
    userName: 'Tommy Fleetwood',
    text: "Don't get too confident. Blue has the better players 😤",
    time: '9:22 AM',
    reactions: [{ emoji: '💪', count: 2, reacted: false }],
  },
  {
    id: 'rcm3',
    userId: '3',
    userName: 'Mike Chen',
    text: 'Who wants to practice tomorrow morning? Tee time at 7 AM.',
    time: '10:05 AM',
    reactions: [{ emoji: '👍', count: 4, reacted: true }],
  },
  {
    id: 'rcm4',
    userId: '4',
    userName: 'Jake Sullivan',
    text: "I'm in. Let's play the back 9 at Hermitage as a warmup.",
    time: '10:12 AM',
    reactions: [],
  },
  {
    id: 'rcm5',
    userId: '2',
    userName: 'Drew Patterson',
    text: "Foursomes day was incredible. Can't believe that chip-in on 17!",
    time: '6:45 PM',
    reactions: [
      { emoji: '⛳', count: 3, reacted: true },
      { emoji: '🔥', count: 2, reacted: false },
    ],
  },
];

const EMOJI_OPTIONS = ['👍', '🔥', '⛳', '😂', '💪', '🏆'];

const RC_RED = '#C44B4F';
const RC_BLUE = '#1A3A5C';

// ─── Sub-view type ──────────────────────────────────────────────────────
type SubView = 'hub' | 'checklist' | 'chat' | 'settings';

// ═══════════════════════════════════════════════════════════════════════
// RC CHECKLIST VIEW
// ═══════════════════════════════════════════════════════════════════════
function RCChecklist({
  checklist,
  onToggle,
  onBack,
}: {
  checklist: RCCheckItem[];
  onToggle: (id: string) => void;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const done = checklist.filter((x) => x.done).length;

  return (
    <View style={[h.screen, { backgroundColor: c.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={[RC_BLUE, RC_RED]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={h.subHeader}
      >
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={[h.subHeaderTitle, { fontFamily: GEO }]}>Checklist</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={h.subBody} showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={[h.checkProgress, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <Text style={[h.checkProgressNum, { color: c.teal, fontFamily: GEO }]}>
            {done}
            <Text style={{ color: c.textMuted, fontSize: 16 }}> / {checklist.length}</Text>
          </Text>
          <Text style={[h.checkProgressLabel, { color: c.textMuted }]}>tasks completed</Text>
          <View style={[h.progressTrack, { backgroundColor: c.elevated }]}>
            <View
              style={[h.progressFill, { width: `${(done / checklist.length) * 100}%`, backgroundColor: c.teal }]}
            />
          </View>
        </View>

        {checklist.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onToggle(item.id)}
            style={[h.checkRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <View
              style={[
                h.checkBox,
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
                h.checkText,
                { color: item.done ? c.textMuted : c.text },
                item.done && h.checkTextDone,
              ]}
            >
              {item.text}
            </Text>
          </Pressable>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RC CHAT VIEW (19th Hole)
// ═══════════════════════════════════════════════════════════════════════
function RCChat({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [messages, setMessages] = useState(MOCK_RC_CHAT);
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
                .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r))
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
    <View style={[h.screen, { backgroundColor: c.bg }]}>
      <LinearGradient
        colors={[RC_BLUE, RC_RED]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={h.subHeader}
      >
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={[h.subHeaderTitle, { fontFamily: GEO }]}>19th Hole</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={h.chatScroll}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isMe = msg.userId === '1';
          const player = MOCK_RC_PLAYERS.find((p) => p.id === msg.userId);
          const teamColor = player?.team === 'red' ? RC_RED : RC_BLUE;
          return (
            <View key={msg.id} style={h.chatMsgWrap}>
              {!isMe && <Avatar id={msg.userId} size={28} name={msg.userName} />}
              <View style={[h.chatBubbleWrap, isMe && h.chatBubbleWrapMe]}>
                {!isMe && (
                  <Text style={[h.chatAuthor, { color: teamColor }]}>{msg.userName}</Text>
                )}
                <Pressable
                  onLongPress={() => setEmojiPickerMsg(emojiPickerMsg === msg.id ? null : msg.id)}
                  style={[
                    h.chatBubble,
                    {
                      backgroundColor: isMe ? `${teamColor}20` : c.cardBg,
                      borderColor: isMe ? teamColor : c.border,
                    },
                  ]}
                >
                  <Text style={[h.chatMsgText, { color: c.text }]}>{msg.text}</Text>
                </Pressable>
                <View style={h.chatBottom}>
                  <Text style={[h.chatTime, { color: c.textMuted }]}>{msg.time}</Text>
                  {msg.reactions.length > 0 && (
                    <View style={h.reactionsRow}>
                      {msg.reactions.map((r) => (
                        <Pressable
                          key={r.emoji}
                          onPress={() => toggleReaction(msg.id, r.emoji)}
                          style={[
                            h.reactionPill,
                            {
                              backgroundColor: r.reacted ? `${c.teal}15` : c.elevated,
                              borderColor: r.reacted ? c.teal : c.border,
                            },
                          ]}
                        >
                          <Text style={h.reactionEmoji}>{r.emoji}</Text>
                          <Text style={[h.reactionCount, { color: r.reacted ? c.teal : c.textMuted }]}>
                            {r.count}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
                {emojiPickerMsg === msg.id && (
                  <View style={[h.emojiPicker, { backgroundColor: c.elevated, borderColor: c.border }]}>
                    {EMOJI_OPTIONS.map((em) => (
                      <Pressable key={em} onPress={() => toggleReaction(msg.id, em)} style={h.emojiOption}>
                        <Text style={h.emojiOptionText}>{em}</Text>
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

      <View style={[h.chatInputWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TextInput
          style={[h.chatInput, { color: c.text, backgroundColor: c.cardBg, borderColor: c.border }]}
          placeholder="Message the 19th Hole..."
          placeholderTextColor={c.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={sendMessage}
          style={[h.sendBtn, { backgroundColor: inputText.trim() ? c.teal : c.elevated }]}
        >
          <Ionicons name="send" size={18} color={inputText.trim() ? '#fff' : c.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RC SETTINGS VIEW
// ═══════════════════════════════════════════════════════════════════════
function RCSettings({ trip, onBack }: { trip: Trip; onBack: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;

  const redPlayers = MOCK_RC_PLAYERS.filter((p) => p.team === 'red');
  const bluePlayers = MOCK_RC_PLAYERS.filter((p) => p.team === 'blue');

  const configRows: [string, string][] = [
    ['Competition', trip.name],
    ['Location', `${trip.city}, ${trip.state}`],
    ['Course', trip.destination],
    ['Dates', `${trip.startDate} → ${trip.endDate}`],
    ['Team Size', `${trip.playerIds.length / 2}v${trip.playerIds.length / 2}`],
    ['Sessions', `${MOCK_RC_SESSIONS.length}`],
    ['Win Condition', 'Most Points'],
    ['Scoring', 'Win = 1 · Halve = ½ · Loss = 0'],
    ['Invite Code', trip.inviteCode],
  ];

  return (
    <View style={[h.screen, { backgroundColor: c.bg }]}>
      <LinearGradient
        colors={[RC_BLUE, RC_RED]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={h.subHeader}
      >
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={[h.subHeaderTitle, { fontFamily: GEO }]}>Settings</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={h.subBody} showsVerticalScrollIndicator={false}>
        {/* Competition info */}
        <Text style={[h.settingsSection, { color: c.gold, fontFamily: GEO }]}>COMPETITION INFO</Text>
        <View style={[h.configTable, { borderColor: c.border }]}>
          {configRows.map(([label, val], i) => (
            <View
              key={label}
              style={[h.configRow, { borderColor: c.border }, i === 0 && { borderTopWidth: 0 }]}
            >
              <Text style={[h.configLabel, { color: c.textMuted }]}>{label}</Text>
              <Text style={[h.configVal, { color: c.text }]}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Team cards */}
        <Text style={[h.settingsSection, { color: c.gold, fontFamily: GEO }]}>TEAMS</Text>
        <View style={h.teamCardsRow}>
          {/* Team Red */}
          <View style={[h.teamCard, { borderColor: RC_RED }]}>
            <View style={[h.teamCardHeader, { backgroundColor: RC_RED }]}>
              <Text style={[h.teamCardTitle, { fontFamily: GEO }]}>Team Red</Text>
            </View>
            {redPlayers.map((p) => (
              <View key={p.id} style={[h.teamPlayerRow, { borderColor: c.border }]}>
                <Avatar id={p.id} size={24} name={p.name} />
                <View style={{ flex: 1 }}>
                  <Text style={[h.teamPlayerName, { color: c.text }]}>{p.name}</Text>
                  <Text style={[h.teamPlayerHcp, { color: c.textMuted }]}>{p.handicap} HCP</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Team Blue */}
          <View style={[h.teamCard, { borderColor: RC_BLUE }]}>
            <View style={[h.teamCardHeader, { backgroundColor: RC_BLUE }]}>
              <Text style={[h.teamCardTitle, { fontFamily: GEO }]}>Team Blue</Text>
            </View>
            {bluePlayers.map((p) => (
              <View key={p.id} style={[h.teamPlayerRow, { borderColor: c.border }]}>
                <Avatar id={p.id} size={24} name={p.name} />
                <View style={{ flex: 1 }}>
                  <Text style={[h.teamPlayerName, { color: c.text }]}>{p.name}</Text>
                  <Text style={[h.teamPlayerHcp, { color: c.textMuted }]}>{p.handicap} HCP</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* All players list */}
        <Text style={[h.settingsSection, { color: c.gold, fontFamily: GEO }]}>ALL PLAYERS</Text>
        {MOCK_RC_PLAYERS.map((p) => (
          <View key={p.id} style={[h.settingsPlayerRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={[h.teamDot, { backgroundColor: p.team === 'red' ? RC_RED : RC_BLUE }]} />
            <Avatar id={p.id} size={32} name={p.name} />
            <View style={{ flex: 1 }}>
              <Text style={[h.settingsPlayerName, { color: c.text }]}>{p.name}</Text>
              <Text style={[h.settingsPlayerHcp, { color: c.textMuted }]}>{p.handicap} HCP</Text>
            </View>
          </View>
        ))}

        {/* Dark / light toggle */}
        <Text style={[h.settingsSection, { color: c.gold, fontFamily: GEO }]}>APPEARANCE</Text>
        <Pressable
          onPress={toggleTheme}
          style={[h.themeToggle, { backgroundColor: c.cardBg, borderColor: c.border }]}
        >
          <Ionicons
            name={theme.isDark ? 'moon' : 'sunny'}
            size={20}
            color={theme.isDark ? c.gold : c.teal}
          />
          <Text style={[h.themeToggleText, { color: c.text }]}>
            {theme.isDark ? 'Dark Mode' : 'Light Mode'}
          </Text>
          <View
            style={[
              h.toggleSwitch,
              {
                backgroundColor: theme.isDark ? c.teal : c.elevated,
                borderColor: theme.isDark ? c.teal : c.border,
              },
            ]}
          >
            <View style={[h.toggleKnob, theme.isDark && h.toggleKnobOn]} />
          </View>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN RC HUB
// ═══════════════════════════════════════════════════════════════════════
export function RyderCupHub({ trip }: { trip: Trip }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  const [subView, setSubView] = useState<SubView>('hub');
  const [checklist, setChecklist] = useState(MOCK_RC_CHECKLIST);
  const [teamsDrafted] = useState(true); // toggle false to see draft CTA

  const toggleCheck = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );
  };

  // Scores
  const redTotal = MOCK_RC_SESSIONS.reduce((s, ss) => s + (ss.redScore ?? 0), 0);
  const blueTotal = MOCK_RC_SESSIONS.reduce((s, ss) => s + (ss.blueScore ?? 0), 0);
  const totalPoints = MOCK_RC_SESSIONS.reduce((s, ss) => s + ss.matchCount, 0);

  // Sub-views
  if (subView === 'checklist') {
    return <RCChecklist checklist={checklist} onToggle={toggleCheck} onBack={() => setSubView('hub')} />;
  }
  if (subView === 'chat') {
    return <RCChat onBack={() => setSubView('hub')} />;
  }
  if (subView === 'settings') {
    return <RCSettings trip={trip} onBack={() => setSubView('hub')} />;
  }

  const statusColor = (status: SessionStatus) => {
    if (status === 'live') return c.teal;
    if (status === 'complete') return c.gold;
    return c.textMuted;
  };

  const statusLabel = (status: SessionStatus) => {
    if (status === 'live') return 'LIVE';
    if (status === 'complete') return 'COMPLETE';
    return 'NOT STARTED';
  };

  const handleSessionPress = (session: RCSession) => {
    if (session.status === 'not_started') {
      Alert.alert('Matchup Reveal', 'This would open the cinematic matchup reveal animation.');
    } else {
      Alert.alert('Match List', `Viewing ${session.formatLabel} matches — ${session.status === 'live' ? 'live scoring' : 'final results'}.`);
    }
  };

  return (
    <View style={[h.screen, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* ─── GRADIENT HEADER ────────────────────────────────────── */}
        <LinearGradient
          colors={[RC_BLUE, '#0A0A0A', RC_RED]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={h.headerGradient}
        >
          {/* Pinstripe texture overlay */}
          <View style={h.pinstripeOverlay}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View key={i} style={h.pinstripe} />
            ))}
          </View>

          {/* Top row */}
          <View style={h.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={h.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
              <Text style={[h.backText]}>Trips</Text>
            </Pressable>
          </View>

          {/* Trip name + location */}
          <Text style={[h.cupName, { fontFamily: GEO }]}>{trip.name}</Text>
          <Text style={h.cupLocation}>
            {trip.destination} · {trip.city}, {trip.state}
          </Text>

          {/* ─── BIG SCOREBOARD ───────────────────────────────────── */}
          <View style={h.scoreboard}>
            {/* Team Red */}
            <View style={h.teamBadge}>
              <View style={[h.teamBadgeDot, { backgroundColor: RC_RED }]} />
              <Text style={[h.teamBadgeLabel, { fontFamily: GEO }]}>TEAM RED</Text>
            </View>

            {/* Score */}
            <View style={h.scoreCenter}>
              <View style={h.scoreRow}>
                <Text style={[h.scoreNum, { color: RC_RED, fontFamily: GEO }]}>
                  {redTotal % 1 === 0 ? redTotal : redTotal.toFixed(1)}
                </Text>
                <View style={h.scoreDivider}>
                  <View style={[h.scoreDividerHalf, { backgroundColor: RC_RED }]} />
                  <View style={[h.scoreDividerHalf, { backgroundColor: RC_BLUE }]} />
                </View>
                <Text style={[h.scoreNum, { color: RC_BLUE, fontFamily: GEO }]}>
                  {blueTotal % 1 === 0 ? blueTotal : blueTotal.toFixed(1)}
                </Text>
              </View>
              <Text style={h.scoreSubtext}>
                {totalPoints - redTotal - blueTotal} points remaining
              </Text>
            </View>

            {/* Team Blue */}
            <View style={h.teamBadge}>
              <View style={[h.teamBadgeDot, { backgroundColor: RC_BLUE }]} />
              <Text style={[h.teamBadgeLabel, { fontFamily: GEO }]}>TEAM BLUE</Text>
            </View>
          </View>

          {/* Win condition callout */}
          <View style={h.winCallout}>
            <Text style={h.winCalloutText}>Most points after {MOCK_RC_SESSIONS.length} sessions wins</Text>
          </View>
        </LinearGradient>

        {/* ─── CONTENT BELOW HEADER ──────────────────────────────── */}
        <View style={h.contentBody}>
          {/* Draft CTA (if teams not drafted) */}
          {!teamsDrafted && (
            <Pressable style={h.draftCta}>
              <LinearGradient
                colors={[RC_RED, RC_BLUE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="people" size={22} color="#D4AF37" />
              <View style={{ flex: 1 }}>
                <Text style={[h.draftCtaTitle, { fontFamily: GEO }]}>Draft Teams</Text>
                <Text style={h.draftCtaSub}>
                  Captain&apos;s Picks · {trip.playerIds.length} players
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D4AF37" />
            </Pressable>
          )}

          {/* SESSIONS */}
          <Text style={[h.sectionLabel, { color: c.gold, fontFamily: GEO }]}>SESSIONS</Text>
          {MOCK_RC_SESSIONS.map((session) => (
            <Pressable
              key={session.id}
              onPress={() => handleSessionPress(session)}
              style={[h.sessionCard, { backgroundColor: c.cardBg, borderColor: c.border }]}
            >
              <View style={h.sessionTop}>
                {/* Day badge */}
                <View style={[h.dayBadge, { backgroundColor: `${c.teal}15` }]}>
                  <Text style={[h.dayBadgeText, { color: c.teal, fontFamily: GEO }]}>
                    DAY {session.day}
                  </Text>
                </View>
                {/* Status badge */}
                <View style={[h.statusBadge, { backgroundColor: `${statusColor(session.status)}15` }]}>
                  {session.status === 'live' && (
                    <View style={[h.liveDot, { backgroundColor: c.teal }]} />
                  )}
                  <Text style={[h.statusText, { color: statusColor(session.status) }]}>
                    {statusLabel(session.status)}
                  </Text>
                </View>
              </View>

              <View style={h.sessionMain}>
                <Ionicons name={session.formatIcon as any} size={20} color={c.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[h.sessionFormat, { color: c.text }]}>{session.formatLabel}</Text>
                  <Text style={[h.sessionMeta, { color: c.textMuted }]}>
                    {session.matchCount} matches · {session.holeCount} holes · {session.courseName}
                  </Text>
                </View>
              </View>

              {/* Session score if available */}
              {session.redScore != null && session.blueScore != null && (
                <View style={[h.sessionScoreRow, { borderColor: c.border }]}>
                  <View style={h.sessionScoreSide}>
                    <View style={[h.sessionScoreDot, { backgroundColor: RC_RED }]} />
                    <Text style={[h.sessionScoreVal, { color: RC_RED, fontFamily: GEO }]}>
                      {session.redScore % 1 === 0 ? session.redScore : session.redScore.toFixed(1)}
                    </Text>
                  </View>
                  <Text style={[h.sessionScoreDash, { color: c.textMuted }]}>—</Text>
                  <View style={h.sessionScoreSide}>
                    <Text style={[h.sessionScoreVal, { color: RC_BLUE, fontFamily: GEO }]}>
                      {session.blueScore % 1 === 0 ? session.blueScore : session.blueScore.toFixed(1)}
                    </Text>
                    <View style={[h.sessionScoreDot, { backgroundColor: RC_BLUE }]} />
                  </View>
                </View>
              )}

              {/* Arrow indicator */}
              <View style={h.sessionArrow}>
                <Ionicons
                  name={session.status === 'not_started' ? 'play-circle' : 'chevron-forward'}
                  size={session.status === 'not_started' ? 22 : 18}
                  color={session.status === 'not_started' ? c.gold : c.textMuted}
                />
              </View>
            </Pressable>
          ))}

          {/* QUICK ACTIONS */}
          <Text style={[h.sectionLabel, { color: c.gold, fontFamily: GEO }]}>QUICK ACTIONS</Text>
          <View style={h.quickActionsRow}>
            <Pressable
              onPress={() => setSubView('checklist')}
              style={[h.quickActionBtn, { backgroundColor: c.cardBg, borderColor: c.border }]}
            >
              <Ionicons name="checkbox-outline" size={22} color={c.teal} />
              <Text style={[h.quickActionLabel, { color: c.text }]}>Checklist</Text>
            </Pressable>
            <Pressable
              onPress={() => setSubView('chat')}
              style={[h.quickActionBtn, { backgroundColor: c.cardBg, borderColor: c.border }]}
            >
              <Ionicons name="beer-outline" size={22} color={c.gold} />
              <Text style={[h.quickActionLabel, { color: c.text }]}>19th Hole</Text>
            </Pressable>
            <Pressable
              onPress={() => setSubView('settings')}
              style={[h.quickActionBtn, { backgroundColor: c.cardBg, borderColor: c.border }]}
            >
              <Ionicons name="settings-outline" size={22} color={c.textMuted} />
              <Text style={[h.quickActionLabel, { color: c.text }]}>Settings</Text>
            </Pressable>
          </View>

          {/* INVITE CODE */}
          <Text style={[h.sectionLabel, { color: c.gold, fontFamily: GEO }]}>INVITE CODE</Text>
          <Pressable
            onPress={() => {
              Clipboard.setString(trip.inviteCode);
              Alert.alert('Copied!', `Invite code ${trip.inviteCode} copied to clipboard.`);
            }}
            style={[h.inviteRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Text style={[h.inviteCode, { color: c.gold, fontFamily: GEO }]}>{trip.inviteCode}</Text>
            <View style={h.inviteCopyWrap}>
              <Ionicons name="copy-outline" size={16} color={c.teal} />
              <Text style={[h.inviteCopyText, { color: c.teal }]}>Copy</Text>
            </View>
          </Pressable>

          {/* PLAYERS horizontal scroll */}
          <Text style={[h.sectionLabel, { color: c.gold, fontFamily: GEO }]}>PLAYERS</Text>
        </View>
      </ScrollView>

      {/* Players row sits outside ScrollView for consistent placement */}
      <FlatList
        data={MOCK_RC_PLAYERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={h.playerScroll}
        style={[h.playerStrip, { backgroundColor: c.bg, borderColor: c.border }]}
        renderItem={({ item }) => {
          const teamCol = item.team === 'red' ? RC_RED : RC_BLUE;
          return (
            <View style={[h.playerCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
              <View style={h.playerAvatarWrap}>
                <Avatar id={item.id} size={36} name={item.name} />
                <View style={[h.playerTeamDot, { backgroundColor: teamCol }]} />
              </View>
              <Text style={[h.playerCardName, { color: c.text }]} numberOfLines={1}>
                {item.name.split(' ')[0]}
              </Text>
              <Text style={[h.playerCardHcp, { color: c.textMuted, fontFamily: GEO }]}>
                {item.handicap}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const h = StyleSheet.create({
  screen: { flex: 1 },

  /* Header gradient */
  headerGradient: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 20,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  pinstripeOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    opacity: 0.06,
  },
  pinstripe: {
    width: 1,
    height: '100%',
    backgroundColor: '#fff',
  },

  /* Top row */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },

  /* Cup info */
  cupName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cupLocation: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 20,
  },

  /* Scoreboard */
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamBadge: {
    alignItems: 'center',
    gap: 4,
    width: 70,
  },
  teamBadgeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  teamBadgeLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  scoreCenter: {
    alignItems: 'center',
    flex: 1,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreNum: {
    fontSize: 40,
    fontWeight: '900',
  },
  scoreDivider: {
    width: 4,
    height: 36,
    gap: 0,
  },
  scoreDividerHalf: {
    flex: 1,
    width: 4,
  },
  scoreSubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 4,
  },
  winCallout: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'center',
    marginTop: 14,
  },
  winCalloutText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    letterSpacing: 0.5,
  },

  /* Content body */
  contentBody: {
    paddingHorizontal: 16,
  },

  /* Section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },

  /* Draft CTA */
  draftCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  draftCtaTitle: {
    color: '#D4AF37',
    fontSize: 16,
    fontWeight: '800',
  },
  draftCtaSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },

  /* Session card */
  sessionCard: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    position: 'relative',
  },
  sessionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dayBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sessionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionFormat: {
    fontSize: 15,
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  sessionScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  sessionScoreSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionScoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionScoreVal: {
    fontSize: 18,
    fontWeight: '700',
  },
  sessionScoreDash: {
    fontSize: 14,
  },
  sessionArrow: {
    position: 'absolute',
    right: 14,
    top: '50%',
    marginTop: -9,
  },

  /* Quick actions */
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    gap: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Invite */
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
  },
  inviteCode: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
  },
  inviteCopyWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inviteCopyText: { fontSize: 12, fontWeight: '600' },

  /* Player strip */
  playerStrip: {
    maxHeight: 100,
    borderTopWidth: 1,
  },
  playerScroll: {
    paddingHorizontal: 12,
    gap: 8,
    paddingVertical: 8,
  },
  playerCard: {
    width: 80,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
  },
  playerAvatarWrap: {
    position: 'relative',
  },
  playerTeamDot: {
    position: 'absolute',
    bottom: -1,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#1A1816',
  },
  playerCardName: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  playerCardHcp: { fontSize: 12, fontWeight: '700', marginTop: 1 },

  /* Sub-view shared */
  subHeader: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subHeaderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  subBody: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  /* Checklist */
  checkProgress: {
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  checkProgressNum: { fontSize: 32, fontWeight: '700' },
  checkProgressLabel: { fontSize: 12, marginTop: 2 },
  progressTrack: { height: 4, width: '100%', marginTop: 8 },
  progressFill: { height: 4 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { fontSize: 14, flex: 1 },
  checkTextDone: { textDecorationLine: 'line-through' },

  /* Chat */
  chatScroll: { paddingHorizontal: 16, paddingTop: 8 },
  chatMsgWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  chatBubbleWrap: { flex: 1, maxWidth: '80%' },
  chatBubbleWrapMe: { alignItems: 'flex-end', marginLeft: 'auto' },
  chatAuthor: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  chatBubble: { borderWidth: 1, padding: 10 },
  chatMsgText: { fontSize: 14, lineHeight: 19 },
  chatBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  chatTime: { fontSize: 10 },
  reactionsRow: { flexDirection: 'row', gap: 4 },
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
  emojiOption: { padding: 4 },
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

  /* Settings */
  settingsSection: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },
  configTable: { borderWidth: 1 },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  configLabel: { fontSize: 12 },
  configVal: { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 12 },
  teamCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamCard: {
    flex: 1,
    borderWidth: 2,
    overflow: 'hidden',
  },
  teamCardHeader: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  teamCardTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  teamPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
  },
  teamPlayerName: { fontSize: 12, fontWeight: '600' },
  teamPlayerHcp: { fontSize: 10, marginTop: 1 },
  settingsPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  settingsPlayerName: { fontSize: 13, fontWeight: '600' },
  settingsPlayerHcp: { fontSize: 10, marginTop: 1 },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  themeToggleText: { fontSize: 14, fontWeight: '600', flex: 1 },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: 18,
    height: 18,
    backgroundColor: '#fff',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
});
