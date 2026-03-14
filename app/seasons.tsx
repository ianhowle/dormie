import { useState, useMemo, useCallback } from 'react';
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
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { Avatar } from '../src/components/Avatar';
import { useAuth } from '../src/lib/auth';
import { seasonsService } from '../src/services/seasons.service';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;
const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────
type SeasonType = 'fedex' | 'ryder';
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

// ─── Constants ────────────────────────────────────────────────────────
const LENGTH_PRESETS: LengthPreset[] = [
  { key: 'sprint', label: 'Sprint', description: '4 regular + 2 playoff', regular: 4, playoff: 2, total: 6 },
  { key: 'standard', label: 'Standard', description: '8 regular + 2 playoff', regular: 8, playoff: 2, total: 10 },
  { key: 'full', label: 'Full', description: '12 regular + 3 playoff', regular: 12, playoff: 3, total: 15 },
  { key: 'marathon', label: 'Marathon', description: '16 regular + 4 playoff', regular: 16, playoff: 4, total: 20 },
];

const FORMAT_CYCLE = ['stableford', 'modified_stableford', 'stroke_net', 'quota', 'best9'];
const FORMAT_LABELS: Record<string, string> = {
  stableford: 'Stableford',
  modified_stableford: 'Mod. Stableford',
  stroke_net: 'Stroke (Net)',
  quota: 'Quota',
  best9: 'Best 9',
};

const POINTS_TABLE = [15, 12, 10, 8, 6, 5, 4, 3, 2, 1];

const CUT_OPTIONS: CutOption[] = [
  { label: '25%', value: 0.25 },
  { label: '33%', value: 0.33 },
  { label: '50%', value: 0.50 },
  { label: '67%', value: 0.67 },
  { label: '75%', value: 0.75 },
];

const DEFAULT_MAJOR_NAMES = ['The Dormie Invitational', 'The Dormie Championship'];

const MOCK_FRIENDS: Friend[] = [
  { id: '2', name: 'Drew Patterson', handicap: 12, avatarColor: '#D4AF37' },
  { id: '3', name: 'Jake Sullivan', handicap: 15, avatarColor: '#C44B4F' },
  { id: '4', name: 'Tommy Fleetwood', handicap: 3, avatarColor: '#6B8E23' },
  { id: '5', name: 'Mike Chen', handicap: 18, avatarColor: '#8B4513' },
  { id: '6', name: 'Sam Rodriguez', handicap: 22, avatarColor: '#4682B4' },
  { id: '7', name: 'Will Harrison', handicap: 25, avatarColor: '#9370DB' },
  { id: '8', name: 'Chris Lee', handicap: 28, avatarColor: '#20B2AA' },
];

