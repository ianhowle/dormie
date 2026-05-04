import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { greenHeaderGradient } from '../src/theme/colors';
import { useAuth } from '../src/lib/auth';
import { haptics } from '../src/lib/haptics';
import { useToast } from '../src/components/Toast';
import GoldDivider from '../src/components/GoldDivider';
import {
  destinationsService,
  type Destination,
} from '../src/services/destinations.service';
import {
  inquiriesService,
  type DreamTripInquiryInput,
  type WhenWindow,
  type GroupSize,
  type BudgetTier,
  type DestinationCategory,
  type TripKind,
  type WhatMatters,
} from '../src/services/inquiries.service';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

const DESTINATION_TEXT_MAX = 200;
const UNFORGETTABLE_MAX = 1000;
const WHAT_MATTERS_MAX = 3;

// ─── Field option config ───────────────────────────────────────────────
const DESTINATION_CATEGORIES: { id: DestinationCategory; label: string }[] = [
  { id: 'coastal', label: 'Coastal' },
  { id: 'mountain', label: 'Mountain' },
  { id: 'desert', label: 'Desert' },
  { id: 'links', label: 'Links' },
  { id: 'tropical', label: 'Tropical' },
  { id: 'top_100', label: 'Top 100' },
  { id: 'bucket_list', label: 'Bucket list' },
];

const WHEN_OPTIONS: { id: WhenWindow; label: string }[] = [
  { id: 'next_3_months', label: 'In the next 3 months' },
  { id: 'this_year', label: 'This year' },
  { id: 'next_year', label: 'Next year' },
  { id: 'someday', label: 'Someday' },
  { id: 'still_determining', label: 'Still determining' },
];

const GROUP_SIZE_OPTIONS: { id: GroupSize; label: string }[] = [
  { id: 'just_me', label: 'Just me' },
  { id: 'me_plus_1', label: 'Me +1' },
  { id: 'small_group', label: 'Small group (3-5)' },
  { id: 'big_group', label: 'Big group (6+)' },
  { id: 'still_determining', label: 'Still determining' },
];

const TRIP_KINDS: { id: TripKind; label: string }[] = [
  { id: 'bachelor_party', label: 'Bachelor party' },
  { id: 'annual_friends', label: 'Annual trip with friends' },
  { id: 'couples_retreat', label: 'Couples retreat' },
  { id: 'bucket_list', label: 'Bucket list' },
  { id: 'business', label: 'Business' },
  { id: 'family', label: 'Family' },
  { id: 'other', label: 'Other' },
];

const BUDGET_OPTIONS: { id: BudgetTier; label: string }[] = [
  { id: 'under_500', label: 'Under $500' },
  { id: '500_to_1500', label: '$500–1,500' },
  { id: '1500_to_3000', label: '$1,500–3,000' },
  { id: '3000_to_5000', label: '$3,000–5,000' },
  { id: '5000_plus', label: '$5,000+' },
  { id: 'variable', label: 'Variable / mix' },
  { id: 'still_determining', label: 'Still determining' },
];

const WHAT_MATTERS_OPTIONS: { id: WhatMatters; label: string }[] = [
  { id: 'iconic_courses', label: 'Iconic courses' },
  { id: 'course_variety', label: 'Course variety' },
  { id: 'off_the_beaten_path', label: 'Off-the-beaten-path' },
  { id: 'resort_experience', label: 'Resort experience' },
  { id: 'easy_logistics', label: 'Easy travel logistics' },
  { id: 'food_nightlife', label: 'Great food/nightlife' },
  { id: 'affordability', label: 'Affordability' },
  { id: 'weather_guarantee', label: 'Weather guarantee' },
];

// ─── Best-season formatting ────────────────────────────────────────────
const MONTH_NAMES: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April',
  May: 'May', Jun: 'June', Jul: 'July', Aug: 'August',
  Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};
