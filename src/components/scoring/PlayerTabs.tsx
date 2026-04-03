import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { scoringStyles as st } from './styles';

export function PlayerTabs({
  players,
  soloPlayerIdx,
  onSoloPlayerChange,
}: {
  players: { id: string; name: string }[];
  soloPlayerIdx: number;
  onSoloPlayerChange: (idx: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={st.soloNavRow}>
      <Pressable
        onPress={() => onSoloPlayerChange(Math.max(0, soloPlayerIdx - 1))}
        disabled={soloPlayerIdx === 0}
        style={{ opacity: soloPlayerIdx === 0 ? 0.3 : 1 }}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={20} color={c.text} />
      </Pressable>
      <Text style={[st.soloNavText, { color: c.text }]}>
        {players[soloPlayerIdx].id === '1' ? 'You' : players[soloPlayerIdx].name} ({soloPlayerIdx + 1}/{players.length})
      </Text>
      <Pressable
        onPress={() => onSoloPlayerChange(Math.min(players.length - 1, soloPlayerIdx + 1))}
        disabled={soloPlayerIdx === players.length - 1}
        style={{ opacity: soloPlayerIdx === players.length - 1 ? 0.3 : 1 }}
        hitSlop={12}
      >
        <Ionicons name="chevron-forward" size={20} color={c.text} />
      </Pressable>
    </View>
  );
}
