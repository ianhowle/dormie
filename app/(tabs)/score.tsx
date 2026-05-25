import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  Modal,
  FlatList,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO, SANS } from '../../src/theme/fonts';
import { cardShadowDark, cardShadowLight } from '../../src/theme/colors';
import GoldDivider from '../../src/components/GoldDivider';
import { Avatar } from '../../src/components/Avatar';
import { PLAYED_SORTED, SEED_COMMUNITY_COURSES as COMMUNITY_COURSES } from '../../src/data/courses';
import { coursesService, stripTeeSuffix, type ScorecardData, type TeeBox } from '../../src/services/courses.service';
import { usgaService, type USGATeeBox } from '../../src/services/usga.service';
import { friendsService } from '../../src/services/friends.service';
import { seasonsService } from '../../src/services/seasons.service';
import { tripsService } from '../../src/services/trips.service';
import { useAuth } from '../../src/lib/auth';
import type { FriendshipWithUser } from '../../src/lib/database.types';
import type { Season, Trip } from '../../src/lib/database.types';
import { haptics } from '../../src/lib/haptics';
import { logWarn, logError } from '../../src/lib/logger';
import { useToast } from '../../src/components/Toast';
import {
  SCORING_FORMATS,
  SIDE_GAMES,
  type ScoringFormat,
  type SideGame,
  type HoleRange,
  type ScoreMode,
  type TrackingLevel,
  type RoundType,
} from '../../src/data/scoring';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

/** Strip common tee name suffixes — delegates to shared stripTeeSuffix */
const stripCB = stripTeeSuffix;

const FORMAT_DESCRIPTIONS: Record<string, string> = {
  'Stableford': 'Points awarded per hole based on net score relative to par',
  'Stroke Play': 'Lowest total strokes wins — most common competitive format',
  'Match Play': 'Hole-by-hole competition — win the most holes to win the match',
  'Best Ball': 'Each player plays their own ball, best score on each hole counts',
  'Scramble': 'All players hit, team picks best shot and plays from there',
  'Shamble': 'All players drive, pick best drive, then play own ball in',
  'Chapman': 'Both players drive, swap and hit partner\'s ball, then alternate',
  'Skins': 'Each hole is worth a skin — tie carries over to next hole',
};

// ─── Pinstripe overlay ───────────────────────────────────────────────
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

// ─── Shimmer loading placeholder ─────────────────────────────────────
function TeeBoxShimmer() {
  const { theme } = useTheme();
  const c = theme.colors;
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      <Text style={{ fontSize: 11, fontStyle: 'italic', color: c.textMuted, fontFamily: SANS }}>
        Fetching course ratings...
      </Text>
      {[1, 2, 3].map((i) => (
        <Animated.View key={i} style={{ opacity, height: 48, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border }} />
      ))}
    </View>
  );
}

// ─── Types ────────────────────────────────────────────────────────────
type SelectedCourse = {
  id: string;
  name: string;
  par: number;
  city: string;
  state: string;
  source?: string;
  location?: string;
  /** Tee boxes from hole_data (Supabase) or USGA lookup */
  teeBoxes?: TeeBox[];
} | null;

type Player = {
  id: string;
  name: string;
  handicap: number;
};

// ─── All searchable courses ───────────────────────────────────────────
const ALL_COURSES = [
  ...PLAYED_SORTED.map((c) => ({ id: c.id, name: c.name, par: c.par, city: c.city, state: c.state, location: `${c.city}, ${c.state}` })),
  ...COMMUNITY_COURSES.map((c) => ({ id: c.id, name: c.name, par: 72, city: c.city, state: c.state, location: `${c.city}, ${c.state}` })),
];


// Friend type for player selection (mapped from FriendshipWithUser)
type FriendPlayer = {
  id: string;
  name: string;
  handicap: number;
  avatarColor?: string;
};

// ─── Side game descriptions ─────────────────────────────────────────
const SIDE_GAME_DESCRIPTIONS: Record<string, string> = {
  dots: 'Points for birdies (+1), one-putts (+1), three-putts (-1), greenies (+1)',
  snake: 'Three-putt passes the snake; holder at end pays everyone',
  greenies: 'Closest to pin on par 3s; must make par to collect',
  skins: 'Win the hole outright to win the skin; ties carry over',
  hammer: 'Double the bet by throwing the hammer; opponent can re-hammer',
  nassau: 'Three separate bets: front 9, back 9, and overall',
  wolf: 'Rotating wolf picks a partner or goes alone each hole',
  bingo_bango_bongo: 'Three points per hole: first on green, closest to pin, first to hole out',
  sandies: 'Up and down from a bunker for par or better',
  bark: 'Hit a tree and still make par or better',
  arnies: 'Make par without hitting the fairway',
  close_shave: 'Closest to the pin on designated holes',
};

// ─── Section header ───────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Text style={[st.sectionLabel, { color: c.gold }]}>
      {title}
    </Text>
  );
}

