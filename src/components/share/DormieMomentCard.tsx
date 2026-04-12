import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GEO } from '../../theme/fonts';
import { ShareCardFrame, type CardAspect } from './_frame';

const GOLD = '#C9A227';
const TEXT = '#E8E4DE';
const MUTED = '#6B6560';

export function DormieMomentCard({
  momentLabel,
  playerName,
  detail,
  icon = 'flag',
  aspect = 'square',
}: {
  momentLabel: string;
  playerName: string;
  detail?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  aspect?: CardAspect;
}) {
  return (
    <ShareCardFrame aspect={aspect} kicker={momentLabel.toUpperCase()}>
      <Ionicons name={icon} size={64} color={GOLD} style={{ marginTop: 8 }} />
      <Text style={[styles.name, { fontFamily: GEO }]} numberOfLines={2}>{playerName}</Text>
      {detail && (
        <Text style={[styles.detail, { fontFamily: GEO }]} numberOfLines={3}>{detail}</Text>
      )}
      <View style={styles.divider} />
      <Text style={styles.timestamp}>{new Date().toLocaleDateString()}</Text>
    </ShareCardFrame>
  );
}

const styles = StyleSheet.create({
  name: { color: TEXT, fontSize: 24, letterSpacing: -0.5, textAlign: 'center', marginTop: 20 },
  detail: { color: MUTED, fontSize: 13, textAlign: 'center', marginTop: 10, paddingHorizontal: 20 },
  divider: { width: 60, height: 1, backgroundColor: GOLD, opacity: 0.6, marginVertical: 16 },
  timestamp: { color: MUTED, fontSize: 9, letterSpacing: 3 },
});
