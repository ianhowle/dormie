import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PARTICLE_COUNT = 30;
const DURATION = 1500;

const GOLD_SHADES = ['#C9A227', '#C5A028', '#E6C64A', '#B8960F', '#F0D76C', '#A88B00'];

type ConfettiProps = {
  visible: boolean;
  onDone?: () => void;
};

type Particle = {
  x: number;
  size: number;
  color: string;
  delay: number;
  drift: number;
};

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * SCREEN_W,
    size: 4 + Math.random() * 6,
    color: GOLD_SHADES[Math.floor(Math.random() * GOLD_SHADES.length)],
    delay: Math.random() * 400,
    drift: (Math.random() - 0.5) * 60,
  }));
}

function ConfettiParticle({ particle }: { particle: Particle }) {
  const fall = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fall, {
          toValue: 1,
          duration: DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(spin, {
          toValue: 1,
          duration: DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: DURATION,
          delay: DURATION * 0.6,
          useNativeDriver: true,
        }),
      ]).start();
    }, particle.delay);

    return () => clearTimeout(timer);
  }, []);

  const translateY = fall.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, SCREEN_H * 0.7],
  });

  const translateX = fall.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, particle.drift, particle.drift * 1.5],
  });

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${360 + Math.random() * 360}deg`],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: particle.x,
        top: -10,
        width: particle.size,
        height: particle.size * 1.5,
        backgroundColor: particle.color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  );
}

export function Confetti({ visible, onDone }: ConfettiProps) {
  const particles = useRef(makeParticles()).current;

  useEffect(() => {
    if (visible && onDone) {
      const timer = setTimeout(onDone, DURATION + 500);
      return () => clearTimeout(timer);
    }
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <ConfettiParticle key={i} particle={p} />
      ))}
    </View>
  );
}
