// =============================================================
// TripLaunchedAvatar — cinematic-only avatar tile
// =============================================================
// Custom because the existing src/components/Avatar.tsx renders an
// 8-gradient palette tuned for app chrome; the Trip Launched spec
// locks a 6-color tonal palette that pairs with the broadcast green
// stage. Sharp-edged (Dormie design system: no border-radius), 1px
// border, optional gold ring + glow when isYou. Captain pip overlay
// renders above the tile when isCaptain (Phase 1.9e Ryder Cup).
//
// Animation is not handled here — callers wrap this in an
// Animated.View driving opacity + translateY for the per-avatar drop.
//
// Compost note (2026-05-06): the dual-palette inconsistency between
// Avatar.tsx (8 gradients) and TripLaunched (6 tonal colors) is
// flagged in docs/dormie-compost.md. Future work: unify on one.
// =============================================================

import { Image, Text, View } from 'react-native';
import TL from './tokens';

const PALETTE: string[] = TL.avatarFallback.palette;

/** Stable string→int hash. Used to pick a deterministic background
 *  color for a name's monogram fallback. */
function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0; // force 32-bit
  }
  return Math.abs(h);
}

function getMonogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export interface TripLaunchedAvatarProps {
  name: string;
  /** Optional remote photo URL. When present, replaces the monogram
   *  fallback. */
  avatarUrl?: string;
  /** Tile edge length in px. Roster variants pick from 36/40/44. */
  size: number;
  /** Highlights the user's own tile with a championshipGold border
   *  and a soft gold glow. */
  isYou?: boolean;
  /** Marks one of the two Ryder Cup captains. Renders a championshipGold
   *  rotated-diamond pip above the tile. Independent of team assignment
   *  — both captains carry the pip in undrafted mode. */
  isCaptain?: boolean;
  /** Optional team-color override for the tile border (Ryder Cup
   *  drafted modes). Ignored when isYou — the gold border wins. */
  teamColor?: string;
  /** Optional team glow color (translucent halo). Composited via iOS
   *  shadow props; ignored on Android (acceptable trade for v1). */
  teamGlow?: string;
}

export function TripLaunchedAvatar({
  name,
  avatarUrl,
  size,
  isYou,
  isCaptain,
  teamColor,
  teamGlow,
}: TripLaunchedAvatarProps) {
  const bgColor = PALETTE[hashName(name) % PALETTE.length];
  // Border priority: isYou (gold) > teamColor > neutral white-12%.
  const borderColor = isYou
    ? TL.championshipGold
    : teamColor ?? 'rgba(255,255,255,0.12)';

  // Glow priority: isYou (gold) > teamGlow > none.
  const glowStyle = isYou
    ? {
        shadowColor: TL.championshipGold,
        shadowOpacity: 0.4,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      }
    : teamGlow
      ? {
          shadowColor: teamGlow,
          shadowOpacity: 1, // teamGlow is already translucent (rgba)
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 0 },
        }
      : null;

  // Outer wrapper has NO overflow:hidden so the captain pip can extend
  // above the tile (top: -12 per token). The inner tile keeps its own
  // overflow:hidden for clean image clipping.
  return (
    <View style={{ position: 'relative', width: size, height: size }}>
      <View
        style={[
          {
            width: size,
            height: size,
            backgroundColor: bgColor,
            borderWidth: TL.avatarBorderW,
            borderColor,
            alignItems: 'center',
            justifyContent: 'center',
            // Sharp edges per Dormie design system — no borderRadius.
            overflow: 'hidden',
          },
          glowStyle,
        ]}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{
              width: size - TL.avatarBorderW * 2,
              height: size - TL.avatarBorderW * 2,
            }}
            // cover fills the (square) tile regardless of source aspect
            // ratio. Without this, a portrait avatar URL would letterbox.
            resizeMode="cover"
          />
        ) : (
          <Text
            style={{
              fontFamily: TL.avatarFallback.monogramFont.split(',')[0],
              fontSize: TL.avatarFallback.monogramSize,
              fontWeight: '700',
              color: TL.avatarFallback.monogramColor,
            }}
          >
            {getMonogram(name)}
          </Text>
        )}
      </View>
      {isCaptain ? (
        <View
          style={{
            position: 'absolute',
            top: TL.captainPipOffsetTop, // -12 per spec
            // Center horizontally on the tile via 50% + negative margin
            // (since we don't know parent width at style-build time).
            left: size / 2 - TL.captainPipSize / 2,
            width: TL.captainPipSize, // 7
            height: TL.captainPipSize, // 7
            backgroundColor: TL.captainPipColor, // championshipGold
            transform: [{ rotate: '45deg' }], // diamond
            // 6px gold halo per token captainPipGlow.
            shadowColor: TL.championshipGold,
            shadowOpacity: 0.9,
            shadowRadius: TL.captainPipGlow,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      ) : null}
    </View>
  );
}

export default TripLaunchedAvatar;
