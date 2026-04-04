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

const INITIALS_COLORS = [
  { name: 'Augusta Green', colors: ['#046A38', '#034D28'] },
  { name: 'Pebble Blue', colors: ['#1E3A5F', '#0F2440'] },
  { name: 'Championship Gold', colors: ['#B8860B', '#8B6508'] },
  { name: 'Midnight Navy', colors: ['#002366', '#001744'] },
  { name: 'Links Brown', colors: ['#8B4513', '#5C2E0D'] },
  { name: 'Dormie Teal', colors: ['#006747', '#1E4D2B'] },
];

const COURSE_THEMES = [
  { name: 'Augusta', colors: ['#046A38', '#034D28'], label: 'Augusta' },
  { name: 'Pebble Beach', colors: ['#1E3A5F', '#0F2440'], label: 'Pebble' },
  { name: 'St Andrews', colors: ['#8B4513', '#5C2E0D'], label: 'St Andrews' },
  { name: 'Sawgrass', colors: ['#2D6A3F', '#1E4D2B'], label: 'Sawgrass' },
  { name: 'Pinehurst', colors: ['#C4A35A', '#8B7D3C'], label: 'Pinehurst' },
  { name: 'Masters', colors: ['#1E4D2B', '#0D2818'], label: 'Masters' },
];

export default function AvatarPickerScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState<'initials' | 'theme' | null>(null);

  const initials = user?.user_metadata?.name
    ? user.user_metadata.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const handleSelectColor = async (colorName: string) => {
    if (!user || saving) return;
    haptics.light();
    setSaving(true);
    try {
      await authService.updateProfile(user.id, {
        avatar_color: colorName,
      });
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

      // Save URL to user profile
      await authService.updateProfile(user.id, {
        avatar_color: `photo:${urlData.publicUrl}`,
      });

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
        colors={greenHeaderGradient as unknown as string[]}
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
        {/* Initials Section */}
        <Text style={[styles.sectionLabel, { color: c.gold }]}>INITIALS</Text>
        <GoldDivider style={{ marginBottom: 12 }} />
        <Text style={[styles.sectionDesc, { color: c.textMuted }]}>
          Pick a background color for your initials.
        </Text>
        <View style={styles.colorGrid}>
          {INITIALS_COLORS.map((item) => (
            <Pressable
              key={item.name}
              onPress={() => handleSelectColor(item.name)}
              disabled={saving}
              style={({ pressed }) => [
                styles.colorOption,
                { borderColor: c.border, ...cardShadow },
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
            >
              <LinearGradient
                colors={item.colors as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.colorCircle}
              >
                <Text style={styles.colorInitials}>{initials}</Text>
              </LinearGradient>
              <Text style={[styles.colorName, { color: c.textMuted }]}>{item.name}</Text>
            </Pressable>
          ))}
        </View>

        {/* Course Theme Section */}
        <Text style={[styles.sectionLabel, { color: c.gold, marginTop: 24 }]}>COURSE THEME</Text>
        <GoldDivider style={{ marginBottom: 12 }} />
        <Text style={[styles.sectionDesc, { color: c.textMuted }]}>
          Themed avatars inspired by legendary courses.
        </Text>
        <View style={styles.colorGrid}>
          {COURSE_THEMES.map((item) => (
            <Pressable
              key={item.name}
              onPress={() => handleSelectColor(item.name)}
              disabled={saving}
              style={({ pressed }) => [
                styles.colorOption,
                { borderColor: c.border, ...cardShadow },
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
            >
              <LinearGradient
                colors={item.colors as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.colorCircle}
              >
                <Text style={styles.colorInitials}>{initials}</Text>
              </LinearGradient>
              <Text style={[styles.colorName, { color: c.textMuted }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Upload Photo Section */}
        <Text style={[styles.sectionLabel, { color: c.gold, marginTop: 24 }]}>UPLOAD PHOTO</Text>
        <GoldDivider style={{ marginBottom: 12 }} />
        <Pressable
          onPress={handleUploadPhoto}
          disabled={saving}
          style={({ pressed }) => [
            styles.uploadBtn,
            { backgroundColor: c.cardBg, borderColor: c.border, ...cardShadow },
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
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    alignItems: 'center',
    width: '30%',
    borderWidth: 1,
    padding: 12,
  },
  colorCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E8E4DE',
    fontFamily: GEO,
  },
  colorName: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
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
