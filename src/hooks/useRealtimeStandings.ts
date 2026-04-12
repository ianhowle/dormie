import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { seasonsService } from '../services/seasons.service';
import type { SeasonStandingsEntry } from '../lib/database.types';

type Options = {
  seasonId: string | null;
  /** How often to refresh standings after a change (ms) */
  debounceMs?: number;
};

/**
 * Subscribes to season_scores inserts/updates, then refetches standings
 * via get_season_standings RPC. Small debounce to coalesce bursts.
 */
export function useRealtimeStandings({ seasonId, debounceMs = 600 }: Options) {
  const [standings, setStandings] = useState<SeasonStandingsEntry[] | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!seasonId) return;
    try {
      const data = await seasonsService.getStandings(seasonId);
      setStandings(data);
      setLastUpdated(new Date());
    } catch {
      // swallow — keep last good snapshot
    }
  }, [seasonId]);

  useEffect(() => {
    if (!seasonId) return;
    refresh();
  }, [seasonId, refresh]);

  useEffect(() => {
    if (!seasonId) return;

    const channel = supabase
      .channel(`standings:${seasonId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'season_scores',
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            refresh();
          }, debounceMs);
        },
      )
      .subscribe((status: string) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [seasonId, refresh, debounceMs]);

  return { standings, isLive, lastUpdated, refresh };
}
