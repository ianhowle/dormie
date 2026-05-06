import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { haptics } from '../../../lib/haptics';
import TL from './tokens';
import {
  buildSentence,
  computeRoster,
  orderPlayersForRail,
  type RosterConfig,
  type SentenceShape,
  type TripLaunchedPlayer,
} from './roster';
import { TripLaunchedAvatar } from './TripLaunchedAvatar';

// ─── Hero adaptive type sizing ────────────────────────────────────────
// Per spec (and tokens.jsx adaptive comments):
//   ≤ 9 chars   → 64pt single line
//   10–13       → 52pt single line
//   14–19       → 44pt up-to-2 lines
//   20+         → 36pt up-to-2 lines
function getHeroFontSize(charCount: number): number {
  if (charCount <= 9) return 64;
  if (charCount <= 13) return 52;
  if (charCount <= 19) return 44;
  return 36;
}
function heroIsTwoLine(charCount: number): boolean {
  return charCount >= 14;
}

// ─── Tokens (locked — see tokens.jsx) ─────────────────────────────────
// Pulled out for ergonomic access. Values mirror tokens.jsx exactly.
const LETTERBOX_BAR_H = TL.letterboxBarH;
const CORNER_INSET = TL.cornerInset;
const CORNER_SIZE = TL.cornerSize;
const CORNER_STROKE = TL.cornerStroke;

// Stage content width (viewport minus the two contentPadX gutters).
// Used to compute hairline max-width from TL.hairlineWidth (a fraction).
const STAGE_CONTENT_W = TL.viewportW - 2 * TL.contentPadX;

// Glow sweep dimensions — 80px wide highlight, ~60px tall (covers the
// vertical span of even the tallest hero line at 64pt).
const GLOW_W = 80;
const GLOW_H = 60;

