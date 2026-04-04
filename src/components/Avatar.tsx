import { useState } from 'react';
import { Text, StyleSheet, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../lib/auth';
import { GEO } from '../theme/fonts';

// Golf-themed gradient palette — deterministic pick based on id
const GRADIENTS: [string, string][] = [
  ['#046A38', '#034D28'],   // Augusta green (default for new/restored users)
  ['#1E3A5F', '#0F2440'],   // Pebble blue
  ['#B8860B', '#8B6508'],   // Championship gold
  ['#002366', '#001744'],   // Midnight navy
  ['#8B4513', '#5C2E0D'],   // Links brown
  ['#006747', '#1E4D2B'],   // Dormie teal
  ['#2D6A3F', '#1E4D2B'],   // Masters green
  ['#1E4D2B', '#0D2818'],   // Deep green
];

// Named color to gradient mapping (matches avatar-picker INITIALS_COLORS)
const NAMED_COLORS: Record<string, [string, string]> = {
  'Augusta Green': ['#046A38', '#034D28'],
  'Navy': ['#002366', '#001744'],
  'Burgundy': ['#6B1C2A', '#4A1420'],
  'Forest': ['#2D6A3F', '#1E4D2B'],
  'Charcoal': ['#3C3C3C', '#1A1A1A'],
  'Royal Blue': ['#2A5CAD', '#1A3D7A'],
  'Deep Purple': ['#4A2D73', '#2E1A4A'],
  'Copper': ['#A0522D', '#6B3720'],
};

// Course theme definitions (matches avatar-picker COURSE_THEMES)
type CourseThemeDef = {
  bgColors: [string, string];
  initialsColor: string;
  patternType: 'pinstripes' | 'waves' | 'gradient' | 'solid';
  patternColor?: string;
};

const COURSE_THEMES: Record<string, CourseThemeDef> = {
  'Augusta': {
    bgColors: ['#034D28', '#034D28'],
    initialsColor: '#C9A227',
    patternType: 'pinstripes',
    patternColor: 'rgba(255,255,255,0.08)',
  },
  'Pebble Beach': {
    bgColors: ['#1E6494', '#0D3B5C'],
    initialsColor: '#FFFFFF',
    patternType: 'gradient',
  },
  'St Andrews': {
    bgColors: ['#8B6F47', '#6B5335'],
    initialsColor: '#F5F0E8',
    patternType: 'solid',
  },
  'Sawgrass': {
    bgColors: ['#1A7A6A', '#0D5C4F'],
    initialsColor: '#FFFFFF',
    patternType: 'waves',
    patternColor: 'rgba(255,255,255,0.06)',
  },
  'Pinehurst': {
    bgColors: ['#C9A227', '#A0820F'],
    initialsColor: '#1E4D2B',
    patternType: 'solid',
  },
  'Bandon': {
    bgColors: ['#6B7B8D', '#4A5A6B'],
    initialsColor: '#FFFFFF',
    patternType: 'solid',
  },
};

function pickGradient(id: string | undefined | null): [string, string] {
  const safeId = id ?? 'user';
  let hash = 0;
  for (let i = 0; i < safeId.length; i++) {
    hash = ((hash << 5) - hash + safeId.charCodeAt(i)) | 0;
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function getInitials(id: string | undefined | null, name?: string | undefined | null): string {
  if (name) {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  if (!id) return '?';
  return id.slice(0, 2).toUpperCase();
}

// Pattern overlays for course themes
function AvatarPatternOverlay({ type, color, size }: { type: string; color?: string; size: number }) {
  if (type === 'pinstripes') {
    const count = Math.ceil(size / 6);
    const stripes = Array.from({ length: count });
    return (
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
        {stripes.map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: -size * 0.6,
              left: i * (size / count * 0.8) - size * 0.3,
              width: 1.5,
              height: size * 2,
              backgroundColor: color ?? 'rgba(255,255,255,0.08)',
              transform: [{ rotate: '45deg' }],
            }}
          />
        ))}
      </View>
    );
  }
  if (type === 'waves') {
    const count = Math.ceil(size / 10);
    const waves = Array.from({ length: count });
    return (
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
        {waves.map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              bottom: size * 0.1 + i * (size / count * 0.7),
              left: -size * 0.15,
              right: -size * 0.15,
              height: 1,
              backgroundColor: color ?? 'rgba(255,255,255,0.06)',
              borderRadius: 10,
            }}
          />
        ))}
      </View>
    );
  }
  return null;
}

type AvatarProps = {
  id: string;
  size?: number;
  name?: string;
  photoUrl?: string;
  accessibilityLabel?: string;
};

export function Avatar({ id, size = 48, name, photoUrl }: AvatarProps) {
  const { user } = useAuth();
  const initials = getInitials(id, name);
  const fontSize = size * 0.38;
  const [imageError, setImageError] = useState(false);

  // Determine avatar_color — use auth metadata if this is the current user
  const isCurrentUser = user?.id === id;
  const avatarColor = isCurrentUser ? (user?.user_metadata?.avatar_color ?? null) : null;

  // Photo mode: either from prop or from avatar_color "photo:..." prefix
  const resolvedPhotoUrl = photoUrl || (avatarColor?.startsWith('photo:') ? avatarColor.slice(6) : null);
  if (resolvedPhotoUrl && !imageError) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <Image
          source={{ uri: resolvedPhotoUrl }}
          style={{ width: size, height: size }}
          onError={() => setImageError(true)}
        />
      </View>
    );
  }

  // Course theme mode: avatar_color starts with "theme:"
  if (avatarColor?.startsWith('theme:')) {
    const themeName = avatarColor.slice(6);
    const themeDef = COURSE_THEMES[themeName];
    if (themeDef) {
      return (
        <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
          <LinearGradient
            colors={themeDef.bgColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradient, { width: size, height: size }]}
          >
            <AvatarPatternOverlay type={themeDef.patternType} color={themeDef.patternColor} size={size} />
            <Text
              style={[
                styles.initials,
                {
                  fontSize,
                  fontFamily: GEO,
                  color: themeDef.initialsColor,
                  zIndex: 1,
                },
              ]}
            >
              {initials}
            </Text>
          </LinearGradient>
        </View>
      );
    }
  }

  // Named color mode: look up from NAMED_COLORS map
  const namedGradient = avatarColor ? NAMED_COLORS[avatarColor] : null;
  const [start, end] = namedGradient ?? pickGradient(id);

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <LinearGradient
        colors={[start, end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { width: size, height: size }]}
      >
        <Text
          style={[
            styles.initials,
            {
              fontSize,
              fontFamily: GEO,
              color: '#E8E4DE',
            },
          ]}
        >
          {initials}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
    color: '#E8E4DE',
  },
});
