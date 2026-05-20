import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/lib/auth';
import { GEO, SANS } from '../src/theme/fonts';
import { greenHeaderGradient, cardShadowDark, cardShadowLight } from '../src/theme/colors';
import { authService } from '../src/services/auth.service';
import { supabase } from '../src/lib/supabase';
import { useToast } from '../src/components/Toast';
import { haptics } from '../src/lib/haptics';
import GoldDivider from '../src/components/GoldDivider';

function Pinstripes() {
  const lines = Array.from({ length: 40 });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: -200,
            left: i * 18 - 100,
            width: 1,
            height: 800,
            backgroundColor: '#fff',
            opacity: 0.03,
            transform: [{ rotate: '35deg' }],
          }}
        />
      ))}
    </View>
  );
}

// 8 solid color options in a 2x4 grid
const INITIALS_COLORS = [
  { name: 'Augusta Green', colors: ['#046A38', '#034D28'] },
  { name: 'Navy', colors: ['#002366', '#001744'] },
  { name: 'Burgundy', colors: ['#6B1C2A', '#4A1420'] },
  { name: 'Forest', colors: ['#2D6A3F', '#1E4D2B'] },
  { name: 'Charcoal', colors: ['#3C3C3C', '#1A1A1A'] },
  { name: 'Royal Blue', colors: ['#2A5CAD', '#1A3D7A'] },
  { name: 'Deep Purple', colors: ['#4A2D73', '#2E1A4A'] },
  { name: 'Copper', colors: ['#A0522D', '#6B3720'] },
];

// Course-inspired designs with distinct visual patterns
const COURSE_THEMES = [
  {
    name: 'Augusta',
    label: 'Augusta',
    bgColor: '#034D28',
    initialsColor: '#C9A227',
    patternType: 'pinstripes' as const,
    patternColor: 'rgba(255,255,255,0.08)',
  },
  {
    name: 'Pebble Beach',
    label: 'Pebble Beach',
    bgColors: ['#1E6494', '#0D3B5C'] as [string, string],
    initialsColor: '#FFFFFF',
    patternType: 'gradient' as const,
  },
  {
    name: 'St Andrews',
    label: 'St Andrews',
    bgColors: ['#8B6F47', '#6B5335'] as [string, string],
    initialsColor: '#F5F0E8',
    patternType: 'solid' as const,
  },
  {
    name: 'Sawgrass',
    label: 'Sawgrass',
    bgColors: ['#1A7A6A', '#0D5C4F'] as [string, string],
    initialsColor: '#FFFFFF',
    patternType: 'waves' as const,
    patternColor: 'rgba(255,255,255,0.06)',
  },
  {
    name: 'Pinehurst',
    label: 'Pinehurst',
    bgColors: ['#C9A227', '#A0820F'] as [string, string],
    initialsColor: '#1E4D2B',
    patternType: 'solid' as const,
  },
  {
    name: 'Bandon',
    label: 'Bandon Dunes',
    bgColors: ['#6B7B8D', '#4A5A6B'] as [string, string],
    initialsColor: '#FFFFFF',
    patternType: 'solid' as const,
  },
];

