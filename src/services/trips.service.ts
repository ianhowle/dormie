import { supabase } from '../lib/supabase';
import type {
  Trip,
  TripInsert,
  TripUpdate,
  TripWithMembers,
  TripMember,
  TripMemberWithUser,
  TripCourse,
  TripCourseInsert,
  TripLeaderboardEntry,
} from '../lib/database.types';
import type { ScoringFormat, SideGame } from '../data/scoring';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Layer-3 fallbacks for the wizard's recent/most-used queries
// (docs/trips-wizard-redesign-spec-2026-05-05.md Phase 1.3). Used only
// when the user has no trip history AND the cross-user popular RPC also
// returns empty (very early adopter or RPC failure path).
const DEFAULT_FORMATS: ScoringFormat[] = ['stroke_play', 'match_play'];
const DEFAULT_SIDE_GAMES: SideGame[] = ['skins'];

export const tripsService = {
  /** Create a trip and add the organizer as a confirmed member. */
  async create(trip: TripInsert): Promise<Trip> {
    const { data, error } = await supabase
      .from('trips')
      .insert(trip)
      .select()
      .single();
    if (error) throw error;

    const created = data as Trip;

    // Auto-add organizer as confirmed member
    await supabase.from('trip_members').insert({
      trip_id: created.id,
      user_id: trip.organizer_id,
      rsvp_status: 'confirmed',
      role: 'organizer',
    });

    return created;
  },

  /** Get a trip with all members and their user profiles. */
  async getById(tripId: string): Promise<TripWithMembers> {
    const { data, error } = await supabase
      .from('trips')
      .select('*, trip_members(*, user:users(id, name, handicap_index, avatar_color))')
      .eq('id', tripId)
      .single();
    if (error) throw error;
    return data as TripWithMembers;
  },

  /** Get all trips the user is a member of, with members joined for avatar/player rendering. */
  async getByUser(userId: string): Promise<TripWithMembers[]> {
    const { data, error } = await supabase
      .from('trip_members')
      .select('trip:trips(*, trip_members(*, user:users(id, name, handicap_index, avatar_color)))')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((row: any) => row.trip) as TripWithMembers[];
  },

  /** Delete a trip (organizer only via RLS). Cascades to trip_members,
   *  trip_courses, trip_invites, messages, moments, etc. via FK constraints. */
  async delete(tripId: string): Promise<void> {
    const { error } = await supabase.from('trips').delete().eq('id', tripId);
    if (error) throw error;
  },

  /** Update trip details (organizer only via RLS). */
  async update(tripId: string, updates: TripUpdate): Promise<Trip> {
    const { data, error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', tripId)
      .select()
      .single();
    if (error) throw error;
    return data as Trip;
  },

  /** RSVP to a trip (update your own membership status). */
  async rsvp(tripId: string, userId: string, status: TripMember['rsvp_status']): Promise<void> {
    const { error } = await supabase
      .from('trip_members')
      .update({ rsvp_status: status })
      .eq('trip_id', tripId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  /** Invite a user to a trip (add as pending member). */
  async inviteMember(tripId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('trip_members')
      .insert({ trip_id: tripId, user_id: userId, rsvp_status: 'pending', role: 'player' });
    if (error) throw error;
  },

  /** Join a trip using an invite code (via RPC). Returns the trip ID. */
  async joinByCode(code: string): Promise<string> {
    const { data, error } = await supabase.rpc('join_trip_by_code', {
      code: code.toUpperCase(),
    });
    if (error) throw error;
    return data as string;
  },

  /** Get trip courses for a specific trip. */
  async getCourses(tripId: string): Promise<TripCourse[]> {
    const { data, error } = await supabase
      .from('trip_courses')
      .select('*, course:courses(*)')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true });
    if (error) throw error;
    return data as TripCourse[];
  },

  /** Add a course to a trip day. */
  async addCourse(tripCourse: TripCourseInsert): Promise<void> {
    const { error } = await supabase.from('trip_courses').insert(tripCourse);
    if (error) throw error;
  },

  /** Get trip leaderboard via RPC. */
  async getLeaderboard(tripId: string): Promise<TripLeaderboardEntry[]> {
    const { data, error } = await supabase.rpc('get_trip_leaderboard', {
      p_trip_id: tripId,
    });
    if (error) throw error;
    return data as TripLeaderboardEntry[];
  },

  /** Add multiple members to a trip in bulk.
   *  Supports both registered users (upsert by trip_id,user_id)
   *  and guest players (insert with user_id: null + guest_name). */
  async addMembers(
    tripId: string,
    members: (
      | { user_id: string; role?: TripMember['role']; team?: TripMember['team'] }
      | { guest_name: string; handicap?: number }
    )[],
  ): Promise<void> {
    const userRows = members
      .filter((m): m is { user_id: string; role?: TripMember['role']; team?: TripMember['team'] } => 'user_id' in m)
      .map((m) => ({
        trip_id: tripId,
        user_id: m.user_id,
        rsvp_status: 'confirmed' as const,
        role: m.role ?? 'player',
        team: m.team ?? null,
      }));

    const guestRows = members
      .filter((m): m is { guest_name: string; handicap?: number } => 'guest_name' in m)
      .map((m) => ({
        trip_id: tripId,
        user_id: null as string | null,
        guest_name: m.guest_name,
        rsvp_status: 'confirmed' as const,
        role: 'player' as const,
      }));

    // Upsert registered users (handles re-invites gracefully)
    if (userRows.length > 0) {
      const { error } = await supabase.from('trip_members').upsert(userRows, {
        onConflict: 'trip_id,user_id',
      });
      if (error) throw error;
    }

    // Insert guests (no conflict path — guests don't dedupe)
    if (guestRows.length > 0) {
      const { error } = await supabase.from('trip_members').insert(guestRows);
      if (error) throw error;
    }
  },

  /** Update a member's team assignment. */
  async updateMemberTeam(
    tripId: string,
    userId: string,
    team: 'red' | 'blue' | null,
  ): Promise<void> {
    const { error } = await supabase
      .from('trip_members')
      .update({ team })
      .eq('trip_id', tripId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  /** Get all members for a trip with user profiles. */
  async getMembers(tripId: string): Promise<TripMemberWithUser[]> {
    const { data, error } = await supabase
      .from('trip_members')
      .select('*, user:users(id, name, handicap_index, avatar_color)')
      .eq('trip_id', tripId);
    if (error) throw error;
    return (data ?? []) as TripMemberWithUser[];
  },

  /** Get rounds linked to a trip, with course info. */
  async getTripRounds(tripId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('rounds')
      .select('*, course:courses(name, par)')
      .eq('trip_id', tripId)
      .order('played_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  /** Subscribe to real-time trip member changes (joins, RSVPs). */
  subscribe(
    tripId: string,
    onUpdate: (payload: { event: string; member: TripMember }) => void
  ): RealtimeChannel {
    return supabase
      .channel(`trip:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_members',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) =>
          onUpdate({
            event: payload.eventType,
            member: payload.new as TripMember,
          })
      )
      .subscribe();
  },

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  },

  /** Recent formats the user has chosen, with three-layer fallback ladder.
   *
   * Layer 1: user's own trip history. Queried via trip_members so the
   *   organizer (auto-added as a member at trip creation) and member-only
   *   trips are both covered in a single fetch. Sorted by (isOrganizer DESC,
   *   created_at DESC) so a format the user picked themselves outranks one
   *   they merely played in. draft and cancelled trips excluded — drafts
   *   aren't real history; cancelled trips don't represent preference signal.
   *
   * Layer 2: cross-user popular via the get_popular_formats security_definer
   *   RPC. Used only when Layer 1 returns empty.
   *
   * Layer 3: hardcoded curated default. Guarantees the wizard never breaks
   *   on a brand-new install where both prior layers are empty.
   *
   * Each layer falls through only if it returns zero results. A partial
   * Layer 1 (e.g., the user has only used one format ever) is preferred
   * over Layer 2 — the user's own signal beats aggregate popularity.
   */
  async getRecentFormats(userId: string, limit = 2): Promise<ScoringFormat[]> {
    // Layer 1 — user's own recent
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select('trip:trips(format, status, created_at, organizer_id)')
        .eq('user_id', userId);
      if (!error && data) {
        type Row = {
          format: ScoringFormat;
          isOrganizer: boolean;
          createdAt: number;
        };
        const trips: Row[] = [];
        for (const row of data as any[]) {
          const t = row.trip;
          if (!t) continue;
          if (t.status === 'draft' || t.status === 'cancelled') continue;
          if (!t.format) continue;
          trips.push({
            format: t.format as ScoringFormat,
            isOrganizer: t.organizer_id === userId,
            createdAt: new Date(t.created_at).getTime(),
          });
        }
        trips.sort((a, b) => {
          if (a.isOrganizer !== b.isOrganizer) return a.isOrganizer ? -1 : 1;
          return b.createdAt - a.createdAt;
        });
        const seen = new Set<ScoringFormat>();
        const out: ScoringFormat[] = [];
        for (const t of trips) {
          if (seen.has(t.format)) continue;
          seen.add(t.format);
          out.push(t.format);
          if (out.length >= limit) break;
        }
        if (out.length > 0) return out;
      }
    } catch {
      // Fall through
    }

    // Layer 2 — cross-user popular
    try {
      const { data, error } = await supabase.rpc('get_popular_formats', { p_limit: limit });
      if (!error && Array.isArray(data) && data.length > 0) {
        return (data as string[]).slice(0, limit) as ScoringFormat[];
      }
    } catch {
      // Fall through
    }

    // Layer 3 — hardcoded curated default
    return DEFAULT_FORMATS.slice(0, limit);
  },

  /** Recent side games the user has chosen, with the same three-layer
   *  fallback ladder as getRecentFormats. side_games is a jsonb array per
   *  trip, so Layer 1 walks through trips in (isOrganizer, recency) order
   *  and flattens each trip's array into a deduplicated stream. */
  async getRecentSideGames(userId: string, limit = 2): Promise<SideGame[]> {
    // Layer 1 — user's own recent
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select('trip:trips(side_games, status, created_at, organizer_id)')
        .eq('user_id', userId);
      if (!error && data) {
        type Row = {
          sideGames: SideGame[];
          isOrganizer: boolean;
          createdAt: number;
        };
        const trips: Row[] = [];
        for (const row of data as any[]) {
          const t = row.trip;
          if (!t) continue;
          if (t.status === 'draft' || t.status === 'cancelled') continue;
          const arr = Array.isArray(t.side_games) ? (t.side_games as SideGame[]) : [];
          if (arr.length === 0) continue;
          trips.push({
            sideGames: arr,
            isOrganizer: t.organizer_id === userId,
            createdAt: new Date(t.created_at).getTime(),
          });
        }
        trips.sort((a, b) => {
          if (a.isOrganizer !== b.isOrganizer) return a.isOrganizer ? -1 : 1;
          return b.createdAt - a.createdAt;
        });
        const seen = new Set<SideGame>();
        const out: SideGame[] = [];
        for (const t of trips) {
          for (const g of t.sideGames) {
            if (seen.has(g)) continue;
            seen.add(g);
            out.push(g);
            if (out.length >= limit) break;
          }
          if (out.length >= limit) break;
        }
        if (out.length > 0) return out;
      }
    } catch {
      // Fall through
    }

    // Layer 2 — cross-user popular
    try {
      const { data, error } = await supabase.rpc('get_popular_side_games', { p_limit: limit });
      if (!error && Array.isArray(data) && data.length > 0) {
        return (data as string[]).slice(0, limit) as SideGame[];
      }
    } catch {
      // Fall through
    }

    // Layer 3 — hardcoded curated default
    return DEFAULT_SIDE_GAMES.slice(0, limit);
  },
};
