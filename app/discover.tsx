import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO } from '../src/theme/fonts';
import { cardShadowDark, cardShadowLight } from '../src/theme/colors';
import GoldDivider from '../src/components/GoldDivider';
import { haptics } from '../src/lib/haptics';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Types ───────────────────────────────────────────────────────────
type DiscoverDestination = {
  id: string;
  name: string;
  description: string;
  courseCount: number;
  bestSeason: string;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  gradient: [string, string];
  courses: string[];
};

// ─── Mock destinations ───────────────────────────────────────────────
const DISCOVER_DESTINATIONS: DiscoverDestination[] = [
  {
    id: 'dd1',
    name: 'Pebble Beach',
    description: 'Iconic oceanside golf along the cliffs of Monterey. Bucket list territory for every golfer.',
    courseCount: 5,
    bestSeason: 'Apr – Oct',
    priceRange: '$$$$',
    gradient: ['#1A3A5A', '#3A6A8A'],
    courses: ['Pebble Beach Golf Links', 'Spyglass Hill', 'The Links at Spanish Bay'],
  },
  {
    id: 'dd2',
    name: 'Bandon Dunes',
    description: 'Links-style golf on the rugged Oregon coast. Wind-swept dunes and raw, natural beauty.',
    courseCount: 6,
    bestSeason: 'Jun – Sep',
    priceRange: '$$$',
    gradient: ['#3A5A3A', '#6B8F6B'],
    courses: ['Bandon Dunes', 'Pacific Dunes', 'Old Macdonald'],
  },
  {
    id: 'dd3',
    name: 'Pinehurst',
    description: 'The cradle of American golf. Sandhills, pine trees, and the legendary No. 2 course.',
    courseCount: 9,
    bestSeason: 'Mar – May',
    priceRange: '$$$',
    gradient: ['#5A3D7A', '#8B6DAF'],
    courses: ['Pinehurst No. 2', 'Pinehurst No. 4', 'Pinehurst No. 8'],
  },
  {
    id: 'dd4',
    name: 'Scottsdale',
    description: 'Desert golf at its finest. Saguaro cacti, mountain views, and year-round sunshine.',
    courseCount: 12,
    bestSeason: 'Oct – Apr',
    priceRange: '$$',
    gradient: ['#8B6B3A', '#C4994A'],
    courses: ['TPC Scottsdale', 'We-Ko-Pa Saguaro', 'Grayhawk Raptor'],
  },
  {
    id: 'dd5',
    name: 'Kiawah Island',
    description: 'Pete Dye masterpiece on the South Carolina coast. The Ocean Course is an unforgettable challenge.',
    courseCount: 5,
    bestSeason: 'Mar – May',
    priceRange: '$$$$',
    gradient: ['#2D4A3A', '#5A7B6A'],
    courses: ['The Ocean Course', 'Osprey Point', 'Cougar Point'],
  },
  {
    id: 'dd6',
    name: 'Streamsong',
    description: 'Hidden gem in central Florida. Three world-class courses on reclaimed phosphate land.',
    courseCount: 3,
    bestSeason: 'Nov – Apr',
    priceRange: '$$$',
    gradient: ['#4A5A3A', '#7A8B6A'],
    courses: ['Streamsong Red', 'Streamsong Blue', 'Streamsong Black'],
  },
  {
    id: 'dd7',
    name: 'Hilton Head',
    description: 'Lowcountry charm meets championship golf. Spanish moss, ocean breezes, and great food.',
    courseCount: 8,
    bestSeason: 'Mar – May',
    priceRange: '$$',
    gradient: ['#2D3A2D', '#4A5C4A'],
    courses: ['Harbour Town Golf Links', 'Atlantic Dunes', 'Heron Point'],
  },
  {
    id: 'dd8',
    name: 'Palm Springs',
    description: 'Desert oasis with mountain backdrops. Over 100 courses within the Coachella Valley.',
    courseCount: 15,
    bestSeason: 'Nov – Apr',
    priceRange: '$$',
    gradient: ['#5A4A2A', '#8A7A5A'],
    courses: ['PGA West Stadium', 'La Quinta Mountain', 'Indian Wells Celebrity'],
  },
];

