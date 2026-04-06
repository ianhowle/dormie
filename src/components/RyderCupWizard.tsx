import { useState, useEffect, useRef } from 'react';
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
  Animated,
  Alert,
  FlatList,
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
import { SIDE_GAMES, type SideGame } from '../data/scoring';
import { useAuth } from '../lib/auth';
import { tripsService } from '../services/trips.service';
import { coursesService } from '../services/courses.service';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Types ─────────────────────────────────────────────────────────────
type RCFormat = 'foursomes' | 'fourball' | 'singles' | 'shamble' | 'scramble' | 'greensomes';
type HoleRange = 'front9' | 'back9' | 'full18';
type WinCondition = 'most_points' | 'first_to';
type Formation = 'captain' | 'auto_balance' | 'snake_draft' | 'import';

type Session = {
  id: string;
  format: RCFormat;
  holeRange: HoleRange;
  courseId: string;
  points: number;
};

type RCCourse = { id: string; name: string; city: string; state: string };

type Player = { id: string; name: string; handicap: number };

// ─── Constants ──────────────────────────────────────────────────────────
const TEAM_SIZES = [4, 6, 8, 10, 12] as const;

const RC_FORMATS: { key: RCFormat; label: string; desc: string }[] = [
  { key: 'foursomes', label: 'Foursomes', desc: 'Alternate shot — teammates take turns hitting the same ball' },
  { key: 'fourball', label: 'Four-Ball', desc: 'Both players play their own ball, best score counts' },
  { key: 'singles', label: 'Singles', desc: 'One-on-one match play head to head' },
  { key: 'shamble', label: 'Shamble', desc: 'Best drive, then everyone plays their own ball' },
  { key: 'scramble', label: 'Scramble', desc: 'All play from the best shot each time' },
  { key: 'greensomes', label: 'Greensomes', desc: 'Both tee off, pick best drive, alternate from there' },
];

const QUICK_FILL = ['Scottsdale', 'Myrtle Beach', 'Bandon', 'Pinehurst', 'Pebble Beach'];

const SUGGESTED_COURSES: Record<string, RCCourse[]> = {
  Scottsdale: [
    { id: 'sc1', name: 'TPC Scottsdale', city: 'Scottsdale', state: 'AZ' },
    { id: 'sc2', name: 'We-Ko-Pa Saguaro', city: 'Scottsdale', state: 'AZ' },
    { id: 'sc3', name: 'Grayhawk Raptor', city: 'Scottsdale', state: 'AZ' },
  ],
  'Myrtle Beach': [
    { id: 'mb1', name: 'TPC Myrtle Beach', city: 'Myrtle Beach', state: 'SC' },
    { id: 'mb2', name: 'Caledonia Golf & Fish', city: 'Pawleys Island', state: 'SC' },
    { id: 'mb3', name: 'Tidewater Golf Club', city: 'North Myrtle Beach', state: 'SC' },
  ],
  Bandon: [
    { id: 'bd1', name: 'Bandon Dunes', city: 'Bandon', state: 'OR' },
    { id: 'bd2', name: 'Pacific Dunes', city: 'Bandon', state: 'OR' },
    { id: 'bd3', name: 'Old Macdonald', city: 'Bandon', state: 'OR' },
  ],
  Pinehurst: [
    { id: 'ph1', name: 'Pinehurst No. 2', city: 'Pinehurst', state: 'NC' },
    { id: 'ph2', name: 'Pinehurst No. 4', city: 'Pinehurst', state: 'NC' },
    { id: 'ph3', name: 'Pinehurst No. 8', city: 'Pinehurst', state: 'NC' },
  ],
  'Pebble Beach': [
    { id: 'pb1', name: 'Pebble Beach Golf Links', city: 'Pebble Beach', state: 'CA' },
    { id: 'pb2', name: 'Spyglass Hill', city: 'Pebble Beach', state: 'CA' },
    { id: 'pb3', name: 'Spanish Bay', city: 'Pebble Beach', state: 'CA' },
  ],
};

const DEFAULT_RC_SCHEDULE: Omit<Session, 'courseId'>[] = [
  { id: 's1', format: 'foursomes', holeRange: 'full18', points: 1 },
  { id: 's2', format: 'fourball', holeRange: 'full18', points: 1 },
  { id: 's3', format: 'singles', holeRange: 'full18', points: 1 },
];

const FORMATION_OPTIONS: { key: Formation; label: string; desc: string; icon: string }[] = [
  { key: 'captain', label: "Captain's Picks", desc: 'Captains draft their teams', icon: 'people' },
  { key: 'auto_balance', label: 'Auto-Balance', desc: 'Teams balanced by handicap', icon: 'scale' },
  { key: 'snake_draft', label: 'Snake Draft', desc: 'Alternating snake-style picks', icon: 'swap-vertical' },
  { key: 'import', label: 'Import Teams', desc: 'Pre-assigned team rosters', icon: 'download' },
];

const FEATURE_PILLS = ['Team Draft', 'Alternate Shot', 'Best Ball', 'Singles', 'Matchup Reveal'];

// ─── Shared section label ───────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[w.sectionLabel, { color: theme.colors.gold, fontFamily: GEO }]}>
      {title}
    </Text>
  );
}

