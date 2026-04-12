import { Platform, Share } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';

/**
 * Lightweight share fallback for Dormie Moments. The full share-card capture
 * lives in ShareButton (wraps a ViewShot target); this helper is used by the
 * in-moment "SHARE" affordance where we don't already have a rendered card.
 * We share a concise text blurb via the native sheet so the CTA never
 * dead-ends if react-native-view-shot isn't in the current build.
 */
export async function shareDormieMoment(args: {
  label: string;
  playerName: string;
  detail: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const message = `${args.label}\n${args.playerName}\n${args.detail}\n\nvia Dormie`;
  try {
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        await nav.share({ title: args.label, text: message });
        return;
      }
      return;
    }
    await Share.share({ message });
  } catch {
    // swallow — share is fire-and-forget
  }
}