// ─── Section label ───────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[s.sectionLabel, { color: theme.colors.gold, fontFamily: GEO }]}>{title}</Text>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════
export default function DiscoverScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const toggleSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const savedDestinations = DISCOVER_DESTINATIONS.filter((d) => savedIds.has(d.id));

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style="light" />
      {/* Header */}
      <View style={[s.header, { backgroundColor: c.surface }]}>
        <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerBrand, { color: c.gold, fontFamily: GEO }]}>DORMIE</Text>
          <Text style={[s.headerTitle, { color: c.text, fontFamily: GEO }]}>Discover</Text>
        </View>
        <Ionicons name="compass" size={22} color={c.gold} />
      </View>

      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Dream Board */}
        {savedDestinations.length > 0 && (
          <View style={s.dreamSection}>
            <SectionLabel title="DREAM BOARD" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.dreamScroll}
            >
              {savedDestinations.map((dest) => (
                <View key={dest.id} style={s.dreamCard}>
                  <LinearGradient
                    colors={dest.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.dreamGradient}
                  >
                    <View style={s.dreamOverlay} />
                    {/* Remove button */}
                    <Pressable
                      onPress={() => { haptics.light(); removeSaved(dest.id); }}
                      style={s.dreamRemoveBtn}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color="rgba(255,255,255,0.8)" />
                    </Pressable>
                    <Text style={[s.dreamName, { fontFamily: GEO }]}>{dest.name}</Text>
                    <Text style={s.dreamCourses}>{dest.courseCount} courses</Text>
                  </LinearGradient>
                  <Pressable
                    onPress={() => { haptics.light(); router.push(`/create-trip?destination=${encodeURIComponent(dest.name)}`); }}
                    style={[s.dreamFooter, { backgroundColor: c.cardBg }]}
                  >
                    <Text style={[s.dreamAction, { color: c.teal }]}>Plan Trip →</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {savedDestinations.length > 0 && <GoldDivider style={{ marginBottom: 4 }} />}

        {/* Destinations */}
        <View style={s.body}>
          <SectionLabel title="DESTINATIONS" />

          {DISCOVER_DESTINATIONS.map((dest) => {
            const isSaved = savedIds.has(dest.id);
            const isDark = theme.isDark;
            return (
              <View
                key={dest.id}
                style={[s.destCard, { borderColor: c.border }, isDark ? cardShadowDark : cardShadowLight]}
              >
                {/* Gradient image area */}
                <LinearGradient
                  colors={dest.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.destGradient}
                >
                  <View style={s.destGradientOverlay} />

                  {/* Star / save button */}
                  <Pressable
                    onPress={() => { haptics.light(); toggleSaved(dest.id); }}
                    style={[
                      s.starBtn,
                      isSaved && { backgroundColor: 'rgba(212,175,55,0.25)' },
                    ]}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={isSaved ? 'star' : 'star-outline'}
                      size={18}
                      color={isSaved ? '#D4AF37' : 'rgba(255,255,255,0.6)'}
                    />
                  </Pressable>

                  <Text style={[s.destName, { fontFamily: GEO }]}>{dest.name}</Text>
                </LinearGradient>

                {/* Info body */}
                <View style={[s.destBody, { backgroundColor: c.cardBg }]}>
                  <Text style={[s.destDesc, { color: c.textMuted }]}>{dest.description}</Text>

                  {/* Meta pills */}
                  <View style={s.destMetaRow}>
                    <View style={[s.destMeta, { backgroundColor: c.elevated }]}>
                      <Ionicons name="golf-outline" size={12} color={c.teal} />
                      <Text style={[s.destMetaText, { color: c.text }]}>{dest.courseCount} courses</Text>
                    </View>
                    <View style={[s.destMeta, { backgroundColor: c.elevated }]}>
                      <Ionicons name="calendar-outline" size={12} color={c.gold} />
                      <Text style={[s.destMetaText, { color: c.text }]}>{dest.bestSeason}</Text>
                    </View>
                    <View style={[s.destMeta, { backgroundColor: c.elevated }]}>
                      <Ionicons name="cash-outline" size={12} color={c.teal} />
                      <Text style={[s.destMetaText, { color: c.text }]}>{dest.priceRange}</Text>
                    </View>
                  </View>

                  {/* Top courses */}
                  <View style={s.destCoursesList}>
                    {dest.courses.map((course) => (
                      <View key={course} style={[s.destCourseRow, { borderColor: c.border }]}>
                        <Ionicons name="golf" size={12} color={c.textMuted} />
                        <Text style={[s.destCourseName, { color: c.text }]}>{course}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
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
  headerCenter: { alignItems: 'center' },
  headerBrand: {
    fontSize: 9,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 3,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', marginTop: 2 },

  /* Section label */
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
  },

  body: { paddingHorizontal: 20 },

  /* Dream board */
  dreamSection: { paddingHorizontal: 20 },
  dreamScroll: { gap: 10, paddingRight: 16 },
  dreamCard: { width: 160, overflow: 'hidden' },
  dreamGradient: {
    height: 90,
    justifyContent: 'flex-end',
    padding: 10,
  },
  dreamOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dreamRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dreamName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dreamCourses: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },
  dreamFooter: { paddingVertical: 8, paddingHorizontal: 10 },
  dreamAction: { fontSize: 11, fontWeight: '700' },

  /* Destination card */
  destCard: {
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  destGradient: {
    height: 120,
    justifyContent: 'flex-end',
    padding: 14,
  },
  destGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  starBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  destName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  destBody: { padding: 16 },
  destDesc: { fontSize: 13, lineHeight: 18 },
  destMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  destMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  destMetaText: { fontSize: 11, fontWeight: '600' },
  destCoursesList: { marginTop: 10 },
  destCourseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
  },
  destCourseName: { fontSize: 12, fontWeight: '600' },
});
