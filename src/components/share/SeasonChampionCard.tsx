import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GEO } from '../../theme/fonts';
import { ShareCardFrame, type CardAspect } from './_frame';

const GOLD = '#C9A227';
const TEXT = '#E8E4DE';
const MUTED = '#6B6560';

export function SeasonChampionCard({
  championName,
  seasonName,
  finalPoints,
  runnerUp,
  year,
  aspect = 'story',
}: {
  championName: string;
  seasonName: string;
  finalPoints?: number;
  runnerUp?: string;
  year?: number | string;
  aspect?: CardAspect;
}) {
  return (
    <ShareCardFrame aspect={aspect} kicker="SEASON CHAMPION">
      <Ionicons name="trophy" size={72} color={GOLD} />
      <Text style={[styles.champion, { fontFamily: GEO }]} numberOfLines={2}>{championName}</Text>
      <Text style={[styles.season, { fontFamily: GEO }]} numberOfLines={2}>{seasonName}</Text>
      {year !== undefined && (
        <Text style={[styles.year, { fontFamily: GEO }]}>{year}</Text>
      )}
      <View style={styles.divider} />
      {finalPoints !== undefined && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>FINAL POINTS</Text>
          <Text style={[styles.rowValue, { fontFamily: GEO }]}>{finalPoints}</Text>
        </View>
      )}
      {runnerUp && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>RUNNER-UP</Text>
          <Text style={[styles.rowValue, { fontFamily: GEO }]} numberOfLines={1}>{runnerUp}</Text>
        </View>
      )}
    </ShareCardFrame>
  );
}

const styles = StyleSheet.create({
  champion: { color: TEXT, fontSize: 28, letterSpacing: -1, textAlign: 'center', marginTop: 20 },
  season: { color: GOLD, fontSize: 12, letterSpacing: 3, marginTop: 8, textAlign: 'center' },
  year: { color: MUTED, fontSize: 18, letterSpacing: 4, marginTop: 6 },
  divider: { width: 80, height: 1, backgroundColor: GOLD, opacity: 0.6, marginVertical: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '80%', paddingVertical: 4 },
  rowLabel: { color: MUTED, fontSize: 9, letterSpacing: 2 },
  rowValue: { color: TEXT, fontSize: 14 },
});
