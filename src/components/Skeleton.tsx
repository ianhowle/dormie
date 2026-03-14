import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type SkeletonProps = {
  width: number | string;
  height: number;
  style?: ViewStyle;
};

export function Skeleton({ width, height, style }: SkeletonProps) {
  const { theme } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  const baseColor = theme.isDark ? '#262320' : '#E5E2DE';
  const shimmerColor = theme.isDark ? '#333028' : '#F0EDE8';

  return (
    <View style={[{ width: width as any, height, backgroundColor: baseColor, overflow: 'hidden' }, style]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: shimmerColor,
            opacity: 0.6,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

// Pre-built skeleton patterns
export function SkeletonRow({ style }: { style?: ViewStyle }) {
  return (
    <View style={[skel.row, style]}>
      <Skeleton width={32} height={32} style={{ borderRadius: 16 }} />
      <View style={skel.rowContent}>
        <Skeleton width="70%" height={12} />
        <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={40} height={18} />
    </View>
  );
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[skel.card, style]}>
      <Skeleton width="100%" height={80} />
      <View style={skel.cardBody}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={10} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

export function SkeletonLeaderboard() {
  return (
    <View style={skel.leaderboard}>
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonRow key={i} style={{ marginBottom: 4 }} />
      ))}
    </View>
  );
}

export function SkeletonFeed() {
  return (
    <View style={skel.feed}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={skel.feedItem}>
          <View style={skel.feedHeader}>
            <Skeleton width={36} height={36} style={{ borderRadius: 18 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Skeleton width="50%" height={12} />
              <Skeleton width="30%" height={10} style={{ marginTop: 4 }} />
            </View>
          </View>
          <Skeleton width="100%" height={10} style={{ marginTop: 10 }} />
          <Skeleton width="80%" height={10} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonStats() {
  return (
    <View style={skel.statsGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={skel.statItem}>
          <Skeleton width={48} height={28} />
          <Skeleton width={60} height={10} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

const skel = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  rowContent: {
    flex: 1,
  },
  card: {
    overflow: 'hidden',
    marginBottom: 10,
  },
  cardBody: {
    padding: 14,
  },
  leaderboard: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  feed: {
    paddingHorizontal: 20,
  },
  feedItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  statItem: {
    alignItems: 'center',
    width: '25%',
    paddingVertical: 8,
  },
});
