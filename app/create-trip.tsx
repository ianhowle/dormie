import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { cardShadowDark, cardShadowLight } from '../src/theme/colors';
import { haptics } from '../src/lib/haptics';
import { useToast } from '../src/components/Toast';
import { Avatar } from '../src/components/Avatar';
import GoldDivider from '../src/components/GoldDivider';
import { RyderCupWizard } from '../src/components/RyderCupWizard';
import { useAuth } from '../src/lib/auth';
import { tripsService } from '../src/services/trips.service';
import {
  SCORING_FORMATS,
  SIDE_GAMES,
  type ScoringFormat,
  type SideGame,
} from '../src/data/scoring';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

type TripType = 'quick' | 'planned' | 'ryder';

type Player = { id: string; name: string; handicap: number };

const QUICK_FILL = ['Scottsdale', 'Myrtle Beach', 'Bandon', 'Pinehurst', 'Pebble Beach'];

const PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8, 10, 12];

// ─── Format descriptions ──────────────────────────────────────────────
const FORMAT_RULES: Record<string, string> = {
  stroke_play: 'Count every stroke. Lowest total score wins. The classic format for most competitive rounds.',
  stableford: 'Earn points per hole based on score relative to par. Double bogey or worse = 0, bogey = 1, par = 2, birdie = 3, eagle = 4.',
  modified_stableford: 'Aggressive points: eagle +5, birdie +2, par 0, bogey -1, double -3. Rewards attacking play.',
  match_play: 'Win individual holes. Most holes won takes the match. Ties are halved. Can concede holes.',
  best_ball: 'Teams of 2. Each player plays their own ball, best score on each hole counts for the team.',
  scramble: 'All players tee off, pick the best shot, everyone plays from there. Repeat until holed out.',
  wolf: 'Rotating "wolf" picks a partner after seeing drives, or goes lone wolf for double points.',
  shamble: 'Pick the best tee shot, then everyone plays their own ball from that spot.',
  fourball: 'Two-person teams. Both play their own ball, better score of the pair counts each hole.',
};

// ─── Side game descriptions ───────────────────────────────────────────
const SIDE_RULES: Record<string, string> = {
  dots: 'Earn/lose dots: birdie +1, eagle +2, double+ -1. Most dots wins.',
  snake: 'Last person to 3-putt holds the snake. Holder pays at the end.',
  greenies: 'Closest to the pin on par 3s wins the greenie. Must make par or better to collect.',
  skins: 'Lowest score on a hole wins the skin. Ties carry over to the next hole.',
  hammer: 'Press the bet at any time. Opponent must accept (double stakes) or concede.',
  nassau: 'Three bets in one: front 9, back 9, and overall 18. Press available on each.',
  wolf: 'Rotating wolf picks partner or plays alone. Lone wolf = 2x points.',
  sandies: 'Get up and down from a bunker for par or better. Bonus points.',
  bark: 'Hit a tree and still make par or better on the hole.',
  arnies: 'Make par without hitting the fairway. Named after The King.',
  close_shave: 'Closest to the pin on designated holes. KP marker on the green.',
};

// ─── Section label ────────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[z.sectionLabel, { color: theme.colors.gold, fontFamily: GEO }]}>
      {title}
    </Text>
  );
}

