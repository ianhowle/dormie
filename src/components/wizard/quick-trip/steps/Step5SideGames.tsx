// =============================================================
// Step 5 — Side games (optional spice)
// =============================================================
// Same B+D pattern as Step 4 (How), but multi-select. Zero side games
// is valid — they're optional. The Skip link clears any in-progress
// selections and advances to Step 6.
//
// Sections (top → bottom):
//   1. "Your most-used" — top 3 recent side games via
//      tripsService.getRecentSideGames() with the three-layer
//      fallback. Hidden when the resolved list is empty.
//   2. "All side games" — vertical list of every SIDE_GAMES entry.
//      Tapping the row toggles inclusion. ⓘ opens InfoDisclosureModal.
//   3. "Help me choose →" — opens HelpMeChoose mode='sideGame'.
//      Recommendations dispatch ADD_SIDE_GAME (additive — never
//      removes user's existing picks).
//   4. "Skip side games" — clears all selections and advances.
//
// Validation: Step 5 always advances (zero selections is valid).
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
  SIDE_GAMES,
  type Complexity,
  type ScoringFormat,
  type SideGame,
  type SideGameInfo,
} from '../../../../data/scoring';
import { InfoDisclosureModal } from '../../InfoDisclosureModal';
import { HelpMeChoose } from '../../HelpMeChoose';
import { useToast } from '../../../Toast';
import { useWizard } from '../WizardContext';
import { checkFormatCompatibility, type CompatibilityResult } from '../compatibility';

const HAIRLINE = 'rgba(255,255,255,0.06)';
const CARD_BG = '#151312';
const AUGUSTA = '#006747';
const GOLD = '#C9A227';
// Compatibility lock-out tokens — same palette as Step 4 for visual
// continuity across the two surfaces.
const COMPAT_TAG_COLOR = 'rgba(201,162,39,0.65)';
const LOCK_ICON_COLOR = 'rgba(201,162,39,0.5)';
const BANNER_BG = 'rgba(196,30,58,0.08)';
const BANNER_BORDER = 'rgba(196,30,58,0.35)';

// Match InfoDisclosureModal + Step 4 complexity palette so all three
// surfaces read consistently.
const COMPLEXITY_COLOR: Record<Complexity, string> = {
  Beginner: '#006747',
  Casual: '#8A857F',
  Expert: '#C9A227',
};

// =============================================================
// Component
// =============================================================