const ALL_MONTHS_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Group consecutive months into ranges and join naturally.
// ['Apr','May','Jun','Sep','Oct'] → "April through June and September through October"
function formatBestSeason(months: string[]): string {
  if (!months || months.length === 0) return '';
  const sorted = [...months].sort(
    (a, b) => ALL_MONTHS_ORDER.indexOf(a) - ALL_MONTHS_ORDER.indexOf(b),
  );
  const groups: string[][] = [];
  let cur: string[] = [];
  for (const m of sorted) {
    if (cur.length === 0) {
      cur.push(m);
      continue;
    }
    const last = cur[cur.length - 1];
    if (ALL_MONTHS_ORDER.indexOf(m) === ALL_MONTHS_ORDER.indexOf(last) + 1) {
      cur.push(m);
    } else {
      groups.push(cur);
      cur = [m];
    }
  }
  if (cur.length > 0) groups.push(cur);
  const phrases = groups.map((g) => {
    if (g.length === 1) return MONTH_NAMES[g[0]] ?? g[0];
    return `${MONTH_NAMES[g[0]] ?? g[0]} through ${MONTH_NAMES[g[g.length - 1]] ?? g[g.length - 1]}`;
  });
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`;
}

// Off-season is the months NOT in best_season.
function formatOffSeason(best: string[]): string {
  const offSet = new Set(ALL_MONTHS_ORDER);
  for (const m of best) offSet.delete(m);
  const off = ALL_MONTHS_ORDER.filter((m) => offSet.has(m));
  if (off.length === 0) return '';
  // Compress to a short range like "Nov-Mar" (find first contiguous range starting from earliest off month)
  // For simplicity render as "Nov-Mar" style for the most common shape; otherwise list naturally
  if (off.length >= 3 && off.length <= 7) {
    return `${off[0]}–${off[off.length - 1]}`;
  }
  return off.join(', ');
}

// ─── Section header ───────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Text style={[s.sectionHeader, { color: c.gold, fontFamily: GEO }]}>{title}</Text>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────
export default function ExploreDreamTripScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Section 1 state
  const [destCategories, setDestCategories] = useState<Set<DestinationCategory>>(new Set());
  const [destText, setDestText] = useState('');
  const [destId, setDestId] = useState<string | null>(null);
  const [pickedDestination, setPickedDestination] = useState<Destination | null>(null);
  const [whenWindow, setWhenWindow] = useState<WhenWindow | null>(null);
  const [groupSize, setGroupSize] = useState<GroupSize | null>(null);

  // Section 2 state (preserved across hide/show)
  const [tripKinds, setTripKinds] = useState<Set<TripKind>>(new Set());
  const [budgetTier, setBudgetTier] = useState<BudgetTier | null>(null);
  const [whatMatters, setWhatMatters] = useState<Set<WhatMatters>>(new Set());
  const [unforgettable, setUnforgettable] = useState('');

  // Catalog autocomplete
  const [catalog, setCatalog] = useState<Destination[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Submit / success
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    destinationsService.listAll().then(setCatalog).catch(() => {});
  }, []);

  // Whenever the typed text changes, clear any prior catalog match unless it
  // exactly matches the picked destination's name. This keeps free-text and
  // catalog states consistent.
  useEffect(() => {
    if (pickedDestination && destText !== pickedDestination.name) {
      setPickedDestination(null);
      setDestId(null);
    }
  }, [destText, pickedDestination]);

  const filteredSuggestions = useMemo<Destination[]>(() => {
    const q = destText.trim().toLowerCase();
    if (q.length < 3) return [];
    return catalog
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.region.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [catalog, destText]);

  const isDreamerMode = whenWindow === 'someday' || whenWindow === 'still_determining';
  const showVisionSection = whenWindow !== null && !isDreamerMode;

  const canSubmit = whenWindow !== null && groupSize !== null && !submitting;

  const toggleSet = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const onPickSuggestion = (d: Destination) => {
    haptics.light();
    setPickedDestination(d);
    setDestId(d.id);
    setDestText(d.name);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const onClearDestination = () => {
    haptics.light();
    setDestText('');
    setDestId(null);
    setPickedDestination(null);
    setShowSuggestions(false);
  };

  const onToggleWhatMatters = (id: WhatMatters) => {
    if (whatMatters.has(id)) {
      haptics.light();
      setWhatMatters(toggleSet(whatMatters, id));
      return;
    }
    if (whatMatters.size >= WHAT_MATTERS_MAX) {
      showToast({ message: 'Pick your top 3 priorities.', type: 'info' });
      return;
    }
    haptics.light();
    setWhatMatters(toggleSet(whatMatters, id));
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit || !whenWindow || !groupSize) return;
    haptics.light();
    setSubmitting(true);
    try {
      // When dreamer mode, explicitly null/empty Section 2 fields per spec.
      const isDreamer = whenWindow === 'someday' || whenWindow === 'still_determining';
      const input: DreamTripInquiryInput = {
        destination_categories: Array.from(destCategories),
        destination_text: destText.trim() ? destText.trim().slice(0, DESTINATION_TEXT_MAX) : null,
        destination_id: destId,
        when_window: whenWindow,
        group_size: groupSize,
        trip_kinds: isDreamer ? [] : Array.from(tripKinds),
        budget_tier: isDreamer ? null : budgetTier,
        what_matters: isDreamer ? [] : Array.from(whatMatters),
        unforgettable_text: isDreamer
          ? null
          : unforgettable.trim()
            ? unforgettable.trim().slice(0, UNFORGETTABLE_MAX)
            : null,
      };
      await inquiriesService.create(user.id, input);
      haptics.success();
      setSuccess(true);
    } catch (err: any) {
      haptics.error();
      showToast({
        message: err?.message ?? "Couldn't submit your dream trip",
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    haptics.light();
    router.back();
  };

  // ─── Success state ──────────────────────────────────────────────────
  if (success) {
    return (
      <View style={[s.screen, { backgroundColor: c.bg }]}>
        <ExpoStatusBar style="light" />
        <LinearGradient colors={greenHeaderGradient} style={[s.header, { paddingTop: STATUS_BAR_H }]}>
          <View style={s.headerRow}>
            <View style={{ width: 24 }} />
            <Text style={[s.headerTitle, { color: c.gold, fontFamily: GEO }]}>SUBMITTED</Text>
            <View style={{ width: 24 }} />
          </View>
          <GoldDivider style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
        </LinearGradient>
        <View style={[s.successWrap, { paddingBottom: 32 + insets.bottom }]}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#006747" />
          <Text style={[s.successTitle, { color: c.text, fontFamily: GEO }]}>Got it.</Text>
          <Text style={[s.successBody, { color: c.textMuted }]}>
            We're using these submissions to design Dormie's trip planning recommendations.
            The more we hear from golfers like you, the better we can help plan trips that actually
            match what you want.
          </Text>
          <Pressable
            onPress={handleDone}
            style={({ pressed }) => [
              s.primaryBtn,
              { backgroundColor: '#006747', opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[s.primaryBtnText, { color: '#C9A227', fontFamily: GEO }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Best season callout ────────────────────────────────────────────
  let bestSeasonNote: string | null = null;
  if (pickedDestination && pickedDestination.best_season && pickedDestination.best_season.length > 0) {
    const best = formatBestSeason(pickedDestination.best_season);
    const off = formatOffSeason(pickedDestination.best_season);
    bestSeasonNote = off
      ? `Best at ${pickedDestination.name}: ${best}.\nOff-season (${off}) is typically half the price but rain risk is real.`
      : `Best at ${pickedDestination.name}: ${best}.`;
  }

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      <LinearGradient colors={greenHeaderGradient} style={[s.header, { paddingTop: STATUS_BAR_H }]}>
        <View style={s.headerRow}>
          <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#E8E4DE" />
          </Pressable>
          <Text style={[s.headerTitle, { color: c.gold, fontFamily: GEO }]}>DREAM TRIP</Text>
          <View style={{ width: 24 }} />
        </View>
        <GoldDivider style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title block */}
          <View style={s.titleBlock}>
            <Text style={[s.title, { color: c.text, fontFamily: GEO }]}>
              Explore your next dream trip
            </Text>
            <Text style={[s.subtitle, { color: c.textMuted }]}>
              Tell us about your dream trip. We're building a trip planner that produces what matters most to golfers.
            </Text>
          </View>

          {/* SECTION 1 — THE TRIP */}
          <View style={s.section}>
            <SectionHeader title="THE TRIP" />

            {/* 1.1 Destination categories */}
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: c.text }]}>What kind of place draws you in?</Text>
              <Text style={[s.fieldHelp, { color: c.textMuted }]}>
                Pick any that fit — or skip if you have a specific spot in mind.
              </Text>
              <View style={s.chipRow}>
                {DESTINATION_CATEGORIES.map((opt) => {
                  const active = destCategories.has(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => { haptics.light(); setDestCategories(toggleSet(destCategories, opt.id)); }}
                      style={({ pressed }) => [
                        s.chip,
                        {
                          backgroundColor: active ? '#006747' : c.cardBg,
                          borderColor: active ? '#006747' : c.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.chipText,
                          { color: active ? '#C9A227' : c.textMuted, fontFamily: GEO },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 1.2 Destination text + autocomplete */}
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: c.text }]}>Where specifically?</Text>
              <Text style={[s.fieldHelp, { color: c.textMuted }]}>Type a course, city, or just a vibe.</Text>
              <View style={[s.inputWrap, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                {pickedDestination && (
                  <Ionicons name="checkmark-circle" size={16} color="#006747" />
                )}
                <TextInput
                  ref={inputRef}
                  value={destText}
                  onChangeText={(text) => {
                    setDestText(text.slice(0, DESTINATION_TEXT_MAX));
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="e.g. Pebble Beach, Bandon, links vibes…"
                  placeholderTextColor={c.textMuted}
                  style={[s.input, { color: c.text }]}
                  maxLength={DESTINATION_TEXT_MAX}
                  returnKeyType="done"
                />
                {destText.length > 0 && (
                  <Pressable onPress={onClearDestination} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={c.textMuted} />
                  </Pressable>
                )}
              </View>
              {destText.length > DESTINATION_TEXT_MAX - 20 && (
                <Text style={[s.charCounter, { color: c.textMuted }]}>
                  {DESTINATION_TEXT_MAX - destText.length} characters left
                </Text>
              )}
              {showSuggestions && filteredSuggestions.length > 0 && !pickedDestination && (
                <View style={[s.suggestionDropdown, { backgroundColor: c.cardBg, borderColor: c.border }]}>
                  {filteredSuggestions.map((d) => (
                    <Pressable
                      key={d.id}
                      onPress={() => onPickSuggestion(d)}
                      style={({ pressed }) => [
                        s.suggestionRow,
                        { borderBottomColor: c.border, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text style={[s.suggestionName, { color: c.text }]}>{d.name}</Text>
                      <Text style={[s.suggestionRegion, { color: c.textMuted }]}>{d.region}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* 1.3 When (required) */}
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: c.text }]}>
                When? <Text style={{ color: '#C41E3A' }}>*</Text>
              </Text>
              <View style={s.pillRow}>
                {WHEN_OPTIONS.map((opt) => {
                  const active = whenWindow === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => { haptics.light(); setWhenWindow(opt.id); }}
                      style={({ pressed }) => [
                        s.pill,
                        {
                          backgroundColor: active ? '#006747' : c.cardBg,
                          borderColor: active ? '#006747' : c.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.pillText,
                          { color: active ? '#C9A227' : c.textMuted, fontFamily: GEO },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {bestSeasonNote && (
                <View style={[s.calloutBox, { backgroundColor: `${c.gold}10`, borderColor: c.gold }]}>
                  <Ionicons name="sunny-outline" size={14} color={c.gold} />
                  <Text style={[s.calloutText, { color: c.text }]}>{bestSeasonNote}</Text>
                </View>
              )}
            </View>

            {/* 1.4 Group size (required) */}
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: c.text }]}>
                Who's going? <Text style={{ color: '#C41E3A' }}>*</Text>
              </Text>
              <View style={s.pillRow}>
                {GROUP_SIZE_OPTIONS.map((opt) => {
                  const active = groupSize === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => { haptics.light(); setGroupSize(opt.id); }}
                      style={({ pressed }) => [
                        s.pill,
                        {
                          backgroundColor: active ? '#006747' : c.cardBg,
                          borderColor: active ? '#006747' : c.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.pillText,
                          { color: active ? '#C9A227' : c.textMuted, fontFamily: GEO },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* SECTION 2 — THE VISION (hidden in dreamer mode) */}
          {showVisionSection && (
            <View style={s.section}>
              <SectionHeader title="THE VISION" />
              <Text style={[s.fieldHelp, { color: c.textMuted, marginTop: -4, marginBottom: 16 }]}>
                All optional, but the more you tell us the better we understand what you actually want.
              </Text>

              {/* 2.1 Trip kind */}
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: c.text }]}>What kind of trip is this?</Text>
                <View style={s.chipRow}>
                  {TRIP_KINDS.map((opt) => {
                    const active = tripKinds.has(opt.id);
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => { haptics.light(); setTripKinds(toggleSet(tripKinds, opt.id)); }}
                        style={({ pressed }) => [
                          s.chip,
                          {
                            backgroundColor: active ? '#006747' : c.cardBg,
                            borderColor: active ? '#006747' : c.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.chipText,
                            { color: active ? '#C9A227' : c.textMuted, fontFamily: GEO },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 2.2 Budget */}
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: c.text }]}>Budget per person?</Text>
                <Text style={[s.fieldHelp, { color: c.textMuted }]}>Rough estimate is fine.</Text>
                <View style={s.pillRow}>
                  {BUDGET_OPTIONS.map((opt) => {
                    const active = budgetTier === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => { haptics.light(); setBudgetTier(opt.id); }}
                        style={({ pressed }) => [
                          s.pill,
                          {
                            backgroundColor: active ? '#006747' : c.cardBg,
                            borderColor: active ? '#006747' : c.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.pillText,
                            { color: active ? '#C9A227' : c.textMuted, fontFamily: GEO },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 2.3 What matters most (max 3) */}
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: c.text }]}>What matters most?</Text>
                <Text style={[s.fieldHelp, { color: c.textMuted }]}>Pick up to 3.</Text>
                <View style={s.chipRow}>
                  {WHAT_MATTERS_OPTIONS.map((opt) => {
                    const active = whatMatters.has(opt.id);
                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => onToggleWhatMatters(opt.id)}
                        style={({ pressed }) => [
                          s.chip,
                          {
                            backgroundColor: active ? '#006747' : c.cardBg,
                            borderColor: active ? '#006747' : c.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.chipText,
                            { color: active ? '#C9A227' : c.textMuted, fontFamily: GEO },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 2.4 Unforgettable text */}
              <View style={s.field}>
                <Text style={[s.fieldLabel, { color: c.text }]}>
                  What would make this trip unforgettable for your group?
                </Text>
                <Text style={[s.fieldHelp, { color: c.textMuted }]}>
                  Anything from "a hole-in-one celebration spot" to "Drew's last trip before his kids
                  are born" to specific course requests.
                </Text>
                <TextInput
                  value={unforgettable}
                  onChangeText={(t) => setUnforgettable(t.slice(0, UNFORGETTABLE_MAX))}
                  placeholder="Optional — type freely"
                  placeholderTextColor={c.textMuted}
                  multiline
                  style={[
                    s.textArea,
                    { color: c.text, backgroundColor: c.cardBg, borderColor: c.border },
                  ]}
                  maxLength={UNFORGETTABLE_MAX}
                />
                {unforgettable.length > UNFORGETTABLE_MAX - 50 && (
                  <Text style={[s.charCounter, { color: c.textMuted }]}>
                    {UNFORGETTABLE_MAX - unforgettable.length} characters left
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Submit */}
          <View style={[s.section, { paddingTop: 8 }]}>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                s.primaryBtn,
                {
                  backgroundColor: canSubmit ? '#006747' : c.elevated,
                  opacity: pressed && canSubmit ? 0.85 : 1,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#C9A227" />
              ) : (
                <Text
                  style={[
                    s.primaryBtnText,
                    { color: canSubmit ? '#C9A227' : c.textMuted, fontFamily: GEO },
                  ]}
                >
                  Submit
                </Text>
              )}
            </Pressable>
            {!canSubmit && !submitting && (
              <Text style={[s.fieldHelp, { color: c.textMuted, textAlign: 'center', marginTop: 8 }]}>
                Pick a When and a Who's going to submit.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },

  /* Title */
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },

  /* Sections */
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  field: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldHelp: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },

  /* Chips */
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* Pills */
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* Inputs */
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  textArea: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  suggestionDropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    marginTop: -1,
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionRegion: {
    fontSize: 11,
    marginTop: 2,
  },

  /* Best season callout */
  calloutBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  calloutText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },

  /* Submit */
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* Success */
  successWrap: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 64,
    alignItems: 'center',
    gap: 12,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 12,
  },
  successBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginVertical: 16,
  },
});
