import { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import GoldDivider from './GoldDivider';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Moment types ─────────────────────────────────────────────────────
export type MomentType =
  | 'DORMIE'
  | 'MATCH_CLOSED'
  | 'SKINS_JACKPOT'
  | 'LONE_WOLF_VICTORY'
  | 'BLIND_WOLF_WIN'
  | 'BBB_TRIPLE_CROWN';

type MomentConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  gradient: [string, string];
};

const MOMENT_CONFIG: Record<MomentType, MomentConfig> = {
  DORMIE: {
    icon: 'flag',
    label: 'DORMIE',
    gradient: ['#1E4D2B', '#0A1F12'],
  },
  MATCH_CLOSED: {
    icon: 'checkmark-done',
    label: 'MATCH CLOSED',
    gradient: ['#2A2520', '#0A0908'],
  },
  SKINS_JACKPOT: {
    icon: 'cash',
    label: 'SKINS JACKPOT',
    gradient: ['#3A2A10', '#0A0800'],
  },
  LONE_WOLF_VICTORY: {
    icon: 'paw',
    label: 'LONE WOLF',
    gradient: ['#2A1A2A', '#0A0608'],
  },
  BLIND_WOLF_WIN: {
    icon: 'eye-off',
    label: 'BLIND WOLF',
    gradient: ['#1A1A2A', '#060608'],
  },
  BBB_TRIPLE_CROWN: {
    icon: 'trophy',
    label: 'TRIPLE CROWN',
    gradient: ['#2A2510', '#0A0900'],
  },
};

const AUTO_DISMISS_MS = 5000;

export type DormieMomentProps = {
  visible: boolean;
  type: MomentType;
  playerName: string;
  detail: string;
  onDismiss: () => void;
};

export function DormieMoment({ visible, type, playerName, detail, onDismiss }: DormieMomentProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const config = MOMENT_CONFIG[type];

  // Staggered animation values
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const labelY = useRef(new Animated.Value(30)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const nameY = useRef(new Animated.Value(20)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const detailY = useRef(new Animated.Value(20)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;
  const dividerWidth = useRef(new Animated.Value(0)).current;
  const tapOpacity = useRef(new Animated.Value(0)).current;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runEntrance = useCallback(() => {
    overlayOpacity.setValue(0);
    labelY.setValue(30);
    labelOpacity.setValue(0);
    iconScale.setValue(0);
    nameY.setValue(20);
    nameOpacity.setValue(0);
    detailY.setValue(20);
    detailOpacity.setValue(0);
    dividerWidth.setValue(0);
    tapOpacity.setValue(0);

    Animated.sequence([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(labelY, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(labelOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.spring(iconScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(dividerWidth, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(nameY, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(nameOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(detailY, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(detailOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
      Animated.timing(tapOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
  }, [overlayOpacity, labelY, labelOpacity, iconScale, nameY, nameOpacity, detailY, detailOpacity, dividerWidth, tapOpacity, onDismiss]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onDismiss();
  }, [onDismiss]);

  if (!visible) return null;

  const dividerInterp = dividerWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_W * 0.25],
  });

  return (
    <Modal transparent animationType="none" visible={visible} onShow={runEntrance}>
      <Pressable style={styles.overlay} onPress={handleDismiss}>
        <Animated.View
          style={[
            styles.background,
            { backgroundColor: config.gradient[1], opacity: overlayOpacity },
          ]}
        />

        {/* Gold corner brackets */}
        <View style={[styles.cornerTL, { borderColor: c.gold }]} />
        <View style={[styles.cornerTR, { borderColor: c.gold }]} />
        <View style={[styles.cornerBL, { borderColor: c.gold }]} />
        <View style={[styles.cornerBR, { borderColor: c.gold }]} />

        <View style={styles.content}>
          {/* Event label */}
          <Animated.Text
            style={[
              styles.eventLabel,
              { color: c.gold, opacity: labelOpacity, transform: [{ translateY: labelY }] },
            ]}
          >
            {config.label}
          </Animated.Text>

          {/* Icon */}
          <Animated.View style={{ transform: [{ scale: iconScale }], marginVertical: 20 }}>
            <Ionicons name={config.icon} size={56} color={c.gold} />
          </Animated.View>

          {/* Gold divider between icon and name */}
          <GoldDivider style={{ marginVertical: 16, width: SCREEN_W * 0.5 }} />

          {/* Animated divider */}
          <View style={styles.dividerRow}>
            <Animated.View style={[styles.dividerLine, { backgroundColor: c.gold, width: dividerInterp }]} />
            <Ionicons name="diamond" size={10} color={c.gold} style={{ marginHorizontal: 10 }} />
            <Animated.View style={[styles.dividerLine, { backgroundColor: c.gold, width: dividerInterp }]} />
          </View>

          {/* Player name */}
          <Animated.Text
            style={[
              styles.playerName,
              { color: '#FFFFFF', opacity: nameOpacity, transform: [{ translateY: nameY }] },
            ]}
          >
            {playerName}
          </Animated.Text>

          {/* Detail */}
          <Animated.Text
            style={[
              styles.detail,
              { color: c.textMuted, opacity: detailOpacity, transform: [{ translateY: detailY }] },
            ]}
          >
            {detail}
          </Animated.Text>

          {/* Gold divider after detail */}
          <GoldDivider style={{ marginTop: 24, marginBottom: 16, width: SCREEN_W * 0.35 }} />

          {/* Tap to continue */}
          <Animated.Text style={[styles.tapText, { color: c.textMuted, opacity: tapOpacity }]}>
            TAP TO CONTINUE
          </Animated.Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  background: { ...StyleSheet.absoluteFillObject },
  content: { alignItems: 'center', paddingHorizontal: 40 },
  eventLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 2, fontFamily: GEO, textTransform: 'uppercase' },
  dividerRow: { flexDirection: 'row', alignItems: 'center' },
  dividerLine: { height: 1 },
  playerName: { fontSize: 28, fontWeight: '700', fontFamily: GEO, textAlign: 'center', marginTop: 20, letterSpacing: -1 },
  detail: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  tapText: { fontSize: 10, fontWeight: '600', letterSpacing: 2, marginTop: 32 },
  cornerTL: { position: 'absolute', top: 60, left: 24, width: 28, height: 28, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { position: 'absolute', top: 60, right: 24, width: 28, height: 28, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { position: 'absolute', bottom: 60, left: 24, width: 28, height: 28, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { position: 'absolute', bottom: 60, right: 24, width: 28, height: 28, borderBottomWidth: 2, borderRightWidth: 2 },
});
