import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { tickerShadowDark, tickerShadowLight } from '../../theme/colors';
import type { PlayerConfig, HoleData, HoleScore, WolfHoleState, BBBHolePoints } from '../../scoring/types';
import { pName, SIDE_GAME_DISPLAY, computeWolfPoints } from '../../scoring/calculations';
import { scoringStyles as st } from './styles';

// ─── Running panels ─────────────────────────────────────────────────
export const RunningSkinsPanel = memo(function RunningSkinsPanel({
  players, holes, allScores, currentHoleNumber,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
  currentHoleNumber: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const skinWins = new Map<string, number>();
  players.forEach((p) => skinWins.set(p.id, 0));
  let carryover = 0;

  holes.forEach((h) => {
    if (h.number > currentHoleNumber) return;
    const holeScores = allScores.get(h.number);
    if (!holeScores || holeScores.size < players.length) { carryover++; return; }
    let best = Infinity;
    let winners: string[] = [];
    holeScores.forEach((s, pid) => {
      if (s.gross < best) { best = s.gross; winners = [pid]; }
      else if (s.gross === best) winners.push(pid);
    });
    if (winners.length === 1) {
      skinWins.set(winners[0], (skinWins.get(winners[0]) ?? 0) + 1 + carryover);
      carryover = 0;
    } else { carryover++; }
  });

  return (
    <View style={st.runningGameSection}>
      <Text maxFontSizeMultiplier={1.3} style={[st.runningGameTitle, { color: c.gold, fontFamily: GEO }]}>SKINS</Text>
      {players.map((p) => (
        <View key={p.id} style={st.runningGameRow}>
          <Text maxFontSizeMultiplier={1.3} style={[st.runningGameName, { color: p.id === '1' ? c.teal : c.text }]}>
            {p.id === '1' ? 'You' : p.name.split(' ')[0]}
          </Text>
          <Text maxFontSizeMultiplier={1.3} style={[st.runningGameValue, { color: c.text, fontFamily: GEO }]}>
            {skinWins.get(p.id) ?? 0} skins
          </Text>
        </View>
      ))}
      {carryover > 0 && (
        <Text maxFontSizeMultiplier={1.3} style={[st.runningGameNote, { color: c.textMuted }]}>
          {carryover} carried over
        </Text>
      )}
    </View>
  );
});

export const RunningDotsPanel = memo(function RunningDotsPanel({
  players, holes, allScores,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const dots = new Map<string, number>();
  players.forEach((p) => dots.set(p.id, 0));

  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    holeScores.forEach((s, pid) => {
      const diff = s.gross - h.par;
      let pts = 0;
      if (diff <= -2) pts = 2;
      else if (diff === -1) pts = 1;
      else if (diff >= 2) pts = -1;
      dots.set(pid, (dots.get(pid) ?? 0) + pts);
    });
  });

  return (
    <View style={st.runningGameSection}>
      <Text maxFontSizeMultiplier={1.3} style={[st.runningGameTitle, { color: c.gold, fontFamily: GEO }]}>DOTS</Text>
      {players.map((p) => {
        const val = dots.get(p.id) ?? 0;
        return (
          <View key={p.id} style={st.runningGameRow}>
            <Text maxFontSizeMultiplier={1.3} style={[st.runningGameName, { color: p.id === '1' ? c.teal : c.text }]}>
              {p.id === '1' ? 'You' : p.name.split(' ')[0]}
            </Text>
            <Text maxFontSizeMultiplier={1.3} style={[st.runningGameValue, { color: val >= 0 ? c.teal : c.urgent, fontFamily: GEO }]}>
              {val >= 0 ? '+' : ''}{val}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

export const RunningNassauPanel = memo(function RunningNassauPanel({
  players, holes, allScores,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  function segmentLeader(segHoles: HoleData[]): string {
    let best = Infinity;
    let leader = '';
    players.forEach((p) => {
      let total = 0;
      segHoles.forEach((h) => {
        const s = allScores.get(h.number)?.get(p.id);
        if (s) total += s.gross;
      });
      if (total > 0 && total < best) { best = total; leader = p.id; }
    });
    const lp = players.find((p) => p.id === leader);
    return lp ? pName(lp) : 'Tied';
  }

  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);

  return (
    <View style={st.runningGameSection}>
      <Text maxFontSizeMultiplier={1.3} style={[st.runningGameTitle, { color: c.gold, fontFamily: GEO }]}>NASSAU</Text>
      {front.length > 0 && (
        <View style={st.runningGameRow}>
          <Text maxFontSizeMultiplier={1.3} style={[st.runningGameName, { color: c.textMuted }]}>Front 9</Text>
          <Text maxFontSizeMultiplier={1.3} style={[st.runningGameValue, { color: c.text }]}>{segmentLeader(front)}</Text>
        </View>
      )}
      {back.length > 0 && (
        <View style={st.runningGameRow}>
          <Text maxFontSizeMultiplier={1.3} style={[st.runningGameName, { color: c.textMuted }]}>Back 9</Text>
          <Text maxFontSizeMultiplier={1.3} style={[st.runningGameValue, { color: c.text }]}>{segmentLeader(back)}</Text>
        </View>
      )}
      <View style={st.runningGameRow}>
        <Text maxFontSizeMultiplier={1.3} style={[st.runningGameName, { color: c.textMuted }]}>Overall</Text>
        <Text maxFontSizeMultiplier={1.3} style={[st.runningGameValue, { color: c.text }]}>{segmentLeader(holes)}</Text>
      </View>
    </View>
  );
});

export const RunningSnakePanel = memo(function RunningSnakePanel({
  players, holes, allScores,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  let holder: string | null = null;
  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    holeScores.forEach((s, pid) => {
      if (s.putts >= 3) holder = pid;
    });
  });
  const holderPlayer = holder ? players.find((p) => p.id === holder) : null;

  return (
    <View style={st.runningGameSection}>
      <Text maxFontSizeMultiplier={1.3} style={[st.runningGameTitle, { color: c.gold, fontFamily: GEO }]}>SNAKE</Text>
      <View style={st.runningGameRow}>
        <Text maxFontSizeMultiplier={1.3} style={[st.runningGameName, { color: c.textMuted }]}>Current holder</Text>
        <Text maxFontSizeMultiplier={1.3} style={[st.runningGameValue, { color: holder ? c.urgent : c.teal }]}>
          {holderPlayer ? pName(holderPlayer) : 'Nobody'}
        </Text>
      </View>
    </View>
  );
});

export const RunningWolfPanel = memo(function RunningWolfPanel({
  players, holes, allScores, wolfHoleDecisions, currentHoleNumber,
}: {
  players: PlayerConfig[];
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
  wolfHoleDecisions: Map<number, WolfHoleState>;
  currentHoleNumber: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  // Only count holes up to and including currentHoleNumber
  const holesUpToNow = holes.filter((h) => h.number <= currentHoleNumber);
  const points = computeWolfPoints(players, holesUpToNow, allScores, wolfHoleDecisions);

  const wolfDecision = wolfHoleDecisions.get(currentHoleNumber);
  const wolfPlayer = wolfDecision ? players.find((p) => p.id === wolfDecision.wolfPlayerId) : null;

  return (
    <View style={st.runningGameSection}>
      <Text maxFontSizeMultiplier={1.3} style={[st.runningGameTitle, { color: c.gold, fontFamily: GEO }]}>WOLF</Text>
      {wolfPlayer && (
        <View style={st.runningGameRow}>
          <Text maxFontSizeMultiplier={1.3} style={[st.runningGameName, { color: c.textMuted }]}>Current Wolf</Text>
          <Text maxFontSizeMultiplier={1.3} style={[st.runningGameValue, { color: c.teal }]}>
            {pName(wolfPlayer)}{wolfDecision?.decision === 'lone' ? ' (Lone)' : wolfDecision?.decision === 'blind' ? ' (Blind)' : ''}
          </Text>
        </View>
      )}
      {players.map((p) => (
        <View key={p.id} style={st.runningGameRow}>
          <Text maxFontSizeMultiplier={1.3} style={[st.runningGameName, { color: p.id === '1' ? c.teal : c.text }]}>
            {p.id === '1' ? 'You' : p.name.split(' ')[0]}
          </Text>
          <Text maxFontSizeMultiplier={1.3} style={[st.runningGameValue, { color: c.text, fontFamily: GEO }]}>
            {points.get(p.id) ?? 0} pts
          </Text>
        </View>
      ))}
    </View>
  );
});

export const RunningBBBPanel = memo(function RunningBBBPanel({
  players, bbbHolePoints,
}: {
  players: PlayerConfig[];
  bbbHolePoints: Map<number, BBBHolePoints>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const totals = new Map<string, { bingo: number; bango: number; bongo: number }>();
  players.forEach((p) => totals.set(p.id, { bingo: 0, bango: 0, bongo: 0 }));

  bbbHolePoints.forEach((hp) => {
    if (hp.bingo) { const t = totals.get(hp.bingo); if (t) t.bingo++; }
    if (hp.bango) { const t = totals.get(hp.bango); if (t) t.bango++; }
    if (hp.bongo) { const t = totals.get(hp.bongo); if (t) t.bongo++; }
  });

  return (
    <View style={st.runningGameSection}>
      <Text maxFontSizeMultiplier={1.3} style={[st.runningGameTitle, { color: c.gold, fontFamily: GEO }]}>BINGO BANGO BONGO</Text>
      {players.map((p) => {
        const t = totals.get(p.id) ?? { bingo: 0, bango: 0, bongo: 0 };
        const total = t.bingo + t.bango + t.bongo;
        return (
          <View key={p.id} style={st.runningGameRow}>
            <Text maxFontSizeMultiplier={1.3} style={[st.runningGameName, { color: p.id === '1' ? c.teal : c.text }]}>
              {p.id === '1' ? 'You' : p.name.split(' ')[0]}
            </Text>
            <Text maxFontSizeMultiplier={1.3} style={[st.runningGameValue, { color: c.text, fontFamily: GEO }]}>
              {total} ({t.bingo}/{t.bango}/{t.bongo})
            </Text>
          </View>
        );
      })}
      <Text maxFontSizeMultiplier={1.3} style={[st.runningGameNote, { color: c.textMuted }]}>
        Bi/Ba/Bo
      </Text>
    </View>
  );
});

// ─── Collapsible Side Game Ticker (used in header area) ─────────────
export const SideGameTicker = memo(function SideGameTicker({
  sideGameKeys,
  expanded,
  onToggle,
  holes,
  allScores,
  players,
}: {
  sideGameKeys: string[];
  expanded: boolean;
  onToggle: () => void;
  holes: HoleData[];
  allScores: Map<number, Map<string, HoleScore>>;
  players: PlayerConfig[];
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      accessibilityLabel={expanded ? 'Collapse side games' : 'Expand side games'}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      style={[st.sideGameTicker, theme.isDark ? tickerShadowDark : tickerShadowLight]}
    >
      {!expanded ? (
        <View style={st.sideGameTickerCollapsed}>
          <Text style={st.sideGameTickerText} maxFontSizeMultiplier={1.3}>
            {sideGameKeys.includes('dots') ? `Dots: ${(() => {
              let d = 0;
              holes.forEach((h) => {
                const s = allScores.get(h.number)?.get('1');
                if (s) {
                  const diff = s.gross - h.par;
                  if (diff <= -2) d += 2;
                  else if (diff === -1) d += 1;
                  else if (diff >= 2) d -= 1;
                }
              });
              return d >= 0 ? `+${d}` : `${d}`;
            })()}` : ''}
            {sideGameKeys.includes('dots') && sideGameKeys.includes('skins') ? ' | ' : ''}
            {sideGameKeys.includes('skins') ? `Skins: ${(() => {
              let wins = 0;
              let carry = 0;
              holes.forEach((h) => {
                const hs = allScores.get(h.number);
                if (!hs || hs.size < players.length) { carry++; return; }
                let best = Infinity;
                let w: string[] = [];
                hs.forEach((s, pid) => { if (s.gross < best) { best = s.gross; w = [pid]; } else if (s.gross === best) w.push(pid); });
                if (w.length === 1 && w[0] === '1') { wins += 1 + carry; carry = 0; }
                else if (w.length === 1) carry = 0;
                else carry++;
              });
              return wins;
            })()}` : ''}
            {(sideGameKeys.includes('dots') || sideGameKeys.includes('skins')) && sideGameKeys.includes('snake') ? ' | ' : ''}
            {sideGameKeys.includes('snake') ? `Snake: ${(() => {
              let holder: string | null = null;
              holes.forEach((h) => {
                const hs = allScores.get(h.number);
                if (!hs) return;
                hs.forEach((s, pid) => { if (s.putts >= 3) holder = pid; });
              });
              if (!holder) return 'None';
              const hp = players.find((p) => p.id === holder);
              return hp ? (hp.id === '1' ? 'You' : hp.name.split(' ')[0]) : 'None';
            })()}` : ''}
            {sideGameKeys.length > 0 && !sideGameKeys.includes('dots') && !sideGameKeys.includes('skins') && !sideGameKeys.includes('snake')
              ? sideGameKeys.map((k) => SIDE_GAME_DISPLAY[k] ?? k).join(' | ')
              : ''}
          </Text>
          <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.6)" />
        </View>
      ) : (
        <View style={st.sideGameTickerExpanded}>
          <View style={st.sideGameTickerExpandedHeader}>
            <Text style={[st.sideGameTickerTitle, { fontFamily: GEO }]} maxFontSizeMultiplier={1.3}>SIDE GAMES</Text>
            <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.6)" />
          </View>
          {sideGameKeys.map((key) => (
            <Text key={key} style={st.sideGameTickerLine} maxFontSizeMultiplier={1.3}>
              {SIDE_GAME_DISPLAY[key] ?? key}: Active
            </Text>
          ))}
        </View>
      )}
    </Pressable>
  );
});
