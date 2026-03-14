import { useState, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { GEO } from '../../src/theme/fonts';
import { Avatar } from '../../src/components/Avatar';
import { PLAYED_SORTED, MOCK_COMMUNITY_COURSES } from '../../src/data/courses';
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

// ─── Section header ───────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Text style={[st.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
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

  if (selected) {
    return (
      <Pressable
        onPress={() => { onSelect(null); setQuery(''); setOpen(true); }}
        style={[st.selectedCourse, { backgroundColor: c.cardBg, borderColor: c.teal }]}
      >
        <View style={st.selectedInfo}>
          <Text style={[st.selectedName, { color: c.text }]}>{selected.name}</Text>
          <Text style={[st.selectedMeta, { color: c.textMuted }]}>
            {selected.city}, {selected.state} · Par {selected.par}
          </Text>
        </View>
        <Ionicons name="close-circle" size={18} color={c.textMuted} />
      </Pressable>
    );
  }

  return (
    <View>
      <View style={[st.searchWrap, { backgroundColor: c.elevated, borderColor: c.border }]}>
        <Ionicons name="search" size={16} color={c.textMuted} />
        <TextInput
          style={[st.searchInput, { color: c.text }]}
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
                {cr.city}, {cr.state} · Par {cr.par}
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
      <Text style={[st.parLabel, { color: c.textMuted }]}>Course Par</Text>
      <View style={st.parControls}>
        <Pressable
          onPress={() => onChange(Math.max(54, par - 1))}
          style={[st.parBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
        >
          <Ionicons name="remove" size={16} color={c.text} />
        </Pressable>
        <Text style={[st.parValue, { color: c.text, fontFamily: GEO }]}>{par}</Text>
        <Pressable
          onPress={() => onChange(Math.min(80, par + 1))}
          style={[st.parBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
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

  return (
    <View>
      {players.map((p, i) => {
        const isMe = i === 0;
        return (
          <View
            key={p.id}
            style={[st.playerRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Avatar id={p.id} size={32} name={p.name} />
            <View style={st.playerInfo}>
              <Text style={[st.playerName, { color: isMe ? c.teal : c.text }]}>
                {isMe ? 'You' : p.name}
              </Text>
              <Text style={[st.playerHcp, { color: c.textMuted }]}>
                {p.handicap} HCP
              </Text>
            </View>
            {!isMe && (
              <Pressable onPress={() => onRemove(p.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={c.textMuted} />
              </Pressable>
            )}
          </View>
        );
      })}
      <Pressable onPress={onAdd} style={[st.addPlayerBtn, { borderColor: c.border }]}>
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
    <View style={[st.addForm, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <TextInput
        style={[st.addInput, { color: c.text, borderColor: c.border }]}
        placeholder="Player name"
        placeholderTextColor={c.textMuted}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextInput
        style={[st.addInput, st.addHcpInput, { color: c.text, borderColor: c.border }]}
        placeholder="HCP"
        placeholderTextColor={c.textMuted}
        value={hcp}
        onChangeText={setHcp}
        keyboardType="numeric"
        maxLength={3}
      />
      <View style={st.addActions}>
        <Pressable onPress={onCancel} style={st.addCancelBtn}>
          <Text style={[st.addCancelText, { color: c.textMuted }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (name.trim().length > 0) {
              onDone(name.trim(), Number(hcp) || 0);
            }
          }}
          style={[st.addDoneBtn, { backgroundColor: c.teal }]}
        >
          <Text style={st.addDoneText}>Add</Text>
        </Pressable>
      </View>
    </View>
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
              style={[
                st.pill,
                {
                  backgroundColor: active ? `${c.teal}20` : c.elevated,
                  borderColor: active ? c.teal : c.border,
                },
              ]}
            >
              <Text
                style={[
                  st.pillText,
                  { color: active ? c.teal : c.textMuted },
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
}: {
  selected: Set<SideGame>;
  onToggle: (g: SideGame) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={st.sideWrap}>
      {SIDE_GAMES.map((g) => {
        const active = selected.has(g.key);
        return (
          <Pressable
            key={g.key}
            onPress={() => onToggle(g.key)}
            style={[
              st.sidePill,
              {
                backgroundColor: active ? `${c.teal}20` : c.elevated,
                borderColor: active ? c.teal : c.border,
              },
            ]}
          >
            <Text
              style={[
                st.sidePillText,
                { color: active ? c.teal : c.textMuted },
                active && { fontWeight: '700' },
              ]}
            >
              {g.label}
            </Text>
          </Pressable>
        );
      })}
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
    <View style={[st.toggleRow, { borderColor: c.border }]}>
      {options.map((opt) => {
        const active = opt.key === selected;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            style={[
              st.toggleBtn,
              active && { backgroundColor: `${c.teal}20` },
            ]}
          >
            <Text
              style={[
                st.toggleLabel,
                { color: active ? c.teal : c.textMuted },
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
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [format, setFormat] = useState<ScoringFormat>('stroke_play');
  const [sideGames, setSideGames] = useState<Set<SideGame>>(new Set());
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
    setShowAddPlayer(false);
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

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
              onAdd={() => setShowAddPlayer(true)}
              onRemove={handleRemovePlayer}
            />
            {showAddPlayer && (
              <AddPlayerInline
                onDone={handleAddPlayer}
                onCancel={() => setShowAddPlayer(false)}
              />
            )}

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
            <SideGamePicker selected={sideGames} onToggle={handleToggleSideGame} />

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
