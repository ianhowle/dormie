import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeContext';
import { GEO, SANS } from '../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../theme/colors';
import { haptics } from '../lib/haptics';

// ─── Nudge Card (appears in home feed) ──────────────────────────────
export function NudgeCard({
  message,
  actionLabel,
  actionRoute,
  icon,
  accentColor,
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  actionRoute?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
  onDismiss?: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();
  const accent = accentColor ?? c.teal;

  return (
    <View style={[
      styles.nudgeCard,
      { backgroundColor: `${accent}10`, borderColor: accent, borderWidth: 1, borderLeftWidth: 3 },
      isDark ? cardShadowDark : cardShadowLight,
    ]}>
      <View style={styles.nudgeContent}>
        {icon && <Ionicons name={icon} size={18} color={accent} style={{ marginRight: 8 }} />}
        <View style={{ flex: 1 }}>
          <Text style={[styles.nudgeText, { color: c.text, fontFamily: SANS }]}>{message}</Text>
          {actionLabel && actionRoute && (
            <Pressable
              onPress={() => { haptics.light(); router.push(actionRoute as any); }}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.nudgeAction, { color: accent, fontFamily: SANS }]}>
                {actionLabel} {'\u2192'}
              </Text>
            </Pressable>
          )}
        </View>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Ionicons name="close" size={16} color={c.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Friend Round Card (shown when a friend logs a round) ──────────
export function FriendRoundNudge({
  friendName,
  score,
  onDismiss,
}: {
  friendName: string;
  score: number;
  onDismiss?: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isDark = theme.isDark;
  const router = useRouter();

  return (
    <View style={[
      styles.nudgeCard,
      { backgroundColor: c.cardBg, borderColor: c.gold, borderWidth: 1, borderLeftWidth: 3, borderLeftColor: c.gold },
      isDark ? cardShadowDark : cardShadowLight,
    ]}>
      <View style={styles.nudgeContent}>
        <Ionicons name="flame-outline" size={18} color={c.gold} style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.nudgeText, { color: c.text, fontFamily: SANS }]}>
            {friendName} just posted a {score}. Think you can beat that?
          </Text>
          <Pressable
            onPress={() => { haptics.light(); router.push('/(tabs)/score'); }}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.nudgeAction, { color: c.gold, fontFamily: SANS }]}>
              Log a Round {'\u2192'}
            </Text>
          </Pressable>
        </View>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={12}>
            <Ionicons name="close" size={16} color={c.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Toast configs for contextual nudges ────────────────────────────
export const NUDGE_TOASTS = {
  firstRound: {
    message: 'First round logged! Your stats are live.',
    type: 'success' as const,
    icon: 'checkmark-circle' as const,
    duration: 3000,
  },
  firstFriend: {
    message: 'Nice \u2014 check the Board tab to see how you stack up.',
    type: 'success' as const,
    icon: 'people' as const,
    duration: 3000,
  },
};

const styles = StyleSheet.create({
  nudgeCard: {
    marginBottom: 12,
    padding: 14,
  },
  nudgeContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nudgeText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  nudgeAction: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
});
