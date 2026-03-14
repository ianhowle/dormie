import { useState, useMemo, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO, SANS } from '../../src/theme/fonts';
import { cardShadowDark, cardShadowLight } from '../../src/theme/colors';
import GoldDivider from '../../src/components/GoldDivider';
import { Avatar } from '../../src/components/Avatar';
import { PLAYED_SORTED, MOCK_COMMUNITY_COURSES } from '../../src/data/courses';
import { coursesService } from '../../src/services/courses.service';
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

// ─── Types ────────────────────────────────────────────────────────────
type SelectedCourse = {
  id: string;
  name: string;
  par: number;
  city: string;
  state: string;
} | null;

type Player = {
  id: string;
  name: string;
  handicap: number;
};

// ─── All searchable courses ───────────────────────────────────────────
const ALL_COURSES = [
  ...PLAYED_SORTED.map((c) => ({ id: c.id, name: c.name, par: c.par, city: c.city, state: c.state })),
  ...MOCK_COMMUNITY_COURSES.map((c) => ({ id: c.id, name: c.name, par: 72, city: c.city, state: c.state })),
];

// ─── Mock tee boxes ──────────────────────────────────────────────────
const MOCK_TEE_BOXES = [
  { name: 'Championship', color: '#1E4D2B', rating: 74.2, slope: 142, yards: 7200 },
  { name: 'Blue', color: '#1B2A4A', rating: 72.1, slope: 135, yards: 6800 },
  { name: 'White', color: '#FFFFFF', rating: 70.0, slope: 128, yards: 6400 },
  { name: 'Gold', color: '#D4AF37', rating: 68.2, slope: 121, yards: 5900 },
  { name: 'Red', color: '#C44B4F', rating: 66.1, slope: 115, yards: 5400 },
];

// ─── Mock friends for player search ──────────────────────────────────
const MOCK_FRIENDS = [
  { id: 'f1', name: 'Drew Patterson', handicap: 12 },
  { id: 'f2', name: 'Jake Sullivan', handicap: 15 },
  { id: 'f3', name: 'Tommy Fleetwood', handicap: 3 },
  { id: 'f4', name: 'Mike Chen', handicap: 18 },
  { id: 'f5', name: 'Sam Rodriguez', handicap: 22 },
  { id: 'f6', name: 'Nate Harmon', handicap: 14 },
];

