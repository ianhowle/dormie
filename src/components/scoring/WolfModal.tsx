import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { haptics } from '../../lib/haptics';
import type { PlayerConfig, HoleData, WolfHoleState } from '../../scoring/types';
import { pName } from '../../scoring/calculations';
import { scoringStyles as st } from './styles';

export function WolfModal({
  currentWolfId,
  players,
  currentHole,
  wolfPickStep,
  setWolfPickStep,
  onDecision,
  onClose,
}: {
  currentWolfId: string | null;
  players: PlayerConfig[];
  currentHole: HoleData;
  wolfPickStep: 'choose' | 'partner';
  setWolfPickStep: (step: 'choose' | 'partner') => void;
  onDecision: (decision: WolfHoleState) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const wolfPlayer = currentWolfId ? players.find((p) => p.id === currentWolfId) : null;
  const wolfName = wolfPlayer ? (wolfPlayer.id === '1' ? 'You' : wolfPlayer.name.split(' ')[0]) : 'Wolf';

  return (
    <View style={st.modalOverlay}>
      <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.gold }]}>
        <Ionicons name="paw" size={28} color={c.gold} style={{ alignSelf: 'center', marginBottom: 8 }} />
        <Text style={[st.modalTitle, { color: c.gold, fontFamily: GEO }]}>WOLF — HOLE {currentHole.number}</Text>
        <Text style={[st.modalText, { color: c.text, textAlign: 'center', marginBottom: 16 }]}>
          {wolfName} {wolfPlayer?.id === '1' ? 'are' : 'is'} the Wolf
        </Text>

        {wolfPickStep === 'choose' && (
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => setWolfPickStep('partner')}
              style={({ pressed }) => [st.modalBtn, { backgroundColor: c.teal }, pressed && { opacity: 0.7 }]}
            >
              <Text style={st.modalBtnText}>Pick a Partner</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (currentWolfId) {
                  onDecision({ wolfPlayerId: currentWolfId, decision: 'lone', partnerId: null });
                }
                onClose();
                haptics.medium();
              }}
              style={({ pressed }) => [st.modalBtn, { backgroundColor: c.urgent }, pressed && { opacity: 0.7 }]}
            >
              <Text style={st.modalBtnText}>Lone Wolf (3x risk)</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (currentWolfId) {
                  onDecision({ wolfPlayerId: currentWolfId, decision: 'blind', partnerId: null });
                }
                onClose();
                haptics.heavy();
              }}
              style={({ pressed }) => [st.modalBtn, { backgroundColor: '#1A1A2A', borderWidth: 1, borderColor: c.gold }, pressed && { opacity: 0.7 }]}
            >
              <Text style={[st.modalBtnText, { color: c.gold }]}>Blind Wolf (4x risk)</Text>
            </Pressable>
          </View>
        )}

        {wolfPickStep === 'partner' && (
          <View style={{ gap: 10 }}>
            <Text style={[st.modalText, { color: c.textMuted, fontSize: 12, marginBottom: 4 }]}>Choose your partner:</Text>
            {players.filter((p) => p.id !== currentWolfId).map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  if (currentWolfId) {
                    onDecision({ wolfPlayerId: currentWolfId, decision: 'partner', partnerId: p.id });
                  }
                  onClose();
                  haptics.light();
                }}
                style={({ pressed }) => [st.modalBtn, { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border }, pressed && { opacity: 0.7 }]}
              >
                <Text style={[st.modalBtnText, { color: c.text }]}>
                  {p.id === '1' ? 'You' : p.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setWolfPickStep('choose')}
              style={({ pressed }) => [{ paddingVertical: 8, alignItems: 'center' } as any, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ color: c.textMuted, fontSize: 13 }}>Back</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
