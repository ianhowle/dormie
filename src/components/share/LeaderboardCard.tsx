import { View, Text, StyleSheet } from 'react-native';
import { GEO } from '../../theme/fonts';
import { ShareCardFrame, type CardAspect } from './_frame';

const GOLD = '#C9A227';
const TEXT = '#E8E4DE';
const MUTED = '#6B6560';

export type LeaderboardRow = {
  position: number;
  name: string;
  value: string | number;
  trend?: 'up' | 'down' | 'flat';
};

export function LeaderboardCard({
  title,
  subtitle,
  rows,
  aspect = 'story',
}: {
  title: string;
  subtitle?: string;
  rows: LeaderboardRow[];
  aspect?: CardAspect;
}) {
  return (
    <ShareCardFrame aspect={aspect} kicker="STANDINGS">
      <Text style={[styles.title, { fontFamily: GEO }]} numberOfLines={2}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle.toUpperCase()}</Text>}

      <View style={styles.list}>
        {rows.slice(0, 8).map((row) => {
          const isTop = row.position === 1;
          return (
            <View key={row.position} style={styles.row}>
              <Text style={[styles.pos, { fontFamily: GEO, color: isTop ? GOLD : MUTED }]}>
                {row.position}
              </Text>
              <Text style={[styles.name, { color: isTop ? TEXT : MUTED }]} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={[styles.value, { fontFamily: GEO, color: isTop ? GOLD : TEXT }]}>
                {row.value}
              </Text>
            </View>
          );
        })}
      </View>
    </ShareCardFrame>
  );
}

const styles = StyleSheet.create({
  title: { color: TEXT, fontSize: 20, letterSpacing: -0.5, textAlign: 'center', marginTop: 4 },
  subtitle: { color: GOLD, fontSize: 10, letterSpacing: 3, marginTop: 4 },
  list: { width: '100%', marginTop: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(201,162,39,0.15)',
  },
  pos: { width: 28, fontSize: 16, textAlign: 'center' },
  name: { flex: 1, fontSize: 13, marginLeft: 8 },
  value: { fontSize: 14, marginLeft: 8 },
});
