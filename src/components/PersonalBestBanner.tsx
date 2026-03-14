import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { GEO } from '../theme/fonts';

type PersonalBestBannerProps = {
  visible: boolean;
  courseName: string;
  previousBest?: number;
  onDone?: () => void;
};

export function PersonalBestBanner({ visible, courseName, previousBest, onDone }: PersonalBestBannerProps) {
  const slideY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        damping: 15,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: -80,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onDone?.());
    }, 3500);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { transform: [{ translateY: slideY }], opacity },
      ]}
    >
      <Text style={styles.emoji}>🏆</Text>
      <View style={styles.textWrap}>
        <Text style={styles.title}>NEW PERSONAL BEST</Text>
        <Text style={styles.course}>at {courseName}</Text>
        {previousBest != null && (
          <Text style={styles.previous}>Previous: {previousBest}</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#2A2318',
    borderWidth: 1,
    borderColor: '#D4AF37',
    padding: 16,
    zIndex: 9998,
  },
  emoji: {
    fontSize: 28,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: GEO,
  },
  course: {
    color: '#E8E4DE',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  previous: {
    color: '#6B6560',
    fontSize: 11,
    marginTop: 2,
  },
});
