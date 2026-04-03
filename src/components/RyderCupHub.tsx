import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { haptics } from '../lib/haptics';
import { GEO } from '../theme/fonts';
import { cardShadowDark, cardShadowLight, dark as darkColors } from '../theme/colors';
import GoldDivider from './GoldDivider';
import { Avatar } from './Avatar';
import { CaptainsPairings } from './CaptainsPairings';
import { DormieMoment } from './DormieMoment';
import type { MomentType } from './DormieMoment';
import type { RCPlayer as CaptainsRCPlayer, Pairing } from './CaptainsPairings';
import type { Trip } from '../data/trips';
import { tripsService } from '../services/trips.service';
import { useAuth } from '../lib/auth';
import type { RyderCupConfig, TripMemberWithUser } from '../lib/database.types';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

function formatInviteCode(trip: Trip): string {
  const prefix = trip.city.slice(0, 3).toUpperCase();
  const year = trip.startDate.slice(0, 4);
  return `DORMIE-${prefix}-${year}`;
}

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

// ─── Helpers to build data from Supabase ─────────────────────────────
const FORMAT_LABELS: Record<string, string> = {
  foursomes: 'Foursomes',
  fourball: 'Four-Ball',
  singles: 'Singles',
  shamble: 'Shamble',
  scramble: 'Scramble',
  greensomes: 'Greensomes',
};

const FORMAT_ICONS: Record<string, string> = {
  foursomes: 'swap-horizontal',
  fourball: 'people',
  singles: 'person',
  shamble: 'golf',
  scramble: 'people-circle',
  greensomes: 'git-merge',
};

function buildSessionsFromConfig(
  config: RyderCupConfig | null,
  tripCourses: { day_number: number; course?: { name: string } }[],
): RCSession[] {
  if (!config || !config.sessions) return [];
  return (config.sessions as any[]).map((s: any, i: number) => {
    const courseForSession = tripCourses[i];
    const format = s.format || 'singles';
    const holeRange = s.holeRange || 'full18';
    const holeCount = holeRange === 'full18' ? 18 : 9;
    return {
      id: s.id || `s${i}`,
      day: i + 1,
      format: format as RCFormat,
      formatLabel: FORMAT_LABELS[format] || format,
      formatIcon: FORMAT_ICONS[format] || 'golf',
      status: 'not_started' as SessionStatus,
      matchCount: s.points || 4,
      holeCount,
      courseName: courseForSession?.course?.name || 'TBD',
    };
  });
}

function buildPlayersFromMembers(members: TripMemberWithUser[]): RCPlayer[] {
  return members.map((m) => ({
    id: m.user_id,
    name: m.user?.name || 'Player',
    handicap: m.user?.handicap_index || 0,
    team: m.team,
  }));
}

// ─── Mock data (fallback when no Supabase data) ─────────────────────

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

const RC_RED = '#B71C1C';
const RC_BLUE = '#1565C0';

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

// ─── Match play helpers ──────────────────────────────────────────────
/** Compute match play status string from hole results. */
function computeMatchStatus(
  holeResults: Record<number, HoleResult>,
  totalHoles: number,
): { status: MatchStatus; leader: 'red' | 'blue' | null; lead: number; holesPlayed: number; finalResult: string | null; winner: 'red' | 'blue' | 'halved' | undefined } {
  const holesPlayed = Object.keys(holeResults).length;
  const redWins = Object.values(holeResults).filter((r) => r.winner === 'red').length;
  const blueWins = Object.values(holeResults).filter((r) => r.winner === 'blue').length;
  const lead = Math.abs(redWins - blueWins);
  const leader: 'red' | 'blue' | null = redWins > blueWins ? 'red' : blueWins > redWins ? 'blue' : null;
  const holesRemaining = totalHoles - holesPlayed;

  // Match is complete: all holes played or lead > remaining holes
  if (holesPlayed === totalHoles) {
    if (lead === 0) {
      return { status: 'HALVED', leader: null, lead: 0, holesPlayed, finalResult: 'HALVED', winner: 'halved' };
    }
    return { status: 'FINAL', leader, lead, holesPlayed, finalResult: `${lead} UP`, winner: leader! };
  }

  // Lead exceeds remaining holes — match is clinched
  if (lead > holesRemaining && holesPlayed > 0) {
    const closedBy = `${lead} & ${holesRemaining}`;
    return { status: 'FINAL', leader, lead, holesPlayed, finalResult: closedBy, winner: leader! };
  }

  // Dormie: lead equals remaining holes
  if (lead === holesRemaining && lead > 0 && holesPlayed > 0) {
    return { status: 'DORMIE', leader, lead, holesPlayed, finalResult: null, winner: undefined };
  }

  // In progress
  if (lead === 0) {
    return { status: 'AS', leader: null, lead: 0, holesPlayed, finalResult: null, winner: undefined };
  }
  const statusStr = `${lead} UP` as MatchStatus;
  return { status: statusStr, leader, lead, holesPlayed, finalResult: null, winner: undefined };
}

