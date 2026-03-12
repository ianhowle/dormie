import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// TODO: Full 3-mode avatar (131 lines)
// Modes: initials, themed (10 themes), photo

type AvatarProps = {
  name?: string;
  imageUrl?: string;
  size?: number;
};

export function Avatar({ name = '', imageUrl, size = 48 }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />;
  }

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.white, fontWeight: '600' },
  image: { backgroundColor: colors.surface },
});
