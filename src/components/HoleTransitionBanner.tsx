import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { GEO } from '../theme/fonts';
import { scoreColor as scoreColorUtil, scoreName as scoreNameUtil } from '../lib/scoring-utils';

const { width: SCREEN_W } = Dimensions.get('window');
const AUTO_DISMISS_MS = 1800;

// ─── Score styling (from shared scoring-utils) ──────────────────────
const scoreName = scoreNameUtil;
const scoreColor = scoreColorUtil;

// ─── Types ────────────────────────────────────────────────────────────
export type PlayerHoleResult = {
  name: string;
  avatarColor: string;
  gross: number;
  putts: number;
  fir: boolean | null;
  gir: boolean;
};

export type HoleTransitionBannerProps = {
  visible: boolean;
  holeNumber: number;
  par: number;
  results: PlayerHoleResult[];
  onDismiss: () => void;
};

export function HoleTransitionBanner({
  visible,
  holeNumber,
  par,
  results,
  onDismiss,
}: HoleTransitionBannerProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const slideAnim = useRef(new Animated.Value(-200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(-200);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: -200, duration: 300, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => onDismiss());
      }, AUTO_DISMISS_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, slideAnim, opacityAnim, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: c.cardBg, opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Hole header */}
      <View style={[styles.header, { backgroundColor: c.elevated }]}>
        <Text style={[styles.holeLabel, { color: c.textMuted }]}>HOLE</Text>
        <Text style={[styles.holeNum, { color: c.text, fontFamily: GEO }]}>{holeNumber}</Text>
        <Text style={[styles.holePar, { color: c.textMuted }]}>PAR {par}</Text>
      </View>

      {/* Player results */}
      {results.map((r, i) => {
        const sName = scoreName(r.gross, par);
        const sColor = scoreColor(r.gross, par);

        return (
          <View key={i} style={[styles.row, { borderBottomColor: c.border }]}>
            <View style={[styles.colorDot, { backgroundColor: r.avatarColor }]} />
            <Text style={[styles.playerName, { color: c.text }]} numberOfLines={1}>
              {r.name}
            </Text>

            {/* FIR / GIR indicators */}
            <View style={styles.indicators}>
              {r.fir !== null && (
                <View style={[styles.indicator, { backgroundColor: r.fir ? c.teal + '22' : c.urgent + '22' }]}>
                  <Text style={[styles.indicatorText, { color: r.fir ? c.teal : c.urgent }]}>FIR</Text>
                </View>
              )}
              <View style={[styles.indicator, { backgroundColor: r.gir ? c.teal + '22' : c.urgent + '22' }]}>
                <Text style={[styles.indicatorText, { color: r.gir ? c.teal : c.urgent }]}>GIR</Text>
              </View>
            </View>

            {/* Putts */}
            <View style={styles.puttsBox}>
              <Ionicons name="golf" size={11} color={c.textMuted} />
              <Text style={[styles.puttsVal, { color: c.textMuted, fontFamily: GEO }]}>{r.putts}</Text>
            </View>

            {/* Score */}
            <View style={[styles.scoreBox, { backgroundColor: sColor + '1A' }]}>
              <Text style={[styles.scoreGross, { color: sColor, fontFamily: GEO }]}>{r.gross}</Text>
              <Text style={[styles.scoreLbl, { color: sColor }]}>{sName}</Text>
            </View>
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  holeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  holeNum: { fontSize: 24, fontWeight: '700' },
  holePar: { fontSize: 11, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  colorDot: { width: 8, height: 8, borderRadius: 0 },
  playerName: { flex: 1, fontSize: 14, fontWeight: '600', minWidth: 70 },
  indicators: { flexDirection: 'row', gap: 4 },
  indicator: { paddingHorizontal: 4, paddingVertical: 1 },
  indicatorText: { fontSize: 9, fontWeight: '700' },
  puttsBox: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 30 },
  puttsVal: { fontSize: 13 },
  scoreBox: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, minWidth: 54 },
  scoreGross: { fontSize: 18, fontWeight: '700' },
  scoreLbl: { fontSize: 9, fontWeight: '600', marginTop: 1 },
});
