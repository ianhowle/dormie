import { useState, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { haptics } from '../lib/haptics';
import { GEO } from '../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../theme/colors';
import GoldDivider from './GoldDivider';
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

// ─── Match types ────────────────────────────────────────────────────────
type MatchStatus = 'AS' | '1 UP' | '2 UP' | '3 UP' | '4 UP' | '5 UP' | 'DORMIE' | 'HALVED' | 'FINAL';
type Formation = 'captain' | 'auto_balance' | 'snake_draft';

type RCMatch = {
  id: string;
  redPlayers: string[];
  bluePlayers: string[];
  status: MatchStatus;
  winner?: 'red' | 'blue' | 'halved';
  redScore: number;
  blueScore: number;
  holesPlayed: number;
};

type HoleResult = {
  redScore: number;
  blueScore: number;
  winner: 'red' | 'blue' | 'halved';
};

// Mock matches per session
const MOCK_MATCHES: Record<string, RCMatch[]> = {
  rs1: [
    { id: 'rm1', redPlayers: ['Ian McGowan', 'Mike Chen'], bluePlayers: ['Drew Patterson', 'Jake Sullivan'], status: 'FINAL', winner: 'red', redScore: 3, blueScore: 2, holesPlayed: 18 },
    { id: 'rm2', redPlayers: ['Chris Burke', 'Alex Rivera'], bluePlayers: ['Tommy Fleetwood', 'Ryan O\'Brien'], status: 'FINAL', winner: 'blue', redScore: 1, blueScore: 2, holesPlayed: 18 },
    { id: 'rm3', redPlayers: ['Ian McGowan', 'Alex Rivera'], bluePlayers: ['Tommy Fleetwood', 'Drew Patterson'], status: 'FINAL', winner: 'red', redScore: 1, blueScore: 0, holesPlayed: 18 },
    { id: 'rm4', redPlayers: ['Mike Chen', 'Chris Burke'], bluePlayers: ['Jake Sullivan', 'Ryan O\'Brien'], status: 'HALVED', winner: 'halved', redScore: 0, blueScore: 0, holesPlayed: 18 },
  ],
  rs2: [
    { id: 'rm5', redPlayers: ['Ian McGowan', 'Mike Chen'], bluePlayers: ['Tommy Fleetwood', 'Drew Patterson'], status: '2 UP', winner: undefined, redScore: 0, blueScore: 2, holesPlayed: 12 },
    { id: 'rm6', redPlayers: ['Alex Rivera', 'Chris Burke'], bluePlayers: ['Jake Sullivan', 'Ryan O\'Brien'], status: '1 UP', winner: undefined, redScore: 1, blueScore: 0, holesPlayed: 14 },
    { id: 'rm7', redPlayers: ['Ian McGowan', 'Chris Burke'], bluePlayers: ['Tommy Fleetwood', 'Jake Sullivan'], status: 'AS', winner: undefined, redScore: 0, blueScore: 0, holesPlayed: 10 },
    { id: 'rm8', redPlayers: ['Mike Chen', 'Alex Rivera'], bluePlayers: ['Drew Patterson', 'Ryan O\'Brien'], status: 'DORMIE', winner: undefined, redScore: 0, blueScore: 0, holesPlayed: 16 },
  ],
  rs3: [
    { id: 'rm9', redPlayers: ['Ian McGowan'], bluePlayers: ['Tommy Fleetwood'], status: 'AS', winner: undefined, redScore: 0, blueScore: 0, holesPlayed: 0 },
    { id: 'rm10', redPlayers: ['Alex Rivera'], bluePlayers: ['Drew Patterson'], status: 'AS', winner: undefined, redScore: 0, blueScore: 0, holesPlayed: 0 },
    { id: 'rm11', redPlayers: ['Mike Chen'], bluePlayers: ['Jake Sullivan'], status: 'AS', winner: undefined, redScore: 0, blueScore: 0, holesPlayed: 0 },
    { id: 'rm12', redPlayers: ['Chris Burke'], bluePlayers: ['Ryan O\'Brien'], status: 'AS', winner: undefined, redScore: 0, blueScore: 0, holesPlayed: 0 },
  ],
  rs4: [
    { id: 'rm13', redPlayers: ['Ian McGowan'], bluePlayers: ['Drew Patterson'], status: 'AS', winner: undefined, redScore: 0, blueScore: 0, holesPlayed: 0 },
    { id: 'rm14', redPlayers: ['Alex Rivera'], bluePlayers: ['Tommy Fleetwood'], status: 'AS', winner: undefined, redScore: 0, blueScore: 0, holesPlayed: 0 },
    { id: 'rm15', redPlayers: ['Mike Chen'], bluePlayers: ['Ryan O\'Brien'], status: 'AS', winner: undefined, redScore: 0, blueScore: 0, holesPlayed: 0 },
    { id: 'rm16', redPlayers: ['Chris Burke'], bluePlayers: ['Jake Sullivan'], status: 'AS', winner: undefined, redScore: 0, blueScore: 0, holesPlayed: 0 },
  ],
};

// ─── Sub-view type ──────────────────────────────────────────────────────
type SubView = 'hub' | 'checklist' | 'chat' | 'settings' | 'draft' | 'reveal' | 'matchlist' | 'scoring' | 'completion';

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
          onPress={() => { haptics.light(); toggleTheme(); }}
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
// TEAM DRAFT
// ═══════════════════════════════════════════════════════════════════════
function RCTeamDraft({
  players,
  onConfirm,
  onBack,
}: {
  players: RCPlayer[];
  onConfirm: (drafted: RCPlayer[]) => void;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [formation, setFormation] = useState<Formation>('captain');
  const [draftedPlayers, setDraftedPlayers] = useState<RCPlayer[]>(
    players.map((p) => ({ ...p, team: null })),
  );
  const [snakePickIdx, setSnakePickIdx] = useState(0);

  const available = draftedPlayers.filter((p) => p.team === null);
  const redTeam = draftedPlayers.filter((p) => p.team === 'red');
  const blueTeam = draftedPlayers.filter((p) => p.team === 'blue');
  const maxPerSide = Math.floor(draftedPlayers.length / 2);

  // Snake draft: alternating picks — red, blue, blue, red, red, blue...
  const snakeTeam = (): 'red' | 'blue' => {
    const round = Math.floor(snakePickIdx / 2);
    const isSecondPick = snakePickIdx % 2 === 1;
    return (round % 2 === 0) === !isSecondPick ? 'red' : 'blue';
  };

  const assignPlayer = (playerId: string, team: 'red' | 'blue') => {
    const teamCount = draftedPlayers.filter((p) => p.team === team).length;
    if (teamCount >= maxPerSide) return;
    setDraftedPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, team } : p)),
    );
    if (formation === 'snake_draft') setSnakePickIdx((i) => i + 1);
  };

  const autoBalance = () => {
    const sorted = [...draftedPlayers]
      .map((p) => ({ ...p, team: null as 'red' | 'blue' | null }))
      .sort((a, b) => a.handicap - b.handicap);
    // Snake-by-handicap: best to red, next two to blue, next to red...
    sorted.forEach((p, i) => {
      const round = Math.floor(i / 2);
      const isSecond = i % 2 === 1;
      p.team = (round % 2 === 0) === !isSecond ? 'red' : 'blue';
    });
    setDraftedPlayers(sorted);
  };

  const resetDraft = () => {
    setDraftedPlayers(players.map((p) => ({ ...p, team: null })));
    setSnakePickIdx(0);
  };

  const canConfirm = redTeam.length === maxPerSide && blueTeam.length === maxPerSide;

  return (
    <View style={[h.screen, { backgroundColor: c.bg }]}>
      <LinearGradient colors={[RC_BLUE, RC_RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={h.subHeader}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={[h.subHeaderTitle, { fontFamily: GEO }]}>Team Draft</Text>
        <Pressable onPress={resetDraft} hitSlop={12}>
          <Ionicons name="refresh" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </LinearGradient>

      <ScrollView contentContainerStyle={h.subBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Formation picker */}
        <Text style={[h.settingsSection, { color: c.gold, fontFamily: GEO }]}>FORMATION METHOD</Text>
        <View style={d.formationRow}>
          {([
            { key: 'captain' as Formation, label: "Captain's Picks", icon: 'hand-left' },
            { key: 'auto_balance' as Formation, label: 'Auto-Balance', icon: 'scale' },
            { key: 'snake_draft' as Formation, label: 'Snake Draft', icon: 'swap-vertical' },
          ]).map((opt) => {
            const active = opt.key === formation;
            return (
              <Pressable
                key={opt.key}
                onPress={() => { setFormation(opt.key); resetDraft(); }}
                style={[d.formationPill, { backgroundColor: active ? `${c.teal}20` : c.elevated, borderColor: active ? c.teal : c.border }]}
              >
                <Ionicons name={opt.icon as any} size={14} color={active ? c.teal : c.textMuted} />
                <Text style={[d.formationPillText, { color: active ? c.teal : c.textMuted }]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Auto-balance button */}
        {formation === 'auto_balance' && (
          <Pressable onPress={autoBalance} style={[d.autoBtn, { backgroundColor: c.teal }]}>
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={[d.autoBtnText, { fontFamily: GEO }]}>Balance by Handicap</Text>
          </Pressable>
        )}

        {/* Snake draft indicator */}
        {formation === 'snake_draft' && available.length > 0 && (
          <View style={[d.snakeIndicator, { backgroundColor: `${snakeTeam() === 'red' ? RC_RED : RC_BLUE}15`, borderColor: snakeTeam() === 'red' ? RC_RED : RC_BLUE }]}>
            <View style={[d.snakeDot, { backgroundColor: snakeTeam() === 'red' ? RC_RED : RC_BLUE }]} />
            <Text style={[d.snakeText, { color: snakeTeam() === 'red' ? RC_RED : RC_BLUE }]}>
              Team {snakeTeam() === 'red' ? 'Red' : 'Blue'} picks next
            </Text>
          </View>
        )}

        {/* Side-by-side team columns */}
        <View style={d.teamColumnsRow}>
          {/* Red column */}
          <View style={[d.teamColumn, { borderColor: RC_RED }]}>
            <View style={[d.teamColHeader, { backgroundColor: RC_RED }]}>
              <Text style={[d.teamColTitle, { fontFamily: GEO }]}>Team Red</Text>
              <Text style={d.teamColCount}>{redTeam.length}/{maxPerSide}</Text>
            </View>
            {redTeam.map((p) => (
              <View key={p.id} style={[d.teamColPlayer, { borderColor: c.border }]}>
                <Avatar id={p.id} size={24} name={p.name} />
                <View style={{ flex: 1 }}>
                  <Text style={[d.teamColName, { color: c.text }]}>{p.name.split(' ')[0]}</Text>
                  <Text style={[d.teamColHcp, { color: c.textMuted }]}>{p.handicap}</Text>
                </View>
              </View>
            ))}
            {redTeam.length === 0 && (
              <Text style={[d.emptyTeam, { color: c.textMuted }]}>No players yet</Text>
            )}
          </View>
          {/* Blue column */}
          <View style={[d.teamColumn, { borderColor: RC_BLUE }]}>
            <View style={[d.teamColHeader, { backgroundColor: RC_BLUE }]}>
              <Text style={[d.teamColTitle, { fontFamily: GEO }]}>Team Blue</Text>
              <Text style={d.teamColCount}>{blueTeam.length}/{maxPerSide}</Text>
            </View>
            {blueTeam.map((p) => (
              <View key={p.id} style={[d.teamColPlayer, { borderColor: c.border }]}>
                <Avatar id={p.id} size={24} name={p.name} />
                <View style={{ flex: 1 }}>
                  <Text style={[d.teamColName, { color: c.text }]}>{p.name.split(' ')[0]}</Text>
                  <Text style={[d.teamColHcp, { color: c.textMuted }]}>{p.handicap}</Text>
                </View>
              </View>
            ))}
            {blueTeam.length === 0 && (
              <Text style={[d.emptyTeam, { color: c.textMuted }]}>No players yet</Text>
            )}
          </View>
        </View>

        {/* Available player pool */}
        {available.length > 0 && (
          <>
            <Text style={[h.settingsSection, { color: c.gold, fontFamily: GEO }]}>AVAILABLE PLAYERS</Text>
            {available.map((p) => (
              <View key={p.id} style={[d.availableRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                <Avatar id={p.id} size={36} name={p.name} />
                <View style={{ flex: 1 }}>
                  <Text style={[d.availableName, { color: c.text }]}>{p.name}</Text>
                  <Text style={[d.availableHcp, { color: c.textMuted }]}>{p.handicap} HCP</Text>
                </View>
                {formation === 'captain' ? (
                  <View style={d.pickBtns}>
                    <Pressable
                      onPress={() => assignPlayer(p.id, 'red')}
                      style={[d.pickBtn, { backgroundColor: `${RC_RED}20`, borderColor: RC_RED }]}
                    >
                      <Text style={[d.pickBtnText, { color: RC_RED }]}>Red</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => assignPlayer(p.id, 'blue')}
                      style={[d.pickBtn, { backgroundColor: `${RC_BLUE}20`, borderColor: RC_BLUE }]}
                    >
                      <Text style={[d.pickBtnText, { color: RC_BLUE }]}>Blue</Text>
                    </Pressable>
                  </View>
                ) : formation === 'snake_draft' ? (
                  <Pressable
                    onPress={() => assignPlayer(p.id, snakeTeam())}
                    style={[d.pickBtn, { backgroundColor: `${snakeTeam() === 'red' ? RC_RED : RC_BLUE}20`, borderColor: snakeTeam() === 'red' ? RC_RED : RC_BLUE }]}
                  >
                    <Text style={[d.pickBtnText, { color: snakeTeam() === 'red' ? RC_RED : RC_BLUE }]}>Pick</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        )}

        {/* Confirm button */}
        <Pressable
          onPress={() => canConfirm && onConfirm(draftedPlayers)}
          disabled={!canConfirm}
          style={[d.confirmBtn, { opacity: canConfirm ? 1 : 0.4 }]}
        >
          <LinearGradient colors={[RC_RED, RC_BLUE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="checkmark-circle" size={20} color="#D4AF37" />
          <Text style={[d.confirmBtnText, { fontFamily: GEO }]}>Confirm Teams</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MATCHUP REVEAL
// ═══════════════════════════════════════════════════════════════════════
function RCMatchupReveal({
  session,
  matches,
  onStartScoring,
  onBack,
}: {
  session: RCSession;
  matches: RCMatch[];
  onStartScoring: () => void;
  onBack: () => void;
}) {
  const [revealedCount, setRevealedCount] = useState(0);
  const anims = useRef(matches.map(() => new Animated.Value(0))).current;

  const revealNext = () => {
    if (revealedCount >= matches.length) return;
    Animated.timing(anims[revealedCount], {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    setRevealedCount((c) => c + 1);
  };

  const allRevealed = revealedCount >= matches.length;

  return (
    <View style={rv.screen}>
      <LinearGradient
        colors={[RC_BLUE, '#0A0A0A', RC_RED]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView bounces={false} contentContainerStyle={rv.content}>
        {/* Skip */}
        <View style={rv.topRow}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.5)" />
          </Pressable>
          <Pressable onPress={() => { setRevealedCount(matches.length); matches.forEach((_, i) => anims[i].setValue(1)); }}>
            <Text style={rv.skipText}>Skip</Text>
          </Pressable>
        </View>

        <Text style={[rv.title, { fontFamily: GEO }]}>MATCHUP REVEAL</Text>
        <View style={rv.formatRow}>
          <Ionicons name={session.formatIcon as any} size={18} color="#D4AF37" />
          <Text style={[rv.formatText, { fontFamily: GEO }]}>{session.formatLabel}</Text>
        </View>

        {/* Match cards */}
        {matches.map((match, i) => (
          <Animated.View
            key={match.id}
            style={[
              rv.matchCard,
              {
                opacity: anims[i],
                transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              },
            ]}
          >
            {/* Red side */}
            <View style={rv.matchSide}>
              <View style={[rv.matchColorBar, { backgroundColor: RC_RED }]} />
              <View style={rv.matchPlayers}>
                {match.redPlayers.map((name) => (
                  <Text key={name} style={rv.matchPlayerName}>{name}</Text>
                ))}
              </View>
            </View>
            <Text style={[rv.matchVs, { fontFamily: GEO }]}>VS</Text>
            {/* Blue side */}
            <View style={[rv.matchSide, rv.matchSideBlue]}>
              <View style={rv.matchPlayers}>
                {match.bluePlayers.map((name) => (
                  <Text key={name} style={[rv.matchPlayerName, { textAlign: 'right' }]}>{name}</Text>
                ))}
              </View>
              <View style={[rv.matchColorBar, { backgroundColor: RC_BLUE }]} />
            </View>
          </Animated.View>
        ))}

        {/* Reveal / Start buttons */}
        {!allRevealed ? (
          <Pressable onPress={revealNext} style={rv.revealBtn}>
            <Text style={[rv.revealBtnText, { fontFamily: GEO }]}>
              Reveal Match {revealedCount + 1}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={onStartScoring} style={rv.startBtn}>
            <LinearGradient colors={['#1E4D2B', '#2D6A3F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Text style={[rv.startBtnText, { fontFamily: GEO }]}>Start Scoring →</Text>
          </Pressable>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MATCH LIST
// ═══════════════════════════════════════════════════════════════════════
function RCMatchList({
  session,
  matches,
  onMatchPress,
  onFinalize,
  onBack,
}: {
  session: RCSession;
  matches: RCMatch[];
  onMatchPress: (match: RCMatch, idx: number) => void;
  onFinalize: () => void;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const redPts = matches.reduce((s, m) => s + (m.winner === 'red' ? 1 : m.winner === 'halved' ? 0.5 : 0), 0);
  const bluePts = matches.reduce((s, m) => s + (m.winner === 'blue' ? 1 : m.winner === 'halved' ? 0.5 : 0), 0);
  const allComplete = matches.every((m) => m.winner != null);

  const statusColor = (match: RCMatch) => {
    if (match.winner === 'red') return RC_RED;
    if (match.winner === 'blue') return RC_BLUE;
    if (match.status === 'DORMIE') return c.gold;
    if (match.status === 'HALVED') return c.textMuted;
    return c.teal;
  };

  return (
    <View style={[h.screen, { backgroundColor: c.bg }]}>
      {/* Gradient header with session score */}
      <LinearGradient colors={[RC_BLUE, RC_RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ml.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <View style={ml.headerCenter}>
          <View style={ml.headerScoreRow}>
            <Text style={[ml.headerScore, { color: RC_RED, fontFamily: GEO }]}>
              {redPts % 1 === 0 ? redPts : redPts.toFixed(1)}
            </Text>
            <View style={ml.headerDash}>
              <Text style={[ml.headerSessionLabel, { fontFamily: GEO }]}>{session.formatLabel}</Text>
            </View>
            <Text style={[ml.headerScore, { color: '#fff', fontFamily: GEO }]}>
              {bluePts % 1 === 0 ? bluePts : bluePts.toFixed(1)}
            </Text>
          </View>
          <Text style={ml.headerMeta}>Day {session.day} · {session.courseName}</Text>
        </View>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={h.subBody} showsVerticalScrollIndicator={false}>
        {matches.map((match, i) => (
          <Pressable
            key={match.id}
            onPress={() => onMatchPress(match, i)}
            style={[ml.matchCard, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            {/* Red side */}
            <View style={ml.matchRow}>
              <View style={[ml.matchIndicator, { backgroundColor: RC_RED }]} />
              <View style={{ flex: 1 }}>
                {match.redPlayers.map((name) => (
                  <Text key={name} style={[ml.matchName, { color: match.winner === 'red' ? RC_RED : c.text }]}>{name}</Text>
                ))}
              </View>
            </View>

            {/* Status badge */}
            <View style={[ml.matchStatusBadge, { backgroundColor: `${statusColor(match)}15` }]}>
              <Text style={[ml.matchStatusText, { color: statusColor(match), fontFamily: GEO }]}>
                {match.winner ? (match.winner === 'halved' ? 'HALVED' : `${match.winner === 'red' ? 'RED' : 'BLUE'} WINS`) : match.status}
              </Text>
              {match.holesPlayed > 0 && !match.winner && (
                <Text style={[ml.matchHolesText, { color: c.textMuted }]}>
                  Thru {match.holesPlayed}
                </Text>
              )}
            </View>

            {/* Blue side */}
            <View style={ml.matchRow}>
              <View style={{ flex: 1 }}>
                {match.bluePlayers.map((name) => (
                  <Text key={name} style={[ml.matchName, { color: match.winner === 'blue' ? RC_BLUE : c.text, textAlign: 'right' }]}>{name}</Text>
                ))}
              </View>
              <View style={[ml.matchIndicator, { backgroundColor: RC_BLUE }]} />
            </View>
          </Pressable>
        ))}

        {/* Finalize button */}
        {allComplete && (
          <Pressable onPress={onFinalize} style={ml.finalizeBtn}>
            <LinearGradient colors={[RC_BLUE, RC_RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Ionicons name="checkmark-circle" size={20} color="#D4AF37" />
            <Text style={[ml.finalizeBtnText, { fontFamily: GEO }]}>Finalize Session</Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// HOLE-BY-HOLE MATCH SCORING
// ═══════════════════════════════════════════════════════════════════════
function RCMatchScoring({
  session,
  match,
  matchIndex,
  onBack,
}: {
  session: RCSession;
  match: RCMatch;
  matchIndex: number;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const totalHoles = session.holeCount;
  const [currentHole, setCurrentHole] = useState(1);
  const [holeResults, setHoleResults] = useState<Record<number, HoleResult>>({});
  const [redScores, setRedScores] = useState<Record<number, number>>({});
  const [blueScores, setBlueScores] = useState<Record<number, number>>({});

  const getScoreName = (score: number, par: number) => {
    const diff = score - par;
    if (diff <= -3) return 'Albatross';
    if (diff === -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double';
    return 'Triple+';
  };

  const getScoreColor = (score: number, par: number) => {
    const diff = score - par;
    if (diff <= -2) return c.gold;
    if (diff === -1) return c.teal;
    if (diff === 0) return c.text;
    if (diff === 1) return c.urgent;
    return c.urgent;
  };

  const par = currentHole <= 4 ? 4 : currentHole % 3 === 0 ? 3 : currentHole % 5 === 0 ? 5 : 4;
  const redScore = redScores[currentHole] ?? par;
  const blueScore = blueScores[currentHole] ?? par;

  const holeResult = holeResults[currentHole];
  const redWins = Object.values(holeResults).filter((r) => r.winner === 'red').length;
  const blueWins = Object.values(holeResults).filter((r) => r.winner === 'blue').length;
  const halves = Object.values(holeResults).filter((r) => r.winner === 'halved').length;

  const formatBanner = () => {
    if (session.format === 'fourball') return 'Enter best ball score for each team';
    if (session.format === 'foursomes') return 'Enter team\'s alternate shot score';
    if (session.format === 'scramble') return 'Enter team scramble score';
    return null;
  };

  const scoreLabel = () => {
    if (session.format === 'fourball') return 'Best Ball';
    if (session.format === 'foursomes' || session.format === 'scramble') return 'Team Score';
    return 'Score';
  };

  const lockHole = () => {
    const winner: 'red' | 'blue' | 'halved' =
      redScore < blueScore ? 'red' : blueScore < redScore ? 'blue' : 'halved';
    setHoleResults((prev) => ({
      ...prev,
      [currentHole]: { redScore, blueScore, winner },
    }));
  };

  return (
    <View style={[h.screen, { backgroundColor: c.bg }]}>
      {/* Header */}
      <LinearGradient colors={[RC_BLUE, RC_RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ms.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <View style={ms.headerCenter}>
          <Text style={[ms.matchNum, { fontFamily: GEO }]}>Match {matchIndex + 1}</Text>
          <View style={ms.headerFormatRow}>
            <Ionicons name={session.formatIcon as any} size={14} color="rgba(255,255,255,0.6)" />
            <Text style={ms.headerFormatText}>{session.formatLabel}</Text>
          </View>
        </View>
        <View style={ms.headerScoreMini}>
          <Text style={[ms.miniScore, { color: RC_RED }]}>{redWins}</Text>
          <Text style={ms.miniDash}>-</Text>
          <Text style={[ms.miniScore, { color: '#aac' }]}>{blueWins}</Text>
        </View>
      </LinearGradient>

      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Hole navigation strip */}
        <FlatList
          data={Array.from({ length: totalHoles }, (_, i) => i + 1)}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => `h${item}`}
          contentContainerStyle={ms.holeStrip}
          renderItem={({ item: hole }) => {
            const result = holeResults[hole];
            const isCurrent = hole === currentHole;
            const bgColor = result
              ? result.winner === 'red' ? `${RC_RED}30` : result.winner === 'blue' ? `${RC_BLUE}30` : `${c.textMuted}20`
              : isCurrent ? `${c.gold}30` : 'transparent';
            const borderCol = isCurrent ? c.gold : result ? (result.winner === 'red' ? RC_RED : result.winner === 'blue' ? RC_BLUE : c.textMuted) : c.border;
            return (
              <Pressable
                onPress={() => setCurrentHole(hole)}
                style={[ms.holeNum, { backgroundColor: bgColor, borderColor: borderCol }]}
              >
                <Text style={[ms.holeNumText, { color: isCurrent ? c.gold : result ? '#fff' : c.textMuted, fontFamily: GEO }]}>
                  {hole}
                </Text>
              </Pressable>
            );
          }}
        />

        {/* Hole info */}
        <View style={ms.holeInfoRow}>
          <Text style={[ms.holeLabel, { color: c.text, fontFamily: GEO }]}>HOLE {currentHole}</Text>
          <Text style={[ms.holePar, { color: c.gold, fontFamily: GEO }]}>PAR {par}</Text>
        </View>

        {/* Format context banner */}
        {formatBanner() && (
          <View style={[ms.formatBanner, { backgroundColor: `${c.gold}10`, borderColor: c.gold }]}>
            <Ionicons name="information-circle" size={14} color={c.gold} />
            <Text style={[ms.formatBannerText, { color: c.gold }]}>{formatBanner()}</Text>
          </View>
        )}

        {/* Red team scoring */}
        <View style={[ms.teamScoreCard, { backgroundColor: `${RC_RED}08`, borderColor: RC_RED }]}>
          <View style={[ms.teamScoreHeader, { borderColor: `${RC_RED}30` }]}>
            <View style={[ms.teamDotLg, { backgroundColor: RC_RED }]} />
            <Text style={[ms.teamScoreLabel, { color: RC_RED }]}>
              {match.redPlayers.join(' & ')}
            </Text>
          </View>
          <Text style={[ms.scoreTypeLabel, { color: c.textMuted }]}>{scoreLabel()}</Text>
          <View style={ms.scoreControls}>
            <Pressable
              onPress={() => setRedScores((p) => ({ ...p, [currentHole]: Math.max(1, (p[currentHole] ?? par) - 1) }))}
              style={[ms.scoreBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
            >
              <Ionicons name="remove" size={22} color={c.text} />
            </Pressable>
            <View style={ms.scoreDisplay}>
              <Text style={[ms.scoreNum, { color: getScoreColor(redScore, par), fontFamily: GEO }]}>
                {redScore}
              </Text>
              <Text style={[ms.scoreName, { color: getScoreColor(redScore, par) }]}>
                {getScoreName(redScore, par)}
              </Text>
            </View>
            <Pressable
              onPress={() => setRedScores((p) => ({ ...p, [currentHole]: Math.min(12, (p[currentHole] ?? par) + 1) }))}
              style={[ms.scoreBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
            >
              <Ionicons name="add" size={22} color={c.text} />
            </Pressable>
          </View>
        </View>

        {/* Blue team scoring */}
        <View style={[ms.teamScoreCard, { backgroundColor: `${RC_BLUE}08`, borderColor: RC_BLUE }]}>
          <View style={[ms.teamScoreHeader, { borderColor: `${RC_BLUE}30` }]}>
            <View style={[ms.teamDotLg, { backgroundColor: RC_BLUE }]} />
            <Text style={[ms.teamScoreLabel, { color: RC_BLUE }]}>
              {match.bluePlayers.join(' & ')}
            </Text>
          </View>
          <Text style={[ms.scoreTypeLabel, { color: c.textMuted }]}>{scoreLabel()}</Text>
          <View style={ms.scoreControls}>
            <Pressable
              onPress={() => setBlueScores((p) => ({ ...p, [currentHole]: Math.max(1, (p[currentHole] ?? par) - 1) }))}
              style={[ms.scoreBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
            >
              <Ionicons name="remove" size={22} color={c.text} />
            </Pressable>
            <View style={ms.scoreDisplay}>
              <Text style={[ms.scoreNum, { color: getScoreColor(blueScore, par), fontFamily: GEO }]}>
                {blueScore}
              </Text>
              <Text style={[ms.scoreName, { color: getScoreColor(blueScore, par) }]}>
                {getScoreName(blueScore, par)}
              </Text>
            </View>
            <Pressable
              onPress={() => setBlueScores((p) => ({ ...p, [currentHole]: Math.min(12, (p[currentHole] ?? par) + 1) }))}
              style={[ms.scoreBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
            >
              <Ionicons name="add" size={22} color={c.text} />
            </Pressable>
          </View>
        </View>

        {/* Hole result banner */}
        {holeResult && (
          <View
            style={[
              ms.resultBanner,
              {
                backgroundColor:
                  holeResult.winner === 'red' ? `${RC_RED}15` :
                  holeResult.winner === 'blue' ? `${RC_BLUE}15` : `${c.textMuted}15`,
                borderColor:
                  holeResult.winner === 'red' ? RC_RED :
                  holeResult.winner === 'blue' ? RC_BLUE : c.textMuted,
              },
            ]}
          >
            <Text
              style={[
                ms.resultText,
                {
                  color: holeResult.winner === 'red' ? RC_RED : holeResult.winner === 'blue' ? RC_BLUE : c.textMuted,
                  fontFamily: GEO,
                },
              ]}
            >
              {holeResult.winner === 'halved' ? 'HALVED' : `${holeResult.winner === 'red' ? 'RED' : 'BLUE'} WINS HOLE`}
            </Text>
          </View>
        )}

        {/* Navigation */}
        <View style={ms.navRow}>
          <Pressable
            onPress={() => setCurrentHole(Math.max(1, currentHole - 1))}
            disabled={currentHole === 1}
            style={[ms.navBtn, { backgroundColor: c.elevated, borderColor: c.border, opacity: currentHole === 1 ? 0.4 : 1 }]}
          >
            <Ionicons name="chevron-back" size={18} color={c.text} />
            <Text style={[ms.navBtnText, { color: c.text }]}>Prev</Text>
          </Pressable>

          {!holeResult && (
            <Pressable onPress={lockHole} style={[ms.lockBtn, { backgroundColor: c.teal }]}>
              <Text style={[ms.lockBtnText, { fontFamily: GEO }]}>Lock Hole</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              if (currentHole < totalHoles) {
                if (!holeResult) lockHole();
                setCurrentHole(currentHole + 1);
              } else {
                onBack();
              }
            }}
            style={[ms.navBtn, { backgroundColor: currentHole === totalHoles ? '#1E4D2B' : c.elevated, borderColor: currentHole === totalHoles ? '#1E4D2B' : c.border }]}
          >
            <Text style={[ms.navBtnText, { color: currentHole === totalHoles ? '#D4AF37' : c.text }]}>
              {currentHole === totalHoles ? 'Finish' : 'Next'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={currentHole === totalHoles ? '#D4AF37' : c.text} />
          </Pressable>
        </View>

        {/* Running score */}
        <View style={[ms.runningScore, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <Text style={[ms.runningLabel, { color: c.textMuted }]}>MATCH SCORE</Text>
          <View style={ms.runningScoreRow}>
            <View style={ms.runningSide}>
              <View style={[ms.teamDotSm, { backgroundColor: RC_RED }]} />
              <Text style={[ms.runningVal, { color: RC_RED, fontFamily: GEO }]}>{redWins}</Text>
            </View>
            <Text style={[ms.runningDash, { color: c.textMuted }]}>—</Text>
            <View style={ms.runningSide}>
              <Text style={[ms.runningVal, { color: RC_BLUE, fontFamily: GEO }]}>{blueWins}</Text>
              <View style={[ms.teamDotSm, { backgroundColor: RC_BLUE }]} />
            </View>
          </View>
          <Text style={[ms.halvedText, { color: c.textMuted }]}>{halves} halved</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RC COMPLETION CINEMATIC
// ═══════════════════════════════════════════════════════════════════════
function RCCompletion({
  redTotal,
  blueTotal,
  onDetails,
  onDone,
}: {
  redTotal: number;
  blueTotal: number;
  onDetails: () => void;
  onDone: () => void;
}) {
  const winner = redTotal > blueTotal ? 'red' : redTotal < blueTotal ? 'blue' : 'tied';
  const winnerColor = winner === 'red' ? RC_RED : winner === 'blue' ? RC_BLUE : '#D4AF37';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={cp.screen}>
      <LinearGradient
        colors={
          winner === 'red'
            ? [RC_RED, '#0A0A0A', '#2A1A1A']
            : winner === 'blue'
            ? [RC_BLUE, '#0A0A0A', '#1A1A2A']
            : ['#D4AF37', '#0A0A0A', '#2A2A1A']
        }
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[cp.content, { opacity: fadeAnim }]}>
        <Text style={cp.trophy}>🏆</Text>
        <Text style={[cp.champLabel, { fontFamily: GEO }]}>CHAMPIONS</Text>
        <Text style={[cp.winnerName, { color: winnerColor, fontFamily: GEO }]}>
          {winner === 'red' ? 'TEAM RED' : winner === 'blue' ? 'TEAM BLUE' : 'TIED'}
        </Text>

        <GoldDivider style={{ marginBottom: 24, width: '60%' }} />

        <View style={cp.finalScoreRow}>
          <Text style={[cp.finalNum, { color: RC_RED, fontFamily: GEO }]}>
            {redTotal % 1 === 0 ? redTotal : redTotal.toFixed(1)}
          </Text>
          <View style={cp.finalDivider}>
            <View style={[cp.finalDivHalf, { backgroundColor: RC_RED }]} />
            <View style={[cp.finalDivHalf, { backgroundColor: RC_BLUE }]} />
          </View>
          <Text style={[cp.finalNum, { color: RC_BLUE, fontFamily: GEO }]}>
            {blueTotal % 1 === 0 ? blueTotal : blueTotal.toFixed(1)}
          </Text>
        </View>

        <View style={cp.btns}>
          <Pressable onPress={onDetails} style={cp.detailsBtn}>
            <Text style={[cp.detailsBtnText, { fontFamily: GEO }]}>View Details</Text>
          </Pressable>
          <Pressable onPress={onDone} style={cp.doneBtn}>
            <LinearGradient colors={[RC_BLUE, RC_RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Text style={[cp.doneBtnText, { fontFamily: GEO }]}>Done</Text>
          </Pressable>
        </View>
      </Animated.View>
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
  const [teamsDrafted, setTeamsDrafted] = useState(true);
  const [activeSession, setActiveSession] = useState<RCSession | null>(null);
  const [activeMatch, setActiveMatch] = useState<{ match: RCMatch; idx: number } | null>(null);
  const [players, setPlayers] = useState(MOCK_RC_PLAYERS);

  const toggleCheck = (id: string) => {
    haptics.light();
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );
  };

  // Scores
  const redTotal = MOCK_RC_SESSIONS.reduce((s, ss) => s + (ss.redScore ?? 0), 0);
  const blueTotal = MOCK_RC_SESSIONS.reduce((s, ss) => s + (ss.blueScore ?? 0), 0);
  const totalPoints = MOCK_RC_SESSIONS.reduce((s, ss) => s + ss.matchCount, 0);
  const allSessionsComplete = MOCK_RC_SESSIONS.every((ss) => ss.status === 'complete');

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
  if (subView === 'draft') {
    return (
      <RCTeamDraft
        players={players}
        onConfirm={(drafted) => {
          setPlayers(drafted);
          setTeamsDrafted(true);
          setSubView('hub');
        }}
        onBack={() => setSubView('hub')}
      />
    );
  }
  if (subView === 'reveal' && activeSession) {
    const matches = MOCK_MATCHES[activeSession.id] ?? [];
    return (
      <RCMatchupReveal
        session={activeSession}
        matches={matches}
        onStartScoring={() => setSubView('matchlist')}
        onBack={() => { setSubView('hub'); setActiveSession(null); }}
      />
    );
  }
  if (subView === 'matchlist' && activeSession) {
    const matches = MOCK_MATCHES[activeSession.id] ?? [];
    return (
      <RCMatchList
        session={activeSession}
        matches={matches}
        onMatchPress={(match, idx) => {
          setActiveMatch({ match, idx });
          setSubView('scoring');
        }}
        onFinalize={() => {
          setSubView('hub');
          setActiveSession(null);
        }}
        onBack={() => {
          setSubView('hub');
          setActiveSession(null);
        }}
      />
    );
  }
  if (subView === 'scoring' && activeSession && activeMatch) {
    return (
      <RCMatchScoring
        session={activeSession}
        match={activeMatch.match}
        matchIndex={activeMatch.idx}
        onBack={() => {
          setActiveMatch(null);
          setSubView('matchlist');
        }}
      />
    );
  }
  if (subView === 'completion') {
    return (
      <RCCompletion
        redTotal={redTotal}
        blueTotal={blueTotal}
        onDetails={() => setSubView('hub')}
        onDone={() => router.back()}
      />
    );
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
    haptics.light();
    setActiveSession(session);
    if (session.status === 'not_started') {
      setSubView('reveal');
    } else {
      setSubView('matchlist');
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
            <Pressable onPress={() => setSubView('draft')} style={h.draftCta}>
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

          {/* RC Completion CTA when all sessions done */}
          {allSessionsComplete && (
            <Pressable onPress={() => setSubView('completion')} style={h.draftCta}>
              <LinearGradient
                colors={[RC_RED, '#D4AF37', RC_BLUE]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="trophy" size={22} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={[h.draftCtaTitle, { color: '#fff' }]}>View Final Results</Text>
                <Text style={h.draftCtaSub}>All sessions complete</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </Pressable>
          )}

          {/* SESSIONS */}
          <Text style={[h.sectionLabel, { color: c.gold, fontFamily: GEO }]}>SESSIONS</Text>
          {MOCK_RC_SESSIONS.map((session) => (
            <Pressable
              key={session.id}
              onPress={() => handleSessionPress(session)}
              style={({ pressed }) => [h.sessionCard, { backgroundColor: c.cardBg, borderColor: c.border, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
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
    letterSpacing: -1,
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
    borderRadius: 0,
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
    letterSpacing: -1,
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
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
    textTransform: 'uppercase',
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
    padding: 16,
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
    borderRadius: 0,
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
    borderRadius: 0,
  },
  sessionScoreVal: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -1,
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
    fontSize: 13,
    fontWeight: '600',
  },

  /* Invite */
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
  },
  inviteCode: {
    fontSize: 24,
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
    borderRadius: 0,
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
  checkProgressNum: { fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  checkProgressLabel: { fontSize: 10, marginTop: 2 },
  progressTrack: { height: 4, width: '100%', marginTop: 8 },
  progressFill: { height: 4 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
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
  checkText: { fontSize: 13, flex: 1 },
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
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
    textTransform: 'uppercase',
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
    borderRadius: 0,
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
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
});

// ─── Draft styles ────────────────────────────────────────────────────
const d = StyleSheet.create({
  formationRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  formationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  formationPillText: { fontSize: 12, fontWeight: '600' },
  autoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
  },
  autoBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  snakeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  snakeDot: { width: 10, height: 10, borderRadius: 0 },
  snakeText: { fontSize: 13, fontWeight: '600' },
  teamColumnsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  teamColumn: { flex: 1, borderWidth: 2, overflow: 'hidden' },
  teamColHeader: { paddingVertical: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  teamColTitle: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  teamColCount: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  teamColPlayer: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, borderBottomWidth: 1 },
  teamColName: { fontSize: 11, fontWeight: '600' },
  teamColHcp: { fontSize: 9 },
  emptyTeam: { padding: 12, fontSize: 11, fontStyle: 'italic', textAlign: 'center' },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  availableName: { fontSize: 14, fontWeight: '600' },
  availableHcp: { fontSize: 11, marginTop: 1 },
  pickBtns: { flexDirection: 'row', gap: 6 },
  pickBtn: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1 },
  pickBtnText: { fontSize: 12, fontWeight: '700' },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 24,
    overflow: 'hidden',
  },
  confirmBtnText: { color: '#D4AF37', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});

// ─── Matchup Reveal styles ──────────────────────────────────────────
const rv = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { paddingHorizontal: 16, alignItems: 'center', paddingTop: STATUS_BAR_H },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  skipText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 4, marginBottom: 8 },
  formatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 },
  formatText: { color: '#D4AF37', fontSize: 14, fontWeight: '700' },
  matchCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  matchSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchSideBlue: { justifyContent: 'flex-end' },
  matchColorBar: { width: 4, height: 32 },
  matchPlayers: { flex: 1 },
  matchPlayerName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  matchVs: { color: '#D4AF37', fontSize: 12, fontWeight: '800', marginHorizontal: 8 },
  revealBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 20,
  },
  revealBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  startBtn: {
    overflow: 'hidden',
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 20,
  },
  startBtnText: { color: '#D4AF37', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});

// ─── Match List styles ──────────────────────────────────────────────
const ml = StyleSheet.create({
  header: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerScore: { fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  headerDash: { alignItems: 'center' },
  headerSessionLabel: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  headerMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4 },
  matchCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchIndicator: { width: 4, height: '100%', minHeight: 20 },
  matchName: { fontSize: 13, fontWeight: '600' },
  matchStatusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 8,
    alignItems: 'center',
  },
  matchStatusText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  matchHolesText: { fontSize: 9, marginTop: 2 },
  finalizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  finalizeBtnText: { color: '#D4AF37', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});

// ─── Match Scoring styles ───────────────────────────────────────────
const ms = StyleSheet.create({
  header: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  matchNum: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerFormatRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerFormatText: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  headerScoreMini: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniScore: { fontSize: 16, fontWeight: '700', fontFamily: 'Georgia' },
  miniDash: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  holeStrip: { gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  holeNum: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  holeNumText: { fontSize: 13, fontWeight: '700' },
  holeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  holeLabel: { fontSize: 18, fontWeight: '700' },
  holePar: { fontSize: 14, fontWeight: '700' },
  formatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  formatBannerText: { fontSize: 12, fontWeight: '600', flex: 1 },
  teamScoreCard: {
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
  },
  teamScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  teamDotLg: { width: 10, height: 10, borderRadius: 0 },
  teamScoreLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  scoreTypeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  scoreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  scoreBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scoreDisplay: { alignItems: 'center', minWidth: 60 },
  scoreNum: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  scoreName: { fontSize: 11, fontWeight: '600', marginTop: -2 },
  resultBanner: {
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  resultText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  navRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderWidth: 1,
  },
  navBtnText: { fontSize: 14, fontWeight: '600' },
  lockBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  lockBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  runningScore: {
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  runningLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 2 },
  runningScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  runningSide: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamDotSm: { width: 8, height: 8, borderRadius: 0 },
  runningVal: { fontSize: 24, fontWeight: '700', letterSpacing: -1 },
  runningDash: { fontSize: 14 },
  halvedText: { fontSize: 10, marginTop: 4 },
});

// ─── Completion styles ──────────────────────────────────────────────
const cp = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  trophy: { fontSize: 72, marginBottom: 16 },
  champLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 8,
  },
  winnerName: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 32,
  },
  finalScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 48,
  },
  finalNum: { fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  finalDivider: { width: 4, height: 40, gap: 0 },
  finalDivHalf: { flex: 1, width: 4 },
  btns: { gap: 12, width: '100%' },
  detailsBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailsBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  doneBtn: {
    overflow: 'hidden',
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: { color: '#D4AF37', fontSize: 15, fontWeight: '800', letterSpacing: 2 },
});
