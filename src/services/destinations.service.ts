import { supabase } from '../lib/supabase';

export type DestinationStatus = 'saved' | 'planning' | 'booked' | 'played';

export interface Destination {
  id: string;
  name: string;
  region: string;
  country: string;
  description: string | null;
  hero_image_url: string | null;
  hero_image_credit: string | null;
  course_count: number;
  price_tier: number | null;
  best_season: string[] | null;
  is_curated: boolean;
  is_sponsored: boolean;
  sponsored_until: string | null;
  created_at: string;
}

export interface DreamBoardEntry {
  id: string;
  user_id: string;
  destination_id: string;
  status: DestinationStatus;
  notes: string | null;
  added_at: string;
  destination: Destination;
}

export const destinationsService = {
  /** All destinations in the catalog. Sponsored entries float to the top, then alphabetical. */
  async listAll(): Promise<Destination[]> {
    const { data, error } = await supabase
      .from('destinations')
      .select('*')
      .order('is_sponsored', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Destination[];
  },

  /** A user's saved destinations, hydrated with the joined catalog row, oldest first. */
  async getDreamBoard(userId: string): Promise<DreamBoardEntry[]> {
    const { data, error } = await supabase
      .from('user_dream_board')
      .select('*, destination:destinations(*)')
      .eq('user_id', userId)
      .order('added_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as DreamBoardEntry[];
  },

  /** Add a destination to the user's Dream Board. Throws the trigger's
   *  "Dream Board limit reached" message verbatim when the cap is hit, so
   *  callers can surface it in a toast. */
  async addToDreamBoard(userId: string, destinationId: string): Promise<DreamBoardEntry> {
    const { data, error } = await supabase
      .from('user_dream_board')
      .insert({ user_id: userId, destination_id: destinationId, status: 'saved' as DestinationStatus })
      .select('*, destination:destinations(*)')
      .single();
    if (error) throw error;
    return data as DreamBoardEntry;
  },

  async updateStatus(entryId: string, status: DestinationStatus): Promise<void> {
    const { error } = await supabase
      .from('user_dream_board')
      .update({ status })
      .eq('id', entryId);
    if (error) throw error;
  },

  async removeFromDreamBoard(entryId: string): Promise<void> {
    const { error } = await supabase
      .from('user_dream_board')
      .delete()
      .eq('id', entryId);
    if (error) throw error;
  },
};
