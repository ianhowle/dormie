/**
 * Sound design system for Dormie.
 * Uses expo-av when available, silently no-ops otherwise.
 * All sounds are subtle and < 100ms — enhance, never annoy.
 *
 * Sound assets needed: assets/sounds/click.mp3, chime.mp3, pop.mp3, whoosh.mp3
 */

let Audio: any = null;
let soundInstances: Record<string, any> = {};

try {
  Audio = require('expo-av').Audio;
} catch {
  // expo-av not installed — sounds will be silent no-ops
}

// ─── Pre-load asset references with graceful fallback ───────────────
// Each require() is wrapped individually so a single missing file
// does not prevent the others from loading.
const soundAssets: Record<string, any> = {};

try {
  soundAssets.click = require('../../assets/sounds/click.mp3');
} catch {
  soundAssets.click = null;
  console.warn('[sounds] Missing asset: assets/sounds/click.mp3');
}

try {
  soundAssets.whoosh = require('../../assets/sounds/whoosh.mp3');
} catch {
  soundAssets.whoosh = null;
  console.warn('[sounds] Missing asset: assets/sounds/whoosh.mp3');
}

try {
  soundAssets.chime = require('../../assets/sounds/chime.mp3');
} catch {
  soundAssets.chime = null;
  console.warn('[sounds] Missing asset: assets/sounds/chime.mp3');
}

try {
  soundAssets.pop = require('../../assets/sounds/pop.mp3');
} catch {
  soundAssets.pop = null;
  console.warn('[sounds] Missing asset: assets/sounds/pop.mp3');
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
  // Skip silently if the asset failed to load
  if (!soundAssets[name]) return;
  try {
    if (soundInstances[name]) {
      await soundInstances[name].replayAsync();
    } else {
      const { sound } = await Audio.Sound.createAsync(soundAssets[name], {
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