// ─── Course search ────────────────────────────────────────────────────
function CourseSearch({
  selected,
  onSelect,
  selectedTeeBox,
  scorecard,
  genderTees,
}: {
  selected: SelectedCourse;
  onSelect: (c: SelectedCourse) => void;
  selectedTeeBox: number;
  scorecard: ScorecardData | null;
  genderTees: TeeBox[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [remoteResults, setRemoteResults] = useState<{ id: string; name: string; par: number; city: string; state: string; source?: string; location?: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Instant local results from mock data — match partial names so both
  // "Hermitage Golf Course - Presidents Reserve" and "Generals Retreat" appear.
  // Also matches with common golf words stripped (e.g. "Indian Wells" matches
  // "Indian Wells Golf Resort - Celebrity Course").
  const localResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    const words = q.split(/\s+/).filter(Boolean);
    return ALL_COURSES.filter((cr) => {
      const haystack = `${cr.name} ${cr.city} ${cr.state}`.toLowerCase();
      if (words.every((w) => haystack.includes(w))) return true;
      // Also try with golf words stripped from course name
      const stripped = cr.name.toLowerCase()
        .replace(/^the\s+/i, '')
        .replace(/\s*(golf\s*(course|club)|country\s*club|links|resort|club)\s*/gi, ' ')
        .replace(/\s+/g, ' ').trim();
      const strippedHaystack = `${stripped} ${cr.city} ${cr.state}`.toLowerCase();
      return words.every((w) => strippedHaystack.includes(w));
    }).slice(0, 8);
  }, [query]);

  // Debounced unified search: Supabase + Google Places in parallel
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRemoteResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await coursesService.searchAll(q);
        setRemoteResults(results);
      } catch (e) {
        logWarn('Score: course search failed', e);
        setRemoteResults([]);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Merge instant local + remote, dedupe by normalized name.
  // Local/verified results take priority over remote/Google results.
  const results = useMemo(() => {
    const normalize = (n: string) =>
      n.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    // Also strip common golf words so "Classic Club" matches "The Classic Club"
    const stripGolf = (n: string) =>
      n.toLowerCase()
        .replace(/^the\s+/i, '')
        .replace(/\s*(golf\s*(course|club)|country\s*club|links|resort|club)\s*/gi, ' ')
        .replace(/[-–—]/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const seenFull = new Set<string>();
    const seenStripped = new Set<string>();
    const merged: typeof localResults = [];

    const isDup = (name: string) => {
      const full = normalize(name);
      const stripped = stripGolf(name);
      for (const existing of seenFull) {
        if (existing.includes(full) || full.includes(existing)) return true;
      }
      for (const existing of seenStripped) {
        if (existing.includes(stripped) || stripped.includes(existing)) return true;
      }
      return false;
    };
    const addSeen = (name: string) => {
      seenFull.add(normalize(name));
      seenStripped.add(stripGolf(name));
    };

    // Local results first (verified data, higher quality)
    for (const r of localResults) {
      if (!isDup(r.name)) {
        addSeen(r.name);
        merged.push(r);
      }
    }
    // Then remote results (Supabase + Google Places)
    for (const r of remoteResults) {
      if (!isDup(r.name)) {
        addSeen(r.name);
        merged.push(r);
      }
    }
    return merged.slice(0, 10);
  }, [localResults, remoteResults]);

  const isDark = theme.isDark;
  const hasApiTees = scorecard && scorecard.source !== 'none' && scorecard.teeBoxes.length > 0;
  const activeTee = hasApiTees && genderTees.length > 0 ? genderTees[selectedTeeBox] ?? genderTees[0] : null;

  if (selected) {
    const displayLocation = selected.location || `${selected.city}, ${selected.state}`;
    return (
      <Pressable
        onPress={() => { onSelect(null); setQuery(''); setOpen(true); }}
        style={({ pressed }) => [
          st.selectedCourse,
          { backgroundColor: c.cardBg, borderColor: c.teal, borderWidth: 1 },
          ...(isDark ? [cardShadowDark] : [cardShadowLight]),
          pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={st.selectedInfo}>
          <Text style={[st.selectedName, { color: c.text }]}>{selected.name}</Text>
          <Text style={[st.selectedMeta, { color: c.textMuted }]}>
            {displayLocation}
          </Text>
          {/* Show rating/slope/yards from selected tee */}
          {activeTee ? (
            <Text style={[st.selectedStats, { color: c.teal }]}>
              <Text style={{ fontFamily: GEO, fontWeight: '700' }}>
                {activeTee.rating.toFixed(1)} / {activeTee.slope}
              </Text>
              {activeTee.yards > 0 && (
                <Text style={{ fontFamily: GEO, fontWeight: '700' }}>
                  {' '}{'\u00B7'} {activeTee.yards.toLocaleString()} yds
                </Text>
              )}
              {' '}{'\u00B7'} Par {selected.par}
            </Text>
          ) : (
            <Text style={[st.selectedStats, { color: c.textMuted }]}>
              Par <Text style={{ fontFamily: GEO, fontWeight: '700' }}>{selected.par}</Text>
            </Text>
          )}
        </View>
        <Ionicons name="close-circle" size={18} color={c.textMuted} />
      </Pressable>
    );
  }

  return (
    <View>
      <View style={[st.searchWrap, { backgroundColor: isDark ? c.elevated : '#FFFFFF', borderColor: c.border, borderWidth: 1 }]}>
        <Ionicons name="search" size={16} color={c.textMuted} />
        <TextInput
          style={[st.searchInput, { color: c.text, fontFamily: SANS }]}
          placeholder="Search or type course name..."
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={(v) => { setQuery(v); setOpen(true); }}
          onFocus={() => setOpen(true)}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setRemoteResults([]); }} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={c.textMuted} />
          </Pressable>
        )}
      </View>

      {open && results.length > 0 && (
        <View style={[st.dropdown, { backgroundColor: isDark ? c.elevated : '#FFFFFF', borderColor: c.border }]}>
          {results.map((cr) => {
            const loc = cr.location || `${cr.city}, ${cr.state}`;
            return (
              <Pressable
                key={cr.id}
                onPress={() => {
                  onSelect({ ...cr, location: loc });
                  if ('source' in cr && (cr as any).source === 'google') {
                    coursesService.saveGooglePlacesCourse(cr as any);
                  }
                  setQuery('');
                  setRemoteResults([]);
                  setOpen(false);
                }}
                style={[st.dropdownItem, { borderColor: c.border }]}
              >
                <Text style={[st.dropdownName, { color: c.text }]}>{cr.name}</Text>
                <Text style={[st.dropdownMeta, { color: c.textMuted }]}>
                  {loc} {'\u00B7'} Par <Text style={{ fontFamily: GEO, fontWeight: '700' }}>{cr.par}</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {open && query.length > 0 && results.length === 0 && (
        <Pressable
          onPress={() => {
            onSelect({ id: `custom-${Date.now()}`, name: query, par: 72, city: '', state: '' });
            setOpen(false);
          }}
          style={[st.dropdown, st.customOption, { backgroundColor: isDark ? c.elevated : '#FFFFFF', borderColor: c.border }]}
        >
          <Ionicons name="add-circle-outline" size={16} color={c.teal} />
          <Text style={[st.customText, { color: c.teal }]}>
            Use "{query}" as custom course
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Par entry (for custom courses) ──────────────────────────────────
function ParEntry({
  par,
  onChange,
}: {
  par: number;
  onChange: (p: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={st.parRow}>
      <Text style={[st.parLabel, { color: c.textMuted, fontFamily: SANS }]}>Course Par</Text>
      <View style={st.parControls}>
        <Pressable
          onPress={() => onChange(Math.max(54, par - 1))}
          style={({ pressed }) => [
            st.parBtn,
            { backgroundColor: c.elevated, borderColor: c.border },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons name="remove" size={16} color={c.text} />
        </Pressable>
        <Text style={[st.parValue, { color: c.text, fontFamily: GEO, fontWeight: '700' }]}>{par}</Text>
        <Pressable
          onPress={() => onChange(Math.min(80, par + 1))}
          style={({ pressed }) => [
            st.parBtn,
            { backgroundColor: c.elevated, borderColor: c.border },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons name="add" size={16} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Course details form (when no API data) ─────────────────────────
function CourseDetailsForm({
  par,
  rating,
  slope,
  tee,
  onParChange,
  onRatingChange,
  onSlopeChange,
  onTeeChange,
}: {
  par: number;
  rating: string;
  slope: string;
  tee: string;
  onParChange: (p: number) => void;
  onRatingChange: (r: string) => void;
  onSlopeChange: (s: string) => void;
  onTeeChange: (t: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={st.courseDetailsWrap}>
      <View style={{ backgroundColor: 'rgba(201,162,39,0.10)', padding: 12, marginBottom: 12 }}>
        <Text style={[{ color: c.gold, fontSize: 13, fontWeight: '700', fontFamily: SANS, marginBottom: 4 }]}>
          Rating & slope not found for this course
        </Text>
        <Text style={[{ color: c.textMuted, fontSize: 12, lineHeight: 17, fontFamily: SANS }]}>
          Enter the course rating and slope from the scorecard or tee markers. These numbers affect your handicap calculation.
        </Text>
      </View>

      {/* Par */}
      <ParEntry par={par} onChange={onParChange} />

      {/* Rating + Slope row */}
      <View style={st.customFieldsRow}>
        <View style={st.customFieldHalf}>
          <Text style={[st.customFieldLabel, { color: c.textMuted }]}>Rating</Text>
          <TextInput
            style={[st.customField, { color: c.text, borderColor: c.border, backgroundColor: c.elevated, fontFamily: GEO }]}
            placeholder="72.0"
            placeholderTextColor={c.textMuted}
            value={rating}
            onChangeText={onRatingChange}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={st.customFieldHalf}>
          <Text style={[st.customFieldLabel, { color: c.textMuted }]}>Slope</Text>
          <TextInput
            style={[st.customField, { color: c.text, borderColor: c.border, backgroundColor: c.elevated, fontFamily: GEO }]}
            placeholder="113"
            placeholderTextColor={c.textMuted}
            value={slope}
            onChangeText={onSlopeChange}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Tee played */}
      <View style={{ marginTop: 8 }}>
        <Text style={[st.customFieldLabel, { color: c.textMuted }]}>Tee Played</Text>
        <TextInput
          style={[st.customField, { color: c.text, borderColor: c.border, backgroundColor: c.elevated, fontFamily: SANS }]}
          placeholder="e.g. Blue, White, Gold"
          placeholderTextColor={c.textMuted}
          value={tee}
          onChangeText={onTeeChange}
          autoCapitalize="words"
        />
      </View>
    </View>
  );
}

// ─── Players section ──────────────────────────────────────────────────
function PlayersSection({
  players,
  onAdd,
  onRemove,
}: {
  players: Player[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  return (
    <View>
      {players.map((p, i) => {
        const isMe = i === 0;
        return (
          <View
            key={p.id}
            style={[
              st.playerRow,
              { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 },
              ...(isDark ? [cardShadowDark] : [cardShadowLight]),
            ]}
          >
            <Avatar id={p.id} size={32} name={p.name} />
            <View style={st.playerInfo}>
              <Text style={[st.playerName, { color: isMe ? c.teal : c.text, fontFamily: SANS }]}>
                {isMe ? 'You' : p.name}
              </Text>
              <Text style={[st.playerHcp, { color: c.textMuted }]}>
                <Text style={{ fontFamily: GEO, fontWeight: '700' }}>{p.handicap}</Text> HCP
              </Text>
            </View>
            {!isMe && (
              <Pressable
                onPress={() => onRemove(p.id)}
                hitSlop={8}
                style={({ pressed }) => pressed ? { opacity: 0.7, transform: [{ scale: 0.98 }] } : undefined}
              >
                <Ionicons name="close-circle" size={18} color={c.textMuted} />
              </Pressable>
            )}
          </View>
        );
      })}
      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [
          st.addPlayerBtn,
          { borderColor: c.border },
          pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
        ]}
      >
        <Ionicons name="add-circle-outline" size={18} color={c.teal} />
        <Text style={[st.addPlayerText, { color: c.teal }]}>Add Player</Text>
      </Pressable>
    </View>
  );
}

// ─── Add player modal (inline) ────────────────────────────────────────
function AddPlayerInline({
  onDone,
  onCancel,
}: {
  onDone: (name: string, hcp: number) => void;
  onCancel: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [name, setName] = useState('');
  const [hcp, setHcp] = useState('');

  return (
    <View style={[st.addForm, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
      <TextInput
        style={[st.addInput, { color: c.text, borderColor: c.border, backgroundColor: c.elevated, fontFamily: SANS }]}
        placeholder="Player name"
        placeholderTextColor={c.textMuted}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextInput
        style={[st.addInput, st.addHcpInput, { color: c.text, borderColor: c.border, backgroundColor: c.elevated, fontFamily: GEO }]}
        placeholder="HCP"
        placeholderTextColor={c.textMuted}
        value={hcp}
        onChangeText={setHcp}
        keyboardType="numeric"
        maxLength={3}
      />
      <View style={st.addActions}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [st.addCancelBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={[st.addCancelText, { color: c.textMuted }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (name.trim().length > 0) {
              onDone(name.trim(), Number(hcp) || 0);
            }
          }}
          style={({ pressed }) => [
            st.addDoneBtn,
            { backgroundColor: theme.isDark ? c.greenDark : '#006747' },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={st.addDoneText}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Add player modal (full) ─────────────────────────────────────────
function AddPlayerModal({
  visible,
  existingPlayerIds,
  friends,
  loadingFriends,
  onAddFriend,
  onAddManual,
  onClose,
}: {
  visible: boolean;
  existingPlayerIds: Set<string>;
  friends: FriendPlayer[];
  loadingFriends: boolean;
  onAddFriend: (friend: { id: string; name: string; handicap: number }) => void;
  onAddManual: (name: string, hcp: number) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [search, setSearch] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualHcp, setManualHcp] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return friends.filter(
      (f) => !existingPlayerIds.has(f.id) && (q.length === 0 || f.name.toLowerCase().includes(q)),
    );
  }, [search, existingPlayerIds, friends]);

  const handleClose = () => {
    setSearch('');
    setShowManualForm(false);
    setManualName('');
    setManualHcp('');
    onClose();
  };

  const handleAddManual = () => {
    if (manualName.trim().length > 0) {
      onAddManual(manualName.trim(), Number(manualHcp) || 0);
      handleClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[st.modalOverlay]}>
        <View style={[st.modalContent, { backgroundColor: c.bg }]}>
          {/* Header */}
          <View style={[st.modalHeader, { borderColor: c.border }]}>
            <Text style={[st.modalTitle, { color: c.text, fontFamily: GEO }]}>Add Player</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={c.textMuted} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={[st.modalSearchWrap, { backgroundColor: theme.isDark ? c.elevated : '#FFFFFF', borderColor: c.border, borderWidth: 1 }]}>
            <Ionicons name="search" size={16} color={c.textMuted} />
            <TextInput
              style={[st.modalSearchInput, { color: c.text, fontFamily: SANS }]}
              placeholder="Search friends..."
              placeholderTextColor={c.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={c.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Friends list */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            style={st.modalList}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onAddFriend(item); handleClose(); }}
                style={({ pressed }) => [
                  st.modalFriendRow,
                  { borderColor: c.border },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Avatar id={item.id} size={32} name={item.name} />
                <View style={st.playerInfo}>
                  <Text style={[st.playerName, { color: c.text, fontFamily: SANS }]}>{item.name}</Text>
                  <Text style={[st.playerHcp, { color: c.textMuted }]}>
                    <Text style={{ fontFamily: GEO, fontWeight: '700' }}>{item.handicap}</Text> HCP
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={20} color={c.teal} />
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={[st.modalEmptyText, { color: c.textMuted }]}>
                {loadingFriends ? 'Loading friends...' : search.length > 0 ? 'No friends found' : friends.length === 0 ? 'No friends yet — add a manual player below' : 'No more friends to add'}
              </Text>
            }
          />

          {/* Manual add section */}
          {!showManualForm ? (
            <Pressable
              onPress={() => setShowManualForm(true)}
              style={[st.modalManualBtn, { borderColor: c.border }]}
            >
              <Ionicons name="person-add-outline" size={16} color={c.gold} />
              <Text style={[st.modalManualText, { color: c.gold }]}>Add Manual Player</Text>
            </Pressable>
          ) : (
            <View style={[st.addForm, { backgroundColor: c.cardBg, borderColor: c.border, borderWidth: 1 }]}>
              <TextInput
                style={[st.addInput, { color: c.text, borderColor: c.border, backgroundColor: c.elevated, fontFamily: SANS }]}
                placeholder="Player name"
                placeholderTextColor={c.textMuted}
                value={manualName}
                onChangeText={setManualName}
                autoCapitalize="words"
              />
              <TextInput
                style={[st.addInput, st.addHcpInput, { color: c.text, borderColor: c.border, backgroundColor: c.elevated, fontFamily: GEO }]}
                placeholder="HCP"
                placeholderTextColor={c.textMuted}
                value={manualHcp}
                onChangeText={setManualHcp}
                keyboardType="numeric"
                maxLength={3}
              />
              <View style={st.addActions}>
                <Pressable
                  onPress={() => setShowManualForm(false)}
                  style={({ pressed }) => [st.addCancelBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[st.addCancelText, { color: c.textMuted }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleAddManual}
                  style={({ pressed }) => [
                    st.addDoneBtn,
                    { backgroundColor: theme.isDark ? c.greenDark : '#006747' },
                    pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <Text style={st.addDoneText}>Add</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Format picker ────────────────────────────────────────────────────
function FormatPicker({
  selected,
  onSelect,
}: {
  selected: ScoringFormat;
  onSelect: (f: ScoringFormat) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const activeFormat = SCORING_FORMATS.find((f) => f.key === selected);

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.pillsScroll}
      >
        {SCORING_FORMATS.map((f) => {
          const active = f.key === selected;
          return (
            <Pressable
              key={f.key}
              onPress={() => { haptics.light(); onSelect(f.key); }}
              style={({ pressed }) => [
                st.pill,
                {
                  backgroundColor: active ? 'rgba(0,103,71,0.08)' : (isDark ? c.elevated : '#FFFFFF'),
                  borderColor: active ? c.teal : c.border,
                },
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text
                style={[
                  st.pillText,
                  { color: active ? c.teal : c.textMuted, fontFamily: SANS },
                  active && { fontWeight: '700' },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {activeFormat && (
        <Text style={[st.formatDesc, { color: c.textMuted }]}>
          {activeFormat.description}
        </Text>
      )}
    </View>
  );
}

// ─── Side game multi-select ───────────────────────────────────────────
function SideGamePicker({
  selected,
  onToggle,
  lastToggled,
}: {
  selected: Set<SideGame>;
  onToggle: (g: SideGame) => void;
  lastToggled: SideGame | null;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const desc = lastToggled && selected.has(lastToggled) ? SIDE_GAME_DESCRIPTIONS[lastToggled] : null;

  return (
    <View>
      <View style={st.sideWrap}>
        {SIDE_GAMES.map((g) => {
          const active = selected.has(g.key);
          return (
            <Pressable
              key={g.key}
              onPress={() => { haptics.light(); onToggle(g.key); }}
              style={({ pressed }) => [
                st.sidePill,
                {
                  backgroundColor: active ? 'rgba(0,103,71,0.08)' : (isDark ? c.elevated : '#FFFFFF'),
                  borderColor: active ? c.teal : c.border,
                },
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text
                style={[
                  st.sidePillText,
                  { color: active ? c.teal : c.textMuted, fontFamily: SANS },
                  active && { fontWeight: '700' },
                ]}
              >
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {desc && (
        <Text style={[st.formatDesc, { color: c.textMuted }]}>
          {desc}
        </Text>
      )}
    </View>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────
function ToggleRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { key: T; label: string }[];
  selected: T;
  onSelect: (k: T) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;

  return (
    <View style={[st.toggleRow, { borderColor: c.border, borderWidth: 1, backgroundColor: isDark ? undefined : '#FFFFFF' }]}>
      {options.map((opt) => {
        const active = opt.key === selected;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            style={({ pressed }) => [
              st.toggleBtn,
              active && { backgroundColor: isDark ? 'rgba(0,103,71,0.08)' : '#006747', },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                st.toggleLabel,
                { color: active ? (isDark ? c.teal : '#FFFFFF') : c.textMuted, fontFamily: SANS },
                active && { fontWeight: '700' },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────
export default function ScoreScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // State
  const [course, setCourse] = useState<SelectedCourse>(null);
  const [customPar, setCustomPar] = useState(72);
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'Ian McGowan', handicap: 8 },
  ]);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [format, setFormat] = useState<ScoringFormat>('stroke_play');
  const [sideGames, setSideGames] = useState<Set<SideGame>>(new Set());
  const [lastToggledSideGame, setLastToggledSideGame] = useState<SideGame | null>(null);
  const [holeData, setHoleData] = useState<any[] | null>(null);
  const [holeRange, setHoleRange] = useState<HoleRange>('full18');
  const [scoreMode, setScoreMode] = useState<ScoreMode>('gross');
  const [trackingLevel, setTrackingLevel] = useState<TrackingLevel>('standard');
  const [scorekeeperMode, setScorekeeperMode] = useState<'scorekeeper' | 'everyone'>('everyone');
  const [selectedTeeBox, setSelectedTeeBox] = useState(0);
  const [teeGender, setTeeGender] = useState<'male' | 'female'>('male');
  const [customLocation, setCustomLocation] = useState('');
  const [customRating, setCustomRating] = useState('72.0');
  const [customSlope, setCustomSlope] = useState('113');
  const [customTee, setCustomTee] = useState('White');
  const [roundType, setRoundType] = useState<RoundType>('casual');
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [loadingScorecard, setLoadingScorecard] = useState(false);

  // Round context linking
  const [linkedSeasons, setLinkedSeasons] = useState<string[]>([]);
  const [linkedTrip, setLinkedTrip] = useState<string | null>(null);
  const [linkedMatchup, setLinkedMatchup] = useState<string | null>(null);
  const [expandedFormat, setExpandedFormat] = useState<string | null>(null);

  // Real data: friends, seasons, trips
  const [friends, setFriends] = useState<FriendPlayer[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [activeSeasons, setActiveSeasons] = useState<Season[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);

  // Fetch friends, seasons, trips on mount
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    setLoadingFriends(true);
    friendsService.getActiveFriends(userId)
      .then((friendships) => {
        const mapped: FriendPlayer[] = friendships.map((fs) => ({
          id: fs.friend.id,
          name: fs.friend.name,
          handicap: fs.friend.handicap_index ?? 0,
          avatarColor: fs.friend.avatar_color ?? undefined,
        }));
        setFriends(mapped);
      })
      .catch(() => setFriends([]))
      .finally(() => setLoadingFriends(false));

    seasonsService.getByUser(userId)
      .then((seasons) => {
        setActiveSeasons(seasons.filter((s) => s.status === 'active' || s.status === 'playoffs'));
      })
      .catch(() => setActiveSeasons([]));

    tripsService.getByUser(userId)
      .then((trips) => {
        setActiveTrips(trips.filter((t) => t.status === 'upcoming' || t.status === 'active'));
      })
      .catch(() => setActiveTrips([]));
  }, [user?.id]);

  const toggleSeason = (id: string) => {
    haptics.selection();
    setLinkedSeasons((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  // Detect format conflicts across selected seasons
  const selectedSeasonData = activeSeasons.filter((s) => linkedSeasons.includes(s.id));
  const getSeasonFormat = (s: Season) => {
    const cfg = s.config as any;
    return cfg?.format ?? cfg?.scoring_format ?? 'Stroke Play';
  };
  const seasonFormats = [...new Set(selectedSeasonData.map(getSeasonFormat))];
  const hasFormatConflict = seasonFormats.length > 1;
  const hasVirtualSeason = selectedSeasonData.some((s) => (s.config as any)?.virtual === true);

  const isCustom = course?.id.startsWith('custom-');
  const hasApiTees = scorecard && scorecard.source !== 'none' && scorecard.teeBoxes.length > 0;
  // Filter tees by selected gender (default: male)
  const genderTees = useMemo(() => {
    if (!scorecard) return [];
    const filtered = scorecard.teeBoxes.filter((t) => t.gender === teeGender);
    return filtered.length > 0 ? filtered : scorecard.teeBoxes;
  }, [scorecard, teeGender]);
  const effectivePar = isCustom ? customPar : (hasApiTees ? (scorecard?.par ?? course?.par ?? 72) : customPar);
  const hasManualPlayers = players.some((p) => p.id.startsWith('p-'));

  const handleToggleSideGame = (g: SideGame) => {
    setLastToggledSideGame(g);
    setSideGames((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const handleAddPlayer = (name: string, hcp: number) => {
    haptics.selection();
    setPlayers((prev) => [
      ...prev,
      { id: `p-${Date.now()}`, name, handicap: hcp },
    ]);
    setShowAddPlayerModal(false);
  };

  const handleAddFriend = (friend: { id: string; name: string; handicap: number }) => {
    haptics.selection();
    setPlayers((prev) => [...prev, friend]);
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  // Fetch scorecard + tee data when a non-custom course is selected
  // Flow: cache → GolfCourseAPI (rating/slope/tees) → Supabase community → USGA NCRDB → manual entry
  useEffect(() => {
    if (!course || isCustom) {
      setScorecard(null);
      setHoleData(null);
      setTeeGender('male');
      return;
    }

    let cancelled = false;
    setLoadingScorecard(true);

    (async () => {
      // 1. Try existing scorecard flow (checks cache → GolfCourseAPI → Supabase)
      const sc = await coursesService.fetchScorecard(course.name, course.location);
      if (cancelled) return;

      // 2. If no tee boxes from scorecard, try USGA lookup
      if (sc.teeBoxes.length === 0 && course.id && !course.id.startsWith('custom-')) {
        try {
          // Parse state from location — works for both "Nashville, TN" and
          // Google Places addresses like "123 Main St, Nashville, TN 37201, USA"
          const loc = course.location || `${course.city}, ${course.state}`;
          let state = usgaService.parseState(loc);
          // Fallback: try extracting 2-letter state from longer addresses
          if (!state && loc) {
            const stateMatch = loc.match(/,\s*([A-Z]{2})\s/);
            if (stateMatch) state = stateMatch[1];
          }
          const usgaTees = await usgaService.getTeeBoxes(course.id, course.name, state);
          if (!cancelled && usgaTees.length > 0) {
            sc.teeBoxes = usgaService.toScorecardTeeBoxes(usgaTees);
            sc.source = 'community';
            sc.rating = usgaTees[0].rating;
            sc.slope = usgaTees[0].slope;
          }
        } catch (err) {
          console.log('[Score] USGA lookup failed:', err);
        }
      }

      if (cancelled) return;
      setScorecard(sc);
      setLoadingScorecard(false);

      // Pre-fill defaults from scorecard
      if (sc.source !== 'none') {
        setCustomPar(sc.par);
        setCustomRating(String(sc.rating));
        setCustomSlope(String(sc.slope));
        if (sc.teeBoxes.length > 0) {
          // Default to male tees and find "white" within that set
          const maleTees = sc.teeBoxes.filter((t) => t.gender === 'male');
          const defaultSet = maleTees.length > 0 ? maleTees : sc.teeBoxes;
          const whiteIdx = defaultSet.findIndex((t) => t.name.toLowerCase().includes('white'));
          setSelectedTeeBox(whiteIdx >= 0 ? whiteIdx : 0);
          setTeeGender('male');
        }
      } else {
        // No data found — clear pre-fills so user sees empty fields
        setCustomRating('');
        setCustomSlope('');
      }

      // Use API hole data if available, otherwise generate
      if (sc.holes.length === 18) {
        setHoleData(sc.holes);
      } else {
        coursesService.generateHoleData?.(course.name, sc.par)
          ?.then((h) => { if (!cancelled) setHoleData(h); })
          ?.catch((e) => logWarn('Score: hole data auto-fill failed', e));
      }
    })();

    return () => { cancelled = true; };
  }, [course, isCustom]);

  // Build enriched hole data with per-hole yardage from selected tee
  const enrichedHoleData = useMemo(() => {
    const activeTee = hasApiTees
      ? genderTees[selectedTeeBox] ?? genderTees[0]
      : null;
    const totalYards = activeTee?.yards ?? 0;

    // If we have per-hole data with yardage already, use it
    if (holeData && holeData.length > 0 && holeData[0]?.yards) {
      return holeData;
    }

    // If we have total yardage from tee box but no per-hole data,
    // distribute yardage proportionally based on par
    if (totalYards > 0) {
      const baseHoles = holeData && holeData.length > 0
        ? holeData
        : Array.from({ length: 18 }, (_, i) => ({
            number: i + 1,
            par: [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4][i],
            strokeIndex: [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 2, 16, 6, 4, 12, 18, 10, 14][i],
          }));

      // Par-based yardage distribution: par 3 ~165y, par 4 ~400y, par 5 ~530y
      const weights = baseHoles.map((h: any) => {
        if (h.par === 3) return 165;
        if (h.par === 5) return 530;
        return 400; // par 4
      });
      const totalWeight = weights.reduce((a: number, b: number) => a + b, 0);

      return baseHoles.map((h: any, i: number) => ({
        ...h,
        yards: Math.round((weights[i] / totalWeight) * totalYards),
      }));
    }

    return holeData;
  }, [holeData, hasApiTees, genderTees, selectedTeeBox]);

  // Build round context label for scoring header badge
  const roundContextLabel = useMemo(() => {
    const parts: string[] = [];
    if (linkedSeasons.length === 1) parts.push('SEASON');
    else if (linkedSeasons.length > 1) parts.push(`${linkedSeasons.length} SEASONS`);
    if (linkedTrip) parts.push('TRIP');
    if (linkedMatchup) parts.push('MATCHUP');
    if (parts.length === 0) return roundType;
    return parts.join(' \u00B7 ');
  }, [linkedSeasons, linkedTrip, linkedMatchup, roundType]);

  const isDark = theme.isDark;
  const canStart = course !== null && players.length > 0;

  const handleStartRound = () => {
    if (!course) return;
    haptics.medium();
    showToast({ message: 'Round started', type: 'success', icon: 'flag' });
    const activeFormat = SCORING_FORMATS.find((f) => f.key === format);

    // Determine slope/rating from API tee boxes or manual entry
    let slope: number;
    let rating: number;
    if (hasApiTees && genderTees.length > 0) {
      const tee = genderTees[selectedTeeBox] ?? genderTees[0];
      slope = tee.slope;
      rating = tee.rating;
    } else {
      slope = Number(customSlope) || 113;
      rating = Number(customRating) || 72.0;
    }

    // Save course data to Supabase for community database
    if (course.source === 'google' || !isCustom) {
      const dataSource = scorecard?.source === 'api' ? 'api' : 'user_entered';
      coursesService.saveCourseWithData(
        course as any,
        { par: effectivePar, rating, slope, tee: customTee },
        dataSource as any,
      ).catch((e) => logError('Score: saveCourseWithData write failed', e));
    }

    // Determine selected tee name for display
    const selectedTeeName = hasApiTees && genderTees.length > 0
      ? stripCB(genderTees[selectedTeeBox]?.name ?? customTee)
      : customTee;

    router.push({
      pathname: '/scoring',
      params: {
        courseName: course.name,
        courseId: course.id,
        coursePar: String(effectivePar),
        courseSlope: String(slope),
        courseRating: String(rating),
        courseTee: selectedTeeName,
        players: JSON.stringify(players),
        format: activeFormat?.label ?? 'Total Strokes',
        holeRange,
        scoreMode,
        sideGames: JSON.stringify([...sideGames]),
        trackingLevel,
        scorekeeperMode,
        roundType: roundContextLabel,
        ...(linkedSeasons.length > 0 ? {
          linkedSeasons: JSON.stringify(
            selectedSeasonData.map((s) => ({
              seasonId: s.id,
              seasonName: s.name,
              weekNumber: s.currentWeek,
              format: s.format ?? 'Stroke Play',
              multiplier: s.multiplier ?? 1,
            })),
          ),
        } : {}),
        ...(linkedTrip ? { tripId: linkedTrip } : {}),
        ...(linkedMatchup ? { matchupOpponent: linkedMatchup } : {}),
        ...(enrichedHoleData ? { holeData: JSON.stringify(enrichedHoleData) } : {}),
      },
    });
  };

  const { showToast } = useToast();

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      {/* Top safe-area backdrop — fills the iOS status-bar/notch area so
          horizontal pill rows (FORMAT / ROUND TYPE) and other content
          scrolling beneath the system status bar don't visually bleed
          behind the clock. Color matches the gradient header's top stop
          so there's no seam at scroll offset 0. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: '#1E4D2B',
          zIndex: 100,
        }}
      />
      <ExpoStatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={st.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <LinearGradient
            colors={['#1E4D2B', '#2D6A3F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.header}
          >
            {isDark && <Pinstripes />}
            <Text style={[st.headerDormie, { fontFamily: GEO }]}>DORMIE</Text>
            <Text style={[st.headerTitle, { fontFamily: GEO }]}>
              New Round
            </Text>
          </LinearGradient>
          <GoldDivider />

          <View style={st.body}>
            {/* Course */}
            <SectionLabel title="COURSE" />
            {hasVirtualSeason && (
              <View style={{ backgroundColor: '#0F3E4A', borderLeftWidth: 3, borderLeftColor: '#38BDF8', padding: 12, marginBottom: 12 }}>
                <Text style={{ color: '#7DD3FC', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 }}>
                  VIRTUAL / ASYNC SEASON
                </Text>
                <Text style={{ color: '#E8E4DE', fontSize: 13, lineHeight: 18 }}>
                  Pick any course below — slope and rating will be pulled automatically for fair handicap scoring.
                </Text>
              </View>
            )}
            <CourseSearch selected={course} onSelect={setCourse} selectedTeeBox={selectedTeeBox} scorecard={scorecard} genderTees={genderTees} />

            {/* Loading shimmer while fetching tee data */}
            {loadingScorecard && course && !isCustom && (
              <TeeBoxShimmer />
            )}

            {/* Tee box dropdown selector */}
            {course && !isCustom && hasApiTees && scorecard && (
              <View style={st.teeBoxSection}>
                {/* Gender toggle */}
                {scorecard.teeBoxes.some((t) => t.gender === 'female') && (
                  <View style={st.teeGenderToggle}>
                    {(['male', 'female'] as const).map((g) => {
                      const isActive = teeGender === g;
                      return (
                        <Pressable
                          key={g}
                          onPress={() => {
                            haptics.selection();
                            setTeeGender(g);
                            setSelectedTeeBox(0);
                          }}
                          style={[
                            st.teeGenderBtn,
                            { borderColor: isActive ? c.teal : c.border, backgroundColor: isActive ? 'rgba(0,103,71,0.08)' : (isDark ? 'transparent' : '#FFFFFF') },
                          ]}
                        >
                          <Text style={[st.teeGenderBtnText, { color: isActive ? c.teal : c.textMuted, fontFamily: SANS }]}>
                            {g === 'male' ? "Men\u2019s Tees" : "Women\u2019s Tees"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <Text style={[st.teeBoxLabel, { color: c.textMuted }]}>SELECT TEE</Text>
                {genderTees.map((tee, i) => {
                  const active = i === selectedTeeBox;
                  const displayName = stripCB(tee.name);
                  return (
                    <Pressable
                      key={`${tee.name}-${tee.gender || 'male'}-${i}`}
                      onPress={() => {
                        haptics.selection();
                        setSelectedTeeBox(i);
                        setCustomRating(String(tee.rating));
                        setCustomSlope(String(tee.slope));
                        setCustomTee(displayName);
                      }}
                      style={({ pressed }) => [
                        st.teeDropdownRow,
                        {
                          backgroundColor: active ? 'rgba(0,103,71,0.08)' : (isDark ? c.elevated : '#FFFFFF'),
                          borderColor: active ? c.teal : c.border,
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View style={[st.teeBoxDot, { backgroundColor: tee.color, borderColor: tee.color === '#FFFFFF' ? c.textMuted : tee.color }]} />
                      <View style={st.teeDropdownInfo}>
                        <Text style={[st.teeDropdownName, { color: active ? c.teal : c.text, fontFamily: SANS }]}>
                          {displayName}
                        </Text>
                        <Text style={[st.teeDropdownStats, { color: c.textMuted, fontFamily: GEO, fontWeight: '700' }]}>
                          {tee.yards > 0 ? `${tee.yards.toLocaleString()} yds` : '---'} {'\u2014'} {tee.rating}/{tee.slope}
                        </Text>
                      </View>
                      {active && (
                        <Ionicons name="checkmark-circle" size={18} color={c.teal} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Manual course details form (when no tee data found) */}
            {course && !hasApiTees && !loadingScorecard && (
              <CourseDetailsForm
                par={customPar}
                rating={customRating}
                slope={customSlope}
                tee={customTee}
                onParChange={setCustomPar}
                onRatingChange={setCustomRating}
                onSlopeChange={setCustomSlope}
                onTeeChange={setCustomTee}
              />
            )}

            {/* Location field for custom courses */}
            {isCustom && (
              <View style={st.customFieldsWrap}>
                <TextInput
                  style={[st.customField, { color: c.text, borderColor: c.border, backgroundColor: c.elevated, fontFamily: SANS }]}
                  placeholder="Location / City"
                  placeholderTextColor={c.textMuted}
                  value={customLocation}
                  onChangeText={setCustomLocation}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* Divider */}
            <GoldDivider style={{ marginTop: 24 }} />

            {/* Players */}
            <SectionLabel title="PLAYERS" />
            <PlayersSection
              players={players}
              onAdd={() => setShowAddPlayerModal(true)}
              onRemove={handleRemovePlayer}
            />
            <AddPlayerModal
              visible={showAddPlayerModal}
              existingPlayerIds={new Set(players.map((p) => p.id))}
              friends={friends}
              loadingFriends={loadingFriends}
              onAddFriend={handleAddFriend}
              onAddManual={handleAddPlayer}
              onClose={() => setShowAddPlayerModal(false)}
            />

            {/* Divider */}
            <GoldDivider style={{ marginTop: 24 }} />

            {/* Scoring format */}
            <SectionLabel title="FORMAT" />
            <FormatPicker selected={format} onSelect={setFormat} />

            {/* Divider */}
            <GoldDivider style={{ marginTop: 24 }} />

            {/* Round type */}
            <SectionLabel title="ROUND TYPE" />
            <View style={st.roundTypeRow}>
              {([
                { key: 'casual' as RoundType, label: 'Casual', desc: 'Just for fun', icon: 'beer-outline' as const },
                { key: 'competitive' as RoundType, label: 'Competitive', desc: 'Counts toward handicap', icon: 'trophy-outline' as const },
                { key: 'matchup' as RoundType, label: 'Matchup', desc: 'Head-to-head battle', icon: 'people-outline' as const },
              ]).map((rt) => {
                const active = roundType === rt.key;
                return (
                  <Pressable
                    key={rt.key}
                    onPress={() => setRoundType(rt.key)}
                    style={({ pressed }) => [
                      st.roundTypeCard,
                      {
                        backgroundColor: active ? 'rgba(0,103,71,0.05)' : (isDark ? c.elevated : '#FFFFFF'),
                        borderColor: active ? c.teal : c.border,
                        borderWidth: 1,
                      },
                      active && { borderLeftWidth: 2, borderLeftColor: c.teal },
                      ...(isDark ? [cardShadowDark] : [cardShadowLight]),
                      pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Ionicons name={rt.icon} size={18} color={active ? c.teal : c.textMuted} />
                    <Text style={[st.roundTypeLabel, { color: active ? c.teal : c.text, fontFamily: SANS }]}>
                      {rt.label}
                    </Text>
                    <Text style={[st.roundTypeDesc, { color: c.textMuted, fontFamily: SANS }]}>{rt.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Divider */}
            <GoldDivider style={{ marginTop: 24 }} />

            {/* Round context: link to season, trip, matchup */}
            <SectionLabel title="LINK TO" />
            <View style={st.contextSection}>
              {/* Season link — multi-select */}
              <View style={[st.contextCard, { backgroundColor: linkedSeasons.length > 0 ? 'rgba(201,162,39,0.05)' : (isDark ? c.elevated : '#FFFFFF'), borderColor: linkedSeasons.length > 0 ? c.gold : c.border, borderWidth: 1 }]}>
                <View style={st.contextCardHeader}>
                  <Ionicons name="trophy" size={16} color={linkedSeasons.length > 0 ? c.gold : c.textMuted} />
                  <Text style={[st.contextCardTitle, { color: linkedSeasons.length > 0 ? c.gold : c.text, fontFamily: SANS }]}>
                    Season Match{linkedSeasons.length > 1 ? `es (${linkedSeasons.length})` : ''}
                  </Text>
                </View>
                {activeSeasons.length > 0 ? (
                  <View style={st.seasonList}>
                    {activeSeasons.map((s) => {
                      const selected = linkedSeasons.includes(s.id);
                      const fmt = getSeasonFormat(s);
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => toggleSeason(s.id)}
                          style={({ pressed }) => [
                            st.seasonRow,
                            {
                              backgroundColor: selected ? 'rgba(201,162,39,0.08)' : 'transparent',
                              borderColor: selected ? c.gold : c.border,
                              borderWidth: 1,
                            },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <View style={st.seasonRowInfo}>
                            <Text style={[st.seasonRowName, { color: selected ? c.gold : c.text, fontFamily: SANS }]}>
                              {s.name}
                            </Text>
                            <Text style={[st.seasonRowMeta, { color: c.textMuted, fontFamily: SANS }]}>
                              {s.type === 'fedex' ? 'FedEx Cup' : s.type === 'ryder' ? 'Ryder Cup' : 'Custom'} {'\u00B7'} {fmt}
                            </Text>
                          </View>
                          <Ionicons
                            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={selected ? c.gold : c.textMuted}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[st.contextMuted, { color: c.textMuted, fontFamily: SANS }]}>
                    No active seasons
                  </Text>
                )}
              </View>

              {/* Format conflict banner */}
              {hasFormatConflict && (
                <View style={[st.formatConflictBanner, { backgroundColor: `${c.gold}12`, borderColor: c.gold, borderWidth: 1 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name="information-circle" size={14} color={c.gold} />
                    <Text style={[st.formatConflictTitle, { color: c.gold, fontFamily: SANS }]}>
                      Scored differently across seasons:
                    </Text>
                  </View>
                  {selectedSeasonData.map((s) => {
                    const fmt = getSeasonFormat(s);
                    const isExpanded = expandedFormat === s.id;
                    return (
                      <Pressable key={s.id} onPress={() => setExpandedFormat(isExpanded ? null : s.id)}>
                        <Text style={[st.formatConflictItem, { color: c.text, fontFamily: SANS }]}>
                          {'\u2022'} {s.name} — <Text style={{ fontFamily: GEO, fontWeight: '700', color: c.gold }}>{fmt}</Text>
                        </Text>
                        {isExpanded && (
                          <Text style={[st.formatConflictDesc, { color: c.textMuted, fontFamily: SANS }]}>
                            {FORMAT_DESCRIPTIONS[fmt] ?? 'Standard scoring format'}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Trip link */}
              <Pressable
                onPress={() => {
                  haptics.selection();
                  if (linkedTrip) {
                    setLinkedTrip(null);
                  } else if (activeTrips.length > 0) {
                    setLinkedTrip(activeTrips[0].id);
                  }
                }}
                style={({ pressed }) => [
                  st.contextCard,
                  {
                    backgroundColor: linkedTrip ? 'rgba(0,103,71,0.08)' : (isDark ? c.elevated : '#FFFFFF'),
                    borderColor: linkedTrip ? c.teal : c.border,
                    borderWidth: 1,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={st.contextCardHeader}>
                  <Ionicons name="airplane" size={16} color={linkedTrip ? c.teal : c.textMuted} />
                  <Text style={[st.contextCardTitle, { color: linkedTrip ? c.teal : c.text, fontFamily: SANS }]}>
                    Trip Round
                  </Text>
                  {linkedTrip && <Ionicons name="checkmark-circle" size={16} color={c.teal} />}
                </View>
                {activeTrips.length > 0 ? (
                  linkedTrip ? (
                    <View style={st.contextDetail}>
                      {activeTrips.filter((t) => t.id === linkedTrip).map((t) => (
                        <Text key={t.id} style={[st.contextDetailText, { color: c.textMuted, fontFamily: SANS }]}>
                          {t.name} {'\u00B7'} {t.location}
                        </Text>
                      ))}
                      {activeTrips.length > 1 && (
                        <View style={st.contextPickerRow}>
                          {activeTrips.map((t) => (
                            <Pressable
                              key={t.id}
                              onPress={() => { haptics.selection(); setLinkedTrip(t.id); }}
                              style={[st.contextPill, { borderColor: t.id === linkedTrip ? c.teal : c.border, backgroundColor: t.id === linkedTrip ? 'rgba(0,103,71,0.12)' : 'transparent' }]}
                            >
                              <Text style={[st.contextPillText, { color: t.id === linkedTrip ? c.teal : c.textMuted, fontFamily: SANS }]} numberOfLines={1}>{t.name}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={[st.contextMuted, { color: c.textMuted, fontFamily: SANS }]}>
                      Tap to link this round to a trip
                    </Text>
                  )
                ) : (
                  <Text style={[st.contextMuted, { color: c.textMuted, fontFamily: SANS }]}>
                    No upcoming trips
                  </Text>
                )}
              </Pressable>

              {/* Matchup link */}
              <Pressable
                onPress={() => {
                  haptics.selection();
                  if (linkedMatchup) {
                    setLinkedMatchup(null);
                  } else if (friends.length > 0) {
                    setLinkedMatchup(friends[0].id);
                  }
                }}
                style={({ pressed }) => [
                  st.contextCard,
                  {
                    backgroundColor: linkedMatchup ? 'rgba(0,103,71,0.08)' : (isDark ? c.elevated : '#FFFFFF'),
                    borderColor: linkedMatchup ? c.teal : c.border,
                    borderWidth: 1,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={st.contextCardHeader}>
                  <Ionicons name="people" size={16} color={linkedMatchup ? c.teal : c.textMuted} />
                  <Text style={[st.contextCardTitle, { color: linkedMatchup ? c.teal : c.text, fontFamily: SANS }]}>
                    Matchup
                  </Text>
                  {linkedMatchup && <Ionicons name="checkmark-circle" size={16} color={c.teal} />}
                </View>
                {linkedMatchup ? (
                  <View style={st.contextDetail}>
                    <Text style={[st.contextDetailText, { color: c.textMuted, fontFamily: SANS }]}>
                      vs {friends.find((f) => f.id === linkedMatchup)?.name ?? 'Opponent'}
                    </Text>
                    <View style={st.contextPickerRow}>
                      {friends.slice(0, 4).map((f) => (
                        <Pressable
                          key={f.id}
                          onPress={() => { haptics.selection(); setLinkedMatchup(f.id); }}
                          style={[st.contextPill, { borderColor: f.id === linkedMatchup ? c.teal : c.border, backgroundColor: f.id === linkedMatchup ? 'rgba(0,103,71,0.12)' : 'transparent' }]}
                        >
                          <Text style={[st.contextPillText, { color: f.id === linkedMatchup ? c.teal : c.textMuted, fontFamily: SANS }]} numberOfLines={1}>{f.name.split(' ')[0]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Text style={[st.contextMuted, { color: c.textMuted, fontFamily: SANS }]}>
                    {friends.length > 0 ? 'Tap to set up a 1v1 matchup' : 'Add friends to set up matchups'}
                  </Text>
                )}
              </Pressable>
            </View>

            {/* Divider */}
            <GoldDivider style={{ marginTop: 24 }} />

            {/* Side games */}
            <SectionLabel title="SIDE GAMES" />
            <SideGamePicker selected={sideGames} onToggle={handleToggleSideGame} lastToggled={lastToggledSideGame} />

            {/* Divider */}
            <GoldDivider style={{ marginTop: 24 }} />

            {/* Hole range */}
            <SectionLabel title="HOLES" />
            <ToggleRow
              options={[
                { key: 'front9' as HoleRange, label: 'Front 9' },
                { key: 'back9' as HoleRange, label: 'Back 9' },
                { key: 'full18' as HoleRange, label: 'Full 18' },
              ]}
              selected={holeRange}
              onSelect={setHoleRange}
            />

            {/* Gross / Net */}
            <SectionLabel title="SCORING" />
            <ToggleRow
              options={[
                { key: 'gross' as ScoreMode, label: 'Gross' },
                { key: 'net' as ScoreMode, label: 'Net' },
              ]}
              selected={scoreMode}
              onSelect={setScoreMode}
            />

            {/* Tracking level */}
            <SectionLabel title="TRACKING" />
            <View style={st.trackingRow}>
              {([
                { key: 'basic' as TrackingLevel, label: 'BASIC', desc: 'Score only', icon: 'reader-outline' as const },
                { key: 'standard' as TrackingLevel, label: 'STANDARD', desc: 'Score + Putts', icon: 'golf-outline' as const },
                { key: 'detailed' as TrackingLevel, label: 'DETAILED', desc: 'Score + Putts + FIR + GIR + Penalties + Putt Distance', icon: 'analytics-outline' as const },
              ]).map((tl) => {
                const active = trackingLevel === tl.key;
                return (
                  <Pressable
                    key={tl.key}
                    onPress={() => setTrackingLevel(tl.key)}
                    style={({ pressed }) => [
                      st.trackingCard,
                      {
                        backgroundColor: active ? 'rgba(0,103,71,0.05)' : (isDark ? c.elevated : '#FFFFFF'),
                        borderColor: active ? c.teal : c.border,
                        borderWidth: 1,
                      },
                      active && { borderLeftWidth: 2, borderLeftColor: c.teal },
                      ...(isDark ? [cardShadowDark] : [cardShadowLight]),
                      pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Ionicons name={tl.icon} size={18} color={active ? c.teal : c.textMuted} />
                    <Text style={[st.trackingLabel, { color: active ? c.teal : c.text, fontFamily: GEO, fontWeight: '700' }]}>
                      {tl.label}
                    </Text>
                    <Text style={[st.trackingDesc, { color: c.textMuted, fontFamily: SANS }]} numberOfLines={2}>
                      {tl.desc}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Scorekeeper mode */}
            <SectionLabel title="SCOREKEEPER" />
            <ToggleRow
              options={[
                { key: 'everyone' as 'scorekeeper' | 'everyone', label: 'Everyone Scores' },
                { key: 'scorekeeper' as 'scorekeeper' | 'everyone', label: "I'm Scorekeeper" },
              ]}
              selected={scorekeeperMode}
              onSelect={setScorekeeperMode}
            />
            {hasManualPlayers && scorekeeperMode === 'everyone' && (
              <Text style={[st.scorekeeperWarning, { color: c.urgent }]}>
                Manual players need scorekeeper mode
              </Text>
            )}

            {/* Summary line */}
            {course && (
              <View style={[st.summaryRow, { borderColor: c.border, borderTopWidth: 1 }]}>
                <View style={st.summaryInner}>
                  {(linkedSeasons.length > 0 || linkedTrip || linkedMatchup) && (
                    <View style={[st.roundTypeBadge, { backgroundColor: `${c.gold}30` }]}>
                      <Text style={[st.roundTypeBadgeText, { color: c.gold, fontFamily: GEO }]}>
                        {roundContextLabel.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {linkedSeasons.length === 0 && !linkedTrip && !linkedMatchup && roundType !== 'casual' && (
                    <View style={[st.roundTypeBadge, { backgroundColor: roundType === 'competitive' ? `${c.gold}30` : `${c.teal}30` }]}>
                      <Text style={[st.roundTypeBadgeText, { color: roundType === 'competitive' ? c.gold : c.teal, fontFamily: GEO }]}>
                        {roundType === 'competitive' ? 'COMPETITIVE' : 'MATCHUP'}
                      </Text>
                    </View>
                  )}
                  <Text style={[st.summaryText, { color: c.textMuted, fontFamily: SANS }]}>
                    <Text style={{ fontFamily: GEO, fontWeight: '700' }}>{players.length}</Text> player{players.length !== 1 ? 's' : ''} ·{' '}
                    Par <Text style={{ fontFamily: GEO, fontWeight: '700' }}>{effectivePar}</Text> ·{' '}
                    {holeRange === 'full18' ? (<><Text style={{ fontFamily: GEO, fontWeight: '700' }}>18</Text> holes</>) : (<><Text style={{ fontFamily: GEO, fontWeight: '700' }}>9</Text> holes</>)} ·{' '}
                    {scoreMode === 'gross' ? 'Gross' : 'Net'}
                    {sideGames.size > 0 ? <> · <Text style={{ fontFamily: GEO, fontWeight: '700' }}>{sideGames.size}</Text> side game{sideGames.size !== 1 ? 's' : ''}</> : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Divider */}
            <GoldDivider style={{ marginTop: 24 }} />

            {/* Start button */}
            <Pressable
              onPress={handleStartRound}
              disabled={!canStart}
              style={({ pressed }) => [
                st.startBtn,
                canStart
                  ? { backgroundColor: isDark ? c.greenDark : '#006747' }
                  : { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.gold },
                pressed && canStart && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text
                style={[
                  st.startBtnText,
                  {
                    color: canStart ? '#FFFFFF' : c.gold,
                    fontFamily: GEO,
                  },
                ]}
              >
                Start Round
              </Text>
            </Pressable>
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 40 + insets.bottom }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const st = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },

  /* Header */
  header: {
    paddingTop: STATUS_BAR_H + 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerDormie: {
    color: '#C9A227',
    fontSize: 7,
    letterSpacing: 3,
    fontStyle: 'italic',
    fontWeight: '600',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Body */
  body: {
    paddingHorizontal: 20,
  },

  /* Section label */
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },

  /* Course search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  dropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dropdownName: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownMeta: {
    fontSize: 10,
    marginTop: 1,
  },
  customOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
  },
  customText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Selected course */
  selectedCourse: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  selectedStats: {
    fontSize: 11,
    marginTop: 3,
  },

  /* Par entry */
  parRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  parLabel: {
    fontSize: 13,
  },
  parControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  parBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  parValue: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },

  /* Players */
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 6,
    gap: 10,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  playerHcp: {
    fontSize: 10,
    marginTop: 1,
  },
  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  addPlayerText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Add player form */
  addForm: {
    padding: 14,
    marginTop: 6,
    gap: 8,
  },
  addInput: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 13,
  },
  addHcpInput: {
    width: 80,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  addCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addCancelText: {
    fontSize: 13,
  },
  addDoneBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  addDoneText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Format pills */
  pillsScroll: {
    gap: 8,
    paddingLeft: 20,
    paddingRight: 24,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  formatDesc: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  /* Side games */
  sideWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sidePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  sidePillText: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Toggle row */
  toggleRow: {
    flexDirection: 'row',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  /* Tee box selector */
  teeBoxSection: {
    marginTop: 10,
  },
  teeGenderToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  teeGenderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  teeGenderBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  teeBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  teeDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: -1,
    gap: 10,
  },
  teeDropdownInfo: {
    flex: 1,
  },
  teeDropdownName: {
    fontSize: 13,
    fontWeight: '600',
  },
  teeDropdownStats: {
    fontSize: 11,
    marginTop: 1,
  },
  teeBoxRow: {
    gap: 8,
    paddingRight: 16,
  },
  teeBoxChip: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    minWidth: 70,
  },
  teeBoxDot: {
    width: 10,
    height: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  teeBoxName: {
    fontSize: 11,
    fontWeight: '600',
  },
  teeBoxDetails: {
    marginTop: 4,
  },
  teeBoxStat: {
    fontSize: 10,
  },

  /* Loading hint */
  loadingHint: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  /* Course details form */
  courseDetailsWrap: {
    marginTop: 12,
    gap: 8,
  },
  courseDetailsHint: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },
  /* Custom course fields */
  customFieldsWrap: {
    marginTop: 10,
    gap: 8,
  },
  customField: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 13,
  },
  customFieldsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customFieldHalf: {
    flex: 1,
  },
  customFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },

  /* Round type */
  roundTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roundTypeCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 4,
  },
  roundTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  roundTypeDesc: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },

  /* Tracking level */
  trackingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trackingCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 4,
  },
  trackingLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  trackingDesc: {
    fontSize: 9,
    textAlign: 'center',
  },

  /* Scorekeeper warning */
  scorekeeperWarning: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },

  /* Summary */
  summaryRow: {
    marginTop: 24,
    paddingTop: 14,
  },
  summaryInner: {
    alignItems: 'center',
    gap: 6,
  },
  summaryText: {
    fontSize: 12,
    textAlign: 'center',
  },
  roundTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roundTypeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  /* Round context linking */
  contextSection: {
    gap: 8,
  },
  contextCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contextCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  contextDetail: {
    marginTop: 6,
    marginLeft: 24,
    gap: 6,
  },
  contextDetailText: {
    fontSize: 11,
  },
  contextMuted: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 24,
    fontStyle: 'italic',
  },
  contextPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  contextPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  contextPillText: {
    fontSize: 11,
    fontWeight: '500',
  },

  /* Season multi-select */
  seasonList: {
    marginTop: 8,
    gap: 6,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  seasonRowInfo: {
    flex: 1,
  },
  seasonRowName: {
    fontSize: 13,
    fontWeight: '600',
  },
  seasonRowMeta: {
    fontSize: 10,
    marginTop: 1,
  },

  /* Format conflict */
  formatConflictBanner: {
    padding: 12,
  },
  formatConflictTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  formatConflictItem: {
    fontSize: 12,
    marginLeft: 4,
    marginTop: 4,
  },
  formatConflictDesc: {
    fontSize: 11,
    marginLeft: 12,
    marginTop: 2,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  /* Add player modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  modalList: {
    maxHeight: 280,
    paddingHorizontal: 12,
  },
  modalFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  modalEmptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  modalManualText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Start button */
  startBtn: {
    marginTop: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
