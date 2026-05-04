import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Switch, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme/ThemeContext';
import { useAuth } from '../src/lib/auth';
import { GEO } from '../src/theme/fonts';
import {
  DEFAULT_PREFS,
  getPreferences,
  updatePreferences,
  type NotificationPrefs,
} from '../src/services/pushNotification.service';

const ROWS: { key: keyof NotificationPrefs; label: string; detail: string }[] = [
  { key: 'lead_changes', label: 'Lead Changes', detail: 'When someone passes you on a leaderboard' },
  { key: 'position_changes', label: 'Position Changes', detail: 'Your standing moves up or down' },
  { key: 'match_updates', label: 'Match Updates', detail: 'Trips, Ryder Cup, head-to-head' },
  { key: 'birdies_eagles_aces', label: 'Birdies · Eagles · Aces', detail: 'Highlights from your friends' },
  { key: 'friend_joined', label: 'Friend Joined', detail: 'A contact signs up for Dormie' },
  { key: 'season_reminders', label: 'Season Reminders', detail: 'Week deadlines and playoff alerts' },
  { key: 'digest_weekly', label: 'Weekly Digest', detail: 'Sunday recap + upcoming week' },
];

export default function NotificationPreferencesScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getPreferences(user.id).then((p) => {
      setPrefs(p);
      setLoading(false);
    });
  }, [user?.id]);

  const toggle = async (key: keyof NotificationPrefs) => {
    if (!user) return;
    const next = { ...prefs, [key]: !prefs[key] } as NotificationPrefs;
    setPrefs(next);
    await updatePreferences(user.id, next);
  };

  const toggleQuiet = async () => {
    if (!user) return;
    const next = {
      ...prefs,
      quiet_hours: { ...prefs.quiet_hours, enabled: !prefs.quiet_hours.enabled },
    };
    setPrefs(next);
    await updatePreferences(user.id, next);
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderColor: c.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text, fontFamily: GEO }]}>NOTIFICATIONS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <Text style={{ color: c.textMuted }}>Loading…</Text>
        ) : (
          <>
            {ROWS.map((row) => (
              <View key={row.key} style={[styles.row, { borderColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: c.text }]}>{row.label}</Text>
                  <Text style={[styles.rowDetail, { color: c.textMuted }]}>{row.detail}</Text>
                </View>
                <Switch
                  value={!!prefs[row.key]}
                  onValueChange={() => toggle(row.key)}
                  trackColor={{ false: c.border, true: c.gold }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}

            <Text style={[styles.section, { color: c.gold, fontFamily: GEO }]}>QUIET HOURS</Text>
            <View style={[styles.row, { borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: c.text }]}>Silence notifications</Text>
                <Text style={[styles.rowDetail, { color: c.textMuted }]}>
                  {prefs.quiet_hours.start} – {prefs.quiet_hours.end}
                </Text>
              </View>
              <Switch
                value={prefs.quiet_hours.enabled}
                onValueChange={toggleQuiet}
                trackColor={{ false: c.border, true: c.gold }}
                thumbColor="#FFFFFF"
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 14, letterSpacing: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowDetail: { fontSize: 11, marginTop: 2 },
  section: { fontSize: 11, letterSpacing: 2, marginTop: 24, marginBottom: 4 },
});
