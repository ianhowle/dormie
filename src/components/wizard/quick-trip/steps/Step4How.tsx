// =============================================================
// Step 4 — How (format selection)
// =============================================================
// B+D pattern: recent-at-top + educated list + Help-me-choose escape
// hatch. Single-select — exactly one ScoringFormat.
//
// Sections (top → bottom):
//   1. "Your most-used" — top 3 recent formats from tripsService
//      .getRecentFormats() with the established three-layer fallback
//      (user history → cross-user popular RPC → curated default).
//      Hidden when the resolved list is empty (rare; layer-3 fallback
//      catches most cases). Horizontal scroll of pill cards.
//   2. "All formats" — vertical list of every SCORING_FORMATS entry
//      with name + complexity badge + one-line description + ⓘ.
//      Tapping the row selects; tapping ⓘ opens InfoDisclosureModal.
//   3. "Help me choose →" — opens HelpMeChoose mode='format'. The
//      sub-flow returns a recommendation that's dispatched to state.
//
// Validation: Step 4 advances when state.format !== null.
// =============================================================

import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../theme/ThemeContext';
import { GEO } from '../../../../theme/fonts';
import { haptics } from '../../../../lib/haptics';
import { useAuth } from '../../../../lib/auth';
import { tripsService } from '../../../../services/trips.service';
import {
  SCORING_FORMATS,
  type Complexity,
  type FormatInfo,
  type ScoringFormat,
  type SideGame,
} from '../../../../data/scoring';
import { InfoDisclosureModal } from '../../InfoDisclosureModal';
import { HelpMeChoose } from '../../HelpMeChoose';
import { useWizard } from '../WizardContext';

const HAIRLINE = 'rgba(255,255,255,0.06)';
const CARD_BG = '#151312';
const AUGUSTA = '#006747';
const GOLD = '#C9A227';

// Match InfoDisclosureModal's complexity palette so the badges read
// consistently across the two surfaces.
const COMPLEXITY_COLOR: Record<Complexity, string> = {
  Beginner: '#006747',  // Augusta green
  Casual: '#8A857F',    // muted
  Expert: '#C9A227',    // gold
};

// =============================================================
// Component
// =============================================================

