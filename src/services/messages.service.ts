import { supabase } from '../lib/supabase';
import type { TripMessage, TripMessageWithUser } from '../lib/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const messagesService = {
  /** Send a message to a trip chat. */
  async send(tripId: string, userId: string, message: string): Promise<TripMessage> {
    const { data, error } = await supabase
      .from('trip_messages')
      .insert({ trip_id: tripId, user_id: userId, message })
      .select()
      .single();
    if (error) throw error;
    return data as TripMessage;
  },

  /** Fetch messages with pagination (newest first). */
  async fetch(
    tripId: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}
  ): Promise<TripMessageWithUser[]> {
    const { data, error } = await supabase
      .from('trip_messages')
      .select('*, user:users!trip_messages_user_id_fkey(id, name, avatar_color)')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data as TripMessageWithUser[];
  },

  /** Subscribe to new messages in real time. Returns the channel for cleanup. */
  subscribe(
    tripId: string,
    onMessage: (message: TripMessage) => void
  ): RealtimeChannel {
    return supabase
      .channel(`trip_messages:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => onMessage(payload.new as TripMessage)
      )
      .subscribe();
  },

  /** Unsubscribe from a channel. */
  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  },

  /** Toggle a reaction on a message (add/remove via RPC). */
  async toggleReaction(messageId: string, emoji: string): Promise<void> {
    const { error } = await supabase.rpc('toggle_message_reaction', {
      p_message_id: messageId,
      p_emoji: emoji,
    });
    if (error) throw error;
  },
};
