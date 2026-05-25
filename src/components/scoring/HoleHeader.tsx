import React, { memo } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GEO } from '../../theme/fonts';
import { greenHeaderGradient } from '../../theme/colors';
import { scoringStyles as st } from './styles';

// Abbreviate long course names for header display
function abbreviateCourseName(name: string): string {
  if (name.length <= 30) return name;
  const dashIdx = name.indexOf(' - ');
  if (dashIdx > 0) {
    const facility = name.slice(0, dashIdx);
    const course = name.slice(dashIdx + 3);
    const shortFacility = facility
      .replace(/\s+Golf\s+(Course|Club|Links|Resort)$/i, '')
      .trim();
    const shortCourse = course.replace(/\s+Course$/i, '').trim();
    return `${shortFacility} - ${shortCourse}`;
  }
  return name
    .replace(/\s+Golf\s+(Course|Club|Links|Resort)$/i, '')
    .trim();
}

export const HoleHeader = memo(function HoleHeader({
  courseName,
  holeNumber,
  holePar,
  format,
  totalHoles,
  holesScored,
  onLeaderboard,
  onFeed,
  unreadFeedCount,
  viewMode,
  onToggleViewMode,
  holeYardage,
  holeHcp,
  onPrevHole,
  onNextHole,
  canPrevHole,
  canNextHole,
  competitionCount = 0,
  roundType,
}: {
  courseName: string;
  holeNumber: number;
  holePar: number;
  format: string;
  totalHoles: number;
  holesScored: number;
  onLeaderboard?: () => void;
  onFeed?: () => void;
  unreadFeedCount?: number;
  viewMode?: 'solo' | 'all';
  onToggleViewMode?: () => void;
  holeYardage?: number;
  holeHcp?: number;
  onPrevHole?: () => void;
  onNextHole?: () => void;
  canPrevHole?: boolean;
  canNextHole?: boolean;
  competitionCount?: number;
  roundType?: string;
}) {
  const router = useRouter();

  return (
    <LinearGradient
      colors={[...greenHeaderGradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={st.header}
    >
      <View style={st.headerOverlay} />

      {/* Top bar */}
      <View style={st.headerTop}>
        <Pressable
          onPress={() => {
            Alert.alert(
              'Leave Round?',
              'Your scores will be lost if you leave.',
              [
                { text: 'Stay', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: () => router.back() },
              ],
            );
          }}
          accessibilityLabel="Leave round"
          accessibilityRole="button"
          hitSlop={12}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={[st.headerCourseName, { fontFamily: GEO }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {abbreviateCourseName(courseName)}
        </Text>
        <View style={st.headerActions}>
          {onToggleViewMode && (
            <Pressable onPress={onToggleViewMode} hitSlop={8} accessibilityLabel={viewMode === 'solo' ? 'Switch to all players view' : 'Switch to solo player view'} accessibilityRole="button">
              <Ionicons
                name={viewMode === 'solo' ? 'person-outline' : 'people-outline'}
                size={18}
                color="#fff"
              />
            </Pressable>
          )}
          {onFeed && (
            <Pressable onPress={onFeed} hitSlop={8} style={st.headerActionBtn} accessibilityLabel={`Live feed${(unreadFeedCount ?? 0) > 0 ? `, ${unreadFeedCount} new` : ''}`} accessibilityRole="button">
              <Ionicons name="newspaper-outline" size={18} color="#fff" />
              {(unreadFeedCount ?? 0) > 0 && (
                <View style={st.feedBadge}>
                  <Text style={st.feedBadgeText}>{unreadFeedCount}</Text>
                </View>
              )}
            </Pressable>
          )}
          {onLeaderboard && (
            <Pressable onPress={onLeaderboard} hitSlop={8} style={{ position: 'relative' }} accessibilityLabel={`Leaderboard${competitionCount > 1 ? `, ${competitionCount} competitions` : ''}`} accessibilityRole="button">
              <Ionicons name="trophy-outline" size={18} color="#D4AF37" />
              {competitionCount != null && competitionCount > 1 && (
                <View style={st.compBadge}>
                  <Text style={st.compBadgeText}>{competitionCount}</Text>
                </View>
              )}
            </Pressable>
          )}
          <Text style={st.headerThrough}>
            {holesScored}/{totalHoles}
          </Text>
        </View>
      </View>

      {/* Hole info */}
      <View style={st.headerHoleRow}>
        <Pressable
          onPress={onPrevHole}
          disabled={!canPrevHole}
          accessibilityLabel="Previous hole"
          accessibilityRole="button"
          hitSlop={12}
          style={{ opacity: canPrevHole ? 1 : 0.2 }}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={{ alignItems: 'center' }} accessible={true} accessibilityLabel={`Hole ${holeNumber}, par ${holePar}${holeYardage ? `, ${holeYardage} yards` : ''}`}>
          <Text style={[st.headerHoleLabel]}>HOLE</Text>
          <Text style={[st.headerHoleNum, { fontFamily: GEO }]} allowFontScaling={false}>{holeNumber}</Text>
          <Text style={st.headerHoleDetail}>
            Par {holePar}{holeYardage ? ` \u2022 ${holeYardage} yds` : ''} {'\u2022'} HCP {holeHcp ?? '-'}
          </Text>
        </View>
        <Pressable
          onPress={onNextHole}
          disabled={!canNextHole}
          accessibilityLabel="Next hole"
          accessibilityRole="button"
          hitSlop={12}
          style={{ opacity: canNextHole ? 1 : 0.2 }}
        >
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Round context badges + Format name */}
      <View style={st.headerFormatRow}>
        {roundType && roundType.length > 0 && (
          <View style={[
            st.roundTypeBadge,
            {
              backgroundColor: roundType.includes('\u00B7') ? '#C9A227' :
                roundType === 'Competitive' ? '#C9A227' :
                roundType === 'Matchup' ? '#006747' :
                roundType.toLowerCase() === 'casual' ? 'rgba(255,255,255,0.25)' : '#C9A227',
            },
          ]}>
            <Text style={[st.roundTypeBadgeText, {
              color: roundType.toLowerCase() === 'casual' ? 'rgba(255,255,255,0.8)' : '#1E4D2B',
            }]}>
              {roundType.toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={st.headerFormat} maxFontSizeMultiplier={1.3}>{format}</Text>
      </View>
    </LinearGradient>
  );
});
