import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import type { PlayerConfig, BBBHolePoints, MomentType } from '../../scoring/types';
import { scoringStyles as st } from './styles';

export const BBBPrompt = memo(function BBBPrompt({
  bangoHoleNumber,
  players,
  bbbHolePoints,
  onSelect,
  onSkip,
  onTripleCrown,
}: {
  bangoHoleNumber: number;
  players: PlayerConfig[];
  bbbHolePoints: Map<number, BBBHolePoints>;
  onSelect: (holeNumber: number, playerId: string) => void;
  onSkip: () => void;
  onTripleCrown: (playerName: string, holeNumber: number) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={st.modalOverlay}>
      <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.gold }]}>
        <Ionicons name="flag" size={28} color={c.gold} style={{ alignSelf: 'center', marginBottom: 8 }} />
        <Text style={[st.modalTitle, { color: c.gold, fontFamily: GEO }]} maxFontSizeMultiplier={1.3}>BANGO — HOLE {bangoHoleNumber}</Text>
        <Text style={[st.modalText, { color: c.text, textAlign: 'center', marginBottom: 16 }]} maxFontSizeMultiplier={1.3}>
          Who was closest to the pin?
        </Text>
        <View style={{ gap: 10 }}>
          {players.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                onSelect(bangoHoleNumber, p.id);
                haptics.light();

                // Check BBB Triple Crown
                const hp = bbbHolePoints.get(bangoHoleNumber);
                if (hp && hp.bingo === p.id && hp.bongo === p.id) {
                  haptics.heavy();
                  sounds.chime();
                  onTripleCrown(p.id === '1' ? 'You' : p.name, bangoHoleNumber);
                }
              }}
              accessibilityLabel={`${p.id === '1' ? 'You were' : `${p.name.split(' ')[0]} was`} closest to the pin`}
              accessibilityRole="button"
              style={({ pressed }) => [st.modalBtn, { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border }, pressed && { opacity: 0.7 }]}
            >
              <Text style={[st.modalBtnText, { color: c.text }]} maxFontSizeMultiplier={1.3}>
                {p.id === '1' ? 'You' : p.name.split(' ')[0]}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onSkip}
            accessibilityLabel="Skip closest to pin selection"
            accessibilityRole="button"
            style={({ pressed }) => [{ paddingVertical: 8, alignItems: 'center' } as any, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ color: c.textMuted, fontSize: 13 }} maxFontSizeMultiplier={1.3}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});
