import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import {
  createDefaultTeams,
  createInitialConfig,
  DEFAULT_TEAM_COLORS,
  type FourTeamRyderConfig,
  type FourTeamRyderScheduleMode,
  type FourTeamRyderTeam,
} from '../../services/fourTeamRyder.service';

type Props = {
  initialPlayerIds?: string[];
  availablePlayers?: { id: string; name: string }[];
  onComplete: (config: FourTeamRyderConfig) => void;
  onCancel?: () => void;
};

export function FourTeamRyderSetup({ availablePlayers = [], onComplete, onCancel }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [teams, setTeams] = useState<FourTeamRyderTeam[]>(createDefaultTeams);
  const [scheduleMode, setScheduleMode] = useState<FourTeamRyderScheduleMode>('three_round');

  const updateTeam = (idx: number, patch: Partial<FourTeamRyderTeam>) => {
    setTeams((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const assignPlayer = (pid: string, teamIdx: number) => {
    setTeams((prev) =>
      prev.map((t, i) => ({
        ...t,
        playerIds: i === teamIdx
          ? (t.playerIds.includes(pid) ? t.playerIds : [...t.playerIds, pid])
          : t.playerIds.filter((p) => p !== pid),
      })),
    );
  };

  const canStart = teams.every((t) => t.name.trim().length > 0);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.gold, fontFamily: GEO }]}>4-TEAM RYDER CUP</Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        Round-robin across 4 teams — 6 matchups, 3 rounds.
      </Text>

      <Text style={[styles.sectionLabel, { color: c.text, fontFamily: GEO }]}>TEAMS</Text>
      {teams.map((team, idx) => (
        <View key={team.id} style={[styles.teamCard, { borderColor: team.color, backgroundColor: `${team.color}10` }]}>
          <View style={styles.teamRow}>
            <View style={[styles.colorSwatch, { backgroundColor: team.color }]} />
            <TextInput
              value={team.name}
              onChangeText={(v) => updateTeam(idx, { name: v })}
              style={[styles.teamName, { color: c.text, borderColor: c.border }]}
              placeholder={`Team ${idx + 1}`}
              placeholderTextColor={c.textMuted}
            />
          </View>

          <View style={styles.colorRow}>
            {DEFAULT_TEAM_COLORS.map((col) => (
              <Pressable
                key={col}
                onPress={() => updateTeam(idx, { color: col })}
                style={[
                  styles.colorDot,
                  { backgroundColor: col, borderColor: team.color === col ? '#FFF' : 'transparent' },
                ]}
              />
            ))}
          </View>

          {availablePlayers.length > 0 && (
            <View style={styles.playersList}>
              {availablePlayers.map((p) => {
                const assignedTeamIdx = teams.findIndex((t) => t.playerIds.includes(p.id));
                const mine = assignedTeamIdx === idx;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => assignPlayer(p.id, idx)}
                    style={[
                      styles.playerChip,
                      {
                        borderColor: mine ? team.color : c.border,
                        backgroundColor: mine ? `${team.color}30` : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: mine ? team.color : c.textMuted, fontSize: 12 }}>
                      {p.name}
                      {assignedTeamIdx >= 0 && !mine ? ` · ${teams[assignedTeamIdx].name}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ))}

      <Text style={[styles.sectionLabel, { color: c.text, fontFamily: GEO, marginTop: 16 }]}>SCHEDULE</Text>
      <View style={styles.modeRow}>
        {(['three_round', 'single_round'] as FourTeamRyderScheduleMode[]).map((m) => {
          const active = scheduleMode === m;
          return (
            <Pressable
              key={m}
              onPress={() => setScheduleMode(m)}
              style={[
                styles.modeBtn,
                { borderColor: active ? c.gold : c.border, backgroundColor: active ? `${c.gold}18` : 'transparent' },
              ]}
            >
              <Text style={{ color: active ? c.gold : c.text, fontWeight: '600', fontSize: 13 }}>
                {m === 'three_round' ? '3 Rounds' : 'Single Round (6-6-6)'}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>
                {m === 'three_round' ? 'Three separate 18-hole days' : 'Rotate pairings every 6 holes'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        {onCancel && (
          <Pressable onPress={onCancel} style={[styles.actionBtn, { borderColor: c.border }]}>
            <Text style={{ color: c.text }}>Cancel</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => onComplete(createInitialConfig(teams, scheduleMode))}
          disabled={!canStart}
          style={[styles.actionBtn, { backgroundColor: canStart ? c.gold : c.border, flex: 1 }]}
        >
          <Text style={{ color: canStart ? '#000' : c.textMuted, fontWeight: '700' }}>Build Schedule</Text>
          <Ionicons name="arrow-forward" size={14} color={canStart ? '#000' : c.textMuted} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, letterSpacing: 2, textAlign: 'center' },
  subtitle: { fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  sectionLabel: { fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  teamCard: { padding: 12, borderWidth: 1, marginBottom: 10 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorSwatch: { width: 20, height: 20 },
  teamName: { flex: 1, borderBottomWidth: 1, paddingVertical: 6, fontSize: 15 },
  colorRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  colorDot: { width: 22, height: 22, borderWidth: 2 },
  playersList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  playerChip: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  modeRow: { gap: 8 },
  modeBtn: { padding: 12, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 24 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1,
  },
});