// ─── Step 1: Trip type selection ──────────────────────────────────────
function TypeSelection({ onSelect }: { onSelect: (t: TripType) => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  return (
    <View style={[z.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[z.header, { backgroundColor: c.surface }]}>
          <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </Pressable>
          <Text style={[z.headerTitle, { color: c.text, fontFamily: GEO }]}>
            New Trip
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={z.body}>
          <Text style={[z.typePrompt, { color: c.textMuted }]}>
            What kind of trip are you planning?
          </Text>

          {/* Quick Trip */}
          <Pressable
            onPress={() => { haptics.light(); onSelect('quick'); }}
            style={[z.typeCard, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Text style={z.typeEmoji}>🏃</Text>
            <Text style={[z.typeName, { color: c.text }]}>Quick Trip</Text>
            <View style={z.tagRow}>
              <View style={[z.tag, { backgroundColor: `${c.teal}15` }]}>
                <Text style={[z.tagText, { color: c.teal }]}>Fast setup</Text>
              </View>
              <View style={[z.tag, { backgroundColor: `${c.teal}15` }]}>
                <Text style={[z.tagText, { color: c.teal }]}>Flexible</Text>
              </View>
            </View>
            <Text style={[z.typeDesc, { color: c.textMuted }]}>
              Get a round going fast. Pick a course, add friends, and tee off. Perfect for weekend rounds and spontaneous golf.
            </Text>
          </Pressable>

          {/* Plan Ahead */}
          <Pressable
            onPress={() => { haptics.light(); onSelect('planned'); }}
            style={[z.typeCard, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Text style={z.typeEmoji}>📅</Text>
            <Text style={[z.typeName, { color: c.text }]}>Plan Ahead</Text>
            <View style={z.tagRow}>
              <View style={[z.tag, { backgroundColor: `${c.gold}15` }]}>
                <Text style={[z.tagText, { color: c.gold }]}>Course voting</Text>
              </View>
              <View style={[z.tag, { backgroundColor: `${c.gold}15` }]}>
                <Text style={[z.tagText, { color: c.gold }]}>Invite link</Text>
              </View>
            </View>
            <Text style={[z.typeDesc, { color: c.textMuted }]}>
              Plan a multi-day golf trip with your crew. Set dates, vote on courses, share invite codes, and build the perfect itinerary.
            </Text>
          </Pressable>

          {/* Ryder Cup */}
          <Pressable
            onPress={() => { haptics.light(); onSelect('ryder'); }}
            style={[z.typeCard, { overflow: 'hidden' }]}
          >
            <LinearGradient
              colors={['#1A3A5C', '#C44B4F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={z.rcGradientBg}
            />
            <Text style={z.typeEmoji}>🏆</Text>
            <Text style={[z.typeName, { color: '#fff' }]}>Ryder Cup</Text>
            <View style={z.tagRow}>
              <View style={[z.tag, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={[z.tagText, { color: '#fff' }]}>Team draft</Text>
              </View>
              <View style={[z.tag, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={[z.tagText, { color: '#fff' }]}>Match play</Text>
              </View>
              <View style={[z.tag, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={[z.tagText, { color: '#fff' }]}>Point system</Text>
              </View>
            </View>
            <Text style={[z.typeDesc, { color: 'rgba(255,255,255,0.7)' }]}>
              The ultimate team competition. Draft teams, set pairings, play foursomes and singles matches. Captain picks and a full point system.
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Step 2: Trip form ────────────────────────────────────────────────
function TripForm({ tripType }: { tripType: 'quick' | 'planned' }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  // State
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [format, setFormat] = useState<ScoringFormat>('stroke_play');
  const [expandedFormat, setExpandedFormat] = useState<ScoringFormat | null>(null);
  const [sideGames, setSideGames] = useState<Set<SideGame>>(new Set());
  const [expandedSide, setExpandedSide] = useState<SideGame | null>(null);
  const [stakes, setStakes] = useState('');
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'Ian McGowan', handicap: 8 },
  ]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addName, setAddName] = useState('');
  const [addHcp, setAddHcp] = useState('');

  const toggleSideGame = (g: SideGame) => {
    setSideGames((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const handleAddPlayer = () => {
    if (addName.trim().length === 0) return;
    setPlayers((prev) => [
      ...prev,
      { id: `p-${Date.now()}`, name: addName.trim(), handicap: Number(addHcp) || 0 },
    ]);
    setAddName('');
    setAddHcp('');
    setShowAddPlayer(false);
  };

  const canCreate = name.trim().length > 0 && location.trim().length > 0;

  return (
    <View style={[z.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={[z.header, { backgroundColor: c.surface }]}>
            <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
              <Ionicons name="chevron-back" size={24} color={c.text} />
            </Pressable>
            <Text style={[z.headerTitle, { color: c.text, fontFamily: GEO }]}>
              {tripType === 'quick' ? 'Quick Trip' : 'Plan a Trip'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={z.body}>
            {/* Trip name */}
            <SectionLabel title="TRIP NAME" />
            <TextInput
              style={[z.input, { color: c.text, backgroundColor: c.elevated, borderColor: c.border, fontFamily: GEO }]}
              placeholder="e.g. Scottsdale 2026"
              placeholderTextColor={c.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            {/* Location */}
            <SectionLabel title="LOCATION" />
            <TextInput
              style={[z.input, { color: c.text, backgroundColor: c.elevated, borderColor: c.border }]}
              placeholder="City or destination"
              placeholderTextColor={c.textMuted}
              value={location}
              onChangeText={setLocation}
              autoCapitalize="words"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={z.quickFillScroll}
            >
              {QUICK_FILL.map((dest) => (
                <Pressable
                  key={dest}
                  onPress={() => { haptics.light(); setLocation(dest); }}
                  style={[
                    z.quickFillChip,
                    {
                      backgroundColor: location === dest ? `${c.teal}20` : c.elevated,
                      borderColor: location === dest ? c.teal : c.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      z.quickFillText,
                      { color: location === dest ? c.teal : c.textMuted },
                    ]}
                  >
                    {dest}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Dates */}
            {tripType === 'planned' && (
              <>
                <SectionLabel title="DATES" />
                <View style={z.dateRow}>
                  <TextInput
                    style={[z.input, z.dateInput, { color: c.text, backgroundColor: c.elevated, borderColor: c.border }]}
                    placeholder="Start (YYYY-MM-DD)"
                    placeholderTextColor={c.textMuted}
                    value={startDate}
                    onChangeText={setStartDate}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={[z.dateTo, { color: c.textMuted }]}>to</Text>
                  <TextInput
                    style={[z.input, z.dateInput, { color: c.text, backgroundColor: c.elevated, borderColor: c.border }]}
                    placeholder="End (YYYY-MM-DD)"
                    placeholderTextColor={c.textMuted}
                    value={endDate}
                    onChangeText={setEndDate}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </>
            )}

            {/* Player count */}
            <SectionLabel title="NUMBER OF PLAYERS" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={z.pillScroll}
            >
              {PLAYER_COUNTS.map((n) => {
                const active = n === playerCount;
                return (
                  <Pressable
                    key={n}
                    onPress={() => { haptics.light(); setPlayerCount(n); }}
                    style={[
                      z.countPill,
                      {
                        backgroundColor: active ? `${c.teal}20` : c.elevated,
                        borderColor: active ? c.teal : c.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        z.countPillText,
                        { color: active ? c.teal : c.textMuted, fontFamily: GEO },
                        active && { fontWeight: '700' },
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Scoring format */}
            <SectionLabel title="SCORING FORMAT" />
            {SCORING_FORMATS.map((f) => {
              const active = f.key === format;
              const expanded = f.key === expandedFormat;
              const rules = FORMAT_RULES[f.key];
              return (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    haptics.light();
                    setFormat(f.key);
                    setExpandedFormat(expanded ? null : f.key);
                  }}
                  style={[
                    z.formatRow,
                    {
                      backgroundColor: active ? `${c.teal}10` : c.cardBg,
                      borderColor: active ? c.teal : c.border,
                    },
                  ]}
                >
                  <View style={z.formatHeader}>
                    <View style={z.formatLeft}>
                      <View
                        style={[
                          z.radio,
                          {
                            borderColor: active ? c.teal : c.textMuted,
                            backgroundColor: active ? c.teal : 'transparent',
                          },
                        ]}
                      >
                        {active && <View style={z.radioDot} />}
                      </View>
                      <Text style={[z.formatLabel, { color: active ? c.teal : c.text }]}>
                        {f.label}
                      </Text>
                    </View>
                    {rules && (
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={c.textMuted}
                      />
                    )}
                  </View>
                  <Text style={[z.formatDesc, { color: c.textMuted }]}>{f.description}</Text>
                  {expanded && rules && (
                    <Text style={[z.formatRules, { color: c.textMuted, borderColor: c.border }]}>
                      {rules}
                    </Text>
                  )}
                </Pressable>
              );
            })}

            {/* Side games */}
            <SectionLabel title="SIDE GAMES" />
            <View style={[z.gamblingCallout, { backgroundColor: `${c.gold}10`, borderColor: c.gold }]}>
              <Ionicons name="cash-outline" size={14} color={c.gold} />
              <Text style={[z.gamblingText, { color: c.gold }]}>
                Side games add friendly stakes and keep everyone engaged
              </Text>
            </View>
            {SIDE_GAMES.map((g) => {
              const active = sideGames.has(g.key);
              const expanded = g.key === expandedSide;
              const rules = SIDE_RULES[g.key];
              return (
                <Pressable
                  key={g.key}
                  onPress={() => { haptics.light(); toggleSideGame(g.key); }}
                  onLongPress={() => setExpandedSide(expanded ? null : g.key)}
                  style={[
                    z.sideRow,
                    {
                      backgroundColor: active ? `${c.gold}10` : c.cardBg,
                      borderColor: active ? c.gold : c.border,
                    },
                  ]}
                >
                  <View style={z.sideHeader}>
                    <View
                      style={[
                        z.checkbox,
                        {
                          borderColor: active ? c.gold : c.textMuted,
                          backgroundColor: active ? c.gold : 'transparent',
                        },
                      ]}
                    >
                      {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <Text style={[z.sideLabel, { color: active ? c.gold : c.text }]}>
                      {g.label}
                    </Text>
                    {rules && (
                      <Pressable
                        onPress={() => { haptics.light(); setExpandedSide(expanded ? null : g.key); }}
                        hitSlop={8}
                      >
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'information-circle-outline'}
                          size={14}
                          color={c.textMuted}
                        />
                      </Pressable>
                    )}
                  </View>
                  {expanded && rules && (
                    <Text style={[z.sideRules, { color: c.textMuted, borderColor: c.border }]}>
                      {rules}
                    </Text>
                  )}
                </Pressable>
              );
            })}

            {/* Stakes */}
            <SectionLabel title="STAKES (OPTIONAL)" />
            <TextInput
              style={[z.input, { color: c.text, backgroundColor: c.elevated, borderColor: c.border }]}
              placeholder="e.g. $5 per skin, $20 Nassau"
              placeholderTextColor={c.textMuted}
              value={stakes}
              onChangeText={setStakes}
            />

            {/* Players */}
            <SectionLabel title="PLAYERS" />
            {players.map((p, i) => {
              const isMe = i === 0;
              return (
                <View
                  key={p.id}
                  style={[z.playerRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
                >
                  <Avatar id={p.id} size={28} name={p.name} />
                  <View style={z.playerInfo}>
                    <Text style={[z.playerName, { color: isMe ? c.teal : c.text }]}>
                      {isMe ? 'You' : p.name}
                    </Text>
                    <Text style={[z.playerHcp, { color: c.textMuted }]}>{p.handicap} HCP</Text>
                  </View>
                  {!isMe && (
                    <Pressable
                      onPress={() => { haptics.light(); setPlayers((prev) => prev.filter((x) => x.id !== p.id)); }}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={18} color={c.textMuted} />
                    </Pressable>
                  )}
                </View>
              );
            })}

            {showAddPlayer ? (
              <View style={[z.addForm, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                <TextInput
                  style={[z.addInput, { color: c.text, borderColor: c.border }]}
                  placeholder="Player name"
                  placeholderTextColor={c.textMuted}
                  value={addName}
                  onChangeText={setAddName}
                  autoCapitalize="words"
                />
                <TextInput
                  style={[z.addInput, z.addHcpInput, { color: c.text, borderColor: c.border }]}
                  placeholder="HCP"
                  placeholderTextColor={c.textMuted}
                  value={addHcp}
                  onChangeText={setAddHcp}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <View style={z.addActions}>
                  <Pressable onPress={() => { haptics.light(); setShowAddPlayer(false); }}>
                    <Text style={[z.addCancel, { color: c.textMuted }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { haptics.light(); handleAddPlayer(); }}
                    style={[z.addDoneBtn, { backgroundColor: c.teal }]}
                  >
                    <Text style={z.addDoneText}>Add</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => { haptics.light(); setShowAddPlayer(true); }}
                style={[z.addPlayerBtn, { borderColor: c.border }]}
              >
                <Ionicons name="add-circle-outline" size={18} color={c.teal} />
                <Text style={[z.addPlayerText, { color: c.teal }]}>Add Player</Text>
              </Pressable>
            )}

            {/* Create button */}
            <Pressable
              onPress={async () => {
                haptics.success();
                if (user) {
                  try {
                    await tripsService.create({
                      name,
                      location,
                      start_date: startDate || new Date().toISOString().slice(0, 10),
                      end_date: endDate || new Date().toISOString().slice(0, 10),
                      organizer_id: user.id,
                      trip_type: tripType,
                      format,
                    });
                  } catch {}
                }
                showToast({ message: 'Trip created', type: 'gold', icon: 'airplane' });
                router.back();
              }}
              disabled={!canCreate}
              style={[
                z.createBtn,
                { backgroundColor: canCreate ? '#1E4D2B' : c.elevated },
                !canCreate && { opacity: 0.5 },
              ]}
            >
              <Text
                style={[
                  z.createBtnText,
                  { color: canCreate ? '#D4AF37' : c.textMuted, fontFamily: GEO },
                ]}
              >
                Create Trip
              </Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}


// ─── Main screen ──────────────────────────────────────────────────────
export default function CreateTripScreen() {
  const [tripType, setTripType] = useState<TripType | null>(null);

  if (tripType === null) {
    return <TypeSelection onSelect={setTripType} />;
  }

  if (tripType === 'ryder') {
    return <RyderCupWizard onBack={() => setTripType(null)} />;
  }

  return <TripForm tripType={tripType} />;
}

// ─── Styles ───────────────────────────────────────────────────────────
const z = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  /* Body */
  body: { paddingHorizontal: 20 },

  /* Type prompt */
  typePrompt: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
  },

  /* Type card */
  typeCard: {
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  typeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  typeDesc: {
    fontSize: 13,
    lineHeight: 18,
  },

  /* RC gradient */
  rcGradientBg: {
    ...StyleSheet.absoluteFillObject,
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

  /* Input */
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },

  /* Quick fill */
  quickFillScroll: {
    gap: 8,
    marginTop: 8,
    paddingRight: 16,
  },
  quickFillChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  quickFillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Dates */
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
  },
  dateTo: {
    fontSize: 12,
  },

  /* Player count pills */
  pillScroll: {
    gap: 8,
    paddingRight: 16,
  },
  countPill: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  countPillText: {
    fontSize: 16,
    fontWeight: '500',
  },

  /* Format rows */
  formatRow: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  formatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radio: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 0,
    backgroundColor: '#fff',
  },
  formatLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  formatDesc: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 28,
  },
  formatRules: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    marginLeft: 28,
    paddingTop: 8,
    borderTopWidth: 1,
  },

  /* Side game rows */
  gamblingCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  gamblingText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  sideRow: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  sideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  sideRules: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    marginLeft: 28,
    paddingTop: 8,
    borderTopWidth: 1,
  },

  /* Players */
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 13, fontWeight: '600' },
  playerHcp: { fontSize: 10, marginTop: 1 },

  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  addPlayerText: { fontSize: 13, fontWeight: '600' },

  /* Add form */
  addForm: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  addInput: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  addHcpInput: { width: 80 },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  addCancel: { fontSize: 13, paddingVertical: 8, paddingHorizontal: 16 },
  addDoneBtn: { paddingHorizontal: 20, paddingVertical: 8 },
  addDoneText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  /* Create button */
  createBtn: {
    marginTop: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#FFFFFF',
  },

});
