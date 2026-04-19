/**
 * Local round storage for offline resilience.
 *
 * - Persists active round state after every hole (crash recovery)
 * - Queues completed rounds when offline (syncs on reconnect)
 * - Provides resume detection for interrupted rounds
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { onConnectivityChange, isOnline } from './networkStatus';

const ACTIVE_ROUND_KEY = 'dormie_active_round';
const OFFLINE_ROUNDS_KEY = 'dormie_offline_rounds';

// ─── Active Round (in-progress persistence) ─────────────────────────

export type ActiveRoundState = {
  /** Course info */
  courseName: string;
  courseId: string;
  coursePar: number;
  courseSlope: number;
  courseRating: number;
  courseTee: string;
  /** Player configs (serialized) */
  players: any[];
  /** Format and mode */
  formatLabel: string;
  scoreMode: string;
  holeRange: string;
  /** Scores: serialized from Map<number, Map<string, HoleScore>> */
  allScores: Record<string, Record<string, any>>;
  /** Current hole index */
  currentHoleIdx: number;
  /** Total holes in round */
  totalHoles: number;
  /** Timestamp */
  startedAt: string;
  updatedAt: string;
  /** Optional context */
  tripId?: string;
  linkedSeasons?: any[];
  /** Side game keys */
  sideGames?: string[];
  /** Hole data passed from setup */
  holeData?: any[];
  /** Round type */
  roundType?: string;
};

/**
 * Serialize the allScores Map into a plain object for JSON storage.
 * Map<number, Map<string, HoleScore>> → Record<string, Record<string, HoleScore>>
 */
export function serializeScores(
  allScores: Map<number, Map<string, any>>,
): Record<string, Record<string, any>> {
  const result: Record<string, Record<string, any>> = {};
  allScores.forEach((playerMap, holeNum) => {
    const players: Record<string, any> = {};
    playerMap.forEach((score, playerId) => {
      players[playerId] = score;
    });
    result[String(holeNum)] = players;
  });
  return result;
}

/**
 * Deserialize stored scores back into the Map structure.
 */
export function deserializeScores(
  raw: Record<string, Record<string, any>>,
): Map<number, Map<string, any>> {
  const map = new Map<number, Map<string, any>>();
  for (const [holeStr, players] of Object.entries(raw)) {
    const playerMap = new Map<string, any>();
    for (const [playerId, score] of Object.entries(players)) {
      playerMap.set(playerId, score);
    }
    map.set(Number(holeStr), playerMap);
  }
  return map;
}

/** Save active round state (call after every hole). */
export async function saveActiveRound(state: ActiveRoundState): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_ROUND_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[roundStorage] Failed to save active round:', e);
  }
}

/** Get the active round (if any). */
export async function getActiveRound(): Promise<ActiveRoundState | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_ROUND_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Clear the active round (on completion or discard). */
export async function clearActiveRound(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_ROUND_KEY);
  } catch {}
}

/**
 * Compute how many holes have been scored in a saved round.
 */
export function holesCompleted(state: ActiveRoundState): number {
  return Object.keys(state.allScores).length;
}

// ─── Offline Completed Rounds Queue ─────────────────────────────────

export type OfflineRound = {
  id: string;
  userId: string;
  courseId: string;
  courseName: string;
  courseSlope?: number;
  courseRating?: number;
  grossScore: number;
  netScore: number | null;
  holeScores: { hole: number; gross: number; putts?: number; fir?: boolean }[];
  source: 'app';
  playedAt: string;
  queuedAt: string;
  tripId?: string;
  seasonWeekId?: string;
  linkedSeasons?: any[];
  /** Course pars per hole, needed for Stableford calculation during offline sync */
  coursePars?: number[];
};

