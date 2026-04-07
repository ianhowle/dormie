import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { cardShadowDark, cardShadowLight } from '../../src/theme/colors';
import { haptics } from '../../src/lib/haptics';

/** Small red dot badge */
function BadgeDot() {
  return <View style={badgeStyles.dot} />;
}

const badgeStyles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C41E3A',
  },
});

/** Elevated center Score button — Masters green circle with white flag */
function ScoreTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={scoreStyles.wrapper}>
      <View
        style={[
          scoreStyles.circle,
          focused && scoreStyles.circleFocused,
        ]}
      >
        <Ionicons name="flag" size={28} color="#FFFFFF" />
      </View>
    </View>
  );
}

const scoreStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 16 : 12,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E4D2B',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(30,77,43,0.4)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  circleFocused: {
    backgroundColor: '#256B3A',
  },
});

export default function TabLayout() {
  const { theme } = useTheme();
  const c = theme.colors;

  // Badge state — in a real app these would come from services/context
  const [homeBadge, setHomeBadge] = useState(false);
  const [tripsBadge, setTripsBadge] = useState(0);
  const [leaderboardBadge, setLeaderboardBadge] = useState(false);

  // Simulate badges for demo (would be driven by real data)
  useEffect(() => {
    const timer = setTimeout(() => {
      setHomeBadge(true);
      setTripsBadge(3);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.teal,
        tabBarInactiveTintColor: theme.isDark ? c.textMuted : '#9C9894',
        tabBarStyle: {
          backgroundColor: theme.isDark ? '#1E1B18' : '#FFFFFF',
          borderTopColor: theme.isDark ? c.border : 'rgba(0,0,0,0.08)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          ...(theme.isDark ? cardShadowDark : cardShadowLight),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
      }}
      screenListeners={{
        tabPress: () => {
          haptics.light();
        },
      }}
    >
      {/* ── Tab 1: Home ─────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
              {homeBadge && <BadgeDot />}
            </View>
          ),
        }}
        listeners={{
          tabPress: () => setHomeBadge(false),
        }}
      />

      {/* ── Tab 2: Seasons ──────────────────────────── */}
      <Tabs.Screen
        name="seasons"
        options={{
          title: 'Seasons',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* ── Tab 3: Score (center, elevated Masters green circle) ── */}
      <Tabs.Screen
        name="score"
        options={{
          title: '',
          tabBarIcon: ({ focused }) => <ScoreTabIcon focused={focused} />,
          tabBarLabel: () => null,
        }}
      />

      {/* ── Tab 4: Trips ────────────────────────────── */}
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarBadge: tripsBadge > 0 ? tripsBadge : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#C41E3A',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
            borderRadius: 9,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'airplane' : 'airplane-outline'} size={22} color={color} />
          ),
        }}
        listeners={{
          tabPress: () => setTripsBadge(0),
        }}
      />

      {/* ── Tab 5: Leaderboard ──────────────────────── */}
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Board',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? 'podium' : 'podium-outline'} size={22} color={color} />
              {leaderboardBadge && <BadgeDot />}
            </View>
          ),
        }}
        listeners={{
          tabPress: () => setLeaderboardBadge(false),
        }}
      />

      {/* ── Hidden: Profile (accessible via avatar in header) ── */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