/** Format match status for display. */
function formatMatchStatusDisplay(
  status: MatchStatus,
  leader: 'red' | 'blue' | null,
  holesPlayed: number,
  totalHoles: number,
  finalResult: string | null,
): string {
  if (finalResult) return finalResult;
  if (status === 'AS') return holesPlayed > 0 ? `ALL SQUARE thru ${holesPlayed}` : 'ALL SQUARE';
  if (status === 'DORMIE') return `DORMIE (${leader === 'red' ? 'Red' : 'Blue'} leads)`;
  return `${status} thru ${holesPlayed}`;
}


// ─── Sub-view type ──────────────────────────────────────────────────────
type SubView = 'hub' | 'checklist' | 'chat' | 'settings' | 'draft' | 'reveal' | 'matchlist' | 'scoring' | 'completion' | 'pairings';

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
  const c = darkColors;
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
function RCChat({ onBack, rcPlayers }: { onBack: () => void; rcPlayers: RCPlayer[] }) {
  const { theme } = useTheme();
  const c = darkColors;
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
          const player = rcPlayers.find((p) => p.id === msg.userId);
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
function RCSettings({ trip, onBack, rcPlayers, rcSessions }: { trip: Trip; onBack: () => void; rcPlayers: RCPlayer[]; rcSessions: RCSession[] }) {
  const { theme, toggleTheme } = useTheme();
  const c = darkColors;

  const redPlayers = rcPlayers.filter((p) => p.team === 'red');
  const bluePlayers = rcPlayers.filter((p) => p.team === 'blue');

  const configRows: [string, string][] = [
    ['Competition', trip.name],
    ['Location', `${trip.city}, ${trip.state}`],
    ['Course', trip.destination],
    ['Dates', `${trip.startDate} → ${trip.endDate}`],
    ['Team Size', `${trip.playerIds.length / 2}v${trip.playerIds.length / 2}`],
    ['Sessions', `${rcSessions.length}`],
    ['Win Condition', 'Most Points'],
    ['Scoring', 'Win = 1 · Halve = ½ · Loss = 0'],
    ['Invite Code', formatInviteCode(trip)],
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
        {rcPlayers.map((p) => (
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
  tripId,
  onConfirm,
  onBack,
}: {
  players: RCPlayer[];
  tripId?: string;
  onConfirm: (drafted: RCPlayer[]) => void;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const c = darkColors;
  const [formation, setFormation] = useState<Formation>('captain');
  const [draftedPlayers, setDraftedPlayers] = useState<RCPlayer[]>(
    players.map((p) => ({ ...p, team: null })),
  );
  const [snakePickIdx, setSnakePickIdx] = useState(0);
  const [confirming, setConfirming] = useState(false);

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
    if (formation === 'snake_draft') {
      setSnakePickIdx((i) => i + 1);
    }
    // Persist each pick immediately
    if (tripId) {
      tripsService.updateMemberTeam(tripId, playerId, team).catch(() => {});
    }
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

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    haptics.medium();
    try {
      // Persist all team assignments to Supabase
      if (tripId) {
        const members = draftedPlayers
          .filter((p) => p.team !== null)
          .map((p) => ({
            user_id: p.id,
            role: 'player' as const,
            team: p.team,
          }));
        await tripsService.addMembers(tripId, members);
      }
      onConfirm(draftedPlayers);
    } catch {
      Alert.alert('Error', 'Failed to save team assignments. Please try again.');
    } finally {
      setConfirming(false);
    }
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
          onPress={() => canConfirm && handleConfirm()}
          disabled={!canConfirm || confirming}
          style={[d.confirmBtn, { opacity: canConfirm && !confirming ? 1 : 0.4 }]}
        >
          <LinearGradient colors={[RC_RED, RC_BLUE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="checkmark-circle" size={20} color="#C9A227" />
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
          <Ionicons name={session.formatIcon as any} size={18} color="#C9A227" />
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
  const c = darkColors;

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
                {match.winner
                  ? (match.winner === 'halved' ? 'HALVED' : `${match.winner === 'red' ? 'RED' : 'BLUE'} WINS`)
                  : match.status === 'DORMIE' ? 'DORMIE'
                  : match.status === 'AS' ? 'ALL SQUARE'
                  : match.status
                }
              </Text>
              {match.holesPlayed > 0 && !match.winner && (
                <Text style={[ml.matchHolesText, { color: c.textMuted }]}>
                  thru {match.holesPlayed}
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
            <Ionicons name="checkmark-circle" size={20} color="#C9A227" />
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
  onMatchComplete,
  onBack,
}: {
  session: RCSession;
  match: RCMatch;
  matchIndex: number;
  onMatchComplete: (matchId: string, winner: 'red' | 'blue' | 'halved', result: string) => void;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const c = darkColors;

  const totalHoles = session.holeCount;
  const format = session.format;
  const [currentHole, setCurrentHole] = useState(1);
  const [holeResults, setHoleResults] = useState<Record<number, HoleResult>>({});
  const [matchFinished, setMatchFinished] = useState(false);

  // Foursomes/Scramble: one score per team per hole
  const [redTeamScores, setRedTeamScores] = useState<Record<number, number>>({});
  const [blueTeamScores, setBlueTeamScores] = useState<Record<number, number>>({});

  // Four-Ball: individual player scores (best of two per team)
  const [fourBallScores, setFourBallScores] = useState<Record<string, Record<number, number>>>({});

  // Singles: individual player scores
  // (same structure as fourBallScores but only 1 per side)

  // Track which player tees off on each hole for foursomes alternate shot
  const foursomesTeeSide = useCallback((hole: number): { redPlayer: string; bluePlayer: string } => {
    // In foursomes, players alternate tee shots. Odd holes = player 1, even = player 2
    const redIdx = (hole - 1) % 2;
    const blueIdx = (hole - 1) % 2;
    return {
      redPlayer: match.redPlayers[redIdx] || match.redPlayers[0],
      bluePlayer: match.bluePlayers[blueIdx] || match.bluePlayers[0],
    };
  }, [match.redPlayers, match.bluePlayers]);

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
    return c.urgent;
  };

  const par = currentHole <= 4 ? 4 : currentHole % 3 === 0 ? 3 : currentHole % 5 === 0 ? 5 : 4;

  // Get the effective red/blue scores for the current hole based on format
  const getEffectiveScores = (hole: number, holePar: number): { red: number; blue: number } => {
    if (format === 'fourball') {
      // Best ball: take the lower of the two player scores
      const r1 = fourBallScores[match.redPlayers[0]]?.[hole] ?? holePar;
      const r2 = match.redPlayers[1] ? (fourBallScores[match.redPlayers[1]]?.[hole] ?? holePar) : holePar;
      const b1 = fourBallScores[match.bluePlayers[0]]?.[hole] ?? holePar;
      const b2 = match.bluePlayers[1] ? (fourBallScores[match.bluePlayers[1]]?.[hole] ?? holePar) : holePar;
      return { red: Math.min(r1, r2), blue: Math.min(b1, b2) };
    }
    // Foursomes, singles, scramble: team/individual scores
    return {
      red: redTeamScores[hole] ?? holePar,
      blue: blueTeamScores[hole] ?? holePar,
    };
  };

  const { red: effectiveRed, blue: effectiveBlue } = getEffectiveScores(currentHole, par);

  // Compute match status from all locked holes
  const matchStatus = useMemo(() => computeMatchStatus(holeResults, totalHoles), [holeResults, totalHoles]);
  const holeResult = holeResults[currentHole];

  // Check if match is clinched after each hole lock
  useEffect(() => {
    if (matchFinished) return;
    if (matchStatus.winner) {
      setMatchFinished(true);
      const resultStr = matchStatus.finalResult || (matchStatus.winner === 'halved' ? 'HALVED' : '1 UP');
      haptics.heavy();
      onMatchComplete(match.id, matchStatus.winner, resultStr);
    }
  }, [matchStatus.winner, matchFinished, match.id, onMatchComplete, matchStatus.finalResult]);

  const formatBanner = () => {
    if (format === 'fourball') return 'Four-Ball: Enter each player\'s score. Best ball counts for the team.';
    if (format === 'foursomes') {
      const tee = foursomesTeeSide(currentHole);
      return `Alternate Shot: ${tee.redPlayer} tees off for Red, ${tee.bluePlayer} for Blue.`;
    }
    if (format === 'scramble') return 'Scramble: Enter the team score.';
    return null;
  };

  const lockHole = () => {
    const scores = getEffectiveScores(currentHole, par);
    const winner: 'red' | 'blue' | 'halved' =
      scores.red < scores.blue ? 'red' : scores.blue < scores.red ? 'blue' : 'halved';
    setHoleResults((prev) => ({
      ...prev,
      [currentHole]: { redScore: scores.red, blueScore: scores.blue, winner },
    }));
    haptics.light();
  };

  const renderScoreControl = (
    label: string,
    teamColor: string,
    score: number,
    onChange: (delta: number) => void,
  ) => (
    <View style={[ms.teamScoreCard, { backgroundColor: `${teamColor}08`, borderColor: teamColor }]}>
      <View style={[ms.teamScoreHeader, { borderColor: `${teamColor}30` }]}>
        <View style={[ms.teamDotLg, { backgroundColor: teamColor }]} />
        <Text style={[ms.teamScoreLabel, { color: teamColor }]}>{label}</Text>
      </View>
      <View style={ms.scoreControls}>
        <Pressable
          onPress={() => onChange(-1)}
          style={[ms.scoreBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
        >
          <Ionicons name="remove" size={22} color={c.text} />
        </Pressable>
        <View style={ms.scoreDisplay}>
          <Text style={[ms.scoreNum, { color: getScoreColor(score, par), fontFamily: GEO }]}>
            {score}
          </Text>
          <Text style={[ms.scoreName, { color: getScoreColor(score, par) }]}>
            {getScoreName(score, par)}
          </Text>
        </View>
        <Pressable
          onPress={() => onChange(1)}
          style={[ms.scoreBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
        >
          <Ionicons name="add" size={22} color={c.text} />
        </Pressable>
      </View>
    </View>
  );

  const renderFourBallScoring = () => {
    const players = [
      { names: match.redPlayers, color: RC_RED, team: 'red' as const },
      { names: match.bluePlayers, color: RC_BLUE, team: 'blue' as const },
    ];
    return players.map(({ names, color }) =>
      names.map((name) => {
        const score = fourBallScores[name]?.[currentHole] ?? par;
        return renderScoreControl(
          name,
          color,
          score,
          (delta) => {
            setFourBallScores((prev) => ({
              ...prev,
              [name]: {
                ...(prev[name] || {}),
                [currentHole]: Math.max(1, Math.min(12, (prev[name]?.[currentHole] ?? par) + delta)),
              },
            }));
          },
        );
      })
    );
  };

  // Match status display string
  const statusDisplay = formatMatchStatusDisplay(
    matchStatus.status,
    matchStatus.leader,
    matchStatus.holesPlayed,
    totalHoles,
    matchStatus.finalResult,
  );

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
          <Text style={[ms.miniScore, { color: RC_RED }]}>
            {matchStatus.leader === 'red' ? matchStatus.lead : 0}
          </Text>
          <Text style={ms.miniDash}>-</Text>
          <Text style={[ms.miniScore, { color: '#aac' }]}>
            {matchStatus.leader === 'blue' ? matchStatus.lead : 0}
          </Text>
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

        {/* Match status banner */}
        <View style={[ms.matchStatusBanner, { backgroundColor: `${matchStatus.leader === 'red' ? RC_RED : matchStatus.leader === 'blue' ? RC_BLUE : c.gold}10` }]}>
          <Text style={[ms.matchStatusText, {
            color: matchStatus.leader === 'red' ? RC_RED : matchStatus.leader === 'blue' ? RC_BLUE : c.gold,
            fontFamily: GEO,
          }]}>
            {statusDisplay}
          </Text>
        </View>

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

        {/* Scoring inputs based on format */}
        {format === 'fourball' ? (
          // Four-Ball: individual scores for each player
          renderFourBallScoring()
        ) : (
          // Foursomes, Singles, Scramble: team/individual scores
          <>
            {renderScoreControl(
              format === 'singles' ? match.redPlayers[0] : match.redPlayers.join(' & '),
              RC_RED,
              redTeamScores[currentHole] ?? par,
              (delta) => setRedTeamScores((p) => ({
                ...p,
                [currentHole]: Math.max(1, Math.min(12, (p[currentHole] ?? par) + delta)),
              })),
            )}
            {renderScoreControl(
              format === 'singles' ? match.bluePlayers[0] : match.bluePlayers.join(' & '),
              RC_BLUE,
              blueTeamScores[currentHole] ?? par,
              (delta) => setBlueTeamScores((p) => ({
                ...p,
                [currentHole]: Math.max(1, Math.min(12, (p[currentHole] ?? par) + delta)),
              })),
            )}
          </>
        )}

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

          {!holeResult && !matchFinished && (
            <Pressable onPress={lockHole} style={[ms.lockBtn, { backgroundColor: c.teal }]}>
              <Text style={[ms.lockBtnText, { fontFamily: GEO }]}>Lock Hole</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              if (matchFinished) {
                onBack();
              } else if (currentHole < totalHoles) {
                if (!holeResult) lockHole();
                setCurrentHole(currentHole + 1);
              } else {
                if (!holeResult) lockHole();
                onBack();
              }
            }}
            style={[ms.navBtn, { backgroundColor: currentHole === totalHoles || matchFinished ? '#1E4D2B' : c.elevated, borderColor: currentHole === totalHoles || matchFinished ? '#1E4D2B' : c.border }]}
          >
            <Text style={[ms.navBtnText, { color: currentHole === totalHoles || matchFinished ? '#C9A227' : c.text }]}>
              {matchFinished ? 'Done' : currentHole === totalHoles ? 'Finish' : 'Next'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={currentHole === totalHoles || matchFinished ? '#C9A227' : c.text} />
          </Pressable>
        </View>

        {/* Running match score */}
        <View style={[ms.runningScore, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <Text style={[ms.runningLabel, { color: c.textMuted }]}>MATCH PLAY STATUS</Text>
          <View style={ms.runningScoreRow}>
            <View style={ms.runningSide}>
              <View style={[ms.teamDotSm, { backgroundColor: RC_RED }]} />
              <Text style={[ms.runningVal, { color: RC_RED, fontFamily: GEO }]}>
                {Object.values(holeResults).filter((r) => r.winner === 'red').length}
              </Text>
            </View>
            <Text style={[ms.runningDash, { color: c.textMuted }]}>—</Text>
            <View style={ms.runningSide}>
              <Text style={[ms.runningVal, { color: RC_BLUE, fontFamily: GEO }]}>
                {Object.values(holeResults).filter((r) => r.winner === 'blue').length}
              </Text>
              <View style={[ms.teamDotSm, { backgroundColor: RC_BLUE }]} />
            </View>
          </View>
          <Text style={[ms.halvedText, { color: c.textMuted }]}>
            {Object.values(holeResults).filter((r) => r.winner === 'halved').length} halved · {matchStatus.holesPlayed} of {totalHoles} holes
          </Text>
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
  const winnerColor = winner === 'red' ? RC_RED : winner === 'blue' ? RC_BLUE : '#C9A227';
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
            : ['#C9A227', '#0A0A0A', '#2A2A1A']
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
  const c = darkColors;
  const router = useRouter();
  const { user } = useAuth();

  const [subView, setSubView] = useState<SubView>('hub');
  const [checklist, setChecklist] = useState(MOCK_RC_CHECKLIST);
  const [activeSession, setActiveSession] = useState<RCSession | null>(null);
  const [activeMatch, setActiveMatch] = useState<{ match: RCMatch; idx: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Real data from Supabase
  const [players, setPlayers] = useState<RCPlayer[]>([]);
  const [sessions, setSessions] = useState<RCSession[]>([]);
  const [matches, setMatches] = useState<Record<string, RCMatch[]>>({});

  // Pairings state for CaptainsPairings
  const [pairings, setPairings] = useState<Pairing[]>([]);

  // Dormie moment state
  const [momentVisible, setMomentVisible] = useState(false);
  const [momentType, setMomentType] = useState<MomentType>('CUP_CLINCHED');
  const [momentPlayer, setMomentPlayer] = useState('');
  const [momentDetail, setMomentDetail] = useState('');

  // Derived: teams drafted when all players have a team assigned
  const teamsDrafted = players.length > 0 && players.every((p) => p.team !== null);
  const isCaptain = user?.id === trip.createdBy || trip.playerIds?.[0] === user?.id;

  // Fetch real data from Supabase
  const fetchData = useCallback(async () => {
    if (!trip.id) return;
    try {
      // Fetch members
      const members = await tripsService.getMembers(trip.id);
      if (members.length > 0) {
        setPlayers(buildPlayersFromMembers(members));
      }

      // Fetch courses
      const tripCourses = await tripsService.getCourses(trip.id);

      // Build sessions from ryder_cup_config
      const tripData = await tripsService.getById(trip.id);
      const config = (tripData as any).ryder_cup_config as RyderCupConfig | null;
      if (config && config.sessions && (config.sessions as any[]).length > 0) {
        const builtSessions = buildSessionsFromConfig(config, tripCourses);
        if (builtSessions.length > 0) {
          // Compute session scores from rounds
          const rounds = await tripsService.getTripRounds(trip.id);
          const memberMap = new Map(members.map((m) => [m.user_id, m.team]));

          builtSessions.forEach((session, idx) => {
            // Find rounds played on this session's day
            const dayRounds = rounds.filter((r: any) => {
              const courseMatch = tripCourses[idx];
              return courseMatch && r.course_id === courseMatch.course_id;
            });

            if (dayRounds.length > 0) {
              let redScore = 0;
              let blueScore = 0;
              dayRounds.forEach((r: any) => {
                const team = memberMap.get(r.user_id);
                if (team === 'red') redScore += 1;
                else if (team === 'blue') blueScore += 1;
              });
              // Normalize to match-play points (each round = portion of session)
              const matchCount = session.matchCount || 4;
              session.redScore = Math.min(redScore / 2, matchCount);
              session.blueScore = Math.min(blueScore / 2, matchCount);
              session.status = dayRounds.length >= matchCount * 2 ? 'complete' : 'live';
            }
          });

          setSessions(builtSessions);

          // Build match stubs from sessions (for matchup reveals)
          const newMatches: Record<string, RCMatch[]> = {};
          const redPlayers = members.filter((m) => m.team === 'red');
          const bluePlayers = members.filter((m) => m.team === 'blue');

          builtSessions.forEach((session) => {
            const sessionMatches: RCMatch[] = [];
            const pairCount = Math.min(
              session.format === 'singles' ? redPlayers.length : Math.floor(redPlayers.length / 2),
              session.matchCount,
            );
            for (let i = 0; i < pairCount; i++) {
              if (session.format === 'singles') {
                const rp = redPlayers[i % redPlayers.length];
                const bp = bluePlayers[i % bluePlayers.length];
                sessionMatches.push({
                  id: `${session.id}-m${i}`,
                  redPlayers: [rp?.user?.name || 'TBD'],
                  bluePlayers: [bp?.user?.name || 'TBD'],
                  status: 'AS',
                  redScore: 0,
                  blueScore: 0,
                  holesPlayed: 0,
                });
              } else {
                const r1 = redPlayers[i * 2 % redPlayers.length];
                const r2 = redPlayers[(i * 2 + 1) % redPlayers.length];
                const b1 = bluePlayers[i * 2 % bluePlayers.length];
                const b2 = bluePlayers[(i * 2 + 1) % bluePlayers.length];
                sessionMatches.push({
                  id: `${session.id}-m${i}`,
                  redPlayers: [r1?.user?.name || 'TBD', r2?.user?.name || 'TBD'],
                  bluePlayers: [b1?.user?.name || 'TBD', b2?.user?.name || 'TBD'],
                  status: 'AS',
                  redScore: 0,
                  blueScore: 0,
                  holesPlayed: 0,
                });
              }
            }
            newMatches[session.id] = sessionMatches;
          });
          setMatches(newMatches);
        }
      }
    } catch {
      // Silently keep empty state on error
    } finally {
      setLoading(false);
    }
  }, [trip.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Match completion callback ────────────────────────────────────
  const handleMatchComplete = useCallback((matchId: string, winner: 'red' | 'blue' | 'halved', result: string) => {
    // Update the match in state
    setMatches((prev) => {
      const updated = { ...prev };
      for (const sessionId of Object.keys(updated)) {
        updated[sessionId] = updated[sessionId].map((m) => {
          if (m.id !== matchId) return m;
          return {
            ...m,
            winner,
            status: (winner === 'halved' ? 'HALVED' : 'FINAL') as MatchStatus,
            redScore: winner === 'red' ? 1 : winner === 'halved' ? 0.5 : 0,
            blueScore: winner === 'blue' ? 1 : winner === 'halved' ? 0.5 : 0,
            holesPlayed: m.holesPlayed,
          };
        });
      }
      return updated;
    });

    // Update session scores
    setSessions((prev) => prev.map((s) => {
      const sessionMatchList = matches[s.id];
      if (!sessionMatchList) return s;
      const hasMatch = sessionMatchList.some((m) => m.id === matchId);
      if (!hasMatch) return s;

      // Recompute session scores
      const updatedMatches = sessionMatchList.map((m) => {
        if (m.id !== matchId) return m;
        return { ...m, winner, redScore: winner === 'red' ? 1 : winner === 'halved' ? 0.5 : 0, blueScore: winner === 'blue' ? 1 : winner === 'halved' ? 0.5 : 0 };
      });
      const redPts = updatedMatches.reduce((sum, m) => sum + (m.winner === 'red' ? 1 : m.winner === 'halved' ? 0.5 : 0), 0);
      const bluePts = updatedMatches.reduce((sum, m) => sum + (m.winner === 'blue' ? 1 : m.winner === 'halved' ? 0.5 : 0), 0);
      const allDone = updatedMatches.every((m) => m.winner != null);

      return {
        ...s,
        redScore: redPts,
        blueScore: bluePts,
        status: allDone ? 'complete' as SessionStatus : 'live' as SessionStatus,
      };
    }));
  }, [matches]);

  // ─── Generate pairings slots for the active session ──────────────
  const buildPairingsForSession = useCallback((session: RCSession) => {
    const slots: Pairing[] = [];
    for (let i = 0; i < session.matchCount; i++) {
      slots.push({
        id: `${session.id}-p${i}`,
        player1Id: null,
        player2Id: null,
        format: session.formatLabel,
        sessionIndex: sessions.indexOf(session),
      });
    }
    setPairings(slots);
  }, [sessions]);

  const toggleCheck = (id: string) => {
    haptics.light();
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );
  };

  // Scores
  const redTotal = sessions.reduce((s, ss) => s + (ss.redScore ?? 0), 0);
  const blueTotal = sessions.reduce((s, ss) => s + (ss.blueScore ?? 0), 0);
  const totalPoints = sessions.reduce((s, ss) => s + ss.matchCount, 0);
  const winThreshold = totalPoints / 2 + 0.5; // e.g., 14.5 for 28-match format
  const allSessionsComplete = sessions.every((ss) => ss.status === 'complete');

  // Cup winner detection
  const cupWinner: 'red' | 'blue' | null = redTotal >= winThreshold ? 'red' : blueTotal >= winThreshold ? 'blue' : null;
  const [cupCelebrated, setCupCelebrated] = useState(false);

  useEffect(() => {
    if (cupWinner && !cupCelebrated) {
      setCupCelebrated(true);
      setMomentType('CUP_CLINCHED');
      setMomentPlayer(cupWinner === 'red' ? 'Team Red' : 'Team Blue');
      setMomentDetail(`${cupWinner === 'red' ? redTotal : blueTotal} - ${cupWinner === 'red' ? blueTotal : redTotal}`);
      setMomentVisible(true);
      // Auto-navigate to completion after moment dismisses
      setTimeout(() => {
        setMomentVisible(false);
        setSubView('completion');
      }, 5000);
    }
  }, [cupWinner, cupCelebrated, redTotal, blueTotal]);

  // Sub-views
  if (subView === 'checklist') {
    return <RCChecklist checklist={checklist} onToggle={toggleCheck} onBack={() => setSubView('hub')} />;
  }
  if (subView === 'chat') {
    return <RCChat onBack={() => setSubView('hub')} rcPlayers={players} />;
  }
  if (subView === 'settings') {
    return <RCSettings trip={trip} onBack={() => setSubView('hub')} rcPlayers={players} rcSessions={sessions} />;
  }
  if (subView === 'draft') {
    return (
      <RCTeamDraft
        players={players}
        tripId={trip.id}
        onConfirm={(drafted) => {
          setPlayers(drafted);
          setSubView('hub');
        }}
        onBack={() => setSubView('hub')}
      />
    );
  }
  if (subView === 'reveal' && activeSession) {
    const sessionMatches = matches[activeSession.id] ?? [];
    return (
      <RCMatchupReveal
        session={activeSession}
        matches={sessionMatches}
        onStartScoring={() => setSubView('matchlist')}
        onBack={() => { setSubView('hub'); setActiveSession(null); }}
      />
    );
  }
  if (subView === 'matchlist' && activeSession) {
    const sessionMatches = matches[activeSession.id] ?? [];
    return (
      <RCMatchList
        session={activeSession}
        matches={sessionMatches}
        onMatchPress={(match, idx) => {
          setActiveMatch({ match, idx });
          setSubView('scoring');
        }}
        onFinalize={() => {
          // Mark session as complete with final scores
          if (activeSession) {
            const sessionMatchList = matches[activeSession.id] ?? [];
            const redPts = sessionMatchList.reduce((s, m) => s + (m.winner === 'red' ? 1 : m.winner === 'halved' ? 0.5 : 0), 0);
            const bluePts = sessionMatchList.reduce((s, m) => s + (m.winner === 'blue' ? 1 : m.winner === 'halved' ? 0.5 : 0), 0);
            setSessions((prev) => prev.map((s) =>
              s.id === activeSession.id
                ? { ...s, status: 'complete' as SessionStatus, redScore: redPts, blueScore: bluePts }
                : s
            ));
          }
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
  if (subView === 'pairings' && activeSession) {
    const redPlayers = players.filter((p) => p.team === 'red').map((p) => ({
      id: p.id, name: p.name, handicap: p.handicap, avatarColor: '#B71C1C',
    }));
    const bluePlayers = players.filter((p) => p.team === 'blue').map((p) => ({
      id: p.id, name: p.name, handicap: p.handicap, avatarColor: '#1565C0',
    }));

    return (
      <View style={[h.screen, { backgroundColor: c.bg }]}>
        <LinearGradient colors={[RC_BLUE, RC_RED]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={h.subHeader}>
          <Pressable onPress={() => { setSubView('hub'); setActiveSession(null); }} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={[h.subHeaderTitle, { fontFamily: GEO }]}>Set Pairings</Text>
          <Pressable
            onPress={() => {
              // Convert pairings to matches and proceed to reveal
              const newMatches: RCMatch[] = pairings.map((p, i) => {
                const r1 = players.find((pl) => pl.id === p.player1Id);
                const r2 = players.find((pl) => pl.id === p.player2Id);
                // For singles, player1 is red and player2 is blue
                if (activeSession.format === 'singles') {
                  return {
                    id: `${activeSession.id}-m${i}`,
                    redPlayers: [r1?.name || 'TBD'],
                    bluePlayers: [r2?.name || 'TBD'],
                    status: 'AS' as MatchStatus,
                    redScore: 0,
                    blueScore: 0,
                    holesPlayed: 0,
                  };
                }
                // For team formats, both players go on same side
                return {
                  id: `${activeSession.id}-m${i}`,
                  redPlayers: [r1?.name || 'TBD', r2?.name || 'TBD'],
                  bluePlayers: [],
                  status: 'AS' as MatchStatus,
                  redScore: 0,
                  blueScore: 0,
                  holesPlayed: 0,
                };
              });
              // Build proper red/blue matches from paired red/blue pairings
              const redPairings = pairings.filter((p) => {
                const p1 = redPlayers.find((rp) => rp.id === p.player1Id);
                return !!p1;
              });
              const bluePairings = pairings.filter((p) => {
                const p1 = bluePlayers.find((bp) => bp.id === p.player1Id);
                return !!p1;
              });
              const pairedMatches: RCMatch[] = [];
              const matchCount = Math.min(redPairings.length, bluePairings.length, activeSession.matchCount);
              for (let i = 0; i < matchCount; i++) {
                const rp = redPairings[i];
                const bp = bluePairings[i];
                const rName1 = players.find((pl) => pl.id === rp?.player1Id)?.name || 'TBD';
                const rName2 = players.find((pl) => pl.id === rp?.player2Id)?.name;
                const bName1 = players.find((pl) => pl.id === bp?.player1Id)?.name || 'TBD';
                const bName2 = players.find((pl) => pl.id === bp?.player2Id)?.name;
                pairedMatches.push({
                  id: `${activeSession.id}-m${i}`,
                  redPlayers: rName2 ? [rName1, rName2] : [rName1],
                  bluePlayers: bName2 ? [bName1, bName2] : [bName1],
                  status: 'AS',
                  redScore: 0,
                  blueScore: 0,
                  holesPlayed: 0,
                });
              }
              setMatches((prev) => ({ ...prev, [activeSession.id]: pairedMatches }));
              setSubView('reveal');
            }}
            hitSlop={12}
          >
            <Text style={{ color: '#C9A227', fontSize: 14, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </LinearGradient>
        <View style={{ flex: 1, padding: 16 }}>
          <CaptainsPairings
            teamRed={redPlayers}
            teamBlue={bluePlayers}
            teamRedName="Team Red"
            teamBlueName="Team Blue"
            pairings={pairings}
            onPairingsChange={setPairings}
            isCaptain={isCaptain}
          />
        </View>
      </View>
    );
  }
  if (subView === 'scoring' && activeSession && activeMatch) {
    return (
      <RCMatchScoring
        session={activeSession}
        match={activeMatch.match}
        matchIndex={activeMatch.idx}
        onMatchComplete={handleMatchComplete}
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
      // If teams are drafted and captain wants to set pairings, show pairings first
      if (teamsDrafted && isCaptain) {
        buildPairingsForSession(session);
        setSubView('pairings');
      } else {
        setSubView('reveal');
      }
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
            <Text style={h.winCalloutText}>
              {cupWinner
                ? `${cupWinner === 'red' ? 'TEAM RED' : 'TEAM BLUE'} WINS THE CUP!`
                : `First to ${winThreshold % 1 === 0 ? winThreshold : winThreshold.toFixed(1)} points wins`
              }
            </Text>
          </View>

          {/* Points needed tracker */}
          {!cupWinner && redTotal + blueTotal > 0 && (
            <View style={h.pointsNeededRow}>
              <Text style={[h.pointsNeededText, { color: RC_RED }]}>
                Red needs {Math.max(0, winThreshold - redTotal) % 1 === 0 ? Math.max(0, winThreshold - redTotal) : Math.max(0, winThreshold - redTotal).toFixed(1)}
              </Text>
              <Text style={[h.pointsNeededText, { color: RC_BLUE }]}>
                Blue needs {Math.max(0, winThreshold - blueTotal) % 1 === 0 ? Math.max(0, winThreshold - blueTotal) : Math.max(0, winThreshold - blueTotal).toFixed(1)}
              </Text>
            </View>
          )}
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
              <Ionicons name="people" size={22} color="#C9A227" />
              <View style={{ flex: 1 }}>
                <Text style={[h.draftCtaTitle, { fontFamily: GEO }]}>Draft Teams</Text>
                <Text style={h.draftCtaSub}>
                  Captain&apos;s Picks · {trip.playerIds.length} players
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C9A227" />
            </Pressable>
          )}

          {/* RC Completion CTA when all sessions done */}
          {allSessionsComplete && (
            <Pressable onPress={() => setSubView('completion')} style={h.draftCta}>
              <LinearGradient
                colors={[RC_RED, '#C9A227', RC_BLUE]}
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
          {sessions.map((session) => (
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
              Clipboard.setString(formatInviteCode(trip));
              Alert.alert('Copied!', `Invite code ${formatInviteCode(trip)} copied to clipboard.`);
            }}
            style={[h.inviteRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Text style={[h.inviteCode, { color: c.gold, fontFamily: GEO, flex: 1 }]} numberOfLines={1} adjustsFontSizeToFit>{formatInviteCode(trip)}</Text>
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
        data={players}
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

      {/* Cup clinched celebration moment */}
      <DormieMoment
        visible={momentVisible}
        type={momentType}
        playerName={momentPlayer}
        detail={momentDetail}
        onDismiss={() => setMomentVisible(false)}
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
  pointsNeededRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  pointsNeededText: {
    fontSize: 10,
    fontWeight: '600',
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
    color: '#C9A227',
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
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 3,
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
    paddingTop: 12,
    paddingBottom: 16,
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
  confirmBtnText: { color: '#C9A227', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
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
  formatText: { color: '#C9A227', fontSize: 14, fontWeight: '700' },
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
  matchVs: { color: '#C9A227', fontSize: 12, fontWeight: '800', marginHorizontal: 8 },
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
  startBtnText: { color: '#C9A227', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
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
  finalizeBtnText: { color: '#C9A227', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
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
  matchStatusBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 4,
    alignItems: 'center',
  },
  matchStatusText: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
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
  doneBtnText: { color: '#C9A227', fontSize: 15, fontWeight: '800', letterSpacing: 2 },
});
