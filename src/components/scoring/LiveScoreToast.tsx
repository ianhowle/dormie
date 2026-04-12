import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';

export type LiveScoreToastPayload = {
  id: string;
  title: string;
  detail?: string;
  kind?: 'score' | 'birdie' | 'eagle' | 'ace' | 'lead';
};

export function LiveScoreToast({ payload }: { payload: LiveScoreToastPayload | null }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<LiveScoreToastPayload | null>(null);
  const slide = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!payload) return;
    setCurrent(payload);
    setVisible(true);

    slide.setValue(-80);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();

    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slide, { toValue: -80, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }, 3200);

    return () => {
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [payload?.id]);

  if (!visible || !current) return null;

  const accent =
    current.kind === 'ace' || current.kind === 'eagle' ? c.gold :
    current.kind === 'birdie' ? c.teal :
    current.kind === 'lead' ? c.urgent :
    c.gold;

  const icon: keyof typeof Ionicons.glyphMap =
    current.kind === 'ace' ? 'flash' :
    current.kind === 'eagle' ? 'trophy' :
    current.kind === 'birdie' ? 'golf' :
    current.kind === 'lead' ? 'trending-up' :
    'pulse';

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { transform: [{ translateY: slide }], opacity, backgroundColor: c.cardBg, borderColor: accent },
      ]}
    >
      <Ionicons name={icon} size={18} color={accent} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: c.text, fontFamily: GEO }]} numberOfLines={1}>
          {current.title}
        </Text>
        {current.detail && (
          <Text style={[styles.detail, { color: c.textMuted }]} numberOfLines={1}>
            {current.detail}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60, left: 16, right: 16, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderWidth: 1,
  },
  text: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700' },
  detail: { fontSize: 11, marginTop: 2 },
});
