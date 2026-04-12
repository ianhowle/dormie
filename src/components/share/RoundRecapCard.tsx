import { View, Text, StyleSheet } from 'react-native';
import { GEO } from '../../theme/fonts';
import { ShareCardFrame, type CardAspect } from './_frame';

const GOLD = '#C9A227';
const TEXT = '#E8E4DE';
const MUTED = '#6B6560';

export function RoundRecapCard({
  playerName,
  courseName,
  gross,
  toPar,
  highlights = [],
  date,
  aspect = 'square',
}: {
  playerName: string;
  courseName: string;
  gross: number;
  toPar: number;
  highlights?: { label: string; value: string }[];
  date?: string;
  aspect?: CardAspect;
}) {
  return (
    <ShareCardFrame aspect={aspect} kicker="ROUND RECAP">
      <Text style={[styles.name, { fontFamily: GEO }]} numberOfLines={1}>{playerName}</Text>
      <Text style={[styles.course, { fontFamily: GEO }]} numberOfLines={1}>{courseName}</Text>

      <View style={styles.scoreRow}>
        <Text style={[styles.gross, { fontFamily: GEO }]}>{gross}</Text>
        <Text style={[styles.toPar, { fontFamily: GEO }]}>
          {toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : `${toPar}`}
        </Text>
      </View>

      {highlights.length > 0 && (
        <View style={styles.highlights}>
          {highlights.map((h, i) => (
            <View key={i} style={styles.hCell}>
              <Text style={[styles.hValue, { fontFamily: GEO }]}>{h.value}</Text>
              <Text style={styles.hLabel}>{h.label.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      )}

      {date && <Text style={styles.date}>{date.toUpperCase()}</Text>}
    </ShareCardFrame>
  );
}

const styles = StyleSheet.create({
  name: { color: TEXT, fontSize: 22, letterSpacing: -0.5, textAlign: 'center' },
  course: { color: MUTED, fontSize: 12, letterSpacing: 2, marginTop: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 24, gap: 12 },
  gross: { color: TEXT, fontSize: 80, letterSpacing: -2 },
  toPar: { color: GOLD, fontSize: 26, letterSpacing: -1 },
  highlights: { flexDirection: 'row', marginTop: 28, gap: 20 },
  hCell: { alignItems: 'center' },
  hValue: { color: TEXT, fontSize: 20, letterSpacing: -0.5 },
  hLabel: { color: MUTED, fontSize: 9, letterSpacing: 2, marginTop: 4 },
  date: { color: MUTED, fontSize: 9, letterSpacing: 3, marginTop: 20 },
});
