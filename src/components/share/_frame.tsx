import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GEO } from '../../theme/fonts';

const BG = '#0D0B09';
const GOLD = '#C9A227';

export type CardAspect = 'story' | 'square';

export function ShareCardFrame({
  children,
  aspect = 'square',
  kicker,
}: {
  children: React.ReactNode;
  aspect?: CardAspect;
  kicker?: string;
}) {
  const width = 360;
  const height = aspect === 'story' ? Math.round((width * 16) / 9) : width;

  return (
    <View style={[styles.card, { width, height }]}>
      <View style={[styles.cornerTL, { borderColor: GOLD }]} />
      <View style={[styles.cornerTR, { borderColor: GOLD }]} />
      <View style={[styles.cornerBL, { borderColor: GOLD }]} />
      <View style={[styles.cornerBR, { borderColor: GOLD }]} />

      <View style={styles.header}>
        <Ionicons name="golf" size={14} color={GOLD} />
        <Text style={[styles.brand, { fontFamily: GEO }]}>DORMIE</Text>
      </View>

      {kicker && (
        <Text style={[styles.kicker, { fontFamily: GEO }]}>{kicker}</Text>
      )}

      <View style={styles.body}>{children}</View>

      <View style={styles.footer}>
        <View style={styles.divider} />
        <Text style={[styles.footerText, { fontFamily: GEO }]}>dormieapp.com</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BG,
    paddingHorizontal: 24, paddingVertical: 32,
    alignItems: 'center', justifyContent: 'space-between',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { color: GOLD, fontSize: 11, letterSpacing: 4, fontWeight: '700' },
  kicker: { color: GOLD, fontSize: 10, letterSpacing: 3, marginTop: 14 },
  body: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 8 },
  divider: { width: 60, height: 1, backgroundColor: GOLD, opacity: 0.6 },
  footerText: { color: '#6B6560', fontSize: 9, letterSpacing: 3 },
  cornerTL: { position: 'absolute', top: 14, left: 14, width: 18, height: 18, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { position: 'absolute', top: 14, right: 14, width: 18, height: 18, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { position: 'absolute', bottom: 14, left: 14, width: 18, height: 18, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { position: 'absolute', bottom: 14, right: 14, width: 18, height: 18, borderBottomWidth: 2, borderRightWidth: 2 },
});
