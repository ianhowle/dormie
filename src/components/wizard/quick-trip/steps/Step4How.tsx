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
import { useToast } from '../../../Toast';
import { useWizard } from '../WizardContext';
import { checkFormatCompatibility, type CompatibilityResult } from '../compatibility';

const AUGUSTA = '#006747';
const GOLD = '#C9A227';
// Compatibility lock-out tokens (Phase 2.9 UI sub-phase) — muted gold
// matching the multi-course off-ramp link from Step 1, used here for
// requirement tags + the lock icon. Banner uses a warmer red-tinted
// surface to signal "this needs your attention" without screaming.
const COMPAT_TAG_COLOR = 'rgba(201,162,39,0.65)';
const LOCK_ICON_COLOR = 'rgba(201,162,39,0.5)';
const BANNER_BG = 'rgba(196,30,58,0.08)';
const BANNER_BORDER = 'rgba(196,30,58,0.35)';

// Match InfoDisclosureModal's complexity palette so the badges read
// consistently across the two surfaces. Beginner/Expert are brand
// accents (theme-invariant); Casual maps to the theme's muted text
// token so the badge reads on both dark and light backgrounds.

// =============================================================
// Component
// =============================================================

export function Step4How() {
  const { state, dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const { showToast } = useToast();

  const playerCount = state.players.length;

  // Currently-selected format compatibility. When the user backs into
  // Step 3 and shrinks the roster below this format's requirement, the
  // selection becomes invalid — surface a banner above the list and
  // gate Next via computeCanAdvance (handled in WizardContext).
  const selectedFormatInfo = useMemo(
    () => (state.format ? SCORING_FORMATS.find((f) => f.key === state.format) ?? null : null),
    [state.format],
  );
  const selectedCompat: CompatibilityResult | null = useMemo(
    () =>
      selectedFormatInfo
        ? checkFormatCompatibility(selectedFormatInfo, playerCount)
        : null,
    [selectedFormatInfo, playerCount],
  );
  const selectionInvalidated =
    !!selectedFormatInfo && selectedCompat?.state === 'locked-too-few';

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

  const handleSelect = (format: ScoringFormat, compat: CompatibilityResult) => {
    if (compat.state === 'locked-too-few') {
      // Locked rows: tap surfaces a toast instead of selecting.
      // ⓘ icon still works for education (handled separately).
      haptics.warning();
      showToast({
        message: 'Add more players to unlock this format',
        type: 'info',
      });
      return;
    }
    // 'compatible' and 'recommended-mismatch' both proceed — the
    // mismatch tag is advisory only.
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
              const compat = checkFormatCompatibility(info, playerCount);
              const locked = compat.state === 'locked-too-few';
              return (
                <Pressable
                  key={info.key}
                  onPress={() => handleSelect(info.key, compat)}
                  style={({ pressed }) => [
                    s.recentPill,
                    {
                      backgroundColor: c.cardBg,
                      borderColor: selected ? AUGUSTA : c.border,
                      borderWidth: selected ? 1.5 : 1,
                      opacity: locked ? 0.4 : pressed ? 0.85 : 1,
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

      {/* Invalidation banner — appears when state.format is set but
          the current roster size puts that format into 'locked-too-few'.
          Typical trigger: user picked a format on Step 4, went back
          to Step 3, removed players. Footer Next is disabled via
          computeCanAdvance until the user picks a different (compat)
          format or grows the roster. */}
      {selectionInvalidated && selectedFormatInfo && selectedCompat ? (
        <View style={s.invalidationBanner}>
          <Ionicons name="alert-circle" size={18} color={c.urgent} />
          <Text style={[s.invalidationBannerText, { color: c.text }]}>
            {selectedFormatInfo.label} {selectedCompat.message
              ? `— ${selectedCompat.message.toLowerCase()}`
              : 'no longer fits this roster'}. Pick a different format or add more players.
          </Text>
        </View>
      ) : null}

      {/* Section 2 — All formats */}
      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
          ALL FORMATS
        </Text>
        {SCORING_FORMATS.map((info) => {
          const selected = state.format === info.key;
          const compat = checkFormatCompatibility(info, playerCount);
          const locked = compat.state === 'locked-too-few';
          const advisory = compat.state === 'recommended-mismatch';
          return (
            <Pressable
              key={info.key}
              onPress={() => handleSelect(info.key, compat)}
              style={({ pressed }) => [
                s.formatRow,
                {
                  backgroundColor: c.cardBg,
                  borderColor: c.border,
                  borderLeftColor: selected ? AUGUSTA : 'transparent',
                  borderLeftWidth: selected ? 3 : 0,
                  // Press feedback applies at row level. Locked-state
                  // dim is applied only to the inner body so the ⓘ
                  // button stays at full opacity (users can still
                  // read the disclosure on locked formats).
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[s.formatRowBody, locked && s.lockedBody]}>
                <View style={s.formatRowHead}>
                  {locked ? (
                    <Ionicons
                      name="lock-closed"
                      size={14}
                      color={LOCK_ICON_COLOR}
                      style={s.lockIcon}
                    />
                  ) : null}
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
                {(locked || advisory) && compat.message ? (
                  <Text style={s.compatTag}>{compat.message}</Text>
                ) : null}
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
  const { theme } = useTheme();
  const c = theme.colors;
  const color =
    complexity === 'Beginner' ? '#006747'
    : complexity === 'Expert'  ? '#C9A227'
    : c.textMuted;
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
  lockedBody: {
    // Applied to the row body when compat.state === 'locked-too-few'.
    // The ⓘ button is a sibling, NOT inside formatRowBody, so it
    // stays at full opacity.
    opacity: 0.4,
  },
  lockIcon: {
    marginRight: 2,
  },
  compatTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: COMPAT_TAG_COLOR,
    marginTop: 6,
    fontFamily: 'Georgia',
  },
  /* Invalidation banner — shown above the format list when state.format
     is set but no longer compatible (user shrunk the roster after
     selecting). */
  invalidationBanner: {
    backgroundColor: BANNER_BG,
    borderColor: BANNER_BORDER,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invalidationBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
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
