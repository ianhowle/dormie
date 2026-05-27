import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import type { MatchPlayState } from '../../data/scoring';
import type { PlayerConfig } from '../../scoring/types';

type Props = {
  state: MatchPlayState;
  perspective: 'A' | 'B';
  sides: { sideA: { playerIds: string[] }; sideB: { playerIds: string[] } };
  players: PlayerConfig[];
};

function nameFor(pid: string | undefined, players: PlayerConfig[]) {
  if (!pid) return 'You';
  const p = players.find((pl) => pl.id === pid);
  if (!p) return '—';
  return p.id === '1' ? 'You' : p.name.split(' ')[0];
}

// Stage 3a: live match-status banner. Reads matchPlayState.currentDisplay
// (perspective-aware UP/DOWN) and prefixes the perspective side's name so
// the line reads as a subject: "You 2 UP thru 9" / "Kara 2 DOWN thru 4" /
// "AS thru 12" / "You DORMIE". Inline View — no Modal, no state.
export function MatchPlayBanner({ state, perspective, sides, players }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const perspectivePid = perspective === 'A'
    ? sides.sideA.playerIds[0]
    : sides.sideB.playerIds[0];
  const perspectiveName = nameFor(perspectivePid, players);

  let line: string;
  if (state.status === 'AS') {
    line = state.currentDisplay;
  } else if (state.status === 'DORMIE') {
    line = `${perspectiveName} DORMIE`;
  } else {
    line = `${perspectiveName} ${state.currentDisplay}`;
  }

  const isDormie = state.status === 'DORMIE';

  return (
    <View style={[styles.banner, { backgroundColor: c.elevated, borderColor: c.border }]}>
      <Ionicons name="flag" size={16} color={c.gold} />
      <Text
        style={[styles.status, { color: isDormie ? c.gold : c.text, fontFamily: GEO }]}
        numberOfLines={1}
      >
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
