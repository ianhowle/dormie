import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { haptics } from '../lib/haptics';
import { GEO } from '../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../theme/colors';
import { Avatar } from './Avatar';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────
export type RCPlayer = {
  id: string;
  name: string;
  handicap: number;
  avatarColor: string;
};

export type Pairing = {
  id: string;
  player1Id: string | null;
  player2Id: string | null;
  format: string;
  sessionIndex: number;
};

export type CaptainsPairingsProps = {
  teamRed: RCPlayer[];
  teamBlue: RCPlayer[];
  teamRedName: string;
  teamBlueName: string;
  pairings: Pairing[];
  onPairingsChange: (pairings: Pairing[]) => void;
  isCaptain: boolean;
};

// ─── Handicap suggestion ──────────────────────────────────────────────
function suggestOptimalPairings(
  team: RCPlayer[],
  slotsNeeded: number,
): string[][] {
  // Simple strategy: pair strongest with weakest
  const sorted = [...team].sort((a, b) => a.handicap - b.handicap);
  const pairs: string[][] = [];
  const used = new Set<string>();

  for (let i = 0; i < Math.min(slotsNeeded, Math.floor(sorted.length / 2)); i++) {
    const strong = sorted[i];
    const weak = sorted[sorted.length - 1 - i];
    if (strong && weak && strong.id !== weak.id && !used.has(strong.id) && !used.has(weak.id)) {
      pairs.push([strong.id, weak.id]);
      used.add(strong.id);
      used.add(weak.id);
    }
  }

  return pairs;
}

// ─── Player Card ──────────────────────────────────────────────────────
function PlayerCard({
  player,
  isAssigned,
  teamColor,
  onTap,
  compact,
}: {
  player: RCPlayer;
  isAssigned: boolean;
  teamColor: string;
  onTap: () => void;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Pressable
      onPress={onTap}
      style={[
        compact ? styles.playerCardCompact : styles.playerCard,
        {
          backgroundColor: isAssigned ? teamColor + '12' : c.elevated,
          borderColor: isAssigned ? teamColor : c.border,
          borderWidth: 1,
          opacity: isAssigned ? 0.5 : 1,
        },
      ]}
    >
      <Avatar id={player.id} name={player.name} size={compact ? 28 : 32} />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            compact ? styles.playerNameCompact : styles.playerName,
            { color: isAssigned ? c.textMuted : c.text },
          ]}
          numberOfLines={1}
        >
          {player.name}
        </Text>
        <Text style={[styles.playerHcp, { color: c.textMuted }]}>{player.handicap} hcp</Text>
      </View>
      {!isAssigned && (
        <Ionicons name="add-circle" size={20} color={teamColor} />
      )}
    </Pressable>
  );
}

