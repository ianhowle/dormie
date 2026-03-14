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
} from '../../src/data/scoring';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

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
                backgroundColor: active ? `${c.gold}20` : c.elevated,
                borderColor: active ? c.gold : c.border,
              },
            ]}
          >
            <Text
              style={[
                st.sidePillText,
                { color: active ? c.gold : c.textMuted },
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

  const isCustom = course?.id.startsWith('custom-');
  const effectivePar = isCustom ? customPar : (course?.par ?? 72);

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
    // Look up slope/rating from played courses if available
    const played = PLAYED_SORTED.find((pc) => pc.id === course.id);
    router.push({
      pathname: '/scoring',
      params: {
        courseName: course.name,
        coursePar: String(effectivePar),
        courseSlope: String(played?.slope ?? 113),
        courseRating: String(effectivePar), // use par as approx rating if unknown
        players: JSON.stringify(players),
        format: activeFormat?.label ?? 'Total Strokes',
        holeRange,
        scoreMode,
        sideGames: JSON.stringify([...sideGames]),
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
          <View style={[st.header, { backgroundColor: c.surface }]}>
            <Text style={[st.headerTitle, { color: c.text, fontFamily: GEO }]}>
              New Round
            </Text>
          </View>

          <View style={st.body}>
            {/* Course */}
            <SectionLabel title="COURSE" />
            <CourseSearch selected={course} onSelect={setCourse} />
            {isCustom && (
              <ParEntry par={customPar} onChange={setCustomPar} />
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

            {/* Summary line */}
            {course && (
              <View style={[st.summaryRow, { borderColor: c.border }]}>
                <Text style={[st.summaryText, { color: c.textMuted }]}>
                  {players.length} player{players.length !== 1 ? 's' : ''} ·{' '}
                  Par {effectivePar} ·{' '}
                  {holeRange === 'full18' ? '18 holes' : '9 holes'} ·{' '}
                  {scoreMode === 'gross' ? 'Gross' : 'Net'}
                  {sideGames.size > 0 ? ` · ${sideGames.size} side game${sideGames.size !== 1 ? 's' : ''}` : ''}
                </Text>
              </View>
            )}

            {/* Start button */}
            <Pressable
              onPress={handleStartRound}
              disabled={!canStart}
              style={[
                st.startBtn,
                { backgroundColor: canStart ? '#1E4D2B' : c.elevated },
                !canStart && { opacity: 0.5 },
              ]}
            >
              <Text
                style={[
                  st.startBtnText,
                  {
                    color: canStart ? '#D4AF37' : c.textMuted,
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
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
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

  /* Summary */
  summaryRow: {
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 12,
  },
  summaryText: {
    fontSize: 12,
    textAlign: 'center',
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
