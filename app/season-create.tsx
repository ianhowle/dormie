import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  StatusBar,
  Switch,
  FlatList,
  Dimensions,
  Share,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import GoldDivider from '../src/components/GoldDivider';
import { useAuth } from '../src/lib/auth';
import { seasonsService } from '../src/services/seasons.service';
import { haptics } from '../src/lib/haptics';
import { useToast } from '../src/components/Toast';
import { BracketPreview } from '../src/components/BracketView';
import {
  type BracketSize,
  type BracketSeedingMethod,
  type BracketFormat,
  type BracketScoringMethod,
  getBracketRounds,
  getBracketRoundLabel,
  generateBracketMatches,
} from '../src/data/seasons-detail';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;
const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────
type SeasonType = 'fedex' | 'ryder' | 'bracket' | 'stroke_series' | 'league' | 'custom';
type ScoringMethod = 'position' | 'stableford';

type LengthPreset = {
  key: string;
  label: string;
  description: string;
  regular: number;
  playoff: number;
  total: number;
};

type CutOption = {
  label: string;
  value: number;
};

type WeekConfig = {
  number: number;
  format: string;
  isMajor: boolean;
  majorName: string;
  isPlayoff: boolean;
  isChampionship: boolean;
  multiplier: number;
};

type Friend = {
  id: string;
  name: string;
  handicap: number;
  avatarColor: string;
};

