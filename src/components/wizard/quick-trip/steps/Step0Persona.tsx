// =============================================================
// Step 0 — Persona Fork
// =============================================================
// Three vertical pressable cards eliminate the "select trip type from
// a list" feel. Each option is described in user-mental-model terms
// (per docs/trips-wizard-redesign-spec-2026-05-05.md Step 0).
//
// Tap behavior:
//   - Quick Trip → SELECT_PERSONA('quick') + NEXT_STEP (advance to
//     Step 1 — Where)
//   - Plan Ahead → toast "coming next release", stay on Step 0. Phase
//     3 wires the real Plan Ahead flow.
//   - Ryder Cup → router.replace('/create-trip') so the existing
//     legacy TypeSelection screen shows. The user picks Ryder Cup
//     there, which mounts the existing RyderCupWizard. Phase 4
//     migrates Ryder to share the universal wizard pattern.
//
// Optional duplicate row at the bottom — Phase 2.1 stubs the tap with
// a "coming next release" toast. Real duplicate-flow data carry-over
// lands in Phase 2.9 polish or Phase 3.
// =============================================================

import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../theme/ThemeContext';
import { GEO } from '../../../../theme/fonts';
import { haptics } from '../../../../lib/haptics';
import { useToast } from '../../../Toast';
import { useWizard, type WizardPersona } from '../WizardContext';

const HAIRLINE = 'rgba(255,255,255,0.06)';
const TOP_ACCENT = 'rgba(255,255,255,0.12)';
const CARD_BG = '#151312';

interface PersonaCardConfig {
  persona: Exclude<WizardPersona, null>;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CARDS: PersonaCardConfig[] = [
  {
    persona: 'quick',
    label: 'QUICK TRIP',
    description:
      'Single-day round with friends. Locked-in date, casual format, ready to launch.',
    icon: 'flag-outline',
  },
  {
    persona: 'plan',
    label: 'PLAN AHEAD',
    description:
      'Multi-day trips, far-future dates, courses TBD. Build it as you go.',
    icon: 'calendar-outline',
  },
  {
    persona: 'ryder',
    label: 'RYDER CUP',
    description:
      'Team competition with captains, drafts, and per-day formats. Built for the big one.',
    icon: 'trophy-outline',
  },
];

export function Step0Persona() {
  const { dispatch } = useWizard();
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();

  const handleTap = (persona: Exclude<WizardPersona, null>) => {
    haptics.light();
    if (persona === 'quick') {
      dispatch({ type: 'SELECT_PERSONA', persona: 'quick' });
      dispatch({ type: 'NEXT_STEP' });
      return;
    }
    if (persona === 'plan') {
      showToast({
        message: 'Plan Ahead — coming next release',
        type: 'info',
      });
      return;
    }
    if (persona === 'ryder') {
      // Route to the legacy /create-trip TypeSelection screen — user
      // picks Ryder Cup there, which mounts the existing RyderCupWizard.
      // Phase 4 migrates Ryder to the universal wizard pattern.
      router.replace('/create-trip');
      return;
    }
  };

  const handleDuplicateTap = () => {
    haptics.light();
    showToast({
      message: 'Duplicate flow coming next release',
      type: 'info',
    });
  };

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero prompt — Georgia serif, mirrors the "What's this trip?"
          framing from the spec. */}
      <Text style={[s.prompt, { color: c.text, fontFamily: GEO }]}>
        What's this trip?
      </Text>

      <View style={s.cardStack}>
        {CARDS.map((card) => (
          <Pressable
            key={card.persona}
            onPress={() => handleTap(card.persona)}
            style={({ pressed }) => [
              s.card,
              {
                backgroundColor: CARD_BG,
                borderColor: HAIRLINE,
                borderTopColor: TOP_ACCENT,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${card.label}: ${card.description}`}
          >
            <View style={s.cardBody}>
              <View style={s.cardHeader}>
                <Ionicons name={card.icon} size={16} color={c.gold} />
                <Text style={[s.cardLabel, { color: c.gold, fontFamily: GEO }]}>
                  {card.label}
                </Text>
              </View>
              <Text style={[s.cardDescription, { color: c.text, fontFamily: GEO }]}>
                {card.description}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={c.gold}
              style={s.chevron}
            />
          </Pressable>
        ))}
      </View>

      {/* Optional duplicate row — Phase 2.1 stub. Real data carry-over
          lands in 2.9 / Phase 3. */}
      <Pressable
        onPress={handleDuplicateTap}
        style={({ pressed }) => [
          s.duplicateLink,
          { opacity: pressed ? 0.5 : 1 },
        ]}
        hitSlop={8}
      >
        <Text style={[s.duplicateText, { color: c.textMuted }]}>
          Duplicate a past trip →
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  prompt: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 28,
  },
  cardStack: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    // Sharper top edge as a subtle visual delineator, per spec
    // ("subtle border on top edge"). Sharp edges throughout — no
    // borderRadius (Dormie design DNA).
    borderTopWidth: 2,
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  chevron: {
    marginLeft: 12,
  },
  duplicateLink: {
    marginTop: 32,
    alignItems: 'center',
    paddingVertical: 12,
  },
  duplicateText: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
