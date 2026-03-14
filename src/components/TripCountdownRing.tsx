import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type TripCountdownRingProps = {
  daysUntil: number;
  totalDays?: number;
  size?: number;
  strokeWidth?: number;
  accentColor?: string;
};

export function TripCountdownRing({
  daysUntil,
  totalDays = 30,
  size = 120,
  strokeWidth = 5,
  accentColor,
}: TripCountdownRingProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const color = accentColor ?? c.teal;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, 1 - daysUntil / totalDays));
  const targetDash = circumference * progress;

  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: targetDash,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [targetDash]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={c.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={animVal.interpolate({
            inputRange: [0, circumference],
            outputRange: [circumference, 0],
          })}
          strokeLinecap="butt"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.textWrap}>
        <Text style={[styles.days, { color: c.text, fontFamily: GEO }]}>
          {daysUntil}
        </Text>
        <Text style={[styles.label, { color: c.textMuted }]}>
          {daysUntil === 1 ? 'day' : 'days'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  textWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  days: { fontSize: 32, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: -2 },
});