// ─── Pairing Slot ─────────────────────────────────────────────────────
function PairingSlot({
  pairing,
  allPlayers,
  teamColor,
  teamName,
  onRemove,
}: {
  pairing: Pairing;
  allPlayers: RCPlayer[];
  teamColor: string;
  teamName: string;
  onRemove: (pairingId: string, slot: 1 | 2) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const p1 = allPlayers.find((p) => p.id === pairing.player1Id);
  const p2 = allPlayers.find((p) => p.id === pairing.player2Id);

  const renderSlot = (player: RCPlayer | undefined, slot: 1 | 2) => {
    if (!player) {
      return (
        <View style={[styles.emptySlot, { borderColor: teamColor + '44' }]}>
          <Ionicons name="person-add" size={16} color={teamColor + '66'} />
          <Text style={[styles.emptySlotText, { color: teamColor + '66' }]}>Tap player to assign</Text>
        </View>
      );
    }

    return (
      <Pressable
        onPress={() => onRemove(pairing.id, slot)}
        style={[styles.assignedSlot, { backgroundColor: teamColor + '12' }]}
      >
        <Avatar id={player.id} name={player.name} size={24} />
        <Text style={[styles.assignedName, { color: c.text }]} numberOfLines={1}>
          {player.name}
        </Text>
        <Text style={[styles.assignedHcp, { color: c.textMuted, fontFamily: GEO }]}>
          {player.handicap}
        </Text>
        <Ionicons name="close-circle" size={16} color={c.urgent + '88'} />
      </Pressable>
    );
  };

  const combinedHcp = (p1 && p2)
    ? ((p1.handicap + p2.handicap) / 2).toFixed(1)
    : null;

  return (
    <View style={[styles.pairingSlot, { backgroundColor: c.cardBg }]}>
      <View style={styles.pairingHeader}>
        <Text style={[styles.pairingFormat, { color: c.textMuted }]}>
          {pairing.format}
        </Text>
        {combinedHcp && (
          <Text style={[styles.pairingAvg, { color: teamColor, fontFamily: GEO }]}>
            Avg {combinedHcp}
          </Text>
        )}
      </View>
      <View style={styles.pairingSlots}>
        {renderSlot(p1, 1)}
        {renderSlot(p2, 2)}
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export function CaptainsPairings({
  teamRed,
  teamBlue,
  teamRedName,
  teamBlueName,
  pairings,
  onPairingsChange,
  isCaptain,
}: CaptainsPairingsProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [activeTeam, setActiveTeam] = useState<'red' | 'blue'>('red');
  const [selectedPairingId, setSelectedPairingId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<1 | 2 | null>(null);

  const teamColor = activeTeam === 'red' ? c.urgent : '#4169E1';
  const teamName = activeTeam === 'red' ? teamRedName : teamBlueName;
  const teamPlayers = activeTeam === 'red' ? teamRed : teamBlue;
  const allPlayers = [...teamRed, ...teamBlue];

  // Track which players are already assigned
  const assignedIds = useMemo(() => {
    const ids = new Set<string>();
    pairings.forEach((p) => {
      if (p.player1Id) ids.add(p.player1Id);
      if (p.player2Id) ids.add(p.player2Id);
    });
    return ids;
  }, [pairings]);

  const teamPairings = pairings.filter((p) => {
    const p1 = allPlayers.find((pl) => pl.id === p.player1Id);
    const p2 = allPlayers.find((pl) => pl.id === p.player2Id);
    const teamPlayerIds = new Set(teamPlayers.map((tp) => tp.id));
    return (
      (p.player1Id === null || teamPlayerIds.has(p.player1Id)) &&
      (p.player2Id === null || teamPlayerIds.has(p.player2Id))
    );
  });

  const handlePlayerTap = useCallback((playerId: string) => {
    if (!isCaptain) return;
    if (assignedIds.has(playerId)) return;
    haptics.light();

    // Find first empty slot
    for (const p of teamPairings) {
      if (!p.player1Id) {
        onPairingsChange(
          pairings.map((pr) => (pr.id === p.id ? { ...pr, player1Id: playerId } : pr))
        );
        return;
      }
      if (!p.player2Id) {
        onPairingsChange(
          pairings.map((pr) => (pr.id === p.id ? { ...pr, player2Id: playerId } : pr))
        );
        return;
      }
    }
  }, [isCaptain, assignedIds, teamPairings, pairings, onPairingsChange]);

  const handleRemove = useCallback((pairingId: string, slot: 1 | 2) => {
    if (!isCaptain) return;
    onPairingsChange(
      pairings.map((p) => {
        if (p.id !== pairingId) return p;
        return slot === 1 ? { ...p, player1Id: null } : { ...p, player2Id: null };
      })
    );
  }, [isCaptain, pairings, onPairingsChange]);

  const handleSuggest = useCallback(() => {
    haptics.light();
    const slotsNeeded = teamPairings.length;
    const suggestions = suggestOptimalPairings(teamPlayers, slotsNeeded);

    const updated = pairings.map((p, i) => {
      const teamPairingIdx = teamPairings.indexOf(p);
      if (teamPairingIdx < 0 || teamPairingIdx >= suggestions.length) return p;
      return {
        ...p,
        player1Id: suggestions[teamPairingIdx][0] ?? null,
        player2Id: suggestions[teamPairingIdx][1] ?? null,
      };
    });

    onPairingsChange(updated);
  }, [teamPlayers, teamPairings, pairings, onPairingsChange]);

  return (
    <View style={styles.container}>
      {/* Team toggle */}
      <View style={[styles.teamToggle, { backgroundColor: c.elevated }]}>
        <Pressable
          onPress={() => setActiveTeam('red')}
          style={[
            styles.teamToggleBtn,
            activeTeam === 'red' && { backgroundColor: c.urgent + '22' },
          ]}
        >
          <View style={[styles.teamDot, { backgroundColor: c.urgent }]} />
          <Text style={[styles.teamToggleText, { color: activeTeam === 'red' ? c.urgent : c.textMuted }]}>
            {teamRedName}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTeam('blue')}
          style={[
            styles.teamToggleBtn,
            activeTeam === 'blue' && { backgroundColor: '#4169E122' },
          ]}
        >
          <View style={[styles.teamDot, { backgroundColor: '#4169E1' }]} />
          <Text style={[styles.teamToggleText, { color: activeTeam === 'blue' ? '#4169E1' : c.textMuted }]}>
            {teamBlueName}
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Pairings */}
        <Text style={[styles.sectionLabel, { color: c.gold }]}>PAIRINGS</Text>
        {teamPairings.map((p) => (
          <PairingSlot
            key={p.id}
            pairing={p}
            allPlayers={allPlayers}
            teamColor={teamColor}
            teamName={teamName}
            onRemove={handleRemove}
          />
        ))}

        {/* Suggest button */}
        {isCaptain && (
          <Pressable onPress={handleSuggest} style={[styles.suggestBtn, { backgroundColor: teamColor + '15' }]}>
            <Ionicons name="bulb" size={18} color={teamColor} />
            <Text style={[styles.suggestText, { color: teamColor }]}>Suggest Optimal Pairings</Text>
          </Pressable>
        )}

        {/* Available players */}
        <Text style={[styles.sectionLabel, { color: c.gold, marginTop: 20 }]}>AVAILABLE PLAYERS</Text>
        {teamPlayers.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            isAssigned={assignedIds.has(p.id)}
            teamColor={teamColor}
            onTap={() => handlePlayerTap(p.id)}
            compact
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Team toggle
  teamToggle: { flexDirection: 'row', padding: 4, marginBottom: 16 },
  teamToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  teamToggleText: { fontSize: 13, fontWeight: '600' },
  teamDot: { width: 8, height: 8, borderRadius: 0 },

  sectionLabel: { fontSize: 10, fontWeight: '600', marginBottom: 8, letterSpacing: 2, textTransform: 'uppercase' },

  // Pairing slot
  pairingSlot: { padding: 14, marginBottom: 8 },
  pairingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pairingFormat: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  pairingAvg: { fontSize: 13 },
  pairingSlots: { gap: 6 },
  emptySlot: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderStyle: 'dashed' },
  emptySlotText: { fontSize: 13 },
  assignedSlot: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  assignedName: { flex: 1, fontSize: 14, fontWeight: '500' },
  assignedHcp: { fontSize: 13 },

  // Player card
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: 6 },
  playerCardCompact: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginBottom: 4 },
  playerName: { fontSize: 13, fontWeight: '600' },
  playerNameCompact: { fontSize: 13, fontWeight: '500' },
  playerHcp: { fontSize: 11, marginTop: 1 },

  // Suggest
  suggestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8, marginTop: 8 },
  suggestText: { fontSize: 13, fontWeight: '600' },
});
