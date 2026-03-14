/**
 * Safe haptic feedback wrapper.
 * Uses expo-haptics when available, silently no-ops otherwise.
 */

let Haptics: any = null;

try {
  Haptics = require('expo-haptics');
} catch {
  // expo-haptics not installed — haptics will be silent no-ops
}

export const haptics = {
  /** Light tap — tab switches, chip selections, toggle switches */
  light() {
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
  },
  /** Medium tap — saving a round, submitting a score */
  medium() {
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
  },
  /** Heavy tap — Dormie Moments, champion ceremony */
  heavy() {
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Heavy);
  },
  /** Success notification — round saved, trip created, friend accepted */
  success() {
    Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
  },
  /** Warning notification */
  warning() {
    Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Warning);
  },
  /** Error notification */
  error() {
    Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Error);
  },
  /** Selection tick — scrolling through pickers */
  selection() {
    Haptics?.selectionAsync?.();
  },
};