// ─── Pinstripe overlay (3% white diagonal lines) ──────────────────────
// Reuses the pattern from app/auth/login.tsx and friends. Pulse animation
// drives a wrapper opacity 0→1→0, multiplied against the lines' intrinsic
// 0.03 opacity for the contracted 3% peak intensity.
function Pinstripes() {
  const lines = Array.from({ length: 40 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: -200,
            left: i * 18 - 100,
            width: 1,
            height: 1200,
            backgroundColor: '#FFFFFF',
            opacity: 0.03,
            transform: [{ rotate: '35deg' }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Corner bracket (one of four) ─────────────────────────────────────
// Two bars per corner: a horizontal stroke along the corner's top/bottom
// edge and a vertical stroke along the left/right edge. Both grow from
// the corner outward via scale + translate compensation, native-driven
// so the four-corner draw stays at 60fps even on older iPhones.
//
// Why scale + translate over width/height: scale runs on the native
// driver, width/height does not. With four corners × two bars × 500ms,
// driving widths on the JS thread risks jank on iPhone 12 era hardware.
// Anchoring the scale at the corner end requires translating by half the
// bar's collapsed length so the visible end stays pinned to the corner.
function CornerBracket({
  position,
  progress,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br';
  progress: Animated.Value;
}) {
  const isTop = position === 'tl' || position === 'tr';
  const isLeft = position === 'tl' || position === 'bl';

  // For a left-anchored horizontal bar, the default center-origin scale
  // collapses toward the bar's center. Translating by -half the size at
  // scale=0 shifts the collapsed point to the LEFT edge (the corner).
  // Right-anchored bars get +half. Same logic for vertical bars on Y.
  const horizontalTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [(isLeft ? -1 : 1) * (CORNER_SIZE / 2), 0],
  });
  const verticalTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [(isTop ? -1 : 1) * (CORNER_SIZE / 2), 0],
  });

  // Brackets frame the GREEN STAGE area, not the device viewport.
  // Vertical inset accounts for the letterbox bar height so the corner
  // sits just inside the stage edge (CORNER_INSET past the letterbox
  // boundary). Horizontal inset is from the screen edge directly since
  // there's no horizontal letterbox.
  const containerStyle = {
    position: 'absolute' as const,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    [isTop ? 'top' : 'bottom']: LETTERBOX_BAR_H + CORNER_INSET,
    [isLeft ? 'left' : 'right']: CORNER_INSET,
  };

  return (
    <View style={containerStyle} pointerEvents="none">
      {/* Horizontal bar — top/bottom edge of the corner frame */}
      <Animated.View
        style={{
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 0,
          [isLeft ? 'left' : 'right']: 0,
          width: CORNER_SIZE,
          height: CORNER_STROKE,
          backgroundColor: TL.brandGold,
          transform: [
            { translateX: horizontalTranslate },
            { scaleX: progress },
          ],
        }}
      />
      {/* Vertical bar — left/right edge of the corner frame */}
      <Animated.View
        style={{
          position: 'absolute',
          [isTop ? 'top' : 'bottom']: 0,
          [isLeft ? 'left' : 'right']: 0,
          width: CORNER_STROKE,
          height: CORNER_SIZE,
          backgroundColor: TL.brandGold,
          transform: [
            { translateY: verticalTranslate },
            { scaleY: progress },
          ],
        }}
      />
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────

export interface DormieMomentTripLaunchedProps {
  visible: boolean;
  /** Fired when the user taps the CTA at the end of Beat 4. Caller
   *  unmounts the moment and routes to /trip-detail. For 1.9a (Beat 1
   *  only), this is wired to the Android back button via onRequestClose
   *  so users can dismiss during testing. */
  onViewTrip: () => void;
  /** Hero — italic Georgia destination or trip name. Adaptive type
   *  sizing per char count (see getHeroFontSize). */
  destination: string;
  /** Primary date line, e.g. "OCT 15 – 17" or "8:42 AM" or "T-127 DAYS".
   *  Caller builds via the adaptive time helper (Phase 1.9f). */
  datePrimary: string;
  /** Optional secondary date line, e.g. "2026" or "TODAY". */
  dateSecondary?: string;
  /** Roster for Beat 3. Order is preserved for non-"you" players;
   *  internally the "you" player is anchored to row 1 leftmost. Solo
   *  trips (length 1 with isYou) skip the rail and play a single
   *  Medium haptic. Ryder Cup variants are NOT handled in 1.9c —
   *  those land in Phase 1.9e. */
  players: TripLaunchedPlayer[];
  /** Beat 4 stakes credit, e.g. "NASSAU · CLASSIC" or "RYDER CUP ·
   *  DRAFT PENDING". When omitted, falls back to "GAME TBD" per the
   *  spec's fire-floor language. */
  stakes?: string;
  /** Scoring format pass-through. Currently unused inside Beat 4 (the
   *  `stakes` prop drives display copy directly), but reserved for
   *  Ryder-Cup detection in Phase 1.9e. */
  format?: string;
  /** Dev-only — when true, any tap on the stage (outside the active
   *  CTA tap area) dismisses the moment via onViewTrip. Useful for
   *  reviewing the cinematic without waiting for the CTA to activate.
   *  Has no effect outside of __DEV__. Production callers should NOT
   *  pass this — the real CTA Pressable is the only dismiss path. */
  __devTapToDismiss?: boolean;
}

/**
 * Trip Launched cinematic moment — Phase 1.9d (Beats 1+2+3+4).
 *
 * Beat 1 — Arrival (0–1000ms): letterbox bars slide in, Masters green
 * gradient fades up, gold corner brackets draw inward, a one-shot 3%
 * white pinstripe pulse, and the "DORMIE · TRIP LAUNCHED" kicker rises
 * from below. haptics.heavy() fires at t=0.
 *
 * Beat 2 — Recognition (1000–2500ms): destination italic Georgia hero
 * rises (1000–1700ms), gold glow sweeps L→R across the destination
 * (1500–2300ms), date stack fades in (1900–2200ms), gold hairline draws
 * to 42% stage width (2100–2500ms). haptics.light() fires at t=1700ms.
 *
 * Beat 3 — Momentum (2500ms→variable): per-avatar roll call drops at
 * cadence (180ms standard / 110ms large), each tile 320ms cubicOut
 * (translateY 8→0 + opacity 0→1). Haptic ramp [light×2, medium×2,
 * heavy×2] fires AT each avatar's land time, capped at 6 hits. Sentence
 * type-ons 200ms after the last avatar (30ms/char, 800ms cap), then a
 * championshipGold underline draws under "you" (380ms cubicInOut, with
 * a selection haptic at start). Solo: rail dropped, single Medium
 * haptic at 2500ms, "Just you." sentence with you-underline.
 *
 * Beat 4 — Invitation (after Beat 3): stakes credit fades in (300ms
 * cubicOut), CTA arrow extends 14px (400ms cubicOut), live amber dot
 * begins a 1200ms pulse loop, and the CTA tap target activates with a
 * `ctaReady` haptic at +600ms. Beat 3's end time is computed
 * dynamically from roster + sentence so Beat 4 lands the same +offsets
 * regardless of how long the roll call ran. The CTA Pressable replaces
 * dev tap-anywhere as the production dismiss path; the dev override is
 * still available for testing.
 *
 * Subsequent phases add Ryder Cup states (1.9e) and adaptive time /
 * multi-destination / fire-floor logic (1.9f).
 *
 * Reference: docs/trip-launched-design-spec-2026-05-05.md (locked).
 * Tokens contract: src/components/wizard/trip-launched/tokens.jsx.
 */
export function DormieMomentTripLaunched({
  visible,
  onViewTrip,
  destination,
  datePrimary,
  dateSecondary,
  players,
  stakes,
  // format reserved for Phase 1.9e Ryder-Cup detection
  format: _format,
  __devTapToDismiss,
}: DormieMomentTripLaunchedProps) {
  // ─── Beat 1 animated values (initialized to "hidden" state) ────────────
  const letterboxProgress = useRef(new Animated.Value(0)).current;
  const gradientOpacity = useRef(new Animated.Value(0)).current;
  const cornerProgress = useRef(new Animated.Value(0)).current;
  const pinstripeOpacity = useRef(new Animated.Value(0)).current;
  const kickerOpacity = useRef(new Animated.Value(0)).current;
  const kickerTranslateY = useRef(new Animated.Value(8)).current;

  // ─── Beat 2 animated values ────────────────────────────────────────────
  const destinationProgress = useRef(new Animated.Value(0)).current; // 0=hidden, 1=visible (drives opacity + translateY)
  const glowSweepProgress = useRef(new Animated.Value(0)).current;   // 0=off-left, 1=off-right
  const dateOpacity = useRef(new Animated.Value(0)).current;
  const hairlineProgress = useRef(new Animated.Value(0)).current;     // 0=zero width, 1=42% stage width

  // ─── Beat 3 — roster, sentence, animated values ────────────────────────
  // Pure derivations: ordered players (you-first), layout config, and
  // the recap sentence + youAt index. Memoized on the players array so
  // variant switches in dev cycling rebuild cleanly.
  const orderedPlayers: TripLaunchedPlayer[] = useMemo(
    () => orderPlayersForRail(players),
    [players],
  );
  const roster: RosterConfig = useMemo(
    () => computeRoster(orderedPlayers),
    [orderedPlayers],
  );
  const sentence: SentenceShape = useMemo(
    () => buildSentence(orderedPlayers),
    [orderedPlayers],
  );

  // Per-avatar Animated.Values, indexed parallel to orderedPlayers. We
  // memo on the player COUNT (not identity) so a name swap at the same
  // size doesn't churn animation state, but a variant change rebuilds.
  const avatarProgresses = useMemo(
    () => orderedPlayers.map(() => new Animated.Value(0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderedPlayers.length],
  );

  // Sentence type-on (state, not animated value — drives sliced text
  // re-render). youUnderlineProgress is animated 0→1 over 380ms.
  const [revealedChars, setRevealedChars] = useState(0);
  // youLayout captures position + size of the "you" inline Text within
  // the sentence's outer Text. Using a nested Text + onLayout keeps the
  // sentence wrapping as one continuous flow (vs three sibling Texts,
  // which broke "you." onto an orphan line at narrow widths). x/y are
  // relative to the outer Text's origin, which we co-locate with the
  // sentence wrapper View's origin (no padding) so the underline can
  // be absolute-positioned in the wrapper using these coordinates.
  const [youLayout, setYouLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const youUnderlineProgress = useRef(new Animated.Value(0)).current;

  // ─── Beat 4 animated values ────────────────────────────────────────────
  const stakesOpacity = useRef(new Animated.Value(0)).current;
  // CTA arrow translates 0 → CTA_ARROW_EXTENSION (14px) cubicOut over
  // 400ms. Drives a translateX on the arrow glyph to "extend" the arrow
  // outward from the text.
  const ctaArrowTranslate = useRef(new Animated.Value(0)).current;
  // Live amber dot opacity loops 1.0 → 0.4 → 1.0 over 1200ms while the
  // moment is active. The Animation handle is kept in a ref so dismiss
  // can stop it cleanly (otherwise the loop continues silently behind
  // the closed modal until the component unmounts).
  const liveDotOpacity = useRef(new Animated.Value(1)).current;
  const liveDotLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  // CTA fades from disabled-look to active-look. We also gate the
  // Pressable's onPress on this state so taps before activation are no-ops.
  const ctaActiveOpacity = useRef(new Animated.Value(0.5)).current;
  const [ctaActive, setCtaActive] = useState(false);

  // ─── Timer tracking ────────────────────────────────────────────────────
  // Many Beat 3 events fire on setTimeout (haptics, sentence start,
  // underline start). We track all IDs so dismiss-during-animation cancels
  // in-flight scheduled work — no stranded buzz, no late renders.
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sentenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const clearAllTimers = useCallback(() => {
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    if (sentenceIntervalRef.current) {
      clearInterval(sentenceIntervalRef.current);
      sentenceIntervalRef.current = null;
    }
    if (liveDotLoopRef.current) {
      liveDotLoopRef.current.stop();
      liveDotLoopRef.current = null;
    }
  }, []);
  const scheduleTimer = useCallback((delay: number, fn: () => void) => {
    const id = setTimeout(fn, delay);
    pendingTimersRef.current.push(id);
  }, []);

  // Cancel in-flight timers + reset Beat 3 state when the modal hides
  // or the component unmounts. Animations themselves are allowed to
  // finish silently behind the closed modal.
  useEffect(() => {
    if (!visible) {
      clearAllTimers();
      setRevealedChars(0);
      setYouLayout(null);
      setCtaActive(false);
    }
  }, [visible, clearAllTimers]);
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // ─── Vertical layout flow ──────────────────────────────────────────────
  // Two deviations from the locked tokens, both driven by the Claude
  // Design v1 mockups (2026-05-05) over the token values:
  //
  // 1. destinationTop = 200, not the token's 100. At 100, the hero
  //    sits 12px below the kicker bottom — feels like a page header,
  //    not a movie title card. The mockups show ~80–100px breathing
  //    room above the destination so it lands in the upper third
  //    (200pt centers a 64pt single-line hero at ~28% from viewport
  //    top, inside the 25–30% target band).
  //
  // 2. dateBlockTop / hairlineTop / avatarRailTop flow off actual
  //    rendered hero size, not fixed token positions. The locked
  //    tokens (dateBlockTop:220 etc.) over-reserve for short heroes
  //    and leave a ~56px void between hero and date. Dynamic flow
  //    gives uniform tight grouping; the spec's layoutShiftTwoLine
  //    becomes implicit since a wrapping hero naturally pushes
  //    everything below it down by its full extra line.
  const DESTINATION_TOP = 200;
  const HERO_TO_DATE_GAP = 20; // tight grouping under the destination
  const HAIRLINE_TO_RAIL_GAP = 28; // matches token-implied 308−280 gap

  const heroFontSize = getHeroFontSize(destination.length);
  const heroLineHeight = heroFontSize * TL.destinationLineH;
  const heroLines = heroIsTwoLine(destination.length) ? 2 : 1;
  const heroActualH = heroLineHeight * heroLines;

  const dateStackH = dateSecondary
    ? TL.dateFontSize + TL.dateSubtitleMarginTop + TL.dateFontSize
    : TL.dateFontSize;

  const dateBlockTop = DESTINATION_TOP + heroActualH + HERO_TO_DATE_GAP;
  const hairlineTop = dateBlockTop + dateStackH + TL.hairlineMarginTop;
  const avatarRailTop = hairlineTop + HAIRLINE_TO_RAIL_GAP;

  // ─── Beat 3 type-on + underline helpers ──────────────────────────────
  // Sentence reveals one char at a time at tickMs intervals (or fewer if
  // the 800ms cap is hit on long sentences). When the last char lands, we
  // wait 200ms then fire the selection haptic and start the underline.
  const startSentenceTypeOn = useCallback(() => {
    const charCount = sentence.text.length;
    if (charCount === 0) return;
    const totalDuration = Math.min(charCount * 30, 800);
    const tickMs = totalDuration / charCount;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setRevealedChars(i);
      if (i >= charCount) {
        clearInterval(id);
        sentenceIntervalRef.current = null;
        // 200ms after the sentence lands, draw the gold underline under
        // "you" with a selection haptic at the start.
        if (sentence.youAt >= 0) {
          scheduleTimer(200, () => {
            haptics.selection();
            Animated.timing(youUnderlineProgress, {
              toValue: 1,
              duration: 380,
              easing: Easing.inOut(Easing.cubic),
              // Width is the animated dimension — JS thread is fine for
              // a single 380ms branch.
              useNativeDriver: false,
            }).start();
          });
        }
      }
    }, tickMs);
    sentenceIntervalRef.current = id;
  }, [sentence, scheduleTimer, youUnderlineProgress]);

  const runEntrance = useCallback(() => {
    // Defensive reset (in case the modal re-shows after a previous run).
    letterboxProgress.setValue(0);
    gradientOpacity.setValue(0);
    cornerProgress.setValue(0);
    pinstripeOpacity.setValue(0);
    kickerOpacity.setValue(0);
    kickerTranslateY.setValue(8);
    destinationProgress.setValue(0);
    glowSweepProgress.setValue(0);
    dateOpacity.setValue(0);
    hairlineProgress.setValue(0);
    avatarProgresses.forEach((p) => p.setValue(0));
    youUnderlineProgress.setValue(0);
    stakesOpacity.setValue(0);
    ctaArrowTranslate.setValue(0);
    ctaActiveOpacity.setValue(0.5);
    liveDotOpacity.setValue(1);
    setRevealedChars(0);
    setYouLayout(null);
    setCtaActive(false);

    // Cancel any timers left over from a prior aborted run.
    clearAllTimers();

    // Beat 1 haptic — single tactile commit at t=0.
    haptics.heavy();

    // Beat 2 haptic — soft tick when destination lands at t=1700ms.
    scheduleTimer(TL.haptics.destination.at, () => haptics.light());

    // Schedule each element on its token-defined window in parallel.
    // Animated.parallel runs all branches concurrently; each branch
    // uses Animated.sequence with a leading Animated.delay to shift its
    // start time. cubicOut → Easing.out(Easing.cubic),
    // cubicInOut → Easing.inOut(Easing.cubic).
    Animated.parallel([
      // Letterbox bars: 0–600ms cubicOut
      Animated.sequence([
        Animated.delay(TL.beats.arrival.letterboxIn.start),
        Animated.timing(letterboxProgress, {
          toValue: 1,
          duration:
            TL.beats.arrival.letterboxIn.end - TL.beats.arrival.letterboxIn.start,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Stage gradient: 100–700ms cubicOut
      Animated.sequence([
        Animated.delay(TL.beats.arrival.stageGradientFade.start),
        Animated.timing(gradientOpacity, {
          toValue: 1,
          duration:
            TL.beats.arrival.stageGradientFade.end -
            TL.beats.arrival.stageGradientFade.start,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Corner brackets: 400–900ms cubicInOut, all four simultaneously
      Animated.sequence([
        Animated.delay(TL.beats.arrival.cornersDrawIn.start),
        Animated.timing(cornerProgress, {
          toValue: 1,
          duration:
            TL.beats.arrival.cornersDrawIn.end -
            TL.beats.arrival.cornersDrawIn.start,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Pinstripe pulse: 650–900ms — opacity 0→1→0 over the 250ms window.
      // Spec lists a single cubicOut easing for the pulse; rendering it
      // as cubicOut on both halves produces a soft decelerating pulse on
      // the way up and a soft fade on the way down (natural one-shot
      // lighting feel).
      Animated.sequence([
        Animated.delay(TL.beats.arrival.pinstripePulse.start),
        Animated.timing(pinstripeOpacity, {
          toValue: 1,
          duration: 125,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pinstripeOpacity, {
          toValue: 0,
          duration: 125,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Kicker: 700–1000ms cubicOut, opacity + 8px translateY rise
      Animated.sequence([
        Animated.delay(TL.beats.arrival.kickerIn.start),
        Animated.parallel([
          Animated.timing(kickerOpacity, {
            toValue: 1,
            duration:
              TL.beats.arrival.kickerIn.end - TL.beats.arrival.kickerIn.start,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(kickerTranslateY, {
            toValue: 0,
            duration:
              TL.beats.arrival.kickerIn.end - TL.beats.arrival.kickerIn.start,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // ─── Beat 2 — Recognition (1000–2500ms) ──────────────────

      // Destination rise: 1000–1700ms cubicOut. Drives both opacity and
      // a 24px translateY together off the same Animated.Value (cheaper
      // than two parallel timings; identical visual outcome).
      Animated.sequence([
        Animated.delay(TL.beats.recognition.destinationRise.start),
        Animated.timing(destinationProgress, {
          toValue: 1,
          duration:
            TL.beats.recognition.destinationRise.end -
            TL.beats.recognition.destinationRise.start,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Gold glow sweep: 1500–2300ms cubicInOut. championshipGold
      // translates L→R across the destination block. Spec calls for
      // "screen blend" — RN doesn't expose blend modes, so we approximate
      // with a horizontal LinearGradient (transparent → gold → transparent)
      // at moderate opacity that briefly tints whatever it passes over.
      Animated.sequence([
        Animated.delay(TL.beats.recognition.destinationGlow.start),
        Animated.timing(glowSweepProgress, {
          toValue: 1,
          duration:
            TL.beats.recognition.destinationGlow.end -
            TL.beats.recognition.destinationGlow.start,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Date stack: 1900–2200ms cubicOut. Opacity only — spec
      // explicitly calls out "no translate" so the date block grounds
      // calmly underneath the rising hero.
      Animated.sequence([
        Animated.delay(TL.beats.recognition.dateIn.start),
        Animated.timing(dateOpacity, {
          toValue: 1,
          duration:
            TL.beats.recognition.dateIn.end -
            TL.beats.recognition.dateIn.start,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Gold hairline: 2100–2500ms cubicInOut, draws L→R to 42% stage
      // width. Width animation cannot run on the native driver; this is
      // a single short branch on the JS thread and is safe at 60fps.
      Animated.sequence([
        Animated.delay(TL.beats.recognition.hairlineDraw.start),
        Animated.timing(hairlineProgress, {
          toValue: 1,
          duration:
            TL.beats.recognition.hairlineDraw.end -
            TL.beats.recognition.hairlineDraw.start,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),

      // ─── Beat 3 — Momentum (2500ms→variable) ──────────────────
      //
      // Per-avatar drops at the variant cadence (180ms standard, 110ms
      // large). Solo skips the rail entirely — no avatar branches in
      // that case (avatarProgresses is empty), and the haptic + sentence
      // get scheduled outside the parallel below.
      ...avatarProgresses.map((progress, i) =>
        Animated.sequence([
          Animated.delay(
            TL.beats.momentum.avatarRollCall.firstAvatarStart +
              i * roster.cadence,
          ),
          Animated.timing(progress, {
            toValue: 1,
            duration: TL.beats.momentum.avatarRollCall.perAvatarDuration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();

    // ─── Beat 3 — haptic ramp + sentence + underline scheduling ─────
    // These fire on setTimeout (not Animated branches) because the
    // ramp is keyed to land-times rather than animation values, and
    // the sentence type-on is character-based, not value-based.
    const FIRST_LAND =
      TL.beats.momentum.avatarRollCall.firstAvatarStart +
      TL.beats.momentum.avatarRollCall.perAvatarDuration;
    const HAPTIC_RAMP = TL.haptics.rollCall.ramp;
    const HAPTIC_CAP = TL.haptics.rollCall.maxHits;

    // Compute when Beat 3 ends so Beat 4 can land at the correct +0/+200/
    // +400/+600 offsets regardless of roster size. The chain is:
    //   lastLand → +200 sentenceStart → +typedDuration → +200 underline
    //   start → +380 underline end. Sentences without "you" (rare; future
    //   undrafted Ryder Cup) skip the underline phase.
    const lastLandAt =
      roster.variant === 'solo'
        ? FIRST_LAND
        : TL.beats.momentum.avatarRollCall.firstAvatarStart +
          (avatarProgresses.length - 1) * roster.cadence +
          TL.beats.momentum.avatarRollCall.perAvatarDuration;
    const sentenceStartAt =
      lastLandAt + TL.beats.momentum.sentenceTypeOn.startsAfterLastAvatar;
    const sentenceDurMs =
      sentence.text.length > 0
        ? Math.min(
            sentence.text.length * TL.beats.momentum.sentenceTypeOn.msPerChar,
            TL.beats.momentum.sentenceTypeOn.maxDuration,
          )
        : 0;
    const sentenceEndAt = sentenceStartAt + sentenceDurMs;
    const underlineStartAt =
      sentence.youAt >= 0
        ? sentenceEndAt + TL.beats.momentum.sentenceTypeOn.youUnderlineDelay
        : sentenceEndAt;
    const beat3EndAt =
      sentence.youAt >= 0
        ? underlineStartAt + TL.beats.momentum.sentenceTypeOn.youUnderlineDuration
        : sentenceEndAt;

    if (roster.variant === 'solo') {
      // Solo override: single Medium haptic where the first avatar
      // would have landed (roughly 2820ms = 2500 + 320). The sentence
      // starts 200ms after that, matching the "200ms after last avatar
      // lands" rule applied to a phantom landing.
      scheduleTimer(FIRST_LAND, () => haptics.medium());
      scheduleTimer(sentenceStartAt, () => startSentenceTypeOn());
    } else {
      // Roll call: schedule one haptic per land time, capped at 6 hits.
      // Avatars beyond the cap (e.g., 9–12 player rosters) drop silently.
      avatarProgresses.forEach((_progress, i) => {
        if (i >= HAPTIC_CAP) return;
        const landAt =
          TL.beats.momentum.avatarRollCall.firstAvatarStart +
          i * roster.cadence +
          TL.beats.momentum.avatarRollCall.perAvatarDuration;
        const kind = HAPTIC_RAMP[i];
        scheduleTimer(landAt, () => {
          if (kind === 'impactLight') haptics.light();
          else if (kind === 'impactMedium') haptics.medium();
          else if (kind === 'impactHeavy') haptics.heavy();
        });
      });

      // Sentence: 200ms after the LAST avatar lands.
      scheduleTimer(sentenceStartAt, () => startSentenceTypeOn());
    }

    // ─── Beat 4 — Invitation (after Beat 3) ──────────────────────────
    // Stakes credit fade: beat3End → +300ms cubicOut, opacity only.
    Animated.sequence([
      Animated.delay(beat3EndAt),
      Animated.timing(stakesOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // CTA arrow extension: beat3End +200 → +600 cubicOut, translateX
    // 0 → 14. Drives the arrow glyph rightward to "extend" the call to
    // action.
    Animated.sequence([
      Animated.delay(beat3EndAt + 200),
      Animated.timing(ctaArrowTranslate, {
        toValue: TL.ctaArrowExtension,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // CTA enabled-fade: beat3End +200 → +600 cubicOut, opacity 0.5 → 1.
    Animated.sequence([
      Animated.delay(beat3EndAt + 200),
      Animated.timing(ctaActiveOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Live amber dot: starts pulsing at beat3End +400ms. 1200ms loop:
    // 1.0 → 0.4 → 1.0 across two 600ms timing branches (cubicInOut for
    // a smooth heartbeat). The composite handle is stored so dismiss
    // can stop it cleanly via clearAllTimers.
    scheduleTimer(beat3EndAt + 400, () => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(liveDotOpacity, {
            toValue: 0.4,
            duration: 600,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(liveDotOpacity, {
            toValue: 1.0,
            duration: 600,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      );
      liveDotLoopRef.current = loop;
      loop.start();
    });

    // CTA tap target activates at beat3End +600ms with a soft ctaReady
    // haptic. Before then, taps on the CTA Pressable are no-ops.
    scheduleTimer(beat3EndAt + 600, () => {
      haptics.light();
      setCtaActive(true);
    });
  }, [
    letterboxProgress,
    gradientOpacity,
    cornerProgress,
    pinstripeOpacity,
    kickerOpacity,
    kickerTranslateY,
    destinationProgress,
    glowSweepProgress,
    dateOpacity,
    hairlineProgress,
    avatarProgresses,
    youUnderlineProgress,
    stakesOpacity,
    ctaArrowTranslate,
    ctaActiveOpacity,
    liveDotOpacity,
    roster,
    sentence,
    scheduleTimer,
    clearAllTimers,
    startSentenceTypeOn,
  ]);

  if (!visible) return null;

  // Letterbox translation: top bar slides from -72 → 0, bottom from +72 → 0.
  const topBarTranslate = letterboxProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-LETTERBOX_BAR_H, 0],
  });
  const bottomBarTranslate = letterboxProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [LETTERBOX_BAR_H, 0],
  });

  // Beat 2 — destination 24→0 translateY (paired with opacity 0→1 off
  // the same Animated.Value).
  const destinationTranslate = destinationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  // Beat 2 — glow sweep crosses from off-stage-left to off-stage-right.
  // Glow box is GLOW_W wide; we anchor at left:0 and translate so the
  // box starts fully past the left edge and ends fully past the right.
  const glowTranslate = glowSweepProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-GLOW_W, TL.viewportW + GLOW_W],
  });

  // Beat 2 — hairline width grows from 0 to 42% of the stage CONTENT
  // width (viewport minus the two contentPadX gutters). Anchored at the
  // left content edge so the line draws rightward.
  const hairlineWidth = hairlineProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, STAGE_CONTENT_W * TL.hairlineWidth],
  });

  // ─── Beat 3 sentence position ───────────────────────────────────────
  // Sentence sits below the rail. avatarRailTop is computed up top in
  // the dynamic flow block. Solo skips the rail so its sentence anchors
  // at avatarRailTop directly (replacing the would-be rail block).
  const railHeight =
    roster.variant === 'solo'
      ? 0
      : roster.rowSplits.length === 1
        ? roster.avatarSize
        : roster.avatarSize * 2 + roster.gap;
  const sentenceTop =
    roster.variant === 'solo'
      ? avatarRailTop
      : avatarRailTop + railHeight + TL.sentenceMarginTop;

  // Beat 3 — sliced text for type-on. We render the sentence as ONE
  // continuous Text with a nested <Text> for "you" so wrapping flows
  // naturally (vs three sibling Texts which flex-wrapped "you." onto
  // an orphan line at narrow widths). During type-on, the prefix +
  // inner-you text + suffix are sliced according to revealedChars.
  const youAt = sentence.youAt;
  const prefixFull = youAt >= 0 ? sentence.text.slice(0, youAt) : sentence.text;
  const youFull = youAt >= 0 ? sentence.text.slice(youAt, youAt + 3) : '';
  const suffixFull = youAt >= 0 ? sentence.text.slice(youAt + 3) : '';
  const revealedPrefix = prefixFull.slice(
    0,
    Math.min(revealedChars, prefixFull.length),
  );
  const revealedYou =
    youAt >= 0
      ? youFull.slice(
          0,
          Math.max(0, Math.min(revealedChars - prefixFull.length, youFull.length)),
        )
      : '';
  const revealedSuffix =
    youAt >= 0
      ? suffixFull.slice(
          0,
          Math.max(0, revealedChars - prefixFull.length - youFull.length),
        )
      : '';

  // Beat 3 — underline width interpolates 0 → measured "you" word width.
  // Until the layout has measured (youLayout === null), keep at 0.
  const underlineWidth = youUnderlineProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, youLayout?.width ?? 0],
  });

  // onLayout on the nested "you" Text reports its position relative to
  // the outer Text. Since the outer Text is the only child of the
  // sentenceWrap View (no padding), those coordinates are also valid
  // within the wrapper — we use them to absolute-position the underline.
  const onYouLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout;
    if (next.width <= 0) return;
    if (
      youLayout &&
      youLayout.x === next.x &&
      youLayout.y === next.y &&
      youLayout.width === next.width &&
      youLayout.height === next.height
    ) return;
    setYouLayout({ x: next.x, y: next.y, width: next.width, height: next.height });
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onShow={runEntrance}
      onRequestClose={onViewTrip}
      // iOS: overFullScreen lets the modal extend edge-to-edge under the
      // system status bar so the top letterbox covers the full viewport.
      // Android: statusBarTranslucent does the equivalent.
      presentationStyle="overFullScreen"
      statusBarTranslucent
    >
      {/* Hide the iOS time/signal/battery indicators while the moment is
          on screen. expo-status-bar restores prior state when this
          component unmounts. */}
      <StatusBar hidden />
      <View style={s.container}>
        {/* Stage gradient (back-most layer) */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: gradientOpacity }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[TL.mastersGreen, TL.greenDeep, TL.stage, TL.bg]}
            locations={[0, 0.38, 0.78, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Pinstripe pulse (one-shot lighting) */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: pinstripeOpacity }]}
          pointerEvents="none"
        >
          <Pinstripes />
        </Animated.View>

        {/* ─── Beat 2 — Recognition ─────────────────────────────────── */}

        {/* Destination — italic Georgia hero with adaptive type sizing.
            top set inline to DESTINATION_TOP (overrides token; see
            vertical layout flow comment for rationale). */}
        <Animated.View
          style={[
            s.destinationWrap,
            {
              top: DESTINATION_TOP,
              opacity: destinationProgress,
              transform: [{ translateY: destinationTranslate }],
            },
          ]}
          pointerEvents="none"
        >
          <Text
            numberOfLines={heroLines}
            style={[
              s.destinationText,
              { fontSize: heroFontSize, lineHeight: heroLineHeight },
            ]}
          >
            {destination}
          </Text>
        </Animated.View>

        {/* Gold glow sweep — championshipGold horizontal gradient that
            crosses the destination block L→R. Approximates the spec's
            screen-blend highlight via transparent→gold→transparent.
            top anchored to DESTINATION_TOP (overrides the token-anchored
            stylesheet position so the glow follows the bumped hero). */}
        <Animated.View
          style={[
            s.glowSweep,
            {
              top:
                DESTINATION_TOP +
                TL.destinationBlockHeight / 2 -
                GLOW_H / 2,
              transform: [{ translateX: glowTranslate }],
            },
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['rgba(212,175,55,0)', TL.goldGlow, 'rgba(212,175,55,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Date stack — Georgia 22pt with optional muted secondary line.
            Wrapper spans full width with alignItems:center so each Text
            child centers on its intrinsic content width. */}
        <Animated.View
          style={[s.dateWrap, { top: dateBlockTop, opacity: dateOpacity }]}
          pointerEvents="none"
        >
          <Text style={s.datePrimary}>{datePrimary}</Text>
          {dateSecondary ? (
            <Text style={s.dateSecondary}>{dateSecondary}</Text>
          ) : null}
        </Animated.View>

        {/* Gold hairline — 1px line drawing L→R to 42% stage width.
            Wrapper centers it horizontally; the inner Animated.View grows
            from width 0 outward (alignItems keeps it centered as it
            expands rather than left-anchored). */}
        <View
          style={[s.hairlineWrap, { top: hairlineTop }]}
          pointerEvents="none"
        >
          <Animated.View style={[s.hairline, { width: hairlineWidth }]} />
        </View>

        {/* ─── Beat 3 — Momentum ─────────────────────────────────────── */}

        {/* Avatar rail — skipped for solo. Each row centers via flexbox;
            "you" anchors row 1 leftmost (orderPlayersForRail). Per-tile
            opacity + translateY drive off avatarProgresses[i]. */}
        {roster.variant !== 'solo' ? (
          <View
            style={[s.avatarRail, { top: avatarRailTop }]}
            pointerEvents="none"
          >
            {(() => {
              let cumIdx = 0;
              return roster.rowSplits.map((count, rowIdx) => {
                const rowStart = cumIdx;
                cumIdx += count;
                const rowPlayers = orderedPlayers.slice(rowStart, rowStart + count);
                return (
                  <View
                    key={rowIdx}
                    style={[
                      s.avatarRow,
                      { gap: roster.gap, marginTop: rowIdx > 0 ? roster.gap : 0 },
                    ]}
                  >
                    {rowPlayers.map((player, colIdx) => {
                      const absIdx = rowStart + colIdx;
                      const progress = avatarProgresses[absIdx];
                      return (
                        <Animated.View
                          key={`${player.name}-${absIdx}`}
                          style={{
                            opacity: progress,
                            transform: [
                              {
                                translateY: progress.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [8, 0],
                                }),
                              },
                            ],
                          }}
                        >
                          <TripLaunchedAvatar
                            name={player.name}
                            avatarUrl={player.avatarUrl}
                            size={roster.avatarSize}
                            isYou={player.isYou}
                          />
                        </Animated.View>
                      );
                    })}
                  </View>
                );
              });
            })()}
          </View>
        ) : null}

        {/* Sentence + you-underline. Single continuous Text (with a
            nested <Text> for "you") so wrapping flows as one paragraph
            — the prior three-sibling-Text layout caused "you." to
            orphan onto its own line at 7+ player widths. During type-on,
            each piece is sliced from revealedChars. The underline is an
            absolute-positioned overlay anchored to the nested Text's
            measured layout. */}
        {sentence.text.length > 0 ? (
          <View
            style={[s.sentenceWrap, { top: sentenceTop }]}
            pointerEvents="none"
          >
            <Text style={s.sentenceText}>
              {revealedPrefix}
              {youAt >= 0 ? (
                <Text style={s.sentenceText} onLayout={onYouLayout}>
                  {revealedYou}
                </Text>
              ) : null}
              {revealedSuffix}
            </Text>
            {youAt >= 0 && youLayout ? (
              <Animated.View
                style={{
                  position: 'absolute',
                  left: youLayout.x,
                  top: youLayout.y + youLayout.height - TL.youUnderlineInset,
                  height: TL.youUnderlineThickness,
                  width: underlineWidth,
                  backgroundColor: TL.youUnderlineColor,
                }}
              />
            ) : null}
          </View>
        ) : null}

        {/* Letterbox bars (above stage, define the broadcast frame) */}
        <Animated.View
          style={[
            s.letterboxTop,
            { transform: [{ translateY: topBarTranslate }] },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            s.letterboxBottom,
            { transform: [{ translateY: bottomBarTranslate }] },
          ]}
          pointerEvents="none"
        />

        {/* Gold corner brackets (above letterbox, frame the cinematic) */}
        <CornerBracket position="tl" progress={cornerProgress} />
        <CornerBracket position="tr" progress={cornerProgress} />
        <CornerBracket position="bl" progress={cornerProgress} />
        <CornerBracket position="br" progress={cornerProgress} />

        {/* Kicker — gold tracked-caps Georgia at the top of the stage */}
        <Animated.View
          style={[
            s.kickerWrap,
            {
              opacity: kickerOpacity,
              transform: [{ translateY: kickerTranslateY }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={s.kickerText}>DORMIE · TRIP LAUNCHED</Text>
        </Animated.View>

        {/* ─── Beat 4 — Invitation ──────────────────────────────────── */}

        {/* Stakes credit — tracked-caps SF Pro just above the CTA. Fades
            in (cubicOut) at beat3End. Falls back to "GAME TBD" per the
            spec's fire-floor language when no stakes string is provided. */}
        <Animated.View
          style={[s.stakesWrap, { opacity: stakesOpacity }]}
          pointerEvents="none"
        >
          <Text style={s.stakesText}>{stakes ?? 'GAME TBD'}</Text>
        </Animated.View>

        {/* Live amber dot — top-right, begins pulsing at beat3End +400ms.
            Renders inside the top letterbox area (per token positions);
            this is the broadcast "LIVE" tell. */}
        <Animated.View
          style={[s.liveDot, { opacity: liveDotOpacity }]}
          pointerEvents="none"
        />

        {/* Dev tap-to-dismiss — full-screen invisible Pressable layered
            above all visuals. Only active when the harness opts in via
            __devTapToDismiss AND we're in __DEV__. Rendered BEFORE the
            CTA so the CTA's bounds win for taps within them. */}
        {__DEV__ && __devTapToDismiss ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onViewTrip}
            accessibilityLabel="Dismiss preview"
          />
        ) : null}

        {/* CTA — production tap target. Activates at beat3End +600ms.
            Before activation, pointerEvents="none" lets taps pass
            through (to the dev layer below in __DEV__, or to the modal
            backdrop in production where they're absorbed silently).
            After activation, the Pressable receives taps directly. */}
        <Animated.View
          style={[s.ctaWrap, { opacity: ctaActiveOpacity }]}
          pointerEvents={ctaActive ? 'auto' : 'none'}
        >
          <Pressable
            onPress={onViewTrip}
            accessibilityLabel="View trip"
            accessibilityRole="button"
            style={s.ctaInner}
          >
            <Text style={s.ctaText}>TAP TO VIEW TRIP</Text>
            <Animated.Text
              style={[
                s.ctaArrow,
                { transform: [{ translateX: ctaArrowTranslate }] },
              ]}
            >
              {'  →'}
            </Animated.Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TL.bg,
  },

  letterboxTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: LETTERBOX_BAR_H,
    backgroundColor: TL.bg,
  },
  letterboxBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: LETTERBOX_BAR_H,
    backgroundColor: TL.bg,
  },

  kickerWrap: {
    position: 'absolute',
    // 48px below the green stage's top edge (= top letterbox bottom).
    // Gives the kicker visible breathing room above and a defined
    // "header zone" before the destination block begins at y=200.
    top: LETTERBOX_BAR_H + 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  kickerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4,
    color: TL.brandGold,
    // SF Pro Text on iOS is system default; explicit fontFamily omitted
    // so the system stack resolves it.
    textTransform: 'uppercase',
  },

  // ─── Beat 2 ──────────────────────────────────────────────────────────

  destinationWrap: {
    position: 'absolute',
    // top is set inline to DESTINATION_TOP (overrides token)
    left: TL.contentPadX,
    right: TL.contentPadX,
    height: TL.destinationBlockHeight,
  },
  destinationText: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontWeight: '400',
    color: TL.text,
    letterSpacing: TL.destinationTracking,
    textAlign: 'center',
    // Optical-center compensation for italic lean. Italic glyphs lean
    // right, so a mathematically-centered bounding box reads slightly
    // left of true visual center against centered chrome (kicker, date,
    // hairline). +6pt translateX nudges the rendered text rightward to
    // align optical center with the rest of the centered stack.
    transform: [{ translateX: 6 }],
  },

  glowSweep: {
    position: 'absolute',
    left: 0,
    // top is set inline (anchored to DESTINATION_TOP, not the token)
    width: GLOW_W,
    height: GLOW_H,
  },

  dateWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    // top is set inline (dynamic flow: hero bottom + HERO_TO_DATE_GAP)
  },
  datePrimary: {
    fontSize: TL.dateFontSize,
    // Tight line height matches the spec's absolute positioning math
    // (dateBlockTop:220 → hairlineTop:280 only fits if each line is
    // ~22px, not the default Georgia ~26px). Without this, the hairline
    // overlaps the secondary line.
    lineHeight: TL.dateFontSize,
    fontFamily: 'Georgia',
    fontWeight: '400',
    letterSpacing: TL.dateTracking,
    color: TL.text,
    textAlign: 'center',
  },
  dateSecondary: {
    fontSize: TL.dateFontSize,
    lineHeight: TL.dateFontSize,
    fontFamily: 'Georgia',
    fontWeight: '400',
    letterSpacing: TL.dateTracking,
    color: TL.text,
    marginTop: TL.dateSubtitleMarginTop,
    textAlign: 'center',
  },

  hairlineWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    // top is set inline (dynamic flow: dateBlockTop + dateStackH + hairlineMarginTop)
  },
  hairline: {
    height: TL.hairlineH,
    backgroundColor: TL.hairlineColor,
  },

  // ─── Beat 3 ──────────────────────────────────────────────────────────

  avatarRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    // top is set inline (dynamic flow: hairlineTop + HAIRLINE_TO_RAIL_GAP)
  },
  avatarRow: {
    flexDirection: 'row',
    // gap is set inline (depends on roster variant)
  },

  sentenceWrap: {
    position: 'absolute',
    left: TL.contentPadX,
    right: TL.contentPadX,
    // top is set inline (depends on roster variant + dynamic flow)
  },
  sentenceText: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: TL.sentenceFontSize,
    lineHeight: Math.round(TL.sentenceFontSize * 1.3),
    letterSpacing: TL.sentenceTracking,
    color: TL.text,
    textAlign: 'center',
  },

  // ─── Beat 4 ──────────────────────────────────────────────────────────

  stakesWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Sits above the CTA with the spec's stakesMarginTop (28) gap.
    // CTA bottom is LETTERBOX_BAR_H + 8, CTA glyph height ~14, so:
    //   stakesBottom = 80 (CTA bottom anchor) + 14 (CTA height) + 28
    bottom: LETTERBOX_BAR_H + 8 + 14 + TL.stakesMarginTop,
    alignItems: 'center',
  },
  stakesText: {
    fontSize: TL.stakesFontSize,
    fontWeight: '600',
    letterSpacing: TL.stakesTracking,
    color: TL.textMuted,
    textTransform: 'uppercase',
  },

  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Floats just above the bottom letterbox (8px gap) so the CTA reads
    // as part of the broadcast frame's lower chrome.
    bottom: LETTERBOX_BAR_H + 8,
    alignItems: 'center',
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  ctaText: {
    fontSize: TL.ctaFontSize,
    fontWeight: '700',
    letterSpacing: TL.ctaTracking,
    color: TL.brandGold,
    textTransform: 'uppercase',
  },
  ctaArrow: {
    fontSize: TL.ctaFontSize,
    fontWeight: '700',
    color: TL.brandGold,
  },

  liveDot: {
    position: 'absolute',
    top: TL.liveDotInsetT,
    right: TL.liveDotInsetR,
    width: TL.liveDotSize,
    height: TL.liveDotSize,
    backgroundColor: TL.liveAmber,
  },
});

export default DormieMomentTripLaunched;
