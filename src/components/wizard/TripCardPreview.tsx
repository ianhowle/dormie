import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { GEO } from '../../theme/fonts';
import { haptics } from '../../lib/haptics';
import { Avatar } from '../Avatar';
import {
  FORMAT_LABELS,
  SIDE_GAME_LABELS,
  type ScoringFormat,
  type SideGame,
} from '../../data/scoring';

const HAIRLINE = 'rgba(255,255,255,0.06)';

// Avatar stack constants — slightly larger than the Trips-list TripCard
// to fit the confirmation-context emphasis (28px vs 26px). Overlap and
// ring width follow the same proportions.
const AVATAR_SIZE = 28;
const AVATAR_OVERLAP = 10; // ~35% overlap
const AVATAR_RING_WIDTH = 2;
const AVATAR_MAX_VISIBLE = 4;

export interface TripCardPreviewMember {
  id: string;
  name: string;
  avatarUrl?: string;
  isOrganizer?: boolean;
}

export interface TripCardPreviewProps {
  name: string;
  destination: string;
  dateRange: string;
  members: TripCardPreviewMember[];
  format: ScoringFormat;
  sideGames: SideGame[];
  tripType: 'quick' | 'plan' | 'ryder';
  onEdit?: () => void;
}

/**
 * Confirmation-step trip card preview. Visual sibling to the Trips-list
 * inline TripCard in app/(tabs)/trips.tsx but rendered at a slightly
 * larger emphasis (Georgia serif title at 28px, 28px avatars) appropriate
 * for the wizard's Step 7 launch screen.
 *
 * Sharp edges throughout per docs/dormie-design-dna.md (the Trips-list
 * TripCard carries a legacy border-radius: 12 from earlier work; this
 * component uses 0 to match the design DNA).
 */
export function TripCardPreview({
  name,
  destination,
  dateRange,
  members,
  format,
  sideGames,
  tripType,
  onEdit,
}: TripCardPreviewProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const visible = members.slice(0, AVATAR_MAX_VISIBLE);
  const overflowCount = Math.max(0, members.length - visible.length);
  const wrapSize = AVATAR_SIZE + AVATAR_RING_WIDTH * 2;

  // Format + side games meta row, e.g.
  //   "STROKE PLAY"
  //   "STROKE PLAY + SKINS"
  //   "STROKE PLAY + SKINS + SNAKE"
  const formatGamesLine = useMemo(() => {
    const formatLabel = FORMAT_LABELS[format] ?? String(format);
    const gameLabels = sideGames
      .map((g) => SIDE_GAME_LABELS[g] ?? String(g))
      .filter(Boolean);
    if (gameLabels.length === 0) return formatLabel;
    return `${formatLabel} + ${gameLabels.join(' + ')}`;
  }, [format, sideGames]);

  // Ryder Cup gets a subtle accent so it reads as different from a quick/plan
  // trip even at the preview surface.
  const accentColor =
    tripType === 'ryder' ? '#C44B4F' : '#006747';

  const handleEditPress = () => {
    haptics.light();
    onEdit?.();
  };

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: '#151312',
          borderColor: HAIRLINE,
          borderLeftColor: accentColor,
        },
      ]}
    >
      {/* Trip name — Georgia serif, broadcast scale */}
      <Text
        style={[s.name, { color: c.text, fontFamily: GEO }]}
        numberOfLines={2}
      >
        {name || 'Untitled trip'}
      </Text>

      {/* Destination · date range */}
      <Text style={[s.destinationLine, { color: c.textMuted }]} numberOfLines={1}>
        {destination ? `${destination} · ${dateRange}` : dateRange}
      </Text>

      {/* Member avatar stack */}
      {members.length > 0 && (
        <View style={s.avatarStack}>
          {visible.map((m, i) => (
            <View
              key={m.id}
              style={[
                s.avatarStackItem,
                {
                  width: wrapSize,
                  height: wrapSize,
                  marginLeft: i > 0 ? -AVATAR_OVERLAP : 0,
                  zIndex: visible.length - i,
                  borderWidth: AVATAR_RING_WIDTH,
                  borderColor: '#151312',
                  borderRadius: wrapSize / 2,
                  backgroundColor: '#151312',
                },
              ]}
            >
              <Avatar
                id={m.id}
                name={m.name}
                photoUrl={m.avatarUrl}
                size={AVATAR_SIZE}
              />
            </View>
          ))}
          {overflowCount > 0 && (
            <View
              style={[
                s.avatarOverflow,
                {
                  width: wrapSize,
                  height: wrapSize,
                  marginLeft: -AVATAR_OVERLAP,
                  borderRadius: wrapSize / 2,
                  borderWidth: AVATAR_RING_WIDTH,
                  borderColor: '#151312',
                  backgroundColor: '#1A1816',
                },
              ]}
            >
              <Text
                style={[s.avatarOverflowText, { color: c.textMuted, fontFamily: GEO }]}
              >
                +{overflowCount}
              </Text>
            </View>
          )}
          <View style={s.memberCount}>
            <Text style={[s.memberCountText, { color: c.textMuted }]}>
              {members.length} {members.length === 1 ? 'player' : 'players'}
            </Text>
          </View>
        </View>
      )}

      {/* Format + side games line — gold small caps */}
      <Text style={[s.formatLine, { color: '#C9A227', fontFamily: GEO }]} numberOfLines={1}>
        {formatGamesLine}
      </Text>

      {/* Optional edit affordance */}
      {onEdit && (
        <Pressable
          onPress={handleEditPress}
          style={({ pressed }) => [s.editLink, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={8}
        >
          <Text style={[s.editLinkText, { color: c.textMuted }]}>
            Edit trip details →
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderLeftWidth: 3,
  },

  /* Title block */
  name: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  destinationLine: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 18,
  },

  /* Avatar stack */
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  avatarStackItem: {
    overflow: 'hidden',
  },
  avatarOverflow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverflowText: {
    fontSize: 11,
    fontWeight: '700',
  },
  memberCount: {
    marginLeft: 12,
  },
  memberCountText: {
    fontSize: 12,
  },

  /* Format + side games line */
  formatLine: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 14,
  },

  /* Edit affordance */
  editLink: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  editLinkText: {
    fontSize: 12,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
});
