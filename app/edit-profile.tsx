import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/lib/auth';
import { GEO, SANS } from '../src/theme/fonts';
import { cardShadowDark, cardShadowLight, greenHeaderGradient } from '../src/theme/colors';
import { Avatar } from '../src/components/Avatar';
import { authService } from '../src/services/auth.service';
import { useToast } from '../src/components/Toast';
import { haptics } from '../src/lib/haptics';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

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

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ scrollTo?: string }>();

  const [name, setName] = useState(user?.user_metadata?.name ?? '');
  const [city, setCity] = useState(user?.user_metadata?.city ?? '');
  const [stateVal, setStateVal] = useState(user?.user_metadata?.state ?? '');
  const [handicap, setHandicap] = useState(
    user?.user_metadata?.handicap_index != null
      ? String(user.user_metadata.handicap_index)
      : ''
  );
  const [saving, setSaving] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const handicapRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to handicap field if requested
  const handleLayout = useCallback(() => {
    if (params.scrollTo === 'handicap' && handicapRef.current) {
      setTimeout(() => {
        handicapRef.current?.focus();
      }, 400);
    }
  }, [params.scrollTo]);

  const handleSave = async () => {
    if (!user) return;
    haptics.light();
    setSaving(true);
    try {
      const hcpNum = handicap ? parseFloat(handicap) : 0;
      console.log('[EditProfile] Saving profile...', { name: name.trim(), city: city.trim(), state: stateVal, handicap: hcpNum });
      await authService.updateProfile(user.id, {
        name: name.trim(),
        city: city.trim() || null,
        state: stateVal || null,
        handicap_index: isNaN(hcpNum) ? 0 : hcpNum,
      });
      console.log('[EditProfile] Profile saved successfully');
      showToast({ message: 'Profile updated', type: 'success', icon: 'checkmark-circle' });
      router.back();
    } catch (err: any) {
      console.log('[EditProfile] Save failed:', err);
      const errorMsg = err?.message || 'Failed to save profile';
      showToast({ message: errorMsg, type: 'error', icon: 'alert-circle' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        onLayout={handleLayout}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Avatar id={user?.id ?? ''} size={80} name={name} />
          <Pressable
            onPress={() => {
              haptics.light();
              router.push('/avatar-picker');
            }}
            style={({ pressed }) => [styles.changeAvatarBtn, { borderColor: c.gold }, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="camera-outline" size={14} color={c.gold} />
            <Text style={[styles.changeAvatarText, { color: c.gold }]}>Change Avatar</Text>
          </Pressable>
        </View>

        {/* Full Name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: isDark ? c.gold : '#6B6966' }]}>FULL NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { backgroundColor: isDark ? c.elevated : '#FFFFFF', borderColor: isDark ? c.border : 'rgba(0,0,0,0.06)', color: c.text }]}
          />
        </View>

        {/* City */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: isDark ? c.gold : '#6B6966' }]}>CITY</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Nashville"
            placeholderTextColor={c.textMuted}
            keyboardType="default"
            autoCorrect={false}
            style={[styles.input, { backgroundColor: isDark ? c.elevated : '#FFFFFF', borderColor: isDark ? c.border : 'rgba(0,0,0,0.06)', color: c.text }]}
          />
        </View>

        {/* State */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: isDark ? c.gold : '#6B6966' }]}>STATE</Text>
          <Pressable
            onPress={() => setShowStatePicker(true)}
            style={[styles.input, {
              backgroundColor: isDark ? c.elevated : '#FFFFFF',
              borderColor: isDark ? c.border : 'rgba(0,0,0,0.06)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }]}
          >
            <Text style={{ color: stateVal ? c.text : c.textMuted, fontSize: 16 }}>
              {stateVal || 'Select state'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={c.textMuted} />
          </Pressable>
        </View>

        {/* Handicap Index */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: isDark ? c.gold : '#6B6966' }]}>HANDICAP INDEX</Text>
          <TextInput
            ref={handicapRef}
            value={handicap}
            onChangeText={setHandicap}
            placeholder="0.0"
            placeholderTextColor={c.textMuted}
            keyboardType="decimal-pad"
            style={[styles.input, { backgroundColor: isDark ? c.elevated : '#FFFFFF', borderColor: isDark ? c.border : 'rgba(0,0,0,0.06)', color: c.text }]}
          />
        </View>

        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            saving && { opacity: 0.6 },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>

        {/* Cancel */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cancelBtn, { borderColor: c.border }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.cancelBtnText, { color: c.textMuted }]}>Cancel</Text>
        </Pressable>
      </ScrollView>

      {/* State Picker Modal */}
      <Modal visible={showStatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.cardBg, borderColor: c.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.text, fontFamily: GEO }]}>Select State</Text>
              <Pressable onPress={() => setShowStatePicker(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </Pressable>
            </View>
            <FlatList
              data={US_STATES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setStateVal(item); setShowStatePicker(false); }}
                  style={({ pressed }) => [
                    styles.stateRow,
                    { borderBottomColor: c.border },
                    stateVal === item && { backgroundColor: `${c.teal}26` },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ color: stateVal === item ? c.teal : c.text, fontSize: 16, fontWeight: '600' }}>{item}</Text>
                  {stateVal === item && <Ionicons name="checkmark" size={18} color={c.teal} />}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  changeAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeAvatarText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saveBtn: {
    backgroundColor: '#006747',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: GEO,
  },
  cancelBtn: {
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '60%',
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
});
