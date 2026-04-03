import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { cardShadowDark, cardShadowLight } from '../../theme/colors';
import { Avatar } from '../Avatar';
import { haptics } from '../../lib/haptics';
import { scoreCellLabel } from '../../lib/accessibility';
import { scoreColor, formatToPar as fmtToPar, scoreName as scoreNameUtil } from '../../lib/scoring-utils';
import { isGIR } from '../../scoring/calculations';
import type { PlayerConfig, HoleScore } from '../../scoring/types';
import { scoringStyles as st } from './styles';

const scoreName = scoreNameUtil;

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

const formatToPar = fmtToPar;

export function PlayerScoreInput({
  player,
  holePar,
  score,
  runningTotal,
  runningPar,
  netStrokes,
  scoreMode,
  onChange,
  compact,
}: {
  player: PlayerConfig;
  holePar: number;
  score: HoleScore;
  runningTotal: number;
  runningPar: number;
  netStrokes: number;
  scoreMode: string;
  onChange: (s: HoleScore) => void;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const isMe = player.id === '1';
  const showFIR = holePar >= 4;
  const gir = isGIR(score.gross, score.putts, holePar);
  const netScore = score.gross - netStrokes;
  const [showHighGrid, setShowHighGrid] = useState(false);
  const [penaltiesExpanded, setPenaltiesExpanded] = useState(false);
  const penalties = score.penalties ?? { water: 0, ob: 0, lost: 0 };
  const hasPenalties = penalties.water > 0 || penalties.ob > 0 || penalties.lost > 0;

  const setGross = (val: number) => {
    onChange({ ...score, gross: val });
  };

  const adjustGross = (delta: number) => {
    const next = Math.max(1, Math.min(15, score.gross + delta));
    haptics.light();
    onChange({ ...score, gross: next });
  };

  const adjustPutts = (delta: number) => {
    const next = Math.max(0, Math.min(score.gross, score.putts + delta));
    haptics.light();
    onChange({ ...score, putts: next });
  };

  const toggleFIR = () => {
    onChange({ ...score, fir: score.fir === true ? false : true });
  };

  const adjustPenalty = (type: 'water' | 'ob' | 'lost', delta: number) => {
    const current = penalties[type];
    const next = Math.max(0, current + delta);
    const diff = next - current;
    const newPenalties = { ...penalties, [type]: next };
    onChange({
      ...score,
      gross: Math.max(1, score.gross + diff),
      penalties: newPenalties,
    });
  };

  const gridNumbers = [1, 2, 3, 4, 5, 6, 7];

  if (compact) {
    return (
      <View
        style={[
          st.playerCardCompact,
          {
            backgroundColor: c.cardBg,
            borderColor: isMe ? 'rgba(201, 162, 39, 0.2)' : c.border,
          },
          isMe && { borderLeftWidth: 3, borderLeftColor: c.gold },
          theme.isDark ? cardShadowDark : cardShadowLight,
        ]}
      >
        <View style={st.compactHeader}>
          <Avatar id={player.id} size={22} name={player.name} />
          <Text
            style={[
              st.compactName,
              { color: isMe ? c.teal : c.text },
              isMe && { fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {isMe ? 'You' : player.name.split(' ')[0]}
          </Text>
          <Text
            style={[
              st.compactRunning,
              { color: toParColor(runningTotal - runningPar, c), fontFamily: GEO },
            ]}
          >
            {runningTotal > 0 ? formatToPar(runningTotal, runningPar) : '-'}
          </Text>
        </View>
        <View style={st.compactGrid}>
          {gridNumbers.map((n) => (
            <Pressable
              key={n}
              onPress={() => setGross(n)}
              accessibilityLabel={scoreCellLabel(n, holePar, n)}
              style={({ pressed }) => [
                st.compactGridCell,
                {
                  backgroundColor: score.gross === n ? c.teal : c.elevated,
                  borderColor: score.gross === n ? c.teal : c.border,
                },
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text
                style={[
                  st.compactGridText,
                  {
                    color: score.gross === n ? '#fff' : c.text,
                    fontFamily: GEO,
                  },
                ]}
              >
                {n}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => { if (score.gross < 8) setGross(8); else adjustGross(1); }}
            onLongPress={() => adjustGross(-1)}
            style={({ pressed }) => [
              st.compactGridCell,
              {
                backgroundColor: score.gross >= 8 ? c.teal : c.elevated,
                borderColor: score.gross >= 8 ? c.teal : c.border,
              },
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text
              style={[
                st.compactGridText,
                {
                  color: score.gross >= 8 ? '#fff' : c.text,
                  fontFamily: GEO,
                },
              ]}
            >
              {score.gross >= 8 ? score.gross : '8+'}
            </Text>
          </Pressable>
        </View>
        <View style={st.compactPuttsRow}>
          <Text style={[st.compactPuttsLabel, { color: c.textMuted }]}>P:</Text>
          <Pressable onPress={() => adjustPutts(-1)} hitSlop={6}>
            <Ionicons name="remove-circle-outline" size={16} color={c.textMuted} />
          </Pressable>
          <Text style={[st.compactPuttsValue, { color: c.text, fontFamily: GEO }]}>{score.putts}</Text>
          <Pressable onPress={() => adjustPutts(1)} hitSlop={6}>
            <Ionicons name="add-circle-outline" size={16} color={c.textMuted} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        st.playerCard,
        {
          backgroundColor: c.cardBg,
          borderColor: isMe ? 'rgba(201, 162, 39, 0.2)' : c.border,
        },
        isMe && { borderLeftWidth: 3, borderLeftColor: c.gold },
        theme.isDark ? cardShadowDark : cardShadowLight,
      ]}
    >
      {/* Player header */}
      <View style={st.playerHeader}>
        <Avatar id={player.id} size={28} name={player.name} />
        <View style={st.playerNameWrap}>
          <Text
            style={[
              st.playerNameText,
              { color: isMe ? c.teal : c.text },
              isMe && { fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {isMe ? 'You' : player.name}
          </Text>
          {netStrokes > 0 && scoreMode === 'net' && (
            <View style={[st.strokeDot, { backgroundColor: c.gold }]}>
              <Text style={st.strokeDotText}>{netStrokes}</Text>
            </View>
          )}
        </View>
        <View style={st.runningWrap}>
          <Text
            style={[
              st.runningTotal,
              { color: toParColor(runningTotal - runningPar, c), fontFamily: GEO },
            ]}
          >
            {runningTotal > 0 ? formatToPar(runningTotal, runningPar) : '-'}
          </Text>
          <Text style={[st.runningLabel, { color: c.textMuted }]}>
            thru {runningPar > 0 ? Math.round(runningPar / (runningTotal / runningTotal || 1)) : 0}
          </Text>
        </View>
      </View>

      {/* Score entry grid — 2x4 layout with golf notation */}
      <View style={st.scoreGrid2Row}>
        <View style={st.scoreGridRowInner}>
          {[1, 2, 3, 4].map((n) => {
            const selected = score.gross === n;
            const diff = n - holePar;
            const notation = selected ? (diff <= -2 ? 'eagle' : diff === -1 ? 'birdie' : diff >= 1 ? 'bogey' : 'par') : null;
            return (
              <Pressable
                key={n}
                onPress={() => setGross(n)}
                accessibilityLabel={scoreCellLabel(n, holePar, n)}
                style={({ pressed }) => [
                  st.scoreGridCell2,
                  {
                    backgroundColor: selected ? c.teal : c.elevated,
                    borderColor: selected ? c.teal : c.border,
                  },
                  selected && notation === 'birdie' && { borderWidth: 2, borderColor: c.teal },
                  selected && notation === 'eagle' && { borderWidth: 3, borderColor: c.gold },
                  selected && notation === 'bogey' && { borderWidth: 2, borderColor: c.urgent },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={[st.scoreGridText2, { color: selected ? '#fff' : c.text, fontFamily: GEO, fontWeight: selected ? '700' : '500' }]}>
                  {n}
                </Text>
                {selected && <Text style={[st.scoreGridParLabel, { color: 'rgba(255,255,255,0.7)' }]}>{scoreName(n, holePar)}</Text>}
              </Pressable>
            );
          })}
        </View>
        <View style={st.scoreGridRowInner}>
          {[5, 6, 7].map((n) => {
            const selected = score.gross === n;
            const diff = n - holePar;
            const notation = selected ? (diff <= -2 ? 'eagle' : diff === -1 ? 'birdie' : diff >= 1 ? 'bogey' : 'par') : null;
            return (
              <Pressable
                key={n}
                onPress={() => setGross(n)}
                accessibilityLabel={scoreCellLabel(n, holePar, n)}
                style={({ pressed }) => [
                  st.scoreGridCell2,
                  {
                    backgroundColor: selected ? c.teal : c.elevated,
                    borderColor: selected ? c.teal : c.border,
                  },
                  selected && notation === 'birdie' && { borderWidth: 2, borderColor: c.teal },
                  selected && notation === 'eagle' && { borderWidth: 3, borderColor: c.gold },
                  selected && notation === 'bogey' && { borderWidth: 2, borderColor: c.urgent },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={[st.scoreGridText2, { color: selected ? '#fff' : c.text, fontFamily: GEO, fontWeight: selected ? '700' : '500' }]}>
                  {n}
                </Text>
                {selected && <Text style={[st.scoreGridParLabel, { color: 'rgba(255,255,255,0.7)' }]}>{scoreName(n, holePar)}</Text>}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => { if (score.gross < 8) setGross(8); else adjustGross(1); }}
            onLongPress={() => { const n = Math.max(1, score.gross - 1); setGross(n); }}
            style={({ pressed }) => [
              st.scoreGridCell2,
              {
                backgroundColor: score.gross >= 8 ? c.teal : c.elevated,
                borderColor: score.gross >= 8 ? c.teal : c.border,
              },
              score.gross >= 8 && { borderWidth: 2, borderColor: c.urgent },
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={[st.scoreGridText2, { color: score.gross >= 8 ? '#fff' : c.text, fontFamily: GEO, fontWeight: score.gross >= 8 ? '700' : '500' }]}>
              {score.gross >= 8 ? score.gross : '8+'}
            </Text>
            {score.gross >= 8 && <Text style={[st.scoreGridParLabel, { color: 'rgba(255,255,255,0.7)' }]}>{scoreName(score.gross, holePar)}</Text>}
          </Pressable>
        </View>
      </View>

      {/* Score label */}
      <View style={st.scoreLabelRow}>
        <Text
          style={[
            st.scoreLabelText,
            { color: scoreNameColor(score.gross, holePar, c) },
          ]}
        >
          {scoreName(score.gross, holePar)}
        </Text>
        {scoreMode === 'net' && netStrokes > 0 && (
          <Text style={[st.netScore, { color: c.gold, fontFamily: GEO }]}>
            Net: {netScore}
          </Text>
        )}
      </View>

      {/* Secondary inputs: Putts, FIR, GIR */}
      <View style={st.secondaryRow}>
        <View style={st.secondaryGroup}>
          <Text style={[st.secondaryLabel, { color: c.textMuted }]}>PUTTS</Text>
          <View style={st.puttsButtonRow}>
            {[0, 1, 2, 3].map((n) => {
              const selected = score.putts === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => { haptics.light(); onChange({ ...score, putts: n }); }}
                  style={({ pressed }) => [
                    st.puttsButton,
                    {
                      backgroundColor: selected ? '#006747' : c.elevated,
                      borderColor: selected ? '#006747' : c.border,
                    },
                    pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
                  ]}
                >
                  <Text style={[st.puttsButtonText, { color: selected ? '#fff' : c.text, fontFamily: GEO }]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {showFIR && (
          <View style={st.secondaryGroup}>
            <Text style={[st.secondaryLabel, { color: c.textMuted }]}>FIR</Text>
            <Pressable
              onPress={toggleFIR}
              style={[
                st.toggleChip,
                {
                  backgroundColor: score.fir === true ? `${c.teal}20` : c.elevated,
                  borderColor: score.fir === true ? c.teal : c.border,
                },
              ]}
            >
              <Ionicons
                name={score.fir === true ? 'checkmark' : 'close'}
                size={14}
                color={score.fir === true ? c.teal : c.textMuted}
              />
            </Pressable>
          </View>
        )}

        <View style={st.secondaryGroup}>
          <Text style={[st.secondaryLabel, { color: c.textMuted }]}>GIR</Text>
          <View
            style={[
              st.toggleChip,
              {
                backgroundColor: gir ? `${c.teal}20` : c.elevated,
                borderColor: gir ? c.teal : c.border,
              },
            ]}
          >
            <Ionicons
              name={gir ? 'checkmark' : 'close'}
              size={14}
              color={gir ? c.teal : c.textMuted}
            />
          </View>
        </View>
      </View>

      {/* Penalty tracking */}
      <Pressable
        onPress={() => setPenaltiesExpanded(!penaltiesExpanded)}
        style={[st.penaltyToggleRow, { borderTopColor: 'rgba(128,128,128,0.15)' }]}
      >
        <Ionicons name="flag-outline" size={14} color={hasPenalties ? c.urgent : c.textMuted} />
        <Text style={[st.penaltyToggleLabel, { color: hasPenalties ? c.urgent : c.textMuted }]}>
          Penalties{hasPenalties ? ` (${penalties.water + penalties.ob + penalties.lost})` : ''}
        </Text>
        <Ionicons name={penaltiesExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={c.textMuted} />
      </Pressable>
      {penaltiesExpanded && (
      <View style={st.penaltyRow}>
        <View style={st.penaltyGroup}>
          <Ionicons name="water-outline" size={14} color={penalties.water > 0 ? c.urgent : c.textMuted} />
          <Text style={[st.penaltyLabel, { color: c.textMuted }]}>Water</Text>
          <View style={st.penaltyControls}>
            <Pressable onPress={() => adjustPenalty('water', -1)} hitSlop={6}>
              <Ionicons name="remove-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
            <Text style={[st.penaltyValue, { color: penalties.water > 0 ? c.urgent : c.textMuted, fontFamily: GEO }]}>
              {penalties.water}
            </Text>
            <Pressable onPress={() => adjustPenalty('water', 1)} hitSlop={6}>
              <Ionicons name="add-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={st.penaltyGroup}>
          <Ionicons name="alert-circle-outline" size={14} color={penalties.ob > 0 ? c.urgent : c.textMuted} />
          <Text style={[st.penaltyLabel, { color: c.textMuted }]}>OB</Text>
          <View style={st.penaltyControls}>
            <Pressable onPress={() => adjustPenalty('ob', -1)} hitSlop={6}>
              <Ionicons name="remove-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
            <Text style={[st.penaltyValue, { color: penalties.ob > 0 ? c.urgent : c.textMuted, fontFamily: GEO }]}>
              {penalties.ob}
            </Text>
            <Pressable onPress={() => adjustPenalty('ob', 1)} hitSlop={6}>
              <Ionicons name="add-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={st.penaltyGroup}>
          <Ionicons name="help-circle-outline" size={14} color={penalties.lost > 0 ? c.urgent : c.textMuted} />
          <Text style={[st.penaltyLabel, { color: c.textMuted }]}>Lost</Text>
          <View style={st.penaltyControls}>
            <Pressable onPress={() => adjustPenalty('lost', -1)} hitSlop={6}>
              <Ionicons name="remove-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
            <Text style={[st.penaltyValue, { color: penalties.lost > 0 ? c.urgent : c.textMuted, fontFamily: GEO }]}>
              {penalties.lost}
            </Text>
            <Pressable onPress={() => adjustPenalty('lost', 1)} hitSlop={6}>
              <Ionicons name="add-circle-outline" size={16} color={c.textMuted} />
            </Pressable>
          </View>
        </View>
      </View>
      )}
    </View>
  );
}
