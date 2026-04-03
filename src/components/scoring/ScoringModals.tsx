import React from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { greenHeaderGradient } from '../../theme/colors';
import { Avatar } from '../Avatar';
import GoldDivider from '../GoldDivider';
import { haptics } from '../../lib/haptics';
import { sounds } from '../../lib/sounds';
import { isGIR, pName } from '../../scoring/calculations';
import { scoringStyles as st, postRoundStyles as ps } from './styles';
import type {
  PlayerConfig, HoleData, HoleScore, CompetitionTab, LinkedSeason,
  HammerState, HammerResult, WolfHoleState, BBBHolePoints,
} from '../../scoring/types';
import type { PlayerHoleResult } from '../HoleTransitionBanner';

// ─── Helper ─────────────────────────────────────────────────────────
function scoreNameColor(
  score: number,
  par: number,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): string {
  const diff = score - par;
  if (diff <= -2) return c.gold;
  if (diff === -1) return c.teal;
  if (diff === 0) return c.text;
  if (diff === 1) return c.urgent;
  return '#C41E3A';
}

function toParColor(
  diff: number,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): string {
  if (diff < 0) return c.teal;
  if (diff === 0) return c.gold;
  return c.urgent;
}

function formatToPar(total: number, par: number): string {
  const diff = total - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

// ─── Score Confirmation Screen ──────────────────────────────────────
export function ScoreConfirmation({
  players,
  holes,
  allScores,
  onEdit,
  onPost,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
  onEdit: (holeIdx: number) => void;
  onPost: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const totalPar = holes.reduce((a, h) => a + h.par, 0);
  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);

  return (
    <View style={[st.screen, { backgroundColor: c.bg }]}>
      <LinearGradient colors={[...greenHeaderGradient]} style={st.confirmHeader}>
        <View style={st.headerOverlay} />
        <Text style={[st.confirmTitle, { fontFamily: GEO }]}>CONFIRM SCORECARD</Text>
        <Text style={st.confirmSub}>Review all scores before saving</Text>
      </LinearGradient>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[ps.scRow, { backgroundColor: '#1E4D2B' }]}>
              <Text style={[ps.scCellHole, ps.scHeaderText]}>HOLE</Text>
              {holes.map((h) => (
                <Text key={h.number} style={[ps.scCell, ps.scHeaderText]}>{h.number}</Text>
              ))}
              <Text style={[ps.scCellTotal, ps.scHeaderText]}>TOT</Text>
            </View>
            <View style={[ps.scRow, { backgroundColor: c.elevated }]}>
              <Text style={[ps.scCellHole, ps.scParText, { color: c.textMuted }]}>Par</Text>
              {holes.map((h) => (
                <Text key={h.number} style={[ps.scCell, ps.scParText, { color: c.textMuted }]}>{h.par}</Text>
              ))}
              <Text style={[ps.scCellTotal, ps.scParText, { color: c.textMuted }]}>{totalPar}</Text>
            </View>
            {players.map((p, pi) => {
              const isMe = p.id === '1';
              let totalGross = 0;
              return (
                <View key={p.id} style={[ps.scRow, { backgroundColor: isMe ? `${c.teal}08` : pi % 2 === 0 ? c.cardBg : c.surface }]}>
                  <Text style={[ps.scCellHole, ps.scPlayerLabel, { color: isMe ? c.teal : c.text }]} numberOfLines={1}>
                    {isMe ? 'You' : p.name.split(' ')[0]}
                  </Text>
                  {holes.map((h) => {
                    const s = allScores.get(h.number)?.get(p.id);
                    if (!s) return <Text key={h.number} style={[ps.scCell, { color: c.textMuted }]}>-</Text>;
                    totalGross += s.gross;
                    return (
                      <Pressable key={h.number} onPress={() => onEdit(holes.findIndex((hole) => hole.number === h.number))}>
                        <Text style={[ps.scCell, { color: scoreNameColor(s.gross, h.par, c), fontFamily: GEO }]}>{s.gross}</Text>
                      </Pressable>
                    );
                  })}
                  <Text style={[ps.scCellTotal, ps.scTotalText, { color: c.text, fontFamily: GEO }]}>{totalGross || '-'}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {front.length > 0 && back.length > 0 && (
          <View style={[st.confirmTotalsRow, { borderColor: c.border }]}>
            {players.map((p) => {
              const isMe = p.id === '1';
              let frontTotal = 0, backTotal = 0, grandTotal = 0;
              front.forEach((h) => { const s = allScores.get(h.number)?.get(p.id); if (s) frontTotal += s.gross; });
              back.forEach((h) => { const s = allScores.get(h.number)?.get(p.id); if (s) backTotal += s.gross; });
              grandTotal = frontTotal + backTotal;
              return (
                <View key={p.id} style={[st.confirmPlayerTotals, { borderColor: c.border }]}>
                  <Text style={[st.confirmPlayerName, { color: isMe ? c.teal : c.text }]}>
                    {isMe ? 'You' : p.name.split(' ')[0]}
                  </Text>
                  <View style={st.confirmNineTotals}>
                    <View style={st.confirmNineItem}>
                      <Text style={[st.confirmNineLabel, { color: c.textMuted }]}>OUT</Text>
                      <Text style={[st.confirmNineValue, { color: c.text, fontFamily: GEO }]}>{frontTotal || '-'}</Text>
                    </View>
                    <View style={st.confirmNineItem}>
                      <Text style={[st.confirmNineLabel, { color: c.textMuted }]}>IN</Text>
                      <Text style={[st.confirmNineValue, { color: c.text, fontFamily: GEO }]}>{backTotal || '-'}</Text>
                    </View>
                    <View style={st.confirmNineItem}>
                      <Text style={[st.confirmNineLabel, { color: c.gold }]}>TOT</Text>
                      <Text style={[st.confirmNineValue, { color: toParColor(grandTotal - totalPar, c), fontFamily: GEO, fontWeight: '700' }]}>
                        {grandTotal || '-'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <Pressable
            onPress={() => onEdit(-1)}
            style={[st.navBtn, { backgroundColor: c.elevated, borderColor: c.border, flex: 1 }]}
          >
            <Ionicons name="chevron-back" size={18} color={c.text} />
            <Text style={[st.navBtnText, { color: c.text }]}>Edit Scores</Text>
          </Pressable>
          <Pressable
            onPress={onPost}
            style={[st.navBtn, st.navFinish, { backgroundColor: '#1E4D2B', flex: 1 }]}
          >
            <Text style={[st.navBtnText, { color: '#C9A227', fontFamily: GEO }]}>Post Score</Text>
            <Ionicons name="checkmark-circle" size={18} color="#C9A227" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Hammer Modal ───────────────────────────────────────────────────
export function HammerModal({
  visible,
  hammerState,
  players,
  onAccept,
  onFold,
}: {
  visible: boolean;
  hammerState: HammerState;
  players: PlayerConfig[];
  onAccept: () => void;
  onFold: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={st.modalOverlay}>
        <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.gold }]}>
          <Text style={[st.modalTitle, { color: c.gold, fontFamily: GEO }]}>HAMMER THROWN!</Text>
          <Text style={[st.modalText, { color: c.text }]}>
            {players.find((p) => p.id === hammerState.thrower)?.name ?? 'Player'} doubles the bet
          </Text>
          <Text style={[st.hammerMultiplierDisplay, { color: c.gold, fontFamily: GEO }]}>
            Current: {hammerState.multiplier}x
          </Text>
          <View style={st.modalBtnRow}>
            <Pressable
              onPress={onAccept}
              style={({ pressed }) => [st.modalBtn, { backgroundColor: c.teal }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
            >
              <Text style={st.modalBtnText}>Accept</Text>
            </Pressable>
            <Pressable
              onPress={onFold}
              style={({ pressed }) => [st.modalBtn, { backgroundColor: c.urgent }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}
            >
              <Text style={st.modalBtnText}>Fold</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Putt Distance Modal ────────────────────────────────────────────
export function PuttDistModal({
  visible,
  playerName,
  holeNumber,
  onSelect,
}: {
  visible: boolean;
  playerName: string;
  holeNumber: number;
  onSelect: (bucket: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={st.modalOverlay}>
        <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <Text style={[st.modalTitle, { color: c.teal, fontFamily: GEO }]}>FIRST PUTT DISTANCE</Text>
          <Text style={[st.modalText, { color: c.text }]}>
            {playerName} first putt on Hole {holeNumber}
          </Text>
          <View style={st.puttDistGrid}>
            {['Inside 5ft', '5-15ft', '15-30ft', 'Outside 30ft'].map((bucket) => (
              <Pressable
                key={bucket}
                onPress={() => onSelect(bucket)}
                style={[st.puttDistBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
              >
                <Text style={[st.puttDistBtnText, { color: c.text }]}>{bucket}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Best Ball Setup Modal ──────────────────────────────────────────
export function BestBallSetupModal({
  visible,
  players,
  teams,
  onMoveToTeam2,
  onMoveToTeam1,
  onStart,
}: {
  visible: boolean;
  players: PlayerConfig[];
  teams: { team1: string[]; team2: string[] };
  onMoveToTeam2: (pid: string) => void;
  onMoveToTeam1: (pid: string) => void;
  onStart: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={st.modalOverlay}>
        <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.teal, width: '90%' }]}>
          <Text style={[st.modalTitle, { color: c.teal, fontFamily: GEO }]}>BEST BALL TEAMS</Text>
          <Text style={[st.modalText, { color: c.textMuted }]}>Tap a player to move between teams</Text>
          <View style={st.bestBallSetupRow}>
            <View style={st.bestBallColumn}>
              <Text style={[st.bestBallColumnTitle, { color: c.teal }]}>Team 1</Text>
              {teams.team1.map((pid) => {
                const p = players.find((pl) => pl.id === pid);
                if (!p) return null;
                return (
                  <Pressable
                    key={pid}
                    onPress={() => { if (teams.team1.length > 1) onMoveToTeam2(pid); }}
                    style={[st.bestBallPlayerChip, { backgroundColor: `${c.teal}20`, borderColor: c.teal }]}
                  >
                    <Avatar id={p.id} size={22} name={p.name} />
                    <Text style={[st.bestBallPlayerName, { color: c.text }]}>{p.id === '1' ? 'You' : p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={st.bestBallColumn}>
              <Text style={[st.bestBallColumnTitle, { color: c.gold }]}>Team 2</Text>
              {teams.team2.map((pid) => {
                const p = players.find((pl) => pl.id === pid);
                if (!p) return null;
                return (
                  <Pressable
                    key={pid}
                    onPress={() => { if (teams.team2.length > 1) onMoveToTeam1(pid); }}
                    style={[st.bestBallPlayerChip, { backgroundColor: `${c.gold}20`, borderColor: c.gold }]}
                  >
                    <Avatar id={p.id} size={22} name={p.name} />
                    <Text style={[st.bestBallPlayerName, { color: c.text }]}>{p.id === '1' ? 'You' : p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Pressable
            onPress={onStart}
            style={[st.modalBtn, { backgroundColor: c.teal, marginTop: 16, alignSelf: 'center' }]}
          >
            <Text style={st.modalBtnText}>Start Round</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Hole Notes Modal ───────────────────────────────────────────────
export function HoleNotesModal({
  visible,
  holeNumber,
  noteText,
  onChangeText,
  onCancel,
  onSave,
}: {
  visible: boolean;
  holeNumber: number;
  noteText: string;
  onChangeText: (t: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={st.modalOverlay}>
        <View style={[st.modalContent, { backgroundColor: c.cardBg, borderColor: c.border }]}>
          <Text style={[st.modalTitle, { color: c.gold, fontFamily: GEO }]}>HOLE {holeNumber} NOTES</Text>
          <TextInput
            value={noteText}
            onChangeText={onChangeText}
            placeholder="Hit 3-wood off tee, pin was back-left..."
            placeholderTextColor={c.textMuted}
            multiline
            style={[st.noteInput, { color: c.text, backgroundColor: c.elevated, borderColor: c.border }]}
          />
          <View style={st.modalBtnRow}>
            <Pressable
              onPress={onCancel}
              style={[st.modalBtn, { backgroundColor: c.elevated, borderWidth: 1, borderColor: c.border }]}
            >
              <Text style={[st.modalBtnText, { color: c.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              style={[st.modalBtn, { backgroundColor: c.teal }]}
            >
              <Text style={st.modalBtnText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Live Leaderboard Overlay ───────────────────────────────────────
export function LiveLeaderboard({
  visible,
  onClose,
  courseName,
  competitionTabs,
  activeCompTab,
  setActiveCompTab,
  leaderboardData,
  allScores,
  holes,
  holesScored,
  players,
  getRunningTotal,
  matchupOpponent,
  linkedTrip,
  MOCK_GROUP_PLAYERS,
}: {
  visible: boolean;
  onClose: () => void;
  courseName: string;
  competitionTabs: CompetitionTab[];
  activeCompTab: string;
  setActiveCompTab: (tab: string) => void;
  leaderboardData: { player: PlayerConfig; total: number; par: number; count: number }[];
  allScores: Map<number, Map<string, HoleScore>>;
  holes: HoleData[];
  holesScored: number;
  players: PlayerConfig[];
  getRunningTotal: (id: string) => { total: number; par: number; count: number };
  matchupOpponent: string | null;
  linkedTrip: any;
  MOCK_GROUP_PLAYERS: any[];
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[st.leaderboardScreen, { backgroundColor: '#1E4D2B' }]}>
        <View style={st.leaderboardHeader}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[st.leaderboardTitle, { color: '#C9A227', fontFamily: GEO }]}>LIVE LEADERBOARD</Text>
            <Text style={st.leaderboardCourse}>{courseName}</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {competitionTabs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.compTabRow}>
            {competitionTabs.map((tab) => {
              const active = activeCompTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveCompTab(tab.key)}
                  style={[st.compTabPill, { backgroundColor: active ? 'rgba(201,162,39,0.12)' : 'transparent', borderBottomWidth: active ? 2 : 0, borderBottomColor: '#C9A227' }]}
                >
                  <Text style={[st.compTabPillText, { color: active ? '#C9A227' : 'rgba(255,255,255,0.45)', fontFamily: GEO }]} numberOfLines={1}>
                    {tab.label.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <GoldDivider />

        {/* Round view */}
        {(activeCompTab === 'round' || !competitionTabs.find((t) => t.key === activeCompTab)) && (
          <>
            <View style={st.broadcastHeaderRow}>
              <Text style={st.broadcastColPos}>POS</Text>
              <Text style={st.broadcastColName}>PLAYER</Text>
              <Text style={st.broadcastColThru}>THRU</Text>
              <Text style={st.broadcastColTotal}>TOTAL</Text>
              <Text style={st.broadcastColPar}>TO PAR</Text>
            </View>
            <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: 0 }}>
              {leaderboardData.map((row, i) => {
                const isMe = row.player.id === '1';
                const diff = row.total - row.par;
                return (
                  <View key={row.player.id} style={[st.lbRow, { backgroundColor: isMe ? 'rgba(0,103,71,0.15)' : i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }]}>
                    <Text style={[st.lbPos, { fontFamily: GEO }]}>{i + 1}</Text>
                    <Avatar id={row.player.id} size={28} name={row.player.name} />
                    <View style={st.lbNameWrap}>
                      <Text style={[st.lbName, isMe && { color: '#006747', fontWeight: '700' }]}>
                        {isMe ? 'You' : row.player.name}
                      </Text>
                    </View>
                    <Text style={[st.lbThru, { width: 36, textAlign: 'center' }]}>{row.count}</Text>
                    <Text style={[st.lbTotal, { fontFamily: GEO }]}>{row.total || '-'}</Text>
                    <Text style={[st.lbToPar, { color: diff < 0 ? '#006747' : diff === 0 ? '#C9A227' : '#C41E3A', fontFamily: GEO }]}>
                      {row.total > 0 ? formatToPar(row.total, row.par) : '-'}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Matchup view */}
        {activeCompTab === 'matchup' && matchupOpponent && (() => {
          const opponentPlayer = players.find((p) => p.id === matchupOpponent) ?? players.find((p) => p.id !== '1');
          const opponentName = opponentPlayer?.name ?? 'Opponent';
          const opponentId = opponentPlayer?.id ?? '2';
          let myUp = 0;
          let holesPlayed = 0;
          const holeResults: { hole: number; myScore: number | null; oppScore: number | null; result: 'win' | 'loss' | 'halve' | 'pending' }[] = [];
          holes.forEach((h) => {
            const myScore = allScores.get(h.number)?.get('1');
            const oppScore = allScores.get(h.number)?.get(opponentId);
            if (myScore && oppScore) {
              holesPlayed++;
              const diff = myScore.gross - oppScore.gross;
              if (diff < 0) myUp++;
              else if (diff > 0) myUp--;
              holeResults.push({ hole: h.number, myScore: myScore.gross, oppScore: oppScore.gross, result: diff < 0 ? 'win' : diff > 0 ? 'loss' : 'halve' });
            } else {
              holeResults.push({ hole: h.number, myScore: myScore?.gross ?? null, oppScore: oppScore?.gross ?? null, result: 'pending' });
            }
          });
          const matchStatus = myUp === 0 ? `ALL SQUARE thru ${holesPlayed}` : myUp > 0 ? `${myUp} UP thru ${holesPlayed}` : `${Math.abs(myUp)} DOWN thru ${holesPlayed}`;

          return (
            <ScrollView bounces={false} contentContainerStyle={{ padding: 16 }}>
              <View style={st.matchupHeader}>
                <View style={st.matchupPlayerCol}>
                  <Avatar id="1" size={40} name="Ian McGowan" />
                  <Text style={[st.matchupPlayerName, { fontFamily: GEO }]}>YOU</Text>
                </View>
                <View style={st.matchupVs}>
                  <Text style={[st.matchupVsText, { fontFamily: GEO }]}>VS</Text>
                </View>
                <View style={st.matchupPlayerCol}>
                  <Avatar id={opponentId} size={40} name={opponentName} />
                  <Text style={[st.matchupPlayerName, { fontFamily: GEO }]}>{opponentName.split(' ')[0].toUpperCase()}</Text>
                </View>
              </View>
              <View style={[st.matchStatusBanner, { backgroundColor: myUp > 0 ? 'rgba(0,103,71,0.15)' : myUp < 0 ? 'rgba(196,30,58,0.15)' : 'rgba(201,162,39,0.15)' }]}>
                <Text style={[st.matchStatusText, { color: myUp > 0 ? '#006747' : myUp < 0 ? '#C41E3A' : '#C9A227', fontFamily: GEO }]}>
                  {matchStatus}
                </Text>
              </View>
              <View style={st.matchupGrid}>
                <View style={st.matchupGridHeader}>
                  <Text style={[st.matchupGridCell, st.matchupGridHole]}>HOLE</Text>
                  <Text style={[st.matchupGridCell, st.matchupGridScore]}>YOU</Text>
                  <Text style={[st.matchupGridCell, st.matchupGridScore]}>{opponentName.split(' ')[0].toUpperCase()}</Text>
                  <Text style={[st.matchupGridCell, st.matchupGridResult]}>{' '}</Text>
                </View>
                {holeResults.map((hr) => (
                  <View key={hr.hole} style={[st.matchupGridRow, hr.result === 'win' && { backgroundColor: 'rgba(0,103,71,0.08)' }, hr.result === 'loss' && { backgroundColor: 'rgba(196,30,58,0.08)' }]}>
                    <Text style={[st.matchupGridCell, st.matchupGridHole, { fontFamily: GEO }]}>{hr.hole}</Text>
                    <Text style={[st.matchupGridCell, st.matchupGridScore, { fontFamily: GEO, color: hr.myScore ? '#E8E4DE' : 'rgba(255,255,255,0.3)' }]}>{hr.myScore ?? '-'}</Text>
                    <Text style={[st.matchupGridCell, st.matchupGridScore, { fontFamily: GEO, color: hr.oppScore ? '#E8E4DE' : 'rgba(255,255,255,0.3)' }]}>{hr.oppScore ?? '-'}</Text>
                    <View style={[st.matchupGridCell, st.matchupGridResult]}>
                      {hr.result === 'win' && <Ionicons name="checkmark-circle" size={14} color="#006747" />}
                      {hr.result === 'loss' && <Ionicons name="close-circle" size={14} color="#C41E3A" />}
                      {hr.result === 'halve' && <Text style={{ color: '#C9A227', fontSize: 10, fontFamily: GEO }}>AS</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          );
        })()}
      </View>
    </Modal>
  );
}
