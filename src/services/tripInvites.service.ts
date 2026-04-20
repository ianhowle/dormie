import { supabase } from '../lib/supabase';

export type TripInvite = {
  id: string;
  trip_id: string;
  code: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  max_uses: number;
  times_used: number;
};

/** Generate a 6-char uppercase code without ambiguous characters (0/O/1/I/L). */
function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const tripInvitesService = {
  /** Create an expiring invite link for a trip. */
  async create(tripId: string): Promise<TripInvite> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const code = generateCode();
    const { data, error } = await supabase
      .from('trip_invites')
      .insert({ trip_id: tripId, code, created_by: user.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as TripInvite;
  },

  /** Join a trip using an expiring invite code. Returns the trip_id. */
  async joinByInvite(code: string): Promise<string> {
    const { data, error } = await supabase.rpc('join_trip_by_invite', {
      p_code: code.toUpperCase(),
    });
    if (error) throw new Error(error.message);
    return data as string;
  },

  /** Get all invite links for a trip (most recent first). */
  async getByTrip(tripId: string): Promise<TripInvite[]> {
    const { data, error } = await supabase
      .from('trip_invites')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as TripInvite[];
  },
};
