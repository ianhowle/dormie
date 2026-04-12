import { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { FourTeamRyderSetup } from './FourTeamRyderSetup';
import { FourTeamRyderStandings } from './FourTeamRyderStandings';
import { FourTeamRyderMatch } from './FourTeamRyderMatch';
import { DormieMoment, type MomentType } from '../DormieMoment';
import {
  checkCupClinched,
  evaluateMatch,
  pointsForMatch,
  type FourTeamRyderConfig,
} from '../../services/fourTeamRyder.service';

type Tab = 'dashboard' | 'bracket' | 'standings';

export function FourTeamRyderHub({
  initialConfig,
  availablePlayers = [],
  onConfigChange,
}: {
  initialConfig?: FourTeamRyderConfig;
  availablePlayers?: { id: string; name: string }[];
  onConfigChange?: (config: FourTeamRyderConfig) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [config, setConfig] = useState<FourTeamRyderConfig | null>(initialConfig ?? null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [moment, setMoment] = useState<{ visible: boolean; type: MomentType; playerName: string; detail: string }>({
    visible: false, type: 'CUP_CLINCHED', playerName: '', detail: '',
  });
  const [clinchedTeamId, setClinchedTeamId] = useState<string | null>(null);

  const persistConfig = useCallback((next: FourTeamRyderConfig) => {
    setConfig(next);
    onConfigChange?.(next);
  }, [onConfigChange]);

  const handleHoleUpdate = useCallback((matchId: string, holeIdx: number, winner: 'team1' | 'team2' | 'halved') => {
    setConfig((prev) => {
      if (!prev) return prev;
      const results = { ...prev.results };
      const existing = results[matchId] ?? { team1Points: 0, team2Points: 0, holeResults: {}, status: 'pending' as const, matchWinner: null };
      const nextHoles = { ...existing.holeResults, [holeIdx]: { winner } };
      const evalRes = evaluateMatch(nextHoles, 18);
      const pts = pointsForMatch(evalRes.matchWinner);
      results[matchId] = {
        ...existing,
        holeResults: nextHoles,
        status: evalRes.status,
        matchWinner: evalRes.matchWinner,
        team1Points: pts.team1,
        team2Points: pts.team2,
      };
      const nextConfig = { ...prev, results };

      // Match-closed + Cup clinched detection
      if (evalRes.status === 'complete' && existing.status !== 'complete') {
        if (evalRes.matchWinner && evalRes.matchWinner !== 'halved' && evalRes.margin) {
          setMoment({ visible: true, type: 'MATCH_CLOSED', playerName: 'Match Closed', detail: evalRes.margin });
        }
        const clinched = checkCupClinched(nextConfig);
        if (clinched && clinchedTeamId !== clinched.id) {
          setClinchedTeamId(clinched.id);
          setTimeout(() => {
            setMoment({ visible: true, type: 'CUP_CLINCHED', playerName: clinched.name, detail: 'Champions.' });
          }, 400);
        }
      }

      onConfigChange?.(nextConfig);
      return nextConfig;
    });
  }, [clinchedTeamId, onConfigChange]);

  const activeRound = useMemo(() => {
    if (!config) return null;
    for (const round of config.schedule) {
      const allComplete = round.matches.every((m) => config.results[m.matchId]?.status === 'complete');
      if (!allComplete) return round;
    }
    return config.schedule[config.schedule.length - 1] ?? null;
  }, [config]);

  if (!config) {
    return (
      <FourTeamRyderSetup
        availablePlayers={availablePlayers}
        onComplete={persistConfig}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <View style={styles.tabBar}>
        {(['dashboard', 'bracket', 'standings'] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, active && { borderBottomColor: c.gold }]}>
              <Text style={[styles.tabText, { color: active ? c.gold : c.textMuted, fontFamily: GEO }]}>
                {t.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'dashboard' && (
          <>
            <FourTeamRyderStandings config={config} compact />
            {activeRound && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
                  {activeRound.label.toUpperCase()}
                </Text>
                {activeRound.matches.map((m) => (
                  <FourTeamRyderMatch
                    key={m.matchId}
                    match={m}
                    config={config}
                    onUpdateHole={(holeIdx, winner) => handleHoleUpdate(m.matchId, holeIdx, winner)}
                  />
                ))}
              </View>
            )}
            {clinchedTeamId && (
              <View style={[styles.clinchBanner, { borderColor: c.gold, backgroundColor: `${c.gold}12` }]}>
                <Ionicons name="trophy" size={18} color={c.gold} />
                <Text style={[styles.clinchText, { color: c.gold, fontFamily: GEO }]}>
                  {config.teams.find((t) => t.id === clinchedTeamId)?.name} clinches the Cup
                </Text>
              </View>
            )}
          </>
        )}

        {tab === 'bracket' && (
          <>
            {config.schedule.map((round) => (
              <View key={round.roundIdx} style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionTitle, { color: c.gold, fontFamily: GEO }]}>
                  {round.label.toUpperCase()}
                </Text>
                {round.matches.map((m) => (
                  <FourTeamRyderMatch
                    key={m.matchId}
                    match={m}
                    config={config}
                    compact
                    onUpdateHole={(holeIdx, winner) => handleHoleUpdate(m.matchId, holeIdx, winner)}
                  />
                ))}
              </View>
            ))}
          </>
        )}

        {tab === 'standings' && <FourTeamRyderStandings config={config} />}
      </ScrollView>

      <DormieMoment
        visible={moment.visible}
        type={moment.type}
        playerName={moment.playerName}
        detail={moment.detail}
        onDismiss={() => setMoment((m) => ({ ...m, visible: false }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#444' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 11, letterSpacing: 2 },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, letterSpacing: 2, marginBottom: 10 },
  clinchBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 12, borderWidth: 1, marginTop: 16,
  },
  clinchText: { fontSize: 13, letterSpacing: 1 },
});
