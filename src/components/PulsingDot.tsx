import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

type Props = {
  color?: string;
  size?: number;
};

export function PulsingDot({ color = '#C44B4F', size = 6 }: Props) {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [anim]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          backgroundColor: color,
          opacity: anim,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