// Diagonal pinstripe pattern overlay for course themes
function CoursePatternOverlay({ type, color }: { type: string; color?: string }) {
  if (type === 'pinstripes') {
    const stripes = Array.from({ length: 12 });
    return (
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
        {stripes.map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: -40,
              left: i * 8 - 20,
              width: 1.5,
              height: 140,
              backgroundColor: color ?? 'rgba(255,255,255,0.08)',
              transform: [{ rotate: '45deg' }],
            }}
          />
        ))}
      </View>
    );
  }
  if (type === 'waves') {
    const waves = Array.from({ length: 6 });
    return (
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
        {waves.map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              bottom: 6 + i * 8,
              left: -10,
              right: -10,
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

export default function AvatarPickerScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  const initials = user?.user_metadata?.name
    ? user.user_metadata.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const currentAvatarColor = user?.user_metadata?.avatar_color ?? null;

  const handleSelectColor = async (colorName: string) => {
    if (!user || saving) return;
    haptics.light();
    setSaving(true);
    try {
      await authService.updateProfile(user.id, {
        avatar_color: colorName,
      });
      await refreshUser();
      showToast({ message: 'Avatar updated', type: 'success', icon: 'checkmark-circle' });
      router.back();
    } catch {
      showToast({ message: 'Failed to update avatar', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadPhoto = async () => {
    if (!user) return;
    haptics.light();

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library to upload an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setSaving(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `${user.id}/avatar.${ext}`;

      // Upload to Supabase Storage
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Save URL to user profile and auth metadata
      await authService.updateProfile(user.id, {
        avatar_color: `photo:${urlData.publicUrl}`,
      });
      await refreshUser();

      showToast({ message: 'Photo uploaded', type: 'success', icon: 'checkmark-circle' });
      router.back();
    } catch (err) {
      showToast({ message: 'Failed to upload photo', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const cardShadow = isDark ? cardShadowDark : cardShadowLight;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={greenHeaderGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 4 }]}
      >
        <Pinstripes />
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Change Avatar</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}>
        {/* ─── INITIALS ─── Solid color circle with initials, 2x4 grid */}
        <Text style={[styles.sectionLabel, { color: c.gold }]}>INITIALS</Text>
        <GoldDivider style={{ marginBottom: 12 }} />
        <Text style={[styles.sectionDesc, { color: c.textMuted }]}>
          Solid color with your initials.
        </Text>
        <View style={styles.initialsGrid}>
          {INITIALS_COLORS.map((item) => {
            const isSelected = currentAvatarColor === item.name;
            return (
              <Pressable
                key={item.name}
                onPress={() => handleSelectColor(item.name)}
                disabled={saving}
                style={({ pressed }) => [
                  styles.initialsOption,
                  { borderColor: isSelected ? (isDark ? '#C9A227' : '#006747') : c.border, borderWidth: isSelected ? 2 : 1, ...cardShadow },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
              >
                <View style={{ position: 'relative' }}>
                  <LinearGradient
                    colors={item.colors as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.initialsCircle}
                  >
                    <Text style={styles.initialsText}>{initials}</Text>
                  </LinearGradient>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark" size={10} color="#141210" />
                    </View>
                  )}
                </View>
                <Text style={[styles.initialsName, { color: isSelected ? '#C9A227' : c.textMuted }]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── COURSE THEME ─── Distinct course-inspired designs */}
        <Text style={[styles.sectionLabel, { color: c.gold, marginTop: 28 }]}>COURSE THEME</Text>
        <GoldDivider style={{ marginBottom: 12 }} />
        <Text style={[styles.sectionDesc, { color: c.textMuted }]}>
          Inspired by the world's most iconic courses.
        </Text>
        <View style={styles.courseGrid}>
          {COURSE_THEMES.map((item) => {
            const isSelected = currentAvatarColor === `theme:${item.name}`;
            return (
              <Pressable
                key={item.name}
                onPress={() => handleSelectColor(`theme:${item.name}`)}
                disabled={saving}
                style={({ pressed }) => [
                  styles.courseOption,
                  { borderColor: isSelected ? (isDark ? '#C9A227' : '#006747') : c.border, borderWidth: isSelected ? 2 : 1, ...cardShadow },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
              >
                <View style={{ position: 'relative' }}>
                  {item.bgColors ? (
                    <LinearGradient
                      colors={item.bgColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.courseCircle}
                    >
                      <CoursePatternOverlay type={item.patternType} color={item.patternColor} />
                      <Text style={[styles.courseInitials, { color: item.initialsColor }]}>{initials}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.courseCircle, { backgroundColor: item.bgColor }]}>
                      <CoursePatternOverlay type={item.patternType} color={item.patternColor} />
                      <Text style={[styles.courseInitials, { color: item.initialsColor }]}>{initials}</Text>
                    </View>
                  )}
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark" size={10} color="#141210" />
                    </View>
                  )}
                </View>
                <Text style={[styles.courseName, { color: isSelected ? '#C9A227' : c.text }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ─── UPLOAD PHOTO ─── */}
        <Text style={[styles.sectionLabel, { color: c.gold, marginTop: 28 }]}>UPLOAD PHOTO</Text>
        <GoldDivider style={{ marginBottom: 12 }} />
        <Pressable
          onPress={handleUploadPhoto}
          disabled={saving}
          style={({ pressed }) => [
            styles.uploadBtn,
            { backgroundColor: c.cardBg, borderColor: currentAvatarColor?.startsWith('photo:') ? (isDark ? '#C9A227' : '#006747') : c.border, borderWidth: currentAvatarColor?.startsWith('photo:') ? 2 : 1, ...cardShadow },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons name="image-outline" size={24} color={c.teal} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.uploadTitle, { color: c.text }]}>Choose from Library</Text>
            <Text style={[styles.uploadDesc, { color: c.textMuted }]}>
              Select a photo and crop to a circle
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: GEO,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: GEO,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 12,
    fontFamily: SANS,
  },
  // Initials: 2x4 grid of solid color circles
  initialsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  initialsOption: {
    alignItems: 'center',
    width: '22%',
    borderWidth: 1,
    padding: 8,
  },
  initialsCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E8E4DE',
    fontFamily: GEO,
  },
  initialsName: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  // Course themes: wider cards with pattern overlays and course name labels
  courseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  courseOption: {
    alignItems: 'center',
    width: '46%',
    borderWidth: 1,
    padding: 14,
  },
  courseCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  courseInitials: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: GEO,
    zIndex: 1,
  },
  courseName: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: SANS,
  },
  selectedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#C9A227',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    padding: 16,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: SANS,
  },
  uploadDesc: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: SANS,
  },
});