/** Queue a completed round for later sync. */
export async function queueOfflineRound(round: OfflineRound): Promise<void> {
  try {
    const existing = await getOfflineRounds();
    existing.push(round);
    await AsyncStorage.setItem(OFFLINE_ROUNDS_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('[roundStorage] Failed to queue offline round:', e);
  }
}

/** Get all queued offline rounds. */
export async function getOfflineRounds(): Promise<OfflineRound[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_ROUNDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Remove a specific round from the queue after successful sync. */
export async function removeOfflineRound(id: string): Promise<void> {
  try {
    const existing = await getOfflineRounds();
    const filtered = existing.filter((r) => r.id !== id);
    await AsyncStorage.setItem(OFFLINE_ROUNDS_KEY, JSON.stringify(filtered));
  } catch {}
}

/** Clear all offline rounds. */
export async function clearOfflineRounds(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_ROUNDS_KEY);
  } catch {}
}

/**
 * Sync all queued offline rounds to Supabase.
 * Returns { synced: number, failed: number }.
 */
export async function syncOfflineRounds(): Promise<{ synced: number; failed: number }> {
  const rounds = await getOfflineRounds();
  if (rounds.length === 0) return { synced: 0, failed: 0 };

  // Lazy import to avoid circular deps
  const { roundsService } = await import('../services/rounds.service');
  const { coursesService } = await import('../services/courses.service');

  let synced = 0;
  let failed = 0;

  for (const round of rounds) {
    try {
      let finalCourseId: string | null = round.courseId || null;
      if (finalCourseId && finalCourseId.startsWith('custom-')) finalCourseId = null;
      if (!finalCourseId && round.courseName) {
        try {
          const course = await coursesService.ensureCourse({
            name: round.courseName,
            location: round.courseName,
            slope: round.courseSlope,
            rating: round.courseRating,
          });
          finalCourseId = course.id;
        } catch {
          finalCourseId = null;
        }
      }

      const savedRound = await roundsService.create({
        user_id: round.userId,
        course_id: finalCourseId,
        gross_score: round.grossScore,
        net_score: round.netScore,
        hole_scores: round.holeScores,
        source: 'app',
        played_at: round.playedAt,
        course_name: round.courseName || null,
        course_slope: round.courseSlope ?? null,
        course_rating: round.courseRating ?? null,
        course_source: 'golfapi',
        ...(round.tripId ? { trip_id: round.tripId } : {}),
        ...(round.seasonWeekId ? { season_week_id: round.seasonWeekId } : {}),
      });

      // Sync linked seasons if any — use processSeasonRound for proper
      // Stableford calculation instead of writing raw gross scores.
      if (round.linkedSeasons && round.linkedSeasons.length > 0 && round.holeScores.length > 0) {
        const { processSeasonRound } = await import('../services/scoring.service');
        const coursePars = round.coursePars ?? round.holeScores.map(() => 4); // fallback par 4
        for (const ls of round.linkedSeasons) {
          try {
            await processSeasonRound({
              roundId: savedRound.id,
              userId: round.userId,
              seasonWeekId: ls.seasonWeekId ?? ls.seasonId,
              seasonId: ls.seasonId,
              holeScores: round.holeScores,
              coursePars,
            });
          } catch (err) {
            console.error('[roundStorage] Season sync failed for season', ls.seasonId, err);
          }
        }
      }

      await removeOfflineRound(round.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

// ─── Auto-sync on reconnect ─────────────────────────────────────────

let syncListenerRegistered = false;
let onSyncCallback: ((result: { synced: number; failed: number }) => void) | null = null;

/**
 * Register the auto-sync listener. Call once at app startup.
 * When connectivity returns, queued rounds sync automatically.
 */
export function registerOfflineSync(
  onSync?: (result: { synced: number; failed: number }) => void,
): () => void {
  if (syncListenerRegistered) return () => {};
  syncListenerRegistered = true;
  if (onSync) onSyncCallback = onSync;

  const unsub = onConnectivityChange(async (online) => {
    if (!online) return;
    const result = await syncOfflineRounds();
    if (result.synced > 0 && onSyncCallback) {
      onSyncCallback(result);
    }
  });

  return () => {
    unsub();
    syncListenerRegistered = false;
    onSyncCallback = null;
  };
}
