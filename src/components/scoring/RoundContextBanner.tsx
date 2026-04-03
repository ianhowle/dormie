import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { GEO } from '../../theme/fonts';
import type { LinkedSeason } from '../../scoring/types';
import { scoringStyles as st } from './styles';

export const RoundContextBanner = memo(function RoundContextBanner({
  linkedSeasons,
}: {
  linkedSeasons: LinkedSeason[];
}) {
  if (linkedSeasons.length === 0) return null;

  return (
    <>
      {linkedSeasons.map((ls) => (
        <View key={ls.seasonId} style={st.seasonBanner}>
          <View style={st.seasonBannerContent}>
            <Text style={[st.seasonBannerName, { fontFamily: GEO }]}>
              {ls.seasonName} {'\u00B7'} Week {ls.weekNumber} {'\u00B7'} {ls.format} {'\u00B7'} {ls.multiplier}x
            </Text>
          </View>
        </View>
      ))}
    </>
  );
});
