import { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { haptics } from '../../../lib/haptics';
import TL from './tokens';

// ─── Tokens (locked — see tokens.jsx) ─────────────────────────────────
// Pulled out for ergonomic access. Values mirror tokens.jsx exactly.
const LETTERBOX_BAR_H = TL.letterboxBarH;
const CORNER_INSET = TL.cornerInset;
const CORNER_SIZE = TL.cornerSize;
const CORNER_STROKE = TL.cornerStroke;

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
}

/**
 * Trip Launched cinematic moment — Phase 1.9a (Beat 1 — Arrival only).
 *
 * Renders the stage shell: black letterbox bars sliding in, Masters
 * green gradient fading up, gold corner brackets drawing inward, a
 * one-shot 3% white pinstripe pulse, and the "DORMIE · TRIP LAUNCHED"
 * kicker rising from below. haptics.heavy() fires at t=0.
 *
 * Subsequent phases add Beat 2 (destination + date), Beat 3 (avatar
 * roll call), Beat 4 (CTA + live amber dot), Ryder Cup states, and
 * adaptive time / multi-destination / fire-floor logic.
 *
 * Reference: docs/trip-launched-design-spec-2026-05-05.md (locked).
 * Tokens contract: src/components/wizard/trip-launched/tokens.jsx.
 */
export function DormieMomentTripLaunched({
  visible,
  onViewTrip,
}: DormieMomentTripLaunchedProps) {
  // ─── Animated values (initialized to "hidden" state) ────────────
  const letterboxProgress = useRef(new Animated.Value(0)).current;
  const gradientOpacity = useRef(new Animated.Value(0)).current;
  const cornerProgress = useRef(new Animated.Value(0)).current;
  const pinstripeOpacity = useRef(new Animated.Value(0)).current;
  const kickerOpacity = useRef(new Animated.Value(0)).current;
  const kickerTranslateY = useRef(new Animated.Value(8)).current;

  const runEntrance = useCallback(() => {
    // Defensive reset (in case the modal re-shows after a previous run).
    letterboxProgress.setValue(0);
    gradientOpacity.setValue(0);
    cornerProgress.setValue(0);
    pinstripeOpacity.setValue(0);
    kickerOpacity.setValue(0);
    kickerTranslateY.setValue(8);

    // Beat 1 haptic — single tactile commit at t=0.
    haptics.heavy();

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
    ]).start();
  }, [
    letterboxProgress,
    gradientOpacity,
    cornerProgress,
    pinstripeOpacity,
    kickerOpacity,
    kickerTranslateY,
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

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onShow={runEntrance}
      onRequestClose={onViewTrip}
      statusBarTranslucent
    >
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
});

export default DormieMomentTripLaunched;