// ─── Step definitions ─────────────────────────────────────────────────
type Step = 'basics' | 'format' | 'rules' | 'majors' | 'members' | 'review';
const STEPS: Step[] = ['basics', 'format', 'rules', 'majors', 'members', 'review'];
const STEP_TITLES: Record<Step, string> = {
  basics: 'Season Basics',
  format: 'Format & Length',
  rules: 'Rules & Scoring',
  majors: 'Majors',
  members: 'Members',
  review: 'Review',
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
            onPress={() => onSelect(opt)}
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
}: {
  name: string;
  setName: (v: string) => void;
  seasonType: SeasonType;
  setSeasonType: (v: SeasonType) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>Season Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g., 2026 FedEx Cup"
        placeholderTextColor={c.textMuted}
        style={[styles.input, { backgroundColor: c.elevated, color: c.text, borderColor: c.border }]}
      />

      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Season Type</Text>
      <View style={styles.typeCards}>
        {([
          { key: 'fedex' as SeasonType, icon: 'trophy' as const, label: 'FedEx Cup', desc: 'Individual points race with playoffs' },
          { key: 'ryder' as SeasonType, icon: 'people' as const, label: 'Ryder Cup', desc: 'Team competition (red vs blue)' },
        ]).map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setSeasonType(t.key)}
            style={[
              styles.typeCard,
              {
                backgroundColor: seasonType === t.key ? c.gold + '12' : c.elevated,
                borderColor: seasonType === t.key ? c.gold : c.border,
                borderWidth: 1,
              },
            ]}
          >
            <Ionicons name={t.icon} size={28} color={seasonType === t.key ? c.gold : c.textMuted} />
            <Text style={[styles.typeCardLabel, { color: seasonType === t.key ? c.gold : c.text }]}>
              {t.label}
            </Text>
            <Text style={[styles.typeCardDesc, { color: c.textMuted }]}>{t.desc}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Step: Format ─────────────────────────────────────────────────────
function FormatStep({
  preset,
  setPreset,
  scoringMethod,
  setScoringMethod,
}: {
  preset: string;
  setPreset: (v: string) => void;
  scoringMethod: ScoringMethod;
  setScoringMethod: (v: ScoringMethod) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>Season Length</Text>
      {LENGTH_PRESETS.map((p) => (
        <Pressable
          key={p.key}
          onPress={() => setPreset(p.key)}
          style={[
            styles.presetCard,
            {
              backgroundColor: preset === p.key ? c.teal + '12' : c.elevated,
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
      <View style={[styles.cyclePrev, { backgroundColor: c.elevated }]}>
        {FORMAT_CYCLE.map((f, i) => (
          <View key={f} style={[styles.cycleItem, { borderBottomColor: c.border }]}>
            <Text style={[styles.cycleNum, { color: c.textMuted }]}>{i + 1}</Text>
            <Text style={[styles.cycleName, { color: c.text }]}>{FORMAT_LABELS[f]}</Text>
          </View>
        ))}
        <Text style={[styles.cycleNote, { color: c.textMuted }]}>Repeats through the season</Text>
      </View>
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
              onPress={() => setCutValue(opt.value)}
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
              <Pressable onPress={() => setDnsMinRounds(Math.max(1, dnsMinRounds - 1))}>
                <Ionicons name="remove-circle-outline" size={24} color={c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{dnsMinRounds}</Text>
              <Pressable onPress={() => setDnsMinRounds(dnsMinRounds + 1)}>
                <Ionicons name="add-circle-outline" size={24} color={c.teal} />
              </Pressable>
            </View>
          </View>
          <View style={styles.dnsRow}>
            <Text style={[styles.dnsLabel, { color: c.textMuted }]}>DNS cap (max pts)</Text>
            <View style={styles.stepperRow}>
              <Pressable onPress={() => setDnsCap(Math.max(1, dnsCap - 1))}>
                <Ionicons name="remove-circle-outline" size={24} color={c.textMuted} />
              </Pressable>
              <Text style={[styles.stepperVal, { color: c.text, fontFamily: GEO }]}>{dnsCap}</Text>
              <Pressable onPress={() => setDnsCap(dnsCap + 1)}>
                <Ionicons name="add-circle-outline" size={24} color={c.teal} />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Multipliers */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 20 }]}>Point Multipliers</Text>
      <View style={[styles.multiplierRow, { backgroundColor: c.elevated }]}>
        <Text style={[styles.multiplierLabel, { color: c.textMuted }]}>Playoff weeks</Text>
        <View style={styles.stepperRow}>
          <Pressable onPress={() => setPlayoffMultiplier(Math.max(1, playoffMultiplier - 0.5))}>
            <Ionicons name="remove-circle-outline" size={24} color={c.textMuted} />
          </Pressable>
          <Text style={[styles.stepperVal, { color: c.urgent, fontFamily: GEO }]}>{playoffMultiplier}×</Text>
          <Pressable onPress={() => setPlayoffMultiplier(playoffMultiplier + 0.5)}>
            <Ionicons name="add-circle-outline" size={24} color={c.urgent} />
          </Pressable>
        </View>
      </View>
      <View style={[styles.multiplierRow, { backgroundColor: c.elevated }]}>
        <Text style={[styles.multiplierLabel, { color: c.textMuted }]}>Championship week</Text>
        <View style={styles.stepperRow}>
          <Pressable onPress={() => setChampMultiplier(Math.max(1, champMultiplier - 0.5))}>
            <Ionicons name="remove-circle-outline" size={24} color={c.textMuted} />
          </Pressable>
          <Text style={[styles.stepperVal, { color: c.gold, fontFamily: GEO }]}>{champMultiplier}×</Text>
          <Pressable onPress={() => setChampMultiplier(champMultiplier + 0.5)}>
            <Ionicons name="add-circle-outline" size={24} color={c.gold} />
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
}: {
  weeks: WeekConfig[];
  setWeeks: (w: WeekConfig[]) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const regularWeeks = weeks.filter((w) => !w.isPlayoff && !w.isChampionship);
  const majorCount = regularWeeks.filter((w) => w.isMajor).length;

  const toggleMajor = (weekNum: number) => {
    setWeeks(
      weeks.map((w) => {
        if (w.number !== weekNum) return w;
        if (w.isMajor) return { ...w, isMajor: false, majorName: '', multiplier: 1 };
        if (majorCount >= 2) return w;
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
      <Text style={[styles.fieldLabel, { color: c.text }]}>
        Designate Majors ({majorCount}/2)
      </Text>
      <Text style={[styles.fieldDesc, { color: c.textMuted }]}>
        Majors award 2× points and get special gold styling
      </Text>

      <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
        {regularWeeks.map((w) => (
          <Pressable
            key={w.number}
            onPress={() => toggleMajor(w.number)}
            style={[
              styles.majorWeekCard,
              {
                backgroundColor: w.isMajor ? c.gold + '12' : c.elevated,
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
        {regularWeeks.filter((w) => w.isMajor).map((w) => (
          <View key={`name-${w.number}`} style={{ marginTop: 8 }}>
            <Text style={[styles.majorNameLabel, { color: c.textMuted }]}>
              Week {w.number} Major Name
            </Text>
            <TextInput
              value={w.majorName}
              onChangeText={(text) => updateMajorName(w.number, text)}
              style={[styles.input, { backgroundColor: c.elevated, color: c.gold, borderColor: c.gold + '44' }]}
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
}: {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const toggle = (id: string) => {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>
        Select Members ({selectedIds.length} selected)
      </Text>

      {MOCK_FRIENDS.map((f) => {
        const selected = selectedIds.includes(f.id);
        return (
          <Pressable
            key={f.id}
            onPress={() => toggle(f.id)}
            style={[
              styles.memberRow,
              {
                backgroundColor: selected ? c.teal + '12' : c.elevated,
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
  cutEnabled,
  cutValue,
  dropWorst,
  playoffMultiplier,
  champMultiplier,
}: {
  name: string;
  seasonType: SeasonType;
  preset: string;
  scoringMethod: ScoringMethod;
  weeks: WeekConfig[];
  selectedIds: string[];
  cutEnabled: boolean;
  cutValue: number;
  dropWorst: boolean;
  playoffMultiplier: number;
  champMultiplier: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const presetData = LENGTH_PRESETS.find((p) => p.key === preset)!;
  const majors = weeks.filter((w) => w.isMajor);
  const members = MOCK_FRIENDS.filter((f) => selectedIds.includes(f.id));

  return (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Summary cards */}
      <View style={[styles.reviewCard, { backgroundColor: c.elevated }]}>
        <Text style={[styles.reviewCardTitle, { color: c.gold, fontFamily: GEO }]}>{name}</Text>
        <Text style={[styles.reviewCardSub, { color: c.textMuted }]}>
          {seasonType === 'fedex' ? 'FedEx Cup' : 'Ryder Cup'} — {presetData.label} ({presetData.total} weeks)
        </Text>
      </View>

      <View style={[styles.reviewCard, { backgroundColor: c.elevated }]}>
        <Text style={[styles.reviewLabel, { color: c.textMuted }]}>Scoring</Text>
        <Text style={[styles.reviewVal, { color: c.text }]}>
          {scoringMethod === 'position' ? 'Position-based points' : 'Raw Stableford'}
        </Text>
      </View>

      <View style={[styles.reviewCard, { backgroundColor: c.elevated }]}>
        <Text style={[styles.reviewLabel, { color: c.textMuted }]}>Rules</Text>
        <View style={styles.reviewRules}>
          {cutEnabled && <Text style={[styles.reviewRule, { color: c.text }]}>Cut: Top {Math.round(cutValue * 100)}%</Text>}
          {dropWorst && <Text style={[styles.reviewRule, { color: c.text }]}>Drop worst week</Text>}
          <Text style={[styles.reviewRule, { color: c.text }]}>Playoff: {playoffMultiplier}× pts</Text>
          <Text style={[styles.reviewRule, { color: c.text }]}>Championship: {champMultiplier}× pts</Text>
        </View>
      </View>

      {majors.length > 0 && (
        <View style={[styles.reviewCard, { backgroundColor: c.elevated }]}>
          <Text style={[styles.reviewLabel, { color: c.gold }]}>Majors</Text>
          {majors.map((m) => (
            <Text key={m.number} style={[styles.reviewMajor, { color: c.gold }]}>
              Wk {m.number} — {m.majorName}
            </Text>
          ))}
        </View>
      )}

      {/* Schedule preview */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 16 }]}>Schedule</Text>
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

      {/* Members */}
      <Text style={[styles.fieldLabel, { color: c.text, marginTop: 16 }]}>
        {members.length + 1} Members
      </Text>
      <View style={styles.memberChips}>
        <View style={[styles.memberChip, { backgroundColor: c.teal + '22' }]}>
          <Text style={[styles.memberChipText, { color: c.teal }]}>You (organizer)</Text>
        </View>
        {members.map((m) => (
          <View key={m.id} style={[styles.memberChip, { backgroundColor: c.elevated }]}>
            <Text style={[styles.memberChipText, { color: c.text }]}>{m.name}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────
export default function SeasonsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const currentStep = STEPS[step];

  // State
  const [name, setName] = useState('');
  const [seasonType, setSeasonType] = useState<SeasonType>('fedex');
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Auto-generate weeks from preset
  const weeks = useMemo<WeekConfig[]>(() => {
    const p = LENGTH_PRESETS.find((lp) => lp.key === preset)!;
    const result: WeekConfig[] = [];
    for (let i = 0; i < p.total; i++) {
      const isPlayoff = i >= p.regular && i < p.total - 1;
      const isChampionship = i === p.total - 1;
      result.push({
        number: i + 1,
        format: FORMAT_CYCLE[i % FORMAT_CYCLE.length],
        isMajor: false,
        majorName: '',
        isPlayoff,
        isChampionship,
        multiplier: isChampionship ? champMultiplier : isPlayoff ? playoffMultiplier : 1,
      });
    }
    return result;
  }, [preset, playoffMultiplier, champMultiplier]);

  const [editableWeeks, setEditableWeeks] = useState<WeekConfig[]>(weeks);

  // Sync when preset changes
  useMemo(() => setEditableWeeks(weeks), [weeks]);

  const canProceed = useMemo(() => {
    if (currentStep === 'basics') return name.trim().length >= 3;
    if (currentStep === 'members') return selectedIds.length >= 1;
    return true;
  }, [currentStep, name, selectedIds]);

  const handleCreate = useCallback(async () => {
    if (user) {
      try {
        await seasonsService.create(
          {
            name,
            type: seasonType,
            creator_id: user.id,
            config: {
              scoring_method: scoringMethod,
              cut_percentage: cutEnabled ? cutValue : null,
              drop_worst: dropWorst,
              playoff_multiplier: playoffMultiplier,
              championship_multiplier: champMultiplier,
            },
          },
          editableWeeks.map((w) => ({
            week_number: w.number,
            format: w.format,
            is_major: w.isMajor,
            major_name: w.majorName || null,
            is_playoff: w.isPlayoff,
            is_championship: w.isChampionship,
            multiplier: w.multiplier,
          })),
          selectedIds
        );
      } catch {}
    }
    Alert.alert('Season Created', `"${name}" has been created with ${selectedIds.length + 1} members.`);
    router.back();
  }, [name, seasonType, scoringMethod, user, cutEnabled, cutValue, dropWorst, playoffMultiplier, champMultiplier, editableWeeks, selectedIds, router]);

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <LinearGradient colors={[c.greenDark, c.greenDark + 'CC']} style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => (step > 0 ? setStep(step - 1) : router.back())} hitSlop={12}>
            <Ionicons name={step > 0 ? 'arrow-back' : 'close'} size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: GEO }]}>
            {STEP_TITLES[currentStep]}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          {STEPS.map((s, i) => (
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

      {/* Step content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {currentStep === 'basics' && (
          <BasicsStep name={name} setName={setName} seasonType={seasonType} setSeasonType={setSeasonType} />
        )}
        {currentStep === 'format' && (
          <FormatStep preset={preset} setPreset={setPreset} scoringMethod={scoringMethod} setScoringMethod={setScoringMethod} />
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
          />
        )}
        {currentStep === 'majors' && (
          <MajorsStep weeks={editableWeeks} setWeeks={setEditableWeeks} />
        )}
        {currentStep === 'members' && (
          <MembersStep selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
        )}
        {currentStep === 'review' && (
          <ReviewStep
            name={name} seasonType={seasonType} preset={preset} scoringMethod={scoringMethod}
            weeks={editableWeeks} selectedIds={selectedIds} cutEnabled={cutEnabled}
            cutValue={cutValue} dropWorst={dropWorst}
            playoffMultiplier={playoffMultiplier} champMultiplier={champMultiplier}
          />
        )}
      </ScrollView>

      {/* Bottom button */}
      <View style={[styles.bottomBar, { borderTopColor: c.border }]}>
        {currentStep === 'review' ? (
          <Pressable
            onPress={handleCreate}
            style={[styles.nextBtn, { backgroundColor: c.gold }]}
          >
            <Ionicons name="trophy" size={20} color="#000000" />
            <Text style={[styles.nextBtnText, { color: '#000000', fontFamily: GEO }]}>Create Season</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setStep(step + 1)}
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
  header: { paddingTop: STATUS_BAR_H + 8, paddingHorizontal: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'center' },
  progressDot: { height: 6, borderRadius: 3 },

  stepContent: { padding: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  fieldDesc: { fontSize: 13, marginBottom: 4 },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, borderWidth: 1 },

  // Type cards
  typeCards: { flexDirection: 'row', gap: 10 },
  typeCard: { flex: 1, padding: 16, alignItems: 'center', gap: 8 },
  typeCardLabel: { fontSize: 15, fontWeight: '600' },
  typeCardDesc: { fontSize: 11, textAlign: 'center' },

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
  pointsPreviewTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
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

  // Review
  reviewCard: { padding: 14, marginBottom: 8 },
  reviewCardTitle: { fontSize: 20 },
  reviewCardSub: { fontSize: 13, marginTop: 4 },
  reviewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  reviewVal: { fontSize: 14, marginTop: 4 },
  reviewRules: { marginTop: 6, gap: 4 },
  reviewRule: { fontSize: 13 },
  reviewMajor: { fontSize: 14, marginTop: 4, fontFamily: GEO },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  schedNum: { width: 24, fontSize: 13, textAlign: 'center' },
  schedFmt: { flex: 1, fontSize: 13 },
  schedBadge: { fontSize: 10, fontWeight: '700' },
  schedMult: { fontSize: 13 },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  memberChip: { paddingHorizontal: 10, paddingVertical: 6 },
  memberChipText: { fontSize: 13, fontWeight: '500' },

  // Bottom bar
  bottomBar: { padding: 16, borderTopWidth: 1 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  nextBtnText: { fontSize: 16, fontWeight: '700' },
});
