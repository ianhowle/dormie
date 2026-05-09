import { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { haptics } from '../../lib/haptics';
import {
  SCORING_FORMATS,
  SIDE_GAMES,
  type ScoringFormat,
  type SideGame,
} from '../../data/scoring';

const HAIRLINE = 'rgba(255,255,255,0.06)';

// ─── Game-specific config schemas ────────────────────────────────────
// Each format / side game gets:
//   - label: shown above the dollar input ("$ X per player", "$ X per skin", etc.)
//   - defaultAmount: pre-filled dollar value when wizard renders the row
//   - configKind: which set of toggles/options to render below the dollar input.
//     'none' renders nothing extra. Other kinds drive the per-game UI below.
//
// All keys are typed against ScoringFormat | SideGame so adding a new
// game/format requires populating its config (or letting it fall through
// to the safe default). Single source of truth lives in this file.

type ConfigKind =
  | 'none'                    // dollar amount only, no extras
  | 'strokePlayPayout'        // winner-takes-all vs split top 3
  | 'skinsCarryOver'          // carry-over toggle
  | 'nassauTriple'            // front 9 / back 9 / total amounts (3 inputs)
  | 'stablefordPayoutKind';   // per-point vs per-place

export type PerGameStakeKey = ScoringFormat | SideGame;

interface GameStakeMeta {
  amountUnit: string;       // " per player" | " per skin" | etc.
  defaultAmount: number;
  configKind: ConfigKind;
}

const GAME_STAKE_META: Partial<Record<PerGameStakeKey, GameStakeMeta>> = {
  // Formats
  stroke_play:           { amountUnit: 'per player',     defaultAmount: 20, configKind: 'strokePlayPayout' },
  match_play:            { amountUnit: 'per match',      defaultAmount: 5,  configKind: 'none' },
  stableford:            { amountUnit: 'per point',      defaultAmount: 1,  configKind: 'stablefordPayoutKind' },
  modified_stableford:   { amountUnit: 'per point',      defaultAmount: 1,  configKind: 'stablefordPayoutKind' },
  best_ball:             { amountUnit: 'per team',       defaultAmount: 20, configKind: 'none' },
  scramble:              { amountUnit: 'per team',       defaultAmount: 20, configKind: 'none' },
  shamble:               { amountUnit: 'per team',       defaultAmount: 20, configKind: 'none' },
  fourball:              { amountUnit: 'per team',       defaultAmount: 20, configKind: 'none' },
  low_high:              { amountUnit: 'per team',       defaultAmount: 20, configKind: 'none' },
  sixsixsix:             { amountUnit: 'per block',      defaultAmount: 5,  configKind: 'none' },
  alternate_shot:        { amountUnit: 'per match',      defaultAmount: 10, configKind: 'none' },
  chapman:               { amountUnit: 'per match',      defaultAmount: 10, configKind: 'none' },
  greensomes:            { amountUnit: 'per match',      defaultAmount: 10, configKind: 'none' },
  pinehurst:             { amountUnit: 'per match',      defaultAmount: 10, configKind: 'none' },
  // Side games (key 'wolf' is shared between formats and side games — same meta works for both)
  wolf:                  { amountUnit: 'per point',      defaultAmount: 2,  configKind: 'none' },
  skins:                 { amountUnit: 'per skin',       defaultAmount: 1,  configKind: 'skinsCarryOver' },
  nassau:                { amountUnit: '',               defaultAmount: 10, configKind: 'nassauTriple' },
  dots:                  { amountUnit: 'per dot',        defaultAmount: 1,  configKind: 'none' },
  snake:                 { amountUnit: 'pot',            defaultAmount: 5,  configKind: 'none' },
  greenies:              { amountUnit: 'per greenie',    defaultAmount: 2,  configKind: 'none' },
  hammer:                { amountUnit: 'per hole',       defaultAmount: 5,  configKind: 'none' },
  bingo_bango_bongo:     { amountUnit: 'per achievement',defaultAmount: 1,  configKind: 'none' },
  sandies:               { amountUnit: 'per sandie',     defaultAmount: 2,  configKind: 'none' },
  bark:                  { amountUnit: 'per barkie',     defaultAmount: 2,  configKind: 'none' },
  arnies:                { amountUnit: 'per arnie',      defaultAmount: 2,  configKind: 'none' },
  close_shave:           { amountUnit: 'per KP',         defaultAmount: 5,  configKind: 'none' },
  three_putt_poker:      { amountUnit: 'pot',            defaultAmount: 10, configKind: 'none' },
  trash:                 { amountUnit: 'per piece',      defaultAmount: 1,  configKind: 'none' },
  hogans:                { amountUnit: 'per Hogan',      defaultAmount: 5,  configKind: 'none' },
  murphys:               { amountUnit: 'per call',       defaultAmount: 2,  configKind: 'none' },
  poleys:                { amountUnit: 'per poley',      defaultAmount: 2,  configKind: 'none' },
};

const FALLBACK_META: GameStakeMeta = {
  amountUnit: 'per round',
  defaultAmount: 5,
  configKind: 'none',
};

// ─── Config value shapes ─────────────────────────────────────────────
// Strongly-typed per kind. The component returns one of these in onChange
// alongside the dollar amount.

export type StrokePlayPayoutKind = 'winner_takes_all' | 'split_top_3';
export interface StrokePlayConfig { payout: StrokePlayPayoutKind }

export interface SkinsConfig { carryOver: boolean }

export interface NassauTripleConfig {
  /** Stake on the front 9 match. */
  front9: number;
  /** Stake on the back 9 match. */
  back9: number;
  /** Stake on the overall 18-hole match. */
  total: number;
}

export type StablefordPayoutKind = 'per_point' | 'per_place';
export interface StablefordConfig { payout: StablefordPayoutKind }

export type PerGameStakeConfig =
  | { kind: 'none' }
  | { kind: 'strokePlayPayout';      strokePlay: StrokePlayConfig }
  | { kind: 'skinsCarryOver';        skins: SkinsConfig }
  | { kind: 'nassauTriple';          nassau: NassauTripleConfig }
  | { kind: 'stablefordPayoutKind';  stableford: StablefordConfig };

// ─── Helpers ─────────────────────────────────────────────────────────

function getLabel(key: PerGameStakeKey): string {
  const fmt = SCORING_FORMATS.find((f) => f.key === key);
  if (fmt) return fmt.label;
  const sg = SIDE_GAMES.find((g) => g.key === key);
  if (sg) return sg.label;
  return String(key);
}

function getMeta(key: PerGameStakeKey): GameStakeMeta {
  return GAME_STAKE_META[key] ?? FALLBACK_META;
}

/** Sensible default config for a key. Caller can override before render. */
export function defaultConfigFor(key: PerGameStakeKey): PerGameStakeConfig {
  const meta = getMeta(key);
  switch (meta.configKind) {
    case 'strokePlayPayout':
      return { kind: 'strokePlayPayout', strokePlay: { payout: 'winner_takes_all' } };
    case 'skinsCarryOver':
      return { kind: 'skinsCarryOver', skins: { carryOver: true } };
    case 'nassauTriple':
      return {
        kind: 'nassauTriple',
        nassau: { front9: meta.defaultAmount, back9: meta.defaultAmount, total: meta.defaultAmount },
      };
    case 'stablefordPayoutKind':
      return { kind: 'stablefordPayoutKind', stableford: { payout: 'per_point' } };
    default:
      return { kind: 'none' };
  }
}

/** Sensible default amount for a key. */
export function defaultAmountFor(key: PerGameStakeKey): number {
  return getMeta(key).defaultAmount;
}

// ─── Component ───────────────────────────────────────────────────────

export interface PerGameStakeInputProps {
  gameKey: PerGameStakeKey;
  amount: number;
  config: PerGameStakeConfig;
  onChange: (next: { amount: number; config: PerGameStakeConfig }) => void;
}

/**
 * Per-game stake input with game-specific configuration. One row per
 * selected format / side game in the wizard's stakes step. Renders a
 * dollar amount (or three for Nassau) plus a kind-specific config control:
 *
 *   stroke_play / total_strokes  → payout structure pills (winner / split top 3)
 *   skins                        → carry-over toggle
 *   nassau                       → front 9 / back 9 / total dollar inputs
 *   stableford / mod_stableford  → per-point vs per-place pills
 *   everything else              → just the dollar amount
 *
 * The component is fully controlled — caller owns the amount + config
 * state. defaultAmountFor and defaultConfigFor exposed as helpers so the
 * caller can seed initial values per game.
 */
export function PerGameStakeInput({
  gameKey,
  amount,
  config,
  onChange,
}: PerGameStakeInputProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const meta = useMemo(() => getMeta(gameKey), [gameKey]);
  const label = useMemo(() => getLabel(gameKey), [gameKey]);

  const sanitizeAmount = (raw: string): number => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    if (cleaned === '') return 0;
    const n = parseInt(cleaned, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const updateAmount = (raw: string) => {
    const next = sanitizeAmount(raw);
    onChange({ amount: next, config });
  };

  const updateConfig = (next: PerGameStakeConfig) => {
    haptics.light();
    onChange({ amount, config: next });
  };

  // ─── Per-kind config UI ───────────────────────────────────────────
  const renderConfigUi = () => {
    switch (config.kind) {
      case 'strokePlayPayout': {
        const current = config.strokePlay.payout;
        const options: { id: StrokePlayPayoutKind; label: string }[] = [
          { id: 'winner_takes_all', label: 'Winner takes all' },
          { id: 'split_top_3', label: 'Split top 3' },
        ];
        return (
          <View style={s.pillRow}>
            {options.map((opt) => {
              const active = current === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() =>
                    updateConfig({ kind: 'strokePlayPayout', strokePlay: { payout: opt.id } })
                  }
                  style={({ pressed }) => [
                    s.pill,
                    {
                      backgroundColor: active ? '#006747' : '#221F1D',
                      borderColor: active ? '#006747' : HAIRLINE,
                      opacity: pressed ? 0.8 : 1,
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
        );
      }
      case 'stablefordPayoutKind': {
        const current = config.stableford.payout;
        const options: { id: StablefordPayoutKind; label: string }[] = [
          { id: 'per_point', label: 'Per point' },
          { id: 'per_place', label: 'Fixed per place' },
        ];
        return (
          <View style={s.pillRow}>
            {options.map((opt) => {
              const active = current === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() =>
                    updateConfig({
                      kind: 'stablefordPayoutKind',
                      stableford: { payout: opt.id },
                    })
                  }
                  style={({ pressed }) => [
                    s.pill,
                    {
                      backgroundColor: active ? '#006747' : '#221F1D',
                      borderColor: active ? '#006747' : HAIRLINE,
                      opacity: pressed ? 0.8 : 1,
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
        );
      }
      case 'skinsCarryOver': {
        const on = config.skins.carryOver;
        return (
          <Pressable
            onPress={() =>
              updateConfig({ kind: 'skinsCarryOver', skins: { carryOver: !on } })
            }
            style={({ pressed }) => [s.toggleRow, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View
              style={[
                s.toggleBox,
                {
                  backgroundColor: on ? '#006747' : 'transparent',
                  borderColor: on ? '#006747' : c.textMuted,
                },
              ]}
            >
              {on && (
                <View style={s.toggleCheck} />
              )}
            </View>
            <Text style={[s.toggleLabel, { color: c.text }]}>Carry-over on tied holes</Text>
          </Pressable>
        );
      }
      case 'nassauTriple': {
        const cfg = config.nassau;
        const updateField = (field: keyof NassauTripleConfig, raw: string) => {
          const next = sanitizeAmount(raw);
          updateConfig({
            kind: 'nassauTriple',
            nassau: { ...cfg, [field]: next },
          });
        };
        return (
          <View style={s.nassauCol}>
            {(['front9', 'back9', 'total'] as const).map((field) => {
              const fieldLabel =
                field === 'front9' ? 'Front 9'
                : field === 'back9' ? 'Back 9'
                : 'Total';
              return (
                <View key={field} style={s.nassauRow}>
                  <Text style={[s.nassauLabel, { color: c.textMuted }]}>{fieldLabel}</Text>
                  <View
                    style={[
                      s.amountInputWrap,
                      { backgroundColor: '#221F1D', borderColor: HAIRLINE },
                    ]}
                  >
                    <Text style={[s.dollarSign, { color: c.textMuted, fontFamily: GEO }]}>
                      $
                    </Text>
                    <TextInput
                      value={String(cfg[field] ?? 0)}
                      onChangeText={(text) => updateField(field, text)}
                      keyboardType="number-pad"
                      style={[
                        s.amountInput,
                        { color: (cfg[field] ?? 0) > 0 ? c.gold : c.textMuted, fontFamily: GEO },
                      ]}
                      maxLength={6}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        );
      }
      default:
        return null;
    }
  };

  // ─── Layout ────────────────────────────────────────────────────────
  // Nassau renders three dollar inputs instead of one, so the top dollar
  // row is suppressed for that kind. All other kinds get the standard
  // dollar row + their config UI below.
  const isNassau = config.kind === 'nassauTriple';

  return (
    <View style={[s.card, { backgroundColor: '#1A1816', borderColor: HAIRLINE }]}>
      <Text style={[s.title, { color: c.text, fontFamily: GEO }]}>{label}</Text>

      {!isNassau && (
        <View style={s.amountRow}>
          <View
            style={[
              s.amountInputWrap,
              { backgroundColor: '#221F1D', borderColor: HAIRLINE },
            ]}
          >
            <Text style={[s.dollarSign, { color: c.textMuted, fontFamily: GEO }]}>$</Text>
            <TextInput
              value={String(amount)}
              onChangeText={updateAmount}
              keyboardType="number-pad"
              style={[
                s.amountInput,
                { color: amount > 0 ? c.gold : c.textMuted, fontFamily: GEO },
              ]}
              maxLength={6}
            />
          </View>
          {meta.amountUnit ? (
            <Text style={[s.amountUnit, { color: c.textMuted }]}>{meta.amountUnit}</Text>
          ) : null}
        </View>
      )}

      {renderConfigUi()}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    /* Spacing is parent-decided — Step6Stakes uses a gap: 8 wrapper
       around the side game list so cards read as one ledger. The
       sole format card sits inside a section with its own bottom
       margin, so no internal margin is needed here. */
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  /* Amount input */
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    minWidth: 96,
  },
  dollarSign: {
    fontSize: 16,
    fontWeight: '700',
  },
  amountInput: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 48,
    paddingVertical: 0,
  },
  amountUnit: {
    fontSize: 13,
  },

  /* Pill row (stroke play payout, stableford payout) */
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* Toggle (skins carry-over) */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    /* paddingLeft matches amountInputWrap's paddingHorizontal so the
       checkbox left-edge aligns with the dollar sign — the visual
       "input column" the eye tracks, not the input field's border. */
    paddingLeft: 12,
  },
  toggleBox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleCheck: {
    width: 8,
    height: 8,
    backgroundColor: '#C9A227',
  },
  toggleLabel: {
    fontSize: 13,
  },

  /* Nassau triple */
  nassauCol: {
    marginTop: 12,
    gap: 8,
  },
  nassauRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nassauLabel: {
    width: 64,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
