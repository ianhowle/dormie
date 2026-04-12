import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import type { PlayerConfig, SixSixSixSegment } from '../../scoring/types';

const { width: SCREEN_W } = Dimensions.get('window');

function nameFor(pid: string, players: PlayerConfig[]) {
  const p = players.find((pl) => pl.id === pid);
  if (!p) return '—';
  return p.id === '1' ? 'You' : p.name.split(' ')[0];
}

// ─── Per-hole banner: current partnerships + segment score ──────────
export function SixSixSixBanner({
  segment,
  segmentIdx,
  players,
}: {
  segment: SixSixSixSegment;
  segmentIdx: number;
  players: PlayerConfig[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const label = ['HOLES 1–6', 'HOLES 7–12', 'HOLES 13–18'][segmentIdx];

  return (
    <View style={[styles.banner, { backgroundColor: c.elevated, borderColor: c.border }]}>
      <View style={styles.side}>
        <Text style={[styles.teamLabel, { color: c.teal }]}>
          {nameFor(segment.team1[0], players)} & {nameFor(segment.team1[1], players)}
        </Text>
        <Text style={[styles.score, { color: c.text, fontFamily: GEO }]}>{segment.team1Wins}</Text>
      </View>
      <View style={styles.centerCol}>
        <Text style={[styles.segTag, { color: c.gold }]}>{label}</Text>
        <Text style={[styles.vs, { color: c.textMuted }]}>vs</Text>
      </View>
      <View style={styles.side}>
        <Text style={[styles.teamLabel, { color: c.gold }]}>
          {nameFor(segment.team2[0], players)} & {nameFor(segment.team2[1], players)}
        </Text>
        <Text style={[styles.score, { color: c.text, fontFamily: GEO }]}>{segment.team2Wins}</Text>
      </View>
    </View>
  );
}

// ─── Segment transition overlay: "PARTNERS ROTATE" ──────────────────
export function SixSixSixSegmentTransition({
  visible,
  segmentIdx,
  team1,
  team2,
  players,
  onDismiss,
}: {
  visible: boolean;
  segmentIdx: number;
  team1: [string, string];
  team2: [string, string];
  players: PlayerConfig[];
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    scale.setValue(0.8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [visible, opacity, scale, onDismiss]);

  if (!visible) return null;
  const segLabel = ['HOLES 1–6', 'HOLES 7–12', 'HOLES 13–18'][segmentIdx];

  return (
    <Modal transparent animationType="none" visible={visible}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Animated.View style={[styles.bg, { backgroundColor: '#0A0908', opacity }]} />
        <View style={[styles.cornerTL, { borderColor: c.gold }]} />
        <View style={[styles.cornerTR, { borderColor: c.gold }]} />
        <View style={[styles.cornerBL, { borderColor: c.gold }]} />
        <View style={[styles.cornerBR, { borderColor: c.gold }]} />

        <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
          <Text style={[styles.kicker, { color: c.gold, fontFamily: GEO }]}>PARTNERS ROTATE</Text>
          <Ionicons name="swap-horizontal" size={56} color={c.gold} style={{ marginVertical: 16 }} />
          <Text style={[styles.segLabel, { color: c.text, fontFamily: GEO }]}>{segLabel}</Text>

          <View style={styles.pairRow}>
            <View style={styles.pair}>
              <Text style={[styles.pairTag, { color: c.teal }]}>TEAM 1</Text>
              <Text style={[styles.pairNames, { color: c.text, fontFamily: GEO }]}>
                {nameFor(team1[0], players)} & {nameFor(team1[1], players)}
              </Text>
            </View>
            <Text style={[styles.vsLarge, { color: c.textMuted }]}>vs</Text>
            <View style={styles.pair}>
              <Text style={[styles.pairTag, { color: c.gold }]}>TEAM 2</Text>
              <Text style={[styles.pairNames, { color: c.text, fontFamily: GEO }]}>
                {nameFor(team2[0], players)} & {nameFor(team2[1], players)}
              </Text>
            </View>
          </View>

          <Text style={[styles.tap, { color: c.textMuted }]}>TAP TO CONTINUE</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  side: { alignItems: 'center', minWidth: 90, flex: 1 },
  centerCol: { alignItems: 'center', paddingHorizontal: 8 },
  teamLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  score: { fontSize: 22, marginTop: 2 },
  segTag: { fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  vs: { fontSize: 11, marginTop: 2 },

  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bg: { ...StyleSheet.absoluteFillObject },
  content: { alignItems: 'center', paddingHorizontal: 40 },
  kicker: { fontSize: 12, letterSpacing: 3 },
  segLabel: { fontSize: 20, letterSpacing: 2, marginBottom: 24 },
  pairRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  pair: { alignItems: 'center', minWidth: 110 },
  pairTag: { fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  pairNames: { fontSize: 16, marginTop: 4, textAlign: 'center' },
  vsLarge: { fontSize: 14, marginHorizontal: 12 },
  tap: { fontSize: 10, fontWeight: '600', letterSpacing: 2, marginTop: 32 },
  cornerTL: { position: 'absolute', top: 80, left: 24, width: 24, height: 24, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { position: 'absolute', top: 80, right: 24, width: 24, height: 24, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { position: 'absolute', bottom: 80, left: 24, width: 24, height: 24, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { position: 'absolute', bottom: 80, right: 24, width: 24, height: 24, borderBottomWidth: 2, borderRightWidth: 2 },
});
