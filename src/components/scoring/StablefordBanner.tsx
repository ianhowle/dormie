import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import type { PlayerConfig } from '../../scoring/types';
import type { StablefordLiveEntry } from '../../scoring/stableford-live';

type Props = {
  entries: Map<string, StablefordLiveEntry>;
  players: PlayerConfig[];
};

function shortName(p: PlayerConfig) {
  return p.id === '1' ? 'You' : p.name.split(' ')[0];
}

// Stage 2: live Stableford points banner. Pure render of the Stage 1
// `stablefordLive` memo — points DESC (leader first), "You" for id '1'.
// Inline View — no Modal, no Pressable, no state. Mirrors MatchPlayBanner's
// peer-card chrome (flag icon, Georgia serif 17pt, one line).
//
// All roster players are shown (defaulting to 0/0) so the line is stable from
// the first hole. `thru` = the furthest hole reached in the round (max across
// players): during normal hole-by-hole group scoring every player shares the
// same thru, so max == the common value; when momentarily uneven it reflects
// the round's leading edge rather than dropping to a laggard's count.
export function StablefordBanner({ entries, players }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const rows = players
    .map((p) => ({ p, e: entries.get(p.id) ?? { points: 0, thru: 0 } }))
    .sort((a, b) => b.e.points - a.e.points);

  const thru = rows.reduce((max, r) => Math.max(max, r.e.thru), 0);
  const scoreText = rows.map((r) => `${shortName(r.p)} ${r.e.points}`).join(' · ');
  const line = thru > 0 ? `${scoreText} · thru ${thru}` : scoreText;

  return (
    <View style={[styles.banner, { backgroundColor: c.elevated, borderColor: c.border }]}>
      <Ionicons name="flag" size={16} color={c.gold} />
      <Text style={[styles.status, { color: c.text, fontFamily: GEO }]} numberOfLines={1}>
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  status: { fontSize: 17, flex: 1 },
});
