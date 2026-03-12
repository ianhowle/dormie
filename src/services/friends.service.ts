import { supabase } from '../lib/supabase';

export const friendsService = {
  async getFriends(userId: string) {
    return supabase
      .from('friends')
      .select('*, friend:profiles!friends_friend_id_fkey(*)')
      .eq('user_id', userId)
      .eq('status', 'accepted');
  },

  async sendRequest(userId: string, friendId: string) {
    return supabase.from('friends').insert({
      user_id: userId,
      friend_id: friendId,
      status: 'pending',
    });
  },

  async acceptRequest(requestId: string) {
    return supabase.from('friends').update({ status: 'accepted' }).eq('id', requestId);
  },

  async removeFriend(requestId: string) {
    return supabase.from('friends').delete().eq('id', requestId);
  },

  async searchUsers(query: string) {
    return supabase
      .from('profiles')
      .select('id, display_name, avatar_url, handicap_index')
      .ilike('display_name', `%${query}%`)
      .limit(20);
  },
};
