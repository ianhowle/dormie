import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import type { HoleScore } from '../../scoring/types';
import { scoringStyles as st } from './styles';

export const LogHoleTags = memo(function LogHoleTags({
  myScore,
  sideGameKeys,
  onToggleTag,
}: {
  myScore: HoleScore;
  sideGameKeys: string[];
  onToggleTag: (tag: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const tags = myScore.tags ?? [];

  return (
    <View style={st.tagSection}>
      <Text style={[st.tagSectionTitle, { fontFamily: GEO }]}>LOG THIS HOLE</Text>
      <View style={st.tagRow}>
        {(['Sand', 'Trees', 'Water', 'Penalty', 'Up & Down'] as const).map((tag) => {
          const isSelected = tags.includes(tag);
          let indicator = '';
          if (tag === 'Sand' && sideGameKeys.includes('dots') && isSelected) indicator = '-1 dot';
          if (tag === 'Trees' && sideGameKeys.includes('bark') && isSelected) indicator = 'Barkie?';

          return (
            <Pressable
              key={tag}
              onPress={() => onToggleTag(tag)}
              style={({ pressed }) => [
                st.tagPill,
                {
                  backgroundColor: isSelected ? `${c.teal}20` : c.elevated,
                  borderColor: isSelected ? c.teal : c.border,
                },
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={[st.tagPillText, { color: isSelected ? c.teal : c.textMuted }]}>
                {tag}
              </Text>
              {indicator.length > 0 && (
                <Text style={[st.tagIndicator, { color: c.gold, fontFamily: GEO }]}>
                  {indicator}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});
