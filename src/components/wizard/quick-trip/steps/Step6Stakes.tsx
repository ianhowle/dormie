// =============================================================
// Step 6 — Stakes (per-game with adjustability)
// =============================================================
// One PerGameStakeInput row per selected format + each selected side
// game. Defaults seeded automatically from defaultAmountFor() and
// defaultConfigFor(). Zero stakes is valid — trips can settle offline.
//
// Sections:
//   - "Format stakes" — single row for state.format
//   - "Side game stakes" — one row per state.sideGames entry (only
//     rendered when sideGames.length > 0)
//   - "Skip stakes — handle offline" link below the inputs
//
// Auto-seed: on mount and whenever the format/sideGames selection
// changes, seed any missing perGameStakes entry with defaults.
// Existing entries are preserved (re-entering Step 6 doesn't reset
// adjustments). Skipping clears all entries; re-entering after skip
// re-seeds defaults — intent lost on back-nav, acceptable trade for v1.
//
// Validation: Step 6 advances unconditionally. The Skip link in the
// step body is a one-shot CLEAR_STAKES + NEXT_STEP shortcut.
// =============================================================

import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme/ThemeContext';
import { GEO } from '../../../../theme/fonts';
import { haptics } from '../../../../lib/haptics';
import {
  PerGameStakeInput,
  defaultAmountFor,
  defaultConfigFor,
  type PerGameStakeKey,
} from '../../PerGameStakeInput';
import { useWizard } from '../WizardContext';

// =============================================================
// Component
// =============================================================

export function Step6Stakes() {
  const { state, dispatch } = useWizard();
  const { theme } = useTheme();
  const c = theme.colors;

  // ─── Auto-seed defaults ───────────────────────────────────────
  // For every selected format/sideGame missing a perGameStakes entry,
  // dispatch SET_PER_GAME_STAKE with defaults. Already-set entries
  // are preserved (re-entering Step 6 keeps user adjustments).
  useEffect(() => {
    const keys: PerGameStakeKey[] = [];
    if (state.format) keys.push(state.format);
    state.sideGames.forEach((g) => keys.push(g));
    for (const key of keys) {
      if (!state.perGameStakes[key]) {
        dispatch({
          type: 'SET_PER_GAME_STAKE',
          key,
          stake: {
            amount: defaultAmountFor(key),
            config: defaultConfigFor(key),
          },
        });
      }
    }
  }, [state.format, state.sideGames, state.perGameStakes, dispatch]);

  const handleSkip = () => {
    haptics.light();
    dispatch({ type: 'CLEAR_STAKES' });
    dispatch({ type: 'NEXT_STEP' });
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <Text style={[s.prompt, { color: c.text, fontFamily: GEO }]}>
        Set the stakes
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        Add dollar amounts for each game. Skip if you'll handle stakes off
        the app.
      </Text>

      {/* Format stakes — defensive null check; Step 4 validation gates
          on state.format !== null so the section always renders in
          normal flow. */}
      {state.format ? (
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
            FORMAT STAKES
          </Text>
          <StakeInputRow gameKey={state.format} />
        </View>
      ) : null}

      {/* Side game stakes — conditional on at least one selected. */}
      {state.sideGames.length > 0 ? (
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: c.gold, fontFamily: GEO }]}>
            SIDE GAME STAKES
          </Text>
          {state.sideGames.map((game) => (
            <StakeInputRow key={game} gameKey={game} />
          ))}
        </View>
      ) : null}

      {/* Skip link */}
      <Pressable
        onPress={handleSkip}
        style={({ pressed }) => [
          s.skipLink,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text
          style={[s.skipLinkText, { color: c.textMuted, fontFamily: GEO }]}
        >
          Skip stakes — handle offline
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// =============================================================
// StakeInputRow — wraps PerGameStakeInput with wizard state binding
// =============================================================

function StakeInputRow({ gameKey }: { gameKey: PerGameStakeKey }) {
  const { state, dispatch } = useWizard();

  // Pull from wizard state; falls back to defaults if the auto-seed
  // hasn't run yet (first paint after mount).
  const stake = state.perGameStakes[gameKey] ?? {
    amount: defaultAmountFor(gameKey),
    config: defaultConfigFor(gameKey),
  };

  return (
    <PerGameStakeInput
      gameKey={gameKey}
      amount={stake.amount}
      config={stake.config}
      onChange={(next) => {
        // Clamp negative to 0. PerGameStakeInput's number-pad input
        // doesn't allow minus signs, but defensive anyway.
        const safeAmount = Math.max(0, next.amount);
        dispatch({
          type: 'SET_PER_GAME_STAKE',
          key: gameKey,
          stake: { amount: safeAmount, config: next.config },
        });
      }}
    />
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
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },

  /* Skip link */
  skipLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  skipLinkText: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
