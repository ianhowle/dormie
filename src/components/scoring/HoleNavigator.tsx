import React, { useCallback, useRef, memo } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import type { HoleData, HoleScore } from '../../scoring/types';
import { scoringStyles as st } from './styles';

const DARK_GREEN = '#1E4D2B';
/** Accessible gold for text on dark green — passes WCAG AA 4.5:1 */
const GOLD_A11Y = '#D4AF37';

export const HoleNavigator = memo(function HoleNavigator({
  holes,
  currentIdx,
  scores,
  onSelect,
  holeNotes,
}: {
  holes: HoleData[];
  currentIdx: number;
  scores: Map<number, Map<string, HoleScore>>;
  onSelect: (idx: number) => void;
  holeNotes?: Map<number, string>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const flatListRef = useRef<FlatList>(null);

  const renderItem = useCallback(
    ({ item, index }: { item: HoleData; index: number }) => {
      const isCurrent = index === currentIdx;
      const hasScores = scores.has(item.number);
      const holeScores = scores.get(item.number);
      let hasPenalties = false;
      if (holeScores) {
        holeScores.forEach((s) => {
          if (s.penalties && (s.penalties.water > 0 || s.penalties.ob > 0 || s.penalties.lost > 0)) {
            hasPenalties = true;
          }
        });
      }
      const hasNote = holeNotes?.has(item.number) && (holeNotes.get(item.number) ?? '').length > 0;

      return (
        <Pressable
          onPress={() => onSelect(index)}
          accessibilityLabel={`Hole ${item.number}, par ${item.par}${hasScores ? ', scored' : ''}${isCurrent ? ', current' : ''}`}
          accessibilityRole="button"
          style={({ pressed }) => [
            st.holeChip,
            {
              backgroundColor: isCurrent
                ? '#C9A227'
                : hasScores
                  ? `${c.teal}25`
                  : c.elevated,
              borderColor: isCurrent ? '#C9A227' : hasScores ? c.teal : c.border,
            },
            isCurrent && { borderLeftWidth: 3, borderLeftColor: DARK_GREEN },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text
            style={[
              st.holeChipNum,
              {
                color: isCurrent ? DARK_GREEN : hasScores ? c.teal : c.textMuted,
                fontFamily: GEO,
              },
              isCurrent && { fontWeight: '800' },
            ]}
          >
            {item.number}
          </Text>
          <Text
            style={[
              st.holeChipPar,
              { color: isCurrent ? DARK_GREEN : c.textMuted },
            ]}
          >
            {item.par}
          </Text>
          {hasPenalties && (
            <View style={st.holeChipPenaltyDot} />
          )}
          {hasNote && (
            <View style={[st.holeChipNoteDot, { backgroundColor: c.gold }]} />
          )}
        </Pressable>
      );
    },
    [currentIdx, scores, c, holeNotes],
  );

  return (
    <FlatList
      ref={flatListRef}
      data={holes}
      renderItem={renderItem}
      keyExtractor={(h) => String(h.number)}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.holeStripContent}
      style={[st.holeStrip, { backgroundColor: c.surface, borderColor: c.border }]}
    />
  );
});

export const NavButtons = memo(function NavButtons({
  canPrev,
  canNext,
  isLast,
  onPrev,
  onNext,
  onFinish,
}: {
  canPrev: boolean;
  canNext: boolean;
  isLast: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={st.navRow}>
      <Pressable
        onPress={onPrev}
        disabled={!canPrev}
        accessibilityLabel="Previous hole"
        accessibilityRole="button"
        style={({ pressed }) => [
          st.navBtn,
          { backgroundColor: c.elevated, borderColor: c.border, opacity: canPrev ? 1 : 0.3 },
          pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
        ]}
      >
        <Ionicons name="chevron-back" size={18} color={c.text} />
        <Text style={[st.navBtnText, { color: c.text }]} maxFontSizeMultiplier={1.3}>Prev Hole</Text>
      </Pressable>

      {isLast ? (
        <Pressable
          onPress={onFinish}
          accessibilityLabel="Finish round"
          accessibilityRole="button"
          style={({ pressed }) => [
            st.navBtn, st.navFinish, { backgroundColor: DARK_GREEN },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={[st.navBtnText, { color: GOLD_A11Y, fontFamily: GEO }]} maxFontSizeMultiplier={1.3}>
            Finish Round
          </Text>
          <Ionicons name="checkmark-circle" size={18} color={GOLD_A11Y} />
        </Pressable>
      ) : (
        <Pressable
          onPress={onNext}
          accessibilityLabel="Next hole"
          accessibilityRole="button"
          style={({ pressed }) => [
            st.navBtn,
            { backgroundColor: c.teal },
            pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={[st.navBtnText, { color: '#fff' }]} maxFontSizeMultiplier={1.3}>Next Hole</Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>
      )}
    </View>
  );
});
