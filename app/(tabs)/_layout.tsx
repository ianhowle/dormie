import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { cardShadowDark, cardShadowLight } from '../../src/theme/colors';
import { haptics } from '../../src/lib/haptics';

/** Small red dot badge */
function BadgeDot() {
  return <View style={badgeStyles.dot} />;
}

/** Number badge */
function BadgeCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={badgeStyles.count}>
      <View style={badgeStyles.countInner}>
        <Ionicons name="ellipse" size={0} color="transparent" />
        <View style={badgeStyles.countBg}>
          <Ionicons name="ellipse" size={0} color="transparent" />
        </View>
      </View>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C44B4F',
  },
  count: {
    position: 'absolute',
    top: -4,
    right: -10,
  },
  countInner: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#C44B4F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBg: { display: 'none' },
});

export default function TabLayout() {
  const { theme } = useTheme();
  const c = theme.colors;

  // Badge state — in a real app these would come from services/context
  const [homeBadge, setHomeBadge] = useState(false);
  const [tripsBadge, setTripsBadge] = useState(0);
  const [profileBadge, setProfileBadge] = useState(false);

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
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: theme.isDark ? '#1E1B18' : '#FAF8F4',
          borderTopColor: c.border,
          borderTopWidth: 1,
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

      {/* ── Tab 3: Score (center, distinctive) ──────── */}
      <Tabs.Screen
        name="score"
        options={{
          title: 'Score',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'flag' : 'flag-outline'}
              size={28}
              color={focused ? '#1E4D2B' : c.textMuted}
            />
          ),
          tabBarActiveTintColor: '#1E4D2B',
        }}
      />

      {/* ── Tab 4: Trips ────────────────────────────── */}
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarBadge: tripsBadge > 0 ? tripsBadge : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#C44B4F',
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

      {/* ── Tab 5: Profile ──────────────────────────── */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
              {profileBadge && <BadgeDot />}
            </View>
          ),
        }}
        listeners={{
          tabPress: () => setProfileBadge(false),
        }}
      />

      {/* ── Hidden: Leaderboard (accessible via stack navigation) ── */}
      <Tabs.Screen
        name="leaderboard"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