export function Step5SideGames() {
  const { state, dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();

  // ─── Recent side games (Layer-1+2+3 fallback) ─────────────────
  const [recentSideGames, setRecentSideGames] = useState<SideGame[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    tripsService
      .getRecentSideGames(user.id, 3)
      .then((games) => {
        if (!cancelled) setRecentSideGames(games);
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
      recentSideGames
        .map((key) => SIDE_GAMES.find((g) => g.key === key))
        .filter((g): g is SideGameInfo => !!g),
    [recentSideGames],
  );

  // ─── Selection lookup ─────────────────────────────────────────
  const selectedSet = useMemo(
    () => new Set(state.sideGames),
    [state.sideGames],
  );

  const playerCount = state.players.length;
  const { showToast } = useToast();

  // Side games that were previously selected but are now incompatible
  // with the current roster (user shrunk roster after selecting).
  // Surfaces a banner above the list and gates Next via computeCanAdvance.
  const invalidatedSideGames = useMemo(
    () =>
      state.sideGames
        .map((key) => SIDE_GAMES.find((g) => g.key === key))
        .filter((sg): sg is SideGameInfo => !!sg)
        .filter(
          (sg) =>
            checkFormatCompatibility(sg, playerCount).state === 'locked-too-few',
        ),
    [state.sideGames, playerCount],
  );

  // ─── Disclosure modal state ───────────────────────────────────
  const [disclosure, setDisclosure] = useState<SideGameInfo | null>(null);

  // ─── Help-me-choose state ─────────────────────────────────────
  const [showHelpMeChoose, setShowHelpMeChoose] = useState(false);

  const handleToggle = (sideGame: SideGame, compat: CompatibilityResult) => {
    if (compat.state === 'locked-too-few') {
      // Locked side game tap → toast, no toggle. Allows the user to
      // deselect a previously-selected side game even if it's now
      // locked (the toggle still fires for currently-selected
      // entries — see selected check below).
      const isSelected = selectedSet.has(sideGame);
      if (isSelected) {
        // Deselect path: always allowed, even if locked.
        haptics.light();
        dispatch({ type: 'TOGGLE_SIDE_GAME', sideGame });
        return;
      }
      haptics.warning();
      showToast({
        message: 'Add more players to unlock this side game',
        type: 'info',
      });
      return;
    }
    haptics.light();
    dispatch({ type: 'TOGGLE_SIDE_GAME', sideGame });
  };

  const handleOpenDisclosure = (info: SideGameInfo) => {
    haptics.light();
    setDisclosure(info);
  };

  const handleHelpMeChoose = () => {
    haptics.light();
    setShowHelpMeChoose(true);
  };

  const handleHelpMeChooseComplete = (
    rec: ScoringFormat | SideGame,
    _rationale: string,
  ) => {
    // mode='sideGame' → rec is always a SideGame at runtime. Use
    // ADD (not toggle) so the recommendation never removes one of
    // the user's existing picks.
    dispatch({ type: 'ADD_SIDE_GAME', sideGame: rec as SideGame });
    setShowHelpMeChoose(false);
  };

  const handleSkip = () => {
    haptics.light();
    dispatch({ type: 'CLEAR_SIDE_GAMES' });
    dispatch({ type: 'NEXT_STEP' });
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={[s.prompt, { color: c.text, fontFamily: GEO }]}>
        Add side games?
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        Optional bets and contests on top of your scoring format. Skip if
        you don't want any.
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
              const selected = selectedSet.has(info.key);
              const compat = checkFormatCompatibility(info, playerCount);
              const locked = compat.state === 'locked-too-few' && !selected;
              return (
                <Pressable
                  key={info.key}
                  onPress={() => handleToggle(info.key, compat)}
                  style={({ pressed }) => [
                    s.recentPill,
                    {
                      backgroundColor: CARD_BG,
                      borderColor: selected ? AUGUSTA : HAIRLINE,
                      borderWidth: selected ? 1.5 : 1,
                      opacity: locked ? 0.4 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={s.recentPillHead}>
                    {selected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={GOLD}
                      />
                    ) : null}
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
                  </View>
                  <ComplexityBadge complexity={info.complexity} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Invalidation banner — shown when one or more selected side
          games are now locked due to a roster shrink. Footer Next is
          gated by computeCanAdvance until the user deselects the
          locked entries or grows the roster. */}
      {invalidatedSideGames.length > 0 ? (
        <View style={s.invalidationBanner}>
          <Ionicons name="alert-circle" size={18} color="#C41E3A" />
          <Text style={s.invalidationBannerText}>
            {invalidatedSideGames.length === 1
              ? `${invalidatedSideGames[0].label} no longer fits this roster. Tap to deselect or add more players.`
              : `${invalidatedSideGames.length} selected side games no longer fit this roster. Deselect them or add more players.`}
          </Text>
        </View>
      ) : null}

      {/* Section 2 — All side games */}
      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
          ALL SIDE GAMES
        </Text>
        {SIDE_GAMES.map((info) => {
          const selected = selectedSet.has(info.key);
          const compat = checkFormatCompatibility(info, playerCount);
          // A row is "locked" only when compat fails AND it's NOT
          // currently selected. Selected-but-now-locked rows render
          // with a warning state (banner above) but stay tappable
          // for deselection.
          const locked = compat.state === 'locked-too-few' && !selected;
          const advisory = compat.state === 'recommended-mismatch';
          return (
            <Pressable
              key={info.key}
              onPress={() => handleToggle(info.key, compat)}
              style={({ pressed }) => [
                s.sideGameRow,
                {
                  backgroundColor: CARD_BG,
                  borderColor: HAIRLINE,
                  borderLeftColor: selected ? AUGUSTA : 'transparent',
                  borderLeftWidth: selected ? 3 : 0,
                  // Press feedback at row level. Locked-state dim is
                  // applied to the inner body so the ⓘ button stays
                  // at full opacity for education.
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[s.sideGameRowBody, locked && s.lockedBody]}>
                <View style={s.sideGameRowHead}>
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
                      s.sideGameName,
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
                  style={[s.sideGameDescription, { color: c.textMuted }]}
                  numberOfLines={2}
                >
                  {info.description}
                </Text>
                {(locked || advisory) && compat.message ? (
                  <Text style={s.compatTag}>{compat.message}</Text>
                ) : null}
              </View>
              {selected ? (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={GOLD}
                  style={s.rowEndIcon}
                />
              ) : null}
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

      {/* Section 4 — Skip side games */}
      <Pressable
        onPress={handleSkip}
        style={({ pressed }) => [
          s.skipLink,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[s.skipLinkText, { color: c.textMuted, fontFamily: GEO }]}>
          Skip side games
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
        mode="sideGame"
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
    lineHeight: 18,
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
    paddingRight: 4,
  },
  recentPill: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 140,
    gap: 8,
  },
  recentPillHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },

  /* All-side-games list */
  sideGameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  sideGameRowBody: {
    flex: 1,
  },
  lockedBody: {
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
    color: '#E8E4DE',
  },
  sideGameRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sideGameName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  sideGameDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowEndIcon: {
    marginHorizontal: 4,
  },
  infoBtn: {
    marginLeft: 4,
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

  /* Bottom links */
  helpLink: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  helpLinkText: {
    fontSize: 13,
    textDecorationLine: 'underline',
    letterSpacing: 0.3,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipLinkText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
