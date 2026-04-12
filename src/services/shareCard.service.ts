import type { RefObject } from 'react';
import { Platform } from 'react-native';

type Capturable = {
  capture?: () => Promise<string>;
};

/**
 * Capture a rendered view (via react-native-view-shot ref) and share it.
 * Falls back to the Web Share API on web. No-ops cleanly if deps missing.
 */
export async function captureAndShare(
  viewRef: RefObject<Capturable | null>,
  opts: { filename?: string; mimeType?: string; dialogTitle?: string } = {},
): Promise<void> {
  const ref = viewRef.current;
  if (!ref?.capture) return;

  try {
    const uri = await ref.capture();
    if (!uri) return;

    if (Platform.OS === 'web') {
      try {
        const blob = await fetch(uri).then((r) => r.blob());
        const file = new File([blob], opts.filename ?? 'dormie.png', { type: opts.mimeType ?? 'image/png' });
        const nav: any = typeof navigator !== 'undefined' ? navigator : null;
        if (nav?.share && nav.canShare?.({ files: [file] })) {
          await nav.share({ files: [file], title: opts.dialogTitle ?? 'Dormie' });
          return;
        }
        // Fallback: trigger download
        const dl = document.createElement('a');
        dl.href = uri;
        dl.download = opts.filename ?? 'dormie.png';
        dl.click();
        return;
      } catch {
        return;
      }
    }

    const Sharing = await import('expo-sharing').catch(() => null as any);
    if (!Sharing) return;
    const available = await Sharing.isAvailableAsync();
    if (!available) return;
    await Sharing.shareAsync(uri, {
      mimeType: opts.mimeType ?? 'image/png',
      dialogTitle: opts.dialogTitle,
    });
  } catch {
    // swallow — share is fire-and-forget
  }
}
