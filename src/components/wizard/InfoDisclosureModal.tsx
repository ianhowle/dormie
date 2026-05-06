import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { haptics } from '../../lib/haptics';
import type { Complexity } from '../../data/scoring';

// ─── Complexity badge palette ─────────────────────────────────────────
// Per spec: Beginner = Augusta green, Casual = muted, Expert = gold.
const COMPLEXITY_COLOR: Record<Complexity, string> = {
  Beginner: '#006747',
  Casual: '#8A857F',
  Expert: '#C9A227',
};

const HAIRLINE = 'rgba(255,255,255,0.06)';

export interface InfoDisclosureModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  complexity: Complexity;
  description: string;
  fullDescription: string;
  example: string;
  whenToUse: string;
}

/**
 * Reusable disclosure modal for the trip-creation wizard. Opens off the
 * (i) icons next to formats and side games. Same component for both —
 * FormatInfo and SideGameInfo share an identical disclosure shape post
 * Phase 1.2 of the wizard redesign.
 *
 * Visual treatment per docs/dormie-design-dna.md: sharp edges, dark
 * elevated surface, Georgia serif title, hairline dividers between
 * sections, small-caps gold section headers.
 */
export function InfoDisclosureModal({
  visible,
  onClose,
  title,
  complexity,
  description,
  fullDescription,
  example,
  whenToUse,
}: InfoDisclosureModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const enteredRef = useRef(false);

  useEffect(() => {
    if (visible) {
      if (!enteredRef.current) {
        haptics.light();
        enteredRef.current = true;
      }
      scale.setValue(0.96);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      enteredRef.current = false;
    }
  }, [visible, scale, opacity]);

  const handleClose = () => {
    haptics.light();
    onClose();
  };

  const complexityColor = COMPLEXITY_COLOR[complexity];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Animated.View style={[s.overlay, { opacity }]}>
        <Pressable style={s.backdrop} onPress={handleClose} />
        <Animated.View
          style={[
            s.card,
            {
              backgroundColor: '#1A1816',
              transform: [{ scale }],
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={[s.title, { color: c.text, fontFamily: GEO }]}>{title}</Text>

            {/* Complexity badge */}
            <View
              style={[
                s.badge,
                {
                  backgroundColor: `${complexityColor}15`,
                  borderColor: complexityColor,
                },
              ]}
            >
              <Text style={[s.badgeText, { color: complexityColor, fontFamily: GEO }]}>
                {complexity.toUpperCase()}
              </Text>
            </View>

            {/* One-line description */}
            <Text style={[s.description, { color: c.textMuted }]}>{description}</Text>

            {/* Section: How it works */}
            <View style={[s.divider, { backgroundColor: HAIRLINE }]} />
            <Text style={[s.sectionHeader, { color: c.gold, fontFamily: GEO }]}>HOW IT WORKS</Text>
            <Text style={[s.body, { color: c.text }]}>{fullDescription}</Text>

            {/* Section: Example */}
            <View style={[s.divider, { backgroundColor: HAIRLINE }]} />
            <Text style={[s.sectionHeader, { color: c.gold, fontFamily: GEO }]}>EXAMPLE</Text>
            <Text style={[s.example, { color: c.text }]}>{example}</Text>

            {/* Section: When to use */}
            <View style={[s.divider, { backgroundColor: HAIRLINE }]} />
            <Text style={[s.sectionHeader, { color: c.gold, fontFamily: GEO }]}>WHEN TO USE</Text>
            <Text style={[s.body, { color: c.text }]}>{whenToUse}</Text>
          </ScrollView>

          {/* Close button (sticky bottom of card) */}
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              s.closeBtn,
              { backgroundColor: '#006747', opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[s.closeBtnText, { color: '#C9A227', fontFamily: GEO }]}>Close</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 16,
  },

  /* Title block */
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    marginTop: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  description: {
    fontSize: 13,
    marginTop: 12,
    lineHeight: 18,
  },

  /* Section primitives */
  divider: {
    height: 1,
    marginTop: 20,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  example: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(201,162,39,0.4)',
  },

  /* Close button */
  closeBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
