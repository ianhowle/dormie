/**
 * Sound design system for Dormie.
 * Uses expo-av when available, silently no-ops otherwise.
 * All sounds are subtle and < 100ms — enhance, never annoy.
 */

let Audio: any = null;
let soundInstances: Record<string, any> = {};

try {
  Audio = require('expo-av').Audio;
} catch {
  // expo-av not installed — sounds will be silent no-ops
}

/** Whether sound effects are enabled (user preference) */
let soundEnabled = true;

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

async function playSound(name: string) {
  if (!Audio || !soundEnabled) return;
  try {
    // In production, these would load from bundled assets
    // For now, the infrastructure is ready for when sound files are added
    // to assets/sounds/click.mp3, whoosh.mp3, chime.mp3, pop.mp3
    const soundMap: Record<string, any> = {
      click: require('../../assets/sounds/click.mp3'),
      whoosh: require('../../assets/sounds/whoosh.mp3'),
      chime: require('../../assets/sounds/chime.mp3'),
      pop: require('../../assets/sounds/pop.mp3'),
    };
    if (!soundMap[name]) return;

    if (soundInstances[name]) {
      await soundInstances[name].replayAsync();
    } else {
      const { sound } = await Audio.Sound.createAsync(soundMap[name], {
        volume: 0.3, // Keep subtle
        shouldPlay: true,
      });
      soundInstances[name] = sound;
    }
  } catch {
    // Silently fail — sounds are nice-to-have
  }
}

export const sounds = {
  /** Soft click — score entry, like a ball dropping in cup */
  click: () => playSound('click'),
  /** Muted whoosh — screen transitions */
  whoosh: () => playSound('whoosh'),
  /** Celebratory chime — Dormie Moments, personal bests */
  chime: () => playSound('chime'),
  /** Subtle pop — toast notifications */
  pop: () => playSound('pop'),
};
