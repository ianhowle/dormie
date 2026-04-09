import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { GEO, SANS } from '../src/theme/fonts';
import { greenHeaderGradient } from '../src/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { haptics } from '../src/lib/haptics';
import { seasonsService } from '../src/services/seasons.service';
import { Avatar } from '../src/components/Avatar';

const STATUS_BAR_H = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 54;

// Demo players for the player list
const DEMO_PLAYERS = [
  { id: '1', name: 'McGowan' },
  { id: '2', name: 'Fletcher' },
  { id: '3', name: 'Patterson' },
  { id: '4', name: 'Sullivan' },
  { id: '5', name: 'Rodriguez' },
  { id: '6', name: 'Chen' },
  { id: '7', name: 'Taylor' },
  { id: '8', name: 'Brooks' },
];

export default function SeasonSettingsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name?: string }>();

  const [seasonName, setSeasonName] = useState(params.name ?? '');
  const [paused, setPaused] = useState(false);
  const [players, setPlayers] = useState(DEMO_PLAYERS);

  const handleRemovePlayer = (playerId: string) => {
    Alert.alert('Remove Player', 'Are you sure you want to remove this player?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          haptics.light();
          setPlayers((prev) => prev.filter((p) => p.id !== playerId));
        },
      },
    ]);
  };

  const handleDeleteSeason = () => {
    Alert.alert(
      'Delete Season',
      'This action cannot be undone. All standings, scores, and history will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            haptics.heavy();
            try {
              await seasonsService.delete(params.id);
              router.dismissAll();
            } catch {
              Alert.alert('Error', 'Failed to delete season.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <LinearGradient colors={greenHeaderGradient as unknown as string[]} style={s.header}>
        <View style={s.headerTop}>
          <Pressable onPress={() => { haptics.light(); router.back(); }} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={[s.headerTitle, { fontFamily: GEO }]}>Season Settings</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
        {/* Season Name */}
        <Text style={[s.sectionLabel, { color: c.textMuted, fontFamily: GEO }]}>SEASON NAME</Text>
        <TextInput
          value={seasonName}
          onChangeText={setSeasonName}
          style={[s.textInput, { backgroundColor: c.elevated, color: c.text, borderColor: c.border, fontFamily: SANS }]}
          placeholderTextColor={c.textMuted}
          placeholder="Season name"
        />

        {/* Players */}
        <Text style={[s.sectionLabel, { color: c.textMuted, fontFamily: GEO, marginTop: 24 }]}>
          PLAYERS ({players.length})
        </Text>
        <View style={[s.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          {players.map((player, i) => (
            <View
              key={player.id}
              style={[
                s.playerRow,
                i < players.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
              ]}
            >
              <View style={s.playerInfo}>
                <Avatar id={player.id} name={player.name} size={32} />
                <Text style={[s.playerName, { color: c.text, fontFamily: SANS }]}>{player.name}</Text>
              </View>
              <Pressable onPress={() => handleRemovePlayer(player.id)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color="#C41E3A" />
              </Pressable>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => { haptics.light(); }}
          style={({ pressed }) => [s.addPlayerBtn, { borderColor: c.border }, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="person-add-outline" size={16} color={c.teal} />
          <Text style={[s.addPlayerText, { color: c.teal, fontFamily: SANS }]}>Add Player</Text>
        </Pressable>

        {/* Pause Season */}
        <Text style={[s.sectionLabel, { color: c.textMuted, fontFamily: GEO, marginTop: 24 }]}>SEASON STATUS</Text>
        <View style={[s.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <View style={s.toggleRow}>
            <View>
              <Text style={[s.toggleLabel, { color: c.text, fontFamily: SANS }]}>Pause Season</Text>
              <Text style={[s.toggleDesc, { color: c.textMuted, fontFamily: SANS }]}>
                Temporarily halt all scoring and standings
              </Text>
            </View>
            <Switch
              value={paused}
              onValueChange={(v) => { haptics.light(); setPaused(v); }}
              trackColor={{ false: c.elevated, true: '#C9A227' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Danger Zone */}
        <Text style={[s.sectionLabel, { color: '#C41E3A', fontFamily: GEO, marginTop: 32 }]}>DANGER ZONE</Text>
        <Pressable
          onPress={handleDeleteSeason}
          style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
          <Text style={[s.deleteBtnText, { fontFamily: SANS }]}>Delete Season</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: STATUS_BAR_H + 8, paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },

  textInput: {
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },

  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
  },

  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addPlayerText: {
    fontSize: 14,
    fontWeight: '600',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C41E3A',
    paddingVertical: 14,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