type ManualPlayer = {
  id: string;
  name: string;
  handicap: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────
const LENGTH_PRESETS: LengthPreset[] = [
  { key: 'sprint', label: 'Sprint', description: '4 regular + 2 playoff', regular: 4, playoff: 2, total: 6 },
  { key: 'standard', label: 'Standard', description: '8 regular + 2 playoff', regular: 8, playoff: 2, total: 10 },
  { key: 'full', label: 'Full', description: '12 regular + 3 playoff', regular: 12, playoff: 3, total: 15 },
  { key: 'marathon', label: 'Marathon', description: '16 regular + 4 playoff', regular: 16, playoff: 4, total: 20 },
];

const FORMAT_CYCLE = [
  'stableford', 'modified_stableford', 'stroke_net', 'stroke_gross',
  'quota', 'best9', 'match_play', 'nassau', 'skins', 'best_ball',
  'scramble', 'chapman',
];
const FORMAT_LABELS: Record<string, string> = {
  stableford: 'Stableford',
  modified_stableford: 'Mod. Stableford',
  stroke_net: 'Stroke (Net)',
  stroke_gross: 'Stroke (Gross)',
  quota: 'Quota',
  best9: 'Best 9',
  match_play: 'Match Play',
  nassau: 'Nassau',
  skins: 'Skins',
  best_ball: 'Best Ball',
  scramble: 'Scramble',
  chapman: 'Chapman',
};

const ALL_FORMATS = [
  'stableford', 'modified_stableford', 'stroke_net', 'stroke_gross',
  'quota', 'best9', 'match_play', 'nassau', 'skins', 'best_ball',
  'scramble', 'chapman',
];

const POINTS_TABLE = [15, 12, 10, 8, 6, 5, 4, 3, 2, 1];

const CUT_OPTIONS: CutOption[] = [
  { label: '25%', value: 0.25 },
  { label: '33%', value: 0.33 },
  { label: '50%', value: 0.50 },
  { label: '67%', value: 0.67 },
  { label: '75%', value: 0.75 },
];

const SUGGESTED_COURSES_FLAT = [
  { id: 'sc1', name: 'TPC Scottsdale' },
  { id: 'mb1', name: 'TPC Myrtle Beach' },
  { id: 'bd1', name: 'Bandon Dunes' },
  { id: 'ph1', name: 'Pinehurst No. 2' },
  { id: 'pb1', name: 'Pebble Beach Golf Links' },
  { id: 'sc2', name: 'We-Ko-Pa Saguaro' },
];

const DEFAULT_MAJOR_NAMES = ['The Dormie Invitational', 'The Dormie Championship'];

const MOCK_FRIENDS: Friend[] = [
  { id: '2', name: 'Drew Patterson', handicap: 12, avatarColor: '#C9A227' },
  { id: '3', name: 'Jake Sullivan', handicap: 15, avatarColor: '#C41E3A' },
  { id: '4', name: 'Tommy Fleetwood', handicap: 3, avatarColor: '#6B8E23' },
  { id: '5', name: 'Mike Chen', handicap: 18, avatarColor: '#8B4513' },
  { id: '6', name: 'Sam Rodriguez', handicap: 22, avatarColor: '#4682B4' },
  { id: '7', name: 'Will Harrison', handicap: 25, avatarColor: '#9370DB' },
  { id: '8', name: 'Chris Lee', handicap: 28, avatarColor: '#20B2AA' },
];

// ─── Step definitions ─────────────────────────────────────────────────
type Step = 'basics' | 'format' | 'rules' | 'majors' | 'members' | 'review'
  | 'rc_team_setup' | 'rc_match_format' | 'rc_members' | 'rc_review'
  | 'bracket_setup' | 'bracket_rules' | 'bracket_members' | 'bracket_review'
  | 'stroke_format' | 'stroke_policies' | 'stroke_members' | 'stroke_review'
  | 'league_structure' | 'league_schedule' | 'league_scoring' | 'league_members' | 'league_review'
  | 'custom_structure' | 'custom_length' | 'custom_scoring' | 'custom_rules' | 'custom_bonuses';

type CustomBaseFormat = 'individual' | 'teams' | 'h2h' | 'bracket';
type CustomTeamFormation = 'auto_balance' | 'snake_draft' | 'captains_pick' | 'manual';
type CustomTeamScoring = 'combined' | 'match_play' | 'best_x_of_y';
type CustomSeedingMethod = 'handicap' | 'qualifying' | 'random';
type CustomElimination = 'single' | 'double';

const FEDEX_STEPS: Step[] = ['basics', 'format', 'rules', 'majors', 'members', 'review'];
const RYDER_STEPS: Step[] = ['basics', 'rc_members', 'rc_team_setup', 'rc_match_format', 'rc_review'];
const BRACKET_STEPS: Step[] = ['basics', 'bracket_setup', 'bracket_rules', 'bracket_members', 'bracket_review'];
const STROKE_STEPS: Step[] = ['basics', 'stroke_format', 'stroke_policies', 'stroke_members', 'stroke_review'];
const LEAGUE_STEPS: Step[] = ['basics', 'league_structure', 'league_schedule', 'league_scoring', 'league_members', 'league_review'];
const CUSTOM_STEPS: Step[] = ['basics', 'custom_structure', 'custom_length', 'custom_scoring', 'custom_rules', 'custom_bonuses', 'members', 'review'];

function getStepsForType(type: SeasonType): Step[] {
  switch (type) {
    case 'ryder': return RYDER_STEPS;
    case 'bracket': return BRACKET_STEPS;
    case 'stroke_series': return STROKE_STEPS;
    case 'league': return LEAGUE_STEPS;
    case 'custom': return CUSTOM_STEPS;
    default: return FEDEX_STEPS;
  }
}

const STEP_TITLES: Record<Step, string> = {
  basics: 'Season Basics',
  format: 'Format & Length',
  rules: 'Rules & Scoring',
  majors: 'Majors',
  members: 'Members',
  review: 'Review',
  rc_team_setup: 'Team Setup',
  rc_match_format: 'Match Format',
  rc_members: 'Members',
  rc_review: 'Review',
  bracket_setup: 'Bracket Setup',
  bracket_rules: 'Match Rules',
  bracket_members: 'Members',
  bracket_review: 'Review',
  stroke_format: 'Format & Length',
  stroke_policies: 'Round Policies',
  stroke_members: 'Members',
  stroke_review: 'Review',
  league_structure: 'League Structure',
  league_schedule: 'Schedule',
  league_scoring: 'Scoring & Playoffs',
  league_members: 'Members',
  league_review: 'Review',
  custom_structure: 'Competition Structure',
  custom_length: 'Season Length',
  custom_scoring: 'Scoring',
  custom_rules: 'Rules',
  custom_bonuses: 'Bonuses',
};

// ─── Pill Selector ────────────────────────────────────────────────────
function PillRow<T extends string>({
  options,
  selected,
  onSelect,
  labels,
  colors: c,
  accentColor,
}: {
  options: T[];
  selected: T;
  onSelect: (v: T) => void;
  labels: Record<T, string>;
  colors: any;
  accentColor?: string;
}) {
  const accent = accentColor ?? c.teal;
  return (
    <View style={styles.pillRow}>
      {options.map((opt) => {
        const active = opt === selected;
        return (
          <Pressable
            key={opt}
            onPress={() => { haptics.light(); onSelect(opt); }}
            style={[styles.pill, { backgroundColor: active ? accent + '22' : c.elevated, borderColor: active ? accent : 'transparent', borderWidth: 1 }]}
          >
            <Text style={[styles.pillText, { color: active ? accent : c.textMuted }]}>
              {labels[opt]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Step: Basics ─────────────────────────────────────────────────────
function BasicsStep({
  name,
  setName,
  seasonType,
  setSeasonType,
  customDescription,
  setCustomDescription,
}: {
  name: string;
  setName: (v: string) => void;
  seasonType: SeasonType;
  setSeasonType: (v: SeasonType) => void;
  customDescription?: string;
  setCustomDescription?: (v: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const inputBg = theme.isDark ? c.elevated : '#FFFFFF';
  const [nameFocused, setNameFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [expandedInfo, setExpandedInfo] = useState<SeasonType | null>(null);

  const SEASON_TYPES: { key: SeasonType; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; desc: string; whatsThis: string }[] = [
    { key: 'fedex', icon: 'trophy-outline', label: 'FedEx Cup', desc: 'Individual points race with playoffs', whatsThis: 'Players earn points each week based on finish position. Top players advance to playoffs with bonus multipliers.' },
    { key: 'ryder', icon: 'people-outline', label: 'Ryder Cup', desc: 'Team competition (red vs blue)', whatsThis: 'Two teams compete in foursomes, four-ball, and singles matches. Captains draft players and set pairings.' },
    { key: 'bracket', icon: 'git-merge-outline', label: 'Match Play Bracket', desc: 'Single elimination tournament', whatsThis: 'Players face off head-to-head in a seeded bracket. Lose and you\'re out — last one standing wins.' },
    { key: 'stroke_series', icon: 'document-text-outline', label: 'Stroke Play Series', desc: 'Cumulative strokes, lowest total wins', whatsThis: 'A multi-round series where cumulative stroke totals determine the winner. Option to drop your worst round.' },
    { key: 'league', icon: 'people-outline', label: 'League', desc: 'Weekly matchups, divisions, playoffs', whatsThis: 'Fantasy football style league with divisions and weekly head-to-head matchups. Play division rivals and cross-division opponents across the season.' },
    { key: 'custom', icon: 'settings-outline', label: 'Custom', desc: 'Build your own rules', whatsThis: 'Full control over format, scoring, and structure. Mix and match any combination of rules.' },
  ];

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>Season Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={seasonType === 'custom' ? 'Enter season name' : seasonType === 'bracket' ? 'Match Play Championship \u2014 Spring 2026' : seasonType === 'stroke_series' ? 'Stroke Play Championship \u2014 Spring 2026' : seasonType === 'league' ? 'Dormie League \u2014 Spring 2026' : 'e.g., 2026 FedEx Cup'}
        placeholderTextColor={c.textMuted}
        onFocus={() => setNameFocused(true)}
        onBlur={() => setNameFocused(false)}
        style={[styles.input, { backgroundColor: inputBg, color: c.text, borderColor: nameFocused ? '#C9A227' : c.border }]}
      />

      {seasonType === 'custom' && setCustomDescription && (
        <>
          <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Season Description</Text>
          <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 8 }]}>
            Describe any special rules for your group
          </Text>
          <TextInput
            value={customDescription ?? ''}
            onChangeText={setCustomDescription}
            placeholder="Optional rules, notes, or description..."
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={500}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
            style={[
              styles.input,
              {
                backgroundColor: inputBg,
                color: c.text,
                borderColor: descFocused ? '#C9A227' : c.border,
                minHeight: 80,
                textAlignVertical: 'top',
                paddingTop: 12,
              },
            ]}
          />
          <Text style={[styles.fieldDesc, { color: c.textMuted, marginTop: 4, textAlign: 'right' }]}>
            {(customDescription ?? '').length}/500
          </Text>
        </>
      )}

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Season Type</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        Choose how your group competes.
      </Text>
      <View style={styles.typeGrid}>
        {SEASON_TYPES.map((t, idx) => {
          const isSelected = seasonType === t.key;
          const isLast = idx === SEASON_TYPES.length - 1;
          const isOddLast = isLast && SEASON_TYPES.length % 2 === 1;
          return (
            <Pressable
              key={t.key}
              onPress={() => { haptics.light(); setSeasonType(t.key); }}
              style={[
                styles.typeGridCard,
                isOddLast ? styles.typeGridCardFull : styles.typeGridCardHalf,
                {
                  backgroundColor: isSelected ? '#1A1816' : (theme.isDark ? c.surface : c.cardBg),
                  borderColor: isSelected ? '#C9A227' : 'rgba(255,255,255,0.08)',
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              <Ionicons
                name={t.icon}
                size={28}
                color={isSelected ? '#C9A227' : c.textMuted}
              />
              <Text style={[styles.typeGridLabel, { color: isSelected ? '#C9A227' : c.text }]}>
                {t.label}
              </Text>
              <Text style={[styles.typeGridDesc, { color: c.textMuted }]} numberOfLines={2}>{t.desc}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step: Custom Structure ──────────────────────────────────────────
function CustomStructureStep({
  baseFormat,
  setBaseFormat,
  teamCount,
  setTeamCount,
  teamFormation,
  setTeamFormation,
  teamScoring,
  setTeamScoring,
  bestX,
  setBestX,
  bestY,
  setBestY,
  divisions,
  setDivisions,
  divisionCount,
  setDivisionCount,
  crossDivision,
  setCrossDivision,
  cBracketSize,
  setCBracketSize,
  seeding,
  setSeeding,
  elimination,
  setElimination,
}: {
  baseFormat: CustomBaseFormat;
  setBaseFormat: (v: CustomBaseFormat) => void;
  teamCount: 2 | 3 | 4;
  setTeamCount: (v: 2 | 3 | 4) => void;
  teamFormation: CustomTeamFormation;
  setTeamFormation: (v: CustomTeamFormation) => void;
  teamScoring: CustomTeamScoring;
  setTeamScoring: (v: CustomTeamScoring) => void;
  bestX: number;
  setBestX: (v: number) => void;
  bestY: number;
  setBestY: (v: number) => void;
  divisions: boolean;
  setDivisions: (v: boolean) => void;
  divisionCount: 2 | 3 | 4;
  setDivisionCount: (v: 2 | 3 | 4) => void;
  crossDivision: boolean;
  setCrossDivision: (v: boolean) => void;
  cBracketSize: 4 | 8 | 16 | 32;
  setCBracketSize: (v: 4 | 8 | 16 | 32) => void;
  seeding: CustomSeedingMethod;
  setSeeding: (v: CustomSeedingMethod) => void;
  elimination: CustomElimination;
  setElimination: (v: CustomElimination) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const cardBgVal = theme.isDark ? c.elevated : c.cardBg;

  const BASE_FORMATS: { key: CustomBaseFormat; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; desc: string }[] = [
    { key: 'individual', icon: 'trophy-outline', label: 'Individual', desc: 'Everyone vs the field' },
    { key: 'teams', icon: 'people-outline', label: 'Teams', desc: '2-4 teams compete' },
    { key: 'h2h', icon: 'swap-horizontal-outline', label: 'Head-to-Head', desc: 'Weekly 1v1 matchups with W/L record' },
    { key: 'bracket', icon: 'git-merge-outline', label: 'Bracket', desc: 'Elimination tournament' },
  ];

  const TEAM_COUNTS: (2 | 3 | 4)[] = [2, 3, 4];

  const TEAM_FORMATIONS: { key: CustomTeamFormation; label: string }[] = [
    { key: 'auto_balance', label: 'Auto-balance by handicap' },
    { key: 'snake_draft', label: 'Snake Draft' },
    { key: 'captains_pick', label: "Captain's Pick" },
    { key: 'manual', label: 'Manual assignment' },
  ];

  const TEAM_SCORINGS: { key: CustomTeamScoring; label: string }[] = [
    { key: 'combined', label: 'Combined points (sum all players)' },
    { key: 'match_play', label: 'Match play (team vs team matches)' },
    { key: 'best_x_of_y', label: 'Best X of Y' },
  ];

  const BRACKET_SIZES: (4 | 8 | 16 | 32)[] = [4, 8, 16, 32];

  const SEEDING_METHODS: { key: CustomSeedingMethod; label: string }[] = [
    { key: 'handicap', label: 'By Handicap' },
    { key: 'qualifying', label: 'Qualifying Round' },
    { key: 'random', label: 'Random' },
  ];

  return (
    <View style={styles.stepContent}>
      {/* Base Format */}
      <Text style={[styles.fieldLabel, { color: c.text }]}>Base Format</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        How does the competition work?
      </Text>
      <View style={{ gap: 8 }}>
        {BASE_FORMATS.map((fmt) => {
          const isSelected = baseFormat === fmt.key;
          return (
            <Pressable
              key={fmt.key}
              onPress={() => { haptics.light(); setBaseFormat(fmt.key); }}
              style={[
                styles.customFormatCard,
                {
                  backgroundColor: isSelected ? c.teal + '12' : cardBgVal,
                  borderColor: isSelected ? c.teal : c.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              <Ionicons
                name={fmt.icon}
                size={24}
                color={isSelected ? c.teal : c.textMuted}
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.customFormatLabel, { color: isSelected ? c.teal : c.text }]}>
                  {fmt.label}
                </Text>
                <Text style={[styles.customFormatDesc, { color: c.textMuted }]}>
                  {fmt.desc}
                </Text>
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={22} color={c.teal} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Teams sub-options */}
      {baseFormat === 'teams' && (
        <View style={{ marginTop: 20 }}>
          <Text style={[styles.fieldLabel, { color: c.text }]}>Number of Teams</Text>
          <View style={styles.pillRow}>
            {TEAM_COUNTS.map((n) => {
              const active = teamCount === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => { haptics.light(); setTeamCount(n); }}
                  style={[styles.pill, { backgroundColor: active ? c.teal + '22' : c.elevated, borderColor: active ? c.teal : 'transparent', borderWidth: 1 }]}
                >
                  <Text style={[styles.pillText, { color: active ? c.teal : c.textMuted }]}>
                    {n} teams
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: c.text, marginTop: 16 }]}>Team Formation</Text>
          {TEAM_FORMATIONS.map((f) => {
            const active = teamFormation === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => { haptics.light(); setTeamFormation(f.key); }}
                style={[styles.customRadioRow, { borderBottomColor: c.border }]}
              >
                <View style={[styles.customRadioOuter, { borderColor: active ? c.teal : c.textMuted }]}>
                  {active && <View style={[styles.customRadioInner, { backgroundColor: c.teal }]} />}
                </View>
                <Text style={[styles.customRadioLabel, { color: active ? c.teal : c.text }]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}

          <Text style={[styles.fieldLabel, { color: c.text, marginTop: 16 }]}>Team Scoring</Text>
          {TEAM_SCORINGS.map((s) => {
            const active = teamScoring === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => { haptics.light(); setTeamScoring(s.key); }}
                style={[styles.customRadioRow, { borderBottomColor: c.border }]}
              >
                <View style={[styles.customRadioOuter, { borderColor: active ? c.teal : c.textMuted }]}>
                  {active && <View style={[styles.customRadioInner, { backgroundColor: c.teal }]} />}
                </View>
                <Text style={[styles.customRadioLabel, { color: active ? c.teal : c.text }]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}

          {teamScoring === 'best_x_of_y' && (
            <View style={[styles.bestXYRow, { backgroundColor: c.elevated }]}>
              <Text style={[styles.bestXYLabel, { color: c.text }]}>Best</Text>
              <View style={styles.stepperRow}>
                <Pressable onPress={() => { haptics.light(); setBestX(Math.max(1, bestX - 1)); }} style={[styles.stepperBtn, { backgroundColor: c.surface ?? c.cardBg }]}>
                  <Ionicons name="remove" size={16} color={c.textMuted} />
                </Pressable>
                <Text style={[styles.stepperVal, { color: c.gold, fontFamily: GEO }]}>{bestX}</Text>
                <Pressable onPress={() => { haptics.light(); setBestX(Math.min(bestY - 1, bestX + 1)); }} style={[styles.stepperBtn, { backgroundColor: c.surface ?? c.cardBg }]}>
                  <Ionicons name="add" size={16} color={c.textMuted} />
                </Pressable>
              </View>
              <Text style={[styles.bestXYLabel, { color: c.text }]}>of</Text>
              <View style={styles.stepperRow}>
                <Pressable onPress={() => { haptics.light(); setBestY(Math.max(bestX + 1, bestY - 1)); }} style={[styles.stepperBtn, { backgroundColor: c.surface ?? c.cardBg }]}>
                  <Ionicons name="remove" size={16} color={c.textMuted} />
                </Pressable>
                <Text style={[styles.stepperVal, { color: c.gold, fontFamily: GEO }]}>{bestY}</Text>
                <Pressable onPress={() => { haptics.light(); setBestY(bestY + 1); }} style={[styles.stepperBtn, { backgroundColor: c.surface ?? c.cardBg }]}>
                  <Ionicons name="add" size={16} color={c.textMuted} />
                </Pressable>
              </View>
              <Text style={[styles.bestXYLabel, { color: c.textMuted }]}>scores</Text>
            </View>
          )}
        </View>
      )}

      {/* Head-to-Head sub-options */}
      {baseFormat === 'h2h' && (
        <View style={{ marginTop: 20 }}>
          <View style={[styles.explanationCard, { backgroundColor: c.elevated, borderColor: c.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={c.teal} />
            <Text style={{ flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 18 }}>
              Creates a fantasy football style league
            </Text>
          </View>

          <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ruleLabel, { color: c.text }]}>Enable Divisions</Text>
            </View>
            <Switch
              value={divisions}
              onValueChange={setDivisions}
              trackColor={{ false: c.elevated, true: c.teal + '66' }}
              thumbColor={divisions ? c.teal : c.textMuted}
            />
          </View>

          {divisions && (
            <>
              <Text style={[styles.fieldLabel, { color: c.text, marginTop: 12 }]}>Number of Divisions</Text>
              <View style={styles.pillRow}>
                {([2, 3, 4] as const).map((n) => {
                  const active = divisionCount === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => { haptics.light(); setDivisionCount(n); }}
                      style={[styles.pill, { backgroundColor: active ? c.teal + '22' : c.elevated, borderColor: active ? c.teal : 'transparent', borderWidth: 1 }]}
                    >
                      <Text style={[styles.pillText, { color: active ? c.teal : c.textMuted }]}>
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ruleLabel, { color: c.text }]}>Cross-Division Games</Text>
                </View>
                <Switch
                  value={crossDivision}
                  onValueChange={setCrossDivision}
                  trackColor={{ false: c.elevated, true: c.teal + '66' }}
                  thumbColor={crossDivision ? c.teal : c.textMuted}
                />
              </View>
            </>
          )}
        </View>
      )}

      {/* Bracket sub-options */}
      {baseFormat === 'bracket' && (
        <View style={{ marginTop: 20 }}>
          <Text style={[styles.fieldLabel, { color: c.text }]}>Bracket Size</Text>
          <View style={styles.pillRow}>
            {BRACKET_SIZES.map((n) => {
              const active = cBracketSize === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => { haptics.light(); setCBracketSize(n); }}
                  style={[styles.pill, { backgroundColor: active ? c.teal + '22' : c.elevated, borderColor: active ? c.teal : 'transparent', borderWidth: 1 }]}
                >
                  <Text style={[styles.pillText, { color: active ? c.teal : c.textMuted }]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: c.text, marginTop: 16 }]}>Seeding Method</Text>
          {SEEDING_METHODS.map((s) => {
            const active = seeding === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => { haptics.light(); setSeeding(s.key); }}
                style={[styles.customRadioRow, { borderBottomColor: c.border }]}
              >
                <View style={[styles.customRadioOuter, { borderColor: active ? c.teal : c.textMuted }]}>
                  {active && <View style={[styles.customRadioInner, { backgroundColor: c.teal }]} />}
                </View>
                <Text style={[styles.customRadioLabel, { color: active ? c.teal : c.text }]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}

          <Text style={[styles.fieldLabel, { color: c.text, marginTop: 16 }]}>Format</Text>
          {(['single', 'double'] as CustomElimination[]).map((e) => {
            const active = elimination === e;
            return (
              <Pressable
                key={e}
                onPress={() => { haptics.light(); setElimination(e); }}
                style={[styles.customRadioRow, { borderBottomColor: c.border }]}
              >
                <View style={[styles.customRadioOuter, { borderColor: active ? c.teal : c.textMuted }]}>
                  {active && <View style={[styles.customRadioInner, { backgroundColor: c.teal }]} />}
                </View>
                <Text style={[styles.customRadioLabel, { color: active ? c.teal : c.text }]}>
                  {e === 'single' ? 'Single Elimination' : 'Double Elimination'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Step: Format ─────────────────────────────────────────────────────
function FormatStep({
  preset,
  setPreset,
  scoringMethod,
  setScoringMethod,
  useCustomCycle,
  setUseCustomCycle,
  customCycle,
  setCustomCycle,
}: {
  preset: string;
  setPreset: (v: string) => void;
  scoringMethod: ScoringMethod;
  setScoringMethod: (v: ScoringMethod) => void;
  useCustomCycle: boolean;
  setUseCustomCycle: (v: boolean) => void;
  customCycle: Record<number, string>;
  setCustomCycle: (v: Record<number, string>) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const cardBgVal = theme.isDark ? c.elevated : c.cardBg;
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const presetData = LENGTH_PRESETS.find((p) => p.key === preset)!;
  const totalWeeks = presetData.total;

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>Season Length</Text>
      {LENGTH_PRESETS.map((p) => (
        <Pressable
          key={p.key}
          onPress={() => { haptics.light(); setPreset(p.key); }}
          style={[
            styles.presetCard,
            {
              backgroundColor: preset === p.key ? c.teal + '12' : cardBgVal,
              borderColor: preset === p.key ? c.teal : c.border,
              borderWidth: 1,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.presetLabel, { color: preset === p.key ? c.teal : c.text }]}>
              {p.label}
            </Text>
            <Text style={[styles.presetDesc, { color: c.textMuted }]}>{p.description}</Text>
          </View>
          <Text style={[styles.presetTotal, { color: c.textMuted, fontFamily: GEO }]}>
            {p.total} wks
          </Text>
        </Pressable>
      ))}

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Scoring Method</Text>
      <PillRow
        options={['position', 'stableford'] as ScoringMethod[]}
        selected={scoringMethod}
        onSelect={setScoringMethod}
        labels={{ position: 'Position Points', stableford: 'Raw Stableford' }}
        colors={c}
      />

      {scoringMethod === 'position' && (
        <View style={[styles.pointsPreview, { backgroundColor: c.elevated }]}>
          <Text style={[styles.pointsPreviewTitle, { color: c.textMuted }]}>POINTS TABLE</Text>
          <View style={styles.pointsRow}>
            {POINTS_TABLE.map((pts, i) => (
              <View key={i} style={styles.pointsCell}>
                <Text style={[styles.pointsPos, { color: c.textMuted }]}>{i + 1}</Text>
                <Text style={[styles.pointsVal, { color: c.gold, fontFamily: GEO }]}>{pts}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Format Cycle</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        Formats rotate each week to keep competition fresh.
      </Text>

      {/* Cycle toggle */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>
            {useCustomCycle ? 'Create custom cycle' : 'Use suggested cycle'}
          </Text>
        </View>
        <Switch
          value={useCustomCycle}
          onValueChange={setUseCustomCycle}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={useCustomCycle ? c.teal : c.textMuted}
        />
      </View>

      {!useCustomCycle ? (
        <View style={[styles.cyclePrev, { backgroundColor: c.elevated }]}>
          {FORMAT_CYCLE.map((f, i) => (
            <View key={f} style={[styles.cycleItem, { borderBottomColor: c.border }]}>
              <Text style={[styles.cycleNum, { color: c.textMuted }]}>{i + 1}</Text>
              <Text style={[styles.cycleName, { color: c.text }]}>{FORMAT_LABELS[f]}</Text>
            </View>
          ))}
          <Text style={[styles.cycleNote, { color: c.textMuted }]}>Repeats through the season</Text>
        </View>
      ) : (
        <View style={[styles.cyclePrev, { backgroundColor: c.elevated }]}>
          {Array.from({ length: totalWeeks }, (_, i) => {
            const weekNum = i + 1;
            const currentFormat = customCycle[weekNum] ?? FORMAT_CYCLE[i % FORMAT_CYCLE.length];
            const isExpanded = expandedWeek === weekNum;
            return (
              <View key={weekNum}>
                <Pressable
                  onPress={() => { haptics.light(); setExpandedWeek(isExpanded ? null : weekNum); }}
                  style={[styles.cycleItem, { borderBottomColor: c.border }]}
                >
                  <Text style={[styles.cycleNum, { color: c.textMuted, fontFamily: GEO }]}>{weekNum}</Text>
                  <Text style={[styles.cycleName, { color: c.text, flex: 1 }]}>{FORMAT_LABELS[currentFormat] ?? currentFormat}</Text>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={c.textMuted} />
                </Pressable>
                {isExpanded && (
                  <View style={styles.formatPicker}>
                    {ALL_FORMATS.map((fmt) => (
                      <Pressable
                        key={fmt}
                        onPress={() => {
                          haptics.light();
                          setCustomCycle({ ...customCycle, [weekNum]: fmt });
                          setExpandedWeek(null);
                        }}
                        style={[
                          styles.formatPickerItem,
                          {
                            backgroundColor: currentFormat === fmt ? c.teal + '18' : 'transparent',
                            borderColor: currentFormat === fmt ? c.teal : c.border,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text style={[styles.formatPickerText, { color: currentFormat === fmt ? c.teal : c.text }]}>
                          {FORMAT_LABELS[fmt]}
                        </Text>
                        {currentFormat === fmt && <Ionicons name="checkmark" size={16} color={c.teal} />}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Step: Rules ──────────────────────────────────────────────────────
function RulesStep({
  cutEnabled,
  setCutEnabled,
  cutValue,
  setCutValue,
  dropWorst,
  setDropWorst,
  dnsAveraging,
  setDnsAveraging,
  dnsMinRounds,
  setDnsMinRounds,
  dnsCap,
  setDnsCap,
  playoffMultiplier,
  setPlayoffMultiplier,
  champMultiplier,
  setChampMultiplier,
  makeupWindowEnabled,
  setMakeupWindowEnabled,
  makeupWindowWeeks,
  setMakeupWindowWeeks,
  dnsSafetyNet,
  setDnsSafetyNet,
  dnsSafetyMax,
  setDnsSafetyMax,
  multiRoundWeek,
  setMultiRoundWeek,
  roundsAllowed,
  setRoundsAllowed,
  bestRoundsCount,
  setBestRoundsCount,
  participationBonus,
  setParticipationBonus,
  participationPoints,
  setParticipationPoints,
}: {
  cutEnabled: boolean;
  setCutEnabled: (v: boolean) => void;
  cutValue: number;
  setCutValue: (v: number) => void;
  dropWorst: boolean;
  setDropWorst: (v: boolean) => void;
  dnsAveraging: boolean;
  setDnsAveraging: (v: boolean) => void;
  dnsMinRounds: number;
  setDnsMinRounds: (v: number) => void;
  dnsCap: number;
  setDnsCap: (v: number) => void;
  playoffMultiplier: number;
  setPlayoffMultiplier: (v: number) => void;
  champMultiplier: number;
  setChampMultiplier: (v: number) => void;
  makeupWindowEnabled: boolean;
  setMakeupWindowEnabled: (v: boolean) => void;
  makeupWindowWeeks: number;
  setMakeupWindowWeeks: (v: number) => void;
  dnsSafetyNet: boolean;
  setDnsSafetyNet: (v: boolean) => void;
  dnsSafetyMax: number;
  setDnsSafetyMax: (v: number) => void;
  multiRoundWeek: boolean;
  setMultiRoundWeek: (v: boolean) => void;
  roundsAllowed: number;
  setRoundsAllowed: (v: number) => void;
  bestRoundsCount: number;
  setBestRoundsCount: (v: number) => void;
  participationBonus: boolean;
  setParticipationBonus: (v: boolean) => void;
  participationPoints: number;
  setParticipationPoints: (v: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Cut line */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Playoff Cut Line</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Top percentage advances to playoffs
          </Text>
        </View>
        <Switch
          value={cutEnabled}
          onValueChange={setCutEnabled}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={cutEnabled ? c.teal : c.textMuted}
        />
      </View>

      {cutEnabled && (
        <View style={styles.cutOptions}>
          {CUT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.label}
              onPress={() => { haptics.light(); setCutValue(opt.value); }}
              style={[
                styles.cutPill,
                {
                  backgroundColor: cutValue === opt.value ? c.teal + '22' : c.elevated,
                  borderColor: cutValue === opt.value ? c.teal : 'transparent',
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.cutPillText, { color: cutValue === opt.value ? c.teal : c.textMuted }]}>
                Top {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Drop worst */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Drop Worst Week</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Lowest-scoring regular season week is dropped
          </Text>
        </View>
        <Switch
          value={dropWorst}
          onValueChange={setDropWorst}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={dropWorst ? c.teal : c.textMuted}
        />
      </View>
      {dropWorst && (
        <Text style={{ fontSize: 12, color: c.textMuted, fontStyle: 'italic', paddingHorizontal: 2, paddingTop: 6, paddingBottom: 4 }}>
          Your lowest-scoring regular season week is excluded from your point total before the playoff cut is applied. Playoff and Championship weeks cannot be dropped.
        </Text>
      )}

      {/* DNS averaging */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>DNS Averaging</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Missed weeks get average of played rounds (with cap)
          </Text>
        </View>
        <Switch
          value={dnsAveraging}
          onValueChange={setDnsAveraging}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={dnsAveraging ? c.teal : c.textMuted}
        />
      </View>

      {dnsAveraging && (
        <View style={[styles.dnsOptions, { backgroundColor: c.elevated }]}>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>Min rounds to qualify</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => { haptics.light(); setDnsMinRounds(Math.max(1, dnsMinRounds - 1)); }}>
                <Ionicons name="remove-circle-outline" size={24} color={c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{dnsMinRounds}</Text>
              <Pressable onPress={() => { haptics.light(); setDnsMinRounds(dnsMinRounds + 1); }}>
                <Ionicons name="add-circle-outline" size={24} color={c.teal} />
              </Pressable>
            </View>
          </View>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>DNS cap (max pts)</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => { haptics.light(); setDnsCap(Math.max(1, dnsCap - 1)); }}>
                <Ionicons name="remove-circle-outline" size={24} color={c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{dnsCap}</Text>
              <Pressable onPress={() => { haptics.light(); setDnsCap(dnsCap + 1); }}>
                <Ionicons name="add-circle-outline" size={24} color={c.teal} />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Makeup Window */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Makeup Window</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Allow late round submissions within a window
          </Text>
        </View>
        <Switch
          value={makeupWindowEnabled}
          onValueChange={setMakeupWindowEnabled}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={makeupWindowEnabled ? c.teal : c.textMuted}
        />
      </View>

      {makeupWindowEnabled && (
        <View style={[styles.dnsOptions, { backgroundColor: c.elevated }]}>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>Rounds can be submitted up to</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => { haptics.light(); setMakeupWindowWeeks(Math.max(1, makeupWindowWeeks - 1)); }}>
                <Ionicons name="remove-circle-outline" size={24} color={makeupWindowWeeks <= 1 ? c.border : c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{makeupWindowWeeks}</Text>
              <Pressable onPress={() => { haptics.light(); setMakeupWindowWeeks(Math.min(3, makeupWindowWeeks + 1)); }}>
                <Ionicons name="add-circle-outline" size={24} color={makeupWindowWeeks >= 3 ? c.border : c.teal} />
              </Pressable>
            </View>
          </View>
          <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>week{makeupWindowWeeks !== 1 ? 's' : ''} late</Text>
          <Text style={{ fontSize: 12, color: c.textMuted, fontStyle: 'italic', marginTop: 8 }}>
            Players can submit their round during the scheduled week or within the makeup window. After the window closes, the week becomes DNS.
          </Text>
        </View>
      )}

      {/* DNS Safety Net */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>DNS Safety Net</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Use season average at 50% value instead of zero for missed weeks
          </Text>
        </View>
        <Switch
          value={dnsSafetyNet}
          onValueChange={setDnsSafetyNet}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={dnsSafetyNet ? c.teal : c.textMuted}
        />
      </View>

      {dnsSafetyNet && (
        <View style={[styles.dnsOptions, { backgroundColor: c.elevated }]}>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>Max uses per season</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => { haptics.light(); setDnsSafetyMax(Math.max(1, dnsSafetyMax - 1)); }}>
                <Ionicons name="remove-circle-outline" size={24} color={dnsSafetyMax <= 1 ? c.border : c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{dnsSafetyMax}</Text>
              <Pressable onPress={() => { haptics.light(); setDnsSafetyMax(Math.min(3, dnsSafetyMax + 1)); }}>
                <Ionicons name="add-circle-outline" size={24} color={dnsSafetyMax >= 3 ? c.border : c.teal} />
              </Pressable>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: c.textMuted, fontStyle: 'italic', marginTop: 8 }}>
            Requires 3+ completed rounds to qualify. Limited uses prevent abuse.
          </Text>
        </View>
      )}

      {/* Multiple Rounds Per Week */}
      <GoldDivider style={{ marginTop: 16, marginBottom: 4 }} />
      <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Multiple Rounds Per Week</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Allow multiple rounds per week. Only your best scores count toward standings.
          </Text>
        </View>
        <Switch
          value={multiRoundWeek}
          onValueChange={setMultiRoundWeek}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={multiRoundWeek ? c.teal : c.textMuted}
        />
      </View>

      {multiRoundWeek && (
        <View style={[styles.dnsOptions, { backgroundColor: c.elevated }]}>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>Rounds allowed per week</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => { haptics.light(); const v = Math.max(2, roundsAllowed - 1); setRoundsAllowed(v); if (bestRoundsCount > v) setBestRoundsCount(v); }}>
                <Ionicons name="remove-circle-outline" size={24} color={roundsAllowed <= 2 ? c.border : c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{roundsAllowed}</Text>
              <Pressable onPress={() => { haptics.light(); setRoundsAllowed(Math.min(5, roundsAllowed + 1)); }}>
                <Ionicons name="add-circle-outline" size={24} color={roundsAllowed >= 5 ? c.border : c.teal} />
              </Pressable>
            </View>
          </View>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>Best rounds that count</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => { haptics.light(); setBestRoundsCount(Math.max(1, bestRoundsCount - 1)); }}>
                <Ionicons name="remove-circle-outline" size={24} color={bestRoundsCount <= 1 ? c.border : c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{bestRoundsCount}</Text>
              <Pressable onPress={() => { haptics.light(); setBestRoundsCount(Math.min(roundsAllowed, bestRoundsCount + 1)); }}>
                <Ionicons name="add-circle-outline" size={24} color={bestRoundsCount >= roundsAllowed ? c.border : c.teal} />
              </Pressable>
            </View>
          </View>
          <View style={[styles.explanationCard, { borderColor: c.teal + '33', backgroundColor: c.teal + '0A', marginTop: 8 }]}>
            <Ionicons name="golf-outline" size={16} color={c.teal} />
            <Text style={{ flex: 1, fontSize: 12, color: c.textMuted, lineHeight: 17 }}>
              Best {bestRoundsCount} of {roundsAllowed} — play up to {roundsAllowed} rounds, only your top {bestRoundsCount} count. Great for groups with unpredictable schedules.
            </Text>
          </View>
        </View>
      )}

      {/* Participation Bonus */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Participation Bonus</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Award bonus points just for showing up
          </Text>
        </View>
        <Switch
          value={participationBonus}
          onValueChange={setParticipationBonus}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={participationBonus ? c.teal : c.textMuted}
        />
      </View>

      {participationBonus && (
        <View style={[styles.dnsOptions, { backgroundColor: c.elevated }]}>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>Points per week</Text>
            <View style={styles.stepperRow}>
              {[25, 50, 75, 100].map((pts) => (
                <Pressable
                  key={pts}
                  onPress={() => { haptics.light(); setParticipationPoints(pts); }}
                  style={[
                    styles.cutPill,
                    {
                      backgroundColor: participationPoints === pts ? c.teal + '22' : 'transparent',
                      borderColor: participationPoints === pts ? c.teal : c.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[styles.cutPillText, { color: participationPoints === pts ? c.teal : c.textMuted }]}>
                    {pts}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Text style={{ fontSize: 12, color: c.textMuted, fontStyle: 'italic', marginTop: 8 }}>
            Rewards consistency and keeps everyone engaged, even players out of contention. Awarded for completing at least 1 round during the week.
          </Text>
        </View>
      )}

      {/* Multipliers */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Point Multipliers</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 12 }]}>
        Playoff and Championship weeks award bonus points. A 2× multiplier means all points earned that week are doubled.
      </Text>
      <View style={[styles.multiplierRow, { backgroundColor: c.elevated }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.multiplierLabel, { color: c.textMuted }]}>Playoff weeks</Text>
          <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>Semi-final and elimination rounds</Text>
        </View>
        <View style={styles.stepperRow}>
          <Pressable onPress={() => { haptics.light(); setPlayoffMultiplier(Math.max(2, playoffMultiplier - 0.5)); }}>
            <Ionicons name="remove-circle-outline" size={24} color={playoffMultiplier <= 2 ? c.border : 'rgba(255,255,255,0.4)'} />
          </Pressable>
          <Text style={[styles.stepperVal, { color: c.gold, fontFamily: GEO }]}>{playoffMultiplier}×</Text>
          <Pressable onPress={() => { haptics.light(); setPlayoffMultiplier(Math.min(3, playoffMultiplier + 0.5)); }}>
            <Ionicons name="add-circle-outline" size={24} color={playoffMultiplier >= 3 ? c.border : c.gold} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.multiplierRow, { backgroundColor: c.elevated }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.multiplierLabel, { color: c.textMuted }]}>Championship week</Text>
          <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>The final week — winner takes the season title</Text>
        </View>
        <View style={styles.stepperRow}>
          <Pressable onPress={() => { haptics.light(); setChampMultiplier(Math.max(2.5, champMultiplier - 0.5)); }}>
            <Ionicons name="remove-circle-outline" size={24} color={champMultiplier <= 2.5 ? c.border : 'rgba(255,255,255,0.4)'} />
          </Pressable>
          <Text style={[styles.stepperVal, { color: c.gold, fontFamily: GEO }]}>{champMultiplier}×</Text>
          <Pressable onPress={() => { haptics.light(); setChampMultiplier(Math.min(4, champMultiplier + 0.5)); }}>
            <Ionicons name="add-circle-outline" size={24} color={champMultiplier >= 4 ? c.border : c.gold} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Step: Majors ─────────────────────────────────────────────────────
function MajorsStep({
  weeks,
  setWeeks,
  preset,
}: {
  weeks: WeekConfig[];
  setWeeks: (w: WeekConfig[]) => void;
  preset: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const inputBg = theme.isDark ? c.elevated : '#FFFFFF';

  const maxMajors = (preset === 'full' || preset === 'marathon') ? 4 : 2;
  const regularWeeks = weeks.filter((w) => !w.isPlayoff && !w.isChampionship);
  const majorCount = regularWeeks.filter((w) => w.isMajor).length;

  const MAJOR_PLACEHOLDERS = [
    'e.g., The Dormie Masters',
    'e.g., The Dormie Open',
    'e.g., The Dormie Invitational',
    'e.g., The Dormie Championship',
  ];

  const toggleMajor = (weekNum: number) => {
    setWeeks(
      weeks.map((w) => {
        if (w.number !== weekNum) return w;
        if (w.isMajor) return { ...w, isMajor: false, majorName: '', multiplier: 1 };
        if (majorCount >= maxMajors) return w;
        const nameIdx = regularWeeks.filter((rw) => rw.isMajor).length;
        return {
          ...w,
          isMajor: true,
          majorName: DEFAULT_MAJOR_NAMES[nameIdx] ?? `Major ${nameIdx + 1}`,
          multiplier: 2,
        };
      })
    );
  };

  const updateMajorName = (weekNum: number, name: string) => {
    setWeeks(weeks.map((w) => (w.number === weekNum ? { ...w, majorName: name } : w)));
  };

  return (
    <View style={styles.stepContent}>
      {/* Explanation card */}
      <View style={[styles.explanationCard, { backgroundColor: c.gold + '12', borderColor: c.gold + '33' }]}>
        <Ionicons name="trophy" size={18} color={c.gold} />
        <Text style={{ fontSize: 13, color: c.textMuted, flex: 1 }}>
          Majors are special weeks with 2× points and gold leaderboard styling — your group's version of The Masters and The Open.
        </Text>
      </View>

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 16 }]}>
        Designate Majors ({majorCount}/{maxMajors})
      </Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted }]}>
        Majors award 2× points and get special gold styling
      </Text>

      <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
        {regularWeeks.map((w) => (
          <Pressable
            key={w.number}
            onPress={() => { haptics.light(); toggleMajor(w.number); }}
            style={[
              styles.majorWeekCard,
              {
                backgroundColor: w.isMajor ? c.gold + '12' : (theme.isDark ? c.elevated : c.cardBg),
                borderColor: w.isMajor ? c.gold : c.border,
                borderWidth: 1,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              {w.isMajor ? (
                <Ionicons name="trophy" size={20} color={c.gold} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={c.textMuted} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.majorWeekNum, { color: w.isMajor ? c.gold : c.text }]}>
                  Week {w.number}
                </Text>
                <Text style={[styles.majorWeekFmt, { color: c.textMuted }]}>
                  {FORMAT_LABELS[w.format] ?? w.format}
                </Text>
              </View>
            </View>
            {w.isMajor && (
              <Text style={[styles.majorMultiplier, { color: c.gold, fontFamily: GEO }]}>2×</Text>
            )}
          </Pressable>
        ))}

        {/* Major name editing */}
        {regularWeeks.filter((w) => w.isMajor).map((w, idx) => (
          <View key={`name-${w.number}`} style={{ marginTop: 8 }}>
            <Text style={[styles.majorNameLabel, { color: c.textMuted }]}>
              Week {w.number} Major Name
            </Text>
            <TextInput
              value={w.majorName}
              onChangeText={(text) => updateMajorName(w.number, text)}
              placeholder={MAJOR_PLACEHOLDERS[idx] ?? 'e.g., The Dormie Open'}
              style={[styles.input, { backgroundColor: inputBg, color: c.gold, borderColor: c.gold + '44' }]}
              placeholderTextColor={c.textMuted}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Step: Members ────────────────────────────────────────────────────
function MembersStep({
  selectedIds,
  setSelectedIds,
  seasonName,
  manualPlayers,
  setManualPlayers,
  bracketSize: memberBracketSize,
}: {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  seasonName: string;
  manualPlayers: ManualPlayer[];
  setManualPlayers: (p: ManualPlayer[]) => void;
  bracketSize?: BracketSize;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const cardBgVal = theme.isDark ? c.elevated : c.cardBg;
  const inputBg = theme.isDark ? c.elevated : '#FFFFFF';

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualHandicap, setManualHandicap] = useState('');

  const totalPlayers = selectedIds.length + manualPlayers.length;

  const toggle = (id: string) => {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  const handleShareInvite = async () => {
    haptics.light();
    try {
      await Share.share({
        message: `Join my ${seasonName || 'new'} season on Dormie!`,
      });
    } catch {}
  };

  const handleAddManual = () => {
    if (!manualName.trim()) return;
    haptics.success();
    const newPlayer: ManualPlayer = {
      id: `manual_${Date.now()}`,
      name: manualName.trim(),
      handicap: manualHandicap ? parseInt(manualHandicap, 10) : null,
    };
    setManualPlayers([...manualPlayers, newPlayer]);
    setManualName('');
    setManualHandicap('');
    setShowManualModal(false);
  };

  const removeManual = (id: string) => {
    haptics.light();
    setManualPlayers(manualPlayers.filter((p) => p.id !== id));
  };

  return (
    <View style={styles.stepContent}>
      {/* Action buttons */}
      <View style={styles.memberActions}>
        <Pressable
          onPress={handleShareInvite}
          style={[styles.memberActionBtn, { borderColor: '#006747' }]}
        >
          <Ionicons name="share-outline" size={18} color="#006747" />
          <Text style={[styles.memberActionText, { color: '#006747' }]}>Share Invite Link</Text>
        </Pressable>
        <Pressable
          onPress={() => { haptics.light(); setShowManualModal(true); }}
          style={[styles.memberActionBtn, { borderColor: c.textMuted }]}
        >
          <Ionicons name="person-add-outline" size={18} color={c.textMuted} />
          <Text style={[styles.memberActionText, { color: c.textMuted }]}>Add Manual Player</Text>
        </Pressable>
      </View>

      {/* Min 4 warning */}
      {!memberBracketSize && totalPlayers < 4 && (
        <View style={[styles.minWarning, { backgroundColor: '#C41E3A' + '18' }]}>
          <Ionicons name="warning-outline" size={16} color="#C41E3A" />
          <Text style={{ fontSize: 13, color: '#C41E3A' }}>Minimum 4 players required</Text>
        </View>
      )}

      {/* Bracket size warning */}
      {memberBracketSize != null && (() => {
        const totalWithYou = totalPlayers + 1;
        const diff = totalWithYou - memberBracketSize;
        if (diff < 0) {
          const byeCount = Math.abs(diff);
          return (
            <View style={[styles.minWarning, { backgroundColor: '#C9A227' + '18' }]}>
              <Ionicons name="information-circle-outline" size={16} color="#C9A227" />
              <Text style={{ fontSize: 13, color: '#C9A227', flex: 1 }}>
                {byeCount} slot{byeCount > 1 ? 's' : ''} will be filled with BYE{byeCount > 1 ? 's' : ''}. Add {byeCount} more player{byeCount > 1 ? 's' : ''} to fill the bracket.
              </Text>
            </View>
          );
        } else if (diff > 0) {
          const nextSize = memberBracketSize === 4 ? 8 : memberBracketSize === 8 ? 16 : memberBracketSize === 16 ? 32 : null;
          return (
            <View style={[styles.minWarning, { backgroundColor: '#C41E3A' + '18' }]}>
              <Ionicons name="warning-outline" size={16} color="#C41E3A" />
              <Text style={{ fontSize: 13, color: '#C41E3A', flex: 1 }}>
                {diff} too many players for a {memberBracketSize}-player bracket.
                {nextSize ? ` Increase bracket size to ${nextSize} or remove ${diff} player${diff > 1 ? 's' : ''}.` : ` Remove ${diff} player${diff > 1 ? 's' : ''}.`}
              </Text>
            </View>
          );
        }
        return null;
      })()}

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 12 }]}>
        Select Members ({totalPlayers} selected{memberBracketSize ? ` / ${memberBracketSize - 1} needed` : ''})
      </Text>

      {/* Manual players */}
      {manualPlayers.map((p) => (
        <View
          key={p.id}
          style={[
            styles.memberRow,
            {
              backgroundColor: c.teal + '12',
              borderColor: c.teal,
              borderWidth: 1,
            },
          ]}
        >
          <View style={[styles.manualAvatar, { backgroundColor: c.textMuted + '33' }]}>
            <Ionicons name="person" size={18} color={c.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.memberName, { color: c.teal }]}>{p.name}</Text>
              <View style={[styles.manualBadge, { backgroundColor: c.textMuted + '33' }]}>
                <Text style={styles.manualBadgeText}>MANUAL</Text>
              </View>
            </View>
            {p.handicap != null && (
              <Text style={[styles.memberHcp, { color: c.textMuted }]}>Handicap {p.handicap}</Text>
            )}
          </View>
          <Pressable onPress={() => removeManual(p.id)} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={c.textMuted} />
          </Pressable>
        </View>
      ))}

      {/* Friends list */}
      {MOCK_FRIENDS.map((f) => {
        const selected = selectedIds.includes(f.id);
        return (
          <Pressable
            key={f.id}
            onPress={() => { haptics.light(); toggle(f.id); }}
            style={[
              styles.memberRow,
              {
                backgroundColor: selected ? c.teal + '12' : cardBgVal,
                borderColor: selected ? c.teal : c.border,
                borderWidth: 1,
              },
            ]}
          >
            <Avatar id={f.id} name={f.name} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.memberName, { color: selected ? c.teal : c.text }]}>
                {f.name}
              </Text>
              <Text style={[styles.memberHcp, { color: c.textMuted }]}>
                Handicap {f.handicap}
              </Text>
            </View>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={selected ? c.teal : c.textMuted}
            />
          </Pressable>
        );
      })}

      {/* Manual Player Modal */}
      <Modal visible={showManualModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowManualModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.isDark ? c.card : '#FFFFFF' }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Add Manual Player</Text>

            <Text style={[styles.fieldLabel, { color: c.text }]}>Name</Text>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Player name"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { backgroundColor: inputBg, color: c.text, borderColor: c.border }]}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: c.text, marginTop: 12 }]}>Handicap (optional)</Text>
            <TextInput
              value={manualHandicap}
              onChangeText={setManualHandicap}
              placeholder="e.g., 15"
              placeholderTextColor={c.textMuted}
              keyboardType="numeric"
              style={[styles.input, { backgroundColor: inputBg, color: c.text, borderColor: c.border }]}
            />

            <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 10, fontStyle: 'italic' }}>
              Manual players don't need the app. You'll enter their scores each week.
            </Text>

            <View style={styles.modalButtons}>
              <Pressable onPress={() => setShowManualModal(false)} style={[styles.modalBtn, { borderColor: c.border, borderWidth: 1 }]}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.textMuted }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAddManual}
                disabled={!manualName.trim()}
                style={[styles.modalBtn, { backgroundColor: manualName.trim() ? '#006747' : c.elevated }]}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: manualName.trim() ? '#FFFFFF' : c.textMuted }}>Add Player</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Accordion Section ───────────────────────────────────────────────
function AccordionSection({
  title,
  icon,
  iconColor,
  children,
  defaultOpen,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(defaultOpen ?? false);
  const cardBg = theme.isDark ? c.elevated : c.cardBg;

  return (
    <View style={[styles.accordionSection, { backgroundColor: cardBg }]}>
      <Pressable
        onPress={() => { haptics.light(); setOpen(!open); }}
        style={styles.accordionHeader}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
        <Text style={[styles.accordionTitle, { color: c.text }]}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
      </Pressable>
      {open && <View style={[styles.accordionBody, { borderTopColor: c.border }]}>{children}</View>}
    </View>
  );
}

// ─── Step: Review ─────────────────────────────────────────────────────
function ReviewStep({
  name,
  seasonType,
  preset,
  scoringMethod,
  weeks,
  selectedIds,
  manualPlayers,
  cutEnabled,
  cutValue,
  dropWorst,
  playoffMultiplier,
  champMultiplier,
  makeupWindowEnabled,
  makeupWindowWeeks,
  dnsSafetyNet,
  dnsSafetyMax,
  multiRoundWeek,
  roundsAllowed,
  bestRoundsCount,
  participationBonus,
  participationPoints,
}: {
  name: string;
  seasonType: SeasonType;
  preset: string;
  scoringMethod: ScoringMethod;
  weeks: WeekConfig[];
  selectedIds: string[];
  manualPlayers: ManualPlayer[];
  cutEnabled: boolean;
  cutValue: number;
  dropWorst: boolean;
  playoffMultiplier: number;
  champMultiplier: number;
  makeupWindowEnabled: boolean;
  makeupWindowWeeks: number;
  dnsSafetyNet: boolean;
  dnsSafetyMax: number;
  multiRoundWeek: boolean;
  roundsAllowed: number;
  bestRoundsCount: number;
  participationBonus: boolean;
  participationPoints: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const presetData = LENGTH_PRESETS.find((p) => p.key === preset)!;
  const majors = weeks.filter((w) => w.isMajor);
  const members = MOCK_FRIENDS.filter((f) => selectedIds.includes(f.id));
  const typeLabel = { fedex: 'FedEx Cup', ryder: 'Ryder Cup', bracket: 'Match Play Bracket', stroke_series: 'Stroke Play Series', league: 'League', custom: 'Custom' }[seasonType];

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Hero header */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: c.gold, fontFamily: GEO, textAlign: 'center' }}>
          {name}
        </Text>
        <Text style={{ fontSize: 16, color: c.textMuted, marginTop: 6, textAlign: 'center' }}>
          {typeLabel} — {presetData.label} ({presetData.total} weeks)
        </Text>
      </View>

      {/* Scoring */}
      <AccordionSection title="Scoring" icon="stats-chart" iconColor={c.teal} defaultOpen>
        <Text style={[styles.reviewVal, { color: c.text }]}>
          {scoringMethod === 'position' ? 'Position-based points' : 'Raw Stableford'}
        </Text>
        {scoringMethod === 'position' && (
          <View style={[styles.pointsRow, { marginTop: 8 }]}>
            {POINTS_TABLE.slice(0, 5).map((pts, i) => (
              <View key={i} style={styles.pointsCell}>
                <Text style={[styles.pointsPos, { color: c.textMuted }]}>{i + 1}</Text>
                <Text style={[styles.pointsVal, { color: c.gold, fontFamily: GEO }]}>{pts}</Text>
              </View>
            ))}
          </View>
        )}
      </AccordionSection>

      {/* Rules */}
      <AccordionSection title="Rules" icon="settings-outline" iconColor={c.textMuted}>
        <View style={styles.reviewRules}>
          {cutEnabled && <Text style={[styles.reviewRule, { color: c.text }]}>Cut: Top {Math.round(cutValue * 100)}%</Text>}
          {dropWorst && <Text style={[styles.reviewRule, { color: c.text }]}>Drop worst week</Text>}
          <Text style={[styles.reviewRule, { color: c.text }]}>Playoff: {playoffMultiplier}× pts</Text>
          <Text style={[styles.reviewRule, { color: c.text }]}>Championship: {champMultiplier}× pts</Text>
          {makeupWindowEnabled && <Text style={[styles.reviewRule, { color: c.text }]}>Makeup window: {makeupWindowWeeks} week{makeupWindowWeeks !== 1 ? 's' : ''}</Text>}
          {dnsSafetyNet && <Text style={[styles.reviewRule, { color: c.text }]}>DNS safety net: {dnsSafetyMax} use{dnsSafetyMax !== 1 ? 's' : ''}/season</Text>}
          {multiRoundWeek && <Text style={[styles.reviewRule, { color: c.text }]}>Scoring: Best {bestRoundsCount} of {roundsAllowed} rounds per week</Text>}
          {participationBonus && <Text style={[styles.reviewRule, { color: c.text }]}>Participation bonus: +{participationPoints} pts for completing the week</Text>}
        </View>
      </AccordionSection>

      {/* Majors */}
      {majors.length > 0 && (
        <AccordionSection title={`Majors (${majors.length})`} icon="trophy" iconColor={c.gold}>
          {majors.map((m) => (
            <Text key={m.number} style={[styles.reviewMajor, { color: c.gold }]}>
              Wk {m.number} — {m.majorName}
            </Text>
          ))}
        </AccordionSection>
      )}

      {/* Schedule */}
      <AccordionSection title={`Schedule (${weeks.length} weeks)`} icon="calendar-outline" iconColor={c.textMuted}>
        {weeks.map((w) => (
          <View key={w.number} style={[styles.schedRow, { borderBottomColor: c.border }]}>
            <Text style={[styles.schedNum, { color: c.textMuted, fontFamily: GEO }]}>{w.number}</Text>
            <Text style={[styles.schedFmt, { color: w.isMajor ? c.gold : w.isPlayoff ? c.urgent : c.text }]}>
              {FORMAT_LABELS[w.format] ?? w.format}
            </Text>
            {w.isMajor && <Ionicons name="trophy" size={14} color={c.gold} />}
            {w.isPlayoff && <Text style={[styles.schedBadge, { color: c.urgent }]}>PLF</Text>}
            {w.isChampionship && <Text style={[styles.schedBadge, { color: c.gold }]}>CHMP</Text>}
            {w.multiplier > 1 && (
              <Text style={[styles.schedMult, { color: c.gold, fontFamily: GEO }]}>{w.multiplier}×</Text>
            )}
          </View>
        ))}
      </AccordionSection>

      {/* Members */}
      <AccordionSection title={`Members (${members.length + manualPlayers.length + 1})`} icon="people" iconColor={c.teal} defaultOpen>
        <View style={styles.reviewAvatarRow}>
          {/* You (organizer) */}
          <View style={styles.reviewAvatarItem}>
            <View style={[styles.reviewAvatarCircle, { backgroundColor: c.teal + '33' }]}>
              <Ionicons name="person" size={18} color={c.teal} />
            </View>
            <Text style={[styles.reviewAvatarName, { color: c.teal }]} numberOfLines={1}>You</Text>
          </View>
          {members.map((m) => (
            <View key={m.id} style={styles.reviewAvatarItem}>
              <Avatar id={m.id} name={m.name} size={40} />
              <Text style={[styles.reviewAvatarName, { color: c.text }]} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
            </View>
          ))}
          {manualPlayers.map((p) => (
            <View key={p.id} style={styles.reviewAvatarItem}>
              <View style={[styles.reviewAvatarCircle, { backgroundColor: c.textMuted + '33' }]}>
                <Ionicons name="person" size={18} color={c.textMuted} />
              </View>
              <Text style={[styles.reviewAvatarName, { color: c.textMuted }]} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
            </View>
          ))}
        </View>
      </AccordionSection>

      {/* Championship Bonus Challenges tip */}
      {weeks.some((w) => w.isChampionship) && (
        <View style={[styles.explanationCard, { borderColor: c.gold + '44', backgroundColor: c.gold + '0A', marginTop: 12 }]}>
          <Ionicons name="bulb-outline" size={18} color={c.gold} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: c.text, lineHeight: 18 }}>
              Tip: When championship week arrives, you'll be prompted to add bonus challenges like "Beat your handicap (+3)" and "Most birdies (+3)" to raise the stakes.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Ryder Cup: Team Setup ───────────────────────────────────────────
type DraftMethod = 'snake' | 'captains_pick' | 'random' | 'auto_balance';

function RyderCupTeamSetupStep({
  teamRedName,
  setTeamRedName,
  teamBlueName,
  setTeamBlueName,
  teamRedCaptain,
  setTeamRedCaptain,
  teamBlueCaptain,
  setTeamBlueCaptain,
  draftMethod,
  setDraftMethod,
  teamRedRoster,
  teamBlueRoster,
  selectedIds,
}: {
  teamRedName: string;
  setTeamRedName: (v: string) => void;
  teamBlueName: string;
  setTeamBlueName: (v: string) => void;
  teamRedCaptain: string | null;
  setTeamRedCaptain: (v: string | null) => void;
  teamBlueCaptain: string | null;
  setTeamBlueCaptain: (v: string | null) => void;
  draftMethod: DraftMethod;
  setDraftMethod: (v: DraftMethod) => void;
  teamRedRoster: string[];
  teamBlueRoster: string[];
  selectedIds: string[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const inputBg = theme.isDark ? c.elevated : '#FFFFFF';

  const allPlayers = MOCK_FRIENDS.filter((f) => selectedIds.includes(f.id));

  const DRAFT_METHODS: { key: DraftMethod; label: string; desc: string }[] = [
    { key: 'snake', label: 'Snake Draft', desc: 'Captains alternate picks (1-2-2-1)' },
    { key: 'captains_pick', label: "Captain's Pick", desc: 'Captains choose freely' },
    { key: 'auto_balance', label: 'Auto-Balance', desc: 'Teams balanced by handicap' },
    { key: 'random', label: 'Random', desc: 'Players assigned randomly to teams' },
  ];

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>Team Names</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <View style={[styles.teamColorDot, { backgroundColor: '#C41E3A' }]} />
          <TextInput
            value={teamRedName}
            onChangeText={setTeamRedName}
            placeholder="Team Red"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { backgroundColor: inputBg, color: c.text, borderColor: '#C41E3A44' }]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.teamColorDot, { backgroundColor: '#4682B4' }]} />
          <TextInput
            value={teamBlueName}
            onChangeText={setTeamBlueName}
            placeholder="Team Blue"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { backgroundColor: inputBg, color: c.text, borderColor: '#4682B444' }]}
          />
        </View>
      </View>

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Team Captains</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted }]}>Select one captain per team from your members.</Text>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
        {/* Red captain */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.teamCaptainLabel, { color: '#C41E3A' }]}>{teamRedName || 'Team Red'} Captain</Text>
          {allPlayers.map((p) => {
            const isRedCaptain = teamRedCaptain === p.id;
            const isBlue = teamBlueCaptain === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => { if (!isBlue) { haptics.light(); setTeamRedCaptain(isRedCaptain ? null : p.id); } }}
                style={[styles.captainPick, {
                  backgroundColor: isRedCaptain ? '#C41E3A18' : (theme.isDark ? c.surface : c.cardBg),
                  borderColor: isRedCaptain ? '#C41E3A' : c.border,
                  opacity: isBlue ? 0.35 : 1,
                }]}
              >
                <Text style={[styles.captainPickName, { color: isRedCaptain ? '#C41E3A' : c.text }]} numberOfLines={1}>
                  {p.name.split(' ')[0]}
                </Text>
                {isRedCaptain && <Ionicons name="star" size={14} color="#C41E3A" />}
              </Pressable>
            );
          })}
        </View>
        {/* Blue captain */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.teamCaptainLabel, { color: '#4682B4' }]}>{teamBlueName || 'Team Blue'} Captain</Text>
          {allPlayers.map((p) => {
            const isBlueCaptain = teamBlueCaptain === p.id;
            const isRed = teamRedCaptain === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => { if (!isRed) { haptics.light(); setTeamBlueCaptain(isBlueCaptain ? null : p.id); } }}
                style={[styles.captainPick, {
                  backgroundColor: isBlueCaptain ? '#4682B418' : (theme.isDark ? c.surface : c.cardBg),
                  borderColor: isBlueCaptain ? '#4682B4' : c.border,
                  opacity: isRed ? 0.35 : 1,
                }]}
              >
                <Text style={[styles.captainPickName, { color: isBlueCaptain ? '#4682B4' : c.text }]} numberOfLines={1}>
                  {p.name.split(' ')[0]}
                </Text>
                {isBlueCaptain && <Ionicons name="star" size={14} color="#4682B4" />}
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Draft Method</Text>
      {DRAFT_METHODS.map((dm) => (
        <Pressable
          key={dm.key}
          onPress={() => { haptics.light(); setDraftMethod(dm.key); }}
          style={[styles.presetCard, {
            backgroundColor: draftMethod === dm.key ? c.teal + '12' : (theme.isDark ? c.surface : c.cardBg),
            borderColor: draftMethod === dm.key ? c.teal : c.border,
            borderWidth: 1,
          }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.presetLabel, { color: draftMethod === dm.key ? c.teal : c.text }]}>{dm.label}</Text>
            <Text style={[styles.presetDesc, { color: c.textMuted }]}>{dm.desc}</Text>
          </View>
          {draftMethod === dm.key && <Ionicons name="checkmark-circle" size={22} color={c.teal} />}
        </Pressable>
      ))}

      {/* Team rosters side-by-side preview */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Team Rosters</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
        <View style={[styles.rosterColumn, { backgroundColor: '#C41E3A0C', borderColor: '#C41E3A33' }]}>
          <Text style={[styles.rosterTitle, { color: '#C41E3A' }]}>{teamRedName || 'Team Red'}</Text>
          {teamRedRoster.length === 0 ? (
            <Text style={[styles.rosterEmpty, { color: c.textMuted }]}>Draft pending</Text>
          ) : (
            teamRedRoster.map((id) => {
              const p = allPlayers.find((f) => f.id === id);
              return p ? (
                <Text key={id} style={[styles.rosterPlayer, { color: c.text }]}>{p.name.split(' ')[0]}</Text>
              ) : null;
            })
          )}
        </View>
        <View style={[styles.rosterColumn, { backgroundColor: '#4682B40C', borderColor: '#4682B433' }]}>
          <Text style={[styles.rosterTitle, { color: '#4682B4' }]}>{teamBlueName || 'Team Blue'}</Text>
          {teamBlueRoster.length === 0 ? (
            <Text style={[styles.rosterEmpty, { color: c.textMuted }]}>Draft pending</Text>
          ) : (
            teamBlueRoster.map((id) => {
              const p = allPlayers.find((f) => f.id === id);
              return p ? (
                <Text key={id} style={[styles.rosterPlayer, { color: c.text }]}>{p.name.split(' ')[0]}</Text>
              ) : null;
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Ryder Cup: Match Format ────────────────────────────────────────
type RCSessionType = 'foursomes' | 'four_ball' | 'singles';

function RyderCupMatchFormatStep({
  rcSessions,
  setRcSessions,
  rcNumDays,
  setRcNumDays,
  rcPointsPerMatch,
  setRcPointsPerMatch,
  rcHalvedPoints,
  setRcHalvedPoints,
  rcWinCondition,
  setRcWinCondition,
  rcFirstToTarget,
  setRcFirstToTarget,
  rcDayCourses,
  setRcDayCourses,
  selectedIds,
}: {
  rcSessions: Record<RCSessionType, boolean>;
  setRcSessions: (v: Record<RCSessionType, boolean>) => void;
  rcNumDays: number;
  setRcNumDays: (v: number) => void;
  rcPointsPerMatch: number;
  setRcPointsPerMatch: (v: number) => void;
  rcHalvedPoints: number;
  setRcHalvedPoints: (v: number) => void;
  rcWinCondition: 'most_points' | 'first_to';
  setRcWinCondition: (v: 'most_points' | 'first_to') => void;
  rcFirstToTarget: number;
  setRcFirstToTarget: (v: number) => void;
  rcDayCourses: Record<number, { courseId: string; courseName: string; holes: 'front9' | 'back9' | 'full18' }>;
  setRcDayCourses: (v: Record<number, { courseId: string; courseName: string; holes: 'front9' | 'back9' | 'full18' }>) => void;
  selectedIds: string[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const SESSION_TYPES: { key: RCSessionType; label: string; desc: string }[] = [
    { key: 'foursomes', label: 'Foursomes (Alternate Shot)', desc: '2v2 — teams alternate shots on the same ball' },
    { key: 'four_ball', label: 'Four-Ball (Best Ball)', desc: '2v2 — best individual ball on each hole counts' },
    { key: 'singles', label: 'Singles', desc: '1v1 match play head-to-head' },
  ];

  const DAY_CONFIGS = [
    { days: 1, label: '1 Day', desc: 'All sessions in one day' },
    { days: 2, label: '2 Days', desc: 'Day 1: Foursomes + Four-Ball, Day 2: Singles' },
    { days: 3, label: '3 Days', desc: 'Classic Ryder Cup format spread over 3 days' },
  ];

  const toggleSession = (key: RCSessionType) => {
    haptics.light();
    setRcSessions({ ...rcSessions, [key]: !rcSessions[key] });
  };

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>Session Types</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        Toggle which match formats to include.
      </Text>

      {SESSION_TYPES.map((st) => (
        <Pressable
          key={st.key}
          onPress={() => toggleSession(st.key)}
          style={[styles.ruleRow, { borderBottomColor: c.border }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.ruleLabel, { color: rcSessions[st.key] ? c.teal : c.text }]}>{st.label}</Text>
            <Text style={[styles.ruleDesc, { color: c.textMuted }]}>{st.desc}</Text>
          </View>
          <Switch
            value={rcSessions[st.key]}
            onValueChange={() => toggleSession(st.key)}
            trackColor={{ false: c.elevated, true: c.teal + '66' }}
            thumbColor={rcSessions[st.key] ? c.teal : c.textMuted}
          />
        </Pressable>
      ))}

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Number of Days</Text>
      {DAY_CONFIGS.map((dc) => (
        <Pressable
          key={dc.days}
          onPress={() => { haptics.light(); setRcNumDays(dc.days); }}
          style={[styles.presetCard, {
            backgroundColor: rcNumDays === dc.days ? c.teal + '12' : (theme.isDark ? c.surface : c.cardBg),
            borderColor: rcNumDays === dc.days ? c.teal : c.border,
            borderWidth: 1,
          }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.presetLabel, { color: rcNumDays === dc.days ? c.teal : c.text }]}>{dc.label}</Text>
            <Text style={[styles.presetDesc, { color: c.textMuted }]}>{dc.desc}</Text>
          </View>
          {rcNumDays === dc.days && <Ionicons name="checkmark-circle" size={22} color={c.teal} />}
        </Pressable>
      ))}

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Points</Text>
      <View style={[styles.multiplierRow, { backgroundColor: c.elevated }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.multiplierLabel, { color: c.text }]}>Points per match win</Text>
        </View>
        <View style={styles.stepperRow}>
          <Pressable onPress={() => { haptics.light(); setRcPointsPerMatch(Math.max(0.5, rcPointsPerMatch - 0.5)); }}>
            <Ionicons name="remove-circle-outline" size={24} color={c.textMuted} />
          </Pressable>
          <Text style={[styles.stepperVal, { color: c.gold, fontFamily: GEO }]}>{rcPointsPerMatch}</Text>
          <Pressable onPress={() => { haptics.light(); setRcPointsPerMatch(rcPointsPerMatch + 0.5); }}>
            <Ionicons name="add-circle-outline" size={24} color={c.gold} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.multiplierRow, { backgroundColor: c.elevated }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.multiplierLabel, { color: c.text }]}>Points for halved match</Text>
        </View>
        <View style={styles.stepperRow}>
          <Pressable onPress={() => { haptics.light(); setRcHalvedPoints(Math.max(0, rcHalvedPoints - 0.5)); }}>
            <Ionicons name="remove-circle-outline" size={24} color={c.textMuted} />
          </Pressable>
          <Text style={[styles.stepperVal, { color: c.gold, fontFamily: GEO }]}>{rcHalvedPoints}</Text>
          <Pressable onPress={() => { haptics.light(); setRcHalvedPoints(rcHalvedPoints + 0.5); }}>
            <Ionicons name="add-circle-outline" size={24} color={c.gold} />
          </Pressable>
        </View>
      </View>

      {/* Win Condition */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Win Condition</Text>
      {([
        { key: 'most_points' as const, label: 'Most Points', desc: 'Team with highest total after all matches' },
        { key: 'first_to' as const, label: 'First to X', desc: 'Race to target — competition ends when one team reaches X points' },
      ]).map((wc) => {
        const active = wc.key === rcWinCondition;
        return (
          <Pressable
            key={wc.key}
            onPress={() => { haptics.light(); setRcWinCondition(wc.key); }}
            style={[styles.presetCard, {
              backgroundColor: active ? c.teal + '12' : (theme.isDark ? c.surface : c.cardBg),
              borderColor: active ? c.teal : c.border,
              borderWidth: 1,
            }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.presetLabel, { color: active ? c.teal : c.text }]}>{wc.label}</Text>
              <Text style={[styles.presetDesc, { color: c.textMuted }]}>{wc.desc}</Text>
            </View>
            {active && <Ionicons name="checkmark-circle" size={22} color={c.teal} />}
          </Pressable>
        );
      })}

      {rcWinCondition === 'first_to' && (
        <View style={[styles.dnsOptions, { backgroundColor: c.elevated }]}>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.text }]}>Target Points</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => { haptics.light(); setRcFirstToTarget(Math.max(3, rcFirstToTarget - 0.5)); }}>
                <Ionicons name="remove-circle-outline" size={24} color={c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.gold, fontFamily: GEO }]}>{rcFirstToTarget}</Text>
              <Pressable onPress={() => { haptics.light(); setRcFirstToTarget(Math.min(50, rcFirstToTarget + 0.5)); }}>
                <Ionicons name="add-circle-outline" size={24} color={c.gold} />
              </Pressable>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: c.textMuted, fontStyle: 'italic', marginTop: 4 }}>
            The competition ends as soon as one team reaches {rcFirstToTarget} points — even if matches remain.
          </Text>
        </View>
      )}

      {/* Course Assignment */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Course Assignment</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        Optionally assign a course and hole range for each day/session.
      </Text>
      {Array.from({ length: rcNumDays }, (_, i) => {
        const day = i + 1;
        const dayCourse = rcDayCourses[day];
        return (
          <View key={day} style={[styles.presetCard, { backgroundColor: theme.isDark ? c.elevated : c.cardBg, borderColor: c.border, borderWidth: 1, flexDirection: 'column', alignItems: 'stretch' }]}>
            <Text style={[styles.presetLabel, { color: c.text, marginBottom: 8 }]}>Day {day}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="golf-outline" size={16} color={dayCourse ? c.teal : c.textMuted} />
              <Text style={{ fontSize: 13, color: dayCourse ? c.text : c.textMuted, flex: 1 }}>
                {dayCourse ? dayCourse.courseName : 'TBD — no course assigned'}
              </Text>
              {dayCourse && (
                <Pressable onPress={() => {
                  const updated = { ...rcDayCourses };
                  delete updated[day];
                  setRcDayCourses(updated);
                }} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={c.urgent} />
                </Pressable>
              )}
            </View>
            {/* Hole range pills */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
              {(['front9', 'back9', 'full18'] as const).map((hr) => {
                const label = hr === 'front9' ? 'Front 9' : hr === 'back9' ? 'Back 9' : 'Full 18';
                const active = dayCourse?.holes === hr || (!dayCourse && hr === 'full18');
                return (
                  <Pressable
                    key={hr}
                    onPress={() => {
                      haptics.light();
                      setRcDayCourses({
                        ...rcDayCourses,
                        [day]: { courseId: dayCourse?.courseId ?? '', courseName: dayCourse?.courseName ?? 'TBD', holes: hr },
                      });
                    }}
                    style={[styles.pill, {
                      backgroundColor: active ? c.teal + '22' : c.surface ?? c.cardBg,
                      borderColor: active ? c.teal : 'transparent',
                      borderWidth: 1,
                    }]}
                  >
                    <Text style={[styles.pillText, { color: active ? c.teal : c.textMuted }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Quick-add course from suggestions */}
            {!dayCourse && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {Object.values(SUGGESTED_COURSES_FLAT).slice(0, 4).map((cc) => (
                  <Pressable
                    key={cc.id}
                    onPress={() => {
                      haptics.light();
                      setRcDayCourses({
                        ...rcDayCourses,
                        [day]: { courseId: cc.id, courseName: cc.name, holes: 'full18' },
                      });
                    }}
                    style={[styles.pill, { backgroundColor: c.surface ?? c.cardBg, borderColor: c.border, borderWidth: 1 }]}
                  >
                    <Text style={[styles.pillText, { color: c.textMuted, fontSize: 11 }]}>{cc.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Ryder Cup: Review ──────────────────────────────────────────────
function RyderCupReviewStep({
  name,
  teamRedName,
  teamBlueName,
  teamRedCaptain,
  teamBlueCaptain,
  draftMethod,
  rcSessions,
  rcNumDays,
  rcPointsPerMatch,
  rcHalvedPoints,
  rcWinCondition,
  rcFirstToTarget,
  rcDayCourses,
  rcRevealEnabled,
  setRcRevealEnabled,
  selectedIds,
  manualPlayers,
}: {
  name: string;
  teamRedName: string;
  teamBlueName: string;
  teamRedCaptain: string | null;
  teamBlueCaptain: string | null;
  draftMethod: DraftMethod;
  rcSessions: Record<RCSessionType, boolean>;
  rcNumDays: number;
  rcPointsPerMatch: number;
  rcHalvedPoints: number;
  rcWinCondition: 'most_points' | 'first_to';
  rcFirstToTarget: number;
  rcDayCourses: Record<number, { courseId: string; courseName: string; holes: 'front9' | 'back9' | 'full18' }>;
  rcRevealEnabled: boolean;
  setRcRevealEnabled: (v: boolean) => void;
  selectedIds: string[];
  manualPlayers: ManualPlayer[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const allPlayers = MOCK_FRIENDS.filter((f) => selectedIds.includes(f.id));
  const redCaptainName = allPlayers.find((p) => p.id === teamRedCaptain)?.name ?? 'TBD';
  const blueCaptainName = allPlayers.find((p) => p.id === teamBlueCaptain)?.name ?? 'TBD';
  const draftLabels: Record<DraftMethod, string> = { snake: 'Snake Draft', captains_pick: "Captain's Pick", auto_balance: 'Auto-Balance', random: 'Random' };
  const enabledSessions = (Object.keys(rcSessions) as RCSessionType[]).filter((k) => rcSessions[k]);
  const sessionLabels: Record<RCSessionType, string> = { foursomes: 'Foursomes', four_ball: 'Four-Ball', singles: 'Singles' };

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: c.gold, fontFamily: GEO, textAlign: 'center' }}>{name}</Text>
        <Text style={{ fontSize: 16, color: c.textMuted, marginTop: 6 }}>Ryder Cup</Text>
      </View>

      <AccordionSection title="Teams" icon="people-outline" iconColor="#C41E3A" defaultOpen>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#C41E3A', marginBottom: 4 }}>{teamRedName || 'Team Red'}</Text>
            <Text style={{ fontSize: 12, color: c.textMuted }}>Captain: {redCaptainName}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#4682B4', marginBottom: 4 }}>{teamBlueName || 'Team Blue'}</Text>
            <Text style={{ fontSize: 12, color: c.textMuted }}>Captain: {blueCaptainName}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 8 }}>Draft: {draftLabels[draftMethod]}</Text>
      </AccordionSection>

      <AccordionSection title="Match Format" icon="golf-outline" iconColor={c.teal} defaultOpen>
        {enabledSessions.map((s) => (
          <Text key={s} style={{ fontSize: 14, color: c.text, marginTop: 4 }}>{sessionLabels[s]}</Text>
        ))}
        <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 8 }}>{rcNumDays} day{rcNumDays > 1 ? 's' : ''} of competition</Text>
        <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>Win: {rcPointsPerMatch} pt{rcPointsPerMatch !== 1 ? 's' : ''} | Halved: {rcHalvedPoints} pt{rcHalvedPoints !== 1 ? 's' : ''}</Text>
        <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>
          Win Condition: {rcWinCondition === 'most_points' ? 'Most Points' : `First to ${rcFirstToTarget}`}
        </Text>
      </AccordionSection>

      {/* Match Schedule */}
      <AccordionSection title={`Match Schedule (${rcNumDays} day${rcNumDays > 1 ? 's' : ''})`} icon="calendar-outline" iconColor={c.textMuted}>
        {Array.from({ length: rcNumDays }, (_, i) => {
          const day = i + 1;
          const dayCourse = rcDayCourses[day];
          const holeLabel = dayCourse
            ? (dayCourse.holes === 'front9' ? 'Front 9' : dayCourse.holes === 'back9' ? 'Back 9' : '18 Holes')
            : '18 Holes';
          return (
            <View key={day} style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, paddingVertical: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>Day {day}</Text>
              {enabledSessions.map((s) => (
                <Text key={s} style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>{sessionLabels[s]}</Text>
              ))}
              <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>
                Course: {dayCourse ? dayCourse.courseName : 'TBD'} · {holeLabel}
              </Text>
              <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 1 }}>Pairings TBD</Text>
            </View>
          );
        })}
        <Text style={{ fontSize: 12, color: c.gold, fontFamily: GEO, marginTop: 8 }}>
          Total possible: {rcNumDays * enabledSessions.length * rcPointsPerMatch} pts
        </Text>
      </AccordionSection>

      <AccordionSection title={`Members (${allPlayers.length + manualPlayers.length + 1})`} icon="people" iconColor={c.teal} defaultOpen>
        <View style={styles.reviewAvatarRow}>
          <View style={styles.reviewAvatarItem}>
            <View style={[styles.reviewAvatarCircle, { backgroundColor: c.teal + '33' }]}>
              <Ionicons name="person" size={18} color={c.teal} />
            </View>
            <Text style={[styles.reviewAvatarName, { color: c.teal }]} numberOfLines={1}>You</Text>
          </View>
          {allPlayers.map((m) => (
            <View key={m.id} style={styles.reviewAvatarItem}>
              <Avatar id={m.id} name={m.name} size={40} />
              <Text style={[styles.reviewAvatarName, { color: c.text }]} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
            </View>
          ))}
        </View>
      </AccordionSection>

      {/* Matchup Reveal Toggle */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border, marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Enable Matchup Reveal</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Cinematic reveal animation when players first open this season
          </Text>
        </View>
        <Switch
          value={rcRevealEnabled}
          onValueChange={setRcRevealEnabled}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={rcRevealEnabled ? c.teal : c.textMuted}
        />
      </View>
    </ScrollView>
  );
}

// ─── Match Play Bracket: Bracket Setup ──────────────────────────────
type SeedingMethod = BracketSeedingMethod;

const BRACKET_SIZE_HELPERS: Record<number, string> = {
  4: '4 players = Semifinals + Final.',
  8: '8 players = Quarterfinals through Final.',
  16: '16 players = Round of 16 through Final.',
  32: '32 players = Round of 32 through Final.',
};

function BracketSetupStep({
  bracketSize,
  setBracketSize,
  seedingMethod,
  setSeedingMethod,
  bracketFormat,
  setBracketFormat,
}: {
  bracketSize: BracketSize;
  setBracketSize: (v: BracketSize) => void;
  seedingMethod: SeedingMethod;
  setSeedingMethod: (v: SeedingMethod) => void;
  bracketFormat: BracketFormat;
  setBracketFormat: (v: BracketFormat) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const BRACKET_SIZES: BracketSize[] = [4, 8, 16, 32];
  const rounds = getBracketRounds(bracketSize);
  const SEEDING_METHODS: { key: SeedingMethod; label: string; desc: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'handicap', label: 'By Handicap', desc: 'Lowest handicap gets 1 seed', icon: 'stats-chart-outline' },
    { key: 'qualifying', label: 'By Qualifying Round', desc: 'Run a qualifying week then use results to seed', icon: 'golf-outline' },
    { key: 'random', label: 'Random', desc: 'Seeds assigned randomly at season start', icon: 'shuffle-outline' },
  ];
  const BRACKET_FORMATS: { key: BracketFormat; label: string; desc: string }[] = [
    { key: 'single', label: 'Single Elimination', desc: 'Lose once, you\'re out' },
    { key: 'double', label: 'Double Elimination', desc: 'Must lose twice to be eliminated (adds losers bracket)' },
  ];

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>Bracket Size</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        How many players in the bracket?
      </Text>
      <View style={styles.pillRow}>
        {BRACKET_SIZES.map((size) => (
          <Pressable
            key={size}
            onPress={() => { haptics.light(); setBracketSize(size); }}
            style={[styles.pill, {
              backgroundColor: bracketSize === size ? c.teal + '22' : c.elevated,
              borderColor: bracketSize === size ? c.teal : 'transparent',
              borderWidth: 1,
            }]}
          >
            <Text style={[styles.pillText, { color: bracketSize === size ? c.teal : c.textMuted, fontFamily: GEO }]}>
              {size}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Helper text */}
      <View style={[styles.bracketHelper, { backgroundColor: c.teal + '0D' }]}>
        <Ionicons name="information-circle-outline" size={16} color={c.teal} />
        <Text style={[styles.bracketHelperText, { color: c.textMuted }]}>
          {BRACKET_SIZE_HELPERS[bracketSize]} {rounds} rounds to crown a champion.
        </Text>
      </View>

      {/* Visual bracket preview */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 16 }]}>Bracket Preview</Text>
      <BracketPreview size={bracketSize} />

      {/* Seeding method */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Seeding Method</Text>
      {SEEDING_METHODS.map((sm) => (
        <Pressable
          key={sm.key}
          onPress={() => { haptics.light(); setSeedingMethod(sm.key); }}
          style={[styles.presetCard, {
            backgroundColor: seedingMethod === sm.key ? c.teal + '12' : (theme.isDark ? c.surface : c.cardBg),
            borderColor: seedingMethod === sm.key ? c.teal : c.border,
            borderWidth: 1,
          }]}
        >
          <Ionicons name={sm.icon} size={20} color={seedingMethod === sm.key ? c.teal : c.textMuted} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.presetLabel, { color: seedingMethod === sm.key ? c.teal : c.text }]}>{sm.label}</Text>
            <Text style={[styles.presetDesc, { color: c.textMuted }]}>{sm.desc}</Text>
          </View>
          {seedingMethod === sm.key && <Ionicons name="checkmark-circle" size={22} color={c.teal} />}
        </Pressable>
      ))}

      {/* Qualifying note */}
      {seedingMethod === 'qualifying' && (
        <View style={[styles.bracketHelper, { backgroundColor: c.gold + '0D', marginTop: 4 }]}>
          <Ionicons name="calendar-outline" size={16} color={c.gold} />
          <Text style={[styles.bracketHelperText, { color: c.textMuted }]}>
            You'll set up a qualifying week before the bracket begins.
          </Text>
        </View>
      )}

      {/* Bracket format */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Bracket Format</Text>
      {BRACKET_FORMATS.map((bf) => (
        <Pressable
          key={bf.key}
          onPress={() => { haptics.light(); setBracketFormat(bf.key); }}
          style={[styles.presetCard, {
            backgroundColor: bracketFormat === bf.key ? c.teal + '12' : (theme.isDark ? c.surface : c.cardBg),
            borderColor: bracketFormat === bf.key ? c.teal : c.border,
            borderWidth: 1,
          }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.presetLabel, { color: bracketFormat === bf.key ? c.teal : c.text }]}>{bf.label}</Text>
            <Text style={[styles.presetDesc, { color: c.textMuted }]}>{bf.desc}</Text>
          </View>
          {bracketFormat === bf.key && <Ionicons name="checkmark-circle" size={22} color={c.teal} />}
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Match Play Bracket: Match Rules ────────────────────────────────
type HandicapStrokes = 'full' | 'reduced' | 'none';

function BracketMatchRulesStep({
  bracketMatchLength,
  setBracketMatchLength,
  bracketHandicap,
  setBracketHandicap,
  bracketScoringMethod,
  setBracketScoringMethod,
  roundDeadlineDays,
  setRoundDeadlineDays,
}: {
  bracketMatchLength: '18' | '9';
  setBracketMatchLength: (v: '18' | '9') => void;
  bracketHandicap: HandicapStrokes;
  setBracketHandicap: (v: HandicapStrokes) => void;
  bracketScoringMethod: BracketScoringMethod;
  setBracketScoringMethod: (v: BracketScoringMethod) => void;
  roundDeadlineDays: number;
  setRoundDeadlineDays: (v: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const SCORING_METHODS: { key: BracketScoringMethod; label: string; desc: string }[] = [
    { key: 'match_play', label: 'Match Play (Holes Won)', desc: 'Traditional — most holes won wins the match' },
    { key: 'stableford', label: 'Net Stableford', desc: 'Compare total Stableford points' },
    { key: 'stroke_play', label: 'Stroke Play', desc: 'Lowest net strokes wins the match' },
  ];

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>Match Length</Text>
      <PillRow
        options={['18', '9'] as ('18' | '9')[]}
        selected={bracketMatchLength}
        onSelect={setBracketMatchLength}
        labels={{ '18': '18 Holes', '9': '9 Holes' }}
        colors={c}
      />

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Handicap Strokes</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        How handicap strokes are applied in matches.
      </Text>
      {([
        { key: 'full' as HandicapStrokes, label: 'Full 100%', desc: 'Lower handicap gives full strokes' },
        { key: 'reduced' as HandicapStrokes, label: 'Reduced 80%', desc: 'Competition adjustment (USGA recommendation)' },
        { key: 'none' as HandicapStrokes, label: 'None (Gross)', desc: 'No handicap strokes — scratch play' },
      ]).map((opt) => (
        <Pressable
          key={opt.key}
          onPress={() => { haptics.light(); setBracketHandicap(opt.key); }}
          style={[styles.presetCard, {
            backgroundColor: bracketHandicap === opt.key ? c.teal + '12' : (theme.isDark ? c.surface : c.cardBg),
            borderColor: bracketHandicap === opt.key ? c.teal : c.border,
            borderWidth: 1,
          }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.presetLabel, { color: bracketHandicap === opt.key ? c.teal : c.text }]}>{opt.label}</Text>
            <Text style={[styles.presetDesc, { color: c.textMuted }]}>{opt.desc}</Text>
          </View>
          {bracketHandicap === opt.key && <Ionicons name="checkmark-circle" size={22} color={c.teal} />}
        </Pressable>
      ))}

      {/* Scoring Method */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Scoring Method</Text>
      {SCORING_METHODS.map((sm) => (
        <Pressable
          key={sm.key}
          onPress={() => { haptics.light(); setBracketScoringMethod(sm.key); }}
          style={[styles.presetCard, {
            backgroundColor: bracketScoringMethod === sm.key ? c.teal + '12' : (theme.isDark ? c.surface : c.cardBg),
            borderColor: bracketScoringMethod === sm.key ? c.teal : c.border,
            borderWidth: 1,
          }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.presetLabel, { color: bracketScoringMethod === sm.key ? c.teal : c.text }]}>{sm.label}</Text>
            <Text style={[styles.presetDesc, { color: c.textMuted }]}>{sm.desc}</Text>
          </View>
          {bracketScoringMethod === sm.key && <Ionicons name="checkmark-circle" size={22} color={c.teal} />}
        </Pressable>
      ))}

      {/* Remote play note */}
      <View style={[styles.bracketHelper, { backgroundColor: c.teal + '0D', marginTop: 12 }]}>
        <Ionicons name="globe-outline" size={16} color={c.teal} />
        <Text style={[styles.bracketHelperText, { color: c.textMuted }]}>
          For remote matches, players don't need to play together. Scores are compared after both players complete their rounds.
        </Text>
      </View>

      {/* Deadline per Round */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Deadline per Round</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        Players have {roundDeadlineDays} days to complete their match each round.
      </Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => { if (roundDeadlineDays > 3) { haptics.light(); setRoundDeadlineDays(roundDeadlineDays - 1); } }}
          style={[styles.stepperBtn, { backgroundColor: c.elevated, opacity: roundDeadlineDays <= 3 ? 0.4 : 1 }]}
        >
          <Ionicons name="remove" size={18} color={c.text} />
        </Pressable>
        <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{roundDeadlineDays}</Text>
        <Text style={[styles.stepperUnit, { color: c.textMuted }]}>days</Text>
        <Pressable
          onPress={() => { if (roundDeadlineDays < 14) { haptics.light(); setRoundDeadlineDays(roundDeadlineDays + 1); } }}
          style={[styles.stepperBtn, { backgroundColor: c.elevated, opacity: roundDeadlineDays >= 14 ? 0.4 : 1 }]}
        >
          <Ionicons name="add" size={18} color={c.text} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Match Play Bracket: Review ─────────────────────────────────────
function BracketReviewStep({
  name,
  bracketSize,
  seedingMethod,
  bracketFormat,
  bracketMatchLength,
  bracketHandicap,
  bracketScoringMethod,
  roundDeadlineDays,
  selectedIds,
  manualPlayers,
}: {
  name: string;
  bracketSize: BracketSize;
  seedingMethod: SeedingMethod;
  bracketFormat: BracketFormat;
  bracketMatchLength: '18' | '9';
  bracketHandicap: HandicapStrokes;
  bracketScoringMethod: BracketScoringMethod;
  roundDeadlineDays: number;
  selectedIds: string[];
  manualPlayers: ManualPlayer[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const allPlayers = MOCK_FRIENDS.filter((f) => selectedIds.includes(f.id));
  const totalPlayerCount = allPlayers.length + manualPlayers.length + 1;
  const seedLabels: Record<SeedingMethod, string> = { handicap: 'By Handicap', qualifying: 'Qualifying Round', random: 'Random' };
  const hcpLabels: Record<HandicapStrokes, string> = { full: 'Full 100%', reduced: 'Reduced 80%', none: 'None (Gross)' };
  const scoringLabels: Record<BracketScoringMethod, string> = { match_play: 'Match Play (Holes Won)', stableford: 'Net Stableford', stroke_play: 'Stroke Play' };
  const formatLabels: Record<BracketFormat, string> = { single: 'Single Elimination', double: 'Double Elimination' };
  const rounds = getBracketRounds(bracketSize);
  const byeCount = bracketSize - totalPlayerCount;

  // Generate preview bracket matches
  const previewPlayers = useMemo(() => {
    const players: { id: string; name: string; seed: number }[] = [];
    // "You" is always seed 1 in preview
    players.push({ id: 'you', name: 'You', seed: 1 });
    let seedNum = 2;
    for (const p of allPlayers) {
      if (seedNum > bracketSize) break;
      players.push({ id: p.id, name: p.name.split(' ')[0], seed: seedNum++ });
    }
    for (const p of manualPlayers) {
      if (seedNum > bracketSize) break;
      players.push({ id: p.id, name: p.name, seed: seedNum++ });
    }
    return players;
  }, [allPlayers, manualPlayers, bracketSize]);

  const previewMatches = useMemo(
    () => generateBracketMatches(bracketSize, previewPlayers),
    [bracketSize, previewPlayers],
  );

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Ionicons name="trophy" size={36} color={c.gold} style={{ marginBottom: 8 }} />
        <Text style={{ fontSize: 28, fontWeight: '700', color: c.gold, fontFamily: GEO, textAlign: 'center' }}>{name}</Text>
        <Text style={{ fontSize: 16, color: c.textMuted, marginTop: 6 }}>Match Play Bracket</Text>
      </View>

      {/* Bracket visualization */}
      <AccordionSection title={`Bracket — ${rounds} Rounds`} icon="git-merge-outline" iconColor={c.gold} defaultOpen>
        <BracketPreview size={bracketSize} />
        <View style={{ gap: 4, marginTop: 8 }}>
          <Text style={[styles.reviewVal, { color: c.text }]}>{bracketSize} players, {formatLabels[bracketFormat]}</Text>
          <Text style={[styles.reviewVal, { color: c.textMuted }]}>Seeding: {seedLabels[seedingMethod]}</Text>
          {seedingMethod === 'qualifying' && (
            <Text style={[styles.reviewVal, { color: c.gold }]}>Qualifying round required before bracket begins</Text>
          )}
          {byeCount > 0 && (
            <Text style={[styles.reviewVal, { color: c.urgent }]}>{byeCount} BYE slot{byeCount > 1 ? 's' : ''} in first round</Text>
          )}
        </View>
      </AccordionSection>

      {/* Match rules */}
      <AccordionSection title="Match Rules" icon="golf-outline" iconColor={c.teal} defaultOpen>
        <View style={{ gap: 4 }}>
          <Text style={[styles.reviewVal, { color: c.text }]}>{bracketMatchLength} holes per match</Text>
          <Text style={[styles.reviewVal, { color: c.text }]}>Handicap: {hcpLabels[bracketHandicap]}</Text>
          <Text style={[styles.reviewVal, { color: c.text }]}>Scoring: {scoringLabels[bracketScoringMethod]}</Text>
          <Text style={[styles.reviewVal, { color: c.textMuted }]}>{roundDeadlineDays} days to complete each round</Text>
        </View>
      </AccordionSection>

      {/* Members */}
      <AccordionSection title={`Members (${totalPlayerCount})`} icon="people" iconColor={c.teal} defaultOpen>
        <View style={styles.reviewAvatarRow}>
          <View style={styles.reviewAvatarItem}>
            <View style={[styles.reviewAvatarCircle, { backgroundColor: c.teal + '33' }]}>
              <Ionicons name="person" size={18} color={c.teal} />
            </View>
            <Text style={[styles.reviewAvatarName, { color: c.teal }]} numberOfLines={1}>You</Text>
          </View>
          {allPlayers.map((m) => (
            <View key={m.id} style={styles.reviewAvatarItem}>
              <Avatar id={m.id} name={m.name} size={40} />
              <Text style={[styles.reviewAvatarName, { color: c.text }]} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
            </View>
          ))}
          {manualPlayers.map((m) => (
            <View key={m.id} style={styles.reviewAvatarItem}>
              <View style={[styles.reviewAvatarCircle, { backgroundColor: c.elevated }]}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.textMuted }}>{m.name.charAt(0)}</Text>
              </View>
              <Text style={[styles.reviewAvatarName, { color: c.text }]} numberOfLines={1}>{m.name}</Text>
            </View>
          ))}
        </View>
      </AccordionSection>
    </ScrollView>
  );
}

// ─── Stroke Play Series types ────────────────────────────────────────
type StrokeScoringType = 'gross' | 'net' | 'both';
type StrokeTiebreaker = 'scorecard' | 'most_recent' | 'co_champions';
type StrokeCourseRestriction = 'any' | 'same' | 'rotating';

// ─── Stroke Play Series: Step 2 — Format & Length ───────────────────
function StrokeFormatStep({
  strokeRounds,
  setStrokeRounds,
  strokeScoring,
  setStrokeScoring,
  strokeTiebreaker,
  setStrokeTiebreaker,
}: {
  strokeRounds: number;
  setStrokeRounds: (v: number) => void;
  strokeScoring: StrokeScoringType;
  setStrokeScoring: (v: StrokeScoringType) => void;
  strokeTiebreaker: StrokeTiebreaker;
  setStrokeTiebreaker: (v: StrokeTiebreaker) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const TIEBREAKER_OPTIONS: { key: StrokeTiebreaker; label: string; desc: string }[] = [
    { key: 'scorecard', label: 'Scorecard Playoff', desc: 'Compare back 9, then back 6, then back 3, then 18th hole' },
    { key: 'most_recent', label: 'Most Recent Round', desc: 'Lower score in the final round wins' },
    { key: 'co_champions', label: 'Co-Champions', desc: 'No tiebreaker — share the title' },
  ];

  return (
    <View style={styles.stepContent}>
      {/* Season Length */}
      <Text style={[styles.fieldLabel, { color: c.text }]}>Number of Rounds</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        Total rounds in the series. Players accumulate strokes across all rounds.
      </Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => { if (strokeRounds > 4) { haptics.light(); setStrokeRounds(strokeRounds - 1); } }}
          style={[styles.stepperBtn, { backgroundColor: c.elevated, opacity: strokeRounds <= 4 ? 0.4 : 1 }]}
        >
          <Ionicons name="remove" size={18} color={c.text} />
        </Pressable>
        <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{strokeRounds}</Text>
        <Text style={[styles.stepperUnit, { color: c.textMuted }]}>rounds</Text>
        <Pressable
          onPress={() => { if (strokeRounds < 20) { haptics.light(); setStrokeRounds(strokeRounds + 1); } }}
          style={[styles.stepperBtn, { backgroundColor: c.elevated, opacity: strokeRounds >= 20 ? 0.4 : 1 }]}
        >
          <Ionicons name="add" size={18} color={c.text} />
        </Pressable>
      </View>

      {/* Scoring Type */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 24 }]}>Scoring Type</Text>
      {(['net', 'gross'] as const).map((opt) => {
        const isActive = strokeScoring === opt;
        const label = opt === 'net' ? 'Net Strokes' : 'Gross Strokes';
        const desc = opt === 'net'
          ? 'Handicap-adjusted scores — levels the playing field'
          : 'Raw scores, no handicap adjustment';
        return (
          <Pressable
            key={opt}
            onPress={() => { haptics.light(); setStrokeScoring(opt); }}
            style={[styles.strokeRadioRow, { backgroundColor: isActive ? c.teal + '12' : c.elevated, borderColor: isActive ? c.teal : c.border, borderWidth: 1, marginBottom: 8 }]}
          >
            <View style={[styles.strokeRadioOuter, { borderColor: isActive ? c.teal : c.textMuted }]}>
              {isActive && <View style={[styles.strokeRadioInner, { backgroundColor: c.teal }]} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.strokeRadioLabel, { color: isActive ? c.text : c.textMuted }]}>{label}</Text>
              <Text style={[styles.strokeRadioDesc, { color: c.textMuted }]}>{desc}</Text>
            </View>
          </Pressable>
        );
      })}

      {/* Tiebreaker */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 24 }]}>Tiebreaker</Text>
      {TIEBREAKER_OPTIONS.map((opt) => {
        const isActive = strokeTiebreaker === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => { haptics.light(); setStrokeTiebreaker(opt.key); }}
            style={[styles.strokeRadioRow, { backgroundColor: isActive ? c.gold + '12' : c.elevated, borderColor: isActive ? c.gold : c.border, borderWidth: 1, marginBottom: 8 }]}
          >
            <View style={[styles.strokeRadioOuter, { borderColor: isActive ? c.gold : c.textMuted }]}>
              {isActive && <View style={[styles.strokeRadioInner, { backgroundColor: c.gold }]} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.strokeRadioLabel, { color: isActive ? c.text : c.textMuted }]}>{opt.label}</Text>
              <Text style={[styles.strokeRadioDesc, { color: c.textMuted }]}>{opt.desc}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Stroke Play Series: Step 3 — Round Policies ────────────────────
function StrokePoliciesStep({
  strokeLimitRounds,
  setStrokeLimitRounds,
  strokeMaxRoundsPerWeek,
  setStrokeMaxRoundsPerWeek,
  strokeDropWorst,
  setStrokeDropWorst,
  strokeDropCount,
  setStrokeDropCount,
  strokeCourseRestriction,
  setStrokeCourseRestriction,
  strokeDesignatedCourseId,
  setStrokeDesignatedCourseId,
  strokeDesignatedCourseName,
  setStrokeDesignatedCourseName,
}: {
  strokeLimitRounds: boolean;
  setStrokeLimitRounds: (v: boolean) => void;
  strokeMaxRoundsPerWeek: number;
  setStrokeMaxRoundsPerWeek: (v: number) => void;
  strokeDropWorst: boolean;
  setStrokeDropWorst: (v: boolean) => void;
  strokeDropCount: number;
  setStrokeDropCount: (v: number) => void;
  strokeCourseRestriction: StrokeCourseRestriction;
  setStrokeCourseRestriction: (v: StrokeCourseRestriction) => void;
  strokeDesignatedCourseId: string | null;
  setStrokeDesignatedCourseId: (v: string | null) => void;
  strokeDesignatedCourseName: string | null;
  setStrokeDesignatedCourseName: (v: string | null) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const COURSE_OPTIONS: { key: StrokeCourseRestriction; label: string; desc: string }[] = [
    { key: 'any', label: 'Any Course', desc: 'Players can play any course each round' },
    { key: 'same', label: 'Same Course', desc: 'All rounds played at one designated course' },
    { key: 'rotating', label: 'Rotating Courses', desc: 'Commissioner assigns a course per round' },
  ];

  return (
    <View style={styles.stepContent}>
      {/* Rounds Per Week */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Limit Rounds Per Week</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Prevents grinding multiple rounds in one week
          </Text>
        </View>
        <Switch
          value={strokeLimitRounds}
          onValueChange={setStrokeLimitRounds}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={strokeLimitRounds ? c.teal : c.textMuted}
        />
      </View>
      {strokeLimitRounds && (
        <View style={[styles.dnsOptions, { backgroundColor: c.elevated }]}>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>Max rounds per week</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => { haptics.light(); setStrokeMaxRoundsPerWeek(Math.max(1, strokeMaxRoundsPerWeek - 1)); }}>
                <Ionicons name="remove-circle-outline" size={24} color={strokeMaxRoundsPerWeek <= 1 ? c.border : c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{strokeMaxRoundsPerWeek}</Text>
              <Pressable onPress={() => { haptics.light(); setStrokeMaxRoundsPerWeek(Math.min(3, strokeMaxRoundsPerWeek + 1)); }}>
                <Ionicons name="add-circle-outline" size={24} color={strokeMaxRoundsPerWeek >= 3 ? c.border : c.teal} />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Drop Worst Round */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border, marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Drop Worst Round</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Your worst round(s) won't count toward total
          </Text>
        </View>
        <Switch
          value={strokeDropWorst}
          onValueChange={setStrokeDropWorst}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={strokeDropWorst ? c.teal : c.textMuted}
        />
      </View>
      {strokeDropWorst && (
        <View style={[styles.dnsOptions, { backgroundColor: c.elevated }]}>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>Rounds to drop</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => { haptics.light(); setStrokeDropCount(Math.max(1, strokeDropCount - 1)); }}>
                <Ionicons name="remove-circle-outline" size={24} color={strokeDropCount <= 1 ? c.border : c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{strokeDropCount}</Text>
              <Pressable onPress={() => { haptics.light(); setStrokeDropCount(Math.min(3, strokeDropCount + 1)); }}>
                <Ionicons name="add-circle-outline" size={24} color={strokeDropCount >= 3 ? c.border : c.teal} />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Course Restrictions */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 24 }]}>Course Restrictions</Text>
      {COURSE_OPTIONS.map((opt) => {
        const isActive = strokeCourseRestriction === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => { haptics.light(); setStrokeCourseRestriction(opt.key); }}
            style={[styles.strokeRadioRow, { backgroundColor: isActive ? c.teal + '12' : c.elevated, borderColor: isActive ? c.teal : c.border, borderWidth: 1, marginBottom: 8 }]}
          >
            <View style={[styles.strokeRadioOuter, { borderColor: isActive ? c.teal : c.textMuted }]}>
              {isActive && <View style={[styles.strokeRadioInner, { backgroundColor: c.teal }]} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.strokeRadioLabel, { color: isActive ? c.text : c.textMuted }]}>{opt.label}</Text>
              <Text style={[styles.strokeRadioDesc, { color: c.textMuted }]}>{opt.desc}</Text>
            </View>
          </Pressable>
        );
      })}

      {/* Designated course selector for "same" restriction */}
      {strokeCourseRestriction === 'same' && (
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 8 }]}>Select course</Text>
          <View style={styles.pillRow}>
            {SUGGESTED_COURSES_FLAT.map((course) => {
              const isActive = strokeDesignatedCourseId === course.id;
              return (
                <Pressable
                  key={course.id}
                  onPress={() => {
                    haptics.light();
                    setStrokeDesignatedCourseId(course.id);
                    setStrokeDesignatedCourseName(course.name);
                  }}
                  style={[styles.pill, { backgroundColor: isActive ? c.teal + '22' : c.elevated, borderColor: isActive ? c.teal : 'transparent', borderWidth: 1 }]}
                >
                  <Text style={[styles.pillText, { color: isActive ? c.teal : c.textMuted }]}>{course.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Stroke Play Series: Step 5 — Review ────────────────────────────
function StrokeSeriesReviewStep({
  name,
  strokeRounds,
  strokeScoring,
  strokeTiebreaker,
  strokeLimitRounds,
  strokeMaxRoundsPerWeek,
  strokeDropWorst,
  strokeDropCount,
  strokeCourseRestriction,
  strokeDesignatedCourseName,
  selectedIds,
  manualPlayers,
}: {
  name: string;
  strokeRounds: number;
  strokeScoring: StrokeScoringType;
  strokeTiebreaker: StrokeTiebreaker;
  strokeLimitRounds: boolean;
  strokeMaxRoundsPerWeek: number;
  strokeDropWorst: boolean;
  strokeDropCount: number;
  strokeCourseRestriction: StrokeCourseRestriction;
  strokeDesignatedCourseName: string | null;
  selectedIds: string[];
  manualPlayers: ManualPlayer[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const allPlayers = MOCK_FRIENDS.filter((f) => selectedIds.includes(f.id));
  const scoringLabels: Record<StrokeScoringType, string> = { gross: 'Gross Strokes', net: 'Net Strokes', both: 'Gross + Net' };
  const tiebreakerLabels: Record<StrokeTiebreaker, string> = {
    scorecard: 'Scorecard Playoff',
    most_recent: 'Most Recent Round',
    co_champions: 'Co-Champions',
  };
  const courseLabels: Record<StrokeCourseRestriction, string> = {
    any: 'Any Course',
    same: 'Same Course Each Round',
    rotating: 'Rotating Courses',
  };

  const totalPlayers = allPlayers.length + manualPlayers.length + 1;

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Trophy header */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Ionicons name="trophy" size={40} color={c.gold} style={{ marginBottom: 8 }} />
        <Text style={{ fontSize: 28, fontWeight: '700', color: c.gold, fontFamily: GEO, textAlign: 'center' }}>{name}</Text>
        <Text style={{ fontSize: 14, color: c.textMuted, marginTop: 6 }}>Stroke Play Series</Text>
      </View>

      {/* Season Summary */}
      <AccordionSection title="Season Summary" icon="document-text-outline" iconColor={c.teal} defaultOpen>
        <Text style={[styles.reviewVal, { color: c.text }]}>{strokeRounds} rounds</Text>
        <Text style={[styles.reviewVal, { color: c.text }]}>{scoringLabels[strokeScoring]}</Text>
        <Text style={[styles.reviewVal, { color: c.textMuted }]}>Tiebreaker: {tiebreakerLabels[strokeTiebreaker]}</Text>
      </AccordionSection>

      {/* Policies */}
      <AccordionSection title="Policies" icon="settings-outline" iconColor={c.gold} defaultOpen>
        {strokeLimitRounds && (
          <Text style={[styles.reviewVal, { color: c.text }]}>Max {strokeMaxRoundsPerWeek} round{strokeMaxRoundsPerWeek > 1 ? 's' : ''} per week</Text>
        )}
        {!strokeLimitRounds && (
          <Text style={[styles.reviewVal, { color: c.textMuted }]}>No weekly round limit</Text>
        )}
        {strokeDropWorst ? (
          <Text style={[styles.reviewVal, { color: c.text }]}>Drop worst {strokeDropCount} round{strokeDropCount > 1 ? 's' : ''}</Text>
        ) : (
          <Text style={[styles.reviewVal, { color: c.textMuted }]}>All rounds count</Text>
        )}
        <Text style={[styles.reviewVal, { color: c.text }]}>
          {courseLabels[strokeCourseRestriction]}
          {strokeCourseRestriction === 'same' && strokeDesignatedCourseName ? ` — ${strokeDesignatedCourseName}` : ''}
        </Text>
      </AccordionSection>

      {/* Members */}
      <AccordionSection title={`Members (${totalPlayers})`} icon="people" iconColor={c.teal} defaultOpen>
        <View style={styles.reviewAvatarRow}>
          <View style={styles.reviewAvatarItem}>
            <View style={[styles.reviewAvatarCircle, { backgroundColor: c.teal + '33' }]}>
              <Ionicons name="person" size={18} color={c.teal} />
            </View>
            <Text style={[styles.reviewAvatarName, { color: c.teal }]} numberOfLines={1}>You</Text>
          </View>
          {allPlayers.map((m) => (
            <View key={m.id} style={styles.reviewAvatarItem}>
              <Avatar id={m.id} name={m.name} size={40} />
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.reviewAvatarName, { color: c.text }]} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
                {strokeScoring === 'net' && (
                  <Text style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>HCP {m.handicap}</Text>
                )}
              </View>
            </View>
          ))}
          {manualPlayers.map((m) => (
            <View key={m.id} style={styles.reviewAvatarItem}>
              <View style={[styles.reviewAvatarCircle, { backgroundColor: c.teal + '22' }]}>
                <Ionicons name="person-add" size={16} color={c.teal} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.reviewAvatarName, { color: c.text }]} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
                {strokeScoring === 'net' && m.handicap !== null && (
                  <Text style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>HCP {m.handicap}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </AccordionSection>
    </ScrollView>
  );
}

// ─── League: Step 2 — Structure & Divisions ─────────────────────────
type LeagueDivisionGames = 'once' | 'twice';

const DIVISION_DEFAULTS: Record<number, string[]> = {
  2: ['East', 'West'],
  3: ['East', 'West', 'South'],
  4: ['East', 'West', 'North', 'South'],
};

function LeagueStructureStep({
  leagueDivisions,
  setLeagueDivisions,
  leagueDivisionCount,
  setLeagueDivisionCount,
  leagueDivisionNames,
  setLeagueDivisionNames,
  leagueAutoBalance,
  setLeagueAutoBalance,
}: {
  leagueDivisions: boolean;
  setLeagueDivisions: (v: boolean) => void;
  leagueDivisionCount: number;
  setLeagueDivisionCount: (v: number) => void;
  leagueDivisionNames: string[];
  setLeagueDivisionNames: (v: string[]) => void;
  leagueAutoBalance: boolean;
  setLeagueAutoBalance: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const inputBg = theme.isDark ? c.elevated : '#FFFFFF';

  const handleDivisionCountChange = (count: number) => {
    haptics.light();
    setLeagueDivisionCount(count);
    const defaults = DIVISION_DEFAULTS[count] ?? [];
    const newNames = [...defaults];
    // Preserve custom names if they exist
    for (let i = 0; i < Math.min(count, leagueDivisionNames.length); i++) {
      if (leagueDivisionNames[i] && leagueDivisionNames[i] !== DIVISION_DEFAULTS[leagueDivisionCount]?.[i]) {
        newNames[i] = leagueDivisionNames[i];
      }
    }
    setLeagueDivisionNames(newNames);
  };

  const handleNameChange = (index: number, value: string) => {
    const updated = [...leagueDivisionNames];
    updated[index] = value;
    setLeagueDivisionNames(updated);
  };

  return (
    <View style={styles.stepContent}>
      {/* Number of Players info */}
      <View style={[styles.explanationCard, { backgroundColor: c.gold + '12', borderColor: c.gold + '33' }]}>
        <Ionicons name="information-circle" size={18} color={c.gold} />
        <Text style={{ fontSize: 13, color: c.textMuted, flex: 1 }}>
          Players are added in the Members step. Recommended: 8-16 players for best division balance.
        </Text>
      </View>

      {/* Divisions toggle */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border, marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Enable Divisions</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Split players into divisions for balanced scheduling
          </Text>
        </View>
        <Switch
          value={leagueDivisions}
          onValueChange={setLeagueDivisions}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={leagueDivisions ? c.teal : c.textMuted}
        />
      </View>

      {leagueDivisions ? (
        <>
          {/* Number of divisions */}
          <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Number of Divisions</Text>
          <View style={styles.pillRow}>
            {[2, 3, 4].map((count) => {
              const isActive = leagueDivisionCount === count;
              return (
                <Pressable
                  key={count}
                  onPress={() => handleDivisionCountChange(count)}
                  style={[styles.pill, { backgroundColor: isActive ? c.teal + '22' : c.elevated, borderColor: isActive ? c.teal : 'transparent', borderWidth: 1, paddingHorizontal: 20 }]}
                >
                  <Text style={[styles.pillText, { color: isActive ? c.teal : c.textMuted }]}>{count}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Division names */}
          <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Division Names</Text>
          {leagueDivisionNames.slice(0, leagueDivisionCount).map((divName, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 28, height: 28, backgroundColor: c.teal + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: c.teal, fontFamily: GEO }}>{i + 1}</Text>
              </View>
              <TextInput
                value={divName}
                onChangeText={(val) => handleNameChange(i, val)}
                placeholder={`Division ${i + 1}`}
                placeholderTextColor={c.textMuted}
                style={[styles.input, { backgroundColor: inputBg, color: c.text, borderColor: c.border, flex: 1, paddingVertical: 10 }]}
              />
            </View>
          ))}

          {/* Auto-balance */}
          <View style={[styles.ruleRow, { borderBottomColor: c.border, marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ruleLabel, { color: c.text }]}>Auto-Balance by Handicap</Text>
              <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
                Distribute players evenly so divisions have similar skill levels
              </Text>
            </View>
            <Switch
              value={leagueAutoBalance}
              onValueChange={setLeagueAutoBalance}
              trackColor={{ false: c.elevated, true: c.teal + '66' }}
              thumbColor={leagueAutoBalance ? c.teal : c.textMuted}
            />
          </View>

          <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 8, fontStyle: 'italic' }}>
            Players distributed evenly across divisions, balanced by handicap
          </Text>
        </>
      ) : (
        <View style={[styles.explanationCard, { backgroundColor: c.elevated, borderColor: c.border, marginTop: 12 }]}>
          <Ionicons name="refresh" size={18} color={c.teal} />
          <Text style={{ fontSize: 13, color: c.textMuted, flex: 1 }}>
            Round-robin format — each player faces every other player over the season
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── League: Step 3 — Schedule ──────────────────────────────────────
function LeagueScheduleStep({
  leagueWeeks,
  setLeagueWeeks,
  leagueDivisions,
  leagueDivisionCount,
  leagueDivisionGames,
  setLeagueDivisionGames,
  leagueCrossDivision,
  setLeagueCrossDivision,
  leagueRivalryWeek,
  setLeagueRivalryWeek,
  leagueSchedulePreview,
  setLeagueSchedulePreview,
  selectedIds,
  manualPlayers,
  leagueDivisionNames,
}: {
  leagueWeeks: number;
  setLeagueWeeks: (v: number) => void;
  leagueDivisions: boolean;
  leagueDivisionCount: number;
  leagueDivisionGames: LeagueDivisionGames;
  setLeagueDivisionGames: (v: LeagueDivisionGames) => void;
  leagueCrossDivision: boolean;
  setLeagueCrossDivision: (v: boolean) => void;
  leagueRivalryWeek: boolean;
  setLeagueRivalryWeek: (v: boolean) => void;
  leagueSchedulePreview: { week: number; matchups: { a: string; b: string }[] }[];
  setLeagueSchedulePreview: (v: { week: number; matchups: { a: string; b: string }[] }[]) => void;
  selectedIds: string[];
  manualPlayers: ManualPlayer[];
  leagueDivisionNames: string[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const totalPlayers = selectedIds.length + manualPlayers.length + 1; // +1 for self
  const playersPerDivision = leagueDivisions && leagueDivisionCount > 0
    ? Math.ceil(totalPlayers / leagueDivisionCount) : totalPlayers;
  const divisionOpponents = leagueDivisions ? playersPerDivision - 1 : totalPlayers - 1;
  const divisionGamesNeeded = leagueDivisionGames === 'twice' ? divisionOpponents * 2 : divisionOpponents;
  const gamesPerPlayer = leagueWeeks;

  // Build a helper text about games
  const scheduleHelper = leagueDivisions
    ? `~${playersPerDivision} per division · ${divisionGamesNeeded} division game${divisionGamesNeeded !== 1 ? 's' : ''} · ${Math.max(0, gamesPerPlayer - divisionGamesNeeded)} cross-division`
    : `${totalPlayers} players · Round-robin across ${leagueWeeks} weeks`;

  // Generate schedule preview
  const generatePreview = () => {
    haptics.light();
    const allNames = ['You', ...MOCK_FRIENDS.filter((f) => selectedIds.includes(f.id)).map((f) => f.name.split(' ')[0]), ...manualPlayers.map((m) => m.name.split(' ')[0])];
    const players = allNames.slice(0, Math.max(4, allNames.length));
    const schedule: { week: number; matchups: { a: string; b: string }[] }[] = [];

    // Simple round-robin generation
    const n = players.length;
    const isOdd = n % 2 !== 0;
    const pool = [...players];
    if (isOdd) pool.push('BYE');
    const size = pool.length;

    for (let wk = 0; wk < leagueWeeks; wk++) {
      const round = wk % (size - 1);
      const matchups: { a: string; b: string }[] = [];
      // Rotate the array (keep first element fixed)
      const rotated = [pool[0]];
      for (let i = 1; i < size; i++) {
        const idx = ((i - 1 + round) % (size - 1)) + 1;
        rotated.push(pool[idx]);
      }
      for (let i = 0; i < size / 2; i++) {
        const a = rotated[i];
        const b = rotated[size - 1 - i];
        if (a !== 'BYE' && b !== 'BYE') {
          matchups.push({ a, b });
        }
      }
      schedule.push({ week: wk + 1, matchups });
    }
    setLeagueSchedulePreview(schedule);
  };

  return (
    <View style={styles.stepContent}>
      {/* Regular season length */}
      <Text style={[styles.fieldLabel, { color: c.text }]}>Regular Season Length</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        Number of weeks of head-to-head matchups
      </Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => { if (leagueWeeks > 6) { haptics.light(); setLeagueWeeks(leagueWeeks - 1); setLeagueSchedulePreview([]); } }}
          style={[styles.stepperBtn, { backgroundColor: c.elevated, opacity: leagueWeeks <= 6 ? 0.4 : 1 }]}
        >
          <Ionicons name="remove" size={18} color={c.text} />
        </Pressable>
        <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{leagueWeeks}</Text>
        <Text style={[styles.stepperUnit, { color: c.textMuted }]}>weeks</Text>
        <Pressable
          onPress={() => { if (leagueWeeks < 16) { haptics.light(); setLeagueWeeks(leagueWeeks + 1); setLeagueSchedulePreview([]); } }}
          style={[styles.stepperBtn, { backgroundColor: c.elevated, opacity: leagueWeeks >= 16 ? 0.4 : 1 }]}
        >
          <Ionicons name="add" size={18} color={c.text} />
        </Pressable>
      </View>

      <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 6 }}>
        {scheduleHelper}
      </Text>

      {/* Matchup Rules — division mode only */}
      {leagueDivisions && (
        <>
          <Text style={[styles.fieldLabel, { color: c.text, marginTop: 24 }]}>Matchup Rules</Text>

          {/* Division games frequency */}
          <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 8 }]}>Play division opponents</Text>
          {(['once', 'twice'] as const).map((opt) => {
            const isActive = leagueDivisionGames === opt;
            const label = opt === 'once' ? 'Once' : 'Twice';
            const desc = opt === 'once'
              ? 'Face each division rival one time during the season'
              : 'Home and away — play each division rival twice';
            return (
              <Pressable
                key={opt}
                onPress={() => { haptics.light(); setLeagueDivisionGames(opt); setLeagueSchedulePreview([]); }}
                style={[styles.strokeRadioRow, { backgroundColor: isActive ? c.teal + '12' : c.elevated, borderColor: isActive ? c.teal : c.border, borderWidth: 1, marginBottom: 8 }]}
              >
                <View style={[styles.strokeRadioOuter, { borderColor: isActive ? c.teal : c.textMuted }]}>
                  {isActive && <View style={[styles.strokeRadioInner, { backgroundColor: c.teal }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.strokeRadioLabel, { color: isActive ? c.text : c.textMuted }]}>{label}</Text>
                  <Text style={[styles.strokeRadioDesc, { color: c.textMuted }]}>{desc}</Text>
                </View>
              </Pressable>
            );
          })}

          {/* Cross-division games */}
          <View style={[styles.ruleRow, { borderBottomColor: c.border, marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.ruleLabel, { color: c.text }]}>Cross-Division Games</Text>
              <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
                Cross-division games fill remaining weeks after division play
              </Text>
            </View>
            <Switch
              value={leagueCrossDivision}
              onValueChange={(v) => { setLeagueCrossDivision(v); setLeagueSchedulePreview([]); }}
              trackColor={{ false: c.elevated, true: c.teal + '66' }}
              thumbColor={leagueCrossDivision ? c.teal : c.textMuted}
            />
          </View>
        </>
      )}

      {/* Rivalry week */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border, marginTop: leagueDivisions ? 0 : 20 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Rivalry Week</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Commissioner assigns marquee matchups for one special week
          </Text>
        </View>
        <Switch
          value={leagueRivalryWeek}
          onValueChange={setLeagueRivalryWeek}
          trackColor={{ false: c.elevated, true: c.gold + '66' }}
          thumbColor={leagueRivalryWeek ? c.gold : c.textMuted}
        />
      </View>

      {/* Schedule Preview */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 24 }]}>Schedule Preview</Text>
      <Pressable
        onPress={generatePreview}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: c.elevated, marginBottom: 12 }}
      >
        <Ionicons name={leagueSchedulePreview.length > 0 ? 'refresh' : 'calendar-outline'} size={18} color={c.teal} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.teal }}>
          {leagueSchedulePreview.length > 0 ? 'Regenerate Schedule' : 'Generate Preview'}
        </Text>
      </Pressable>

      {leagueSchedulePreview.length > 0 && (
        <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {leagueSchedulePreview.map((wk) => (
            <View key={wk.week} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: c.gold, fontFamily: GEO, letterSpacing: 1 }}>
                  WEEK {wk.week}
                </Text>
                {leagueRivalryWeek && wk.week === Math.ceil(leagueWeeks / 2) && (
                  <View style={{ backgroundColor: c.gold + '22', paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: c.gold, letterSpacing: 1 }}>RIVALRY</Text>
                  </View>
                )}
              </View>
              {wk.matchups.map((m, mi) => (
                <View
                  key={mi}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: c.elevated, marginBottom: 2 }}
                >
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: c.text }}>{m.a}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: c.textMuted, marginHorizontal: 8 }}>vs</Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: c.text, textAlign: 'right' }}>{m.b}</Text>
                </View>
              ))}
            </View>
          ))}
          <Text style={{ fontSize: 11, color: c.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 4, marginBottom: 12 }}>
            Commissioner can edit matchups before season starts
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

// ─── League: Step 4 — Scoring & Playoffs ────────────────────────────
type LeagueWinDetermination = 'stableford' | 'strokes' | 'holes';

function LeagueScoringStep({
  leagueScoringFormat,
  setLeagueScoringFormat,
  leagueSameFormatAllSeason,
  setLeagueSameFormatAllSeason,
  leagueWinDetermination,
  setLeagueWinDetermination,
  leagueMarginBonus,
  setLeagueMarginBonus,
  leagueMarginThreshold,
  setLeagueMarginThreshold,
  leaguePlayoffTeams,
  setLeaguePlayoffTeams,
  leagueChampionshipFormat,
  setLeagueChampionshipFormat,
  leagueDivisions,
  leagueDivisionCount,
  leagueWeeks,
}: {
  leagueScoringFormat: string;
  setLeagueScoringFormat: (v: string) => void;
  leagueSameFormatAllSeason: boolean;
  setLeagueSameFormatAllSeason: (v: boolean) => void;
  leagueWinDetermination: LeagueWinDetermination;
  setLeagueWinDetermination: (v: LeagueWinDetermination) => void;
  leagueMarginBonus: boolean;
  setLeagueMarginBonus: (v: boolean) => void;
  leagueMarginThreshold: number;
  setLeagueMarginThreshold: (v: number) => void;
  leaguePlayoffTeams: 2 | 4 | 6 | 8;
  setLeaguePlayoffTeams: (v: 2 | 4 | 6 | 8) => void;
  leagueChampionshipFormat: string;
  setLeagueChampionshipFormat: (v: string) => void;
  leagueDivisions: boolean;
  leagueDivisionCount: number;
  leagueWeeks: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const WIN_OPTIONS: { key: LeagueWinDetermination; label: string; desc: string }[] = [
    { key: 'stableford', label: 'Higher Stableford Points Wins', desc: 'Best for Stableford, Mod. Stableford, and Quota formats' },
    { key: 'strokes', label: 'Lower Net Strokes Wins', desc: 'Best for Stroke (Net), Stroke (Gross), and Best 9 formats' },
    { key: 'holes', label: 'More Holes Won', desc: 'Match play style — count holes won within the matchup round' },
  ];

  // Calculate playoff weeks based on teams
  const playoffRounds = Math.ceil(Math.log2(leaguePlayoffTeams));
  const divisionWinners = leagueDivisions ? leagueDivisionCount : 0;
  const wildCards = Math.max(0, leaguePlayoffTeams - divisionWinners);

  return (
    <View style={styles.stepContent}>
      {/* Section 1 — How Matchups Work */}
      <View style={[styles.explanationCard, { backgroundColor: c.gold + '12', borderColor: c.gold + '33', marginBottom: 16 }]}>
        <Ionicons name="information-circle" size={18} color={c.gold} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: c.gold }}>How Matchups Work</Text>
          <Text style={{ fontSize: 12, color: c.textMuted }}>Each week you play ONE opponent</Text>
          <Text style={{ fontSize: 12, color: c.textMuted }}>Better score wins the matchup (1 Win)</Text>
          <Text style={{ fontSize: 12, color: c.textMuted }}>Worse score loses (1 Loss)</Text>
          <Text style={{ fontSize: 12, color: c.textMuted }}>Ties: Both players receive 0.5 Win and 0.5 Loss</Text>
        </View>
      </View>

      {/* Section 2 — Scoring Format */}
      <Text style={[styles.fieldLabel, { color: c.text }]}>Scoring Format</Text>

      <View style={[styles.ruleRow, { borderBottomColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Same Format All Season</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Every week uses the same scoring format
          </Text>
        </View>
        <Switch
          value={leagueSameFormatAllSeason}
          onValueChange={setLeagueSameFormatAllSeason}
          trackColor={{ false: c.elevated, true: c.teal + '66' }}
          thumbColor={leagueSameFormatAllSeason ? c.teal : c.textMuted}
        />
      </View>

      {leagueSameFormatAllSeason ? (
        <View style={{ marginTop: 8 }}>
          <View style={styles.pillRow}>
            {ALL_FORMATS.map((fmt) => {
              const isActive = leagueScoringFormat === fmt;
              return (
                <Pressable
                  key={fmt}
                  onPress={() => { haptics.light(); setLeagueScoringFormat(fmt); }}
                  style={[styles.pill, { backgroundColor: isActive ? c.teal + '22' : c.elevated, borderColor: isActive ? c.teal : 'transparent', borderWidth: 1 }]}
                >
                  <Text style={[styles.pillText, { color: isActive ? c.teal : c.textMuted }]}>{FORMAT_LABELS[fmt]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={[styles.explanationCard, { backgroundColor: c.elevated, borderColor: c.border, marginTop: 8 }]}>
          <Ionicons name="create-outline" size={18} color={c.teal} />
          <Text style={{ fontSize: 13, color: c.textMuted, flex: 1 }}>
            Commissioner assigns the format each week before matchups begin
          </Text>
        </View>
      )}

      {/* Section 3 — Win Determination */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 24 }]}>Win Determination</Text>
      {WIN_OPTIONS.map((opt) => {
        const isActive = leagueWinDetermination === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => { haptics.light(); setLeagueWinDetermination(opt.key); }}
            style={[styles.strokeRadioRow, { backgroundColor: isActive ? c.teal + '12' : c.elevated, borderColor: isActive ? c.teal : c.border, borderWidth: 1, marginBottom: 8 }]}
          >
            <View style={[styles.strokeRadioOuter, { borderColor: isActive ? c.teal : c.textMuted }]}>
              {isActive && <View style={[styles.strokeRadioInner, { backgroundColor: c.teal }]} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.strokeRadioLabel, { color: isActive ? c.text : c.textMuted }]}>{opt.label}</Text>
              <Text style={[styles.strokeRadioDesc, { color: c.textMuted }]}>{opt.desc}</Text>
            </View>
          </Pressable>
        );
      })}

      {/* Section 4 — Margin Bonus */}
      <View style={[styles.ruleRow, { borderBottomColor: c.border, marginTop: 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleLabel, { color: c.text }]}>Margin Bonus</Text>
          <Text style={[styles.ruleDesc, { color: c.textMuted }]}>
            Award bonus credit for dominant wins
          </Text>
        </View>
        <Switch
          value={leagueMarginBonus}
          onValueChange={setLeagueMarginBonus}
          trackColor={{ false: c.elevated, true: c.gold + '66' }}
          thumbColor={leagueMarginBonus ? c.gold : c.textMuted}
        />
      </View>
      {leagueMarginBonus && (
        <View style={[styles.dnsOptions, { backgroundColor: c.elevated }]}>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>Win by more than</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => { haptics.light(); setLeagueMarginThreshold(Math.max(5, leagueMarginThreshold - 5)); }}>
                <Ionicons name="remove-circle-outline" size={24} color={leagueMarginThreshold <= 5 ? c.border : c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{leagueMarginThreshold}</Text>
              <Text style={[styles.stepperUnit, { color: c.textMuted }]}>pts</Text>
              <Pressable onPress={() => { haptics.light(); setLeagueMarginThreshold(Math.min(20, leagueMarginThreshold + 5)); }}>
                <Ionicons name="add-circle-outline" size={24} color={leagueMarginThreshold >= 20 ? c.border : c.gold} />
              </Pressable>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>
            Win by {leagueMarginThreshold}+ points = 1.5 wins instead of 1
          </Text>
        </View>
      )}

      {/* Section 5 — Playoff Structure */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 24 }]}>Playoff Structure</Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 10 }]}>
        Number of teams that qualify for the postseason
      </Text>
      <View style={styles.pillRow}>
        {([2, 4, 6, 8] as const).map((count) => {
          const isActive = leaguePlayoffTeams === count;
          return (
            <Pressable
              key={count}
              onPress={() => { haptics.light(); setLeaguePlayoffTeams(count); }}
              style={[styles.pill, { backgroundColor: isActive ? c.gold + '22' : c.elevated, borderColor: isActive ? c.gold : 'transparent', borderWidth: 1, paddingHorizontal: 18 }]}
            >
              <Text style={[styles.pillText, { color: isActive ? c.gold : c.textMuted }]}>{count}</Text>
            </Pressable>
          );
        })}
      </View>

      {leagueDivisions && divisionWinners > 0 && (
        <View style={{ marginTop: 10, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="shield-checkmark" size={14} color={c.teal} />
            <Text style={{ fontSize: 12, color: c.textMuted }}>
              {divisionWinners} division winner{divisionWinners > 1 ? 's' : ''} automatically qualify
            </Text>
          </View>
          {wildCards > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="ticket" size={14} color={c.gold} />
              <Text style={{ fontSize: 12, color: c.textMuted }}>
                {wildCards} wild card spot{wildCards > 1 ? 's' : ''} go to best records among non-winners
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="list" size={14} color={c.textMuted} />
            <Text style={{ fontSize: 12, color: c.textMuted }}>
              Division winners get top seeds, then by record
            </Text>
          </View>
        </View>
      )}

      {!leagueDivisions && (
        <View style={{ marginTop: 10, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="list" size={14} color={c.teal} />
            <Text style={{ fontSize: 12, color: c.textMuted }}>
              Top {leaguePlayoffTeams} players by record qualify, seeded by wins
            </Text>
          </View>
        </View>
      )}

      {/* Section 6 — Playoff Format */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 24 }]}>Playoff Format</Text>
      <View style={[styles.explanationCard, { backgroundColor: c.elevated, borderColor: c.border, marginBottom: 8 }]}>
        <Ionicons name="git-merge-outline" size={18} color={c.gold} />
        <Text style={{ fontSize: 13, color: c.textMuted, flex: 1 }}>
          Single elimination bracket · {playoffRounds} round{playoffRounds > 1 ? 's' : ''} to the championship
        </Text>
      </View>

      <Text style={[styles.fieldDesc, { color: c.textMuted, marginBottom: 8 }]}>Championship match format</Text>
      <View style={styles.pillRow}>
        <Pressable
          onPress={() => { haptics.light(); setLeagueChampionshipFormat('same'); }}
          style={[styles.pill, { backgroundColor: leagueChampionshipFormat === 'same' ? c.gold + '22' : c.elevated, borderColor: leagueChampionshipFormat === 'same' ? c.gold : 'transparent', borderWidth: 1 }]}
        >
          <Text style={[styles.pillText, { color: leagueChampionshipFormat === 'same' ? c.gold : c.textMuted }]}>Same as Regular Season</Text>
        </Pressable>
      </View>
      {leagueChampionshipFormat !== 'same' && (
        <View style={{ marginTop: 4 }}>
          <View style={styles.pillRow}>
            {ALL_FORMATS.map((fmt) => {
              const isActive = leagueChampionshipFormat === fmt;
              return (
                <Pressable
                  key={fmt}
                  onPress={() => { haptics.light(); setLeagueChampionshipFormat(fmt); }}
                  style={[styles.pill, { backgroundColor: isActive ? c.gold + '22' : c.elevated, borderColor: isActive ? c.gold : 'transparent', borderWidth: 1 }]}
                >
                  <Text style={[styles.pillText, { color: isActive ? c.gold : c.textMuted }]}>{FORMAT_LABELS[fmt]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      <Pressable
        onPress={() => {
          haptics.light();
          setLeagueChampionshipFormat(leagueChampionshipFormat === 'same' ? 'stableford' : 'same');
        }}
        style={{ marginTop: 8 }}
      >
        <Text style={{ fontSize: 12, color: c.teal, fontWeight: '600' }}>
          {leagueChampionshipFormat === 'same' ? 'Pick a specific format instead' : 'Use same as regular season'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── League: Step 6 — Review ────────────────────────────────────────
function LeagueReviewStep({
  name,
  leagueDivisions,
  leagueDivisionCount,
  leagueDivisionNames,
  leagueAutoBalance,
  leagueWeeks,
  leagueDivisionGames,
  leagueCrossDivision,
  leagueRivalryWeek,
  leagueScoringFormat,
  leagueSameFormatAllSeason,
  leagueWinDetermination,
  leagueMarginBonus,
  leagueMarginThreshold,
  leaguePlayoffTeams,
  leagueChampionshipFormat,
  selectedIds,
  manualPlayers,
}: {
  name: string;
  leagueDivisions: boolean;
  leagueDivisionCount: number;
  leagueDivisionNames: string[];
  leagueAutoBalance: boolean;
  leagueWeeks: number;
  leagueDivisionGames: LeagueDivisionGames;
  leagueCrossDivision: boolean;
  leagueRivalryWeek: boolean;
  leagueScoringFormat: string;
  leagueSameFormatAllSeason: boolean;
  leagueWinDetermination: LeagueWinDetermination;
  leagueMarginBonus: boolean;
  leagueMarginThreshold: number;
  leaguePlayoffTeams: 2 | 4 | 6 | 8;
  leagueChampionshipFormat: string;
  selectedIds: string[];
  manualPlayers: ManualPlayer[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const allPlayers = MOCK_FRIENDS.filter((f) => selectedIds.includes(f.id));
  const totalPlayers = allPlayers.length + manualPlayers.length + 1;

  const winLabels: Record<LeagueWinDetermination, string> = {
    stableford: 'Higher Stableford points',
    strokes: 'Lower net strokes',
    holes: 'More holes won',
  };

  const playoffRounds = Math.ceil(Math.log2(leaguePlayoffTeams));

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Trophy header */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Ionicons name="people" size={40} color={c.gold} style={{ marginBottom: 8 }} />
        <Text style={{ fontSize: 28, fontWeight: '700', color: c.gold, fontFamily: GEO, textAlign: 'center' }}>{name}</Text>
        <Text style={{ fontSize: 14, color: c.textMuted, marginTop: 6 }}>League Season</Text>
      </View>

      {/* League Structure */}
      <AccordionSection title="League Structure" icon="grid-outline" iconColor={c.teal} defaultOpen>
        {leagueDivisions ? (
          <>
            <Text style={[styles.reviewVal, { color: c.text }]}>
              {leagueDivisionCount} divisions: {leagueDivisionNames.slice(0, leagueDivisionCount).join(', ')}
            </Text>
            <Text style={[styles.reviewVal, { color: c.textMuted }]}>
              {leagueAutoBalance ? 'Auto-balanced by handicap' : 'Manual division assignment'}
            </Text>
          </>
        ) : (
          <Text style={[styles.reviewVal, { color: c.text }]}>Single pool — round-robin</Text>
        )}
      </AccordionSection>

      {/* Schedule */}
      <AccordionSection title="Schedule" icon="calendar-outline" iconColor={c.gold} defaultOpen>
        <Text style={[styles.reviewVal, { color: c.text }]}>{leagueWeeks} week regular season</Text>
        {leagueDivisions && (
          <>
            <Text style={[styles.reviewVal, { color: c.text }]}>
              Division opponents: {leagueDivisionGames === 'twice' ? 'Twice' : 'Once'}
            </Text>
            <Text style={[styles.reviewVal, { color: c.textMuted }]}>
              Cross-division games: {leagueCrossDivision ? 'Yes' : 'No'}
            </Text>
          </>
        )}
        {leagueRivalryWeek && (
          <Text style={[styles.reviewVal, { color: c.gold }]}>Rivalry Week enabled</Text>
        )}
      </AccordionSection>

      {/* Scoring & Playoffs */}
      <AccordionSection title="Scoring & Playoffs" icon="trophy-outline" iconColor={c.gold} defaultOpen>
        {leagueSameFormatAllSeason ? (
          <Text style={[styles.reviewVal, { color: c.text }]}>
            Format: {FORMAT_LABELS[leagueScoringFormat] ?? leagueScoringFormat} (all season)
          </Text>
        ) : (
          <Text style={[styles.reviewVal, { color: c.text }]}>Format: Commissioner picks each week</Text>
        )}
        <Text style={[styles.reviewVal, { color: c.text }]}>Win by: {winLabels[leagueWinDetermination]}</Text>
        {leagueMarginBonus && (
          <Text style={[styles.reviewVal, { color: c.gold }]}>
            Margin bonus: +0.5 wins for {leagueMarginThreshold}+ point blowouts
          </Text>
        )}
        <Text style={[styles.reviewVal, { color: c.text, marginTop: 6 }]}>
          Playoffs: Top {leaguePlayoffTeams} · {playoffRounds}-round bracket
        </Text>
        <Text style={[styles.reviewVal, { color: c.textMuted }]}>
          Championship: {leagueChampionshipFormat === 'same'
            ? 'Same as regular season'
            : FORMAT_LABELS[leagueChampionshipFormat] ?? leagueChampionshipFormat}
        </Text>
      </AccordionSection>

      {/* Members */}
      <AccordionSection title={`Members (${totalPlayers})`} icon="people" iconColor={c.teal} defaultOpen>
        <View style={styles.reviewAvatarRow}>
          <View style={styles.reviewAvatarItem}>
            <View style={[styles.reviewAvatarCircle, { backgroundColor: c.teal + '33' }]}>
              <Ionicons name="person" size={18} color={c.teal} />
            </View>
            <Text style={[styles.reviewAvatarName, { color: c.teal }]} numberOfLines={1}>You</Text>
          </View>
          {allPlayers.map((m) => (
            <View key={m.id} style={styles.reviewAvatarItem}>
              <Avatar id={m.id} name={m.name} size={40} />
              <Text style={[styles.reviewAvatarName, { color: c.text }]} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
            </View>
          ))}
          {manualPlayers.map((m) => (
            <View key={m.id} style={styles.reviewAvatarItem}>
              <View style={[styles.reviewAvatarCircle, { backgroundColor: c.teal + '22' }]}>
                <Ionicons name="person-add" size={16} color={c.teal} />
              </View>
              <Text style={[styles.reviewAvatarName, { color: c.text }]} numberOfLines={1}>{m.name.split(' ')[0]}</Text>
            </View>
          ))}
        </View>
      </AccordionSection>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────
export default function SeasonsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState(0);
  const [seasonType, setSeasonType] = useState<SeasonType>('fedex');

  const steps = useMemo(() => getStepsForType(seasonType), [seasonType]);
  const currentStep = steps[step];

  // State — shared
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualPlayers, setManualPlayers] = useState<ManualPlayer[]>([]);

  // State — FedEx / Custom
  const [preset, setPreset] = useState('standard');
  const [scoringMethod, setScoringMethod] = useState<ScoringMethod>('position');
  const [cutEnabled, setCutEnabled] = useState(true);
  const [cutValue, setCutValue] = useState(0.67);
  const [dropWorst, setDropWorst] = useState(true);
  const [dnsAveraging, setDnsAveraging] = useState(false);
  const [dnsMinRounds, setDnsMinRounds] = useState(3);
  const [dnsCap, setDnsCap] = useState(5);
  const [playoffMultiplier, setPlayoffMultiplier] = useState(2);
  const [champMultiplier, setChampMultiplier] = useState(3);
  const [makeupWindowEnabled, setMakeupWindowEnabled] = useState(true);
  const [makeupWindowWeeks, setMakeupWindowWeeks] = useState(2);
  const [dnsSafetyNet, setDnsSafetyNet] = useState(false);
  const [dnsSafetyMax, setDnsSafetyMax] = useState(2);
  const [useCustomCycle, setUseCustomCycle] = useState(false);
  const [customCycle, setCustomCycle] = useState<Record<number, string>>({});

  // State — Multi-Round Week & Participation Bonus
  const [multiRoundWeek, setMultiRoundWeek] = useState(false);
  const [roundsAllowed, setRoundsAllowed] = useState(3);
  const [bestRoundsCount, setBestRoundsCount] = useState(1);
  const [participationBonus, setParticipationBonus] = useState(false);
  const [participationPoints, setParticipationPoints] = useState(50);

  // State — Ryder Cup
  const [teamRedName, setTeamRedName] = useState('Team Red');
  const [teamBlueName, setTeamBlueName] = useState('Team Blue');
  const [teamRedCaptain, setTeamRedCaptain] = useState<string | null>(null);
  const [teamBlueCaptain, setTeamBlueCaptain] = useState<string | null>(null);
  const [draftMethod, setDraftMethod] = useState<DraftMethod>('snake');
  const [rcSessions, setRcSessions] = useState<Record<RCSessionType, boolean>>({
    foursomes: true, four_ball: true, singles: true,
  });
  const [rcNumDays, setRcNumDays] = useState(2);
  const [rcPointsPerMatch, setRcPointsPerMatch] = useState(1);
  const [rcHalvedPoints, setRcHalvedPoints] = useState(0.5);
  const [rcWinCondition, setRcWinCondition] = useState<'most_points' | 'first_to'>('most_points');
  const [rcFirstToTarget, setRcFirstToTarget] = useState(15);
  type RCDayCourse = { courseId: string; courseName: string; holes: 'front9' | 'back9' | 'full18' };
  const [rcDayCourses, setRcDayCourses] = useState<Record<number, RCDayCourse>>({});
  const [rcRevealEnabled, setRcRevealEnabled] = useState(true);

  // State — Match Play Bracket
  const [bracketSize, setBracketSize] = useState<BracketSize>(8);
  const [seedingMethod, setSeedingMethod] = useState<SeedingMethod>('handicap');
  const [bracketFormat, setBracketFormat] = useState<BracketFormat>('single');
  const [bracketMatchLength, setBracketMatchLength] = useState<'18' | '9'>('18');
  const [bracketHandicap, setBracketHandicap] = useState<HandicapStrokes>('reduced');
  const [bracketScoringMethod, setBracketScoringMethod] = useState<BracketScoringMethod>('match_play');
  const [roundDeadlineDays, setRoundDeadlineDays] = useState(7);

  // State — Stroke Play Series
  const [strokeRounds, setStrokeRounds] = useState(8);
  const [strokeScoring, setStrokeScoring] = useState<StrokeScoringType>('net');
  const [strokeTiebreaker, setStrokeTiebreaker] = useState<StrokeTiebreaker>('scorecard');
  const [strokeLimitRounds, setStrokeLimitRounds] = useState(false);
  const [strokeMaxRoundsPerWeek, setStrokeMaxRoundsPerWeek] = useState(1);
  const [strokeDropWorst, setStrokeDropWorst] = useState(false);
  const [strokeDropCount, setStrokeDropCount] = useState(1);
  const [strokeCourseRestriction, setStrokeCourseRestriction] = useState<StrokeCourseRestriction>('any');
  const [strokeDesignatedCourseId, setStrokeDesignatedCourseId] = useState<string | null>(null);
  const [strokeDesignatedCourseName, setStrokeDesignatedCourseName] = useState<string | null>(null);

  // State — League
  const [leagueDivisions, setLeagueDivisions] = useState(true);
  const [leagueDivisionCount, setLeagueDivisionCount] = useState(2);
  const [leagueDivisionNames, setLeagueDivisionNames] = useState<string[]>(['East', 'West']);
  const [leagueAutoBalance, setLeagueAutoBalance] = useState(true);
  const [leagueWeeks, setLeagueWeeks] = useState(10);
  const [leagueDivisionGames, setLeagueDivisionGames] = useState<'once' | 'twice'>('once');
  const [leagueCrossDivision, setLeagueCrossDivision] = useState(true);
  const [leagueRivalryWeek, setLeagueRivalryWeek] = useState(false);
  const [leagueSchedulePreview, setLeagueSchedulePreview] = useState<{ week: number; matchups: { a: string; b: string }[] }[]>([]);
  const [leagueScoringFormat, setLeagueScoringFormat] = useState('stableford');
  const [leagueSameFormatAllSeason, setLeagueSameFormatAllSeason] = useState(true);
  const [leagueWinDetermination, setLeagueWinDetermination] = useState<'stableford' | 'strokes' | 'holes'>('stableford');
  const [leagueMarginBonus, setLeagueMarginBonus] = useState(false);
  const [leagueMarginThreshold, setLeagueMarginThreshold] = useState(10);
  const [leaguePlayoffTeams, setLeaguePlayoffTeams] = useState<2 | 4 | 6 | 8>(4);
  const [leagueChampionshipFormat, setLeagueChampionshipFormat] = useState('same');

  // State — Custom Season
  const [customDescription, setCustomDescription] = useState('');
  const [customBaseFormat, setCustomBaseFormat] = useState<CustomBaseFormat>('individual');
  const [customTeamCount, setCustomTeamCount] = useState<2 | 3 | 4>(2);
  const [customTeamFormation, setCustomTeamFormation] = useState<CustomTeamFormation>('auto_balance');
  const [customTeamScoring, setCustomTeamScoring] = useState<CustomTeamScoring>('combined');
  const [customBestX, setCustomBestX] = useState(2);
  const [customBestY, setCustomBestY] = useState(4);
  const [customDivisions, setCustomDivisions] = useState(false);
  const [customDivisionCount, setCustomDivisionCount] = useState<2 | 3 | 4>(2);
  const [customCrossDivision, setCustomCrossDivision] = useState(true);
  const [customBracketSize, setCustomBracketSize] = useState<4 | 8 | 16 | 32>(8);
  const [customSeeding, setCustomSeeding] = useState<CustomSeedingMethod>('handicap');
  const [customElimination, setCustomElimination] = useState<CustomElimination>('single');

  // Auto-generate weeks from preset
  const weeks = useMemo<WeekConfig[]>(() => {
    const p = LENGTH_PRESETS.find((lp) => lp.key === preset)!;
    const result: WeekConfig[] = [];
    for (let i = 0; i < p.total; i++) {
      const weekNum = i + 1;
      const isPlayoff = i >= p.regular && i < p.total - 1;
      const isChampionship = i === p.total - 1;
      const format = useCustomCycle && customCycle[weekNum]
        ? customCycle[weekNum]
        : FORMAT_CYCLE[i % FORMAT_CYCLE.length];
      result.push({
        number: weekNum,
        format,
        isMajor: false,
        majorName: '',
        isPlayoff,
        isChampionship,
        multiplier: isChampionship ? champMultiplier : isPlayoff ? playoffMultiplier : 1,
      });
    }
    return result;
  }, [preset, playoffMultiplier, champMultiplier, useCustomCycle, customCycle]);

  const [editableWeeks, setEditableWeeks] = useState<WeekConfig[]>(weeks);

  // Sync when preset changes
  useMemo(() => setEditableWeeks(weeks), [weeks]);

  const canProceed = useMemo(() => {
    if (currentStep === 'basics') return name.trim().length >= 3;
    if (currentStep === 'members' || currentStep === 'rc_members' || currentStep === 'stroke_members' || currentStep === 'league_members') {
      return (selectedIds.length + manualPlayers.length) >= 4;
    }
    if (currentStep === 'bracket_members') {
      // For bracket, need at least 3 others (you + 3 = 4 minimum)
      return (selectedIds.length + manualPlayers.length) >= 3;
    }
    if (currentStep === 'league_structure') {
      // Divisions must have names if enabled
      if (leagueDivisions) {
        return leagueDivisionNames.slice(0, leagueDivisionCount).every((n) => n.trim().length > 0);
      }
      return true;
    }
    return true;
  }, [currentStep, name, selectedIds, manualPlayers, leagueDivisions, leagueDivisionCount, leagueDivisionNames]);

  const [creating, setCreating] = useState(false);

  const buildSeasonConfig = useCallback(() => {
    const base: Record<string, any> = { season_type: seasonType };
    if (seasonType === 'custom') {
      const customStructure: Record<string, any> = {
        base_format: customBaseFormat,
      };
      if (customBaseFormat === 'teams') {
        Object.assign(customStructure, {
          team_count: customTeamCount,
          team_formation: customTeamFormation,
          team_scoring: customTeamScoring,
          best_x: customTeamScoring === 'best_x_of_y' ? customBestX : null,
          best_y: customTeamScoring === 'best_x_of_y' ? customBestY : null,
        });
      } else if (customBaseFormat === 'h2h') {
        Object.assign(customStructure, {
          divisions_enabled: customDivisions,
          division_count: customDivisions ? customDivisionCount : null,
          cross_division: customDivisions ? customCrossDivision : null,
        });
      } else if (customBaseFormat === 'bracket') {
        Object.assign(customStructure, {
          bracket_size: customBracketSize,
          seeding_method: customSeeding,
          elimination: customElimination,
        });
      }
      Object.assign(base, {
        description: customDescription || null,
        custom_structure: customStructure,
        scoring_method: scoringMethod,
        cut_percentage: cutEnabled ? cutValue : null,
        drop_worst: dropWorst,
        dns_averaging: dnsAveraging,
        dns_min_rounds: dnsMinRounds,
        dns_cap: dnsCap,
        playoff_multiplier: playoffMultiplier,
        championship_multiplier: champMultiplier,
        length_preset: preset,
        use_custom_cycle: useCustomCycle,
        custom_cycle: useCustomCycle ? customCycle : null,
        makeup_window_weeks: makeupWindowEnabled ? makeupWindowWeeks : null,
        dns_safety_net: dnsSafetyNet,
        dns_safety_max: dnsSafetyNet ? dnsSafetyMax : null,
        multi_round_week: multiRoundWeek,
        rounds_allowed_per_week: multiRoundWeek ? roundsAllowed : null,
        best_rounds_count: multiRoundWeek ? bestRoundsCount : null,
        participation_bonus: participationBonus,
        participation_points: participationBonus ? participationPoints : null,
      });
    } else if (seasonType === 'fedex') {
      Object.assign(base, {
        scoring_method: scoringMethod,
        cut_percentage: cutEnabled ? cutValue : null,
        drop_worst: dropWorst,
        dns_averaging: dnsAveraging,
        dns_min_rounds: dnsMinRounds,
        dns_cap: dnsCap,
        playoff_multiplier: playoffMultiplier,
        championship_multiplier: champMultiplier,
        length_preset: preset,
        use_custom_cycle: useCustomCycle,
        custom_cycle: useCustomCycle ? customCycle : null,
        makeup_window_weeks: makeupWindowEnabled ? makeupWindowWeeks : null,
        dns_safety_net: dnsSafetyNet,
        dns_safety_max: dnsSafetyNet ? dnsSafetyMax : null,
        multi_round_week: multiRoundWeek,
        rounds_allowed_per_week: multiRoundWeek ? roundsAllowed : null,
        best_rounds_count: multiRoundWeek ? bestRoundsCount : null,
        participation_bonus: participationBonus,
        participation_points: participationBonus ? participationPoints : null,
      });
    } else if (seasonType === 'ryder') {
      Object.assign(base, {
        team_red_name: teamRedName,
        team_blue_name: teamBlueName,
        team_red_captain: teamRedCaptain,
        team_blue_captain: teamBlueCaptain,
        draft_method: draftMethod,
        sessions: rcSessions,
        num_days: rcNumDays,
        points_per_match: rcPointsPerMatch,
        halved_points: rcHalvedPoints,
        win_condition: rcWinCondition,
        first_to_target: rcWinCondition === 'first_to' ? rcFirstToTarget : null,
        day_courses: rcDayCourses,
        reveal_enabled: rcRevealEnabled,
      });
    } else if (seasonType === 'bracket') {
      Object.assign(base, {
        bracket_size: bracketSize,
        seeding_method: seedingMethod,
        format: bracketFormat,
        match_length: bracketMatchLength,
        handicap_strokes: bracketHandicap,
        scoring_method: bracketScoringMethod,
        round_deadline_days: roundDeadlineDays,
      });
    } else if (seasonType === 'stroke_series') {
      Object.assign(base, {
        stroke_play_config: {
          scoring_type: strokeScoring,
          total_rounds: strokeRounds,
          tiebreaker: strokeTiebreaker,
          limit_rounds_per_week: strokeLimitRounds,
          max_rounds_per_week: strokeLimitRounds ? strokeMaxRoundsPerWeek : null,
          drop_worst: strokeDropWorst,
          drop_count: strokeDropWorst ? strokeDropCount : null,
          course_restriction: strokeCourseRestriction,
          designated_course_id: strokeCourseRestriction === 'same' ? strokeDesignatedCourseId : null,
        },
      });
    } else if (seasonType === 'league') {
      Object.assign(base, {
        league_config: {
          divisions_enabled: leagueDivisions,
          division_count: leagueDivisions ? leagueDivisionCount : null,
          division_names: leagueDivisions ? leagueDivisionNames.slice(0, leagueDivisionCount) : null,
          auto_balance_handicap: leagueDivisions ? leagueAutoBalance : null,
          regular_season_weeks: leagueWeeks,
          division_games: leagueDivisions ? leagueDivisionGames : null,
          cross_division: leagueDivisions ? leagueCrossDivision : null,
          rivalry_week: leagueRivalryWeek,
          scoring_format: leagueSameFormatAllSeason ? leagueScoringFormat : null,
          same_format_all_season: leagueSameFormatAllSeason,
          win_determination: leagueWinDetermination,
          margin_bonus: leagueMarginBonus,
          margin_threshold: leagueMarginBonus ? leagueMarginThreshold : null,
          playoff_teams: leaguePlayoffTeams,
          championship_format: leagueChampionshipFormat === 'same' ? null : leagueChampionshipFormat,
        },
      });
    }
    return base;
  }, [seasonType, scoringMethod, cutEnabled, cutValue, dropWorst, dnsAveraging, dnsMinRounds, dnsCap, playoffMultiplier, champMultiplier, preset, useCustomCycle, customCycle, teamRedName, teamBlueName, teamRedCaptain, teamBlueCaptain, draftMethod, rcSessions, rcNumDays, rcPointsPerMatch, rcHalvedPoints, rcWinCondition, rcFirstToTarget, rcDayCourses, bracketSize, seedingMethod, bracketFormat, bracketMatchLength, bracketHandicap, bracketScoringMethod, roundDeadlineDays, strokeRounds, strokeScoring, strokeDropWorst, strokeTiebreaker, strokeLimitRounds, strokeMaxRoundsPerWeek, strokeDropCount, strokeCourseRestriction, strokeDesignatedCourseId, makeupWindowEnabled, makeupWindowWeeks, dnsSafetyNet, dnsSafetyMax, multiRoundWeek, roundsAllowed, bestRoundsCount, participationBonus, participationPoints, leagueDivisions, leagueDivisionCount, leagueDivisionNames, leagueAutoBalance, leagueWeeks, leagueDivisionGames, leagueCrossDivision, leagueRivalryWeek, leagueScoringFormat, leagueSameFormatAllSeason, leagueWinDetermination, leagueMarginBonus, leagueMarginThreshold, leaguePlayoffTeams, leagueChampionshipFormat, customDescription, customBaseFormat, customTeamCount, customTeamFormation, customTeamScoring, customBestX, customBestY, customDivisions, customDivisionCount, customCrossDivision, customBracketSize, customSeeding, customElimination]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    let newSeasonId: string | null = null;
    const config = buildSeasonConfig();

    // Build weeks for FedEx/Custom types
    const weeksPayload = (seasonType === 'fedex' || seasonType === 'custom')
      ? editableWeeks.map((w) => ({
          week_number: w.number,
          format: w.format,
          is_major: w.isMajor,
          major_name: w.majorName || null,
          is_playoff: w.isPlayoff,
          is_championship: w.isChampionship,
          multiplier: w.multiplier,
        }))
      : [];

    // 1. Try Supabase
    if (user) {
      try {
        const created = await seasonsService.create(
          {
            name,
            type: seasonType === 'bracket' || seasonType === 'stroke_series' || seasonType === 'league' ? 'custom' : seasonType as any,
            creator_id: user.id,
            config,
            status: 'draft',
          },
          weeksPayload,
          selectedIds
        );
        newSeasonId = created.id;
      } catch (err) {
        // Supabase failed — fall through to AsyncStorage fallback
        console.warn('Supabase save failed, falling back to AsyncStorage:', err);
      }
    }

    // 2. AsyncStorage fallback if Supabase didn't work
    if (!newSeasonId) {
      try {
        const localId = `local_season_${Date.now()}`;
        const localSeason = {
          id: localId,
          name,
          type: seasonType,
          config,
          status: 'draft',
          creator_id: user?.id ?? 'local',
          created_at: new Date().toISOString(),
          weeks: weeksPayload,
          member_ids: selectedIds,
          manual_players: manualPlayers,
        };
        const existing = await AsyncStorage.getItem('dormie_local_seasons');
        const seasons = existing ? JSON.parse(existing) : [];
        seasons.push(localSeason);
        await AsyncStorage.setItem('dormie_local_seasons', JSON.stringify(seasons));
        newSeasonId = localId;
      } catch (storageErr) {
        console.warn('AsyncStorage save failed:', storageErr);
        setCreating(false);
        showToast({ message: 'Failed to create season', type: 'error', icon: 'alert-circle' });
        return;
      }
    }

    setCreating(false);
    showToast({ message: 'Season created', type: 'gold', icon: 'trophy' });
    router.replace({ pathname: '/season-detail', params: { id: newSeasonId } });
  }, [name, seasonType, user, editableWeeks, selectedIds, manualPlayers, buildSeasonConfig, router, showToast]);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      {/* Header */}
      <LinearGradient colors={greenHeaderGradient as unknown as string[]} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => { haptics.light(); step > 0 ? setStep(step - 1) : router.back(); }} hitSlop={12}>
            <Ionicons name={step > 0 ? 'arrow-back' : 'close'} size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: GEO }]}>
            {STEP_TITLES[currentStep]}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          {steps.map((s, i) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                {
                  backgroundColor: i < step ? c.gold : i === step ? c.teal : '#FFFFFF33',
                  width: i === step ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>
      </LinearGradient>
      <GoldDivider />

      {/* Step content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {currentStep === 'basics' && (
          <BasicsStep name={name} setName={setName} seasonType={seasonType} setSeasonType={(t) => { setSeasonType(t); setStep(0); }} customDescription={customDescription} setCustomDescription={setCustomDescription} />
        )}
        {currentStep === 'custom_structure' && (
          <CustomStructureStep
            baseFormat={customBaseFormat} setBaseFormat={setCustomBaseFormat}
            teamCount={customTeamCount} setTeamCount={setCustomTeamCount}
            teamFormation={customTeamFormation} setTeamFormation={setCustomTeamFormation}
            teamScoring={customTeamScoring} setTeamScoring={setCustomTeamScoring}
            bestX={customBestX} setBestX={setCustomBestX}
            bestY={customBestY} setBestY={setCustomBestY}
            divisions={customDivisions} setDivisions={setCustomDivisions}
            divisionCount={customDivisionCount} setDivisionCount={setCustomDivisionCount}
            crossDivision={customCrossDivision} setCrossDivision={setCustomCrossDivision}
            cBracketSize={customBracketSize} setCBracketSize={setCustomBracketSize}
            seeding={customSeeding} setSeeding={setCustomSeeding}
            elimination={customElimination} setElimination={setCustomElimination}
          />
        )}
        {(currentStep === 'custom_length' || currentStep === 'custom_scoring' || currentStep === 'custom_rules' || currentStep === 'custom_bonuses') && (
          <View style={styles.stepContent}>
            <View style={[styles.explanationCard, { backgroundColor: c.elevated, borderColor: c.border }]}>
              <Ionicons name="construct-outline" size={18} color={c.gold} />
              <Text style={{ flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 18 }}>
                This step will be configured in the next update.
              </Text>
            </View>
          </View>
        )}
        {currentStep === 'format' && (
          <FormatStep preset={preset} setPreset={setPreset} scoringMethod={scoringMethod} setScoringMethod={setScoringMethod} useCustomCycle={useCustomCycle} setUseCustomCycle={setUseCustomCycle} customCycle={customCycle} setCustomCycle={setCustomCycle} />
        )}
        {currentStep === 'rules' && (
          <RulesStep
            cutEnabled={cutEnabled} setCutEnabled={setCutEnabled}
            cutValue={cutValue} setCutValue={setCutValue}
            dropWorst={dropWorst} setDropWorst={setDropWorst}
            dnsAveraging={dnsAveraging} setDnsAveraging={setDnsAveraging}
            dnsMinRounds={dnsMinRounds} setDnsMinRounds={setDnsMinRounds}
            dnsCap={dnsCap} setDnsCap={setDnsCap}
            playoffMultiplier={playoffMultiplier} setPlayoffMultiplier={setPlayoffMultiplier}
            champMultiplier={champMultiplier} setChampMultiplier={setChampMultiplier}
            makeupWindowEnabled={makeupWindowEnabled} setMakeupWindowEnabled={setMakeupWindowEnabled}
            makeupWindowWeeks={makeupWindowWeeks} setMakeupWindowWeeks={setMakeupWindowWeeks}
            dnsSafetyNet={dnsSafetyNet} setDnsSafetyNet={setDnsSafetyNet}
            dnsSafetyMax={dnsSafetyMax} setDnsSafetyMax={setDnsSafetyMax}
            multiRoundWeek={multiRoundWeek} setMultiRoundWeek={setMultiRoundWeek}
            roundsAllowed={roundsAllowed} setRoundsAllowed={setRoundsAllowed}
            bestRoundsCount={bestRoundsCount} setBestRoundsCount={setBestRoundsCount}
            participationBonus={participationBonus} setParticipationBonus={setParticipationBonus}
            participationPoints={participationPoints} setParticipationPoints={setParticipationPoints}
          />
        )}
        {currentStep === 'majors' && (
          <MajorsStep weeks={editableWeeks} setWeeks={setEditableWeeks} preset={preset} />
        )}
        {(currentStep === 'members' || currentStep === 'rc_members' || currentStep === 'bracket_members' || currentStep === 'stroke_members') && (
          <MembersStep
            selectedIds={selectedIds} setSelectedIds={setSelectedIds} seasonName={name}
            manualPlayers={manualPlayers} setManualPlayers={setManualPlayers}
            bracketSize={currentStep === 'bracket_members' ? bracketSize : undefined}
          />
        )}
        {currentStep === 'review' && (
          <ReviewStep
            name={name} seasonType={seasonType} preset={preset} scoringMethod={scoringMethod}
            weeks={editableWeeks} selectedIds={selectedIds} manualPlayers={manualPlayers}
            cutEnabled={cutEnabled} cutValue={cutValue} dropWorst={dropWorst}
            playoffMultiplier={playoffMultiplier} champMultiplier={champMultiplier}
            makeupWindowEnabled={makeupWindowEnabled} makeupWindowWeeks={makeupWindowWeeks}
            dnsSafetyNet={dnsSafetyNet} dnsSafetyMax={dnsSafetyMax}
            multiRoundWeek={multiRoundWeek} roundsAllowed={roundsAllowed} bestRoundsCount={bestRoundsCount}
            participationBonus={participationBonus} participationPoints={participationPoints}
          />
        )}
        {/* Ryder Cup steps */}
        {currentStep === 'rc_team_setup' && (
          <RyderCupTeamSetupStep
            teamRedName={teamRedName} setTeamRedName={setTeamRedName}
            teamBlueName={teamBlueName} setTeamBlueName={setTeamBlueName}
            teamRedCaptain={teamRedCaptain} setTeamRedCaptain={setTeamRedCaptain}
            teamBlueCaptain={teamBlueCaptain} setTeamBlueCaptain={setTeamBlueCaptain}
            draftMethod={draftMethod} setDraftMethod={setDraftMethod}
            teamRedRoster={[]} teamBlueRoster={[]} selectedIds={selectedIds}
          />
        )}
        {currentStep === 'rc_match_format' && (
          <RyderCupMatchFormatStep
            rcSessions={rcSessions} setRcSessions={setRcSessions}
            rcNumDays={rcNumDays} setRcNumDays={setRcNumDays}
            rcPointsPerMatch={rcPointsPerMatch} setRcPointsPerMatch={setRcPointsPerMatch}
            rcHalvedPoints={rcHalvedPoints} setRcHalvedPoints={setRcHalvedPoints}
            rcWinCondition={rcWinCondition} setRcWinCondition={setRcWinCondition}
            rcFirstToTarget={rcFirstToTarget} setRcFirstToTarget={setRcFirstToTarget}
            rcDayCourses={rcDayCourses} setRcDayCourses={setRcDayCourses}
            selectedIds={selectedIds}
          />
        )}
        {currentStep === 'rc_review' && (
          <RyderCupReviewStep
            name={name} teamRedName={teamRedName} teamBlueName={teamBlueName}
            teamRedCaptain={teamRedCaptain} teamBlueCaptain={teamBlueCaptain}
            draftMethod={draftMethod} rcSessions={rcSessions} rcNumDays={rcNumDays}
            rcPointsPerMatch={rcPointsPerMatch} rcHalvedPoints={rcHalvedPoints}
            rcWinCondition={rcWinCondition} rcFirstToTarget={rcFirstToTarget}
            rcDayCourses={rcDayCourses}
            rcRevealEnabled={rcRevealEnabled} setRcRevealEnabled={setRcRevealEnabled}
            selectedIds={selectedIds} manualPlayers={manualPlayers}
          />
        )}
        {/* Match Play Bracket steps */}
        {currentStep === 'bracket_setup' && (
          <BracketSetupStep
            bracketSize={bracketSize} setBracketSize={setBracketSize}
            seedingMethod={seedingMethod} setSeedingMethod={setSeedingMethod}
            bracketFormat={bracketFormat} setBracketFormat={setBracketFormat}
          />
        )}
        {currentStep === 'bracket_rules' && (
          <BracketMatchRulesStep
            bracketMatchLength={bracketMatchLength} setBracketMatchLength={setBracketMatchLength}
            bracketHandicap={bracketHandicap} setBracketHandicap={setBracketHandicap}
            bracketScoringMethod={bracketScoringMethod} setBracketScoringMethod={setBracketScoringMethod}
            roundDeadlineDays={roundDeadlineDays} setRoundDeadlineDays={setRoundDeadlineDays}
          />
        )}
        {currentStep === 'bracket_review' && (
          <BracketReviewStep
            name={name} bracketSize={bracketSize} seedingMethod={seedingMethod}
            bracketFormat={bracketFormat}
            bracketMatchLength={bracketMatchLength} bracketHandicap={bracketHandicap}
            bracketScoringMethod={bracketScoringMethod} roundDeadlineDays={roundDeadlineDays}
            selectedIds={selectedIds} manualPlayers={manualPlayers}
          />
        )}
        {/* Stroke Play Series steps */}
        {currentStep === 'stroke_format' && (
          <StrokeFormatStep
            strokeRounds={strokeRounds} setStrokeRounds={setStrokeRounds}
            strokeScoring={strokeScoring} setStrokeScoring={setStrokeScoring}
            strokeTiebreaker={strokeTiebreaker} setStrokeTiebreaker={setStrokeTiebreaker}
          />
        )}
        {currentStep === 'stroke_policies' && (
          <StrokePoliciesStep
            strokeLimitRounds={strokeLimitRounds} setStrokeLimitRounds={setStrokeLimitRounds}
            strokeMaxRoundsPerWeek={strokeMaxRoundsPerWeek} setStrokeMaxRoundsPerWeek={setStrokeMaxRoundsPerWeek}
            strokeDropWorst={strokeDropWorst} setStrokeDropWorst={setStrokeDropWorst}
            strokeDropCount={strokeDropCount} setStrokeDropCount={setStrokeDropCount}
            strokeCourseRestriction={strokeCourseRestriction} setStrokeCourseRestriction={setStrokeCourseRestriction}
            strokeDesignatedCourseId={strokeDesignatedCourseId} setStrokeDesignatedCourseId={setStrokeDesignatedCourseId}
            strokeDesignatedCourseName={strokeDesignatedCourseName} setStrokeDesignatedCourseName={setStrokeDesignatedCourseName}
          />
        )}
        {currentStep === 'stroke_review' && (
          <StrokeSeriesReviewStep
            name={name} strokeRounds={strokeRounds} strokeScoring={strokeScoring}
            strokeTiebreaker={strokeTiebreaker}
            strokeLimitRounds={strokeLimitRounds} strokeMaxRoundsPerWeek={strokeMaxRoundsPerWeek}
            strokeDropWorst={strokeDropWorst} strokeDropCount={strokeDropCount}
            strokeCourseRestriction={strokeCourseRestriction} strokeDesignatedCourseName={strokeDesignatedCourseName}
            selectedIds={selectedIds} manualPlayers={manualPlayers}
          />
        )}
        {/* League steps */}
        {currentStep === 'league_structure' && (
          <LeagueStructureStep
            leagueDivisions={leagueDivisions} setLeagueDivisions={setLeagueDivisions}
            leagueDivisionCount={leagueDivisionCount} setLeagueDivisionCount={setLeagueDivisionCount}
            leagueDivisionNames={leagueDivisionNames} setLeagueDivisionNames={setLeagueDivisionNames}
            leagueAutoBalance={leagueAutoBalance} setLeagueAutoBalance={setLeagueAutoBalance}
          />
        )}
        {currentStep === 'league_schedule' && (
          <LeagueScheduleStep
            leagueWeeks={leagueWeeks} setLeagueWeeks={setLeagueWeeks}
            leagueDivisions={leagueDivisions} leagueDivisionCount={leagueDivisionCount}
            leagueDivisionGames={leagueDivisionGames} setLeagueDivisionGames={setLeagueDivisionGames}
            leagueCrossDivision={leagueCrossDivision} setLeagueCrossDivision={setLeagueCrossDivision}
            leagueRivalryWeek={leagueRivalryWeek} setLeagueRivalryWeek={setLeagueRivalryWeek}
            leagueSchedulePreview={leagueSchedulePreview} setLeagueSchedulePreview={setLeagueSchedulePreview}
            selectedIds={selectedIds} manualPlayers={manualPlayers}
            leagueDivisionNames={leagueDivisionNames}
          />
        )}
        {currentStep === 'league_scoring' && (
          <LeagueScoringStep
            leagueScoringFormat={leagueScoringFormat} setLeagueScoringFormat={setLeagueScoringFormat}
            leagueSameFormatAllSeason={leagueSameFormatAllSeason} setLeagueSameFormatAllSeason={setLeagueSameFormatAllSeason}
            leagueWinDetermination={leagueWinDetermination} setLeagueWinDetermination={setLeagueWinDetermination}
            leagueMarginBonus={leagueMarginBonus} setLeagueMarginBonus={setLeagueMarginBonus}
            leagueMarginThreshold={leagueMarginThreshold} setLeagueMarginThreshold={setLeagueMarginThreshold}
            leaguePlayoffTeams={leaguePlayoffTeams} setLeaguePlayoffTeams={setLeaguePlayoffTeams}
            leagueChampionshipFormat={leagueChampionshipFormat} setLeagueChampionshipFormat={setLeagueChampionshipFormat}
            leagueDivisions={leagueDivisions} leagueDivisionCount={leagueDivisionCount}
            leagueWeeks={leagueWeeks}
          />
        )}
        {(currentStep === 'league_members') && (
          <MembersStep
            selectedIds={selectedIds} setSelectedIds={setSelectedIds} seasonName={name}
            manualPlayers={manualPlayers} setManualPlayers={setManualPlayers}
          />
        )}
        {currentStep === 'league_review' && (
          <LeagueReviewStep
            name={name}
            leagueDivisions={leagueDivisions} leagueDivisionCount={leagueDivisionCount}
            leagueDivisionNames={leagueDivisionNames} leagueAutoBalance={leagueAutoBalance}
            leagueWeeks={leagueWeeks} leagueDivisionGames={leagueDivisionGames}
            leagueCrossDivision={leagueCrossDivision} leagueRivalryWeek={leagueRivalryWeek}
            leagueScoringFormat={leagueScoringFormat} leagueSameFormatAllSeason={leagueSameFormatAllSeason}
            leagueWinDetermination={leagueWinDetermination} leagueMarginBonus={leagueMarginBonus}
            leagueMarginThreshold={leagueMarginThreshold} leaguePlayoffTeams={leaguePlayoffTeams}
            leagueChampionshipFormat={leagueChampionshipFormat}
            selectedIds={selectedIds} manualPlayers={manualPlayers}
          />
        )}
      </ScrollView>

      {/* Bottom button */}
      <View style={[styles.bottomBar, { borderTopColor: c.border }]}>
        {step === steps.length - 1 ? (
          <Pressable
            onPress={() => { if (!creating) { haptics.success(); handleCreate(); } }}
            disabled={creating}
            style={[styles.nextBtn, { backgroundColor: creating ? c.elevated : c.gold }]}
          >
            {creating ? (
              <ActivityIndicator size="small" color={c.gold} />
            ) : (
              <>
                <Ionicons name="trophy" size={20} color="#000000" />
                <Text style={[styles.nextBtnText, { color: '#000000', fontFamily: GEO }]}>Create Season</Text>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={() => { haptics.light(); setStep(step + 1); }}
            disabled={!canProceed}
            style={[styles.nextBtn, { backgroundColor: canProceed ? c.teal : c.elevated }]}
          >
            <Text style={[styles.nextBtnText, { color: canProceed ? '#FFFFFF' : c.textMuted }]}>
              Continue
            </Text>
            <Ionicons name="arrow-forward" size={18} color={canProceed ? '#FFFFFF' : c.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: STATUS_BAR_H + 8, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'center' },
  progressDot: { height: 6, borderRadius: 0 },

  stepContent: { padding: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  fieldDesc: { fontSize: 13, marginBottom: 4 },
  input: { paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, borderWidth: 1 },

  // Type cards — 2-column grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeGridCard: { height: 120, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 4 },
  typeGridCardHalf: { width: (SCREEN_W - 40 - 10) / 2 },
  typeGridCardFull: { width: SCREEN_W - 40 },
  typeGridLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  typeGridDesc: { fontSize: 11, textAlign: 'center' },

  // Pill row
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 8 },
  pillText: { fontSize: 13, fontWeight: '600' },

  // Preset cards
  presetCard: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8 },
  presetLabel: { fontSize: 15, fontWeight: '600' },
  presetDesc: { fontSize: 12, marginTop: 2 },
  presetTotal: { fontSize: 16 },

  // Points table
  pointsPreview: { marginTop: 12, padding: 12 },
  pointsPreviewTitle: { fontSize: 10, fontWeight: '600', letterSpacing: 2, marginBottom: 8, textAlign: 'center', textTransform: 'uppercase' as const },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  pointsCell: { alignItems: 'center' },
  pointsPos: { fontSize: 10 },
  pointsVal: { fontSize: 16, fontWeight: '700', marginTop: 2 },

  // Format cycle
  cyclePrev: { padding: 12 },
  cycleItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  cycleNum: { width: 20, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cycleName: { fontSize: 14 },
  cycleNote: { fontSize: 11, fontStyle: 'italic', marginTop: 6, textAlign: 'center' },
  formatPicker: { paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  formatPickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  formatPickerText: { fontSize: 13 },

  // Rules
  ruleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  ruleLabel: { fontSize: 15, fontWeight: '600' },
  ruleDesc: { fontSize: 12, marginTop: 2 },
  cutOptions: { flexDirection: 'row', gap: 6, paddingVertical: 8, flexWrap: 'wrap' },
  cutPill: { paddingHorizontal: 12, paddingVertical: 6 },
  cutPillText: { fontSize: 13, fontWeight: '600' },

  // DNS
  dnsOptions: { padding: 12, marginVertical: 4 },
  dnsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  dnsLabel: { fontSize: 13 },

  // Stepper
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperVal: { fontSize: 18, fontWeight: '700', minWidth: 30, textAlign: 'center' },

  // Multiplier
  multiplierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, marginBottom: 4 },
  multiplierLabel: { fontSize: 14 },

  // Majors
  majorWeekCard: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 6 },
  majorWeekNum: { fontSize: 14, fontWeight: '600' },
  majorWeekFmt: { fontSize: 12, marginTop: 1 },
  majorMultiplier: { fontSize: 18, fontWeight: '700' },
  majorNameLabel: { fontSize: 12, marginBottom: 4 },

  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 6 },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberHcp: { fontSize: 12, marginTop: 1 },

  // Accordion
  accordionSection: { marginBottom: 8 },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  accordionTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  accordionBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },

  // Review
  reviewVal: { fontSize: 14, marginTop: 4 },
  reviewRules: { marginTop: 6, gap: 4 },
  reviewRule: { fontSize: 13 },
  reviewMajor: { fontSize: 14, marginTop: 4, fontFamily: GEO },
  reviewAvatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  reviewAvatarItem: { alignItems: 'center', width: 52 },
  reviewAvatarCircle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarName: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  schedNum: { width: 24, fontSize: 13, textAlign: 'center' },
  schedFmt: { flex: 1, fontSize: 13 },
  schedBadge: { fontSize: 10, fontWeight: '700' },
  schedMult: { fontSize: 13 },

  // Explanation card
  explanationCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderWidth: 1, marginBottom: 4 },

  // Member actions
  memberActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  memberActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderWidth: 1 },
  memberActionText: { fontSize: 13, fontWeight: '600' },
  minWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginBottom: 8 },
  manualAvatar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  manualBadge: { paddingHorizontal: 5, paddingVertical: 1 },
  manualBadgeText: { fontSize: 9, fontWeight: '700', color: '#8A857F', letterSpacing: 1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalContent: { padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },

  // Bottom bar
  bottomBar: { padding: 16, borderTopWidth: 1 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  nextBtnText: { fontSize: 16, fontWeight: '700' },

  // Bracket
  bracketHelper: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, marginTop: 8 },
  bracketHelperText: { flex: 1, fontSize: 12, lineHeight: 18 },
  stepperBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepperUnit: { fontSize: 14, marginLeft: -4 },

  // Stroke Play radio buttons
  strokeRadioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  strokeRadioOuter: { width: 20, height: 20, borderWidth: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  strokeRadioInner: { width: 10, height: 10, borderRadius: 5 },
  strokeRadioLabel: { fontSize: 15, fontWeight: '600' },
  strokeRadioDesc: { fontSize: 12, marginTop: 2 },

  // Ryder Cup
  teamColorDot: { width: 10, height: 10, marginBottom: 6 },
  teamCaptainLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  captainPick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 4, borderWidth: 1 },
  captainPickName: { fontSize: 13, fontWeight: '600' },
  rosterColumn: { flex: 1, padding: 12, borderWidth: 1 },
  rosterTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  rosterPlayer: { fontSize: 13, marginBottom: 4 },
  rosterEmpty: { fontSize: 12, fontStyle: 'italic' },

  // Custom structure
  customFormatCard: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  customFormatLabel: { fontSize: 15, fontWeight: '700' },
  customFormatDesc: { fontSize: 12, marginTop: 2 },
  customRadioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  customRadioOuter: { width: 20, height: 20, borderWidth: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  customRadioInner: { width: 10, height: 10, borderRadius: 5 },
  customRadioLabel: { fontSize: 14, fontWeight: '600' },
  bestXYRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginTop: 8 },
  bestXYLabel: { fontSize: 14, fontWeight: '600' },
});
