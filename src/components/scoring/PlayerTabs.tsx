import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { scoringStyles as st } from './styles';

export const PlayerTabs = memo(function PlayerTabs({
  players,
  soloPlayerIdx,
  onSoloPlayerChange,
  runningToPar,
  holesPlayed,
}: {
  players: { id: string; name: string }[];
  soloPlayerIdx: number;
  onSoloPlayerChange: (idx: number) => void;
  runningToPar?: number;
  holesPlayed?: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const prevIdx = Math.max(0, soloPlayerIdx - 1);
  const nextIdx = Math.min(players.length - 1, soloPlayerIdx + 1);
  const prevPlayer = players[prevIdx];
  const nextPlayer = players[nextIdx];

  return (
    <View style={st.soloNavRow} accessibilityRole="tablist">
      <Pressable
        onPress={() => onSoloPlayerChange(prevIdx)}
        disabled={soloPlayerIdx === 0}
        accessibilityLabel={soloPlayerIdx === 0 ? 'No previous player' : `Switch to ${prevPlayer.id === '1' ? 'You' : prevPlayer.name}`}
        accessibilityRole="tab"
        style={{ opacity: soloPlayerIdx === 0 ? 0.3 : 1 }}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={20} color={c.text} />
      </Pressable>
      <Text
        style={[st.soloNavText, { color: c.text }]}
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
        accessibilityLabel={
          `${players[soloPlayerIdx].id === '1' ? 'You' : players[soloPlayerIdx].name}` +
          (runningToPar != null && holesPlayed != null
            ? `, ${runningToPar === 0 ? 'even par' : runningToPar > 0 ? `${runningToPar} over par` : `${Math.abs(runningToPar)} under par`} through ${holesPlayed}`
            : '') +
          `, ${soloPlayerIdx + 1} of ${players.length}`
        }
      >
        {players[soloPlayerIdx].id === '1' ? 'You' : players[soloPlayerIdx].name} ({soloPlayerIdx + 1}/{players.length})
      </Text>
      <Pressable
        onPress={() => onSoloPlayerChange(nextIdx)}
        disabled={soloPlayerIdx === players.length - 1}
        accessibilityLabel={soloPlayerIdx === players.length - 1 ? 'No next player' : `Switch to ${nextPlayer.id === '1' ? 'You' : nextPlayer.name}`}
        accessibilityRole="tab"
        style={{ opacity: soloPlayerIdx === players.length - 1 ? 0.3 : 1 }}
        hitSlop={12}
      >
        <Ionicons name="chevron-forward" size={20} color={c.text} />
      </Pressable>
    </View>
  );
});