// ─── Side game descriptions ─────────────────────────────────────────
const SIDE_GAME_DESCRIPTIONS: Record<string, string> = {
  dots: 'Points for birdies (+1), one-putts (+1), three-putts (-1), greenies (+1)',
  snake: 'Three-putt passes the snake; holder at end pays everyone',
  greenies: 'Closest to pin on par 3s; must make par to collect',
  skins: 'Win the hole outright to win the skin; ties carry over',
  hammer: 'Double the bet by throwing the hammer; opponent can re-hammer',
  nassau: 'Three separate bets: front 9, back 9, and overall',
  wolf: 'Rotating wolf picks a partner or goes alone each hole',
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
}: {
  selected: SelectedCourse;
  onSelect: (c: SelectedCourse) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    return ALL_COURSES.filter(
      (cr) =>
        cr.name.toLowerCase().includes(q) ||
        cr.city.toLowerCase().includes(q) ||
        cr.state.toLowerCase().includes(q),
    ).slice(0, 6);
  }, [query]);

  const isDark = theme.dark;

  if (selected) {
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
            {selected.city}, {selected.state} · Par <Text style={{ fontFamily: GEO, fontWeight: '700' }}>{selected.par}</Text>
          </Text>
        </View>
        <Ionicons name="close-circle" size={18} color={c.textMuted} />
      </Pressable>
    );
  }

  return (
    <View>
      <View style={[st.searchWrap, { backgroundColor: c.elevated, borderColor: c.border, borderWidth: 1 }]}>
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
          <Pressable onPress={() => { setQuery(''); }} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={c.textMuted} />
          </Pressable>
        )}
      </View>

      {open && results.length > 0 && (
        <View style={[st.dropdown, { backgroundColor: c.elevated, borderColor: c.border }]}>
          {results.map((cr) => (
            <Pressable
              key={cr.id}
              onPress={() => {
                onSelect(cr);
                setQuery('');
                setOpen(false);
              }}
              style={[st.dropdownItem, { borderColor: c.border }]}
            >
              <Text style={[st.dropdownName, { color: c.text }]}>{cr.name}</Text>
              <Text style={[st.dropdownMeta, { color: c.textMuted }]}>
                {cr.city}, {cr.state} · Par <Text style={{ fontFamily: GEO, fontWeight: '700' }}>{cr.par}</Text>
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {open && query.length > 0 && results.length === 0 && (
        <Pressable
          onPress={() => {
            onSelect({ id: `custom-${Date.now()}`, name: query, par: 72, city: '', state: '' });
            setOpen(false);
          }}
          style={[st.dropdown, st.customOption, { backgroundColor: c.elevated, borderColor: c.border }]}
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
  const isDark = theme.dark;

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
            { backgroundColor: c.greenDark },
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
  onAddFriend,
  onAddManual,
  onClose,
}: {
  visible: boolean;
  existingPlayerIds: Set<string>;
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
    return MOCK_FRIENDS.filter(
      (f) => !existingPlayerIds.has(f.id) && (q.length === 0 || f.name.toLowerCase().includes(q)),
    );
  }, [search, existingPlayerIds]);

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
          <View style={[st.modalSearchWrap, { backgroundColor: c.elevated, borderColor: c.border, borderWidth: 1 }]}>
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
                {search.length > 0 ? 'No friends found' : 'No more friends to add'}
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
                    { backgroundColor: c.greenDark },
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
              onPress={() => onSelect(f.key)}
              style={({ pressed }) => [
                st.pill,
                {
                  backgroundColor: active ? 'rgba(42,157,143,0.08)' : c.elevated,
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
  const desc = lastToggled && selected.has(lastToggled) ? SIDE_GAME_DESCRIPTIONS[lastToggled] : null;

  return (
    <View>
      <View style={st.sideWrap}>
        {SIDE_GAMES.map((g) => {
          const active = selected.has(g.key);
          return (
            <Pressable
              key={g.key}
              onPress={() => onToggle(g.key)}
              style={({ pressed }) => [
                st.sidePill,
                {
                  backgroundColor: active ? 'rgba(42,157,143,0.08)' : c.elevated,
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

  return (
    <View style={[st.toggleRow, { borderColor: c.border, borderWidth: 1 }]}>
      {options.map((opt) => {
        const active = opt.key === selected;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            style={({ pressed }) => [
              st.toggleBtn,
              active && { backgroundColor: 'rgba(42,157,143,0.08)' },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                st.toggleLabel,
                { color: active ? c.teal : c.textMuted, fontFamily: SANS },
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
  const [selectedTeeBox, setSelectedTeeBox] = useState(2);
  const [customLocation, setCustomLocation] = useState('');
  const [customRating, setCustomRating] = useState('72.0');
  const [customSlope, setCustomSlope] = useState('113');
  const [roundType, setRoundType] = useState<RoundType>('casual');

  const isCustom = course?.id.startsWith('custom-');
  const effectivePar = isCustom ? customPar : (course?.par ?? 72);
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
    setPlayers((prev) => [
      ...prev,
      { id: `p-${Date.now()}`, name, handicap: hcp },
    ]);
    setShowAddPlayerModal(false);
  };

  const handleAddFriend = (friend: { id: string; name: string; handicap: number }) => {
    setPlayers((prev) => [...prev, friend]);
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  // Fetch hole data when a non-custom course is selected
  useEffect(() => {
    if (course && !isCustom) {
      coursesService.generateHoleData?.(course.name, course.par)
        ?.then(setHoleData)
        ?.catch(() => setHoleData(null));
    } else {
      setHoleData(null);
    }
  }, [course, isCustom]);

  const isDark = theme.dark;
  const canStart = course !== null;

  const handleStartRound = () => {
    if (!course) return;
    const activeFormat = SCORING_FORMATS.find((f) => f.key === format);
    // Determine slope/rating based on course type
    let slope: number;
    let rating: number;
    if (isCustom) {
      slope = Number(customSlope) || 113;
      rating = Number(customRating) || 72.0;
    } else {
      const tee = MOCK_TEE_BOXES[selectedTeeBox];
      slope = tee.slope;
      rating = tee.rating;
    }
    router.push({
      pathname: '/scoring',
      params: {
        courseName: course.name,
        courseId: course.id,
        coursePar: String(effectivePar),
        courseSlope: String(slope),
        courseRating: String(rating),
        players: JSON.stringify(players),
        format: activeFormat?.label ?? 'Total Strokes',
        holeRange,
        scoreMode,
        sideGames: JSON.stringify([...sideGames]),
        trackingLevel,
        scorekeeperMode,
        roundType,
        ...(holeData ? { holeData: JSON.stringify(holeData) } : {}),
      },
    });
  };

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
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
            <Pinstripes />
            <Text style={[st.headerDormie, { fontFamily: GEO }]}>DORMIE</Text>
            <Text style={[st.headerTitle, { fontFamily: GEO }]}>
              New Round
            </Text>
          </LinearGradient>

          <View style={st.body}>
            {/* Course */}
            <SectionLabel title="COURSE" />
            <CourseSearch selected={course} onSelect={setCourse} />
            {isCustom && (
              <ParEntry par={customPar} onChange={setCustomPar} />
            )}
            {/* Tee box selector (non-custom courses) */}
            {course && !isCustom && (
              <View style={st.teeBoxSection}>
                <Text style={[st.teeBoxLabel, { color: c.textMuted }]}>Tee Box</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={st.teeBoxRow}
                >
                  {MOCK_TEE_BOXES.map((tee, i) => {
                    const active = i === selectedTeeBox;
                    return (
                      <Pressable
                        key={tee.name}
                        onPress={() => setSelectedTeeBox(i)}
                        style={[
                          st.teeBoxChip,
                          {
                            backgroundColor: active ? `${c.teal}20` : c.elevated,
                            borderColor: active ? c.teal : c.border,
                          },
                        ]}
                      >
                        <View style={[st.teeBoxDot, { backgroundColor: tee.color, borderColor: tee.color === '#FFFFFF' ? c.textMuted : tee.color }]} />
                        <Text style={[st.teeBoxName, { color: active ? c.teal : c.text }]}>
                          {tee.name}
                        </Text>
                        {active && (
                          <View style={st.teeBoxDetails}>
                            <Text style={[st.teeBoxStat, { color: c.textMuted, fontFamily: GEO }]}>
                              {tee.rating} / {tee.slope} · {tee.yards}y
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            {/* Manual course entry (custom courses) */}
            {isCustom && (
              <View style={st.customFieldsWrap}>
                <TextInput
                  style={[st.customField, { color: c.text, borderColor: c.border, backgroundColor: c.elevated }]}
                  placeholder="Location / City"
                  placeholderTextColor={c.textMuted}
                  value={customLocation}
                  onChangeText={setCustomLocation}
                  autoCapitalize="words"
                />
                <View style={st.customFieldsRow}>
                  <View style={st.customFieldHalf}>
                    <Text style={[st.customFieldLabel, { color: c.textMuted }]}>Rating</Text>
                    <TextInput
                      style={[st.customField, { color: c.text, borderColor: c.border, backgroundColor: c.elevated }]}
                      placeholder="72.0"
                      placeholderTextColor={c.textMuted}
                      value={customRating}
                      onChangeText={setCustomRating}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={st.customFieldHalf}>
                    <Text style={[st.customFieldLabel, { color: c.textMuted }]}>Slope</Text>
                    <TextInput
                      style={[st.customField, { color: c.text, borderColor: c.border, backgroundColor: c.elevated }]}
                      placeholder="113"
                      placeholderTextColor={c.textMuted}
                      value={customSlope}
                      onChangeText={setCustomSlope}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>
            )}

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
              onAddFriend={handleAddFriend}
              onAddManual={handleAddPlayer}
              onClose={() => setShowAddPlayerModal(false)}
            />

            {/* Scoring format */}
            <SectionLabel title="FORMAT" />
            <FormatPicker selected={format} onSelect={setFormat} />

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
                    style={[
                      st.roundTypeCard,
                      {
                        backgroundColor: active ? `${c.teal}20` : c.elevated,
                        borderColor: active ? c.teal : c.border,
                      },
                    ]}
                  >
                    <Ionicons name={rt.icon} size={18} color={active ? c.teal : c.textMuted} />
                    <Text style={[st.roundTypeLabel, { color: active ? c.teal : c.text }]}>
                      {rt.label}
                    </Text>
                    <Text style={[st.roundTypeDesc, { color: c.textMuted }]}>{rt.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Side games */}
            <SectionLabel title="SIDE GAMES" />
            <SideGamePicker selected={sideGames} onToggle={handleToggleSideGame} lastToggled={lastToggledSideGame} />

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
                    style={[
                      st.trackingCard,
                      {
                        backgroundColor: active ? `${c.teal}20` : c.elevated,
                        borderColor: active ? c.teal : c.border,
                      },
                    ]}
                  >
                    <Ionicons name={tl.icon} size={18} color={active ? c.teal : c.textMuted} />
                    <Text style={[st.trackingLabel, { color: active ? c.teal : c.text, fontFamily: GEO }]}>
                      {tl.label}
                    </Text>
                    <Text style={[st.trackingDesc, { color: c.textMuted }]} numberOfLines={2}>
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
              <View style={[st.summaryRow, { borderColor: c.border }]}>
                <View style={st.summaryInner}>
                  {roundType !== 'casual' && (
                    <View style={[st.roundTypeBadge, { backgroundColor: roundType === 'competitive' ? `${c.gold}30` : `${c.teal}30` }]}>
                      <Text style={[st.roundTypeBadgeText, { color: roundType === 'competitive' ? c.gold : c.teal }]}>
                        {roundType === 'competitive' ? 'COMPETITIVE' : 'MATCHUP'}
                      </Text>
                    </View>
                  )}
                  <Text style={[st.summaryText, { color: c.textMuted }]}>
                    {players.length} player{players.length !== 1 ? 's' : ''} ·{' '}
                    Par {effectivePar} ·{' '}
                    {holeRange === 'full18' ? '18 holes' : '9 holes'} ·{' '}
                    {scoreMode === 'gross' ? 'Gross' : 'Net'}
                    {sideGames.size > 0 ? ` · ${sideGames.size} side game${sideGames.size !== 1 ? 's' : ''}` : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Start button */}
            <Pressable
              onPress={handleStartRound}
              disabled={!canStart}
              style={[
                st.startBtn,
                canStart
                  ? { backgroundColor: '#1E4D2B' }
                  : { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#D4AF37' },
              ]}
            >
              <Text
                style={[
                  st.startBtnText,
                  {
                    color: '#D4AF37',
                    fontFamily: GEO,
                  },
                ]}
              >
                Start Round
              </Text>
            </Pressable>
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 40 }} />
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
    paddingTop: STATUS_BAR_H + 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerDormie: {
    color: '#D4AF37',
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

  /* Course search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  dropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dropdownName: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownMeta: {
    fontSize: 11,
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
    borderWidth: 1,
    padding: 12,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectedMeta: {
    fontSize: 11,
    marginTop: 2,
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
    borderWidth: 1,
    padding: 10,
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
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  addPlayerText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Add player form */
  addForm: {
    borderWidth: 1,
    padding: 12,
    marginTop: 6,
    gap: 8,
  },
  addInput: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
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
    paddingLeft: 2,
    paddingRight: 16,
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
    borderWidth: 1,
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
  teeBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
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

  /* Custom course fields */
  customFieldsWrap: {
    marginTop: 10,
    gap: 8,
  },
  customField: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
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
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    gap: 4,
  },
  roundTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  roundTypeDesc: {
    fontSize: 10,
    textAlign: 'center',
  },

  /* Tracking level */
  trackingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trackingCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
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
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 12,
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
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
    borderStyle: 'dashed',
  },
  modalManualText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Start button */
  startBtn: {
    marginTop: 16,
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