export function Step4How() {
  const { state, dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();

  // ─── Recent formats (Layer-1+2+3 fallback) ─────────────────────
  const [recentFormats, setRecentFormats] = useState<ScoringFormat[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    tripsService
      .getRecentFormats(user.id, 3)
      .then((formats) => {
        if (!cancelled) setRecentFormats(formats);
      })
      .catch(() => {
        // Best-effort. Section just doesn't render on failure.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const recentInfos = useMemo(
    () =>
      recentFormats
        .map((key) => SCORING_FORMATS.find((f) => f.key === key))
        .filter((f): f is FormatInfo => !!f),
    [recentFormats],
  );

  // ─── Disclosure modal state ────────────────────────────────────
  const [disclosure, setDisclosure] = useState<FormatInfo | null>(null);

  // ─── Help-me-choose state ──────────────────────────────────────
  const [showHelpMeChoose, setShowHelpMeChoose] = useState(false);

  const handleSelect = (format: ScoringFormat) => {
    haptics.light();
    dispatch({ type: 'SET_FORMAT', format });
  };

  const handleOpenDisclosure = (format: FormatInfo) => {
    haptics.light();
    setDisclosure(format);
  };

  const handleHelpMeChoose = () => {
    haptics.light();
    setShowHelpMeChoose(true);
  };

  const handleHelpMeChooseComplete = (
    rec: ScoringFormat | SideGame,
    _rationale: string,
  ) => {
    // mode='format' → rec is always a ScoringFormat at runtime.
    dispatch({ type: 'SET_FORMAT', format: rec as ScoringFormat });
    setShowHelpMeChoose(false);
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={[s.prompt, { color: c.text, fontFamily: GEO }]}>
        How are you scoring?
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        Pick a format. We'll explain each as you go.
      </Text>

      {/* Section 1 — Your most-used */}
      {recentInfos.length > 0 ? (
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
            YOUR MOST-USED
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.recentRow}
          >
            {recentInfos.map((info) => {
              const selected = state.format === info.key;
              return (
                <Pressable
                  key={info.key}
                  onPress={() => handleSelect(info.key)}
                  style={({ pressed }) => [
                    s.recentPill,
                    {
                      backgroundColor: CARD_BG,
                      borderColor: selected ? AUGUSTA : HAIRLINE,
                      borderWidth: selected ? 1.5 : 1,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.recentName,
                      {
                        color: selected ? GOLD : c.text,
                        fontFamily: GEO,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {info.label}
                  </Text>
                  <ComplexityBadge complexity={info.complexity} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Section 2 — All formats */}
      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
          ALL FORMATS
        </Text>
        {SCORING_FORMATS.map((info) => {
          const selected = state.format === info.key;
          return (
            <Pressable
              key={info.key}
              onPress={() => handleSelect(info.key)}
              style={({ pressed }) => [
                s.formatRow,
                {
                  backgroundColor: CARD_BG,
                  borderColor: HAIRLINE,
                  borderLeftColor: selected ? AUGUSTA : 'transparent',
                  borderLeftWidth: selected ? 3 : 0,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={s.formatRowBody}>
                <View style={s.formatRowHead}>
                  <Text
                    style={[
                      s.formatName,
                      {
                        color: selected ? GOLD : c.text,
                        fontFamily: GEO,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {info.label}
                  </Text>
                  <ComplexityBadge complexity={info.complexity} />
                </View>
                <Text
                  style={[s.formatDescription, { color: c.textMuted }]}
                  numberOfLines={2}
                >
                  {info.description}
                </Text>
              </View>
              <Pressable
                onPress={() => handleOpenDisclosure(info)}
                hitSlop={12}
                style={({ pressed }) => [
                  s.infoBtn,
                  { opacity: pressed ? 0.5 : 1 },
                ]}
                accessibilityLabel={`Info about ${info.label}`}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={c.textMuted}
                />
              </Pressable>
            </Pressable>
          );
        })}
      </View>

      {/* Section 3 — Help me choose */}
      <Pressable
        onPress={handleHelpMeChoose}
        style={({ pressed }) => [
          s.helpLink,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[s.helpLinkText, { color: c.textMuted, fontFamily: GEO }]}>
          Help me choose →
        </Text>
      </Pressable>

      {/* Disclosure modal */}
      {disclosure ? (
        <InfoDisclosureModal
          visible={!!disclosure}
          onClose={() => setDisclosure(null)}
          title={disclosure.label}
          complexity={disclosure.complexity}
          description={disclosure.description}
          fullDescription={disclosure.fullDescription}
          example={disclosure.example}
          whenToUse={disclosure.whenToUse}
        />
      ) : null}

      {/* Help me choose sub-flow */}
      <HelpMeChoose
        visible={showHelpMeChoose}
        mode="format"
        onComplete={handleHelpMeChooseComplete}
        onCancel={() => setShowHelpMeChoose(false)}
      />
    </ScrollView>
  );
}

// =============================================================
// Complexity badge
// =============================================================

function ComplexityBadge({ complexity }: { complexity: Complexity }) {
  const color = COMPLEXITY_COLOR[complexity];
  return (
    <View
      style={[
        s.badge,
        { borderColor: color, backgroundColor: `${color}15` },
      ]}
    >
      <Text style={[s.badgeText, { color, fontFamily: GEO }]}>
        {complexity.toUpperCase()}
      </Text>
    </View>
  );
}

// =============================================================
// Styles
// =============================================================

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },

  /* Header */
  prompt: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 24,
  },

  /* Section primitives */
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },

  /* Recent pills */
  recentRow: {
    gap: 8,
    paddingRight: 4, // breathing room at end of horizontal scroll
  },
  recentPill: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 140,
    gap: 8,
  },
  recentName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  /* All-formats list */
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  formatRowBody: {
    flex: 1,
  },
  formatRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  formatName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  formatDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoBtn: {
    marginLeft: 8,
    padding: 4,
  },

  /* Complexity badge */
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  /* Help me choose link */
  helpLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  helpLinkText: {
    fontSize: 13,
    textDecorationLine: 'underline',
    letterSpacing: 0.3,
  },
});
