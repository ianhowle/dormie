import { useState } from 'react';
import { Text, StyleSheet, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';

// Golf-themed gradient palette — deterministic pick based on id
// Matches the onboarding avatar color choices:
// Augusta green, Pebble blue, Championship gold, Midnight navy, Links brown
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

type AvatarProps = {
  id: string;
  size?: number;
  name?: string;
  photoUrl?: string;
};

export function Avatar({ id, size = 48, name, photoUrl }: AvatarProps) {
  const { theme } = useTheme();
  const [start, end] = pickGradient(id);
  const initials = getInitials(id, name);
  const fontSize = size * 0.38;
  const [imageError, setImageError] = useState(false);

  // Show photo if photoUrl is provided and hasn't errored
  if (photoUrl && !imageError) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <Image
          source={{ uri: photoUrl }}
          style={{ width: size, height: size }}
          onError={() => setImageError(true)}
        />
      </View>
    );
  }

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
              color: theme.colors.text,
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
