// =============================================================
// TripLaunchedAvatar — cinematic-only avatar tile
// =============================================================
// Custom because the existing src/components/Avatar.tsx renders an
// 8-gradient palette tuned for app chrome; the Trip Launched spec
// locks a 6-color tonal palette that pairs with the broadcast green
// stage. Sharp-edged (Dormie design system: no border-radius), 1px
// border, optional gold ring + glow when isYou.
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
}

export function TripLaunchedAvatar({
  name,
  avatarUrl,
  size,
  isYou,
}: TripLaunchedAvatarProps) {
  const bgColor = PALETTE[hashName(name) % PALETTE.length];
  const borderColor = isYou
    ? TL.championshipGold
    : 'rgba(255,255,255,0.12)';

  // The "you" tile gets a soft championshipGold glow. iOS shadow*
  // props composite naturally on dark backgrounds; on Android they
  // don't render — that's acceptable trade for v1 (cinematic moment
  // is iOS-first per stakeholder priority).
  const youGlowStyle = isYou
    ? {
        shadowColor: TL.championshipGold,
        shadowOpacity: 0.4,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      }
    : null;

  return (
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
        youGlowStyle,
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
  );
}

export default TripLaunchedAvatar;
