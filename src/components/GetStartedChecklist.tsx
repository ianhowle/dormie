import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { GEO, SANS } from '../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../theme/colors';
import { haptics } from '../lib/haptics';
import GoldDivider from './GoldDivider';

type ChecklistItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  completed: boolean;
  onPress: () => void;
};

type Props = {
  hasHandicap: boolean;
  hasHomeCourse: boolean;
  hasFriend: boolean;
  hasRound: boolean;
  onDismiss?: () => void;
};

export function GetStartedChecklist({ hasHandicap, hasHomeCourse, hasFriend, hasRound, onDismiss }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const items: ChecklistItem[] = [
    {
      key: 'handicap',
      label: 'Set your handicap',
      icon: 'golf-outline',
      completed: hasHandicap,
      onPress: () => router.push({ pathname: '/edit-profile', params: { scrollTo: 'handicap' } }),
    },
    {
      key: 'course',
      label: 'Add your home course',
      icon: 'location-outline',
      completed: hasHomeCourse,
      onPress: () => router.push('/course-search'),
    },
    {
      key: 'friend',
      label: 'Add a friend',
      icon: 'person-add-outline',
      completed: hasFriend,
      onPress: () => router.push('/add-friends'),
    },
    {
      key: 'round',
      label: 'Log your first round',
      icon: 'flag-outline',
      completed: hasRound,
      onPress: () => router.push('/(tabs)/score'),
    },
  ];

  const completedCount = items.filter(i => i.completed).length;
  const allComplete = completedCount === 4;
  const progress = completedCount / 4;

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      damping: 20,
      stiffness: 150,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    if (allComplete) {
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -20,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => onDismiss?.());
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [allComplete]);

  // Entrance animation
  const entryAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: c.cardBg,
          borderColor: c.gold,
          borderWidth: 1,
          opacity: Animated.multiply(fadeAnim, entryAnim),
          transform: [
            { translateY: slideAnim },
            { translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
          ],
        },
        isDark ? cardShadowDark : cardShadowLight,
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.gold, fontFamily: GEO }]}>GET STARTED</Text>
          <Text style={[styles.progress, { color: c.textMuted, fontFamily: SANS }]}>
            {completedCount} of 4 complete
          </Text>
        </View>
        <Ionicons name="flag" size={20} color={c.gold} />
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: c.elevated }]}>
        <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: '#006747' }]} />
      </View>

      <GoldDivider style={{ marginVertical: 12 }} />

      {/* Checklist items */}
      {items.map((item, i) => (
        <Pressable
          key={item.key}
          onPress={() => {
            if (!item.completed) {
              haptics.light();
              item.onPress();
            }
          }}
          style={({ pressed }) => [
            styles.item,
            i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
            !item.completed && pressed && { opacity: 0.7 },
          ]}
        >
          <View style={[styles.checkbox, item.completed ? { backgroundColor: '#006747' } : { borderWidth: 1.5, borderColor: c.textMuted }]}>
            {item.completed && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
          </View>
          <Ionicons
            name={item.icon}
            size={16}
            color={item.completed ? c.textMuted : c.text}
            style={{ marginRight: 8 }}
          />
          <Text
            style={[
              styles.itemLabel,
              { color: item.completed ? c.textMuted : c.text, fontFamily: SANS },
              item.completed && { textDecorationLine: 'line-through' },
            ]}
          >
            {item.label}
          </Text>
          {!item.completed && (
            <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
          )}
        </Pressable>
      ))}

      {/* Footer message */}
      <Text style={[styles.footer, { color: c.textMuted, fontFamily: SANS }]}>
        Complete these to unlock your Dormie experience.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  progress: {
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  itemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    fontSize: 11,
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
