import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';

export function LiveIndicator({
  live,
  label = live ? 'LIVE' : 'OFFLINE',
  size = 10,
}: {
  live: boolean;
  label?: string;
  size?: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!live) {
      pulse.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [live, pulse]);

  const dotColor = live ? c.urgent : c.textMuted;

  return (
    <View style={styles.row}>
      <Animated.View
        style={[
          styles.dot,
          { width: size, height: size, backgroundColor: dotColor, opacity: pulse },
        ]}
      />
      <Text style={[styles.label, { color: live ? c.text : c.textMuted, fontFamily: GEO }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { borderRadius: 0 },
  label: { fontSize: 10, letterSpacing: 2, fontWeight: '700' },
});
