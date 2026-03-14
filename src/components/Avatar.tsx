import { useState } from 'react';
import { Text, StyleSheet, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';

// Gradient palette — deterministic pick based on id
const GRADIENTS: [string, string][] = [
  ['#2A9D8F', '#1E4D2B'],
  ['#D4AF37', '#8B7228'],
  ['#C44B4F', '#7A2E30'],
  ['#2D6A3F', '#1E4D2B'],
  ['#5B7FA5', '#2A4A6B'],
  ['#8B6DAF', '#5A3D7A'],
  ['#C47B3B', '#7A4D24'],
  ['#4A9B8E', '#2A6B5F'],
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
      <View style={{ width: size, height: size, overflow: 'hidden' }}>
        <Image
          source={{ uri: photoUrl }}
          style={{ width: size, height: size }}
          onError={() => setImageError(true)}
        />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
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
