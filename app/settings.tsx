import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/lib/auth';
import { GEO } from '../src/theme/fonts';
import { authService } from '../src/services/auth.service';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// ─── Section label ───────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[s.sectionLabel, { color: theme.colors.gold, fontFamily: GEO }]}>{title}</Text>
  );
}

// ─── Setting row ─────────────────────────────────────────────────────
function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[s.settingRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
    >
      <Ionicons name={icon} size={20} color={danger ? c.urgent : c.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[s.settingText, { color: danger ? c.urgent : c.text }]}>{label}</Text>
        {value ? <Text style={[s.settingSub, { color: c.textMuted }]}>{value}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
    </Pressable>
  );
}

// ─── Mock groups ─────────────────────────────────────────────────────
const MOCK_GROUPS = [
  { id: 'g1', name: 'Saturday Crew', members: 8 },
  { id: 'g2', name: 'Work League', members: 12 },
  { id: 'g3', name: 'College Buddies', members: 6 },
];

export default function SettingsScreen() {
  const { theme, toggleTheme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const { user, signOut } = useAuth();

  const userName = user?.user_metadata?.name ?? 'Golfer';
  const userEmail = user?.email ?? '';

  return (
    <View style={[s.screen, { backgroundColor: c.bg }]}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[s.header, { backgroundColor: c.surface }]}>
          <View style={s.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </Pressable>
            <Text style={[s.headerTitle, { color: c.text, fontFamily: GEO }]}>Settings</Text>
            <View style={{ width: 24 }} />
          </View>
        </View>

        <View style={s.body}>
          {/* Profile */}
          <SectionLabel title="PROFILE" />
          <SettingRow icon="person-outline" label="Name" value={userName} onPress={() => Alert.alert('Edit Name', 'Name editing coming soon.')} />
          <SettingRow icon="mail-outline" label="Email" value={userEmail} />
          <SettingRow icon="golf-outline" label="Handicap Index" value={user?.user_metadata?.handicap_index?.toFixed(1) ?? '—'} onPress={() => Alert.alert('Handicap', 'Handicap is calculated automatically from your rounds.')} />

          {/* Groups */}
          <SectionLabel title="GROUPS" />
          {MOCK_GROUPS.map((group) => (
            <SettingRow
              key={group.id}
              icon="people-outline"
              label={group.name}
              value={`${group.members} members`}
              onPress={() => Alert.alert(group.name, `Manage ${group.name} group settings.`)}
            />
          ))}
          <Pressable
            onPress={() => Alert.alert('Create Group', 'Group creation coming soon.')}
            style={[s.addGroupBtn, { borderColor: c.teal }]}
          >
            <Ionicons name="add" size={18} color={c.teal} />
            <Text style={[s.addGroupText, { color: c.teal }]}>Create New Group</Text>
          </Pressable>

          {/* Preferences */}
          <SectionLabel title="PREFERENCES" />
          <Pressable
            onPress={toggleTheme}
            style={[s.settingRow, { backgroundColor: c.cardBg, borderColor: c.border }]}
          >
            <Ionicons name={theme.isDark ? 'moon' : 'sunny'} size={20} color={theme.isDark ? c.gold : c.teal} />
            <Text style={[s.settingText, { color: c.text, flex: 1 }]}>
              {theme.isDark ? 'Dark Mode' : 'Light Mode'}
            </Text>
            <View style={[s.toggleTrack, { backgroundColor: theme.isDark ? c.teal : '#F2F0ED', borderColor: theme.isDark ? c.teal : 'rgba(0,0,0,0.06)' }]}>
              <View style={[s.toggleKnob, theme.isDark && s.toggleKnobOn]} />
            </View>
          </Pressable>
          <SettingRow icon="notifications-outline" label="Notifications" onPress={() => router.push('/notification-preferences')} />
          <SettingRow icon="wallet-outline" label="Ledger" onPress={() => router.push('/ledger')} />
          <SettingRow icon="newspaper-outline" label="Weekly Digest" onPress={() => router.push('/digest')} />
          <SettingRow icon="calculator-outline" label="Default Scoring" value="Gross" onPress={() => Alert.alert('Scoring', 'Default scoring format coming soon.')} />

          {/* About */}
          <SectionLabel title="ABOUT" />
          <SettingRow icon="information-circle-outline" label="Version" value="1.0.0" />
          <SettingRow icon="document-text-outline" label="Privacy Policy" onPress={() => Alert.alert('Privacy', 'Privacy policy coming soon.')} />
          <SettingRow icon="help-circle-outline" label="Help & Support" onPress={() => Alert.alert('Support', 'Contact support@dormie.golf')} />

          {/* Sign out */}
          <View style={{ marginTop: 24 }}>
            <Pressable
              onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
              ])}
              style={[s.signOutBtn, { borderColor: c.urgent }]}
            >
              <Ionicons name="log-out-outline" size={18} color={c.urgent} />
              <Text style={[s.signOutText, { color: c.urgent }]}>Sign Out</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingTop: STATUS_BAR_H + 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  body: { paddingHorizontal: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  settingText: { fontSize: 14, fontWeight: '600' },
  settingSub: { fontSize: 11, marginTop: 2 },
  addGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  addGroupText: { fontSize: 13, fontWeight: '600' },
  toggleTrack: {
    width: 44,
    height: 24,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: 18,
    height: 18,
    backgroundColor: '#fff',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 14,
  },
  signOutText: { fontSize: 14, fontWeight: '700' },
});