// ─── Progress header ────────────────────────────────────────────────────
function WizardHeader({
  step,
  totalSteps,
  onBack,
}: {
  step: number;
  totalSteps: number;
  onBack: () => void;
}) {
  const progress = step / totalSteps;
  return (
    <LinearGradient
      colors={['#1565C0', '#B71C1C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={w.wizHeader}
    >
      <View style={w.wizHeaderTop}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={[w.wizHeaderTitle, { fontFamily: GEO }]}>
          {step === 0 ? '' : `Step ${step} of ${totalSteps}`}
        </Text>
        <View style={{ width: 24 }} />
      </View>
      {step > 0 && (
        <View style={w.progressTrack}>
          <View style={[w.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Step 0 — CINEMATIC WELCOME
// ═══════════════════════════════════════════════════════════════════════
function StepWelcome({ onBegin }: { onBegin: () => void }) {
  const anims = useRef(FEATURE_PILLS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const stagger = FEATURE_PILLS.map((_, i) =>
      Animated.timing(anims[i], {
        toValue: 1,
        duration: 400,
        delay: 600 + i * 150,
        useNativeDriver: true,
      }),
    );
    Animated.stagger(150, stagger).start();
  }, []);

  return (
    <View style={w.welcomeScreen}>
      <LinearGradient
        colors={['#1565C0', '#0A0A0A', '#B71C1C']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={w.welcomeContent}>
        <Text style={w.welcomeTrophy}>🏆</Text>
        <Text style={[w.welcomeTitle, { fontFamily: GEO }]}>RYDER CUP</Text>

        {/* Red-white-blue divider */}
        <View style={w.dividerRow}>
          <View style={[w.dividerLine, { backgroundColor: '#B71C1C' }]} />
          <View style={[w.dividerLine, { backgroundColor: '#FFFFFF' }]} />
          <View style={[w.dividerLine, { backgroundColor: '#1565C0' }]} />
        </View>

        <Text style={w.welcomeSub}>The ultimate team competition</Text>

        {/* Feature pills with staggered fade-in */}
        <View style={w.featurePills}>
          {FEATURE_PILLS.map((pill, i) => (
            <Animated.View
              key={pill}
              style={[
                w.featurePill,
                {
                  opacity: anims[i],
                  transform: [
                    {
                      translateY: anims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={w.featurePillText}>{pill}</Text>
            </Animated.View>
          ))}
        </View>

        <Pressable onPress={onBegin} style={w.beginBtn}>
          <LinearGradient
            colors={['#1565C0', '#B71C1C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[w.beginBtnText, { fontFamily: GEO }]}>BEGIN SETUP</Text>
        </Pressable>
        <Text style={w.timeNote}>Takes about 3 minutes</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Step 1 — BASICS
// ═══════════════════════════════════════════════════════════════════════
function StepBasics({
  name,
  setName,
  destination,
  setDestination,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  rounds,
  setRounds,
}: {
  name: string;
  setName: (v: string) => void;
  destination: string;
  setDestination: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  rounds: number;
  setRounds: (v: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={w.stepBody}
      bounces={false}
      keyboardShouldPersistTaps="handled"
    >
      <SectionLabel title="COMPETITION NAME" />
      <TextInput
        style={[w.input, { color: c.text, borderColor: c.border, fontFamily: GEO }]}
        placeholder="e.g. The McGowan Cup"
        placeholderTextColor={c.textMuted}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <SectionLabel title="DESTINATION" />
      <TextInput
        style={[w.input, { color: c.text, borderColor: c.border }]}
        placeholder="City or destination"
        placeholderTextColor={c.textMuted}
        value={destination}
        onChangeText={setDestination}
        autoCapitalize="words"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={w.quickFillScroll}
      >
        {QUICK_FILL.map((d) => (
          <Pressable
            key={d}
            onPress={() => setDestination(d)}
            style={[
              w.quickChip,
              {
                backgroundColor: destination === d ? `${c.teal}20` : c.elevated,
                borderColor: destination === d ? c.teal : c.border,
              },
            ]}
          >
            <Text style={[w.quickChipText, { color: destination === d ? c.teal : c.textMuted }]}>
              {d}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionLabel title="DATES" />
      <View style={w.dateRow}>
        <TextInput
          style={[w.input, { flex: 1, color: c.text, borderColor: c.border }]}
          placeholder="Start (YYYY-MM-DD)"
          placeholderTextColor={c.textMuted}
          value={startDate}
          onChangeText={setStartDate}
          keyboardType="numbers-and-punctuation"
        />
        <Text style={[w.dateTo, { color: c.textMuted }]}>to</Text>
        <TextInput
          style={[w.input, { flex: 1, color: c.text, borderColor: c.border }]}
          placeholder="End (YYYY-MM-DD)"
          placeholderTextColor={c.textMuted}
          value={endDate}
          onChangeText={setEndDate}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <SectionLabel title="NUMBER OF ROUNDS" />
      <View style={w.roundsRow}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n === rounds;
          return (
            <Pressable
              key={n}
              onPress={() => setRounds(n)}
              style={[
                w.roundPill,
                {
                  backgroundColor: active ? `${c.teal}20` : c.elevated,
                  borderColor: active ? c.teal : c.border,
                },
              ]}
            >
              <Text
                style={[
                  w.roundPillText,
                  { color: active ? c.teal : c.textMuted, fontFamily: GEO },
                ]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Step 2 — TEAMS
// ═══════════════════════════════════════════════════════════════════════
function StepTeams({
  teamSize,
  setTeamSize,
  winCondition,
  setWinCondition,
  firstToTarget,
  setFirstToTarget,
  nineHoleMatches,
  setNineHoleMatches,
}: {
  teamSize: number;
  setTeamSize: (v: number) => void;
  winCondition: WinCondition;
  setWinCondition: (v: WinCondition) => void;
  firstToTarget: number;
  setFirstToTarget: (v: number) => void;
  nineHoleMatches: boolean;
  setNineHoleMatches: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const perSide = teamSize / 2;
  const maxSessions = teamSize <= 4 ? 3 : teamSize <= 8 ? 4 : 5;
  const estimatedPoints = nineHoleMatches ? maxSessions * perSide * 0.5 : maxSessions * perSide;

  const formatAdaptation = (size: number) => {
    if (size === 4) return '2v2 — Foursomes + Singles';
    if (size === 6) return '3v3 — All formats available';
    if (size === 8) return '4v4 — Full Ryder Cup format';
    if (size === 10) return '5v5 — Extended sessions, more pairings';
    return '6v6 — Full field, multiple sessions required';
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={w.stepBody}
      bounces={false}
    >
      <SectionLabel title="TEAM SIZE" />
      <View style={w.teamSizeRow}>
        {TEAM_SIZES.map((n) => {
          const active = n === teamSize;
          return (
            <Pressable
              key={n}
              onPress={() => setTeamSize(n)}
              style={[
                w.teamSizeBtn,
                {
                  backgroundColor: active ? `${c.teal}20` : c.elevated,
                  borderColor: active ? c.teal : c.border,
                },
              ]}
            >
              <Text
                style={[
                  w.teamSizeNum,
                  { color: active ? c.teal : c.text, fontFamily: GEO },
                ]}
              >
                {n}
              </Text>
              <Text style={[w.teamSizeLabel, { color: active ? c.teal : c.textMuted }]}>
                {n / 2}v{n / 2}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Format adaptation */}
      <View style={[w.adaptBox, { backgroundColor: `${c.gold}10`, borderColor: c.gold }]}>
        <Ionicons name="information-circle" size={16} color={c.gold} />
        <Text style={[w.adaptText, { color: c.gold }]}>{formatAdaptation(teamSize)}</Text>
      </View>

      <SectionLabel title="WIN CONDITION" />
      {(['most_points', 'first_to'] as WinCondition[]).map((wc) => {
        const active = wc === winCondition;
        return (
          <Pressable
            key={wc}
            onPress={() => setWinCondition(wc)}
            style={[
              w.winRow,
              {
                backgroundColor: active ? `${c.teal}10` : c.cardBg,
                borderColor: active ? c.teal : c.border,
              },
            ]}
          >
            <View
              style={[
                w.radio,
                {
                  borderColor: active ? c.teal : c.textMuted,
                  backgroundColor: active ? c.teal : 'transparent',
                },
              ]}
            >
              {active && <View style={w.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[w.winLabel, { color: active ? c.teal : c.text }]}>
                {wc === 'most_points' ? 'Most Points' : 'First to X'}
              </Text>
              <Text style={[w.winDesc, { color: c.textMuted }]}>
                {wc === 'most_points'
                  ? 'Team with the most points after all sessions wins'
                  : 'First team to reach the target wins immediately'}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {winCondition === 'first_to' && (
        <View style={w.stepperRow}>
          <Text style={[w.stepperLabel, { color: c.text }]}>Target Points</Text>
          <View style={w.stepperBtns}>
            <Pressable
              onPress={() => { haptics.light(); setFirstToTarget(Math.max(3, firstToTarget - 0.5)); }}
              style={[w.stepperBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
            >
              <Ionicons name="remove" size={18} color={c.text} />
            </Pressable>
            <Text style={[w.stepperVal, { color: c.teal, fontFamily: GEO }]}>
              {firstToTarget}
            </Text>
            <Pressable
              onPress={() => { haptics.light(); setFirstToTarget(Math.min(30, firstToTarget + 0.5)); }}
              style={[w.stepperBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
            >
              <Ionicons name="add" size={18} color={c.text} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Scoring explanation */}
      <SectionLabel title="SCORING" />
      <View style={[w.scoreExplain, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        {[
          { label: 'Win', pts: '1', color: c.teal },
          { label: 'Halve', pts: '½', color: c.gold },
          { label: 'Loss', pts: '0', color: c.urgent },
        ].map((s) => (
          <View key={s.label} style={w.scoreExplainItem}>
            <Text style={[w.scoreExplainPts, { color: s.color, fontFamily: GEO }]}>{s.pts}</Text>
            <Text style={[w.scoreExplainLabel, { color: c.textMuted }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* 9-hole match toggle */}
      <Pressable
        onPress={() => { haptics.light(); setNineHoleMatches(!nineHoleMatches); }}
        style={[w.toggleRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[w.toggleLabel, { color: c.text }]}>9-Hole Match Scoring</Text>
          <Text style={[w.toggleDesc, { color: c.textMuted }]}>
            Split each round into front/back 9 matches (0.5 pts each)
          </Text>
        </View>
        <View
          style={[
            w.toggleSwitch,
            {
              backgroundColor: nineHoleMatches ? c.teal : c.elevated,
              borderColor: nineHoleMatches ? c.teal : c.border,
            },
          ]}
        >
          <View
            style={[
              w.toggleKnob,
              nineHoleMatches && w.toggleKnobOn,
            ]}
          />
        </View>
      </Pressable>

      {/* Odd team note */}
      {teamSize % 4 !== 0 && (
        <View style={[w.adaptBox, { backgroundColor: `${c.gold}10`, borderColor: c.gold, marginTop: 12 }]}>
          <Ionicons name="warning" size={14} color={c.gold} />
          <Text style={[w.adaptText, { color: c.gold }]}>
            Odd pairings: one player will sit out per team session, or play a singles match
          </Text>
        </View>
      )}

      {/* Estimated total points */}
      <View style={[w.totalPtsBox, { backgroundColor: `${c.teal}10`, borderColor: c.teal }]}>
        <Text style={[w.totalPtsLabel, { color: c.textMuted }]}>ESTIMATED TOTAL POINTS</Text>
        <Text style={[w.totalPtsVal, { color: c.teal, fontFamily: GEO }]}>
          {estimatedPoints}
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Step 3 — COURSES
// ═══════════════════════════════════════════════════════════════════════
function StepCourses({
  destination,
  courses,
  setCourses,
}: {
  destination: string;
  courses: RCCourse[];
  setCourses: (v: RCCourse[]) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [customName, setCustomName] = useState('');

  const suggested = SUGGESTED_COURSES[destination] ?? [];
  const suggestedFiltered = suggested.filter((s) => !courses.find((cc) => cc.id === s.id));

  const addCourse = (course: RCCourse) => setCourses([...courses, course]);
  const removeCourse = (id: string) => setCourses(courses.filter((cc) => cc.id !== id));
  const addCustom = () => {
    if (!customName.trim()) return;
    setCourses([
      ...courses,
      { id: `custom-${Date.now()}`, name: customName.trim(), city: destination || 'TBD', state: '' },
    ]);
    setCustomName('');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={w.stepBody}
      bounces={false}
      keyboardShouldPersistTaps="handled"
    >
      <SectionLabel title="SELECTED COURSES" />
      {courses.length === 0 && (
        <Text style={[w.emptyText, { color: c.textMuted }]}>No courses added yet</Text>
      )}
      {courses.map((course) => (
        <View key={course.id} style={[w.courseRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <Ionicons name="golf" size={18} color={c.teal} />
          <View style={{ flex: 1 }}>
            <Text style={[w.courseName, { color: c.text }]}>{course.name}</Text>
            <Text style={[w.courseCity, { color: c.textMuted }]}>
              {course.city}{course.state ? `, ${course.state}` : ''}
            </Text>
          </View>
          <Pressable onPress={() => removeCourse(course.id)} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={c.urgent} />
          </Pressable>
        </View>
      ))}

      {suggestedFiltered.length > 0 && (
        <>
          <SectionLabel title={`SUGGESTED — ${destination.toUpperCase()}`} />
          {suggestedFiltered.map((course) => (
            <Pressable
              key={course.id}
              onPress={() => addCourse(course)}
              style={[w.courseRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
            >
              <Ionicons name="add-circle" size={18} color={c.teal} />
              <View style={{ flex: 1 }}>
                <Text style={[w.courseName, { color: c.text }]}>{course.name}</Text>
                <Text style={[w.courseCity, { color: c.textMuted }]}>
                  {course.city}, {course.state}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      )}

      <SectionLabel title="ADD CUSTOM COURSE" />
      <View style={w.addCourseRow}>
        <TextInput
          style={[w.input, { flex: 1, color: c.text, borderColor: c.border }]}
          placeholder="Course name"
          placeholderTextColor={c.textMuted}
          value={customName}
          onChangeText={setCustomName}
        />
        <Pressable
          onPress={addCustom}
          style={[w.addCourseBtn, { backgroundColor: customName.trim() ? c.teal : c.elevated }]}
        >
          <Ionicons name="add" size={20} color={customName.trim() ? '#fff' : c.textMuted} />
        </Pressable>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Step 4 — SCHEDULE
// ═══════════════════════════════════════════════════════════════════════
function StepSchedule({
  sessions,
  setSessions,
  courses,
  teamSize,
}: {
  sessions: Session[];
  setSessions: (v: Session[]) => void;
  courses: RCCourse[];
  teamSize: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const perSide = teamSize / 2;

  const applyRCFormat = () => {
    const defaultCourse = courses[0]?.id ?? '';
    setSessions([
      { id: 's1', format: 'foursomes', holeRange: 'full18', courseId: defaultCourse, points: perSide },
      { id: 's2', format: 'fourball', holeRange: 'full18', courseId: defaultCourse, points: perSide },
      { id: 's3', format: 'singles', holeRange: 'full18', courseId: defaultCourse, points: perSide },
    ]);
  };

  const updateSession = (idx: number, patch: Partial<Session>) => {
    setSessions(sessions.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const addSession = () => {
    setSessions([
      ...sessions,
      {
        id: `s${Date.now()}`,
        format: 'singles',
        holeRange: 'full18',
        courseId: courses[0]?.id ?? '',
        points: perSide,
      },
    ]);
  };

  const removeSession = (idx: number) => {
    setSessions(sessions.filter((_, i) => i !== idx));
  };

  const totalPoints = sessions.reduce((sum, s) => sum + s.points, 0);

  const getPointsForFormat = (format: RCFormat, range: HoleRange): number => {
    const matchesPerSession = format === 'singles' ? perSide : Math.floor(perSide / 2);
    return range === 'full18' ? matchesPerSession : matchesPerSession * 2;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={w.stepBody}
      bounces={false}
    >
      {/* One-tap RC format */}
      <Pressable onPress={applyRCFormat} style={[w.rcFormatBtn, { borderColor: c.teal }]}>
        <LinearGradient
          colors={['#1565C0', '#B71C1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="flash" size={18} color="#C9A227" />
        <Text style={[w.rcFormatBtnText, { fontFamily: GEO }]}>Use Ryder Cup Format</Text>
        <Text style={w.rcFormatBtnSub}>Foursomes → Four-Ball → Singles</Text>
      </Pressable>

      <SectionLabel title="SESSIONS" />
      {sessions.map((session, idx) => (
        <View key={session.id} style={[w.sessionCard, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <View style={w.sessionHeader}>
            <Text style={[w.sessionTitle, { color: c.text, fontFamily: GEO }]}>
              Session {idx + 1}
            </Text>
            {sessions.length > 1 && (
              <Pressable onPress={() => removeSession(idx)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={c.urgent} />
              </Pressable>
            )}
          </View>

          {/* Format picker */}
          <Text style={[w.sessionSubLabel, { color: c.textMuted }]}>FORMAT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={w.formatPillScroll}>
            {RC_FORMATS.map((f) => {
              const active = f.key === session.format;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => {
                    const pts = getPointsForFormat(f.key, session.holeRange);
                    updateSession(idx, { format: f.key, points: pts });
                  }}
                  style={[
                    w.fmtPill,
                    {
                      backgroundColor: active ? `${c.teal}20` : c.elevated,
                      borderColor: active ? c.teal : c.border,
                    },
                  ]}
                >
                  <Text style={[w.fmtPillText, { color: active ? c.teal : c.textMuted }]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Hole range */}
          <Text style={[w.sessionSubLabel, { color: c.textMuted }]}>HOLES</Text>
          <View style={w.holeToggleRow}>
            {(['front9', 'back9', 'full18'] as HoleRange[]).map((hr) => {
              const active = hr === session.holeRange;
              const label = hr === 'front9' ? 'Front 9' : hr === 'back9' ? 'Back 9' : 'Full 18';
              return (
                <Pressable
                  key={hr}
                  onPress={() => {
                    const pts = getPointsForFormat(session.format, hr);
                    updateSession(idx, { holeRange: hr, points: pts });
                  }}
                  style={[
                    w.holePill,
                    {
                      backgroundColor: active ? `${c.teal}20` : c.elevated,
                      borderColor: active ? c.teal : c.border,
                    },
                  ]}
                >
                  <Text style={[w.holePillText, { color: active ? c.teal : c.textMuted }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Course assignment */}
          {courses.length > 0 && (
            <>
              <Text style={[w.sessionSubLabel, { color: c.textMuted }]}>COURSE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={w.formatPillScroll}>
                {courses.map((cc) => {
                  const active = cc.id === session.courseId;
                  return (
                    <Pressable
                      key={cc.id}
                      onPress={() => updateSession(idx, { courseId: cc.id })}
                      style={[
                        w.fmtPill,
                        {
                          backgroundColor: active ? `${c.gold}20` : c.elevated,
                          borderColor: active ? c.gold : c.border,
                        },
                      ]}
                    >
                      <Text style={[w.fmtPillText, { color: active ? c.gold : c.textMuted }]}>
                        {cc.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Points for this session */}
          <View style={w.sessionPtsRow}>
            <Text style={[w.sessionPtsLabel, { color: c.textMuted }]}>Points available</Text>
            <Text style={[w.sessionPtsVal, { color: c.teal, fontFamily: GEO }]}>
              {session.points}
            </Text>
          </View>
        </View>
      ))}

      <Pressable onPress={addSession} style={[w.addSessionBtn, { borderColor: c.border }]}>
        <Ionicons name="add-circle-outline" size={18} color={c.teal} />
        <Text style={[w.addSessionText, { color: c.teal }]}>Add Session</Text>
      </Pressable>

      {/* Total points */}
      <View style={[w.totalPtsBox, { backgroundColor: `${c.teal}10`, borderColor: c.teal }]}>
        <Text style={[w.totalPtsLabel, { color: c.textMuted }]}>TOTAL POINTS IN PLAY</Text>
        <Text style={[w.totalPtsVal, { color: c.teal, fontFamily: GEO }]}>{totalPoints}</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Step 5 — FORMATION
// ═══════════════════════════════════════════════════════════════════════
function StepFormation({
  formation,
  setFormation,
  teamAName,
  setTeamAName,
  teamBName,
  setTeamBName,
  sideGames,
  setSideGames,
}: {
  formation: Formation;
  setFormation: (v: Formation) => void;
  teamAName: string;
  setTeamAName: (v: string) => void;
  teamBName: string;
  setTeamBName: (v: string) => void;
  sideGames: Set<SideGame>;
  setSideGames: (v: Set<SideGame>) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const toggleSide = (g: SideGame) => {
    const next = new Set(sideGames);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    setSideGames(next);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={w.stepBody}
      bounces={false}
      keyboardShouldPersistTaps="handled"
    >
      <SectionLabel title="TEAM FORMATION" />
      {FORMATION_OPTIONS.map((opt) => {
        const active = opt.key === formation;
        return (
          <Pressable
            key={opt.key}
            onPress={() => setFormation(opt.key)}
            style={[
              w.formationRow,
              {
                backgroundColor: active ? `${c.teal}10` : c.cardBg,
                borderColor: active ? c.teal : c.border,
              },
            ]}
          >
            <View
              style={[
                w.radio,
                {
                  borderColor: active ? c.teal : c.textMuted,
                  backgroundColor: active ? c.teal : 'transparent',
                },
              ]}
            >
              {active && <View style={w.radioDot} />}
            </View>
            <Ionicons name={opt.icon as any} size={18} color={active ? c.teal : c.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[w.formationLabel, { color: active ? c.teal : c.text }]}>
                {opt.label}
              </Text>
              <Text style={[w.formationDesc, { color: c.textMuted }]}>{opt.desc}</Text>
            </View>
          </Pressable>
        );
      })}

      {/* Team naming */}
      <SectionLabel title="TEAM NAMES" />
      <View style={w.teamNameRow}>
        <View style={[w.teamColorBar, { backgroundColor: '#B71C1C' }]} />
        <TextInput
          style={[w.teamNameInput, { color: c.text, borderColor: c.border }]}
          placeholder="Team Red"
          placeholderTextColor={c.textMuted}
          value={teamAName}
          onChangeText={setTeamAName}
        />
      </View>
      <View style={[w.teamNameRow, { marginTop: 8 }]}>
        <View style={[w.teamColorBar, { backgroundColor: '#1565C0' }]} />
        <TextInput
          style={[w.teamNameInput, { color: c.text, borderColor: c.border }]}
          placeholder="Team Blue"
          placeholderTextColor={c.textMuted}
          value={teamBName}
          onChangeText={setTeamBName}
        />
      </View>

      {/* Side games */}
      <SectionLabel title="SIDE GAMES (OPTIONAL)" />
      <View style={w.sideGameWrap}>
        {SIDE_GAMES.map((g) => {
          const active = sideGames.has(g.key);
          return (
            <Pressable
              key={g.key}
              onPress={() => toggleSide(g.key)}
              style={[
                w.sideGamePill,
                {
                  backgroundColor: active ? `${c.gold}20` : c.elevated,
                  borderColor: active ? c.gold : c.border,
                },
              ]}
            >
              <Text style={[w.sideGamePillText, { color: active ? c.gold : c.textMuted }]}>
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Step 6 — PLAYERS
// ═══════════════════════════════════════════════════════════════════════
function StepPlayers({
  players,
  setPlayers,
  teamSize,
}: {
  players: Player[];
  setPlayers: (v: Player[]) => void;
  teamSize: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [addName, setAddName] = useState('');
  const [addHcp, setAddHcp] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = () => {
    if (!addName.trim()) return;
    setPlayers([
      ...players,
      { id: `p-${Date.now()}`, name: addName.trim(), handicap: Number(addHcp) || 0 },
    ]);
    setAddName('');
    setAddHcp('');
    setShowAdd(false);
  };

  const removePlayer = (id: string) => setPlayers(players.filter((p) => p.id !== id));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={w.stepBody}
      bounces={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Player count tracker */}
      <View style={[w.playerTracker, { backgroundColor: c.cardBg, borderColor: c.border }]}>
        <Text style={[w.trackerLabel, { color: c.textMuted }]}>PLAYERS</Text>
        <Text style={[w.trackerCount, { color: players.length >= teamSize ? c.teal : c.text, fontFamily: GEO }]}>
          {players.length}
          <Text style={{ color: c.textMuted, fontSize: 16 }}> / {teamSize}</Text>
        </Text>
        {players.length < teamSize && (
          <Text style={[w.trackerNeeded, { color: c.gold }]}>
            Need {teamSize - players.length} more
          </Text>
        )}
      </View>

      <SectionLabel title="ROSTER" />
      {players.map((p, i) => {
        const isMe = i === 0;
        return (
          <View
            key={p.id}
            style={[w.playerRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Avatar id={p.id} size={32} name={p.name} />
            <View style={{ flex: 1 }}>
              <Text style={[w.playerName, { color: isMe ? c.teal : c.text }]}>
                {isMe ? 'You' : p.name}
              </Text>
              <Text style={[w.playerHcp, { color: c.textMuted }]}>{p.handicap} HCP</Text>
            </View>
            {!isMe && (
              <Pressable onPress={() => removePlayer(p.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={c.textMuted} />
              </Pressable>
            )}
          </View>
        );
      })}

      {showAdd ? (
        <View style={[w.addForm, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <TextInput
            style={[w.input, { color: c.text, borderColor: c.border }]}
            placeholder="Player name"
            placeholderTextColor={c.textMuted}
            value={addName}
            onChangeText={setAddName}
            autoCapitalize="words"
          />
          <TextInput
            style={[w.input, { width: 80, color: c.text, borderColor: c.border }]}
            placeholder="HCP"
            placeholderTextColor={c.textMuted}
            value={addHcp}
            onChangeText={setAddHcp}
            keyboardType="numeric"
            maxLength={3}
          />
          <View style={w.addFormActions}>
            <Pressable onPress={() => setShowAdd(false)}>
              <Text style={[w.addCancelText, { color: c.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleAdd} style={[w.addDoneBtn, { backgroundColor: c.teal }]}>
              <Text style={w.addDoneBtnText}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowAdd(true)}
          style={[w.addPlayerBtn, { borderColor: c.border }]}
        >
          <Ionicons name="add-circle-outline" size={18} color={c.teal} />
          <Text style={[w.addPlayerText, { color: c.teal }]}>Add Player</Text>
        </Pressable>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Step 7 — REVIEW
// ═══════════════════════════════════════════════════════════════════════
function StepReview({
  name,
  destination,
  startDate,
  endDate,
  teamSize,
  teamAName,
  teamBName,
  sessions,
  courses,
  players,
  formation,
  winCondition,
  firstToTarget,
  onLaunch,
}: {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  teamSize: number;
  teamAName: string;
  teamBName: string;
  sessions: Session[];
  courses: RCCourse[];
  players: Player[];
  formation: Formation;
  winCondition: WinCondition;
  firstToTarget: number;
  onLaunch: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const redName = teamAName || 'Team Red';
  const blueName = teamBName || 'Team Blue';
  const totalPoints = sessions.reduce((s, ss) => s + ss.points, 0);
  const formatLabel = (f: RCFormat) => RC_FORMATS.find((x) => x.key === f)?.label ?? f;
  const formationLabel = FORMATION_OPTIONS.find((x) => x.key === formation)?.label ?? formation;

  const configRows: [string, string][] = [
    ['Destination', destination || 'TBD'],
    ['Dates', startDate && endDate ? `${startDate} → ${endDate}` : 'TBD'],
    ['Team Size', `${teamSize / 2}v${teamSize / 2}`],
    ['Formation', formationLabel],
    ['Win Condition', winCondition === 'most_points' ? 'Most Points' : `First to ${firstToTarget}`],
    ['Sessions', `${sessions.length}`],
    ['Total Points', `${totalPoints}`],
    ['Courses', courses.map((cc) => cc.name).join(', ') || 'TBD'],
    ['Players', `${players.length} / ${teamSize}`],
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={w.stepBody}
      bounces={false}
    >
      {/* Hero graphic */}
      <View style={w.reviewHero}>
        <LinearGradient
          colors={['#B71C1C', '#1A1A1A', '#1565C0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={w.reviewHeroContent}>
          <View style={w.reviewVsRow}>
            <View style={w.reviewTeamSide}>
              <View style={[w.reviewTeamDot, { backgroundColor: '#B71C1C' }]} />
              <Text style={[w.reviewTeamName, { fontFamily: GEO }]}>{redName}</Text>
            </View>
            <Text style={[w.reviewVs, { fontFamily: GEO }]}>VS</Text>
            <View style={w.reviewTeamSide}>
              <View style={[w.reviewTeamDot, { backgroundColor: '#1565C0' }]} />
              <Text style={[w.reviewTeamName, { fontFamily: GEO }]}>{blueName}</Text>
            </View>
          </View>
          <Text style={[w.reviewCupName, { fontFamily: GEO }]}>{name || 'Ryder Cup'}</Text>
        </View>
      </View>

      {/* Config table */}
      <SectionLabel title="CONFIGURATION" />
      <View style={[w.configTable, { borderColor: c.border }]}>
        {configRows.map(([label, val], i) => (
          <View
            key={label}
            style={[
              w.configRow,
              { borderColor: c.border },
              i === 0 && { borderTopWidth: 0 },
            ]}
          >
            <Text style={[w.configLabel, { color: c.textMuted }]}>{label}</Text>
            <Text style={[w.configVal, { color: c.text }]}>{val}</Text>
          </View>
        ))}
      </View>

      {/* Schedule preview */}
      <SectionLabel title="SCHEDULE" />
      {sessions.map((s, i) => {
        const courseName = courses.find((cc) => cc.id === s.courseId)?.name ?? 'TBD';
        const rangeLabel = s.holeRange === 'front9' ? 'Front 9' : s.holeRange === 'back9' ? 'Back 9' : '18 Holes';
        return (
          <View key={s.id} style={[w.scheduleRow, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={[w.scheduleNum, { backgroundColor: `${c.teal}20` }]}>
              <Text style={[w.scheduleNumText, { color: c.teal, fontFamily: GEO }]}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[w.scheduleFormat, { color: c.text }]}>{formatLabel(s.format)}</Text>
              <Text style={[w.scheduleMeta, { color: c.textMuted }]}>
                {rangeLabel} · {courseName} · {s.points} pts
              </Text>
            </View>
          </View>
        );
      })}

      {/* Launch button */}
      <Pressable onPress={onLaunch} style={w.launchBtn}>
        <LinearGradient
          colors={['#1565C0', '#B71C1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="trophy" size={20} color="#C9A227" />
        <Text style={[w.launchBtnText, { fontFamily: GEO }]}>Launch Ryder Cup</Text>
      </Pressable>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN WIZARD
// ═══════════════════════════════════════════════════════════════════════
export function RyderCupWizard({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Basics
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rounds, setRounds] = useState(3);

  // Step 2: Teams
  const [teamSize, setTeamSize] = useState(8);
  const [winCondition, setWinCondition] = useState<WinCondition>('most_points');
  const [firstToTarget, setFirstToTarget] = useState<number>(14.5);
  const [nineHoleMatches, setNineHoleMatches] = useState(false);

  // Step 3: Courses
  const [courses, setCourses] = useState<RCCourse[]>([]);

  // Step 4: Schedule
  const [sessions, setSessions] = useState<Session[]>([
    { id: 's1', format: 'foursomes', holeRange: 'full18', courseId: '', points: 4 },
    { id: 's2', format: 'fourball', holeRange: 'full18', courseId: '', points: 4 },
    { id: 's3', format: 'singles', holeRange: 'full18', courseId: '', points: 4 },
  ]);

  // Step 5: Formation
  const [formation, setFormation] = useState<Formation>('captain');
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [sideGames, setSideGames] = useState<Set<SideGame>>(new Set());

  // Step 6: Players
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'Ian McGowan', handicap: 8 },
  ]);

  const TOTAL_STEPS = 7;

  const handleBack = () => {
    if (step === 0) {
      onBack();
    } else {
      haptics.medium();
      setStep(step - 1);
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      haptics.medium();
      setStep(step + 1);
    }
  };

  const canContinue = (): boolean => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return true;
      case 3: return true;
      case 4: return sessions.length > 0;
      case 5: return true;
      case 6: return players.length >= 2;
      default: return true;
    }
  };

  const handleLaunch = async () => {
    if (!user || saving) return;
    setSaving(true);
    haptics.medium();

    try {
      // 1. Build ryder_cup_config
      const ryderCupConfig = {
        teamRedName: teamAName || 'Team Red',
        teamBlueName: teamBName || 'Team Blue',
        sessions: sessions.map((s) => ({
          id: s.id,
          format: s.format,
          holeRange: s.holeRange,
          courseId: s.courseId,
          points: s.points,
        })),
        formation,
        teamSize,
        winCondition,
        firstToTarget: winCondition === 'first_to' ? firstToTarget : null,
        nineHoleMatches,
        sideGames: Array.from(sideGames),
      };

      // 2. Create the trip
      const trip = await tripsService.create({
        name: name || 'Ryder Cup',
        location: destination || 'TBD',
        start_date: startDate || new Date().toISOString().slice(0, 10),
        end_date: endDate || new Date().toISOString().slice(0, 10),
        organizer_id: user.id,
        trip_type: 'ryder',
        status: 'planning',
        ryder_cup_config: ryderCupConfig,
        side_games: Array.from(sideGames),
        gradient: ['#1565C0', '#B71C1C'],
      });

      // 3. Add players as trip_members
      // Auto-balance assigns teams now if formation is 'auto_balance'
      let teamAssignments: { userId: string; team: 'red' | 'blue' | null }[] = [];

      if (formation === 'auto_balance') {
        // Snake-by-handicap assignment
        const sorted = [...players].sort((a, b) => a.handicap - b.handicap);
        sorted.forEach((p, i) => {
          const round = Math.floor(i / 2);
          const isSecond = i % 2 === 1;
          const team: 'red' | 'blue' = (round % 2 === 0) === !isSecond ? 'red' : 'blue';
          teamAssignments.push({ userId: p.id, team });
        });
      } else {
        // For captain/snake_draft/import, teams will be assigned later in draft
        teamAssignments = players.map((p) => ({ userId: p.id, team: null }));
      }

      // Skip the organizer (already added by tripsService.create) — update their team instead
      const otherMembers = teamAssignments
        .filter((m) => m.userId !== user.id)
        .map((m) => ({
          user_id: m.userId,
          role: 'player' as const,
          team: m.team,
        }));

      if (otherMembers.length > 0) {
        await tripsService.addMembers(trip.id, otherMembers);
      }

      // Update organizer's team if auto-balanced
      const orgAssignment = teamAssignments.find((m) => m.userId === user.id);
      if (orgAssignment?.team) {
        await tripsService.updateMemberTeam(trip.id, user.id, orgAssignment.team);
      }

      // 4. Add courses as trip_courses
      for (let i = 0; i < courses.length; i++) {
        const course = courses[i];
        // Ensure course exists in DB
        let courseRecord;
        try {
          courseRecord = await coursesService.ensureCourse({
            name: course.name,
            location: `${course.city}, ${course.state}`,
          });
        } catch {
          continue; // Skip if course creation fails
        }
        await tripsService.addCourse({
          trip_id: trip.id,
          course_id: courseRecord.id,
          day_number: i + 1,
        });
      }

      // 5. Navigate to the trip detail screen
      haptics.success();
      router.dismissAll();
      router.push({ pathname: '/trip-detail', params: { tripId: trip.id } });
    } catch (err) {
      setSaving(false);
      Alert.alert(
        'Error',
        'Failed to create Ryder Cup. Please try again.',
        [{ text: 'OK' }],
      );
    }
  };

  // Step 0: Welcome
  if (step === 0) {
    return <StepWelcome onBegin={() => setStep(1)} />;
  }

  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[w.screen, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <WizardHeader step={step} totalSteps={TOTAL_STEPS} onBack={handleBack} />

        {step === 1 && (
          <StepBasics
            name={name} setName={setName}
            destination={destination} setDestination={setDestination}
            startDate={startDate} setStartDate={setStartDate}
            endDate={endDate} setEndDate={setEndDate}
            rounds={rounds} setRounds={setRounds}
          />
        )}
        {step === 2 && (
          <StepTeams
            teamSize={teamSize} setTeamSize={setTeamSize}
            winCondition={winCondition} setWinCondition={setWinCondition}
            firstToTarget={firstToTarget} setFirstToTarget={setFirstToTarget}
            nineHoleMatches={nineHoleMatches} setNineHoleMatches={setNineHoleMatches}
          />
        )}
        {step === 3 && (
          <StepCourses
            destination={destination}
            courses={courses} setCourses={setCourses}
          />
        )}
        {step === 4 && (
          <StepSchedule
            sessions={sessions} setSessions={setSessions}
            courses={courses}
            teamSize={teamSize}
          />
        )}
        {step === 5 && (
          <StepFormation
            formation={formation} setFormation={setFormation}
            teamAName={teamAName} setTeamAName={setTeamAName}
            teamBName={teamBName} setTeamBName={setTeamBName}
            sideGames={sideGames} setSideGames={setSideGames}
          />
        )}
        {step === 6 && (
          <StepPlayers
            players={players} setPlayers={setPlayers}
            teamSize={teamSize}
          />
        )}
        {step === 7 && (
          <StepReview
            name={name}
            destination={destination}
            startDate={startDate}
            endDate={endDate}
            teamSize={teamSize}
            teamAName={teamAName}
            teamBName={teamBName}
            sessions={sessions}
            courses={courses}
            players={players}
            formation={formation}
            winCondition={winCondition}
            firstToTarget={firstToTarget}
            onLaunch={handleLaunch}
          />
        )}

        {/* Bottom nav — not on step 7 (review has its own Launch button) */}
        {step < 7 && (
          <View style={[w.bottomNav, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Pressable
              onPress={handleNext}
              disabled={!canContinue()}
              style={[
                w.nextBtn,
                { backgroundColor: canContinue() ? '#1E4D2B' : c.elevated },
                !canContinue() && { opacity: 0.5 },
              ]}
            >
              <Text
                style={[
                  w.nextBtnText,
                  { color: canContinue() ? '#C9A227' : c.textMuted, fontFamily: GEO },
                ]}
              >
                Continue
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={canContinue() ? '#C9A227' : c.textMuted}
              />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const w = StyleSheet.create({
  screen: { flex: 1 },

  /* Wizard header */
  wizHeader: {
    paddingTop: STATUS_BAR_H,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  wizHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wizHeaderTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
  },
  progressFill: {
    height: 3,
    backgroundColor: '#C9A227',
  },

  /* Step body */
  stepBody: { paddingHorizontal: 16, paddingTop: 8 },

  /* Welcome */
  welcomeScreen: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  welcomeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  welcomeTrophy: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 6,
  },
  dividerRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
    marginBottom: 12,
  },
  dividerLine: {
    width: 40,
    height: 3,
  },
  welcomeSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: 32,
    letterSpacing: 1,
  },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 40,
  },
  featurePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  featurePillText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  beginBtn: {
    overflow: 'hidden',
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  beginBtnText: {
    color: '#C9A227',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
  },
  timeNote: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 12,
  },

  /* Shared controls */
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  quickFillScroll: { gap: 8, marginTop: 8, paddingRight: 16 },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  quickChipText: { fontSize: 12, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateTo: { fontSize: 12 },

  /* Rounds */
  roundsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roundPill: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  roundPillText: { fontSize: 18, fontWeight: '700', letterSpacing: -1 },

  /* Teams */
  teamSizeRow: { flexDirection: 'row', gap: 8 },
  teamSizeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  teamSizeNum: { fontSize: 24, fontWeight: '700', letterSpacing: -1 },
  teamSizeLabel: { fontSize: 10, marginTop: 2 },
  adaptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  adaptText: { fontSize: 12, fontWeight: '600', flex: 1 },
  winRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  radio: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: { width: 8, height: 8, borderRadius: 0, backgroundColor: '#fff' },
  winLabel: { fontSize: 14, fontWeight: '600' },
  winDesc: { fontSize: 11, marginTop: 2 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  stepperLabel: { fontSize: 14 },
  stepperBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepperVal: { fontSize: 24, fontWeight: '700', minWidth: 40, textAlign: 'center', letterSpacing: -1 },
  scoreExplain: {
    flexDirection: 'row',
    borderWidth: 1,
    padding: 16,
    justifyContent: 'space-around',
  },
  scoreExplainItem: { alignItems: 'center' },
  scoreExplainPts: { fontSize: 24, fontWeight: '700', letterSpacing: -1 },
  scoreExplainLabel: { fontSize: 10, marginTop: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDesc: { fontSize: 11, marginTop: 2 },
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
  totalPtsBox: {
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  totalPtsLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 2 },
  totalPtsVal: { fontSize: 32, fontWeight: '700', marginTop: 4, letterSpacing: -1 },

  /* Courses */
  emptyText: { fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  courseName: { fontSize: 14, fontWeight: '600' },
  courseCity: { fontSize: 11, marginTop: 1 },
  addCourseRow: { flexDirection: 'row', gap: 8 },
  addCourseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Schedule */
  rcFormatBtn: {
    overflow: 'hidden',
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  rcFormatBtnText: {
    color: '#C9A227',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  rcFormatBtnSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 4,
  },
  sessionCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sessionTitle: { fontSize: 15, fontWeight: '700' },
  sessionSubLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 10,
    marginBottom: 6,
  },
  formatPillScroll: { gap: 6 },
  fmtPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  fmtPillText: { fontSize: 12, fontWeight: '600' },
  holeToggleRow: { flexDirection: 'row', gap: 6 },
  holePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  holePillText: { fontSize: 12, fontWeight: '600' },
  sessionPtsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sessionPtsLabel: { fontSize: 11 },
  sessionPtsVal: { fontSize: 18, fontWeight: '700', letterSpacing: -1 },
  addSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  addSessionText: { fontSize: 13, fontWeight: '600' },

  /* Formation */
  formationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  formationLabel: { fontSize: 14, fontWeight: '600' },
  formationDesc: { fontSize: 11, marginTop: 2 },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  teamColorBar: {
    width: 6,
    height: 44,
  },
  teamNameInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderLeftWidth: 0,
  },
  sideGameWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sideGamePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  sideGamePillText: { fontSize: 12, fontWeight: '600' },

  /* Players */
  playerTracker: {
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  trackerLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 2 },
  trackerCount: { fontSize: 32, fontWeight: '700', marginTop: 4, letterSpacing: -1 },
  trackerNeeded: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  playerName: { fontSize: 13, fontWeight: '600' },
  playerHcp: { fontSize: 10, marginTop: 1 },
  addForm: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  addFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  addCancelText: { fontSize: 13, paddingVertical: 8, paddingHorizontal: 16 },
  addDoneBtn: { paddingHorizontal: 20, paddingVertical: 8 },
  addDoneBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  addPlayerText: { fontSize: 13, fontWeight: '600' },

  /* Review */
  reviewHero: {
    overflow: 'hidden',
    padding: 24,
    marginTop: 8,
  },
  reviewHeroContent: {
    alignItems: 'center',
  },
  reviewVsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  reviewTeamSide: {
    alignItems: 'center',
    gap: 6,
  },
  reviewTeamDot: {
    width: 14,
    height: 14,
    borderRadius: 0,
  },
  reviewTeamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  reviewVs: {
    color: '#C9A227',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -1,
  },
  reviewCupName: {
    color: '#C9A227',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 12,
  },
  configTable: {
    borderWidth: 1,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  configLabel: { fontSize: 12 },
  configVal: { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 12 },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
  },
  scheduleNum: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleNumText: { fontSize: 14, fontWeight: '700' },
  scheduleFormat: { fontSize: 14, fontWeight: '600' },
  scheduleMeta: { fontSize: 11, marginTop: 2 },
  launchBtn: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    marginTop: 24,
  },
  launchBtnText: {
    color: '#C9A227',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },

  /* Bottom nav */
  bottomNav: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    borderTopWidth: 1,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
