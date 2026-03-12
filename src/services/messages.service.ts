import { supabase } from '../lib/supabase';

export const messagesService = {
  async getMessages(tripId: string, limit = 50) {
    return supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(id, display_name, avatar_url)')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  async sendMessage(tripId: string, senderId: string, content: string) {
    return supabase.from('messages').insert({
      trip_id: tripId,
      sender_id: senderId,
      content,
    });
  },

  subscribeToMessages(tripId: string, callback: (message: unknown) => void) {
    return supabase
      .channel(`messages:${tripId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `trip_id=eq.${tripId}` },
        (payload) => callback(payload.new)
      )
      .subscribe();
  },
};
