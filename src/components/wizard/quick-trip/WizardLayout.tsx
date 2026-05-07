// =============================================================
// WizardLayout — chrome around the Quick Trip wizard
// =============================================================
// Top: close (X) + step counter + step name
// Body: animated step container (children = current step component)
// Bottom: [Back] / [Next] navigation bar
//
// Step transitions: opacity fade + small horizontal slide. Direction-
// aware — going forward slides in from the right (translateX 16→0),
// going back slides in from the left (translateX -16→0). Polish in 2.9
// if needed.
//
// Back behavior:
//   - Footer Back button + Android hardware back: dispatch PREV_STEP
//     when step > 0; close the wizard route at step 0.
//   - iOS swipe-back is disabled at the route level (gestureEnabled:
//     false in app/_layout.tsx) so users can't accidentally lose
//     wizard progress mid-flow. Explicit Back is the dismiss path.
// =============================================================

import { useEffect, useRef, type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useTheme } from '../../../theme/ThemeContext';
import { GEO } from '../../../theme/fonts';
import { haptics } from '../../../lib/haptics';
import { useWizard, TOTAL_WIZARD_STEPS } from './WizardContext';

const STEP_NAMES: Record<number, string> = {
  0: 'Choose your trip',
  1: 'Where',
  2: 'When',
  3: 'Who',
  4: 'How',
  5: 'Side games',
  6: 'Stakes',
  7: 'Confirm',
};

const HAIRLINE = 'rgba(255,255,255,0.06)';

interface WizardLayoutProps {
  children: ReactNode;
}

export function WizardLayout({ children }: WizardLayoutProps) {
  const { state, dispatch, canAdvance } = useWizard();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const c = theme.colors;

  // ─── Step transition animation ────────────────────────────────────
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(16)).current;
  const prevStepRef = useRef(state.step);

  useEffect(() => {
    const goingForward = state.step >= prevStepRef.current;
    opacity.setValue(0);
    translateX.setValue(goingForward ? 16 : -16);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
    prevStepRef.current = state.step;
  }, [state.step, opacity, translateX]);

  // ─── Android hardware back ────────────────────────────────────────
  // Step > 0: pop one step. Step 0: let system close the route.
  useEffect(() => {
    const onBack = (): boolean => {
      if (state.step > 0) {
        haptics.light();
        dispatch({ type: 'PREV_STEP' });
        return true; // handled; suppress default
      }
      return false; // let system pop the route
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [state.step, dispatch]);

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleClose = () => {
    haptics.light();
    router.back();
  };

  const handleBack = () => {
    if (state.step === 0) {
      handleClose();
      return;
    }
    haptics.light();
    dispatch({ type: 'PREV_STEP' });
  };

  const handleNext = () => {
    if (!canAdvance) return;
    if (state.step >= TOTAL_WIZARD_STEPS - 1) {
      // Step 7 placeholder — close the wizard. Real launch path
      // (Save-as-draft + Create-and-invite + cinematic) lands in 2.8.
      handleClose();
      return;
    }
    haptics.light();
    dispatch({ type: 'NEXT_STEP' });
  };

  const isLastStep = state.step === TOTAL_WIZARD_STEPS - 1;
  // Step 0 is the persona fork (no "Step 0 of 7" label — its own header).
  const showStepCounter = state.step > 0;
  // Step 0 advances via the persona cards (each tap dispatches
  // SELECT_PERSONA + NEXT_STEP), so the footer Next button is redundant
  // there. Hide it; the Back button doubles as Close at step 0.
  const showNextButton = state.step > 0;

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <ExpoStatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleClose} hitSlop={12} style={s.headerSlot}>
          <Ionicons name="close" size={26} color={c.text} />
        </Pressable>
        <View style={s.headerCenter}>
          {showStepCounter ? (
            <Text style={[s.stepCounter, { color: c.gold, fontFamily: GEO }]}>
              {`STEP ${state.step} OF ${TOTAL_WIZARD_STEPS - 1}`}
            </Text>
          ) : null}
          <Text style={[s.stepName, { color: c.text, fontFamily: GEO }]}>
            {STEP_NAMES[state.step]}
          </Text>
        </View>
        <View style={s.headerSlot} />
      </View>

      {/* Step body */}
      <Animated.View
        style={[s.body, { opacity, transform: [{ translateX }] }]}
      >
        {children}
      </Animated.View>

      {/* Footer */}
      <View
        style={[
          s.footer,
          {
            paddingBottom: insets.bottom + 12,
            borderTopColor: HAIRLINE,
            backgroundColor: c.bg,
          },
        ]}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={8}
          style={({ pressed }) => [s.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={c.textMuted}
          />
          <Text style={[s.backBtnText, { color: c.textMuted, fontFamily: GEO }]}>
            {state.step === 0 ? 'CLOSE' : 'BACK'}
          </Text>
        </Pressable>

        {showNextButton ? (
          <Pressable
            onPress={handleNext}
            disabled={!canAdvance}
            style={({ pressed }) => [
              s.nextBtn,
              {
                backgroundColor: canAdvance ? '#006747' : c.elevated,
                borderWidth: canAdvance ? 0 : 1,
                borderColor: canAdvance ? 'transparent' : HAIRLINE,
                opacity: pressed ? 0.85 : 1,
              },
              !canAdvance && { opacity: 0.6 },
            ]}
          >
            <Text
              style={[
                s.nextBtnText,
                {
                  color: canAdvance ? '#C9A227' : c.textMuted,
                  fontFamily: GEO,
                },
              ]}
            >
              {isLastStep ? 'DONE' : 'NEXT'}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={canAdvance ? '#C9A227' : c.textMuted}
            />
          </Pressable>
        ) : (
          // Spacer keeps Back button left-aligned when Next is hidden.
          <View />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },

  /* Header */
  header: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  stepCounter: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  stepName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },

  /* Body */
  body: { flex: 1 },

  /* Footer */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginLeft: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  nextBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginRight: 4,
  },
});
