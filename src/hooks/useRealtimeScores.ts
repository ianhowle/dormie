import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type RealtimeScoreEvent = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  round: any;
  at: Date;
};

type Options = {
  tripId?: string | null;
  userId?: string | null;
  courseId?: string | null;
  onEvent?: (ev: RealtimeScoreEvent) => void;
};

/**
 * Subscribes to rounds table inserts/updates scoped by trip/user/course.
 * Returns the latest events (most recent first) and a live-connection flag.
 */
export function useRealtimeScores(opts: Options = {}) {
  const [events, setEvents] = useState<RealtimeScoreEvent[]>([]);
  const [isLive, setIsLive] = useState(false);
  const onEventRef = useRef(opts.onEvent);
  onEventRef.current = opts.onEvent;

  useEffect(() => {
    const filters: string[] = [];
    if (opts.tripId) filters.push(`trip_id=eq.${opts.tripId}`);
    if (opts.userId) filters.push(`user_id=eq.${opts.userId}`);
    if (opts.courseId) filters.push(`course_id=eq.${opts.courseId}`);

    const channel = supabase
      .channel(`rounds:${filters.join(':') || 'all'}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'rounds',
          ...(filters.length > 0 ? { filter: filters.join(',') } : {}),
        },
        (payload: any) => {
          const ev: RealtimeScoreEvent = {
            type: payload.eventType,
            round: payload.new ?? payload.old,
            at: new Date(),
          };
          setEvents((prev) => [ev, ...prev].slice(0, 50));
          onEventRef.current?.(ev);
        },
      )
      .subscribe((status: string) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [opts.tripId, opts.userId, opts.courseId]);

  return { events, isLive };
}
