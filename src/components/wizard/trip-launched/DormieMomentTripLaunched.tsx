import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { haptics } from '../../../lib/haptics';
import TL from './tokens';

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

  const containerStyle = {
    position: 'absolute' as const,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    [isTop ? 'top' : 'bottom']: CORNER_INSET,
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
  /** Dev-only — when true, any tap dismisses the moment via onViewTrip.
   *  Useful for visually reviewing the cinematic in isolation before the
   *  real CTA tap target lands in Phase 1.9d. Has no effect outside of
   *  __DEV__. Production callers should NOT pass this. */
  __devTapToDismiss?: boolean;
}

/**
 * Trip Launched cinematic moment — Phase 1.9b (Beats 1+2).
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
 * Subsequent phases add Beat 3 (avatar roll call + sentence + you-
 * underline), Beat 4 (CTA + live amber dot), Ryder Cup states, and
 * adaptive time / multi-destination / fire-floor logic.
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

  // ─── Haptic timeout tracking ───────────────────────────────────────────
  // Beat 2's haptics.light() at t=1700 needs to fire on a setTimeout (no
  // synchronous "land" event we can hook). We track timeout IDs in a ref
  // so closing the modal early cancels in-flight haptics — avoids buzzing
  // the user after they've dismissed the moment.
  const hapticTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearScheduledHaptics = useCallback(() => {
    hapticTimeoutsRef.current.forEach(clearTimeout);
    hapticTimeoutsRef.current = [];
  }, []);
  const scheduleHaptic = useCallback((delay: number, fn: () => void) => {
    const id = setTimeout(fn, delay);
    hapticTimeoutsRef.current.push(id);
  }, []);

  // Cancel any in-flight haptics when the modal hides or the component
  // unmounts. Animations themselves are allowed to finish silently behind
  // the closed modal — they free up automatically on unmount.
  useEffect(() => {
    if (!visible) clearScheduledHaptics();
  }, [visible, clearScheduledHaptics]);
  useEffect(() => {
    return () => clearScheduledHaptics();
  }, [clearScheduledHaptics]);

  // ─── Layout shift (when destination wraps) ─────────────────────────────
  // Per spec: dateBlockTop / hairlineTop / avatarRailTop all push +36px
  // when hero wraps (≤44pt + ≥14ch heuristic). +14px additional when a
  // subtitle is rendered (multi-destination case — Phase 1.9f).
  const layoutShift = useMemo(
    () => (heroIsTwoLine(destination.length) ? TL.layoutShiftTwoLine : 0),
    [destination],
  );
  const dateBlockTop = TL.dateBlockTop + layoutShift;
  const hairlineTop = TL.hairlineTop + layoutShift;

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

    // Cancel any haptic timeouts left over from a prior aborted run.
    clearScheduledHaptics();

    // Beat 1 haptic — single tactile commit at t=0.
    haptics.heavy();

    // Beat 2 haptic — soft tick when destination lands at t=1700ms.
    scheduleHaptic(TL.haptics.destination.at, () => haptics.light());

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
    ]).start();
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
    scheduleHaptic,
    clearScheduledHaptics,
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

  const heroFontSize = getHeroFontSize(destination.length);
  const heroLineHeight = heroFontSize * TL.destinationLineH;
  const heroLines = heroIsTwoLine(destination.length) ? 2 : 1;

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

        {/* Destination — italic Georgia hero with adaptive type sizing */}
        <Animated.View
          style={[
            s.destinationWrap,
            {
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
            screen-blend highlight via transparent→gold→transparent. */}
        <Animated.View
          style={[
            s.glowSweep,
            { transform: [{ translateX: glowTranslate }] },
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

        {/* Dev tap-to-dismiss — full-screen invisible Pressable layered
            above all visuals. Only active when the harness opts in via
            __devTapToDismiss AND we're in __DEV__. Replaced by the real
            CTA tap target in Phase 1.9d. */}
        {__DEV__ && __devTapToDismiss ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onViewTrip}
            accessibilityLabel="Dismiss preview"
          />
        ) : null}
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
    top: LETTERBOX_BAR_H + 16, // 16px below the top letterbox edge
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
    top: TL.destinationBlockTop,
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
  },

  glowSweep: {
    position: 'absolute',
    left: 0,
    top:
      TL.destinationBlockTop +
      TL.destinationBlockHeight / 2 -
      GLOW_H / 2,
    width: GLOW_W,
    height: GLOW_H,
  },

  dateWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    // top is set inline (depends on layoutShift)
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
    // top is set inline (depends on layoutShift)
  },
  hairline: {
    height: TL.hairlineH,
    backgroundColor: TL.hairlineColor,
  },
});

export default DormieMomentTripLaunched;
